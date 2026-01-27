import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import {
  eachDayOfInterval,
  endOfMonth,
  isWeekend,
  startOfMonth,
} from "date-fns";
import { DbService } from "../db/db.service";
import { LeaveStatus } from "../db/types";
import {
  IdentityService,
  IdentityUserProfile,
} from "../integrations/identity.service";
import { LeaveDateResponseDto } from "./dto/leave-date-response.dto";
import {
  TeamLeaveResponseDto,
  TeamLeaveUserDto,
} from "./dto/team-leave-response.dto";
import {
  LEAVE_UPDATE_STATUSES,
  LeaveUpdateStatus,
} from "./dto/set-leave-dates.dto";

const NANOID_ALPHABET =
  "ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW";
const NANOID_SIZE = 14;

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly db: DbService,
    private readonly identityService: IdentityService,
  ) {}

  async setLeaveDates(
    userId: string,
    dates: string[],
    status: LeaveUpdateStatus,
    updatedBy: string,
  ) {
    if (!LEAVE_UPDATE_STATUSES.includes(status)) {
      throw new BadRequestException("Status must be LEAVE, HOLIDAY, or AVAILABLE");
    }

    const parsedDates = dates.map((dateString) =>
      this.parseDateString(dateString),
    );
    const uniqueDates = this.dedupeDates(parsedDates);
    const statusToPersist: LeaveStatus = status;

    try {
      const now = new Date();
      const existingRecords = await this.db.user_leave_dates.findMany({
        where: { userId, date: { in: uniqueDates } },
      });
      const existingByDate = new Map<
        string,
        (typeof existingRecords)[number]
      >();
      existingRecords.forEach((record) => {
        existingByDate.set(this.formatDateKey(record.date), record);
      });

      return await Promise.all(
        uniqueDates.map((date) => {
          const key = this.formatDateKey(date);
          const existing = existingByDate.get(key);

          if (existing) {
            return this.db.user_leave_dates.update({
              where: { id: existing.id },
              data: { status: statusToPersist, updatedBy, updatedAt: now },
            });
          }

          return this.db.user_leave_dates.create({
            data: {
              id: this.generateId(),
              userId,
              date,
              status: statusToPersist,
              createdBy: updatedBy,
              updatedBy,
              createdAt: now,
              updatedAt: now,
            },
          });
        }),
      );
    } catch (error) {
      const details = this.describeError(error);
      this.logger.error(
        `Failed to set leave dates for user ${userId}. ${JSON.stringify(details)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: "Failed to set leave dates",
        details,
      });
    }
  }

  async getLeaveDates(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<LeaveDateResponseDto[]> {
    const { start, end } = this.resolveRange(startDate, endDate);

    const [userLeaveDates, wiproHolidays] = await Promise.all([
      this.db.user_leave_dates.findMany({
        where: { userId, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      this.db.wipro_holidays.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
    ]);

    const leaveByDate = new Map<string, (typeof userLeaveDates)[number]>();
    userLeaveDates.forEach((record) => {
      const key = this.formatDateKey(record.date);
      leaveByDate.set(key, record);
    });

    const holidayByDate = new Map<string, (typeof wiproHolidays)[number]>();
    wiproHolidays.forEach((holiday) => {
      const key = this.formatDateKey(holiday.date);
      holidayByDate.set(key, holiday);
    });

    const dates = eachDayOfInterval({ start, end });

    const calendar = dates.map((day) => {
      const key = this.formatDateKey(day);
      const weekend = isWeekend(day);
      let status: LeaveStatus = weekend
        ? LeaveStatus.WEEKEND
        : LeaveStatus.AVAILABLE;
      const holiday = holidayByDate.get(key);
      const userLeave = leaveByDate.get(key);

      let isWiproHoliday = false;
      let holidayName: string | undefined;

      if (holiday) {
        status = LeaveStatus.WIPRO_HOLIDAY;
        isWiproHoliday = true;
        holidayName = holiday.name || undefined;
      }

      if (userLeave) {
        status = userLeave.status;
      }

      const response: LeaveDateResponseDto = {
        date: key,
        status,
        isWeekend: weekend,
        isWiproHoliday,
        holidayName,
      };

      return response;
    });

    return calendar;
  }

  // Note: user_leave_dates is expected to store leave or personal holiday entries for Topcoder Staff/Administrator users.
  // LeaveAccessGuard enforces that only these roles can consume the aggregated team calendar.
  async getTeamLeave(
    startDate?: Date,
    endDate?: Date,
  ): Promise<TeamLeaveResponseDto[]> {
    const { start, end } = this.resolveRange(startDate, endDate);

    const [leaveRecords, holidays] = await Promise.all([
      this.db.user_leave_dates.findMany({
        where: {
          date: { gte: start, lte: end },
          status: { in: [LeaveStatus.LEAVE, LeaveStatus.HOLIDAY] },
        },
        orderBy: { date: "asc" },
      }),
      this.db.wipro_holidays.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
    ]);

    const grouped = new Map<string, TeamLeaveUserDto[]>();
    const userIds = Array.from(
      new Set(
        leaveRecords
          .map((record) => String(record.userId))
          .filter(Boolean),
      ),
    );
    let userProfiles: IdentityUserProfile[] = [];

    if (userIds.length > 0) {
      try {
        userProfiles = await this.identityService.getUsersByIds(userIds);
      } catch (error) {
        this.logger.warn(
          "Failed to fetch user profiles for team leave calendar.",
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const userProfileById = new Map(
      userProfiles.map((profile) => [profile.userId, profile]),
    );

    leaveRecords.forEach((record) => {
      const key = this.formatDateKey(record.date);
      const profile = userProfileById.get(record.userId);
      const fallbackHandle =
        (record.updatedBy as string) ||
        (record.createdBy as string) ||
        record.userId;
      const handle = profile?.handle || fallbackHandle;
      const users = grouped.get(key) || [];
      users.push({
        userId: record.userId,
        handle,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        status: record.status,
      });
      grouped.set(key, users);
    });

    holidays.forEach((holiday) => {
      const key = this.formatDateKey(holiday.date);
      const users = grouped.get(key) || [];
      users.push({
        userId: "wipro-holiday",
        handle: holiday.name || "Wipro Holiday",
        status: LeaveStatus.WIPRO_HOLIDAY,
      });
      grouped.set(key, users);
    });

    const response: TeamLeaveResponseDto[] = Array.from(grouped.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, usersOnLeave]) => ({ date, usersOnLeave }));

    return response;
  }

  async createWiproHolidays(
    dates: string[],
    name: string | undefined,
    createdBy: string,
  ) {
    const parsedDates = dates.map((dateString) =>
      this.parseDateString(dateString),
    );
    const now = new Date();

    await this.db.wipro_holidays.createMany({
      data: parsedDates.map((date) => ({
        date,
        name,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
      })),
      skipDuplicates: true,
    });

    return this.db.wipro_holidays.findMany({
      where: { date: { in: parsedDates } },
      orderBy: { date: "asc" },
    });
  }

  async getWiproHolidays(startDate?: Date, endDate?: Date) {
    const { start, end } = this.resolveRange(startDate, endDate);
    return this.db.wipro_holidays.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    });
  }

  private parseDateString(dateString: string): Date {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateString}`);
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private resolveRange(startDate?: Date, endDate?: Date) {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (!startDate && !endDate) {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (startDate && !endDate) {
      start = startDate;
      end = endOfMonth(startDate);
    } else if (!startDate && endDate) {
      start = startOfMonth(endDate);
      end = endDate;
    } else {
      start = startDate!;
      end = endDate!;
    }

    if (start > end) {
      throw new BadRequestException(
        "startDate must be before or equal to endDate",
      );
    }

    return { start, end };
  }

  private formatDateKey(date: Date) {
    return date.toISOString().split("T")[0];
  }

  private dedupeDates(dates: Date[]): Date[] {
    const seen = new Set<string>();
    const unique: Date[] = [];

    dates.forEach((date) => {
      const key = this.formatDateKey(date);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      unique.push(date);
    });

    return unique;
  }

  private generateId(): string {
    const bytes = randomBytes(NANOID_SIZE);
    let id = "";

    for (let i = 0; i < NANOID_SIZE; i += 1) {
      id += NANOID_ALPHABET[bytes[i] & 63];
    }

    return id;
  }

  private describeError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        message: error.message,
        code: error.code,
        meta: (error.meta ?? undefined) as Record<string, unknown> | undefined,
      };
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return { message: error.message };
    }

    if (error instanceof Error) {
      return { message: error.message };
    }

    return { message: "Unknown error" };
  }
}

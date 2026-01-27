import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { DbService } from "../db/db.service";
import { LeaveStatus } from "../db/types";
import { UserRoles } from "../app-constants";
import {
  EventBusSendEmailPayload,
  EventBusService,
} from "../integrations/event-bus.service";
import {
  IdentityRoleMember,
  IdentityService,
  IdentityUserProfile,
} from "../integrations/identity.service";
import { SlackService } from "../integrations/slack.service";

@Injectable()
export class LeaveNotificationsService {
  private readonly logger = new Logger(LeaveNotificationsService.name);
  private readonly monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  constructor(
    private readonly db: DbService,
    private readonly identityService: IdentityService,
    private readonly eventBusService: EventBusService,
    private readonly slackService: SlackService,
    private readonly configService: ConfigService,
  ) {}

  @Cron("0 0 * * *", { timeZone: "UTC" })
  async sendMonthlyLeaveReminder(): Promise<void> {
    const now = new Date();
    if (!this.isLastUtcDayOfMonth(now)) {
      return;
    }

    const templateId = this.configService.get<string>(
      "SENDGRID_LEAVE_REMINDER_TEMPLATE_ID",
    );

    if (!templateId) {
      this.logger.warn(
        "Monthly leave reminder skipped: SENDGRID_LEAVE_REMINDER_TEMPLATE_ID is not set.",
      );
      return;
    }

    let members: IdentityRoleMember[];

    try {
      members = await this.identityService.listRoleMembersByName(
        UserRoles.TopcoderStaff,
      );
    } catch (error) {
      this.logger.error(
        "Failed to fetch Topcoder Staff members for leave reminder.",
        error instanceof Error ? error.stack : undefined,
      );
      return;
    }

    const recipients = this.uniqueEmails(members);

    if (recipients.length === 0) {
      this.logger.warn(
        "Monthly leave reminder skipped: no Topcoder Staff emails found.",
      );
      return;
    }

    const { month, year } = this.getReminderMonthYear(now);
    const payload = new EventBusSendEmailPayload();
    payload.sendgrid_template_id = templateId;
    payload.recipients = recipients;
    payload.data = { month, year };

    try {
      await this.eventBusService.sendEmail(payload);
      this.logger.log(
        `Monthly leave reminder sent to ${recipients.length} recipients.`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to send monthly leave reminder email.",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron("0 0 * * 1-5", { timeZone: "UTC" })
  async sendDailyLeaveSlackSummary(): Promise<void> {
    const now = new Date();
    const lockId = this.buildDailySlackSummaryLockId(now);
    const lockAcquired = await this.tryAcquireAdvisoryLock(lockId);

    if (!lockAcquired) {
      this.logger.warn(
        "Skipping daily leave Slack summary because another instance is running.",
      );
      return;
    }

    const { start, end } = this.getUtcDayRange(now);

    try {
      const leaveRecords = await this.db.user_leave_dates.findMany({
        where: {
          date: { gte: start, lte: end },
          status: { in: [LeaveStatus.LEAVE, LeaveStatus.HOLIDAY] },
        },
      });

      const fallbackByUserId = new Map<string, string>();

      leaveRecords.forEach((record) => {
        const userId = String(record.userId);
        if (!userId || fallbackByUserId.has(userId)) {
          return;
        }

        const fallbackHandle = String(
          record.updatedBy || record.createdBy || record.userId,
        );
        fallbackByUserId.set(userId, fallbackHandle);
      });

      const userIds = Array.from(fallbackByUserId.keys());
      let userProfiles: IdentityUserProfile[] = [];

      if (userIds.length > 0) {
        try {
          userProfiles = await this.identityService.getUsersByIds(userIds);
        } catch (error) {
          this.logger.warn(
            "Failed to fetch user profiles for daily leave Slack summary.",
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      const userProfileById = new Map(
        userProfiles.map((profile) => [profile.userId, profile]),
      );
      const displayNames = userIds
        .map((userId) =>
          this.getDisplayName(
            userProfileById.get(userId),
            fallbackByUserId.get(userId) ?? userId,
          ),
        )
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

      const message = this.buildSlackMessage(displayNames);
      await this.slackService.sendNotification(message);
    } catch (error) {
      this.logger.error(
        "Failed to send daily leave Slack summary.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      await this.releaseAdvisoryLock(lockId);
    }
  }

  private isLastUtcDayOfMonth(date: Date): boolean {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const nextDay = new Date(Date.UTC(year, month, date.getUTCDate() + 1));
    return nextDay.getUTCMonth() !== month;
  }

  private getUtcDayRange(date: Date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const start = new Date(Date.UTC(year, month, day));
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return { start, end };
  }

  private getReminderMonthYear(date: Date) {
    const offsetRaw = this.configService.get<string>(
      "LEAVE_REMINDER_MONTH_OFFSET",
      "1",
    );
    const offset = Number(offsetRaw);
    const monthOffset = Number.isFinite(offset) ? offset : 1;
    const target = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1),
    );
    return {
      month: this.monthFormatter.format(target),
      year: String(target.getUTCFullYear()),
    };
  }

  private uniqueEmails(members: IdentityRoleMember[]): string[] {
    const emails = members
      .map((member) => member.email)
      .filter((email): email is string => Boolean(email));
    return Array.from(new Set(emails.map((email) => email.toLowerCase())));
  }

  private buildSlackMessage(names: string[]): string {
    if (names.length === 0) {
      return "These users are on leave today:\n* None";
    }

    return [
      "These users are on leave today:",
      ...names.map((name) => `* ${name}`),
    ].join("\n");
  }

  private getDisplayName(
    profile: IdentityUserProfile | undefined,
    fallback: string,
  ): string {
    const firstName = profile?.firstName?.trim();
    const lastName = profile?.lastName?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    if (fullName) {
      return fullName;
    }

    return profile?.handle || fallback;
  }

  private buildDailySlackSummaryLockId(date: Date): bigint {
    const dayKey = date.toISOString().slice(0, 10);
    const hash = createHash("sha256")
      .update(`leave-api-v6:daily-slack-summary:${dayKey}`)
      .digest("hex")
      .slice(0, 16);

    return BigInt.asIntN(64, BigInt(`0x${hash || "0"}`));
  }

  private async tryAcquireAdvisoryLock(lockId: bigint): Promise<boolean> {
    try {
      const rows = await this.db.$queryRaw<Array<{ acquired: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_lock(${lockId}) AS acquired`,
      );

      return Boolean(rows[0]?.acquired);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        "Failed to acquire advisory lock for daily leave Slack summary.",
        err.stack,
      );
      return false;
    }
  }

  private async releaseAdvisoryLock(lockId: bigint): Promise<void> {
    try {
      await this.db.$queryRaw(
        Prisma.sql`SELECT pg_advisory_unlock(${lockId})`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        "Failed to release advisory lock for daily leave Slack summary.",
        err.stack,
      );
    }
  }
}

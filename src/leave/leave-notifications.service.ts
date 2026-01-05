import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
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
    const { start, end } = this.getUtcDayRange(new Date());

    try {
      const leaveRecords = await this.db.user_leave_dates.findMany({
        where: {
          date: { gte: start, lte: end },
          status: LeaveStatus.LEAVE,
        },
      });

      const handles = leaveRecords.map((record) =>
        String(record.updatedBy || record.createdBy || record.userId),
      );

      const uniqueHandles = Array.from(new Set(handles)).sort((a, b) =>
        a.localeCompare(b),
      );

      const message = this.buildSlackMessage(uniqueHandles);
      await this.slackService.sendNotification(message);
    } catch (error) {
      this.logger.error(
        "Failed to send daily leave Slack summary.",
        error instanceof Error ? error.stack : undefined,
      );
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

  private buildSlackMessage(handles: string[]): string {
    if (handles.length === 0) {
      return "These users are on leave today:\n* None";
    }

    return [
      "These users are on leave today:",
      ...handles.map((handle) => `* ${handle}`),
    ].join("\n");
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

interface SlackMessagePayload {
  channel: string;
  text: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly slackBotKey: string;
  private readonly slackChannelId: string;
  private readonly slackApiUrl = "https://slack.com/api/chat.postMessage";
  private readonly topcoderEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.slackBotKey = this.configService.get<string>("SLACK_BOT_KEY") || "";
    this.slackChannelId =
      this.configService.get<string>("SLACK_CHANNEL_ID") || "";
    this.topcoderEnv = this.configService.get<string>("ENV_NAME", "DEV");

    if (!this.slackBotKey || !this.slackChannelId) {
      this.logger.error(
        "Slack service configuration is incomplete. SLACK_BOT_KEY or SLACK_CHANNEL_ID is missing.",
      );
    }
  }

  async sendNotification(message: string): Promise<void> {
    if (!this.slackBotKey || !this.slackChannelId) {
      this.logger.warn(
        "Slack service is not configured. Skipping notification.",
      );
      return;
    }

    const prefix = `[${this.topcoderEnv}]`;
    const payload: SlackMessagePayload = {
      channel: this.slackChannelId,
      text: `${prefix} ${message}`,
    };

    this.logger.debug(
      `Sending Slack notification to channel ${this.slackChannelId}.`,
    );

    try {
      await firstValueFrom(
        this.httpService.post(this.slackApiUrl, payload, {
          headers: {
            Authorization: `Bearer ${this.slackBotKey}`,
            "Content-Type": "application/json; charset=utf-8",
          },
        }),
      );
      this.logger.log("Slack notification sent successfully.");
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Error sending Slack notification: ${axiosError.message}`,
        axiosError.stack,
      );
      if (axiosError.response) {
        this.logger.error(
          `Slack API Response Status: ${axiosError.response.status}`,
        );
        this.logger.error(
          `Slack API Response Data: ${JSON.stringify(
            axiosError.response.data,
          )}`,
        );
      }
    }
  }
}

import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosError, AxiosResponse } from "axios";

interface SlackMessagePayload {
  channel: string;
  text: string;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  warning?: string;
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
    if (!this.isConfigured()) {
      this.logger.warn(
        "Slack service is not configured. Skipping notification.",
      );
      return;
    }

    const payload = this.buildPayload(message);

    this.logger.debug(
      `Sending Slack notification to channel ${this.slackChannelId}.`,
    );

    try {
      await this.postMessage(payload);
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

  async sendTestNotification(message: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Slack service is not configured. SLACK_BOT_KEY or SLACK_CHANNEL_ID is missing.",
      );
    }

    const payload = this.buildPayload(message);

    this.logger.debug(
      `Sending Slack test notification to channel ${this.slackChannelId}.`,
    );

    let response: AxiosResponse<SlackApiResponse>;

    try {
      response = await this.postMessage(payload);
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
      throw new BadGatewayException(
        `Error sending Slack notification: ${axiosError.message}`,
      );
    }

    if (!response.data?.ok) {
      const slackError = response.data?.error || "unknown_error";
      this.logger.error(`Slack API responded with error: ${slackError}`);
      throw new BadGatewayException(`Slack API error: ${slackError}`);
    }

    this.logger.log("Slack test notification sent successfully.");
  }

  private isConfigured(): boolean {
    return Boolean(this.slackBotKey && this.slackChannelId);
  }

  private buildPayload(message: string): SlackMessagePayload {
    const prefix = `[${this.topcoderEnv}]`;
    return {
      channel: this.slackChannelId,
      text: `${prefix} ${message}`,
    };
  }

  private postMessage(payload: SlackMessagePayload) {
    return firstValueFrom(
      this.httpService.post<SlackApiResponse>(this.slackApiUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.slackBotKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }),
    );
  }
}

import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { M2mService } from "./m2m.service";

class EventBusMessage<T> {
  topic!: string;
  originator!: string;
  "mime-type": string = "application/json";
  timestamp: string = new Date().toISOString();
  payload!: T;
}

export class EventBusSendEmailPayload {
  data!: Record<string, unknown>;
  from: string = "no-reply@topcoder.com";
  replyTo: string = "no-reply@topcoder.com";
  version: string = "v3";
  sendgrid_template_id!: string;
  recipients!: string[];
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly m2mService: M2mService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getBusApiUrl(): string {
    return (
      this.configService.get<string>("BUS_API_URL") ||
      this.configService.get<string>("BUSAPI_URL") ||
      "http://localhost:4000/eventBus"
    );
  }

  private async postMessage<T>(topic: string, payload: T): Promise<void> {
    const token = await this.m2mService.getM2MToken();
    const msg = new EventBusMessage<T>();
    msg.topic = topic;
    msg.originator = "leave-api-v6";
    msg.payload = payload;

    const url = this.getBusApiUrl();

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, msg, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const status = response.status as HttpStatus;
      if (
        status !== HttpStatus.OK &&
        status !== HttpStatus.NO_CONTENT &&
        status !== HttpStatus.ACCEPTED
      ) {
        throw new Error(`Event bus status code: ${response.status}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown error";
      this.logger.error(`Event bus failed with error: ${message}`);
      throw new InternalServerErrorException(
        "Sending message to event bus failed.",
      );
    }
  }

  async sendEmail(payload: EventBusSendEmailPayload): Promise<void> {
    await this.postMessage("external.action.email", payload);
  }
}

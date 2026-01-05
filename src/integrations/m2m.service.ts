import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as core from "tc-core-library-js";

@Injectable()
export class M2mService {
  private readonly logger = new Logger(M2mService.name);
  private readonly m2m;

  constructor(private readonly configService: ConfigService) {
    const authUrl = this.configService.get<string>(
      "M2M_AUTH_URL",
      "http://localhost:4000/oauth/token",
    );
    const audience = this.configService.get<string>(
      "M2M_AUTH_AUDIENCE",
      "https://m2m.topcoder-dev.com/",
    );
    const proxyUrl =
      this.configService.get<string>("M2M_AUTH_PROXY_SERVER_URL") || undefined;

    this.m2m = core.auth.m2m({
      AUTH0_URL: authUrl,
      AUTH0_AUDIENCE: audience,
      AUTH0_PROXY_SERVER_URL: proxyUrl,
    });
  }

  async getM2MToken(): Promise<string> {
    const clientId = this.configService.get<string>("M2M_AUTH_CLIENT_ID");
    const clientSecret = this.configService.get<string>(
      "M2M_AUTH_CLIENT_SECRET",
    );

    if (!clientId || !clientSecret) {
      this.logger.error(
        "M2M credentials are not configured. Set M2M_AUTH_CLIENT_ID and M2M_AUTH_CLIENT_SECRET.",
      );
      throw new Error("M2M credentials are not configured.");
    }

    return (await this.m2m.getMachineToken(clientId, clientSecret)) as string;
  }
}

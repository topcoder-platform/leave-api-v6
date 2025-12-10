import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import { middleware } from "tc-core-library-js";
const { jwtAuthenticator: authenticator } = middleware;

const logger = new Logger("AuthMiddleware");

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private jwtAuthenticator;

  constructor(private configService: ConfigService) {
    const authSecret = this.configService.get<string>(
      "AUTH_SECRET",
      "mysecret",
    );
    let issuersValue = this.configService.get<string>(
      "VALID_ISSUERS",
      '["https://api.topcoder.com","https://api.topcoder-dev.com","https://topcoder-dev.auth0.com/","https://auth.topcoder-dev.com/","https://topcoder.auth0.com/","https://auth.topcoder.com/"]',
    );

    // The tc-core-library-js authenticator expects a string that is a valid JSON array.
    // This logic ensures the value is always in the correct format.
    if (!issuersValue.trim().startsWith("[")) {
      const issuersArray = issuersValue.split(",").map((s) => s.trim());
      issuersValue = JSON.stringify(issuersArray);
    }

    this.jwtAuthenticator = authenticator({
      AUTH_SECRET: authSecret,
      VALID_ISSUERS: issuersValue,
    });
  }

  use(req: any, res: Response, next: NextFunction) {
    if (req.headers.authorization) {
      this.jwtAuthenticator(req, res, (err) => {
        if (err) {
          const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
          const payload = token ? decodeTokenPayload(token) : null;
          logger.warn({
            message: "JWT authentication failed",
            error: err?.message,
            tokenIss: payload?.["iss"],
            tokenAud: payload?.["aud"],
            validIssuers: this.configService.get<string>("VALID_ISSUERS"),
          });
          return next(new UnauthorizedException(err.message));
        }
        next();
      });
    } else {
      next();
    }
  }
}

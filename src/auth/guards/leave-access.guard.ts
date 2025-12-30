import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { UserRoles } from "../../app-constants";

type AuthenticatedRequest = Request & {
  authUser?: {
    roles?: string[];
    isMachine?: boolean;
  };
};

@Injectable()
export class LeaveAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    if (request.authUser.isMachine) {
      throw new ForbiddenException(
        "M2M tokens are not allowed for this service",
      );
    }

    const roles = request.authUser.roles || [];

    if (this.hasRequiredRole(roles)) {
      return true;
    }

    throw new ForbiddenException(
      "You must have 'Topcoder Staff' or 'Administrator' role to access this resource",
    );
  }

  private hasRequiredRole(roles: string[]): boolean {
    const normalizedRoles = roles.map((role) => role.toLowerCase());
    const allowedRoles = [
      UserRoles.Admin.toLowerCase(),
      UserRoles.TopcoderStaff.toLowerCase(),
    ];

    return allowedRoles.some((role) => normalizedRoles.includes(role));
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRoles } from "../../app-constants";

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      authUser?: { roles?: string[]; isMachine?: boolean };
    }>();

    if (!request.authUser) {
      throw new UnauthorizedException();
    }

    if (request.authUser.isMachine) {
      throw new ForbiddenException(
        "M2M tokens are not allowed for this service",
      );
    }

    const roles = request.authUser.roles || [];
    const hasAdminRole = roles.some(
      (role) => role && role.toLowerCase() === UserRoles.Admin.toLowerCase(),
    );

    if (!hasAdminRole) {
      throw new ForbiddenException(
        "Only administrators can manage Wipro holidays",
      );
    }

    return true;
  }
}

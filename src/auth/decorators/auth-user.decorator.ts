import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  userId: string;
  handle: string;
  roles: string[];
  isMachine: boolean;
}

export const AuthUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ authUser?: Partial<AuthUser> }>();
    const authUser = request.authUser;

    if (!authUser) {
      return undefined;
    }

    if (data) {
      return (authUser as Record<string, unknown>)[data];
    }

    return authUser;
  },
);

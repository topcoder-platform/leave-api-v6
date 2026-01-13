import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { M2mService } from "./m2m.service";

export interface IdentityRoleMember {
  userId: number;
  handle: string;
  email: string;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly m2mService: M2mService,
  ) {}

  async listRoleMembersByName(roleName: string): Promise<IdentityRoleMember[]> {
    const token = await this.m2mService.getM2MToken();
    const roleId = await this.getRoleIdByName(roleName, token);
    if (!roleId) {
      this.logger.warn(`Role not found for name: ${roleName}`);
      return [];
    }
    return this.listRoleMembers(roleId, token);
  }

  private getIdentityApiUrl(): string {
    return (
      this.configService.get<string>("IDENTITY_API_URL") ||
      "http://localhost:4000/v6"
    );
  }

  private buildUrl(path: string): string {
    const baseUrl = this.getIdentityApiUrl().replace(/\/$/, "");
    if (!path.startsWith("/")) {
      return `${baseUrl}/${path}`;
    }
    return `${baseUrl}${path}`;
  }

  private async getRoleIdByName(
    roleName: string,
    token: string,
  ): Promise<number | null> {
    const url = this.buildUrl(
      `/roles?filter=roleName=${encodeURIComponent(roleName)}`,
    );

    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const roles = Array.isArray(response.data) ? response.data : [];
    if (roles.length === 0) {
      return null;
    }

    const normalized = roleName.toLowerCase();
    const matched =
      roles.find(
        (role) =>
          String(role.roleName || "").toLowerCase() === normalized,
      ) || roles[0];

    const roleId = Number(matched?.id);
    if (!Number.isFinite(roleId)) {
      return null;
    }

    if (roles.length > 1) {
      this.logger.warn(
        `Multiple roles matched ${roleName}. Using roleId ${roleId}.`,
      );
    }

    return roleId;
  }

  private resolvePerPage(): number {
    const raw = this.configService.get<string>(
      "IDENTITY_ROLE_MEMBER_PAGE_SIZE",
      "200",
    );
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return 200;
    }
    return Math.min(value, 1000);
  }

  private async listRoleMembers(
    roleId: number,
    token: string,
  ): Promise<IdentityRoleMember[]> {
    const perPage = this.resolvePerPage();
    const members: IdentityRoleMember[] = [];
    let page = 1;
    let total = 0;

    do {
      const url = this.buildUrl(
        `/roles/${roleId}/subjects?page=${page}&perPage=${perPage}`,
      );
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      const data = Array.isArray(response.data) ? response.data : [];
      members.push(...data);

      const totalHeader = response.headers?.["x-total"];
      const parsedTotal = totalHeader ? Number(totalHeader) : NaN;
      if (Number.isFinite(parsedTotal)) {
        total = parsedTotal;
      }

      if (!Number.isFinite(parsedTotal) && data.length < perPage) {
        break;
      }

      page += 1;
    } while (members.length < total);

    return members;
  }
}

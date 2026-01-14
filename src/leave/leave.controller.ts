import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthUser } from "../auth/decorators/auth-user.decorator";
import { AdminOnlyGuard } from "../auth/guards/admin-only.guard";
import { LeaveAccessGuard } from "../auth/guards/leave-access.guard";
import { SlackService } from "../integrations/slack.service";
import { CreateWiproHolidayDto } from "./dto/create-wipro-holiday.dto";
import { GetLeaveDatesQueryDto } from "./dto/get-leave-dates-query.dto";
import { LeaveDateResponseDto } from "./dto/leave-date-response.dto";
import { SlackTestMessageDto } from "./dto/slack-test-message.dto";
import { SetLeaveDatesDto } from "./dto/set-leave-dates.dto";
import { TeamLeaveResponseDto } from "./dto/team-leave-response.dto";
import { LeaveService } from "./leave.service";

@Controller()
@ApiTags("Leave Management")
@ApiBearerAuth()
@UseGuards(LeaveAccessGuard)
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly slackService: SlackService,
  ) {}

  @Post("/dates")
  @ApiOperation({ summary: "Set leave dates for authenticated user" })
  @ApiBody({ type: SetLeaveDatesDto })
  @ApiResponse({
    status: 200,
    description: "Leave dates successfully created or updated",
    schema: {
      example: {
        success: true,
        updatedDates: [
          { userId: "123", date: "2024-12-24T00:00:00.000Z", status: "LEAVE" },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid date format or status" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async setLeaveDates(
    @Body() dto: SetLeaveDatesDto,
    @AuthUser() authUser: AuthUser,
  ) {
    const actor = authUser.handle ?? authUser.userId;
    const result = await this.leaveService.setLeaveDates(
      authUser.userId,
      dto.dates,
      dto.status,
      actor,
    );
    return { success: true, updatedDates: result };
  }

  @Patch("/dates")
  @ApiOperation({ summary: "Update leave dates for authenticated user" })
  @ApiBody({ type: SetLeaveDatesDto })
  @ApiResponse({
    status: 200,
    description: "Leave dates successfully created or updated",
    schema: {
      example: {
        success: true,
        updatedDates: [
          {
            userId: "123",
            date: "2024-12-24T00:00:00.000Z",
            status: "AVAILABLE",
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid date format or status" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async updateLeaveDates(
    @Body() dto: SetLeaveDatesDto,
    @AuthUser() authUser: AuthUser,
  ) {
    const actor = authUser.handle ?? authUser.userId;
    const result = await this.leaveService.setLeaveDates(
      authUser.userId,
      dto.dates,
      dto.status,
      actor,
    );
    return { success: true, updatedDates: result };
  }

  @Get("/dates")
  @ApiOperation({ summary: "Get leave calendar for authenticated user" })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Leave calendar",
    type: [LeaveDateResponseDto],
  })
  @ApiResponse({ status: 400, description: "Invalid date format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getLeaveDates(
    @Query() query: GetLeaveDatesQueryDto,
    @AuthUser("userId") userId: string,
  ) {
    const { startDate, endDate } = this.parseDateRange(query);
    return this.leaveService.getLeaveDates(userId, startDate, endDate);
  }

  @Get("/team")
  @ApiOperation({
    summary: "Get leave calendar for all team members",
    description:
      'Returns leave and personal holiday records for Topcoder Staff/Administrator users and includes synthetic entries for Wipro holidays (userId "wipro-holiday", status WIPRO_HOLIDAY).',
  })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiResponse({
    status: 200,
    description:
      "Team leave calendar for Topcoder Staff/Administrator users; holidays appear as personal holiday entries or synthetic Wipro holiday entries in usersOnLeave",
    type: [TeamLeaveResponseDto],
  })
  @ApiResponse({ status: 400, description: "Invalid date format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getTeamLeave(@Query() query: GetLeaveDatesQueryDto) {
    const { startDate, endDate } = this.parseDateRange(query);
    return this.leaveService.getTeamLeave(startDate, endDate);
  }

  @Post("/wipro-holidays")
  @UseGuards(LeaveAccessGuard, AdminOnlyGuard)
  @ApiOperation({ summary: "Configure Wipro holiday dates (Admin only)" })
  @ApiBody({ type: CreateWiproHolidayDto })
  @ApiResponse({
    status: 200,
    description: "Wipro holidays configured",
    schema: {
      example: {
        success: true,
        holidays: [{ date: "2024-12-25T00:00:00.000Z", name: "Christmas" }],
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Only administrators can manage Wipro holidays",
  })
  async createWiproHolidays(
    @Body() dto: CreateWiproHolidayDto,
    @AuthUser("handle") handle: string,
  ) {
    const holidays = await this.leaveService.createWiproHolidays(
      dto.dates,
      dto.name,
      handle,
    );
    return { success: true, holidays };
  }

  @Post("/slack/test")
  @ApiOperation({ summary: "Send a test Slack message" })
  @ApiBody({ type: SlackTestMessageDto })
  @ApiResponse({
    status: 200,
    description: "Slack test message sent",
    schema: {
      example: {
        success: true,
        message:
          "Slack test message from Leave API by jane_doe at 2024-12-20T12:34:56.789Z.",
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 502, description: "Slack API error" })
  @ApiResponse({ status: 503, description: "Slack is not configured" })
  async sendSlackTestMessage(
    @Body() dto: SlackTestMessageDto,
    @AuthUser() authUser: AuthUser,
  ) {
    const actor = authUser.handle ?? authUser.userId;
    const timestamp = new Date().toISOString();
    const customMessage = dto?.message?.trim();
    const message = customMessage
      ? `Slack test message from Leave API by ${actor} at ${timestamp}. Message: ${customMessage}`
      : `Slack test message from Leave API by ${actor} at ${timestamp}.`;

    await this.slackService.sendTestNotification(message);
    return { success: true, message };
  }

  private parseDateRange(query: GetLeaveDatesQueryDto) {
    const { startDate: startDateString, endDate: endDateString } = query;
    const startDate = startDateString ? new Date(startDateString) : undefined;
    const endDate = endDateString ? new Date(endDateString) : undefined;

    if (startDateString && Number.isNaN(startDate?.getTime())) {
      throw new BadRequestException("Invalid startDate format");
    }

    if (endDateString && Number.isNaN(endDate?.getTime())) {
      throw new BadRequestException("Invalid endDate format");
    }

    return { startDate, endDate };
  }
}

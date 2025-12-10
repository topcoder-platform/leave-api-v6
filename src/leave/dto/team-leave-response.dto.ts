import { ApiProperty } from "@nestjs/swagger";
import { LeaveStatus } from "../../db/types";

export class TeamLeaveUserDto {
  @ApiProperty({
    example: "12345",
    description:
      'User identifier for the member on leave or a synthetic identifier for Wipro holidays (e.g. "wipro-holiday")',
  })
  userId!: string;

  @ApiProperty({
    example: "someHandle",
    description: "User handle or fallback identifier (holiday name when status is WIPRO_HOLIDAY)",
  })
  handle!: string;

  @ApiProperty({
    enum: LeaveStatus,
    example: LeaveStatus.LEAVE,
    description: "Leave status; WIPRO_HOLIDAY indicates a Wipro holiday entry",
  })
  status!: LeaveStatus;
}

export class TeamLeaveResponseDto {
  @ApiProperty({
    example: "2024-12-24",
    description: "Calendar date in ISO-8601 format for the combined leave calendar",
  })
  date!: string;

  @ApiProperty({
    type: [TeamLeaveUserDto],
    description:
      'Users on leave for the date; may include a synthetic Wipro holiday entry with userId "wipro-holiday" and status WIPRO_HOLIDAY',
    example: [
      { userId: "12345", handle: "someHandle", status: LeaveStatus.LEAVE },
      { userId: "wipro-holiday", handle: "Independence Day", status: LeaveStatus.WIPRO_HOLIDAY },
    ],
  })
  usersOnLeave!: TeamLeaveUserDto[];
}

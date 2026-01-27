import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
    description:
      "User handle or fallback identifier (holiday name when status is WIPRO_HOLIDAY). Calendar clients should prefer firstName/lastName when available.",
  })
  handle!: string;

  @ApiPropertyOptional({
    example: "Jane",
    description: "Member first name when available",
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: "Doe",
    description: "Member last name when available",
  })
  lastName?: string;

  @ApiProperty({
    enum: LeaveStatus,
    example: LeaveStatus.LEAVE,
    description:
      "Leave status; HOLIDAY indicates a personal holiday entry and WIPRO_HOLIDAY indicates a Wipro holiday entry",
  })
  status!: LeaveStatus;
}

export class TeamLeaveResponseDto {
  @ApiProperty({
    example: "2024-12-24",
    description:
      "Calendar date in ISO-8601 format for the combined leave calendar",
  })
  date!: string;

  @ApiProperty({
    type: [TeamLeaveUserDto],
    description:
      'Users on leave for the date; may include a personal holiday entry or a synthetic Wipro holiday entry with userId "wipro-holiday" and status WIPRO_HOLIDAY',
    example: [
      {
        userId: "12345",
        handle: "someHandle",
        firstName: "Jane",
        lastName: "Doe",
        status: LeaveStatus.LEAVE,
      },
      {
        userId: "67890",
        handle: "anotherHandle",
        firstName: "John",
        lastName: "Smith",
        status: LeaveStatus.HOLIDAY,
      },
      {
        userId: "wipro-holiday",
        handle: "Independence Day",
        status: LeaveStatus.WIPRO_HOLIDAY,
      },
    ],
  })
  usersOnLeave!: TeamLeaveUserDto[];
}

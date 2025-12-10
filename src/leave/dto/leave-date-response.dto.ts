import { ApiProperty } from "@nestjs/swagger";
import { LeaveStatus } from "../../db/types";

export class LeaveDateResponseDto {
  @ApiProperty({ example: "2024-12-24", description: "Calendar date in ISO-8601 format" })
  date!: string;

  @ApiProperty({ enum: LeaveStatus, example: LeaveStatus.LEAVE })
  status!: LeaveStatus;

  @ApiProperty({ example: true, description: "Indicates whether the date falls on a weekend" })
  isWeekend!: boolean;

  @ApiProperty({
    example: false,
    description: "Indicates whether the date is marked as a Wipro holiday",
  })
  isWiproHoliday!: boolean;

  @ApiProperty({
    required: false,
    example: "Christmas",
    description: "Optional holiday name when the date is a Wipro holiday",
  })
  holidayName?: string;
}

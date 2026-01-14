import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsDateString, IsIn } from "class-validator";
import { LeaveStatus } from "../../db/types";

export const LEAVE_UPDATE_STATUSES = [
  LeaveStatus.LEAVE,
  LeaveStatus.HOLIDAY,
  LeaveStatus.AVAILABLE,
] as const;

export type LeaveUpdateStatus = (typeof LEAVE_UPDATE_STATUSES)[number];

export class SetLeaveDatesDto {
  @ApiProperty({
    type: [String],
    example: ["2024-12-24", "2024-12-25"],
    description: "ISO-8601 dates to update for the authenticated user",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  dates!: string[];

  @ApiProperty({
    enum: LEAVE_UPDATE_STATUSES,
    example: LeaveStatus.LEAVE,
    description: "Desired status for the provided dates",
  })
  @IsIn(LEAVE_UPDATE_STATUSES)
  status!: LeaveUpdateStatus;
}

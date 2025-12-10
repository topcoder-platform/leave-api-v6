import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
} from "class-validator";
import { LeaveStatus } from "../../db/types";

export enum LeaveUpdateStatus {
  LEAVE = LeaveStatus.LEAVE,
  AVAILABLE = LeaveStatus.AVAILABLE,
}

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
    enum: LeaveUpdateStatus,
    example: LeaveUpdateStatus.LEAVE,
    description: "Desired status for the provided dates",
  })
  @IsEnum(LeaveUpdateStatus)
  status!: LeaveUpdateStatus;
}

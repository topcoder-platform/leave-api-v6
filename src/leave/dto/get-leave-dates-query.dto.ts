import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class GetLeaveDatesQueryDto {
  @ApiProperty({
    required: false,
    example: "2024-12-01",
    description:
      "Inclusive start date in ISO-8601 format. Defaults to the first day of the current month when omitted.",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    required: false,
    example: "2024-12-31",
    description:
      "Inclusive end date in ISO-8601 format. Defaults to the last day of the current month when omitted.",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateWiproHolidayDto {
  @ApiProperty({
    type: [String],
    example: ["2024-12-25", "2024-12-26"],
    description: "ISO-8601 dates to mark as Wipro holidays",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  dates!: string[];

  @ApiProperty({
    required: false,
    example: "Diwali",
    description: "Optional name that will be associated with the holiday dates",
  })
  @IsOptional()
  @IsString()
  name?: string;
}

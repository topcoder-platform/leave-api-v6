import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SlackTestMessageDto {
  @ApiProperty({
    required: false,
    example: "Hello from the Leave API.",
    description: "Optional message to include in the test Slack notification",
  })
  @IsOptional()
  @IsString()
  message?: string;
}

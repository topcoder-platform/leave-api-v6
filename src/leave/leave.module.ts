import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { LeaveController } from "./leave.controller";
import { LeaveService } from "./leave.service";

@Module({
  imports: [DbModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}

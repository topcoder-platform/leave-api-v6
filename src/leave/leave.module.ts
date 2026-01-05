import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { LeaveController } from "./leave.controller";
import { LeaveNotificationsService } from "./leave-notifications.service";
import { LeaveService } from "./leave.service";

@Module({
  imports: [DbModule, IntegrationsModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveNotificationsService],
  exports: [LeaveService],
})
export class LeaveModule {}

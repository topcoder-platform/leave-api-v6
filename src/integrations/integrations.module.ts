import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { EventBusService } from "./event-bus.service";
import { IdentityService } from "./identity.service";
import { M2mService } from "./m2m.service";
import { SlackService } from "./slack.service";

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [M2mService, EventBusService, IdentityService, SlackService],
  exports: [EventBusService, IdentityService, SlackService],
})
export class IntegrationsModule {}

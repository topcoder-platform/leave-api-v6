import {
  Injectable,
  INestApplication,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DbService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>("DATABASE_URL", "");
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  enableShutdownHooks(app: INestApplication) {
    this.$on("beforeExit", async () => {
      await app.close();
    });
  }
}

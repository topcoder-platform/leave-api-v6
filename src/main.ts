import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { DbService } from "./db/db.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable CORS
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = Number(process.env.PORT || 3000);

  // Apply the Prisma exception filter globally
  app.setGlobalPrefix("v6/leave");

  // Get PrismaService instance to handle graceful shutdown
  const prismaService = app.get(DbService);
  prismaService.enableShutdownHooks(app);

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle("Topcoder Leave Tracker API")
    .setDescription(
      "API for managing team member leave dates and Wipro holidays",
    )
    .setVersion("6.0")
    .setBasePath("v6/leave")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/v6/leave/api-docs", app, document);

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(
    `Swagger docs available at: ${await app.getUrl()}/v6/leave/api-docs`,
  );
}
bootstrap().catch(console.error);

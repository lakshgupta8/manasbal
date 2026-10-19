import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { echoRequestId, fastifyOptions } from "./logging/logging.config.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(fastifyOptions),
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  echoRequestId(app);
  // Listen on all interfaces so the API is reachable inside Docker and on Render. Locally it
  // takes 3001, since the storefront uses 3000; hosts and the Docker image set PORT.
  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}

await bootstrap();

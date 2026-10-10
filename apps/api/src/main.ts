import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // Listen on all interfaces so the API is reachable inside Docker and on Render. Locally it
  // takes 3001, since the storefront uses 3000; hosts and the Docker image set PORT.
  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}

await bootstrap();

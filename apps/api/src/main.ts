import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // Listen on all interfaces so the API is reachable inside Docker and on Render.
  await app.listen(process.env.PORT ?? 3000, "0.0.0.0");
}

await bootstrap();

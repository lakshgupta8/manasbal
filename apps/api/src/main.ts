import "temporal-polyfill/global";
import fastifyCookie from "@fastify/cookie";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { requireJwtSecret } from "./auth/jwt-secret.js";
import { requireTotpKey } from "./auth/totp-key.js";
import { webOrigins } from "./auth/web-origins.js";
import { setupDocs } from "./docs/docs.js";
import { echoRequestId, fastifyOptions } from "./logging/logging.config.js";
import { trustedProxyHops, trustProxy } from "./proxy/trusted-proxy.js";

async function bootstrap() {
  requireJwtSecret();
  requireTotpKey();
  // Read first, so a missing or malformed WEB_ORIGINS stops the start-up.
  const origins = webOrigins();
  // Behind Render's proxy every request comes from the proxy; trusting its hops makes request.ip
  // the visitor's own address, which the rate limits count by.
  const hops = trustedProxyHops();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ ...fastifyOptions, trustProxy: trustProxy(hops) }),
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  // Reads and sets the refresh_token cookie on /auth routes.
  await app.register(fastifyCookie);
  // Only the shop may call from a browser with credentials (the refresh cookie); the refresh and
  // sign-out routes also check Origin themselves (OriginGuard).
  app.enableCors({ origin: origins, credentials: true });
  echoRequestId(app);
  setupDocs(app);
  // Listen on all interfaces so the API is reachable inside Docker and on Render. Locally it
  // takes 3001, since the storefront uses 3000; hosts and the Docker image set PORT.
  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}

await bootstrap();

import { Controller, Get } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
  service: "manasbal-api";
  version: string;
}

// Liveness check used by the deploy smoke test and the uptime monitor. `version` is the
// commit baked into the image (APP_VERSION), so the smoke test can tell the new deploy
// from the old one still answering.
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok", service: "manasbal-api", version: process.env.APP_VERSION ?? "dev" };
  }
}

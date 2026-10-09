import { Controller, Get } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
  service: "manasbal-api";
}

// Liveness check used by the deploy smoke test and the uptime monitor.
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok", service: "manasbal-api" };
  }
}

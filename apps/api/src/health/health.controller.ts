import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiProperty } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

// A class rather than an interface so the OpenAPI description (and the generated SDK) knows
// the shape of the answer.
export class HealthStatus {
  @ApiProperty({ enum: ["ok"] })
  status: "ok";

  @ApiProperty({ enum: ["manasbal-api"] })
  service: "manasbal-api";

  @ApiProperty({ example: "dev" })
  version: string;
}

// Liveness check used by the deploy smoke test and the uptime monitor. `version` is the
// commit baked into the image (APP_VERSION), so the smoke test can tell the new deploy
// from the old one still answering. Monitors poll it often, so it is not rate limited.
@SkipThrottle()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthStatus })
  check(): HealthStatus {
    return { status: "ok", service: "manasbal-api", version: process.env.APP_VERSION ?? "dev" };
  }
}

import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";

export const VALKEY = Symbol("VALKEY");

// Valkey speaks the Redis protocol, so REDIS_URL (see .env.example) points at it.
// Connects on first use, so starting the app or a unit test never needs Valkey running.
export function createValkeyClient(url = process.env["REDIS_URL"] ?? "redis://localhost:6379") {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

@Module({
  providers: [{ provide: VALKEY, useFactory: () => createValkeyClient() }],
  exports: [VALKEY],
})
export class ValkeyModule implements OnApplicationShutdown {
  constructor(@Inject(VALKEY) private readonly client: Redis) {}

  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}

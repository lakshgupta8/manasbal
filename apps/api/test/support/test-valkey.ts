import { GenericContainer, Wait } from "testcontainers";

export interface TestValkey {
  url: string;
  stop(): Promise<void>;
}

// Starts a throwaway Valkey and points REDIS_URL at it. Needs Docker. Call stop() in afterAll:
// it restores REDIS_URL and removes the container.
export async function startTestValkey(): Promise<TestValkey> {
  const container = await new GenericContainer("valkey/valkey:8-alpine")
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();
  const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;

  const previousUrl = process.env["REDIS_URL"];
  process.env["REDIS_URL"] = url;

  return {
    url,
    async stop() {
      if (previousUrl === undefined) delete process.env["REDIS_URL"];
      else process.env["REDIS_URL"] = previousUrl;
      await container.stop();
    },
  };
}

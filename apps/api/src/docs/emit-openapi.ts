import { writeFile } from "node:fs/promises";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../app.module.js";
import { createOpenApiDocument } from "./docs.js";

// Writes the same description /docs-json serves to a file, without starting the server or
// touching a database. packages/types is generated from it (`pnpm api-types`). The version is
// fixed so the file only changes when an endpoint does.
async function emit(outFile: string) {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
  const document = createOpenApiDocument(app, "generated");
  await writeFile(outFile, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

const outFile = process.argv[2];
if (outFile === undefined) throw new Error("Usage: node dist/docs/emit-openapi.js <out.json>");
await emit(outFile);

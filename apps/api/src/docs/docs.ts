import type { INestApplication } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

export const DOCS_PATH = "docs";
export const DOCS_JSON_PATH = "docs-json";

export function createOpenApiDocument(app: INestApplication, version: string): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Manasbal API")
    .setDescription("HTTP API of the Manasbal storefront")
    .setVersion(version)
    .build();
  return SwaggerModule.createDocument(app, config);
}

// Serves the interactive page at /docs and the raw OpenAPI description at /docs-json.
export function setupDocs(app: NestFastifyApplication): void {
  const document = createOpenApiDocument(app, process.env.APP_VERSION ?? "dev");
  SwaggerModule.setup(DOCS_PATH, app, document, { jsonDocumentUrl: DOCS_JSON_PATH });
}

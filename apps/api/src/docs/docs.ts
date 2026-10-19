import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const DOCS_PATH = "docs";
export const DOCS_JSON_PATH = "docs-json";

// Serves the interactive page at /docs and the raw OpenAPI description at /docs-json.
export function setupDocs(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Manasbal API")
    .setDescription("HTTP API of the Manasbal storefront")
    .setVersion(process.env.APP_VERSION ?? "dev")
    .build();

  SwaggerModule.setup(DOCS_PATH, app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: DOCS_JSON_PATH,
  });
}

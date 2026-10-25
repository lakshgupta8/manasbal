import type { INestApplication } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

export const DOCS_PATH = "docs";
export const DOCS_JSON_PATH = "docs-json";

// Every tag a controller uses, so the docs page groups them in this order with a description.
const TAGS: ReadonlyArray<readonly [name: string, description: string]> = [
  ["Health", "Whether the API is up, and which version is running"],
  ["Catalog", "Categories, products, stock and reviews"],
  ["Sellers", "Seller storefronts"],
  ["Cart", "The demo user's cart"],
  ["Orders", "The demo user's orders"],
  ["Addresses", "The demo user's delivery addresses"],
  ["Admin", "Admin-only views, such as the audit log"],
];

export function createOpenApiDocument(app: INestApplication, version: string): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle("Manasbal API")
    .setDescription("HTTP API of the Manasbal storefront")
    .setVersion(version)
    // Relative, so the same document is right locally, on previews and in production.
    .addServer("/", "The server that serves these docs");
  for (const [name, description] of TAGS) builder.addTag(name, description);
  return SwaggerModule.createDocument(app, builder.build());
}

// Serves the interactive page at /docs and the raw OpenAPI description at /docs-json.
export function setupDocs(app: NestFastifyApplication): void {
  const document = createOpenApiDocument(app, process.env.APP_VERSION ?? "dev");
  SwaggerModule.setup(DOCS_PATH, app, document, { jsonDocumentUrl: DOCS_JSON_PATH });
}

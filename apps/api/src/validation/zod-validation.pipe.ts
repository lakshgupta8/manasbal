import { BadRequestException, type PipeTransform } from "@nestjs/common";
import { ApiBody, type ApiBodyOptions } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

type BodySchema = Extract<ApiBodyOptions, { schema: unknown }>["schema"];

// Checks a request body against a Zod schema and passes on the parsed value. A failure is a
// 400 that lists every problem, each starting with the field it is about.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException(
      result.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      ),
    );
  }
}

// Puts the same schema in the OpenAPI description, so /docs and the generated types show the
// body the pipe accepts.
export function ApiZodBody(schema: ZodType): MethodDecorator {
  return ApiBody({
    schema: z.toJSONSchema(schema, { target: "openapi-3.0", io: "input" }) as BodySchema,
  });
}

import { HttpException, HttpStatus } from "@nestjs/common";

// A 429 that also says when to try again: ProblemDetailsFilter sends it as Retry-After, the same
// shape the rate limiter answers.
export class TooManyTriesException extends HttpException {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

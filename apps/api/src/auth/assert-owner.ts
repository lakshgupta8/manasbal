import { NotFoundException } from "@nestjs/common";

// For a record loaded by id: it must exist and belong to the user. Another user's record gets
// the same 404 as one that doesn't exist, so a stranger can't learn which ids are real.
export function assertOwner<T extends { userId: string }>(
  resource: T | null,
  userId: string,
  message: string,
): asserts resource is T {
  if (resource?.userId !== userId) throw new NotFoundException(message);
}

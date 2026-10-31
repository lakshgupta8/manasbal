// Prisma reads and writes timestamps as Temporal.Instant, which Node 24 doesn't have yet.
import "temporal-polyfill/global";

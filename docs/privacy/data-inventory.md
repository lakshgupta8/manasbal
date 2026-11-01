# Data inventory: personal data the app stores

What the app stores about people, taken from `apps/api/src/prisma/contract.prisma` and the API code. The privacy policy (Phase 13) relies on this page, so change it in the same PR as any schema change that adds, renames or removes one of these fields.

> [!NOTE]
> The app is a public demo. Every person in it is simulated, and visitors are told not to enter real details. The columns below say what would be personal data **if** a real person typed it in.

**Legend:** 🔴 = we don't really need it; a candidate to delete.

## How the nightly reset treats a row

| Flag                        | Meaning               | At the nightly reset                                    |
| --------------------------- | --------------------- | ------------------------------------------------------- |
| `created_by_visitor = true` | Made through the demo | **Deleted**                                             |
| `is_sample = true`          | Shipped with the seed | **Deleted**, then written again, unchanged, by the seed |

> [!WARNING]
> **The nightly reset truncates every table.** The workflow `.github/workflows/seed-demo.yml` runs every night at 21:00 UTC (02:30 IST). It migrates the hosted database, empties **every** table with one `TRUNCATE`, and seeds the demo profile again in the same transaction. It refuses unless `SEED_ALLOW_RESET=true` is set and the database has a `_demo_marker` row. So nothing a visitor made survives the night, whatever its flags. The flags matter for targeted deletes (a visitor's data-delete request) and for the "Sample review" label, not for choosing what survives the reset.

"How long we keep it" for a visitor's rows is therefore **until the next nightly reset (at most about a day)**. For seed rows it is **until the seed is changed**: they are deleted every night and written again, identical.

## Fields in the database

A visitor's account is created at sign-up (`POST /auth/sign-up`) with `created_by_visitor = true`, so the nightly reset removes it. The 18+ confirmation on the form is checked and never stored.

| Table.field                                                                                  | Example                      | Why we need it                                                                                            | How long we keep it                                  | Removed by the nightly reset?                        |
| -------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `users.email`                                                                                | `asha@example.test`          | Identifies the account and is the login name                                                              | Visitor: to next reset. Seed: until the seed changes | Yes, every row; seed rows come back with the re-seed |
| `users.name`                                                                                 | `Asha Rao`                   | Greets the user; the first name is shown beside their reviews                                             | As `users.email`                                     | As `users.email`                                     |
| `users.password_hash`                                                                        | (a hash, never the password) | Sign-in. Written at sign-up as an argon2id hash (ADR 0011); the password itself is never stored or logged | As `users.email`                                     | As `users.email`                                     |
| `sellers.store_name`                                                                         | `Open Store`                 | Public name of the store (a person's own name if they use it)                                             | Visitor: to next reset. Seed: until the seed changes | Yes, every row; seed rows come back with the re-seed |
| `sellers.slug`                                                                               | `open-store`                 | Store page address; derived from the store name                                                           | As `sellers.store_name`                              | As `sellers.store_name`                              |
| `addresses.name`                                                                             | `Asha Rao`                   | Recipient name on the delivery address                                                                    | Visitor: to next reset. Seed: until the seed changes | Yes, every row; seed rows come back with the re-seed |
| `addresses.line1`                                                                            | `1 Test Road`                | Where to deliver                                                                                          | As `addresses.name`                                  | As `addresses.name`                                  |
| `addresses.city`                                                                             | `Pune`                       | Where to deliver                                                                                          | As `addresses.name`                                  | As `addresses.name`                                  |
| `addresses.state`                                                                            | `MH`                         | Where to deliver; tax and shipping rules                                                                  | As `addresses.name`                                  | As `addresses.name`                                  |
| `addresses.pincode`                                                                          | `411001`                     | Delivery area and shipping cost                                                                           | As `addresses.name`                                  | As `addresses.name`                                  |
| `reviews.body`                                                                               | `Fits well`                  | The review text. Free text, so a visitor could type personal details                                      | Visitor: to next reset. Seed: until the seed changes | Yes, every row; seed rows come back with the re-seed |
| `audit_logs.actor_id`                                                                        | a user id                    | Who changed a record (today: a buyer's address); links the log to a person                                | As `users.email` (the log row carries its own flags) | Yes, every row; seed rows come back with the re-seed |
| `orders.user_id`, `carts.user_id`, `reviews.user_id`, `addresses.user_id`, `sellers.user_id` | a user id                    | Links purchases, carts, reviews, addresses and a store to their owner                                     | Same as the row they sit on                          | Yes, every row; seed rows come back with the re-seed |
| `orders.address_id`                                                                          | an address id                | Links an order to where the buyer lives                                                                   | Same as the order                                    | Yes, every row; seed rows come back with the re-seed |
| `audit_logs.request_id`                                                                      | a request id                 | Matches the log row to the request in the host logs, which hold the IP address                            | As `audit_logs.actor_id`                             | Yes, every row; seed rows come back with the re-seed |
| `settlements.gross_paise`, `settlements.commission_paise`, `settlements.payout_paise`        | `250000`                     | A seller's simulated monthly earnings (no money moves); a person's income if they sell under their name   | Visitor: to next reset. Seed: until the seed changes | Yes, every row; seed rows come back with the re-seed |

Not personal on their own, but they reveal what a person bought when joined to the fields above: `orders.*`, `order_items.*`, `sub_orders.*`, `shipments.*`, `payments.amount_paise`. The `created_at` times on `users`, `orders` and `reviews` show when a person was active. `payments.gateway_ref` and `shipments.tracking_number` are simulated references, not card, bank or courier numbers; the app stores no card, ID or bank numbers.

## Personal data outside the database

| Where                                               | What                                           | Why we need it                                                                       | How long we keep it                    | Removed by the nightly reset?    |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- | -------------------------------- |
| Valkey, rate-limit counter (`rate-limit.module.ts`) | IP address, as the counter key                 | Stops one visitor sending too many requests (100 a minute; 10 a minute on `/auth/*`) | One minute (the counting window)       | Not needed; it expires by itself |
| Server logs on Render and Vercel                    | IP address and request path, kept by the hosts | Debugging and abuse handling                                                         | Set by the host's plan, not by the app | No. The app cannot reset these   |

> [!IMPORTANT]
> The database has **no IP address column**. An IP address is used only as the rate-limit key and in host logs.

## Candidates to delete

None right now.

`addresses.phone` was a candidate and is gone: the API stored and returned it, but no page used it and nothing is shipped, so it was removed (column, schema field, API docs and tests). Add it back only if a delivery feature needs it.

The audit log never stores field values (`audit.service.ts`), so no address details leak into `audit_logs`.

`users.name` and `addresses.name` overlap, but the recipient can differ from the account holder, so both stay.

## Open points for the Phase 13 policy

- The retention figures above describe the nightly reset, not a written retention rule. The policy must either confirm "about a day for visitor data" or set another figure.
- The reset shipped in Phase 4 and truncates every table (`packages/seed/src/reset.ts`). If it ever changes to delete only flagged rows, update the tables above.
- The roadmap lists other services that may see personal data and are not covered above: Sentry (errors, 30-day history), Grafana Cloud (logs, 14-day retention), Umami (cookieless analytics) and Resend (optional email). Add a row for each once it is wired in. The roadmap also says the logger redacts emails, tokens and passwords, and Phase 11 sets a log retention period.
- Valkey on Render has no persistence, so the rate-limit counters are lost on restart; that only shortens retention.
- Host logs are outside the app's control. The policy should name the hosts and link to their retention terms.

# Data inventory: personal data the app stores

What the app stores about people, taken from `apps/api/src/prisma/contract.prisma` and the API code. The privacy policy (Phase 13) relies on this page, so change it in the same PR as any schema change that adds, renames or removes one of these fields.

> [!NOTE]
> The app is a public demo. Every person in it is simulated, and visitors are told not to enter real details. The columns below say what would be personal data **if** a real person typed it in.

**Legend:** 🔴 = we don't really need it; a candidate to delete.

## How the nightly reset treats a row

| Flag                        | Meaning               | At the nightly reset       |
| --------------------------- | --------------------- | -------------------------- |
| `created_by_visitor = true` | Made through the demo | **Deleted**                |
| `is_sample = true`          | Shipped with the seed | Kept (restored if changed) |

> [!WARNING]
> **The nightly reset does not exist yet.** It is Phase 4 in the roadmap (not started): a GitHub Actions run that migrates, **truncates** and re-seeds the hosted database, guarded by `SEED_ALLOW_RESET=true` and a `_demo_marker` row. Until it ships, visitor rows are kept indefinitely. When it ships, the truncate removes every row, so the flags matter for targeted deletes (a visitor's data-delete request) and for the "Sample review" label, not for choosing what survives the reset. The columns below describe the intended behaviour.

"How long we keep it" for a visitor's rows will therefore be **until the next nightly reset (at most about a day)**. For seed rows it is **until the seed is changed**.

## Fields in the database

| Table.field                                                               | Example                      | Why we need it                                                       | How long we keep it                                  | Removed by the nightly reset?               |
| ------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `users.email`                                                             | `asha@example.test`          | Identifies the account and is the login name                         | Visitor: to next reset. Seed: until the seed changes | Yes if `created_by_visitor`; seed rows stay |
| `users.name`                                                              | `Asha Rao`                   | Greets the user; the first name is shown beside their reviews        | As `users.email`                                     | As `users.email`                            |
| `users.password_hash`                                                     | (a hash, never the password) | Sign-in check. Stored hashed only                                    | As `users.email`                                     | As `users.email`                            |
| `sellers.store_name`                                                      | `Open Store`                 | Public name of the store (a person's own name if they use it)        | Visitor: to next reset. Seed: until the seed changes | Yes if `created_by_visitor`; seed rows stay |
| `sellers.slug`                                                            | `open-store`                 | Store page address; derived from the store name                      | As `sellers.store_name`                              | As `sellers.store_name`                     |
| `addresses.name`                                                          | `Asha Rao`                   | Recipient name on the delivery address                               | Visitor: to next reset. Seed: until the seed changes | Yes if `created_by_visitor`; seed rows stay |
| `addresses.line1`                                                         | `1 Test Road`                | Where to deliver                                                     | As `addresses.name`                                  | As `addresses.name`                         |
| `addresses.city`                                                          | `Pune`                       | Where to deliver                                                     | As `addresses.name`                                  | As `addresses.name`                         |
| `addresses.state`                                                         | `MH`                         | Where to deliver; tax and shipping rules                             | As `addresses.name`                                  | As `addresses.name`                         |
| `addresses.pincode`                                                       | `411001`                     | Delivery area and shipping cost                                      | As `addresses.name`                                  | As `addresses.name`                         |
| `reviews.body`                                                            | `Fits well`                  | The review text. Free text, so a visitor could type personal details | Visitor: to next reset. Seed: until the seed changes | Yes if `created_by_visitor`; seed rows stay |
| `audit_logs.actor_id`                                                     | a user id                    | Who did an admin action; links the log to a person                   | As `users.email` (the log row carries its own flags) | Yes if `created_by_visitor`; seed rows stay |
| `orders.user_id`, `carts.user_id`, `reviews.user_id`, `addresses.user_id` | a user id                    | Links purchases, carts, reviews and addresses to their owner         | Same as the row they sit on                          | Yes if `created_by_visitor`; seed rows stay |

Not personal on their own, but they reveal what a person bought when joined to the fields above: `orders.*`, `order_items.*`, `sub_orders.*`, `payments.amount_paise`. `payments.gateway_ref` is a simulated reference, not a card or bank number; the app stores no card, ID or bank numbers.

## Personal data outside the database

| Where                                               | What                                           | Why we need it                                             | How long we keep it                    | Removed by the nightly reset?    |
| --------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- | -------------------------------- |
| Valkey, rate-limit counter (`rate-limit.module.ts`) | IP address, as the counter key                 | Stops one visitor sending too many requests (100 a minute) | One minute (the counting window)       | Not needed; it expires by itself |
| Server logs on Render and Vercel                    | IP address and request path, kept by the hosts | Debugging and abuse handling                               | Set by the host's plan, not by the app | No. The app cannot reset these   |

> [!IMPORTANT]
> The database has **no IP address column**. An IP address is used only as the rate-limit key and in host logs.

## Candidates to delete

None today. `addresses.phone` was the only one: the API stored and returned it, but no page used it and nothing is shipped, so it was removed (column, schema field, API docs and tests). Add it back only if a delivery feature needs it.

The audit log never stores field values (`audit.service.ts`), so no address details leak into `audit_logs`.

`users.name` and `addresses.name` overlap, but the recipient can differ from the account holder, so both stay.

## Open points for the Phase 13 policy

- The retention figures above describe the nightly reset, not a written retention rule. The policy must either confirm "about a day for visitor data" or set another figure.
- The roadmap (Phase 4) confirms the reset is planned, not built: re-check this page when it ships, and in particular whether it truncates everything or deletes only flagged rows.
- The roadmap lists other services that may see personal data and are not covered above: Sentry (errors, 30-day history), Grafana Cloud (logs, 14-day retention), Umami (cookieless analytics) and Resend (optional email). Add a row for each once it is wired in. The roadmap also says the logger redacts emails, tokens and passwords, and Phase 11 sets a log retention period.
- Valkey on Render has no persistence, so the rate-limit counters are lost on restart; that only shortens retention.
- Host logs are outside the app's control. The policy should name the hosts and link to their retention terms.

# 0010: Data model of the application

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

The shop is a marketplace: several sellers sell through one storefront, and a buyer pays once for a basket that can hold products from more than one of them. The data is a public demo that anyone can write to, and it is reset every night. The schema is `apps/api/src/prisma/contract.prisma`. Money is whole paise (integers) throughout.

## Decision

- **An order is split into one sub-order per seller.** `orders` holds what the buyer sees and pays: the address, the coupon, the total, one payment. `sub_orders` holds one row per seller in that order, with its own status and subtotal, and `order_items` hang off the sub-order. The buyer sees one order. Each seller sees and handles only their own sub-order.
- **Stock is kept per variant, not per product.** A product is the listing (name, description, category). A `variant` is the thing that is bought: one SKU, one size and colour, one price. `inventory` rows belong to a variant, with `quantity` held and `reserved` for carts and orders in flight. The cart, order items and stock checks all point at a variant.
- **Demo rows are flagged.** Every table a visitor can write to, directly or as a side effect, has `is_sample` (rows that ship with the seed) and `created_by_visitor` (rows made through the demo). `categories` and `coupons` have neither, because only the seed or an admin writes them.

## Why

**Sub-orders per seller.** Sellers ship, cancel and refund independently, so one order cannot have a single status: one seller's part can be delivered while another's is still packing. Putting the status and subtotal on a per-seller row keeps that true without guessing from the items. It also gives every seller a clean boundary: a seller's queries filter on `sub_orders.seller_id` and can never reach another seller's items or the buyer's other purchases. The buyer-facing parts that are not per seller (address, coupon, payment, idempotency key) stay once on the order, so the buyer pays once and a retry cannot create a second order.

**Stock on variants.** A shirt in size M and a shirt in size L are different things to a warehouse: one can sell out while the other does not, and they can have different prices. Stock on the product would let a buyer order a size that is gone. Per-variant stock makes "can this be bought" a question about one row, and `quantity - reserved` is the number the cart and checkout check ("Only 2 left"). Inventory is a separate table because one variant can be held in more than one `location`.

**Flagged demo data.** The site is public and visitors can sign up, add to a cart and place orders. A nightly reset has to remove what visitors made without touching what the seed put there, and must not rely on guessing from names or dates. Two flags answer it directly: `created_by_visitor` marks what to delete, `is_sample` marks what the seed owns and can be restored. A row a visitor causes indirectly (a cart line, an order's sub-order, an audit entry) is flagged too, so the delete does not leave orphans that point at removed rows. Lookup tables nobody can write to are left out on purpose: a flag there could only be wrong.

## Consequences

- Placing an order writes to several tables (order, sub-orders, items, payment, stock), so it must run in one transaction and reserve stock first.
- Every new table a visitor can reach needs both flag columns and a place in the reset, or the nightly reset leaves junk behind.
- Reports per seller are simple. A report on a whole order has to join through sub-orders.
- A variant needs its product, so a product with no variant cannot be bought. Listing queries must handle that case.
- Changing any of this is a new record that supersedes this one.

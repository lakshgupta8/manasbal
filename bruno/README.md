# Bruno collection

Requests for every endpoint of the API, for [Bruno](https://www.usebruno.com/). Each request has assertions on the status and the shape of the answer, so a run shows what passed and what failed.

## Open it

1. Start the API (see the root [README](../README.md#api)).
2. In Bruno, choose **Open Collection** and pick this `bruno` folder.

## Local or prod

Choose the environment at the top right of Bruno.

| Environment | `baseUrl`                           | Use it for                          |
| ----------- | ----------------------------------- | ----------------------------------- |
| **local**   | `http://localhost:3001`             | The API running on your computer    |
| **prod**    | `https://manasbal-api.onrender.com` | The hosted demo API (health, reads) |

Requests that act as a user (cart, orders, addresses, admin) send the access token that **Auth → Sign in** saves, on local and on prod alike. Run the `Auth` folder first; without a token they answer 401.

The ids in [`environments/local.yml`](environments/local.yml) (`productId`, `variantId`, `sellerSlug`, `productSlug`) belong to seed rows in one database. On your own database, replace them with ids that exist there, or those requests answer 404. The **prod** environment only sets `baseUrl`, so on prod add the ids you need first.

## Sign-in requests

The `Auth` folder runs first and in this order:

1. **Sign up** makes a new account with a fresh email.
2. **Verify email** confirms it. With `MAIL_MODE=smtp` (the local default in `.env.example`), its script reads the confirmation link from the newest mail to that account in Mailpit (`mailpitUrl`, http://localhost:8025) and posts the token. With `MAIL_MODE=off`, as on prod, no mail is sent, the account is confirmed at sign-up, and this request is skipped.
3. **Sign in** signs in with it and saves the access token (`accessToken`) and the refresh cookie. With mail on, an account that is not confirmed yet answers 403.
4. **Me** reads the account back with the token.
5. **Refresh** swaps the refresh cookie once and saves the new access token.
6. **Refresh reuse** replays the old cookie and must answer 401 (reuse revokes the whole session).
7. **Sign out** clears the cookie. The access token keeps working until it expires (15 minutes).
8. **Forgot password** asks for a reset link for the same account and must answer 202 (it answers 202 for any email).
9. **Reset password** reads the link from the newest reset mail to that account in Mailpit (it waits up to 3 seconds, since the API sends it just after answering) and sets the password to `made-up-new-password-456`. The reset ends every session of the account.
10. **Sign in with new password** signs in with it and saves the new access token for the requests after the folder.

With `MAIL_MODE=off` no mail exists, so **Verify email**, **Reset password** and **Sign in with new password** skip themselves.

They pass values to each other through runtime variables, so running one on its own may fail. Every other request with `auth: inherit` sends `Authorization: Bearer {{accessToken}}`, set once in [`opencollection.yml`](opencollection.yml). **Address add** saves the new address's id, which **Address edit** and **Address delete** then change.

### Staff and seller requests

**Admin audit log forbidden** uses the signed-in customer's token and must answer 403. Three requests need another role, and the seed gives no account a known password, so the run skips each until you set its token in the **local** environment:

| Request             | Role                 | Variables                          |
| ------------------- | -------------------- | ---------------------------------- |
| **Admin audit log** | `admin`              | `adminAccessToken`                 |
| **Store update**    | `seller`             | `sellerAccessToken`                |
| **Admin order**     | `support` or `admin` | `supportAccessToken` and `orderId` |

To get a token for a role:

1. Run **Auth → Sign up** and **Sign in** (or use any account you signed up locally).
2. Open the local database in Prisma Studio, `pnpm dlx prisma@7.10.1 studio --url "postgresql://manasbal:manasbal@localhost:5432/manasbal"`, then http://localhost:5555, and set that user's `role` in `users`. A `seller` also needs a row in `sellers` with their `user_id` (a store name, a unique slug and status `approved`).
3. Run **Sign in** again and copy `accessToken` from the answer into the variable. Don't commit it; it expires in 15 minutes.

For **Admin order**, set `orderId` to any order in the database, for example one from the seed (Prisma Studio, `orders`). Each view adds an `order.view` row to the audit log, with the support user as the actor: **Admin audit log** shows it.

## Run every request

1. Right-click the collection name in the sidebar and choose **Run** (or click the collection, then **Run**).
2. Press **Run Collection**. Requests run in order, top to bottom.
3. Read the results: a green tick per request means its assertions held; a red cross shows which one failed and the answer received.

To run one request, open it and press **Send** (Ctrl+Enter).

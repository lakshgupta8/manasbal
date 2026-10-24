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

On **prod** the `x-demo-user` header is refused, so requests that act as a user (cart, orders, addresses, admin) answer 401 there.

The ids in [`environments/local.yml`](environments/local.yml) (`demoUser`, `adminUser`, `addressId`, `variantId` and the others) belong to rows in one database. On your own database, replace them with ids that exist there, or those requests answer 401 or 404.

## Run every request

1. Right-click the collection name in the sidebar and choose **Run** (or click the collection, then **Run**).
2. Press **Run Collection**. Requests run in order, top to bottom.
3. Read the results: a green tick per request means its assertions held; a red cross shows which one failed and the answer received.

To run one request, open it and press **Send** (Ctrl+Enter).

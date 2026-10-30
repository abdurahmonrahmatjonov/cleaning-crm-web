# Gilam sizes + Saygak (partner) accounts: design

Repos: backend `/Users/imac/Desktop/BIS/NewCRMBack` (Express + better-sqlite3 + zod), frontend `NEWCRMWEB` (React/Vite).

## 1. Gilam sizes
- Applies only to order lines whose unit is `kv.m`. `metr` and `dona` lines are unchanged.
- New table `order_line_sizes(id, lineId, width, length, area)`. Area = width*length rounded to 2 dp; width, length > 0 and <= 100 m.
- `PATCH /orders/:id/wash` and `/pack` accept optional `sizes: [{width,length}]` per line; supplied sizes replace the line's previous rows (both steps editable).
- Line payload gains `sizes[]` and `sizesTotal`.
- Wash/pack UI: per kv.m line, rows eni x bo'yi (m), add/remove, live total m2. Pack starts from the sizes saved at wash.
- Delivery/payment form: kv.m input pre-filled with `sizesTotal`, editable. Empty when no sizes exist (current behaviour).
- Row count is not forced to equal the piece count; the UI shows a hint only.

## 2. Saygak accounts
### Data
- `clients.isPartner`, `client_prices(clientId, serviceId, price)`, `users.clientId`, locked system role `saygak` (not editable in Roles, no staff permissions).
### Orders
- Price comes from `client_prices` on the server; any client-sent price is ignored. Copied to the line at creation (snapshot).
- Saygak-created orders need no location or pickup time and no approval. They start as "Zakaz qabul qilindi"; staff confirm real counts at the pickup step (waybill optional for saygaks).
- A saygak may edit or cancel their own order only while "Zakaz qabul qilindi".
- Services without a price for that saygak cannot be ordered.
- Final step is "Topshirildi" instead of delivery: uses sizes, computes total at the saygak price, takes no money; the total stays as debt.
### Payments
- `POST /clients/:id/payments {amount, discount?, date}` allocates oldest unpaid orders first as normal payment rows, so Debtors, Summary and history keep working.
- Monthly statement for the saygak and staff: orders, total, paid, balance.
### Security
- Every request with a saygak token is scoped server-side to its own `clientId`. Another client's order returns 404.
- Allowlist: own orders, create order, statement, profile. Staff routes (clients, users, roles, expenses, reports, activity, chat) are denied.
- Hidden from saygaks: internal comments, staff chat, activity log, worker names.
- Frontend shows a slim layout (Buyurtmalar, Yangi buyurtma, Hisobot); this is cosmetic, the backend enforces access.
- Deactivating a login invalidates its token (auth middleware re-checks `isActive`).
- Saygak phone is unique; the login is separate from the phone.
- All migrations are additive; existing orders and clients are unaffected.
### Staff UI
- Client profile: toggle Saygak, edit price list, create/reset/deactivate login.
### Tests (test/api.test.js)
- Saygak cannot read another client's order, cannot call staff routes, cannot set own price.
- FIFO payment allocation; sizes total pre-fill; wash->pack size replacement.

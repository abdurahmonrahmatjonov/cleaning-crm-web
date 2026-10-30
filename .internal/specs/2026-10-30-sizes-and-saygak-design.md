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

## Stress Test Results: sizes and saygak

### Resolved Decisions
1. Access: global deny-by-default gate right after `authenticate` for any user with a `clientId`. Explicit method+path allowlist (own orders, create order, services with the saygak's prices only, own statement, own profile). `clientId` is always read from the DB, never from the token or request. Saygak gets one permission, `partner.portal`, never staff permissions. A route-walk test fails if an unlisted route is reachable. Reason: `/api/services` (shows defaultPrice) and all of `/api/chat/*` are open to any logged-in user.
2. Payments: lump payment runs FIFO in one transaction. Overpayment is rejected (no credit balance). Each lump payment carries a `batchId`; admin-only `DELETE /clients/:id/payments/:batchId` reverses a batch. Discounts need `orders.discount` and are applied oldest-first.
3. Saygak orders: server forces the linked client and ignores clientId/name/phone from the body. Optional expected count per line (informational). Cap of 10 open ("Qabul qilindi") orders per saygak (constant). Edit/cancel only while "Qabul qilindi", logged. Price copied at creation.
4. Totals: at the final step, a visible (non-blocking) warning when kv.m differs from `sizesTotal`. Activity log records sizes at wash, sizes at pack and final kv.m, with who. Saygak sees size rows once entered, and amounts only after "Topshirildi".
5. Roles/logins: DB-enforced pairing (user has `clientId` iff role is `saygak`). `saygak` role is `isSystem` and read-only via the API. Saygak logins are managed only from the client profile (hidden from the Users page). One login per saygak (unique `clientId`). Staff set the password (min 8 chars); reset button on the profile. Deactivate instead of delete. Saygaks cannot change their own password in this version.
6. Orders without an address: add `orders.kind` ('regular'|'partner'), placeholders lat/lon 0 and `pickupPlannedAt` = creation time, no table rebuild. UI hides map/address/driver fields for partner orders. `waybillNumber`/`deliveryTime` optional at pickup for partner orders only. Partner "Topshirildi" reuses the DELIVERED status with a different UI label, so reports and debtors keep working.
7. Statement: order belongs to the month of `deliveredDate`. Opening balance + charges in month - payments/discounts in month (by `paidDate`) = closing balance. For the current month the closing balance equals the client's current total debt (tested). Undelivered orders are listed as "in progress" without amounts.
8. Sizes: row area rounded to 2 dp, line total = sum of rounded rows. Old and new sizes logged on every wash/pack save. No backfill. Server rejects sizes on non-kv.m lines.
9. Staff creating orders for a saygak: server decides `kind` and prices from `clients.isPartner`/`client_prices` at creation, ignoring typed prices; missing price rejects the service. Form hides location/pickup time and shows prices read-only. Existing orders keep their kind when a client is later toggled. Price edits are admin-only and logged.

### Changes Made
- Added reversal of lump payments (batchId), the 10-open-orders cap, the deny-by-default gate, `orders.kind`, the statement definition and the staff-created partner order rules to the design.
- Clarified: saygak sees sizes as soon as entered, amounts only after "Topshirildi".

### Deferred / Parking Lot
- Saygak self-service password change.
- Prepayment / credit balance.
- Staff approval of saygak-created orders.
- Printing or exporting the monthly statement.

### Confidence Assessment
- Overall: High on design, Medium on effort: the access gate and the statement/payment tests are the largest pieces.
- Areas of concern: placeholder lat/lon (0,0) must never reach the map or any report; the route-walk test must be kept up to date as routes are added.

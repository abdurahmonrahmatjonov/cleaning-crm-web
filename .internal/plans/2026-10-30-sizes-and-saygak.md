# Gilam Sizes + Saygak Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use beads-superpowers:subagent-driven-development (recommended) or beads-superpowers:executing-plans to implement this plan task-by-task. Each Task becomes a bead (`bd create -t task --parent <epic-id>`). Steps within tasks use checkbox (`- [ ]`) syntax for human readability.

**Spec:** `.internal/specs/2026-10-30-sizes-and-saygak-design.md` (includes the Stress Test Results; those decisions are binding).

**Goal:** Let staff record per-carpet sizes at wash/pack (pre-filling kv.m at the final step), and add "saygak" partner clients with their own prices, a login that sees only their own orders, no delivery, and month-end lump payments.

**Architecture:** Backend (Express 5 + better-sqlite3 + zod) gets additive migrations, a sizes table, partner-kind orders, a deny-by-default access gate keyed on `users.clientId`, a dedicated `/api/partner/*` router for saygaks, FIFO lump payments with reversal, and a shared monthly-statement builder. The React/Vite frontend gets a sizes editor, partner-aware staff screens, and a slim saygak portal.

**Tech Stack:** Node >=20, Express 5, better-sqlite3, zod, node:test (backend, `/Users/imac/Desktop/BIS/NewCRMBack`); React 18, TypeScript, Vite, Tailwind 4 (frontend, `/Users/imac/Desktop/BIS/NEWCRMWEB`).

## Global Constraints

- All DB migrations are additive (`ALTER TABLE ... ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`); never rebuild `orders`. Existing orders/clients are unaffected.
- Sizes apply only to lines with `unit = 'kv.m'`; the server rejects sizes on `metr`/`dona` lines.
- Row area = round2(round2(width) * round2(length)); width/length > 0 and <= 100; line `sizesTotal` = sum of rounded row areas.
- A saygak's `clientId` is read from the DB on every request (never from the token or request body).
- Saygak gets NO staff permissions; access is deny-by-default (gate allows only `/api/partner/*`, plus `/api/auth/*` and `/api/branding` which are mounted outside the gate).
- Partner order price comes from `client_prices` on the server; client-sent prices are ignored; a service with no price is rejected.
- Partner "Topshirildi" reuses `ORDER_STATUS.DELIVERED` (`'Yetkazib berildi'`); only the UI label differs.
- Partner orders take no money at handover and cannot take per-order payments; money arrives only via client lump payments (batches).
- Lump payment: FIFO by `deliveredDate, docNum`, one transaction, overpayment rejected, admin-only reversal by batch.
- Statement month = `deliveredDate` month; opening + charges - credits = closing; credits by `paidDate`.
- Cap: 10 open ("Zakaz Qabul qilindi") orders per saygak (`PARTNER_OPEN_ORDER_CAP = 10`).
- Passwords min 8 chars (existing `password` zod rule); one login per saygak; deactivate, never delete.
- UI strings are Uzbek, matching existing screens. Commit messages are plain (no Co-Authored-By / "Generated with" lines, per the user's global rule). Backend and frontend are separate git repos; commit in the repo you changed.
- Backend tests run with `cd /Users/imac/Desktop/BIS/NewCRMBack && npm test`; frontend verification is `cd /Users/imac/Desktop/BIS/NEWCRMWEB && npm run build` (type-check) plus manual run.

## Plan decisions that refine the spec

- **No `partner.portal` permission.** The gate is keyed on `clientId`, so a permission would only add a meaningless checkbox on the Roles page. The `saygak` role has `permissions: []`. (Spec said one permission; this is a deliberate simplification with identical security.)
- **Deny-by-default is implemented by mount, not by route table:** all saygak endpoints live under `/api/partner`; every other secured mount goes through `secured = [authenticate, partnerGate]` and `partnerGate` rejects any user with a `clientId` (403). `/api/partner` rejects users without a `clientId`.
- **Reversal needs its own table** (`payment_batches`) because discount-only allocations cannot be stored in `payments` (`amount > 0` CHECK).

## File Structure

Backend (`/Users/imac/Desktop/BIS/NewCRMBack`)
- Modify `src/db.js`: migration 2g (columns, tables, triggers), `saygak` default role.
- Modify `src/middleware/auth.js`: load `clientId`; add `partnerGate`, `requirePartner`.
- Modify `src/app.js`: `secured` chain, mount helper that records `STAFF_MOUNTS`, mount `/api/partner`.
- Modify `src/routes/auth.js`: return `clientId` from login and `/me`.
- Modify `src/routes/roles.js`: `saygak` role is locked.
- Modify `src/routes/users.js`: hide saygak users; reject creating/updating into the saygak role.
- Modify `src/routes/orders.js`: sizes in wash/pack, partner kind on create, pickup relaxation, partner handover, block per-order payments for partner orders, `sizes` in payloads.
- Create `src/utils/sizes.js`: `normalizeSizes`, `sizesTotal`, `loadSizes`, `replaceSizes`.
- Create `src/utils/partner.js`: `partnerPrices`, `priceFor`, `PARTNER_OPEN_ORDER_CAP`.
- Create `src/utils/statement.js`: `buildStatement(db, clientId, month)`.
- Modify `src/routes/clients.js`: `isPartner`, prices, login management, lump payments, reversal, statement.
- Create `src/routes/partner.js`: the saygak-facing API.
- Modify `test/api.test.js` (append) or create `test/partner.test.js` (preferred; copy the `call`/`login`/`before` harness from `test/api.test.js:1-52`).

Frontend (`/Users/imac/Desktop/BIS/NEWCRMWEB/src`)
- Modify `types.ts`, `auth.tsx`: `clientId`, size types.
- Create `components/SizesEditor.tsx`.
- Modify `pages/OrderModal.tsx` (Step, DeliverForm), `pages/CreateOrderModal.tsx`, `pages/Clients.tsx`, `pages/Users.tsx`, `pages/Orders.tsx` (partner labels).
- Create `pages/partner/PartnerApp.tsx`, `PartnerOrders.tsx`, `PartnerNewOrder.tsx`, `PartnerStatement.tsx`.
- Modify `App.tsx`: render `PartnerApp` when `user.clientId`.

---

## Part A: Backend

### Task 1: Migrations, roles and test harness

**Files:**
- Modify: `/Users/imac/Desktop/BIS/NewCRMBack/src/db.js` (inside `migrate`, before "3. built-in roles"; and `DEFAULT_ROLES`)
- Create: `/Users/imac/Desktop/BIS/NewCRMBack/test/partner.test.js`

**Interfaces:**
- Produces tables/columns: `clients.isPartner`, `users.clientId`, `orders.kind`, `order_lines.expectedQuantity`, `payments.batchId`, tables `order_line_sizes`, `client_prices`, `payment_batches`; role `saygak`.
- `payment_batches(batchId TEXT PRIMARY KEY, clientId, amount, discount, paidDate, createdAt, creatorId, creatorName, allocations TEXT /*JSON [{docNum,cash,disc}]*/, reversedAt TEXT NOT NULL DEFAULT '', reversedByName TEXT NOT NULL DEFAULT '')`.

**Acceptance Criteria:**
- Opening an old DB adds all new columns/tables without data loss; re-running is a no-op.
- Inserting a user with role `saygak` and no `clientId`, or `clientId` with another role, fails at the DB level.
- `saygak` role exists with `isSystem = 1` and `[]` permissions.

- [ ] **Step 1: Write the failing test** in `test/partner.test.js` (harness copied from `test/api.test.js:1-52`, exporting nothing; add `let partnerA, partnerB, clientA, clientB;` later tasks fill them in)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { openDb } = await import('../src/db.js');

test('migration adds partner schema and enforces role/clientId pairing', () => {
  const db = openDb(':memory:');
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.ok(cols('clients').includes('isPartner'));
  assert.ok(cols('users').includes('clientId'));
  assert.ok(cols('orders').includes('kind'));
  assert.ok(cols('order_lines').includes('expectedQuantity'));
  assert.ok(cols('payments').includes('batchId'));
  for (const t of ['order_line_sizes', 'client_prices', 'payment_batches']) {
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t), t);
  }
  assert.equal(db.prepare("SELECT isSystem FROM roles WHERE key = 'saygak'").get().isSystem, 1);
  db.prepare("INSERT INTO clients (name, phone, createdAt) VALUES ('P','+998900000001','2026-10-01')").run();
  const ins = (role, clientId) =>
    db.prepare("INSERT INTO users (username, fullName, passwordHash, role, createdAt, clientId) VALUES (?,?,?,?,?,?)")
      .run(`u${Math.random()}`, 'x', 'h', role, '2026-10-01', clientId);
  assert.throws(() => ins('saygak', null), /saygak/);
  assert.throws(() => ins('operator', 1), /saygak/);
  assert.doesNotThrow(() => ins('saygak', 1));
  assert.throws(() => ins('saygak', 1), /UNIQUE/); // one login per saygak
  openDb(':memory:'); // idempotent open
});
```

- [ ] **Step 2: Run to verify it fails** — `cd /Users/imac/Desktop/BIS/NewCRMBack && node --test test/partner.test.js` → FAIL (`isPartner` missing).

- [ ] **Step 3: Implement** in `src/db.js`. Add to `DEFAULT_ROLES`:

```js
  { key: 'saygak', name: 'Saygak', isSystem: 1, permissions: [] },
```

and insert in `migrate` before `// 3. built-in roles`:

```js
  // 2g. saygak (partner) accounts: special prices, own login, no-delivery orders, gilam sizes, lump payments
  if (!hasColumn(db, 'clients', 'isPartner')) db.exec('ALTER TABLE clients ADD COLUMN isPartner INTEGER NOT NULL DEFAULT 0');
  if (!hasColumn(db, 'users', 'clientId')) db.exec('ALTER TABLE users ADD COLUMN clientId INTEGER REFERENCES clients(id)');
  if (!hasColumn(db, 'orders', 'kind')) db.exec("ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'regular'");
  if (!hasColumn(db, 'order_lines', 'expectedQuantity')) db.exec('ALTER TABLE order_lines ADD COLUMN expectedQuantity INTEGER NOT NULL DEFAULT 0');
  if (!hasColumn(db, 'payments', 'batchId')) db.exec("ALTER TABLE payments ADD COLUMN batchId TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_client ON users(clientId) WHERE clientId IS NOT NULL;
    CREATE TABLE IF NOT EXISTS order_line_sizes (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      lineId INTEGER NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
      width  REAL NOT NULL,
      length REAL NOT NULL,
      area   REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sizes_line ON order_line_sizes(lineId);
    CREATE TABLE IF NOT EXISTS client_prices (
      clientId  INTEGER NOT NULL REFERENCES clients(id),
      serviceId INTEGER NOT NULL REFERENCES services(id),
      price     REAL NOT NULL CHECK (price >= 0),
      PRIMARY KEY (clientId, serviceId)
    );
    CREATE TABLE IF NOT EXISTS payment_batches (
      batchId        TEXT PRIMARY KEY,
      clientId       INTEGER NOT NULL REFERENCES clients(id),
      amount         REAL NOT NULL,
      discount       REAL NOT NULL DEFAULT 0,
      paidDate       TEXT NOT NULL,
      createdAt      TEXT NOT NULL,
      creatorId      INTEGER NOT NULL,
      creatorName    TEXT NOT NULL,
      allocations    TEXT NOT NULL,
      reversedAt     TEXT NOT NULL DEFAULT '',
      reversedByName TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_batches_client ON payment_batches(clientId);
    CREATE TRIGGER IF NOT EXISTS users_saygak_pair_ins BEFORE INSERT ON users
      WHEN (NEW.role = 'saygak') != (NEW.clientId IS NOT NULL)
      BEGIN SELECT RAISE(ABORT, 'saygak role and clientId must go together'); END;
    CREATE TRIGGER IF NOT EXISTS users_saygak_pair_upd BEFORE UPDATE OF role, clientId ON users
      WHEN (NEW.role = 'saygak') != (NEW.clientId IS NOT NULL)
      BEGIN SELECT RAISE(ABORT, 'saygak role and clientId must go together'); END;
  `);
```

Note: `DEFAULT_ROLES` insert (step 3) runs after this block; the test's `roles` lookup passes because `INSERT OR IGNORE` runs at the end of `migrate`.

- [ ] **Step 4: Run** `node --test test/partner.test.js` → PASS; then `npm test` → all existing tests still pass.
- [ ] **Step 5: Commit** (backend repo) — `git add src/db.js test/partner.test.js && git commit -m "Add partner schema: prices, sizes, batches, pairing triggers"`

### Task 2: Gilam sizes at wash/pack

**Files:**
- Create: `src/utils/sizes.js`
- Modify: `src/routes/orders.js` (`countSchema`, `presentLine`, `presentOrder`, `loadOrder`, `listByStatus`, `step`, `deliver` log)
- Test: `test/partner.test.js` (append) — uses the full app harness

**Interfaces:**
- Produces `src/utils/sizes.js`:
  - `export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;`
  - `export const sizeRow = z.object({ width: z.number().positive().max(100), length: z.number().positive().max(100) });`
  - `export function normalizeSizes(rows) -> [{width,length,area}]` (rounds each to 2 dp; throws if a rounded value becomes 0)
  - `export function loadSizes(db, docNums) -> Map<lineId, [{width,length,area}]>`
  - `export function replaceSizes(db, lineId, rows)`
  - `export const sizesTotal = (rows) => round2(rows.reduce((s, r) => s + r.area, 0))`
- API: `PATCH /orders/:id/wash|pack` body line = `{ id, quantity, sizes?: [{width,length}] }`; `sizes` absent = unchanged, `[]` = clear. Line JSON gains `sizes: [{width,length,area}]`, `sizesTotal: number`.

**Acceptance Criteria:**
- Wash saves sizes; pack replaces them; absent `sizes` leaves them untouched; `[]` clears.
- `12.4 x 3.1` stores area `38.44`; `sizesTotal` equals the sum of row areas.
- Sizes on a `metr`/`dona` line → 400. width or length <= 0 or > 100 → 400.
- Activity log entry for wash/pack contains old and new sizes per line.
- Deliver activity log contains, per kv.m line, `sizesTotal` and the final `sqm` entered.

- [ ] **Step 1: Failing tests** (append to `test/partner.test.js`; reuse `newOrder`, `washAndPack`, `counts`, `call` helpers copied from `test/api.test.js:7-34`)

```js
const pickedOrder = async (lines) => {
  const o = (await call('POST', '/api/orders', { token: operator, body: newOrder({ lines }) })).body;
  const p = await call('PATCH', `/api/orders/${o.docNum}/pickup`, { token: driver, body: { waybillNumber: 'N1', deliveryTime: '2026-11-02T10:00', lines: o.lines.map((l) => ({ id: l.id, quantity: 2 })) } });
  assert.equal(p.status, 200);
  return p.body;
};
const wash = (o, lines) => call('PATCH', `/api/orders/${o.docNum}/wash`, { token: packer, body: { lines } });

test('sizes: wash saves, pack replaces, [] clears, absent keeps', async () => {
  const a = await pickedOrder([{ serviceId: 1, price: 15000 }]);
  const w = await wash(a, [{ id: a.lines[0].id, quantity: 2, sizes: [{ width: 12.4, length: 3.1 }, { width: 2, length: 3 }] }]);
  assert.equal(w.status, 200);
  assert.deepEqual(w.body.lines[0].sizes.map((s) => s.area), [38.44, 6]);
  assert.equal(w.body.lines[0].sizesTotal, 44.44);
  const pack = await call('PATCH', `/api/orders/${a.docNum}/pack`, { token: packer, body: { lines: [{ id: a.lines[0].id, quantity: 2, sizes: [{ width: 5, length: 4 }] }] } });
  assert.equal(pack.body.lines[0].sizesTotal, 20);
  assert.equal(pack.body.lines[0].sizes.length, 1);

  const b = await pickedOrder([{ serviceId: 1, price: 15000 }]);
  const cleared = await wash(b, [{ id: b.lines[0].id, quantity: 2, sizes: [] }]);
  assert.deepEqual(cleared.body.lines[0].sizes, []);

  const c = await pickedOrder([{ serviceId: 1, price: 15000 }]);
  const kept = await wash(c, [{ id: c.lines[0].id, quantity: 2 }]);
  assert.deepEqual(kept.body.lines[0].sizes, []);
  const packNoSizes = await call('PATCH', `/api/orders/${c.docNum}/pack`, { token: packer, body: { lines: [{ id: c.lines[0].id, quantity: 2 }] } });
  assert.equal(packNoSizes.status, 200);
});

test('sizes: invalid input and non kv.m lines are rejected', async () => {
  const dona = (await call('POST', '/api/services', { token: admin, body: { name: 'Dona test', unit: 'dona' } })).body;
  const d = await pickedOrder([{ serviceId: dona.id, price: 3000 }]);
  assert.equal((await wash(d, [{ id: d.lines[0].id, quantity: 2, sizes: [{ width: 1, length: 1 }] }])).status, 400);
  const k = await pickedOrder([{ serviceId: 1, price: 15000 }]);
  for (const bad of [{ width: -1, length: 1 }, { width: 0, length: 1 }, { width: 101, length: 1 }, { width: 0.001, length: 1 }]) {
    assert.equal((await wash(k, [{ id: k.lines[0].id, quantity: 2, sizes: [bad] }])).status, 400, JSON.stringify(bad));
  }
});

- [ ] **Step 2: Run** `node --test test/partner.test.js` → FAIL (no `sizes` in payload).
- [ ] **Step 3: Implement.** `src/utils/sizes.js`:

```js
import { z } from 'zod';
import { badRequest } from './httpError.js';

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sizeRow = z.object({ width: z.number().positive().max(100), length: z.number().positive().max(100) });
export const sizesTotal = (rows) => round2(rows.reduce((s, r) => s + r.area, 0));

export function normalizeSizes(rows) {
  return rows.map((r) => {
    const width = round2(r.width), length = round2(r.length);
    if (!width || !length) throw badRequest('Size must be at least 0.01 m');
    return { width, length, area: round2(width * length) };
  });
}

export function loadSizes(db, docNums) {
  const map = new Map();
  if (!docNums.length) return map;
  const rows = db.prepare(
    `SELECT s.lineId, s.width, s.length, s.area FROM order_line_sizes s JOIN order_lines l ON l.id = s.lineId
     WHERE l.docNum IN (${docNums.map(() => '?').join(',')}) ORDER BY s.id`).all(...docNums);
  for (const r of rows) (map.get(r.lineId) ?? map.set(r.lineId, []).get(r.lineId)).push({ width: r.width, length: r.length, area: r.area });
  return map;
}

export function replaceSizes(db, lineId, rows) {
  db.prepare('DELETE FROM order_line_sizes WHERE lineId = ?').run(lineId);
  const ins = db.prepare('INSERT INTO order_line_sizes (lineId, width, length, area) VALUES (?,?,?,?)');
  for (const r of rows) ins.run(lineId, r.width, r.length, r.area);
}
```

In `orders.js`:
1. `countSchema` line item → `z.object({ id: idSchema, quantity: z.number().int().min(1).max(100000), sizes: z.array(sizeRow).max(100).optional() })`.
2. `presentLine(l, sizes = [])` adds `sizes, sizesTotal: sizesTotal(sizes)`; `presentOrder(o, lines, sizeMap = new Map())` passes `sizeMap.get(l.id) ?? []`; `loadOrder` and `listByStatus` call `loadSizes(db, [docNums])` once and pass the map (one query per page, not per order).
3. In `step()` inside the transaction, after `assertAllLines`, for each `l of b.lines` with `l.sizes !== undefined`: `if (before.get(l.id).unit !== 'kv.m') throw badRequest('Sizes are only for kv.m services', { lineId: l.id });` then `const rows = normalizeSizes(l.sizes); const old = loadSizes(db,[docNum]).get(l.id) ?? []; replaceSizes(db, l.id, rows);` and add `sizes: { from: old, to: rows }` to that line's entry in the `counts` log array.
4. In `deliver`, add to the log `lines: [{ service, sizesTotal, sqm }]` for kv.m lines (load sizes with `loadSizes`).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Gilam sizes at wash/pack with per-row areas"` (add new files first).

### Task 3: Saygak client data, prices and login management (staff side)

**Files:**
- Modify: `src/routes/clients.js`, `src/routes/users.js`, `src/routes/roles.js`, `src/routes/auth.js`, `src/middleware/auth.js`
- Create: `src/utils/partner.js`
- Test: `test/partner.test.js`

**Interfaces:**
- Produces `src/utils/partner.js`:
  - `export const PARTNER_OPEN_ORDER_CAP = 10;`
  - `export const priceMap = (db, clientId) -> Map<serviceId, price>`
- Staff endpoints (all `manage` = `clients.manage`, except where noted):
  - `PATCH /api/clients/:id` body gains `isPartner: boolean`.
  - `GET /api/clients/:id/prices` → `{ data: [{ serviceId, serviceName, unit, price }] }` (all active services; `price: null` if unset)
  - `PUT /api/clients/:id/prices` (admin only) body `{ prices: [{ serviceId, price }] }` — replaces the set; each change logged (`client.prices`) with old/new; only for `isPartner` clients.
  - `PUT /api/clients/:id/login` (admin only) body `{ username, fullName?, password }` — creates the saygak user if none, else resets password/username; client must be `isPartner`. `PATCH /api/clients/:id/login` (admin only) `{ isActive }`. `GET /api/clients/:id/login` → `{ username, isActive } | null`.
  - `GET /api/clients/:id` and list rows gain `isPartner`.
- `req.user.clientId` is set by `authenticate`; `/auth/login` and `/auth/me` return `clientId` (null for staff).

**Acceptance Criteria:**
- Only admin can set prices/logins; prices only for partner clients; login only for partner clients; one login per client.
- `users` list (`GET /api/users`) excludes saygak users; `POST/PATCH /api/users` with role `saygak` → 400; `roles` PATCH/DELETE on `saygak` → 409 and creating a role slugged `saygak` is impossible.
- Deactivating a saygak login makes its existing token return 401 immediately.
- Login response and `/auth/me` include `clientId`.

- [ ] **Step 1: Failing tests** — create partner clients A and B (`PATCH isPartner`), set prices (A: service1=6000; B: service1=7000), `PUT login` for each, log in as `partnerA`/`partnerB` (store tokens in module vars `partnerA`, `partnerB`, and client ids `clientA`, `clientB` for later tasks), then assert:

```js
test('partner setup: admin-only prices/logins, role locked, token revoked on deactivate', async () => {
  const mk = async (name, phone) => (await call('POST', '/api/clients', { token: operator, body: { name, phone } })).body;
  const A = await mk('Saygak A', '+998901111111');
  assert.equal((await call('PUT', `/api/clients/${A.id}/prices`, { token: operator, body: { prices: [{ serviceId: 1, price: 6000 }] } })).status, 403);
  assert.equal((await call('PUT', `/api/clients/${A.id}/prices`, { token: admin, body: { prices: [{ serviceId: 1, price: 6000 }] } })).status, 409); // not a partner yet
  assert.equal((await call('PATCH', `/api/clients/${A.id}`, { token: operator, body: { isPartner: true } })).status, 200);
  assert.equal((await call('PUT', `/api/clients/${A.id}/prices`, { token: admin, body: { prices: [{ serviceId: 1, price: 6000 }] } })).status, 200);
  assert.equal((await call('PUT', `/api/clients/${A.id}/login`, { token: admin, body: { username: 'saygakA', password: 'password123' } })).status, 200);
  const t = await login('saygakA', 'password123');
  const me = await call('GET', '/api/auth/me', { token: t });
  assert.equal(me.body.clientId, A.id);
  assert.equal((await call('GET', '/api/users', { token: admin })).body.data.some((u) => u.role === 'saygak'), false);
  assert.equal((await call('POST', '/api/users', { token: admin, body: { username: 'x1x', fullName: 'x', password: 'password123', role: 'saygak' } })).status, 400);
  assert.equal((await call('PATCH', '/api/roles/saygak', { token: admin, body: { permissions: ['expenses.manage'] } })).status, 409);
  assert.equal((await call('PATCH', `/api/clients/${A.id}/login`, { token: admin, body: { isActive: false } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: t })).status, 401);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - `middleware/auth.js`: `findUser` selects `clientId`; `req.user = { ...user, permissions, clientId: user.clientId ?? null }`.
  - `routes/auth.js`: add `clientId: user.clientId ?? null` to the login `user` object; add `clientId` to the `/me` destructure+response.
  - `routes/users.js`: `GET /` → `WHERE role != 'saygak'`; in `assertRole` throw `badRequest('Saygak accounts are managed from the client profile')` if `key === 'saygak'`; in `PATCH /:id` first `const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id); if (target?.role === 'saygak') throw badRequest('Saygak accounts are managed from the client profile');`.
  - `routes/roles.js`: read the file's PATCH/DELETE handlers and add `if (key === 'saygak') throw conflict('The saygak role is fixed');` at the top of each; the POST slug generator must not produce `saygak` (`if (key === 'saygak') key = 'saygak_2'`-style uniqueness check already exists via the conflict path; add the explicit check so it 409s).
  - `routes/clients.js`: extend `patchSchema` with `isPartner: z.boolean().optional()` (writes `isPartner`; log via `diff`); implement the prices and login endpoints using `requireRole('admin')` per route; username rule reuses the `users.js` regex (`/^[\w.-]+$/`, 3–50), password `z.string().min(8).max(100)`; creating the user: `INSERT INTO users (username, fullName, passwordHash, role, createdAt, clientId) VALUES (?, ?, ?, 'saygak', ?, ?)` (default `fullName` = client name); catch `SQLITE_CONSTRAINT_UNIQUE` → 409. Log `client.login.created|reset|active` (never the password).
  - `utils/partner.js`: the two exports above.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Saygak client flag, price list and login management"`.

### Task 4: Deny-by-default access gate

**Files:**
- Modify: `src/middleware/auth.js`, `src/app.js`
- Test: `test/partner.test.js`

**Interfaces:**
- Produces in `middleware/auth.js`:
  - `export const partnerGate = (req, _res, next) => req.user?.clientId ? next(new HttpError(403, 'Forbidden for your role')) : next();` (applied to every staff mount)
  - `export const requirePartner = (req, _res, next) => req.user?.clientId ? next() : next(new HttpError(403, 'Forbidden for your role'));`
- Produces in `app.js`: `export const STAFF_MOUNTS = [];` and a local `mount(path, ...handlers)` that does `STAFF_MOUNTS.push(path); app.use(path, auth, partnerGate, ...handlers);`. Every existing mount except `/api/auth` and `/api/branding` uses `mount`. `/api/partner` is mounted with `auth, requirePartner, partnerRouter(db)` (router created in Task 7; for this task mount a stub returning `{ ok: true }` at `GET /ping`).

**Acceptance Criteria:**
- A saygak token gets 403 on `GET` of every path in `STAFF_MOUNTS` (including `/api/services`, `/api/chat/global`, `/api/orders/received`, `/api/comments`, `/api/clients`, `/api/reports/summary`, `/api/activity`, `/api/users`, `/api/roles`, `/api/expenses`, `/api/expense-types`).
- A staff token gets 403 on `/api/partner/ping`; a saygak token gets 200.
- `/api/auth/me` and `/api/branding` still work for a saygak.
- Adding a new `mount(...)` is automatically covered by the test.

- [ ] **Step 1: Failing test**

```js
const { STAFF_MOUNTS } = await import('../src/app.js');
test('saygak token is denied on every staff mount; staff denied on /partner', async () => {
  assert.ok(STAFF_MOUNTS.length >= 12);
  for (const m of STAFF_MOUNTS) {
    assert.equal((await call('GET', m, { token: partnerA })).status, 403, m);
  }
  assert.equal((await call('GET', '/api/partner/ping', { token: partnerA })).status, 200);
  assert.equal((await call('GET', '/api/partner/ping', { token: admin })).status, 403);
  assert.equal((await call('GET', '/api/auth/me', { token: partnerA })).status, 200);
});
```

(`partnerA` is the token created in Task 3's setup; hoist that setup into a `before`-time helper `makePartner(name, phone, username, prices)` in the test file so later tasks reuse it.)

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (code above; keep `/api/branding` and `/api/auth` mounts as they are). **Step 4: Run** `npm test` → PASS. **Step 5: Commit** — `git commit -am "Deny-by-default access gate for saygak tokens"`.

### Task 5: Partner-kind orders, pickup relaxation and handover

**Files:**
- Modify: `src/routes/orders.js`
- Test: `test/partner.test.js`

**Interfaces:**
- Consumes: `priceMap`, `PARTNER_OPEN_ORDER_CAP` (Task 3), `round2` (Task 2).
- Produces in `orders.js` an exported helper used by Task 7:
  `export function createPartnerOrder(db, user, client, { lines, note }) -> docNum` where `lines = [{ serviceId, expectedQuantity? }]`; rules: client must be partner; service active and priced else `badRequest`; enforces the open-order cap; inserts `kind = 'partner'`, `latitude = 0`, `longitude = 0`, `pickupPlannedAt = now`, `landmark = ''`, line `price = customerPrice = priced`, logs `order.created` with `via`.
- Staff `POST /orders`: `location` and `pickupTime` become optional in `createSchema`; after resolving the client, if `client.isPartner` → build lines from `client_prices` via `createPartnerOrder` (ignoring typed `price`); otherwise require `location` and `pickupTime` (400 if missing).
- `pickupSchema`: `waybillNumber` and `deliveryTime` optional; non-partner orders still require them (400).
- `deliverSchema.paid` → `money.default(0)`. For `kind = 'partner'`: `paid > 0` or `discount > 0` → 400; the order moves to `DELIVERED` with `deliveredDate`.
- `POST /:docNum/payments` on a partner order → 409 `'Saygak orders are paid from the client page'`.

**Acceptance Criteria:**
- Staff creating an order for a partner client gets partner prices regardless of typed prices, `kind = 'partner'`, no location needed; unpriced service → 400.
- A regular order without `location`/`pickupTime`/`waybillNumber`/`deliveryTime` is still rejected (400).
- Cap: the 11th open partner order → 409.
- Handover with sizes: the form submits `sqm = sizesTotal` default; `docTotal = sqm * 6000`; `paid = 0`; debt equals total; reports `outstandingDebt` includes it.
- Per-order payment on a partner order → 409.

- [ ] **Step 1: Failing tests** covering the five criteria (staff creates order for client A with `lines: [{ serviceId: 1, price: 1 }]`, asserts `lines[0].price === 6000`; walk it pickup (no waybill) → wash with sizes `[{width:5,length:4}]` → pack → deliver with `{ lines: [{ id, sqm: 20 }] }` → `docTotal === 120000`, `paid === 0`, `debt === 120000`; `deliver` with `paid: 1000` → 400; per-order payment → 409; cap test creates 10 open orders then expects 409 on the 11th using a dedicated third partner).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Extract the insert part of `POST /` so both paths call one `insertOrder` closure; in `createSchema` use `location: createSchema.shape...optional()` is circular, so declare `const locationField = z.object({...})` once and reuse it in `createSchema` and `editSchema`. Activity log for partner creation includes `{ partner: true, prices }`.
- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** — `git commit -am "Partner-kind orders, no-delivery handover, cap and price lock"`.

### Task 6: Lump payments, reversal and statement

**Files:**
- Create: `src/utils/statement.js`
- Modify: `src/routes/clients.js`
- Test: `test/partner.test.js`

**Interfaces:**
- Produces `src/utils/statement.js`: `export function buildStatement(db, clientId, month)` where `month` is `YYYY-MM`; returns
  `{ month, opening, charges, credits, closing, orders: [{docNum, deliveredDate, docTotal, sqmTotal}], payments: [{batchId, paidDate, amount, discount}], inProgress: [{docNum, status, createdAt}] }`. Math: `from = month + '-01'`, `to` = last day of month. `charges(M)` = sum(`docTotal`) of partner `DELIVERED` orders with `deliveredDate` in M; `credits(M)` = sum(`amount + discount`) of non-reversed `payment_batches` with `paidDate` in M; `opening` = (sum docTotal with `deliveredDate < from`) − (sum credits with `paidDate < from`); `closing = round2(opening + charges − credits)`.
- Staff endpoints:
  - `POST /api/clients/:id/payments` (`requirePerm('orders.payments')`) body `{ amount, discount?, paidDate? }` → `201 { batchId, allocations: [{docNum, cash, disc}], debtLeft }`.
  - `DELETE /api/clients/:id/payments/:batchId` (admin only) → `200 { reversed: true }`; 409 if already reversed.
  - `GET /api/clients/:id/statement?month=YYYY-MM` (`clients.view`).
  - `GET /api/clients/:id/payments` → batches list (for the reversal UI).

**Acceptance Criteria:**
- FIFO by `deliveredDate, docNum`; cash and discount applied oldest-first; one transaction; the order `paid`/`discount` columns and `payments` rows (`batchId` set, only when cash > 0) updated; a `payment_batches` row stores allocations.
- `amount + discount` greater than total debt → 400 with the debt in the message; `discount > 0` needs `orders.discount` (403 otherwise).
- Reversal restores every order's `paid`/`discount`, deletes the batch's `payments` rows, marks the batch reversed, and is logged; non-admin → 403.
- For the current month `closing` equals the client's current total debt (sum of `docTotal − discount − paid`); a reversed batch is excluded from `credits`.

- [ ] **Step 1: Failing tests** (client A has three delivered partner orders of 100000, 200000, 300000 on different `deliveredDate`s; pay 250000 → first fully, second partially (150000); statement equals `{charges: 600000, credits: 250000, closing: 350000}`; overpay 400000 → 400; discount-only 50000 → oldest remaining; reverse batch → `paid` back and `closing` back to prior; operator reversing → 403).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Core allocation:

```js
import { randomUUID } from 'node:crypto';
// inside the route, within db.transaction(() => { ... })():
const orders = db.prepare(
  `SELECT docNum, docTotal, discount, paid FROM orders
   WHERE clientId = ? AND kind = 'partner' AND status = ? AND docTotal - discount > paid
   ORDER BY deliveredDate, docNum`).all(id, ORDER_STATUS.DELIVERED);
const owed = (o) => round2(o.docTotal - o.discount - o.paid);
const totalDebt = round2(orders.reduce((s, o) => s + owed(o), 0));
if (round2(amount + discount) > totalDebt) throw badRequest(`Amount and discount exceed the debt (${totalDebt})`);
let cashLeft = amount, discLeft = discount;
const allocations = [];
for (const o of orders) {
  const debt = owed(o);
  const disc = Math.min(discLeft, debt); discLeft = round2(discLeft - disc);
  const cash = Math.min(cashLeft, round2(debt - disc)); cashLeft = round2(cashLeft - cash);
  if (!cash && !disc) continue;
  db.prepare('UPDATE orders SET paid = ?, discount = ? WHERE docNum = ?').run(round2(o.paid + cash), round2(o.discount + disc), o.docNum);
  if (cash > 0) db.prepare(`INSERT INTO payments (docNum, amount, discount, paidDate, createdAt, creatorId, creatorName, batchId) VALUES (?,?,?,?,?,?,?,?)`)
    .run(o.docNum, cash, disc, date, nowDateTime(), req.user.id, req.user.fullName, batchId);
  allocations.push({ docNum: o.docNum, cash, disc });
  if (cashLeft === 0 && discLeft === 0) break;
}
```

Reversal loops over the stored `allocations` and subtracts, then `DELETE FROM payments WHERE batchId = ?`. Restrict this API to `kind = 'partner'` clients (`isPartner`). Add `round2` import from `utils/sizes.js`.
- [ ] **Step 4: Run** `npm test` → PASS. **Step 5: Commit** — `git commit -am "Saygak lump payments with FIFO allocation, reversal and statement"`.

### Task 7: Saygak-facing API (`/api/partner`)

**Files:**
- Create: `src/routes/partner.js`
- Modify: `src/app.js` (replace the stub from Task 4)
- Test: `test/partner.test.js`

**Interfaces:**
- Consumes: `createPartnerOrder` (Task 5), `buildStatement` (Task 6), `loadSizes`.
- Produces endpoints (all scoped by `req.user.clientId`, which comes from the DB via `authenticate`):
  - `GET /me` → `{ client: { id, name, phone }, openOrders, debt }`
  - `GET /services` → `[{ id, name, unit, price }]` (only services priced for this client and active)
  - `GET /orders?page&limit&status?` → own orders (`kind = 'partner'`, `clientId = me`), `{ data, meta }`
  - `POST /orders` body `{ lines: [{ serviceId, expectedQuantity? }] }` (1–20 lines, `expectedQuantity` int 1–100000; `clientId`/`price`/`clientName` ignored by schema `.strip()`)
  - `GET /orders/:docNum` → own order only; another client's order or a staff-created non-partner order of the same client → 404
  - `PATCH /orders/:docNum` body `{ lines: [{ id, expectedQuantity }] }` and `POST /orders/:docNum/cancel` body `{ reason }` — only while status is `RECEIVED`, else 409; logged with the saygak's name
  - `GET /statement?month=YYYY-MM`
- Partner order presentation (`presentPartnerOrder`): `{ docNum, status, createdAt, deliveredDate, lines: [{ id, serviceName, unit, expectedQuantity, quantity (only once packed), sizes, sizesTotal, price*, sqm*, lineTotal* }], docTotal*, paid*, debt* }` where `*` fields appear only when `status === DELIVERED`. Never present: `createdBy`, `*By` worker names, `waybillNumber`, `location`, `landmark`, `cancelReason`'s staff fields, history, comments.

**Acceptance Criteria:**
- Saygak A cannot see, cancel, or edit saygak B's orders or any non-partner order (404, not 403).
- `POST /orders` ignores `clientId`/`price` fields in the body; uses A's price; unpriced service → 400; open-order cap → 409.
- No amount fields before handover; sizes visible once entered.
- Response JSON never contains the strings `createdBy`, `pickedUpBy`, `washedBy`, `packedBy`, `deliveredBy`, `waybillNumber`, `latitude` (asserted by `JSON.stringify` check).
- Statement for the current month matches Task 6's staff statement for the same client.

- [ ] **Step 1: Failing tests** for each criterion, including the forbidden-field JSON scan and cross-client 404s (A reads/cancels B's docNum).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `partnerRouter(db)` with one prepared helper `ownOrder(docNum, clientId)` = `SELECT * FROM orders WHERE docNum = ? AND clientId = ? AND kind = 'partner'` used by every `:docNum` route (single choke point; no route queries orders without `clientId`). **Step 4: Run** `npm test` → PASS. **Step 5: Commit** — `git commit -am "Saygak-facing API: own orders, create, statement"`.

### Task 8: Backend regression sweep

**Files:** `test/partner.test.js`, existing tests.

**Acceptance Criteria:**
- `npm test` fully green; reports `Summary`/`Debtors` include saygak debt (assert via a delivered partner order).
- Route-walk test (Task 4) still covers every `mount`.
- `API_FRONTEND.md` documents: `sizes` on wash/pack, `kind`, `/api/partner/*`, client prices/login/payments/statement, `clientId` in login/me.

- [ ] **Step 1:** add the reports assertions. **Step 2:** `npm test`. **Step 3:** update `API_FRONTEND.md` (read it first and follow its format). **Step 4:** Commit — `git commit -am "Document sizes and saygak API"`.

---

## Part B: Frontend (`/Users/imac/Desktop/BIS/NEWCRMWEB`)

Verification for every frontend task: `npm run build` must pass (type-check), then check manually in `npm run dev` against a locally running backend (`cd ../NewCRMBack && npm run dev`, with `VITE_API_URL=http://localhost:<port>/api` in `.env.local`).

### Task 9: Types, auth and the SizesEditor component

**Files:**
- Modify: `src/types.ts`, `src/auth.tsx` (no change needed beyond type), `src/format.ts` (if it has number helpers; else inline)
- Create: `src/components/SizesEditor.tsx`

**Interfaces:**
- `types.ts`: `Line` gains `expectedQuantity: number; sizes: { width: number; length: number; area: number }[]; sizesTotal: number`; `Order` gains `kind: 'regular' | 'partner'`; `User` gains `clientId: number | null`; `Client` gains `isPartner: boolean`; add `ClientPrice`, `Statement`, `PaymentBatch` types matching Task 3/6/7 payloads.
- `SizesEditor.tsx` exports:
  - `export interface SizeRow { width: string; length: string }`
  - `export const rowsFromLine = (l: Line): SizeRow[]` (maps saved sizes to strings)
  - `export const rowArea = (r: SizeRow): number` = round2(round2(+width) * round2(+length)) or 0 when invalid
  - `export const rowsTotal = (rows: SizeRow[]): number`
  - `export const rowsPayload = (rows: SizeRow[]) => { width: number; length: number }[]` (only complete rows)
  - `export default function SizesEditor({ rows, onChange, pieces }: { rows: SizeRow[]; onChange: (r: SizeRow[]) => void; pieces: number })` — renders "O'lchamlar (eni × bo'yi, m)", one row per carpet using the existing `NumberInput` (decimal), an "+ Gilam qo'shish" button, remove button per row, live "Jami: X.XX kv.m", and a soft hint `"{rows} ta o'lcham, {pieces} dona"` when counts differ (not blocking).

**Acceptance Criteria:** `npm run build` passes; the component computes 12.4 × 3.1 = 38.44 and totals exactly as the backend.

- [ ] Steps: write the component using `NumberInput` from `components/fields.tsx` (read it first for props), update the types, build, commit (`git commit -am "Add size types and SizesEditor"`).

### Task 10: Sizes in wash/pack and kv.m pre-fill at the final step

**Files:** Modify `src/pages/OrderModal.tsx` (`Step` at ~line 121, `DeliverForm` at ~line 191).

**Behavior:**
- `Step`: state `sizes: Record<lineId, SizeRow[]>` initialised from `rowsFromLine(l)` (pack therefore starts from wash sizes). For lines with `l.unit === 'kv.m'` render `<SizesEditor>` under the count input. Submit body line = `{ id, quantity, ...(l.unit === 'kv.m' && { sizes: rowsPayload(sizes[l.id]) }) }` (always send for kv.m so editing/clearing works at both steps).
- `DeliverForm`: initial `sqm` state = `Object.fromEntries(order.lines.filter(l => l.unit==='kv.m' && l.sizesTotal > 0).map(l => [l.id, String(l.sizesTotal)]))`; stays editable. Under the input, if `+sqm[l.id] !== l.sizesTotal && l.sizesTotal > 0` show amber text `"o'lchamlardan farq qiladi: {sizesTotal} → {value}"` (non-blocking).
- `LinesTable`: for kv.m lines with sizes, list the rows (`eni × bo'yi = area`) in small grey text.
- Partner orders: in `DeliverForm`, if `order.kind === 'partner'` hide the "Mijozdan olingan summa"/"Chegirma" fields, send `paid: 0`, and label the submit button "Topshirildi".

**Acceptance Criteria:** wash with 2 rows, pack shows the same rows and lets edit; deliver shows kv.m pre-filled with the total and editable; non-kv.m lines show no editor; `npm run build` passes.
- [ ] Commit — `git commit -am "Sizes at wash/pack and kv.m pre-fill at delivery"`.

### Task 11: Staff-side saygak management and partner-aware order creation

**Files:** Modify `src/pages/Clients.tsx`, `src/pages/CreateOrderModal.tsx`, `src/components/ClientPicker.tsx` (already has uncommitted local changes in the working tree; read it and keep them), `src/pages/Orders.tsx`.

**Behavior:**
- Client detail: "Saygak" toggle (`PATCH /clients/:id {isPartner}`; `clients.manage`). When on, show (admin only for editing): price list table (`GET/PUT /clients/:id/prices`), "Login" card (`GET/PUT/PATCH /clients/:id/login`; username, password, "Parolni yangilash", active toggle), "Oylik to'lov qabul qilish" form (`POST /clients/:id/payments`; amount, optional discount if `orders.discount`, date; shows total debt and rejects locally if above), payment history list with an admin-only "Bekor qilish" per batch, and a month selector showing the statement (opening / charges / payments / closing, orders list).
- `CreateOrderModal`: when the picked client has `isPartner`, hide location + pickup time, show service lines with the saygak price read-only (prices from `GET /clients/:id/prices`), send lines as `[{ serviceId, price: 0 }]` (server ignores price).
- `Orders.tsx`: partner orders show a "Saygak" badge; the stage label for `Yetkazib berildi` on partner orders reads "Topshirildi"; hide map/address for them.

**Acceptance Criteria:** staff can turn a client into a saygak, set prices and a login, create an order for them without an address, take a lump payment and see the statement; `npm run build` passes.
- [ ] Commit — `git commit -am "Saygak management, partner-aware order creation, lump payments"`.

### Task 12: Saygak portal

**Files:**
- Create: `src/pages/partner/PartnerApp.tsx`, `PartnerOrders.tsx`, `PartnerNewOrder.tsx`, `PartnerStatement.tsx`
- Modify: `src/App.tsx`, `src/components/Layout.tsx` (only if reusable; otherwise `PartnerApp` has its own minimal header with the app branding, a logout button and the bottom tab bar from the existing mobile layout)

**Behavior:**
- `App.tsx`: after the `!user` check add `if (user.clientId) return <PartnerApp />;` so a saygak can never render a staff route.
- `PartnerApp`: routes `/` → orders, `/new` → new order, `/statement` → statement; tabs "Buyurtmalar", "Yangi", "Hisobot".
- `PartnerOrders`: list `GET /partner/orders`, status badge (partner label "Topshirildi" for delivered), tap opens a detail sheet (`GET /partner/orders/:id`) showing lines, sizes rows and total kv.m, and — only after handover — price, line totals, order total, paid, debt. While status is "Zakaz Qabul qilindi", show "Bekor qilish" (`POST .../cancel`, needs a reason) and editable expected counts.
- `PartnerNewOrder`: loads `GET /partner/services`; checkboxes per service with an optional expected count; shows the saygak's price per unit; submit `POST /partner/orders`; surfaces the 10-open-orders error message.
- `PartnerStatement`: month picker; cards opening / charges / payments / closing; order list for the month; payments list; "jarayonda" list without amounts.

**Acceptance Criteria:** logging in as a saygak shows only these three tabs; manual check that typing a staff URL (e.g. `/clients`) redirects to orders; the browser network tab shows only `/auth/*`, `/branding` and `/partner/*` calls; `npm run build` passes.
- [ ] Commit — `git commit -am "Saygak portal: orders, new order, statement"`.

### Task 13: End-to-end verification and release notes

- [ ] Run the full backend suite (`npm test`) and the frontend build (`npm run build`).
- [ ] Manual scenario in a local run: admin creates a saygak with Gilam = 6000 and a login; saygak logs in, creates an order; staff pick it up (no waybill), wash with two sizes, pack with edited sizes, hand over (kv.m prefilled, edited once); saygak sees amounts; staff take a lump payment covering one and a half orders; statement closing equals total debt; reverse the batch and confirm balances revert; deactivate the login and confirm the saygak is logged out on the next request.
- [ ] Security spot checks with the saygak token via `curl`: `/api/orders/received`, `/api/services`, `/api/chat/global`, `/api/clients`, another saygak's `/api/partner/orders/<id>` → 403/403/403/403/404.
- [ ] Deploy order note: backend first (additive migrations run on start; the app's SQLite file is replicated by litestream, so take no manual action), then frontend. Old frontend keeps working against the new backend.
- [ ] Commit any doc updates (plain messages) in both repos.

## Spec coverage map

| Spec item | Task |
|---|---|
| Sizes table, wash/pack API, rounding, kv.m-only | 1, 2 |
| Sizes UI, pre-fill, difference warning, delivery log of both numbers | 2 (log), 9, 10 |
| `clients.isPartner`, `client_prices`, admin-only price edits + log | 1, 3, 11 |
| Locked `saygak` role, login pairing trigger, one login per saygak, hidden in Users, deactivate revokes | 1, 3 |
| Deny-by-default gate, route-walk test, DB-derived `clientId` | 3, 4, 7 |
| Partner orders (kind, placeholders, price lock, cap, edit/cancel while received, staff-created) | 5, 7, 11, 12 |
| Handover without payment, status reuse | 5, 10 |
| Lump FIFO payment, overpayment rejection, reversal by batch | 6, 11 |
| Monthly statement definition and invariant | 6, 7, 11, 12 |
| Fields hidden from saygak (workers, comments, chat, history, location) | 4, 7 |
| Slim saygak UI | 12 |
| Tests (cross-client 404, staff routes denied, price tamper, FIFO, sizes) | 2–8 |
| Parking lot (self password change, credit balance, approval, statement export) | Not built; recorded in spec |

Deliberate deviation from the spec text: no `partner.portal` permission (see "Plan decisions").

# Merchant Ops Platform — Multi-Tenant Shopify App

> Formerly framed as “Products & Inventory Manager.” Repo folder name unchanged.  
> **Single source of truth** for architecture, install steps, skills, and progress.  
> **Agents:** `.cursor/rules/` loads this automatically — you must still read `PROJECT.md` and keep Section 19 updated.  
> **Human one-pager:** `docs/roadmap/platform-next.md` (points here).

---

## 0. Automatic context (new chats)

| Mechanism | Location | What it does |
|-----------|----------|--------------|
| **Cursor rules** | `.cursor/rules/project-context.mdc` | Always apply — read this file, update progress, user installs only |
| **Verification rule** | `.cursor/rules/verification.mdc` | Always apply — verify scripts, retry, checklists every phase |
| **Skills routing** | `.cursor/rules/skills-routing.mdc` | Auto-pick skills; full inventory = **Section 16** |
| **Code conventions** | `.cursor/rules/shopify-code.mdc` | Applies when editing `app/`, `lib/`, `components/`, `prisma/` |
| **Token savings** | `.cursorignore` (create at repo root) | Excludes `node_modules`, `.next`, `.obsidian` from AI context |
| **Obsidian notes** | `docs/` | Optional vault; master plan stays here in `PROJECT.md` |
| **Roadmap summary** | `docs/roadmap/platform-next.md` | Short human summary of Phase 8–13 |

**You do not need to tell the agent "read PROJECT.md"** — rules enforce it.  
**You do need** to keep Section 19 accurate (or let the agent update it after each phase).

### PROJECT.md maintenance (agents must do this)

After any phase milestone, dependency change, or architecture decision:

1. Update **Section 19** checkboxes and `Current phase` / `Last updated` / `Notes`
2. If install steps changed, update **Section 11**
3. If new env vars, update **Section 10**
4. One-line `Notes` entry: what shipped, what's next, blockers

---

## Agent rules (mandatory)

```
PROJECT: Merchant Ops Platform (multi-tenant Shopify)
WORKSPACE: G:\fire fist\shopify apps\products and inventory

HARD RULES — NEVER BREAK:
1. USER installs everything. Agent must NOT run npm install, shopify install, git push, deploy, DB migrations, or create Partner/App records in Shopify.
2. Agent only gives step-by-step instructions for installs. User confirms each step before the next.
3. Agent must NOT commit or push unless user explicitly asks.
4. Agent must NOT read or print .env / access tokens / API secrets.
5. Shop access tokens stay server-side only — stored encrypted in DB, never in client code or API responses.
6. Read PROJECT.md + apply skills from Section 16–17 automatically (via .cursor/rules).
7. After completing work, update Section 19 in this file.
8. VERIFICATION (every phase, every chat): Read `docs/verification/AGENT-PROTOCOL.md`. Run `npm run verify:phase-<N>` before marking phase done. Retry until exit 0. Log → `docs/verification/agent-log.md`. Give user `docs/verification/phase-<N>-checklist.md`. Do not skip in new chats.
9. KEEP IT LIGHT: no new heavy deps, microservices, or abstractions unless phase Done-when requires them. Prefer reuse. Deploy must stay simple (one Next app).
10. SECURITY MAX: treat DB as holding shop keys — encrypt tokens, hash passwords, httpOnly cookies, shop-scoped auth, never log secrets, never send tokens to browser/AI prompts.
```

---

## 1. Project overview

### Purpose

A **multi-tenant Shopify Merchant Ops Platform**. Any client store can install the Partner app. After install, the app **discovers** that store’s products, metafield definitions, locations, and inventory — no hardcoded per-store config.

**Core (always on):** OAuth multi-shop, encrypted tokens, `shop_configs`, agency ops, merchant dashboard shell.

**Modules (pluggable per shop):** Products, Metafields, Inventory, Import today → Coupons, SEO, Geo, and more later without rebuilding auth.

Three surfaces:

| Surface | Who uses it | Hosted on |
|---------|-------------|-----------|
| **Agency Dashboard** | App owner / operator | `ops.yourdomain.com` |
| **Embedded Shopify app** | Store staff (in Admin) | Shopify Admin iframe — **thin shell**: Home + Settings + launch CTA |
| **Merchant Dashboard** | Store staff (full tools) | `app.yourdomain.com/merchant/*` (and app-domain login) |

### Non-tech UX principles

- Never show raw JSON / list encoding to merchants by default
- Widgets by metafield type (defs from `shop_configs` + normalize in `lib/metafields/validators.ts`)
- **Two edit modes side by side** (same data, same save):
  - **Simple forms** (default) — color pickers, tags/multi-select, prose fields
  - **Edit with preview** — storefront/PDP iframe + same widgets
- Bulk import: dumb Excel → AI → template CSV (AI **not** on single-product create path)
- Platform grows by **modules**, not one-off apps

### Simplicity / deploy-light (mandatory)

This app must stay **easy to deploy** (single Next.js app on Vercel or similar). Agents must not bloat it.

- One deployable app — no separate worker fleets, no Kafka, no extra frontends unless Phase Done-when says so
- Reuse existing libs/components before adding packages
- New deps only when stdlib / current stack cannot do the job
- Module shell (Phase 13) = nav flags + routes, **not** a plugin runtime or monorepo of apps
- AI (Phase 12) = one mapper path for bulk Excel only; keep out of every page
- PDP preview (Phase 11) = iframe + same forms; no full theme editor
- Prefer boring, boring code over clever architecture

User will add **next vision steps later** after current Phase 8–13 arc — do not invent Phase 14+ features ahead of that.

### Agency Dashboard capabilities

- See all client stores that installed the app
- View per-store status: connected, last sync, product count, currency
- Open any client's store context to manage their data
- Generate install link for new clients
- Per-store settings (low-stock threshold, etc.)
- Disconnect / mark uninstalled stores
- Enable/disable modules per shop (Phase 13)

### Merchant capabilities (modules)

| Module | Where | Capability | Status |
|--------|-------|------------|--------|
| **Home** | Embedded `/app` | Store stats, **Open dashboard** CTA | Shipped |
| **Settings** | Embedded `/app/settings` | Store preferences | Partial |
| **Products** | `/merchant/products` | List, search, create | Shipped (Phase 3/7) |
| **Metafields** | `/merchant/metafields` | Bulk edit — dynamic columns per store | Shipped (Phase 4); smart widgets Phase 10 |
| **Inventory** | `/merchant/inventory` | Stock per variant per location | Shipped (Phase 6) |
| **Import** | `/merchant/import` | CSV upload + create | Shipped (Phase 7); AI Excel Phase 12 |
| **PDP preview editor** | Merchant product edit | Forms + live PDP | Phase 11 |
| **Coupons / SEO / Geo** | Future modules | TBD | Phase 13+ stubs |

Agency operators use the **same modules** at `/agency/stores/[shopId]/*` for any client store.

### Key design principle: zero hardcoded store config

- Metafield columns → fetched from `metafieldDefinitions(ownerType: PRODUCT)` per store
- Locations → fetched from `locations` per store
- Product types / categories → discovered from store's actual products
- Currency, timezone → from `shop` query per store
- Each store's OAuth access token stored separately in database

### First client (dev / test store)

| Field | Value |
|-------|-------|
| Store name | Arthenic |
| Custom domain | arthenic.com |
| myshopify domain | `f1qzim-fc.myshopify.com` |
| Currency | INR |
| Notes | First install for testing; app must work identically for any future store |

---

## 2. Architecture

### Why OAuth (not Custom App static token)

| Approach | Single store | Multi-client |
|----------|--------------|--------------|
| Custom App static token | OK | **Does not scale** — one token per store, manual setup |
| Partner App + OAuth | Overkill for one store | **Required** — clients click Install, token stored per shop |

This project uses a **Shopify Partner App with OAuth**. Each installed store gets its own access token saved in the database.

### Plan alignment (vs generic multi-store prompts)

This doc is **ahead** of a dashboard-only SaaS prompt in several ways. Keep these; do not regress.

| Topic | Generic prompt | This project |
|-------|----------------|--------------|
| Surfaces | One agency dashboard only | **Agency dashboard + thin embedded app + merchant dashboard** |
| Store config | Fetch on demand | **Bootstrap on install** + cache in `shop_configs` |
| Inventory edit | `inventoryAdjustQuantities` only | **`inventorySetQuantities`** (spreadsheet) + adjust (delta) + idempotency |
| API version | `2025-01` | **`2026-07`** |
| Image upload | Not covered | **`read_files` / `write_files`** + staged uploads |
| Product upload | Not covered | **Phase 7** — create + CSV import |
| CLI workflow | Not covered | **`shopify.app.toml`** + `config link` + `app dev` |

Good ideas adopted from generic prompts (added below): connect-store page, HMAC on OAuth callback, richer shop query on connect, `inventory_log` / audit table, shadcn/ui on agency UI, rate-limit your own API routes.

### Three-surface layout

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENCY DASHBOARD (ops.yourdomain.com) — UNCHANGED              │
│  - Login as operator                                            │
│  - List all client stores                                       │
│  - Click store → manage products / metafields / inventory       │
│  - Generate install links                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EMBEDDED SHOPIFY APP (Shopify Admin iframe)                    │
│  - OAuth install / callback (same app host)                     │
│  - Home: store stats + "Manage products & inventory" CTA        │
│  - Settings: basic store preferences                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  MERCHANT DASHBOARD (app.yourdomain.com/merchant/*)             │
│  - Session via app-domain login (Phase 9); handoff optional     │
│  - Modules: products, metafields, inventory, import, …          │
│  - Edit modes: simple forms + PDP preview (Phase 10–11)         │
│  - Full tools for ONE shop: products, metafields, inventory     │
│  - Same components/APIs as agency store views                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  PostgreSQL DB   │
                    │  shops, sessions │
                    │  shop_configs    │
                    │  agency_users    │
                    │  merchant_users  │
                    └──────────────────┘
```

In development all routes can run on `localhost:3000` (`/agency/*`, `/app/*`, `/merchant/*`). In production, use separate domains or subdomains for agency vs app host.

### Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Shopify integration | `@shopify/shopify-api` + `@shopify/app-bridge-react` |
| Embedded UI | Shopify Polaris |
| Database | PostgreSQL (production) / SQLite (local dev option) |
| ORM | Prisma |
| Styling | Tailwind CSS + **shadcn/ui** (agency dashboard) + **Polaris** (merchant embedded app) |
| Tables | TanStack Table v8 |
| Server state | TanStack Query |
| Client state | Zustand |
| Validation | Zod |
| Agency auth | Operator credentials on `/agency` (separate from merchant users) |
| Merchant auth | App-domain login (Phase 9) + Admin soft-land; shop OAuth token still server-side |
| Token encryption | AES-256 via `ENCRYPTION_KEY` env var |

### Request flows

**Merchant (embedded shell — Home / Settings only):**
```
Shopify Admin iframe
    ↓ App Bridge session token
Next.js /app/* routes (stats + settings + launch CTA)
    ↓ load shop session from DB by shop domain
```

**Merchant dashboard entry (dual path — Phase 9):**
```
Path A — From Admin:
  Embedded Home → "Open dashboard"
      ↓ valid merchant cookie for this shop?
      ├─ yes → /merchant/* tools
      └─ no  → /merchant/login (or register) → then tools

Path B — Direct:
  app.yourdomain.com/login
      ↓ email + password (merchant_user linked to shop_id)
      ↓ merchant session cookie
      → /merchant/* tools

After OAuth install:
  Prompt "Create dashboard login" (email + password tied to shop_id)
  Invites for more staff per shop (later)

Rules:
  - Login gates WHO may use the dashboard
  - Shopify Admin GraphQL always uses that shop's encrypted OAuth token from DB
  - Agency operator auth MUST stay separate from merchant_users
  - Legacy handoff token may remain as optional bootstrap; not the only door
```

**Merchant (full tools — once authenticated):**
```
app.yourdomain.com/merchant/*
    ↓ merchant session (login cookie; optional handoff bootstrap)
    ↓ scoped to one shopId
    ↓ decrypt that shop's access token
Shopify Admin GraphQL API for THAT shop
```

**Agency operator:**
```
ops.yourdomain.com
    ↓ operator session (NextAuth / JWT)
Next.js /agency/* routes
    ↓ operator selects shopId
    ↓ load that shop's token from DB
Shopify Admin GraphQL API for selected shop
```

**OAuth install:**
```
Client clicks Install URL
    ↓ Shopify OAuth consent
    ↓ /api/auth/callback
    ↓ exchange code → access token
    ↓ save shop + token to DB
    ↓ run store bootstrap (fetch defs, locations, shop info)
    ↓ redirect to embedded app home
```

### API configuration (per shop)

| Setting | Value |
|---------|-------|
| URL pattern | `https://{shop}.myshopify.com/admin/api/{version}/graphql.json` |
| Auth header | `X-Shopify-Access-Token: {token from DB for that shop}` |
| API version | `2026-07` (pin in env, update deliberately) |

> Always use the **myshopify.com** hostname from the shop record, not custom domains.

### Required Admin API scopes (in `shopify.app.toml`)

| Scope | Purpose |
|-------|---------|
| `read_products` | List and read products |
| `write_products` | Create and update products |
| `read_inventory` | Read stock levels |
| `write_inventory` | Adjust stock |
| `read_locations` | List warehouses |
| `read_files` | Read uploaded files |
| `write_files` | Staged image uploads |

Optional (if metaobjects needed later):

| Scope | Purpose |
|-------|---------|
| `read_metaobjects` | Read metaobjects |
| `write_metaobjects` | Write metaobjects |
| `read_metaobject_definitions` | Read metaobject schemas |
| `write_metaobject_definitions` | Create metaobject schemas |

---

## 3. Database schema

### `shops`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `agency_user_id` | uuid | nullable FK → agency_users (who connected this store) |
| `shop_domain` | string | unique, e.g. `f1qzim-fc.myshopify.com` |
| `shop_name` | string | from `shop.name` |
| `shop_email` | string | from `shop.email` |
| `shopify_shop_id` | string | from `shop.id` GID |
| `plan_name` | string | from `shop.plan.displayName` |
| `access_token` | string | encrypted at rest |
| `scope` | string | granted scopes |
| `currency_code` | string | e.g. `INR` |
| `timezone` | string | IANA timezone |
| `is_active` | boolean | false after uninstall |
| `installed_at` | datetime | |
| `uninstalled_at` | datetime | nullable |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### `shop_configs`

Per-store settings and cached discovery data. Refreshed on install and on demand.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `shop_id` | uuid | FK → shops |
| `low_stock_threshold` | int | default 5 |
| `metafield_definitions` | json | cached array from API |
| `locations` | json | cached array from API |
| `product_types` | json | discovered unique product types |
| `last_synced_at` | datetime | last bootstrap/refresh |
| `settings` | json | extensible per-store flags |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### `shopify_sessions`

OAuth session storage (required by `@shopify/shopify-api`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | string | session id |
| `shop` | string | |
| `state` | string | OAuth state |
| `is_online` | boolean | |
| `scope` | string | |
| `expires` | datetime | nullable |
| `access_token` | string | encrypted |
| `user_id` | string | nullable |

### `agency_users`

Operators who log into the agency dashboard.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `email` | string | unique |
| `password_hash` | string | bcrypt |
| `name` | string | |
| `role` | string | `admin` / `operator` |
| `created_at` | datetime | |

### `merchant_users` (Phase 9)

Store staff who log into the merchant dashboard (`/login`). Separate from agency operators.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `shop_id` | uuid | FK → shops |
| `email` | string | unique per shop (`shop_id`+`email`); same email can link many stores |
| `password_hash` | string | bcrypt |
| `name` | string | |
| `role` | string | `owner` / later staff roles |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### `audit_logs` (Phase 8)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `shop_id` | uuid | FK |
| `actor` | string | agency user email or shop staff |
| `action` | string | e.g. `metafields.update`, `inventory.adjust` |
| `details` | json | |
| `created_at` | datetime | |

### `inventory_logs` (optional, Phase 8 — or fold into `audit_logs`)

Dedicated inventory change history for reporting.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `shop_id` | uuid | FK |
| `variant_id` | string | Shopify variant GID |
| `inventory_item_id` | string | Shopify inventory item GID |
| `location_id` | string | Shopify location GID |
| `delta` | int | change amount |
| `quantity_after` | int | nullable |
| `reason` | string | correction, received, etc. |
| `adjusted_by` | string | agency user email |
| `adjusted_at` | datetime | |

> **Note:** Per-product metafield value caching in a separate `metafield_cache` table is **not planned** — metafield definitions live in `shop_configs.metafield_definitions`; values are fetched live from Shopify (with React Query cache in the browser).

---

## 4. Store bootstrap (runs on every install)

After OAuth completes, before showing the app:

```
1. Save shop record + encrypted access token
2. Query shop {
     id, name, email, myshopifyDomain,
     currencyCode, timezoneAbbreviation,
     plan { displayName },
     primaryDomain { url }
   }
3. Paginate all metafieldDefinitions(ownerType: PRODUCT) → cache in shop_configs
4. Fetch all locations → cache in shop_configs
5. Sample products to discover unique productTypes → cache in shop_configs
6. Set last_synced_at = now
7. Redirect to embedded app home
```

**Refresh triggers:**
- Manual "Sync store config" button in agency dashboard or merchant settings
- Webhook `APP_UNINSTALLED` → mark shop `is_active = false`
- Optional: scheduled nightly re-sync per active shop

**No hardcoded metafield namespaces or product types anywhere in code.**

---

## 5. Metafields strategy (per store)

| Action | Approach |
|--------|----------|
| Discover definitions | `metafieldDefinitions(ownerType: PRODUCT)` — paginate all, cache per shop |
| Build UI columns | Read from `shop_configs.metafield_definitions` for current shop |
| Read values | Query per product; prefer `jsonValue` for complex types |
| Write values | `metafieldsSet` — include `ownerId`, `namespace`, `key`, `value`, `type` |
| Create new definitions | Only if merchant explicitly requests — `metafieldDefinitionCreate` |
| App-owned defs via TOML | Only for app-specific data, not merchant product metafields |

### Metafield types to support in UI

| Shopify type | UI control |
|--------------|------------|
| `single_line_text_field` | Text input |
| `multi_line_text_field` | Textarea |
| `number_integer` / `number_decimal` | Number input |
| `boolean` | Checkbox |
| `date` | Date picker |
| `url` | URL input + validation |
| `color` | Color picker |
| `json` | Prose textarea (plain text OK; normalize wraps) |
| `list.*` | Tags / one-per-line (no JSON array typing) |
| `file_reference` | File upload → staged upload → GID (Phase 8) |
| `product_reference` | Product search picker → GID (Phase 8) |

---

## 6. API corrections (Shopify docs)

| Topic | Common mistake | Correct |
|-------|----------------|---------|
| API host | custom domain | `{shop}.myshopify.com` |
| API version | `2025-01` | `2026-07` (pin in env) |
| Rate limits | ~40 req/sec | Cost-based bucket — read `extensions.cost.throttleStatus` |
| `metafieldsSet` | unlimited batch | **Max 250 items** per mutation |
| Inventory spreadsheet | `inventoryAdjustQuantities` only | **`inventorySetQuantities`** with `compareQuantity` for absolute |
| Inventory delta | same | **`inventoryAdjustQuantities`** with `delta` |
| Metafield defs | hardcode per client | **Fetch dynamically** per store on install |
| Idempotency | skip | **Required from API 2026-04** — `@idempotent(key:)` |
| Multi-store auth | static token in env | **OAuth token per shop in DB** |

---

## 7. Core GraphQL operations

All operations run against the **currently selected shop's** access token. Replace `{shop}` with the shop domain from the session.

### 7.1 Shop info (on connect / bootstrap)

```graphql
query {
  shop {
    id
    name
    email
    myshopifyDomain
    currencyCode
    timezoneAbbreviation
    plan { displayName }
    primaryDomain { url }
  }
}
```

### 7.2 List products (paginated + search)

```graphql
query Products($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query) {
    edges {
      cursor
      node {
        id
        title
        handle
        productType
        status
        variants(first: 50) {
          nodes {
            id
            sku
            price
            inventoryItem { id tracked }
          }
        }
        metafields(first: 20) {
          nodes { id namespace key value type }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### 7.3 Metafield definitions (discover per store)

```graphql
query MetafieldDefs($first: Int!, $after: String) {
  metafieldDefinitions(first: $first, after: $after, ownerType: PRODUCT) {
    edges {
      node {
        id
        name
        namespace
        key
        type { name }
        description
        validations { name value }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### 7.4 Set metafields (bulk, max 250)

```graphql
mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id namespace key value }
    userErrors { field message }
  }
}
```

### 7.5 Locations

```graphql
query {
  locations(first: 20) {
    nodes {
      id name isActive
      address { city country }
    }
  }
}
```

### 7.6 Inventory read

```graphql
query InventoryItem($id: ID!) {
  inventoryItem(id: $id) {
    id sku
    inventoryLevels(first: 20) {
      nodes {
        location { id name }
        quantities(names: ["available", "on_hand", "committed", "incoming"]) {
          name quantity
        }
      }
    }
  }
}
```

### 7.7 Inventory set (absolute)

```graphql
mutation InventorySet($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup {
      changes { name delta quantityAfterChange }
    }
    userErrors { field message code }
  }
}
```

### 7.8 Inventory adjust (delta)

```graphql
mutation InventoryAdjust($input: InventoryAdjustQuantitiesInput!, $idempotencyKey: String!) {
  inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup {
      reason
      changes { name delta item { id sku } location { id name } }
    }
    userErrors { field message }
  }
}
```

Valid `reason` values: `correction`, `received`, `return`, `damaged`, `theft`, `promotion`, `other`

### 7.9 Create product

```graphql
mutation ProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
  productCreate(product: $product, media: $media) {
    product {
      id title handle status
      variants(first: 5) {
        nodes { id sku price inventoryItem { id tracked } }
      }
    }
    userErrors { field message }
  }
}
```

### 7.10 Image upload flow

1. `stagedUploadsCreate` → presigned URL
2. `PUT` file to staged URL
3. `productCreate` with `media` using `resourceUrl`

---

## 8. Rate limit strategy

Per-shop buckets (Shopify rate limits are per app + store combination).

1. Read `extensions.cost.throttleStatus` from every response
2. Sleep when `currentlyAvailable` < next request cost
3. On HTTP 429, exponential backoff from 1 second
4. Batch `metafieldsSet` in chunks of ≤250
5. Full catalog export → `bulkOperationRunQuery`

---

## 9. Folder structure

```
products-and-inventory/
├── PROJECT.md
├── shopify.app.toml                    # linked via `shopify app config link`
├── shopify.web.toml                    # optional — web process config (CLI)
├── prisma/
│   └── schema.prisma
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # redirect to agency or app
│   │
│   ├── agency/                         # OPERATOR DASHBOARD (ops.yourdomain.com)
│   │   ├── layout.tsx                  # agency auth guard
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx          # overview stats all stores
│   │   ├── connect/page.tsx            # enter myshopify domain → start OAuth
│   │   ├── stores/page.tsx             # list all client stores
│   │   ├── stores/[shopId]/
│   │   │   ├── page.tsx                # store detail + config
│   │   │   ├── products/page.tsx
│   │   │   ├── metafields/page.tsx
│   │   │   ├── inventory/page.tsx
│   │   │   └── import/page.tsx
│   │   └── settings/page.tsx           # agency-wide settings
│   │
│   ├── app/                            # MERCHANT EMBEDDED APP (inside Shopify Admin)
│   │   ├── layout.tsx                  # App Bridge provider
│   │   ├── page.tsx                    # merchant home
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── metafields/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── import/page.tsx
│   │   └── settings/page.tsx
│   │
│   └── api/
│       ├── auth/
│       │   ├── route.ts                # OAuth begin
│       │   └── callback/route.ts       # OAuth callback + bootstrap
│       ├── webhooks/
│       │   └── app-uninstalled/route.ts
│       ├── agency/
│       │   ├── login/route.ts
│       │   ├── stores/route.ts         # list shops
│       │   └── stores/[shopId]/
│       │       ├── sync/route.ts       # re-run bootstrap
│       │       └── config/route.ts
│       └── shops/
│           └── [shopId]/
│               ├── products/route.ts
│               ├── metafield-definitions/route.ts
│               ├── metafields/route.ts
│               ├── locations/route.ts
│               ├── inventory/route.ts
│               ├── inventory/set/route.ts
│               ├── inventory/adjust/route.ts
│               ├── products/create/route.ts
│               └── upload/staged/route.ts
│
├── components/
│   ├── agency/
│   │   ├── StoreList.tsx
│   │   ├── StoreCard.tsx
│   │   └── InstallLinkGenerator.tsx
│   ├── merchant/
│   │   ├── AppNav.tsx
│   │   ├── ProductTable.tsx
│   │   ├── ProductForm.tsx
│   │   ├── MetafieldGrid.tsx
│   │   ├── MetafieldCell.tsx
│   │   ├── InventoryGrid.tsx
│   │   └── LocationSwitcher.tsx
│   └── shared/
│       └── DataTable.tsx
│
├── lib/
│   ├── shopify/
│   │   ├── client.ts                   # GraphQL client — takes shop + token
│   │   ├── auth.ts                     # OAuth helpers
│   │   ├── session.ts                  # load session by shop
│   │   ├── bootstrap.ts                # post-install store discovery
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   └── throttle.ts
│   ├── db/
│   │   ├── prisma.ts
│   │   └── shops.ts                    # shop CRUD + token encrypt/decrypt
│   ├── encryption.ts                   # AES-256 encrypt/decrypt for tokens
│   ├── agency/
│   │   └── auth.ts                     # operator session
│   ├── metafields/
│   │   ├── types.ts
│   │   └── validators.ts
│   └── csv/
│       ├── productImport.ts
│       └── export.ts
│
├── types/
│   └── shopify.ts
├── .env.example
├── .env.local                          # NEVER commit
└── .gitignore
```

---

## 10. Environment variables

### `.env.local` (user creates — never commit)

```env
# Shopify Partner App
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-tunnel-or-app-domain.com
SCOPES=read_products,write_products,read_inventory,write_inventory,read_locations,read_files,write_files
SHOPIFY_API_VERSION=2026-07

# Agency dashboard (separate domain in production)
AGENCY_DASHBOARD_URL=https://ops.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/shopify_ops
# or for local dev: DATABASE_URL=file:./dev.db

# Security
SESSION_SECRET=random_64_char_string
ENCRYPTION_KEY=random_32_byte_hex_for_token_encryption

# Agency operator (seed account — change after first login)
AGENCY_ADMIN_EMAIL=you@yourdomain.com
AGENCY_ADMIN_PASSWORD=change_me
```

### `.env.example` (safe to commit)

Copy from above with empty secrets.

### `.gitignore` must include

```
.env.local
.env*.local
prisma/dev.db
prisma/dev.db-journal
```

---

## 11. User installation guide (step-by-step + directories)

> **The user runs every command below.** Agent gives steps only — never runs installs.

**Project root (always):**

```
G:\fire fist\shopify apps\products and inventory\
```

### Directory map after full setup

```
G:\fire fist\shopify apps\products and inventory\
├── .cursor\
│   └── rules\                          ← auto context for agents (already created)
│       ├── project-context.mdc
│       ├── skills-routing.mdc
│       └── shopify-code.mdc
├── .cursorignore                       ← YOU create (Section 0) — token savings
├── PROJECT.md                          ← this file
├── docs\                               ← Obsidian vault (optional)
│   ├── README.md
│   ├── Clients\
│   └── Phases\
├── shopify.app.toml                    ← Step 3: shopify app config link
├── shopify.web.toml                    ← optional (CLI)
├── package.json                        ← Step 5–6
├── prisma\
│   ├── schema.prisma                   ← Step 6
│   └── dev.db                          ← SQLite only, if used
├── .env.example                        ← Step 7
├── .env.local                          ← Step 7 (never commit)
├── .gitignore
├── app\                                ← agent builds Phase 0+
├── components\
├── lib\
└── types\
```

### Global installs (machine-wide, not in project folder)

| Step | What | Install location | Verify |
|------|------|------------------|--------|
| 1a | Node.js LTS | `C:\Program Files\nodejs\` | `node -v` |
| 1b | Git | `C:\Program Files\Git\` | `git -v` |
| 1c | Shopify CLI | npm global (`%AppData%\npm\`) | `shopify version` |
| 1d | Cursor Shopify plugin | Cursor → Marketplace | `/shopify-admin` works |
| 1e | PostgreSQL (optional) | `C:\Program Files\PostgreSQL\` or Supabase cloud | connection string |

### Step 1 — Prerequisites

**Node.js LTS (v20 or v22)** — https://nodejs.org

```powershell
node -v
npm -v
```

**Git** — https://git-scm.com/download/win

```powershell
git -v
```

**Shopify CLI**

```powershell
npm install -g @shopify/cli@latest
shopify version
```

**Shopify Partner account** — https://dev.shopify.com/dashboard (free)

**PostgreSQL** (production) or SQLite (local dev)
- Postgres: https://www.postgresql.org/download/windows/
- Or use Supabase/Neon free tier for hosted Postgres

**Cursor extensions (recommended)** — install in Cursor → Extensions:

- Prisma
- ESLint (or Biome) + Prettier
- Tailwind CSS IntelliSense
- GraphQL (optional)

**Cursor Shopify plugin** — skills auto-routed via `.cursor/rules/skills-routing.mdc`

**Create `.cursorignore` at project root** (copy from Section 0 table or use contents in repo once created).

---

### Step 2 — Create Shopify Partner App (browser)

**Where:** https://dev.shopify.com/dashboard (no local directory)

1. Go to https://dev.shopify.com/dashboard
2. **Apps** → **Create app** → **Create app manually**
3. Name: `Products & Inventory Manager`
4. Copy **Client ID** (`SHOPIFY_API_KEY`) and **Client secret** (`SHOPIFY_API_SECRET`)
5. Set **App URL** (use tunnel URL in dev — Step 7; CLI sets this when using `shopify app dev`)
6. Set **Allowed redirection URL(s)**:
   - `https://YOUR_APP_URL/api/auth/callback`
7. Configure **API access scopes** — same as Section 2 scopes table
8. Save

> Distribution: for agency use across your own + client stores, use **Custom app** or **Unlisted public app** in Partner Dashboard — not full public App Store listing unless you plan to publish.

---

### Step 3 — Link local project to Partner app (`shopify app config link`)

**Working directory:**

```powershell
cd "G:\fire fist\shopify apps\products and inventory"
```

**Creates/updates files:**

```
G:\fire fist\shopify apps\products and inventory\shopify.app.toml
```

```powershell
shopify app config link
```

CLI will:
1. Ask you to log in to Partner account (if not already)
2. Show your apps — pick **Products & Inventory Manager**
3. Write **`shopify.app.toml`** at project root with `client_id`, scopes, redirect URLs, webhooks

This is the Shopify-recommended way to connect a local codebase to a Partner Dashboard app. It replaces hand-editing `shopify.app.toml` for app identity and scopes.

**Validate config before dev:**

```powershell
shopify app config validate --json
```

Fix any errors before `shopify app dev`.

> If Partner Dashboard says *"create a new local project and connect to this app"* — that means run `shopify app config link` (or `shopify app init` then link).

---

### Step 4 — Create dev store (if needed)

1. Partner Dashboard → **Stores** → **Add store** → **Development store**
2. Or use existing Arthenic store: `f1qzim-fc.myshopify.com`

---

### Step 5 — Scaffold project

**Working directory:** `G:\fire fist\shopify apps\products and inventory\`

**Option A — Shopify CLI init + config link (recommended)**

```powershell
cd "G:\fire fist\shopify apps\products and inventory"
shopify app init
```

**Creates:** app template files + often `shopify.app.toml` (then run Step 3 if linking existing Partner app)

Choose:
- App name: `products-inventory-manager`
- Template: Remix or React Router (Shopify official) — has OAuth + session built in
- Then run `shopify app config link` if init created a new Partner app instead of linking existing one

**Option B — Next.js manual scaffold (this plan's target stack)**

```powershell
cd "G:\fire fist\shopify apps\products and inventory"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
npm install @shopify/shopify-api @shopify/app-bridge-react @shopify/polaris
npm install @prisma/client @tanstack/react-table @tanstack/react-query zustand zod bcrypt
npm install -D prisma
npx prisma init
npx shadcn@latest init
```

Then run **`shopify app config link`** (Step 3) to pull Partner app config into `shopify.app.toml`.

**Option B creates these paths:**

```
G:\fire fist\shopify apps\products and inventory\package.json
G:\fire fist\shopify apps\products and inventory\app\
G:\fire fist\shopify apps\products and inventory\prisma\schema.prisma
G:\fire fist\shopify apps\products and inventory\node_modules\   (after npm install)
```

---

### Step 6 — Install dependencies (if not done in Step 5)

**Working directory:** project root

```powershell
cd "G:\fire fist\shopify apps\products and inventory"
npm install
npx prisma generate
npx prisma db push
```

> Phase 0 adds `@prisma/adapter-pg` and `pg` to `package.json` — run `npm install` again after pulling agent changes.

**Updates:** `node_modules\`, `prisma\` client, database file or Postgres schema

---

### Step 7 — Create environment file

**Create at:**

```
G:\fire fist\shopify apps\products and inventory\.env.local
G:\fire fist\shopify apps\products and inventory\.env.example
```

See Section 10 for variable names. Never commit `.env.local`.

`SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` must match `shopify.app.toml` (from config link).

---

### Step 8 — Dev tunnel (required for OAuth)

**Working directory:** project root

```powershell
cd "G:\fire fist\shopify apps\products and inventory"
shopify app dev
```

CLI prints tunnel URL → copy into Partner app **App URL** and **callback** if not auto-synced.

Or use Cloudflare Tunnel / ngrok manually and set `SHOPIFY_APP_URL` in `.env.local`.

---

### Step 9 — Install app on test store

1. Run `shopify app dev` (opens install prompt + tunnel)
2. Select `f1qzim-fc` (Arthenic) or your dev store
3. Click Install → approve scopes
4. Verify: shop appears in database, bootstrap runs, metafield defs cached

Tell agent: **"Install steps done, OAuth works on Arthenic. Build Phase 0."**

---

### Step 10 — Agency dashboard domain (production)

1. Register domain or subdomain: `ops.yourdomain.com`
2. Point DNS to hosting provider
3. Set `AGENCY_DASHBOARD_URL=https://ops.yourdomain.com`
4. Configure middleware to route agency paths on that domain
5. App URL (`app.yourdomain.com`) stays separate for Shopify embedded app

---

### Step 11 — Deploy (user only, when ready)

**Shopify app hosting:**
- Deploy app to Fly.io, Railway, or Vercel
- Update Partner app URLs to production domain
- Set all env vars in hosting dashboard

**Agency dashboard:**
- Can be same deployment with domain routing, or separate deploy
- Set `AGENCY_DASHBOARD_URL` to production ops domain

Agent gives steps. User clicks deploy. Agent does not push.

---

## 12. Multi-phase build plan

### Build order

```
Phase 0: Partner app + DB + OAuth + shop bootstrap
    ↓
Phase 1: Agency dashboard — store list + install link
    ↓
Phase 2: Merchant app shell — embedded layout + shop context
    ↓
Phase 3: Product list + search (works for any store)
    ↓
Phase 4: Metafield bulk editor (dynamic columns per store)
    ↓
Phase 5: Merchant portal + thin embedded shell (Home/Settings in Admin; tools on app domain)
    ↓
Phase 6: Inventory manager (merchant dashboard)
    ↓
Phase 7: Product create + CSV upload
    ↓
Phase 8: Polish + production hosts
    ↓
Phase 9: Merchant accounts (register + app-domain login + Admin soft-land)
    ↓
Phase 10: Smart metafield forms (hide JSON; type widgets)
    ↓
Phase 11: PDP preview editor (side-by-side with simple forms)
    ↓
Phase 12: AI Excel mapper (defs → prompt pack → mapped CSV)
    ↓
Phase 13: Module shell (nav/flags; Coupons / SEO / Geo stubs)
```

**Next code phase:** say **Phase 8** (prod domains/polish) or **Phase 9** (login first while still on tunnel). Non-tech priority favors **9 → 10 → 11 → 12** if production hosts can wait.

---

### Phase 0 — Foundation: OAuth + DB + bootstrap

**User installs:** Steps 1–8

**Agent builds:**

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | shops, shop_configs, shopify_sessions, agency_users |
| `lib/db/prisma.ts` | Prisma client singleton |
| `lib/db/shops.ts` | Shop CRUD, token encrypt/decrypt |
| `lib/shopify/auth.ts` | OAuth begin + callback |
| `lib/shopify/bootstrap.ts` | Post-install: fetch defs, locations, product types |
| `lib/shopify/client.ts` | GraphQL client — accepts shop domain + token |
| `app/api/auth/route.ts` | OAuth start |
| `app/api/auth/callback/route.ts` | OAuth callback → save shop → bootstrap |
| `app/api/webhooks/app-uninstalled/route.ts` | Mark shop inactive |
| `shopify.app.toml` | Scopes, app URL, webhooks |
| `.env.example` | Template |

**Done when:**
- [ ] Install on Arthenic completes OAuth
- [ ] Shop row in DB with encrypted token
- [ ] `shop_configs` populated with metafield definitions + locations
- [ ] Uninstall webhook marks shop inactive

---

### Phase 1 — Agency dashboard: manage all clients

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/agency/login/page.tsx` | Operator login |
| `app/agency/dashboard/page.tsx` | Stats: total stores, active, products |
| `app/agency/stores/page.tsx` | Table of all installed stores |
| `components/agency/StoreList.tsx` | Store cards with status |
| `components/agency/InstallLinkGenerator.tsx` | Copy install URL for new clients |
| `app/api/agency/login/route.ts` | Operator auth |
| `app/api/agency/stores/route.ts` | List all shops |
| `lib/agency/auth.ts` | Session middleware for agency routes |

**Features:**
- Login as agency operator (NextAuth.js or credentials — Section 10)
- **`/agency/connect`** — enter client `store-name.myshopify.com` → redirect to OAuth
- See all connected stores: name, domain, plan, currency, installed date, last sync, product count
- Click store → store overview + enter management context
- Generate install link: `https://{app_url}/api/auth?shop=CLIENT.myshopify.com`
- **Disconnect store** — mark inactive locally + optional token purge (uninstall happens in merchant Admin)
- "Sync config" button → re-run bootstrap for one store
- Per-store settings: low stock threshold, sync frequency (in `shop_configs.settings`)

**Done when:**
- [ ] Operator can log in at `/agency/login`
- [ ] All installed stores listed
- [ ] Install link works for a second dev store
- [ ] Clicking store opens store management view

---

### Phase 2 — Merchant app shell (embedded)

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/app/layout.tsx` | App Bridge + Polaris provider |
| `app/app/page.tsx` | Merchant home — shop name, quick stats |
| `components/merchant/AppNav.tsx` | Nav: Products, Metafields, Inventory, Import, Settings |
| `lib/shopify/session.ts` | Resolve shop from App Bridge session token |

**Features:**
- App loads embedded inside Shopify Admin after install
- Nav between modules *(Phase 2–4; slimmed to Home + Settings in Phase 5 — full tools move to `/merchant/*`)*
- Shop context resolved from session (not hardcoded)

**Done when:**
- [ ] App renders inside Shopify Admin iframe for Arthenic
- [ ] Navigation works between empty module pages

---

### Phase 3 — Product list + search

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/api/shops/[shopId]/products/route.ts` | Paginated products for shop |
| `app/app/products/page.tsx` | Merchant product list *(→ `/merchant/products` in Phase 5)* |
| `app/agency/stores/[shopId]/products/page.tsx` | Agency view of same data |
| `components/merchant/ProductTable.tsx` | TanStack Table |

**Features:**
- Product list scoped to current shop
- Search by title, handle, SKU
- Filter by product type (from `shop_configs.product_types` — dynamic per store)
- Cursor pagination
- Works identically from agency dashboard and merchant dashboard (`/app/*` → `/merchant/*` in Phase 5)

**Done when:**
- [ ] Products load for Arthenic
- [ ] Product types filter shows Arthenic's actual types (not hardcoded)
- [ ] Same view works when agency operator selects a different store

---

### Phase 4 — Metafield bulk editor

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/api/shops/[shopId]/metafield-definitions/route.ts` | From cache or live fetch |
| `app/api/shops/[shopId]/metafields/route.ts` | GET + POST metafieldsSet |
| `app/app/metafields/page.tsx` | Merchant spreadsheet |
| `app/agency/stores/[shopId]/metafields/page.tsx` | Agency spreadsheet |
| `components/merchant/MetafieldSpreadsheet.tsx` | Server-rendered spreadsheet + native forms |
| `components/merchant/MetafieldField.tsx` | Type-aware inputs |
| `lib/metafields/validators.ts` | Zod per type |

**Features:**
- Columns auto-generated from that store's `metafield_definitions` cache
- Different stores show different columns automatically
- Dirty tracking, batch save ≤250, per-cell errors
- CSV export
- "Refresh definitions" re-runs bootstrap metafield fetch

**Done when:**
- [x] Arthenic metafield columns appear (whatever that store has)
- [x] Second store with different metafields shows different columns
- [x] Save persists in Shopify Admin (agency path verified; merchant `/app/metafields` moves to `/merchant/metafields` in Phase 5)

**Implementation note:** Spreadsheet uses server-rendered forms + `MetafieldSpreadsheet.tsx` (not client `MetafieldGrid`) because App Bridge iframe breaks React hydration for save/refresh. Dirty cells via `/public/metafield-dirty.js`. Redirects use `appRedirectUrl()` from `lib/agency/app-url.ts`.

---

### Architecture pivot (after Phase 4)

**Problem:** Full spreadsheet tools inside Shopify Admin iframe are fragile (hydration, redirects, nav).

**Decision:**

| Surface | Routes | Role |
|---------|--------|------|
| **Agency** | `/agency/*` on `ops.yourdomain.com` | Unchanged — manage any client store |
| **Embedded** | `/app`, `/app/settings` only | Home (stats + launch CTA) + basic settings |
| **Merchant dashboard** | `/merchant/*` on `app.yourdomain.com` | Full tools for one shop; login (Phase 9) + optional handoff |

Reuse same APIs (`/api/shops/[shopId]/*`) and spreadsheet components. Move `/app/products`, `/app/metafields`, etc. → `/merchant/*`.

---

### Phase 5 — Merchant portal + thin embedded shell

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/merchant/layout.tsx` | Merchant dashboard shell + auth guard |
| `app/merchant/enter/route.ts` | App Bridge token handoff → merchant session |
| `lib/merchant/auth.ts` | Merchant session (separate from agency operator) |
| `app/app/page.tsx` | Slim home — stats + **Manage products & inventory** button |
| `app/app/settings/page.tsx` | Basic store settings only |
| `components/merchant/AppNav.tsx` | Embedded: Home + Settings only |
| `app/merchant/products/page.tsx` | Move from `app/app/products` |
| `app/merchant/metafields/page.tsx` | Move from `app/app/metafields` |
| `middleware.ts` (update) | Route `/merchant/*` with merchant session |

**Features:**
- Embedded app shows Home + Settings in Shopify Admin sidebar / in-app tabs
- **Manage products & inventory** opens merchant dashboard on app domain (new tab or top-level navigate)
- Merchant session scoped to one `shopId`; decrypt that shop's token only
- Agency store views unchanged at `/agency/stores/[shopId]/*`

**Done when:**
- [ ] Embedded `/app` shows stats + launch button only (no product/metafield nav)
- [ ] Launch from Admin opens `/merchant/*` with valid session
- [ ] Products + metafields work at `/merchant/products` and `/merchant/metafields`
- [ ] Agency paths still work for same store

---

### Phase 6 — Inventory manager

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/api/shops/[shopId]/locations/route.ts` | From cache or live |
| `app/api/shops/[shopId]/inventory/route.ts` | Read levels |
| `app/api/shops/[shopId]/inventory/set/route.ts` | inventorySetQuantities |
| `app/api/shops/[shopId]/inventory/adjust/route.ts` | inventoryAdjustQuantities |
| `app/app/inventory/page.tsx` | Merchant inventory grid → **`app/merchant/inventory/page.tsx`** (Phase 5 move) |
| `components/merchant/InventoryGrid.tsx` | Variant rows |
| `components/merchant/LocationSwitcher.tsx` | From shop's locations cache |

**Features:**
- Locations from store config (not hardcoded)
- Low stock threshold from `shop_configs.low_stock_threshold` per store
- Inline edit with compare-and-set
- Idempotency keys on all writes
- CSV export per location

**Done when:**
- [ ] Inventory shows per Arthenic locations
- [ ] Edit persists in Shopify Admin
- [ ] Different store with different locations works without code changes

---

### Phase 7 — Product create + CSV upload

**User installs:** nothing new

**Agent builds:**

| File | Purpose |
|------|---------|
| `app/merchant/products/new/page.tsx` | Create form |
| `app/api/shops/[shopId]/products/create/route.ts` | productCreate |
| `app/api/shops/[shopId]/upload/staged/route.ts` | Image upload |
| `app/merchant/import/page.tsx` | CSV import |
| `lib/csv/productImport.ts` | Parse + batch create |
| `components/merchant/ProductForm.tsx` | Dynamic metafield fields from store config |

**Features:**
- Create product with metafields matching that store's definitions
- Image upload
- CSV import with dynamic column mapping based on store's metafield defs
- CSV template generated per store (not global template)

**Done when:**
- [ ] Create product on Arthenic with its metafields
- [ ] CSV import works
- [ ] Template CSV reflects current store's metafield columns

---

### Phase 8 — Polish + production hosts

**User installs:** deploy when ready (Step 10)

**Agent builds:**
- Agency / app domain routing middleware (`ops.` vs `app.`)
- Audit log table + UI
- Bulk operations export per store
- `file_reference` / `product_reference` metafield UIs (baseline pickers)
- Rate limit progress UI
- Toast notifications, loading states
- Product list per-page size selector (10 / 20 / 50)
- Per-store settings page (threshold, sync schedule)
- Agency-wide settings

**Done when:**
- [ ] `ops.yourdomain.com` serves agency dashboard
- [ ] `app.yourdomain.com` serves embedded shell (`/app`) + merchant dashboard (`/merchant/*`)
- [ ] Operator manages 2+ stores without code changes

---

### Phase 9 — Merchant accounts

**User installs:** none beyond existing OAuth; email provider optional later

**Agent builds:**
- `merchant_users` (or shop-scoped users) table: email, password hash, `shopId`, role
- Post-install / first-open: create dashboard login tied to `shop_id`
- `app.yourdomain.com/login` + register (+ logout)
- Admin Home CTA soft-land: cookie valid → dashboard; else → login
- Keep shop OAuth token server-side only; login does not replace Shopify auth
- Separate agency operator auth from merchant users
- Handoff token optional bootstrap only

**Done when:**
- [x] Merchant can register after install and log in on app domain *(code + verify; confirm manual checklist)*
- [x] Bookmark login reaches dashboard without Admin *(code path)*
- [x] Admin “Open dashboard” respects session / sends to login *(soft-land)*
- [x] Agency login still isolated

---

### Phase 10 — Smart metafield forms

**Agent builds:**
- Shared metafield widgets by type (color, date, boolean, list → tags/multi-select, json/prose → text; normalize on save)
- Use everywhere: product create, metafield grid/spreadsheet, import hints
- Never require merchants to type raw JSON / `["list"]` encoding
- Reuse `normalizeMetafieldValue` / validators

**Done when:**
- [x] Non-tech can fill all common metafield types without seeing JSON
- [x] Create + metafields editor + import guidance use same widgets

---

### Phase 11 — PDP preview editor

**Agent builds:**
- Toggle / tab: **Simple forms** | **Edit with preview**
- Storefront or product preview URL in iframe/panel
- Same widgets as Phase 10; best-effort preview refresh when fields change
- If theme does not read a metafield, preview still shows product (limited impact)

**Done when:**
- [ ] Both modes exist side by side on product edit
- [ ] Save path identical for both modes

---

### Phase 12 — AI Excel mapper

**Agent builds:**
- On install/sync: build **store prompt pack** from metafield defs (namespace.key, type, examples, normalize rules) + template headers; version when defs change
- Upload messy Excel → AI maps columns → outputs template CSV → optional auto-import
- AI off single-product create path
- Env for AI provider (user sets keys; never commit secrets)

**Done when:**
- [ ] Prompt pack regenerates after metafield sync
- [ ] Messy spreadsheet becomes valid import CSV for that shop
- [ ] Optional one-click import after mapping

---

### Phase 13 — Module shell + future modules

**Agent builds:**
- Module registry (id, label, routes, enabled flag per shop)
- Merchant + agency nav driven by registry
- Permission / billing hooks stub (no billing required yet)
- Stub module slots: Coupons, SEO analyzer, Geo analyzer (empty pages or “Coming soon”)

**Done when:**
- [ ] Enabling a module shows nav without code fork per feature
- [ ] Products / Metafields / Inventory / Import registered as modules
- [ ] At least one future stub visible as disabled/coming soon

---

## 13. UI layouts

### Agency dashboard (`ops.yourdomain.com`)

```
┌──────────────┬──────────────────────────────────────────────┐
│  Ops Panel   │  Stores · Dashboard · Settings               │
│──────────────│──────────────────────────────────────────────│
│  Dashboard   │                                              │
│  All Stores  │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  Settings    │  │Arthenic │ │Client B │ │Client C │        │
│              │  │ INR · ✓ │ │ USD · ✓ │ │ + Install│        │
│              │  └─────────┘ └─────────┘ └─────────┘        │
│              │                                              │
│              │  [Generate Install Link]                      │
└──────────────┴──────────────────────────────────────────────┘
```

Click store → same Products / Metafields / Inventory views scoped to that shop.

### Embedded app (Shopify Admin iframe — thin shell)

```
┌──────────────┬──────────────────────────────────────────────┐
│  {Shop Name} │  Store overview                              │
│──────────────│──────────────────────────────────────────────│
│  Home        │  Products: 142 · Low stock: 3              │
│  Settings    │                                              │
│              │  [ Manage products & inventory ]  → opens    │
│              │    app.yourdomain.com/merchant/*             │
└──────────────┴──────────────────────────────────────────────┘
```

OAuth install + callback stay on app host. No product/metafield/inventory nav in iframe.

### Merchant dashboard (`app.yourdomain.com/merchant/*`)

```
┌──────────────┬──────────────────────────────────────────────┐
│  {Shop Name} │  🔍 Search...                                │
│──────────────│──────────────────────────────────────────────│
│  Products    │                                              │
│  Metafields  │         [ Main content area ]               │
│  Inventory   │         (same components as agency store)    │
│  Import      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

Session via merchant login (Phase 9) or optional handoff from embedded Home (`/merchant/enter`). Full-page — no iframe constraints.

---

## 14. Security checklist

This app holds **Shopify Admin API access** per shop. Treat the database as a vault.

### Tokens & secrets (always)

- [x] Shop access tokens encrypted at rest (`ENCRYPTION_KEY` + AES-256-GCM in `lib/encryption.ts`)
- [ ] Tokens never returned in API / RSC payloads / HTML
- [ ] Tokens never written to logs, agent transcripts, or AI prompts (Phase 12: prompt pack = defs/headers only, **not** access tokens)
- [ ] OAuth **`state`** validated on callback (CSRF)
- [ ] OAuth callback **`hmac`** verified per Shopify docs
- [ ] HMAC verified on webhooks
- [ ] `.env.local` in `.gitignore`; no secrets in git
- [ ] No `NEXT_PUBLIC_` prefix on secrets / tokens / `ENCRYPTION_KEY`
- [ ] Rotate `ENCRYPTION_KEY` and re-encrypt tokens if compromised
- [ ] Production: strong unique `ENCRYPTION_KEY`, `SESSION`/`AUTH` secrets, DB credentials

### Auth & tenancy

- [ ] Per-shop API calls — resolve `shopId` from session; never use wrong shop's token (`saas-multi-tenant`)
- [ ] Agency dashboard behind operator login (separate from merchant users)
- [ ] App Bridge session token validated for embedded `/app/*`
- [x] Merchant dashboard: httpOnly Secure cookie session (Phase 9); passwords hashed (bcrypt/argon2); no plaintext
- [ ] Merchant user always bound to `shop_id`; authorize every route/API for that shop
- [ ] Rate limit `/api/*` (login, import, create) against abuse
- [ ] CSRF protection on cookie-auth form POSTs / server actions where applicable
- [ ] Uninstall webhook: revoke/disable shop row; block further API use

### Data & deploy

- [ ] DB access restricted (managed Postgres; no public wide-open admin)
- [ ] Least privilege: only scopes the app needs in `shopify.app.toml`
- [ ] Keep stack light (Section 1 simplicity) so security surface stays small

Skills for this area: `api-security-best-practices`, `secrets-management`, `auth-implementation-patterns`, `saas-multi-tenant`.

---

## 15. Official Shopify documentation

| Topic | URL |
|-------|-----|
| Build a Shopify app | https://shopify.dev/docs/apps/build |
| OAuth authorization code grant | https://shopify.dev/docs/apps/build/authentication-authorization/access-token/authorization-code-grant |
| OAuth HMAC verification | https://shopify.dev/docs/apps/build/authentication-authorization/access-token/authorization-code-grant#verify-a-request |
| App distribution | https://shopify.dev/docs/apps/launch/distribution |
| Shopify CLI — config link | https://shopify.dev/docs/api/shopify-cli/app/config-link |
| OAuth | https://shopify.dev/docs/apps/build/authentication-authorization |
| App Bridge | https://shopify.dev/docs/api/app-bridge |
| Polaris | https://polaris.shopify.com |
| Admin GraphQL API | https://shopify.dev/docs/api/admin-graphql |
| Metafields | https://shopify.dev/docs/apps/build/custom-data/metafields |
| metafieldsSet | https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet |
| productCreate | https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate |
| inventorySetQuantities | https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorySetQuantities |
| inventoryAdjustQuantities | https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventoryAdjustQuantities |
| Webhooks | https://shopify.dev/docs/apps/build/webhooks |
| Rate limits | https://shopify.dev/docs/api/usage/rate-limits |
| Idempotent requests | https://shopify.dev/docs/api/usage/idempotent-requests |
| Bulk operations | https://shopify.dev/docs/api/usage/bulk-operations |
| Session storage | https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens |

---

## 16. Skills & plugins inventory (agents: read every chat)

Agents **must** open this section + `.cursor/rules/skills-routing.mdc`, then **read the matching skill file** before coding that area. Do not load unrelated packs.

**Product intent (for skill choice):** multi-tenant Shopify **Merchant Ops Platform** — OAuth + encrypted shop tokens, agency ops, merchant login, products/metafields/inventory/import, non-tech forms + PDP preview, AI Excel map, light module shell for later Coupons/SEO/Geo. Keep deploy as **one Next.js app**.

### 16.1 Plugins / extensions (Cursor + IDE)

| Item | Status | Why | You action |
|------|--------|-----|------------|
| **Cursor Shopify plugin** | Required | Tier-1 Shopify skills + docs | Marketplace → install/enable if missing; verify `/shopify-admin` |
| **Prisma** (Cursor extension) | Recommended | Schema / migrate UX | Install if you edit `prisma/` often |
| **ESLint + Tailwind IntelliSense** | Recommended | Lint / class hints | Optional IDE comfort |
| **Neon / Postgres MCP** | Optional | Remote DB inspect | Only if you use Neon cloud DB |
| **Extra AI/SEO plugins** | Not now | Bloat | Skip until you start SEO/Geo modules |

No other Cursor plugins required for Phase 8–13.

### 16.2 Skill sources

| Source | Where | How agent uses |
|--------|-------|----------------|
| Shopify plugin | Cursor Shopify plugin cache | Skill names `shopify-*` |
| Claude / personal skills | `~/.claude/skills/<name>/SKILL.md` | Skill names below |
| Repo rules | `.cursor/rules/skills-routing.mdc` | Always-on routing table |

### 16.3 Core skills — already expected on this machine

These match the current stack. Confirm folders exist under `~/.claude/skills/` (or Shopify plugin). **You already have most of these installed.**

| Skill | Use for |
|-------|---------|
| `shopify-admin` | Admin GraphQL (products, inventory, discounts later) |
| `shopify-custom-data` | Metafield defs, types, set/get |
| `shopify-use-shopify-cli` | `app dev`, `config link`, TOML |
| `shopify-onboarding-dev` | Partner / install flows |
| `shopify-polaris-app-home` | Embedded Admin shell |
| `shopify-dev` | General Shopify docs |
| `shopify-app-store-review` | Pre-launch compliance |
| `shopify-liquid` | Theme/PDP metafield rendering (Phase 11 context) |
| `shopify-storefront-graphql` | Storefront preview URLs / product URLs if needed (Phase 11) |
| `saas-multi-tenant` | Per-shop token isolation — **every shop API** |
| `prisma-expert` | Schema, `merchant_users`, audit tables |
| `nextjs-app-router-patterns` | `app/` routes, layouts, server actions |
| `nextjs-best-practices` | RSC, caching, light Next patterns |
| `auth-implementation-patterns` | OAuth, agency login, **merchant login (Phase 9)** |
| `api-security-best-practices` | Cookies, CSRF, rate limits, HMAC |
| `secrets-management` | `ENCRYPTION_KEY`, env — **never tokens in AI prompts** |
| `graphql` | Cost, pagination, batching |
| `zod-validation-expert` | Forms, APIs, metafield normalize |
| `shadcn` | Merchant/agency UI widgets |
| `tailwind-design-system` | Styling |
| `tanstack-query-expert` | Client fetch cache when needed |
| `zustand-store-ts` | Dirty grid state only |
| `postgres-best-practices` | Prod DB |
| `vercel-deployment` | One-app deploy |

### 16.4 Phase → skills map (load only when in that phase)

| Phase | What you build | Skills to read |
|-------|----------------|----------------|
| **8** Polish + hosts | Domains, audit, toasts, settings, export, file/product_reference | `nextjs-app-router-patterns`, `vercel-deployment`, `prisma-expert`, `shopify-custom-data`, `shadcn`, `saas-multi-tenant` |
| **9** Merchant accounts | Register/login, cookies, shop-linked users | `auth-implementation-patterns`, `api-security-best-practices`, `secrets-management`, `saas-multi-tenant`, `prisma-expert` |
| **10** Smart metafield forms | Type widgets, hide JSON | `shopify-custom-data`, `zod-validation-expert`, `shadcn` |
| **11** PDP preview | Forms + storefront iframe | `shopify-liquid`, `shopify-storefront-graphql`, `nextjs-app-router-patterns`, `shopify-custom-data` — keep iframe simple |
| **12** AI Excel mapper | Messy xlsx → template CSV | `xlsx-official`, `llm-structured-output` or `prompt-engineering` (pick **one**), `secrets-management`, `zod-validation-expert` |
| **13** Module shell | Nav flags + stubs | `saas-multi-tenant`, `nextjs-app-router-patterns` only |
| **Later Coupons** | Bulk discount codes | `shopify-admin` (Discount APIs) — no new skill pack required |
| **Later SEO / Geo** | Analyzers | `seo-audit` / `seo-technical` / `seo-geo` — **install/use only when you start that module** |

### 16.5 Optional installs — **agent must ask you at phase start**

**Rule for every new chat / phase:** Before writing Phase N code, agent must:

1. Read Section **16.4** for that phase  
2. Check which skills from that row are missing on the machine  
3. **Tell the user** a short install list (only missing ones) and wait if anything is required  
4. Then implement  

Do **not** ask the user to install Phase 12 / SEO skills during Phase 8–9.

Check helpers (PowerShell):

```powershell
# Claude skills
Test-Path "$env:USERPROFILE\.claude\skills\<skill-name>\SKILL.md"
# Shopify plugin skills come from Cursor Shopify plugin (enable plugin; no folder install)
```

| Skill | Needed when | Install if missing? |
|-------|-------------|---------------------|
| Core stack (Section 16.3) | All phases | Fix gaps only if agent reports missing |
| `xlsx-official` | **Phase 12** | Agent reminds at Phase 12 start |
| `llm-structured-output` **or** `prompt-engineering` | **Phase 12** | Agent reminds at Phase 12 start (one of them) |
| `seo-audit` / `seo-technical` / `seo-geo` | Later SEO/Geo modules | Agent reminds only when you start that work |
| `stripe-integration` | Billing | Agent reminds only when you add billing |
| Cursor Shopify plugin | Always | Agent reminds if Shopify skills unavailable |

**Do not** install big SEO/LLM/Azure packs “just in case.”

### 16.6 Do not load (unless user explicitly asks)

Azure, mobile, WordPress, pentest suites, marketing SEO writers, agent orchestration mega-packs, checkout/POS extensions (unless building those surfaces).

### 16.7 Agent chat bootstrap (skills)

When user says **Phase N**:

1. Section 19 + AGENT-PROTOCOL  
2. This Section 16.4 row for that phase  
3. **Tell user any missing skills/plugins to install now** (Section 16.5) — only that phase’s list  
4. Read those skill files  
5. Implement → `verify:phase-N`  
6. Update Section 19  

Routing mirror: `.cursor/rules/skills-routing.mdc` (keep in sync with this section).

---

## 17. Full acceptance criteria

- [ ] Partner app created with correct scopes
- [ ] OAuth install works on any client store
- [ ] Per-store token saved encrypted in DB
- [ ] Bootstrap auto-discovers metafield defs, locations, product types per store
- [ ] Agency dashboard lists all installed stores
- [ ] Agency operator can manage any store's data
- [ ] Install link generator works for new clients
- [ ] Merchant embedded app works inside Shopify Admin
- [ ] Product list/search works per store
- [ ] Metafield grid columns differ per store (dynamic, not hardcoded)
- [ ] Inventory works per store's locations
- [ ] Product create + CSV import with store-specific metafield template
- [ ] Uninstall webhook deactivates store
- [ ] Tokens never exposed to browser
- [ ] 429 rate limits handled gracefully

---

## 18. New agent chat (minimal)

`.cursor/rules` loads agent rules + verification. **You only say what to do**, e.g.:

> Phase 2

Agent must:

1. Read `PROJECT.md` Section 19 + Section **16** (skills for that phase) + `docs/verification/AGENT-PROTOCOL.md`
2. Read last run in `docs/verification/agent-log.md`
3. **Tell user** any missing skills/plugins to install for this phase only (Section 16.5); wait if required
4. Read listed skill files → implement phase → `npm run verify:phase-N` until pass
5. Update Section 19 + link user checklist `docs/verification/phase-N-checklist.md`

Optional if rules fail: paste **Section 19** progress block only.

---

## 20. Verification (all phases)

| Item | Location |
|------|----------|
| Agent protocol | `docs/verification/AGENT-PROTOCOL.md` |
| User checklists | `docs/verification/phase-N-checklist.md` |
| Agent run log | `docs/verification/agent-log.md` |
| Phase registry | `docs/verification/phases.json` |
| Verify scripts | `scripts/verify/phase-N.mjs` |
| Shared checks | `scripts/verify/common.mjs` |
| Cursor rule | `.cursor/rules/verification.mdc` |

Commands: `npm run verify:phase-0` … `verify:phase-7`, `verify:phase-9`

**Done criteria:** automated verify exit 0 + user manual checklist complete for that phase.

---

## 19. Current progress

> **Agents:** update this section after every milestone. **Users:** glance here to see state.

```
Setup (repo / tooling):
- [x] PROJECT.md created
- [x] .cursor/rules/ created (auto context + skills)
- [x] docs/ Obsidian folder created
- [x] .cursorignore created at repo root (Section 0)
- [ ] Cursor extensions: Prisma, ESLint, Tailwind IntelliSense

Prerequisites (user runs — Section 11):
- [x] Node.js installed
- [x] Shopify CLI installed
- [x] Shopify Partner account created
- [x] Partner app created (API key + secret saved)
- [x] `shopify app config link` run — shopify.app.toml linked to Partner app
- [ ] `shopify app config validate --json` passes
- [x] Dev store available (Arthenic: f1qzim-fc.myshopify.com; also teststore-for-app-3p7rdjc3)
- [x] Project scaffolded (Next.js manual scaffold)
- [x] PostgreSQL or SQLite ready
- [ ] npm install + prisma db push done (re-run after Phase 0 schema — adds `pg` adapter)
- [x] .env.local created with all vars (Section 10)
- [x] Dev tunnel working (shopify app dev)
- [x] OAuth install completed on test store (re-test after Phase 0 routes)
- [x] Shop row + shop_configs in database after install

Build phases (agent writes code):
- [x] Phase 0: OAuth + DB + store bootstrap
- [x] Phase 1: Agency dashboard — store list + install link
- [x] Phase 2: Merchant embedded app shell
- [x] Phase 3: Product list + search
- [x] Phase 4: Metafield bulk editor (dynamic per store)
- [x] Phase 5: Merchant portal + thin embedded shell
- [x] Phase 6: Inventory manager (merchant dashboard)
- [x] Phase 7: Product create + CSV upload
- [ ] Phase 8: Polish + production hosts
- [x] Phase 9: Merchant accounts (login + register)
- [x] Phase 10: Smart metafield forms
- [x] Phase 11: PDP preview editor
- [ ] Phase 12: AI Excel mapper (automated verify 7/7 PASS; Phase 12b shipped; manual checklist pending)
- [ ] Phase 13: Module shell + future stubs

Deploy (user only):
- [ ] App deployed (app.yourdomain.com)
- [ ] Agency dashboard live (ops.yourdomain.com)
- [ ] Partner app URLs updated to production
- [x] Second client store installed successfully
```

**Last updated:** 2026-08-03  
**Current phase:** Phase 12 — AI Excel mapper (**automated verify 7/7 PASS**). User: run `docs/verification/phase-12-checklist.md`  
**Architecture:** Merchant Ops Platform — multi-tenant OAuth + agency ops + thin embedded shell + light modules  
**Notes:** Phase 12b: theme Liquid scan (`theme-scan.ts`), `merge_kv`/`merge_text` on update preview, full story JSON transforms (`stories.ts`), persisted import sessions + resume UI (`import-sessions.ts`, confirm `resumeFromHandle`). Spec engine in `lib/import/spec/`. Verify 7/7 PASS 2026-08-03.

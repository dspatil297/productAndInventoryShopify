# Platform roadmap (one-pager)

**Source of truth:** [PROJECT.md](../../PROJECT.md) (Sections 1, 2, 12, 14, 16, 19).  
This file is a short human summary only.

## Status

- Phase 0–7: **done**
- Phase 8–13: **planned** (roadmap locked)
- You will add **later vision steps** after this arc — agents must not invent Phase 14+ until you say so

## What we are building

**Merchant Ops Platform** — multi-tenant Shopify app (not products/inventory only).

| Layer | What |
|-------|------|
| Core | OAuth multi-shop, encrypted tokens, shop_configs, agency ops, merchant shell |
| Modules now | Products, Metafields, Inventory, Import |
| Modules later | Coupons, SEO, Geo, … (Phase 13 shell only — stubs, not full products yet) |

## Non-tech UX

- Hide JSON / list encoding — type widgets (Phase 10)
- Two modes side by side: **Simple forms** (default) + **Edit with preview** / PDP (Phase 11)
- Bulk: messy Excel → AI → proper CSV (Phase 12); AI not on single-product create

## Auth

- **Keep** Admin install + thin Home + “Open dashboard”
- **Add** app-domain register/login linked to `shop_id` (Phase 9)
- Soft-land: cookie OK → tools; else → login
- Login gates **who**; Shopify API still uses shop OAuth token in DB
- Agency operator login stays separate

## Keep it light (deploy)

- One Next.js app — no microservices / extra frontends
- Reuse code; avoid new heavy deps
- Modules = nav flags + routes, not a plugin framework
- AI only on bulk Excel path

## Security (shop keys in DB)

- Access tokens encrypted at rest (`lib/encryption.ts`)
- Never expose tokens to browser, logs, or AI prompts
- Shop-scoped auth on every API; httpOnly cookies + hashed passwords (Phase 9)
- Skills: `api-security-best-practices`, `secrets-management`, `saas-multi-tenant`, `auth-implementation-patterns`

## Skills / plugins (see PROJECT.md Section 16)

**Required plugin:** Cursor Shopify plugin.

**Core skills (already on machine for this stack):** Shopify `shopify-*`, `saas-multi-tenant`, `prisma-expert`, Next.js, auth, security, secrets, zod, shadcn, postgres, vercel.

**Before Phase 12:** agent will tell you to install `xlsx-official` + one LLM skill if missing.

**Later only:** SEO/Geo skills — agent reminds when you start those modules.

Agents: every chat reads Section 16.4; **must prompt installs at phase start** (16.5).

## Phase order (after Phase 7)

| Phase | Focus |
|-------|--------|
| 8 | Polish + production hosts (`ops.` / `app.`) |
| 9 | Merchant accounts |
| 10 | Smart metafield forms |
| 11 | PDP preview editor |
| 12 | AI Excel mapper |
| 13 | Module shell + future stubs |

**What to say in chat:** `Phase 8` (prod) or `Phase 9` (login first on tunnel). Prefer **9 → 10** for non-tech if domains can wait.

## Verify

Phases 8–13 registered in [phases.json](../verification/phases.json). Create `verify:phase-N` + checklist when that phase **starts** (see [AGENT-PROTOCOL.md](../verification/AGENT-PROTOCOL.md)).

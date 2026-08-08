# Phase 3 verification checklist (user)

Product list + search (merchant + agency). Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 2 complete (`npm run verify:phase-2` passes)
- [x] `shopify app dev` running
- [x] App installed on dev store with products in catalog

## B. Automated verify

```bash
npm run verify:phase-3
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Merchant product list

- [x] Open app in Shopify Admin → **Products**
- [x] Product rows load (title, handle, type, status, SKU, price)
- [x] Search by title / handle / SKU returns matches
- [x] Product type filter shows **this store's** types from sync (not hardcoded)
- [x] Next / Previous pagination works

- Per-page size selector → **Phase 7** (fixed 20 products per page for now)

## D. Agency product list

- [x] Log in at `/agency/login`
- [x] Open a store → **Products**
- [x] Same product data as merchant view for that store
- [x] Repeat for a second store if available — list scoped to selected store

## E. Security

- [x] `/api/shops/{shopId}/products` returns 401 without agency session or App Bridge token
- [x] No access tokens in browser network/HTML responses

## F. Phase 3 complete when

**B + C + D** all pass.

## Troubleshooting


| Symptom                   | Fix                                                                         |
| ------------------------- | --------------------------------------------------------------------------- |
| Empty product list        | Re-run **Sync config** on store; confirm `read_products` scope              |
| 401 on merchant Products  | Open from Shopify Admin iframe; App Bridge must send `Authorization` header |
| Product type filter empty | Run store bootstrap/sync to populate `shop_configs.product_types`           |
| Wrong store data          | API must use `shopId` from session/context, not env default                 |



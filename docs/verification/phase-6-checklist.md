# Phase 6 verification checklist (user)

Inventory manager on merchant dashboard (+ agency store view). Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 5 complete (`npm run verify:phase-5` passes)
- [x] `shopify app dev` running
- [x] App installed on Arthenic (or other) store
- [x] Store has at least one location + tracked inventory variants

## B. Automated verify

```bash
npm run verify:phase-6
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Merchant inventory

- [x] Open merchant portal → **Inventory**
- [x] Location filter lists **this store’s** locations (not hardcoded); Filter switches view
- [x] Grid shows variants with available / on hand / committed for selected location
- [x] Low-stock rows highlight using `shop_configs.low_stock_threshold`
- [x] **Set** absolute qty → persists in Shopify Admin inventory
- [x] **+1 / −1** adjust → persists in Shopify Admin
- [x] Concurrent edit conflict (stale compare) shows error flash, does not overwrite silently
- [x] **Export CSV** downloads rows for current location
- [x] **Move selected** → pick destination location (+ optional Move qty) → stock leaves current location, appears at destination in Shopify Admin

## D. Multi-store / agency

- [x] Agency → store → **Inventory** works for same store
- [x] Second store (or different location set) works **without code changes**

## E. Security

- [x] `/api/shops/{shopId}/inventory`* and `/locations` return 401 without session
- [x] No access tokens in browser network/HTML

## F. Phase 6 complete when

**B + C** pass (D recommended).

## Troubleshooting


| Symptom                       | Fix                                                                  |
| ----------------------------- | -------------------------------------------------------------------- |
| No locations                  | Agency store page → Sync config, or `POST /api/shops/{id}/locations` |
| Empty grid                    | Confirm variants stocked at that location; try another location      |
| Set fails with stale quantity | Refresh page, set again (compare-and-set working)                    |
| 401 on save                   | Re-launch merchant portal from embedded Home                         |



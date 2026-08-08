# Phase 4 verification checklist (user)

Metafield bulk editor (merchant + agency). Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 3 complete (`npm run verify:phase-3` passes)
- [x] `shopify app dev` running
- [x] App installed on dev store with products + product metafield definitions

## B. Automated verify

```bash
npm run verify:phase-4
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Merchant metafield grid

- [x] Open app in Shopify Admin → **Metafields**
- [x] Columns match **this store's** metafield definitions (not hardcoded)
- [ ] Product rows load with current metafield values
- [ ] Edit a cell → row highlights dirty → **Save changes** persists in Shopify Admin
- [ ] Search by title / handle works
- [ ] Next / Previous pagination works (warns if unsaved)
- [ ] **Export CSV** downloads current page
- [ ] **Refresh definitions** updates columns after adding a definition in Admin

## D. Agency metafield grid

- [ ] Log in at `/agency/login`
- [ ] Open a store → **Metafields**
- [ ] Same dynamic columns + data as merchant view for that store
- [ ] Save from agency view persists in Shopify Admin
- [ ] Second store (if available) shows **different** columns

## E. Security

- [ ] `/api/shops/{shopId}/metafields` returns 401 without agency session or App Bridge token
- [ ] No access tokens in browser network/HTML responses

## F. Phase 4 complete when

**B + C + D** all pass.

## Troubleshooting


| Symptom                                | Fix                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------- |
| No columns                             | Run **Sync config** on store or **Refresh definitions** on Metafields page  |
| Empty product rows                     | Confirm products exist; re-run store sync                                   |
| 401 on merchant Metafields             | Open from Shopify Admin iframe; App Bridge must send `Authorization` header |
| Save fails on one cell                 | Check per-cell error; value must match metafield type                       |
| `file_reference` / `product_reference` | Read-only until Phase 7                                                     |



# Phase 5 verification checklist (user)

Merchant portal + thin embedded shell. Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 4 complete (`npm run verify:phase-4` passes)
- [x] `shopify app dev` running
- [x] App installed on dev store

## B. Automated verify

```bash
npm run verify:phase-5
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Embedded shell (Shopify Admin iframe)

- [x] Open app in Shopify Admin → **Home** only shows stats + **Manage products & inventory** button
- [x] Nav shows **Home** and **Settings** only (no Products / Metafields / Inventory / Import)
- [x] `/app/products`, `/app/metafields`, `/app/inventory`, `/app/import` redirect back to Home
- [x] **Settings** page still loads in iframe

## D. Merchant portal handoff

- [x] Click **Manage products & inventory** → new tab opens `/merchant/products`
- [x] Merchant dashboard sidebar shows Products, Metafields, Inventory, Import
- [x] Products list loads with search, filters, pagination
- [x] Metafields grid loads with dynamic columns; save persists in Shopify Admin
- [x] Direct visit to `/merchant/products` without session redirects away (no data leak)

## E. Agency unchanged

- [x] Log in at `/agency/login`
- [x] Store **Products** and **Metafields** still work for the same store

## F. Security

- [x] `/api/shops/{shopId}/`* returns 401 without agency session, App Bridge token, or merchant portal cookie
- [x] Merchant portal cookie scoped to one `shopId` (wrong shop in URL → 403)
- [x] No access tokens in browser network/HTML responses

## G. Phase 5 complete when

**B + C + D + E** all pass.

## Troubleshooting


| Symptom                                | Fix                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Launch button does nothing             | Hard refresh Admin app; click button — brief "Opening merchant dashboard…" in iframe, then full tab goes to `/merchant/products` |
| Stuck on "Opening merchant dashboard…" | App Bridge `idToken` failed — close tab, reopen app from Admin                                                                   |
| `/merchant/`* redirects to `/app`      | Re-launch from embedded Home (session expired or missing)                                                                        |
| 401 on merchant portal save            | Confirm portal cookie set; check `SESSION_SECRET` in `.env.local`                                                                |
| Products empty                         | Run **Sync config** on agency store page                                                                                         |



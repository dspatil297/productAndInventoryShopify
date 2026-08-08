# Phase 7 verification checklist (user)

Product create + CSV import on merchant dashboard. Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 6 complete (`npm run verify:phase-6` passes)
- [x] `shopify app dev` running
- [x] App installed on Arthenic (or other) store
- [x] Store has metafield definitions (sync config if empty)
- [ ] Approve new scopes when CLI prompts: `read_publications`, `write_publications` (needed for Online Store visibility)

## B. Automated verify

```bash
npm run verify:phase-7
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**



## C. Create product

- [x] Merchant portal → **Products** → **New product**
- [x] Form shows **this store’s** metafield fields (not a global list)
- [x] Status **Active** + **Publish to sales channels** checked → product appears in Shopify Admin **and** Online Store / channels
- [x] Create with compare-at price, multi images, track qty + location → persists in Admin
- [x] Optional: price / SKU set on default variant



## D. CSV import

- [x] **Import** → **Download template CSV** — headers include store metafield `namespace.key` columns
- [x] Fill 1–2 rows → **Import products** → products created in Shopify
- [x] Second store (different metafield defs) gets a **different** template without code changes



## E. Security

- [ ] `/api/shops/{shopId}/products/create`, `/upload/staged`, `/import`* return 401 without session
- [ ] No access tokens in browser network/HTML



## F. Phase 7 complete when

**B + C + D** pass.

## Troubleshooting


| Symptom                           | Fix                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| No metafield fields               | Agency store page → Sync config                                                             |
| Image upload fails                | Confirm `write_files` / `read_files` scopes; reinstall if scopes changed                    |
| Publish fails / not on storefront | Approve `read_publications,write_publications`; keep Active + Publish checked               |
| Import creates 0                  | Check CSV has `title` column; use downloaded template                                       |
| 401 on submit                     | Re-launch merchant portal from embedded Home                                                |
| UI stale after code change        | Hard refresh / restart `shopify app dev`                                                    |
| Old create “worked” but missing   | Was Draft/unpublished — Admin → Products → filter Drafts, or recreate with Active + Publish |



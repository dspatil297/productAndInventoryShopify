# Phase 11 — Visual product templates (non-tech)

## A. Prerequisites

- [ ] `.env.local` complete · `shopify app dev` running
- [ ] Phase 10 OK

## B. Automated verify

```bash
npm run verify:phase-11
```

- [ ] Exit **0**

## C. Create via visual templates

- [x] Products → **New product** (opens visual) or `/merchant/products/new?view=visual`
- [x] **Sync templates from theme** (once) — lists `templates/product`* + caches **look** (colors + **block/section slot order** from template JSON)
- [x] Picker shows color swatches; fill canvas uses synced colors
- [x] Fill layout = live PDP: **image | title/price/buy + details table**, **accordions below**
- [x] Metafields **not** on theme PDP do **not** appear in visual fill
- [x] Pick a theme product template
- [x] JSON: `k/v` rows, FAQ `q/a` rows, freeform objects (`title`/`quote`/…) as labeled fields — not flattened prose
- [x] Layout works per **synced theme** (multi-store) — not one hardcoded heritage page
- [x] Hard refresh so `/pair-list.js` + `/json-object.js` load

- [x] Fill **Stock & publishing** under the page
- [x] **Create product** → Shopify product + metafields + `templateSuffix`
- [x] After theme layout change → Sync again (not every create)



## D. Edit via visual templates

- [x] Open product → **Visual templates** tab → pick template
- [x] Change fields on canvas → Save → values persist (Admin / Simple forms)



## E. Simple forms still works

- [x] **Simple forms** tab create/edit still works (Power users)



## F. Security

- [ ] No access tokens in browser HTML



## G. Done when

- [ ] Non-tech path: template → fill look → stock/publish → Shopify fields filled
- [ ] Automated verify pass



## Troubleshooting


| Symptom              | Fix                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Content not saving   | Hard refresh — `/visual-pdp.js` + `/tag-list.js`                                              |
| Sync templates fails | Add `read_themes` scope in Partner app, restart `shopify app dev`, re-open store install link |
| Still sees JSON      | Hard refresh; lists should be tags, json = plain text                                         |
| Tab clicks dead      | Plain links — hard refresh                                                                    |



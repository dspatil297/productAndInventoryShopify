# Phase 10 — Smart metafield forms

## A. Prerequisites

- [x] `.env.local` complete (Section 10, `PROJECT.md`)
- [x] `SHOPIFY_APP_URL` = current tunnel from `shopify app dev`
- [x] `shopify app dev` running
- [x] Previous phase OK: merchant login works (`npm run verify:phase-9` if unsure)

## B. Automated verify (agent or user)

```bash
npm run verify:phase-10
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Manual — product create widgets

- [x] Open `/merchant/products/new`
- [x] Metafields use type widgets (color picker, date, Yes/No, tags) — no raw `["list"]` / scary JSON instructions
- [x] Add tags on a `list.*` field via Enter/Add; save product; Shopify Admin shows list values
- [x] Fill a `json` metafield with plain words (e.g. `care tip`); save succeeds



## D. Manual — metafields editor

- [x] Open `/merchant/metafields` (grid or spreadsheet UI for your shell)
- [x] Same widget types as create form for color / date / boolean / list / json
- [x] Edit a list metafield with tags (not JSON); Save; reload shows tags not `["…"]` blob
- [x] Dirty highlight still works on spreadsheet page when values change



## E. Manual — import guidance

- [x] Open `/merchant/import`
- [x] “Metafield column tips” lists each store column with type + fill hint
- [x] Tips say comma-separated / plain text — **not** JSON array syntax
- [x] Optional: import a row with `red, blue` in a list column; product gets two tags



## F. Security

- [ ] No access tokens in browser network/HTML
- [ ] Metafield values only — shop token never in responses



## G. Phase 10 complete when

- [x] Sections C–E + automated verify pass
- [x] Non-tech can fill common metafield types without seeing JSON encoding



## Troubleshooting


| Symptom                               | Fix                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| Tags save as one string `"red, blue"` | Confirm type is `list.*`; re-run sync definitions                    |
| JSON prose save fails                 | Leave blank or use plain text; check Admin definition type is `json` |
| Widgets missing on Agency metafields  | Agency uses same `MetafieldCell` / spreadsheet — hard refresh        |
| Draft restore blanks metafields       | Type once after reload; session draft fires `mf-draft-restored`      |



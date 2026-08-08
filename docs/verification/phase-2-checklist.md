# Phase 2 verification checklist (user)

Merchant embedded app shell. Dev server + tunnel required.

---

## A. Prerequisites

- [x] Phase 1 complete (`npm run verify:phase-1` passes)
- [x] `SHOPIFY_APP_URL` in `.env.local` matches `shopify app dev` tunnel
- [x] App installed on a dev store (OAuth done)

## B. Automated verify

```bash
npm run verify:phase-2
```

- [x] Exit code **0**
- [x] `docs/verification/agent-log.md` latest run all **PASS**

## C. Embedded app loads

- [x] Partner Dashboard → open app on dev store (or Apps → your app)
- [x] App renders **inside** Shopify Admin iframe (not broken blank page)
- [x] Shop name / home content visible on `/app`

## D. Navigation

- [x] Nav links work: Products, Metafields, Inventory, Import, Settings
- [x] Each module page loads (empty placeholder OK for Phase 2)
- [x] No hardcoded shop domain in UI — context from session

## E. Agency + merchant parity

- [x] Same store visible in `/agency/stores` with correct stats

## F. Phase 2 complete when

**B + C + D** all pass.

## Troubleshooting


| Symptom              | Fix                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| Blank iframe         | Check browser console; App Bridge + Polaris providers in `app/app/layout.tsx` |
| 401 / session errors | `lib/shopify/session.ts` must validate App Bridge token                       |
| Wrong shop           | Session must load shop from token, not env default                            |



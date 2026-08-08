# Phase 0 verification checklist (user)

Foundation: OAuth, DB, bootstrap. Mostly complete if Phase 1 works.

---

## A. Prerequisites

- [ ] `DATABASE_URL` in `.env` + `.env.local`
- [ ] `SHOPIFY_APP_URL` = tunnel URL
- [ ] `shopify app config link` done

## B. Automated verify

```bash
npm run verify:phase-0
```

- [ ] Exit code **0**

## C. OAuth + DB

- [ ] Install on dev store completes without Unauthorized error
- [ ] `shops` + `shop_configs` rows in database
- [ ] Uninstall webhook route exists (`/api/webhooks/app-uninstalled`)

## D. Phase 0 complete when

**B + C** pass.

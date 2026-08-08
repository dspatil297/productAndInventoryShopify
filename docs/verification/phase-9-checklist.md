# Phase 9 checklist — Merchant accounts

## A. Prerequisites

- [x] `.env.local` complete (`SESSION_SECRET`, `DATABASE_URL`, Shopify vars)
- [x] `SHOPIFY_APP_URL` = current tunnel from `shopify app dev`
- [x] Schema applied: `npx prisma generate` then `npx prisma db push`
- [x] `shopify app dev` running
- [x] Previous phase: `npm run verify:phase-7` still green (optional smoke)

## B. Automated verify

```bash
npm run verify:phase-9
```

- [x] Exit code **0**
- [x] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Manual — register + login

- [x] From Shopify Admin → app Home → **Manage products & inventory**
- [x] Lands on `/login` with store name (no session yet)
- [x] **Create dashboard login** → register with name/email/password (prefer Shopify store email)
- [x] Lands on `/merchant/products` (or return_to)
- [x] Sign out → `/login`
- [x] Sign in with same email/password (bookmark `/login`, no Admin) → dashboard



## C2. Manual — multi-store (same email)

- [x] Second store: Admin Home → Manage → create/link login with **same email + same password**
- [x] Sign out → `/login` with that email → lands on `/select-store`
- [x] Pick a store → that store’s products load
- [ ] Nav **Switch store** appears when 2+ stores linked



## D. Manual — soft-land

- [x] While signed in: Admin Home → Manage… → opens tools directly (no re-login)
- [x] After sign out: Admin Home → Manage… → `/login` (not auto-session from handoff alone)
- [x] Agency `/agency/login` still works; merchant cookie does not unlock agency



## E. Security

- [ ] No access tokens in browser network/HTML
- [ ] `merchant_portal_session` cookie is HttpOnly
- [ ] Passwords not logged; only bcrypt hashes in DB (`merchant_users`)



## F. Phase 9 complete when

- [ ] Sections B + C + D pass
- [ ] Merchant can register after install and log in on app domain
- [ ] Bookmark login reaches dashboard without Admin
- [ ] Admin “Open dashboard” respects session / sends to login
- [ ] Agency login still isolated



## Troubleshooting


| Symptom                        | Fix                                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| Prisma `merchantUser` missing  | Run `npx prisma generate` + `npx prisma db push`                  |
| Register says proof expired    | Handoff lasts 5 min — click Manage again from Admin Home          |
| Login “not for selected store” | Email belongs to another shop — use that store’s account          |
| Redirect loop on `/merchant/*` | Clear cookies; sign in at `/login`                                |
| Agency login broken            | Unrelated cookie — check `agency_session` + `AGENCY_ADMIN_*` seed |



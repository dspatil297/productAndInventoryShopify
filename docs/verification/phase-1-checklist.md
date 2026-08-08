# Phase 1 verification checklist (user)

Run after agent ships Phase 1. Check boxes as you go. Dev server must be running unless noted.

**Prerequisites:** `.env.local` filled (see Section 10 in `PROJECT.md`), Postgres up, `npm install` + `prisma db push` done.

---

## A. Environment (before starting server)

- [x] **A1.** `.env.local` exists at project root (never commit).
- [x] **A2.** `DATABASE_URL` — valid Postgres connection string.
- [x] **A3.** `SHOPIFY_API_KEY` + `SHOPIFY_API_SECRET` — from Partner Dashboard → your app → Client credentials.
- [x] **A4.** `SCOPES` — includes at least: `read_products,write_products,read_inventory,write_inventory,read_locations,read_files,write_files`.
- [x] **A5.** `SESSION_SECRET` — long random string (32+ chars).
- [x] **A6.** `ENCRYPTION_KEY` — exactly **64 hex characters** (`openssl rand -hex 32`).
- [x] **A7.** `AGENCY_ADMIN_EMAIL` + `AGENCY_ADMIN_PASSWORD` — credentials you will use to log in.
- [x] **A8.** Duplicate `DATABASE_URL` into `.env` as well (Prisma CLI reads `.env`).

---

## B. Start dev environment

- [x] **B1.** Terminal 1 — from project root: `shopify app dev` (or `npm run dev` if tunnel already configured).
- [x] **B2.** Note the tunnel URL (e.g. `https://….trycloudflare.com`) — no trailing slash issues.
- [x] **B3.** Partner Dashboard → App setup → URLs match tunnel (App URL, redirect URLs) if CLI did not update them.
- [x] **B4.** Open tunnel root in browser — home page loads without 500.

---

## C. Automated agent checks (optional — you or agent)

From project root:

```bash
npm run verify:phase-1
```

- [x] **C1.** Command exits **0** (all checks pass after retries).
- [x] **C2.** `docs/verification/agent-log.md` shows latest run with all **PASS**.

---

## D. Agency login

- [x] **D1.** Open `{tunnel}/agency/login`.
- [x] **D2.** Enter `AGENCY_ADMIN_EMAIL` + `AGENCY_ADMIN_PASSWORD`.
- [x] **D3.** Submit → redirects to `/agency/dashboard` (not back to login).
- [x] **D4.** Refresh dashboard — still logged in (cookie works).
- [x] **D5.** Click **Log out** → back to `/agency/login`; `/agency/dashboard` redirects to login.

---

## E. Dashboard & store list

- [x] **E1.** Dashboard shows stat cards: Total stores, Active, Inactive, Total products.
- [x] **E2.** **Recent stores** section lists your installed dev store(s).
- [x] **E3.** Open `/agency/stores` — full table with domain, status, plan, products, last sync.
- [x] **E4.** If you had a store from Phase 0: row appears with **Active** status.

---

## F. Install link & connect store

- [x] **F1.** On dashboard or stores page — **Install link** generator.
- [x] **F2.** Enter a dev store domain (e.g. `your-store.myshopify.com`) → copy link.
- [x] **F3.** Copied URL format: `{tunnel}/api/auth?shop=…myshopify.com`.
- [x] **F4.** Open `/agency/connect` → enter same domain → redirects to Shopify OAuth.
- [x] **F5.** (Optional) Complete OAuth on a **second** dev store → new row in `/agency/stores`.

---

## G. Store detail & actions

Pick one **Active** store from the list.

- [x] **G1.** Click **Open** → `/agency/stores/{id}` loads with shop name, domain, stats.
- [x] **G2.** Stats show: plan, currency, products, locations, metafield defs, installed date, last sync.
- [x] **G3.** Click **Sync** on stores list (or note sync from detail) → **Last sync** updates; no error toast.
- [x] **G4.** After sync, **Products** count is a number (not `—`) if store has products.
- [x] **G5.** **Store settings** — change low stock threshold → **Save** → success message; refresh keeps value.
- [x] **G6.** **Disconnect** on an inactive test store OR skip if you only have one dev store.
- [x] **G7.** If disconnected: status **Inactive**; OAuth reinstall works via install link.

---

## H. Security spot-check

- [x] **H1.** Browser DevTools → Network → agency API responses — no `accessToken` or raw Shopify tokens in JSON.
- [x] **H2.** View page source on agency pages — no secrets in HTML.

---

## I. Phase 1 complete when

All of **D**, **E**, **F** (F5 optional), and **G1–G5** pass.

Then tell the agent: **Phase 2** (merchant embedded shell).s

---

## Troubleshooting


| Symptom                         | Fix                                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login always fails              | Check `AGENCY_ADMIN_`* in `.env.local`; restart dev server after env change.                                                                                         |
| Login loops back to login form  | Restart dev server after pull. Login now uses server action + cookie. If still loops: delete rows in `agency_users` table, restart, login again (re-seeds from env). |
| Wrong password after env change | Seed runs once only — delete `agency_users` rows or update password in DB.                                                                                           |
| `ENCRYPTION_KEY must be 64 hex` | Regenerate with `openssl rand -hex 32`.                                                                                                                              |
| Empty store list                | Complete OAuth install first; check DB has `shops` row.                                                                                                              |
| Sync fails                      | Store must be Active; token not revoked in Partner/Admin.                                                                                                            |
| OAuth cookie error              | Use same browser; complete flow in one tab; retry from `/agency/connect`.                                                                                            |



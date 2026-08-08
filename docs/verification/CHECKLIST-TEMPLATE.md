# Phase checklist template (copy per phase)

Copy to `phase-N-checklist.md`. Replace `N`, feature names, and routes.

---

## A. Prerequisites

- [ ] `.env.local` complete (Section 10, `PROJECT.md`)
- [ ] `SHOPIFY_APP_URL` = current tunnel from `shopify app dev`
- [ ] `shopify app dev` running
- [ ] Previous phase verify still passes: `npm run verify:phase-<N-1>`

## B. Automated verify (agent or user)

```bash
npm run verify:phase-N
```

- [ ] Exit code **0**
- [ ] Latest entry in `docs/verification/agent-log.md` shows all **PASS**

## C. Manual — core feature

- [ ] … (from PROJECT.md **Done when**)

## D. Manual — edge cases

- [ ] …

## E. Security

- [ ] No access tokens in browser network/HTML

## F. Phase N complete when

- [ ] All sections C + automated verify pass

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| … | … |

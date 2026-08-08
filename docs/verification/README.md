# Verification (all phases)

**Agents:** read [AGENT-PROTOCOL.md](./AGENT-PROTOCOL.md) every chat before closing a phase.

Two layers:

1. **Automated** — `npm run verify:phase-N` (retry 3×, log to [agent-log.md](./agent-log.md))
2. **Manual** — user checklist per phase (browser / Shopify Admin)

## Commands

| Phase | Command | Checklist |
|-------|---------|-----------|
| 0 | `npm run verify:phase-0` | [phase-0-checklist.md](./phase-0-checklist.md) |
| 1 | `npm run verify:phase-1` | [phase-1-checklist.md](./phase-1-checklist.md) |
| 2 | `npm run verify:phase-2` | [phase-2-checklist.md](./phase-2-checklist.md) |
| 3–7 | `npm run verify:phase-N` | Create from [CHECKLIST-TEMPLATE.md](./CHECKLIST-TEMPLATE.md) when phase starts |

Registry: [phases.json](./phases.json)

## Agent rules (summary)

- Do **not** mark phase done in `PROJECT.md` Section 19 until `verify:phase-N` exits **0**
- Failed check → fix → re-run until pass (script retries each check 3× internally)
- Always give user the phase checklist link after shipping
- New chat: read Section 19 + last [agent-log.md](./agent-log.md) entry

## Adding a new phase verify script

1. Copy `scripts/verify/phase-2.mjs` → adjust `REQUIRED_FILES`
2. Copy [CHECKLIST-TEMPLATE.md](./CHECKLIST-TEMPLATE.md) → `phase-N-checklist.md`
3. Add `"verify:phase-N"` to `package.json`
4. Register in [phases.json](./phases.json)

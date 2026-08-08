# Agent verification protocol (every chat, every phase)

Mandatory for **all agents** in **all chats**. `.cursor/rules/project-context.mdc` enforces this.

## Before marking a phase done

1. Read `PROJECT.md` Section 19 — work only current phase.
2. Implement phase scope from `PROJECT.md` build table.
3. Run automated verify (retry until pass):

```bash
npm run verify:phase-<N>
```

4. If any check fails → **fix code** → run again. Up to **3 retries per check** (built into script). If still failing after your fixes, **do not** check off the phase in Section 19.
5. Append run is automatic → `docs/verification/agent-log.md`.
6. Give user the **manual checklist** for that phase (link below). User runs browser/Shopify steps; agent does not skip listing them.

## Phase registry

| Phase | Verify command | User checklist |
|-------|----------------|----------------|
| 0 | `npm run verify:phase-0` | [phase-0-checklist.md](./phase-0-checklist.md) |
| 1 | `npm run verify:phase-1` | [phase-1-checklist.md](./phase-1-checklist.md) |
| 2 | `npm run verify:phase-2` | [phase-2-checklist.md](./phase-2-checklist.md) |
| 3 | `npm run verify:phase-3` | [phase-3-checklist.md](./phase-3-checklist.md) |
| 4 | `npm run verify:phase-4` | [phase-4-checklist.md](./phase-4-checklist.md) |
| 5 | `npm run verify:phase-5` | [phase-5-checklist.md](./phase-5-checklist.md) |
| 6 | `npm run verify:phase-6` | [phase-6-checklist.md](./phase-6-checklist.md) |
| 7 | `npm run verify:phase-7` | [phase-7-checklist.md](./phase-7-checklist.md) |
| 8 | `npm run verify:phase-8` | [phase-8-checklist.md](./phase-8-checklist.md) *(create when phase starts)* |
| 9 | `npm run verify:phase-9` | [phase-9-checklist.md](./phase-9-checklist.md) *(create when phase starts)* |
| 10 | `npm run verify:phase-10` | [phase-10-checklist.md](./phase-10-checklist.md) |
| 11 | `npm run verify:phase-11` | [phase-11-checklist.md](./phase-11-checklist.md) |
| 12 | `npm run verify:phase-12` | [phase-12-checklist.md](./phase-12-checklist.md) *(create when phase starts)* |
| 13 | `npm run verify:phase-13` | [phase-13-checklist.md](./phase-13-checklist.md) *(create when phase starts)* |

Machine-readable copy: [phases.json](./phases.json). Roadmap summary: [../roadmap/platform-next.md](../roadmap/platform-next.md).

## New phase checklist (agent creates when starting phase N)

1. Copy [CHECKLIST-TEMPLATE.md](./CHECKLIST-TEMPLATE.md) → `phase-N-checklist.md`.
2. Fill sections A–I from `PROJECT.md` phase **Done when** + **Features**.
3. Add `scripts/verify/phase-N.mjs` with required files + `standardPhaseChecks`.
4. Add `"verify:phase-N"` to `package.json`.
5. Register in `phases.json`.

## Automated checks (default)

Every `phase-N.mjs` should use `standardPhaseChecks()` from `scripts/verify/common.mjs`:

- Required phase files exist
- `.env.example` keys (when applicable)
- `node_modules` present
- `npm run lint`
- `npm run build`

Never read `.env.local` or print secrets in logs.

## User manual checks (agent summarizes, user executes)

Typical blocks (adapt per phase):

- **A.** Environment / prerequisites
- **B.** Start dev (`shopify app dev`, `SHOPIFY_APP_URL` = tunnel)
- **C.** Run `npm run verify:phase-N` → exit 0
- **D–H.** Feature-specific UI flows in browser / Shopify Admin
- **I.** Phase complete when …

## New chat bootstrap

User may say only: **Phase N** or **Continue Phase N**.

Agent must:

1. Read `PROJECT.md` Section 19 + Section **16** (phase skill row) + `docs/verification/AGENT-PROTOCOL.md`
2. Read `docs/verification/agent-log.md` (last run)
3. **Tell user** which skills/plugins to install for Phase N if missing (PROJECT.md Section 16.5). Do not ask for future-phase skills early.
4. Run `npm run verify:phase-<N-1>` if previous phase regression suspected
5. Implement Phase N → run `npm run verify:phase-N` until pass
6. Update Section 19 + point user to `phase-N-checklist.md`

## Regression

After bugfixes in a shipped phase, re-run that phase’s verify script before closing the task.

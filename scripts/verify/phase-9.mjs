import { standardPhaseChecks } from "./common.mjs";
import { runMerchantAuthSelfCheck } from "./merchant-auth-selfcheck.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 9 — Merchant accounts";
const CHECKLIST = "docs/verification/phase-9-checklist.md";

const REQUIRED_FILES = [
  "prisma/schema.prisma",
  "lib/db/merchant-users.ts",
  "lib/merchant/auth.ts",
  "lib/merchant/cookies.ts",
  "app/login/page.tsx",
  "app/login/actions.ts",
  "app/register/page.tsx",
  "app/api/merchant/logout/route.ts",
  "app/merchant/enter/route.ts",
  "middleware.ts",
  "docs/verification/phase-9-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: [
    ...standardPhaseChecks(REQUIRED_FILES),
    {
      name: "Merchant auth self-check",
      fn: runMerchantAuthSelfCheck,
    },
  ],
});

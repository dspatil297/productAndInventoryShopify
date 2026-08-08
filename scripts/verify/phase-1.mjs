import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 1 — Agency dashboard";
const CHECKLIST = "docs/verification/phase-1-checklist.md";

const REQUIRED_FILES = [
  "app/agency/login/page.tsx",
  "app/agency/(protected)/layout.tsx",
  "app/agency/(protected)/dashboard/page.tsx",
  "app/agency/(protected)/stores/page.tsx",
  "app/agency/(protected)/connect/page.tsx",
  "app/api/agency/login/route.ts",
  "app/api/agency/stores/route.ts",
  "app/api/agency/stores/[shopId]/sync/route.ts",
  "app/api/agency/stores/[shopId]/disconnect/route.ts",
  "lib/agency/auth.ts",
  "lib/agency/session.ts",
  "lib/agency/app-url.ts",
  "components/agency/InstallLinkForm.tsx",
  "components/agency/StoreList.tsx",
  "components/agency/OAuthDiagnostics.tsx",
  "scripts/verify/run-phase.mjs",
  "docs/verification/AGENT-PROTOCOL.md",
];

const ENV_KEYS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SCOPES",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
  "AGENCY_ADMIN_EMAIL",
  "AGENCY_ADMIN_PASSWORD",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES, ENV_KEYS),
});

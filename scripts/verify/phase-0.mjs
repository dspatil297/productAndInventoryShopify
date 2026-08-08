import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 0 — OAuth + DB + bootstrap";
const CHECKLIST = "docs/verification/phase-0-checklist.md";

const REQUIRED_FILES = [
  "prisma/schema.prisma",
  "lib/db/shops.ts",
  "lib/shopify/auth.ts",
  "lib/shopify/bootstrap.ts",
  "lib/shopify/client.ts",
  "app/api/auth/route.ts",
  "app/api/auth/callback/route.ts",
  "app/api/webhooks/app-uninstalled/route.ts",
  "shopify.app.toml",
];

const ENV_KEYS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SCOPES",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES, ENV_KEYS),
});

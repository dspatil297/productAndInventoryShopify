import type { Prisma } from "@/generated/prisma/client";
import type { ExcelImportPreviewRow } from "@/lib/import/excel-pipeline";
import { updateShopConfig } from "@/lib/db/shops";import { prisma } from "@/lib/db/prisma";
import type { ImportReport, ProductDraft } from "@/lib/import/spec/types";

const SESSIONS_KEY = "importSessions";
const MAX_SESSIONS = 4;

export type StoredImportSessionStatus =
  | "processing"
  | "preview_ready"
  | "importing"
  | "completed"
  | "failed";

export interface StoredImportSession {
  id: string;
  shopId: string;
  fileName: string;
  status: StoredImportSessionStatus;
  createdAt: string;
  updatedAt: string;
  mappingNotes?: string;
  rowCount?: number;
  previewSummary?: {
    create: number;
    update: number;
    skip: number;
    error: number;
  };
  previewRows?: ExcelImportPreviewRow[];
  drafts?: ProductDraft[];
  csv?: string;
  report?: ImportReport;
  resumeFromHandle?: string;
  error?: string;
}

function readSettingsRecord(
  settings: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  if (typeof settings === "object" && settings !== null && !Array.isArray(settings)) {
    return settings as Record<string, unknown>;
  }
  return {};
}

export function readImportSessions(
  settings: Prisma.JsonValue | null | undefined,
): StoredImportSession[] {
  const raw = readSettingsRecord(settings)[SESSIONS_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (item): item is StoredImportSession =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as StoredImportSession).id === "string",
  );
}

export async function saveImportSession(
  shopId: string,
  session: StoredImportSession,
): Promise<void> {
  const existing = await prisma.shopConfig.findUnique({
    where: { shopId },
    select: { settings: true },
  });
  const settings = readSettingsRecord(existing?.settings);
  const sessions = readImportSessions(settings as Prisma.JsonValue).filter(
    (entry) => entry.id !== session.id,
  );
  sessions.unshift(session);
  const trimmed = sessions.slice(0, MAX_SESSIONS).map((entry, idx) =>
    idx < 2
      ? entry
      : {
          ...entry,
          drafts: undefined,
          csv: undefined,
        },
  );
  await updateShopConfig(shopId, {
    settings: {
      [SESSIONS_KEY]: trimmed,
    },
  });
}

export async function getImportSession(
  shopId: string,
  sessionId: string,
): Promise<StoredImportSession | null> {
  const existing = await prisma.shopConfig.findUnique({
    where: { shopId },
    select: { settings: true },
  });
  return (
    readImportSessions(existing?.settings).find(
      (session) => session.id === sessionId,
    ) ?? null
  );
}

export async function loadImportSessionDrafts(
  shopId: string,
  sessionId: string,
  resumeFromHandle?: string,
): Promise<{ drafts: ProductDraft[]; resumeFromHandle?: string } | null> {
  const session = await getImportSession(shopId, sessionId);
  if (!session?.drafts) {
    return null;
  }

  const completed = new Set(
    (session.report?.handles ?? [])
      .filter((entry) => entry.status === "created" || entry.status === "updated")
      .map((entry) => entry.handle),
  );

  const drafts = session.drafts.filter((draft) => {
    if (completed.has(draft.handle)) {
      return false;
    }
    if (resumeFromHandle) {
      return draft.handle >= resumeFromHandle;
    }
    return true;
  });

  return {
    drafts,
    resumeFromHandle: session.resumeFromHandle ?? resumeFromHandle,
  };
}

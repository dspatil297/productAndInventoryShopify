import type { Shop } from "@/generated/prisma/client";
import { shopifyGraphqlForShop } from "@/lib/shopify/client";
import { STAGED_UPLOADS_CREATE_MUTATION } from "@/lib/shopify/mutations";

export interface StagedUploadTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

interface StagedUploadsCreateResponse {
  stagedUploadsCreate: {
    stagedTargets: Array<{
      url: string | null;
      resourceUrl: string | null;
      parameters: Array<{ name: string; value: string }>;
    }> | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

function sanitizeFilename(raw: string): string {
  const base = raw.split(/[/\\]/).pop()?.trim() || "product-image.jpg";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  if (cleaned.includes(".")) {
    return cleaned.slice(0, 120);
  }
  return `${cleaned.slice(0, 100)}.jpg`;
}

function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

export async function createStagedUploadTarget(
  shop: Shop,
  input: {
    filename: string;
    mimeType: string;
    resource?: "PRODUCT_IMAGE" | "FILE";
  },
): Promise<StagedUploadTarget> {
  const data = await shopifyGraphqlForShop<StagedUploadsCreateResponse>(
    shop,
    STAGED_UPLOADS_CREATE_MUTATION,
    {
      input: [
        {
          filename: input.filename,
          mimeType: input.mimeType,
          resource: input.resource ?? "PRODUCT_IMAGE",
          // POST + multipart is required for PRODUCT_IMAGE on GCS targets
          httpMethod: "POST",
        },
      ],
    },
  );

  const userError = data.stagedUploadsCreate.userErrors[0];
  if (userError) {
    throw new Error(userError.message);
  }

  const target = data.stagedUploadsCreate.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl) {
    throw new Error("Shopify returned no staged upload target");
  }

  return {
    url: target.url,
    resourceUrl: target.resourceUrl,
    parameters: target.parameters ?? [],
  };
}

/** Upload file bytes to a staged target (multipart POST). Returns resourceUrl. */
export async function uploadFileToStagedTarget(
  target: StagedUploadTarget,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<string> {
  const body = new FormData();
  // GCS is strict: parameters first, file last
  for (const parameter of target.parameters) {
    body.append(parameter.name, parameter.value);
  }

  // Node/undici: Blob + explicit type is more reliable than reusing request File
  // Copy to ArrayBuffer-backed view — TS BlobPart rejects SharedArrayBuffer-typed Uint8Array
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const blob = new Blob([payload], { type: mimeType });
  body.append("file", blob, filename);

  const response = await fetch(target.url, {
    method: "POST",
    body,
    // do not set Content-Type — boundary must be set by runtime
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(
      detail
        ? `Staged upload failed (${response.status}): ${detail}`
        : `Staged upload failed (${response.status})`,
    );
  }

  return target.resourceUrl;
}

export async function stageProductImage(
  shop: Shop,
  file: File,
): Promise<string> {
  const filename = sanitizeFilename(file.name || "product-image.jpg");
  const mimeType = file.type?.startsWith("image/")
    ? file.type
    : mimeFromFilename(filename);

  if (file.size <= 0) {
    throw new Error("Image file is empty");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const target = await createStagedUploadTarget(shop, {
    filename,
    mimeType,
    resource: "PRODUCT_IMAGE",
  });
  return uploadFileToStagedTarget(target, bytes, filename, mimeType);
}

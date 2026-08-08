"use client";

import { useState } from "react";
import {
  formatBytes,
  MAX_PRODUCT_IMAGE_BYTES,
  validateProductImages,
} from "@/lib/products/image-limits";

const inputClassName =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function ProductImagesField() {
  const [error, setError] = useState<string | null>(null);

  return (
    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span className="text-muted-foreground">
        Images (optional, max {formatBytes(MAX_PRODUCT_IMAGE_BYTES)} each)
      </span>
      <input
        name="images"
        type="file"
        accept="image/*"
        multiple
        className={inputClassName}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const message = validateProductImages(files);
          setError(message);
          if (message) {
            event.target.value = "";
          }
        }}
      />
      <span className="text-xs text-muted-foreground">
        Big files hang create under tunnel. Skip images to create fast, add later in Admin.
      </span>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

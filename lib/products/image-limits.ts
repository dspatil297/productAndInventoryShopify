/** Max bytes per product image (multipart + tunnel; keep small). */
export const MAX_PRODUCT_IMAGE_BYTES = 4 * 1024 * 1024;

/** Soft total for all images in one create submit. */
export const MAX_PRODUCT_IMAGES_TOTAL_BYTES = 12 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateProductImages(files: File[]): string | null {
  let total = 0;
  for (const file of files) {
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      return `Image "${file.name}" is ${formatBytes(file.size)}. Max ${formatBytes(MAX_PRODUCT_IMAGE_BYTES)} per file — compress or skip images.`;
    }
    total += file.size;
  }
  if (total > MAX_PRODUCT_IMAGES_TOTAL_BYTES) {
    return `Images total ${formatBytes(total)}. Max ${formatBytes(MAX_PRODUCT_IMAGES_TOTAL_BYTES)} — fewer/smaller files.`;
  }
  return null;
}

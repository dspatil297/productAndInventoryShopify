export function isNextNavigationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const digest = (error as { digest?: string }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

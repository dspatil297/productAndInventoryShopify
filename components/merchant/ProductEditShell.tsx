import type { ReactNode } from "react";

interface ProductEditShellProps {
  view: "simple" | "visual";
  simpleHref: string;
  visualHref: string;
  children: ReactNode;
  visualSlot?: ReactNode;
}

/**
 * Simple forms | Visual templates (non-tech PDP fill → stock/publish → Shopify).
 */
export function ProductEditShell({
  view,
  simpleHref,
  visualHref,
  children,
  visualSlot,
}: ProductEditShellProps) {
  const tabBase = "rounded px-3 py-1.5 text-sm no-underline";
  const tabOn = `${tabBase} bg-primary text-primary-foreground`;
  const tabOff = `${tabBase} text-muted-foreground hover:text-foreground`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          <a href={simpleHref} className={view === "simple" ? tabOn : tabOff}>
            Simple forms
          </a>
          <a href={visualHref} className={view === "visual" ? tabOn : tabOff}>
            Visual templates
          </a>
        </div>
      </div>

      {view === "simple" ? (
        <div className="mx-auto max-w-2xl">{children}</div>
      ) : (
        (visualSlot ?? children)
      )}
    </div>
  );
}

export default function MerchantLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-muted" />
          <div className="h-3.5 w-64 rounded bg-muted/70" />
        </div>
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>
      <div className="h-16 w-full rounded-xl border border-border bg-card" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-64 rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Server-rendered key/value or FAQ pair editor.
 * Behavior: /public/pair-list.js (delegation — tunnel-safe).
 */
export function PairListField({
  name,
  defaultValue = "",
  mode,
  storage = "json",
  listFormat,
}: {
  name: string;
  defaultValue?: string;
  mode: "kv" | "faq" | "vk";
  storage?: "json" | "list_lines";
  listFormat?: "kv" | "vk" | "faq_lines";
}) {
  const leftLabel =
    mode === "faq" ? "Question" : mode === "vk" ? "Value" : "Label";
  const rightLabel =
    mode === "faq" ? "Answer" : mode === "vk" ? "Caption" : "Value";
  const hint =
    mode === "faq"
      ? "FAQ pairs — Add each Q & A (saved as JSON)"
      : mode === "vk"
        ? "Stat / caption pairs — Add each row (saved as list lines)"
        : storage === "list_lines"
          ? "Label / value rows — saved as list lines (K: … V: …)"
          : "Key / value pairs — Add each row (saved as JSON)";

  return (
    <div
      className="flex flex-col gap-2"
      data-mf-pair-root=""
      data-mf-pair-mode={mode === "vk" ? "kv" : mode}
      data-mf-pair-storage={storage}
      data-mf-list-format={listFormat ?? ""}
    >
      <input
        type="hidden"
        name={name}
        defaultValue={defaultValue}
        data-mf-pair-hidden=""
      />
      <div className="flex flex-col gap-2" data-mf-pair-rows="" />
      <p className="text-[11px] text-muted-foreground" data-mf-pair-empty="">
        No rows yet
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          placeholder={leftLabel}
          autoComplete="off"
          data-mf-pair-left=""
        />
        <input
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          placeholder={rightLabel}
          autoComplete="off"
          data-mf-pair-right=""
        />
      </div>
      <button type="button" className="mf-btn w-fit px-3 text-xs" data-mf-pair-add="">
        Add {mode === "faq" ? "FAQ" : "row"}
      </button>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

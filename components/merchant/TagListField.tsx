/**
 * Server-rendered tag list markup.
 * Behavior: /public/tag-list.js (document event delegation).
 * Bypass React handlers — tunnel/HMR leaves client onClick dead on create form.
 */
export function TagListField({
  name,
  defaultValue = "",
  dataMfInput = false,
  dataBaseline,
}: {
  name: string;
  defaultValue?: string;
  multiline?: boolean;
  dataMfInput?: boolean;
  dataBaseline?: string;
}) {
  const inputClassName =
    "w-full min-w-[140px] rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div className="flex flex-col gap-1" data-mf-tag-root="">
      <input
        type="hidden"
        name={name}
        defaultValue={defaultValue}
        data-mf-tag-hidden=""
        data-mf-input={dataMfInput ? "1" : undefined}
        data-baseline={dataBaseline ?? defaultValue}
      />
      <div className="flex min-h-6 flex-wrap gap-1" data-mf-tag-chips="" />
      <p className="text-[11px] text-muted-foreground" data-mf-tag-empty="">
        No tags yet
      </p>
      <div className="flex items-center gap-2">
        <input
          className={inputClassName}
          placeholder="Type a tag"
          autoComplete="off"
          data-mf-tag-draft=""
        />
        <button type="button" className="mf-btn shrink-0 px-3 text-xs" data-mf-tag-add="">
          Add
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Tags — Add or Enter · no JSON</p>
    </div>
  );
}

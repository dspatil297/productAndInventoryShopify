function labelFor(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function isMultilineField(field: string): boolean {
  return /quote|bio|description|body|text|content|story|html|paragraph/i.test(
    field,
  );
}

export function parseJsonObjectEditorState(
  defaultValue: string,
  fields: string[],
): {
  values: Record<string, string>;
  fieldKeys: string[];
  nestedFields: Set<string>;
} {
  const nestedFields = new Set<string>();
  const values: Record<string, string> = {};
  const seen = new Set<string>();

  for (const field of fields) {
    seen.add(field);
    values[field] = "";
  }

  const trimmed = defaultValue.trim();
  if (trimmed) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
          if (!seen.has(key)) {
            seen.add(key);
            values[key] = "";
          }
          if (Array.isArray(value)) {
            if (value.every((item) => typeof item === "string")) {
              values[key] = value.map(String).join("\n");
            } else {
              nestedFields.add(key);
              values[key] = JSON.stringify(value, null, 2);
            }
          } else if (value !== null && typeof value === "object") {
            nestedFields.add(key);
            values[key] = JSON.stringify(value, null, 2);
          } else {
            values[key] = value == null ? "" : String(value);
          }
        }
      }
    } catch {
      // keep blank defaults
    }
  }

  return {
    values,
    fieldKeys: [...seen],
    nestedFields,
  };
}

export function JsonObjectFieldItem({
  index,
  fields,
  values,
  nestedFields,
  mode,
}: {
  index: number;
  fields: string[];
  values: Record<string, string>;
  nestedFields: Set<string>;
  mode: "object" | "object_list";
}) {
  const inputClassName =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div
      className="space-y-2 rounded-md border border-border/80 p-2"
      data-mf-json-item={String(index)}
    >
      {fields.map((field) => {
        const multiline =
          nestedFields.has(field) ||
          isMultilineField(field) ||
          /paragraphs|^meta$/i.test(field) ||
          (values[field]?.includes("\n") ?? false);
        return (
          <label key={field} className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{labelFor(field)}</span>
            {multiline ? (
              <textarea
                className={`${inputClassName} min-h-16 resize-y`}
                rows={nestedFields.has(field) ? 4 : 3}
                defaultValue={values[field] ?? ""}
                data-mf-json-field={field}
                data-mf-json-field-type={
                  nestedFields.has(field)
                    ? "json"
                    : /paragraphs|^meta$/i.test(field)
                      ? "string_array"
                      : "string"
                }
              />
            ) : (
              <input
                type="text"
                className={inputClassName}
                defaultValue={values[field] ?? ""}
                data-mf-json-field={field}
                data-mf-json-field-type="string"
              />
            )}
          </label>
        );
      })}
      {mode === "object_list" ? (
        <button
          type="button"
          className="mf-btn px-2 text-xs"
          data-mf-json-remove=""
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

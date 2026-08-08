import {
  JsonObjectFieldItem,
  parseJsonObjectEditorState,
} from "@/components/merchant/JsonObjectFieldItem";
import { jsonObjectFieldsForKey } from "@/lib/metafields/editor-hints";
import { keyFromFieldName } from "@/lib/metafields/resolve-metafield-editor";

/**
 * JSON object / object-list editor — SSR fields + /public/json-object.js sync.
 */
export function JsonObjectField({
  name,
  defaultValue = "",
  mode,
  fields,
}: {
  name: string;
  defaultValue?: string;
  mode: "object" | "object_list";
  fields: string[];
}) {
  const fieldKey = keyFromFieldName(name);
  const resolvedFields =
    fields.length > 0 ? fields : jsonObjectFieldsForKey(fieldKey);
  const state = parseJsonObjectEditorState(defaultValue, resolvedFields);
  const hiddenValue =
    defaultValue.trim() ||
    (mode === "object_list" ? "[]" : "{}");

  let items: Record<string, string>[] = [];
  if (mode === "object_list") {
    try {
      const parsed: unknown = JSON.parse(hiddenValue);
      if (Array.isArray(parsed)) {
        items = parsed.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return Object.fromEntries(state.fieldKeys.map((field) => [field, ""]));
          }
          const row: Record<string, string> = {};
          for (const field of state.fieldKeys) {
            const value = (item as Record<string, unknown>)[field];
            row[field] =
              value == null
                ? ""
                : typeof value === "string"
                  ? value
                  : JSON.stringify(value);
          }
          return row;
        });
      }
    } catch {
      items = [];
    }
    if (items.length === 0 && state.fieldKeys.length > 0) {
      items = [Object.fromEntries(state.fieldKeys.map((field) => [field, ""]))];
    }
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-mf-json-root=""
      data-mf-json-mode={mode}
      data-mf-json-fields={JSON.stringify(state.fieldKeys)}
    >
      <input
        type="hidden"
        name={name}
        defaultValue={hiddenValue}
        data-mf-json-hidden=""
      />
      <div className="flex flex-col gap-3" data-mf-json-items="">
        {mode === "object_list" ? (
          items.map((item, index) => (
            <JsonObjectFieldItem
              key={`item-${index}`}
              index={index}
              fields={state.fieldKeys}
              values={item}
              nestedFields={state.nestedFields}
              mode={mode}
            />
          ))
        ) : (
          <JsonObjectFieldItem
            index={0}
            fields={state.fieldKeys}
            values={state.values}
            nestedFields={state.nestedFields}
            mode={mode}
          />
        )}
      </div>
      {mode === "object_list" ? (
        <button
          type="button"
          className="mf-btn w-fit px-3 text-xs"
          data-mf-json-add=""
        >
          Add item
        </button>
      ) : null}
    </div>
  );
}

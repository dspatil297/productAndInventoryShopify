"use client";

import { useId, useState } from "react";
import {
  decodeJsonProse,
  encodeListEditorItems,
  isJsonProseMetafieldType,
  isListMetafieldType,
  parseListEditorItems,
} from "@/lib/metafields/display";
import type { MetafieldDefinitionNode } from "@/types/shopify";
import {
  keyFromFieldName,
  resolveMetafieldEditor,
} from "@/lib/metafields/resolve-metafield-editor";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import { StructuredMetafieldField } from "@/components/merchant/StructuredMetafieldField";

const INPUT_CLASS =
  "w-full min-w-[140px] rounded-md border border-border bg-background px-2 py-1.5 text-sm";

interface MetafieldWidgetProps {
  typeName: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  allowEmptyBoolean?: boolean;
}

declare global {
  interface Window {
    mfMarkDirty?: (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => void;
  }
}

function ErrorLine({ error }: { error?: string }) {
  if (!error) {
    return null;
  }
  return <p className="text-xs text-destructive">{error}</p>;
}

/** Controlled tags UI for grid (MetafieldCell). */
function ListTagsControlled({
  value,
  onChange,
  disabled,
  multiline,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const items = parseListEditorItems(value);

  const commit = (next: string[]) => {
    onChange(encodeListEditorItems(next));
  };

  const addDraft = () => {
    const pieces = draft
      .split(",")
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0);
    if (pieces.length === 0) {
      return;
    }
    commit([...items, ...pieces]);
    setDraft("");
  };

  if (multiline) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          className={`${INPUT_CLASS} min-h-[72px] resize-y`}
          value={items.join("\n")}
          disabled={disabled}
          placeholder="One item per line"
          onChange={(event) => {
            commit(
              event.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0),
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs"
            >
              {item}
              {!disabled ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${item}`}
                  onClick={() =>
                    commit(items.filter((_, i) => i !== index))
                  }
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <div className="flex items-center gap-2">
          <input
            className={INPUT_CLASS}
            value={draft}
            placeholder="Type a tag"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                event.stopPropagation();
                addDraft();
              }
            }}
          />
          <button
            type="button"
            className="mf-btn shrink-0 px-3 text-xs"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addDraft();
            }}
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NamedColorField({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <input
          type="color"
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
          value={hex}
          aria-label="Pick color"
          onChange={(event) => setValue(event.target.value)}
        />
        <input
          type="text"
          className={INPUT_CLASS}
          value={value}
          placeholder="#RRGGBB"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </div>
  );
}

function NamedDateField({
  name,
  typeName,
  defaultValue,
}: {
  name: string;
  typeName: string;
  defaultValue: string;
}) {
  const isDateTime = typeName === "date_time";
  const [value, setValue] = useState(defaultValue);
  const valid = isDateTime
    ? /^\d{4}-\d{2}-\d{2}/.test(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(value);
  const displayValue = valid
    ? isDateTime
      ? value.slice(0, 16).replace("Z", "").replace(" ", "T")
      : value.slice(0, 10)
    : "";

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={value} />
      <input
        type={isDateTime ? "datetime-local" : "date"}
        className={`${INPUT_CLASS} max-w-xs`}
        value={displayValue}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

export function MetafieldWidget({
  typeName,
  value,
  onChange,
  disabled = false,
  error,
  allowEmptyBoolean = false,
}: MetafieldWidgetProps) {
  const boolId = useId();

  if (isUnsupportedMetafieldType(typeName)) {
    return (
      <div className="flex flex-col gap-1">
        <input
          className={`${INPUT_CLASS} cursor-not-allowed opacity-60`}
          value={value}
          readOnly
          tabIndex={-1}
          title="Read-only in this app"
        />
        <ErrorLine error={error} />
      </div>
    );
  }

  if (isListMetafieldType(typeName)) {
    return (
      <div className="flex flex-col gap-1">
        <ListTagsControlled
          value={value}
          onChange={onChange}
          disabled={disabled}
          multiline={typeName === "list.multi_line_text_field"}
        />
        <ErrorLine error={error} />
      </div>
    );
  }

  if (isJsonProseMetafieldType(typeName)) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          className={`${INPUT_CLASS} min-h-[72px] resize-y`}
          value={decodeJsonProse(value)}
          disabled={disabled}
          placeholder="Plain text ok"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-[11px] text-muted-foreground">
          Plain text ok — no JSON required
        </span>
        <ErrorLine error={error} />
      </div>
    );
  }

  if (typeName === "multi_line_text_field") {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          className={`${INPUT_CLASS} min-h-[72px] resize-y`}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <ErrorLine error={error} />
      </div>
    );
  }

  if (typeName === "boolean") {
    if (allowEmptyBoolean) {
      return (
        <div className="flex flex-col gap-1">
          <select
            className={INPUT_CLASS}
            value={value === "true" || value === "false" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <ErrorLine error={error} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm" htmlFor={boolId}>
          <input
            id={boolId}
            type="checkbox"
            checked={value === "true"}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.checked ? "true" : "false")
            }
          />
          <span>{value === "true" ? "Yes" : "No"}</span>
        </label>
        <ErrorLine error={error} />
      </div>
    );
  }

  if (typeName === "color") {
    const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
            value={hex}
            disabled={disabled}
            aria-label="Pick color"
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="text"
            className={INPUT_CLASS}
            value={value}
            disabled={disabled}
            placeholder="#RRGGBB"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <ErrorLine error={error} />
      </div>
    );
  }

  if (typeName === "date" || typeName === "date_time") {
    const isDateTime = typeName === "date_time";
    const valid = isDateTime
      ? /^\d{4}-\d{2}-\d{2}/.test(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(value);
    const displayValue = valid
      ? isDateTime
        ? value.slice(0, 16).replace("Z", "").replace(" ", "T")
        : value.slice(0, 10)
      : "";

    return (
      <div className="flex flex-col gap-1">
        <input
          type={isDateTime ? "datetime-local" : "date"}
          className={`${INPUT_CLASS} max-w-xs`}
          value={displayValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <ErrorLine error={error} />
      </div>
    );
  }

  const inputType = typeName === "url" ? "url" : "text";

  return (
    <div className="flex flex-col gap-1">
      <input
        type={inputType}
        className={INPUT_CLASS}
        value={value}
        disabled={disabled}
        inputMode={
          typeName === "number_integer" || typeName === "number_decimal"
            ? "decimal"
            : undefined
        }
        onChange={(event) => onChange(event.target.value)}
      />
      <ErrorLine error={error} />
    </div>
  );
}

/** Form wrapper for create + spreadsheet. */
export function NamedMetafieldWidget({
  name,
  typeName,
  defaultValue = "",
  allowEmptyBoolean = false,
  dataMfInput = false,
  dataBaseline,
  definition,
}: {
  name: string;
  typeName: string;
  defaultValue?: string;
  allowEmptyBoolean?: boolean;
  dataMfInput?: boolean;
  dataBaseline?: string;
  definition?: Pick<MetafieldDefinitionNode, "validations" | "type" | "key">;
}) {
  if (isUnsupportedMetafieldType(typeName)) {
    return (
      <input
        className={`${INPUT_CLASS} cursor-not-allowed opacity-60`}
        value={defaultValue}
        readOnly
        tabIndex={-1}
      />
    );
  }

  const fieldKey = definition?.key ?? keyFromFieldName(name);
  const editor = resolveMetafieldEditor(
    typeName,
    defaultValue,
    fieldKey,
    definition,
  );
  if (editor.kind !== "generic") {
    const structured = (
      <StructuredMetafieldField
        name={name}
        editor={editor}
        dataMfInput={dataMfInput}
        dataBaseline={dataBaseline}
      />
    );
    if (structured) {
      return structured;
    }
  }

  if (typeName === "color") {
    return <NamedColorField name={name} defaultValue={defaultValue} />;
  }

  if (typeName === "date" || typeName === "date_time") {
    return (
      <NamedDateField
        name={name}
        typeName={typeName}
        defaultValue={defaultValue}
      />
    );
  }

  return (
    <NamedGenericField
      name={name}
      typeName={typeName}
      defaultValue={defaultValue}
      allowEmptyBoolean={allowEmptyBoolean}
      dataMfInput={dataMfInput}
      dataBaseline={dataBaseline}
    />
  );
}

function NamedGenericField({
  name,
  typeName,
  defaultValue,
  allowEmptyBoolean,
  dataMfInput,
  dataBaseline,
}: {
  name: string;
  typeName: string;
  defaultValue: string;
  allowEmptyBoolean?: boolean;
  dataMfInput?: boolean;
  dataBaseline?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value}
        data-mf-input={dataMfInput ? "1" : undefined}
        data-baseline={dataBaseline ?? defaultValue}
      />
      <MetafieldWidget
        typeName={typeName}
        value={value}
        onChange={setValue}
        allowEmptyBoolean={allowEmptyBoolean}
      />
    </>
  );
}

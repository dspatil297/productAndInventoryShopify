import type { CSSProperties } from "react";
import { JsonObjectField } from "@/components/merchant/JsonObjectField";
import { MetafieldEditorScripts } from "@/components/merchant/MetafieldEditorScripts";
import { NamedMetafieldWidget } from "@/components/merchant/MetafieldWidget";
import { PairListField } from "@/components/merchant/PairListField";
import type { MetafieldDefinitionNode } from "@/types/shopify";
import {
  decodeJsonProse,
  isJsonProseMetafieldType,
} from "@/lib/metafields/display";
import { resolveMetafieldEditor } from "@/lib/metafields/resolve-metafield-editor";
import { jsonObjectFieldsFromDefinition } from "@/lib/metafields/json-definition-schema";
import { jsonObjectFieldsForKey } from "@/lib/metafields/editor-hints";
import { resolveJsonDisplay } from "@/lib/metafields/structured-json";
import { StructuredMetafieldField } from "@/components/merchant/StructuredMetafieldField";
import { metafieldColumnKey } from "@/lib/metafields/types";
import {
  buildPdpCanvasPlan,
  heritageMfName,
  type PdpCanvasBlock,
} from "@/lib/products/pdp-canvas-plan";
import {
  DEFAULT_THEME_LOOK_COLORS,
  type ThemeProductLook,
} from "@/lib/products/theme-look";

interface HeritagePdpCanvasProps {
  values: {
    title: string;
    price: string;
    descriptionHtml: string;
    metafieldValues: Record<string, string>;
  };
  definitions: MetafieldDefinitionNode[];
  look?: ThemeProductLook | null;
}

function TitlePriceEditable({
  name,
  defaultValue,
  className,
  placeholder,
  style,
}: {
  name: string;
  defaultValue: string;
  className?: string;
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      <input type="hidden" name={name} defaultValue={defaultValue} />
      <div
        className={`mop-vis-edit rounded-sm outline-1 outline-transparent hover:outline-amber-700/40 focus:outline-amber-800/60 ${className ?? ""}`}
        style={style}
        contentEditable
        suppressContentEditableWarning
        data-visual-name={name}
        data-placeholder={placeholder ?? "Click to type…"}
      >
        {defaultValue}
      </div>
    </>
  );
}

function MetafieldPlainEditor({
  definition,
  rawValue,
  forceDisplay,
}: {
  definition: MetafieldDefinitionNode;
  rawValue: string;
  forceDisplay?: "json_kv" | "json_faq" | "json_object";
}) {
  const name = heritageMfName(definition);
  const typeName = definition.type.name;

  const editor = resolveMetafieldEditor(
    typeName,
    rawValue,
    definition.key,
    definition,
  );
  if (editor.kind !== "generic") {
    return <StructuredMetafieldField name={name} editor={editor} />;
  }

  if (forceDisplay === "json_kv" || forceDisplay === "json_faq") {
    return (
      <PairListField
        name={name}
        defaultValue={rawValue || "[]"}
        mode={forceDisplay === "json_faq" ? "faq" : "kv"}
      />
    );
  }

  if (forceDisplay === "json_object") {
    const hinted = resolveMetafieldEditor(
      "json",
      rawValue,
      definition.key,
      definition,
    );
    if (hinted.kind === "json_object") {
      return <StructuredMetafieldField name={name} editor={hinted} />;
    }
    const schemaFields = jsonObjectFieldsFromDefinition(definition);
    return (
      <JsonObjectField
        name={name}
        defaultValue={rawValue || "{}"}
        mode="object"
        fields={
          schemaFields.length > 0
            ? schemaFields
            : jsonObjectFieldsForKey(definition.key)
        }
      />
    );
  }

  if (isJsonProseMetafieldType(typeName)) {
    return (
      <NamedMetafieldWidget
        name={name}
        typeName={typeName}
        defaultValue={decodeJsonProse(rawValue)}
        allowEmptyBoolean
      />
    );
  }

  return (
    <NamedMetafieldWidget
      name={name}
      typeName={typeName}
      defaultValue={rawValue}
      allowEmptyBoolean
    />
  );
}

function MetafieldTable({
  rows,
  metafieldValues,
  colors,
  forceDisplayByKey,
}: {
  rows: Array<{ definition: MetafieldDefinitionNode; label: string }>;
  metafieldValues: Record<string, string>;
  colors: ThemeProductLook["colors"];
  forceDisplayByKey?: Record<string, "json_kv" | "json_faq" | "json_object">;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(({ definition, label }) => {
          const columnKey = metafieldColumnKey(
            definition.namespace,
            definition.key,
          );
          return (
            <tr
              key={definition.id}
              className="align-top"
              style={{ borderTop: `1px solid ${colors.border}` }}
            >
              <th
                className="w-[42%] py-2.5 pr-3 text-left text-xs font-normal"
                style={{ color: colors.muted }}
              >
                {label}
              </th>
              <td className="py-2.5">
                <MetafieldPlainEditor
                  definition={definition}
                  rawValue={metafieldValues[columnKey] ?? ""}
                  forceDisplay={forceDisplayByKey?.[columnKey]}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderSidebarBlock(
  block: PdpCanvasBlock,
  ctx: {
    values: HeritagePdpCanvasProps["values"];
    colors: ThemeProductLook["colors"];
    mf: Record<string, string>;
  },
  key: string,
) {
  const { values, colors, mf } = ctx;

  switch (block.kind) {
    case "title":
      return (
        <TitlePriceEditable
          key={key}
          name="title"
          defaultValue={values.title}
          placeholder="Product title"
          className="text-xl font-medium leading-snug tracking-tight md:text-2xl"
        />
      );
    case "price":
      return (
        <div key={key} className="flex flex-wrap items-baseline gap-2">
          <TitlePriceEditable
            name="price"
            defaultValue={values.price}
            placeholder="0.00"
            className="min-w-20 text-xl font-medium"
          />
        </div>
      );
    case "buy":
      return (
        <div
          key={key}
          className="w-full py-3 text-center text-sm tracking-wide"
          style={{
            backgroundColor: colors.buttonBg,
            color: colors.buttonText,
          }}
        >
          Add to cart
          <span className="mt-1 block text-[10px] font-normal tracking-normal opacity-70">
            Stock &amp; publish below this page
          </span>
        </div>
      );
    case "description":
      return (
        <details
          key={key}
          open
          className="border-t py-2"
          style={{ borderColor: colors.border }}
        >
          <summary className="cursor-pointer list-none py-2 text-sm font-medium">
            Description
          </summary>
          <div className="pb-3">
            <input
              type="hidden"
              name="descriptionHtml"
              defaultValue={values.descriptionHtml}
            />
            <div
              className="mop-vis-edit min-h-16 text-sm"
              contentEditable
              suppressContentEditableWarning
              data-visual-name="descriptionHtml"
              data-visual-html="1"
              dangerouslySetInnerHTML={{
                __html: values.descriptionHtml || "",
              }}
            />
          </div>
        </details>
      );
    case "details_group":
      return (
        <details
          key={key}
          open
          className="border-t py-2"
          style={{ borderColor: colors.border }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-medium">
            {block.label}
            <span style={{ color: colors.muted }}>−</span>
          </summary>
          <div className="pb-3">
            <MetafieldTable
              rows={block.rows}
              metafieldValues={mf}
              colors={colors}
            />
          </div>
        </details>
      );
    case "metafield": {
      const columnKey = metafieldColumnKey(
        block.definition.namespace,
        block.definition.key,
      );
      const raw = mf[columnKey] ?? "";
      const jsonDisplay = resolveJsonDisplay(
        raw,
        block.display === "json_kv" ||
          block.display === "json_faq" ||
          block.display === "json_object"
          ? block.display
          : null,
      );

      if (jsonDisplay === "json_kv" || jsonDisplay === "json_faq") {
        return (
          <details
            key={key}
            open={jsonDisplay === "json_kv"}
            className="border-t py-2"
            style={{ borderColor: colors.border }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-medium">
              {block.label}
              <span style={{ color: colors.muted }}>
                {jsonDisplay === "json_kv" ? "−" : "+"}
              </span>
            </summary>
            <div className="pb-3">
              <MetafieldPlainEditor
                definition={block.definition}
                rawValue={raw}
                forceDisplay={jsonDisplay}
              />
            </div>
          </details>
        );
      }

      if (jsonDisplay === "json_object") {
        return (
          <details
            key={key}
            className="border-t"
            style={{ borderColor: colors.border }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
              {block.label}
              <span style={{ color: colors.muted }}>+</span>
            </summary>
            <div className="pb-3">
              <MetafieldPlainEditor
                definition={block.definition}
                rawValue={raw}
                forceDisplay="json_object"
              />
            </div>
          </details>
        );
      }

      if (block.display === "table_row") {
        return (
          <div key={key} className="border-t pt-2" style={{ borderColor: colors.border }}>
            <MetafieldTable
              rows={[{ definition: block.definition, label: block.label }]}
              metafieldValues={mf}
              colors={colors}
            />
          </div>
        );
      }
      return (
        <details
          key={key}
          className="border-t"
          style={{ borderColor: colors.border }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
            {block.label}
            <span style={{ color: colors.muted }}>+</span>
          </summary>
          <div className="pb-3">
            <MetafieldPlainEditor
              definition={block.definition}
              rawValue={mf[columnKey] ?? ""}
            />
          </div>
        </details>
      );
    }
    default:
      return null;
  }
}

function renderBelowBlock(
  block: PdpCanvasBlock,
  ctx: {
    values: HeritagePdpCanvasProps["values"];
    colors: ThemeProductLook["colors"];
    mf: Record<string, string>;
  },
  key: string,
) {
  const { colors, mf } = ctx;

  if (block.kind === "description") {
    return renderSidebarBlock(block, ctx, key);
  }
  if (block.kind === "details_group") {
    return (
      <section
        key={key}
        className="border-b pb-6"
        style={{ borderColor: colors.border }}
      >
        <h3
          className="mb-4 text-center text-[11px] tracking-[0.2em]"
          style={{ color: colors.muted }}
        >
          {block.label.toUpperCase()}
        </h3>
        <MetafieldTable rows={block.rows} metafieldValues={mf} colors={colors} />
      </section>
    );
  }
  if (block.kind !== "metafield") {
    return null;
  }

  const columnKey = metafieldColumnKey(
    block.definition.namespace,
    block.definition.key,
  );
  const raw = mf[columnKey] ?? "";
  const jsonDisplay = resolveJsonDisplay(
    raw,
    block.display === "json_kv" ||
      block.display === "json_faq" ||
      block.display === "json_object"
      ? block.display
      : null,
  );

  if (jsonDisplay === "json_kv" || jsonDisplay === "json_faq") {
    return (
      <section
        key={key}
        className="border-b pb-6"
        style={{ borderColor: colors.border }}
      >
        <h3
          className="mb-4 text-center text-[11px] tracking-[0.2em]"
          style={{ color: colors.muted }}
        >
          {block.label.toUpperCase()}
        </h3>
        <MetafieldPlainEditor
          definition={block.definition}
          rawValue={raw}
          forceDisplay={jsonDisplay}
        />
      </section>
    );
  }

  if (jsonDisplay === "json_object") {
    return (
      <section
        key={key}
        className="border-b pb-6"
        style={{ borderColor: colors.border }}
      >
        <h3
          className="mb-4 text-center text-[11px] tracking-[0.2em]"
          style={{ color: colors.muted }}
        >
          {block.label.toUpperCase()}
        </h3>
        <MetafieldPlainEditor
          definition={block.definition}
          rawValue={raw}
          forceDisplay="json_object"
        />
      </section>
    );
  }

  if (block.display === "section") {
    return (
      <section
        key={key}
        className="border-b pb-6"
        style={{ borderColor: colors.border }}
      >
        <h3
          className="mb-4 text-center text-[11px] tracking-[0.2em]"
          style={{ color: colors.muted }}
        >
          {block.label.toUpperCase()}
        </h3>
        <MetafieldPlainEditor
          definition={block.definition}
          rawValue={raw}
        />
      </section>
    );
  }

  return (
    <details
      key={key}
      className="border-b"
      style={{ borderColor: colors.border }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
        {block.label}
        <span style={{ color: colors.muted }}>+</span>
      </summary>
      <div className="pb-3">
        <MetafieldPlainEditor
          definition={block.definition}
          rawValue={raw}
        />
      </div>
    </details>
  );
}

/**
 * Renders synced theme slot order — sidebar (beside image) then below-fold.
 */
export function HeritagePdpCanvas({
  values,
  definitions,
  look,
}: HeritagePdpCanvasProps) {
  const colors = look?.colors ?? DEFAULT_THEME_LOOK_COLORS;
  const mf = values.metafieldValues;
  const plan = buildPdpCanvasPlan(definitions, look, mf);
  const ctx = { values, colors, mf };

  const hasDescriptionInPlan =
    plan.sidebar.some((block) => block.kind === "description") ||
    plan.below.some((block) => block.kind === "description");

  return (
    <div
      className="overflow-hidden rounded-sm border shadow-sm"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        borderColor: colors.border,
      }}
    >
      <style>{`.mop-vis-edit:empty:before{content:attr(data-placeholder);color:${colors.muted};opacity:0.7}`}</style>

      <div className="grid gap-8 px-4 py-8 lg:grid-cols-2 lg:gap-10 lg:px-10">
        <div
          className="flex aspect-square items-center justify-center border border-dashed text-center text-sm"
          style={{ borderColor: colors.border, color: colors.muted }}
        >
          Product image
          <br />
          <span className="text-xs">(add under Stock &amp; publishing)</span>
        </div>

        <div className="space-y-1">
          {plan.sidebar.map((block, index) =>
            renderSidebarBlock(block, ctx, `sidebar-${index}`),
          )}
        </div>
      </div>

      {plan.below.length > 0 ? (
        <div
          className="space-y-4 border-t px-4 py-6 lg:px-10"
          style={{ borderColor: colors.border }}
        >
          {plan.below.map((block, index) =>
            renderBelowBlock(block, ctx, `below-${index}`),
          )}
        </div>
      ) : null}

      {!hasDescriptionInPlan ? (
        <input
          type="hidden"
          name="descriptionHtml"
          defaultValue={values.descriptionHtml}
        />
      ) : null}

      <MetafieldEditorScripts />
    </div>
  );
}

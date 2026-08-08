"use client";

import type { MetafieldDefinitionNode } from "@/types/shopify";
import { NamedMetafieldWidget } from "@/components/merchant/MetafieldWidget";
import { cellFieldName } from "@/lib/metafields/form-fields";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";

interface MetafieldFieldProps {
  index: number;
  definition: MetafieldDefinitionNode;
  ownerId: string;
  defaultValue: string;
}

export function MetafieldField({
  index,
  definition,
  ownerId,
  defaultValue,
}: MetafieldFieldProps) {
  const typeName = definition.type.name;
  const valueName = cellFieldName(index, "value");

  return (
    <>
      <input type="hidden" name={cellFieldName(index, "ownerId")} value={ownerId} />
      <input
        type="hidden"
        name={cellFieldName(index, "namespace")}
        value={definition.namespace}
      />
      <input type="hidden" name={cellFieldName(index, "key")} value={definition.key} />
      <input type="hidden" name={cellFieldName(index, "type")} value={typeName} />
      <input
        type="hidden"
        name={cellFieldName(index, "baseline")}
        value={defaultValue}
      />
      {isUnsupportedMetafieldType(typeName) ? (
        <input
          className="w-full min-w-[140px] cursor-not-allowed rounded-md border border-border bg-background px-2 py-1.5 text-sm opacity-60"
          value={defaultValue}
          readOnly
          tabIndex={-1}
          title="Read-only in this app"
        />
      ) : (
        <NamedMetafieldWidget
          name={valueName}
          typeName={typeName}
          defaultValue={defaultValue}
          definition={definition}
          dataMfInput
          dataBaseline={defaultValue}
        />
      )}
    </>
  );
}

"use client";

import type { MetafieldDefinitionNode } from "@/types/shopify";
import { MetafieldWidget } from "@/components/merchant/MetafieldWidget";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";

interface MetafieldCellProps {
  definition: MetafieldDefinitionNode;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function MetafieldCell({
  definition,
  value,
  error,
  disabled = false,
  onChange,
}: MetafieldCellProps) {
  const typeName = definition.type.name;

  return (
    <MetafieldWidget
      typeName={typeName}
      value={value}
      error={error}
      disabled={disabled || isUnsupportedMetafieldType(typeName)}
      onChange={onChange}
    />
  );
}

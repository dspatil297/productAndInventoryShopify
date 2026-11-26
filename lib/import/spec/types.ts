export type TransformId =
  | "identity"
  | "clean_text"
  | "skip_placeholder"
  | "slugify"
  | "html_paragraphs"
  | "lines_to_list"
  | "comma_to_list"
  | "kv_lines"
  | "impact_stats"
  | "impact_note"
  | "sale_from_list"
  | "faq_columns"
  | "story_maker_json"
  | "story_process_json"
  | "story_heritage_json"
  | "story_styling_json"
  | "dimensions_block"
  | "kv_column";

export type ParseHint =
  | "plain_text"
  | "paragraphs"
  | "lines"
  | "comma_list"
  | "kv_lines"
  | "impact_stats"
  | "faq_pipe"
  | "json_object"
  | "html_body";

export type ValueKind =
  | "string"
  | "text"
  | "string_list"
  | "json"
  | "file"
  | "integer"
  | "decimal"
  | "boolean";

export interface StoreMetafieldSchema {
  namespace: string;
  key: string;
  shopify_type: string;
  value_kind: ValueKind;
  parse_hint: ParseHint;
  name: string;
  required_for_storefront: boolean;
  in_theme: boolean;
  theme_files: string[];
  aliases: string[];
  liquid_hints?: string[];
  sample_values?: string[];
}

export interface StoreSchema {
  schema_version: number;
  shop: string;
  discovered_at: string;
  product_templates: string[];
  metafields: StoreMetafieldSchema[];
}

export interface ImportPolicy {
  frozen_fields: string[];
  sale_price_multiplier?: number;
  compare_at_from_list_price: boolean;
  default_vendor?: string;
  default_status: "ACTIVE" | "DRAFT";
  match_strategy: "handle" | "sku" | "title";
  create_missing: boolean;
  update_existing: boolean;
  placeholder_values: string[];
}

export interface ColumnMapping {
  target:
    | "title"
    | "body_html"
    | "handle"
    | "template_suffix"
    | "variant.price"
    | "variant.compare_at_price"
    | "variant.sku"
    | "tags"
    | "metafield"
    | "ignore";
  namespace?: string;
  key?: string;
  transform: TransformId;
  transform_params?: Record<string, unknown>;
  merge_strategy?: "replace" | "merge_kv" | "merge_text" | "skip_if_empty";
}

export interface ExtraColumnMapping extends ColumnMapping {
  source_column: string;
}

export interface MappingConfig {
  excel: {
    sheet_name?: string;
    header_row: number;
    category_column?: string;
  };
  column_map: Record<string, ColumnMapping>;
  extra_mappings?: ExtraColumnMapping[];
  handle_overrides: Record<string, string>;
  template_map: Record<string, string>;
  handle_strategy?: {
    primary: "slugify";
    source_column: string;
    overrides: Record<string, string>;
  };
  notes?: string[];
}

export interface ProductDraft {
  handle: string;
  action: "create" | "update" | "skip";
  productId?: string;
  variantId?: string | null;
  title?: string;
  body_html?: string;
  template_suffix?: string;
  tags?: string[];
  variants: Array<{
    sku?: string;
    price?: string;
    compare_at_price?: string;
  }>;
  metafields: Array<{
    namespace: string;
    key: string;
    type: string;
    value: unknown;
    merge_strategy?: "replace" | "merge_kv" | "merge_text" | "skip_if_empty";
  }>;
  warnings: string[];
  errors: string[];
}

export interface PreviewRowDiff {
  handle: string;
  action: "create" | "update" | "skip" | "error";
  title?: { old?: string; new?: string };
  price?: { old?: string; new?: string };
  template_suffix?: { old?: string; new?: string };
  metafieldChanges: number;
  metafieldDiffs?: Array<{ key: string; old?: string; new?: string }>;
  warnings: string[];
  errors: string[];
}

export interface ImportReport {
  session_id: string;
  started_at: string;
  completed_at?: string;
  summary: { created: number; updated: number; failed: number; skipped: number };
  handles: Array<{
    handle: string;
    status: "created" | "updated" | "failed" | "skipped";
    metafields_set?: number;
    errors: string[];
  }>;
  resume_from_handle?: string;
}

export interface StoreProfile {
  schema: StoreSchema;
  system_prompt: string;
  mapping_config: MappingConfig;
  import_policy: ImportPolicy;
  updated_at: string;
}

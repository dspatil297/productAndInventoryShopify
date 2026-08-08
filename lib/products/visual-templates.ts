export type VisualTemplateId = "heritage" | "classic";

export interface VisualTemplateMeta {
  id: VisualTemplateId;
  name: string;
  blurb: string;
}

export const VISUAL_TEMPLATES: VisualTemplateMeta[] = [
  {
    id: "heritage",
    name: "Heritage product page",
    blurb:
      "Matches live PDP — image, title, price, product details, accordions, craftsperson.",
  },
  {
    id: "classic",
    name: "Simple card",
    blurb: "Compact title / price / description card.",
  },
];

export function getVisualTemplate(
  id: string | null | undefined,
): VisualTemplateMeta | null {
  if (!id) {
    return null;
  }
  return VISUAL_TEMPLATES.find((template) => template.id === id) ?? null;
}

/** Product Details table rows (beside image) — match definition names. */
export const HERITAGE_DETAIL_LABEL_ORDER = [
  "sculpture type",
  "craft tradition",
  "material",
  "finish technique",
  "surface finish",
  "placement type",
  "weight",
  "usage",
  "indoor",
  "outdoor",
  "outfit type",
  "fabric",
  "work style",
  "craft technique",
  "design",
  "pattern",
  "fit",
  "occasion",
  "set includes",
  "color",
  "palette",
  "origin",
  "style inspiration",
];

/** Accordions under buy box on live PDP. */
export const HERITAGE_ACCORDION_LABELS = [
  "dimensions",
  "scale",
  "what's included",
  "whats included",
  "what’s included",
  "artisan impact",
  "care instructions",
  "care",
  "shipping",
  "returns",
  "measurements",
  "faq",
  "faqs",
  "frequently asked",
  "questions",
  "q&a",
  "q and a",
];

/** Full-width sections below the product grid. */
export const HERITAGE_BELOW_LABELS = [
  "craftsperson",
  "craftsman",
  "artisan story",
  "artisan name",
  "how it's made",
  "how its made",
  "how it is made",
  "making process",
  "styling story",
  "our promise",
  "promise",
];

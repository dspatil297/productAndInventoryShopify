import {
  sectionFilenamesFromTemplate,
  sectionKind,
  snippetFilenamesFromLiquids,
  type ThemePdpSlotColumn,
} from "@/lib/products/theme-look";

export interface OrderedSectionLiquid {
  filename: string;
  body: string;
  column: ThemePdpSlotColumn;
}

function isTemplateJson(templateBody: string | null): boolean {
  return Boolean(templateBody?.trim().startsWith("{"));
}

function parseTemplateSectionOrder(
  templateBody: string | null,
): Array<{ sectionKey: string; type: string; isMain: boolean }> {
  if (!isTemplateJson(templateBody)) {
    return [];
  }
  try {
    const data = JSON.parse(templateBody!) as {
      sections?: Record<string, { type?: string; disabled?: boolean }>;
      order?: string[];
    };
    if (!data.sections) {
      return [];
    }
    const order =
      Array.isArray(data.order) && data.order.length > 0
        ? data.order
        : Object.keys(data.sections);
    const sections: Array<{ sectionKey: string; type: string; isMain: boolean }> =
      [];
    for (const sectionKey of order) {
      const section = data.sections[sectionKey];
      if (!section?.type || section.disabled || section.type.includes("://")) {
        continue;
      }
      sections.push({
        sectionKey,
        type: section.type,
        isMain: sectionKind(section.type) === "product_main",
      });
    }
    return sections;
  } catch {
    return [];
  }
}

function ensureMainSection(
  sections: Array<{ sectionKey: string; type: string; isMain: boolean }>,
): void {
  if (sections.some((section) => section.isMain)) {
    return;
  }
  if (sections.length > 0) {
    sections[0].isMain = true;
  }
}

function pushSnippetTree(
  files: OrderedSectionLiquid[],
  seenFiles: Set<string>,
  sectionFilename: string,
  sectionBody: string,
  column: ThemePdpSlotColumn,
  liquidByFilename: Map<string, string>,
): void {
  const pushFile = (filename: string, fileColumn: ThemePdpSlotColumn) => {
    if (seenFiles.has(filename)) {
      return;
    }
    const body = liquidByFilename.get(filename);
    if (!body) {
      return;
    }
    seenFiles.add(filename);
    files.push({ filename, body, column: fileColumn });
  };

  const snippetQueue = [
    ...snippetFilenamesFromLiquids([{ filename: sectionFilename, body: sectionBody }]),
  ];
  while (snippetQueue.length > 0) {
    const snippetFilename = snippetQueue.shift();
    if (!snippetFilename || seenFiles.has(snippetFilename)) {
      continue;
    }
    const snippetBody = liquidByFilename.get(snippetFilename);
    if (!snippetBody) {
      continue;
    }
    pushFile(snippetFilename, column);
    for (const nested of snippetFilenamesFromLiquids([
      { filename: snippetFilename, body: snippetBody },
    ])) {
      if (!seenFiles.has(nested)) {
        snippetQueue.push(nested);
      }
    }
  }
}

/** Shared PDP section/snippet liquids when template JSON missing or empty. */
export function sharedPdpSectionLiquids(
  liquidByFilename: Map<string, string>,
  templateFilename?: string | null,
): OrderedSectionLiquid[] {
  const files: OrderedSectionLiquid[] = [];
  const seen = new Set<string>();

  const push = (filename: string, column: ThemePdpSlotColumn) => {
    if (seen.has(filename)) {
      return;
    }
    const body = liquidByFilename.get(filename);
    if (!body) {
      return;
    }
    seen.add(filename);
    files.push({ filename, body, column });
  };

  for (const filename of [
    "sections/main-product.liquid",
    "sections/product-information.liquid",
    "sections/product-details.liquid",
  ]) {
    push(filename, "info");
  }

  for (const [filename, body] of liquidByFilename.entries()) {
    if (!/^sections\/.+\.liquid$/i.test(filename)) {
      continue;
    }
    if (
      /product|jewell|jewelry|sculpture|ethnic|pdp|craft|maker|promise|detail|faq/i.test(
        filename,
      )
    ) {
      const column =
        /main-product|product-information|product-details/i.test(filename)
          ? "info"
          : "full";
      push(filename, column);
      pushSnippetTree(files, seen, filename, body, column, liquidByFilename);
    }
  }

  return files;
}

/**
 * Per-template section + snippet liquids in template section order.
 * Supports JSON templates (OS 2.0) and legacy liquid product templates.
 */
export function orderedSectionLiquidsForTemplate(
  templateBody: string | null,
  liquidByFilename: Map<string, string>,
  templateFilename?: string | null,
): OrderedSectionLiquid[] {
  const files: OrderedSectionLiquid[] = [];
  const seenFiles = new Set<string>();

  const pushFile = (filename: string, column: ThemePdpSlotColumn) => {
    if (seenFiles.has(filename)) {
      return;
    }
    const body = liquidByFilename.get(filename);
    if (!body) {
      return;
    }
    seenFiles.add(filename);
    files.push({ filename, body, column });
  };

  // Legacy liquid product template (templates/product.foo.liquid)
  if (templateBody && !isTemplateJson(templateBody)) {
    files.push({
      filename: templateFilename ?? "templates/product.liquid",
      body: templateBody,
      column: "info",
    });
    seenFiles.add(templateFilename ?? "templates/product.liquid");
    for (const shared of sharedPdpSectionLiquids(liquidByFilename, templateFilename)) {
      if (!seenFiles.has(shared.filename)) {
        seenFiles.add(shared.filename);
        files.push(shared);
      }
    }
    pushSnippetTree(
      files,
      seenFiles,
      templateFilename ?? "templates/product.liquid",
      templateBody,
      "info",
      liquidByFilename,
    );
    return files;
  }

  const sectionOrder = parseTemplateSectionOrder(templateBody);
  ensureMainSection(sectionOrder);

  for (const section of sectionOrder) {
    const column: ThemePdpSlotColumn = section.isMain ? "info" : "full";
    const sectionFilename = `sections/${section.type}.liquid`;
    pushFile(sectionFilename, column);

    const sectionBody = liquidByFilename.get(sectionFilename);
    if (!sectionBody) {
      continue;
    }
    pushSnippetTree(files, seenFiles, sectionFilename, sectionBody, column, liquidByFilename);
  }

  if (files.length === 0) {
    for (const filename of sectionFilenamesFromTemplate(templateBody)) {
      pushFile(filename, "info");
    }
  }

  if (files.length === 0) {
    return sharedPdpSectionLiquids(liquidByFilename, templateFilename);
  }

  return files;
}

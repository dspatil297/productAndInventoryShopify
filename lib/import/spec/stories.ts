import {
  cleanSpreadsheetText,
  isPlaceholderValue,
} from "@/lib/import/deterministic-row-clean";

function clean(text: string): string {
  return cleanSpreadsheetText(text);
}

function isPlaceholder(text: string): boolean {
  return isPlaceholderValue(text);
}

function paragraphs(text: string): string[] {
  const cleaned = clean(text);
  if (!cleaned || isPlaceholder(cleaned)) {
    return [];
  }
  return cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

function splitSentences(text: string): string[] {
  const cleaned = clean(text);
  if (!cleaned) {
    return [];
  }
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function dropEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function parseRoleName(firstLine: string): { role: string; name: string } {
  const match = firstLine.match(
    /^(The\s+(?:Artist|Weaver|Maker|Craftsperson))\s*[–\-:]\s*(.+)$/i,
  );
  if (match) {
    return { role: match[1].trim(), name: match[2].trim() };
  }
  return { role: "", name: firstLine };
}

function extractQuoteBlock(text: string): {
  body: string;
  quote: { text: string; cite: string } | null;
} {
  const patterns = [
    /[""]([^""]+)[""]\s*[-–—]\s*([\s\S]+?)\.?\s*$/,
    /"([^"]+)"\s*[-–—]\s*([\s\S]+?)\.?\s*$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const body = text.slice(0, match.index).trim().replace(/\.$/, "");
      let cite = clean(match[2]);
      if (cite && !cite.startsWith("—")) {
        cite = `— ${cite}`;
      }
      return { body, quote: { text: clean(match[1]), cite } };
    }
  }
  return { body: text, quote: null };
}

function parseInlineNumberedSteps(text: string): {
  intro: string;
  steps: Array<{ title: string; description: string }>;
} {
  const cleaned = clean(text);
  const marker = cleaned.match(/\s+1\.\s+/);
  if (!marker || marker.index === undefined) {
    return { intro: cleaned, steps: [] };
  }
  const intro = cleaned.slice(0, marker.index).trim();
  const tail = cleaned.slice(marker.index).trim();
  const steps: Array<{ title: string; description: string }> = [];
  for (const part of tail.split(/(?=\d+\.\s+)/)) {
    const stepMatch = part.trim().match(/^\d+\.\s+([\s\S]+)/);
    if (stepMatch) {
      const title = stepMatch[1].trim().replace(/\.$/, "");
      if (title) {
        steps.push({ title, description: "" });
      }
    }
  }
  return { intro, steps };
}

function splitProcessStepLines(text: string): string[] {
  const cleaned = clean(text);
  if (!cleaned) {
    return [];
  }
  const bulletParts = cleaned.split(/\s*[•·|]\s*/).map((part) => part.trim()).filter(Boolean);
  if (bulletParts.length > 1) {
    return bulletParts;
  }
  const newlineParts = cleaned
    .split(/\n+/)
    .map((line) => line.replace(/([a-z])([A-Z])/g, "$1\n$2").trim())
    .flatMap((line) => line.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);
  if (newlineParts.length > 1) {
    return newlineParts;
  }
  const numbered = parseInlineNumberedSteps(cleaned);
  if (numbered.steps.length > 0) {
    return numbered.steps.map((step) =>
      step.description ? `${step.title}. ${step.description}` : step.title,
    );
  }
  return [cleaned];
}

export function buildMakerStoryJson(text: string): Record<string, unknown> {
  const cleaned = clean(text);
  if (!cleaned || isPlaceholder(cleaned)) {
    return {};
  }

  const lines = cleaned.split("\n");
  const first = lines[0]?.trim() ?? "";
  const rest = lines.slice(1).join("\n").trim();
  const { role, name } = parseRoleName(first);
  const { body, quote } = extractQuoteBlock(rest || cleaned);

  let introParagraphs = paragraphs(body || rest);
  let closingParagraphs: string[] | undefined;
  if (!role && introParagraphs.length > 1) {
    closingParagraphs = introParagraphs.slice(-1);
    introParagraphs = introParagraphs.slice(0, -1);
  }

  return dropEmpty({
    eyebrow: role ? role.split(" ")[1]?.toLowerCase() === "artist" ? "The artist" : role : undefined,
    name: name || undefined,
    intro_paragraphs: introParagraphs.length > 0 ? introParagraphs : undefined,
    quote: quote ?? undefined,
    closing_paragraphs: closingParagraphs,
  });
}

export function buildProcessStoryJson(text: string): Record<string, unknown> {
  const cleaned = clean(text);
  if (!cleaned || isPlaceholder(cleaned)) {
    return {};
  }

  const lines = splitProcessStepLines(cleaned);
  const numbered = parseInlineNumberedSteps(cleaned);
  const steps = lines.map((line) => {
    const stripped = line.replace(/^\d+\.\s*/, "").trim();
    if (stripped.includes(". ") && stripped.length > 40) {
      const [title, ...rest] = stripped.split(". ");
      return { title: title.trim(), description: rest.join(". ").trim() };
    }
    return { title: stripped.replace(/\.$/, ""), description: "" };
  });

  const introSentences = splitSentences(numbered.intro || cleaned);
  return dropEmpty({
    eyebrow: "How it's made",
    heading_html: introSentences[0] ?? undefined,
    description: introSentences.slice(1).join(" ") || undefined,
    steps: steps.length > 0 ? steps : undefined,
  });
}

export function buildHeritageStoryJson(text: string): Record<string, unknown> {
  const cleaned = clean(text);
  if (!cleaned || isPlaceholder(cleaned)) {
    return {};
  }

  const parts = paragraphs(cleaned);
  const first = parts[0] ?? cleaned;
  const headingMatch = first.match(/^(.+?)[.!?]\s*$/);
  const heading = headingMatch ? headingMatch[1] : first;
  const bodyParagraphs = parts.length > 1 ? parts.slice(1) : splitSentences(cleaned);

  const sentences = splitSentences(cleaned);
  let fabricCards: Array<{ title: string; description: string }> | undefined;
  if (sentences.length >= 2) {
    fabricCards = [
      { title: "Fabric base", description: sentences[0] },
      {
        title: "Texture & motifs",
        description: sentences[1],
      },
      ...(sentences.length > 2
        ? [{ title: "Wear & occasion", description: sentences.slice(2).join(" ") }]
        : []),
    ];
  }

  return dropEmpty({
    heading_html: heading,
    paragraphs: bodyParagraphs.length > 0 ? bodyParagraphs : undefined,
    fabric_cards: fabricCards,
  });
}

export function buildStylingStoryJson(text: string): Record<string, unknown> {
  const cleaned = clean(text).replace(/^(Perfect for|Ideal for)\s+/i, "").replace(/\.$/, "");
  if (!cleaned || isPlaceholder(cleaned)) {
    return {};
  }
  const items = cleaned.split(/,\s*(?=[a-zA-Z])/).map((part) => part.trim()).filter(Boolean);
  const cards = items.slice(0, 8).map((item) => ({
    tag: "Styling",
    title: item.charAt(0).toUpperCase() + item.slice(1),
    description: `Works beautifully for ${item.toLowerCase()}.`,
  }));
  return dropEmpty({ cards });
}

#!/usr/bin/env python3
"""Build PDP story JSON metafields from Arthenic Excel prose columns."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import pandas as pd

from build_product_import import (
    PAINTING_SKU_HANDLE_OVERRIDES,
    ExportIndex,
    clean,
    is_placeholder,
    slugify,
)
from paths import (
    DATA_DIR,
    EXPORT_PATH,
    STORIES_JSON,
    STORIES_REPORT,
    ensure_output_dir,
)

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = STORIES_JSON
REPORT_PATH = STORIES_REPORT


def paragraphs(text: str) -> list[str]:
    text = clean(text)
    if not text or is_placeholder(text):
        return []
    return [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]


def first_line_and_rest(text: str) -> tuple[str, list[str]]:
    text = clean(text)
    if not text:
        return "", []
    lines = text.split("\n", 1)
    first = lines[0].strip()
    rest = lines[1].strip() if len(lines) > 1 else ""
    return first, paragraphs(rest) if rest else []


def parse_role_name(first_line: str) -> tuple[str, str]:
    """e.g. 'The Artist – Neeraj Bhanawat' -> role, name."""
    first_line = clean(first_line)
    m = re.match(
        r"^(The\s+(?:Artist|Weaver|Maker|Craftsperson))\s*[–\-:]\s*(.+)$",
        first_line,
        re.I,
    )
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return "", first_line


def split_sentences(text: str) -> list[str]:
    text = clean(text)
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def heading_with_break(sentence: str, fallback_second: str = "") -> str:
    sentence = clean(sentence).rstrip(".")
    if not sentence:
        return fallback_second
    words = sentence.split()
    if len(words) <= 5:
        second = fallback_second or "crafted with care"
        return f"{sentence},<br>{second}"
    mid = len(words) // 2
    return f"{' '.join(words[:mid])}<br>{' '.join(words[mid:])}"


def split_meta_parts(line: str) -> list[str]:
    parts = [p.strip().rstrip(".") for p in re.split(r"[·•\u2022|]", line) if p.strip()]
    return parts


def extract_quote_block(text: str) -> tuple[str, dict | None]:
    """Pull a trailing quote sentence + cite from prose."""
    text = clean(text)
    patterns = [
        r'[""\u201c]([^""\u201d]+)[""\u201d]\s*[-–—]\s*(.+?)\.?\s*$',
        r'"([^"]+)"\s*[-–—]\s*(.+?)\.?\s*$',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.S)
        if m:
            body = text[: m.start()].strip().rstrip(".")
            cite = clean(m.group(2))
            if cite and not cite.startswith("-"):
                cite = f"— {cite}"
            return body, {"text": clean(m.group(1)), "cite": cite}

    cite_match = re.search(
        r"\s+[-–—]\s+([A-Z][^,.]+(?:,\s*(?:Founder|founder)[^,.]*)?(?:,\s*ARTHENIC)?)\.?\s*$",
        text,
    )
    if cite_match:
        before = text[: cite_match.start()].strip().rstrip(".")
        sentences = split_sentences(before)
        if sentences:
            quote_text = sentences[-1].strip('""\u201c\u201d ')
            body = " ".join(sentences[:-1]).strip()
            cite = f"— {cite_match.group(1).strip()}"
            if quote_text:
                return body, {"text": quote_text, "cite": cite}
    return text, None


def parse_inline_numbered_steps(text: str) -> tuple[str, list[dict[str, str]]]:
    """Split 'intro prose 1. Step one. 2. Step two.' into intro + steps."""
    text = clean(text)
    if not text:
        return "", []
    m = re.search(r"\s+1\.\s+", text)
    if not m:
        return text, parse_multiline_numbered_steps(text)
    intro = text[: m.start()].strip()
    tail = text[m.start() :].strip()
    steps: list[dict[str, str]] = []
    for part in re.split(r"\s*(?=\d+\.\s+)", tail):
        part = part.strip()
        sm = re.match(r"\d+\.\s+(.+?)(?:\.\s*$|\.$)", part, re.S)
        if not sm:
            sm = re.match(r"\d+\.\s+(.+)", part, re.S)
        if sm:
            title = sm.group(1).strip().rstrip(".")
            if title:
                steps.append({"title": title, "description": ""})
    return intro, steps


def parse_multiline_numbered_steps(text: str) -> list[dict[str, str]]:
    text = clean(text)
    if not text:
        return []
    steps: list[dict[str, str]] = []
    for m in re.finditer(
        r"(?:^|\n)\s*(\d+)\.\s*([^\n]+)(?:\n([^\n]+(?:\n(?!\s*\d+\.)[^\n]+)*))?",
        text,
        re.M,
    ):
        title = m.group(2).strip().rstrip(".")
        desc = clean(m.group(3) or "")
        if title:
            steps.append({"title": title, "description": desc})
    return steps


def group_sentences(sentences: list[str], chunk_size: int) -> list[str]:
    if not sentences:
        return []
    grouped: list[str] = []
    for i in range(0, len(sentences), chunk_size):
        grouped.append(" ".join(sentences[i : i + chunk_size]))
    return grouped


def fabric_text_to_cards(text: str) -> list[dict[str, str]]:
    sentences = split_sentences(text)
    if not sentences:
        return []
    titles = ("Fabric base", "Texture & motifs", "Wear & occasion")
    cards: list[dict[str, str]] = []
    if len(sentences) == 1:
        return [{"title": "The fabric", "description": sentences[0]}]
    if len(sentences) == 2:
        return [
            {"title": titles[0], "description": sentences[0]},
            {"title": titles[1], "description": sentences[1]},
        ]
    cards.append({"title": titles[0], "description": sentences[0]})
    cards.append({"title": titles[1], "description": sentences[1]})
    cards.append({"title": titles[2], "description": " ".join(sentences[2:])})
    return cards


def split_meta_footer(text: str) -> tuple[str, list[str]]:
    """Decor maker footer: '...craftsmanship. 8+ yrs ... • Jodhpur, India.'"""
    text = clean(text)
    inline = re.search(r"\.\s+(\d+\+?\s*yrs?.+)$", text, re.I | re.S)
    if inline:
        body = text[: inline.start()].strip()
        meta = split_meta_parts(inline.group(1))
        return body, meta

    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if lines:
        last = lines[-1]
        if re.search(r"\d+\+?\s*yrs?", last, re.I) and re.search(
            r"[·•\u2022|]", last
        ):
            body = "\n".join(lines[:-1]).strip()
            meta = split_meta_parts(last)
            return body, meta
    return text, []


def parse_decor_stats(meta_parts: list[str]) -> list[dict[str, str]]:
    stats: list[dict[str, str]] = []
    for part in meta_parts:
        ym = re.match(r"(\d+\+?\s*yrs?)\s+(.+)", part, re.I)
        if ym:
            stats.append({"value": ym.group(1).strip(), "label": ym.group(2).strip()})
    return stats


def extract_person_name(text: str) -> str:
    for pattern in (
        r"\b([A-Z][a-z]+)\s+grew up\b",
        r"\bFor\s+([A-Z][a-z]+),",
        r"curated by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"led by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*Founder\s*&\s*Curator",
        r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*founder of ARTHENIC",
    ):
        m = re.search(pattern, text)
        if m:
            return m.group(1).strip()
    return ""


BULLET_SEP_RE = re.compile(r"\s*[\u2022\u00b7\u2023\u2043|]\s*")


def split_decor_process_lines(text: str) -> list[str]:
    """Split decor process prose into step lines (newlines + merged-word fixes)."""
    lines: list[str] = []
    for raw in text.split("\n"):
        line = clean(raw)
        if not line:
            continue
        line = re.sub(r"([a-z])([A-Z])", r"\1\n\2", line)
        line = re.sub(r"(box)([A-Z])", r"\1\n\2", line, flags=re.I)
        for piece in line.split("\n"):
            piece = piece.strip()
            if piece:
                lines.append(piece)
    return lines


def split_bullet_separated_steps(text: str) -> list[str]:
    """Decor Excel often uses •-separated steps on one line."""
    text = clean(text).lstrip("\u2022\u00b7\u2023\u2043| ").strip()
    if not text:
        return []
    parts = [p.strip() for p in BULLET_SEP_RE.split(text) if p.strip()]
    return parts if len(parts) > 1 else []


def line_to_process_step(line: str) -> dict[str, str] | None:
    line = line.lstrip("•-*\u2022\u00b7\u2023\u2043| ").strip()
    line = re.sub(r"^\d+\.\s*", "", line).strip()
    if not line:
        return None
    if ". " in line:
        title, _, rest = line.partition(". ")
        if len(rest) > 20:
            return {"title": title.strip().rstrip("."), "description": rest.strip()}
    return {"title": line.rstrip("."), "description": ""}


def process_lines_to_steps(lines: list[str]) -> list[dict[str, str]]:
    steps: list[dict[str, str]] = []
    for line in lines:
        step = line_to_process_step(line)
        if step:
            steps.append(step)
    return steps


def split_process_step_lines(text: str) -> list[str]:
    """Resolve process prose into individual step strings."""
    text = clean(text)
    if not text:
        return []

    bullet_lines = split_bullet_separated_steps(text)
    if bullet_lines:
        return bullet_lines

    newline_lines = split_decor_process_lines(text)
    if len(newline_lines) > 1:
        return newline_lines

    _, numbered = parse_inline_numbered_steps(text)
    if numbered:
        return [
            (f"{s['title']}. {s['description']}".strip(". ") if s["description"] else s["title"])
            for s in numbered
        ]

    if newline_lines:
        return newline_lines
    return [text]


def comma_phrases_to_styling_cards(text: str) -> list[dict[str, str]]:
    text = clean(text).rstrip(".")
    if not text:
        return []
    # Drop leading "Perfect for" / "Ideal for"
    text = re.sub(r"^(Perfect for|Ideal for)\s+", "", text, flags=re.I)
    items = [p.strip() for p in re.split(r",\s*(?=[a-zA-Z])", text) if p.strip()]
    cards: list[dict[str, str]] = []
    for item in items[:8]:
        title = item[0].upper() + item[1:] if item else item
        cards.append(
            {
                "tag": "Styling",
                "title": title,
                "description": f"Works beautifully for {item.lower()}.",
            }
        )
    return cards


def drop_empty(obj: dict) -> dict:
    return {k: v for k, v in obj.items() if v not in (None, "", [], {})}


def painting_stories(row: pd.Series) -> dict[str, dict]:
    out: dict[str, dict] = {}
    artist = clean(row.get("Artist", ""))
    if artist and not is_placeholder(artist):
        first, body = first_line_and_rest(artist)
        _, name = parse_role_name(first)
        maker = drop_empty(
            {
                "eyebrow": "The artist",
                "name": name or None,
                "intro_paragraphs": body[:2] or None,
                "closing_paragraphs": body[2:] or None,
            }
        )
        if maker:
            out["product_maker_story"] = maker

    how_heading = clean(row.get("How It's Made - Heading", ""))
    step_cols = [
        ("Canvas preparation", "Canvas Preparation Process"),
        ("Detailing & brushwork", "Detailing & Brushwork"),
        ("Color layering & finishing", "Color Layering & Finishing"),
    ]
    steps = []
    for title, col in step_cols:
        desc = clean(row.get(col, ""))
        if desc and not is_placeholder(desc):
            steps.append({"title": title, "description": desc})
    if how_heading or steps:
        heading, intro = first_line_and_rest(how_heading)
        process = drop_empty(
            {
                "eyebrow": "How it's made",
                "heading_html": heading or None,
                "description": "\n\n".join(intro) if intro else None,
                "steps": steps or None,
            }
        )
        if process:
            out["product_process_story"] = process

    heritage_text = clean(row.get("Understanding the Painting - Heading", ""))
    if heritage_text and not is_placeholder(heritage_text):
        heading, rest = first_line_and_rest(heritage_text)
        notes = clean(row.get("Application View Notes", ""))
        all_paras = rest + ([notes] if notes and not is_placeholder(notes) else [])
        heritage = drop_empty(
            {
                "eyebrow": "The story in the subject",
                "heading_html": heading or None,
                "paragraphs": all_paras or None,
            }
        )
        if heritage:
            out["product_heritage_story"] = heritage
    return out


def ethnic_maker_story(text: str) -> dict | None:
    """Parse ARTHENIC ethnic 'The Weaver' curator prose into theme JSON."""
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    body, quote = extract_quote_block(text)
    sentences = split_sentences(body)
    if not sentences:
        return None

    tagline = sentences[0]
    rest = sentences[1:]
    name = extract_person_name(body)
    role = "Founder, ARTHENIC" if name and "ARTHENIC" in body.upper() else ""

    if quote:
        intro = group_sentences(rest, 2)
        closing = None
    else:
        intro = group_sentences(rest[:-1], 2) if len(rest) > 1 else []
        closing = [rest[-1]] if rest else None

    maker = drop_empty(
        {
            "eyebrow": "The weaver",
            "heading_html": heading_with_break(
                tagline.rstrip("!"), "curated with intention"
            ),
            "name": name or None,
            "role": role or None,
            "intro_paragraphs": intro or None,
            "quote": quote,
            "closing_paragraphs": closing,
            "meta": [
                "Rajasthan artisans & tailors",
                "Bandhani-inspired ethnic wear",
                "ARTHENIC founder-led collection",
            ],
        }
    )
    return maker or None


def ethnic_process_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    intro, steps = parse_inline_numbered_steps(text)
    intro_sentences = split_sentences(intro)
    heading = intro_sentences[0] if intro_sentences else "From fabric to finished silhouette"
    description = " ".join(intro_sentences[1:]) if len(intro_sentences) > 1 else ""

    if not steps:
        steps = parse_multiline_numbered_steps(text)
    if not steps:
        lines = split_bullet_separated_steps(text)
        if lines:
            steps = process_lines_to_steps(lines)

    process = drop_empty(
        {
            "eyebrow": "How it's made",
            "heading_html": heading_with_break(heading.rstrip(".")),
            "description": description or None,
            "steps": steps or None,
        }
    )
    return process or None


def ethnic_heritage_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    cards = fabric_text_to_cards(text)
    fabric_match = re.search(
        r"(?:pure|crafted from)\s+([^,]+)", text, re.I
    )
    fabric_name = fabric_match.group(1).strip() if fabric_match else "this fabric"
    heritage = drop_empty(
        {
            "eyebrow": "The fabric",
            "heading_html": heading_with_break(
                f"What makes {fabric_name} special", "texture, drape & motif"
            ),
            "fabric_cards": cards,
        }
    )
    return heritage or None


def ethnic_stories(row: pd.Series) -> dict[str, dict]:
    out: dict[str, dict] = {}

    maker = ethnic_maker_story(row.get("The Weaver", ""))
    if maker:
        out["product_maker_story"] = maker

    process = ethnic_process_story(row.get("The Making", ""))
    if process:
        out["product_process_story"] = process

    heritage = ethnic_heritage_story(row.get("THE FABRIC", ""))
    if heritage:
        out["product_heritage_story"] = heritage

    return out


def extract_jewel_curation_parts(text: str) -> tuple[str, dict | None, list[str]]:
    """Split curator prose into body, quote, and optional closing paragraph."""
    text = clean(text)
    m = re.search(
        r'[""\u201c]([^""\u201d]+)[""\u201d]\s*[-–—]\s*'
        r"([A-Z][^.]*?\bARTHENIC)\.?\s*(.+)?$",
        text,
        re.S,
    )
    if not m:
        return text, None, []

    body = text[: m.start()].strip().rstrip(".")
    quote = {"text": clean(m.group(1)), "cite": f"— {clean(m.group(2))}"}
    closing = [clean(m.group(3))] if m.group(3) and clean(m.group(3)) else []
    return body, quote, closing


def jewel_maker_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    body, quote, closing = extract_jewel_curation_parts(text)
    sentences = split_sentences(body)
    if not sentences:
        return None

    tagline = sentences[0].rstrip(".! ")
    rest = sentences[1:]
    name = extract_person_name(text)
    role = ""
    if re.search(r"Founder\s*&\s*Curator", text, re.I):
        role = "Founder & Curator, ARTHENIC"
    elif name and "ARTHENIC" in text.upper():
        role = "Founder, ARTHENIC"

    if "," in tagline:
        lead, tail = tagline.split(",", 1)
        heading_html = f"{lead.strip()},<br>{tail.strip()}"
    else:
        heading_html = heading_with_break(tagline, "curated with intention")

    intro = group_sentences(rest, 2) if rest else None
    maker = drop_empty(
        {
            "eyebrow": "The maker",
            "heading_html": heading_html,
            "name": name or None,
            "role": role or None,
            "intro_paragraphs": intro,
            "quote": quote,
            "closing_paragraphs": closing or None,
            "meta": [
                "Curated festive jewellery",
                "ARTHENIC founder-led collection",
            ],
        }
    )
    return maker or None


def jewel_heritage_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    sentences = split_sentences(text)
    if not sentences:
        return None

    heritage = drop_empty(
        {
            "eyebrow": "The tradition",
            "heading_html": heading_with_break(
                sentences[0].rstrip("."), "of Indian adornment"
            ),
            "paragraphs": sentences,
        }
    )
    return heritage or None


def jewel_stories(row: pd.Series) -> dict[str, dict]:
    out: dict[str, dict] = {}

    maker = jewel_maker_story(row.get("The Curation Story", ""))
    if maker:
        out["product_maker_story"] = maker

    heritage = jewel_heritage_story(row.get("The Tradition", ""))
    if heritage:
        out["product_heritage_story"] = heritage
    return out


def decor_maker_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    body, meta_parts = split_meta_footer(text)
    stats = parse_decor_stats(meta_parts)
    meta = [p for p in meta_parts if not re.search(r"\d+\+?\s*yrs?", p, re.I)]

    sentences = split_sentences(body)
    first = sentences[0] if sentences else body
    body_paras = group_sentences(sentences[1:], 2) if len(sentences) > 1 else []

    name = extract_person_name(body)
    role = ""
    if name and "Jodhpur" in body:
        role = "Hand-painted craft · Jodhpur, Rajasthan"

    maker = drop_empty(
        {
            "eyebrow": "The craftsperson",
            "heading_html": heading_with_break(
                first.rstrip("."), "the warmth of handmade craft"
            ),
            "name": name or None,
            "role": role or None,
            "intro_paragraphs": body_paras or None,
            "stats": stats or None,
            "meta": meta or None,
        }
    )
    return maker or None


def decor_process_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    lines = split_process_step_lines(text)
    steps = process_lines_to_steps(lines)
    process = drop_empty(
        {
            "eyebrow": "How it's made",
            "heading_html": heading_with_break(
                "From raw material to finished piece", "step by step"
            ),
            "steps": steps or None,
        }
    )
    return process or None


def decor_heritage_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    sentences = split_sentences(text)
    heading = sentences[0] if sentences else text
    rest = sentences[1:] if len(sentences) > 1 else []

    heritage = drop_empty(
        {
            "eyebrow": "The artistry",
            "heading_html": heading_with_break(
                heading.rstrip("."), "behind every detail"
            ),
            "paragraphs": rest or [text],
        }
    )
    return heritage or None


def decor_styling_story(text: str) -> dict | None:
    text = clean(text)
    if not text or is_placeholder(text):
        return None

    cards = comma_phrases_to_styling_cards(text)
    styling = drop_empty(
        {
            "eyebrow": "How to style this piece",
            "heading_html": heading_with_break(
                "Places & occasions", "for this piece"
            ),
            "cards": cards or None,
        }
    )
    return styling or None


def decor_stories(row: pd.Series) -> dict[str, dict]:
    out: dict[str, dict] = {}

    maker = decor_maker_story(row.get("The Maker", ""))
    if maker:
        out["product_maker_story"] = maker

    process = decor_process_story(row.get("How its Made", ""))
    if process:
        out["product_process_story"] = process

    heritage = decor_heritage_story(row.get("Artistry Behind", ""))
    if heritage:
        out["product_heritage_story"] = heritage

    styling = decor_styling_story(row.get("Application and Styling", ""))
    if styling:
        out["pdp_styling_story"] = styling

    return out


def load_story_payload(index: ExportIndex) -> tuple[dict[str, dict[str, dict]], list[str], list[str]]:
    payload: dict[str, dict[str, dict]] = {}
    report: list[str] = []
    errors: list[str] = []
    existing = set(index.primary)

    paintings = pd.read_excel(
        DATA_DIR / "Arthenic_Paintings_Data.xlsx", sheet_name="Arthenic Product Data"
    )
    for _, row in paintings.iterrows():
        sku = clean(row["SKU CODE"]).upper()
        title = clean(row["Painting Title"])
        handle = index.sku_to_handle.get(sku) or PAINTING_SKU_HANDLE_OVERRIDES.get(sku)
        if not handle:
            slug = slugify(title)
            if slug in index.primary:
                handle = slug
        if not handle or handle not in existing:
            errors.append(f"SKIP paintings: {sku} ({title})")
            continue
        stories = painting_stories(row)
        if stories:
            payload[handle] = stories
            report.append(f"OK paintings: {handle} ({len(stories)} story keys)")

    ethnic = pd.read_excel(DATA_DIR / "Arthenic_Ethnic_Data.xlsx")
    for _, row in ethnic.iterrows():
        name = clean(row["Product Name"])
        color = clean(row.get("Color", ""))
        handle = index.resolve_ethnic(name, color)
        if not handle or handle not in existing:
            errors.append(f"SKIP ethnic: {name}")
            continue
        stories = ethnic_stories(row)
        if stories:
            payload[handle] = stories
            report.append(f"OK ethnic: {handle} ({len(stories)} story keys)")

    jewel = pd.read_excel(DATA_DIR / "Arthenic_Jewel_Data.xlsx")
    for _, row in jewel.iterrows():
        name = clean(row["Product Name"])
        handle = index.title_to_handle.get(name.lower())
        if not handle or handle not in existing:
            errors.append(f"SKIP jewellery: {name}")
            continue
        stories = jewel_stories(row)
        if stories:
            payload[handle] = stories
            report.append(f"OK jewellery: {handle} ({len(stories)} story keys)")

    decor = pd.read_excel(DATA_DIR / "Arthenic_Decor_Data.xlsx")
    for _, row in decor.iterrows():
        name = clean(row["Product Name"])
        handle = index.resolve_decor(name)
        if not handle:
            errors.append(f"SKIP decor: {name}")
            continue
        stories = decor_stories(row)
        if stories:
            payload[handle] = stories
            tag = "NEW" if handle not in existing else "OK"
            report.append(f"{tag} decor: {handle} ({len(stories)} story keys)")

    return payload, report, errors


def main() -> int:
    ensure_output_dir()
    if not EXPORT_PATH.exists():
        print(f"Missing export: {EXPORT_PATH}", file=sys.stderr)
        return 1
    with EXPORT_PATH.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    index = ExportIndex(rows)
    payload, report, errors = load_story_payload(index)
    OUTPUT_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    lines = report + errors
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} ({len(payload)} products with story JSON)")
    if errors:
        print(f"Warnings/errors: {len(errors)} — see {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

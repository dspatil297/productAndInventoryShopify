#!/usr/bin/env python3
"""Merge Excel product data into Shopify bulk-import CSV format.

Driven by store.json in the data directory.
"""

from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import pandas as pd

from paths import (
    EXPORT_PATH,
    OUTPUT_DIR,
    IMPORT_CSV,
    IMPORT_REPORT,
    NEW_PRODUCTS_CSV,
    SAMPLE_PATH,
    UPLOAD_HANDLES_FILE,
    ensure_output_dir,
    get_data_dir,
)
from store_config import StoreConfig, load_store_config

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = IMPORT_CSV
REPORT_PATH = IMPORT_REPORT
NEW_PRODUCTS_PATH = NEW_PRODUCTS_CSV

COMMON_SKIP = {"common", "nan", "none", "as per the pictures", "same questions as mentioned in word"}

SALE_MULTIPLIER = Decimal("0.95")

# Store-specific values (overridden at runtime from store.json via _config)
_config: StoreConfig | None = None


def _get_config() -> StoreConfig:
    if _config is None:
        raise RuntimeError("build_product_import: call set_store_config() before use")
    return _config


def set_store_config(config: StoreConfig) -> None:
    global _config, DATA_DIR, CATEGORY_BY_TEMPLATE, FROZEN_FIELDS
    _config = config
    DATA_DIR = config.data_dir
    CATEGORY_BY_TEMPLATE = config.category_by_template
    FROZEN_FIELDS = config.frozen_fields


# Defaults (used when running standalone with store.json present)
DATA_DIR = ROOT / "ProductData"
CATEGORY_BY_TEMPLATE: dict[str, str] = {}

# Never overwrite from Excel — keep existing Shopify export values (especially images).
FROZEN_FIELDS = frozenset(
    {
        "Image Src",
        "Image Position",
        "Image Alt Text",
        "Variant Image",
        "Variant SKU",
        "Variant Grams",
        "Variant Inventory Tracker",
        "Variant Inventory Qty",
        "Variant Inventory Policy",
        "Variant Fulfillment Service",
        "Variant Barcode",
        "Variant Requires Shipping",
        "Variant Taxable",
        "Variant Weight Unit",
        "Variant Tax Code",
        "Cost per item",
        "Product Category",
        "Published",
        "Vendor",
        "Gift Card",
        "Status",
        "Option1 Name",
        "Option1 Value",
        "Option2 Name",
        "Option2 Value",
        "Option3 Name",
        "Option3 Value",
        "SEO Title",
        "SEO Description",
    }
)

KV_METAFIELD_SUFFIXES = (
    "product_details)",
    "product_measurements)",
)


FILTER_METAFIELD_COLUMNS = (
    "filter_color (product.metafields.custom.filter_color)",
    "filter_fabric (product.metafields.custom.filter_fabric)",
    "filter_material (product.metafields.custom.filter_material)",
    "filter_subject (product.metafields.custom.filter_subject)",
    "filter_region (product.metafields.custom.filter_region)",
    "filter_style (product.metafields.custom.filter_style)",
    "filter_tradition (product.metafields.custom.filter_tradition)",
    "filter_occasion (product.metafields.custom.filter_occasion)",
    "filter_product_type (product.metafields.custom.filter_product_type)",
    "filter_jewelry_type (product.metafields.custom.filter_jewelry_type)",
)


def clean(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    text = str(val).strip()
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = unicodedata.normalize("NFKC", text)
    text = (
        text.replace("\ufffd", "")
        .replace("", "")
        .replace("–", "-")
        .replace("—", "-")
        .replace("'", "'")
        .replace("'", "'")
        .replace(""", '"')
        .replace(""", '"')
    )
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def is_placeholder(val: str) -> bool:
    return clean(val).lower() in COMMON_SKIP


def filter_value(val) -> str:
    text = clean(val)
    if not text or is_placeholder(text):
        return ""
    return text


def filter_list_value(val) -> str:
    text = filter_value(val)
    if not text:
        return ""
    parts: list[str] = []
    for chunk in re.split(r"[,;\n]", text):
        item = chunk.strip()
        if item and item not in parts:
            parts.append(item)
    return "\n".join(parts)


def format_price(amount: Decimal) -> str:
    rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if rounded == rounded.to_integral_value():
        return str(int(rounded))
    return f"{rounded:.2f}"


def sale_prices_from_list(list_price_raw) -> tuple[str, str]:
    text = clean(list_price_raw)
    if not text or is_placeholder(text):
        return "", ""
    list_price = Decimal(str(list_price_raw).replace(",", "").strip())
    if list_price <= 0:
        return "", ""
    sale_price = list_price * SALE_MULTIPLIER
    return format_price(sale_price), format_price(list_price)


def merge_category_tag(existing: str, category: str) -> str:
    if not category:
        return existing
    tags = [t.strip() for t in existing.split(",") if t.strip()]
    if category not in tags:
        tags.insert(0, category)
    return ", ".join(tags)


def category_fields(template: str) -> dict[str, str]:
    category = CATEGORY_BY_TEMPLATE.get(template, "")
    if not category:
        return {}
    return {
        "_category": category,
        "Type": category,
        "Tags": category,
    }


def apply_sale_pricing_row(row: dict[str, str]) -> bool:
    sale, compare = sale_prices_from_list(row.get("Variant Price", ""))
    if not sale:
        return False
    changed = row.get("Variant Price") != sale or row.get("Variant Compare At Price") != compare
    row["Variant Price"] = sale
    row["Variant Compare At Price"] = compare
    return changed



def validate_excel_prices(
    updates: dict[str, dict[str, str]],
    merged_rows: list[dict[str, str]],
    index: "ExportIndex",
    new_product_rows: list[dict[str, str]],
) -> list[str]:
    """Verify sale/compare prices in output match Excel list price (5% off)."""
    issues: list[str] = []
    row_by_handle: dict[str, dict[str, str]] = {}
    for row in merged_rows:
        handle = clean(row.get("Handle", ""))
        title = clean(row.get("Title", ""))
        if handle and title:
            row_by_handle[handle] = row
    for row in new_product_rows:
        handle = clean(row.get("Handle", ""))
        if handle:
            row_by_handle[handle] = row

    for handle, update in sorted(updates.items()):
        excel_list = ""
        for key in ("Variant Price",):
            raw = update.get(key, "")
            if raw and not str(raw).startswith("_"):
                excel_list = str(raw)
                break
        if not excel_list:
            issues.append(f"{handle}: no Excel list price in update")
            continue
        expected_sale, expected_compare = sale_prices_from_list(excel_list)
        out = row_by_handle.get(handle)
        if not out:
            issues.append(f"{handle}: missing from output CSV")
            continue
        got_sale = clean(out.get("Variant Price", ""))
        got_compare = clean(out.get("Variant Compare At Price", ""))
        if got_sale != expected_sale or got_compare != expected_compare:
            issues.append(
                f"{handle}: expected sale {expected_sale} / compare {expected_compare}, "
                f"got {got_sale} / {got_compare}"
            )
    return issues


def apply_catalog_fields(
    row: dict[str, str], handle: str, updates: dict[str, dict[str, str]]
) -> list[str]:
    changes: list[str] = []
    if apply_sale_pricing_row(row):
        changes.extend(["Variant Price", "Variant Compare At Price"])
    category = clean((updates.get(handle) or {}).get("_category", ""))
    if not category:
        return changes
    if row.get("Type") != category:
        row["Type"] = category
        changes.append("Type")
    merged_tags = merge_category_tag(row.get("Tags", ""), category)
    if merged_tags != row.get("Tags", ""):
        row["Tags"] = merged_tags
        changes.append("Tags")
    return changes


def filter_fields(**values: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for column_suffix, raw in values.items():
        if not raw:
            continue
        column = f"{column_suffix} (product.metafields.custom.{column_suffix})"
        out[column] = raw
    return out


def slugify(text: str) -> str:
    text = clean(text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def join_lines(*parts: str, sep: str = "\n") -> str:
    lines = []
    for part in parts:
        part = clean(part)
        if part and not is_placeholder(part):
            lines.append(part)
    return sep.join(lines)


def split_lines(text: str) -> list[str]:
    text = clean(text)
    if not text:
        return []
    chunks = re.split(r"[\n•]+", text)
    out = []
    for chunk in chunks:
        chunk = re.sub(r"^\s*[-–—]\s*", "", chunk.strip())
        if chunk and not is_placeholder(chunk):
            out.append(chunk)
    return out


def kv_lines(pairs: list[tuple[str, str]]) -> str:
    rows = []
    for key, value in pairs:
        key, value = clean(key), clean(value)
        if key and value and not is_placeholder(value):
            rows.append(f"K: {key} V: {value}")
    return "\n".join(rows)


def impact_stats_from_text(text: str) -> str:
    text = clean(text)
    if not text:
        return ""
    pct = re.search(r"(\d{1,3})\s*%", text)
    days = re.search(
        r"(\d{1,2}\s*[–-]\s*\d{1,2}|\d{1,2})\s*(?:days?|day)", text, re.I
    )
    rows = []
    if pct:
        label = "of this purchase goes directly to the artisan family"
        if "community" in text.lower():
            label = "of this purchase goes directly to the artisan community"
        rows.append(f"V: {pct.group(1)}% K: {label}")
    if days:
        day_val = days.group(1).replace(" ", "")
        label = "of hand-work represented in this piece"
        if "stitch" in text.lower() or "tailor" in text.lower():
            label = "of detailed stitching and finishing work per outfit"
        elif "paint" in text.lower():
            label = "of detailed hand-painting work for this artwork"
        elif "setting" in text.lower() or "jewel" in text.lower():
            label = "of hand-setting work per piece"
        rows.append(f"V: {day_val} days K: {label}")
    return "\n".join(rows)


def impact_note_from_text(text: str) -> str:
    text = clean(text)
    if not text:
        return ""
    parts = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    long_parts = [p for p in parts if len(p) > 120 and "%" not in p[:20]]
    if long_parts:
        return long_parts[0]
    if len(parts) >= 3:
        return parts[-1]
    return ""


def parse_canvas_size(size: str) -> str:
    size = clean(size)
    if not size:
        return ""
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*(in|inch|inches|cm|mm)?",
        size,
        re.I,
    )
    if not m:
        return kv_lines([("Canvas size", size)])
    unit = (m.group(3) or "in").lower()
    if unit.startswith("inch"):
        unit = "in"
    return kv_lines(
        [
            ("Width", f"{m.group(1)} {unit}"),
            ("Height", f"{m.group(2)} {unit}"),
        ]
    )


def parse_dimensions_block(text: str) -> tuple[str, str, str]:
    text = clean(text)
    if not text:
        return "", "", ""
    first_para = text.split("\n\n")[0]
    measurements = ""
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:inch|in|cm|mm)?\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:inch|in|cm|mm)?(?:\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:inch|in|cm|mm)?)?",
        first_para,
        re.I,
    )
    if m:
        unit = "inch" if "inch" in first_para.lower() or " in" in first_para.lower() else "cm"
        if m.group(3):
            measurements = kv_lines(
                [
                    ("Length", f"{m.group(1)} {unit}"),
                    ("Width", f"{m.group(2)} {unit}"),
                    ("Height", f"{m.group(3)} {unit}"),
                ]
            )
        else:
            measurements = kv_lines(
                [
                    ("Width", f"{m.group(1)} {unit}"),
                    ("Height", f"{m.group(2)} {unit}"),
                ]
            )
        weight = re.search(r"(\d+(?:\.\d+)?)\s*(?:g|kg)", first_para, re.I)
        if weight:
            measurements += "\n" + kv_lines([("Weight", weight.group(0))])
    highlight = ""
    if "scale reference" in text.lower():
        highlight = re.split(r"scale reference:\s*", text, flags=re.I)[-1].split("\n\n")[0].strip()
    note = ""
    if "also suitable" in text.lower() or "also available" in text.lower():
        note = re.split(r"also (?:suitable|available)", text, flags=re.I)[-1].strip()
        note = "Also" + note if note else ""
    return measurements, highlight, note


def parse_runon_faq_pairs(block: str) -> list[tuple[str, str]]:
    """Parse 'Question? Answer. Question? Answer.' cells (ethnic wear FAQs)."""
    block = clean(block)
    if not block:
        return []
    pairs: list[tuple[str, str]] = []
    matches = re.findall(
        r"([^.?\n]+?\?)\s*([^?]+?)(?=\s+[A-Z][^?]*\?|$)",
        block,
        flags=re.S,
    )
    for q, a in matches:
        q = clean(q)
        a = clean(a).rstrip(".")
        if not q or not a:
            continue
        q_line = q if q.lower().startswith("q:") else f"Q: {q}"
        a_line = a if a.lower().startswith("a:") else f"A: {a}"
        pairs.append((q_line, a_line))
    return pairs


def parse_faq_columns(row: dict, faq_keys: list[str]) -> str:
    pairs: list[tuple[str, str]] = []
    block = clean(row.get("FAQs") or row.get("product faq") or "")
    if block:
        faq_items = re.findall(
            r"FAQ\s*\d+\s*:\s*(.+?)(?=FAQ\s*\d+\s*:|$)", block, flags=re.I | re.S
        )
        for item in faq_items:
            item = clean(item)
            if "?" in item:
                q, a = item.split("?", 1)
                pairs.append((f"Q: {q.strip()}?", f"A: {a.strip()}"))
        if not pairs:
            pairs.extend(parse_runon_faq_pairs(block))
    for key in faq_keys:
        val = clean(row.get(key, ""))
        if not val or is_placeholder(val):
            continue
        if block and val == block and pairs:
            continue
        if val.lower().startswith("q:"):
            pairs.append((val, ""))
        elif val.count("?") > 1:
            pairs.extend(parse_runon_faq_pairs(val))
        elif "?" in val:
            q, a = val.split("?", 1)
            pairs.append((f"Q: {q.strip()}?", f"A: {a.strip()}"))
    lines = []
    for q, a in pairs:
        lines.append(q)
        if a:
            lines.append(a)
    return "\n".join(lines)


def html_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def paragraphs_to_html(text: str) -> str:
    text = clean(text)
    if not text:
        return ""
    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    return "".join(f"<p>{html_escape(b).replace(chr(10), '<br>')}</p>" for b in blocks)


def bullets_to_html(items: list[str]) -> str:
    if not items:
        return ""
    lis = "".join(f"<li>{html_escape(i)}</li>" for i in items)
    return f"<ul>{lis}</ul>"


def parse_kv_metafield(text: str) -> dict[str, str]:
    """Parse `K: key V: value` lines."""
    out: dict[str, str] = {}
    for line in clean(text).split("\n"):
        line = line.strip()
        if line.startswith("K: ") and " V: " in line:
            key, value = line[3:].split(" V: ", 1)
            out[key.strip()] = value.strip()
    return out


def format_kv_metafield(pairs: dict[str, str]) -> str:
    return "\n".join(f"K: {k} V: {v}" for k, v in pairs.items() if k and v)


def parse_impact_stats(text: str) -> list[tuple[str, str]]:
    """Parse `V: 72% K: label` lines."""
    rows: list[tuple[str, str]] = []
    for line in clean(text).split("\n"):
        line = line.strip()
        if line.startswith("V: ") and " K: " in line:
            value, label = line[3:].split(" K: ", 1)
            rows.append((value.strip(), label.strip()))
    return rows


def format_impact_stats(rows: list[tuple[str, str]]) -> str:
    return "\n".join(f"V: {v} K: {k}" for v, k in rows if v and k)


def merge_kv_metafield(old: str, new: str) -> str:
    if not clean(new):
        return old
    old_pairs = parse_kv_metafield(old)
    new_pairs = parse_kv_metafield(new)
    if not new_pairs:
        return old
    merged = dict(old_pairs)
    for key, value in new_pairs.items():
        if value and not is_placeholder(value):
            merged[key] = value
    return format_kv_metafield(merged)


def merge_impact_stats(old: str, new: str) -> str:
    if not clean(new):
        return old
    new_rows = parse_impact_stats(new)
    if not new_rows:
        return old
    return format_impact_stats(new_rows)


def merge_text_metafield(old: str, new: str) -> str:
    new = clean(new)
    if not new or is_placeholder(new):
        return old
    return new


def merge_update_into_row(row: dict[str, str], update: dict[str, str]) -> list[str]:
    """Apply update with frozen fields and placeholder-aware metafield merge. Returns change log."""
    changes: list[str] = []
    for key, new_val in update.items():
        if key.startswith("_"):
            continue
        if key in FROZEN_FIELDS:
            continue
        old_val = row.get(key, "")
        if key.endswith("product_impact_stats)"):
            merged = merge_impact_stats(old_val, new_val)
        elif key.endswith(KV_METAFIELD_SUFFIXES):
            merged = merge_kv_metafield(old_val, new_val)
        elif "metafields" in key:
            merged = merge_text_metafield(old_val, new_val)
        elif key == "Tags":
            merged = merge_category_tag(old_val, new_val)
        else:
            if not clean(new_val) or is_placeholder(new_val):
                continue
            merged = new_val
        if merged != old_val:
            row[key] = merged
            changes.append(key)
    return changes


ETHNIC_COLOR_HANDLES = {
    ("bandhani set in pure crepe silk", "royal blue & rani pink"): "bandhani-set-in-pure-crepe-silk",
    ("bandhani set in pure crepe silk", "burnt orange & black"): "green-orange-bandhani-set-in-pure-crepe-silk",
    ("crepe silk suit with lace detailing", "mustard yellow & royal blue"): "yellow-blue-crepe-silk-suit-with-lace-detailing",
}

# Excel SKU → export handle when Shopify SKU differs from Excel base code.
PAINTING_SKU_HANDLE_OVERRIDES = {
    "ART-PT-LG-197": "royal-tiger-hunt-in-forest-miniature-cloth-painting-1",
    "ART-PT-LG-198": "royal-hunting-scene-traditional-indian-miniature-painting",
}

DECOR_NAME_HANDLES = {
    "wine boxes painted": "wine-boxes-painted",
    "elephant globe with pen stand": "elephant-globe-with-pen-stand",
    "iron elephant": "iron-elephant",
    "wooden & iron elephant": "wooden-iron-elephant",
    "iron ship with penholder": "iron-ship-with-penholder",
    "tortoise t light candle holder": "tortoise-t-light-candle-holder",
    "iron swan decor showpiece": "iron-swan-decor-showpiece",
    "yellow sacred cow wall art": "yellow-sacred-cow-wall-art",
    "blue sacred cow wall art": "blue-sacred-cow-wall-art",
    "black sacred cow wall art": "black-sacred-cow-wall-art",
    "vintage jewellery box": "vintage-jewellery-box",
    "iron roman wall clock": "iron-roman-wall-clock",
    "antique floral lantern candle holder": "antique-floral-lantern-candle-holder",
    "royal ganesha circle art sculpture": "royal-ganesha-circle-art-sculpture",
}

DECOR_PRODUCT_CATEGORY = {
    "wall art": "Home & Garden > Decor > Wall Decor",
    "wall clock": "Home & Garden > Decor > Clocks",
    "clock": "Home & Garden > Decor > Clocks",
    "candle": "Home & Garden > Decor > Home Fragrance Accessories > Candle Holders",
    "jewellery box": "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Wrapping > Gift Boxes & Tins",
    "jewelry box": "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Wrapping > Gift Boxes & Tins",
    "storage box": "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Wrapping > Gift Boxes & Tins",
    "sculpture": "Home & Garden > Decor > Figurines",
    "figurine": "Home & Garden > Decor > Figurines",
    "organizer": "Home & Garden > Decor > Figurines",
    "showpiece": "Home & Garden > Decor > Figurines",
}


class ExportIndex:
    def __init__(self, rows: list[dict[str, str]]):
        self.rows = rows
        self.by_handle: dict[str, list[int]] = {}
        self.primary: dict[str, dict[str, str]] = {}
        self.sku_to_handle: dict[str, str] = {}
        self.title_to_handle: dict[str, str] = {}
        for idx, row in enumerate(rows):
            handle = clean(row.get("Handle", ""))
            if not handle:
                continue
            self.by_handle.setdefault(handle, []).append(idx)
            if clean(row.get("Title", "")):
                self.primary[handle] = row
                self.title_to_handle[clean(row["Title"]).lower()] = handle
                sku = clean(row.get("Variant SKU", "")).upper()
                if sku:
                    self.sku_to_handle[sku] = handle

    def resolve_ethnic(self, name: str, color: str) -> str | None:
        key = (clean(name).lower(), clean(color).lower())
        if key in ETHNIC_COLOR_HANDLES:
            h = ETHNIC_COLOR_HANDLES[key]
            return h if h in self.primary or True else None
        slug = slugify(name)
        if slug in self.primary:
            return slug
        title_key = clean(name).lower()
        if title_key in self.title_to_handle:
            return self.title_to_handle[title_key]
        return None

    def resolve_decor(self, name: str) -> str | None:
        key = clean(name).lower()
        if key in DECOR_NAME_HANDLES:
            return DECOR_NAME_HANDLES[key]
        slug = slugify(name)
        if slug in self.primary:
            return slug
        if key in self.title_to_handle:
            return self.title_to_handle[key]
        return slug or None


def build_painting_update(row: pd.Series, handle: str) -> dict[str, str]:
    title = clean(row["Painting Title"])
    subtitle = clean(row["Short Description"])
    bullets = [clean(row[c]) for c in ("Bullet 1", "Bullet 2", "Bullet 3") if clean(row.get(c)) and not is_placeholder(row.get(c))]
    body_parts = [paragraphs_to_html(subtitle)]
    if bullets:
        body_parts.append(bullets_to_html(bullets))
    heritage = clean(row.get("Understanding the Painting - Heading", ""))
    if heritage and not is_placeholder(heritage):
        body_parts.append(
            f"<h3><strong>Understanding the painting</strong></h3>{paragraphs_to_html(heritage)}"
        )
    for heading, field in (
        ("Size – Material – Colors", "Canvas Size"),
        ("Shipping & Returns", "Shipping & Returns"),
    ):
        val = clean(row.get(field, "")) if field else ""
        if val and not is_placeholder(val):
            body_parts.append(f"<h3><strong>{heading}</strong></h3>{paragraphs_to_html(val)}")
    details = kv_lines(
        [
            ("Tradition", row.get("Tradition")),
            ("Region", row.get("Region")),
            ("Medium", row.get("Medium")),
            ("Canvas preparation", row.get("Canvas Preparation")),
            ("Pigments", row.get("Pigments")),
            ("Outline technique", row.get("Outline Technique")),
            ("Style", row.get("Style")),
            ("Originality", row.get("Originality")),
            ("Year", row.get("Year")),
            ("Subject", row.get("Paintning Details- Subject")),
            ("Framing", row.get("Framing Options")),
        ]
    )
    measurements = parse_canvas_size(row.get("Canvas Size", ""))
    included = "\n".join(split_lines(row.get("What's Included", "")))
    care = "\n".join(split_lines(row.get("Care & Display", "")))
    impact_stats = impact_stats_from_text(row.get("Artisan Impact", ""))
    impact_note = impact_note_from_text(row.get("Artisan Impact", ""))
    faq = parse_faq_columns(row, [f"FAQ {i}" for i in range(1, 6)])
    price = row.get("Price", "")
    sku = clean(row.get("SKU CODE", "")).upper()
    tag = " · ".join(
        x
        for x in [clean(row.get("Tradition")), clean(row.get("Region"))]
        if x and not is_placeholder(x)
    )
    return {
        "Handle": handle,
        "Title": title,
        "Body (HTML)": "".join(body_parts),
        "Variant Price": str(int(price)) if str(price).strip() and str(price) != "nan" else "",
        **category_fields("paintings"),
        "product_care_instructions (product.metafields.custom.product_care_instructions)": care,
        "product details (product.metafields.custom.product_details)": details,
        "product faq (product.metafields.custom.product_faq)": faq,
        "product_impact_note (product.metafields.custom.product_impact_note)": impact_note,
        "product_impact_stats (product.metafields.custom.product_impact_stats)": impact_stats,
        "product_measurements (product.metafields.custom.product_measurements)": measurements,
        "product_whats_included (product.metafields.custom.product_whats_included)": included,
        **filter_fields(
            filter_subject=filter_value(row.get("Paintning Details- Subject")),
            filter_region=filter_value(row.get("Region")),
            filter_style=filter_value(row.get("Style")),
            filter_tradition=filter_value(row.get("Tradition")),
            filter_material=filter_value(row.get("Medium")),
        ),
        "_category_tag": tag,
        "_template": "paintings",
    }


def build_ethnic_update(row: pd.Series, handle: str) -> dict[str, str]:
    title = clean(row["Product Name"])
    subtitle = clean(row.get("One liner") or row.get("One Liner") or "")
    body = paragraphs_to_html(subtitle)
    highlights = clean(row.get("Highlights", ""))
    if highlights:
        body += bullets_to_html(split_lines(highlights))
    shipping = join_lines(row.get("Shipping and Returns", ""), row.get("Processing Time", ""), row.get("India Delivery", ""), row.get("International Delivery", ""), row.get("Returns", ""))
    if shipping:
        body += f"<h3><strong>Shipping &amp; Returns</strong></h3>{paragraphs_to_html(shipping)}"
    details = kv_lines(
        [
            ("Outfit type", row.get("Outfit Type")),
            ("Fabric", row.get("Fabric.1") or row.get("Fabric")),
            ("Work style", row.get("Work Style")),
            ("Craft technique", row.get("Craft Technique")),
            ("Design pattern", row.get("Design Pattern")),
            ("Fit", row.get("FIt") or row.get("Fit")),
            ("Occasion", row.get("Occasion")),
            ("Set includes", row.get("Set Includes.1") or row.get("Set Includes")),
            ("Color palette", row.get("Color Palatte") or row.get("Color")),
            ("Origin", row.get("Origin")),
            ("Style inspiration", row.get("Style Inspiration")),
        ]
    )
    size_lines = []
    for label, col in (("S", "S"), ("M", "M"), ("L", "L")):
        val = clean(row.get(col, ""))
        if val:
            size_lines.append(f"K: Size {label} V: {val}")
    measurements = "\n".join(size_lines)
    note = clean(row.get("Size Guides (In Inches)", ""))
    included = "\n".join(split_lines(row.get("Whats Included", "")))
    care = "\n".join(split_lines(row.get("Care Instructions", "")))
    impact_stats = impact_stats_from_text(row.get("Artisans Impact", ""))
    impact_note = impact_note_from_text(row.get("Artisans Impact", ""))
    faq = parse_faq_columns(row, ["FAQs"])
    fabric = clean(row.get("Fabric.1") or row.get("Fabric", ""))
    color = clean(row.get("Color", ""))
    return {
        "Handle": handle,
        "Title": title,
        "Body (HTML)": body,
        "Variant Price": str(int(row["Price"])) if str(row.get("Price", "")).strip() else "",
        "product_care_instructions (product.metafields.custom.product_care_instructions)": care,
        "product details (product.metafields.custom.product_details)": details,
        "product faq (product.metafields.custom.product_faq)": faq,
        "product_impact_note (product.metafields.custom.product_impact_note)": impact_note,
        "product_impact_stats (product.metafields.custom.product_impact_stats)": impact_stats,
        "product_measurements (product.metafields.custom.product_measurements)": measurements,
        "product_measurement_note (product.metafields.custom.product_measurement_note)": note,
        "product_whats_included (product.metafields.custom.product_whats_included)": included,
        "Fabric (product.metafields.shopify.fabric)": fabric,
        "Color (product.metafields.shopify.color-pattern)": color,
        "Size (product.metafields.shopify.size)": clean(row.get("Size", "")),
        **filter_fields(
            filter_color=filter_value(color),
            filter_fabric=filter_value(fabric),
            filter_product_type=filter_value(row.get("Outfit Type")),
            filter_occasion=filter_list_value(row.get("Occasion")),
            filter_tradition=filter_value(row.get("Craft Technique") or row.get("Work Style")),
            filter_region=filter_value(row.get("Origin")),
        ),
        **category_fields("ethnic-wear"),
        "_template": "ethnic-wear",
    }


def build_jewel_update(row: pd.Series, handle: str) -> dict[str, str]:
    title = clean(row["Product Name"])
    subtitle = clean(row.get("One Liner", ""))
    body = paragraphs_to_html(subtitle)
    shipping = join_lines(
        row.get("Shipping and Returns", ""),
        row.get("Processing Time", ""),
        row.get("India Delivery", ""),
        row.get("International Delivery", ""),
        row.get("REturn", ""),
        row.get("Jewellery Packaging", ""),
    )
    if shipping:
        body += f"<h3><strong>Shipping &amp; Returns</strong></h3>{paragraphs_to_html(shipping)}"
    details = kv_lines(
        [
            ("Jewellery type", row.get("Jewellery Type")),
            ("Base material", row.get("Base Material")),
            ("Plating", row.get("Planting")),
            ("Stones", row.get("Stones")),
            ("Closure", row.get("Closure Type")),
            ("Craft tradition", row.get("Craft Tradition")),
            ("Occasion", row.get("Occasion")),
            ("Weight", row.get("Weight")),
            ("Finish", row.get("Finish")),
        ]
    )
    included = "\n".join(split_lines(row.get("Whats Included", "")))
    care = "\n".join(split_lines(row.get("Care Instruction", "")))
    impact_stats = impact_stats_from_text(row.get("Artisan Impact", ""))
    impact_note = impact_note_from_text(row.get("Artisan Impact", ""))
    material = clean(row.get("Base Material", ""))
    jewelry_type = clean(row.get("Jewellery Type", ""))
    return {
        "Handle": handle,
        "Title": title,
        "Body (HTML)": body,
        "Variant Price": str(int(row["Price"])) if str(row.get("Price", "")).strip() else "",
        "product_care_instructions (product.metafields.custom.product_care_instructions)": care,
        "product details (product.metafields.custom.product_details)": details,
        "product_impact_note (product.metafields.custom.product_impact_note)": impact_note,
        "product_impact_stats (product.metafields.custom.product_impact_stats)": impact_stats,
        "product_whats_included (product.metafields.custom.product_whats_included)": included,
        "Jewelry type (product.metafields.shopify.jewelry-type)": "imitation-jewelry",
        "Material (product.metafields.shopify.material)": material,
        **filter_fields(
            filter_material=filter_value(material),
            filter_jewelry_type=filter_value(jewelry_type),
            filter_occasion=filter_list_value(row.get("Occasion")),
            filter_product_type=filter_value(jewelry_type),
        ),
        **category_fields("jewellery"),
        "_template": "jewellery",
    }


def build_decor_update(row: pd.Series, handle: str) -> dict[str, str]:
    title = clean(row["Product Name"])
    desc = clean(row.get("Product Description", ""))
    body = paragraphs_to_html(desc)
    shipping = clean(row.get("Shipping & Returns", ""))
    if shipping:
        body += f"<h3><strong>Shipping &amp; Returns</strong></h3>{paragraphs_to_html(shipping)}"
    details = kv_lines(
        [
            ("Sculpture type", row.get("Sculpture Type")),
            ("Craft tradition", row.get("Craft Tradition")),
            ("Material", row.get("Material")),
            ("Finish technique", row.get("Finish Technique")),
            ("Surface finish", row.get("Surface Finish")),
            ("Storage type", row.get("Storage Type")),
            ("Weight", row.get("Weight")),
            ("Usage", row.get("Usage")),
            ("Indoor / Outdoor", row.get("Indoor / Outdoor")),
        ]
    )
    measurements, highlight, note = parse_dimensions_block(row.get("Dimensions & Scale", ""))
    included = "\n".join(split_lines(row.get("Whats Included", "")))
    care = "\n".join(split_lines(row.get("Care Instructions", "")))
    impact_stats = impact_stats_from_text(row.get("Artisan Impact", ""))
    impact_note = impact_note_from_text(row.get("Artisan Impact", ""))
    faq = parse_faq_columns(row, ["FAQs"])
    material = clean(row.get("Material", ""))
    return {
        "Handle": handle,
        "Title": title,
        "Body (HTML)": body,
        "Variant Price": str(int(row["Price"])) if str(row.get("Price", "")).strip() else "",
        "product_care_instructions (product.metafields.custom.product_care_instructions)": care,
        "product details (product.metafields.custom.product_details)": details,
        "product faq (product.metafields.custom.product_faq)": faq,
        "product_impact_note (product.metafields.custom.product_impact_note)": impact_note,
        "product_impact_stats (product.metafields.custom.product_impact_stats)": impact_stats,
        "product_measurements (product.metafields.custom.product_measurements)": measurements,
        "product_measurement_highlight (product.metafields.custom.product_measurement_highlight)": highlight,
        "product_measurement_note (product.metafields.custom.product_measurement_note)": note,
        "product_whats_included (product.metafields.custom.product_whats_included)": included,
        "Material (product.metafields.shopify.material)": material,
        **filter_fields(
            filter_material=filter_value(material),
            filter_product_type=filter_value(row.get("Sculpture Type")),
            filter_tradition=filter_value(row.get("Craft Tradition")),
            filter_occasion=filter_list_value(row.get("Usage")),
        ),
        **category_fields("sculpture"),
        "_template": "sculpture",
    }


def read_category_excel(filename: str) -> pd.DataFrame | None:
    path = DATA_DIR / filename
    if not path.is_file():
        return None
    return pd.read_excel(path)


def load_updates(index: ExportIndex) -> tuple[dict[str, dict[str, str]], list[str], list[str]]:
    updates: dict[str, dict[str, str]] = {}
    report: list[str] = []
    errors: list[str] = []
    existing = set(index.primary)

    paintings = read_category_excel("Arthenic_Paintings_Data.xlsx")
    if paintings is None:
        report.append("WARN: Arthenic_Paintings_Data.xlsx missing — skipping paintings Excel merge")
    else:
        seen_skus: dict[str, str] = {}
        for _, row in paintings.iterrows():
            sku = clean(row["SKU CODE"]).upper()
            title = clean(row["Painting Title"])
            handle = (
                PAINTING_SKU_HANDLE_OVERRIDES.get(sku)
                or index.sku_to_handle.get(sku)
            )
            if not handle:
                slug = slugify(title)
                if slug in index.primary:
                    handle = slug
                    report.append(
                        f"WARN paintings: SKU {sku} not in export — matched by title slug -> {handle}"
                    )
            if not handle:
                errors.append(f"SKIP paintings: SKU {sku} ({title}) — not found in export")
                continue
            if sku in seen_skus:
                report.append(f"WARN paintings: duplicate SKU {sku} — row overwrites {seen_skus[sku]}")
            seen_skus[sku] = title
            updates[handle] = build_painting_update(row, handle)
            report.append(f"OK paintings: {sku} -> {handle} ({title})")

    ethnic = read_category_excel("Arthenic_Ethnic_Data.xlsx")
    if ethnic is None:
        report.append("WARN: Arthenic_Ethnic_Data.xlsx missing — skipping ethnic Excel merge")
    else:
        for _, row in ethnic.iterrows():
            name = clean(row["Product Name"])
            color = clean(row.get("Color", ""))
            handle = index.resolve_ethnic(name, color)
            if not handle or handle not in existing:
                errors.append(f"SKIP ethnic: {name} [{color}] — no matching export handle")
                continue
            updates[handle] = build_ethnic_update(row, handle)
            report.append(f"OK ethnic: {name} [{color}] -> {handle}")

    jewel = read_category_excel("Arthenic_Jewel_Data.xlsx")
    if jewel is None:
        report.append("WARN: Arthenic_Jewel_Data.xlsx missing — skipping jewellery Excel merge")
    else:
        for _, row in jewel.iterrows():
            name = clean(row["Product Name"])
            handle = index.title_to_handle.get(name.lower())
            if not handle or handle not in existing:
                errors.append(f"SKIP jewellery: {name} — no matching export handle")
                continue
            updates[handle] = build_jewel_update(row, handle)
            report.append(f"OK jewellery: {name} -> {handle}")

    decor = read_category_excel("Arthenic_Decor_Data.xlsx")
    if decor is None:
        report.append("WARN: Arthenic_Decor_Data.xlsx missing — skipping decor Excel merge")
    else:
        for _, row in decor.iterrows():
            name = clean(row["Product Name"])
            handle = index.resolve_decor(name)
            if not handle:
                errors.append(f"SKIP decor: {name} — could not resolve handle")
                continue
            updates[handle] = build_decor_update(row, handle)
            if handle in existing:
                report.append(f"OK decor: {name} -> {handle}")
            else:
                report.append(f"NEW decor: {name} -> {handle}")

    return updates, report, errors


def decor_product_category(row: pd.Series) -> str:
    haystack = " ".join(
        clean(row.get(col, "")).lower()
        for col in ("Product Name", "Sculpture Type", "Storage Type", "Usage")
    )
    for keyword, category in DECOR_PRODUCT_CATEGORY.items():
        if keyword in haystack:
            return category
    return "Home & Garden > Decor > Figurines"


def build_new_product_row(update: dict[str, str], row: pd.Series, fieldnames: list[str]) -> dict[str, str]:
    out = {col: "" for col in fieldnames}
    out.update(update)
    out["Vendor"] = "Arthenic"
    out["Product Category"] = decor_product_category(row)
    out["Published"] = "true"
    out["Option1 Name"] = "Title"
    out["Option1 Value"] = "Default Title"
    out["Variant Inventory Tracker"] = "shopify"
    out["Variant Inventory Qty"] = "5"
    out["Variant Inventory Policy"] = "deny"
    out["Variant Fulfillment Service"] = "manual"
    out["Variant Requires Shipping"] = "true"
    out["Variant Taxable"] = "true"
    out["Variant Weight Unit"] = "g"
    out["Gift Card"] = "false"
    out["Status"] = "active"
    apply_sale_pricing_row(out)
    return out


def merge_rows(
    index: ExportIndex, updates: dict[str, dict[str, str]], fieldnames: list[str]
) -> tuple[list[dict[str, str]], set[str], dict[str, list[str]]]:
    merged = [dict(row) for row in index.rows]
    touched: set[str] = set()
    change_log: dict[str, list[str]] = {}
    existing_handles = set(index.primary)

    for handle, update in updates.items():
        if handle not in index.by_handle:
            continue
        primary_idx = index.by_handle[handle][0]
        changes = merge_update_into_row(merged[primary_idx], update)
        touched.add(handle)
        if changes:
            change_log[handle] = changes

    preserved = existing_handles - touched
    return merged, preserved, change_log


def validate_images_unchanged(
    original: list[dict[str, str]], merged: list[dict[str, str]]
) -> list[str]:
    issues: list[str] = []
    if len(original) != len(merged):
        issues.append(f"Row count changed: {len(original)} -> {len(merged)}")
    for idx, (orig, new) in enumerate(zip(original, merged)):
        handle = clean(orig.get("Handle", ""))
        for col in ("Image Src", "Image Position", "Image Alt Text", "Variant Image"):
            if clean(orig.get(col, "")) != clean(new.get(col, "")):
                issues.append(f"row {idx + 1} ({handle}): {col} changed")
    return issues


def main() -> None:
    ensure_output_dir()
    with EXPORT_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    with SAMPLE_PATH.open(encoding="utf-8", newline="") as f:
        sample_fields = csv.DictReader(f).fieldnames or []
    for col in sample_fields:
        if col not in fieldnames:
            fieldnames.append(col)
    for col in FILTER_METAFIELD_COLUMNS:
        if col not in fieldnames:
            fieldnames.append(col)

    index = ExportIndex(rows)
    updates, report_lines, errors = load_updates(index)
    if errors:
        print("ERRORS (rows skipped):")
        for err in errors:
            print(f"  {err}")
    merged_rows, preserved_handles, change_log = merge_rows(index, updates, fieldnames)
    for handle in updates:
        if handle not in index.by_handle:
            continue
        primary_idx = index.by_handle[handle][0]
        catalog_changes = apply_catalog_fields(merged_rows[primary_idx], handle, updates)
        if catalog_changes:
            existing = change_log.get(handle, [])
            change_log[handle] = existing + [c for c in catalog_changes if c not in existing]
    image_issues = validate_images_unchanged(rows, merged_rows)

    new_handles = {h for h in updates if h not in index.primary}
    new_product_rows: list[dict[str, str]] = []
    if new_handles:
        decor_df = pd.read_excel(DATA_DIR / "Arthenic_Decor_Data.xlsx")
        decor_by_handle: dict[str, pd.Series] = {}
        for _, decor_row in decor_df.iterrows():
            decor_handle = index.resolve_decor(clean(decor_row["Product Name"]))
            if decor_handle:
                decor_by_handle[decor_handle] = decor_row
        for handle in sorted(new_handles):
            decor_row = decor_by_handle.get(handle)
            if decor_row is not None and handle in updates:
                new_product_rows.append(
                    build_new_product_row(updates[handle], decor_row, fieldnames)
                )

    if new_product_rows:
        with NEW_PRODUCTS_PATH.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(new_product_rows)
        print(f"Wrote {NEW_PRODUCTS_PATH} ({len(new_product_rows)} new products)")
    elif NEW_PRODUCTS_PATH.exists():
        NEW_PRODUCTS_PATH.unlink()

    price_issues = validate_excel_prices(updates, merged_rows, index, new_product_rows)
    if price_issues:
        print("PRICE VALIDATION FAILURES:")
        for issue in price_issues:
            print(f"  {issue}")
        raise SystemExit(1)

    excel_handles = set(updates.keys())
    if excel_handles:
        UPLOAD_HANDLES_FILE.write_text(
            "\n".join(sorted(excel_handles)) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {UPLOAD_HANDLES_FILE} ({len(excel_handles)} Excel handles to upload)")
    elif UPLOAD_HANDLES_FILE.exists():
        UPLOAD_HANDLES_FILE.unlink()
        print("No Excel changes — skipped upload_handles.txt")

    out_path = OUTPUT_PATH
    try:
        fh = out_path.open("w", encoding="utf-8", newline="")
    except PermissionError:
        out_path = OUTPUT_DIR / "Arthenic_ProductImport_Updated_locked.csv"
        print(f"WARNING: {OUTPUT_PATH.name} is locked — writing {out_path.name} instead.")
        fh = out_path.open("w", encoding="utf-8", newline="")
    with fh as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged_rows)

    with REPORT_PATH.open("w", encoding="utf-8") as f:
        f.write("Arthenic product import merge report\n")
        f.write("=" * 40 + "\n\n")
        f.write("POLICY: Prices, tags, and type come from ProductData Excel only.\n")
        f.write("Export CSV is used for images/SKU/handle mapping — not pricing.\n")
        f.write("Metafields merge per-key; placeholder Excel values never overwrite.\n\n")
        f.write("IMPORTANT — metafields and CSV import:\n")
        f.write("  Shopify CSV import does NOT reliably import list.single_line_text_field\n")
        f.write("  metafields (product_details, product_measurements, etc.).\n")
        f.write("  Use Arthenic_ProductImport_Updated.csv for title/body/price/images.\n")
        f.write("  Then run: python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com\n\n")
        f.write(f"Source export products: {len(index.primary)}\n")
        f.write(f"Excel updates applied: {len(updates)}\n")
        f.write(f"Products preserved (not in Excel batch): {len(preserved_handles)}\n")
        f.write(f"Output rows (incl. image rows): {len(merged_rows)}\n")
        f.write(f"New products (not in export): {len(new_handles)}\n")
        f.write(f"Skipped Excel rows: {len(errors)}\n")
        f.write(f"Excel handles to upload: {len(excel_handles)}\n")
        f.write(f"Price validation: {'PASS' if not price_issues else 'FAIL'}\n")
        if errors:
            f.write("Skipped rows:\n")
            f.write("\n".join(errors))
            f.write("\n\n")
        if image_issues:
            f.write("IMAGE VALIDATION FAILURES:\n")
            f.write("\n".join(image_issues))
            f.write("\n\n")
        else:
            f.write("Image validation: PASS (all Image Src / Variant Image unchanged)\n\n")
        f.write("Handle mapping:\n")
        f.write("\n".join(report_lines))
        f.write("\n\nField changes by handle:\n")
        for handle in sorted(change_log):
            f.write(f"  {handle}: {', '.join(change_log[handle])}\n")
        f.write("\nPreserved handles (not in Excel batch):\n")
        for handle in sorted(preserved_handles):
            f.write(f"  - {handle}\n")

    print(f"Wrote {out_path}")
    print(f"Wrote {REPORT_PATH}")
    print(f"Updated {len(updates)} products; preserved {len(preserved_handles)} existing products.")
    if image_issues:
        print(f"WARNING: {len(image_issues)} image field changes detected — review report.")
    else:
        print("Image validation: PASS")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Shopify import CSV from Excel data")
    parser.add_argument("--data-dir", default=None, help="Path to store's ProductData folder")
    args = parser.parse_args()
    data_dir = get_data_dir(args.data_dir)
    config = load_store_config(data_dir)
    set_store_config(config)
    main()

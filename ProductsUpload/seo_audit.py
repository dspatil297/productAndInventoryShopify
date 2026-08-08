"""Crawl arthenic.com URLs and report missing/short SEO title + meta description."""

from __future__ import annotations

import csv
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path

BASE_URL = "https://arthenic.com"
USER_AGENT = "Mozilla/5.0 (compatible; ArthenicSEOAudit/1.0)"
TITLE_MIN_LEN = 30
DESC_MIN_LEN = 120
REQUEST_DELAY_SEC = 0.25

ROOT = Path(__file__).resolve().parent
PRODUCT_EXPORT = ROOT / "AllProductExport.csv"
OUTPUT_CSV = ROOT / "output" / "seo_audit_report.csv"
OUTPUT_TXT = ROOT / "output" / "seo_audit_summary.txt"


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_meta(html: str) -> tuple[str, str]:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = unescape(re.sub(r"\s+", " ", title_match.group(1)).strip()) if title_match else ""

    desc_match = re.search(
        r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']',
        html,
        re.I | re.S,
    )
    if not desc_match:
        desc_match = re.search(
            r'<meta[^>]*content=["\'](.*?)["\'][^>]*name=["\']description["\']',
            html,
            re.I | re.S,
        )
    description = unescape(desc_match.group(1).strip()) if desc_match else ""
    return title, description


def discover_urls() -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    sitemap_index = f"{BASE_URL}/sitemap.xml"
    try:
        root = ET.fromstring(fetch(sitemap_index))
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in root.findall(".//sm:loc", ns):
            child_url = (loc.text or "").strip()
            if child_url.endswith(".xml"):
                try:
                    child_root = ET.fromstring(fetch(child_url))
                    for child_loc in child_root.findall(".//sm:loc", ns):
                        add((child_loc.text or "").strip())
                except (urllib.error.URLError, ET.ParseError):
                    continue
            else:
                add(child_url)
    except (urllib.error.URLError, ET.ParseError):
        pass

    if PRODUCT_EXPORT.exists():
        with PRODUCT_EXPORT.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                handle_slug = (row.get("Handle") or "").strip()
                if handle_slug:
                    add(f"{BASE_URL}/products/{handle_slug}")

    for path in [
        "/",
        "/collections",
        "/collections/paintings",
        "/collections/ethnic-wears",
        "/collections/jewellery",
        "/collections/gifts-home-decor",
        "/pages/about-us",
        "/pages/contact",
        "/pages/faq",
        "/policies/shipping-policy",
        "/policies/refund-policy",
        "/policies/privacy-policy",
        "/policies/terms-of-service",
        "/search",
        "/cart",
    ]:
        add(f"{BASE_URL}{path}")

    return urls


def page_type_from_url(url: str) -> str:
    path = url.replace(BASE_URL, "") or "/"
    if path == "/":
        return "homepage"
    if path.startswith("/products/"):
        return "product"
    if path.startswith("/collections/"):
        return "collection"
    if path.startswith("/pages/"):
        return "page"
    if path.startswith("/policies/"):
        return "policy"
    if path.startswith("/blogs/"):
        return "blog"
    return "other"


def audit_url(url: str) -> dict[str, str | int | bool]:
    path = url.replace(BASE_URL, "") or "/"
    row: dict[str, str | int | bool] = {
        "url": path,
        "full_url": url,
        "page_type": page_type_from_url(url),
        "status": "ok",
        "title": "",
        "title_length": 0,
        "meta_description": "",
        "meta_description_length": 0,
        "missing_meta_description": True,
        "title_too_short": True,
        "meta_description_too_short": True,
        "error": "",
    }

    try:
        html = fetch(url)
        title, description = parse_meta(html)
        row["title"] = title
        row["title_length"] = len(title)
        row["meta_description"] = description
        row["meta_description_length"] = len(description)
        row["missing_meta_description"] = description == ""
        row["title_too_short"] = len(title) < TITLE_MIN_LEN
        row["meta_description_too_short"] = description != "" and len(description) < DESC_MIN_LEN
    except urllib.error.HTTPError as exc:
        row["status"] = f"http_{exc.code}"
        row["error"] = str(exc.reason)
    except Exception as exc:  # ponytail: network/parse failures stay per-row
        row["status"] = "error"
        row["error"] = str(exc)

    return row


def write_report(rows: list[dict[str, str | int | bool]]) -> None:
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "url",
        "full_url",
        "page_type",
        "status",
        "title",
        "title_length",
        "title_too_short",
        "meta_description",
        "meta_description_length",
        "missing_meta_description",
        "meta_description_too_short",
        "error",
    ]

    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    ok_rows = [row for row in rows if row["status"] == "ok"]
    missing_desc = [row for row in ok_rows if row["missing_meta_description"]]
    short_title = [row for row in ok_rows if row["title_too_short"]]
    short_desc = [row for row in ok_rows if row["meta_description_too_short"]]
    errors = [row for row in rows if row["status"] != "ok"]

    lines = [
        "Arthenic SEO audit",
        f"Base URL: {BASE_URL}",
        f"Title too short: < {TITLE_MIN_LEN} chars",
        f"Meta description too short: < {DESC_MIN_LEN} chars (non-empty only)",
        "",
        f"URLs checked: {len(rows)}",
        f"OK: {len(ok_rows)}",
        f"Errors/404: {len(errors)}",
        f"Missing meta description: {len(missing_desc)}",
        f"Short title: {len(short_title)}",
        f"Short meta description: {len(short_desc)}",
        "",
        "Report CSV: output/seo_audit_report.csv",
        "",
        "--- Missing meta description ---",
    ]
    lines.extend(f"{row['url']}" for row in missing_desc)
    if not missing_desc:
        lines.append("(none)")

    lines.extend(["", "--- Short title ---"])
    for row in sorted(short_title, key=lambda item: int(item["title_length"])):
        lines.append(f"{row['title_length']:>3}  {row['url']}  {row['title']}")

    lines.extend(["", "--- Short meta description ---"])
    for row in sorted(short_desc, key=lambda item: int(item["meta_description_length"])):
        preview = str(row["meta_description"])[:80]
        lines.append(f"{row['meta_description_length']:>3}  {row['url']}  {preview}")

    lines.extend(["", "--- Errors ---"])
    for row in errors:
        lines.append(f"{row['url']}  {row['status']}  {row['error']}")

    OUTPUT_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    urls = discover_urls()
    rows: list[dict[str, str | int | bool]] = []

    for index, url in enumerate(urls):
        rows.append(audit_url(url))
        if index and index % 20 == 0:
            time.sleep(REQUEST_DELAY_SEC)

    write_report(rows)
    print(f"Wrote {OUTPUT_CSV}")
    print(f"Wrote {OUTPUT_TXT}")
    print(f"Checked {len(rows)} URLs")


if __name__ == "__main__":
    main()

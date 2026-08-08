#!/usr/bin/env python3
"""Create new Shopify products from Arthenic_NewProducts.csv (decor batch)."""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

from restore_products_shopify import create_product, lookup_product, sync_product_catalog
from upload_metafields_shopify import normalize_store, shopify_execute

from paths import CREATE_REPORT, NEW_PRODUCTS_CSV, ensure_output_dir

ROOT = Path(__file__).resolve().parent
NEW_PRODUCTS_PATH = NEW_PRODUCTS_CSV
REPORT_PATH = CREATE_REPORT

PRODUCT_UPDATE = """
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      handle
      templateSuffix
    }
    userErrors {
      field
      message
    }
  }
}
"""

TEMPLATE_BY_HANDLE: dict[str, str] = {}


def load_new_product_rows(path: Path, handles: set[str] | None = None) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("Handle") or "").strip()]
    if not handles:
        return rows
    wanted = {h.strip() for h in handles}
    return [r for r in rows if (r.get("Handle") or "").strip() in wanted]


def set_template(store: str, product_id: str, template: str, *, token: str | None) -> list[str]:
    result = shopify_execute(
        store,
        PRODUCT_UPDATE,
        {"input": {"id": product_id, "templateSuffix": template}},
        allow_mutations=True,
        token=token,
        label=f"template {template}",
    )
    payload = result.get("productUpdate") or {}
    return [
        e.get("message", "")
        for e in payload.get("userErrors") or []
        if e.get("message")
    ]


def main() -> int:
    ensure_output_dir()
    parser = argparse.ArgumentParser(description="Create products from Arthenic_NewProducts.csv")
    parser.add_argument("--store", default="f1qzim-fc.myshopify.com")
    parser.add_argument("--csv", type=Path, default=NEW_PRODUCTS_PATH)
    parser.add_argument("--handle", action="append", dest="handles")
    parser.add_argument("--token")
    parser.add_argument("--sleep", type=float, default=0.5)
    parser.add_argument("--use-cli", action="store_true")
    args = parser.parse_args()

    if args.use_cli:
        import upload_metafields_shopify as meta

        meta._USE_CLI = True

    if not args.csv.exists():
        print(f"Missing {args.csv.name}. Run build_product_import.py first.", file=sys.stderr)
        return 1

    store = normalize_store(args.store)
    handle_filter = {h.strip() for h in args.handles} if args.handles else None
    rows = load_new_product_rows(args.csv, handle_filter)
    if not rows:
        print("No new product rows to create.", file=sys.stderr)
        return 1

    lines: list[str] = []
    ok = fail = skip = 0

    for row in rows:
        handle = (row.get("Handle") or "").strip()
        existing = lookup_product(store, handle, token=args.token)
        if existing and existing.get("id"):
            errors = sync_product_catalog(store, existing, row, token=args.token)
            template = row.get("_template") or TEMPLATE_BY_HANDLE.get(handle) or "sculpture"
            errors.extend(set_template(store, existing["id"], template, token=args.token))
            if errors:
                msg = f"SYNC_FAIL\t{handle}\t{'; '.join(errors)}"
                fail += 1
            else:
                msg = f"SYNC\t{handle}\talready exists\t{existing['id']}"
                ok += 1
            print(msg)
            lines.append(msg)
            time.sleep(args.sleep)
            continue

        product_id, errors = create_product(store, row, token=args.token)
        if not product_id:
            msg = f"FAIL\t{handle}\t{'; '.join(errors) if errors else 'create failed'}"
            fail += 1
            print(msg)
            lines.append(msg)
            time.sleep(args.sleep)
            continue

        template = row.get("_template") or TEMPLATE_BY_HANDLE.get(handle) or "sculpture"
        errors = set_template(store, product_id, template, token=args.token)
        if errors:
            msg = f"FAIL\t{handle}\t{'; '.join(errors)}"
            fail += 1
        else:
            msg = f"OK\t{handle}\t{row.get('Title', '')}\t{product_id}"
            ok += 1
        print(msg)
        lines.append(msg)
        time.sleep(args.sleep)

    lines.append(f"\nDone: {ok} ok, {skip} skipped, {fail} failed (total {len(rows)})")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(lines[-1])
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

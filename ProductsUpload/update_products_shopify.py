#!/usr/bin/env python3
"""Push title/body/price/compare-at/type/tags from merged CSV to existing Shopify products."""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

from paths import IMPORT_CSV, NEW_PRODUCTS_CSV, UPDATE_REPORT, UPLOAD_HANDLES_FILE, ensure_output_dir
from restore_products_shopify import lookup_product, sync_product_catalog
from upload_metafields_shopify import normalize_store

ROOT = Path(__file__).resolve().parent
CSV_PATH = IMPORT_CSV
REPORT_PATH = UPDATE_REPORT


def load_primary_rows(path: Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    primary: dict[str, dict[str, str]] = {}
    for row in rows:
        handle = (row.get("Handle") or "").strip()
        title = (row.get("Title") or "").strip()
        if not handle or not title:
            continue
        primary[handle] = row
    return primary


def load_product_rows(import_csv: Path, new_products_csv: Path) -> dict[str, dict[str, str]]:
    rows = load_primary_rows(import_csv)
    if new_products_csv.is_file():
        for handle, row in load_primary_rows(new_products_csv).items():
            rows[handle] = row
    return rows


def load_completed_handles(report_path: Path) -> set[str]:
    if not report_path.is_file():
        return set()
    done: set[str] = set()
    for line in report_path.read_text(encoding="utf-8").splitlines():
        if line.startswith(("OK\t", "SKIP\t")):
            done.add(line.split("\t", 2)[1])
    return done


def main() -> int:
    ensure_output_dir()
    parser = argparse.ArgumentParser(description="Update existing Shopify products from merged CSV")
    parser.add_argument("--store", default="f1qzim-fc.myshopify.com")
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    parser.add_argument("--handles-file", type=Path, default=UPLOAD_HANDLES_FILE)
    parser.add_argument("--handle", action="append", dest="handles")
    parser.add_argument("--token")
    parser.add_argument("--sleep", type=float, default=0.5)
    parser.add_argument("--use-cli", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Skip OK/SKIP handles in products_update_report.txt")
    args = parser.parse_args()

    if args.use_cli:
        import upload_metafields_shopify as meta

        meta._USE_CLI = True

    if not args.csv.exists():
        print(f"Missing {args.csv.name}. Run build_product_import.py first.", file=sys.stderr)
        return 1

    if args.handles:
        wanted = {h.strip() for h in args.handles if h.strip()}
    elif args.handles_file and args.handles_file.is_file():
        wanted = {
            line.strip()
            for line in args.handles_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }
    else:
        print("Provide --handles-file or --handle", file=sys.stderr)
        return 1

    rows = load_product_rows(args.csv, NEW_PRODUCTS_CSV)
    missing = sorted(wanted - set(rows))
    if missing:
        print(f"Handles missing from CSV: {', '.join(missing[:10])}", file=sys.stderr)

    store = normalize_store(args.store)
    completed = load_completed_handles(REPORT_PATH) if args.resume else set()
    if completed:
        print(f"Resuming — skipping {len(completed)} handle(s) already done")

    lines: list[str] = []
    if args.resume and REPORT_PATH.is_file():
        lines = [
            line
            for line in REPORT_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    ok = sum(1 for line in lines if line.startswith("OK\t"))
    skip = sum(1 for line in lines if line.startswith("SKIP\t"))
    fail = sum(1 for line in lines if line.startswith("FAIL\t"))

    for handle in sorted(wanted):
        if handle in completed:
            continue
        row = rows.get(handle)
        if not row:
            msg = f"SKIP\t{handle}\tmissing from CSV"
            skip += 1
            print(msg)
            lines.append(msg)
            continue
        try:
            product = lookup_product(store, handle, token=args.token)
        except RuntimeError as exc:
            msg = f"FAIL\t{handle}\t{exc}"
            fail += 1
            print(msg)
            lines.append(msg)
            time.sleep(args.sleep)
            continue
        if not product or not product.get("id"):
            msg = f"SKIP\t{handle}\tnot in store"
            skip += 1
            print(msg)
            lines.append(msg)
            time.sleep(args.sleep)
            continue
        try:
            errors = sync_product_catalog(store, product, row, token=args.token)
        except RuntimeError as exc:
            errors = [str(exc)]
        if errors:
            msg = f"FAIL\t{handle}\t{'; '.join(errors)}"
            fail += 1
        else:
            msg = f"OK\t{handle}\t{row.get('Variant Price', '')}\t{row.get('Variant Compare At Price', '')}"
            ok += 1
        print(msg)
        lines.append(msg)
        time.sleep(args.sleep)

    lines.append(f"\nDone: {ok} ok, {skip} skipped, {fail} failed (total {len(wanted)})")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(lines[-1])
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

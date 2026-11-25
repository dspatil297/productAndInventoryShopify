#!/usr/bin/env python3
"""One command: Excel in data dir → Shopify products + metafields.

Usage:
    # Use ProductData/ (default, reads store.json from there)
    python upload_products.py

    # Use a different store's folder
    python upload_products.py --data-dir /path/to/StoreB/ProductData

    # Dry run (no Shopify API calls)
    python upload_products.py --dry-run
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from paths import (
    CREATE_REPORT,
    IMPORT_REPORT,
    METAFIELDS_REPORT,
    NEW_PRODUCTS_CSV,
    UPDATE_REPORT,
    UPLOAD_HANDLES_FILE,
    ensure_output_dir,
    get_data_dir,
)
from store_config import load_store_config
from sync_product_data import sync_product_data

ROOT = Path(__file__).resolve().parent


def run_script(name: str, *args: str) -> int:
    script = ROOT / name
    result = subprocess.run([sys.executable, str(script), *args], cwd=ROOT)
    return result.returncode


def read_handles(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload products from Excel to Shopify")
    parser.add_argument("--data-dir", default=None, help="Path to store's ProductData folder (default: ProductData/)")
    parser.add_argument("--store", default=None, help="Override store domain from store.json")
    parser.add_argument("--token", default=None, help="Shopify Admin API token (optional; use --use-cli on Windows)")
    parser.add_argument("--dry-run", action="store_true", help="Build payloads only; no Shopify API")
    parser.add_argument("--skip-create", action="store_true", help="Metafields only (products must already exist)")
    parser.add_argument("--use-cli", action="store_true", help="Use Shopify CLI auth (auto-enabled on Windows if no token)")
    args = parser.parse_args()

    if not args.token and sys.platform == "win32":
        args.use_cli = True

    if args.use_cli:
        import upload_metafields_shopify as meta
        meta._USE_CLI = True

    data_dir = get_data_dir(args.data_dir)
    config = load_store_config(data_dir)
    store = args.store or config.store

    ensure_output_dir()
    synced = sync_product_data(config)
    for line in synced:
        print(line)

    if run_script("build_product_import.py", "--data-dir", str(data_dir)) != 0:
        return 1

    handles = read_handles(UPLOAD_HANDLES_FILE)
    if not handles:
        print("No product changes in Excel — nothing to upload.", file=sys.stderr)
        return 0

    if not args.dry_run and not args.skip_create and NEW_PRODUCTS_CSV.is_file():
        create_args = ["--store", store]
        if args.token:
            create_args.extend(["--token", args.token])
        if args.use_cli:
            create_args.append("--use-cli")
        if run_script("create_new_products_shopify.py", *create_args) != 0:
            return 1

    if not args.dry_run:
        update_args = ["--store", store, "--handles-file", str(UPLOAD_HANDLES_FILE)]
        if args.token:
            update_args.extend(["--token", args.token])
        if args.use_cli:
            update_args.append("--use-cli")
        if run_script("update_products_shopify.py", *update_args) != 0:
            return 1

    if run_script("build_story_json.py", "--data-dir", str(data_dir)) != 0:
        return 1

    upload_args = ["--store", store, "--handles-file", str(UPLOAD_HANDLES_FILE)]
    if args.token:
        upload_args.extend(["--token", args.token])
    if args.dry_run:
        upload_args.append("--dry-run")
    if args.use_cli:
        upload_args.append("--use-cli")

    if run_script("upload_metafields_shopify.py", *upload_args) != 0:
        return 1

    print(f"\nDone — {len(handles)} product(s). Reports in output/")
    if CREATE_REPORT.is_file():
        print(f"  create: {CREATE_REPORT.name}")
    if UPDATE_REPORT.is_file():
        print(f"  update: {UPDATE_REPORT.name}")
    print(f"  metafields: {METAFIELDS_REPORT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

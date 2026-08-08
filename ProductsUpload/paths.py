"""Shared paths for ProductsUpload scripts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "ProductData"
OUTPUT_DIR = ROOT / "output"

EXPORT_PATH = ROOT / "AllProductExport.csv"
SAMPLE_PATH = ROOT / "Sample single product.csv"

IMPORT_CSV = OUTPUT_DIR / "Arthenic_ProductImport_Updated.csv"
NEW_PRODUCTS_CSV = OUTPUT_DIR / "Arthenic_NewProducts.csv"
IMPORT_REPORT = OUTPUT_DIR / "import_report.txt"
UPLOAD_HANDLES_FILE = OUTPUT_DIR / "upload_handles.txt"
STORIES_JSON = OUTPUT_DIR / "stories_upload.json"
STORIES_REPORT = OUTPUT_DIR / "stories_build_report.txt"
METAFIELDS_JSON = OUTPUT_DIR / "metafields_upload.json"
METAFIELDS_REPORT = OUTPUT_DIR / "metafields_upload_report.txt"
CREATE_REPORT = OUTPUT_DIR / "products_create_report.txt"
UPDATE_REPORT = OUTPUT_DIR / "products_update_report.txt"


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR

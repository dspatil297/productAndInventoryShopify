"""Shared paths for ProductsUpload scripts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"

EXPORT_PATH = ROOT / "AllProductExport.csv"
SAMPLE_PATH = ROOT / "Sample single product.csv"

IMPORT_CSV = OUTPUT_DIR / "ProductImport_Updated.csv"
NEW_PRODUCTS_CSV = OUTPUT_DIR / "NewProducts.csv"
IMPORT_REPORT = OUTPUT_DIR / "import_report.txt"
UPLOAD_HANDLES_FILE = OUTPUT_DIR / "upload_handles.txt"
STORIES_JSON = OUTPUT_DIR / "stories_upload.json"
STORIES_REPORT = OUTPUT_DIR / "stories_build_report.txt"
METAFIELDS_JSON = OUTPUT_DIR / "metafields_upload.json"
METAFIELDS_REPORT = OUTPUT_DIR / "metafields_upload_report.txt"
CREATE_REPORT = OUTPUT_DIR / "products_create_report.txt"
UPDATE_REPORT = OUTPUT_DIR / "products_update_report.txt"


def get_data_dir(cli_data_dir: str | None = None) -> Path:
    """Resolve data directory: CLI arg > ProductData/ default."""
    if cli_data_dir:
        path = Path(cli_data_dir).resolve()
        if not path.is_dir():
            raise NotADirectoryError(f"--data-dir not found: {path}")
        return path
    default = ROOT / "ProductData"
    default.mkdir(parents=True, exist_ok=True)
    return default


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR

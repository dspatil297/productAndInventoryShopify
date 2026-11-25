"""Store config loader — reads store.json from a data directory."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class ExcelCategory:
    canonical_name: str
    keywords: list[str]
    template: str
    category: str
    type: str


@dataclass
class StoreConfig:
    store: str
    vendor: str
    sale_multiplier: float
    excel_categories: list[ExcelCategory]
    frozen_fields: frozenset[str]
    metafield_namespaces: list[str]
    data_dir: Path

    @property
    def category_by_template(self) -> dict[str, str]:
        return {cat.template: cat.category for cat in self.excel_categories}


def load_store_config(data_dir: Path) -> StoreConfig:
    """Load store.json from data_dir. Raises FileNotFoundError if missing."""
    config_path = data_dir / "store.json"
    if not config_path.is_file():
        raise FileNotFoundError(
            f"No store.json found in {data_dir}. "
            "Copy the template from ProductData/store.json and edit it for your store."
        )

    raw: dict[str, Any] = json.loads(config_path.read_text(encoding="utf-8"))

    excel_categories = [
        ExcelCategory(
            canonical_name=canonical,
            keywords=cat_cfg["keywords"],
            template=cat_cfg["template"],
            category=cat_cfg["category"],
            type=cat_cfg["type"],
        )
        for canonical, cat_cfg in raw.get("excel_categories", {}).items()
    ]

    return StoreConfig(
        store=raw["store"],
        vendor=raw.get("vendor", ""),
        sale_multiplier=float(raw.get("sale_multiplier", 0.95)),
        excel_categories=excel_categories,
        frozen_fields=frozenset(raw.get("frozen_fields", [])),
        metafield_namespaces=raw.get("metafield_namespaces", ["custom"]),
        data_dir=data_dir,
    )

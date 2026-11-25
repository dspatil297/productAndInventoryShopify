"""Pick newest Excel per category in a data dir; normalize to canonical filenames.

Now driven by store.json instead of hardcoded category names.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from store_config import StoreConfig, load_store_config


def sync_product_data(config: StoreConfig) -> list[str]:
    data_dir = config.data_dir
    if not data_dir.is_dir():
        data_dir.mkdir(parents=True, exist_ok=True)
        return [f"Created {data_dir.name}/ — drop Excel files here"]

    log: list[str] = []
    all_xlsx = list(data_dir.glob("*.xlsx"))

    for cat in config.excel_categories:
        matches = [
            path
            for path in all_xlsx
            if any(kw in path.name.lower() for kw in cat.keywords)
        ]
        if not matches:
            continue

        newest = max(matches, key=lambda path: path.stat().st_mtime)
        target = data_dir / cat.canonical_name
        if newest.resolve() != target.resolve():
            shutil.copy2(newest, target)
            log.append(f"Synced {newest.name} → {cat.canonical_name}")

        for path in matches:
            if path.resolve() == target.resolve():
                continue
            path.unlink(missing_ok=True)
            log.append(f"Removed duplicate {path.name}")

    return log

"""Pick newest Excel per category in ProductData; normalize to canonical filenames."""

from __future__ import annotations

import shutil
from pathlib import Path

from paths import DATA_DIR

CANONICAL_EXCELS: dict[str, tuple[str, ...]] = {
    "Arthenic_Paintings_Data.xlsx": ("painting", "paintings"),
    "Arthenic_Ethnic_Data.xlsx": ("ethnic",),
    "Arthenic_Jewel_Data.xlsx": ("jewel", "jewellery", "jewelry"),
    "Arthenic_Decor_Data.xlsx": ("decor",),
}


def sync_product_data(data_dir: Path = DATA_DIR) -> list[str]:
    if not data_dir.is_dir():
        data_dir.mkdir(parents=True, exist_ok=True)
        return [f"Created {data_dir.name}/ — drop Excel files here"]

    log: list[str] = []
    all_xlsx = list(data_dir.glob("*.xlsx"))

    for canonical, keywords in CANONICAL_EXCELS.items():
        matches = [
            path
            for path in all_xlsx
            if any(keyword in path.name.lower() for keyword in keywords)
        ]
        if not matches:
            continue

        newest = max(matches, key=lambda path: path.stat().st_mtime)
        target = data_dir / canonical
        if newest.resolve() != target.resolve():
            shutil.copy2(newest, target)
            log.append(f"Synced {newest.name} → {canonical}")

        for path in matches:
            if path.resolve() == target.resolve():
                continue
            path.unlink(missing_ok=True)
            log.append(f"Removed duplicate {path.name}")

    return log

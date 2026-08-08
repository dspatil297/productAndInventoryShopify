# Arthenic product upload

**Store:** `f1qzim-fc.myshopify.com`  
**Folder:** `ProductsUpload/`

---

## You (human)

1. Drop Excel into `ProductData/` — any name with `decor`, `painting`, `ethnic`, or `jewel` in it works (duplicates like `(2)` get merged automatically).
2. Tell the agent: **upload the products** (or name the file).

Canonical names (optional):

| File | Category |
|------|----------|
| `Arthenic_Paintings_Data.xlsx` | Paintings |
| `Arthenic_Ethnic_Data.xlsx` | Ethnic wear |
| `Arthenic_Jewel_Data.xlsx` | Jewellery |
| `Arthenic_Decor_Data.xlsx` | Sculpture / décor |

3. Add product images in Shopify Admin after create (Excel has no images).

**Collection filters:** see [COLLECTION_FILTERS.md](COLLECTION_FILTERS.md) — Excel → `custom.filter_*` metafields → Search & Discovery.

---

## Agent — one command

```powershell
cd "G:\fire fist\Arthenic v2\ProductsUpload"
python upload_products.py --store f1qzim-fc.myshopify.com
```

Dry run (no API):

```powershell
python upload_products.py --dry-run
```

Auth once if 401:

```powershell
shopify store auth --store f1qzim-fc.myshopify.com --scopes write_products
```

---

## What `upload_products.py` does

1. `sync_product_data.py` — newest Excel per category → canonical filename; delete `(2)` copies
2. `build_product_import.py` — Excel + `AllProductExport.csv` → `output/` CSVs + `upload_handles.txt`
3. `create_new_products_shopify.py` — creates products in `output/Arthenic_NewProducts.csv` (new handles only)
4. `build_story_json.py` — maker / process / heritage / styling JSON
5. `upload_metafields_shopify.py` — accordion metafields + stories via Admin GraphQL

---

## Folder layout (keep clean)

| Keep | Purpose |
|------|---------|
| `ProductData/*.xlsx` | Source data you add |
| `AllProductExport.csv` | Shopify baseline export (images, SKUs frozen) |
| `Sample single product.csv` | Metafield column template |
| `upload_products.py` | **Run this** |
| `sync_product_data.py` | Excel normalizer |
| `build_product_import.py` | Excel → CSV |
| `build_story_json.py` | Excel → story JSON |
| `create_new_products_shopify.py` | New products API |
| `upload_metafields_shopify.py` | Metafields API |
| `restore_products_shopify.py` | Emergency restore from export |
| `paths.py` | Shared paths |
| `output/` | Generated CSVs, JSON, reports (gitignored) |

Do **not** commit or hand-edit `output/` — regenerated each run.

---

## Rules

- **Existing products:** title, body, price merge from Excel; images/SKU/tags frozen.
- **New products:** created via API with `product.sculpture` template (décor); paintings/ethnic/jewel need handle mapping in `build_product_import.py` if not slug-matchable.
- **Metafields:** list fields + story JSON **must** go through API (CSV import unreliable).
- **Décor handles:** `DECOR_NAME_HANDLES` in `build_product_import.py` for non-obvious slugs.

---

## Manual / debug

```powershell
python build_product_import.py
python create_new_products_shopify.py --store f1qzim-fc.myshopify.com
python upload_metafields_shopify.py --store f1qzim-fc.myshopify.com --handle wine-boxes-painted
python upload_metafields_shopify.py --store f1qzim-fc.myshopify.com --handles-file output/upload_handles.txt --resume
```

Theme PDP JSON shapes: `docs/ARTHENIC-PDP-METAFIELDS-BY-TEMPLATE.md`

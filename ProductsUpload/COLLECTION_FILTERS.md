# Collection filters — setup

Store filters come from **Shopify Search & Discovery**, not theme code.

## 1. Build filter data from Excel

`build_product_import.py` writes `custom.filter_*` metafields per category:

| Collection | Filter metafields |
|------------|-------------------|
| Paintings | subject, region, style, tradition, material |
| Ethnic | color, fabric, product type, occasion, tradition, region |
| Jewellery | material, jewelry type, occasion, product type |
| Décor | material, product type, tradition, occasion (usage) |

## 2. One-time: create filter definitions

```powershell
cd "G:\fire fist\Arthenic v2\ProductsUpload"
python upload_metafields_shopify.py --store f1qzim-fc.myshopify.com --ensure-filter-definitions
```

Creates `custom.filter_*` metafields with **Storefront filtering** enabled.

## 3. Upload filter values to products

Normal upload pipeline:

```powershell
python upload_products.py --store f1qzim-fc.myshopify.com
```

Or metafields only:

```powershell
python build_product_import.py
python upload_metafields_shopify.py --store f1qzim-fc.myshopify.com --handles-file output/upload_handles.txt
```

## 4. Enable filters in admin

**Shopify Admin → Search & Discovery → Filters → Add filter**

Add only what you need per collection:

| Collection | Recommended filters |
|------------|---------------------|
| Paintings | Price, Availability, Filter subject, Filter region, Filter style |
| Ethnic | Price, Filter color, Filter fabric, Filter occasion, Filter product type |
| Jewellery | Price, Filter material, Filter jewelry type, Filter occasion |
| Décor | Price, Filter material, Filter product type |

**Remove Color** if using `Filter color` instead of the broken `shopify.color-pattern` filter.

Category sidebar (Royal Family, etc.) = **Navigation → main-menu** nested collections. Separate from these filters.

## 5. Sub-collection sidebar

Paintings sub-filters show only when that collection has child collection links in `main-menu`. Ethnic / Jewellery / Décor leaf collections show price + metafield filters only.

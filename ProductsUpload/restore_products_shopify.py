#!/usr/bin/env python3
"""Restore deleted Shopify products from AllProductExport.csv via Admin GraphQL."""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

from upload_metafields_shopify import normalize_store, shopify_execute

ROOT = Path(__file__).resolve().parent
EXPORT_PATH = ROOT / "AllProductExport.csv"
REPORT_PATH = ROOT / "products_restore_report.txt"

PRODUCT_BY_HANDLE = """
query ProductByHandle($handle: String!) {
  productByHandle(handle: $handle) {
    id
    title
    status
  }
}
"""

PRODUCT_CREATE = """
mutation ProductCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      handle
      title
    }
    userErrors {
      field
      message
    }
  }
}
"""

PRODUCT_WITH_VARIANT = """
query ProductWithVariant($handle: String!) {
  productByHandle(handle: $handle) {
    id
    handle
    title
    status
    media(first: 1) {
      edges {
        node {
          id
        }
      }
    }
    variants(first: 1) {
      edges {
        node {
          id
          sku
          price
        }
      }
    }
  }
}
"""

VARIANTS_BULK_UPDATE = """
mutation ProductVariantsBulkUpdate(
  $productId: ID!
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants {
      id
      sku
      price
      compareAtPrice
    }
    userErrors {
      field
      message
    }
  }
}
"""

PRODUCT_UPDATE = """
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      handle
      productType
      tags
    }
    userErrors {
      field
      message
    }
  }
}
"""

PRODUCT_CREATE_MEDIA = """
mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media {
      id
    }
    mediaUserErrors {
      field
      message
    }
    userErrors {
      field
      message
    }
  }
}
"""

PUBLISH_PRODUCT = """
mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
  publishable {
      ... on Product {
        id
        publishedOnCurrentPublication
      }
    }
    userErrors {
      field
      message
    }
  }
}
"""


def load_export_rows(path: Path, handles: set[str]) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    by_handle: dict[str, dict[str, str]] = {}
    for row in rows:
        handle = (row.get("Handle") or "").strip()
        if handle not in handles:
            continue
        if handle not in by_handle:
            by_handle[handle] = row
    return by_handle


def lookup_product(store: str, handle: str, *, token: str | None) -> dict | None:
    result = shopify_execute(
        store,
        PRODUCT_WITH_VARIANT,
        {"handle": handle},
        token=token,
        label=f"lookup {handle}",
    )
    return result.get("productByHandle")


def variant_input_from_row(row: dict[str, str], variant_id: str) -> dict:
    price = (row.get("Variant Price") or "0").strip()
    compare_at = (row.get("Variant Compare At Price") or "").strip()
    sku = (row.get("Variant SKU") or "").strip()
    inventory_policy = (row.get("Variant Inventory Policy") or "deny").strip().lower()
    requires_shipping = (row.get("Variant Requires Shipping") or "true").strip().lower() == "true"
    taxable = (row.get("Variant Taxable") or "true").strip().lower() == "true"
    variant_input: dict = {
        "id": variant_id,
        "price": price,
        "inventoryPolicy": inventory_policy.upper() if inventory_policy in {"deny", "continue"} else "DENY",
        "taxable": taxable,
    }
    if compare_at:
        variant_input["compareAtPrice"] = compare_at
    if sku:
        variant_input["inventoryItem"] = {"sku": sku, "requiresShipping": requires_shipping}
    return variant_input


def product_update_input(product_id: str, row: dict[str, str]) -> dict:
    product_input: dict = {"id": product_id}
    title = (row.get("Title") or "").strip()
    if title:
        product_input["title"] = title
    body = row.get("Body (HTML)") or ""
    if body.strip():
        product_input["descriptionHtml"] = body
    product_type = (row.get("Type") or "").strip()
    if product_type:
        product_input["productType"] = product_type
    tags_raw = (row.get("Tags") or "").strip()
    if tags_raw:
        product_input["tags"] = [tag.strip() for tag in tags_raw.split(",") if tag.strip()]
    return product_input


def sync_product_catalog(store: str, product: dict, row: dict[str, str], *, token: str | None) -> list[str]:
    errors: list[str] = []
    product_id = product["id"]
    update_input = product_update_input(product_id, row)
    if len(update_input) > 1:
        result = shopify_execute(
            store,
            PRODUCT_UPDATE,
            {"input": update_input},
            allow_mutations=True,
            token=token,
            label=f"update product {row.get('Handle', '')}",
        )
        payload = result.get("productUpdate") or {}
        errors.extend(
            e.get("message", "") for e in payload.get("userErrors") or [] if e.get("message")
        )
    errors.extend(sync_existing_product(store, product, row, token=token))
    return errors


def attach_image(store: str, product_id: str, row: dict[str, str], *, token: str | None) -> list[str]:
    image_src = (row.get("Image Src") or "").strip()
    if not image_src:
        return []
    m_result = shopify_execute(
        store,
        PRODUCT_CREATE_MEDIA,
        {
            "productId": product_id,
            "media": [{"originalSource": image_src, "mediaContentType": "IMAGE"}],
        },
        allow_mutations=True,
        token=token,
        label=f"image {row.get('Handle', '')}",
    )
    m_payload = m_result.get("productCreateMedia") or {}
    return [
        e.get("message", "")
        for e in (m_payload.get("mediaUserErrors") or []) + (m_payload.get("userErrors") or [])
        if e.get("message")
    ]


def sync_existing_product(store: str, product: dict, row: dict[str, str], *, token: str | None) -> list[str]:
    errors: list[str] = []
    product_id = product["id"]
    variant_edges = ((product.get("variants") or {}).get("edges") or [])
    if variant_edges:
        variant_id = variant_edges[0]["node"]["id"]
        v_result = shopify_execute(
            store,
            VARIANTS_BULK_UPDATE,
            {
                "productId": product_id,
                "variants": [variant_input_from_row(row, variant_id)],
            },
            allow_mutations=True,
            token=token,
            label=f"update variant {row.get('Handle', '')}",
        )
        v_payload = v_result.get("productVariantsBulkUpdate") or {}
        errors.extend(
            e.get("message", "") for e in v_payload.get("userErrors") or [] if e.get("message")
        )
    media_edges = ((product.get("media") or {}).get("edges") or [])
    if not media_edges:
        errors.extend(attach_image(store, product_id, row, token=token))
    return errors


def create_product(store: str, row: dict[str, str], *, token: str | None) -> tuple[str | None, list[str]]:
    handle = (row.get("Handle") or "").strip()
    title = (row.get("Title") or "").strip()
    body = row.get("Body (HTML)") or ""
    vendor = (row.get("Vendor") or "Arthenic").strip() or "Arthenic"
    product_type = (row.get("Type") or "").strip()
    status = (row.get("Status") or "active").strip().upper()
    if status not in {"ACTIVE", "DRAFT", "ARCHIVED"}:
        status = "ACTIVE"

    product_input: dict = {
        "title": title,
        "handle": handle,
        "descriptionHtml": body,
        "vendor": vendor,
        "status": status,
        "productOptions": [{"name": "Title", "values": [{"name": "Default Title"}]}],
    }
    if product_type:
        product_input["productType"] = product_type

    result = shopify_execute(
        store,
        PRODUCT_CREATE,
        {"product": product_input},
        allow_mutations=True,
        token=token,
        label=f"create {handle}",
    )
    payload = result.get("productCreate") or {}
    errors = [e.get("message", "") for e in payload.get("userErrors") or [] if e.get("message")]
    product = payload.get("product")
    if errors or not product:
        return None, errors or ["productCreate returned no product"]

    product_id = product["id"]
    refreshed = lookup_product(store, handle, token=token) or product
    errors = sync_product_catalog(store, refreshed, row, token=token)
    return product_id, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore products from AllProductExport.csv")
    parser.add_argument("--store", default="f1qzim-fc.myshopify.com")
    parser.add_argument("--handle", action="append", dest="handles", help="Handle to restore (repeatable)")
    parser.add_argument("--token")
    parser.add_argument("--sleep", type=float, default=0.5)
    args = parser.parse_args()

    if not args.handles:
        print("Provide at least one --handle", file=sys.stderr)
        return 1

    store = normalize_store(args.store)
    handles = {h.strip() for h in args.handles if h.strip()}
    rows = load_export_rows(EXPORT_PATH, handles)
    missing = handles - set(rows)
    if missing:
        print(f"Handles not found in {EXPORT_PATH.name}: {', '.join(sorted(missing))}", file=sys.stderr)
        return 1

    lines: list[str] = []
    ok = fail = 0

    for handle in sorted(handles):
        existing = lookup_product(store, handle, token=args.token)
        if existing and existing.get("id"):
            errors = sync_existing_product(store, existing, rows[handle], token=args.token)
            if errors:
                msg = f"FAIL\t{handle}\t{'; '.join(errors)}"
                fail += 1
            else:
                msg = f"SYNC\t{handle}\talready exists, synced\t{existing['id']}"
                ok += 1
            print(msg)
            lines.append(msg)
            continue

        row = rows[handle]
        product_id, errors = create_product(store, row, token=args.token)
        if product_id and not errors:
            msg = f"OK\t{handle}\t{row.get('Title', '')}\t{product_id}"
            ok += 1
        else:
            err = "; ".join(errors) if errors else "unknown error"
            msg = f"FAIL\t{handle}\t{err}"
            fail += 1
        print(msg)
        lines.append(msg)
        time.sleep(args.sleep)

    lines.append(f"\nDone: {ok} ok, {fail} failed (total {len(handles)})")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(lines[-1])
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

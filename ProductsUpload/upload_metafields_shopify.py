#!/usr/bin/env python3
"""Upload Arthenic product metafields via Shopify Admin GraphQL.

Why this exists
---------------
Shopify's standard product CSV import does **not** officially support
``list.single_line_text_field`` (your accordion metafields: product_details,
product_measurements, product_whats_included, etc.). Title/body/price import
from CSV; metafields must be set via Admin API.

Usage
-----
1. Generate CSV first:  python build_product_import.py
2. Auth (once):         shopify store auth --store YOUR-STORE.myshopify.com --scopes write_products
   (or set SHOPIFY_ADMIN_TOKEN / pass --token)
3. Dry run:             python upload_metafields_shopify.py --dry-run
4. Upload:              python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com
   Resume:              python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com --resume
5. One product test:    python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com --handle wine-boxes-painted
6. Story JSON:          python build_story_json.py
7. Upload with stories: python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com --build-stories
8. Stories only:        python upload_metafields_shopify.py --store YOUR-STORE.myshopify.com --stories-only --build-stories
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from paths import (
    CREATE_REPORT,
    IMPORT_CSV,
    METAFIELDS_JSON,
    METAFIELDS_REPORT,
    NEW_PRODUCTS_CSV,
    STORIES_JSON,
    ensure_output_dir,
)

ROOT = Path(__file__).resolve().parent
CSV_PATH = IMPORT_CSV
NEW_PRODUCTS_PATH = NEW_PRODUCTS_CSV
PAYLOAD_PATH = METAFIELDS_JSON
STORIES_PATH = STORIES_JSON
REPORT_PATH = METAFIELDS_REPORT

STORY_JSON_KEYS = (
    "product_maker_story",
    "product_process_story",
    "product_heritage_story",
    "pdp_styling_story",
)

# CSV column -> (namespace, key, Shopify type, split_as_list)
METAFIELD_MAP: list[tuple[str, str, str, str, bool]] = [
    (
        "product_care_instructions (product.metafields.custom.product_care_instructions)",
        "custom",
        "product_care_instructions",
        "list.single_line_text_field",
        True,
    ),
    (
        "product details (product.metafields.custom.product_details)",
        "custom",
        "product_details",
        "list.single_line_text_field",
        True,
    ),
    (
        "product faq (product.metafields.custom.product_faq)",
        "custom",
        "product_faq",
        "list.single_line_text_field",
        True,
    ),
    (
        "product_impact_note (product.metafields.custom.product_impact_note)",
        "custom",
        "product_impact_note",
        "multi_line_text_field",
        False,
    ),
    (
        "product_impact_stats (product.metafields.custom.product_impact_stats)",
        "custom",
        "product_impact_stats",
        "list.single_line_text_field",
        True,
    ),
    (
        "product_measurements (product.metafields.custom.product_measurements)",
        "custom",
        "product_measurements",
        "list.single_line_text_field",
        True,
    ),
    (
        "product_measurement_highlight (product.metafields.custom.product_measurement_highlight)",
        "custom",
        "product_measurement_highlight",
        "multi_line_text_field",
        False,
    ),
    (
        "product_measurement_note (product.metafields.custom.product_measurement_note)",
        "custom",
        "product_measurement_note",
        "multi_line_text_field",
        False,
    ),
    (
        "product_whats_included (product.metafields.custom.product_whats_included)",
        "custom",
        "product_whats_included",
        "list.single_line_text_field",
        True,
    ),
]

FILTER_METAFIELD_MAP: list[tuple[str, str, str, str, bool]] = [
    (
        "filter_color (product.metafields.custom.filter_color)",
        "custom",
        "filter_color",
        "single_line_text_field",
        False,
    ),
    (
        "filter_fabric (product.metafields.custom.filter_fabric)",
        "custom",
        "filter_fabric",
        "single_line_text_field",
        False,
    ),
    (
        "filter_material (product.metafields.custom.filter_material)",
        "custom",
        "filter_material",
        "single_line_text_field",
        False,
    ),
    (
        "filter_subject (product.metafields.custom.filter_subject)",
        "custom",
        "filter_subject",
        "single_line_text_field",
        False,
    ),
    (
        "filter_region (product.metafields.custom.filter_region)",
        "custom",
        "filter_region",
        "single_line_text_field",
        False,
    ),
    (
        "filter_style (product.metafields.custom.filter_style)",
        "custom",
        "filter_style",
        "single_line_text_field",
        False,
    ),
    (
        "filter_tradition (product.metafields.custom.filter_tradition)",
        "custom",
        "filter_tradition",
        "single_line_text_field",
        False,
    ),
    (
        "filter_occasion (product.metafields.custom.filter_occasion)",
        "custom",
        "filter_occasion",
        "list.single_line_text_field",
        True,
    ),
    (
        "filter_product_type (product.metafields.custom.filter_product_type)",
        "custom",
        "filter_product_type",
        "single_line_text_field",
        False,
    ),
    (
        "filter_jewelry_type (product.metafields.custom.filter_jewelry_type)",
        "custom",
        "filter_jewelry_type",
        "single_line_text_field",
        False,
    ),
]

FILTER_METAFIELD_DEFINITIONS: list[tuple[str, str, str]] = [
    ("filter_color", "Filter color", "single_line_text_field"),
    ("filter_fabric", "Filter fabric", "single_line_text_field"),
    ("filter_material", "Filter material", "single_line_text_field"),
    ("filter_subject", "Filter subject", "single_line_text_field"),
    ("filter_region", "Filter region", "single_line_text_field"),
    ("filter_style", "Filter style", "single_line_text_field"),
    ("filter_tradition", "Filter tradition", "single_line_text_field"),
    ("filter_occasion", "Filter occasion", "list.single_line_text_field"),
    ("filter_product_type", "Filter product type", "single_line_text_field"),
    ("filter_jewelry_type", "Filter jewelry type", "single_line_text_field"),
]

PRODUCT_BY_HANDLE = """
query ProductId($handle: String!) {
  productByHandle(handle: $handle) {
    id
    title
  }
}
"""

ADMIN_API_VERSION = "2025-01"
_TOKEN_CACHE: dict[str, str] = {}
_USE_CLI = False


def normalize_store(store: str) -> str:
    host = store.replace("https://", "").replace("http://", "").strip("/")
    if not host.endswith(".myshopify.com"):
        raise ValueError(f"Expected a *.myshopify.com store domain, got: {store}")
    return host


def find_store_access_token(obj: object, store: str) -> str | None:
    if isinstance(obj, dict):
        if obj.get("store") == store and obj.get("accessToken"):
            return str(obj["accessToken"])
        for value in obj.values():
            token = find_store_access_token(value, store)
            if token:
                return token
    elif isinstance(obj, list):
        for item in obj:
            token = find_store_access_token(item, store)
            if token:
                return token
    return None


def load_store_access_token(store: str, explicit: str | None = None) -> str:
    host = normalize_store(store)
    if explicit:
        return explicit.strip()
    if host in _TOKEN_CACHE:
        return _TOKEN_CACHE[host]
    env_token = os.environ.get("SHOPIFY_ADMIN_TOKEN", "").strip()
    if env_token:
        _TOKEN_CACHE[host] = env_token
        return env_token
    config_paths = [
        Path(os.environ.get("APPDATA", ""))
        / "shopify-cli-store-nodejs"
        / "Config"
        / "config.json",
        Path.home() / ".config" / "shopify-cli-store-nodejs" / "config.json",
    ]
    for path in config_paths:
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        token = find_store_access_token(data, host)
        if token:
            _TOKEN_CACHE[host] = token
            return token
    raise RuntimeError(
        f"No Admin API token for {host}. Run:\n"
        f"  shopify store auth --store {host} --scopes write_products\n"
        "or set SHOPIFY_ADMIN_TOKEN / pass --token."
    )


def resolve_shopify_cli() -> list[str]:
    """Return argv prefix for Shopify CLI (prefer node + run.js over shopify.cmd on Windows)."""
    node = shutil.which("node")
    if sys.platform == "win32":
        for name in ("shopify.cmd", "shopify.exe", "shopify"):
            shim = shutil.which(name)
            if not shim:
                continue
            npm_dir = Path(shim).resolve().parent
            run_js = npm_dir / "node_modules" / "@shopify" / "cli" / "bin" / "run.js"
            if node and run_js.is_file():
                return [node, str(run_js)]
            return [shim]
    shim = shutil.which("shopify")
    if shim:
        return [shim]
    raise RuntimeError(
        "shopify CLI not found in PATH. Install: npm install -g @shopify/cli@latest"
    )


METAFIELDS_SET = """
mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      key
      namespace
    }
    userErrors {
      field
      message
    }
  }
}
"""


def clean(text: str) -> str:
    return (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def lines_to_list(text: str) -> list[str]:
    return [line.strip() for line in clean(text).split("\n") if line.strip()]


def encode_metafield_value(raw: str, shopify_type: str, as_list: bool) -> str:
    if as_list or shopify_type.startswith("list."):
        items = lines_to_list(raw)
        return json.dumps(items, ensure_ascii=False)
    return raw


def load_primary_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if clean(r.get("Handle", "")) and clean(r.get("Title", ""))]


def story_fields(stories: dict[str, dict]) -> list[dict]:
    fields: list[dict] = []
    for key in STORY_JSON_KEYS:
        obj = stories.get(key)
        if not obj:
            continue
        fields.append(
            {
                "namespace": "custom",
                "key": key,
                "type": "json",
                "value": json.dumps(obj, ensure_ascii=False),
            }
        )
    return fields


def load_stories_payload(
    path: Path, only_handle: str | None = None
) -> dict[str, list[dict]]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    payload: dict[str, list[dict]] = {}
    for handle, stories in raw.items():
        if only_handle and handle != only_handle:
            continue
        fields = story_fields(stories)
        if fields:
            payload[handle] = fields
    return payload


def merge_payloads(*parts: dict[str, list[dict]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {}
    for part in parts:
        for handle, fields in part.items():
            merged.setdefault(handle, []).extend(fields)
    return merged


METAFIELD_DEFINITION_CREATE = """
mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id key }
    userErrors { field message }
  }
}
"""


def ensure_filter_metafield_definitions(store: str, *, token: str | None = None) -> list[str]:
    host = normalize_store(store)
    messages: list[str] = []
    for key, name, mtype in FILTER_METAFIELD_DEFINITIONS:
        definition = {
            "name": name,
            "namespace": "custom",
            "key": key,
            "ownerType": "PRODUCT",
            "type": mtype,
            "pin": True,
            "capabilities": {"adminFilterable": {"enabled": True}},
        }
        result = graphql_http(
            host,
            METAFIELD_DEFINITION_CREATE,
            {"definition": definition},
            token=token,
            label=f"define {key}",
        )
        payload = cli_field(result, "metafieldDefinitionCreate") or {}
        errors = payload.get("userErrors") or []
        if errors:
            message = errors[0].get("message", "")
            if "taken" in message.lower() or "already" in message.lower():
                messages.append(f"OK exists: custom.{key}")
            else:
                messages.append(f"ERR custom.{key}: {message}")
        else:
            messages.append(f"OK created: custom.{key}")
    return messages


def build_payload(rows: list[dict[str, str]], only_handle: str | None = None) -> dict[str, list[dict]]:
    field_maps = METAFIELD_MAP + FILTER_METAFIELD_MAP
    payload: dict[str, list[dict]] = {}
    for row in rows:
        handle = clean(row["Handle"])
        if only_handle and handle != only_handle:
            continue
        fields: list[dict] = []
        for col, namespace, key, mtype, as_list in field_maps:
            raw = clean(row.get(col, ""))
            if not raw:
                continue
            fields.append(
                {
                    "namespace": namespace,
                    "key": key,
                    "type": mtype,
                    "value": encode_metafield_value(raw, mtype, as_list),
                }
            )
        if fields:
            payload[handle] = fields
    return payload


def cli_field(data: dict, key: str) -> dict | list | None:
    """CLI returns fields at top level; HTTP Admin API nests them under data."""
    if key in data:
        return data[key]
    return data.get("data", {}).get(key)


def graphql_http(
    store: str,
    query: str,
    variables: dict | None = None,
    *,
    token: str | None = None,
    timeout: int = 60,
    label: str = "",
    retries: int = 3,
) -> dict:
    host = normalize_store(store)
    access_token = load_store_access_token(host, token)
    url = f"https://{host}/admin/api/{ADMIN_API_VERSION}/graphql.json"
    payload = {"query": query.strip()}
    if variables is not None:
        payload["variables"] = variables
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        if label:
            suffix = f" (attempt {attempt}/{retries})" if attempt > 1 else ""
            print(f"  {label}{suffix}...", flush=True)
        t0 = time.time()
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": access_token,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
            result = json.loads(raw)
            if result.get("errors"):
                messages = "; ".join(
                    err.get("message", str(err)) for err in result["errors"]
                )
                raise RuntimeError(messages)
            if label:
                print(f"  {label} done in {time.time() - t0:.1f}s", flush=True)
            return result.get("data", result)
        except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < retries:
                wait = min(2**attempt, 15)
                print(f"  retry in {wait}s ({exc})", flush=True)
                time.sleep(wait)
    raise RuntimeError(f"{label or 'GraphQL'} failed after {retries} tries: {last_error}")


def shopify_cli_execute(
    store: str,
    query: str,
    variables: dict | None = None,
    *,
    allow_mutations: bool = False,
    timeout: int = 180,
    label: str = "",
) -> dict:
    """Run Admin GraphQL via Shopify CLI (slow on Windows; use only with --use-cli)."""
    shopify_cli = resolve_shopify_cli()
    query_path = ""
    variables_path = ""
    output_path = ""
    query_file = tempfile.NamedTemporaryFile(
        mode="w", suffix=".graphql", delete=False, encoding="utf-8"
    )
    proc: subprocess.CompletedProcess[str] | None = None
    try:
        query_file.write(query.strip())
        query_file.close()
        query_path = query_file.name
        with tempfile.NamedTemporaryFile(
            suffix=".json", delete=False
        ) as out_file:
            output_path = out_file.name
        cmd = [
            *shopify_cli,
            "store",
            "execute",
            "--store",
            store,
            "--query-file",
            query_path,
            "--json",
            "--no-color",
            "--output-file",
            output_path,
        ]
        if variables is not None:
            # Windows cmd.exe breaks on large --variables JSON; use a file instead.
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False, encoding="utf-8"
            ) as var_file:
                json.dump(variables, var_file, ensure_ascii=False)
                variables_path = var_file.name
            cmd.extend(["--variable-file", variables_path])
        if allow_mutations:
            cmd.append("--allow-mutations")
        if label:
            print(f"  {label} (Shopify CLI, up to {timeout}s)...", flush=True)
        t0 = time.time()
        proc = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
            timeout=timeout,
        )
        if label:
            print(f"  {label} done in {time.time() - t0:.1f}s", flush=True)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Shopify CLI timed out after {timeout}s"
            + (f" during {label}" if label else "")
            + " — stop other shopify/python upload processes and retry."
        ) from exc
    finally:
        if query_path:
            os.unlink(query_path)
        if variables_path:
            os.unlink(variables_path)
    if proc is None or proc.returncode != 0:
        detail = ""
        if output_path and os.path.exists(output_path):
            detail = Path(output_path).read_text(encoding="utf-8").strip()[:500]
        raise RuntimeError(
            (detail or "shopify store execute failed")
            + (f" during {label}" if label else "")
        )
    raw = Path(output_path).read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Non-JSON CLI output:\n{raw}") from exc
    finally:
        if output_path and os.path.exists(output_path):
            os.unlink(output_path)


def shopify_execute(
    store: str,
    query: str,
    variables: dict | None = None,
    *,
    allow_mutations: bool = False,
    timeout: int = 60,
    label: str = "",
    token: str | None = None,
) -> dict:
    if _USE_CLI:
        return shopify_cli_execute(
            store,
            query,
            variables,
            allow_mutations=allow_mutations,
            timeout=max(timeout, 180),
            label=label,
        )
    return graphql_http(
        store,
        query,
        variables,
        token=token,
        timeout=timeout,
        label=label,
    )


def product_gid(store: str, handle: str, token: str | None = None) -> str | None:
    data = shopify_execute(
        store,
        PRODUCT_BY_HANDLE,
        {"handle": handle},
        label="Looking up product",
        token=token,
    )
    product = cli_field(data, "productByHandle")
    return product.get("id") if product else None


def upload_handle(
    store: str, handle: str, fields: list[dict], token: str | None = None
) -> list[str]:
    gid = product_gid(store, handle, token=token)
    if not gid:
        return [f"{handle}: product not found in store"]
    errors: list[str] = []
    # API limit: 25 metafields per call
    for i in range(0, len(fields), 25):
        chunk = fields[i : i + 25]
        metafields = [
            {
                "ownerId": gid,
                "namespace": f["namespace"],
                "key": f["key"],
                "type": f["type"],
                "value": f["value"],
            }
            for f in chunk
        ]
        data = shopify_execute(
            store,
            METAFIELDS_SET,
            {"metafields": metafields},
            allow_mutations=True,
            label=f"Setting {len(chunk)} metafield(s)",
            token=token,
        )
        result = cli_field(data, "metafieldsSet") or {}
        user_errors = result.get("userErrors", [])
        for err in user_errors:
            errors.append(f"{handle}: {err.get('message', err)}")
    return errors


def load_completed_handles(report_path: Path) -> set[str]:
    if not report_path.exists():
        return set()
    done: set[str] = set()
    for line in report_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("OK "):
            # "OK handle (N metafields)"
            done.add(line.split()[1])
    return done


def append_report_line(report_path: Path, line: str) -> None:
    with report_path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload Arthenic metafields to Shopify")
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    parser.add_argument("--store", help="Store domain, e.g. arthenic.myshopify.com")
    parser.add_argument("--handle", help="Upload a single handle only (recommended for first test)")
    parser.add_argument(
        "--handles-file",
        type=Path,
        help="Upload only handles listed one per line (from output/upload_handles.txt)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Write JSON payload only; no API calls")
    parser.add_argument("--sleep", type=float, default=0.35, help="Seconds between products")
    parser.add_argument(
        "--stories-file",
        type=Path,
        default=STORIES_PATH,
        help="Story JSON payload (from build_story_json.py)",
    )
    parser.add_argument(
        "--stories-only",
        action="store_true",
        help="Upload only JSON story metafields, not CSV accordion fields",
    )
    parser.add_argument(
        "--no-stories",
        action="store_true",
        help="Skip story JSON even if stories_upload.json exists",
    )
    parser.add_argument(
        "--build-stories",
        action="store_true",
        help="Run build_story_json.py before upload",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip handles already marked OK in metafields_upload_report.txt",
    )
    parser.add_argument(
        "--ensure-filter-definitions",
        action="store_true",
        help="Create custom filter_* metafield definitions (filterable in Search & Discovery)",
    )
    parser.add_argument(
        "--token",
        help="Admin API access token (default: SHOPIFY_ADMIN_TOKEN or shopify store auth cache)",
    )
    parser.add_argument(
        "--use-cli",
        action="store_true",
        help="Use Shopify CLI subprocess instead of direct HTTP (not recommended on Windows)",
    )
    args = parser.parse_args()

    global _USE_CLI
    _USE_CLI = args.use_cli

    ensure_output_dir()

    if args.ensure_filter_definitions:
        if not args.store:
            print("--ensure-filter-definitions requires --store", file=sys.stderr)
            return 1
        for line in ensure_filter_metafield_definitions(args.store, token=args.token):
            print(line)
        return 0

    if args.build_stories:
        import build_story_json

        if build_story_json.main() != 0:
            return 1

    csv_payload: dict[str, list[dict]] = {}
    if not args.stories_only:
        if not args.csv.exists():
            print(f"Missing CSV: {args.csv}. Run build_product_import.py first.", file=sys.stderr)
            return 1
        rows = load_primary_rows(args.csv)
        if NEW_PRODUCTS_PATH.exists():
            extra = load_primary_rows(NEW_PRODUCTS_PATH)
            seen = {clean(r.get("Handle", "")) for r in rows}
            rows.extend(r for r in extra if clean(r.get("Handle", "")) not in seen)
            if extra:
                print(f"Merged {len(extra)} row(s) from {NEW_PRODUCTS_PATH.name}")
        csv_payload = build_payload(rows, args.handle)

    handles_filter: set[str] | None = None
    if args.handles_file:
        if not args.handles_file.is_file():
            print(f"Missing handles file: {args.handles_file}", file=sys.stderr)
            return 1
        handles_filter = {
            line.strip()
            for line in args.handles_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }
    elif args.handle:
        handles_filter = {args.handle}

    stories_payload: dict[str, list[dict]] = {}
    if not args.no_stories:
        story_handle = args.handle if not args.handles_file else None
        stories_payload = load_stories_payload(args.stories_file, story_handle)
        if stories_payload:
            print(
                f"Loaded {args.stories_file.name} "
                f"({len(stories_payload)} products with story JSON)"
            )
        elif not args.stories_only:
            print(f"No story file at {args.stories_file} — accordion metafields only.")

    payload = merge_payloads(csv_payload, stories_payload)
    if handles_filter:
        payload = {h: fields for h, fields in payload.items() if h in handles_filter}
    if not payload:
        print("Nothing to upload.", file=sys.stderr)
        return 1

    PAYLOAD_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {PAYLOAD_PATH} ({len(payload)} products with metafield data)")

    if args.dry_run:
        print("Dry run complete — no API calls.")
        return 0

    if not args.store:
        print("Pass --store YOUR-STORE.myshopify.com to upload, or use --dry-run.", file=sys.stderr)
        return 1

    completed = load_completed_handles(REPORT_PATH) if args.resume else set()
    if args.resume and completed:
        print(f"Resuming — skipping {len(completed)} handle(s) already OK in {REPORT_PATH.name}")

    items = sorted(payload.items())
    total = len(items)
    ok = len(completed) if args.resume else 0
    failed = 0
    if not args.resume:
        REPORT_PATH.write_text("", encoding="utf-8")

    for n, (handle, fields) in enumerate(items, start=1):
        if handle in completed:
            print(f"[{n}/{total}] SKIP {handle} (already OK)", flush=True)
            continue
        print(
            f"[{n}/{total}] Uploading {handle} ({len(fields)} metafields)...",
            flush=True,
        )
        try:
            errs = upload_handle(args.store, handle, fields, token=args.token)
        except RuntimeError as exc:
            line = f"FAILED {handle}: {exc}"
            append_report_line(REPORT_PATH, line)
            failed += 1
            print(f"  {line}", flush=True)
            continue
        if errs:
            for err in errs:
                append_report_line(REPORT_PATH, err)
            failed += 1
            print(f"  FAILED {handle}", flush=True)
        else:
            ok += 1
            line = f"OK {handle} ({len(fields)} metafields)"
            append_report_line(REPORT_PATH, line)
            print(f"  {line}", flush=True)
        time.sleep(args.sleep)

    print(f"Uploaded {ok}/{total} products ({failed} failed). Report: {REPORT_PATH}")
    if failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""
Update `door_frame` (CSV of pure item_codes) on BOM/BOM Creator and
their items child tables, applying the 2026-05-07 ALTO mapping.

Even though the underlying Item rename only renamed KR Items, India
BOMs reference the same AT-* codes as string literals (assemblies are
shared / copied). Those references must be updated too.

Coverage (per scoped company):
  - BOM Creator Item.door_frame: Hinge / Keeper / OPT assemblies only
  - BOM Item.door_frame: every BOM (no prefix filter)
  - BOM Creator.door_frame: every doc
  - BOM.door_frame: every doc

Token-exact replacement (split on `,`, map per token, rejoin) so longer
codes that happen to share a prefix with a mapping key are never
clobbered.

Paired with: clestra_app.patches.update_item_code_ALTO_260507
"""
import frappe
from frappe.custom.doctype.property_setter.property_setter import (
    make_property_setter,
)

from clestra_app.patches.update_item_code_ALTO_260507 import MAPPING


SCOPE_ABBRS = ["KR", "IN"]


CHILD_TARGETS = [
    (
        "BOM Creator Item",
        "tabBOM Creator Item",
        "tabBOM Creator",
        "(p.name LIKE 'Hinge-%%' OR p.name LIKE 'Keeper-%%' OR p.name LIKE 'OPT-%%')",
        (),
        "BOM Creator Item",
    ),
    (
        "BOM Item",
        "tabBOM Item",
        "tabBOM",
        "1=1",
        (),
        "BOM Item",
    ),
]

PARENT_TARGETS = [
    ("BOM Creator", "tabBOM Creator", "BOM Creator (parent)"),
    ("BOM", "tabBOM", "BOM (parent)"),
]

# Already extended by update_bom_door_frame_item_codes_260424; keep for safety.
DOOR_FRAME_LENGTH = 500


def execute():
    companies = []
    for abbr in SCOPE_ABBRS:
        name = frappe.db.get_value("Company", {"abbr": abbr}, "name")
        if name:
            companies.append(name)
        else:
            print(f"No Company with abbr={abbr}; skipping.")
    if not companies:
        return

    code_map = dict(MAPPING)

    for doctype, table, *_ in CHILD_TARGETS:
        _ensure_door_frame_length(doctype, table, DOOR_FRAME_LENGTH)
    for doctype, table, _ in PARENT_TARGETS:
        _ensure_door_frame_length(doctype, table, DOOR_FRAME_LENGTH)

    grand_changed = 0
    for company in companies:
        print(f"\n--- {company} ---")
        company_changed = 0

        for _, child_tbl, parent_tbl, where, where_args, label in CHILD_TARGETS:
            rows = frappe.db.sql(
                f"SELECT c.name, c.door_frame "
                f"FROM `{child_tbl}` c "
                f"JOIN `{parent_tbl}` p ON p.name = c.parent "
                f"WHERE c.door_frame IS NOT NULL AND c.door_frame <> '' "
                f"  AND p.company = %s "
                f"  AND {where}",
                (company, *where_args),
                as_dict=True,
            )
            changed = _rewrite_rows(child_tbl, rows, code_map)
            company_changed += changed
            print(f"  {label}: scanned={len(rows)}, changed={changed}")

        for _, table, label in PARENT_TARGETS:
            rows = frappe.db.sql(
                f"SELECT name, door_frame FROM `{table}` "
                f"WHERE company = %s "
                f"  AND door_frame IS NOT NULL AND door_frame <> ''",
                (company,),
                as_dict=True,
            )
            changed = _rewrite_rows(table, rows, code_map)
            company_changed += changed
            print(f"  {label}: scanned={len(rows)}, changed={changed}")

        print(f"  subtotal: {company_changed}")
        grand_changed += company_changed

    frappe.db.commit()
    print(f"\nDone. Total rows changed: {grand_changed}")


def _rewrite_rows(table, rows, code_map):
    changed = 0
    for r in rows:
        new_value = _rewrite_csv(r.door_frame, code_map)
        if new_value != r.door_frame:
            frappe.db.sql(
                f"UPDATE `{table}` SET door_frame = %s WHERE name = %s",
                (new_value, r.name),
            )
            changed += 1
    return changed


def _ensure_door_frame_length(doctype, table, length):
    if not frappe.db.exists(
        "Property Setter",
        {
            "doc_type": doctype,
            "field_name": "door_frame",
            "property": "length",
        },
    ):
        make_property_setter(
            doctype,
            "door_frame",
            "length",
            str(length),
            "Int",
            for_doctype=False,
            validate_fields_for_doctype=False,
        )
        print(f"  Property Setter set: {doctype}.door_frame.length = {length}")

    current = frappe.db.sql(
        "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = %s "
        "  AND column_name = 'door_frame'",
        (table,),
    )
    if current and current[0][0] and current[0][0] < length:
        frappe.db.commit()
        frappe.db.sql_ddl(
            f"ALTER TABLE `{table}` MODIFY COLUMN door_frame VARCHAR({length})"
        )
        print(f"  ALTER {table}.door_frame -> VARCHAR({length})")


def _rewrite_csv(value, code_map):
    """Token-exact rewrite of a comma-separated item_code list."""
    parts = value.split(",")
    new_parts = []
    for raw in parts:
        token = raw.strip()
        mapped = code_map.get(token, token)
        if raw != token:
            lead = raw[: len(raw) - len(raw.lstrip())]
            tail = raw[len(raw.rstrip()):]
            new_parts.append(f"{lead}{mapped}{tail}")
        else:
            new_parts.append(mapped)
    return ",".join(new_parts)

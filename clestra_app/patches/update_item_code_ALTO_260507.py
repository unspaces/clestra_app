"""
Apply item_code renames per the 2026-05-07 ALTO mapping table.

Scope: Clestra Korea items only (company_abbr = 'KR'); AT-* items live
in the KR namespace per current data.

Pairs with `clestra_app.utils.item_rename` doc_event hook which auto-
syncs Formula Library on each rename. BOM / BOM Creator door_frame
fields are handled by `update_bom_door_frame_item_codes_ALTO_260507`.
"""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


OLD_ITEM_CODE_FIELD = {
    "fieldname": "old_item_code",
    "label": "Old Item Code",
    "fieldtype": "Data",
    "insert_after": "item_code",
    "read_only": 1,
    "translatable": 0,
    "no_copy": 1,
    "description": "Previous item_code preserved before a rename migration.",
}


SCOPE_ABBR = "KR"

MAPPING = [
    ("AT-DGPDU-C26N-B", "AT-P1B-P-C26-DG-44-B"),
    ("AT-DGPDU-C26N-P", "AT-P1B-P-C26-DG-44-P"),
    ("AT-DGPDU-C26-B", "AT-P1B-P-C26-DG-4054-B"),
    ("AT-DGPDU-C26-P", "AT-P1B-P-C26-DG-4054-P"),
    ("AT-DGPDU-C32N-B", "AT-P1B-P-C32-DG-44-B"),
    ("AT-DGPDU-C32N-P", "AT-P1B-P-C32-DG-44-P"),
    ("AT-DGPDU-C32-B", "AT-P1B-P-C32-DG-4054-B"),
    ("AT-DGPDU-C32-P", "AT-P1B-P-C32-DG-4054-P"),
    ("AT-DGSDU-C26N-B", "AT-P1B-C26-DG-44-B"),
    ("AT-DGSDU-C26N-P", "AT-P1B-C26-DG-44-P"),
    ("AT-DGSDU-C26-B", "AT-P1B-C26-DG-4054-B"),
    ("AT-DGSDU-C26-P", "AT-P1B-C26-DG-4054-P"),
    ("AT-DGTPDU-C26N-B", "AT-P1B-P-C26-DGT-44-B"),
    ("AT-DGTPDU-C26N-P", "AT-P1B-P-C26-DGT-44-P"),
    ("AT-DGTPDU-C26-B", "AT-P1B-P-C26-DGT-4054-B"),
    ("AT-DGTPDU-C26-P", "AT-P1B-P-C26-DGT-4054-P"),
    ("AT-DGTSDU-C26N-B", "AT-P1B-C26-DGT-44-B"),
    ("AT-DGTSDU-C26N-P", "AT-P1B-C26-DGT-44-P"),
    ("AT-FPDU-C26N-B", "AT-P1B-P-C26-44-B"),
    ("AT-FPDU-C26N-P", "AT-P1B-P-C26-44-P"),
    ("AT-FPDU-C26-B", "AT-P1B-P-C26-4054-B"),
    ("AT-FPDU-C26-P", "AT-P1B-P-C26-4054-P"),
    ("AT-FPDU-C32N-B", "AT-P1B-P-C32-44-B"),
    ("AT-FPDU-C32N-P", "AT-P1B-P-C32-44-P"),
    ("AT-FPDU-C32-B", "AT-P1B-P-C32-4054-B"),
    ("AT-FPDU-C32-P", "AT-P1B-P-C32-4054-P"),
    ("AT-FSDU-C26N-B", "AT-P1B-C26-44-B"),
    ("AT-FSDU-C26N-P", "AT-P1B-C26-44-P"),
    ("AT-FSDU-C26-B", "AT-P1B-C26-4054-B"),
    ("AT-FSDU-C26-P", "AT-P1B-C26-4054-P"),
    ("AT-FSDU-C32N-B", "AT-P1B-C32-44-B"),
    ("AT-FSDU-C32N-P", "AT-P1B-C32-44-P"),
    ("AT-FSDU-C32-70-B", "AT-P1B-C32-70-B"),
    ("AT-FSDU-C32-70-P", "AT-P1B-C32-70-P"),
    ("AT-FSDU-C32-B", "AT-P1B-C32-4054-B"),
    ("AT-FSDU-C32-P", "AT-P1B-C32-4054-P"),
    ("AT-P81-P1-PDU-B", "AT-P81-P1-P-ST-4483-B"),
    ("AT-P81-P1-PDU-P", "AT-P81-P1-P-ST-4483-P"),
    ("AT-PDU-C26-B", "AT-P1B-P-C26-ST-4054-B"),
    ("AT-PDU-C26-P", "AT-P1B-P-C26-ST-4054-P"),
    ("AT-SGPDU-C26N-B", "AT-P1B-P-C26-SG-44-B"),
    ("AT-SGPDU-C26N-P", "AT-P1B-P-C26-SG-44-P"),
    ("AT-SGPDU-C26-B", "AT-P1B-P-C26-SG-4054-B"),
    ("AT-SGPDU-C26-P", "AT-P1B-P-C26-SG-4054-P"),
    ("AT-SGPDU-C32N-B", "AT-P1B-P-C32-SG-44-B"),
    ("AT-SGPDU-C32N-P", "AT-P1B-P-C32-SG-44-P"),
    ("AT-SGPDU-C32-B", "AT-P1B-P-C32-SG-4054-B"),
    ("AT-SGPDU-C32-P", "AT-P1B-P-C32-SG-4054-P"),
    ("AT-SGSDU-C26N-B", "AT-P1B-C26-SG-44-B"),
    ("AT-SGSDU-C26N-P", "AT-P1B-C26-SG-44-P"),
    ("AT-SGTPDU-C26N-B", "AT-P1B-P-C26-SGT-44-B"),
    ("AT-SGTPDU-C26N-P", "AT-P1B-P-C26-SGT-44-P"),
    ("AT-SGTPDU-C26-B", "AT-P1B-P-C26-SGT-4054-B"),
    ("AT-SGTPDU-C26-P", "AT-P1B-P-C26-SGT-4054-P"),
    ("AT-SGTSDU-C26N-B", "AT-P1B-C26-SGT-44-B"),
    ("AT-SGTSDU-C26N-P", "AT-P1B-C26-SGT-44-P"),
]


def execute():
    frappe.db.MAX_WRITES_PER_TRANSACTION = 50_000_000

    if not frappe.db.exists(
        "Custom Field", {"dt": "Item", "fieldname": "old_item_code"}
    ):
        create_custom_field("Item", OLD_ITEM_CODE_FIELD)
        print("Created Custom Field: Item.old_item_code")

    renamed = 0
    skipped = 0
    not_found = 0
    failed = 0
    for old_code, new_code in MAPPING:
        rows = frappe.db.sql(
            """
            SELECT name, item_code, item_name, company_abbr
            FROM `tabItem`
            WHERE item_code = %s AND company_abbr = %s
            """,
            (old_code, SCOPE_ABBR),
            as_dict=True,
        )

        if not rows:
            print(f"NotFound: {old_code} (abbr={SCOPE_ABBR})")
            not_found += 1
            continue

        for item in rows:
            abbr = item.company_abbr.strip()
            item_name = item.item_name
            current_code = item.item_code
            new_name = f"{abbr}-{new_code}"

            if new_name == item.name:
                continue

            if frappe.db.exists("Item", new_name):
                print(f"Skip {item.name} -> {new_name}: target already exists")
                skipped += 1
                continue

            try:
                frappe.db.set_value(
                    "Item",
                    item.name,
                    "old_item_code",
                    current_code,
                    update_modified=False,
                )

                frappe.rename_doc(
                    "Item", item.name, new_name, force=True, merge=False
                )

                restore = {"item_code": new_code}
                if item_name is not None:
                    restore["item_name"] = item_name
                frappe.db.set_value(
                    "Item", new_name, restore, update_modified=False
                )
                frappe.db.commit()
                renamed += 1
                print(f"Renamed {item.name} -> {new_name}")
            except Exception as e:
                frappe.db.rollback()
                print(f"Failed {item.name} -> {new_name}: {e}")
                failed += 1

    print(
        f"Done. Renamed: {renamed}, Skipped: {skipped}, "
        f"NotFound: {not_found}, Failed: {failed}"
    )

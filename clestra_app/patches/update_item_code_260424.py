"""
Apply item_code renames per the 2026-04-24 mapping table.

Scope: Clestra Korea items only (company_abbr = 'KR').
For each (old_code, new_code):
  - Find Item with item_code = old_code AND company_abbr = 'KR'
  - Save current item_code to `old_item_code` Custom Field (created on first run)
  - Rename name `KR-{old_code}` -> `KR-{new_code}`
  - Update item_code to new_code, preserve item_name
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
    ("MP-DGPDU-C26N-B", "MP-P1B-P-C26-DG-44-B"),
    ("MP-DGPDU-C26N-P", "MP-P1B-P-C26-DG-44-P"),
    ("MP-DGPDU-C26-B", "MP-P1B-P-C26-DG-4054-B"),
    ("MP-DGPDU-C26-P", "MP-P1B-P-C26-DG-4054-P"),
    ("MP-DGPDU-C32N-B", "MP-P1B-P-C32-DG-44-B"),
    ("MP-DGPDU-C32N-P", "MP-P1B-P-C32-DG-44-P"),
    ("MP-DGPDU-C32-B", "MP-P1B-P-C32-DG-4054-B"),
    ("MP-DGPDU-C32-P", "MP-P1B-P-C32-DG-4054-P"),
    ("MP-DGSDU-C26N-B", "MP-P1B-C26-DG-44-B"),
    ("MP-DGSDU-C26N-P", "MP-P1B-C26-DG-44-P"),
    ("MP-DGSDU-C26-B", "MP-P1B-C26-DG-4054-B"),
    ("MP-DGSDU-C26-P", "MP-P1B-C26-DG-4054-P"),
    ("MP-DGSDU-C32N-B", "MP-P1B-C32-DG-44-B"),
    ("MP-DGSDU-C32N-P", "MP-P1B-C32-DG-44-P"),
    ("MP-DGSDU-C32-B", "MP-P1B-C32-DG-4054-B"),
    ("MP-DGSDU-C32-P", "MP-P1B-C32-DG-4054-P"),
    ("MP-DGTPDU-C26N-B", "MP-P1B-P-C26-DGT-44-B"),
    ("MP-DGTPDU-C26N-P", "MP-P1B-P-C26-DGT-44-P"),
    ("MP-DGTPDU-C26-B", "MP-P1B-P-C26-DGT-4054-B"),
    ("MP-DGTPDU-C26-P", "MP-P1B-P-C26-DGT-4054-P"),
    ("MP-DGTSDU-C26N-B", "MP-P1B-C26-DGT-44-B"),
    ("MP-DGTSDU-C26N-P", "MP-P1B-C26-DGT-44-P"),
    ("MP-DGTSDU-C26-B", "MP-P1B-C26-DGT-4054-B"),
    ("MP-DGTSDU-C26-P", "MP-P1B-C26-DGT-4054-P"),
    ("MP-FGSDU-C26-B", "MP-P1B-C26-FG-4054-B"),
    ("MP-FGSDU-C26-P", "MP-P1B-C26-FG-4054-P"),
    ("MP-FPDU-C26N-B", "MP-P1B-P-C26-44-B"),
    ("MP-FPDU-C26N-P", "MP-P1B-P-C26-44-P"),
    ("MP-FPDU-C26-B", "MP-P1B-P-C26-4054-B"),
    ("MP-FPDU-C26-P", "MP-P1B-P-C26-4054-P"),
    ("MP-FPDU-C32N-B", "MP-P1B-P-C32-44-B"),
    ("MP-FPDU-C32N-P", "MP-P1B-P-C32-44-P"),
    ("MP-FPDU-C32-70B", "MP-P1B-P-C32-70-B"),
    ("MP-FPDU-C32-70P", "MP-P1B-P-C32-70-P"),
    ("MP-FPDU-C32-B", "MP-P1B-P-C32-4054-B"),
    ("MP-FPDU-C32-P", "MP-P1B-P-C32-4054-P"),
    ("MP-FPDU-C42-B", "MP-P1B-P-C42-83-B"),
    ("MP-FSDU-C26N-B", "MP-P1B-C26-44-B"),
    ("MP-FSDU-C26N-P", "MP-P1B-C26-44-P"),
    ("MP-FSDU-C26-B", "MP-P1B-C26-4054-B"),
    ("MP-FSDU-C26-P", "MP-P1B-C26-4054-P"),
    ("MP-FSDU-C32N-B", "MP-P1B-C32-44-B"),
    ("MP-FSDU-C32N-P", "MP-P1B-C32-44-P"),
    ("MP-FSDU-C32-70B", "MP-P1B-C32-70-B"),
    ("MP-FSDU-C32-70P", "MP-P1B-C32-70-P"),
    ("MP-FSDU-C32-B", "MP-P1B-C32-4054-B"),
    ("MP-FSDU-C32-P", "MP-P1B-C32-4054-P"),
    ("MP-FSDU-C42-B", "MP-P1B-C42-83-B"),
    ("MP-GDU-C42-B", "MP-P1B-C42-DG-83-B"),
    ("MP-P81-P1B-SDU-B", "MP-P81-P1B-ST-4054-B"),
    ("MP-P81-P1B-SDU-P", "MP-P81-P1B-ST-4054-P"),
    ("MP-P81-P1-PDU-B", "MP-P81-P1-P-ST-4483-B"),
    ("MP-P81-P1-PDU-P", "MP-P81-P1-P-ST-4483-P"),
    ("MP-P81-P1-SDU-B", "MP-P81-P1-ST-4483-B"),
    ("MP-P81-P1-SDU-P", "MP-P81-P1-ST-4483-P"),
    ("MP-PDU-C26-B", "MP-P1B-P-C26-ST-4054-B"),
    ("MP-PDU-C26-P", "MP-P1B-P-C26-ST-4054-P"),
    ("MP-SDU54T-C26-B", "MP-P1B-C26-ST54-4054-B"),
    ("MP-SDU54T-C26-P", "MP-P1B-C26-ST54-4054-P"),
    ("MP-SDU-C26-B", "MP-P1B-C26-ST-4054-B"),
    ("MP-SDU-C26-P", "MP-P1B-C26-ST-4054-P"),
    ("MP-SGPDU-C26N-B", "MP-P1B-P-C26-SG-44-B"),
    ("MP-SGPDU-C26N-P", "MP-P1B-P-C26-SG-44-P"),
    ("MP-SGPDU-C26-B", "MP-P1B-P-C26-SG-4054-B"),
    ("MP-SGPDU-C26-P", "MP-P1B-P-C26-SG-4054-P"),
    ("MP-SGPDU-C32N-B", "MP-P1B-P-C32-SG-44-B"),
    ("MP-SGPDU-C32N-P", "MP-P1B-P-C32-SG-44-P"),
    ("MP-SGPDU-C32-B", "MP-P1B-P-C32-SG-4054-B"),
    ("MP-SGPDU-C32-P", "MP-P1B-P-C32-SG-4054-P"),
    ("MP-SGSDU-C26N-B", "MP-P1B-C26-SG-44-B"),
    ("MP-SGSDU-C26N-P", "MP-P1B-C26-SG-44-P"),
    ("MP-SGSDU-C26-B", "MP-P1B-C26-SG-4054-B"),
    ("MP-SGSDU-C26-P", "MP-P1B-C26-SG-4054-P"),
    ("MP-SGSDU-C32N-B", "MP-P1B-C32-SG-44-B"),
    ("MP-SGSDU-C32N-P", "MP-P1B-C32-SG-44-P"),
    ("MP-SGSDU-C32-B", "MP-P1B-C32-SG-4054-B"),
    ("MP-SGSDU-C32-P", "MP-P1B-C32-SG-4054-P"),
    ("MP-SGTPDU-C26N-B", "MP-P1B-P-C26-SGT-44-B"),
    ("MP-SGTPDU-C26N-P", "MP-P1B-P-C26-SGT-44-P"),
    ("MP-SGTPDU-C26-B", "MP-P1B-P-C26-SGT-4054-B"),
    ("MP-SGTPDU-C26-P", "MP-P1B-P-C26-SGT-4054-P"),
    ("MP-SGTSDU-C26N-B", "MP-P1B-C26-SGT-44-B"),
    ("MP-SGTSDU-C26N-P", "MP-P1B-C26-SGT-44-P"),
    ("MP-SGTSDU-C26-B", "MP-P1B-C26-SGT-4054-B"),
    ("MP-SGTSDU-C26-P", "MP-P1B-C26-SGT-4054-P"),
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
                # Save current item_code to old_item_code BEFORE rename,
                # since rename_doc's after_rename overwrites item_code.
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
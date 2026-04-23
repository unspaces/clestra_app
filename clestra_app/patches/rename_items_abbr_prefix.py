"""
Rename Item.name from `{item_code}-{company_abbr}` (or any current form) to
`{company_abbr}-{item_code}`.

ERPNext's Item rename hooks mutate item_name (before_rename, when it equals
old name) and item_code (after_rename, always). Per request, both fields must
be preserved — so we snapshot them, rename, then restore.
"""
import frappe


def execute():
    frappe.db.MAX_WRITES_PER_TRANSACTION = 50_000_000

    items = frappe.db.sql(
        """
        SELECT name, item_code, item_name, company_abbr
        FROM `tabItem`
        WHERE company_abbr IS NOT NULL
          AND company_abbr != ''
          AND item_code IS NOT NULL
          AND item_code != ''
        """,
        as_dict=True,
    )

    if not items:
        print("No Items to process.")
        return

    renamed = 0
    skipped = 0
    failed = 0
    for item in items:
        abbr = item.company_abbr.strip()
        item_code = item.item_code
        item_name = item.item_name

        new_name = f"{abbr}-{item_code}"
        if new_name == item.name:
            continue

        if frappe.db.exists("Item", new_name):
            print(f"Skip {item.name} -> {new_name}: target already exists")
            skipped += 1
            continue

        try:
            frappe.rename_doc(
                "Item", item.name, new_name, force=True, merge=False
            )
            restore = {"item_code": item_code}
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

    print(f"Done. Renamed: {renamed}, Skipped: {skipped}, Failed: {failed}")

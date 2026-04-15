"""
Rename Item documents where `name == item_code` to `{item_code}-{company_abbr}`.

Background: Item autoname is `format:{item_code}-{company_abbr}`, but during a
rollback some Items were created with just `{item_code}` as their name. This
patch restores the expected naming.

If `company_abbr` is empty on the Item, it is looked up from the linked
Company's `abbr` field first, then used for renaming.
"""
import frappe


def execute():
    # Lift the per-transaction write cap: renaming heavily-referenced Items
    # (Stock Ledger Entry, BOM, etc.) easily exceeds the default 200k.
    frappe.db.MAX_WRITES_PER_TRANSACTION = 50_000_000

    items = frappe.db.sql(
        """
        SELECT name, item_code, company, company_abbr
        FROM `tabItem`
        WHERE name = item_code
        """,
        as_dict=True,
    )

    if not items:
        print("No Item rows to rename.")
        return

    renamed = 0
    skipped = 0
    failed = 0
    for item in items:
        abbr = (item.company_abbr or "").strip()

        if not abbr and item.company:
            company_abbr = frappe.db.get_value("Company", item.company, "abbr")
            if company_abbr:
                abbr = company_abbr.strip()
                frappe.db.set_value(
                    "Item", item.name, "company_abbr", abbr, update_modified=False
                )
                frappe.db.commit()

        if not abbr:
            print(f"Skip {item.name}: no company_abbr and Company abbr unavailable")
            skipped += 1
            continue

        # If item_code already ends with `-{abbr}`, the name is effectively
        # correct — item_code itself carries the suffix. Don't double-append.
        if item.item_code.endswith(f"-{abbr}"):
            print(f"Skip {item.name}: item_code already ends with -{abbr}")
            skipped += 1
            continue

        new_name = f"{item.item_code}-{abbr}"
        if new_name == item.name:
            continue

        if frappe.db.exists("Item", new_name):
            print(f"Skip rename {item.name} -> {new_name}: target already exists")
            skipped += 1
            continue

        try:
            frappe.rename_doc("Item", item.name, new_name, force=True, merge=False)
            frappe.db.commit()
            renamed += 1
            print(f"Renamed {item.name} -> {new_name}")
        except Exception as e:
            frappe.db.rollback()
            print(f"Failed to rename {item.name} -> {new_name}: {e}")
            failed += 1

    print(f"Done. Renamed: {renamed}, Skipped: {skipped}, Failed: {failed}")

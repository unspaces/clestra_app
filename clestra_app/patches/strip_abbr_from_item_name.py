"""
Strip the trailing `-{company_abbr}` from Item.item_name where it was
auto-appended by ERPNext's Item.before_rename (item_name == old_name case).

Safe rule: only Items where item_name == name AND name ends with `-{abbr}`.
If item_name was originally different from item_code (e.g., a user-friendly
label), it was never touched by rename and is left alone.
"""
import frappe


def execute():
    rows = frappe.db.sql(
        """
        SELECT name, item_name, company_abbr
        FROM `tabItem`
        WHERE company_abbr IS NOT NULL
          AND company_abbr != ''
          AND item_name = name
          AND name LIKE CONCAT('%-', company_abbr)
        """,
        as_dict=True,
    )

    if not rows:
        print("No Items need item_name cleanup.")
        return

    updated = 0
    for r in rows:
        suffix = f"-{r.company_abbr}"
        if not r.item_name.endswith(suffix):
            continue
        new_item_name = r.item_name[: -len(suffix)]
        if not new_item_name:
            continue
        frappe.db.set_value(
            "Item", r.name, "item_name", new_item_name, update_modified=False
        )
        updated += 1

    frappe.db.commit()
    print(f"Done. item_name reverted on {updated} Items.")

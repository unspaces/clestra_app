"""
Revert Items that received a doubled company_abbr suffix
(e.g. `X-TC` was wrongly renamed to `X-TC-TC`).

Detection: `name` matches the pattern `{base}-{abbr}-{abbr}` where
`abbr = company_abbr`. Action: rename back to `{base}-{abbr}` and
sync `item_code` to the reverted name.
"""
import frappe


def execute():
    frappe.db.MAX_WRITES_PER_TRANSACTION = 50_000_000

    rows = frappe.db.sql(
        """
        SELECT name, item_code, company_abbr
        FROM `tabItem`
        WHERE company_abbr IS NOT NULL
          AND company_abbr != ''
          AND name LIKE CONCAT('%-', company_abbr, '-', company_abbr)
        """,
        as_dict=True,
    )

    if not rows:
        print("No double-suffixed Items found.")
        return

    reverted = 0
    failed = 0
    for r in rows:
        abbr = r.company_abbr.strip()
        suffix = f"-{abbr}"
        # Strip one trailing `-{abbr}` to get the intended name.
        if not r.name.endswith(suffix + suffix):
            continue
        new_name = r.name[: -len(suffix)]

        if frappe.db.exists("Item", new_name):
            print(f"Skip revert {r.name} -> {new_name}: target already exists")
            failed += 1
            continue

        try:
            frappe.rename_doc("Item", r.name, new_name, force=True, merge=False)
            # Make sure item_code matches the reverted name.
            frappe.db.set_value(
                "Item", new_name, "item_code", new_name, update_modified=False
            )
            frappe.db.commit()
            reverted += 1
            print(f"Reverted {r.name} -> {new_name}")
        except Exception as e:
            frappe.db.rollback()
            print(f"Failed to revert {r.name} -> {new_name}: {e}")
            failed += 1

    print(f"Done. Reverted: {reverted}, Failed: {failed}")

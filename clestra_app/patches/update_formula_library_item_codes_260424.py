"""
Update Formula Library `formula`, and Condition Formula Detail
`condition` / `result_formula` fields after the 2026-04-24 item_code
renames.

Paired with: clestra_app.patches.update_item_code_260424

Uses MariaDB REPLACE() for literal-substring replacement. Old codes are
applied in length-descending order so shorter codes never partially
match inside longer ones. Safe to re-run: once old codes are gone the
UPDATE is a no-op.
"""
import frappe

from clestra_app.patches.update_item_code_260424 import MAPPING, SCOPE_ABBR


def execute():
    company = frappe.db.get_value("Company", {"abbr": SCOPE_ABBR}, "name")
    if not company:
        print(f"No Company with abbr={SCOPE_ABBR}; nothing to do.")
        return

    # Longest first so no old code overlaps a longer old code.
    ordered = sorted(MAPPING, key=lambda p: len(p[0]), reverse=True)

    parent_rows = 0
    child_rows = 0

    for old_code, new_code in ordered:
        like = f"%{old_code}%"

        # Count how many rows actually match before updating, for
        # reporting only — REPLACE on rows without the substring is a
        # no-op.
        p_hits = frappe.db.sql(
            "SELECT COUNT(*) FROM `tabFormula Library` "
            "WHERE formula LIKE %s AND company = %s",
            (like, company),
        )[0][0]
        c_hits = frappe.db.sql(
            "SELECT COUNT(*) FROM `tabCondition Formula Detail` c "
            "JOIN `tabFormula Library` p ON p.name = c.parent "
            "WHERE (c.`condition` LIKE %s OR c.result_formula LIKE %s) "
            "  AND p.company = %s",
            (like, like, company),
        )[0][0]

        if p_hits:
            frappe.db.sql(
                "UPDATE `tabFormula Library` "
                "SET formula = REPLACE(formula, %s, %s) "
                "WHERE formula LIKE %s AND company = %s",
                (old_code, new_code, like, company),
            )
            parent_rows += p_hits

        if c_hits:
            frappe.db.sql(
                "UPDATE `tabCondition Formula Detail` c "
                "JOIN `tabFormula Library` p ON p.name = c.parent "
                "SET c.`condition`    = REPLACE(c.`condition`,    %s, %s), "
                "    c.result_formula = REPLACE(c.result_formula, %s, %s) "
                "WHERE (c.`condition` LIKE %s OR c.result_formula LIKE %s) "
                "  AND p.company = %s",
                (old_code, new_code, old_code, new_code, like, like, company),
            )
            child_rows += c_hits

        if p_hits or c_hits:
            print(
                f"  {old_code} -> {new_code}: "
                f"parent={p_hits}, child={c_hits}"
            )

    frappe.db.commit()
    print(
        f"Done (company={company}). "
        f"Parent rows: {parent_rows}, child rows: {child_rows}"
    )

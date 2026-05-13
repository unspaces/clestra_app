import frappe


def before_rename_item(doc, method, old, new, merge=False):
    """Snapshot the current pure item_code into the `old_item_code`
    Custom Field so after_rename can recover it. Paired with
    after_rename_item; registered via hooks.doc_events.
    """
    current_code = doc.item_code
    if not current_code:
        return
    frappe.db.set_value(
        "Item", old, "old_item_code", current_code, update_modified=False
    )


def after_rename_item(doc, method, old, new, merge=False):
    """Replace old pure item_code with new pure item_code in Formula
    Library formulas and conditions, scoped to the Item's company."""
    old_code = frappe.db.get_value("Item", new, "old_item_code")
    if not old_code:
        return

    # Same pure item_code can exist across companies — scope the replace
    # to Formula Library docs tagged with this Item's company. Items
    # without a company are skipped (no safe scope).
    company = doc.company
    if not company:
        return

    # ERPNext's Item.after_rename overwrites item_code with the full new
    # name (incl. company_abbr prefix) before our hook runs, so we
    # can't trust doc.item_code here — derive pure code by stripping
    # the `{company_abbr}-` prefix from `new`.
    abbr = doc.company_abbr or ""
    prefix = f"{abbr}-"
    new_code = new[len(prefix):] if abbr and new.startswith(prefix) else new

    if not new_code or old_code == new_code:
        return

    like = f"%{old_code}%"
    frappe.db.sql(
        "UPDATE `tabFormula Library` "
        "SET formula = REPLACE(formula, %s, %s) "
        "WHERE formula LIKE %s AND company = %s",
        (old_code, new_code, like, company),
    )
    frappe.db.sql(
        "UPDATE `tabCondition Formula Detail` c "
        "JOIN `tabFormula Library` p ON p.name = c.parent "
        "SET c.`condition`    = REPLACE(c.`condition`,    %s, %s), "
        "    c.result_formula = REPLACE(c.result_formula, %s, %s) "
        "WHERE (c.`condition` LIKE %s OR c.result_formula LIKE %s) "
        "  AND p.company = %s",
        (old_code, new_code, old_code, new_code, like, like, company),
    )

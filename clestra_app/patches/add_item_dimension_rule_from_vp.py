"""
Add `dimension_rule` Custom Field to Item and populate it from the matching
VP Management document (VP Management.product_name == Item.item_code,
take vp_table[0].dimension_rule, mirroring clestra_sales_order.py logic).
"""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


FIELD_DEF = {
    "fieldname": "dimension_rule",
    "label": "Dimension Rule",
    "fieldtype": "Select",
    "options": "\nHEIGHT\nWIDTH\nALL\nNONE",
    "insert_after": "stock_uom",
    "translatable": 0,
    "no_copy": 0,
}


def execute():
    if not frappe.db.exists(
        "Custom Field", {"dt": "Item", "fieldname": "dimension_rule"}
    ):
        create_custom_field("Item", FIELD_DEF)
        print("Created Custom Field: Item.dimension_rule")
    else:
        print("Custom Field Item.dimension_rule already exists; skipping create.")

    # For each VP Management, take the first vp_table row's dimension_rule and
    # apply to every Item whose item_code matches product_name.
    rows = frappe.db.sql(
        """
        SELECT v.product_name,
               (SELECT t.dimension_rule
                  FROM `tabVP Table` t
                 WHERE t.parent = v.name
                   AND t.parenttype = 'VP Management'
                   AND t.parentfield = 'vp_table'
                 ORDER BY t.idx ASC
                 LIMIT 1) AS dimension_rule
        FROM `tabVP Management` v
        WHERE v.product_name IS NOT NULL
          AND v.product_name != ''
        """,
        as_dict=True,
    )

    if not rows:
        print("No VP Management rows found.")
        return

    updated = 0
    no_rule = 0
    no_item = 0
    for vp in rows:
        if not vp.dimension_rule:
            no_rule += 1
            continue

        # VP Management.product_name은 Item.name(= {item_code}-{company_abbr}) 형식이 일반적이며,
        # 과거 레코드 중에는 item_code(raw) 형식도 존재할 수 있어 둘 다 매칭.
        items = frappe.db.sql(
            "SELECT name FROM `tabItem` WHERE name = %s OR item_code = %s",
            (vp.product_name, vp.product_name),
            as_dict=True,
        )
        if not items:
            no_item += 1
            continue

        for item in items:
            frappe.db.set_value(
                "Item",
                item.name,
                "dimension_rule",
                vp.dimension_rule,
                update_modified=False,
            )
            updated += 1

    frappe.db.commit()
    print(
        f"Done. Updated: {updated}, VPM without rule: {no_rule}, "
        f"VPM without matching Item: {no_item}"
    )

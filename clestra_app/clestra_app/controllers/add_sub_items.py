import frappe
from frappe.model.document import Document

@frappe.whitelist()
def add_sub_items_to_quotation(parent_item_code, quotation_name):
    # Get the Quotation document
    quotation = frappe.get_doc("Clestra Quotation", quotation_name)

    # Fetch the Item document with the given parent_item_code
    parent_item = frappe.get_doc("Item", parent_item_code)

    # Check if the Item has a 'quotation_item' child table
    if not parent_item.get("clestra_quotation_item"):
        frappe.msgprint(f"No sub-items found for Item {parent_item_code}")
        return

    # Iterate through the quotation_item child table and add each to the Quotation's items
    for sub_item in parent_item.quotation_item:
        quotation.append("items", {
            "item_code": sub_item.item_code,
            # "uom": sub_item.uom,  # Default UOM if not set
            "quantity": sub_item.qty or 1,  # Default quantity, can be modified
            "rate": sub_item.rate or 0  # Default rate, can be modified
        })

    # Save the Quotation document
    quotation.save()

    return True
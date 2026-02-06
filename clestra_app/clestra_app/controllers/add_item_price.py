import frappe
from frappe.utils import nowdate, flt

@frappe.whitelist()
def add_item_price(item_code, quotation_total, stock_uom):
    quotation_total = flt(quotation_total)
    price_list = "Standard Selling"

    # Check if an Item Price already exists for this item and price list
    existing_item_price = frappe.get_all("Item Price", filters={
        "item_code": item_code
    }, fields=["item_code"])

    if existing_item_price:
        # If Item Price exists, update the price_list_rate
        frappe.db.set_value("Item Price", existing_item_price[0].name, "price_list_rate", quotation_total)
        frappe.msgprint(f"Item Price updated for {item_code}.")
    else:
        # If Item Price does not exist, create a new one
        item_price = frappe.get_doc({
            "doctype": "Item Price",
            "item_code": item_code,
            "uom": stock_uom,
            "price_list": price_list,
            "price_list_rate": quotation_total,
            # "currency": frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "default_currency"),
            "valid_from": nowdate()  # Set valid from the current date
        })
        item_price.insert()
        frappe.msgprint(f"New Item Price created for {item_code}.")

    return "Success"
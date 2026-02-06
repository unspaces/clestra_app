# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

# import frappe
import frappe
from frappe.model.document import Document

class SubItem(Document):
    pass

@frappe.whitelist()
def get_sub_items(parent_item):
    if not parent_item:
        frappe.throw("Parent Item is required")
    
    sub_items = frappe.get_all('Sub Item', filters={'parent_item': parent_item}, fields=['sub_item_code', 'quantity'])
    if not sub_items:
        frappe.msgprint("No sub items found for the selected item.")
    
    return sub_items
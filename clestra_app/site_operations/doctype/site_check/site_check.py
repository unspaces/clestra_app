# Copyright (c) 2024, Seyong EOM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SiteCheck(Document):
	pass

def create_items(finish_list_name):
	finish_list_name = frappe.get_doc("Finish Material List Builder", finish_list_name)

	items = frappe.get_doc({"doctype": "Site Check", "finish_list_name": finish_list_name.name, "date": frappe.utils.getdate()})

	items.insert(ignore_permissions=True)
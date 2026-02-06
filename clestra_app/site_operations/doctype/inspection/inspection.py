# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Inspection(Document):
	pass
 
def create_items(inspection_type):
	inspection_type = frappe.get_doc("Inspection List Builder", inspection_type)

	items = frappe.get_doc({"doctype": "Inspection", "inspection_type": inspection_type.name, "date": frappe.utils.getdate()})

	items.insert(ignore_permissions=True)
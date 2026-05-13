"""Add 'Template' option to Task.status Select via Property Setter.

Previously a direct edit to apps/erpnext/.../task.json. Moved on 2026-05-13
during upstream restoration.

Upstream Task.status options:
  Open\\nWorking\\nPending Review\\nOverdue\\nCompleted\\nCancelled

Clestra extends with 'Template' (inserted before Completed) to mark template
Tasks that aren't real work items.
"""

import frappe

VALUE = "Open\nWorking\nPending Review\nOverdue\nTemplate\nCompleted\nCancelled"


def execute():
	existing = frappe.db.get_value("Property Setter", {
		"doc_type": "Task",
		"field_name": "status",
		"property": "options",
	}, "name")
	if existing:
		if frappe.db.get_value("Property Setter", existing, "value") != VALUE:
			frappe.db.set_value("Property Setter", existing, "value", VALUE)
	else:
		frappe.get_doc({
			"doctype": "Property Setter",
			"doctype_or_field": "DocField",
			"doc_type": "Task",
			"field_name": "status",
			"property": "options",
			"property_type": "Text",
			"value": VALUE,
		}).insert(ignore_permissions=True)
	frappe.db.commit()
	frappe.clear_cache(doctype="Task")

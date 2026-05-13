"""Add 'source' Custom Field + exchange_rate precision Property Setter to Currency Exchange.

Previously these existed as direct modifications to
apps/erpnext/.../currency_exchange.json. Moved on 2026-04-24 during upstream
restoration:
- 'source' field → Custom Field (rate provider tracking)
- exchange_rate.precision='3' → Property Setter (upstream default is '9')
"""

import frappe


def execute():
	if not frappe.db.exists("Custom Field", {"dt": "Currency Exchange", "fieldname": "source"}):
		cf = frappe.get_doc({
			"doctype": "Custom Field",
			"dt": "Currency Exchange",
			"fieldname": "source",
			"label": "Source",
			"fieldtype": "Data",
			"insert_after": "exchange_rate",
			"in_list_view": 0,
			"read_only": 0,
			"description": "Rate source (e.g., Bank of Korea ECOS, exchangerate.host)",
		})
		cf.insert(ignore_permissions=True)

	ps_name = frappe.db.get_value("Property Setter", {
		"doc_type": "Currency Exchange",
		"field_name": "exchange_rate",
		"property": "precision",
	})
	if ps_name:
		frappe.db.set_value("Property Setter", ps_name, "value", "3")
	else:
		frappe.get_doc({
			"doctype": "Property Setter",
			"doctype_or_field": "DocField",
			"doc_type": "Currency Exchange",
			"field_name": "exchange_rate",
			"property": "precision",
			"property_type": "Select",
			"value": "3",
		}).insert(ignore_permissions=True)

	frappe.db.commit()
	frappe.clear_cache(doctype="Currency Exchange")

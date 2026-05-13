"""Add 'source' Custom Field to Currency Exchange.

Previously this field existed as a direct modification to
apps/erpnext/.../currency_exchange.json. Moved to a proper Custom Field
on 2026-04-24 during upstream restoration.
"""

import frappe


def execute():
	if frappe.db.exists("Custom Field", {"dt": "Currency Exchange", "fieldname": "source"}):
		return

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
	frappe.db.commit()

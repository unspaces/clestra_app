"""Add 'supplier_name_abbr' Custom Field to Supplier.

Previously lived as a direct modification in
apps/erpnext/.../supplier.json. Moved to a Custom Field on 2026-04-24.

Notes on cleanup versus the old direct-edit version:
- reqd is 0 (was 1, but only 1 of 4 suppliers had it filled so the required
  flag was never actually being satisfied).
- oldfieldname/oldfieldtype (= "supplier_name" / "Data") from the old direct
  edit are dropped — those attributes are only meaningful when renaming a
  standard field, which this is not.

Existing data (the "Hanjin" value on Hanjin Glass) is preserved because the
underlying DB column is not dropped when the DocType JSON loses the field.
"""

import frappe


def execute():
	if frappe.db.exists("Custom Field", {"dt": "Supplier", "fieldname": "supplier_name_abbr"}):
		return

	cf = frappe.get_doc({
		"doctype": "Custom Field",
		"dt": "Supplier",
		"fieldname": "supplier_name_abbr",
		"label": "Supplier Name Abbr",
		"fieldtype": "Data",
		"insert_after": "column_break_mglr",
		"bold": 1,
		"in_global_search": 1,
		"no_copy": 1,
		"description": "Short name for the supplier (used for display / references)",
	})
	cf.insert(ignore_permissions=True)
	frappe.db.commit()

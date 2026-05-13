"""Bundled migration: UOM (1 CF), Production Plan (5 CF), Quotation Item (19 CF).

Previously direct edits in apps/erpnext/. Moved on 2026-05-11.

Notes:
- Production Plan: 5 tree-related fields (lft, rgt, is_group, old_parent,
  parent_production_plan). DB has 0 records using them — preserved for future
  tree configuration. Note that without is_tree=1 on the DocType these fields
  are inert (no auto-managed nested set).
- Quotation Item: 19 fields, of which only `floor` and `height` (default 1, 2700)
  are actually used (2 of 2 records). Glass-related fields preserved as schema
  for future quotation workflows.
"""

import frappe

FIELDS = {
	"UOM": [
		{"fieldname": "description", "fieldtype": "Data", "label": "Description",
		 "insert_after": "enabled", "in_list_view": 1},
	],
	"Production Plan": [
		{"fieldname": "lft", "fieldtype": "Int", "label": "Left",
		 "insert_after": "consider_minimum_order_qty",
		 "read_only": 1, "hidden": 1, "no_copy": 1},
		{"fieldname": "rgt", "fieldtype": "Int", "label": "Right",
		 "insert_after": "lft",
		 "read_only": 1, "hidden": 1, "no_copy": 1},
		{"fieldname": "is_group", "fieldtype": "Check", "label": "Is Group",
		 "insert_after": "rgt", "default": "0"},
		{"fieldname": "old_parent", "fieldtype": "Link", "label": "Old Parent",
		 "options": "Production Plan", "insert_after": "is_group"},
		{"fieldname": "parent_production_plan", "fieldtype": "Link",
		 "label": "Parent Production Plan", "options": "Production Plan",
		 "insert_after": "old_parent"},
	],
	"Quotation Item": [
		{"fieldname": "floor", "fieldtype": "Int", "label": "Floor",
		 "insert_after": "amount", "in_list_view": 1, "default": "1", "columns": 1},
		{"fieldname": "section_break_rqwr", "fieldtype": "Section Break",
		 "insert_after": "floor"},
		{"fieldname": "height", "fieldtype": "Int", "label": "Height",
		 "insert_after": "section_break_rqwr",
		 "in_list_view": 1, "default": "2700", "columns": 1},
		{"fieldname": "is_sub_item", "fieldtype": "Check", "label": "Is Sub Item",
		 "insert_after": "height", "default": "0"},
		{"fieldname": "parent_item", "fieldtype": "Link", "label": "Parent Item",
		 "options": "Item", "insert_after": "is_sub_item", "depends_on": "is_sub_item"},
		{"fieldname": "original_item_code", "fieldtype": "Data",
		 "label": "Original Item Code", "insert_after": "parent_item", "hidden": 1},
		{"fieldname": "glass_details_section", "fieldtype": "Section Break",
		 "label": "Glass Details", "insert_after": "original_item_code"},
		{"fieldname": "glass_type_a", "fieldtype": "Link", "label": "Glass Type A",
		 "options": "Selection Library", "insert_after": "glass_details_section"},
		{"fieldname": "glass_thk_a", "fieldtype": "Select", "label": "Thickness A",
		 "options": "\n5\n6\n8\n10\n12", "insert_after": "glass_type_a"},
		{"fieldname": "glass_cost_a", "fieldtype": "Currency", "label": "Glass Cost A",
		 "insert_after": "glass_thk_a"},
		{"fieldname": "is_double_panel", "fieldtype": "Check", "label": "Double Panel",
		 "insert_after": "glass_cost_a", "default": "0"},
		{"fieldname": "column_break_sfus", "fieldtype": "Column Break",
		 "insert_after": "is_double_panel"},
		{"fieldname": "is_tempered_b", "fieldtype": "Check", "label": "Tempered Glass B",
		 "insert_after": "column_break_sfus", "default": "0",
		 "depends_on": "eval:doc.is_double_panel == 1"},
		{"fieldname": "glass_type_b", "fieldtype": "Link", "label": "Glass Type B",
		 "options": "Selection Library", "insert_after": "is_tempered_b",
		 "depends_on": "eval:doc.is_double_panel == 1"},
		{"fieldname": "glass_thk_b", "fieldtype": "Select", "label": "Thickness B",
		 "options": "\n5\n6\n8\n10\n12", "insert_after": "glass_type_b",
		 "depends_on": "eval:doc.is_double_panel == 1"},
		{"fieldname": "glass_cost_b", "fieldtype": "Currency", "label": "Glass Cost B",
		 "insert_after": "glass_thk_b",
		 "depends_on": "eval:doc.is_double_panel == 1"},
		{"fieldname": "is_tempered_a", "fieldtype": "Check", "label": "Tempered Glass A",
		 "insert_after": "glass_cost_b", "default": "0"},
		{"fieldname": "glass_details", "fieldtype": "Button", "label": "Glass Details",
		 "insert_after": "is_tempered_a", "in_list_view": 1},
		{"fieldname": "section_break_hfho", "fieldtype": "Section Break",
		 "insert_after": "glass_details"},
	],
}


def execute():
	for dt, specs in FIELDS.items():
		created = 0
		for spec in specs:
			if frappe.db.exists("Custom Field", {"dt": dt, "fieldname": spec["fieldname"]}):
				continue
			try:
				frappe.get_doc({"doctype": "Custom Field", "dt": dt, **spec}).insert(
					ignore_permissions=True
				)
				created += 1
			except Exception as e:
				print(f"[add_uom_pp_qi_custom_fields] FAILED {dt}/{spec['fieldname']}: {e}")
		print(f"[add_uom_pp_qi_custom_fields] {dt}: created={created} / {len(specs)}")
	frappe.db.commit()

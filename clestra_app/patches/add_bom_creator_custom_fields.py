"""Bundled migration: BOM Creator (80 CF) + BOM Creator Item (78 CF).

Previously direct edits in apps/erpnext/.../bom_creator{,_item}/.
Moved on 2026-05-13 during upstream restoration.

The Clestra customization adds manufacturing-domain fields for door/leaf/panel
assemblies: size (width, ch, pw, ph, leaf_*, abl_*, depth, under_cut, etc.),
hardware (hinge*, keeper*, key_cylinder, door_closer, astragal, flush_bolt,
fix_screw_cap, tape_seal_color, ...), glass spec (glass_a/b, leaf_glass_*),
workflow (product_section, door_open_type, door_set_type, color, ...),
display (qty_prefix/suffix, show_qty_bracket, use_unit, indent_level, ...),
and pricing (price_study, sub_contract, hw_options).

Parent (BOM Creator) and child (BOM Creator Item) share most field names: the
parent value acts as a template/header, the child rows carry per-line values.

Existing DB data preserved — DB columns are not touched; only the schema
metadata (Custom Field records) is created.
"""

import frappe


FIELDS = {
	"BOM Creator": [
		{"fieldname": 'product_section', "fieldtype": 'Select', "label": 'Product Section', "insert_after": 'section_break_ylsl', "options": '\nDoor\nLeaf\nPanel\nSub Items'},
		{"fieldname": 'size_section', "fieldtype": 'Section Break', "label": 'Size', "insert_after": 'exclude_from_cover'},
		{"fieldname": 'width', "fieldtype": 'Link', "label": 'Width', "insert_after": 'size_section', "options": 'Formula Library'},
		{"fieldname": 'ch', "fieldtype": 'Link', "label": 'CH', "insert_after": 'pw', "options": 'Formula Library'},
		{"fieldname": 'ph', "fieldtype": 'Link', "label": 'Panel Height (PH)', "insert_after": 'ch', "options": 'Formula Library'},
		{"fieldname": 'column_break_idpo', "fieldtype": 'Column Break', "insert_after": 'leaf_height'},
		{"fieldname": 'ceiling_visible', "fieldtype": 'Link', "label": 'Ceiling Visible', "insert_after": 'column_break_idpo', "options": 'Formula Library'},
		{"fieldname": 'base_visible_h', "fieldtype": 'Link', "label": 'Base Visible H', "insert_after": 'ceiling_visible', "options": 'Formula Library'},
		{"fieldname": 'under_cut', "fieldtype": 'Link', "label": 'Under Cut', "insert_after": 'base_visible_h', "options": 'Formula Library'},
		{"fieldname": 'column_break_khla', "fieldtype": 'Column Break', "insert_after": 'open_height'},
		{"fieldname": 'panel_trh', "fieldtype": 'Link', "label": 'Panel TRH', "insert_after": 'column_break_khla', "options": 'Formula Library'},
		{"fieldname": 'panel_crh', "fieldtype": 'Link', "label": 'Panel CRH', "insert_after": 'panel_trh', "options": 'Formula Library'},
		{"fieldname": 'abl_a', "fieldtype": 'Link', "label": 'ABL A', "insert_after": 'panel_crh', "options": 'Formula Library'},
		{"fieldname": 'abl_b', "fieldtype": 'Link', "label": 'ABL B', "insert_after": 'abl_a', "options": 'Formula Library'},
		{"fieldname": 'qty_custom', "fieldtype": 'Link', "label": 'Quantity (Custom)', "insert_after": 'qty', "options": 'Formula Library'},
		{"fieldname": 'color', "fieldtype": 'Link', "label": 'Color', "insert_after": 'door_set_type', "options": 'Product Color'},
		{"fieldname": 'door_open_type', "fieldtype": 'Select', "label": 'Door Open Type', "insert_after": 'item_group', "options": '\nSwing\nSliding', "depends_on": "eval:doc.product_section == 'Door'"},
		{"fieldname": 'door_set_type', "fieldtype": 'Select', "label": 'Door Set Type', "insert_after": 'door_open_type', "options": '\nSingle\nPair', "depends_on": "eval:doc.product_section == 'Door'"},
		{"fieldname": 'product_abbr', "fieldtype": 'Data', "label": 'Product Abbr', "insert_after": 'product_section'},
		{"fieldname": 'handle_direct', "fieldtype": 'Data', "label": 'Handle Direction', "insert_after": 'door_closer'},
		{"fieldname": 'bom_options_section', "fieldtype": 'Section Break', "label": 'Additional Conditions', "insert_after": 'is_panel_cover'},
		{"fieldname": 'leaf_item_code', "fieldtype": 'Link', "label": 'Leaf Item Code', "insert_after": 'leaf', "options": 'Item'},
		{"fieldname": 'column_break_lnzg', "fieldtype": 'Column Break', "insert_after": 'for_pair_door'},
		{"fieldname": 'keeper', "fieldtype": 'Data', "label": 'Keeper', "insert_after": 'keeper_heading'},
		{"fieldname": 'glass_a', "fieldtype": 'Data', "label": 'Glass A (Outer)', "insert_after": 'panel'},
		{"fieldname": 'glass_b', "fieldtype": 'Data', "label": 'Glass B (Inner)', "insert_after": 'glass_a'},
		{"fieldname": 'hinge', "fieldtype": 'Data', "label": 'Hinge', "insert_after": 'hinge_heading'},
		{"fieldname": 'print_hide', "fieldtype": 'Check', "label": 'Print Hide', "insert_after": 'disassembled', "default": '0'},
		{"fieldname": 'show_qty_bracket', "fieldtype": 'Check', "label": 'Show Qty in Brackets', "insert_after": 'use_unit', "default": '0'},
		{"fieldname": 'app_country', "fieldtype": 'Data', "label": 'Applicable Country', "insert_after": 'general_condition_section'},
		{"fieldname": 'hw_options', "fieldtype": 'Link', "label": 'Door Option', "insert_after": 'handle_direct', "options": 'Item'},
		{"fieldname": 'hinge_type', "fieldtype": 'Link', "label": 'Hinge Type', "insert_after": 'hinge_glass_b', "options": 'Selection Library'},
		{"fieldname": 'hinge_num', "fieldtype": 'Link', "label": 'Number of Hinge Holes', "insert_after": 'hinge_type', "options": 'Selection Library'},
		{"fieldname": 'column_break_pnaz', "fieldtype": 'Column Break', "insert_after": 'hinge_num'},
		{"fieldname": 'leaf_act_status', "fieldtype": 'Link', "label": 'Leaf Active Status', "insert_after": 'leaf_item_code', "options": 'Selection Library'},
		{"fieldname": 'leaf_thk', "fieldtype": 'Data', "label": 'Leaf Thk', "insert_after": 'leaf_act_status'},
		{"fieldname": 'leaf_color', "fieldtype": 'Link', "label": 'Leaf Color', "insert_after": 'leaf_thk', "options": 'Product Color'},
		{"fieldname": 'astragal', "fieldtype": 'Link', "label": 'Astragal', "insert_after": 'auto_drop_seal', "options": 'Selection Library'},
		{"fieldname": 'flush_bolt', "fieldtype": 'Data', "label": 'Flush Bolt', "insert_after": 'astragal'},
		{"fieldname": 'auto_drop_seal', "fieldtype": 'Link', "label": 'Auto Drop Seal', "insert_after": 'hardwares', "options": 'Selection Library'},
		{"fieldname": 'leaf_material', "fieldtype": 'Data', "label": 'Leaf Material', "insert_after": 'leaf_glass_b'},
		{"fieldname": 'for_pair_door', "fieldtype": 'Check', "label": 'For Pair Door', "insert_after": 'exclude_fields', "default": '0'},
		{"fieldname": 'equal_leaf_w', "fieldtype": 'Check', "label": 'Equal Leaf Width', "insert_after": 'leaf_material', "default": '0'},
		{"fieldname": 'column_break_mxyg', "fieldtype": 'Column Break', "insert_after": 'equal_leaf_w'},
		{"fieldname": 'tape_seal_color', "fieldtype": 'Link', "label": 'Tape & Seal Color', "insert_after": 'fgd_info', "options": 'Selection Library'},
		{"fieldname": 'fix_screw_cap', "fieldtype": 'Link', "label": 'Fixing Screw Cap', "insert_after": 'tape_seal_color', "options": 'Selection Library'},
		{"fieldname": 'fgd_info', "fieldtype": 'Link', "label": 'FGD Info', "insert_after": 'flush_bolt', "options": 'Selection Library'},
		{"fieldname": 'qty_prefix', "fieldtype": 'Data', "label": 'Qty Prefix', "insert_after": 'qty_custom'},
		{"fieldname": 'qty_suffix', "fieldtype": 'Data', "label": 'Qty Suffix', "insert_after": 'qty_prefix'},
		{"fieldname": 'use_unit', "fieldtype": 'Check', "label": 'Use Unit', "insert_after": 'qty_suffix', "default": '0'},
		{"fieldname": 'disassembled', "fieldtype": 'Check', "label": 'Disassembled', "insert_after": 'app_country', "default": '0'},
		{"fieldname": 'exclude_fields', "fieldtype": 'Data', "label": 'Exclude Fields', "insert_after": 'sub_contract', "hidden": 1},
		{"fieldname": 'panel', "fieldtype": 'Heading', "label": 'Panel', "insert_after": 'bom_options_section'},
		{"fieldname": 'door_unit', "fieldtype": 'Heading', "label": 'Door Unit', "insert_after": 'glass_b'},
		{"fieldname": 'keeper_heading', "fieldtype": 'Heading', "label": 'Keeper', "insert_after": 'column_break_lnzg'},
		{"fieldname": 'hinge_heading', "fieldtype": 'Heading', "label": 'Hinge', "insert_after": 'keeper_glass_b'},
		{"fieldname": 'general_condition_section', "fieldtype": 'Section Break', "label": 'General Condition', "insert_after": 'depth'},
		{"fieldname": 'door_closer', "fieldtype": 'Link', "label": 'Door Closer', "insert_after": 'door_frame', "options": 'Selection Library'},
		{"fieldname": 'leaf', "fieldtype": 'Heading', "label": 'Leaf', "insert_after": 'column_break_pnaz'},
		{"fieldname": 'hardwares', "fieldtype": 'Heading', "label": 'Hardwares', "insert_after": 'column_break_mxyg'},
		{"fieldname": 'hinge_glass_a', "fieldtype": 'Data', "label": 'Hinge Glass A', "insert_after": 'hinge'},
		{"fieldname": 'hinge_glass_b', "fieldtype": 'Data', "label": 'Hinge Glass B', "insert_after": 'hinge_glass_a'},
		{"fieldname": 'keeper_glass_a', "fieldtype": 'Data', "label": 'Keeper Glass A', "insert_after": 'keeper'},
		{"fieldname": 'keeper_glass_b', "fieldtype": 'Data', "label": 'Keeper Glass B', "insert_after": 'keeper_glass_a'},
		{"fieldname": 'leaf_glass_a', "fieldtype": 'Data', "label": 'Leaf Glass A', "insert_after": 'leaf_color'},
		{"fieldname": 'leaf_glass_b', "fieldtype": 'Data', "label": 'Leaf Glass B', "insert_after": 'leaf_glass_a'},
		{"fieldname": 'leaf_width', "fieldtype": 'Link', "label": 'Leaf Width', "insert_after": 'ph', "options": 'Formula Library'},
		{"fieldname": 'leaf_height', "fieldtype": 'Link', "label": 'Leaf Height', "insert_after": 'leaf_width', "options": 'Formula Library'},
		{"fieldname": 'door_frame', "fieldtype": 'Data', "label": 'Door Frame', "insert_after": 'door_unit'},
		{"fieldname": 'indent_level', "fieldtype": 'Int', "label": 'Indent Level', "insert_after": 'project'},
		{"fieldname": 'pw', "fieldtype": 'Link', "label": 'Panel Width (PW)', "insert_after": 'width', "options": 'Formula Library'},
		{"fieldname": 'exclude_from_cover', "fieldtype": 'Check', "label": 'Exclude From Cover', "insert_after": 'indent_level', "default": '0'},
		{"fieldname": 'depth', "fieldtype": 'Link', "label": 'Depth', "insert_after": 'abl_b', "options": 'Formula Library'},
		{"fieldname": 'price_study', "fieldtype": 'Link', "label": 'Price Study', "insert_after": 'hw_options', "options": 'Item'},
		{"fieldname": 'sub_contract', "fieldtype": 'Link', "label": 'Sub Contract', "insert_after": 'price_study', "options": 'Item'},
		{"fieldname": 'is_panel_cover', "fieldtype": 'Check', "label": 'Panel Cover Item', "insert_after": 'print_hide', "default": '0'},
		{"fieldname": 'open_width', "fieldtype": 'Link', "label": 'Open Width', "insert_after": 'under_cut', "options": 'Formula Library'},
		{"fieldname": 'open_height', "fieldtype": 'Link', "label": 'Open Height', "insert_after": 'open_width', "options": 'Formula Library'},
		{"fieldname": 'key_cylinder', "fieldtype": 'Link', "label": 'Key Cylinder', "insert_after": 'fix_screw_cap', "options": 'Selection Library'},
		{"fieldname": 'use_billing_color', "fieldtype": 'Check', "label": 'Use Billing Color', "insert_after": 'color', "default": '0', "description": "If checked, the color code will be displayed as billing color (e.g., '7099' becomes 'Black')."},
	],
	"BOM Creator Item": [
		{"fieldname": 'bom_no', "fieldtype": 'Link', "label": 'BOM No', "insert_after": 'item_code', "options": 'BOM'},
		{"fieldname": 'print_hide', "fieldtype": 'Check', "label": 'Print Hide', "insert_after": 'disassembled', "default": '0'},
		{"fieldname": 'size_section', "fieldtype": 'Section Break', "label": 'Size', "insert_after": 'description'},
		{"fieldname": 'width', "fieldtype": 'Link', "label": 'Width', "insert_after": 'size_section', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'column_break_mzjl', "fieldtype": 'Column Break', "insert_after": 'leaf_height'},
		{"fieldname": 'column_break_kqie', "fieldtype": 'Column Break', "insert_after": 'open_height'},
		{"fieldname": 'ch', "fieldtype": 'Link', "label": 'CH', "insert_after": 'pw', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'ph', "fieldtype": 'Link', "label": 'Panel Height', "insert_after": 'ch', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'base_visible_h', "fieldtype": 'Link', "label": 'Base Visible H', "insert_after": 'ceiling_visible', "options": 'Formula Library'},
		{"fieldname": 'ceiling_visible', "fieldtype": 'Link', "label": 'Ceiling Visible', "insert_after": 'column_break_mzjl', "options": 'Formula Library'},
		{"fieldname": 'under_cut', "fieldtype": 'Link', "label": 'Under Cut', "insert_after": 'base_visible_h', "options": 'Formula Library'},
		{"fieldname": 'panel_crh', "fieldtype": 'Link', "label": 'Panel CRH', "insert_after": 'panel_trh', "options": 'Formula Library'},
		{"fieldname": 'panel_trh', "fieldtype": 'Link', "label": 'Panel TRH', "insert_after": 'column_break_kqie', "options": 'Formula Library'},
		{"fieldname": 'qty_custom', "fieldtype": 'Link', "label": 'Qty (Custom)', "insert_after": 'qty', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'abl_a', "fieldtype": 'Link', "label": 'ABL A', "insert_after": 'panel_crh', "options": 'Formula Library'},
		{"fieldname": 'abl_b', "fieldtype": 'Link', "label": 'ABL B', "insert_after": 'abl_a', "options": 'Formula Library'},
		{"fieldname": 'color', "fieldtype": 'Link', "label": 'Color', "insert_after": 'item_group', "options": 'Product Color'},
		{"fieldname": 'handle_direct', "fieldtype": 'Data', "label": 'Handle Direction', "insert_after": 'door_closer'},
		{"fieldname": 'bom_options_section', "fieldtype": 'Section Break', "label": 'Additional Conditions', "insert_after": 'is_panel_cover'},
		{"fieldname": 'leaf_item_code', "fieldtype": 'Link', "label": 'Leaf Item Code', "insert_after": 'leaf', "options": 'Item'},
		{"fieldname": 'glass_a', "fieldtype": 'Data', "label": 'Glass A (Outer)', "insert_after": 'panel'},
		{"fieldname": 'glass_b', "fieldtype": 'Data', "label": 'Glass B (Inner)', "insert_after": 'glass_a'},
		{"fieldname": 'column_break_dlfw', "fieldtype": 'Column Break', "insert_after": 'hinge_num'},
		{"fieldname": 'keeper', "fieldtype": 'Data', "label": 'Keeper', "insert_after": 'keeper_heading'},
		{"fieldname": 'hinge', "fieldtype": 'Data', "label": 'Hinge', "insert_after": 'hinge_heading'},
		{"fieldname": 'show_qty_bracket', "fieldtype": 'Check', "label": 'Show Qty in Brackets', "insert_after": 'use_unit', "default": '0'},
		{"fieldname": 'app_country', "fieldtype": 'Data', "label": 'Applicable Country', "insert_after": 'general_condition_section'},
		{"fieldname": 'hw_options', "fieldtype": 'Link', "label": 'Door Options', "insert_after": 'handle_direct', "options": 'Item'},
		{"fieldname": 'indent_level', "fieldtype": 'Int', "label": 'Indent Level', "insert_after": 'item_code'},
		{"fieldname": 'hinge_type', "fieldtype": 'Link', "label": 'Hinge Type', "insert_after": 'hinge_glass_b', "options": 'Selection Library'},
		{"fieldname": 'column_break_nojy', "fieldtype": 'Column Break', "insert_after": 'for_pair_door'},
		{"fieldname": 'hinge_num', "fieldtype": 'Link', "label": 'Number of Hinge Holes', "insert_after": 'hinge_type', "options": 'Selection Library'},
		{"fieldname": 'leaf_act_status', "fieldtype": 'Link', "label": 'Leaf Active Status', "insert_after": 'leaf_item_code', "options": 'Selection Library'},
		{"fieldname": 'leaf_thk', "fieldtype": 'Data', "label": 'Leaf Thk', "insert_after": 'leaf_act_status'},
		{"fieldname": 'leaf_color', "fieldtype": 'Link', "label": 'Leaf Color', "insert_after": 'leaf_thk', "options": 'Product Color'},
		{"fieldname": 'auto_drop_seal', "fieldtype": 'Link', "label": 'Auto Drop Seal', "insert_after": 'hardwares', "options": 'Selection Library'},
		{"fieldname": 'astragal', "fieldtype": 'Link', "label": 'Astragal', "insert_after": 'auto_drop_seal', "options": 'Selection Library'},
		{"fieldname": 'flush_bolt', "fieldtype": 'Data', "label": 'Flush Bolt', "insert_after": 'astragal'},
		{"fieldname": 'leaf_material', "fieldtype": 'Data', "label": 'Leaf Material', "insert_after": 'leaf_glass_b'},
		{"fieldname": 'for_pair_door', "fieldtype": 'Check', "label": 'For Pair Door', "insert_after": 'exclude_fields', "default": '0'},
		{"fieldname": 'equal_leaf_w', "fieldtype": 'Check', "label": 'Equal Leaf Width', "insert_after": 'leaf_material', "default": '0'},
		{"fieldname": 'column_break_kapx', "fieldtype": 'Column Break', "insert_after": 'equal_leaf_w'},
		{"fieldname": 'tape_seal_color', "fieldtype": 'Link', "label": 'Tape & Seal Color', "insert_after": 'fgd_info', "options": 'Selection Library'},
		{"fieldname": 'fix_screw_cap', "fieldtype": 'Link', "label": 'Fixing Screw Cap', "insert_after": 'tape_seal_color', "options": 'Selection Library'},
		{"fieldname": 'fgd_info', "fieldtype": 'Link', "label": 'FGD Info', "insert_after": 'flush_bolt', "options": 'Selection Library'},
		{"fieldname": 'qty_prefix', "fieldtype": 'Data', "label": 'Qty Prefix', "insert_after": 'qty_custom'},
		{"fieldname": 'qty_suffix', "fieldtype": 'Data', "label": 'Qty Suffix', "insert_after": 'qty_prefix'},
		{"fieldname": 'use_unit', "fieldtype": 'Check', "label": 'Use Unit', "insert_after": 'qty_suffix', "default": '0'},
		{"fieldname": 'disassembled', "fieldtype": 'Check', "label": 'Disassembled', "insert_after": 'app_country', "default": '0'},
		{"fieldname": 'exclude_fields', "fieldtype": 'Data', "label": 'Exclude Fields', "insert_after": 'sub_contract'},
		{"fieldname": 'keeper_glass_a', "fieldtype": 'Data', "label": 'Keeper Glass A', "insert_after": 'keeper'},
		{"fieldname": 'keeper_glass_b', "fieldtype": 'Data', "label": 'Keeper Glass B', "insert_after": 'keeper_glass_a'},
		{"fieldname": 'hinge_glass_a', "fieldtype": 'Data', "label": 'Hinge Glass A', "insert_after": 'hinge'},
		{"fieldname": 'hinge_glass_b', "fieldtype": 'Data', "label": 'Hinge Glass B', "insert_after": 'hinge_glass_a'},
		{"fieldname": 'leaf_glass_a', "fieldtype": 'Data', "label": 'Leaf Glass A', "insert_after": 'leaf_color'},
		{"fieldname": 'leaf_glass_b', "fieldtype": 'Data', "label": 'Leaf Glass B', "insert_after": 'leaf_glass_a'},
		{"fieldname": 'general_condition_section', "fieldtype": 'Section Break', "label": 'General Condition', "insert_after": 'depth'},
		{"fieldname": 'panel', "fieldtype": 'Heading', "label": 'Panel', "insert_after": 'bom_options_section'},
		{"fieldname": 'door_unit', "fieldtype": 'Heading', "label": 'Door Unit', "insert_after": 'glass_b'},
		{"fieldname": 'door_closer', "fieldtype": 'Link', "label": 'Door Closer', "insert_after": 'door_frame', "options": 'Selection Library'},
		{"fieldname": 'keeper_heading', "fieldtype": 'Heading', "label": 'Keeper', "insert_after": 'column_break_nojy'},
		{"fieldname": 'hinge_heading', "fieldtype": 'Heading', "label": 'Hinge', "insert_after": 'keeper_glass_b'},
		{"fieldname": 'leaf', "fieldtype": 'Heading', "label": 'Leaf', "insert_after": 'column_break_dlfw'},
		{"fieldname": 'hardwares', "fieldtype": 'Heading', "label": 'Hardwares', "insert_after": 'column_break_kapx'},
		{"fieldname": 'leaf_width', "fieldtype": 'Link', "label": 'Leaf Width', "insert_after": 'ph', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'leaf_height', "fieldtype": 'Link', "label": 'Leaf Height', "insert_after": 'leaf_width', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'door_frame', "fieldtype": 'Data', "label": 'Door Frame', "insert_after": 'door_set_type'},
		{"fieldname": 'pw', "fieldtype": 'Link', "label": 'Panel Width', "insert_after": 'width', "options": 'Formula Library', "in_list_view": 1, "columns": 1},
		{"fieldname": 'depth', "fieldtype": 'Link', "label": 'Depth', "insert_after": 'abl_b', "options": 'Formula Library'},
		{"fieldname": 'door_open_type', "fieldtype": 'Select', "label": 'Door Open Type', "insert_after": 'door_unit', "options": '\nSwing\nSliding'},
		{"fieldname": 'door_set_type', "fieldtype": 'Select', "label": 'Door Set Type', "insert_after": 'door_open_type', "options": '\nSingle\nPair'},
		{"fieldname": 'price_study', "fieldtype": 'Link', "label": 'Price Study', "insert_after": 'hw_options', "options": 'Item'},
		{"fieldname": 'sub_contract', "fieldtype": 'Link', "label": 'Sub Contract', "insert_after": 'price_study', "options": 'Item'},
		{"fieldname": 'is_panel_cover', "fieldtype": 'Check', "label": 'Panel Cover Item', "insert_after": 'print_hide', "default": '0'},
		{"fieldname": 'open_width', "fieldtype": 'Link', "label": 'Open Width', "insert_after": 'under_cut', "options": 'Formula Library'},
		{"fieldname": 'open_height', "fieldtype": 'Link', "label": 'Open Height', "insert_after": 'open_width', "options": 'Formula Library'},
		{"fieldname": 'key_cylinder', "fieldtype": 'Link', "label": 'Key Cylinder', "insert_after": 'fix_screw_cap', "options": 'Selection Library'},
		{"fieldname": 'use_billing_color', "fieldtype": 'Check', "label": 'Use Billing Color', "insert_after": 'color', "default": '0', "description": "If checked, the color code will be displayed as billing color (e.g., '7099' becomes 'Black')."},
	],
}

RECONCILE_KEYS = ("default",)


def execute():
	total_created = 0
	total_updated = 0
	total_unchanged = 0
	for dt, specs in FIELDS.items():
		dt_created = 0
		dt_updated = 0
		for spec in specs:
			existing = frappe.db.get_value(
				"Custom Field",
				{"dt": dt, "fieldname": spec["fieldname"]},
				["name", *RECONCILE_KEYS],
				as_dict=True,
			)
			if existing:
				updates = {k: spec[k] for k in RECONCILE_KEYS if k in spec and existing.get(k) != spec[k]}
				if updates:
					frappe.db.set_value("Custom Field", existing.name, updates)
					dt_updated += 1
				else:
					total_unchanged += 1
				continue
			try:
				frappe.get_doc({"doctype": "Custom Field", "dt": dt, **spec}).insert(
					ignore_permissions=True
				)
				dt_created += 1
			except Exception as e:
				print(f"[add_bom_creator_custom_fields] FAILED {dt}/{spec['fieldname']}: {e}")
		total_created += dt_created
		total_updated += dt_updated
		print(f"[add_bom_creator_custom_fields] {dt}: created={dt_created} updated={dt_updated} / {len(specs)}")
	if total_created or total_updated:
		frappe.db.commit()
		frappe.clear_cache(doctype="BOM Creator")
		frappe.clear_cache(doctype="BOM Creator Item")
	print(
		f"[add_bom_creator_custom_fields] total: created={total_created}, "
		f"updated={total_updated}, unchanged={total_unchanged}"
	)

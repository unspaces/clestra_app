"""Item extension: 36 Custom Fields + item_code.unique override + Property Setters.

Previously these lived as direct modifications in
apps/erpnext/.../item.json. Moved on 2026-05-10 during upstream restoration.

Critical: item_code unique constraint must be set to 0 because Clestra uses
multi-company (KR-/TC- prefix on name, shared item_code across companies). The
unique flag from upstream would block migration with 88 intentional duplicates.

Heavy-usage custom fields (preserved data):
- company (11,713 items - all of them)
- company_abbr (11,713)
- exclude_from_cover (2,599)
- product_section (2,134)
- product_name (1,985)
- color (1,116), product_type (830), print_order (799), print_group (787)
- print_hide (725), vp_rate (665), use_multiple_print_groups (659)
- ... and many more
"""

import frappe

CUSTOM_FIELDS = [
	{"fieldname": "product_section", "fieldtype": "Select", "label": "Product Section", "options": "\nDoor\nLeaf\nPanel", "insert_after": "deferred_accounting_section", "in_standard_filter": 1},
	{"fieldname": "product_name", "fieldtype": "Select", "label": "Product Name", "options": "\nBaYa\nBTJ6\nP61A\nFizz Box\nM1\nM82\nP85\nMplus\nP81\nP85A\nP85SY\nP86A", "insert_after": "product_section"},
	{"fieldname": "print_hide", "fieldtype": "Check", "label": "Print Hide", "insert_after": "product_name", "default": "0"},
	{"fieldname": "show_qty_bracket", "fieldtype": "Check", "label": "Show Qty. in Brackets", "insert_after": "print_hide", "default": "0"},
	{"fieldname": "color", "fieldtype": "Link", "label": "Color", "options": "Product Color", "insert_after": "show_qty_bracket"},
	{"fieldname": "product_type", "fieldtype": "Select", "label": "Product Type", "options": "\nAlign (P95)\nALTO\nBaya Slim (91)\nBTJ6\nBTJ6 CR\nCLESLINE50 CR\nCP86 CR\nDO1\nFizz Box - Crystal\nFizz Box - London\nFizz Box - Modern\nLignage\nLoft (M82)\nM1 (P94)\nMerchendising\nMplus (P94+)\nOperable Wall\nP61A\nP85 Synops\nP85A\nP86A\nP89L (Clean Room)\npleinAir (P81)\nSYSTEMAGE\nWall Cladding", "insert_after": "color", "in_standard_filter": 1},
	{"fieldname": "door_open_type", "fieldtype": "Select", "label": "Door Open Type", "options": "\nSwing\nSliding", "insert_after": "product_type", "depends_on": "eval:doc.product_section == 'Door'"},
	{"fieldname": "door_set_type", "fieldtype": "Select", "label": "Door Set Type", "options": "\nSingle\nPair", "insert_after": "door_open_type", "depends_on": "eval:doc.product_section == 'Door'"},
	{"fieldname": "handle_direct", "fieldtype": "Select", "label": "Handle Direction", "options": "\nRH\nLH\nRHR\nLHR", "insert_after": "door_set_type"},
	{"fieldname": "product_keyword", "fieldtype": "Data", "label": "Product Keyword", "insert_after": "handle_direct", "in_standard_filter": 1},
	{"fieldname": "print_group", "fieldtype": "Link", "label": "Print Group Name", "options": "Print Group", "insert_after": "product_keyword", "depends_on": "eval:doc.use_multiple_print_groups == '0'"},
	{"fieldname": "print_order", "fieldtype": "Int", "label": "Print Group Order", "insert_after": "print_group", "depends_on": "eval:doc.use_multiple_print_groups == '0'"},
	{"fieldname": "print_section", "fieldtype": "Section Break", "label": "Print Group Settings", "insert_after": "print_order"},
	{"fieldname": "image_caption", "fieldtype": "Data", "label": "Image Caption (English)", "insert_after": "print_section"},
	{"fieldname": "exclude_from_cover", "fieldtype": "Check", "label": "Exclude From PBM Cover", "insert_after": "image_caption", "default": "1", "depends_on": "eval:doc.item_group==\"Finished Product\""},
	{"fieldname": "app_country", "fieldtype": "Data", "label": "Applicable Country", "insert_after": "exclude_from_cover"},
	{"fieldname": "section_break_htcg", "fieldtype": "Section Break", "insert_after": "app_country"},
	{"fieldname": "supported_product_types", "fieldtype": "Data", "label": "Supported Product Types", "insert_after": "section_break_htcg"},
	{"fieldname": "unsupported_product_types", "fieldtype": "Data", "label": "Unsupported Product Types", "insert_after": "supported_product_types"},
	{"fieldname": "column_break_oqdz", "fieldtype": "Column Break", "insert_after": "unsupported_product_types"},
	{"fieldname": "supported_product_sections", "fieldtype": "Data", "label": "Supported Product Sections", "insert_after": "column_break_oqdz"},
	{"fieldname": "include_lm", "fieldtype": "Check", "label": "Include in LM", "insert_after": "supported_product_sections", "default": "0"},
	{"fieldname": "cost_code", "fieldtype": "Data", "label": "Cost Code", "insert_after": "include_lm"},
	{"fieldname": "vp_rate", "fieldtype": "Currency", "label": "VP Rate", "insert_after": "cost_code", "depends_on": "is_stock_item"},
	{"fieldname": "leaf_act_status", "fieldtype": "Link", "label": "Leaf Active Status", "options": "Selection Library", "insert_after": "vp_rate", "depends_on": "eval:doc.product_section == 'Leaf'"},
	{"fieldname": "leaf_thk", "fieldtype": "Link", "label": "Leaf Thickness", "options": "Product Thickness", "insert_after": "leaf_act_status", "depends_on": "eval:doc.product_section == 'Leaf'"},
	{"fieldname": "leaf_material", "fieldtype": "Link", "label": "Leaf Material", "options": "Selection Library", "insert_after": "leaf_thk", "depends_on": "eval:doc.product_section == 'Leaf'"},
	{"fieldname": "image_caption_kr", "fieldtype": "Data", "label": "Image Caption (Korean)", "insert_after": "leaf_material"},
	{"fieldname": "image_caption_cn", "fieldtype": "Data", "label": "Image Caption (Chinese)", "insert_after": "image_caption_kr"},
	{"fieldname": "item_name_cn", "fieldtype": "Data", "label": "Item Name (Chinese)", "insert_after": "image_caption_cn", "in_global_search": 1, "bold": 1, "allow_in_quick_entry": 1, "columns": 2},
	{"fieldname": "use_multiple_print_groups", "fieldtype": "Check", "label": "Use Multiple Print Groups", "insert_after": "item_name_cn", "default": "0"},
	{"fieldname": "multiple_print_groups", "fieldtype": "Table", "label": "Multiple Print Groups", "options": "Multiple Print Group", "insert_after": "use_multiple_print_groups", "depends_on": "eval:doc.use_multiple_print_groups == '1'"},
	{"fieldname": "image_captions_section", "fieldtype": "Section Break", "label": "Image Captions", "insert_after": "multiple_print_groups"},
	{"fieldname": "panel_set_type", "fieldtype": "Select", "label": "Panel Set Type", "options": "\nSingle\nDouble", "insert_after": "image_captions_section", "depends_on": "eval:doc.product_section == 'Panel'"},
	{"fieldname": "company", "fieldtype": "Link", "label": "Company", "options": "Company", "insert_after": "panel_set_type", "reqd": 1, "in_list_view": 1, "in_standard_filter": 1, "allow_in_quick_entry": 1},
	{"fieldname": "company_abbr", "fieldtype": "Data", "label": "Company Abbr", "insert_after": "company", "hidden": 1, "fetch_from": "company.abbr"},
]

# Property Setter to disable upstream's unique=1 on item_code. Clestra uses
# multi-company (name=KR-/TC- prefix, item_code shared) — 88 intentional
# duplicates currently exist.
ITEM_CODE_UNIQUE = "0"


def _ensure_property_setter(field_name, prop, value, prop_type="Check"):
	"""Idempotent Property Setter create/update."""
	existing = frappe.db.get_value("Property Setter", {
		"doc_type": "Item",
		"field_name": field_name,
		"property": prop,
	})
	if existing:
		current = frappe.db.get_value("Property Setter", existing, "value")
		if current != value:
			frappe.db.set_value("Property Setter", existing, "value", value)
	else:
		frappe.get_doc({
			"doctype": "Property Setter",
			"doctype_or_field": "DocField",
			"doc_type": "Item",
			"field_name": field_name,
			"property": prop,
			"property_type": prop_type,
			"value": value,
		}).insert(ignore_permissions=True)


def execute():
	# 1. Blocker prevention: item_code.unique = 0
	_ensure_property_setter("item_code", "unique", ITEM_CODE_UNIQUE, prop_type="Check")

	# 2. Custom Fields
	created = 0
	for spec in CUSTOM_FIELDS:
		if frappe.db.exists("Custom Field", {"dt": "Item", "fieldname": spec["fieldname"]}):
			continue
		try:
			frappe.get_doc({"doctype": "Custom Field", "dt": "Item", **spec}).insert(
				ignore_permissions=True
			)
			created += 1
		except Exception as e:
			print(f"[add_item_custom_fields] FAILED {spec['fieldname']}: {e}")

	frappe.db.commit()
	print(f"[add_item_custom_fields] created={created} / {len(CUSTOM_FIELDS)}")

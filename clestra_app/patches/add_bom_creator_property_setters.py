"""BOM Creator + BOM Creator Item Property Setters.

These PSes existed only as DB rows on eclestra (created at various points via
Customize Form UI). Codifying them here so fresh installs reproduce the same
list-view layout and search-filter behavior.

Field-level (8):
- BOM Creator.company.in_standard_filter = 1 (search-filter chip)
- BOM Creator.item_name.in_standard_filter = 1
- BOM Creator.status.in_standard_filter = 1
- BOM Creator.company.in_list_view = 0 (hide standard list column)
- BOM Creator.default_warehouse.in_list_view = 0
- BOM Creator.item_name.in_list_view = 1
- BOM Creator.raw_material_cost.in_list_view = 1
- BOM Creator.door_frame.length = 500 (column width in grid)
- BOM Creator Item.door_frame.length = 500

DocType-level (1):
- BOM Creator.allow_rename = 1 (upstream restoration dropped this — keep
  rename capability for legacy renames; doesn't trigger on regular flow.)
"""

import frappe


# Field-level Property Setters
FIELD_PROPERTY_SETTERS = [
	# Search filter chips at top of list view
	{"doc_type": "BOM Creator", "field_name": "company",
	 "property": "in_standard_filter", "property_type": "Check", "value": "1"},
	{"doc_type": "BOM Creator", "field_name": "item_name",
	 "property": "in_standard_filter", "property_type": "Check", "value": "1"},
	{"doc_type": "BOM Creator", "field_name": "status",
	 "property": "in_standard_filter", "property_type": "Check", "value": "1"},

	# List-view column visibility tweaks
	{"doc_type": "BOM Creator", "field_name": "company",
	 "property": "in_list_view", "property_type": "Check", "value": "0"},
	{"doc_type": "BOM Creator", "field_name": "default_warehouse",
	 "property": "in_list_view", "property_type": "Check", "value": "0"},
	{"doc_type": "BOM Creator", "field_name": "item_name",
	 "property": "in_list_view", "property_type": "Check", "value": "1"},
	{"doc_type": "BOM Creator", "field_name": "raw_material_cost",
	 "property": "in_list_view", "property_type": "Check", "value": "1"},

	# Grid column widths (door_frame is a Data field used as label/sub-grid)
	{"doc_type": "BOM Creator", "field_name": "door_frame",
	 "property": "length", "property_type": "Int", "value": "500"},
	{"doc_type": "BOM Creator Item", "field_name": "door_frame",
	 "property": "length", "property_type": "Int", "value": "500"},
]

# DocType-level Property Setters
DOCTYPE_PROPERTY_SETTERS = [
	{"doc_type": "BOM Creator", "property": "allow_rename",
	 "property_type": "Check", "value": "1"},
]


def _ensure_field_property_setter(spec):
	existing = frappe.db.get_value("Property Setter", {
		"doc_type": spec["doc_type"],
		"field_name": spec["field_name"],
		"property": spec["property"],
	})
	if existing:
		current = frappe.db.get_value("Property Setter", existing, "value")
		if current != spec["value"]:
			frappe.db.set_value("Property Setter", existing, "value", spec["value"])
			return "updated"
		return "unchanged"
	frappe.get_doc({
		"doctype": "Property Setter",
		"doctype_or_field": "DocField",
		**spec,
	}).insert(ignore_permissions=True)
	return "created"


def _ensure_doctype_property_setter(spec):
	existing = frappe.db.get_value("Property Setter", {
		"doc_type": spec["doc_type"],
		"field_name": ["is", "not set"],
		"property": spec["property"],
	})
	if existing:
		current = frappe.db.get_value("Property Setter", existing, "value")
		if current != spec["value"]:
			frappe.db.set_value("Property Setter", existing, "value", spec["value"])
			return "updated"
		return "unchanged"
	frappe.get_doc({
		"doctype": "Property Setter",
		"doctype_or_field": "DocType",
		**spec,
	}).insert(ignore_permissions=True)
	return "created"


def execute():
	counts = {"created": 0, "updated": 0, "unchanged": 0}

	for spec in FIELD_PROPERTY_SETTERS:
		result = _ensure_field_property_setter(spec)
		counts[result] += 1

	for spec in DOCTYPE_PROPERTY_SETTERS:
		result = _ensure_doctype_property_setter(spec)
		counts[result] += 1

	if counts["created"] or counts["updated"]:
		frappe.db.commit()
		frappe.clear_cache(doctype="BOM Creator")
		frappe.clear_cache(doctype="BOM Creator Item")

	print(
		f"[add_bom_creator_property_setters] "
		f"created={counts['created']}, updated={counts['updated']}, "
		f"unchanged={counts['unchanged']}"
	)

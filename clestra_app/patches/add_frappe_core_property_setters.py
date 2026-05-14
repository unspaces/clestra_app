"""Frappe Core Property Setters (DocType-level).

These are doctype-level (not field-level) Property Setters that survived
only as JSON edits in apps/frappe/. Codify here so fresh installs reproduce
the same behavior and ERPNext/Frappe can be upgraded cleanly.

DocType-level (3):
- Color.allow_rename = 1 (Clestra renames Color records as part of palette
  reorganization; upstream defaults to no-rename.)
- Color.naming_rule = "Set by user" (paired with autoname="Prompt"; lets
  the rename actually work when needed.)

Field-level Property Setters that came from Frappe core JSON drift were
already migrated in add_frappe_core_custom_fields.py (Address.address_type
options, Event.event_category/event_type options/default). This patch only
covers the doctype-level ones that PROPERTY SETTERS exist for but were
previously inline JSON.
"""

import frappe


DOCTYPE_PROPERTY_SETTERS = [
	{"doc_type": "Color", "property": "allow_rename",
	 "property_type": "Check", "value": "1"},
	{"doc_type": "Color", "property": "naming_rule",
	 "property_type": "Data", "value": "Set by user"},
]


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
	for spec in DOCTYPE_PROPERTY_SETTERS:
		counts[_ensure_doctype_property_setter(spec)] += 1

	if counts["created"] or counts["updated"]:
		frappe.db.commit()
		frappe.clear_cache(doctype="Color")

	print(
		f"[add_frappe_core_property_setters] "
		f"created={counts['created']}, updated={counts['updated']}, "
		f"unchanged={counts['unchanged']}"
	)

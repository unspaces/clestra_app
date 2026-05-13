"""Frappe Core DocTypes migration: Custom Fields + Property Setters.

Previously direct edits in apps/frappe/frappe/. Moved on 2026-05-11.

Custom Fields:
- Address: search_address (1 hidden helper)
- Country: clestra_code, is_clestra (6 of 249 countries tagged)
- User: full_name_region, company, section_break_ofge, signature,
        column_break_ripa, column_break_vqws (58/59 users have company,
        50/59 have full_name_region — heavily used)

Property Setters (override upstream Select options):
- Address.address_type: move "Office" to front of options list
- Event.event_category: replace upstream's narrow set with Clestra event types
  (Meeting, Seminar, Workshop, Conference, Training, Holiday, Dayoff, ...)
- Event.event_type: reverse to "Public\\nPrivate" and default to Public
"""

import frappe

CUSTOM_FIELDS = {
	"Address": [
		{"fieldname": "search_address", "fieldtype": "Data", "label": "Search Address",
		 "insert_after": "links", "hidden": 1},
	],
	"Country": [
		{"fieldname": "clestra_code", "fieldtype": "Int", "label": "Clestra Code",
		 "insert_after": "code", "in_list_view": 1},
		{"fieldname": "is_clestra", "fieldtype": "Check", "label": "Is Clestra",
		 "insert_after": "clestra_code", "default": "0"},
	],
	"User": [
		# Restore original Clestra layout (was in main User Details tab before
		# upstream restoration moved customizations into Custom Fields).
		{"fieldname": "full_name_region", "fieldtype": "Data",
		 "label": "Full Name (Regional)",
		 "insert_after": "full_name", "in_list_view": 1},
		{"fieldname": "company", "fieldtype": "Link", "label": "Company",
		 "options": "Company",
		 "insert_after": "column_break_11",
		 "in_list_view": 1, "in_standard_filter": 1},
		{"fieldname": "section_break_ofge", "fieldtype": "Section Break",
		 "insert_after": "user_image"},
		{"fieldname": "signature", "fieldtype": "Signature", "label": "Signature",
		 "insert_after": "section_break_ofge"},
		{"fieldname": "column_break_ripa", "fieldtype": "Column Break",
		 "insert_after": "signature"},
		{"fieldname": "column_break_vqws", "fieldtype": "Column Break",
		 "insert_after": "column_break_ripa"},
	],
}

PROPERTY_SETTERS = [
	{"doc_type": "Address", "field_name": "address_type", "property": "options",
	 "property_type": "Text",
	 "value": "Office\nBilling\nShipping\nPersonal\nPlant\nPostal\nShop\nSubsidiary\nWarehouse\nCurrent\nPermanent\nOther"},
	{"doc_type": "Event", "field_name": "event_category", "property": "options",
	 "property_type": "Text",
	 "value": "Meeting\nSeminar\nWorkshop\nConference\nTraining\nHoliday\nDayoff\nEvent\nOther"},
	{"doc_type": "Event", "field_name": "event_type", "property": "options",
	 "property_type": "Text",
	 "value": "Public\nPrivate"},
	{"doc_type": "Event", "field_name": "event_type", "property": "default",
	 "property_type": "Text",
	 "value": "Public"},
]


def _ensure_property_setter(spec):
	existing = frappe.db.get_value("Property Setter", {
		"doc_type": spec["doc_type"],
		"field_name": spec["field_name"],
		"property": spec["property"],
	})
	if existing:
		current = frappe.db.get_value("Property Setter", existing, "value")
		if current != spec["value"]:
			frappe.db.set_value("Property Setter", existing, "value", spec["value"])
		return False
	frappe.get_doc({
		"doctype": "Property Setter",
		"doctype_or_field": "DocField",
		**spec,
	}).insert(ignore_permissions=True)
	return True


def execute():
	cf_created = 0
	cf_updated = 0
	for dt, specs in CUSTOM_FIELDS.items():
		for spec in specs:
			existing = frappe.db.get_value(
				"Custom Field", {"dt": dt, "fieldname": spec["fieldname"]}, "name"
			)
			if existing:
				# Keep insert_after in sync with patch (positions evolve as we
				# learn the right layout).
				current = frappe.db.get_value("Custom Field", existing, "insert_after")
				if current != spec.get("insert_after"):
					frappe.db.set_value(
						"Custom Field", existing, "insert_after", spec["insert_after"]
					)
					cf_updated += 1
				continue
			try:
				frappe.get_doc({"doctype": "Custom Field", "dt": dt, **spec}).insert(
					ignore_permissions=True
				)
				cf_created += 1
			except Exception as e:
				print(f"[add_frappe_core_custom_fields] FAILED {dt}/{spec['fieldname']}: {e}")

	ps_created = 0
	for spec in PROPERTY_SETTERS:
		if _ensure_property_setter(spec):
			ps_created += 1

	frappe.db.commit()
	# Clear meta cache so reordered Custom Fields take effect on next request.
	frappe.clear_cache(doctype="User")
	frappe.clear_cache(doctype="Country")
	frappe.clear_cache(doctype="Address")
	frappe.clear_cache(doctype="Event")
	print(
		f"[add_frappe_core_custom_fields] CF created={cf_created}, "
		f"updated={cf_updated}, PS created={ps_created}"
	)

"""Customer extension: 3 Custom Fields + customer_type Select option extension.

Previously these lived as direct modifications in
apps/erpnext/.../customer.json. Moved on 2026-04-24 during upstream restoration.

Fields:
- organizational_structure: 4 customers using
- activity: 0 customers using (kept for future tagging)
- company: 159 customers using  (heavily used — Clestra multi-company tracking)

customer_type option extension adds "Holding" and "Joint Venture" to upstream's
default ["Company", "Individual", "Proprietorship", "Partnership"] via Property
Setter so the standard Select field's options list is extended without editing
the upstream JSON.
"""

import frappe

CUSTOM_FIELDS = [
	{
		"fieldname": "organizational_structure",
		"fieldtype": "Select",
		"label": "Organizational Structure",
		"options": "\nHead Office\nSubsidiary\nMain Branch\nDivision/Unit",
		"insert_after": "column_break_nwor",
	},
	{
		"fieldname": "activity",
		"fieldtype": "Select",
		"label": "Activity",
		"options": "\nA - Agriculture, Forestry and Fishing\nB - Mining and Quarrying\nC - Manufacturing\nD - Electricity, Gas, Steam and Air Conditioning Supply\nE - Water Supply; Sewerage, Waste Management and Remediation Activities\nF - Construction\nG - Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles\nH - Transportation and Storage\nI - Accommodation and Food Service Activities\nJ - Information and Communication\nK - Financial and Insurance Activities\nL - Real Estate Activities\nM - Professional, Scientific and Technical Activities\nN - Administrative and Support Service Activities\nO - Public Administration and Defense; Compulsory Social Security\nP - Education\nQ - Human Health and Social Work Activities\nR - Arts, Entertainment and Recreation\nS - Other Service Activities\nT - Activities of Households as Employers; Undifferentiated Goods- and Services-Producing Activities of Households for Own Use\nU - Activities of Extraterrestrial Organizations and Bodies",
		"description": "International Standard Industrial Classification",
		"insert_after": "organizational_structure",
	},
	{
		"fieldname": "company",
		"fieldtype": "Link",
		"label": "Company",
		"options": "Company",
		"read_only": 1,
		"insert_after": "activity",
	},
]

CUSTOMER_TYPE_OPTIONS = (
	"\nCompany\nIndividual\nProprietorship\nPartnership\nHolding\nJoint Venture"
)


def execute():
	# 1. Custom Fields
	created_cf = 0
	for spec in CUSTOM_FIELDS:
		if frappe.db.exists("Custom Field", {"dt": "Customer", "fieldname": spec["fieldname"]}):
			continue
		doc = frappe.get_doc({"doctype": "Custom Field", "dt": "Customer", **spec})
		doc.insert(ignore_permissions=True)
		created_cf += 1

	# 2. Property Setter for customer_type options extension
	ps_name = frappe.db.get_value("Property Setter", {
		"doc_type": "Customer",
		"field_name": "customer_type",
		"property": "options",
	})
	if ps_name:
		# Align existing property setter value if drifted
		current = frappe.db.get_value("Property Setter", ps_name, "value")
		if current != CUSTOMER_TYPE_OPTIONS:
			frappe.db.set_value("Property Setter", ps_name, "value", CUSTOMER_TYPE_OPTIONS)
	else:
		frappe.get_doc({
			"doctype": "Property Setter",
			"doctype_or_field": "DocField",
			"doc_type": "Customer",
			"field_name": "customer_type",
			"property": "options",
			"property_type": "Text",
			"value": CUSTOMER_TYPE_OPTIONS,
		}).insert(ignore_permissions=True)

	frappe.db.commit()
	print(f"[add_customer_custom_fields] created_cf={created_cf}")

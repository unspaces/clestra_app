"""Create 17 Custom Fields on Project (Clestra extension).

Previously these lived as direct modifications in
apps/erpnext/.../project/project.json. Moved to Custom Fields on 2026-04-24
during upstream restoration.

Existing data (192 Projects with mpr/job_id/project_group_id, etc.) is preserved
because the underlying DB columns are not touched — only the schema metadata
moves from the upstream DocType JSON to a Custom Field record.
"""

import frappe

FIELDS = [
	{"fieldname": "end_client", "fieldtype": "Data", "label": "End Client",
	 "insert_after": "naming_series", "read_only": 1, "hidden": 1},
	{"fieldname": "edit_proj_name", "fieldtype": "Check", "label": "Edit Project Name",
	 "insert_after": "end_client", "default": "0", "hidden": 1},
	{"fieldname": "section_break_euqb", "fieldtype": "Section Break",
	 "insert_after": "edit_proj_name"},
	{"fieldname": "company_abbr", "fieldtype": "Data", "label": "Company Abbr",
	 "insert_after": "section_break_euqb", "hidden": 1},
	{"fieldname": "project_group_id", "fieldtype": "Link", "label": "Project Group ID",
	 "options": "Project Group", "insert_after": "company_abbr"},
	{"fieldname": "project_id_section", "fieldtype": "Section Break", "label": "Project ID",
	 "insert_after": "project_group_id"},
	{"fieldname": "mpr", "fieldtype": "Link", "label": "MPR", "options": "MPR Code",
	 "insert_after": "project_id_section", "in_list_view": 1, "in_standard_filter": 1},
	{"fieldname": "column_break_ikaw", "fieldtype": "Column Break",
	 "insert_after": "mpr"},
	{"fieldname": "job_id", "fieldtype": "Link", "label": "Job ID", "options": "Job ID",
	 "insert_after": "column_break_ikaw", "read_only": 1, "in_list_view": 1, "in_standard_filter": 1,
	 "fetch_from": "project_group_id.job_id"},
	{"fieldname": "column_break_tbuk", "fieldtype": "Column Break",
	 "insert_after": "job_id"},
	{"fieldname": "contract_no", "fieldtype": "Data", "label": "Contract No.",
	 "insert_after": "column_break_tbuk", "in_list_view": 1, "in_standard_filter": 1},
	{"fieldname": "project_group_section", "fieldtype": "Section Break", "label": "Project Group",
	 "insert_after": "contract_no"},
	{"fieldname": "project_name_region", "fieldtype": "Data", "label": "Project Name (Regional)",
	 "insert_after": "project_group_section",
	 "description": "Enter the project name in the local language",
	 "in_list_view": 1, "in_standard_filter": 1},
	{"fieldname": "project_segment", "fieldtype": "Data", "label": "Project Segment",
	 "insert_after": "project_name_region",
	 "description": "Enter floor, product name, group, or classification"},
	{"fieldname": "project_group_name", "fieldtype": "Data", "label": "Project Group Name",
	 "insert_after": "project_segment"},
	{"fieldname": "general_contractor", "fieldtype": "Link", "label": "General Contractor",
	 "options": "Customer", "insert_after": "project_group_name", "in_global_search": 1},
	{"fieldname": "column_break_bydw", "fieldtype": "Column Break",
	 "insert_after": "general_contractor"},
]


def execute():
	created = 0
	for spec in FIELDS:
		if frappe.db.exists("Custom Field", {"dt": "Project", "fieldname": spec["fieldname"]}):
			continue
		doc = frappe.get_doc({
			"doctype": "Custom Field",
			"dt": "Project",
			**spec,
		})
		doc.insert(ignore_permissions=True)
		created += 1
	if created:
		frappe.db.commit()
	print(f"[add_project_custom_fields] Created {created} Custom Fields (skipped {len(FIELDS) - created} existing)")

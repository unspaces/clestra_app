"""Set fetch_from on Project.job_id Custom Field.

The job_id Custom Field was created without fetch_from, so selecting
project_group_id did not auto-populate job_id and the read-only field
rendered as an empty (apparently invisible) input.

Project Group has a `job_id` Link field, so we wire
fetch_from = "project_group_id.job_id" to pull the value from the
selected Project Group.
"""

import frappe


def execute():
	cf_name = "Project-job_id"
	if not frappe.db.exists("Custom Field", cf_name):
		print(f"[set_project_job_id_fetch_from] {cf_name} not found, skipping")
		return

	cf = frappe.get_doc("Custom Field", cf_name)
	target = "project_group_id.job_id"
	if cf.fetch_from == target:
		print(f"[set_project_job_id_fetch_from] already set, skipping")
		return

	cf.fetch_from = target
	cf.save(ignore_permissions=True)
	frappe.clear_cache(doctype="Project")
	frappe.db.commit()
	print(f"[set_project_job_id_fetch_from] fetch_from set to {target!r}")

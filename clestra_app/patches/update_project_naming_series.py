"""Update Project naming_series Property Setter to new PROJ-... pattern.

Old default/options:  PRO-.{division}.-.YY.-.###
New default/options:  PROJ-.{mpr}.-.{job_id}.-.{contract_no}.-.###

Actual name generation is handled by the doc_events.autoname hook
(clestra_app.utils.project_naming.autoname), which substitutes empty
mpr/job_id/contract_no with 'X'. This Property Setter update is for
form display only — the dropdown shows the new pattern. Existing 192
Projects keep their original PRO-... names because autoname only fires
on insert.
"""

import frappe

NEW_VALUE = "PROJ-.{mpr}.-.{job_id}.-.{contract_no}.-.###"


def execute():
	updated = 0
	for ps_name in ("Project-naming_series-default", "Project-naming_series-options"):
		if not frappe.db.exists("Property Setter", ps_name):
			print(f"[update_project_naming_series] {ps_name} not found, skipping")
			continue
		current = frappe.db.get_value("Property Setter", ps_name, "value")
		if current == NEW_VALUE:
			continue
		frappe.db.set_value("Property Setter", ps_name, "value", NEW_VALUE)
		updated += 1
		print(f"[update_project_naming_series] {ps_name}: {current!r} -> {NEW_VALUE!r}")
	if updated:
		frappe.clear_cache(doctype="Project")
		frappe.db.commit()
	print(f"[update_project_naming_series] updated {updated} Property Setter(s)")

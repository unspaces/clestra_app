"""Custom autoname for Project.

Format: PROJ-{mpr}-{job_id}-{contract_no}-### with per-prefix counter.
Empty mpr/job_id/contract_no are substituted with 'X' in the name (the
underlying field values stay empty).

Wired via hooks.doc_events["Project"]["autoname"], which runs before
Frappe's naming_series rule kicks in — once we set ``doc.name``, the
default flow is skipped.
"""

import frappe
from frappe.model.naming import make_autoname


def _coerce(value):
	v = (value or "").strip()
	return v if v else "X"


def autoname(doc, method=None):
	if doc.name:
		return

	# job_id fetch_from runs during validate (after autoname), so look it up
	# manually when missing but a project_group_id is selected.
	job_id_val = (doc.job_id or "").strip()
	if not job_id_val and doc.get("project_group_id"):
		job_id_val = frappe.db.get_value(
			"Project Group", doc.project_group_id, "job_id"
		) or ""

	mpr = _coerce(doc.get("mpr"))
	job_id = _coerce(job_id_val)
	contract_no = _coerce(doc.get("contract_no"))

	prefix = f"PROJ-{mpr}-{job_id}-{contract_no}-"
	doc.name = make_autoname(prefix + ".###", "Project", doc)

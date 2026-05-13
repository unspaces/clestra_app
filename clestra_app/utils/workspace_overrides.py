"""Re-apply Clestra Workspace customizations after upstream DocType sync.

Why:
  ERPNext ships Workspace JSONs (apps/erpnext/.../<module>/workspace/<name>/<name>.json).
  On `bench migrate` Frappe re-applies those JSONs, overwriting any DB-side
  customizations (shortcuts removed, sequence_id changed, broken links pruned).
  We capture the desired state as JSON fixtures in
  clestra_app/fixtures/workspaces/ and re-apply via `after_migrate`.

Fixture files contain the full Workspace doc dict, with broken links already
filtered out (e.g., the deleted Exotel Settings / Woocommerce Settings links
from ERPNext Integrations).

To add another workspace override:
  1. Run `bench --site <site> execute clestra_app.utils.workspace_overrides.export_workspace --args "['<Name>']"`
     OR craft the fixture JSON manually.
  2. Add the workspace name to WORKSPACES below.
"""

import json
import os

import frappe

FIXTURE_DIR = os.path.join(
	frappe.get_app_path("clestra_app") if False else "/home/frappe/frappe-bench/apps/clestra_app/clestra_app",
	"fixtures",
	"workspaces",
)

WORKSPACES = (
	# ERPNext
	"Buying", "ERPNext Integrations",
	"Selling", "Stock", "Projects", "CRM", "Home",
	"Accounting", "ERPNext Settings",
	"Financial Reports", "Payables", "Receivables",
	"Manufacturing", "Quality", "Support",
	# Frappe
	"Tools", "Users", "Integrations", "Build", "Website",
)


def _fixture_path(name):
	slug = name.lower().replace(" ", "_")
	return os.path.join(
		frappe.get_app_path("clestra_app"),
		"fixtures",
		"workspaces",
		f"{slug}.json",
	)


def export_workspace(name):
	"""Snapshot current DB state of a workspace to its fixture JSON.

	Run manually: bench execute clestra_app.utils.workspace_overrides.export_workspace --args "['<Name>']"
	"""
	ws = frappe.get_doc("Workspace", name)
	d = ws.as_dict(no_default_fields=True, no_nulls=False)
	for k in ("owner", "modified", "modified_by", "creation", "docstatus", "idx", "doctype"):
		d.pop(k, None)
	path = _fixture_path(name)
	os.makedirs(os.path.dirname(path), exist_ok=True)
	with open(path, "w") as f:
		json.dump(d, f, indent=2, ensure_ascii=False)
	print(f"Exported {name} → {path}")


def apply_workspace_overrides():
	"""Re-apply each fixture, replacing the current DB record. Idempotent."""
	applied = 0
	for name in WORKSPACES:
		path = _fixture_path(name)
		if not os.path.exists(path):
			continue
		with open(path) as f:
			data = json.load(f)

		# Workspace primary key is `name`
		if not frappe.db.exists("Workspace", name):
			# Upstream might have removed it; skip rather than fail
			continue

		# Replace the record. Using db_set + recreating child tables is cleaner
		# than .update() because Workspace has many child tables.
		ws = frappe.get_doc("Workspace", name)

		# Top-level scalar fields
		for k in ("label", "title", "icon", "indicator_color", "module",
		          "parent_page", "public", "is_hidden", "for_user", "restrict_to_domain",
		          "hide_custom", "type", "sequence_id", "content"):
			if k in data:
				ws.set(k, data[k])

		# Child tables
		for table_field in ("links", "shortcuts", "charts", "number_cards",
		                    "quick_lists", "custom_blocks", "roles"):
			if table_field in data:
				ws.set(table_field, [])
				for row in data[table_field] or []:
					row_clean = {k: v for k, v in row.items()
					             if k not in ("name", "owner", "modified", "modified_by",
					                          "creation", "docstatus", "idx",
					                          "parent", "parenttype", "parentfield")}
					ws.append(table_field, row_clean)

		ws.save(ignore_permissions=True)
		applied += 1

	if applied:
		frappe.db.commit()
		frappe.clear_cache()

	print(f"[workspace_overrides] re-applied={applied} / {len(WORKSPACES)}")

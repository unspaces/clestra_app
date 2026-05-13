"""Restore/enforce Clestra custom DocPerm rules after any DocType sync.

Problem:
  Standard DocType permissions live in the DocType JSON. When Frappe reloads
  a DocType (e.g., during `bench migrate`), it wipes existing DocPerm rows
  and re-inserts from the JSON. Any permissions added via the Role Permissions
  Manager UI that weren't also written back to the JSON are lost.

Solution:
  Keep custom permission rules as data here, and re-apply them via
  `after_migrate` hook. Idempotent: creates missing rows, and aligns rights
  on existing rows so the DB matches the declared spec exactly.

To add new custom permissions:
  Append an entry to CUSTOM_PERMISSIONS. Use `bench --site <site> execute
  clestra_app.utils.custom_permissions.ensure_custom_permissions` to re-apply
  without a full migrate.
"""

import frappe

# All right fields we track on DocPerm. Anything not listed in a rule's
# "rights" dict defaults to 0.
ALL_RIGHTS = (
	"read", "write", "create", "delete", "submit", "cancel", "amend",
	"report", "export", "import", "share", "print", "email", "set_user_permissions",
)

CUSTOM_PERMISSIONS = [
	# ---- Currency Exchange ----
	{
		"parent": "Currency Exchange",
		"role": "Design Manager",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Currency Exchange",
		"role": "Design User",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Project ----
	# Clestra restricts Projects User to read-only (removed write/create/delete
	# from upstream defaults). Applied automatically after every migrate so
	# any upstream re-sync that re-enables write/create/delete gets clamped back.
	{
		"parent": "Project",
		"role": "Projects User",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Supplier ----
	# Clestra grants full CRUD to Design Manager/Design User (not in upstream).
	{
		"parent": "Supplier",
		"role": "Design Manager",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Supplier",
		"role": "Design User",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Customer ----
	# Clestra adds Design Manager/User and Local Admin (HK) with read/write/create
	# + reporting. No delete.
	{
		"parent": "Customer",
		"role": "Design Manager",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Customer",
		"role": "Design User",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Customer",
		"role": "Local Admin (HK)",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Item ----
	# Clestra extends Maintenance/Manufacturing User with write/create/delete,
	# and adds Design Manager/Design User with full rights.
	{
		"parent": "Item",
		"role": "Maintenance User",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1},
	},
	{
		"parent": "Item",
		"role": "Manufacturing User",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1},
	},
	{
		"parent": "Item",
		"role": "Design Manager",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Item",
		"role": "Design User",
		"permlevel": 0,
		"rights": {"read": 1, "write": 1, "create": 1, "delete": 1,
		           "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Company ----
	# Clestra adds read-only access for Sales Manager + Design Manager + Design User.
	{
		"parent": "Company",
		"role": "Sales Manager",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Company",
		"role": "Design Manager",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	{
		"parent": "Company",
		"role": "Design User",
		"permlevel": 0,
		"rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1},
	},
	# ---- Color (Frappe) ----
	{"parent": "Color", "role": "Projects Manager", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Color", "role": "Projects User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Color", "role": "Manufacturing Manager", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Color", "role": "Manufacturing User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Color", "role": "Design Manager", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Color", "role": "Design User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	# ---- Currency (Frappe) ----
	{"parent": "Currency", "role": "Design Manager", "permlevel": 0,
	 "rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Currency", "role": "Design User", "permlevel": 0,
	 "rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Currency", "role": "Sales Manager", "permlevel": 0,
	 "rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Currency", "role": "Manufacturing Manager", "permlevel": 0,
	 "rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Currency", "role": "Manufacturing User", "permlevel": 0,
	 "rights": {"read": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	# ---- Event / Page / Web Page (Frappe) — HR User added ----
	{"parent": "Event", "role": "HR User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Page", "role": "HR User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
	{"parent": "Web Page", "role": "HR User", "permlevel": 0,
	 "rights": {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "share": 1, "print": 1, "email": 1}},
]


def _expected_rights(spec):
	rights = {k: 0 for k in ALL_RIGHTS}
	rights.update(spec.get("rights", {}))
	return rights


def ensure_custom_permissions():
	"""Create missing rows and align rights on existing rows."""
	created = 0
	updated = 0
	skipped = 0

	for spec in CUSTOM_PERMISSIONS:
		parent = spec["parent"]
		role = spec["role"]
		permlevel = spec.get("permlevel", 0)
		expected = _expected_rights(spec)

		if not frappe.db.exists("DocType", parent):
			continue
		if not frappe.db.exists("Role", role):
			continue

		existing = frappe.db.get_value(
			"DocPerm",
			{"parent": parent, "role": role, "permlevel": permlevel},
			["name"] + list(ALL_RIGHTS),
			as_dict=True,
		)

		if not existing:
			dp = frappe.get_doc({
				"doctype": "DocPerm",
				"parent": parent,
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": role,
				"permlevel": permlevel,
				**expected,
			})
			dp.insert(ignore_permissions=True)
			created += 1
			continue

		# Align rights on existing row
		mismatch = {k: expected[k] for k in ALL_RIGHTS if existing.get(k) != expected[k]}
		if mismatch:
			frappe.db.set_value("DocPerm", existing["name"], mismatch)
			updated += 1
		else:
			skipped += 1

	if created or updated:
		frappe.db.commit()
		frappe.clear_cache()

	print(
		f"[custom_permissions] total={len(CUSTOM_PERMISSIONS)} "
		f"created={created} updated={updated} skipped={skipped}"
	)

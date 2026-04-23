import frappe
import re


SHARED_VALUES = {"HAFELE", "Sample"}
YESNO_VALUES = {"Y", "N"}

FIELD_TO_OPT = {
	"mortise": "HW Mortise",
	"handle": "HW Handle",
	"key_cylinder": "HW Key Cylinder",
	"door_closer": "Door Closer",
}

FIELDS_WITH_YESNO = {"key_cylinder", "door_closer"}

# key_cylinder 값 중 다른 opt_name과 충돌하는 경우 suffix 붙여 구분
KEY_CYLINDER_RENAMES = {
	"CDCM": "CDCM (Key Cylinder)",
}


def normalize(val):
	if not val:
		return None
	# HTML 태그 제거
	val = re.sub(r"<[^>]*>", "", val)
	val = val.strip()
	val = re.sub(r"\s+", " ", val)
	return val or None


def apply_field_rename(field, normalized_val):
	"""필드별 특수 rename 규칙 적용"""
	if field == "key_cylinder" and normalized_val in KEY_CYLINDER_RENAMES:
		return KEY_CYLINDER_RENAMES[normalized_val]
	return normalized_val


def get_target_opt_name(field, normalized_val):
	upper = normalized_val.upper()
	if upper in YESNO_VALUES:
		return "YesNo" if field in FIELDS_WITH_YESNO else None
	if normalized_val in SHARED_VALUES:
		return "door_hw_values"
	return FIELD_TO_OPT[field]


def _collect_buckets():
	buckets = {}
	for field in FIELD_TO_OPT:
		rows = frappe.db.sql(
			f"""SELECT DISTINCT {field} AS val FROM `tabDoor Hardware Spec`
			WHERE {field} IS NOT NULL AND {field} != ''""",
			as_dict=True,
		)
		for r in rows:
			n = normalize(r["val"])
			if not n:
				continue
			opt = get_target_opt_name(field, n)
			if not opt:
				continue
			final_val = apply_field_rename(field, n)
			buckets.setdefault(opt, set()).add(final_val)
	return buckets


def list_unique_values():
	buckets = _collect_buckets()
	for opt in sorted(buckets):
		vals = sorted(buckets[opt])
		print(f"\n=== {opt} ({len(vals)} values) ===")
		for v in vals:
			print(f"  '{v}'")
	return buckets


def create_selection_library_entries():
	buckets = _collect_buckets()
	created = 0
	skipped = 0
	errors = []
	for opt_name, vals in buckets.items():
		for val in sorted(vals):
			existing = frappe.db.get_value(
				"Selection Library", val, ["opt_name"], as_dict=True
			)
			if existing:
				if existing["opt_name"] != opt_name:
					errors.append(
						f"'{val}': exists as opt_name='{existing['opt_name']}', expected '{opt_name}'"
					)
				else:
					skipped += 1
				continue
			try:
				doc = frappe.get_doc(
					{
						"doctype": "Selection Library",
						"opt_name": opt_name,
						"opt_value": val,
					}
				)
				doc.insert(ignore_permissions=True)
				created += 1
			except Exception as e:
				errors.append(f"{opt_name}/{val}: {e}")
	frappe.db.commit()
	print(f"\nCreated: {created}, Skipped: {skipped}")
	if errors:
		print(f"Errors ({len(errors)}):")
		for e in errors:
			print(f"  {e}")
	return created, skipped, errors


def migrate_values():
	updated = 0
	cleared = 0
	for field in FIELD_TO_OPT:
		docs = frappe.db.sql(
			f"""SELECT name, {field} AS val FROM `tabDoor Hardware Spec`
			WHERE {field} IS NOT NULL AND {field} != ''""",
			as_dict=True,
		)
		for d in docs:
			n = normalize(d["val"])
			if n is None:
				frappe.db.set_value(
					"Door Hardware Spec", d["name"], field, None, update_modified=False
				)
				cleared += 1
				continue
			final_val = apply_field_rename(field, n)
			if final_val != d["val"]:
				frappe.db.set_value(
					"Door Hardware Spec", d["name"], field, final_val, update_modified=False
				)
				updated += 1
	frappe.db.commit()
	print(f"\nUpdated: {updated}, Cleared: {cleared}")
	return updated, cleared

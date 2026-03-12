# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
import io
import base64
import pyqrcode


# Fields safe to expose to guest users (no pricing, supplier, internal data)
GUEST_SAFE_FIELDS = [
	"item_code", "item_name", "product_section", "product_type", "product_keyword",
	"zone", "color", "size", "qty", "rh_qty", "lh_qty",
	"width", "ch", "uh", "ph", "pw", "depth", "lm",
	"leaf_width", "leaf_height", "open_width", "open_height",
	"ceiling_visible", "base_visible_h", "panel_trh", "panel_crh",
	"abl_a", "abl_b",
	"door_open_type", "door_set_type", "door_hw_spec",
	"hinge", "hinge_type", "hinge_num", "keeper",
	"door_closer", "door_closer_name", "handle_direct",
	"glass_a", "glass_b",
	"print_group", "print_order", "parent_item_code", "indent_level",
	"bom_no", "remark", "add_desc", "zone_qty",
	"parent_row_no", "fg_item_code"
]


@frappe.whitelist()
def generate_qr_codes(pbm_name, child_row_names=None, position_data=None):
	"""Generate QR codes for selected items in detail_bom_items.

	Creates or updates a single QR Item Lookup document per PBM,
	with child rows (QR Item Detail) for each item.

	Args:
		pbm_name: Project Billing Master document name
		child_row_names: JSON list of specific child row names
		position_data: JSON dict with position info
	"""
	pbm = frappe.get_doc("Project Billing Master", pbm_name)
	site_url = frappe.utils.get_url()

	if child_row_names:
		if isinstance(child_row_names, str):
			child_row_names = json.loads(child_row_names)
		rows = [r for r in pbm.detail_bom_items if r.name in child_row_names]
	else:
		rows = [r for r in pbm.detail_bom_items if r.item_code]

	if not rows:
		frappe.throw(_("No items found for QR code generation."))

	# Parse position data
	pos_data = {}
	if position_data:
		if isinstance(position_data, str):
			pos_data = json.loads(position_data)
		else:
			pos_data = position_data

	# Get or create the QR Item Lookup document for this PBM
	qr_lookup = _get_or_create_qr_lookup(pbm_name, pbm.project)

	generated_count = 0
	skipped_count = 0

	for row in rows:
		# Check if QR already exists for this child row
		existing_child = None
		for item in qr_lookup.items:
			if item.pbm_child_name == row.name:
				existing_child = item
				break

		if existing_child:
			if pos_data:
				existing_child.product_position_desc = pos_data.get("position", "")
				existing_child.drawing_ref = pos_data.get("drawing_ref", "")
				existing_child.floor_level = pos_data.get("floor_level", "")
				existing_child.grid_ref = pos_data.get("grid_ref", "")
				existing_child.position_note = pos_data.get("position_note", "")
				generated_count += 1
			else:
				skipped_count += 1
			continue

		token = frappe.generate_hash(length=10)
		qr_url = f"{site_url}/qr_item?token={token}"

		# Generate QR code image
		qr_png_data = _generate_qr_image(qr_url)

		# Add child row to QR Item Lookup
		child_row = qr_lookup.append("items", {
			"qr_token": token,
			"pbm_child_name": row.name,
			"item_code": row.item_code,
			"item_name": row.item_name,
			"product_section": row.product_section,
			"product_type": getattr(row, "product_type", None),
			"zone": row.zone,
			"color": getattr(row, "color", None),
			"size": getattr(row, "size", None),
			"qty": row.qty,
			"product_position_desc": pos_data.get("position", ""),
			"drawing_ref": pos_data.get("drawing_ref", ""),
			"floor_level": pos_data.get("floor_level", ""),
			"grid_ref": pos_data.get("grid_ref", ""),
			"position_note": pos_data.get("position_note", ""),
			"print_count": 0,
		})

		# Save to get child row name
		qr_lookup.save(ignore_permissions=True)

		# Save QR image as file attachment
		file_doc = frappe.get_doc({
			"doctype": "File",
			"file_name": f"qr_{token}.png",
			"attached_to_doctype": "QR Item Lookup",
			"attached_to_name": qr_lookup.name,
			"content": qr_png_data,
			"is_private": 0,
		})
		file_doc.save(ignore_permissions=True)

		child_row.qr_image = file_doc.file_url

		# Update PBM child table row with token
		frappe.db.set_value(
			"Project Billing Master Sub Item", row.name,
			"qr_token", token, update_modified=False
		)

		generated_count += 1

	# Final save
	qr_lookup.generated_on = frappe.utils.now_datetime()
	qr_lookup.generated_by = frappe.session.user
	qr_lookup.save(ignore_permissions=True)

	frappe.db.commit()

	msg = _("{0} QR codes generated.").format(generated_count)
	if skipped_count:
		msg += " " + _("{0} items skipped (QR already exists).").format(skipped_count)

	return {
		"generated": generated_count,
		"skipped": skipped_count,
		"message": msg
	}


def _get_or_create_qr_lookup(pbm_name, project=None):
	"""Get existing or create new QR Item Lookup document for a PBM."""
	existing = frappe.db.exists("QR Item Lookup", {"pbm": pbm_name})
	if existing:
		return frappe.get_doc("QR Item Lookup", existing)

	qr_lookup = frappe.get_doc({
		"doctype": "QR Item Lookup",
		"pbm": pbm_name,
		"project": project,
		"is_active": 1,
		"generated_on": frappe.utils.now_datetime(),
		"generated_by": frappe.session.user,
	})
	qr_lookup.insert(ignore_permissions=True)
	return qr_lookup


@frappe.whitelist()
def regenerate_qr(pbm_name, child_row_name):
	"""Regenerate QR code for a specific item, replacing the existing one."""
	existing = frappe.db.exists("QR Item Lookup", {"pbm": pbm_name})
	if existing:
		qr_lookup = frappe.get_doc("QR Item Lookup", existing)
		qr_lookup.items = [item for item in qr_lookup.items if item.pbm_child_name != child_row_name]
		qr_lookup.save(ignore_permissions=True)

	frappe.db.set_value(
		"Project Billing Master Sub Item", child_row_name,
		"qr_token", "", update_modified=False
	)

	return generate_qr_codes(pbm_name, child_row_names=json.dumps([child_row_name]))


@frappe.whitelist(allow_guest=True)
def get_qr_item_info(token):
	"""Fetch item information for a scanned QR code.

	Searches QR Item Detail child table for the token.
	Returns filtered data safe for guest access.
	"""
	if not token:
		frappe.throw(_("Invalid QR code"), frappe.ValidationError)

	# Find the child row with this token
	child_data = frappe.db.sql("""
		SELECT name, parent, pbm_child_name, item_code, item_name,
			product_section, zone, color, size, qty,
			drawing_ref, floor_level, grid_ref, position_note,
			assembly_sequence, assembly_group, assembly_notes,
			product_position_desc, qr_image
		FROM `tabQR Item Detail`
		WHERE qr_token = %(token)s
		LIMIT 1
	""", {"token": token}, as_dict=True)
	child_data = child_data[0] if child_data else None

	if not child_data:
		return {"error": "not_found", "message": _("QR code not found.")}

	# Get parent QR Item Lookup
	qr_lookup = frappe.db.get_value(
		"QR Item Lookup",
		child_data.parent,
		["name", "pbm", "project", "is_active"],
		as_dict=True
	)

	if not qr_lookup:
		return {"error": "not_found", "message": _("QR code not found.")}

	if not qr_lookup.is_active:
		return {"error": "inactive", "message": _("This QR code has been deactivated.")}

	# Get PBM child row data (filtered fields only)
	item_data = {}
	if child_data.pbm_child_name:
		child_row = frappe.db.get_value(
			"Project Billing Master Sub Item",
			child_data.pbm_child_name,
			GUEST_SAFE_FIELDS,
			as_dict=True
		)
		if child_row:
			item_data = {k: v for k, v in child_row.items() if v is not None and v != ""}

	# Get PBM header info (project context)
	pbm_data = {}
	if qr_lookup.pbm:
		pbm_info = frappe.db.get_value(
			"Project Billing Master",
			qr_lookup.pbm,
			["project", "contract_no", "mpr", "job_id", "country", "city", "street_address"],
			as_dict=True
		)
		if pbm_info:
			pbm_data = {k: v for k, v in pbm_info.items() if v is not None and v != ""}
			if pbm_info.project:
				project_name = frappe.db.get_value("Project", pbm_info.project, "project_name")
				pbm_data["project_name"] = project_name

	# Get related items in same zone/print_group
	related_items = []
	if item_data.get("zone") and item_data.get("print_group"):
		related = frappe.db.get_all(
			"Project Billing Master Sub Item",
			filters={
				"parent": qr_lookup.pbm,
				"parentfield": "detail_bom_items",
				"zone": item_data["zone"],
				"print_group": item_data["print_group"],
				"name": ["!=", child_data.pbm_child_name],
				"indent_level": 0,
			},
			fields=["item_code", "item_name", "size", "qty", "color", "qr_token"],
			limit=20
		)
		related_items = related

	# Parse zone_qty JSON
	zone_breakdown = {}
	if item_data.get("zone_qty"):
		try:
			zone_breakdown = json.loads(item_data["zone_qty"]) if isinstance(item_data["zone_qty"], str) else item_data["zone_qty"]
		except (json.JSONDecodeError, TypeError):
			pass

	result = {
		"qr_info": {
			"token": token,
			"is_active": qr_lookup.is_active,
		},
		"item": item_data,
		"project": pbm_data,
		"location": {
			"drawing_ref": child_data.drawing_ref,
			"floor_level": child_data.floor_level,
			"grid_ref": child_data.grid_ref,
			"position_note": child_data.position_note,
		},
		"assembly": {
			"sequence": child_data.assembly_sequence,
			"group": child_data.assembly_group,
			"notes": child_data.assembly_notes,
		},
		"product_position": {
			"description": child_data.product_position_desc,
			"image": child_data.qr_image,
		},
		"zone_breakdown": zone_breakdown,
		"related_items": related_items,
	}

	return result


@frappe.whitelist()
def deactivate_qr_codes(pbm_name):
	"""Deactivate all QR codes for a Project Billing Master."""
	existing = frappe.db.exists("QR Item Lookup", {"pbm": pbm_name})
	if not existing:
		return {"deactivated": 0, "message": _("No QR codes found for this PBM.")}

	qr_lookup = frappe.get_doc("QR Item Lookup", existing)
	qr_lookup.is_active = 0
	qr_lookup.deactivated_on = frappe.utils.now_datetime()
	qr_lookup.save(ignore_permissions=True)
	frappe.db.commit()

	item_count = len(qr_lookup.items)
	return {"deactivated": item_count, "message": _("{0} QR codes deactivated.").format(item_count)}


@frappe.whitelist()
def activate_qr_codes(pbm_name):
	"""Re-activate all QR codes for a Project Billing Master."""
	existing = frappe.db.exists("QR Item Lookup", {"pbm": pbm_name})
	if not existing:
		return {"activated": 0, "message": _("No QR codes found for this PBM.")}

	qr_lookup = frappe.get_doc("QR Item Lookup", existing)
	qr_lookup.is_active = 1
	qr_lookup.deactivated_on = None
	qr_lookup.save(ignore_permissions=True)
	frappe.db.commit()

	item_count = len(qr_lookup.items)
	return {"activated": item_count, "message": _("{0} QR codes activated.").format(item_count)}


@frappe.whitelist()
def get_qr_labels(pbm_name, filter_zone=None, filter_product_section=None):
	"""Get QR label data for printing."""
	existing = frappe.db.exists("QR Item Lookup", {"pbm": pbm_name})
	if not existing:
		return []

	filters = {"parent": existing}
	if filter_zone:
		filters["zone"] = filter_zone
	if filter_product_section:
		filters["product_section"] = filter_product_section

	conditions = ["`parent` = %(parent)s"]
	params = {"parent": existing}
	if filter_zone:
		conditions.append("`zone` = %(zone)s")
		params["zone"] = filter_zone
	if filter_product_section:
		conditions.append("`product_section` = %(product_section)s")
		params["product_section"] = filter_product_section

	labels = frappe.db.sql("""
		SELECT qr_token, qr_image, item_code, item_name,
			zone, color, size, qty, product_section,
			drawing_ref, floor_level, grid_ref,
			assembly_sequence, assembly_group
		FROM `tabQR Item Detail`
		WHERE {conditions}
		ORDER BY zone ASC, assembly_sequence ASC, item_code ASC
	""".format(conditions=" AND ".join(conditions)), params, as_dict=True)

	return labels


@frappe.whitelist()
def get_position_suggestions(item_code, product_section):
	"""Get auto-position suggestions based on historical data."""
	suggestions = {
		"position_descriptions": [],
		"assembly_groups": [],
		"drawing_refs": [],
	}

	past_records = frappe.db.sql("""
		SELECT product_position_desc, assembly_group, assembly_sequence,
			drawing_ref, floor_level, grid_ref, position_note
		FROM `tabQR Item Detail`
		WHERE item_code = %(item_code)s
		ORDER BY creation DESC
		LIMIT 50
	""", {"item_code": item_code}, as_dict=True)

	position_descs = {}
	assembly_groups = {}
	drawing_refs = {}

	for rec in past_records:
		if rec.product_position_desc:
			position_descs[rec.product_position_desc] = position_descs.get(rec.product_position_desc, 0) + 1
		if rec.assembly_group:
			assembly_groups[rec.assembly_group] = assembly_groups.get(rec.assembly_group, 0) + 1
		if rec.drawing_ref:
			drawing_refs[rec.drawing_ref] = drawing_refs.get(rec.drawing_ref, 0) + 1

	suggestions["position_descriptions"] = sorted(position_descs.keys(), key=lambda x: -position_descs[x])[:5]
	suggestions["assembly_groups"] = sorted(assembly_groups.keys(), key=lambda x: -assembly_groups[x])[:5]
	suggestions["drawing_refs"] = sorted(drawing_refs.keys(), key=lambda x: -drawing_refs[x])[:5]

	if product_section:
		section_records = frappe.db.sql("""
			SELECT product_position_desc, assembly_group
			FROM `tabQR Item Detail`
			WHERE product_section = %(product_section)s
			GROUP BY product_position_desc
			ORDER BY count(*) DESC
			LIMIT 5
		""", {"product_section": product_section}, as_dict=True)
		for rec in section_records:
			if rec.product_position_desc and rec.product_position_desc not in suggestions["position_descriptions"]:
				suggestions["position_descriptions"].append(rec.product_position_desc)

	return suggestions


@frappe.whitelist()
def get_qr_position_data(qr_token):
	"""Get position data for a QR Item Detail by token."""
	if not qr_token:
		return None

	data = frappe.db.sql("""
		SELECT product_position_desc, drawing_ref, floor_level, grid_ref, position_note
		FROM `tabQR Item Detail`
		WHERE qr_token = %(qr_token)s
		LIMIT 1
	""", {"qr_token": qr_token}, as_dict=True)

	return data[0] if data else None


@frappe.whitelist()
def increment_print_count(qr_lookup_name, child_row_name):
	"""Increment print count for a single QR item."""
	qr_lookup = frappe.get_doc("QR Item Lookup", qr_lookup_name)
	for item in qr_lookup.items:
		if item.name == child_row_name:
			item.print_count = (item.print_count or 0) + 1
			item.last_printed = frappe.utils.now_datetime()
			qr_lookup.save(ignore_permissions=True)
			frappe.db.commit()
			return {"print_count": item.print_count}

	frappe.throw(_("Item not found."))


@frappe.whitelist()
def increment_print_count_bulk(qr_lookup_name, child_row_names):
	"""Increment print count for multiple QR items."""
	if isinstance(child_row_names, str):
		child_row_names = json.loads(child_row_names)

	qr_lookup = frappe.get_doc("QR Item Lookup", qr_lookup_name)
	results = []
	now = frappe.utils.now_datetime()

	for item in qr_lookup.items:
		if item.name in child_row_names:
			item.print_count = (item.print_count or 0) + 1
			item.last_printed = now
			results.append({"name": item.name, "print_count": item.print_count})

	qr_lookup.save(ignore_permissions=True)
	frappe.db.commit()
	return results


def _generate_qr_image(data):
	"""Generate QR code PNG image and return bytes."""
	qr = pyqrcode.create(data, error="M")
	buffer = io.BytesIO()
	qr.png(buffer, scale=6, module_color=[0, 0, 0], background=[255, 255, 255])
	return buffer.getvalue()

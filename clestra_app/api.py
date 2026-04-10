# Copyright (c) 2026, Se Yong EOM and contributors
# Packing List API endpoints for QR scan operations.

import frappe
from frappe import _
import json


@frappe.whitelist(allow_guest=True)
def pallet_lookup(id, pallet=None):
	"""Pallet QR scan — returns pallet info and item list.

	New structure: id = Project Packing List name, pallet = pallet_no.
	"""
	if not id:
		return {"error": "not_found", "message": _("Pallet not found.")}

	if not frappe.db.exists("Project Packing List", id):
		return {"error": "not_found", "message": _("Packing list not found.")}

	ppl = frappe.get_doc("Project Packing List", id)
	pallet_no = int(pallet) if pallet else 0

	if pallet_no <= 0:
		return {"error": "not_found", "message": _("Invalid pallet number.")}

	# Get pallet label from tokens
	pallet_label = ""
	try:
		tokens = json.loads(ppl.pallet_qr_tokens or "{}")
		pdata = tokens.get(str(pallet_no), {})
		pallet_label = pdata.get("label", "")
	except (json.JSONDecodeError, TypeError):
		pass

	if not pallet_label:
		prefix = ppl.pallet_prefix or "#"
		pallet_label = f"{prefix}{pallet_no}"

	# Filter items for this pallet
	items = []
	for item in ppl.items:
		if item.pallet_no and int(item.pallet_no) == pallet_no:
			items.append({
				"item_code": item.item_code,
				"item_name": item.item_name,
				"zone": item.zone,
				"color": item.color,
				"size": item.size,
				"qty": item.qty,
				"handle_direct": item.handle_direct,
				"item_qr_token": item.item_qr_token,
			})

	return {
		"pallet": pallet_label,
		"pallet_no": pallet_no,
		"packing_list": ppl.name,
		"project": ppl.project_name,
		"project_id": ppl.project,
		"status": ppl.status,
		"total_items": len(items),
		"items": items,
	}


@frappe.whitelist(allow_guest=True)
def item_lookup(id):
	"""Item QR scan — returns item info with pallet/project context.

	Looks up by item_qr_token in Packing List Detail.
	"""
	if not id:
		return {"error": "not_found", "message": _("Item not found.")}

	item_data = frappe.db.sql("""
		SELECT pld.item_code, pld.item_name, pld.zone, pld.color, pld.size,
			pld.qty, pld.pallet_no, pld.handle_direct, pld.parent
		FROM `tabPacking List Detail` pld
		WHERE pld.item_qr_token = %(id)s
		LIMIT 1
	""", {"id": id}, as_dict=True)

	if not item_data:
		return {"error": "not_found", "message": _("Item not found.")}

	item = item_data[0]
	ppl = frappe.db.get_value(
		"Project Packing List", item.parent,
		["name", "project_name", "status", "pallet_prefix"],
		as_dict=True
	)

	prefix = (ppl.pallet_prefix or "#") if ppl else "#"
	pallet_label = f"{prefix}{item.pallet_no}" if item.pallet_no and item.pallet_no > 0 else _("Unassigned")

	return {
		"item_code": item.item_code,
		"item_name": item.item_name,
		"project": ppl.project_name if ppl else "",
		"packing_list": ppl.name if ppl else "",
		"pallet_label": pallet_label,
		"pallet_no": item.pallet_no,
		"zone": item.zone,
		"color": item.color,
		"size": item.size,
		"qty": item.qty,
		"handle_direct": item.handle_direct,
	}


@frappe.whitelist()
def add_item_to_pallet(ppl_name, pallet_no, item_qr_token):
	"""Scan an item QR to assign it to a pallet in a Project Packing List."""
	if not ppl_name or not item_qr_token:
		frappe.throw(_("Missing parameters."))

	pallet_no = int(pallet_no)
	doc = frappe.get_doc("Project Packing List", ppl_name)

	# Find the item by QR token
	found = False
	for item in doc.items:
		if item.item_qr_token == item_qr_token:
			if item.pallet_no and item.pallet_no > 0 and item.pallet_no == pallet_no:
				return {"status": "duplicate", "message": _("Already in this pallet.")}
			if item.pallet_no and item.pallet_no > 0:
				return {
					"status": "conflict",
					"message": _("This item is in Pallet #{0}. Move it?").format(item.pallet_no),
					"current_pallet": item.pallet_no,
					"item_name": item.name,
				}
			item.pallet_no = pallet_no
			found = True
			break

	if not found:
		return {"status": "not_found", "message": _("Item QR not found in this packing list.")}

	doc.save()
	return {"status": "success", "message": _("Item assigned to Pallet #{0}.").format(pallet_no)}

# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
import json


# Fields used to determine if two items are identical (for combining)
COMBINE_KEY_FIELDS = [
	"item_code", "item_name", "product_section", "product_keyword",
	"zone", "color", "size", "handle_direct"
]

# Sort order for product_section
SECTION_ORDER = {"Door": 0, "Leaf": 1, "Panel": 2}


class ProjectPackingList(Document):
	def validate(self):
		if not self.project:
			frappe.throw(_("Project is mandatory."))
		self._sort_items()
		self._update_summary()
		self._update_pbm_counts()

	def on_update(self):
		self._generate_pallet_qrs()
		self._backfill_item_qrs()

	def _sort_items(self):
		"""Sort items by pallet_no → zone → product_section → item_code."""
		if not self.items:
			return

		def sort_key(row):
			pallet = row.pallet_no if row.pallet_no and row.pallet_no > 0 else 9999
			zone = (row.zone or "").lower()
			section = row.product_section or ""
			section_rank = SECTION_ORDER.get(section, 99)
			item = (row.item_code or "").lower()
			return (pallet, zone, section_rank, item)

		sorted_items = sorted(self.items, key=sort_key)
		for i, item in enumerate(sorted_items):
			item.idx = i + 1

	def _update_summary(self):
		"""Update total_pallets and total_items."""
		if not self.items:
			self.total_pallets = 0
			self.total_items = 0
			return

		pallet_nos = set()
		for item in self.items:
			if item.pallet_no and item.pallet_no > 0:
				pallet_nos.add(item.pallet_no)

		self.total_pallets = len(pallet_nos)
		self.total_items = len(self.items)

	def _update_pbm_counts(self):
		"""Update section counts (Door, Leaf, Panel, Sub Items) for each PBM row."""
		for pbm_row in self.pbm_items:
			pbm = pbm_row.project_billing_master
			if not pbm:
				continue

			counts = frappe.db.sql("""
				SELECT
					parentfield,
					COALESCE(product_section, '') AS section,
					COUNT(*) AS cnt
				FROM `tabProject Billing Master Sub Item`
				WHERE parent = %(pbm)s
				  AND parentfield IN ('door_cover', 'panel_cover', 'sub_items')
				  AND item_code IS NOT NULL AND item_code != ''
				GROUP BY parentfield, product_section
			""", {"pbm": pbm}, as_dict=True)

			door = 0
			leaf = 0
			panel = 0
			sub = 0
			for c in counts:
				if c.parentfield == "door_cover":
					if c.section == "Leaf":
						leaf += c.cnt
					else:
						door += c.cnt
				elif c.parentfield == "panel_cover":
					panel += c.cnt
				elif c.parentfield == "sub_items":
					sub += c.cnt

			pbm_row.door_count = door
			pbm_row.leaf_count = leaf
			pbm_row.panel_count = panel
			pbm_row.sub_items_count = sub

	def _generate_pallet_qrs(self):
		"""Generate Pallet QR codes on save for assigned pallets."""
		from clestra_app.utils.qr_generator import generate_qr_code

		site_url = frappe.utils.get_url()

		pallet_tokens = {}
		if self.pallet_qr_tokens:
			try:
				pallet_tokens = json.loads(self.pallet_qr_tokens) if isinstance(self.pallet_qr_tokens, str) else self.pallet_qr_tokens
			except (json.JSONDecodeError, TypeError):
				pass

		pallet_nos = set()
		for item in self.items:
			if item.pallet_no and item.pallet_no > 0:
				pallet_nos.add(item.pallet_no)

		changed = False
		for pno in pallet_nos:
			key = str(pno)
			if key not in pallet_tokens:
				token = frappe.generate_hash(length=10)
				prefix = self.pallet_prefix or "#"
				pallet_label = f"{prefix}{pno}"
				qr_url = f"{site_url}/pallet?id={self.name}&pallet={pno}"
				file_url = generate_qr_code(
					label=f"{self.name}-P{pno}",
					data=qr_url,
					attached_to_doctype="Project Packing List",
					attached_to_name=self.name,
				)
				pallet_tokens[key] = {"token": token, "qr_image": file_url, "label": pallet_label}
				changed = True

		# Remove tokens for pallets no longer used
		for key in list(pallet_tokens.keys()):
			if int(key) not in pallet_nos:
				del pallet_tokens[key]
				changed = True

		if changed:
			self.pallet_qr_tokens = json.dumps(pallet_tokens)
			frappe.db.set_value("Project Packing List", self.name,
				"pallet_qr_tokens", self.pallet_qr_tokens,
				update_modified=False)
			frappe.db.commit()

	def _backfill_item_qrs(self):
		"""Backfill missing Item QR tokens and parent_item_code on save."""
		from clestra_app.clestra_manufacturing.qr_code_api import ensure_item_qr_codes

		changed = False

		# Collect items needing QR or parent_item_code backfill
		pbm_qr_rows = {}
		backfill_parent_rows = []

		for item in self.items:
			# QR backfill
			if not (item.item_qr_token and item.item_qr_image):
				if item.source_row_name and item.pbm_name:
					pbm_qr_rows.setdefault(item.pbm_name, []).append(item)

			# parent_item_code backfill for sub_items
			if item.source_table == "sub_items" and not item.parent_item_code and item.source_row_name:
				backfill_parent_rows.append(item)

		# Backfill QR tokens
		for pbm_name, items in pbm_qr_rows.items():
			row_names = [i.source_row_name for i in items]
			qr_map = ensure_item_qr_codes(pbm_name, row_names)

			for item in items:
				qr_info = qr_map.get(item.source_row_name, {})
				if qr_info.get("token") and qr_info.get("image"):
					item.item_qr_token = qr_info["token"]
					item.item_qr_image = qr_info["image"]
					frappe.db.set_value("Packing List Detail", item.name, {
						"item_qr_token": qr_info["token"],
						"item_qr_image": qr_info["image"],
					}, update_modified=False)
					changed = True

		# Backfill parent_item_code from PBM source
		for item in backfill_parent_rows:
			parent_code = frappe.db.get_value(
				"Project Billing Master Sub Item", item.source_row_name, "parent_item_code"
			)
			if parent_code:
				item.parent_item_code = parent_code
				frappe.db.set_value("Packing List Detail", item.name,
					"parent_item_code", parent_code, update_modified=False)
				changed = True

		if changed:
			frappe.db.commit()


@frappe.whitelist()
def get_pbm_list(project):
	"""Return Project Billing Masters linked to a project with section counts."""
	pbms = frappe.get_all(
		"Project Billing Master",
		filters={"project": project},
		fields=["name", "project", "contract_no", "mpr"],
		order_by="name asc"
	)

	for pbm in pbms:
		counts = frappe.db.sql("""
			SELECT parentfield, COALESCE(product_section, '') AS section, COUNT(*) AS cnt
			FROM `tabProject Billing Master Sub Item`
			WHERE parent = %(pbm)s
			  AND parentfield IN ('door_cover', 'panel_cover', 'sub_items')
			  AND item_code IS NOT NULL AND item_code != ''
			GROUP BY parentfield, product_section
		""", {"pbm": pbm.name}, as_dict=True)

		door = leaf = panel = sub = 0
		for c in counts:
			if c.parentfield == "door_cover":
				if c.section == "Leaf":
					leaf += c.cnt
				else:
					door += c.cnt
			elif c.parentfield == "panel_cover":
				panel += c.cnt
			elif c.parentfield == "sub_items":
				sub += c.cnt

		pbm["door_count"] = door
		pbm["leaf_count"] = leaf
		pbm["panel_count"] = panel
		pbm["sub_items_count"] = sub

	return pbms


@frappe.whitelist()
def generate_pallet_qrs(ppl_name, pallet_count=None):
	"""Pre-create Pallet QR codes based on pallet_count, or from assigned items."""
	from clestra_app.utils.qr_generator import generate_qr_code

	doc = frappe.get_doc("Project Packing List", ppl_name)
	site_url = frappe.utils.get_url()

	pallet_tokens = {}
	if doc.pallet_qr_tokens:
		try:
			pallet_tokens = json.loads(doc.pallet_qr_tokens) if isinstance(doc.pallet_qr_tokens, str) else doc.pallet_qr_tokens
		except (json.JSONDecodeError, TypeError):
			pass

	# Determine which pallets to create QR for
	if pallet_count:
		pallet_nos = set(range(1, int(pallet_count) + 1))
	else:
		pallet_nos = set()
		for item in doc.items:
			if item.pallet_no and item.pallet_no > 0:
				pallet_nos.add(item.pallet_no)

	if not pallet_nos:
		return {"status": "error", "message": _("Set the number of pallets to create.")}

	generated = 0
	for pno in pallet_nos:
		key = str(pno)
		if key not in pallet_tokens:
			token = frappe.generate_hash(length=10)
			prefix = doc.pallet_prefix or "#"
			pallet_label = f"{prefix}{pno}"
			qr_url = f"{site_url}/pallet?id={doc.name}&pallet={pno}"
			file_url = generate_qr_code(
				label=f"{doc.name}-P{pno}",
				data=qr_url,
				attached_to_doctype="Project Packing List",
				attached_to_name=doc.name,
			)
			pallet_tokens[key] = {"token": token, "qr_image": file_url, "label": pallet_label}
			generated += 1

	doc.pallet_qr_tokens = json.dumps(pallet_tokens)
	frappe.db.set_value("Project Packing List", ppl_name,
		"pallet_qr_tokens", doc.pallet_qr_tokens,
		update_modified=False)
	frappe.db.commit()

	return {
		"status": "success",
		"message": _("{0} Pallet QR(s) generated.").format(generated),
		"pallet_qr_tokens": doc.pallet_qr_tokens,
	}


@frappe.whitelist()
def load_pbm_items(pbm_names, existing_items_json=None):
	"""Load door_cover, panel_cover, sub_items from selected PBMs.

	Combines items with identical key fields across PBMs.
	Maps existing QR Item Lookup tokens to items.
	"""
	if isinstance(pbm_names, str):
		pbm_names = json.loads(pbm_names)

	existing_source_rows = set()
	if existing_items_json:
		if isinstance(existing_items_json, str):
			existing_items = json.loads(existing_items_json)
		else:
			existing_items = existing_items_json
		for ei in existing_items:
			if ei.get("source_row_name"):
				existing_source_rows.add(ei["source_row_name"])

	source_tables = ["door_cover", "panel_cover", "sub_items"]
	raw_items = []

	from clestra_app.clestra_manufacturing.qr_code_api import ensure_item_qr_codes

	for pbm_name in pbm_names:
		# Collect all child row names per PBM first, then auto-generate missing QRs
		all_rows_for_pbm = []

		for table_name in source_tables:
			rows = frappe.db.sql("""
				SELECT psi.name, psi.item_code AS item_link,
					COALESCE(itm.item_code, psi.item_code) AS item_code,
					psi.item_name, psi.product_section, psi.product_keyword,
					psi.zone, psi.color, psi.size, psi.qty, psi.old_idx,
					psi.handle_direct, psi.remark,
					COALESCE(pitm.item_code, psi.parent_item_code) AS parent_item_code
				FROM `tabProject Billing Master Sub Item` psi
				LEFT JOIN `tabItem` itm ON itm.name = psi.item_code
				LEFT JOIN `tabItem` pitm ON pitm.name = psi.parent_item_code
				WHERE psi.parent = %(pbm)s
				  AND psi.parentfield = %(table)s
				  AND psi.item_code IS NOT NULL AND psi.item_code != ''
				ORDER BY psi.old_idx ASC, psi.item_code ASC
			""", {"pbm": pbm_name, "table": table_name}, as_dict=True)

			for row in rows:
				if row.name not in existing_source_rows:
					all_rows_for_pbm.append({"row": row, "table": table_name})

		# Auto-generate Item QR for all rows that don't have one yet
		child_row_names = [r["row"].name for r in all_rows_for_pbm]
		qr_map = ensure_item_qr_codes(pbm_name, child_row_names) if child_row_names else {}

		for entry in all_rows_for_pbm:
			row = entry["row"]
			table_name = entry["table"]
			qr_info = qr_map.get(row.name, {})

			raw_items.append({
				"pbm_name": pbm_name,
				"source_table": table_name,
				"source_row_name": row.name,
				"item_code": row.item_code,
				"item_name": row.item_name,
				"handle_direct": row.handle_direct or "",
				"product_section": row.product_section or "",
				"product_keyword": row.product_keyword or "",
				"zone": row.zone or "",
				"color": row.color or "",
				"size": row.size or "",
				"qty": row.qty or 0,
				"remark": row.remark or "",
				"parent_item_code": row.parent_item_code or "",
				"item_qr_token": qr_info.get("token", ""),
				"item_qr_image": qr_info.get("image", ""),
			})

	# Combine identical items
	combined = _combine_items(raw_items)
	return combined


def _combine_items(raw_items):
	"""Combine items with identical key fields, summing qty."""
	buckets = {}

	for item in raw_items:
		key = tuple(item.get(f, "") for f in COMBINE_KEY_FIELDS)

		if key in buckets:
			existing = buckets[key]
			existing["qty"] += item.get("qty", 0)
			existing["combined_qty"] = existing["qty"]
			sources = json.loads(existing.get("combined_from", "[]"))
			sources.append({
				"pbm": item["pbm_name"],
				"table": item["source_table"],
				"row": item["source_row_name"],
				"qty": item.get("qty", 0),
			})
			existing["combined_from"] = json.dumps(sources)
			# Keep QR token from first source
		else:
			item["combined_qty"] = item.get("qty", 0)
			item["combined_from"] = json.dumps([{
				"pbm": item["pbm_name"],
				"table": item["source_table"],
				"row": item["source_row_name"],
				"qty": item.get("qty", 0),
			}])
			buckets[key] = item

	result = list(buckets.values())

	def sort_key(r):
		section_rank = SECTION_ORDER.get(r.get("product_section", ""), 99)
		return (r.get("zone", "").lower(), section_rank, r.get("item_code", "").lower())

	result.sort(key=sort_key)
	return result


@frappe.whitelist()
def split_item(ppl_name, row_name, splits_json):
	"""Split an item row into multiple rows with different pallet assignments.

	Args:
		ppl_name: Project Packing List name
		row_name: The child row name to split
		splits_json: JSON list of {pallet_no: int, qty: float}
	"""
	if isinstance(splits_json, str):
		splits = json.loads(splits_json)
	else:
		splits = splits_json

	doc = frappe.get_doc("Project Packing List", ppl_name)

	# Find the source row
	source_row = None
	source_idx = None
	for i, item in enumerate(doc.items):
		if item.name == row_name:
			source_row = item
			source_idx = i
			break

	if not source_row:
		frappe.throw(_("Item row not found."))

	total_split_qty = sum(s.get("qty", 0) for s in splits)
	if total_split_qty > source_row.qty:
		frappe.throw(_("Split quantities ({0}) exceed original qty ({1}).").format(total_split_qty, source_row.qty))

	# Copy base data from source
	base_data = {
		"pbm_name": source_row.pbm_name,
		"source_table": source_row.source_table,
		"source_row_name": source_row.source_row_name,
		"item_code": source_row.item_code,
		"item_name": source_row.item_name,
		"handle_direct": source_row.handle_direct,
		"product_section": source_row.product_section,
		"product_keyword": source_row.product_keyword,
		"zone": source_row.zone,
		"color": source_row.color,
		"size": source_row.size,
		"combined_from": source_row.combined_from,
		"item_qr_token": source_row.item_qr_token,
		"item_qr_image": source_row.item_qr_image,
	}

	# Remove original row
	doc.items = [item for item in doc.items if item.name != row_name]

	# Add split rows
	remaining_qty = source_row.qty - total_split_qty
	for split in splits:
		if split.get("qty", 0) <= 0:
			continue
		new_row = doc.append("items", base_data)
		new_row.pallet_no = split.get("pallet_no", 0)
		new_row.qty = split["qty"]
		new_row.combined_qty = split["qty"]

	# Add remaining as unassigned if any
	if remaining_qty > 0:
		new_row = doc.append("items", base_data)
		new_row.pallet_no = 0
		new_row.qty = remaining_qty
		new_row.combined_qty = remaining_qty

	doc.save()
	return {"status": "success", "message": _("Item split into {0} rows.").format(len(splits) + (1 if remaining_qty > 0 else 0))}

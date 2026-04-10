# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class PackingListPallet(Document):
	def after_insert(self):
		self._generate_pallet_qr()

	def on_update(self):
		self._generate_item_qrs()
		self._update_total_items()
		self._sync_parent()

	def validate(self):
		self._check_duplicate_items()

	def _generate_pallet_qr(self):
		"""Generate QR code for this pallet."""
		from clestra_app.utils.qr_generator import generate_qr_code

		qr_url = f"{frappe.utils.get_url()}/pallet?id={self.name}"
		file_url = generate_qr_code(
			label=self.name,
			data=qr_url,
			attached_to_doctype="Packing List Pallet",
			attached_to_name=self.name,
		)
		frappe.db.set_value("Packing List Pallet", self.name, {
			"pallet_qr_code": self.name,
			"pallet_qr_image": file_url,
		}, update_modified=False)
		self.pallet_qr_code = self.name
		self.pallet_qr_image = file_url

	def _generate_item_qrs(self):
		"""Generate QR codes for items that don't have one."""
		from clestra_app.utils.qr_generator import generate_qr_code

		for item in self.items:
			if item.item_qr_code:
				continue

			qr_id = f"{self.name}-{item.idx}"
			qr_url = f"{frappe.utils.get_url()}/packing_item?id={qr_id}"
			file_url = generate_qr_code(
				label=qr_id,
				data=qr_url,
				attached_to_doctype="Packing List Pallet",
				attached_to_name=self.name,
			)
			item.item_qr_code = qr_id
			item.item_qr_image = file_url

	def _update_total_items(self):
		self.total_items = len(self.items)

	def _sync_parent(self):
		"""Update parent Project Packing List summary."""
		if self.packing_list:
			ppl = frappe.get_doc("Project Packing List", self.packing_list)
			ppl._update_summary()

	def _check_duplicate_items(self):
		"""Check if any item is already assigned to another pallet in the same packing list."""
		if not self.packing_list:
			return

		for item in self.items:
			if not item.item_code:
				continue

			existing = frappe.db.sql("""
				SELECT pli.item_code, plp.name AS pallet_name
				FROM `tabPacking List Item` pli
				JOIN `tabPacking List Pallet` plp ON plp.name = pli.parent
				WHERE pli.item_code = %(item_code)s
				  AND plp.packing_list = %(packing_list)s
				  AND plp.name != %(current_pallet)s
				  AND pli.project_billing_master = %(pbm)s
				  AND pli.zone = %(zone)s
				LIMIT 1
			""", {
				"item_code": item.item_code,
				"packing_list": self.packing_list,
				"current_pallet": self.name,
				"pbm": item.project_billing_master or "",
				"zone": item.zone or "",
			}, as_dict=True)

			if existing:
				frappe.throw(
					_("Item {0} (Zone: {1}) is already in Pallet {2}").format(
						item.item_code, item.zone or "-", existing[0].pallet_name
					)
				)


@frappe.whitelist()
def get_pbm_detail_items(pbm_name, pallet_name=None):
	"""Get detail_bom_items from a PBM with assignment status for pallet item selection."""
	items = frappe.db.sql("""
		SELECT name, item_code, item_name, zone, size, qty,
			fg_item_code, parent_item_code, product_section, color
		FROM `tabProject Billing Master Sub Item`
		WHERE parent = %(pbm)s
		  AND parentfield = 'detail_bom_items'
		  AND indent_level = 0
		  AND item_code IS NOT NULL AND item_code != ''
		ORDER BY zone ASC, item_code ASC
	""", {"pbm": pbm_name}, as_dict=True)

	# Check which items are already assigned to any pallet in this packing list
	if pallet_name:
		packing_list = frappe.db.get_value("Packing List Pallet", pallet_name, "packing_list")
		if packing_list:
			assigned_items = frappe.db.sql("""
				SELECT pli.item_code, pli.zone, plp.name AS pallet_name
				FROM `tabPacking List Item` pli
				JOIN `tabPacking List Pallet` plp ON plp.name = pli.parent
				WHERE plp.packing_list = %(packing_list)s
				  AND pli.project_billing_master = %(pbm)s
			""", {"packing_list": packing_list, "pbm": pbm_name}, as_dict=True)

			assigned_set = {(a.item_code, a.zone or "") for a in assigned_items}

			for item in items:
				item["assigned"] = (item.item_code, item.zone or "") in assigned_set
		else:
			for item in items:
				item["assigned"] = False
	else:
		for item in items:
			item["assigned"] = False

	return items

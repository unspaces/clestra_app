# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from collections import OrderedDict

import hashlib
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt
from collections import defaultdict

# frappe.utils.logger.set_log_level("DEBUG")

import logging
# Logger 설정
logger = frappe.logger("bom_creator", allow_site=True)
logger.setLevel(logging.DEBUG)

from erpnext.manufacturing.doctype.bom.bom import get_bom_item_rate

PARENT_ITEM_FIELDS = (
    "product_section", "product_keyword", "door_open_type", "door_set_type", "color",
    "print_hide", "show_qty_bracket"
)

BOM_FIELDS = (
    "company", "rm_cost_as_per", "project", "currency", "conversion_rate",
    "buying_price_list", "product_section", "product_keyword", "door_open_type",
    "door_set_type", "color", "use_billing_color", "print_hide", "use_unit", 
	"qty_prefix", "qty_suffix", "show_qty_bracket"
)

BOM_ITEM_BASE_FIELDS = (
    "item_code", "qty", "uom", "rate", "stock_qty", "stock_uom",
    "conversion_factor", "do_not_explode", "color", "use_billing_color", "app_country", "print_hide",
)

BOM_ITEM_QTY_FIELDS = (
    "qty_prefix", "qty_suffix", "use_unit", "show_qty_bracket", "qty_custom",
)

SIZE_FIELDS = (
    "width", "ch", "pw", "ph", "leaf_width", "leaf_height",
	"ceiling_visible", "base_visible_h", "under_cut", "open_width", "open_height",
    "panel_crh", "panel_trh", "abl_a", "abl_b", "depth"
)

BOM_DETAIL_FIELDS = (
    "disassembled",
	"glass_a", "glass_b",
	"door_open_type", "door_set_type", "door_frame", "door_closer", "handle_direct", "hw_options", "sub_contract", "price_study", "exclude_fields", "for_pair_door", 
	"keeper", "keeper_glass_a", "keeper_glass_b",
    "hinge", "hinge_glass_a", "hinge_glass_b", "hinge_type", "hinge_num",
    "leaf_item_code", "leaf_act_status", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_material", "equal_leaf_w", 
	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap", "key_cylinder", "app_country", "print_hide", "is_panel_cover",
	"qty_custom", "qty_prefix", "qty_suffix", "use_unit", "show_qty_bracket"
)

ALL_BOM_ITEM_FIELDS = BOM_ITEM_BASE_FIELDS + BOM_ITEM_QTY_FIELDS + SIZE_FIELDS + BOM_DETAIL_FIELDS

GET_CHILDREN_BASE_FIELDS = (
	"parent", "name", "parent_row_no", "idx", "is_expandable", # Core identifying fields
    # Combine necessary fields from other groups:
    *BOM_ITEM_BASE_FIELDS,
    *BOM_ITEM_QTY_FIELDS,
    *SIZE_FIELDS,
    *BOM_DETAIL_FIELDS,
    "amount", # Calculated field, still need to request it if available
)

GET_CHILDREN_BASE_FIELDS = tuple(OrderedDict.fromkeys(GET_CHILDREN_BASE_FIELDS))


class BOMCreator(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from erpnext.manufacturing.doctype.bom_creator_item.bom_creator_item import BOMCreatorItem
		from frappe.types import DF

		abl_a: DF.Link | None
		abl_b: DF.Link | None
		amended_from: DF.Link | None
		app_country: DF.Data | None
		astragal: DF.Link | None
		auto_drop_seal: DF.Link | None
		base_visible_h: DF.Link | None
		buying_price_list: DF.Link | None
		ceiling_visible: DF.Link | None
		ch: DF.Link | None
		color: DF.Link | None
		company: DF.Link
		conversion_rate: DF.Float
		currency: DF.Link
		default_warehouse: DF.Link | None
		depth: DF.Link | None
		disassembled: DF.Check
		door_closer: DF.Link | None
		door_frame: DF.Data | None
		door_open_type: DF.Literal["", "Swing", "Sliding"]
		door_set_type: DF.Literal["", "Single", "Pair"]
		equal_leaf_w: DF.Check
		error_log: DF.Text | None
		exclude_fields: DF.Data | None
		exclude_from_cover: DF.Check
		fgd_info: DF.Link | None
		fix_screw_cap: DF.Link | None
		flush_bolt: DF.Data | None
		for_pair_door: DF.Check
		glass_a: DF.Data | None
		glass_b: DF.Data | None
		handle_direct: DF.Data | None
		hinge: DF.Data | None
		hinge_glass_a: DF.Data | None
		hinge_glass_b: DF.Data | None
		hinge_num: DF.Link | None
		hinge_type: DF.Link | None
		hw_options: DF.Link | None
		indent_level: DF.Int
		is_panel_cover: DF.Check
		item_code: DF.Link
		item_group: DF.Link | None
		item_name: DF.Data | None
		items: DF.Table[BOMCreatorItem]
		keeper: DF.Data | None
		keeper_glass_a: DF.Data | None
		keeper_glass_b: DF.Data | None
		key_cylinder: DF.Link | None
		leaf_act_status: DF.Link | None
		leaf_color: DF.Link | None
		leaf_glass_a: DF.Data | None
		leaf_glass_b: DF.Data | None
		leaf_height: DF.Link | None
		leaf_item_code: DF.Link | None
		leaf_material: DF.Data | None
		leaf_thk: DF.Data | None
		leaf_width: DF.Link | None
		open_height: DF.Link | None
		open_width: DF.Link | None
		panel_crh: DF.Link | None
		panel_trh: DF.Link | None
		ph: DF.Link | None
		plc_conversion_rate: DF.Float
		price_list_currency: DF.Link | None
		price_study: DF.Link | None
		print_hide: DF.Check
		product_abbr: DF.Data | None
		product_section: DF.Literal["", "Door", "Leaf", "Panel", "Sub Items"]
		project: DF.Link | None
		pw: DF.Link | None
		qty: DF.Float
		qty_custom: DF.Link | None
		qty_prefix: DF.Data | None
		qty_suffix: DF.Data | None
		raw_material_cost: DF.Currency
		remarks: DF.TextEditor | None
		rm_cost_as_per: DF.Literal["Valuation Rate", "Last Purchase Rate", "Price List"]
		set_rate_based_on_warehouse: DF.Check
		show_qty_bracket: DF.Check
		status: DF.Literal["Draft", "Submitted", "In Progress", "Completed", "Failed", "Cancelled"]
		sub_contract: DF.Link | None
		tape_seal_color: DF.Link | None
		under_cut: DF.Link | None
		uom: DF.Link | None
		use_billing_color: DF.Check
		use_unit: DF.Check
		width: DF.Link | None
	# end: auto-generated types

	def before_save(self):
		if self.is_new():
			self.set_parent_item_fields()
		self.set_status()
		self.set_is_expandable()
		self.set_conversion_factor()
		self.set_reference_id()
		self.set_rate_for_items()
		self.set_indent_level()

	def on_insert(self):
		self.set_reference_id()

	def validate(self):
		self.validate_items()

	def validate_items(self):
		for row in self.items:
			# Validation 전에 디버깅 로그 추가
			# logger.info(f"Validating row {row.idx}: Parent Row No: {row.parent_row_no}, "f"FG Item: {row.fg_item}, Item Code: {row.item_code}", f"fg_reference_id: {row.fg_reference_id}")

			if row.is_expandable and row.item_code == self.item_code:
				frappe.throw(_("Item {0} cannot be added as a sub-assembly of itself").format(row.item_code))
			
			if not row.parent_row_no and row.fg_item and row.fg_item != self.item_code:
				# logger.info(f"Validation Error: Row Index: {row.idx}, Item Code: {row.item_code}, "f"Parent Row No: {row.parent_row_no}, FG Item: {row.fg_item}, Self Item Code: {self.item_code}")
				frappe.throw(
					_("At row {0}: set Parent Row No for item {1}").format(row.idx, row.item_code),
					title=_("Set Parent Row No in Items Table"),
				)

			elif row.parent_row_no and row.fg_item == self.item_code:
				frappe.throw(
					_("At row {0}: Parent Row No cannot be set for item {1}").format(row.idx, row.item_code),
					title=_("Remove Parent Row No in Items Table"),
				)

			# SYEOM @241205 - size_fields 유효성 검사
			# self.validate_size_fields(row)
				
			
	def validate_size_fields(self, row):
		for field in SIZE_FIELDS:
			value = getattr(row, field, None)
			if value is None:
				frappe.throw(
					_("Missing value for {0} in row {1} (Item: {2}). Please provide a valid value.").format(
						field, row.idx, row.item_code
					)
				)

	def set_parent_item_fields(self):
		"""Set fields from the Item doctype for the Parent Item in BOM Creator."""
		if self.item_code:
			item_details = frappe.get_cached_value(
				"Item",
				self.item_code,
				PARENT_ITEM_FIELDS,
				as_dict=True,
			)

			if item_details:
				for field in PARENT_ITEM_FIELDS:
					if field in item_details:
						setattr(self, field, item_details.get(field))

				
	def set_status(self, save=False):
		self.status = {
			0: "Draft",
			1: "Submitted",
			2: "Cancelled",
		}[self.docstatus]

		self.set_status_completed()
		if save:
			self.db_set("status", self.status)

	def set_status_completed(self):
		if self.docstatus != 1:
			return

		has_completed = True
		for row in self.items:
			if row.is_expandable and not row.bom_created:
				has_completed = False
				break

		if not frappe.get_cached_value("BOM", {"bom_creator": self.name, "item": self.item_code}, "name"):
			has_completed = False

		if has_completed:
			self.status = "Completed"

	def on_cancel(self):
		self.set_status(True)

	def set_conversion_factor(self):
		for row in self.items:
			row.conversion_factor = 1.0

	def before_submit(self):
		self.validate_fields()
		self.set_status()

	def set_reference_id(self):
		parent_reference = {row.idx: row.name for row in self.items}
		logger.info(f"Setting reference IDs for BOM Creator {self.name} with parent_reference: {parent_reference}")

		for row in self.items:
			ref_id = ""

			if row.parent_row_no:
				ref_id = parent_reference.get(cint(row.parent_row_no))

			# Check whether the reference id of the FG Item has correct or not
			if row.fg_reference_id and row.fg_reference_id == ref_id:
				continue

			if row.parent_row_no:
				row.fg_reference_id = ref_id
				logger.info(f"Row {row.idx} has parent_row_no {row.parent_row_no}, setting fg_reference_id to {ref_id}")
			elif row.fg_item == self.item_code:
				row.fg_reference_id = self.name

	@frappe.whitelist()
	def add_boms(self):
		self.submit()

	def set_rate_for_items(self):
		amount = self.get_raw_material_cost()
		self.raw_material_cost = amount

	def get_raw_material_cost(self, fg_item=None, amount=0):
		if not fg_item:
			fg_item = self.item_code

		total_amount = 0.0

		for row in self.items:
			if row.fg_item != fg_item:
				continue

			if not row.is_expandable:
				row.rate = get_bom_item_rate(
					{
						"company": self.company,
						"item_code": row.item_code,
						"bom_no": "",
						"qty": row.qty,
						"uom": row.uom,
						"stock_uom": row.stock_uom,
						"conversion_factor": row.conversion_factor,
						"sourced_by_supplier": row.sourced_by_supplier,
					},
					self,
				)

				row.amount = flt(row.rate) * flt(row.qty)

			else:
				row.amount = 0.0
		# 		row.amount = self.get_raw_material_cost(row.name, row.amount)
		# 		row.rate = flt(row.amount) / (flt(row.qty) * flt(row.conversion_factor))

		# 	amount += flt(row.amount)

		# return amount
				for sub_row in self.items:
					if sub_row.fg_item == row.item_code:
						if not sub_row.is_expandable:
							sub_row.rate = get_bom_item_rate(
								{
									"company": self.company,
									"item_code": sub_row.item_code,
									"bom_no": "",
									"qty": sub_row.qty,
									"uom": sub_row.uom,
									"stock_uom": sub_row.stock_uom,
									"conversion_factor": sub_row.conversion_factor,
									"sourced_by_supplier": sub_row.sourced_by_supplier,
								},
								self,
							)
							sub_row.amount = flt(sub_row.rate) * flt(sub_row.qty)
						else:
							sub_row.amount = 0.0  # 깊은 재귀는 피함

						row.amount += flt(sub_row.amount)

				if flt(row.qty) * flt(row.conversion_factor) > 0:
					row.rate = flt(row.amount) / (flt(row.qty) * flt(row.conversion_factor))
				else:
					row.rate = 0.0

			total_amount += flt(row.amount)

		return total_amount

	def set_is_expandable(self):
		fg_items = {row.fg_item for row in self.items if row.fg_item != self.item_code}
		parent_row_no = set()
		for row in self.items:
			if row.fg_item != self.item_code and row.parent_row_no:
				parent_row_no.add(int(row.parent_row_no))

		for row in self.items:
			row.is_expandable = 0
			if row.item_code in fg_items and row.idx in parent_row_no:
				row.is_expandable = 1


	def validate_fields(self):
		fields = {
			"items": "Items",
		}

		for field, label in fields.items():
			if not self.get(field):
				frappe.throw(_("Please set {0} in BOM Creator {1}").format(label, self.name))

	def on_submit(self):
		self.enqueue_create_boms()
	
	def set_indent_level(self):
		"""Set indent_level based on parent hierarchy in BOM Creator Item, BOM Item, Project Billing Master Sub Item"""

		if not self.items:
			return

		# idx를 키로 하는 아이템 맵 생성 (O(N))
		item_map = {item.idx: item for item in self.items}

		for row in self.items:
			indent_level = 0
			current_parent_idx = cint(row.parent_row_no) if row.parent_row_no else None

			parent_row_no = row.parent_row_no

			while current_parent_idx:
				indent_level += 1
				parent_row = item_map.get(current_parent_idx)
				if parent_row:
					current_parent_idx = cint(parent_row.parent_row_no) if parent_row.parent_row_no else None
				else:
					logger.warning(f"Parent with idx {current_parent_idx} not found while calculating indent for row {row.idx}. Stopping calculation for this row.")
					break

			row.indent_level = indent_level if indent_level > 0 else None


	@frappe.whitelist()
	def enqueue_create_boms(self):
		frappe.enqueue(
			self.create_boms,
			queue="short",
			timeout=600,
			is_async=True,
		)

		frappe.msgprint(
			_("BOMs creation has been enqueued, kindly check the status after some time"), alert=True
		)

	def create_boms(self):
		"""
		Sample data structure of production_item_wise_rm
		production_item_wise_rm = {
				(fg_item_code, name): {
						"items": [],
						"bom_no": "",
						"fg_item_data": {}
				}
		}
		"""

		self.db_set("status", "In Progress")
		production_item_wise_rm = OrderedDict({})
		# production_item_wise_rm.setdefault(
		# 	(self.item_code, self.name), frappe._dict({"items": [], "bom_no": "", "fg_item_data": self})
		# )
		final_product = (self.item_code, self.name)
		production_item_wise_rm.setdefault(
			final_product, frappe._dict({"items": [], "bom_no": "", "fg_item_data": self})
		)

		for row in self.items:
			if row.is_expandable:
				if (row.item_code, row.name) not in production_item_wise_rm:
					production_item_wise_rm.setdefault(
						(row.item_code, row.name),
						frappe._dict({"items": [], "bom_no": "", "fg_item_data": row}),
					)

			if not row.fg_reference_id and production_item_wise_rm.get((row.fg_item, row.fg_reference_id)):
				frappe.throw(_("Please set Parent Row No for item {0}").format(row.fg_item))

			production_item_wise_rm[(row.fg_item, row.fg_reference_id)]["items"].append(row)

		reverse_tree = OrderedDict(reversed(list(production_item_wise_rm.items())))

		try:
			for d in reverse_tree:
				fg_item_data = production_item_wise_rm.get(d).fg_item_data
				# self.create_bom(fg_item_data, production_item_wise_rm)

				# SYEOM @241121 - 최상위 부모 BOM은 무조건 생성
				if fg_item_data.item_code == self.item_code:
					self.create_bom(fg_item_data, production_item_wise_rm, is_top_level=True)
				else:
					self.create_bom(fg_item_data, production_item_wise_rm)

			frappe.msgprint(_("BOMs created successfully"))
		except Exception as e:
			traceback = frappe.get_traceback(with_context=True)
			logger.error(f"Failed to create BOM: {e}")
			self.db_set(
				{
					"status": "Failed",
					"error_log": traceback,
				})
			frappe.msgprint(_("BOMs creation failed"))
		
		logger.info(f"Finished create_boms for BOM Creator {self.name}")

	
	def get_size_field_values(self, item):
		"""Fetch values for SIZE_FIELDS from Formula Library or set as None."""
		size_field_values = {}
		for field in SIZE_FIELDS:
			if not field:  # Skip if field is empty or None
				continue
			formula_value = frappe.db.get_value("Formula Library", item.get(field), "formula")
			size_field_values[field] = formula_value or None
		return size_field_values
	
	def get_additional_fields(self, item):
		additional_field_values = {}
		field_groups = [PARENT_ITEM_FIELDS, SIZE_FIELDS, BOM_DETAIL_FIELDS]
		for fields in field_groups:
			additional_field_values.update({key: item.get(key, None) for key in fields})
		return additional_field_values

	def create_bom(self, row, production_item_wise_rm, is_top_level=False):
		"""
		Create a BOM for the given row. For Sub Assemblies, compare item_code with existing BOM structures
		and reuse if identical. Always create a BOM for the top-level parent.
		"""
		logger.info(f"Starting BOM creation process for item: {row.item_code}")
		bom_creator_item = row.name if row.name != self.name else ""
		if frappe.db.exists(
			"BOM",
			{
				"bom_creator": self.name,
				"item": row.item_code,
				"bom_creator_item": bom_creator_item,
				"docstatus": 1,
			},
		):
			logger.info(f"BOM already exists for item {row.item_code}.")
			return
		
		# 최상위 부모 BOM은 무조건 생성
		if is_top_level:
			logger.info(f"Creating top-level BOM for item: {row.item_code}")
			pass
		else:
			#logger.info(f"Searching for reusable BOMs for item: {row.item_code}")
			# Sub Assembly: 모든 BOM 검색
			existing_bom_list = frappe.get_all(
				"BOM",
				filters={"item": row.item_code, "docstatus": 1},
				fields=["name"],
			)

			logger.info(f"Found {len(existing_bom_list)} existing BOMs for item: {row.item_code}")

			# 현재 Sub Assembly의 hash 생성
			# current_item_codes = [item.item_code for item in production_item_wise_rm.get((row.item_code, row.name), {}).get("items", [])]
			# current_hash = self.generate_bom_hash(current_item_codes)
			current_item_data = []
			for item in production_item_wise_rm.get((row.item_code, row.name), {}).get("items", []):
				additional_field_values = self.get_additional_fields(item)
				item_data = {
					"item_code": item.item_code,
					"qty": item.qty,
					"color": item.color,
					**additional_field_values,  # Include PARENT_ITEM_FIELDS, SIZE_FIELDS, BOM_DETAIL_FIELD values
				}
				current_item_data.append(item_data)
				
			# logger.info(f"Generated current item data hash for item: {row.item_code}")
			# logger.info(f"About to generate hash for item: {row.item_code} with current_item_data: {current_item_data}")
			current_hash = self.generate_bom_hash(current_item_data)
			# logger.info(f"Hash generated: {current_hash}")

			# 모든 기존 BOM에 대해 hash 기반 구조 비교
			for existing_bom in existing_bom_list:
				if self.is_bom_structure_identical(current_hash, existing_bom.name):
					# logger.info(f"Reusing existing BOM {existing_bom.name} for item: {row.item_code}")
					print(f"Reusing existing BOM {existing_bom.name} for {row.item_code}")
					production_item_wise_rm[(row.item_code, row.name)]["bom_no"] = existing_bom.name
					return

		logger.info(f"Creating new BOM for item: {row.item_code}")
		bom = frappe.new_doc("BOM")
		# logger.info(f"BOM object type after creation: {type(bom)}")  # 타입 확인
		
		# Update BOM fields
		# bom_data = {
		bom.update({
			"item": row.item_code,
			"bom_type": "Production",
			"quantity": row.qty,
			"allow_alternative_item": 1,
			"bom_creator": self.name,
			"bom_creator_item": bom_creator_item, 
		})
		logger.info(f"BOM data before update: {bom}")

		# Fetch and add size fields
		# additional_field_values = self.get_additional_fields(row)

		# bom_data.update(additional_field_values)

		# for field in BOM_FIELDS:
		# 	if self.get(field):
		# 		bom.set(field, self.get(field))

		# for field in SIZE_FIELDS:
		# 	if self.get(field):
		# 		bom.set(field, self.get(field))

		# for field in BOM_DETAIL_FIELDS:
		# 	if self.get(field):
		# 		bom.set(field, self.get(field))

		for field_group in [BOM_FIELDS, SIZE_FIELDS, BOM_DETAIL_FIELDS]:
			for field in field_group:
				# if self.get(field):
				# 	bom.set(field, self.get(field))

				# row.get(field)  # row에서 가져오기
				# if row.get(field):  # row 값이 있으면 덮어쓰기
				# 	bom.set(field, row.get(field))

				# logger.info(f"Setting BOM field {field}: {bom.get(field)}")
				value_from_self = self.get(field)
				value_from_row = row.get(field)
				final_value = value_from_row if value_from_row is not None else value_from_self

				if final_value is not None:
					bom.set(field, final_value)


		# Update BOM with all fields
		# bom.update(bom_data)
		#logger.info(f"BOM data updated for item: {row.item_code}")

		for item in production_item_wise_rm[(row.item_code, row.name)]["items"]:
			bom_no = ""
			item.do_not_explode = 1
			if (item.item_code, item.name) in production_item_wise_rm:
				bom_no = production_item_wise_rm.get((item.item_code, item.name)).bom_no
				item.do_not_explode = 0

			# BOM Item 필드 처리
			item_args = {}
			# for field in BOM_ITEM_FIELDS:
			# 	item_args[field] = item.get(field)

			# for field in SIZE_FIELDS:
			# 	item_args[field] = item.get(field)

			# for field in BOM_DETAIL_FIELDS:
			# 	item_args[field] = item.get(field)

			for field in ALL_BOM_ITEM_FIELDS: # Use the combined tuple
				value = item.get(field)
				item_args[field] = value
			
			#logger.info(f"Item args for item: {item.item_code} - {item.name}: {item_args}")

			item_args.update(
				{
					"bom_no": bom_no,
					"allow_alternative_item": 1,
					"allow_scrap_items": 1,
					"include_item_in_manufacturing": 1,
				}
			)

			bom.append("items", item_args)

		#logger.info(f"Added items to BOM for item: {row.item_code}")

		try:
			bom.save(ignore_permissions=True)
			bom.submit()
			#logger.info(f"Successfully created and submitted BOM {bom.name} for item: {row.item_code}")
		except Exception as e:
			logger.error(frappe.get_traceback(), f"Error submitting BOM for {row.item_code}")
			raise e

		production_item_wise_rm[(row.item_code, row.name)].bom_no = bom.name
		#logger.info(f"Assigned BOM {bom.name} to item: {row.item_code}")


	def is_bom_structure_identical(self, current_hash, existing_bom_name):
		"""
		Check if the hash of the current Sub Assembly matches the hash of the existing BOM.
		"""
		try:
			# Fetch the existing BOM and its item_code list
			existing_bom = frappe.get_doc("BOM", existing_bom_name)
			existing_item_codes = [item.item_code for item in existing_bom.items]

			# Generate hash for the existing BOM
			existing_hash = self.generate_bom_hash(existing_item_codes)

			# Log comparison data for debugging
			print(f"Current Hash: {current_hash}")
			print(f"Existing Hash for {existing_bom_name}: {existing_hash}")

			return current_hash == existing_hash

		except Exception as e:
			# logger.error(f"Error in BOM structure comparison: {e}")
			return False
		

	def generate_bom_hash(self, item_data):
		"""
		Generate a hash based on the sorted item_code list.
		"""
		import json

		#logger.info(f"Generating BOM hash for item_data: {item_data}")
		# 정렬 후 문자열로 변환
		# sorted_codes = sorted(item_data)
		# try:
		# 	sorted_codes = sorted(item_data)
		# except Exception as e:
		# 	logger.error(f"Error during sorting item_data: {e}")
		# 	raise
		
		sorted_codes = sorted(json.dumps(entry, sort_keys=True) for entry in item_data)
		combined_string = ",".join(sorted_codes)
		# SHA256 해시 생성
		hash_object = hashlib.sha256(combined_string.encode())
		return hash_object.hexdigest()


	@frappe.whitelist()
	def get_default_bom(self, item_code) -> str:
		return frappe.get_cached_value("Item", item_code, "default_bom")


@frappe.whitelist()
def get_children(doctype=None, parent=None, idx=None, **kwargs):
	# logger.info(f"get_children called with: parent={parent}, idx={idx}, kwargs={kwargs}")
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	aliases = [
		"item_code as value",
		"is_expandable as expandable",
		"parent as parent_id",
		"'BOM Creator Item' as doctype",
	]

	fields_for_query = aliases + list(GET_CHILDREN_BASE_FIELDS)

	query_filters = {
		"fg_item": parent,
		"parent": kwargs.parent_id,
	}
	# if idx is not None:
	# 	query_filters["parent_row_no"] = str(idx)

	if kwargs.get("parent_row_no") != "":
		query_filters["parent_row_no"] = str(idx)

	if kwargs.name:
		query_filters["name"] = kwargs.name

	# 디버깅 로깅 추가
	# logger.info(f"query_filters: {query_filters}")
	# logger.info(f"get_children called with: parent={parent}, idx={idx}")
		
	result = frappe.get_all("BOM Creator Item", fields=fields_for_query, filters=query_filters, order_by="idx")

	# logger.info(f"get_children result: {result}")

	return result


def get_parent_row_no(doc, name):
	for row in doc.items:
		if row.name == name:
			return row.idx


def get_parent_name(doc, num):
	for row in doc.items:
		if row.idx == num:
			return row.name

		
def get_parent_item_code(doc, name):
	for row in doc.items:
		if row.name == name:
			return row.item_code	


@frappe.whitelist()
def add_item(**kwargs):
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	item_info = get_item_details(kwargs.item_code)

	parent_row_no = ""
	if kwargs.fg_reference_id and doc.name != kwargs.fg_reference_id:
		parent_row_no = get_parent_row_no(doc, kwargs.fg_reference_id)

	# 필드값 동기화
	kwargs.update(
		{
			"uom": item_info.stock_uom,
			"stock_uom": item_info.stock_uom,
			"conversion_factor": 1,
		}
	)

	if parent_row_no:
		kwargs.update({"parent_row_no": parent_row_no})

	doc.append("items", kwargs)
	# Reorder + recompute parent_row_no from fg_reference_id BEFORE the save
	# so validate_items sees a self-consistent items list. The previous
	# save-then-reorder ordering tripped "At row N: set Parent Row No for
	# item ..." whenever any existing row had a stale parent_row_no that the
	# reorder pass would have fixed.
	doc = reorder_items_hierarchically(doc)
	doc.save()

	return doc


@frappe.whitelist()
def add_sub_assembly(**kwargs):
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	bom_item = frappe.parse_json(kwargs.bom_item)

	name = kwargs.fg_reference_id
	parent_row_no = ""
	if kwargs.fg_reference_id and doc.name != kwargs.fg_reference_id:
		parent_row_no = get_parent_row_no(doc, kwargs.fg_reference_id)
		fg_item = get_parent_item_code(doc, kwargs.fg_reference_id)
		kwargs.update({
			"parent_row_no": parent_row_no,
			"fg_item": fg_item
			})
		
	# logger.info(f"Initial Name: {name}, Parent Row No: {parent_row_no}")
	# logger.info(f"Added Main Item: {bom_item.item_code}, FG Item: {kwargs.fg_item}, Item's Parent Row No: {kwargs.parent_row_no}")

	if not kwargs.convert_to_sub_assembly:
		item_info = get_item_details(bom_item.item_code)
		item_row = doc.append(
			"items",
			{
				"item_code": bom_item.item_code,
				"qty": bom_item.qty,
				"show_qty_bracket": bom_item.show_qty_bracket,
				"uom": item_info.stock_uom,
				"fg_item": kwargs.fg_item,
				"parent_row_no": parent_row_no,
				"conversion_factor": 1,
				"fg_reference_id": name,
				"stock_qty": bom_item.qty,
				"do_not_explode": 1,
				"is_expandable": 1,
				"stock_uom": item_info.stock_uom,
				"bom_no": kwargs.get("bom_no"), # SYEOM @ 241120 - Add bom_no
				"color": bom_item.color,
				"handle_direct": bom_item.handle_direct,
				"print_hide": bom_item.print_hide,
				"indent_level": bom_item.indent_level,
			},
		)

		parent_row_no = item_row.idx
		# logger.info(f"Newly Added Row Name: {item_row.name}, Parent Row No: {parent_row_no}")
		name = ""
	else:
		parent_row_no = [row.idx for row in doc.items if row.name == kwargs.fg_reference_id]
		if parent_row_no:
			parent_row_no = parent_row_no[0]
			# logger.info(f"Parent Row No (convert_to_sub_assembly): {parent_row_no}")

	# logger.info(f"Name After Processing (Before Adding Sub-Items): {name}")

	for row in bom_item.get("items"):
		row = frappe._dict(row)
		item_info = get_item_details(row.item_code)
		# new_row = doc.append(
		doc.append(
			"items",
			{
				"item_code": row.item_code,
				"qty": row.qty,
				"fg_item": bom_item.item_code,
				"uom": item_info.stock_uom,
				"fg_reference_id": name,
				"parent_row_no": parent_row_no,
				"conversion_factor": 1,
				"do_not_explode": 1,
				"stock_qty": row.qty,
				"stock_uom": item_info.stock_uom,
				"color": row.color,
				"handle_direct": row.handle_direct,
				"print_hide": row.print_hide,
				"show_qty_bracket": row.show_qty_bracket,
				"indent_level": row.indent_level,			
			},
		)
		# logger.info(f"Added Sub-Item Row: {new_row.as_dict()}")
	
	# logger.info(f"Name After Adding Sub-Items: {name}")
	# Reorder + recompute parent_row_no from fg_reference_id BEFORE saving so
	# validate_items has a self-consistent items list. The previous save-then-
	# reorder ordering tripped "At row N: set Parent Row No for item ..."
	# whenever any existing row had a stale parent_row_no that this reorder
	# pass would have repaired.
	doc = reorder_items_hierarchically(doc)
	doc.save()

	# logger.info(f"Name After Save: {name}")

	# Debugging log for all items in doc after saving
	# logger.info(f"All items in doc after saving: {[row.as_dict() for row in doc.items]}")

	return doc


@frappe.whitelist()
def duplicate(**kwargs):
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	bom_item = frappe.parse_json(kwargs.bom_item)

	kwargs.select_parent_row_no = int(kwargs.select_parent_row_no)
	
	if kwargs.select_parent_row_no != kwargs.parent_row_no:
		parent_row_no = kwargs.select_parent_row_no 
		if parent_row_no == 0:
			parent_row_no = None
			name = doc.name
			fg_item = doc.item_code
		else:
			name = get_parent_name(doc, parent_row_no)
			fg_item = get_parent_item_code(doc, name)

		kwargs.update({
			"fg_item": fg_item,
			"fg_reference_id": name,
			"parent_row_no": parent_row_no
			})
	
	additional_fields = {}
	if bom_item.get("include_conditions"):
		field_groups = [PARENT_ITEM_FIELDS, SIZE_FIELDS, BOM_DETAIL_FIELDS]
		for fields in field_groups:
			additional_fields.update({key: bom_item.get(key, None) for key in fields})

	# Create a new parent row
	parent_row = doc.append("items", {
			"item_code": bom_item.item_code,
			"qty": bom_item.qty,
			"uom": bom_item.stock_uom,
			"fg_item": kwargs.fg_item,
			"parent_row_no": parent_row_no,
			"conversion_factor": 1,
			"fg_reference_id": kwargs.fg_reference_id,
			"stock_qty": bom_item.qty,
			"do_not_explode": 1,
			"is_expandable": 1,
			"stock_uom": bom_item.stock_uom,
			"bom_no": bom_item.get("bom_no"),
			"indent_level": bom_item.indent_level,
			**additional_fields
		},
	)

	parent_row_no = parent_row.idx

	include_conditions = bom_item.get("include_conditions", False)

	new_rows_list = []
	updates = {}

	for row in bom_item.get("items", []):
		row = frappe._dict(row)
		row.update({
			"old_idx": row.idx,
			"old_prn": row.parent_row_no if row.parent_row_no else None,
			"old_fg": row.fg_item if row.parent_row_no else None
			})

		child_fields = {}
		if include_conditions:
			field_groups = [PARENT_ITEM_FIELDS, SIZE_FIELDS, BOM_DETAIL_FIELDS]
			for fields in field_groups:
				child_fields.update({key: row.get(key, None) for key in fields})

		new_row = doc.append("items",{
			"item_code": row.item_code,
			"qty": row.qty,
			"uom": row.stock_uom,
			"fg_item": parent_row.item_code,
			"fg_reference_id": "",
			"parent_row_no": parent_row_no,
			"conversion_factor": 1,
			"do_not_explode": 1,
			"is_expandable": 1 if row.expandable else 0,
			"stock_qty": row.qty,
			"stock_uom": row.stock_uom,
			"indent_level": row.indent_level,
			**child_fields
		})
		new_rows_list.append({
			"idx": new_row.idx, 
			"old_idx": row.old_idx,
			"item_code": row.item_code,
			"old_prn": row.old_prn,
			"old_fg": row.old_fg
			})

	
	for row in new_rows_list:
		if row["old_prn"] != "":
			
			parent_entry = next(
				(item for item in new_rows_list if item["item_code"] == row["old_fg"] and str(item["old_idx"]) == str(row["old_prn"])), 
				None
			)

			if parent_entry:
				updates[(row["idx"], row["item_code"])] = {
					"fg_item": parent_entry["item_code"],
					"parent_row_no": str(parent_entry["idx"])
				}

	for item in doc.items:
		key = (item.idx, item.item_code)  # (idx, item_code) 튜플로 매칭
		if key in updates:
			item.fg_item = updates[key]["fg_item"]
			item.parent_row_no = updates[key]["parent_row_no"]
	
	doc.save()
	doc = reorder_items_hierarchically(doc)
	doc.save()
	return doc

def get_item_details(item_code):
	return frappe.get_cached_value(
		"Item", item_code, ["item_name", "description", "image", "stock_uom", "default_bom",
					  "product_section", "product_abbr", "door_open_type", "door_set_type",], as_dict=1)

def reorder_items_hierarchically(doc):
    """
    BOM Creator 문서의 아이템들을 부모-자식 계층 구조에 따라 재정렬하고,
    idx 및 parent_row_no를 업데이트합니다.

    Args:
        doc: 수정할 BOM Creator 문서 객체.

    Returns:
        수정된 BOM Creator 문서 객체.
    """
    if not doc or not doc.get("items"):
        logger.debug("No items found to reorder hierarchically.")
        return doc

    items = doc.items
    item_map = {item.name: item for item in items} # name을 키로 아이템 객체 빠르게 찾기
    children_map = defaultdict(list) # 부모 name을 키로 자식 리스트 저장
    top_level_items = [] # 최상위 아이템 저장

    # --- 단계 1: 트리 구조 구축 (children_map 생성 및 top_level 식별) ---
    for item in items:
        parent_ref_id = item.fg_reference_id
        if not parent_ref_id or parent_ref_id == doc.name:
            # Top-level row. Force fg_item to the BOM's final product so
            # validate_items doesn't trip — without this, rows with
            # fg_reference_id=NULL but fg_item pointing to a non-root item
            # (a stale state seen after partially-completed delete +
            # duplicate operations) get parent_row_no=None from step 2 below,
            # then validate_items throws "set Parent Row No for item ...".
            if item.fg_item != doc.item_code:
                logger.warning(
                    f"Top-level row '{item.name}' (item_code={item.item_code}) "
                    f"had fg_item='{item.fg_item}' but no fg_reference_id. "
                    f"Resetting fg_item to doc.item_code={doc.item_code}."
                )
                item.fg_item = doc.item_code
            top_level_items.append(item)
        elif parent_ref_id in item_map: # 부모가 실제 존재하는지 확인
             children_map[parent_ref_id].append(item)
        else:
             # Orphan row — fg_reference_id points to a sibling row that no
             # longer exists (typically a side-effect of a partially-completed
             # delete or an in-place item_code change). Self-heal by promoting
             # to top-level: clear the stale reference and bind fg_item to
             # the BOM's final product so validate_items doesn't trip on a
             # row with fg_item set but no parent_row_no. Without this,
             # downstream Add Item / Add Sub Assembly / save throws
             # "At row N: set Parent Row No for item ..." because the reorder
             # silently bails on len-mismatch and leaves the bad row in place.
             logger.warning(
                 f"Orphan row '{item.name}' (item_code={item.item_code}) "
                 f"references missing parent '{parent_ref_id}'. Promoting to "
                 f"top-level under doc.item_code={doc.item_code}."
             )
             item.fg_reference_id = doc.name
             item.fg_item = doc.item_code
             item.parent_row_no = None
             top_level_items.append(item)

    # --- 단계 2: 깊이 우선 탐색(DFS)으로 재정렬 ---
    ordered_items = []

    def dfs_traverse(item_list):
        # 형제 노드 간 순서 유지 위해 원래 idx 기준 정렬 (선택 사항)
        # item_list.sort(key=lambda x: x.idx) # 필요하면 정렬 추가
        for item in item_list:
            ordered_items.append(item) # 현재 노드 추가
            # 현재 노드의 자식들을 재귀적으로 탐색
            if item.name in children_map:
                dfs_traverse(children_map[item.name])

    # 최상위 아이템부터 탐색 시작
    # 최상위 아이템 간 순서 유지 위해 원래 idx 기준 정렬 (선택 사항)
    # top_level_items.sort(key=lambda x: x.idx) # 필요하면 정렬 추가
    dfs_traverse(top_level_items)

    # 오류 검증: 원래 아이템 수와 정렬된 아이템 수가 같은지 확인
    if len(ordered_items) != len(items):
         logger.error(f"Reordering failed: Item count mismatch. Original={len(items)}, Ordered={len(ordered_items)}. Check for orphaned items or duplicates.")
         # 오류 발생 시 원본 doc을 반환하거나 예외 발생
         # frappe.throw("Failed to reorder items due to inconsistencies.")
         return doc # 여기서는 안전하게 원본 반환

    # --- 단계 3: 리스트 교체 ---
    doc.items = ordered_items
    logger.info(f"Reordered {len(doc.items)} items hierarchically.")

    # --- 단계 4: idx 및 parent_row_no 재정렬 ---
    # 이전에 만든 함수 재사용
    doc = renumber_and_update_parent_links(doc)

    return doc


def renumber_and_update_parent_links(doc):
    if not doc or not doc.get("items"):
        logger.debug("No items found to renumber.")
        return doc # 아이템이 없으면 아무것도 하지 않음

    items = doc.items
    name_to_new_idx = {} # 아이템 name을 새로운 idx에 매핑
    original_parent_refs = {} # 아이템 name을 원래 부모의 name (fg_reference_id)에 매핑

    # --- 단계 1: idx 재정렬 및 매핑 정보 수집 ---
    # Walk doc.items in their (DFS-ordered) position and assign sequential idx
    # to EVERY row, including freshly-appended ones that don't yet have a
    # name. Without this, validate_items would see new rows keeping their
    # append-time idx (= original len+1) which doesn't match their DFS
    # position, and renumber_and_update_parent_links Step 2 would reset
    # their parent_row_no to None because original_parent_refs is keyed by
    # name and skipping name=None drops them from the lookup.
    logger.debug("Starting Step 1: Renumbering idx and collecting parent references.")
    new_idx_counter = 1
    for item in items:
        item.idx = new_idx_counter
        if item.name:
            name_to_new_idx[item.name] = new_idx_counter
            original_parent_refs[item.name] = item.fg_reference_id
        new_idx_counter += 1


    # --- 단계 2: parent_row_no 업데이트 ---
    logger.debug("Starting Step 2: Updating parent_row_no links.")
    for item in items:
        item_name = item.name
        # For freshly-appended (unsaved) items, item.name is None so the
        # original_parent_refs lookup misses. Fall back to the item's live
        # fg_reference_id — that's the value the caller (add_item /
        # add_sub_assembly) just set and we want to honour.
        if item_name and item_name in original_parent_refs:
            parent_ref_id = original_parent_refs[item_name]
        else:
            parent_ref_id = item.fg_reference_id

        new_parent_idx = None # 기본값: 부모 없음 (최상위)

        if parent_ref_id and parent_ref_id != doc.name:
            # 부모가 최상위 문서가 아닌 경우, 매핑에서 새로운 idx 조회
            new_parent_idx = name_to_new_idx.get(parent_ref_id)

            if new_parent_idx is None:
                # 오류: 부모 참조가 존재하지만, 해당 부모가 리스트에 없거나 이름이 매칭되지 않음
                logger.error(f"Data inconsistency detected! Could not find new idx for parent reference '{parent_ref_id}' needed by item '{item_name}'. Setting parent_row_no to None.")
                # 여기서 오류를 발생시킬 수도 있음: frappe.throw(...)
                new_parent_idx = None # 안전하게 None으로 처리

        # item의 parent_row_no를 새로운 부모 idx로 업데이트 (최상위면 None)
        if item.parent_row_no != new_parent_idx: # 변경될 경우에만 로깅
             logger.debug(f"Updating parent_row_no for item '{item_name}' (new_idx={item.idx}): Old={item.parent_row_no}, New={new_parent_idx} (Points to parent '{parent_ref_id}')")
             item.parent_row_no = new_parent_idx
        # else: # 변경 없을 시 로깅 (선택 사항)
        #      logger.debug(f"parent_row_no for item '{item_name}' (new_idx={item.idx}) remains {item.parent_row_no}")

    logger.info(f"Finished renumbering and updating parent links for {len(items)} items in {doc.name}.")
    return doc
@frappe.whitelist()
def delete_node_origin(**kwargs):
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	# `skip_save` is set internally by delete_node so we don't trigger
	# validate_items on a half-deleted tree (a still-present grandchild row
	# whose fg_reference_id points to an already-removed parent throws
	# "set Parent Row No for item ..."). The top-level delete_node does
	# one reorder + save at the very end instead.
	skip_save = kwargs.pop("skip_save", False)

	items = get_children(parent=kwargs.fg_item, parent_id=kwargs.parent, idx=kwargs.idx)
	if kwargs.docname:
		frappe.delete_doc("BOM Creator Item", kwargs.docname)

	for item in items:
		frappe.delete_doc("BOM Creator Item", item.name)
		if item.expandable:
			delete_node_origin(
				fg_item=item.value, parent=item.parent_id, skip_save=skip_save
			)

	if skip_save:
		return None

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	doc.set_rate_for_items()
	doc.save()

	return doc

@frappe.whitelist()
def delete_node(delete_children=None, **kwargs):
	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	target_docname = kwargs.docname
	if not target_docname:
		return doc

	delete_descendants = delete_children in (True, "true")

	if delete_descendants:
		# Walk descendants via fg_reference_id rather than fg_item — fg_item
		# (the parent's item_code) can have duplicates after Duplicate
		# operations and would over-match the wrong subtree. fg_reference_id
		# stores the parent's docname which is unique. This BFS deletes the
		# target plus every transitive descendant in one pass, sidestepping
		# the get_children "parent_row_no = 'None'" filter bug that left
		# grandchildren un-deleted in the prior recursive implementation.
		descendants = set()
		queue = [target_docname]
		while queue:
			current = queue.pop(0)
			for row in doc.items:
				if row.fg_reference_id == current and row.name not in descendants:
					descendants.add(row.name)
					queue.append(row.name)
		for docname in {target_docname} | descendants:
			frappe.delete_doc("BOM Creator Item", docname)
	else:
		# Re-parent the immediate children to the target's parent (grandparent
		# from the children's perspective) so they don't become orphans.
		node_parent_row_no = cint(kwargs.parent_row_no)
		grandparent_docname = get_parent_name(doc, node_parent_row_no)
		grandparent_item_code = get_parent_item_code(doc, grandparent_docname)
		if node_parent_row_no == 0:
			grandparent_item_code = doc.item_code
			node_parent_row_no = None
			grandparent_docname = doc.name

		direct_children = [row for row in doc.items if row.fg_reference_id == target_docname]
		for child in direct_children:
			frappe.db.set_value("BOM Creator Item", child.name, "parent_row_no", node_parent_row_no)
			frappe.db.set_value("BOM Creator Item", child.name, "fg_item", grandparent_item_code)
			frappe.db.set_value("BOM Creator Item", child.name, "fg_reference_id", grandparent_docname)

		frappe.delete_doc("BOM Creator Item", target_docname)

	doc = frappe.get_doc("BOM Creator", kwargs.parent)
	doc = reorder_items_hierarchically(doc)
	doc.set_rate_for_items()
	doc.save()

	return doc


@frappe.whitelist()
def edit_qty(doctype, docname, qty, qty_custom=None, qty_prefix=None, qty_suffix=None, show_qty_bracket=None, use_unit=None, parent=None):
	frappe.db.set_value(doctype, docname, "qty", qty)
	frappe.db.set_value(doctype, docname, "qty_custom", qty_custom)
	frappe.db.set_value(doctype, docname, "qty_prefix", qty_prefix)
	frappe.db.set_value(doctype, docname, "qty_suffix", qty_suffix)
	frappe.db.set_value(doctype, docname, "use_unit", use_unit)
	frappe.db.set_value(doctype, docname, "show_qty_bracket", show_qty_bracket)
	doc = frappe.get_doc("BOM Creator", parent)
	doc.set_rate_for_items()
	doc.save()

	return doc

@frappe.whitelist()
def edit_conditions(doctype, docname, exclude_fields=None, parent=None, **kwargs):

	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)

	# """Update multiple fields in one database call."""
	# fields = [
	# 	"exclude_fields",
	# 	"handle_direct", "hw_options", "glass_a", "glass_b", "door_frame", "app_country", "print_hide",
	# 	"keeper", "hinge", "hinge_type", "hinge_num", "al_extend_strip", "disassembled",
	# 	"leaf_item_code", "leaf_act_status", "leaf_thk", "leaf_color", "leaf_glass_thk", "leaf_material", 
	# 	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap",
	# 	"for_pair_door", "equal_leaf_w"
	# ]

	# for field in fields:
	# 	if field in kwargs:
	# 		frappe.db.set_value(doctype, docname, field, kwargs.get(field))

	# 무시할 시스템 키
	# ignore_keys = {"cmd", "doctype", "docname", "parent", "exclude_fields"}

	# doc = frappe.get_doc(doctype, docname)

	# for field, value in kwargs.items():
	# 	if field in ignore_keys or field.startswith("exclude_"):
	# 		continue
	# 	# frappe.db.set_value(doctype, docname, field, value)
	# 	doc.set(field, value)
	# 	logger.info(f"[edit_conditions] Setting field: {field} with value: {value}")

	# if exclude_fields:
	# 	frappe.db.set_value(doctype, docname, "exclude_fields", exclude_fields)

	# doc = frappe.get_doc("BOM Creator", parent)
	# doc.save()

	# return doc

	# 무시할 시스템 키
	ignore_keys = {"cmd", "doctype", "docname", "parent", "exclude_fields"}

	# 함수 시작 및 기본 정보 로깅 (INFO 레벨)
	#logger.info(f"Starting edit_conditions for {doctype} '{docname}' (Parent: {parent})")
	# 상세 입력값 로깅 (DEBUG 레벨 - 필요시 주석 해제 또는 레벨 조정)
	# logger.debug(f"Received kwargs for {docname}: {kwargs!r}")

	try:
		# 1. 대상 자식 문서 및 메타데이터 로드
		child_doc = frappe.get_doc(doctype, docname)
		try:
			meta = frappe.get_meta(doctype)
		except frappe.DoesNotExistError:
			logger.error(f"Metadata not found for DocType: {doctype}")
			raise ValueError(f"Could not find metadata for DocType: {doctype}")

		updated_fields = []

		# 2. kwargs를 순회하며 필드 업데이트
		for field, value in kwargs.items():
			if field in ignore_keys or field.startswith("exclude_"):
				continue

			# DocType에 필드가 존재하는지 확인
			if not meta.has_field(field):
				logger.warn(f"Skipping non-existent field '{field}' for {doctype} '{docname}'.")
				continue

			# 현재 값과 비교하여 변경된 경우에만 set 호출
			current_value = child_doc.get(field)
			if current_value != value:
				child_doc.set(field, value)
				updated_fields.append(field)
				# 변경된 필드 로깅 (INFO 레벨)
				#logger.info(f"Setting field '{field}' to {value!r} for {doctype} '{docname}'")

		# 3. exclude_fields 처리
		if exclude_fields is not None:
			if meta.has_field("exclude_fields"):
				current_exclude = child_doc.get("exclude_fields")
				if current_exclude != exclude_fields:
					child_doc.set("exclude_fields", exclude_fields)
					updated_fields.append("exclude_fields")
					#logger.info(f"Setting field 'exclude_fields' to {exclude_fields!r} for {doctype} '{docname}'")
			else:
				logger.warn(f"Field 'exclude_fields' does not exist in DocType '{doctype}'. Skipping update.")

		# 4. 변경 사항이 있을 경우 자식 문서 저장
		if updated_fields:
			#logger.info(f"Saving {doctype} '{docname}' with updated fields: {updated_fields}")
			# 권한 문제가 발생할 수 있는 API 호출이므로 ignore_permissions 권장
			child_doc.save(ignore_permissions=True)
			#logger.info(f"Successfully saved {doctype} '{docname}'")
		# else:
			#logger.info(f"No changes detected for {doctype} '{docname}'. Skipping save.")

		# 5. 부모 문서 저장 (타임스탬프 업데이트 목적)
		if parent:
			try:
				parent_doc = frappe.get_doc("BOM Creator", parent)
				# 부모 문서는 변경 사항이 없어도 저장하여 modified 타임스탬프 업데이트
				parent_doc.save(ignore_permissions=True)
				#logger.info(f"Successfully saved parent document 'BOM Creator' '{parent}'")
			except frappe.DoesNotExistError:
				logger.error(f"Parent document 'BOM Creator' '{parent}' not found for {docname}.")
			except Exception as e:
				# 부모 저장 실패 시에도 자식 업데이트는 성공했을 수 있으므로 에러 로깅만 수행
				logger.error(f"Error saving parent document 'BOM Creator' '{parent}': {e}")


		# 6. 업데이트된 자식 문서 객체를 다시 로드하여 반환 (가장 확실한 최신 상태)
		#logger.info(f"Returning updated document: {doctype} '{docname}'")
		return frappe.get_doc(doctype, docname)

	except Exception as e:
		# 전체 에러 로깅
		logger.error(f"Error occurred in edit_conditions for {doctype} '{docname}'")
		frappe.log_error(frappe.get_traceback(), "edit_conditions Error")
		# 클라이언트에 에러를 명시적으로 알리려면 frappe.throw 사용 고려
		# frappe.throw(f"Failed to update conditions for {docname}. Error: {e}")
		return None # 또는 빈 객체 등 에러 상황에 맞는 값 반환


@frappe.whitelist()
def edit_values(doctype, docname, parent=None, **kwargs):

	if isinstance(kwargs, str):
		kwargs = frappe.parse_json(kwargs)

	if isinstance(kwargs, dict):
		kwargs = frappe._dict(kwargs)
		
	fields = [
		"color", "use_billing_color", "width", "ch", "pw", "ph", "leaf_width", "leaf_height",
		"ceiling_visible", "base_visible_h", 
		"under_cut", "open_width", "open_height", "panel_crh", "panel_trh", "abl_a", "abl_b", "depth"
	]

	for field in fields:
		if field in kwargs:
			frappe.db.set_value(doctype, docname, field, kwargs.get(field))

	doc = frappe.get_doc("BOM Creator", parent)
	doc.save()

	return doc

@frappe.whitelist()
def get_bom_details(bom_no):
	if not bom_no:
		frappe.throw(_("BOM Number is required"))

	# Get BOM details
	bom = frappe.get_doc("BOM", bom_no)

	if not bom:
		frappe.throw(_("BOM not found"))

	# Prepare BOM details
	data = {
		"item_code": bom.item,
		"items": [
			{
				"item_code": item.item_code,
				"qty": item.qty,
				"uom": item.uom
			}
			for item in bom.items
		],
	}
	return data
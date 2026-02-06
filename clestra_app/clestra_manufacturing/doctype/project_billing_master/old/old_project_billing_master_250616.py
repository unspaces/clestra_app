# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
import logging
from collections import defaultdict

# Logger 설정
logger = frappe.logger("project_billing_master", allow_site=True)
logger.setLevel(logging.DEBUG)

from frappe.model.document import Document
from frappe.query_builder.functions import IfNull, Sum
from frappe.utils import cint, flt, cstr
from erpnext.manufacturing.doctype.bom.bom import get_children as get_bom_children
from erpnext.manufacturing.doctype.work_order.work_order import get_item_details

SIZE_FIELDS = [
        "width", "ch", "pw", "ph", "ceiling_visible", "base_visible_h",
        "under_cut", "panel_crh", "panel_trh", "abl_a", "abl_b",
		"leaf_width", "leaf_height"
    ]

PBM_FILTER_FIELDS = [
		"name", "zone", "color", "glass_a", "glass_b", "door_frame", "app_country",
		"handle_direct", "hw_options", "keeper", "keeper_glass_a", "keeper_glass_b",
		"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
		"al_extend_strip", "disassembled",
		"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap", "print_hide",
		"is_pair_door", "equal_leaf_w", "door_frame_ref",
		"leaf_item_code", "leaf_act_status", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_material",
		"leaf_b_item_code", "leaf_b_act_status", "leaf_b_thk", "leaf_b_color", "leaf_b_glass_a", "leaf_b_glass_b", "leaf_b_material",
		"door_hw_spec_code"
	]

PARENT_FIELDS = [
	"door_open_type", "door_set_type",
	"color", "glass_a", "glass_b", "door_frame", "app_country", 
	"handle_direct", "hw_options", "keeper", "keeper_glass_a", "keeper_glass_b",
	"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
	"disassembled",
	"leaf_item_code", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_act_status",
	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap",
	"for_pair_door", "equal_leaf_w", "under_cut",
	"qty_prefix", "qty_suffix",
	]

BOM_ITEM_FIELDS = [
	"idx", "item_code", 
	"color", "glass_a", "glass_b", "door_frame", "app_country",
	"handle_direct", "hw_options", "keeper", "keeper_glass_a", "keeper_glass_b",
	"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
	"al_extend_strip", "disassembled",
	"leaf_item_code", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_act_status",
	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap",
	"for_pair_door", "equal_leaf_w", "print_hide", "qty_prefix", "qty_suffix", "use_unit", "show_qty_bracket",
	"qty_prefix", "qty_suffix",
	]

CONDITIONAL_FIELDS_KEYS = ["door_frame", "astragal", "leaf_item_code"]

class ProjectBillingMaster(Document):

	def before_render(doc, method):
		if not doc.door_items:
			return  # door_items가 없으면 실행하지 않음

		# 모든 item_code를 한 번의 쿼리로 가져옴
		item_codes = [row.item_code for row in doc.door_items if row.item_code]
		if not item_codes:
			return  # item_code가 없는 경우 실행하지 않음

		# 한 번의 쿼리로 모든 item_code의 image 정보를 가져옴
		item_images = frappe._dict(
			frappe.get_all(
				"Item",
				filters={"name": ("in", item_codes)},
				fields=["name", "image"],
				as_list=True
			)
		)

		# door_items의 image 필드 업데이트
		for row in doc.door_items:
			row.image = item_images.get(row.item_code, "")  # 이미지가 없으면 빈 문자열 할당

	@frappe.whitelist()
	def get_sub_assembly_items(self, manufacturing_type=None):
		"Fetch sub assembly items and optionally combine them."
		self.panel_items = []
		self.door_items = []
		self.detail_bom_items = []
		sub_assembly_items_store = []
		sub_assembly_items_pair_store = []
		
		for row in self.po_items:
			indent_level = cint(row.indent_level)
			
			if self.skip_available_sub_assembly_item and not self.sub_assembly_warehouse:
				frappe.throw(_("Row #{0}: Please select the Sub Assembly Warehouse").format(row.idx))

			if not row.item_code:
				frappe.throw(_("Row #{0}: Please select Item Code in Assembly Items").format(row.idx))

			if not row.bom_no:
				frappe.throw(_("Row #{0}: Please select the BOM No in Assembly Items").format(row.idx))
			
			# Determine warehouse for sub-assembly items
			warehouse = (self.sub_assembly_warehouse) if self.skip_available_sub_assembly_item else None

			bom_data_main = []
			common_args = {
				"bom_no": row.bom_no,
				"to_produce_qty": row.planned_qty,
				"company": self.company,
				"warehouse": warehouse,
				"color": row.color,
				"indent_level": indent_level,
				"size_fields": {field: getattr(row, field, None) for field in SIZE_FIELDS},
				"pbm_filter_fields": {field: getattr(row, field, None) for field in PBM_FILTER_FIELDS},
			}
			# Pass size_fields explicitly
			get_sub_assembly_items(**common_args, bom_data=bom_data_main)
			self.set_sub_assembly_items_based_on_level(row, bom_data_main, manufacturing_type)
			sub_assembly_items_store.extend(bom_data_main)

			if cint(row.is_pair_door):
				get_sub_assembly_items(**common_args,bom_data=bom_data_main)
				sub_assembly_items_pair_store.extend(bom_data_main)

		if (not sub_assembly_items_store and self.skip_available_sub_assembly_item) or (
			not sub_assembly_items_pair_store and self.skip_available_sub_assembly_item
			and self.is_pair_door == 1
		):
			message = (
				_(
					"As there are sufficient Sub Assembly Items, Work Order is not required for Warehouse {0}."
				).format(self.sub_assembly_warehouse)
				+ "<br><br>"
			)
			message += _(
				"If you still want to proceed, please disable 'Skip Available Sub Assembly Items' checkbox."
			)

			frappe.msgprint(message, title=_("Note"))

		if self.combine_sub_items:
			# Combine subassembly items
			sub_assembly_items_store = self.combine_subassembly_items(sub_assembly_items_store)
			sub_assembly_items_pair_store = self.combine_subassembly_items(sub_assembly_items_pair_store)

		# door_cover_data = {}
		# leaf_cover_data = {}
		last_product_section = None
		last_parent_item_code = None
		
		for idx, row in enumerate(sub_assembly_items_store):
			# row.idx = idx

			# self.append("panel_items", row)
			# parent_item_code = row.item_code
			# product_section = frappe.get_value("Item", parent_item_code, "product_section")

			# Item 정보를 한 번의 DB 조회로 가져오기
			# item_details = frappe.get_cached_value(
			# 	"Item", row.item_code, ["door_set_type", "product_type", "product_keyword"], as_dict=True
			# )

			# 값이 없을 경우 기본값 설정
			# door_set_type = item_details.get("door_set_type", "")
			# product_type = item_details.get("product_type", "")
			# product_keyword = item_details.get("product_keyword", "")

			# 부모 아이템 설정 (이전 부모 값이 없으면 row.item_code 유지)
			if not getattr(row, "parent_item_code", None):  
				parent_item_code = row.item_code  
				last_parent_item_code = parent_item_code  # 🔹 이후에도 유지
			else:
				parent_item_code = last_parent_item_code

			 # product_section 값 가져오기 (이전 값 유지)
			product_section = frappe.get_cached_value("Item", parent_item_code, "product_section") if parent_item_code else None
			if not product_section and last_product_section:
				product_section = last_product_section  # 🔹 이전 값 유지

			# 현재 row에 product_section 적용
			row.product_section = product_section
			last_product_section = product_section

			# 🔍 Debug 로그 추가
			# logger.info(f"Processing Row: {row.item_code} | Parent: {parent_item_code} | Section: {product_section}")
			# logger.info(f"Attempting to append to detail_bom_items: {row.item_code}, Product Section: {product_section}, Indent: {row.indent_level}")

			try:
				self.append("detail_bom_items", row)
				# logger.info(f"Successfully appended {row.item_code} to detail_bom_items.")
			except Exception as e:
				logger.error(f"Error appending {row.item_code} to detail_bom_items: {e}", exc_info=True)
			
			# if product_section == "Door":
			# 	if not row.parent_item_code:
			# 		key = (row.item_code, row.width, row.ch, row.under_cut)
			# 		if key in door_cover_data:
			# 			door_cover_data[key]["lh_qty"] += row.stock_qty if row.stock_qty and row.handle_direct in ["LH", "RHR"] else 0
			# 			door_cover_data[key]["rh_qty"] += row.stock_qty if row.stock_qty and row.handle_direct in ["RH", "LHR"] else 0
			# 		else:
			# 			door_cover_data[key] = {
			# 				"name": row.name,
			# 				"door_hw_spec_code": row.door_hw_spec_code,
			# 				"item_code": row.item_code,
			# 				"door_set_type": door_set_type,
			# 				"product_type": product_type,
			# 				"product_keyword": product_keyword,
			# 				"door_set_type_keyword": "S" if door_set_type == "Single" else ("P" if door_set_type == "Pair" else ""),
			# 				"width": row.width,
			# 				"ch": row.ch,
			# 				"ph": row.ph,
			# 				"rh_qty": row.stock_qty if row.stock_qty >0 and row.handle_direct in ["RH", "LHR"] else 0,
			# 				"lh_qty": row.stock_qty if row.stock_qty >0 and row.handle_direct in ["LH", "RHR"] else 0,
			# 				"under_cut": row.under_cut,
			# 				"remark": f"U.C {row.under_cut}" if row.under_cut else "",
			# 				"ref_name": row.ref_name,
			# 				"color" : row.color,
			# 			}
			# 	else:
			# 		self.append("detail_bom_items", row)
			# elif product_section == "Panel":
			# 	if not row.parent_item_code:
			# 		self.append("panel_cover", row)
			# 	else: 
			# 		self.append("detail_bom_items", row)
			# elif product_section == "Leaf":
			# 	key = (row.door_frame_ref, row.width, row.height)
			# 	if not row.parent_item_code:
			# 		if key in leaf_cover_data:
			# 			leaf_cover_data[key] = {
			# 			"door_frame_ref": row.door_frame_ref,
			# 			"leaf_keyword": frappe.get_value("Item", row.item_code, "product_keyword"),
			# 			"leaf_width": row.width,
			# 			"leaf_height": row.height
			# 			}
			# 	else:
			# 		self.append("door_items", row)

		# Door 항목을 합친 후 다시 적용
		# self.door_cover = []
		# for key, merged_row in door_cover_data.items():
		# 	self.append("summary_parent_items", frappe._dict(merged_row))
		
		# self.leaf_cover = []
		# for key, merged_row in leaf_cover_data.items():
		# 	self.append("summary_parent_items", frappe._dict(merged_row))

		# for row in self.leaf_cover:
		# 	matching_row = next((r for r in self.door_cover if r.ref_name == row.door_frame_ref), None)
		# 	if matching_row:
		# 		matching_row.leaf_keyword = row.leaf_keyword
		# 		matching_row.leaf_width = row.leaf_width
		# 		matching_row.leaf_height = row.leaf_height

		# for idx, row in enumerate(sub_assembly_items_pair_store):
		# 	row.idx = idx
		# 	row.product_section = product_section  # Set product_section for all items

		# 	# self.append("panel_items", row)
		# 	# parent_item_code = row.item_code
		# 	# product_section = frappe.get_value("Item", parent_item_code, "product_section")
			
		# 	if product_section == "Door":
		# 		if not row.parent_item_code: 
		# 			self.append("door_cover", frappe._dict({
		# 				"door_hw_spec_code": row.door_hw_spec_code,
		# 				"item_code": row.item_code,
		# 				"width": row.width,
		# 				"ch": row.ch,
		# 				"ph": row.ph,
		# 				"rh_qty": row.stock_qty if row.stock_qty >0 and row.handle_direct in ["RH", "LHR"] else 0,
		# 				"lh_qty": row.stock_qty if row.stock_qty >0 and row.handle_direct in ["LH", "RHR"] else 0,
		# 				"under_cut": row.under_cut,
		# 				"remark": f"U.C {row.under_cut}" if row.under_cut else ""
		# 			}))
		# 		else:
		# 			self.append("door_items", row)
		# 	elif product_section == "Panel" and row.idx == 0:
		# 		self.append("panel_cover", row)
		# 	elif product_section == "Panel":
		# 		self.append("panel_items", row)

		self.set_default_supplier_for_subcontracting_order()


	@frappe.whitelist()
	def generate_billing(self):
		# Check if the source table exists and has data
		if not self.detail_bom_items:
			# frappe.msgprint(_("Please run 'Get Sub Assembly Items' first to populate the Summary Items table."), indicator='warning')
			return

		# Clear target tables to prevent duplicates on re-run
		self.set("door_cover", [])
		self.set("panel_cover", [])
		self.set("sub_items", [])  # Replace 'sub_items' if your actual field name is different

		# --- ★★★ Step 1: Establish Global Zone to Virtual Field Mapping ★★★ ---
		all_unique_original_zone_keys_in_document = set()
		for item_row in self.detail_bom_items: # Iterate through all source items
			current_zone_from_item = cstr(getattr(item_row, "zone", "")).strip()
			current_qty_from_item = cint(getattr(item_row, "qty", 0))
			if current_zone_from_item and current_qty_from_item > 0: # Only consider valid zones with quantity
				all_unique_original_zone_keys_in_document.add(current_zone_from_item)

		# Sort all unique zone names found in the document to ensure consistent order
		sorted_global_original_zone_keys = sorted(list(all_unique_original_zone_keys_in_document))
		# Example: sorted_global_original_zone_keys = ["12F", "13F", "14F"]

		global_zone_to_virtual_field_map = {}
		MAX_VIRTUAL_FIELDS = 20 # Consistent with client-side

		for i, actual_zone_name in enumerate(sorted_global_original_zone_keys):
			if i < MAX_VIRTUAL_FIELDS:
				# Creates mapping like: {"12F": "zone_1", "13F": "zone_2", "14F": "zone_3"}
				global_zone_to_virtual_field_map[actual_zone_name] = f"zone_{i + 1}"
			else:
				# Optional: Log if too many unique zones for available virtual fields
				# logger.warning(f"Document has more than {MAX_VIRTUAL_FIELDS} unique zones. Zone '{actual_zone_name}' and subsequent ones will not have a 'field' mapping in zone_qty.")
				print(f"WARNING: Document has > {MAX_VIRTUAL_FIELDS} unique zones. Zone '{actual_zone_name}' won't map to zone_X.")
				break

		# --- Define which fields to copy ---
		common_fields = ["item_code", "item_name", "description", "qty", "uom", "rate", "amount", "color", "ref_name", "idx", "parent_item_code", "indent_level", "stock_uom", "product_section", "size", "zone_qty", "zone"]
		size_fields = ["width", "ch", "pw", "ph", "uh", "under_cut"]
		door_specific_fields = ["door_hw_spec_code", "handle_direct", "door_set_type", "product_keyword", "door_set_type_keyword", "leaf_width", "leaf_height", "remark"]
		panel_specific_fields = ["product_keyword"]
		sub_item_specific_fields = ["qty", "abl_a", "abl_b", "print_hide", "print_group", "print_order"]

		fields_for_door_cover = list(set(common_fields + size_fields + door_specific_fields))
		fields_for_panel_cover = list(set(common_fields + size_fields + panel_specific_fields))
		fields_for_sub_items = list(set(common_fields + size_fields + door_specific_fields + panel_specific_fields + sub_item_specific_fields))

		aggregated_door_covers = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "zone_qty": defaultdict(lambda: defaultdict(int)) })
		aggregated_panel_covers = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "zone_qty": defaultdict(int) })
		aggregated_sub_items = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "zone_qty": defaultdict(int) })

		# sub_items_to_process = []

		# --- Iterate and Categorize ---
		processed_count = 0
		skipped_for_print_hide = 0 # print_hide로 인해 스킵된 항목 카운트
		skipped_count = 0

		# --- Phase 1: Iterate and Categorize ---
		for row in self.detail_bom_items:
			product_section = getattr(row, "product_section", None)
			is_parent = not row.parent_item_code # Check if it's a top-level item in its hierarchy
			current_zone = cstr(getattr(row, "zone", "")).strip()
			current_qty = cint(row.qty)

			if not current_zone:
				skipped_count += 1
				continue

			if current_qty <= 0:
				skipped_count += 1
				continue

			target_table_name = None
			target_aggregator = None
			fields_to_copy = []
			combine_key_fields = []

			if (product_section == "Door" or product_section == "Leaf") and is_parent:
				target_table_name = "door_cover"
				target_aggregator = aggregated_door_covers
				fields_to_copy = fields_for_door_cover
				combine_key_fields = ["door_hw_spec_code", "product_keyword", "size", "color", "item_code", "handle_direct", "item_code_prefix"]
				# logger.debug(f"Assigning item {row.item_code} (idx: {row.idx}) to door_cover")
			elif product_section == "Panel" and is_parent:
				target_table_name = "panel_cover"
				target_aggregator = aggregated_panel_covers
				fields_to_copy = fields_for_panel_cover
				combine_key_fields = ["product_keyword", "size", "color", "item_code", "item_code_prefix"]
				# logger.debug(f"Assigning item {row.item_code} (idx: {row.idx}) to panel_cover")
			else:
				print_hide_value = cint(getattr(row, "print_hide", 0))
				if print_hide_value == 1:
					skipped_for_print_hide += 1
					continue

				# All children (parent_item_code exists) OR non-Door/Panel parents go to sub_items
				target_table_name = "sub_items"
				target_aggregator = aggregated_sub_items
				fields_to_copy = fields_for_sub_items
				combine_key_fields = ["item_code", "color", "size", "abl_a", "abl_b", "depth", "print_hide"]
				# logger.debug(f"Assigning item {row.item_code} (idx: {row.idx}) to sub_items")

			# --- Create new row data and append ---
			if target_aggregator is not None:
				key_tuple = tuple(cstr(getattr(row, k, "")) for k in combine_key_fields)

				if key_tuple not in target_aggregator:
					new_row_data = frappe._dict()
					for field in fields_to_copy:
						if hasattr(row, field) and field not in ["qty", "zone_qty"]:
							new_row_data[field] = getattr(row, field)
						elif field == "qty": new_row_data[field] = 0
						elif field == "zone_qty": new_row_data[field] = {}

					if target_aggregator is aggregated_door_covers:
						item_details = frappe.get_cached_value("Item", row.item_code, ["door_set_type", "product_keyword"], as_dict=True) or {}
						new_row_data.door_set_type = item_details.get("door_set_type")
						new_row_data.product_keyword = item_details.get("product_keyword")

						new_row_data.door_set_type_keyword = "S" if new_row_data.door_set_type == "Single" else ("P" if new_row_data.door_set_type == "Pair" else "")
						new_row_data.remark = f"U.C {row.under_cut}" if row.under_cut else ""

						# new_row_data.qty = cint(row.qty) # Ensure qty is int
						# new_row_data.rh_qty = row.qty if row.handle_direct == "RH" else 0
						# new_row_data.lhr_qty = row.qty if row.handle_direct == "LH-R" else 0
						# new_row_data.lh_qty = row.qty if row.handle_direct == "LH" else 0
						# new_row_data.rhr_qty = row.qty if row.handle_direct == "RH-R" else 0

					elif target_aggregator is aggregated_sub_items:
						item_print_info = frappe.get_value("Item", new_row_data.item_code, ["print_group", "print_order"], as_dict=True)
						new_row_data.print_group = item_print_info.get("print_group")
						new_row_data.print_order = item_print_info.get("print_order")
						new_row_data.indent_level = 0

					target_aggregator[key_tuple]["data"] = new_row_data
					
				# target_aggregator[key_tuple]["qty"] += cint(target_aggregator[key_tuple]["qty"]) + current_qty
				target_aggregator[key_tuple]["qty"] += current_qty
				# target_aggregator[key_tuple]["zone_qty"][current_zone] = cint(target_aggregator[key_tuple]["zone_qty"].get(current_zone,0)) + current_qty
				# target_aggregator[key_tuple]["zone_qty"][current_zone] += current_qty
				if target_aggregator is aggregated_door_covers:
					source_row_handle_direct = cstr(getattr(row, "handle_direct", "")).strip()
					if source_row_handle_direct and current_zone:
						target_aggregator[key_tuple]["zone_qty"][current_zone][source_row_handle_direct] += current_qty
				else:
					if current_zone:
						target_aggregator[key_tuple]["zone_qty"][current_zone] += current_qty
				


			# if target_table_name:
			# 	new_row_data = frappe._dict()
			# 	for field in fields_to_copy:
			# 		if hasattr(row, field):
			# 			new_row_data[field] = getattr(row, field)
			# 		# else:
			# 		#     logger.warning(f"Field '{field}' not found in source row {row.idx} (Item: {row.item_code}) when copying to '{target_table_name}'")

			# 	# --- Specific adjustments based on original logic ---
			# 	if target_table_name == "door_cover":
			# 		# Example: Fetch additional details needed only for door_cover
			# 		# (These should ideally be in summary_items already if possible)
			# 		item_details = frappe.get_cached_value("Item", row.item_code, ["door_set_type", "product_keyword"], as_dict=True) or {}
			# 		new_row_data.door_set_type = item_details.get("door_set_type")
			# 		new_row_data.product_keyword = item_details.get("product_keyword")
			# 		new_row_data.door_set_type_keyword = "S" if new_row_data.door_set_type == "Single" else ("P" if new_row_data.door_set_type == "Pair" else "")
			# 		new_row_data.remark = f"U.C {row.under_cut}" if row.under_cut else ""
			# 		new_row_data.qty = cint(row.qty) # Ensure qty is int
			# 		new_row_data.rh_qty = row.qty if row.handle_direct == "RH" else 0
			# 		new_row_data.lhr_qty = row.qty if row.handle_direct == "LHR" else 0
			# 		new_row_data.lh_qty = row.qty if row.handle_direct == "LH" else 0
			# 		new_row_data.rhr_qty = row.qty if row.handle_direct == "RHR" else 0
			# 		try:
			# 			self.append(target_table_name, new_row_data)
			# 			processed_count += 1
			# 		except Exception as e:
			# 			# logger.error(f"Error appending item {row.item_code} to {target_table_name}: {e}", exc_info=True)
			# 			skipped_count += 1

			# 	elif target_table_name == "panel_cover":
			# 		# Example: Fetch additional details needed only for panel_cover
			# 		new_row_data.qty = cint(row.qty)
			# 		try:
			# 			self.append(target_table_name, new_row_data)
			# 			processed_count += 1
			# 		except Exception as e:
			# 			# logger.error(f"Error appending item {row.item_code} to {target_table_name}: {e}", exc_info=True)
			# 			skipped_count += 1

			# 	elif target_table_name == "sub_items":
			# 		# getattr을 사용하여 print_hide 필드가 없는 경우에도 오류 방지 (기본값 0)
			# 		print_hide_value = cint(getattr(row, "print_hide", 0)) # cint로 정수 변환
			# 		if print_hide_value == 1:
			# 			# logger.info(f"Skipping item {row.item_code} (idx: {row.idx}) for sub_items due to print_hide=1")
			# 			skipped_for_print_hide += 1
			# 			continue # 다음 루프로 넘어감 (append하지 않음)

			# 		new_row_data.qty = cint(row.qty)
			# 		new_row_data.indent_level = 0

			# 		item_print_info = frappe.get_value("Item", new_row_data.item_code, ["print_group", "print_order"], as_dict=True)
			# 		if item_print_info:
			# 			new_row_data.print_group = item_print_info.get("print_group")
			# 			new_row_data.print_order = item_print_info.get("print_order")
			# 		sub_items_to_process.append(new_row_data)

		for key, aggregated_data in aggregated_door_covers.items():
			final_row_data = aggregated_data["data"].copy()
			final_row_data.qty = cint(aggregated_data["qty"])

			# item_handle_direct = final_row_data.get("handle_direct", "")

			zone_qty_object_for_json = {}
			item_specific_zone_handle_qty = aggregated_data.get("zone_qty", {})

			for actual_zone_name, handle_details_for_zone in item_specific_zone_handle_qty.items():
				virtual_field_name = global_zone_to_virtual_field_map.get(actual_zone_name)
				if virtual_field_name:
					qty_zone_sum = sum(cint(q) for q in handle_details_for_zone.values())

					zone_qty_object_for_json[actual_zone_name] = {
						"field": virtual_field_name,
						"qty": qty_zone_sum,
						"handle_details": handle_details_for_zone
					}
				else:
					logger.warning(f"Item {final_row_data.item_code}: Zone '{actual_zone_name}' not found in global mapping. Skipping.")

			final_row_data.zone_qty = json.dumps(zone_qty_object_for_json)

			# total_qty = final_row_data.qty
			# final_row_data.rh_qty = total_qty if hd == "RH" else 0
			# final_row_data.lh_qty = total_qty if hd == "LH" else 0
			# final_row_data.lhr_qty = total_qty if hd == "LH-R" else 0
			# final_row_data.rhr_qty = total_qty if hd == "RH-R" else 0

			self.append("door_cover", final_row_data)
			processed_count += 1

		for key, aggregated_data in aggregated_panel_covers.items():
			final_row_data = aggregated_data["data"]
			final_row_data.qty = cint(aggregated_data["qty"])
			# final_row_data.zone_qty = json.dumps(aggregated_data["zone_qty"])

			zone_qty_object_for_json = {}
			item_specific_zone_quantities = aggregated_data.get("zone_qty", {})

			for actual_zone_name, qty in item_specific_zone_quantities.items():
				virtual_field_name = global_zone_to_virtual_field_map.get(actual_zone_name)
				if virtual_field_name:
					zone_qty_object_for_json[actual_zone_name] = {
						"field": virtual_field_name,
						"qty": qty
					}
				else:
					logger.warning(f"Item {final_row_data.item_code}: Zone '{actual_zone_name}' not found in global mapping. Skipping.")

			final_row_data.zone_qty = json.dumps(zone_qty_object_for_json)
			self.append("panel_cover", final_row_data)
			processed_count += 1

		sub_items_final_list = []
		for key, aggregated_data in aggregated_sub_items.items():
			final_row_data = aggregated_data["data"]
			final_row_data.qty = cint(aggregated_data["qty"])
			# final_row_data.zone_qty = json.dumps(aggregated_data["zone_qty"])

			zone_qty_object_for_json = {}
			item_specific_zone_quantities = aggregated_data.get("zone_qty", {})
			# active_zone_names_for_item = sorted(aggregated_data["zone_qty"].keys())

			# temp_virtual_field_counter = 1
			# MAX_VIRTUAL_FIELDS = 20

			# for actual_zone_name in active_zone_names_for_item:
			# 	if temp_virtual_field_counter <= MAX_VIRTUAL_FIELDS:
			# 		vf_name_on_server = f"zone_{temp_virtual_field_counter}"
			# 		zone_qty_object_for_json[actual_zone_name] = {
			# 			"field": vf_name_on_server,
			# 			"qty": aggregated_data["zone_qty"].get(actual_zone_name,0)
			# 		}
			# 		temp_virtual_field_counter += 1
			# 	else:
			# 		logger.warning(f"Item {final_row_data.item_code}: Too many zones ({len(active_zone_names_for_item)}) for MAX_VIRTUAL_FIELD ({MAX_VIRTUAL_FIELDS}). Zone '{actual_zone_name}' will not be included in the JSON.")
			# 		break

			for actual_zone_name, qty in item_specific_zone_quantities.items():
				virtual_field_name = global_zone_to_virtual_field_map.get(actual_zone_name)
				if virtual_field_name:
					zone_qty_object_for_json[actual_zone_name] = {
						"field": virtual_field_name,
						"qty": qty
					}
				else:
					logger.warning(f"Item {final_row_data.item_code}: Zone '{actual_zone_name}' not found in global mapping. Skipping.")

			final_row_data.zone_qty = json.dumps(zone_qty_object_for_json)
			sub_items_final_list.append(final_row_data)

		# --- Phase 2: Combine and Sort sub_items ---
		# combined_sub_items = {}
		# combine_key = ["item_code", "color", "size", "abl_a", "abl_b", "depth", "print_hide"]

		# for item in sub_items_to_process:
		# 	key = tuple(item.get(k) for k in combine_key)
		# 	if key in combined_sub_items:
		# 		combined_sub_items[key]["qty"] += item.qty
		# 	else:
		# 		combined_sub_items[key] = item.copy()

		# combined_list = list(combined_sub_items.values())
		# logger.info(f"Finished combining. Resulting items: {len(combined_list)}")

		def get_sort_key(item):
			print_group = item.get("print_group", "") or ""
			print_order = item.get("print_order", 0) or 0
			color = item.get("color", "") or ""
			size = item.get("size", "") or ""
			# return (print_group, print_order, color, size)
			return (print_group, print_order, color, size, item.get("item_code", "")) # item_code 추가로 안정성 확보
		
		sorted_sub_items = sorted(sub_items_final_list, key=get_sort_key)
		# logger.info("Finished sorting sub_items.")

		# --- Phase 3: Append sorted sub_items to the document ---
		for item_data in sorted_sub_items:
			item_data.pop('idx', None)
			try:
				self.append("sub_items", item_data)
				processed_count += 1
			except Exception as e:
				# logger.error(f"Error appending combined item to sub_items: {e}", exc_info=True)
				skipped_count += 1

		# --- Save the document ---
		# logger.info(f"Saving document. Processed: {processed_count}, Skipped (Print Hide): {skipped_for_print_hide}, Skipped (Errors): {skipped_count}")
		try:
			self.save(ignore_permissions=True)
		except Exception as e:
			logger.error("Error saving document after generate_billing", exc_info=True)
			frappe.throw(_("Failed to save the document after generating billing items."))

		return {"status": "success", "processed": processed_count, "skipped": skipped_count + skipped_for_print_hide}


	def set_sub_assembly_items_based_on_level(self, row, bom_data, manufacturing_type=None):
		"Modify bom_data, set additional details."
		is_group_warehouse = frappe.db.get_value("Warehouse", self.sub_assembly_warehouse, "is_group")

		new_grid_name = {}

		for data in bom_data:
			data.qty = data.stock_qty
			# data.production_plan_item = row.name
			data.schedule_date = row.planned_start_date
			data.type_of_manufacturing = manufacturing_type or (
				"Subcontract" if data.is_sub_contracted_item else "In House"
			)

			if not is_group_warehouse:
				data.fg_warehouse = self.sub_assembly_warehouse

	def set_default_supplier_for_subcontracting_order(self):
		items = [
			d.item_code for d in self.panel_items if d.type_of_manufacturing == "Subcontract"
		]

		if not items:
			return

		default_supplier = frappe._dict(
			frappe.get_all(
				"Item Default",
				fields=["parent", "default_supplier"],
				filters={"parent": ("in", items), "default_supplier": ("is", "set")},
				as_list=1,
			)
		)

		if not default_supplier:
			return

		for row in self.panel_items:
			if row.type_of_manufacturing != "Subcontract":
				continue

			row.supplier = default_supplier.get(row.item_code)


@frappe.whitelist()
def get_bin_details(row, company, for_warehouse=None, all_warehouse=False):
	if isinstance(row, str):
		row = frappe._dict(json.loads(row))

	bin = frappe.qb.DocType("Bin")
	wh = frappe.qb.DocType("Warehouse")

	subquery = frappe.qb.from_(wh).select(wh.name).where(wh.company == company)

	warehouse = ""
	if not all_warehouse:
		warehouse = for_warehouse or row.get("source_warehouse") or row.get("default_warehouse")

	if warehouse:
		lft, rgt = frappe.db.get_value("Warehouse", warehouse, ["lft", "rgt"])
		subquery = subquery.where((wh.lft >= lft) & (wh.rgt <= rgt) & (wh.name == bin.warehouse))

	query = (
		frappe.qb.from_(bin)
		.select(
			bin.warehouse,
			IfNull(Sum(bin.projected_qty), 0).as_("projected_qty"),
			IfNull(Sum(bin.actual_qty), 0).as_("actual_qty"),
			IfNull(Sum(bin.ordered_qty), 0).as_("ordered_qty"),
			IfNull(Sum(bin.reserved_qty_for_production), 0).as_("reserved_qty_for_production"),
			IfNull(Sum(bin.planned_qty), 0).as_("planned_qty"),
		)
		.where((bin.item_code == row["item_code"]) & (bin.warehouse.isin(subquery)))
		.groupby(bin.item_code, bin.warehouse)
	)

	return query.run(as_dict=True)


@frappe.whitelist()
def get_item_data(item_code):
	item_details = get_item_details(item_code)

	return {
		"bom_no": item_details.get("bom_no"),
		"stock_uom": item_details.get("stock_uom"),
		"description": item_details.get("description")
	}


def get_sub_assembly_items(
	bom_no, bom_data, to_produce_qty, company, warehouse=None, indent_level=0, color=None, size_fields=None, pbm_filter_fields=None):
	fields_from_item = ["product_type", "description", "stock_uom"]
	parent_fields = PARENT_FIELDS
	size_fields_keys = SIZE_FIELDS + ["qty_custom"]
	size_fields = size_fields or {}
	pbm_filter_fields = pbm_filter_fields or {}
	local_variables = {f: size_fields.get(f, None) for f in size_fields_keys}
	parent_values_from_po_items = {f: pbm_filter_fields.get(f, None) for f in PBM_FILTER_FIELDS}

	# Get the parent item details
	parent_item_code = frappe.get_cached_value("BOM", bom_no, "item")
	parent_product_section = frappe.get_cached_value("Item", parent_item_code, "product_section") if parent_item_code else None
	parent_product_type = frappe.get_cached_value("Item", parent_item_code, "product_type") if parent_item_code else None
	parent_color_from_item = frappe.get_cached_value("Item", parent_item_code, "color") if parent_item_code else None
	
	logger.info(f"Parent Item Code: {parent_item_code}")
	parent_item_data = frappe.get_cached_value("BOM", bom_no, fields_from_item, as_dict=True)
	parent_bom_data = {}
	for field in parent_fields:
		value = frappe.db.get_value("BOM", bom_no, field)
		first_parent_value = parent_values_from_po_items.get(field, None)
		parent_bom_data[field] = first_parent_value if value in [None, ""] else value
		
	# parent_door_frame = parent_bom_data.get("door_frame",)
	conditional_field_values = {key: parent_bom_data.get(key, None) for key in CONDITIONAL_FIELDS_KEYS}
	parent_stock_qty = flt(to_produce_qty)
	
	parent_color_from_bom = frappe.db.get_value("BOM", bom_no, "color")
	color_from_so = parent_values_from_po_items.get("color", None)
	final_parent_color = None

	if parent_color_from_item is not None: # Check if it has any value
		final_parent_color = parent_color_from_item

	logger.info(f"Parent Item: {parent_item_code}, Parent Color from Item: {final_parent_color}")

	if final_parent_color is None: 
		if parent_color_from_bom is not None and parent_color_from_bom != "":
			final_parent_color = parent_color_from_bom

	logger.info(f"Parent Item: {parent_item_code}, Parent Color from BOM: {final_parent_color}")
	
	if final_parent_color is None:
		if color_from_so is not None or color_from_so != "":
			final_parent_color = color_from_so

	logger.info(f"Parent Item: {parent_item_code}, Color from SO: {color_from_so}, Final Parent Color: {final_parent_color}")

	if final_parent_color == "Disabled":
		logger.info(f"Parent Color's value is Disabled")
		final_parent_color = None

	zone = parent_values_from_po_items.get("zone", None)
	ref_name = parent_values_from_po_items.get("name", None)
	door_hw_spec_code = parent_values_from_po_items.get("door_hw_spec_code", None)

	def _generate_size_string(product_section, calculated_sizes):
		size_parts = []
		if product_section == "Door":
			w = calculated_sizes.get("width")
			ch = calculated_sizes.get("ch")
			if w is not None: size_parts.append(f"W:{w}")
			if ch is not None: size_parts.append(f"CH:{ch}")
		elif product_section == "Leaf":
			lw = calculated_sizes.get("leaf_width")
			lh = calculated_sizes.get("leaf_height")
			if lw is not None: size_parts.append(f"LW:{lw}")
			if lh is not None: size_parts.append(f"LH:{lh}")
		elif product_section == "Panel":
			w = calculated_sizes.get("width")
			pw = calculated_sizes.get("pw") # Panel Width - ensure this exists 
			ph = calculated_sizes.get("ph") # Panel Height
			if w is not None: size_parts.append(f"W:{w}")
			if pw is not None: size_parts.append(f"PW:{pw}") # Add if available
			if ph is not None: size_parts.append(f"PH:{ph}")
		# Add more sections or a default case if needed
		return ", ".join(size_parts)

	def process_field(field, formula, parent_value, conditional_fields_for_eval):
		"""
		Process a field with the provided formula and parent_value.
		Handles numbers, strings (formulas/conditions), and 'True' values.
		"""
		
		try:
			if formula == "Enabled":
				return parent_value
			elif str(formula).strip().lower() == "true":
				return parent_value
			elif isinstance(formula, str):  # 수식 또는 조건식으로 처리
				if "if" in formula: 
					# exec()로 조건식 처리
					exec_locals = {**local_variables, **conditional_fields_for_eval}
					exec(f"result = None\n{formula.replace('return', 'result =')}", {}, exec_locals)
					result = exec_locals["result"]
					logger.info(f"{field}: BOM value is a formula, set to {result}")
					return result
				else:
					evaluated_value = eval(
						formula,
						{},  # No global variables
						local_variables,  # 상위 필드 참조
					)
					return evaluated_value
			else:
				logger.info(f"{field}: BOM value is a number, set to {formula}")
				return formula
		except Exception as e:
			frappe.log_error(
				message=f"Error evaluating {field}: {str(e)}",
				title="Formula Evaluation Error"
			)
			logger.error(f"{field}: Error evaluating formula, set to None. BOM value: {formula}, Error: {e}")
			return None

	def round_and_convert_to_int(value):
		"""
		Round the value and convert to an integer if it's not None.
		"""
		if value is not None:
			return round(value)
		return None

	# Top-level Parent Item 처리
	if indent_level == 0 or (indent_level == 1 and parent_product_section == "Leaf"):
		logger.info(f"[Parent] Processing parent BOM: {bom_no}, Item: {parent_item_code}")
		try:
			size_field_values = {}
			qty_calculated = parent_stock_qty  # 기본 qty 값 초기화

			# 부모 BOM 문서에서 size_fields 가져오기
			parent_bom_values = frappe.db.get_value(
				"BOM",
				bom_no,  # 현재 BOM의 이름
				size_fields_keys,
				as_dict=True
			)

			for field in size_fields_keys:
				if field is None or field == "" or field == "Disabled":
					continue
				formula_library_name = parent_bom_values.get(field, None)
				parent_value = local_variables.get(field, None)
				# parent_door_frame = parent_bom_data.get("door_frame", None)
				# parent_astragal = parent_bom_data.get("astragal", None)
				conditional_field_values = {key: parent_bom_data.get(key, None) for key in CONDITIONAL_FIELDS_KEYS}
				
				formula_value = frappe.db.get_value("Formula Library", formula_library_name, "formula")
				logger.debug(f"Parent Item: Fetched formula for '{field}' from '{formula_value}'")

				if formula_value is not None:
					calculated_value = process_field(field, formula_value, parent_value, conditional_field_values)
					size_field_values[field] = calculated_value
				else:
					# size_field_values[field] = process_field(field, bom_value, parent_value)
					calculated_value = process_field(field, formula_value, parent_value, conditional_field_values)
					size_field_values[field] = parent_value if calculated_value in [None, ""] else calculated_value
				if field == "qty_custom" and size_field_values[field] is not None:
					qty_calculated = size_field_values[field]

			logger.info(f"[Parent] Calculations complete. Qty: {qty_calculated}, Sizes: {size_field_values}")

			parent_size_string = _generate_size_string(parent_product_section, size_field_values)

			parent_item_dict = frappe._dict(
					{
						"parent_item_code": None,
						"zone": zone,
						"item_code": parent_item_code,
						"item_name": parent_item_code,
						"product_type": parent_product_type,
						"description": parent_item_data.description,
						"stock_uom": parent_item_data.stock_uom,
						"uom": parent_item_data.stock_uom,
						"bom_no": bom_no,
						"is_sub_contracted_item": 0,
						"bom_level": indent_level,
						"indent_level": indent_level,
						"stock_qty": round_and_convert_to_int(qty_calculated),
						"color": final_parent_color,
						"door_hw_spec_code": door_hw_spec_code,
						"ref_name": ref_name,
						**parent_bom_data,
						**size_field_values,  # Add calculated size fields
						"size": parent_size_string,
					}
				)

			logger.info(f"[Parent] Attempting to append parent item: {parent_item_dict}")
			# Append parent item
			bom_data.append(parent_item_dict)
			logger.info(f"[Parent] Successfully appended parent item for BOM: {bom_no}")
		except Exception as e:
			logger.error(f"[Parent] Error appending parent item for BOM: {bom_no}, Error: {e}", exc_info=True)
			frappe.throw(_("Error appending parent item for BOM: {0}").format(bom_no))

	# Get BOM Items
	bom_items = frappe.get_all(
		"BOM Item",
		filters={"parent": bom_no},
		fields=BOM_ITEM_FIELDS + size_fields_keys
	)
	# logger.info(f"BOM Items fetched: {bom_items}")

	# def matches_bom_details(bom_item_data, pbm_values_dict):
	# 	# pbm_values_dict contains the filter criteria from PBM.
	# 	# bom_item_data contains the data for the BOM item being checked.

	# 	# Iterate through the fields and their values provided in the PBM filters
	# 	# The keys in pbm_values_dict define which fields we are filtering on.
	# 	for field_key, pbm_value_orig in pbm_values_dict.items():

	# 		item_value_orig = bom_item_data.get(field_key)
			
	# 		logger.debug(
	# 			f"Match Attempt: Item: {bom_item_data.get('item_code')}, Field: {field_key}, "
	# 			f"Item Value (orig): '{item_value_orig}', PBM Value (orig): '{pbm_value_orig}'"
	# 		)

	# 		# --- Convert to sets for comparison, handling None and stripping whitespace ---
	# 		# PBM Value Processing
	# 		pbm_has_specific_filter_value = False
	# 		pbm_set = set()
	# 		if isinstance(pbm_value_orig, str):
	# 			pbm_set = {v.strip() for v in pbm_value_orig.split(',') if v.strip()}
	# 			if pbm_set:
	# 				pbm_has_specific_filter_value = True
	# 		elif pbm_value_orig is not None: # Handles single non-string, non-None values
	# 			pbm_set = {str(pbm_value_orig).strip()}
	# 			if pbm_set: # Check if the string representation is non-empty
	# 				pbm_has_specific_filter_value = True
	# 		# If pbm_value_orig was None or resulted in an empty set, pbm_has_specific_filter_value remains False

	# 		# Item Value Processing
	# 		item_has_value = False
	# 		item_set = set()
	# 		if isinstance(item_value_orig, str):
	# 			item_set = {v.strip() for v in item_value_orig.split(',') if v.strip()}
	# 			if item_set:
	# 				item_has_value = True
	# 		elif item_value_orig is not None: # Handles single non-string, non-None values
	# 			item_set = {str(item_value_orig).strip()}
	# 			if item_set: # Check if the string representation is non-empty
	# 				item_has_value = True
	# 		# If item_value_orig was None or resulted in an empty set, item_has_value remains False

	# 		match_for_this_field = False # Default to no match for the current field

	# 		# --- Revised Matching Logic for the current field ---
	# 		if pbm_has_specific_filter_value:
	# 			# PBM has a specific filter value for this field.
	# 			# Item must match this specific filter.
	# 			if item_has_value:
	# 				# Both PBM and Item have values. Check for intersection.
	# 				if bool(pbm_set & item_set):
	# 					match_for_this_field = True
	# 				logger.debug(f"  -> Field {field_key}: PBM Set: {pbm_set}, Item Set: {item_set}, Intersection: {pbm_set & item_set}, Match for this field: {match_for_this_field}")
	# 			else:
	# 				# PBM has a filter, but Item has no value. This is NOT a match.
	# 				match_for_this_field = False
	# 				logger.debug(f"  -> Field {field_key}: PBM Set: {pbm_set}, but Item Set is empty. No match for this field.")
	# 		else:
	# 			# PBM does NOT have a specific filter value for this field (PBM filter is None/empty).
	# 			# For a match, the Item's value for this field MUST ALSO be None/empty.
	# 			if not item_has_value:
	# 				match_for_this_field = True
	# 				logger.debug(f"  -> Field {field_key}: PBM filter is empty/None, and Item value is also empty/None. Match for this field.")
	# 			else:
	# 				# PBM filter is empty/None, but Item HAS a value. This is NOT a match.
	# 				match_for_this_field = False
	# 				logger.debug(f"  -> Field {field_key}: PBM filter is empty/None, but Item Set ({item_set}) is NOT empty. No match for this field.")


	# 		if not match_for_this_field:
	# 			logger.info(
	# 				f"NO MATCH: Item: {bom_item_data.get('item_code')}, Field: {field_key}, "
	# 				f"ItemVal (Raw): '{item_value_orig}' (Set: {item_set}), "
	# 				f"PBMVal (Raw): '{pbm_value_orig}' (Set: {pbm_set}) "
	# 				f"-> Overall item does not match."
	# 			)
	# 			return False # If any actively applied filter field doesn't match, the item is excluded.

	# 	# If we reach here, it means all PBM filter fields were processed and matched according to the new logic.
	# 	# Note: If pbm_values_dict itself is empty, this loop won't run, and it will return True.
	# 	# This might need an initial check if pbm_values_dict must have at least one filter.
	# 	if not pbm_values_dict: # If there are no PBM filters at all
	# 		logger.info(f"NO PBM FILTERS AT ALL for Item: {bom_item_data.get('item_code')}. Considering this as NO MATCH as per implicit requirement.")
	# 		return False # Or True, depending on desired behavior for empty filter set

	# 	logger.info(f"ALL FILTERS PROCESSED AND MATCHED: Item: {bom_item_data.get('item_code')} for PBM filters -> Returning True.")
	# 	return True

	def matches_bom_details(bom_item_data, pbm_values_dict):
		# pbm_filter_fields is a list of field names that are keys in pbm_values_dict
		# global pbm_filter_fields # If pbm_filter_fields is defined globally

		for field_key in pbm_filter_fields: # Or iterate pbm_values_dict.keys() if that's the source of truth for active filters
			pbm_value_orig = pbm_values_dict.get(field_key)
			item_value_orig = bom_item_data.get(field_key)

			# 1. If PBM has no filter for this field, it doesn't restrict the item.
			if pbm_value_orig is None or (isinstance(pbm_value_orig, str) and pbm_value_orig.strip() == ""):
				logger.debug(f"Match Info: Item: {bom_item_data.get('item_code')}, Field: {field_key}, PBM Value is empty/None. This filter field imposes no restriction.")
				continue # This field does not fail the item. Move to the next filter field.

			# If we are here, PBM *has* a specific filter for field_key.
			
			# 2. Prepare sets from PBM and Item values
			pbm_set = set()
			if isinstance(pbm_value_orig, str):
				pbm_set = {v.strip() for v in pbm_value_orig.split(',') if v.strip()}
			elif pbm_value_orig is not None:
				pbm_set = {str(pbm_value_orig).strip()}
			# If pbm_set is empty here (e.g., pbm_value_orig was ",,"), it means PBM filter is effectively empty.
			# This case should be rare if the first `if` condition is robust.
			if not pbm_set: # PBM filter became empty after processing
				logger.debug(f"Match Info: Item: {bom_item_data.get('item_code')}, Field: {field_key}, PBM Value ('{pbm_value_orig}') processed to empty set. This filter field imposes no restriction.")
				continue


			item_set = set()
			if isinstance(item_value_orig, str):
				item_set = {v.strip() for v in item_value_orig.split(',') if v.strip()}
			elif item_value_orig is not None:
				item_set = {str(item_value_orig).strip()}

			# 3. Perform the match based on the sets
			match_for_this_field = False
			if not item_set:
				# Item has NO value (empty set) for this field.
				# Since PBM *does* have a specific filter (pbm_set is not empty here),
				# an empty item value should typically PASS, as it doesn't contradict the filter.
				# (e.g., if PBM says color must be Red, an item with no color doesn't fail this specific rule,
				# unless the rule is "item MUST be Red and color MUST exist").
				# For your case: "Item Value:  | PBM Value: #61900 | Match: True"
				match_for_this_field = True 
				logger.debug(f"  -> Field {field_key}: PBM Set: {pbm_set}, Item Set is empty. Considered a match for this field (item has no conflicting value).")
			elif bool(pbm_set & item_set): # Both have values, check for intersection
				match_for_this_field = True
				logger.debug(f"  -> Field {field_key}: PBM Set: {pbm_set}, Item Set: {item_set}, Intersection: {pbm_set & item_set}. Match for this field.")
			else:
				# Item has value(s), PBM has value(s), but no overlap.
				logger.debug(f"  -> Field {field_key}: PBM Set: {pbm_set}, Item Set: {item_set}. No intersection. No match for this field.")
				# match_for_this_field remains False

			if not match_for_this_field:
				logger.info(
					f"NO MATCH: Item: {bom_item_data.get('item_code')}, Field: {field_key}, "
					f"ItemVal (Raw): '{item_value_orig}' (Set: {item_set}), "
					f"PBMVal (Raw): '{pbm_value_orig}' (Set: {pbm_set}) "
					f"-> Overall item does not match due to this field."
				)
				return False

		# If the loop completes, all PBM-specified filters were either matched or non-restrictive.
		# However, you need to ensure pbm_filter_fields was not empty, or that at least one filter was active.
		# If pbm_filter_fields is empty, the loop won't run, and it will return True.
		# If pbm_filter_fields has items, but all pbm_values were None/empty, the loop will run but effectively do nothing.
		
		# Optional: Check if any filter was actually applied.
		# This requires a flag similar to `at_least_one_filter_applied` from previous versions
		# if you want "no active filters means no match".
		# For now, if it passes all filters (or there are no restrictive filters), it's True.
		
		logger.info(f"ALL FILTERS PROCESSED AND ITEM MATCHED: Item: {bom_item_data.get('item_code')} for PBM filters -> Returning True.")
		return True

	# Match BOM Items with get_bom_children data
	data = get_bom_children(parent=bom_no)
	for d in data:
		stock_qty = (d.stock_qty / d.parent_bom_qty) * flt(to_produce_qty)
		local_variables["qty"] = stock_qty
		# logger.info(f"Updated local_variables with qty: {local_variables}")

		size_field_values = {}
		parent_field_values = {}
		qty_calculated = stock_qty  # 기본값으로 stock_qty

		# Find matching BOM Item
		bom_item = next((item for item in bom_items if item["idx"] == d.idx and item["item_code"] == d.item_code), None)
		logger.info(f"BOM Item idx: {d.idx}")
		if not bom_item:
			# logger.warning(f"No BOM Item found for {d.item_code}")
			continue

		# Determine values for child items
		child_color_from_item = frappe.get_cached_value("Item", d.item_code, "color")
		child_color_from_bom = bom_item.get("color") if bom_item.get("color") not in [None, ""] else None

		final_child_color = None

		# Step 1: Child Color from Item
		if child_color_from_item is not None or child_color_from_item != "":  # Check if it has any value
			final_child_color = child_color_from_item
		
		logger.info(f"Item {d.item_code}, Child Color from Item: {final_child_color}")

		# Step 2: Child Color from BOM
		if final_child_color is None:
			if child_color_from_bom is not None:
				final_child_color = child_color_from_bom
		
		logger.info(f"Item {d.item_code}, Child Color from BOM: {final_child_color}")

		# Step 3: Child Color from Sales Order
		if final_child_color is None:
			if color_from_so is not None:
				final_child_color = color_from_so
		
		logger.info(f"Item {d.item_code}, Child Color from Sales Order: {final_child_color}")

		if final_child_color == "Disabled":
			final_child_color = ""
			
		logger.info(f"Item {d.item_code}, Disabled Child Color: {final_child_color}")

		zone = parent_values_from_po_items.get("zone", None)
		door_hw_spec_code = parent_values_from_po_items.get("door_hw_spec_code", None)
		door_frame_ref = parent_values_from_po_items.get("door_frame_ref", None)

		for field in size_fields_keys:
			if field is None or field == "":
				continue
			bom_value = bom_item.get(field, None)
			parent_value = local_variables.get(field, None)
			formula_value = frappe.db.get_value("Formula Library", bom_value, "formula")
			logger.debug(f"Parent Item: Fetched formula for '{field}' from '{formula_value}'")
			
			if formula_value is not None:
				size_field_values[field] = process_field(field, formula_value, parent_value, conditional_field_values)
			else:
				size_field_values[field] = process_field(field, formula_value, parent_value, conditional_field_values)
			if field == "qty_custom" and size_field_values[field] is not None:
				qty_calculated = size_field_values[field]

		for field in parent_fields:
			bom_value = bom_item.get(field, None)
			parent_value = parent_values_from_po_items.get(field, None)
			if parent_value is not None:
				parent_field_values[field] = parent_value

		# 최종적으로 qty_calculated 값을 stock_qty에 저장
		stock_qty = round_and_convert_to_int(qty_calculated)
		# logger.info(f"Final stock_qty calculated and set to {stock_qty}")

		if not matches_bom_details(bom_item, pbm_filter_fields):
			logger.info(f"Skipping BOM Item {d.item_code} due to PBM Filter mismatch")
			continue

		# child_product_section = d.product_section
		child_size_string = _generate_size_string(parent_product_section, size_field_values)

		# bom_data에 추가
		# logger.info(f"Adding BOM Item {d.item_code} to bom_data")
		bom_data.append(
			frappe._dict(
				{
					"parent_item_code": parent_item_code,
					"description": d.description,
					"item_code": d.item_code,
					"item_name": d.item_name,
					"zone": zone,
					"stock_uom": d.stock_uom,
					"uom": d.stock_uom,
					"bom_no": d.value,
					"is_sub_contracted_item": d.is_sub_contracted_item,
					"indent_level": (indent_level or 0) + 1,
					"stock_qty": stock_qty,
					"door_frame": d.door_frame,
					"door_frame_ref": door_frame_ref,
					**{k: bom_item.get(k) if bom_item.get(k) not in [None, ""] else parent_field_values.get(k, "") for k in parent_fields},
					**{field: round_and_convert_to_int(value) for field, value in size_field_values.items()},  # 계산된 size fields 저장
					"color": final_child_color,
					"size": child_size_string,
					"handle_direct": parent_field_values.get("handle_direct", None),
				}
			)
		)
		# 하위 BOM 호출
		if d.value:
			# current_indent = indent_level if indent_level is not None else 0
			get_sub_assembly_items(
				d.value,
				bom_data,
				stock_qty,
				company,
				warehouse,
				indent_level=indent_level + 1,
				size_fields=size_fields,  # 현재 size_fields 전달
				pbm_filter_fields=pbm_filter_fields
			)
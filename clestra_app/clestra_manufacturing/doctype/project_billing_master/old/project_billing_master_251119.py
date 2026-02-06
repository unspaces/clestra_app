# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
import logging
from collections import defaultdict
import math

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
		"leaf_width", "leaf_height", "open_width", "open_height"
    ]

IMPORTED_VALUES_FROM_SO = [
		"name", "zone", "color", "glass_a", "glass_b", "door_open_type", "door_set_type", "door_frame", "app_country",
		"handle_direct", "hw_options", "sub_contract", "price_study", "keeper", "keeper_glass_a", "keeper_glass_b",
		"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
		"al_extend_strip", "disassembled",
		"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap", "print_hide",
		"is_pair_door", "equal_leaf_w", "door_frame_ref",
		"leaf_item_code", "leaf_act_status", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_material",
		"leaf_b_item_code", "leaf_b_act_status", "leaf_b_thk", "leaf_b_color", "leaf_b_glass_a", "leaf_b_glass_b", "leaf_b_material",
		"door_hw_spec_code", "product_keyword_prefix", "product_keyword_suffix", "is_pair_door", "is_panel_cover"
	]

NO_FILTER_FIELDS = ["color"]

PARENT_FIELDS = [
	"color", "glass_a", "glass_b", "door_open_type", "door_set_type","door_frame", "app_country", 
	"handle_direct", "hw_options", "sub_contract", "price_study", "keeper", "keeper_glass_a", "keeper_glass_b",
	"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
	"disassembled",
	"leaf_item_code", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_material", "leaf_act_status",
	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap",
	"for_pair_door", "equal_leaf_w", "under_cut",
	"qty_prefix", "qty_suffix", "is_panel_cover"
	]

BOM_ITEM_FIELDS = [
	"idx", "item_code", 
	"color", "use_billing_color", "glass_a", "glass_b", "door_open_type", "door_set_type", "door_frame", "app_country",
	"handle_direct", "hw_options", "sub_contract", "price_study", "keeper", "keeper_glass_a", "keeper_glass_b",
	"hinge", "hinge_type", "hinge_num", "hinge_glass_a", "hinge_glass_b",
	"al_extend_strip", "disassembled",
	"leaf_item_code", "leaf_thk", "leaf_color", "leaf_glass_a", "leaf_glass_b", "leaf_material", "leaf_act_status",
	"auto_drop_seal", "astragal", "flush_bolt", "fgd_info", "tape_seal_color", "fix_screw_cap",
	"for_pair_door", "equal_leaf_w", "print_hide", "is_panel_cover", "qty_prefix", "qty_suffix", "use_unit", "show_qty_bracket",
	"qty_prefix", "qty_suffix", "exclude_fields"
	]

CONDITIONAL_FORMULA_FIELDS = ["door_frame", "astragal", "leaf_item_code", "sub_contract"]

class ProjectBillingMaster(Document):
	def before_save(self):
		self.set_reference_id()

	def set_reference_id(self):
		parent_reference = {row.idx: row.name for row in self.po_items}
		for row in self.po_items:
			ref_id = ""
			if row.parent_row_no:
				ref_id = parent_reference.get(cint(row.parent_row_no))
			if row.linked_item_ref and row.linked_item_ref == ref_id:
				continue
			if row.parent_row_no:
				row.linked_item_ref = ref_id

	def get_context(self, context):
		context.json_loads = json.loads # json.loads 함수를 컨텍스트에 추가
		frappe.msgprint("ProjectBillingMaster get_context called") # 디버깅 메시지
		context.another_test_variable = "Hello from ProjectBillingMaster get_context" # 테스트 변수 추가

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
	def get_sub_assembly_items(self, manufacturing_type=None, selected_po_items=None, append_only=False):
		"Fetch sub assembly items and optionally combine them."
		if not append_only:
			self.panel_items = []
			self.door_items = []
			self.detail_bom_items = []
	
		sub_assembly_items_store = []
		sub_assembly_items_pair_store = []
		
		po_items_to_process = self.po_items
		if selected_po_items:
			try:
				selected_names = json.loads(selected_po_items)
				po_items_to_process = [row for row in self.po_items if row.name in selected_names]
			except json.JSONDecodeError:
				frappe.throw(_("Invalid format for selected items."))

		if not po_items_to_process:
			frappe.msgprint(_("No items selected or found to process."))
			return

		for row in po_items_to_process:
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
				"imported_values_from_so": {field: getattr(row, field, None) for field in IMPORTED_VALUES_FROM_SO},
				"finished_item_code": row.item_code,
				"parent_po_idx": row.idx,
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
			# sub_assembly_items_pair_store = self.combine_subassembly_items(sub_assembly_items_pair_store)

		all_item_codes = {row.item_code for row in sub_assembly_items_store if row.item_code}
		item_details_map = {}
		if all_item_codes:
			fields_to_fetch = ["product_section", "product_type", "print_hide"]
			item_details_list = frappe.get_all("Item", filters={"name": ("in", list(all_item_codes))}, fields=["name"] + fields_to_fetch)
			item_details_map = {d.pop('name'): d for d in item_details_list}
		
		last_product_section = None
		last_parent_item_code = None
		last_product_type = None

		start_idx = 1
		parent_row_no = 1	
		child_counter = 1
		if append_only and self.detail_bom_items:
			start_idx = max(d.idx for d in self.detail_bom_items) + 1
			# 상태 연속성을 위한 코드
			last_existing_item = self.detail_bom_items[-1]
			last_parent_item_code = last_existing_item.parent_item_code or last_existing_item.item_code
			last_product_section = last_existing_item.product_section

		for i, row in enumerate(sub_assembly_items_store):
			row.idx = start_idx + i
			item_code = row.get("item_code")
			item_details = item_details_map.get(item_code, {})

			# Assign parent item code logic
			parent_item_code = getattr(row, "parent_item_code", None)
			if not parent_item_code:
				last_parent_item_code = item_code
			
			current_parent_code = parent_item_code or last_parent_item_code

			# Get product_section, inheriting from parent if needed
			product_section_from_map = item_details_map.get(current_parent_code, {}).get("product_section")
			product_section = product_section_from_map or last_product_section
			product_type = item_details.get("product_type") or last_product_type

			if row.indent_level == 0 or (row.indent_level == 1 and product_section == "Leaf"):
				parent_row_no = row.old_idx
				child_counter = 1
			else:
				row.old_idx = f"{parent_row_no}-{child_counter}"
				child_counter += 1
			
			# Update row with fetched and calculated data
			row.product_section = product_section
			row.product_type = product_type
			row.print_hide = item_details.get("print_hide", 0)
			
			last_product_section = product_section
			last_product_type = row.product_type

			# 🔍 Debug 로그 추가
			# logger.info(f"Processing Row: {row.item_code} | Parent: {parent_item_code} | Section: {product_section}")
			# logger.info(f"Attempting to append to detail_bom_items: {row.item_code}, Product Section: {product_section}, Indent: {row.indent_level}")

			try:
				self.append("detail_bom_items", row)
				# logger.info(f"Successfully appended {row.item_code} to detail_bom_items.")
			except Exception as e:
				logger.error(f"Error appending {row.item_code} to detail_bom_items: {e}", exc_info=True)
			

		self.set_default_supplier_for_subcontracting_order()


	@frappe.whitelist()
	def generate_billing(self):
		# Check if the source table exists and has data
		if not self.detail_bom_items:
			frappe.msgprint(_("Please run 'Get Sub Assembly Items' first to populate the Summary Items table."), indicator='warning')
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
		common_fields = ["idx", "old_idx", "indent_level", 
				   "item_code", "item_name", "description", "ref_name", "parent_item_code", "product_type", "product_section", 
				   "qty", "uom", "rate", "amount", "color", "stock_uom", "size",
				   "zone_qty", "zone", "is_panel_cover",]
		size_fields = ["width", "ch", "pw", "ph", "uh", "under_cut", "leaf_width", "leaf_height", "open_width", "open_height"]
		door_specific_fields = ["door_hw_spec_code", "door_set_type", "product_keyword", "door_set_type_keyword", "leaf_width", "leaf_height", "remark", 
						  "handle_direct", "rh_qty", "lhr_qty", "lh_qty", "rhr_qty",
						  "leaf_glass_a", "leaf_glass_b", "leaf_material", "is_pair_door", "hinge", "hinge_type", "hinge_num"]
		panel_specific_fields = ["product_keyword"]
		sub_item_specific_fields = ["abl_a", "abl_b", "print_hide", "print_group", "print_order", "qty_prefix", "qty_suffix", "image_caption", "show_qty_bracket"]

		fields_for_door_cover = list(set(common_fields + size_fields + door_specific_fields))
		fields_for_panel_cover = list(set(common_fields + size_fields + panel_specific_fields))
		fields_for_sub_items = list(set(common_fields + size_fields + door_specific_fields + panel_specific_fields + sub_item_specific_fields))

		aggregated_door_covers = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "rh_qty": 0, "lhr_qty": 0, "lh_qty": 0, "rhr_qty": 0, "zone_qty": defaultdict(lambda: defaultdict(int)) })
		aggregated_panel_covers = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "zone_qty": defaultdict(int) })
		aggregated_sub_items = defaultdict(lambda: {"data": frappe._dict(), "qty": 0, "zone_qty": defaultdict(int) })

		# --- Iterate and Categorize ---
		processed_count = 0
		skipped_for_print_hide = 0 # print_hide로 인해 스킵된 항목 카운트
		skipped_count = 0

		# --- Phase 1: Iterate and Categorize ---
		for row in self.detail_bom_items:
			product_section = getattr(row, "product_section", None)
			is_parent = not row.parent_item_code and row.exclude_from_cover == 0
			is_panel_cover = cint(getattr(row, "is_panel_cover", 0))
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
				combine_key_fields = ["door_hw_spec_code", "product_keyword", "size", "color", "item_code", "item_code_prefix", "under_cut", "leaf_item_code", "leaf_b_item_code"]
				# logger.debug(f"Assigning item {row.item_code} (idx: {row.idx}) to door_cover")
			elif (product_section == "Panel" and is_parent) or is_panel_cover == 1:
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
				item_code_for_check = getattr(row, "item_code", None)
				if item_code_for_check: # Ensure item_code exists before querying
					item_master_print_hide_val = frappe.db.get_value("Item", item_code_for_check, "print_hide")
					
					if cint(item_master_print_hide_val) == 1:
						skipped_for_print_hide += 1
						continue

				# All children (parent_item_code exists) OR non-Door/Panel parents go to sub_items
				target_table_name = "sub_items"
				target_aggregator = aggregated_sub_items
				fields_to_copy = fields_for_sub_items
				combine_key_fields = ["item_code", "color", "size", "abl_a", "abl_b", "depth", "print_hide", "show_qty_bracket", "qty_prefix", "qty_suffix"]
				# logger.debug(f"Assigning item {row.item_code} (idx: {row.idx}) to sub_items")

			# --- Create new row data and append ---
			if target_aggregator is not None:				
				# key_tuple = tuple(cstr(getattr(row, k, "")) for k in combine_key_fields)
				key_parts = []
				for k in combine_key_fields:
					field_value = getattr(row, k, "")
					
					if target_table_name == "sub_items" and k == "size":
						current_size_val = cstr(field_value).strip()
						normalized_size_for_key = current_size_val # 기본값은 원래 size 값

						if "," not in current_size_val and ":" in current_size_val: # 쉼표가 없고, 콜론이 있는 경우 (예: "W:2700")
							parts = current_size_val.split(":", 1)
							if len(parts) == 2:
								prefix = parts[0].strip().upper() + ":" # 대문자로 통일하고 콜론 추가
								numeric_part = parts[1].strip()
								
								# 지정된 prefix이고, 숫자 부분인지 확인
								# 숫자 부분에 소수점이 있을 수도 있으므로 .replace('.', '', 1).isdigit() 사용
								if prefix in ["W:", "CH:", "LW:", "LH:", "PW:", "PH:"] and numeric_part.replace('.', '', 1).isdigit():
									normalized_size_for_key = f"NUMERIC_PART_FOR_KEY:{numeric_part}" 
									# 이렇게 하면 "W:2700" 과 "CH:2700" 모두 "NUMERIC_PART_FOR_KEY:2700" 으로 키가 생성됨
						
						key_parts.append(normalized_size_for_key)
					else:
						key_parts.append(cstr(field_value))
				
				key_tuple = tuple(key_parts)

				if key_tuple not in target_aggregator:
					new_row_data = frappe._dict()
					for field in fields_to_copy:
						if field in ["qty", "rh_qty", "lhr_qty", "lh_qty", "rhr_qty"]: new_row_data[field] = 0
						elif field == "zone_qty": new_row_data[field] = {}
						elif hasattr(row, field):
							new_row_data[field] = getattr(row, field)

					if target_aggregator is aggregated_door_covers:
						item_details = frappe.get_cached_value("Item", row.item_code, ["door_set_type", "door_open_type", "product_keyword"], as_dict=True) or {}
						new_row_data.door_set_type = item_details.get("door_set_type")
						new_row_data.door_open_type = item_details.get("door_open_type")
						new_row_data.product_keyword = item_details.get("product_keyword")

						new_row_data.door_set_type_keyword = "S" if new_row_data.door_set_type == "Single" else ("P" if new_row_data.door_set_type == "Pair" else "")
						new_row_data.remark = f"U.C {row.under_cut}" if row.under_cut else ""

						new_row_data.qty = cint(row.qty) # Ensure qty is int

					elif target_aggregator is aggregated_sub_items:
						item_code = new_row_data.item_code
						product_type = new_row_data.get("product_type")
						door_set_type = new_row_data.get("door_set_type")
						door_open_type = new_row_data.get("door_open_type")

						# Item 마스터에서 기본 정보와 'use_multiple_print_groups' 플래그만 조회합니다.
						# 'multiple_print_groups' 필드는 여기서 조회하지 않습니다.
						item_print_info = frappe.get_value(
							"Item", item_code, 
							["print_group", "print_order", "image_caption", "use_multiple_print_groups"], 
							as_dict=True
						) or {}

						# 1. 기본 print_group/order를 Item 마스터의 값으로 설정
						new_row_data.print_group = item_print_info.get("print_group")
						new_row_data.print_order = item_print_info.get("print_order")
						new_row_data.image_caption = item_print_info.get("image_caption", "")
						new_row_data.indent_level = 0

						# 2. use_multiple_print_groups 플래그 확인 및 조건부 덮어쓰기
						if cint(item_print_info.get("use_multiple_print_groups")) == 1 and product_type:
							
							# frappe.get_all을 사용하여 'tabMultiple Print Group' 자식 테이블을 직접 조회
							child_rows = frappe.get_all(
								"Multiple Print Group",
								filters={
									"parent": item_code, # 부모 문서의 이름 (Item Code)
									"parenttype": "Item",
									"product_type": product_type,
									"door_set_type": door_set_type,
									"door_open_type": door_open_type
								},
								fields=["group_name", "group_order"],
								limit=1 # 첫 번째 일치하는 항목만 필요
							)
							
							if child_rows:
								# 조회된 자식 테이블의 값으로 덮어쓰기
								new_row_data.print_group = child_rows[0].group_name
								new_row_data.print_order = child_rows[0].group_order

					target_aggregator[key_tuple]["data"] = new_row_data
					
				target_aggregator[key_tuple]["qty"] += current_qty

				if target_aggregator is aggregated_door_covers:
					source_row_handle_direct = cstr(getattr(row, "handle_direct", "")).strip()
					if source_row_handle_direct:
						if source_row_handle_direct == "RH":
							target_aggregator[key_tuple]["rh_qty"] += current_qty
						elif source_row_handle_direct == "LH-R": # 값 확인 필요
							target_aggregator[key_tuple]["lhr_qty"] += current_qty
						elif source_row_handle_direct == "LH":
							target_aggregator[key_tuple]["lh_qty"] += current_qty
						elif source_row_handle_direct == "RH-R": # 값 확인 필요
							target_aggregator[key_tuple]["rhr_qty"] += current_qty
					if source_row_handle_direct and current_zone:
						target_aggregator[key_tuple]["zone_qty"][current_zone][source_row_handle_direct] += current_qty
				else:
					if current_zone:
						target_aggregator[key_tuple]["zone_qty"][current_zone] += current_qty
				
		temp_door_cover_list = []
		for key, aggregated_data in aggregated_door_covers.items():
			final_row_data = aggregated_data["data"].copy()
			final_row_data.qty = cint(aggregated_data["qty"])

			final_row_data.rh_qty = cint(aggregated_data["rh_qty"])
			final_row_data.lhr_qty = cint(aggregated_data["lhr_qty"])
			final_row_data.lh_qty = cint(aggregated_data["lh_qty"])
			final_row_data.rhr_qty = cint(aggregated_data["rhr_qty"])

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
			
			if 'idx' in final_row_data:
				# final_row_data['old_idx'] = final_row_data['idx']
				del final_row_data['idx']

			temp_door_cover_list.append(final_row_data)
			processed_count += 1

		def get_door_cover_sort_key(item):
			door_hw_spec_code = cstr(item.get("door_hw_spec_code", ""))
			return (door_hw_spec_code)
		
		sorted_door_covers = sorted(temp_door_cover_list, key=get_door_cover_sort_key)

		for final_door_data in sorted_door_covers:
			self.append("door_cover", final_door_data)
			processed_count += 1

		temp_panel_cover_list = []
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
			# self.append("panel_cover", final_row_data)
			temp_panel_cover_list.append(final_row_data)
			processed_count += 1

		def get_panel_cover_sort_key(item):
			product_keyword = item.get("product_keyword", "") or ""
			idx = cint(item.get("idx", 0))
			size = item.get("size", "") or ""
			color = item.get("color", "") or ""
			qty = cint(item.get("qty", 0))
			# Sort by: product_keyword (asc), numeric_size (asc), original_size_str (asc as tie-breaker), color (asc), qty (asc)
			return (product_keyword, idx, size, color, qty)

		sorted_panel_covers = sorted(temp_panel_cover_list, key=get_panel_cover_sort_key)

		for final_panel_data in sorted_panel_covers:
			if 'idx' in final_panel_data:
			# 	final_panel_data['old_idx'] = final_panel_data['old_idx']
				del final_panel_data['idx']

			self.append("panel_cover", final_panel_data)
			processed_count += 1

		sub_items_final_list = []
		for key, aggregated_data in aggregated_sub_items.items():
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
			sub_items_final_list.append(final_row_data)

		def get_sub_item_sort_key(item):
			product_type = item.get("product_type", "") or ""
			print_group = item.get("print_group", "") or ""
			print_order = item.get("print_order", 0) or 0
			color = item.get("color", "") or ""
			size_str = item.get("size", "") or ""
			item_code = item.get("item_code", "") or ""

			sortable_numeric_size = 0
			if size_str and "," not in size_str: # 쉼표가 없고, 콜론이 있는 경우 (예: "W:2700")
				parts = size_str.split(":", 1)
				if len(parts) == 2:
					try:
						numeric_part = flt(parts[1].strip())
						sortable_numeric_size = -numeric_part
					except ValueError:
						sortable_numeric_size = 0

			return (product_type, print_group, print_order, color, sortable_numeric_size, item_code) # item_code 추가로 안정성 확보

		sorted_sub_items = sorted(sub_items_final_list, key=get_sub_item_sort_key)
		# logger.info("Finished sorting sub_items.")

		# --- Phase 3: Append sorted sub_items to the document ---
		for item_data in sorted_sub_items:
			if 'idx' in item_data:
			# 	item_data['old_idx'] = item_data['idx']
				del item_data['idx']

			self.append("sub_items", item_data)
			processed_count += 1

		# self.save(ignore_permissions=True)
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
	bom_no, bom_data, to_produce_qty, company, warehouse=None, indent_level=0, color=None, size_fields=None, imported_values_from_so=None, finished_item_code=None, parent_po_idx=None):
	fields_from_item = ["product_type", "description", "stock_uom"]
	parent_fields = PARENT_FIELDS
	size_fields_keys = SIZE_FIELDS + ["qty_custom"]
	size_fields = size_fields or {}
	imported_values_from_so = imported_values_from_so or {}
	local_variables = {f: size_fields.get(f, None) for f in size_fields_keys}
	parent_values_from_so = {f: imported_values_from_so.get(f, None) for f in IMPORTED_VALUES_FROM_SO}

	def _evaluate_conditional_color(color_name, context_values):
		"""주어진 색상 이름이 조건부인지 확인하고, 조건에 맞으면 결과를 반환합니다."""
		if not color_name:
			return None, color_name # 처리할 색상 없음

		try:
			# Product Color DocType에서 is_conditional과 formula를 한번에 가져옵니다.
			color_details = frappe.db.get_value("Product Color", color_name, ["is_conditional", "formula"], as_dict=True)
			
			if not color_details or not color_details.is_conditional:
				# 조건부 색상이 아니면 원래 색상 이름을 그대로 반환
				return "not_conditional", color_name

			formula = color_details.formula
			if not formula:
				# 조건부 체크는 되어있으나 수식이 없으면, Enabled로 간주
				return "enabled", color_name

			# 수식 실행을 위한 로컬 변수 준비
			# context_values는 parent_values_from_so가 됩니다.
			exec_locals = context_values.copy()
			exec_locals['doc'] = frappe._dict(context_values)
			
			exec(f"result = None\n{formula.replace('return', 'result =')}", {}, exec_locals)
			result = exec_locals.get("result")

			# frappe.msgprint(f"Color: {color_name}, Formula: {formula}, Result: {result}") # 디버깅용

			if result is None:
				return "disabled", None
			elif str(result).lower() == 'enabled' or result == "":
				return "enabled", color_name
			elif str(result).lower() == 'disabled':
				return "disabled", None
			else:
				# 수식이 특정 색상 이름(예: 'BLACK')을 반환하는 경우
				return "specific_color", result

		except Exception as e:
			frappe.log_error(f"Error evaluating conditional color '{color_name}': {e}", "Color Formula Error")
			return "disabled", None # 오류 발생 시 비활성화

	# Get the parent item details
	parent_item_code = frappe.get_cached_value("BOM", bom_no, "item")
	finished_product_section = frappe.get_cached_value("Item", finished_item_code, "product_section") if finished_item_code else None
	parent_item_info_from_item = frappe.get_cached_value("Item", parent_item_code, ["product_section", "item_group", "product_type", "exclude_from_cover", "product_keyword"], as_dict=True) if parent_item_code else None
	current_product_section = parent_item_info_from_item.get("product_section")
	item_group = parent_item_info_from_item.get("item_group")
	parent_product_type = parent_item_info_from_item.get("product_type")
	parent_exclude_from_cover = parent_item_info_from_item.get("exclude_from_cover", 0)
	parent_product_keyword = parent_item_info_from_item.get("product_keyword")
	# logger.info(f"Parent Item Code: {parent_item_code}, Product Type: {parent_product_type}")

	finished_door_item_code = parent_item_code if indent_level == 0 and current_product_section == "Door" else None
	finished_leaf_item_code = parent_item_code if indent_level == 1 and current_product_section == "Leaf" else None
	
	# logger.info(f"Parent Item Code: {parent_item_code}")
	parent_item_data = frappe.get_cached_value("BOM", bom_no, fields_from_item, as_dict=True)

	parent_data_from_bom_and_so = {}
	for field in parent_fields:		
		bom_value = frappe.db.get_value("BOM", bom_no, field)
		so_value = parent_values_from_so.get(field, None)
		if so_value is not None and so_value != "":
			parent_data_from_bom_and_so[field] = so_value
		elif bom_value is not None and "," not in cstr(bom_value):
			parent_data_from_bom_and_so[field] = bom_value
		else:
			parent_data_from_bom_and_so[field] = ""

	# parent_door_frame = parent_data_from_bom_and_so.get("door_frame",)
	conditional_field_values = {key: parent_data_from_bom_and_so.get(key, None) for key in CONDITIONAL_FORMULA_FIELDS}
	parent_stock_qty = flt(to_produce_qty)

	def _get_final_billing_color_if_needed(color_code, use_billing_color_flag):
		"""
		use_billing_color_flag가 켜져 있으면, color_code에 해당하는
		final_billing_color를 조회하여 반환합니다.
		"""
		if not color_code or not cint(use_billing_color_flag):
			# 플래그가 꺼져 있거나 색상 코드가 없으면 원래 코드를 그대로 반환
			return color_code
		
		# Product Color Doctype에서 final_billing_color 조회
		billing_color = frappe.db.get_value("Product Color", color_code, "billing_color")
		
		# billing_color가 존재하면 그 값을, 없으면 원래 색상 코드를 반환
		return billing_color if billing_color else color_code

	# ▼▼▼▼▼▼▼▼▼▼ final_parent_color 로직 ▼▼▼▼▼▼▼▼▼▼
	parent_color_from_item = frappe.get_cached_value("Item", parent_item_code, "color") if parent_item_code else None
	parent_color_from_bom = frappe.db.get_value("BOM", bom_no, "color")
	color_from_so = parent_values_from_so.get("color", None)

	use_billing_color_flag = parent_values_from_so.get("use_billing_color", 0)
	
	final_parent_color = None

	if parent_color_from_item is not None: # Check if it has any value
		final_parent_color = parent_color_from_item
	else: 
		if parent_color_from_bom is not None and parent_color_from_bom != "":
			status, result_color = _evaluate_conditional_color(parent_color_from_bom, parent_values_from_so)
			if status == "enabled":
				final_parent_color = color_from_so # 조건 만족 시 SO 색상 적용
			elif status == "disabled":
				final_parent_color = "Disabled" # 조건 만족 시 Disabled -> 최종 색상은 None으로 설정
			elif status == "specific_color":
				final_parent_color = result_color # 수식이 반환한 특정 색상 적용
			elif status == "not_conditional":
				final_parent_color = parent_color_from_bom # 조건부 아니면 BOM 색상 그대로 적용
			# status가 'disabled'이거나 None이면 final_parent_color는 None으로 유지됨
	
	if final_parent_color is None:
		if color_from_so is not None or color_from_so != "":
			final_parent_color = color_from_so

	if final_parent_color == "Disabled":
		# logger.info(f"Parent Color's value is Disabled")
		final_parent_color = None

	final_parent_color = _get_final_billing_color_if_needed(final_parent_color, use_billing_color_flag)

	# ▲▲▲▲▲▲▲▲▲▲ final_parent_color 로직 종료 ▲▲▲▲▲▲▲▲▲▲

	zone = parent_values_from_so.get("zone", None)
	is_pair_door = parent_values_from_so.get("is_pair_door", 0)
	ref_name = parent_values_from_so.get("name", None)
	door_hw_spec_code = parent_values_from_so.get("door_hw_spec_code", None)
	# leaf_material = parent_values_from_so.get("leaf_material", None)

	prod_key_prefix = parent_values_from_so.get("product_keyword_prefix", None)
	prod_key_suffix = parent_values_from_so.get("product_keyword_suffix", None)

	parts = []

	if prod_key_prefix:
		parts.append(prod_key_prefix)

	if parent_product_keyword: # parent_product_keyword가 None이나 빈 문자열이 아닌 경우에만 추가
		parts.append(parent_product_keyword)

	if prod_key_suffix:
		parts.append(prod_key_suffix)

	final_product_keyword = " ".join(parts).strip()
	# logger.info(f"Final Product Keyword: {final_product_keyword}")

	def _generate_size_string(product_section, calculated_sizes):
		size_parts = []
		if product_section == "Door":
			w = calculated_sizes.get("width")
			ch = calculated_sizes.get("ch")
			if w is not None and w != 0: size_parts.append(f"W:{w}")
			if ch is not None and ch != 0: size_parts.append(f"CH:{ch}")
		elif product_section == "Leaf":
			lw = calculated_sizes.get("leaf_width")
			lh = calculated_sizes.get("leaf_height")
			if lw is not None and lw != 0: size_parts.append(f"LW:{lw}")
			if lh is not None and lh != 0: size_parts.append(f"LH:{lh}")
		elif product_section == "Panel":
			w = calculated_sizes.get("width")
			ch = calculated_sizes.get("ch")
			pw = calculated_sizes.get("pw") # Panel Width - ensure this exists 
			ph = calculated_sizes.get("ph") # Panel Height
			if w is not None and w != 0: size_parts.append(f"W:{w}")
			if ch is not None and ch != 0: size_parts.append(f"CH:{ch}")
			if pw is not None and pw != 0: size_parts.append(f"PW:{pw}") # Add if available
			if ph is not None and ph != 0: size_parts.append(f"PH:{ph}")
		# Add more sections or a default case if needed
		return ", ".join(size_parts)

	def process_field(field, formula, parent_value, conditional_fields_for_eval):
		"""
		Process a field with the provided formula and parent_value.
		Handles numbers, strings (formulas/conditions), and 'True' values.
		"""

		safe_globals = {
			'math': math,
			'ceil': math.ceil,
			'floor': math.floor,
			'round': round,
			'int': int
		}

		execution_scope = safe_globals.copy()
		execution_scope.update(local_variables)
		execution_scope.update(conditional_fields_for_eval)
		
		try:
			if formula == "Enabled":
				return parent_value
			elif str(formula).strip().lower() == "true":
				return parent_value
			elif isinstance(formula, str):  # 수식 또는 조건식으로 처리
				if "if" in formula: 
					# exec()로 조건식 처리
					# exec_locals = {**local_variables, **conditional_fields_for_eval}
					exec(f"result = None\n{formula.replace('return', 'result =')}", {}, execution_scope)
					return execution_scope.get("result")
				else:
					# evaluated_value = eval(
					# 	formula,
					# 	safe_globals,
					# 	{},  # No global variables
					# 	local_variables,  # 상위 필드 참조
					# )
					return eval(formula, {}, execution_scope)
			else:
				# logger.info(f"{field}: BOM value is a number, set to {formula}")
				return formula
		except Exception as e:
			frappe.log_error(
				message=f"Error evaluating {field}: {str(e)}",
				title="Formula Evaluation Error"
			)
			# logger.error(f"{field}: Error evaluating formula, set to None. BOM value: {formula}, Error: {e}")
			return None

	def round_and_convert_to_int(value, digits=0):
		"""
		Round the value and convert to an integer if it's not None.
		"""
		if value is not None:
			return round(value, digits)
		return None

	# Top-level Parent Item 처리
	if indent_level == 0 or (indent_level == 1 and current_product_section == "Leaf" and item_group == "Finished Product"):
		# logger.info(f"[Parent] Processing parent BOM: {bom_no}, Item: {parent_item_code}")
		try:
			finished_door_item_code = parent_item_code if indent_level == 0 and current_product_section == "Door" else None
			finished_leaf_item_code = parent_item_code if indent_level == 1 and current_product_section == "Leaf" else None
			finished_item_code = parent_item_code
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
				# parent_door_frame = parent_data_from_bom_and_so.get("door_frame", None)
				# parent_astragal = parent_data_from_bom_and_so.get("astragal", None)
				conditional_field_values = {key: parent_data_from_bom_and_so.get(key, None) for key in CONDITIONAL_FORMULA_FIELDS}
				
				formula_value = frappe.db.get_value("Formula Library", formula_library_name, "formula")
				# logger.debug(f"Parent Item: Fetched formula for '{field}' from '{formula_value}'")

				if formula_value is not None:
					calculated_value = process_field(field, formula_value, parent_value, conditional_field_values)
					size_field_values[field] = calculated_value
				else:
					# size_field_values[field] = process_field(field, bom_value, parent_value)
					calculated_value = process_field(field, formula_value, parent_value, conditional_field_values)
					size_field_values[field] = parent_value if calculated_value in [None, ""] else calculated_value
				if field == "qty_custom" and size_field_values[field] is not None:
					qty_calculated = size_field_values[field]

			# logger.info(f"[Parent] Calculations complete. Qty: {qty_calculated}, Sizes: {size_field_values}")

			parent_size_string = _generate_size_string(current_product_section, size_field_values)

			parent_item_dict = frappe._dict(
					{
						"parent_item_code": None,
						"zone": zone,
						"item_code": parent_item_code,
						"item_name": parent_item_code,
						"item_group": item_group,
						"product_type": parent_product_type,
						"product_section": current_product_section,
						"description": parent_item_data.description,
						"stock_uom": parent_item_data.stock_uom,
						"uom": parent_item_data.stock_uom,
						"bom_no": bom_no,
						"is_sub_contracted_item": 0,
						"is_pair_door": is_pair_door,
						"bom_level": indent_level,
						"indent_level": indent_level,
						"stock_qty": math.ceil(qty_calculated),
						"color": final_parent_color,
						"door_hw_spec_code": door_hw_spec_code,
						"ref_name": ref_name,
						**parent_data_from_bom_and_so,
						**size_field_values,  # Add calculated size fields
						"size": parent_size_string,
						"exclude_from_cover": parent_exclude_from_cover,
						"product_keyword": final_product_keyword,
						"old_idx": parent_po_idx
					}
				)

			# logger.info(f"[Parent] Attempting to append parent item: {parent_item_dict}")

			# Append parent item
			bom_data.append(parent_item_dict)
			# logger.info(f"[Parent] Successfully appended parent item for BOM: {bom_no}")
		except Exception as e:
			logger.error(f"[Parent] Error appending parent item for BOM: {bom_no}, Error: {e}", exc_info=True)
			frappe.throw(_("Error appending parent item for BOM: {0}").format(bom_no))

		# Handle special assembly fields for parent item
		sub_items_bom_field = ["hinge", "keeper", "hw_options", "sub_contract", "price_study"]
		multi_value_fields = ["hw_options", "sub_contract"] 

		for field_name in sub_items_bom_field:
			value_from_dict = parent_item_dict.get(field_name)
			# logger.info(f"Checking parent item's {field_name}: {value_from_dict}")

			if not value_from_dict:
				continue

			item_codes_to_process = []
			if field_name in multi_value_fields and isinstance(value_from_dict, str):
				# If it's a multi-value field, split by comma and strip whitespace
				item_codes_to_process = [code.strip() for code in value_from_dict.split(",") if code.strip()]
			else:
				item_codes_to_process.append(value_from_dict)  # 단일 값인 경우 그대로 추가

			for item_code_for_bom in item_codes_to_process:
				sub_assembly_bom_no = frappe.get_cached_value("Item", item_code_for_bom, "default_bom")
				sub_assembly_product_section = frappe.get_cached_value("Item", item_code_for_bom, "product_section")

				if sub_assembly_product_section != current_product_section:
					# logger.info(f"Skipping {field_name} for {item_code_for_bom} as product section does not match: {sub_assembly_product_section} != {current_product_section}")
					continue

				# logger.info(f"Checking sub-assembly's BOM for {field_name}: {item_code_for_bom} (BOM: {sub_assembly_bom_no})")

				if sub_assembly_bom_no:
					# frappe.msgprint(f"하위 BOM 발견: {field_name} - {item_code_for_bom} (BOM: {sub_assembly_bom_no})") # 디버깅용
					# logger.info(f"{field_name}'s BOM found: {item_code_for_bom}( BOM: {sub_assembly_bom_no})") # 디버깅용
					recursive_pbm_filters = imported_values_from_so.copy()

					# Door/Leaf의 door_frame_ref 정보를 전달합니다.
					if current_product_section == "Door":
						recursive_pbm_filters["door_frame"] = parent_item_code
					elif current_product_section == "Leaf":
						recursive_pbm_filters["door_frame"] = parent_item_dict.get("door_frame")

					recursive_pbm_filters["door_open_type"] = parent_item_dict.get("door_open_type", None)
					recursive_pbm_filters["door_set_type"] = parent_item_dict.get("door_set_type", None)
					recursive_pbm_filters["hinge_glass_a"] = parent_item_dict.get("hinge_glass_a", None)
					recursive_pbm_filters["hinge_glass_b"] = parent_item_dict.get("hinge_glass_b", None)
					recursive_pbm_filters["hw_options"] = parent_item_dict.get("hw_options", None)
					recursive_pbm_filters["sub_contract"] = parent_item_dict.get("sub_contract", None)
					recursive_pbm_filters["hinge_num"] = parent_item_dict.get("hinge_num", None)

					# logger.info(f"{item_code_for_bom}'s values - size_fields: {size_fields['width']}, size_field_values: {size_field_values['width']}, local_variables: {local_variables.get('width', None)}, parent_values_from_so: {parent_values_from_so.get('width')}, imported_values_from_so: {recursive_pbm_filters.get('width')}")
					# logger.info(f"{item_code_for_bom}'s values - size_fields: {size_fields['leaf_width']}, size_field_values: {size_field_values['leaf_width']}, local_variables: {local_variables.get('leaf_width', None)}, parent_values_from_so: {parent_values_from_so.get('leaf_width')}, imported_values_from_so: {recursive_pbm_filters.get('leaf_width')}")

					# for field in size_fields_keys:
					# 	size_fields[field] = local_variables.get(field, None)

					get_sub_assembly_items(
						bom_no=sub_assembly_bom_no,
						bom_data=bom_data,  # 같은 bom_data 리스트를 전달하여 아이템을 누적
						to_produce_qty=to_produce_qty,  # 부모 아이템의 계산된 수량을 전달
						company=company,
						warehouse=warehouse,
						indent_level=indent_level + 1,  # 한 단계 더 깊은 레벨로 설정
						size_fields=size_fields,  # 상위의 size_fields를 그대로 전달
						imported_values_from_so=recursive_pbm_filters, # 상위의 필터 필드를 그대로 전달
						finished_item_code=finished_item_code,  # 최상위 완제품 코드를 그대로 전달
					)

	# Get BOM Items
	bom_items = frappe.get_all(
		"BOM Item",
		filters={"parent": bom_no},
		fields=BOM_ITEM_FIELDS + size_fields_keys
	)
	# logger.info(f"BOM Items fetched: {bom_items}")

	import json # Make sure to import json if you are parsing exclude_fields

	def matches_bom_details(bom_item_data, pbm_values_dict):
		# imported_values_from_so should be accessible (e.g., from outer scope or passed in)
		# global imported_values_from_so 

		# --- Load exclude_fields from bom_item_data ---
		# exclude_fields_str might be a JSON string or already a dict.
		# Adjust parsing as needed based on how it's stored.
		exclude_fields_config = {}
		exclude_fields_raw = bom_item_data.get("exclude_fields")
		if isinstance(exclude_fields_raw, str) and exclude_fields_raw.strip():
			try:
				parsed_json = json.loads(exclude_fields_raw)
				if isinstance(parsed_json, dict): # Check if the parsed result is a dictionary
					exclude_fields_config = parsed_json
				else:
					# Parsed JSON was not a dictionary (e.g., it was an int, list, string, bool)
					# Treat this as an invalid format for exclude_fields_config for your logic.
					# logger.warning(
					# 	f"Item {bom_item_data.get('item_code')}: exclude_fields was a JSON string but did not decode to a dictionary. "
					# 	f"Raw: '{exclude_fields_raw}', Parsed: {type(parsed_json)}. Defaulting to no exclusions."
					# )
					exclude_fields_config = {} # Fall back to empty dict
			except json.JSONDecodeError:
				logger.error(
					f"Item {bom_item_data.get('item_code')}: Could not parse exclude_fields JSON string: '{exclude_fields_raw}'. "
					"Defaulting to no exclusions."
				)
				exclude_fields_config = {} # Fall back to empty dict
		elif isinstance(exclude_fields_raw, dict):
			# If it's already a dictionary in bom_item_data, use it directly.
			exclude_fields_config = exclude_fields_raw
		# If exclude_fields_raw is None, or an empty string, or some other type not handled above (e.g. int, list directly)
		# exclude_fields_config will remain its initialized value of {} (empty dict). This is safe.
		# You might want to log a warning if it's an unexpected type:
		elif exclude_fields_raw is not None: # It's not None, not a string, not a dict
			logger.warning(
				f"Item {bom_item_data.get('item_code')}: exclude_fields has an unexpected type: {type(exclude_fields_raw)}. "
				"Raw Value: '{exclude_fields_raw}'. Defaulting to no exclusions."
			)
			exclude_fields_config = {} # Fall back to empty dict

		for field_key in imported_values_from_so:
			if field_key in NO_FILTER_FIELDS:
				continue

			pbm_value_orig = pbm_values_dict.get(field_key)
			item_value_orig = bom_item_data.get(field_key)

			# 1. Standard Skip: If PBM has no filter for this field, it doesn't restrict.
			if pbm_value_orig is None or (isinstance(pbm_value_orig, str) and pbm_value_orig.strip() == ""):
				# logger.debug(f"Match Info: Item: {bom_item_data.get('item_code')}, Field: {field_key}, PBM Value is empty/None. This filter field imposes no restriction.")
				continue

			# 2. Prepare sets from PBM and Item values
			pbm_set = set()
			if isinstance(pbm_value_orig, str):
				pbm_set = {v.strip() for v in pbm_value_orig.split(',') if v.strip()}
			elif pbm_value_orig is not None:
				pbm_set = {str(pbm_value_orig).strip()}
			
			if not pbm_set: # PBM filter became empty after processing (e.g., was ",,")
				# logger.debug(f"Match Info: Item: {bom_item_data.get('item_code')}, Field: {field_key}, PBM Value ('{pbm_value_orig}') processed to empty set. This filter field imposes no restriction.")
				continue

			item_set = set()
			if isinstance(item_value_orig, str):
				item_set = {v.strip() for v in item_value_orig.split(',') if v.strip()}
			elif item_value_orig is not None:
				item_set = {str(item_value_orig).strip()}

			# 3. Determine if this field_key is an exclusion field
			is_exclusion_field = bool(exclude_fields_config.get(field_key)) # True if field_key in dict and value is truthy

			# 4. Perform the match based on the sets and exclusion status
			match_for_this_field = False

			if is_exclusion_field:
				# logger.debug(f"  -> Field {field_key}: Is an EXCLUSION field.")
				# EXCLUSION LOGIC: Match if values are DIFFERENT. No match if values are THE SAME.
				# "Same" means intersection or both are empty. "Different" means no intersection or one empty & other not.

				if not item_set and not pbm_set: # Both are empty
					match_for_this_field = False # Same (both empty) -> NO MATCH for exclusion
					# logger.debug(f"     Exclusion: Both Item Set and PBM Set are empty. No Match.")
				elif not item_set and pbm_set: # Item empty, PBM has value
					match_for_this_field = True # Different -> MATCH for exclusion
					# logger.debug(f"     Exclusion: Item Set empty, PBM Set {pbm_set}. Match.")
				elif item_set and not pbm_set: # Item has value, PBM empty (should be caught earlier, but for completeness)
					match_for_this_field = True # Different -> MATCH for exclusion
					# logger.debug(f"     Exclusion: Item Set {item_set}, PBM Set empty. Match.")
				elif bool(pbm_set & item_set): # Both have values and they INTERSECT
					match_for_this_field = False # Same (intersect) -> NO MATCH for exclusion
					# logger.debug(f"     Exclusion: PBM Set {pbm_set}, Item Set {item_set}. Intersection: {pbm_set & item_set}. No Match.")
				else: # Both have values but NO INTERSECTION
					match_for_this_field = True # Different -> MATCH for exclusion
					# logger.debug(f"     Exclusion: PBM Set {pbm_set}, Item Set {item_set}. No Intersection. Match.")
			else:
				# NORMAL (INCLUSION) LOGIC
				# logger.debug(f"  -> Field {field_key}: Is a NORMAL field.")
				if not item_set: # Item has NO value (empty set)
					match_for_this_field = True # Passes the filter (item doesn't conflict)
					# logger.debug(f"     Normal: Item Set empty, PBM Set {pbm_set}. Match (no conflict).")
				elif bool(pbm_set & item_set): # Item has value, PBM has value, and they intersect
					match_for_this_field = True
					# logger.debug(f"     Normal: PBM Set {pbm_set}, Item Set {item_set}. Intersection: {pbm_set & item_set}. Match.")
				# else: # Item has value, PBM has value, but no intersection
					# match_for_this_field remains False
					# logger.debug(f"     Normal: PBM Set {pbm_set}, Item Set {item_set}. No Intersection. No Match.")


			if not match_for_this_field:
				# logger.info(
				# 	f"NO MATCH: Item: {bom_item_data.get('item_code')}, Field: {field_key} ({'EXCLUSION' if is_exclusion_field else 'NORMAL'}), "
				# 	f"ItemVal (Raw): '{item_value_orig}' (Set: {item_set}), "
				# 	f"PBMVal (Raw): '{pbm_value_orig}' (Set: {pbm_set}) "
				# 	f"-> Overall item does not match due to this field."
				# )
				return False

		# logger.info(f"ALL FILTERS PROCESSED AND ITEM MATCHED: Item: {bom_item_data.get('item_code')} for PBM filters -> Returning True.")
		return True

	# Match BOM Items with get_bom_children data
	data = get_bom_children(parent=bom_no)
	for d in data:
		stock_qty = d.stock_qty * flt(to_produce_qty)
		local_variables["qty"] = stock_qty
		# logger.info(f"Updated local_variables with qty: {local_variables}")

		size_field_values = {}
		parent_field_values = {}
		qty_calculated = stock_qty  # 기본값으로 stock_qty

		# Find matching BOM Item
		bom_item = next((item for item in bom_items if item["idx"] == d.idx and item["item_code"] == d.item_code), None)
		# logger.info(f"BOM Item idx: {d.idx}")
		if not bom_item:
			# logger.warning(f"No BOM Item found for {d.item_code}")
			continue

		# ▼▼▼▼▼▼▼▼▼▼ final_child_color 로직 ▼▼▼▼▼▼▼▼▼▼
		child_color_from_item = frappe.get_cached_value("Item", d.item_code, "color")
		child_color_from_bom = bom_item.get("color") if bom_item.get("color") not in [None, ""] else None
		use_billing_color_flag = cint(bom_item.get("use_billing_color"))
		color_from_so = parent_values_from_so.get("color", None)

		# logger.info(f"Item {d.item_code}, Child Color from BOM: {child_color_from_bom}, Child Color from Item: {child_color_from_item}")
		# logger.info(f"Parent Values.hw_options: {parent_values_from_so.get('hw_options')}")

		final_child_color = None

		# Step 1: Child Color from Item
		if child_color_from_item is not None and child_color_from_item != "":  # Check if it has any value
			final_child_color = child_color_from_item
		else:
			if child_color_from_bom is not None:
				status, result_color = _evaluate_conditional_color(child_color_from_bom, parent_values_from_so)
				if status == "enabled":
					final_child_color = color_from_so # 조건 만족 시 SO 색상 적용
				if status == "disabled":
					final_child_color = "Disabled" # 조건 만족 시 Disabled -> 최종 색상은 None으로 설정
				elif status == "specific_color":
					final_child_color = result_color # 수식이 반환한 특정 색상 적용
				elif status == "not_conditional":
					final_child_color = child_color_from_bom
		
		# Step 3: Child Color from Sales Order
		if final_child_color is None:
			if color_from_so is not None:
				final_child_color = color_from_so

		# if d.item_code in ["PVCBLOCK-4T", "PVCBLOCK-1T"]:
			# logger.info(f"Item {d.item_code}, Final Child Color: {final_child_color}, Child Color from Item: {child_color_from_item}, Child Color from BOM: {child_color_from_bom}, Color from SO: {color_from_so}")

		if final_child_color == "Disabled":
			final_child_color = ""

		final_child_color = _get_final_billing_color_if_needed(final_child_color, use_billing_color_flag)
			
		# ▲▲▲▲▲▲▲▲▲▲ final_child_color 로직 종료 ▲▲▲▲▲▲▲▲▲▲

		zone = parent_values_from_so.get("zone", None)
		door_hw_spec_code = parent_values_from_so.get("door_hw_spec_code", None)
		# door_frame_ref = parent_values_from_so.get("linked_item_ref", None)
		current_product_section = parent_values_from_so.get("product_section", None)
		# door_frame = finished_item_code if current_product_section == "Door" else None

		for field in size_fields_keys:
			if field is None or field == "":
				continue
			bom_value = bom_item.get(field, None)
			parent_value = local_variables.get(field, None)
			formula_value = frappe.db.get_value("Formula Library", bom_value, "formula")
			# logger.debug(f"Parent Item: Fetched formula for '{field}' from '{formula_value}'")
			
			if formula_value is not None:
				size_field_values[field] = process_field(field, formula_value, parent_value, conditional_field_values)
			else:
				size_field_values[field] = process_field(field, formula_value, parent_value, conditional_field_values)
			if field == "qty_custom" and size_field_values[field] is not None:
				qty_calculated = size_field_values[field]
			# if d.item_code == "MP-SCREW-HW-M4X12" and field == "qty_custom":
				# logger.info(f"Checking formula for {d.item_code}. Qty Custom: {size_field_values[field]}, Parent Value: {parent_value}, Formula Value: {formula_value}")
				# logger.info(f"Leaf Width: Parent Value is {parent_value}, Parent Width:{local_variables.get('width', None)} and {d.item_code}'s value is set to {size_field_values[field]} from size_field_values and formula_value: {formula_value}")

		final_item_data = {}

		for field in parent_fields:
			bom_item_value = bom_item.get(field)
			so_value = parent_values_from_so.get(field, None)

			if so_value is not None and so_value != "":
				final_item_data[field] = so_value
			elif bom_item_value is not None and "," not in cstr(bom_item_value):
				final_item_data[field] = bom_item_value
			else:
				final_item_data[field] = ""

		# 최상위 부모 필드값 적용
		final_item_data["door_set_type"] = parent_data_from_bom_and_so.get("door_set_type", None)
		final_item_data["door_open_type"] = parent_data_from_bom_and_so.get("door_open_type", None)

		# 최종적으로 qty_calculated 값을 stock_qty에 저장
		stock_qty = math.ceil(qty_calculated)
		# logger.info(f"Final stock_qty calculated and set to {stock_qty}")

		if not matches_bom_details(bom_item, imported_values_from_so):
			# logger.info(f"Skipping BOM Item {d.item_code} due to PBM Filter mismatch")
			continue

		# child_product_section = d.product_section
		child_size_string = _generate_size_string(finished_product_section, size_field_values)
		# logger.info(f"Child Size String for {d.item_code}, parent_product_section: {finished_product_section}: {size_field_values}, Result: {child_size_string}")

		# bom_data에 추가
		# logger.info(f"Adding BOM Item {d.item_code} to bom_data")
		bom_data.append(
			frappe._dict(
				{
					"parent_item_code": parent_item_code,
					"description": d.description,
					"finished_item_code": finished_item_code,
					"item_code": d.item_code,
					"item_name": d.item_name,
					"item_group": d.item_group,
					"zone": zone,
					"stock_uom": d.stock_uom,
					"uom": d.stock_uom,
					"bom_no": d.value,
					"is_sub_contracted_item": d.is_sub_contracted_item,
					"indent_level": (indent_level or 0) + 1,
					"stock_qty": stock_qty,
					"door_frame_ref": finished_door_item_code,
					**final_item_data,
					**{field: round_and_convert_to_int(value, 1) for field, value in size_field_values.items()},  # 계산된 size fields 저장
					"door_frame": finished_item_code,
					"color": final_child_color,
					"size": child_size_string,
				}
			)
		)

		# logger.info(f"Successfully added BOM Item {d.item_code} to bom_data {bom_data[-1]}")

		# 하위 BOM 호출
		if d.value:
			# current_indent = indent_level if indent_level is not None else 0
			get_sub_assembly_items(
				d.value,
				bom_data,
				to_produce_qty,
				company,
				warehouse,
				indent_level=indent_level + 1,
				size_fields=size_fields,  # 현재 size_fields 전달
				imported_values_from_so=imported_values_from_so,
				finished_item_code=finished_item_code
			)
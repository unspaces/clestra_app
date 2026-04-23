# Copyright (c) 2025, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from collections import defaultdict
from frappe.utils import nowdate, cint, flt, cstr
import json

class ClestraSalesOrder(Document):
    def before_save(self):
        # 저장 전 계층 구조 및 idx 재정렬 실행
        # self.reorder_items_hierarchically()
        
        self.set_reference_id()
        self.calculate_totals()
        # --- 환율 자동 업데이트 로직 ---
        self.update_exchange_rate()
        self.update_parent_options()

    def validate(self):
        self.correct_parent_row_numbers()

    def correct_parent_row_numbers(self):
        """
        finished_items의 현재 idx를 기준으로 map을 생성하고,
        fg_reference_id(부모 이름)를 이용해 parent_row_no를 동기화합니다.
        """
        if not self.get("finished_items"):
            return

        # 1. 현재 idx 기준 매핑 생성 { "아이템이름": idx }
        # Frappe는 validate 실행 전 리스트 순서대로 idx를 이미 할당합니다.
        name_to_idx_map = {row.name: row.idx for row in self.finished_items if row.name}

        # 2. parent_row_no 보정
        for row in self.finished_items:
            # 자식 아이템인 경우 (참조 ID가 있는 경우)
            if row.fg_reference_id:
                # 참조하는 부모의 현재 idx를 찾음
                actual_parent_idx = name_to_idx_map.get(row.fg_reference_id)
                
                # 부모가 존재하면 업데이트 (부모를 찾지 못하면 기존 값 유지)
                if actual_parent_idx and cint(row.parent_row_no) != actual_parent_idx:
                    row.parent_row_no = actual_parent_idx
            
            # 부모 아이템인 경우 (참조 ID가 없는 경우)
            else:
                if cint(row.parent_row_no) != 0:
                    row.parent_row_no = 0

    def update_parent_options(self):
        """
        자식 아이템(Option, Sub Contract, Price Study)의 item_code를 
        부모 아이템(Door, Leaf)의 해당 필드에 쉼표로 구분하여 저장합니다.
        """
        if not self.get("finished_items"):
            return

        # 1. 부모별 자식 아이템 수집을 위한 딕셔너리
        # 구조: { "부모_name": { "Option": set(), "Sub Contract": set(), "Price Study": set() } }
        parent_group_options = defaultdict(lambda: {
            "Option": set(), 
            "Sub Contract": set(), 
            "Price Study": set()
        })

        # finished_items를 순회하며 자식 데이터 수집
        for row in self.finished_items:
            # 대상 섹션인지 확인
            if row.indent_level > 0 and row.product_section in ["Option", "Sub Contract", "Price Study"]:
                # 부모 참조 ID가 있는 경우
                if row.fg_reference_id:
                    parent_group_options[row.fg_reference_id][row.product_section].add(row.item_code)

        # 2. 업데이트 실행
        for row in self.finished_items:
            target_data = None
            
            # Case A: 최상위 부모 (Door)
            if cint(row.indent_level) == 0 and row.name in parent_group_options:
                target_data = parent_group_options[row.name]
            
            # Case B: Leaf 아이템 (중간 부모 역할)
            # Leaf는 자신의 fg_reference_id(최상위 부모)의 데이터를 가져다 씁니다.
            elif row.product_section == "Leaf" and row.fg_reference_id in parent_group_options:
                target_data = parent_group_options[row.fg_reference_id]

            # 데이터 적용
            if target_data:
                row.hw_options = ", ".join(sorted(list(target_data["Option"]))) if target_data["Option"] else None
                row.sub_contract = ", ".join(sorted(list(target_data["Sub Contract"]))) if target_data["Sub Contract"] else None
                row.price_study = ", ".join(sorted(list(target_data["Price Study"]))) if target_data["Price Study"] else None

    # def reorder_items_hierarchically(self):
    #     """
    #     finished_items의 아이템들을 부모-자식 계층 구조에 따라 재정렬하고,
    #     idx 및 parent_row_no를 업데이트합니다.
    #     """
    #     if not self.finished_items:
    #         return

    #     items = self.finished_items
    #     item_map = {item.name: item for item in items}
    #     children_map = defaultdict(list)
    #     top_level_items = []

    #     # --- 단계 1: 트리 구조 구축 ---
    #     for item in items:
    #         parent_ref_id = item.fg_reference_id
            
    #         # fg_reference_id가 없거나, 자기 자신을 가리키거나(오류 방지), 존재하지 않는 부모라면 최상위로 간주
    #         if not parent_ref_id or parent_ref_id not in item_map:
    #             top_level_items.append(item)
    #         else:
    #             children_map[parent_ref_id].append(item)

    #     # --- 단계 2: 깊이 우선 탐색(DFS)으로 정렬 리스트 생성 ---
    #     ordered_items = []

    #     def dfs_traverse(item_list):
    #         # 형제 노드 간에는 원래의 idx 순서를 유지하여 정렬 (사용자가 지정한 순서 존중)
    #         item_list.sort(key=lambda x: x.idx)
            
    #         for item in item_list:
    #             ordered_items.append(item)
    #             if item.name in children_map:
    #                 dfs_traverse(children_map[item.name])

    #     # 최상위 아이템 정렬 및 탐색 시작
    #     top_level_items.sort(key=lambda x: x.idx)
    #     dfs_traverse(top_level_items)

    #     # --- 단계 3: 리스트 교체 및 번호 다시 매기기 ---
    #     self.finished_items = ordered_items
        
    #     # idx 재할당 및 parent_row_no 업데이트
    #     name_to_new_idx = {}
        
    #     # 3-1. idx 재할당
    #     for idx, item in enumerate(self.finished_items):
    #         item.idx = idx + 1
    #         name_to_new_idx[item.name] = item.idx
            
        # 3-2. parent_row_no 업데이트
        # for item in self.finished_items:
        #     if item.fg_reference_id and item.fg_reference_id in name_to_new_idx:
        #         item.parent_row_no = name_to_new_idx[item.fg_reference_id]
        #     else:
        #         item.parent_row_no = None # 0 대신 None 또는 비워둠
    
    def calculate_totals(self):
        zone_totals = defaultdict(lambda: {
            "lm": 0.0, 
            "square_m": 0.0, 
            "colors": set(), 
            "ch_set": set(),
            "ph_set": set(),
            "detail_colors": {}, 
            "clch_type": None, 
            "ceiling_visible": 0, 
            "base_type": None, 
            "base_visible_h": 0
            })

        grand_total_lm = 0.0
        grand_total_square_m = 0.0

        color_fields = [
            'color_frame', 'color_transom', 'color_leaf', 'color_lipseal', 
            'color_panel', 'color_clch', 'color_base', 'color_junction'
        ]

        cl_base_fields = [
            'clch_type', 'ceiling_visible', 'base_type', 'base_visible_h'
        ]

        if not self.get("finished_items"):
            # self.set("zone_summary", []) # 아이템이 없으면 요약 테이블도 비웁니다.
            # self.grand_total_lm = 0
            # self.grand_total_square_m = 0
            return

        # [수정됨] 자식 테이블의 모든 행을 순회하며 서버에서 직접 계산합니다.
        for row in self.get("finished_items"):
            # --- 서버 측에서 최종 계산 수행 ---
            lm = 0
            square_m = 0
            qty = float(row.planned_qty) if row.planned_qty is not None else 1
            
            # lm 계산: item_code와 width만 필요
            if row.item_code and row.width:
                include_lm = frappe.db.get_value("Item", row.item_code, "include_lm")
                if include_lm:
                    lm = (float(row.width) / 1000) * qty
                    
                    # square_m 계산: height도 필요
                    if row.height:
                        square_m = ((float(row.width) * float(row.height)) / 1000000) * qty
            
            row.lm = lm
            row.square_m = square_m

            grand_total_lm += lm
            grand_total_square_m += square_m

            if row.zone_name:
                zone_totals[row.zone_name]["lm"] += lm
                zone_totals[row.zone_name]["square_m"] += square_m
                if row.color:
                    zone_totals[row.zone_name]["colors"].add(row.color)
                if row.ch:
                    # 소수점 .0 제거 등 포맷팅이 필요하면 여기서 처리 (예: cstr(flt(row.ch)))
                    zone_totals[row.zone_name]["ch_set"].add(cstr(row.ch))
                if row.ph:
                    zone_totals[row.zone_name]["ph_set"].add(cstr(row.ph))

                if cint(row.indent_level) == 0 and not zone_totals[row.zone_name]["detail_colors"]:
                    for field in color_fields:
                        # finished_items의 값을 가져옴
                        val = row.get(field)
                        # zone_summary 필드명 (zone_ 접두사)에 매핑
                        zone_totals[row.zone_name]["detail_colors"][f"zone_{field}"] = val

                    for field in cl_base_fields:
                        val = row.get(field)
                        zone_totals[row.zone_name][field] = val
            
        # Zone doctype에 직접 업데이트
        for zone_name, totals in zone_totals.items():
            if frappe.db.exists("Zone", zone_name):
                update_vals = {
                    "lm": totals["lm"],
                    "square_m": totals["square_m"],
                    "zone_overall_color": ", ".join(sorted(list(totals["colors"]))),
                    "ch": ", ".join(sorted(list(totals["ch_set"]))),
                    "ph": ", ".join(sorted(list(totals["ph_set"]))),
                }
                update_vals.update(totals["detail_colors"])
                for field in cl_base_fields:
                    val = totals[field]
                    if field in ('ceiling_visible', 'base_visible_h') and val is None:
                        val = 0
                    update_vals[field] = val

                frappe.db.set_value("Zone", zone_name, update_vals, update_modified=False)

        self.grand_total_lm = grand_total_lm
        self.grand_total_square_m = grand_total_square_m

        # Zone doctype에 lm/square_m 동기화
        for zone_name, totals in zone_totals.items():
            if frappe.db.exists("Zone", zone_name):
                frappe.db.set_value("Zone", zone_name, {
                    "lm": totals["lm"],
                    "square_m": totals["square_m"]
                }, update_modified=False)

    def set_reference_id(self):
        parent_name = {row.idx: row.name for row in self.finished_items}
        for row in self.finished_items:
            ref_id = ""
            if row.parent_row_no:
                ref_id = parent_name.get(cint(row.parent_row_no))

            # Check whether the reference id of the FG Item has correct or not
            if row.fg_reference_id and row.fg_reference_id == ref_id:
                continue

            if row.parent_row_no:
                row.fg_reference_id = ref_id
            # elif row.fg_item == self.item_code:
                # row.fg_reference_id = self.name

    def get_print_computation_data(self):
        doc_dict = self.as_dict()
        return get_computation_data(doc_dict)
    
    def get_print_codes_sum_data(self, view_type="zone"):
        doc_dict = self.as_dict()
        return get_codes_sum_data(doc_dict, view_type)
    
    def get_print_hw_spec_summary(self):
        doc_dict = self.as_dict()
        return get_hw_spec_summary(doc_dict)
    

    def update_exchange_rate(self):
        """
        문서의 상태에 따라 환율을 자동으로 업데이트하고, 'Approved' 상태가 되면 기준일을 설정하여 고정합니다.
        """
        # --- 1. 사전 조건 확인 ---
        
        # 조건 1: 두 통화가 동일하면 환율을 1로 설정하고 종료
        if self.factory_currency == self.local_currency:
            self.exchange_rate = 1
            self.exchange_rate_date = None
            return

        # 조건 2: 이미 환율이 고정되었다면 (Approved 상태이고 기준일이 이미 설정됨) 아무것도 하지 않고 종료
        if self.workflow_state == "Approved" and self.exchange_rate_date:
            return

        # --- 2. 최신 환율 조회 (환율이 고정되지 않은 모든 경우에 실행) ---
        
        latest_exchange_rate = frappe.db.get_value(
            "Currency Exchange",
            filters={
                "from_currency": self.factory_currency,
                "to_currency": self.local_currency,
                "date": ("<=", nowdate())
            },
            fieldname="exchange_rate",
            order_by="date desc"
        )

        if latest_exchange_rate:
            self.exchange_rate = flt(latest_exchange_rate)
        else:
            self.exchange_rate = 1
            frappe.msgprint(
                _("Could not find a valid exchange rate for {0} to {1}. Please check Currency Exchange records.").format(
                    self.factory_currency, self.local_currency
                ),
                indicator='orange', title='Warning'
            )

        # --- 3. 상태에 따른 기준일(exchange_rate_date) 설정 ---

        if self.workflow_state == "Approved":
            # "Approved" 상태로 저장되는 시점이면, 기준일자를 오늘 날짜로 설정하여 환율을 고정합니다.
            self.exchange_rate_date = nowdate()
            
            # (선택 사항) 사용자에게 환율이 고정되었음을 알리는 메시지
            # get_doc_before_save()는 저장 전 문서 상태를 가져와, 상태가 'Approved'로 "변경"될 때만 메시지를 띄웁니다.
            original_doc = self.get_doc_before_save()
            if not original_doc or original_doc.workflow_state != "Approved":
                frappe.msgprint(f"Exchange rate has been fixed to {self.exchange_rate} as of {self.exchange_rate_date}.")
        else:
            # "Approved" 상태가 아니면 (Draft 등), 기준일자를 항상 비워둡니다.
            self.exchange_rate_date = None
    

@frappe.whitelist()
def duplicate_sales_order(original_sales_order_name, new_project_name):
    """
    원본 Sales Order에 연결된 Zone 및 Door Hardware Spec을 복제하고
    새로운 Project에 연결합니다.
    """
    if not original_sales_order_name or not new_project_name:
        frappe.throw("Original Sales Order and New Project are required.")

    original_so = frappe.get_doc("Clestra Sales Order", original_sales_order_name)
    
    zone_map = {}
    spec_map = {}
    errors = []

    # --- 1. 연결된 Zone 복제 ---
    unique_zones = list(set(d.zone_name for d in original_so.finished_items if d.zone_name))
    
    for original_zone_name in unique_zones:
        try:
            # 1-1. 원본 문서를 가져옵니다.
            original_zone_doc = frappe.get_doc("Zone", original_zone_name)
            
            # 1-2. frappe.copy_doc()를 사용하여 복사본을 만듭니다.
            #      이 함수는 문서를 메모리에 생성하고 바로 DB에 저장까지 합니다.
            new_zone = frappe.copy_doc(original_zone_doc)
            
            # 1-3. 필요한 필드의 값을 변경합니다.
            new_zone.project = new_project_name
            
            # 1-4. 변경된 내용을 저장합니다.
            new_zone.save(ignore_permissions=True)
            
            # 1-5. 맵에 기록합니다.
            zone_map[original_zone_name] = new_zone.name
            
        except Exception as e:
            error_msg = f"Failed to duplicate Zone '{original_zone_name}': {e}"
            errors.append(error_msg)
            frappe.log_error(error_msg, "Sales Order Duplication")

    # --- 2. 연결된 Door Hardware Spec 복제 ---
    unique_specs = list(set(d.door_hw_spec for d in original_so.finished_items if d.door_hw_spec))

    for original_spec_name in unique_specs:
        try:
            original_spec_doc = frappe.get_doc("Door Hardware Spec", original_spec_name)
            new_spec = frappe.copy_doc(original_spec_doc)
            
            new_spec.project = new_project_name
            
            new_spec.save(ignore_permissions=True)
            spec_map[original_spec_name] = new_spec.name
            
        except Exception as e:
            error_msg = f"Failed to duplicate Spec '{original_spec_name}': {e}"
            errors.append(error_msg)
            frappe.log_error(error_msg, "Sales Order Duplication")

    # --- 3. 에러 처리 및 반환 ---
    if errors:
        frappe.msgprint(
            title="Duplication Warning",
            message="Some items could not be duplicated:<br>" + "<br>".join(errors),
            indicator='orange'
        )

    return {
        "zone_map": zone_map,
        "spec_map": spec_map,
    }


@frappe.whitelist()
def calculate_and_get_row_values(item_code, height, width, qty):
    """
    주어진 값으로 lm과 square_m을 계산하여 반환합니다.
    이 함수는 클라이언트의 실시간 피드백을 위해 사용됩니다.
    
    lm 계산: item_code, width, qty만 필요
    square_m 계산: item_code, height, width, qty 모두 필요
    """
    # lm 계산을 위한 최소 필수 값 확인
    if not item_code or not width:
        return {"lm": 0, "square_m": 0}

    try:
        # include_lm 값을 데이터베이스에서 직접 가져옵니다.
        include_lm = frappe.db.get_value("Item", item_code, "include_lm")
        
        if include_lm:
            # lm 계산 (width와 qty만 필요)
            lm = (float(width) / 1000) * float(qty) if qty else 0
            
            # square_m 계산 (height도 필요)
            if height:
                square_m = ((float(width) * float(height)) / 1000000) * float(qty) if qty else 0
            else:
                square_m = 0
                
            return {"lm": lm, "square_m": square_m}
        else:
            return {"lm": 0, "square_m": 0}
            
    except Exception as e:
        frappe.log_error(f"Calculation failed: {e}", "Row Value Calculation")
        return {"lm": 0, "square_m": 0}


@frappe.whitelist()
def search_item_by_name(txt, product_type=None, product_section=None, company=None):
    if not txt:
        return []

    # 기본 필터 목록을 리스트 형태로 시작합니다.
    filters = [
        ['disabled', '=', 0],
        ['has_variants', '=', 0],
    ]

    # set_warehouse → company 필터 (Clestra Korea / Taicang Factory 분리)
    if company:
        filters.append(['company', '=', company])

    # [핵심 수정] 검색어를 공백으로 분리하여 각각 'AND' 조건으로 추가합니다.
    search_terms = txt.split()
    for term in search_terms:
        filters.append(['item_name', 'like', f'%{term}%'])

    # 1. product_section 값에 따라 분기합니다.
    if product_section:
        sub_item_group = ["Option", "Price Study", "Sub Contract"]

        if product_section in sub_item_group:
            filters.append(['item_group', '=', product_section])
        else:
            filters.append(['product_section', '=', product_section])
            if product_type:
                filters.append(['product_type', '=', product_type])
    # product_section이 없으면 product_type 필터도 적용하지 않음 → Option/Price Study/Sub Contract 등 모든 section 아이템이 검색됨

    items = frappe.get_list(
        'Item',
        filters=filters,
        fields=['name', 'item_name', 'item_code', 'product_section', 'item_group'],
        limit=20
    )

    sub_item_groups = {"Option", "Price Study", "Sub Contract"}

    # Link(item_code) 필드가 Item.name을 기대하므로 value에 name을 반환.
    # label은 item_name 우선, 비어있으면 item_code fallback.
    # product_section: Item.product_section 우선, 비어있고 item_group이 Option/Price Study/Sub Contract이면 해당 값 반환.
    result = []
    for item in items:
        effective_section = item.product_section
        if not effective_section and item.item_group in sub_item_groups:
            effective_section = item.item_group
        result.append({
            'label': (item.item_name or item.item_code),
            'value': item.name,
            'product_section': effective_section or '',
        })
    return result


@frappe.whitelist()
def get_calculated_price(item_code, product_section, height=None, width=None, qty=None):
    """
    주어진 조건에 따라 가격(calc_price)과 단위(calc_price_unit)를 계산하여 반환합니다.
    """
    # 필수 입력값 item_code가 없으면 즉시 종료
    if not item_code:
        return {"price": 0, "unit": None}

    try:
        # Item Doctype에서 필요한 모든 정보를 한 번에 가져옵니다.
        item_doc = frappe.get_value(
            "Item", 
            item_code, 
            ["vp_rate", "standard_rate", "include_lm"], 
            as_dict=True
        )
        if not item_doc:
            return {"price": 0, "unit": None} # 아이템이 없으면 종료

        target_price = 0
        target_unit = None
        use_vp = None

        # 조건 1: product_section이 ["Door", "Leaf", "Panel"]에 포함되는 경우
        if product_section in ["Door", "Leaf", "Panel"]:

            # VP Management 문서를 찾습니다.
            vp_doc_name = frappe.db.get_value("VP Management", {"product_name": item_code})
            if vp_doc_name:
                vp_doc = frappe.get_doc("VP Management", vp_doc_name)
                vp_table = vp_doc.get("vp_table")

                if vp_table:
                    dimension_rule = vp_table[0].dimension_rule

                    if dimension_rule == "NONE":
                        target_price = vp_table[0].vp
                        use_vp = True
                    
                    else: 
                        if dimension_rule == "ALL" and not (height and width):
                            return {"price": 0, "unit": None} # 둘 다 필요
                        elif dimension_rule == "HEIGHT" and not height:
                            return {"price": 0, "unit": None} # height만 필요
                        elif dimension_rule == "WIDTH" and not width:
                            return {"price": 0, "unit": None} # width만 필요

                        # 유효성 검사를 통과했으므로, 값을 숫자로 변환합니다.
                        # 값이 없는 경우는 위에서 걸러졌으므로 'or 0'이 없어도 안전합니다.
                        so_height = flt(height) 
                        so_width = flt(width)

                        for vp_row in vp_table:
                            height_from = flt(vp_row.height_from)
                            height_to = flt(vp_row.height_to)
                            width_from = flt(vp_row.width_from)
                            width_to = flt(vp_row.width_to)

                            height_match = (so_height > height_from) and (so_height <= height_to)
                            width_match = (so_width > width_from) and (so_width <= width_to)
                            
                            match_found = False
                            if dimension_rule == "ALL" and height_match and width_match:
                                match_found = True
                            elif dimension_rule == "HEIGHT" and height_match:
                                match_found = True
                            elif dimension_rule == "WIDTH" and width_match:
                                match_found = True
                            
                            if match_found:
                                target_price = vp_row.vp
                                use_vp = True
                                break
            
        else: # 그 외 product_section
            if flt(item_doc.vp_rate) > 0:
                target_price = item_doc.vp_rate
                use_vp = True
            else:
                target_price = item_doc.standard_rate

        # (이하 수량 계산 및 반환 로직은 이전과 동일)
        # try:
        #     quantity = flt(qty or 1)
        # except (ValueError, TypeError):
        #     quantity = 1
        
        # final_price = flt(target_price) * quantity

        if item_doc.include_lm:
            target_unit = "/M2"

        return {"price": target_price, "unit": target_unit, "use_vp": use_vp}

    except Exception as e:
        frappe.log_error(f"Price calculation failed for {item_code}: {e}", "VP Price Calculation")
        return {"price": 0, "unit": None, "use_vp": False}
    
@frappe.whitelist()
def get_computation_data(doc):
    if isinstance(doc, str):
        doc = json.loads(doc)

    items = doc.get("finished_items", [])
    if not items:
        return None

    vp_multiplier = flt(doc.get("point_value"))
    item_codes = list(set(d.get("item_code") for d in items if d.get("item_code")))
    item_cost_code_map = {d.name: d.cost_code for d in frappe.get_all("Item", filters={"name": ("in", item_codes)}, fields=["name", "cost_code"])}

    # Product Type별로 아이템 그룹화
    items_by_type = defaultdict(list)
    for row in items:
        ptype = row.get("product_type") or "Unspecified"
        items_by_type[ptype].append(row)

    def calculate_set(target_items):
        summary = defaultdict(lambda: {"cost": 0, "sales": 0, "discount": 0})
        aa10_details = []

        for row in target_items:
            original_price = flt(row.get("price"))
            qty = flt(row.get("planned_qty"))
            amount = original_price * qty
            cost_code = item_cost_code_map.get(row.get("item_code"))
            
            # 일반 Cost Code 합계
            if cost_code and cost_code != 'AA10' and amount > 0:
                dc_rate = flt(row.get("manufacturer_dc"))
                dc_amt = amount * (dc_rate / 100)
                summary[cost_code]["cost"] += amount
                summary[cost_code]["sales"] += (amount - dc_amt)
                summary[cost_code]["discount"] += dc_amt

            # AA10 상세 내역 및 합계 (VP 기반)
            original_vp = flt(row.get("vp"))
            vp_amount = original_vp * qty
            if original_vp > 0:
                dc_rate = flt(row.get("manufacturer_dc"))
                dc_amt = vp_amount * (dc_rate / 100)
                aa10_details.append({
                    "item_code": row.get("item_code"),
                    "item_name": row.get("item_name"),
                    "cost": vp_amount,
                    "sales": vp_amount - dc_amt,
                    "discount": dc_amt
                })

        # AA10 합계 적용
        summary['AA10']["cost"] = sum(d["cost"] for d in aa10_details) * vp_multiplier
        summary['AA10']["sales"] = sum(d["sales"] for d in aa10_details) * vp_multiplier
        summary['AA10']["discount"] = sum(d["discount"] for d in aa10_details) * vp_multiplier

        # 보고서 구조 생성
        report_structure = {
            'A': {'title': 'A', 'rows': {'AA10': 'Fab', 'AA11': 'Plus Values', 'AA60': 'Total points'}},
            'B': {'title': 'B', 'rows': {'AB10': 'Transport (Local trucking)'}},
            'C': {'title': 'C', 'rows': {'AC20': 'Installation', 'AC32': 'Handling', 'AC44': 'Cleaning', 'AC45': 'Travelling Fees', 'AC46': 'Travelling time', 'AC47': 'Living allowances'}},
            'D': {'title': 'D', 'rows': {
                'AD01_D': 'Locks -by DIV.', 'AD02_D': 'Door closer -by DIV.', 'AD03_D': 'Auto drop seal -by DIV.', 'AD04_D': 'Sliding hardware -by DIV.', 'AD05_D': 'Glazing -by DIV.', 'AD06_D': 'Blind -by DIV', 'AD07_D': 'Blind ACC\'Y -by DIV.', 'AD08_D': 'Fabric or Film -by DIV.', 'AD09_D': 'Partition Accessories -by DIV', 'AD10_D': 'ETC -by Div.',
                'AD01_G': 'Locks -by Factory', 'AD02_G': 'Door closer -by Factory', 'AD03_G': 'Auto drop seal -by Factory', 'AD04_G': 'Sliding hardware -by Factory', 'AD05_G': 'Glazing -by Factory', 'AD06_G': 'Blind -by Factory', 'AD07_G': 'Blind ACC\'Y -by Factory', 'AD08_G': 'Fabric or Film -by Factory', 'AD09_G': 'Partition Accessories -by Factory', 'AD10_G': 'ETC -by Factory'
            }}
        }

        output = {"groups": [], "grand_total": {"cost": 0, "sales": 0, "discount": 0}, "aa10_details": aa10_details}
        for g_info in report_structure.values():
            g_data = {"title": g_info["title"], "rows": [], "total": {"cost": 0, "sales": 0, "discount": 0}}
            for code, label in g_info["rows"].items():
                row_sum = summary.get(code, {"cost": 0, "sales": 0, "discount": 0})
                g_data["rows"].append({"code": code, "label": label, "summary": row_sum})
                g_data["total"]["cost"] += row_sum["cost"]
                g_data["total"]["sales"] += row_sum["sales"]
                g_data["total"]["discount"] += row_sum["discount"]
            output["groups"].append(g_data)
            output["grand_total"]["cost"] += g_data["total"]["cost"]
            output["grand_total"]["sales"] += g_data["total"]["sales"]
            output["grand_total"]["discount"] += g_data["total"]["discount"]
        
        return output

    # 최종 결과 조립
    return {
        "vp_multiplier": vp_multiplier,
        "all": calculate_set(items), # 숨겨진 필드 값 설정용 (전체)
        "by_type": {ptype: calculate_set(t_items) for ptype, t_items in items_by_type.items()} # 탭용
    }


@frappe.whitelist()
def get_codes_sum_data(doc_dict, view_type="zone"):
    """
    주어진 Sales Order 'doc' 객체(딕셔너리)를 기반으로
    합산(consolidate) 및 정렬된 codes summary 데이터를 반환합니다.
    """

    if isinstance(doc_dict, str):
        doc_dict = json.loads(doc_dict)
    
    product_type_filter = doc_dict.get("print_filter_product_type")
    zone_filter = doc_dict.get("print_filter_zone")
    items = doc_dict.get("finished_items", [])

    if not items:
        return {"rows": [], "by_type": {}}
    
    filtered_items = items
    if product_type_filter:
        filtered_items = [item for item in filtered_items if item.get("product_type") == product_type_filter]
    if zone_filter:
        filtered_items = [item for item in filtered_items if item.get("zone_name") == zone_filter]
    
    if not filtered_items:
        if view_type == "zone":
            return {"view_type": "zone", "zones": []}
        else:
            return {"view_type": "section", "rows": [], "total": {"lm": 0, "square_m": 0, "vp_amount": 0, "price": 0}}

    # --- 1. 데이터 합산 (Consolidate) 로직 ---
    consolidated_map = {} # Python에서는 일반 dict 사용

    for row_dict in filtered_items:
        # Document 객체처럼 접근하기 위해 임시 객체 생성
        row = frappe._dict(row_dict)
        # key = ""
        uom = row.stock_uom

        if uom in ['MH', 'LM', 'M2']:
            key = f"{row.item_code}-{row.product_type}"
        else:
            key = f"{row.item_code}-{row.height}-{row.width}-{row.product_type}"

        if key not in consolidated_map:
            consolidated_map[key] = dict(row) # 원본 행을 복사
        else:
            existing_row = consolidated_map[key]
            if uom == 'MH':
                existing_row["height"] = flt(existing_row.get("height")) + flt(row.height)
            elif uom == 'LM':
                existing_row["lm"] = flt(existing_row.get("lm")) + flt(row.lm)
            elif uom == 'M2':
                existing_row["square_m"] = flt(existing_row.get("square_m")) + flt(row.square_m)
            else:
                existing_row["planned_qty"] = cint(existing_row.get("planned_qty")) + cint(row.planned_qty)
                existing_row["lm"] = flt(existing_row.get("lm")) + flt(row.lm)
                existing_row["square_m"] = flt(existing_row.get("square_m")) + flt(row.square_m)
                existing_row["vp"] = flt(existing_row.get("vp")) + flt(row.vp)
                existing_row["price"] = flt(existing_row.get("price")) + flt(row.price)
            existing_row["vp_amount"] = flt(existing_row.get("vp_amount")) + flt(row.vp_amount)
    
    consolidated_items = list(consolidated_map.values())

    # ==========================================================
    # CASE A: Zone별 그룹화 (ITEMS 프린트 포맷용)
    # ==========================================================
    if view_type == "zone" or view_type == 1:
        zones_data = defaultdict(lambda: {"items": [], "total": {"lm": 0, "square_m": 0, "vp_amount": 0, "price": 0}, "type_totals": {}})
        for item in consolidated_items:
            zones_data[item.get("zone_name") or "No Zone"]["items"].append(item)

        final_output = []
        for zone_name, zone_info in zones_data.items():
            zone_items = zone_info["items"]
            sorted_zone_items = []
            
            # 부모 아이템(Door, Panel, 기타) 분리
            door_parents = [i for i in zone_items if cint(i.get("indent_level")) == 0 and i.get("product_section") == 'Door']
            panel_parents = [i for i in zone_items if cint(i.get("indent_level")) == 0 and i.get("product_section") == 'Panel']
            other_parents = [i for i in zone_items if cint(i.get("indent_level")) == 0 and i.get("product_section") not in ['Door', 'Panel']]
            
            all_children = [i for i in zone_items if cint(i.get("indent_level")) > 0]
            
            # 정렬 순서: idx 기준
            door_parents.sort(key=lambda x: x.get("idx"))
            panel_parents.sort(key=lambda x: x.get("idx"))
            other_parents.sort(key=lambda x: x.get("idx"))

            # <Door Group> 조립
            for parent in door_parents:
                sorted_zone_items.append(parent)
                my_children = [c for c in all_children if c.get("fg_reference_id") == parent.get("name")]
                # 자식 정렬: Leaf -> Option -> Price Study -> Sub Contract
                child_order = {"Leaf": 1, "Option": 2, "Price Study": 3, "Sub Contract": 4}
                my_children.sort(key=lambda x: (child_order.get(x.get("product_section"), 99), x.get("idx")))
                sorted_zone_items.extend(my_children)

            # <Panel Group> 조립
            for parent in panel_parents:
                sorted_zone_items.append(parent)
                my_children = [c for c in all_children if c.get("fg_reference_id") == parent.get("name")]
                child_order = {"Option": 1, "Price Study": 2, "Sub Contract": 3}
                my_children.sort(key=lambda x: (child_order.get(x.get("product_section"), 99), x.get("idx")))
                sorted_zone_items.extend(my_children)

            # <Other Groups> 조립
            sorted_zone_items.extend(other_parents)

            # 합계 계산
            for item in sorted_zone_items:
                lm, sm, vp, price = flt(item.get("lm")), flt(item.get("square_m")), flt(item.get("vp_amount")), flt(item.get("price"))
                p_type = item.get("product_type") or "Other"
                
                zone_info["total"]["lm"] += lm
                zone_info["total"]["square_m"] += sm
                zone_info["total"]["price"] += price
                
                if p_type not in zone_info["type_totals"]:
                    zone_info["type_totals"][p_type] = {"lm": 0, "square_m": 0, "price": 0}
                zone_info["type_totals"][p_type]["lm"] += lm
                zone_info["type_totals"][p_type]["square_m"] += sm
                zone_info["type_totals"][p_type]["price"] += price

            final_output.append({
                "zone_name": zone_name,
                "rows": sorted_zone_items,
                "total": zone_info["total"],
                "type_totals": zone_info["type_totals"]
            })
        
        final_output.sort(key=lambda x: x["zone_name"])
        return { "zones": final_output }

    # CASE B: Product Type별 그룹화 (추가됨)
    elif view_type == "product_type":
        def get_sort_priority(row_dict):
            row = frappe._dict(row_dict)
            indent = cint(row.indent_level)
            section = row.product_section
            if indent == 0 and section == 'Door': return 1
            if indent == 1 and section == 'Leaf': return 2
            if indent == 0 and section == 'Panel': return 3
            if section == 'Option': return 4
            if section == 'Price Study': return 5
            if section == 'Sub Contract': return 6
            return 99
        consolidated_items.sort(key=lambda r: (get_sort_priority(r), r.get("idx")))

        type_groups = defaultdict(lambda: {"rows": [], "total": {"lm": 0, "square_m": 0, "vp_amount": 0, "price": 0}})
        for item in consolidated_items:
            ptype = item.get("product_type") or "Unspecified"
            type_groups[ptype]["rows"].append(item)
            type_groups[ptype]["total"]["lm"] += flt(item.get("lm", 0))
            type_groups[ptype]["total"]["square_m"] += flt(item.get("square_m", 0))
            type_groups[ptype]["total"]["vp_amount"] += flt(item.get("vp_amount", 0))
            type_groups[ptype]["total"]["price"] += flt(item.get("price", 0))
        
        return {"by_type": type_groups}

    # CASE C: 기본 전체 통합 (Section)
    else:
        # --- 정렬 헬퍼 함수 (공통) ---
        def get_sort_priority(row_dict):
            row = frappe._dict(row_dict)
            indent = cint(row.indent_level)
            section = row.product_section
            if indent == 0 and section == 'Door': return 1
            if indent == 1 and section == 'Leaf': return 2
            if indent == 0 and section == 'Panel': return 3
            if section == 'Option': return 4
            if section == 'Price Study': return 5
            if section == 'Sub Contract': return 6
            return 99
        
        # 정렬 실행: 우선순위 -> 원래 순서(idx)
        sorted_items = sorted(consolidated_items, key=lambda r: (get_sort_priority(r), r.get("idx")))
        
        grand_total = {"lm": 0, "square_m": 0, "vp_amount": 0, "price": 0}
        for item in sorted_items:
            grand_total["lm"] += flt(item.get("lm", 0))
            grand_total["square_m"] += flt(item.get("square_m", 0))
            grand_total["vp_amount"] += flt(item.get("vp_amount", 0))
            grand_total["price"] += flt(item.get("price", 0))

        return {
            "rows": sorted_items,
            "total": grand_total
        }
    

@frappe.whitelist()
def get_hw_spec_summary(doc_dict):
    """
    주어진 Sales Order doc 딕셔너리를 기반으로 HW Spec Summary 데이터를 계산하여 반환합니다.
    """
    import json
    if isinstance(doc_dict, str):
        doc_dict = json.loads(doc_dict)
    
    doc = frappe._dict(doc_dict) # 딕셔너리를 객체처럼 접근하기 위해 변환
    
    if not doc.project:
        return None

    # --- 1. 데이터 조회 ---
    specs = frappe.db.get_list("Door Hardware Spec",
        filters={'project': doc.project},
        fields=[
            "name", "hw_spec_code", "door_leaf_thk", "lockset_h", "handle", "mortise",
            "security_access_control", "wiring", "key_cylinder", "master_key",
            "auto_drop_seal", "door_closer", "al_strip", "for_lockset", "for_door_closer",
            "flush_bolt", "butt", "pivot", "blind", "fgd_type",
            "tape_seal_color_gray", "tape_seal_color_white", "tape_seal_color_black",
            "fix_screw_gray", "fix_screw_white", "fix_screw_black",
            "back_painted_no", "back_painted_yes",
        ],
        order_by="creation asc",
        limit_page_length=10
    )

    if not specs:
        return None

    filtered_specs = []
    
    # 최대 10개의 체크박스를 순회하며, 해당 인덱스의 Spec이 존재하고 체크되어 있는지 확인
    for i in range(1, 11):
        check_field_name = f"hw_check_{i}"
        
        # specs 리스트의 인덱스는 0부터 시작하므로 i-1
        spec_index = i - 1
        
        if spec_index < len(specs):
            # 해당 순번의 Spec이 존재함
            target_spec = specs[spec_index]
            
            # 문서(doc)에서 해당 체크박스 값이 1(True)인지 확인
            is_checked = doc.get(check_field_name)
            
            if is_checked:
                filtered_specs.append(target_spec)
        else:
            # Spec 목록보다 체크박스 번호가 더 크면 더 이상 매핑할 Spec이 없음
            break

    if not filtered_specs:
        return None
    
    # --- 3. 데이터 가공 (processed_specs 생성) ---
    processed_specs = []
    for spec in filtered_specs:
        tape_colors = []
        if spec.tape_seal_color_gray: tape_colors.append('STD(Gray)')
        if spec.tape_seal_color_white: tape_colors.append('White')
        if spec.tape_seal_color_black: tape_colors.append('Black')
        tape_seal_value = " || ".join(tape_colors) if tape_colors else '-'

        screw_colors = []
        if spec.fix_screw_gray: screw_colors.append('Gray')
        if spec.fix_screw_white: screw_colors.append('White')
        if spec.fix_screw_black: screw_colors.append('Black')
        fix_screw_value = " || ".join(screw_colors) if screw_colors else '-'

        back_painted_value = 'Yes' if spec.back_painted_yes else ('No' if spec.back_painted_no else '-')
        
        processed_specs.append({
            "name": spec.name,
            "hw_spec_code": spec.hw_spec_code,
            'Door Leaf Thickness': spec.door_leaf_thk,
            'Handle Height': spec.lockset_h,
            'Handle Type': spec.handle,
            'Mortise': spec.mortise,
            'Security & Access Control': spec.security_access_control,
            'Wiring Device': spec.wiring,
            'Key Cylinder': spec.key_cylinder,
            'Master Key': spec.master_key,
            'Auto Drop Seal': spec.auto_drop_seal,
            'Door Closer': spec.door_closer,
            'Al. Strip for 40T, 44T': spec.al_strip,
            'Al. Case': spec.for_lockset or spec.for_door_closer,
            'Flush Bolt': spec.flush_bolt,
            'Hinge': spec.butt or spec.pivot,
            'Door Blind': spec.blind,
            'FGD Info': spec.fgd_type,
            '3M Tape and Foam Seal': tape_seal_value,
            'Fixing Screw Cap': fix_screw_value,
            'Back Painted Boarder': back_painted_value,
        })

    # --- 4. 5개씩 그룹으로 분할 (Chunking) ---
    chunk_size = 5
    spec_chunks = []
    for i in range(0, len(processed_specs), chunk_size):
        spec_chunks.append(processed_specs[i:i + chunk_size])

    return {
        "chunks": spec_chunks
    }


@frappe.whitelist()
def create_zone_and_add_to_summary(project, zone_name, product_type, sales_order=None):
    """새로운 Zone 문서를 생성하고, 생성된 문서의 정보를 반환합니다."""
    if not all([project, zone_name, product_type]):
        frappe.throw("Project, Zone Name, and Product Type are required.")

    so_ref = ""
    if sales_order:
        parts = sales_order.split("-")
        so_ref = "-".join(parts[-3:]) if len(parts) >= 3 else sales_order

    filters = {"project": project, "zone_name": zone_name, "product_type": product_type}
    if sales_order:
        filters["sales_order"] = sales_order

    if frappe.db.exists("Zone", filters):
        existing_zone = frappe.db.get_value("Zone", filters, "name")
        return {"name": existing_zone, "zone_name": zone_name, "product_type": product_type}

    try:
        new_zone = frappe.new_doc("Zone")
        new_zone.project = project
        new_zone.zone_name = zone_name
        new_zone.product_type = product_type
        new_zone.sales_order = sales_order
        new_zone.so_ref = so_ref
        new_zone.ceiling_visible = 0
        new_zone.base_visible_h = 0
        new_zone.insert(ignore_permissions=True)

        return {"name": new_zone.name, "zone_name": new_zone.zone_name, "product_type": new_zone.product_type}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Create Zone Error")
        frappe.throw(str(e))


@frappe.whitelist()
def get_zones_for_project(project, sales_order=None):
    """프로젝트 및 Sales Order에 속한 Zone 목록을 반환합니다."""
    filters = {"project": project}
    if sales_order:
        filters["sales_order"] = sales_order

    zones = frappe.get_all("Zone",
        filters=filters,
        fields=["name", "zone_name", "product_type", "lm", "square_m",
                "zone_overall_color", "ch", "ph", "clch_type", "ceiling_visible",
                "base_type", "base_visible_h", "sales_order"],
        order_by="zone_name asc",
        limit_page_length=0
    )
    return zones


@frappe.whitelist()
def duplicate_zone_with_items(project, sales_order_docname, source_zone, new_zone_name, new_product_type):
    """
    Zone 문서를 복제하고, 원본 Zone에 연결된 Finished Items을 복제하여
    새 Zone에 연결한 후, 해당 Finished Items의 데이터를 반환합니다.
    """
    if not all([project, sales_order_docname, source_zone, new_zone_name, new_product_type]):
        frappe.throw("All required parameters are missing.")
    
    try:
        # 1. Zone 생성 또는 조회 (SO별 구분)
        so_ref = ""
        parts = sales_order_docname.split("-")
        so_ref = "-".join(parts[-3:]) if len(parts) >= 3 else sales_order_docname

        new_zone_id = None
        dup_filters = {"project": project, "zone_name": new_zone_name, "product_type": new_product_type, "sales_order": sales_order_docname}
        if frappe.db.exists("Zone", dup_filters):
            new_zone_id = frappe.db.get_value("Zone", dup_filters, "name")
        else:
            new_zone = frappe.new_doc("Zone")
            new_zone.project = project
            new_zone.zone_name = new_zone_name
            new_zone.product_type = new_product_type
            new_zone.sales_order = sales_order_docname
            new_zone.so_ref = so_ref
            new_zone.ceiling_visible = 0
            new_zone.base_visible_h = 0
            new_zone.insert(ignore_permissions=True)
            new_zone_id = new_zone.name

        # 2. Finished Items 데이터 가져오기
        original_so = frappe.get_doc("Clestra Sales Order", sales_order_docname)
        duplicated_items_data = []

        # 원본 Zone에 속한 아이템들만 필터링하고 idx 순서대로 정렬 (부모가 먼저 오도록)
        items_to_duplicate = [
            d for d in original_so.finished_items
            if d.zone_name == source_zone
        ]
        # idx 순으로 정렬해야 부모 -> 자식 순서가 보장되어 클라이언트 매핑이 쉬워짐
        items_to_duplicate.sort(key=lambda x: x.idx)

        for original_row in items_to_duplicate:
            # 딕셔너리로 변환
            item_dict = original_row.as_dict()
            
            # 클라이언트 로직을 위한 원본 식별자 저장
            item_dict['source_item_name'] = original_row.name
            
            # 새로운 Zone 정보로 업데이트
            item_dict['zone_name'] = new_zone_id
            
            # 불필요한 시스템 필드 제거
            for field in ['name', 'creation', 'modified', 'modified_by', 'owner', 'parent', 'parentfield', 'parenttype', 'idx']:
                if field in item_dict:
                    del item_dict[field]

            duplicated_items_data.append(item_dict)

        # 3. 반환
        return {
            "new_zone_name_id": new_zone_id,
            "duplicated_items_data": duplicated_items_data
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Duplicate Zone and Items Error")
        frappe.throw(str(e))
# Copyright (c) 2025, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from collections import defaultdict
from frappe.utils import nowdate, cint, flt, cstr
import json

class ClestraSalesOrder(Document):
    def before_save(self):
        self.set_reference_id()
        self.calculate_and_display_totals()
        # --- 환율 자동 업데이트 로직 ---
        self.update_exchange_rate()
    
    def calculate_and_display_totals(self):
        zone_totals = defaultdict(lambda: {"lm": 0.0, "square_m": 0.0})

        # [수정됨] 자식 테이블의 모든 행을 순회하며 서버에서 직접 계산합니다.
        for row in self.get("finished_items"):
            # --- 서버 측에서 최종 계산 수행 ---
            lm = 0
            square_m = 0
            if row.item_code and row.ch and row.width:
                include_lm = frappe.db.get_value("Item", row.item_code, "include_lm")
                if include_lm:
                    lm = float(row.width) / 1000
                    square_m = (float(row.width) * float(row.ch)) / 1000000
            
            # 계산된 값을 현재 행(자식 문서)에 다시 설정합니다.
            # 이렇게 하면 저장되는 데이터 자체가 정확해집니다.
            row.lm = lm
            row.square_m = square_m
            # --- 계산 끝 ---

            # Zone별 합계를 누적합니다.
            if row.zone_name:
                zone_totals[row.zone_name]["lm"] += lm
                zone_totals[row.zone_name]["square_m"] += square_m

        # 계산된 최종 합계로 Zone Doctype을 업데이트합니다.
        if zone_totals:
            for zone, totals in zone_totals.items():
                try:
                    frappe.db.set_value("Zone", zone, {
                        "lm": totals["lm"],
                        "square_m": totals["square_m"]
                    })
                except Exception as e:
                    frappe.throw(f"Could not update Zone '{zone}'. Error: {e}")
            
            # zones_updated = ', '.join(zone_totals.keys())
            # frappe.msgprint(f"Totals for zones ({zones_updated}) have been updated.", alert=True, indicator='green')s

    def set_reference_id(self):
        parent_name = {row.idx: row.name for row in self.finished_items}
        for row in self.finished_items:
            ref_id = ""
            if row.parent_row_no:
                ref_id = parent_name.get(cint(row.parent_row_no))
            if row.fg_reference_id and row.fg_reference_id == ref_id:
                continue
            if row.parent_row_no:
                row.fg_reference_id = ref_id

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
def calculate_and_get_row_values(item_code, height, width):
    """
    주어진 값으로 lm과 square_m을 계산하여 반환합니다.
    이 함수는 클라이언트의 실시간 피드백을 위해 사용됩니다.
    """
    if not all([item_code, height, width]):
        return {"lm": 0, "square_m": 0}

    try:
        # include_lm 값을 데이터베이스에서 직접 가져옵니다.
        include_lm = frappe.db.get_value("Item", item_code, "include_lm")
        
        if include_lm:
            lm = float(width) / 1000
            square_m = (float(width) * float(height)) / 1000000
            return {"lm": lm, "square_m": square_m}
        else:
            return {"lm": 0, "square_m": 0}
            
    except Exception as e:
        frappe.log_error(f"Calculation failed: {e}", "Row Value Calculation")
        return {"lm": 0, "square_m": 0}


@frappe.whitelist()
def search_item_by_name(txt, product_type=None, product_section=None):
    if not txt:
        return []

    # 기본 필터 목록을 리스트 형태로 시작합니다.
    filters = [
        ['disabled', '=', 0],
        ['has_variants', '=', 0],
    ]
    
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
    else:
        if product_type:
            filters.append(['product_type', '=', product_type])

    items = frappe.get_list(
        'Item',
        filters=filters,
        fields=['item_name', 'item_code'],
        limit=20
    )

    return [{'label': item.item_name, 'value': item.item_code} for item in items]


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
        is_vp = None

        # 조건 1: product_section이 ["Door", "Leaf", "Panel"]에 포함되는 경우
        if product_section in ["Door", "Leaf", "Panel"]:

            # VP Management 문서를 찾습니다.
            vp_doc_name = frappe.db.get_value("VP Management", {"product_name": item_code})
            if vp_doc_name:
                vp_doc = frappe.get_doc("VP Management", vp_doc_name)
                vp_table = vp_doc.get("vp_table")

                if vp_table:
                    dimension_rule = vp_table[0].dimension_rule
                    
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

                    max_height = 0
                    max_width = 0
                    for vp_row in vp_table:
                        if flt(vp_row.height_to) > max_height:
                            max_height = flt(vp_row.height_to)
                        if flt(vp_row.width_to) > max_width:
                            max_width = flt(vp_row.width_to)

                    error_messages = []
                    # 높이 범위 초과 확인
                    if dimension_rule in ["ALL", "HEIGHT"] and so_height > max_height:
                        error_messages.append(f"Height ({so_height}mm) exceeds the maximum limit of {max_height}mm.")
                    
                    # 너비 범위 초과 확인
                    if dimension_rule in ["ALL", "WIDTH"] and so_width > max_width:
                        error_messages.append(f"Width ({so_width}mm) exceeds the maximum limit of {max_width}mm.")

                    # 에러 메시지가 있으면 frappe.throw를 통해 클라이언트로 전송
                    if error_messages:
                        frappe.throw(
                            "<br>".join(error_messages),
                            title="Dimension Out of Range"
                        )

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
                            is_vp = True
                            break
            
        else: # 그 외 product_section
            if flt(item_doc.vp_rate) > 0:
                target_price = item_doc.vp_rate
                is_vp = True
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

        return {"price": target_price, "unit": target_unit, "is_vp": is_vp}

    except Exception as e:
        frappe.log_error(f"Price calculation failed for {item_code}: {e}", "VP Price Calculation")
        return {"price": 0, "unit": None, is_vp: False}
    
@frappe.whitelist()
def get_computation_data(doc):
    """
    주어진 Sales Order 이름(docname)을 기반으로 computation summary 데이터를 계산하여 반환합니다.
    이 함수는 클라이언트 스크립트와 프린트 포맷 양쪽에서 호출됩니다.
    """
    if isinstance(doc, str):
        doc = json.loads(doc)

    items = doc.get("finished_items", [])
    
    if not items:
        return None

    # --- (render_computation의 JavaScript 로직을 Python으로 변환) ---
    
    vp_multiplier_value = frappe.db.get_value("Standard Values", {"code": 'vp'}, "value")
    vp_multiplier = cint(vp_multiplier_value)

    item_codes = list(set(d.get("item_code") for d in items if d.get("item_code")))
    item_cost_codes_list = frappe.db.get_list("Item",
                                              filters={"name": ("in", item_codes)},
                                              fields=["name", "cost_code"])
    item_cost_code_map = {d["name"]: d["cost_code"] for d in item_cost_codes_list}

    cost_code_summary = defaultdict(lambda: {"cost": 0, "sales": 0, "discount": 0})

    # AA10 상세 내역을 담을 리스트
    aa10_detail_items = []

    for row in items:
        original_price = flt(row.get("price"))
        cost_code = item_cost_code_map.get(row.get("item_code"))

        if cost_code and cost_code != 'AA10' and original_price > 0:
            discount_rate = flt(row.get("manufacturer_dc"))
            discount_amount = original_price * (discount_rate / 100)
            discounted_price = original_price - discount_amount
            
            cost_code_summary[cost_code]["cost"] += original_price
            cost_code_summary[cost_code]["sales"] += discounted_price
            cost_code_summary[cost_code]["discount"] += discount_amount
        
        # VP 기반 계산 (AA10 상세 내역 생성)
        original_vp = flt(row.get("vp"))
        if original_vp > 0:
            discount_rate = flt(row.get("manufacturer_dc"))
            discount_amount = original_vp * (discount_rate / 100)
            discounted_vp = original_vp - discount_amount
            
            # 상세 내역 리스트에 추가
            aa10_detail_items.append({
                "item_code": row.get("item_code"),
                "item_name": row.get("item_name"),
                "cost": original_vp,      # Cost: 할인 전 VP
                "sales": discounted_vp,     # Sales: 할인 후 VP
                "discount": discount_amount, # 할인액
                "discount_rate": row.get("manufacturer_dc")
            })

    # 2. AA10 최종 합계 계산
    aa10_cost = sum(item["cost"] for item in aa10_detail_items) * vp_multiplier
    aa10_sales = sum(item["sales"] for item in aa10_detail_items) * vp_multiplier
    aa10_discount = sum(item["discount"] for item in aa10_detail_items) * vp_multiplier
    
    cost_code_summary['AA10']["cost"] = aa10_cost
    cost_code_summary['AA10']["sales"] = aa10_sales
    cost_code_summary['AA10']["discount"] = aa10_discount

    # 최종적으로 반환할 데이터 구조
    report_structure = {
        'A': {'title': 'A', 'rows': {'AA10': 'Fab', 'AA11': 'Plus Values', 'AA60': 'Total points'}},
        'B': {"title": "B", "rows": { "AB10": "Transport (Local trucking)" }},
        'C': { "title": "C", "rows": { 'AC20': 'Installation', 'AC32': 'Handling', 'AC44': 'Cleaning', 'AC45': 'Travelling Fees', 'AC46': 'Travelling time', 'AC47': 'Living allowances' }},
        'D': { "title": "D", "rows": {
            'AD01_D': 'Locks -by DIV.', 'AD02_D': 'Door closer -by DIV.', 'AD03_D': 'Auto drop seal -by DIV.', 'AD04_D': 'Sliding hardware -by DIV.', 'AD05_D': 'Glazing -by DIV.', 'AD06_D': 'Blind -by DIV', 'AD07_D': 'Blind ACC\'Y -by DIV.', 'AD08_D': 'Fabric or Film -by DIV.', 'AD09_D': 'Partition Accessories -by DIV', 'AD10_D': 'ETC -by Div.',
            'AD01_G': 'Locks -by Factory', 'AD02_G': 'Door closer -by Factory', 'AD03_G': 'Auto drop seal -by Factory', 'AD04_G': 'Sliding hardware -by Factory', 'AD05_G': 'Glazing -by Factory', 'AD06_G': 'Blind -by Factory', 'AD07_G': 'Blind ACC\'Y -by Factory', 'AD08_G': 'Fabric or Film -by Factory', 'AD09_G': 'Partition Accessories -by Factory', 'AD10_G': 'ETC -by Factory'
        }}
    }

    # Python 딕셔너리로 최종 결과물 가공
    output_data = {
        "vp_multiplier": vp_multiplier,
        "groups": [],
        "grand_total": {"cost": 0, "sales": 0, "discount": 0}
    }

    for group_key, group_info in report_structure.items():
        group_data = {
            "title": group_info["title"],
            "rows": [],
            "total": {"cost": 0, "sales": 0, "discount": 0}
        }
        for code, label in group_info["rows"].items():
            summary = cost_code_summary.get(code, {"cost": 0, "sales": 0, "discount": 0})
            group_data["rows"].append({
                "code": code,
                "label": label,
                "summary": summary
            })
            group_data["total"]["cost"] += summary["cost"]
            group_data["total"]["sales"] += summary["sales"]
            group_data["total"]["discount"] += summary["discount"]
        
        output_data["groups"].append(group_data)
        output_data["grand_total"]["cost"] += group_data["total"]["cost"]
        output_data["grand_total"]["sales"] += group_data["total"]["sales"]
        output_data["grand_total"]["discount"] += group_data["total"]["discount"]
        output_data["aa10_details"] = aa10_detail_items

    return output_data


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
        if view_type == "zone":
            return {"view_type": "zone", "zones": []}
        else:
            return {"view_type": "section", "rows": [], "total": {"lm": 0, "square_m": 0, "vps": 0, "price": 0}}
    
    filtered_items = items
    if product_type_filter is not None or '':
        filtered_items = [item for item in filtered_items if item.get("product_type") == product_type_filter]
    if zone_filter is not None or '':
        filtered_items = [item for item in filtered_items if item.get("zone_name") == zone_filter]
    
    if not filtered_items:
        if view_type == "zone":
            return {"view_type": "zone", "zones": []}
        else:
            return {"view_type": "section", "rows": [], "total": {"lm": 0, "square_m": 0, "vps": 0, "price": 0}}

    # --- 1. 데이터 합산 (Consolidate) 로직 ---
    consolidated_map = {} # Python에서는 일반 dict 사용

    for row_dict in filtered_items:
        # Document 객체처럼 접근하기 위해 임시 객체 생성
        row = frappe._dict(row_dict)
        
        key = ""
        uom = row.stock_uom

        if uom in ['MH', 'LM', 'M2']:
            key = cstr(row.item_code)
        else:
            key = f"{cstr(row.item_code)}-{cstr(row.ch)}-{cstr(row.width)}"

        if key not in consolidated_map:
            consolidated_map[key] = dict(row) # 원본 행을 복사
        else:
            existing_row = consolidated_map[key]
            if uom == 'MH':
                existing_row["ch"] = flt(existing_row.get("ch")) + flt(row.ch)
            elif uom == 'LM':
                existing_row["lm"] = flt(existing_row.get("lm")) + flt(row.lm)
            elif uom == 'M2':
                existing_row["square_m"] = flt(existing_row.get("square_m")) + flt(row.square_m)
            else:
                existing_row["qty"] = cint(existing_row.get("qty")) + cint(row.qty)
                existing_row["lm"] = flt(existing_row.get("lm")) + flt(row.lm)
                existing_row["square_m"] = flt(existing_row.get("square_m")) + flt(row.square_m)
                existing_row["vp"] = flt(existing_row.get("vp")) + flt(row.vp)
                existing_row["price"] = flt(existing_row.get("price")) + flt(row.price)
    
    consolidated_items = list(consolidated_map.values())

    # ==========================================================
    # CASE A: Zone별 그룹화 (ITEMS 프린트 포맷용)
    # ==========================================================
    if view_type == "zone" or "":
        zones_data = defaultdict(lambda: {"items": [], "total": {"lm": 0, "square_m": 0, "vps": 0, "price": 0}, "type_totals": {}})
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
                lm, sm, vp, price = flt(item.get("lm")), flt(item.get("square_m")), flt(item.get("vp")), flt(item.get("price"))
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

    # ==========================================================
    # CASE B: 전체 통합 (CODES SUM 프린트 포맷용)
    # ==========================================================
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
        
        grand_total = {"lm": 0, "square_m": 0, "vps": 0, "price": 0}
        for item in sorted_items:
            grand_total["lm"] += flt(item.get("lm", 0))
            grand_total["square_m"] += flt(item.get("square_m", 0))
            grand_total["vps"] += flt(item.get("vp", 0))
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
    
    # --- 3. 데이터 가공 (processed_specs 생성) ---
    processed_specs = []
    for spec in specs:
        tape_colors = []
        if spec.tape_seal_color_gray: tape_colors.append('STD(Gray)')
        if spec.tape_seal_color_white: tape_colors.append('White')
        if spec.tape_seal_color_black: tape_colors.append('Black')
        tape_seal_value = " || ".join(tape_colors) if tape_colors else ['-']

        screw_colors = []
        if spec.fix_screw_gray: screw_colors.append('Gray')
        if spec.fix_screw_white: screw_colors.append('White')
        if spec.fix_screw_black: screw_colors.append('Black')
        fix_screw_value = " || ".join(screw_colors) if screw_colors else ['-']

        back_painted_value = 'Yes' if spec.back_painted_yes else 'No'
        
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
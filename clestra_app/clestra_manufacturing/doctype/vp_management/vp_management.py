# Copyright (c) 2025, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, cint
from collections import defaultdict
import logging

# Logger 설정
logger = frappe.logger("vp_management", allow_site=True)
logger.setLevel(logging.DEBUG)

# class YourParentDocType(frappe.model.document.Document):
class VPManagement(Document):
    @frappe.whitelist()
    def calculate_vp_data(self): # Or a whitelisted method
        self.set("calculated_data", []) # 이전 데이터 클리어

        # process_field 함수를 메소드 내에 정의하거나,
        # local_variables를 인자로 받도록 수정하는 것이 좋습니다.
        # 여기서는 local_variables를 인자로 받는 형태로 수정하여 사용합니다.
        def process_formula_field(formula_str, parent_val, local_vars):
            """
            Process a field with the provided formula_str and local_vars.
            Handles numbers, strings (formulas/conditions), and 'True'/'Enabled' values.
            The 'parent_val' is used only for 'Enabled'/'True' cases as per original prompt.
            """

            try:
                if formula_str == "Enabled":
                    return parent_val
                elif str(formula_str).strip().lower() == "true":
                    return parent_val
                elif isinstance(formula_str, str):
                    if "if " in formula_str.lower() and (" else " in formula_str.lower() or formula_str.strip().startswith("if ")):
                        try:
                            evaluated_value = eval(
                                formula_str,
                                {"__builtins__": {}},
                                local_vars
                            )
                            return evaluated_value
                        except Exception as e_eval_if:
                            frappe.log_error(
                                message=f"Error evaluating conditional formula '{formula_str}': {str(e_eval_if)}",
                                title="Formula Evaluation Error"
                            )
                            return 0
                    else:
                        evaluated_value = eval(
                            formula_str,
                            {"__builtins__": {}},
                            local_vars
                        )
                        return evaluated_value
                elif isinstance(formula_str, (int, float)):
                    return formula_str
                else:
                    frappe.log_error(f"Unsupported formula type for: {formula_str}", "Formula Type Error")
                    return 0
            except Exception as e:
                frappe.log_error(
                    message=f"Error evaluating formula '{formula_str}': {str(e)}",
                    title="Formula Evaluation Error"
                )
                return 0
        # --- process_formula_field 함수 정의 끝 ---

        width_values = [flt(w.get("value")) for w in self.get("width_definition") if w.get("type") == "Width" and w.get("value") is not None]
        height_values = [flt(h.get("value")) for h in self.get("height_definition") if h.get("type") == "Height" and h.get("value") is not None] # type을 "Height"로 수정 가정

        if not width_values or not height_values:
            frappe.msgprint("Width 또는 Height 정의가 비어있습니다. 계산을 진행할 수 없습니다.")
            return

        for w_val in width_values:
            for h_val in height_values:
                for bom_item in self.get("vp_bom"): # BOM 아이템 루프가 가장 안쪽으로 이동
                    if not bom_item.get("item_code") or not bom_item.get("formula"):
                        frappe.log_error(f"BOM 항목 누락: {bom_item.get('description') or 'N/A'}, Item Code 또는 Formula 누락 (W:{w_val}, H:{h_val})", "BOM Data Error")
                        continue

                    item_code = bom_item.get("item_code")
                    item_rate = frappe.db.get_value("Item", item_code, "vp_rate")
                    if item_rate is None:
                        frappe.log_error(f"Item '{item_code}'의 단가(valuation_rate)를 찾을 수 없습니다. (W:{w_val}, H:{h_val})", "Item Rate Error")
                        item_rate = 0

                    formula_doc_name = bom_item.get("formula")
                    actual_formula_string = frappe.db.get_value("Formula Library", formula_doc_name, "formula")

                    if not actual_formula_string:
                        frappe.log_error(f"Formula Library에서 '{formula_doc_name}'에 해당하는 수식을 찾을 수 없습니다 (Item: {item_code}, W:{w_val}, H:{h_val}).", "Formula Error")
                        continue
                    
                    current_local_vars = {
                        "width": flt(w_val),
                        "height": flt(h_val)
                    }

                    calculated_quantity_factor = process_formula_field(actual_formula_string, None, current_local_vars)
                    amount = flt(calculated_quantity_factor) * flt(item_rate)

                    new_calculated_row = self.append("calculated_data", {})
                    new_calculated_row.cost_type = bom_item.get("cost_type")
                    new_calculated_row.description = bom_item.get("description")
                    new_calculated_row.item_code = item_code
                    new_calculated_row.rate = flt(item_rate)
                    new_calculated_row.width = flt(w_val)
                    new_calculated_row.height = flt(h_val)
                    new_calculated_row.amount = flt(amount)
        # --- 기존 calculated_data 계산 로직 끝 ---

        # --- summary 테이블 계산 로직 시작 ---
        self.set("summary", []) # 이전 summary 데이터 클리어

        vp_lookup = {}

        # calculated_data를 그룹핑하기 위한 준비
        # 키: (width, height), 값: {'Material Cost': total_amount, 'Labor Cost': total_amount}
        # 이 부분은 이전과 동일 (item_code를 제외하고 width, height로 그룹핑)
        grouped_data_for_summary = defaultdict(lambda: defaultdict(float))
        for row in self.get("calculated_data"):
            group_key = (flt(row.width), flt(row.height))
            grouped_data_for_summary[group_key][row.cost_type] += flt(row.amount)

        mfg_rate = flt(self.get("mfg_rate"))
        oh_rate = flt(self.get("oh_rate"))
        vp_rate_divisor = flt(self.get("vp_rate"))

        if vp_rate_divisor == 0:
            frappe.msgprint("VP Rate가 0입니다. VP 계산을 위해 0이 아닌 값을 입력해주세요.", indicator="orange", alert=True)

        # (width, height) 그룹별로 단일 summary 행 생성
        for (width, height), costs_in_group in grouped_data_for_summary.items():
            
            # 각 (width, height) 그룹의 Material Cost 합계와 Labor Cost 합계 가져오기
            group_mt_cost_total = flt(costs_in_group.get("Material Cost", 0.0))
            group_labor_cost_total = flt(costs_in_group.get("Labor Cost", 0.0))

            # @1: Material Cost 합계 + Labor Cost 합계 (이것이 mfg_cost 등의 계산 기준)
            at_1_mt_and_labor_cost = group_mt_cost_total + group_labor_cost_total

            # @2: manufacturing_cost = @1 * doc.mfg_rate
            at_2_mfg_cost = at_1_mt_and_labor_cost * mfg_rate

            # @3: overhead_cost = (@1 + @2) * doc.oh_rate
            at_3_oh_cost = (at_1_mt_and_labor_cost + at_2_mfg_cost) * oh_rate
            
            # @4: FTC = @1 + @2 + @3
            at_4_ftc = at_1_mt_and_labor_cost + at_2_mfg_cost + at_3_oh_cost

            value_point = 0
            if vp_rate_divisor != 0:
                value_point = cint(at_4_ftc / vp_rate_divisor)
            else:
                # VP Rate가 0일 경우의 로그는 한 번만 남기는 것이 좋으므로,
                # 이미 msgprint로 알렸다면 여기서는 추가 로그 없이 0으로 처리.
                # frappe.log_error(f"VP Rate is 0 for W:{width}, H:{height}. VP set to 0.", "VP Calculation Warning")
                pass

            vp_lookup[(flt(width), flt(height))] = value_point
            
            new_summary_row = self.append("summary", {})
            # cost_type 필드는 이제 단일 행 요약이므로, "Total" 또는 비워둘 수 있음.
            # 또는 summary 테이블에서 이 필드를 제거하는 것도 고려.
            new_summary_row.cost_type = "Sub Total" 
            new_summary_row.description = f"{cint(width)} x {cint(height)}"
            new_summary_row.width = width
            new_summary_row.height = height
            
            new_summary_row.mt_cost = group_mt_cost_total       # Material Cost 합계
            new_summary_row.labor_cost = group_labor_cost_total # Labor Cost 합계
            
            new_summary_row.mfg_cost = at_2_mfg_cost   # Material+Labor 합계를 기준으로 계산됨
            new_summary_row.oh_cost = at_3_oh_cost     # Material+Labor 합계를 기준으로 계산됨
            new_summary_row.ftc = at_4_ftc             # Material+Labor 합계를 기준으로 계산됨
            new_summary_row.vp = value_point           # Material+Labor 합계를 기준으로 계산됨
            # --- summary 테이블 계산 로직 끝 ---


        # --- VP Matrix 계산 로직 시작 ---
        self.set("vp_matrix", []) # 이전 vp_matrix 데이터 클리어

        sorted_width_values = sorted([flt(w.get("value")) for w in self.get("width_definition") if w.get("type") == "Width" and w.get("value") is not None])
        sorted_height_values = sorted([flt(h.get("value")) for h in self.get("height_definition") if h.get("type") == "Height" and h.get("value") is not None])

        if not sorted_width_values or not sorted_height_values:
            pass
        else:
            for h_val in sorted_height_values:
                new_matrix_row = self.append("vp_matrix", {})
                new_matrix_row.value = h_val

                for i, w_val in enumerate(sorted_width_values):
                    col_index = i + 1
                    if col_index > 20:
                        frappe.msgprint(f"Warning: More than 20 width values defined. Only the first 20 will be displayed.")
                        break
                    
                    vp_value = vp_lookup.get((w_val, h_val), 0)
                    # logger.info(f"Setting VP value for Width: {w_val}, Height: {h_val} to {vp_value}")

                    # JavaScript와 일치하도록 필드명 변경
                    fieldname = f"width_{col_index}"
                    new_matrix_row.set(fieldname, vp_value)
        # --- VP Matrix 계산 로직 끝 ---

        self.save() # 모든 변경사항 (calculated_data 및 summary) 저장s
        frappe.msgprint("데이터 계산 및 요약이 완료되었습니다.", indicator="green", alert=True)
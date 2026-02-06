# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
import math
import logging

# Logger 설정
logger = frappe.logger("quotation_pricing", allow_site=True)
logger.setLevel(logging.DEBUG)

class QuotationPricing(Document):
	pass


@frappe.whitelist()
def get_vp(item_code, height=None, width=None, qty=None):
	if not item_code:
		return {"price": 0, "unit": None, "is_vp": False}

	try:
		# 1. Item 기본 정보 가져오기
		item_doc = frappe.get_value(
			"Item", 
			item_code, 
			["vp_rate", "standard_rate", "include_lm"], 
			as_dict=True
		)
		if not item_doc:
			return {"price": 0, "unit": None, "is_vp": False}

		target_price = 0
		target_unit = "/M2" if item_doc.include_lm else None
		is_vp = False
		
		# 2. VP Management 검색
		# get_doc 대신 db.get_values를 사용하여 필요한 child table 데이터만 가져오면 더 가볍습니다.
		vp_doc_name = frappe.db.get_value("VP Management", {"product_name": item_code})
		if vp_doc_name:
			vp_doc = frappe.get_doc("VP Management", vp_doc_name)
			vp_table = vp_doc.get("vp_table")

			if vp_table:
				dimension_rule = vp_table[0].dimension_rule

				if dimension_rule == "NONE":
					target_price = vp_table[0].vp
					is_vp = True
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
def calculate_cost(field, formula_name, doc=None):
	formula = frappe.db.get_value("Formula Library", formula_name, "formula")
	if not formula:
		return None

	context = {
        'math': math,
        'ceil': math.ceil,
        'floor': math.floor,
        'round': round,
        'abs': abs
    }

	if doc:
		# 클라이언트에서 보낸 doc(dict)을 context에 업데이트
		if isinstance(doc, str):
			import json
			doc = json.loads(doc)
		context.update(doc)
	
	try:
		if isinstance(formula, str):  # 수식 또는 조건식으로 처리
			if "if" in formula: 
				# exec()로 조건식 처리
				# logger.debug(f"{field}: Evaluating formula with if condition: {formula}")
				exec(f"result = None\n{formula.replace('return', 'result =')}", {}, context)
				# logger.debug(f"{field}: Evaluated formula with if condition, result: {context.get('result')}")
				return context.get("result")
			else:
				return eval(formula, {}, context)
		else:
			return formula
	except Exception as e:
		frappe.log_error(
			message=f"Error evaluating {field}: {str(e)}",
			title="Formula Evaluation Error"
		)
		# logger.error(f"{field}: Error evaluating formula, set to None. BOM value: {formula}, Error: {e}")
		return None
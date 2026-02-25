# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
import math
import re
import logging

# Logger 설정
logger = frappe.logger("quotation_pricing", allow_site=True)
logger.setLevel(logging.DEBUG)

# Quotation Pricing 고정 필드 변수 (수식에서 자동으로 사용 가능)
FIXED_FIELDS = {
	"item_vp", "vp_rate", "mat_rate", "glass_rate", "inst_rate", "other_rate",
	"mat_margin", "ch_surcharge_rate", "pm_reserve_rate", "royalty_rate",
	"width", "ch", "stnd_ch", "lh", "height", "buffer_width", "buffer_rate",
	"glass_cost_a", "glass_cost_b",
}



# 수식에서 변수 추출용 정규식
VAR_REGEX = r'\b(?![0-9])([a-zA-Z_][a-zA-Z0-9_]*)\b'

# 변수가 아닌 Python 키워드/내장함수
EXCLUDED_NAMES = {
	"if", "elif", "else", "and", "or", "not", "in", "is",
	"True", "False", "None", "return",
	"math", "ceil", "floor", "round", "abs", "max", "min", "pow",
}


class QuotationPricing(Document):
	pass


@frappe.whitelist()
def get_formula_variables(formula_name):
	"""Formula Library에서 수식을 읽어 child table에 입력이 필요한 변수 목록을 반환"""
	if not formula_name:
		return []

	formula = frappe.db.get_value("Formula Library", formula_name, "formula")
	if not formula:
		return []

	# 수식에서 모든 식별자 추출
	all_vars = set(re.findall(VAR_REGEX, formula))

	# 고정 필드, Python 키워드 제외 → child table 변수로 취급
	needed_vars = [v for v in all_vars if v not in FIXED_FIELDS and v not in EXCLUDED_NAMES]

	# 정렬하여 반환
	return needed_vars


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
		return {"status": "error", "message": "Formula not found"}

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

		# Child table 변수 추출
		for key, value in doc.items():
			if isinstance(value, list):
				for row in value:
					if isinstance(row, dict) and 'variable' in row and 'value' in row:
						context[row['variable']] = row['value']
	
	try:
		if isinstance(formula, str):  # 수식 또는 조건식으로 처리
			# 필요한 변수 추출 및 누락 확인
			all_vars = set(re.findall(VAR_REGEX, formula))
			required_vars = [v for v in all_vars if v not in EXCLUDED_NAMES]
			missing_vars = []
			for v in required_vars:
				val = context.get(v)
				if val in (None, "", 0, 0.0, "0", "0.0"):
					missing_vars.append(v)
			
			if missing_vars:
				return {"status": "missing_vars", "missing_vars": missing_vars}

			if "if" in formula: 
				exec(f"result = None\n{formula.replace('return', 'result =')}", {}, context)
				return {"status": "success", "result": context.get("result")}
			else:
				return {"status": "success", "result": eval(formula, {}, context)}
		else:
			return {"status": "success", "result": formula}
	except Exception as e:
		frappe.log_error(
			message=f"Error evaluating {field}: {str(e)}",
			title="Formula Evaluation Error"
		)
		return {"status": "error", "message": str(e)}
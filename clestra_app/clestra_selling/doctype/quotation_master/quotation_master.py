# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
import math
import re
import logging

# Logger 설정
logger = frappe.logger("quotation_master", allow_site=True)
logger.setLevel(logging.DEBUG)

# Quotation Master 고정 필드 변수 (수식에서 자동으로 사용 가능)
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


class QuotationMaster(Document):
	def before_save(self):
		logger.debug(f"[QM SAVE] {self.name} quotation_desc length: {len(self.quotation_desc or '')}")
		logger.debug(f"[QM SAVE] quotation_desc first 200: {(self.quotation_desc or '')[:200]}")

	def on_update(self):
		# DB에 실제 저장된 값 확인
		db_val = frappe.db.get_value("Quotation Master", self.name, "quotation_desc")
		logger.debug(f"[QM ON_UPDATE] DB quotation_desc length: {len(db_val or '')}")
		logger.debug(f"[QM ON_UPDATE] DB first 200: {(db_val or '')[:200]}")


@frappe.whitelist()
def get_formula_variables(formula_name):
	"""Formula Library에서 수식을 읽어 child table에 입력이 필요한 변수 목록을 반환"""
	if not formula_name:
		return []

	formula = frappe.db.get_value("Formula Library", formula_name, "formula")
	if not formula:
		return []

	all_vars = set(re.findall(VAR_REGEX, formula))
	needed_vars = [v for v in all_vars if v not in FIXED_FIELDS and v not in EXCLUDED_NAMES]
	return needed_vars


@frappe.whitelist()
def get_vp(item_code, height=None, width=None, qty=None):
	if not item_code:
		return {"price": 0, "unit": None, "is_vp": False, "reason": "Item Code가 입력되지 않았습니다."}

	try:
		item_doc = frappe.get_value(
			"Item",
			item_code,
			["vp_rate", "standard_rate", "include_lm"],
			as_dict=True
		)
		if not item_doc:
			return {"price": 0, "unit": None, "is_vp": False, "reason": f"Item '{item_code}'을(를) 찾을 수 없습니다."}

		target_price = 0
		target_unit = "/M2" if item_doc.include_lm else None
		is_vp = False
		reason = ""

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
						return {"price": 0, "unit": None, "is_vp": False, "reason": "VP 조회에 CH(높이)와 Width(폭) 값이 모두 필요합니다."}
					elif dimension_rule == "HEIGHT" and not height:
						return {"price": 0, "unit": None, "is_vp": False, "reason": "VP 조회에 CH(높이) 값이 필요합니다."}
					elif dimension_rule == "WIDTH" and not width:
						return {"price": 0, "unit": None, "is_vp": False, "reason": "VP 조회에 Width(폭) 값이 필요합니다."}

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

					if not is_vp:
						reason = f"VP 테이블에서 CH={height}, Width={width} 에 해당하는 구간을 찾을 수 없습니다."
			else:
				reason = f"VP Management '{vp_doc_name}'에 VP 테이블 데이터가 없습니다."

		else:
			if flt(item_doc.vp_rate) > 0:
				target_price = item_doc.vp_rate
				is_vp = True
			else:
				target_price = item_doc.standard_rate
				reason = "VP Management가 없어 Standard Rate를 사용합니다." if target_price else "VP Management가 없고 Standard Rate도 0입니다."

		if item_doc.include_lm:
			target_unit = "/M2"

		return {"price": target_price, "unit": target_unit, "is_vp": is_vp, "reason": reason}

	except Exception as e:
		frappe.log_error(f"Price calculation failed for {item_code}: {e}", "VP Price Calculation")
		return {"price": 0, "unit": None, "is_vp": False, "reason": f"VP 조회 중 오류 발생: {str(e)}"}


@frappe.whitelist()
def get_installation_cost(item_code, field):
	"""Estimate Installation Cost의 콤마 구분 item_code 필드에서 정확히 매칭되는 문서를 찾아 단가를 반환"""
	if not item_code or not field:
		return 0

	valid_fields = {"metro_new_inst", "metro_dismantle", "metro_reinst", "reg_new_inst", "reg_dismantle", "reg_reinst"}
	if field not in valid_fields:
		return 0

	rows = frappe.db.sql(
		f"SELECT item_code, `{field}` as rate FROM `tabEstimate Installation Cost`",
		as_dict=True
	)

	for row in rows:
		items = [v.strip() for v in (row.item_code or "").split(",")]
		if item_code in items:
			return flt(row.rate)

	return 0


@frappe.whitelist()
def calculate_cost(field, formula_name, doc=None, skip_fields=None):
	formula = frappe.db.get_value("Formula Library", formula_name, "formula")
	if not formula:
		return {"status": "error", "message": "Formula not found"}

	if isinstance(skip_fields, str):
		import json as _json
		skip_fields = _json.loads(skip_fields)
	skip_set = set(skip_fields or [])

	context = {
		'math': math,
		'ceil': math.ceil,
		'floor': math.floor,
		'round': round,
		'abs': abs
	}

	if doc:
		if isinstance(doc, str):
			import json
			doc = json.loads(doc)
		context.update(doc)

		for key, value in doc.items():
			if isinstance(value, list):
				for row in value:
					if isinstance(row, dict) and 'variable' in row and 'value' in row:
						context[row['variable']] = flt(row['value'])

	try:
		if isinstance(formula, str):
			all_vars = set(re.findall(VAR_REGEX, formula))
			required_vars = [v for v in all_vars if v not in EXCLUDED_NAMES]
			missing_vars = []
			for v in required_vars:
				val = context.get(v)
				if val is None or val == "":
					if v in skip_set:
						context[v] = 0
						continue
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

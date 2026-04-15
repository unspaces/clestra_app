# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, ceil, cint
from frappe.utils.safe_exec import safe_eval, safe_exec
import math
import logging

# Logger 설정
logger = frappe.logger("clestra_quotation", allow_site=True)
logger.setLevel(logging.DEBUG)


class ClestraQuotation(Document):
	pass


@frappe.whitelist()
def get_row_total_rate(doc_context):
	"""
	Clestra Quotation 그리드 Row의 데이터를 기반으로 
	Quotation Master 수식을 시뮬레이션하여 단가를 산출합니다.
	"""
	if isinstance(doc_context, str):
		import json
		doc_context = json.loads(doc_context)

	item_code = doc_context.get("item_code")
	
	# 1. 마스터 데이터 로드 (Quotation Master)
	pricing = frappe.db.get_value("Quotation Master", {"item_code": item_code}, "*", as_dict=True)
	if not pricing:
		return {"rate": 0, "error": "Quotation Master 마스터를 찾을 수 없습니다."}
	

	# 2. 계산 환경(Context) 초기화
	# 기본적으로 마스터의 값들을 먼저 채웁니다.
	context = { 'math': math, 'flt': flt, 'ceil': ceil, 'cint': cint, 'abs': abs }
	context.update(pricing)
	# logger.debug(f"Pricing Master Loaded: {context}")
	# context.update(doc_context) # 그리드 로우 데이터로 치환

	results = {}

	# 3. 명시적 값 치환 (Substitution)
	# 그리드(row)의 실시간 입력값으로 마스터의 설정값을 덮어씁니다.
	context['ch'] = flt(doc_context.get("ch"))
	context['width'] = flt(doc_context.get("width"))

	# context['vp_rate'] = cint(doc_context.get("vp_rate"))
	
	# 유리 A 세트 치환
	context['glass_type'] = doc_context.get("glass_type_a")
	context['thk'] = flt(doc_context.get("glass_thk_a"))
	context['glass_cost'] = flt(doc_context.get("glass_cost_a"))

	# 유리 B 세트 치환 (이중 파티션 체크 시에만 적용)
	if doc_context.get("is_double_partitions"):
		context['glass_type_b'] = doc_context.get("glass_type_b")
		context['thk_b'] = flt(doc_context.get("glass_thk_b"))
		context['glass_cost_b'] = flt(doc_context.get("glass_cost_b"))
	else:
		# 체크 안되어있으면 B세트 관련 원가는 0으로 강제 치환
		context['glass_type_b'] = None
		context['thk_b'] = 0
		context['glass_cost_b'] = 0

	# logger.debug(f"Computation Context: {context}")

	special_expense_map = {
		'ab44_formula': "Glass Cleaning Fee",
		'ac33_formula': "Silicone & Caulking Works",
		'ab30_formula': "1-Ton Truck Freight"
	}

	# 4. 합계 원가 초기화 (기초 자재비 + 유리비 + 설치비)
	# 수식 결과(aa10...sp1)를 더하기 전 기본 원가들을 먼저 합산합니다.
	total_cost = 0
	# total_cost = flt(context['glass_cost']) + \
	# 			flt(context['glass_cost_b']) + \
	# 			flt(pricing.get("inst_cost", 0))

	# 5. 수식 필드 일괄 계산
	formula_fields = [
		('aa10_formula', 'aa10_result'), ('ab20_formula', 'ab20_result'),
		('ac40_formula', 'ac40_result'), ('ab44_formula', 'ab44_result'),
		('ac33_formula', 'ac33_result'), ('ab30_formula', 'ab30_result'),
		('ad43_formula', 'ad43_result'), ('ad41_formula', 'ad41_result'),
		('ab52_formula', 'ab52_result'), ('sp1_formula', 'sp1_result')
	]

	for f_field, r_field in formula_fields:
		f_name = pricing.get(f_field)
		res_val = 0
		if f_name:
			if f_field in special_expense_map:
				expense_item = special_expense_map[f_field]
				ex_rate = frappe.db.get_value("Estimate Direct Cost", {"expense_item": expense_item}, "rate")
				context['expense_rate'] = flt(ex_rate)
			else:
				# 다른 수식 계산 시 간섭하지 않도록 초기화
				context['expense_rate'] = 0
				
			f_str = frappe.db.get_value("Formula Library", f_name, "formula")
			if f_str:
				try:
					if isinstance(f_str, str) and ("if" in f_str or "\n" in f_str):
						# [조건식 또는 다중행 처리] 
						# return을 result = 으로 치환하여 context에 결과 저장
						exec_script = f"result = 0\n{f_str.replace('return', 'result =')}"
						# safe_exec를 사용하여 안전하게 실행
						safe_exec(exec_script, None, context)
						res_val = flt(context.get("result", 0))
					else:
						# [단순 수식 처리]
						res_val = flt(safe_eval(f_str, None, context))
					
					total_cost += res_val
					context[r_field] = res_val # 계산된 결과를 다음 수식에서 참조 가능하도록 주입
				except Exception as e:
					logger.error(f"Error evaluating {r_field} (Formula: {f_name}): {str(e)}")
					res_val = 0

		results[r_field] = res_val

	# 6. Target Price 산출 (마진 적용 및 1000원 단위 올림)
	mat_margin = flt(pricing.get("mat_margin", 0))
	
	# 0으로 나누기 방지
	target_price = ceil((total_cost / (1 - (mat_margin))) / 1000) * 1000

	return {
		"rate": target_price,
		"total_cost": total_cost,
		"results": results
	}


@frappe.whitelist()
def get_quotation_master_desc(item_code):
	"""Quotation Master에서 item_code에 해당하는 quotation_desc를 반환"""
	if not item_code:
		return {}

	result = frappe.db.sql("""
		SELECT name, target_price, quotation_desc, product_section
		FROM `tabQuotation Master`
		WHERE item_code = %s
		ORDER BY (quotation_desc IS NOT NULL AND quotation_desc != '') DESC,
			is_default DESC, creation DESC
		LIMIT 1
	""", item_code, as_dict=True)

	if result:
		return result[0]
	return {}


@frappe.whitelist()
def get_quotation_master_by_name(name):
	"""Quotation Master를 name으로 직접 조회"""
	if not name:
		return {}

	result = frappe.db.sql("""
		SELECT name, target_price, quotation_desc, product_section
		FROM `tabQuotation Master`
		WHERE name = %s
		LIMIT 1
	""", name, as_dict=True)

	if result:
		return result[0]
	return {}

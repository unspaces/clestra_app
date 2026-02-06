# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProductColor(Document):
    # '저장' 이벤트가 발생하기 전에 서버에서 이 메소드가 실행됩니다.
    def before_save(self):
        if self.is_conditional:
            self.generate_formula_from_rules()
        else:
            self.formula = None # 체크 해제 시 formula 필드를 비움

    def generate_formula_from_rules(self):
        # UI 레이블과 실제 시스템 필드명 매핑 (doc. 접두어는 실제 실행될 때 컨텍스트에 따라 필요)
        # 이 formula가 다른 문서의 컨텍스트에서 eval 될 것이므로 doc. 접두어를 제거합니다.
        field_map = {
            "Door Frame": "door_frame",
            "Leaf Item Code": "leaf_item_code",
            "Sub Contract": "sub_contract",
            "Door Option": "hw_options"
        }
        
        operator_map = {
            "=": "==",
            "Not Equal": "!=",
            "In": "in",
            "Not In": "not in",
        }

        rules = self.get("conditional_color_rule")

        if not rules:
            self.formula = None
            return

        code_lines = []

        # --- else 규칙과 일반 조건 규칙을 분리 ---
        conditional_rules = []
        else_rule = None

        for rule in rules:
            if rule.is_else:
                if not else_rule: # 여러 else 규칙 중 첫 번째 것만 인정
                    else_rule = rule
                else:
                    # 사용자에게 여러 else 규칙이 있음을 알림 (선택 사항)
                    frappe.msgprint("여러 개의 'Else' 규칙이 감지되었습니다. 첫 번째 규칙만 적용됩니다.", indicator="orange")
            else:
                conditional_rules.append(rule)
        
        # 우선순위(priority) 필드가 있다면 정렬
        # rules.sort(key=lambda row: row.priority)

        for i, row in enumerate(rules):
            if not (row.field_name and row.value):
                continue

            system_field_name = field_map.get(row.field_name)
            if not system_field_name:
                frappe.msgprint(f"Invalid field name in rule: {row.field_name}")
                continue
            
            condition_operator = operator_map.get(row.condition, "==")
            if not condition_operator:
                continue
            if (condition_operator not in ("in", "not in") and system_field_name in ("sub_contract", "hw_options")):
                frappe.msgprint(f"Invalid operator '{row.condition}' for field '{row.field_name}'.")
                continue
            
            value_for_code = repr(row.value)
            # else가 아닌 경우, 결과값은 result_color 필드를 사용합니다.
            color_for_code = repr(row.result_color) if row.result_color else '""'
            
            statement = "if" if i == 0 else "elif"
            
            # 여기서 doc.을 붙여줍니다. 이 코드가 실행될 환경을 고려한 것입니다.
            
            if condition_operator in ("in", "not in"):
                # 'value in doc.list' 형태로 피연산자 순서를 바꿉니다.
                # 예: 'OPT_089' in doc.hw_options
                code_lines.append(f"{statement} {value_for_code} {condition_operator} doc.{system_field_name}:")
            else:
                # 일반적인 '==' 또는 '!=' 조건
                # 예: doc.door_frame == 'DF-01'
                code_lines.append(f"{statement} doc.{system_field_name} {condition_operator} {value_for_code}:")
                
            code_lines.append(f"    return {color_for_code}")

        if else_rule:
            else_value_for_code = repr(else_rule.result_color)

            # if/elif 블록이 하나라도 있어야 else를 붙일 수 있습니다.
            if code_lines:
                code_lines.append("else:")
                code_lines.append(f"    return {else_value_for_code}")
            else: 
                # 조건 규칙이 하나도 없고 else만 있다면, 그냥 기본값을 반환하는 코드를 만듭니다.
                self.formula = f"return {else_value_for_code}"
                return

        self.formula = "\n".join(code_lines) if code_lines else None

        self.formula = "\n".join(code_lines) if code_lines else None
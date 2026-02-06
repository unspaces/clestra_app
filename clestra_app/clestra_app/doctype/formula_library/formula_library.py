# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import re  # Import regular expressions
import ast # Import Abstract Syntax Trees for basic syntax checking

# Allowed variables for different formula types
GENERAL_ALLOWED_VARS = {
    "width", "ch", "ph", "ceiling_visible", "base_visible_h",
    "under_cut", "panel_crh", "panel_trh", "abl_a", "abl_b", "leaf_width", "leaf_height",
    "qty", "height", "item_vp", "leveler_vp", "vp_rate", "joint_vp", "mat_rate", "base_vp", "clch_vp", "buffer_rate"
    # Add standard math functions or constants if needed, e.g., 'max', 'min', 'round'
    # 'max', 'min', 'round', 'pow', 'abs'
}
CONDITIONAL_CONDITION_ALLOWED_VARS = {
    "width", "height", "ch", "ph", "ceiling_visible", "base_visible_h",
    "under_cut", "panel_crh", "panel_trh", "abl_a", "abl_b",
    "leaf_width", "leaf_height", "open_width", "open_height",
    "door_frame", "astragal", "sub_contract", "leaf_item_code",
    "inst_cost", "inst_rate",
    # Python keywords used in conditions are implicitly allowed by the parser
    'and', 'or', 'not', 'in', 'is', # Common logical keywords
    # Comparison results
    'True', 'False',
    # Basic types often used in comparison
    'None'
}
CONDITIONAL_RESULT_ALLOWED_VARS = GENERAL_ALLOWED_VARS # Result formulas use the general set

# Regex to find potential variable names (Python identifiers)
# It avoids matching numbers and quoted strings.
VAR_REGEX = r'\b(?![0-9])([a-zA-Z_][a-zA-Z0-9_]*)\b'

# Simple mapping for auto-correction
LOGICAL_OPERATOR_MAP = {
    '&': 'and',
    '|': 'or',
    '&&': 'and', # Handle common alternative syntax
    '||': 'or',
}
COMPARISON_OPERATOR_MAP = {
    '=': '==', # Correct single equals for comparison
}

class FormulaLibrary(Document):
    def validate(self):
        """
        Validate event triggered before saving the document.
        Automatically generate the `formula` field if `formula_type` is 'Conditional'.
        """
        # if self.formula_type == "Conditional":
        #     self.generate_conditional_formula()
        # self._validate_general_formula_variables()
        # self._validate_conditions_and_generate_formula()

        if self.formula_type == "General":
            self._validate_general_formula()

        elif self.formula_type == "Conditional":
            self.formula = None 
            self._validate_conditions_and_generate_formula()
        
        else:
            self.formula = None 

    # def generate_conditional_formula(self):
    #     """
    #     Generate formula based on the conditions specified in the Conditions child table.
    #     The resulting formula is stored in the `formula` field.
    #     """
    #     conditions = self.get("conditions", [])
    #     if not conditions:
    #         frappe.throw("Conditions are required for Conditional Formula.")

    #     # Initialize formula code
    #     formula_code = []
    #     else_formula = None

    #     # Iterate through each condition in the child table
    #     for row in conditions:
    #         if row.else_condition:
    #             # Store Else condition result formula separately
    #             else_formula = f"    return {row.result_formula}"
    #         else:
    #             # Add condition and corresponding result formula
    #             condition_code = f"if {row.condition}:\n    return {row.result_formula}"
    #             formula_code.append(condition_code)

    #     # Combine all conditions into a single formula
    #     formula_code = "\n".join(formula_code)

    #     # Add Else condition if specified
    #     if else_formula:
    #         formula_code += f"\nelse:\n{else_formula}"

    #     # Update the formula field
    #     self.formula = formula_code
    #     frappe.msgprint("Formula has been successfully generated from Conditions.")

    # @frappe.whitelist()
    # def evaluate_formula(self, variables):
    #     """
    #     Evaluate the formula stored in the `formula` field with the given variables.

    #     Args:
    #         variables (dict): A dictionary of variables to use in the formula evaluation.

    #     Returns:
    #         result: The result of the evaluated formula.
    #     """
    #     if not self.formula:
    #         frappe.throw("No formula available to evaluate.")

    #     try:
    #         # Evaluate the formula dynamically with the provided variables
    #         result = eval(self.formula, {}, variables)
    #         return result
    #     except Exception as e:
    #         frappe.log_error(f"Error evaluating formula: {str(e)}", "Formula Evaluation Error")
    #         frappe.throw(f"Error evaluating formula: {str(e)}")

    def _validate_general_formula(self): # 새로운 메소드 또는 _validate_general_formula_variables 이름 변경
        """Validate variables and syntax for a 'General' type formula."""
        if not self.formula: # General 타입인데 formula가 비어있으면 경고 또는 오류 처리 가능
            # frappe.msgprint("General Formula is empty.", indicator='orange')
            return # 또는 frappe.throw("General Formula cannot be empty.")

        # Check syntax first
        syntax_error = self._validate_syntax(self.formula, context='expression')
        if syntax_error:
            frappe.throw(f"Syntax Error in General Formula: {syntax_error}", title="Invalid Syntax")

        # Check variables
        invalid_vars = self._find_invalid_variables(self.formula, GENERAL_ALLOWED_VARS)
        if invalid_vars:
            frappe.msgprint(
                f"Warning: The General Formula might use unallowed variables: {', '.join(invalid_vars)}. "
                f"Allowed variables are: {', '.join(GENERAL_ALLOWED_VARS)}",
                title="Potential Variable Mismatch",
                indicator='orange'
            )
    
    # def _validate_general_formula_variables(self):
    #     """Validate variables used in a 'General' type formula."""
    #     if self.formula_type == "General" and self.formula:
    #         # Check syntax first
    #         syntax_error = self._validate_syntax(self.formula, context='expression')
    #         if syntax_error:
    #             frappe.throw(f"Syntax Error in General Formula: {syntax_error}", title="Invalid Syntax")

    #         # Check variables
    #         invalid_vars = self._find_invalid_variables(self.formula, GENERAL_ALLOWED_VARS)
    #         if invalid_vars:
    #             frappe.msgprint(
    #                 f"Warning: The General Formula might use unallowed variables: {', '.join(invalid_vars)}. "
    #                 f"Allowed variables are: {', '.join(GENERAL_ALLOWED_VARS)}",
    #                 title="Potential Variable Mismatch",
    #                 indicator='orange'
    #             )

    def _validate_conditions_and_generate_formula(self):
        """
        Validate conditions and result formulas for 'Conditional' type.
        Generate the final formula string with corrections and checks.
        """
        conditions = self.get("conditions", [])
        if not conditions:
            self.formula = None # Clear formula if no conditions
            # No throw needed, might be intentional
            return

        formula_parts = []
        warnings = []
        errors = []
        has_else = False
        last_row_index = len(conditions) - 1

        for i, row in enumerate(conditions):
            is_last_row = (i == last_row_index)
            prefix = "if" if i == 0 else "elif" # Use elif for subsequent conditions

            corrected_condition = row.condition
            corrected_result = row.result_formula

            # --- Handle Automatic Else Condition ---
            # If it's the last row, has no condition, but has a result formula -> treat as else
            if is_last_row and not row.condition and row.result_formula:
                row.else_condition = 1 # Auto-check the box
                frappe.msgprint(f"Row #{row.idx}: Automatically marked as 'Else Condition' because it's the last row with no condition but a result formula.", title="Auto Else Condition", indicator='blue')

            # --- Process Row based on whether it's an Else or Condition ---
            if row.else_condition:
                if has_else:
                    errors.append(f"Row #{row.idx}: Multiple 'Else' conditions defined. Only one is allowed.")
                    continue # Skip processing this row further

                if not corrected_result:
                    errors.append(f"Row #{row.idx}: 'Else' condition must have a 'Result Formula'.")
                    continue

                has_else = True
                prefix = "else" # Will be added later
                condition_code = "" # No condition part for else

                # Validate Else Result Formula
                corrected_result, result_warnings, result_errors = self._process_formula_string(
                    corrected_result, CONDITIONAL_RESULT_ALLOWED_VARS, context="expression", row_idx=row.idx, field_name="Result Formula"
                )
                warnings.extend(result_warnings)
                errors.extend(result_errors)

                formula_parts.append({
                    "type": "else",
                    "result": corrected_result
                })

            elif corrected_condition and corrected_result:
                # --- Process Condition ---
                corrected_condition, cond_warnings, cond_errors = self._process_formula_string(
                    corrected_condition, CONDITIONAL_CONDITION_ALLOWED_VARS, context="condition", row_idx=row.idx, field_name="Condition"
                )
                warnings.extend(cond_warnings)
                errors.extend(cond_errors)

                # --- Process Result Formula ---
                corrected_result, result_warnings, result_errors = self._process_formula_string(
                    corrected_result, CONDITIONAL_RESULT_ALLOWED_VARS, context="expression", row_idx=row.idx, field_name="Result Formula"
                )
                warnings.extend(result_warnings)
                errors.extend(result_errors)

                formula_parts.append({
                    "type": "conditional",
                    "prefix": prefix,
                    "condition": corrected_condition,
                    "result": corrected_result
                })
            elif not corrected_result:
                 errors.append(f"Row #{row.idx}: 'Result Formula' is missing.")
            # Handle case where condition is missing but it's not the last row intended as else
            elif not corrected_condition and not is_last_row:
                 errors.append(f"Row #{row.idx}: 'Condition' is missing for a non-else row.")


        # --- Assemble the final formula ---
        if errors:
            frappe.throw(f"Please fix the following errors in Conditions:<br>- {'<br>- '.join(errors)}", title="Validation Errors")

        final_formula_code = []
        else_part = None
        for part in formula_parts:
            if part["type"] == "conditional":
                final_formula_code.append(f"{part['prefix']} {part['condition']}:\n    return {part['result']}")
            elif part["type"] == "else":
                else_part = f"else:\n    return {part['result']}"

        # Check if the first condition was actually an else (shouldn't happen if logic above is correct, but safe check)
        if not final_formula_code and else_part:
             frappe.throw("Cannot have only an 'Else' condition without preceding 'If'/'Elif' conditions.")

        formula_string = "\n".join(final_formula_code)
        if else_part:
            formula_string += f"\n{else_part}"

        # Final check on the assembled code block
        if formula_string.strip(): # 실제 코드가 있을 때만 검사
            validation_code = f"def __dummy_validation_func__():\n"
            # Indent the generated formula to place it inside the dummy function
            indented_formula = "\n".join(["    " + line for line in formula_string.splitlines()])
            validation_code += indented_formula
            # Add a default return or pass in case no conditions match (though 'return' should exist)
            # validation_code += "\n    return None" # Optional: add default return for stricter check

            final_syntax_error = self._validate_syntax(validation_code, context='exec') # Validate the wrapped code
        else:
             final_syntax_error = None # No code to validate
             
        if final_syntax_error:
             # This usually indicates an issue with the if/elif/else structure itself
             frappe.throw(f"Generated formula has an invalid structure: {final_syntax_error}. Check the order and conditions.", title="Formula Generation Error")

        self.formula = formula_string

        # Show warnings if any
        if warnings:
            frappe.msgprint(f"Please review the following warnings:<br>- {'<br>- '.join(warnings)}", title="Validation Warnings", indicator='orange')

        # Only show success if no errors/warnings or only warnings
        if not errors:
             frappe.msgprint("Formula validation passed (review warnings if any). Formula field updated.", title="Validation Successful", indicator='green' if not warnings else 'orange')


    def _process_formula_string(self, formula_str, allowed_vars, context="expression", row_idx=0, field_name="Formula"):
        """Helper to correct, validate variables, and check syntax for a formula string."""
        warnings = []
        errors = []
        corrected_str = formula_str.strip() if formula_str else ""

        if not corrected_str:
             return "", warnings, errors

        # --- Auto Corrections ---

        # 1. 표준화: 대문자 논리 연산자 -> 소문자
        standardization_map = {
            r'\bAND\b': ' and ',
            r'\bOR\b': ' or ',
            r'\bNOT\b': ' not '
        }
        for pattern, replacement in standardization_map.items():
             new_str = re.sub(pattern, replacement, corrected_str, flags=re.IGNORECASE) # IGNORECASE 추가
             if new_str != corrected_str:
                 warnings.append(f"Row #{row_idx} ({field_name}): Standardized logical operator case (e.g., AND -> and).")
                 corrected_str = new_str

        # 2. 표준화: 기호 논리 연산자 -> 키워드
        for op, replacement in LOGICAL_OPERATOR_MAP.items():
            # Use regex to replace only whole operators, not parts of variable names
            # Ensure spaces around the replacement keyword
            new_str = re.sub(r'(?<![&|])\s*' + re.escape(op) + r'\s*(?![&|])', f' {replacement} ', corrected_str)
            if new_str != corrected_str:
                warnings.append(f"Row #{row_idx} ({field_name}): Corrected logical operator '{op}' to '{replacement}'.")
                corrected_str = new_str

        # 3. 표준화: 비교 연산자 (= -> ==)
        # Looks for '=' not preceded or followed by other relevant operators
        new_str = re.sub(r'(?<![!><=])\s*=\s*(?![=])', ' == ', corrected_str)
        if new_str != corrected_str:
            warnings.append(f"Row #{row_idx} ({field_name}): Corrected '=' to '==' for comparison.")
            corrected_str = new_str

        # 4. 산술 연산자 자동 수정 (곱셈 누락)
        # 4.1: 숫자 다음에 바로 괄호 오는 경우 (e.g., "2(x+y)" -> "2 * (x+y)")
        new_str = re.sub(r'(\b[0-9]+(?:\.[0-9]+)?)\s*\(', r'\1 * (', corrected_str)
        if new_str != corrected_str:
            warnings.append(f"Row #{row_idx} ({field_name}): Added missing '*' between number and parenthesis.")
            corrected_str = new_str

        # 4.2: 닫는 괄호 다음에 변수/여는괄호 오는 경우 (개선된 Regex)
        # Negative lookahead (?!) 추가: 뒤에 오는 것이 and, or, not, +, -, *, /, 비교 연산자 등이 아닌 경우에만 적용
        excluded_keywords = r'(?:and|or|not|\+|-|\*\*?|/|%|==|!=|<=|>=|<|>|in|is)\b' # 제외할 키워드/연산자
        # Regex: 닫는괄호 + 공백 + (제외키워드가 아니고) + (변수시작 또는 여는괄호)
        new_str = re.sub(r'\)\s*(?!' + excluded_keywords + r')([a-zA-Z_(])', r') * \1', corrected_str)
        if new_str != corrected_str:
            warnings.append(f"Row #{row_idx} ({field_name}): Added missing '*' between closing parenthesis and next element (variable/parenthesis).")
            corrected_str = new_str


        # --- Validations ---
        # Check syntax
        syntax_error = self._validate_syntax(corrected_str, context=context)
        if syntax_error:
            errors.append(f"Row #{row_idx} ({field_name}): Syntax Error: {syntax_error}")
            # Return original string if syntax error to avoid saving broken corrections
            return formula_str, warnings, errors

        # Check variables
        invalid_vars = self._find_invalid_variables(corrected_str, allowed_vars)
        if invalid_vars:
            warnings.append(
                f"Row #{row_idx} ({field_name}): Uses potentially unallowed variables: {', '.join(invalid_vars)}. "
            )

        return corrected_str, warnings, errors


    def _find_invalid_variables(self, text, allowed_vars):
        """Finds identifiers in text that are not in the allowed list or Python keywords."""
        if not text:
            return []

        potential_vars = re.findall(VAR_REGEX, text)
        invalid_vars = set()

        # Get Python keywords to exclude them
        import keyword
        python_keywords = set(keyword.kwlist)

        for var in potential_vars:
            if var not in allowed_vars and var not in python_keywords:
                invalid_vars.add(var)

        return list(invalid_vars)


    def _validate_syntax(self, code_string, context="expression"):
        """Check Python syntax using compile(). Returns error message or None."""
        try:
            mode = 'eval' if context == "expression" or context == "condition" else 'exec'
            # For conditions/expressions, wrap in something evaluatable if needed for 'exec' mode check
            # For simplicity, conditions are also checked with 'eval' as they should be boolean expressions
            if mode == 'exec':
                 compile(code_string, '<string>', mode)
            else:
                 compile(code_string, '<string>', 'eval') # Check if it's a valid expression
            return None # No syntax error
        except SyntaxError as e:
            return str(e)
        except Exception as e:
            # Catch other potential compilation errors
            return f"Unexpected compilation error: {str(e)}"


    # evaluate_formula method remains the same as it's for execution, not validation.
    @frappe.whitelist()
    def evaluate_formula(self, variables):
        """
        Evaluate the formula stored in the `formula` field with the given variables.

        Args:
            variables (dict): A dictionary of variables to use in the formula evaluation.

        Returns:
            result: The result of the evaluated formula.
        """
        if not self.formula:
            frappe.throw("No formula available to evaluate.")

        # Ensure variables only contain allowed keys for security? Optional.
        # eval_vars = {k: v for k, v in variables.items() if k in GENERAL_ALLOWED_VARS or k in CONDITIONAL_CONDITION_ALLOWED_VARS}
        eval_vars = variables # Use provided variables directly for now

        try:
            # Create a safe execution environment? For now, using standard eval/exec.
            # Use exec for the potentially multi-line conditional formula string
            local_namespace = {}
            global_namespace = {"max": max, "min": min, "round": round, "pow": pow, "abs": abs} # Provide safe built-ins
            exec_code = f"def __temp_formula_func__():\n{self.formula.replace('return', 'return')}" # Define function
            exec(exec_code, global_namespace, local_namespace) # Execute function definition
            # Call the defined function with variables as arguments or accessible within scope?
            # Simpler approach: Inject variables into the execution context of the function's body.
            # This requires modifying the generated formula slightly if it relies on direct variable access.
            # Let's stick to the original generate_conditional_formula approach's output format
            # and assume the formula string is directly executable or evaluatable.

            # Revisit: The generated formula uses 'return'. `eval` cannot handle multi-line or return statements.
            # We need to use `exec` to run the generated code.

            # --- Execution using exec ---
            # Prepare the context for exec
            exec_context = {**global_namespace, **eval_vars} # Combine globals and user vars

            # Modify the generated formula slightly for exec to capture the return value
            exec_formula_code = "result_value = None\n" # Initialize result variable
            # Indent the generated formula to put it inside a function scope (optional but cleaner)
            indented_formula = "\n".join(["    " + line for line in self.formula.splitlines()])
            exec_formula_code += f"def __exec_formula__():\n{indented_formula}\n    return None # Default return if no condition met\n"
            exec_formula_code += "result_value = __exec_formula__()" # Call the inner function

            exec(exec_formula_code, exec_context) # Execute the code
            result = exec_context.get('result_value') # Get the result

            # Original eval approach (only works for single expressions):
            # result = eval(self.formula, {"max": max, "min": min}, eval_vars)

            return result
        except SyntaxError as e:
             frappe.log_error(f"Syntax error during formula evaluation: {str(e)}\nFormula:\n{self.formula}", "Formula Evaluation Error")
             frappe.throw(f"Syntax error evaluating formula: {str(e)}")
        except NameError as e:
             frappe.log_error(f"Name error during formula evaluation: {str(e)}. Check if all variables were provided.\nFormula:\n{self.formula}\nVariables:\n{variables}", "Formula Evaluation Error")
             frappe.throw(f"Variable error evaluating formula: {str(e)}. Ensure all needed variables ({list(GENERAL_ALLOWED_VARS)}) are provided.")
        except Exception as e:
            frappe.log_error(f"Error evaluating formula: {str(e)}\nFormula:\n{self.formula}\nVariables:\n{variables}", "Formula Evaluation Error")
            frappe.throw(f"Error evaluating formula: {str(e)}")
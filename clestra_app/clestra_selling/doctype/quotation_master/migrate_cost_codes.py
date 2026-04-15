"""
Migration script: 기존 개별 cost code 필드 → cost_code_items child table 으로 데이터 복사.

사용법:
    bench --site <site> execute clestra_app.clestra_selling.doctype.quotation_master.migrate_cost_codes.run
"""

import frappe
from frappe.utils import flt

# 마이그레이션 대상 cost code 목록
COST_CODES = ["AB44", "AC33", "AB30", "AC34", "AD43", "AD41", "AB52", "SP1"]


def run():
    docs = frappe.get_all("Quotation Master", pluck="name")
    migrated = 0
    skipped = 0

    for doc_name in docs:
        doc = frappe.get_doc("Quotation Master", doc_name)

        # 이미 존재하는 cost_code 목록
        existing_codes = {row.cost_code for row in (doc.get("cost_code_items") or [])}

        rows_added = False
        for code in COST_CODES:
            code_lower = code.lower()
            skip_field = code_lower + "_skip"
            formula_field = code_lower + "_formula"
            result_field = code_lower + "_result"

            # 이미 존재하면 skip
            if code in existing_codes:
                continue

            formula_val = doc.get(formula_field)
            result_val = flt(doc.get(result_field))

            # formula가 없으면 skip (result만 있는 경우는 없으므로)
            if not formula_val:
                continue

            doc.append("cost_code_items", {
                "cost_code": code,
                "formula": formula_val or "",
                "result": result_val,
            })
            rows_added = True

        if rows_added:
            doc.flags.ignore_validate = True
            doc.flags.ignore_permissions = True
            doc.save()
            migrated += 1

    frappe.db.commit()
    print(f"Migration complete: {migrated} docs migrated, {skipped} docs skipped (already had cost_code_items)")

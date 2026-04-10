"""
Migration script: 기존 개별 cost code 필드 → cost_code_items child table 으로 데이터 복사.

사용법:
    bench --site <site> execute clestra_app.clestra_selling.doctype.quotation_pricing.migrate_cost_codes.run
"""

import frappe
from frappe.utils import flt

# 마이그레이션 대상 cost code 목록
COST_CODES = ["AB44", "AC33", "AB30", "AC34", "AD43", "AD41", "AB52", "SP1"]


def run():
    docs = frappe.get_all("Quotation Pricing", pluck="name")
    migrated = 0
    skipped = 0

    for doc_name in docs:
        doc = frappe.get_doc("Quotation Pricing", doc_name)

        # 이미 cost_code_items가 있으면 skip
        if doc.get("cost_code_items"):
            skipped += 1
            continue

        rows_added = False
        for code in COST_CODES:
            code_lower = code.lower()
            skip_field = code_lower + "_skip"
            formula_field = code_lower + "_formula"
            result_field = code_lower + "_result"

            # _skip 체크된 경우 row 추가하지 않음
            if doc.get(skip_field):
                continue

            formula_val = doc.get(formula_field)
            result_val = flt(doc.get(result_field))

            # formula도 없고 result도 0이면 skip
            if not formula_val and not result_val:
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

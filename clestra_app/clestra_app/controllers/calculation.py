import json

import frappe
from frappe import _, scrub
from frappe.model.document import Document
from frappe.utils import cint, flt, round_based_on_smallest_currency_fraction

import erpnext
from erpnext.accounts.doctype.journal_entry.journal_entry import get_exchange_rate
from erpnext.accounts.doctype.pricing_rule.utils import get_applied_pricing_rules
from erpnext.controllers.accounts_controller import (
	validate_conversion_rate,
	validate_inclusive_tax,
	validate_taxes_and_charges,
)
from erpnext.stock.get_item_details import _get_item_tax_template
from erpnext.utilities.regional import temporary_flag

# def __init__(self, doc: Document):
#     self.doc = doc
#     self._items = self.filter_rows() if self.doc.doctype == "Items" else self.doc.get("items")
#     self.calculate_item_values()

# def filter_rows(self):
#     """Exclude rows, that do not fulfill the filter criteria, from totals computation."""
#     items = list(filter(lambda item: not item.get("is_alternative"), self.doc.get("items")))
#     return items

@frappe.whitelist()
def calculate_item_values(doc):
    # Check if the doc is a string and parse it
    if isinstance(doc, str):
        doc = frappe.parse_json(doc)
        doc = frappe.get_doc(doc)

    # Access the child table field named 'quotation_item'
    items = doc.get("quotation_item", [])

    # Initialize the total amount
    total_amount = 0.0

    # Process each item in the child table
    for item in items:
        qty = item.get('quantity')
        rate = item.get('rate')
        vp_id = item.get('vp')

        vp = frappe.get_value("VP", vp_id, "vp")

        # Debugging logs to check values
        frappe.log_error(message=f"Qty: {qty}, Rate: {rate}, VP: {vp}", title="Debugging Item Calculation")
        
        if not qty or not rate or not vp:
            item.amount = 0  # Directly set the value using dot notation
            item.base_amount = 0
        else:
            amount = flt(rate * qty * vp)
            item.amount = amount  # Directly set the value using dot notation
            total_amount += amount  # Add the amount to the total

    # 회사 통화로 변환된 값을 설정
    # set_in_company_currency(doc, ["amount"])

    return {
        "items": items,
        "quotation_total": total_amount
    }

# @frappe.whitelist()
# def set_in_company_currency(doc, fields):
#     """Set values in the specified fields to company currency."""
#     # Iterate over the specified fields and convert them
#     for field in fields:
#         field_value = flt(doc.get(field), doc.precision(field))
#         base_value = flt(field_value , doc.precision(field))
#         doc.set(f"base_{field}", base_value)

#     return doc

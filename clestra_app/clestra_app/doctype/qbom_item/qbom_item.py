# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class QBOMItem(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        allow_alternative_item: DF.Check
        amount: DF.Currency
        base_amount: DF.Currency
        base_rate: DF.Currency
        qbom_no: DF.Link | None  # 기존 bom_no를 qbom_no로 변경
        conversion_factor: DF.Float
        description: DF.TextEditor | None
        do_not_explode: DF.Check
        has_variants: DF.Check
        image: DF.Attach | None
        item_code: DF.Link
        item_name: DF.Data | None
        # operation: DF.Link | None
        original_item: DF.Link | None
        parent: DF.Data
        parentfield: DF.Data
        parenttype: DF.Data
        qty: DF.Float
        qty_consumed_per_unit: DF.Float
        rate: DF.Currency
        source_warehouse: DF.Link | None
        sourced_by_supplier: DF.Check
        stock_qty: DF.Float
        stock_uom: DF.Link | None
        uom: DF.Link
    # end: auto-generated types

    pass
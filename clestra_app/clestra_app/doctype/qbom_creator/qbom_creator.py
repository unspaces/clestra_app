# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

from collections import OrderedDict

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt

# from clestra_app.clestra_app.doctype.qbom.qbom import get_qbom_item_rate

QBOM_FIELDS = [
    "company",
    "rm_cost_as_per",
    "project",
    "currency",
    "buying_price_list",
]
QBOM_ITEM_FIELDS = [
    "item_code",
    "qty",
    "uom",
    "rate",
    "stock_qty",
    "stock_uom",
    # "conversion_factor",
    "do_not_explode",
]


class QBOMCreator(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF

        from clestra_app.clestra_app.doctype.qbom_creator_item.qbom_creator_item import QBOMCreatorItem
        
        amount: DF.Currency
        amended_from: DF.Link | None
        buying_price_list: DF.Link | None
        company: DF.Link
        currency: DF.Link
        default_warehouse: DF.Link | None
        error_log: DF.Text | None
        item_code: DF.Link
        item_group: DF.Link | None
        item_name: DF.Data | None
        items: DF.Table[QBOMCreatorItem]
        price_list_currency: DF.Link | None
        project: DF.Link | None
        qty: DF.Float
        raw_material_cost: DF.Currency
        rate: DF.Currency
        vp: DF.Int
        remarks: DF.TextEditor | None
        rm_cost_as_per: DF.Literal["Valuation Rate", "Last Purchase Rate", "Price List"]
        set_rate_based_on_warehouse: DF.Check
        status: DF.Literal["Draft", "Submitted", "In Progress", "Completed", "Failed", "Cancelled"]
        uom: DF.Link | None
    # end: auto-generated types
    # pass


    def before_save(self):
        self.set_status()
        self.set_is_expandable()
        # self.set_conversion_factor()
        self.set_reference_id()
        if not self.is_new():
            self.set_ttl_amount_for_items()
        
    def validate(self):
        self.validate_items()
        self.check_rename_permission()

    def validate_items(self):
        for row in self.items:
            if row.is_expandable and row.item_code == self.item_code:
                frappe.throw(_("Item {0} cannot be added as a sub-assembly of itself").format(row.item_code))

            if not row.parent_row_no and row.fg_item and row.fg_item != self.item_code:
                frappe.throw(
                    _("At row {0}: set Parent Row No for item {1}").format(row.idx, row.item_code),
                    title=_("Set Parent Row No in Items Table"),
                )
            elif row.parent_row_no and row.fg_item == self.item_code:
                frappe.throw(
                    _("At row {0}: Parent Row No cannot be set for item {1}").format(row.idx, row.item_code),
                    title=_("Remove Parent Row No in Items Table"),
                )

    def check_rename_permission(self):
        if not self.is_new() and self.name != self.get_db_value("name"):
            self.rename_qbom()

    def rename_qbom(self):
        new_name = self.new_docname  # Ensure new_docname is set correctly
        old_name = self.name
        
        frappe.logger().info(f"Attempting to rename from {old_name} to {new_name}")
        
        if new_name != old_name:
            frappe.rename_doc(self.doctype, old_name, new_name, force=True)
            self.name = new_name

    def set_status(self, save=False):
        self.status = {
            0: "Draft",
            1: "Submitted",
            2: "Cancelled",
        }[self.docstatus]

        self.set_status_completed()
        if save:
            self.db_set("status", self.status)

    def set_status_completed(self):
        if self.docstatus != 1:
            return
        
        has_completed = True
        for row in self.items:
            if row.is_expandable and not row.qbom_created:
                has_completed = False
                break

        if not frappe.get_cached_value("QBOM", {"qbom_creator": self.name, "item": self.item_code}, "name"):
            has_completed = False

        if has_completed:
            self.status = "Completed"

    def on_cancel(self):
        self.set_status(True)

    # def set_conversion_factor(self):
    #     for row in self.items:
    #         row.conversion_factor = 1.0

    def before_submit(self):
        self.validate_fields()
        self.set_status()

    def set_reference_id(self):
        parent_reference = {row.idx: row.name for row in self.items}

        for row in self.items:
            ref_id = ""

            if row.parent_row_no:
                ref_id = parent_reference.get(cint(row.parent_row_no))

            # Check whether the reference id of the FG Item has correct or not
            if row.fg_reference_id and row.fg_reference_id == ref_id:
                continue
            
            if row.parent_row_no:
                row.fg_reference_id = ref_id
            elif row.fg_item == self.item_code:
                row.fg_reference_id = self.name

    @frappe.whitelist()
    def add_qboms(self):
        self.submit()

    def set_ttl_amount_for_items(self):
        vp = self.vp

        # 루트 아이템의 Amount 계산
        if self.excluding_vp == 1:
            self.amount = flt(self.rate) * flt(self.qty)
        else:
            self.amount = flt(self.rate) * flt(self.qty) * vp

        total_amount = self.get_raw_material_cost()
        self.raw_material_cost = total_amount + self.amount

    def get_raw_material_cost(self, fg_reference_id=None, total_amount=0):
        vp = self.vp

        if not fg_reference_id:
            fg_reference_id = self.name

        for row in self.items:
            if row.fg_reference_id != fg_reference_id:
                continue

            # 각 row에 대해 'Excluding VP' 체크 여부 확인
            # excluding_vp = getattr(row, 'excluding_vp', False)  

            if row.excluding_vp == 1:
                row.amount = flt(row.rate) * flt(row.qty)
            else:
                row.amount = flt(row.rate) * flt(row.qty) * vp
        
            total_amount += flt(row.amount)

        frappe.logger().info(f"Total Amount: {total_amount}")
        return total_amount
    
    def set_is_expandable(self):
        fg_items = [row.fg_item for row in self.items if row.fg_item != self.item_code]
        for row in self.items:
            row.is_expandable = 0
            if row.item_code in fg_items:
                row.is_expandable = 1
                
    def validate_fields(self):
        fields = {
            "items": "Items",
        }

        for field, label in fields.items():
            if not self.get(field):
                frappe.throw(_("Please set {0} in QBOM Creator {1}").format(label, self.name))

    def on_submit(self):
        self.enqueue_create_qboms()

    @frappe.whitelist()
    def enqueue_create_qboms(self):
        frappe.enqueue(
            self.create_qboms,
            queue="short",
            timeout=600,
            is_async=True,
        )

        frappe.msgprint(
            _("QBOMs creation has been enqueued, kindly check the status after some time"), alert=True
        )

    def create_qboms(self):
        self.db_set("status", "In Progress")
        production_item_wise_rm = OrderedDict({})
        production_item_wise_rm.setdefault(
            (self.item_code, self.name), frappe._dict({"items": [], "qbom_no": "", "fg_item_data": self})
        )

        for row in self.items:
            if row.is_expandable:
                if (row.item_code, row.name) not in production_item_wise_rm:
                    production_item_wise_rm.setdefault(
                        (row.item_code, row.name),
                        frappe._dict({"items": [], "qbom_no": "", "fg_item_data": row}),
                    )

            if not row.fg_reference_id and production_item_wise_rm.get((row.fg_item, row.fg_reference_id)):
                frappe.throw(_("Please set Parent Row No for item {0}").format(row.fg_item))

            production_item_wise_rm[(row.fg_item, row.fg_reference_id)]["items"].append(row)

        reverse_tree = OrderedDict(reversed(list(production_item_wise_rm.items())))

        try:
            for d in reverse_tree:
                fg_item_data = production_item_wise_rm.get(d).fg_item_data
                self.create_qbom(fg_item_data, production_item_wise_rm)
                
            frappe.msgprint(_("QBOMs created successfully"))
        except Exception:
            traceback = frappe.get_traceback(with_context=True)
            self.db_set(
                {
                    "status": "Failed",
                    "error_log": traceback,
                }
            )
            frappe.msgprint(_("QBOMs creation failed"))

    def create_qbom(self, row, production_item_wise_rm):
        qbom_creator_item = row.name if row.name != self.name else ""
        if frappe.db.exists(
            "QBOM",
            {
                "qbom_creator": self.name,
                "item": row.item_code,
                "qbom_creator_item": qbom_creator_item,
                "docstatus": 1,
            },
        ):
            return
        
        qbom = frappe.new_doc("QBOM")
        qbom.update(
            {
                "item": row.item_code,
                "qbom_type": "Production",
                "quantity": row.qty,
                "allow_alternative_item": 1,
                "qbom_creator": self.name,
                "qbom_creator_item": qbom_creator_item,
            }
        )

        for field in QBOM_FIELDS:
            if self.get(field):
                qbom.set(field, self.get(field))

        for item in production_item_wise_rm[(row.item_code, row.name)]["items"]:
            qbom_no = ""
            item.do_not_explode = 1
            if (item.item_code, item.name) in production_item_wise_rm:
                qbom_no = production_item_wise_rm.get((item.item_code, item.name)).qbom_no
                item.do_not_explode = 0

            item_args = {}
            for field in QBOM_ITEM_FIELDS:
                item_args[field] = item.get(field)

            item_args.update(
                {
                    "qbom_no": qbom_no,
                    "allow_alternative_item": 1,
                }
            )
            qbom.append("items", item_args)

        qbom.save(ignore_permissions=True)
        qbom.submit()

        production_item_wise_rm[(row.item_code, row.name)].qbom_no = qbom.name

    @frappe.whitelist()
    def get_default_qbom(self, item_code) -> str:
        return frappe.get_cached_value("Item", item_code, "default_qbom")
    
    
@frappe.whitelist()
def get_children(doctype=None, parent=None, **kwargs):
    if isinstance(kwargs, str):
        kwargs = frappe.parse_json(kwargs)
        
    if isinstance(kwargs, dict):
        kwargs = frappe._dict(kwargs)
            
    fields = [
        "item_code as value",
        "is_expandable as expandable",
        "parent as parent_id",
        "qty",
        "idx",
        "'QBOM Creator Item' as doctype",
        "name",
        "uom",
        "rate",
        "amount",
        "excluding_vp",
    ]
        
    query_filters = {
        "fg_item": parent,
        "parent": kwargs.parent_id,
    }
        
    if kwargs.name:
        query_filters["name"] = kwargs.name
    
    return frappe.get_all("QBOM Creator Item", fields=fields, filters=query_filters, order_by="idx")
        
@frappe.whitelist()
def add_item(**kwargs):
    if isinstance(kwargs, str):
        kwargs = frappe.parse_json(kwargs)

    if isinstance(kwargs, dict):
        kwargs = frappe._dict(kwargs)

    doc = frappe.get_doc("QBOM Creator", kwargs.parent)
    item_info = get_item_details(kwargs.item_code)
    kwargs.update(
        {
            "uom": item_info.stock_uom,
            "stock_uom": item_info.stock_uom,
            # "conversion_factor": 1
        }
    )

    doc.append("items", kwargs)
    doc.save()

    return doc

@frappe.whitelist()
def add_sub_assembly(**kwargs):
    if isinstance(kwargs, str):
        kwargs = frappe.parse_json(kwargs)

    if isinstance(kwargs, dict):
        kwargs = frappe._dict(kwargs)

    doc = frappe.get_doc("QBOM Creator", kwargs.parent)
    qbom_item = frappe.parse_json(kwargs.qbom_item)

    name = kwargs.fg_reference_id
    parent_row_no = ""
    if not kwargs.convert_to_sub_assembly:
        item_info = get_item_details(qbom_item.item_code)
        item_row = doc.append(
            "items",
            {
                "item_code": qbom_item.item_code,
                "qty": qbom_item.qty,
                "uom": item_info.stock_uom,
                "fg_item": kwargs.fg_item,
                # "conversion_factor": 1,
                "fg_reference_id": name,
                "stock_qty": qbom_item.qty,
                "do_not_explode": 1,
                "is_expandable": 1,
                "stock_uom": item_info.stock_uom,
            },
        )

        parent_row_no = item_row.idx
        name = ""
    else:
        parent_row_no = [row.idx for row in doc.items if row.name == kwargs.fg_reference_id]
        if parent_row_no:
            parent_row_no = parent_row_no[0]

    for row in qbom_item.get("items"):
        row = frappe._dict(row)
        item_info = get_item_details(row.item_code)
        doc.append(
            "items",
            {
                "item_code": row.item_code,
                "qty": row.qty,
                "fg_item": qbom_item.item_code,
                "uom": item_info.stock_uom,
                "fg_reference_id": name,
                "parent_row_no": parent_row_no,
                # "conversion_factor": 1,
                "do_not_explode": 1,
                "stock_qty": row.qty,
                "stock_uom": item_info.stock_uom,
            },
        )
    doc.save()

    return doc

def get_item_details(item_code):
    return frappe.get_cached_value(
        "Item", item_code, ["item_name", "description", "image", "stock_uom", "default_qbom", "rate"], as_dict=1
    )
    
@frappe.whitelist()
def delete_node(**kwargs):
    if isinstance(kwargs, str):
        kwargs = frappe.parse_json(kwargs)

    if isinstance(kwargs, dict):
        kwargs = frappe._dict(kwargs)

    items = get_children(parent=kwargs.fg_item, parent_id=kwargs.parent)
    if kwargs.docname:
        frappe.delete_doc("QBOM Creator Item", kwargs.docname)

    for item in items:
        frappe.delete_doc("QBOM Creator Item", item.name)
        if item.expandable:
            delete_node(fg_item=item.value, parent=item.parent_id)

    doc = frappe.get_doc("QBOM Creator", kwargs.parent)
    doc.set_ttl_amount_for_items()
    doc.save()

    return doc


@frappe.whitelist()
def edit_item(doctype, docname, qty, parent, item_code, rate, excluding_vp):

    frappe.db.set_value(doctype, docname, "item_code", item_code)
    frappe.db.set_value(doctype, docname, "qty", qty)
    frappe.db.set_value(doctype, docname, "rate", rate)
    frappe.db.set_value(doctype, docname, "excluding_vp", excluding_vp)

    doc = frappe.get_doc("QBOM Creator", parent)
    doc.set_ttl_amount_for_items()
    doc.save()
    frappe.db.commit()
    
    return doc
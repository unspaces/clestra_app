# Copyright (c) 2025, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class GridTest(Document):
    def onload(self):
        if self.get("po_items"):
            for item_row in self.get("po_items"):
                item_row.virtual_field_1 = 5
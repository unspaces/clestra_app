# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class QRItemLookup(Document):
	def before_save(self):
		if not self.is_active and not self.deactivated_on:
			self.deactivated_on = frappe.utils.now_datetime()
		elif self.is_active and self.deactivated_on:
			self.deactivated_on = None

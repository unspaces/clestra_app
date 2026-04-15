# Copyright (c) 2025, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DoorHardwareSpec(Document):
	def autoname(self):
		if self.is_template:
			self.name = f"TPL-{self.template_name}"
		else:
			from frappe.model.naming import make_autoname
			self.name = make_autoname(f"{self.project_name}-{self.hw_spec_code}-.##", ignore_validate=True)

	def before_insert(self):
		if self.load_from_template and not self.is_template:
			self._apply_template()

	def _apply_template(self):
		tpl = frappe.get_doc("Door Hardware Spec", self.load_from_template)

		skip_fields = {
			"name", "owner", "creation", "modified", "modified_by",
			"docstatus", "idx", "doctype",
			"is_template", "template_name", "load_from_template",
			"project", "project_name", "hw_spec_code",
		}
		layout_types = {"Section Break", "Column Break", "Heading", "Tab Break"}

		for df in self.meta.fields:
			if df.fieldname in skip_fields:
				continue
			if df.fieldtype in layout_types:
				continue

			tpl_val = tpl.get(df.fieldname)
			current_val = self.get(df.fieldname)

			# Template 값이 있고, 현재 문서에 이미 값이 입력되지 않은 경우만 복사
			if tpl_val is not None and tpl_val != "" and not current_val:
				self.set(df.fieldname, tpl_val)

		# door_open_type, door_set_type으로 hw_spec_code 자동 생성
		if self.door_open_type and self.door_set_type:
			open_map = {"Swing": "SW", "Sliding": "SL"}
			set_map = {"Single": "S", "Pair": "P"}
			open_code = open_map.get(self.door_open_type, "")
			set_code = set_map.get(self.door_set_type, "")
			if open_code and set_code:
				self.hw_spec_code = f"{open_code}-{set_code}-"

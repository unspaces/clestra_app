# Item QR scan landing page (packing list items)

import frappe

no_cache = 1
no_sitemap = 1


def get_context(context):
	context.item_id = frappe.form_dict.get("id", "")

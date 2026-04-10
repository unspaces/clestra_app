# Pallet QR scan landing page

import frappe

no_cache = 1
no_sitemap = 1


def get_context(context):
	context.ppl_id = frappe.form_dict.get("id", "")
	context.pallet_no = frappe.form_dict.get("pallet", "")

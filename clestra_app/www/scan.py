# QR Scanner page for adding items to pallets

import frappe

no_cache = 1
no_sitemap = 1


def get_context(context):
	context.pallet_id = frappe.form_dict.get("pallet", "")

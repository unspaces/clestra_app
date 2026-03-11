# QR Code Item Info Page
# Route: /qr_item?token=xxx

import frappe
from frappe import _

no_cache = 1
no_sitemap = 1


def get_context(context):
	token = frappe.form_dict.get("token", "")
	context.token = token
	context.no_header = 1
	context.no_breadcrumbs = 1

	# Supported languages
	lang = frappe.form_dict.get("lang", "")
	if lang in ("ko", "ja", "zh", "en"):
		frappe.local.lang = lang
	context.current_lang = frappe.local.lang or "en"

	if not token:
		context.error = "no_token"
		context.title = _("QR Code")
		return

	context.title = _("Item Information")

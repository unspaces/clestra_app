# custom_google_integration/custom_google_integration/doctype/google_settings/google_settings.py

import frappe
from frappe import _

@frappe.whitelist()
def get_google_api_key():
    api_key = frappe.db.get_single_value("Google Settings", "api_key")
    if not api_key:
        frappe.throw(_("Enter API key in Google Settings."))
    return api_key
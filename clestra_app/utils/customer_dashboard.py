"""Clestra override for Customer form dashboard transactions.

Previously lived as a direct edit to
apps/erpnext/.../customer_dashboard.py. Moved to clestra_app on 2026-04-24 via
the `override_doctype_dashboards` hook.

Clestra-specific tweaks versus upstream:
- Pre Sales: "Opportunities" (custom doctype) instead of standard Opportunity + Quotation
- Orders: Sales Order only (no Delivery Note / Sales Invoice links)
- Projects: adds "Project Group"
- Removed sections entirely: Payments, Pricing, Subscriptions
"""

from frappe import _


def get_dashboard_data(data=None):
	return {
		"heatmap": True,
		"heatmap_message": _("This is based on transactions against this Customer. See timeline below for details"),
		"fieldname": "customer",
		"non_standard_fieldnames": {
			"Payment Entry": "party_name",
			"Quotation": "party_name",
			"Opportunity": "party_name",
			"Bank Account": "party",
			"Subscription": "party",
		},
		"dynamic_links": {"party_name": ["Customer", "quotation_to"]},
		"transactions": [
			{"label": _("Pre Sales"), "items": ["Opportunities"]},
			{"label": _("Orders"), "items": ["Sales Order"]},
			{
				"label": _("Support"),
				"items": ["Issue", "Maintenance Visit", "Installation Note", "Warranty Claim"],
			},
			{"label": _("Projects"), "items": ["Project Group", "Project"]},
		],
	}

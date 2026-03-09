app_name = "clestra_app"
app_title = "Clestra App"
app_publisher = "Se Yong EOM"
app_description = "Applications for Clestra"
app_email = "sy.eom@clestra.com"
app_license = "MIT"
# required_apps = []

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/clestra_app/css/clestra_app_v1.css"
# app_include_js = [
    # "/assets/clestra_app/js/global_onload.js"
# ]
# app_include_js = "/assets/clestra_app/js/clestra_app.js"
app_include_js = ["/assets/clestra_app/js/quick_entry_custom_v2.js"]

# include js, css files in header of web template
# web_include_css = "/assets/clestra_app/css/clestra_app.css"
# web_include_js = "/assets/clestra_app/js/clestra_app.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "clestra_app/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "clestra_app/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "clestra_app.utils.jinja_methods",
# 	"filters": "clestra_app.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "clestra_app.install.before_install"
# after_install = "clestra_app.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "clestra_app.uninstall.before_uninstall"
# after_uninstall = "clestra_app.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "clestra_app.utils.before_app_install"
# after_app_install = "clestra_app.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "clestra_app.utils.before_app_uninstall"
# after_app_uninstall = "clestra_app.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "clestra_app.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# Product Color 자동 생성은 product_color.py 모듈의 monkey-patch를 통해
# _validate_links 이전에 실행됩니다. (doc_events before_validate는 _validate_links 이후에
# 실행되어 Link 유효성 검사 에러를 방지할 수 없었음)
doc_events = {}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"clestra_app.tasks.all"
# 	],
# 	"daily": [
# 		"clestra_app.tasks.daily"
# 	],
# 	"hourly": [
# 		"clestra_app.tasks.hourly"
# 	],
# 	"weekly": [
# 		"clestra_app.tasks.weekly"
# 	],
# 	"monthly": [
# 		"clestra_app.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "clestra_app.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "clestra_app.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "clestra_app.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["clestra_app.utils.before_request"]
# after_request = ["clestra_app.utils.after_request"]

# Job Events
# ----------
# before_job = ["clestra_app.utils.before_job"]
# after_job = ["clestra_app.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"clestra_app.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# DocType JS
# doctype_js = {
    # "CH Quotation": "clestra_app/clestra_app/doctype/ch_quotation/ch_quotation.js"
# }

# Override whitelisted methods
# override_whitelisted_methods = {
#     "erpnext.selling.doctype.quotation.quotation.get_children": "clestra_app.clestra_app.doctype.ch_quotation.ch_quotation.get_children",
#     "erpnext.selling.doctype.quotation.quotation.add_item": "clestra_app.clestra_app.doctype.ch_quotation.ch_quotation.add_item",
#     "erpnext.selling.doctype.quotation.quotation.add_sub_assembly": "clestra_app.clestra_app.doctype.ch_quotation.ch_quotation.add_sub_assembly",
#     "erpnext.selling.doctype.quotation.quotation.delete_node": "clestra_app.clestra_app.doctype.ch_quotation.ch_quotation.delete_node",
#     "erpnext.selling.doctype.quotation.quotation.edit_qty": "clestra_app.clestra_app.doctype.ch_quotation.ch_quotation.edit_qty",
# }

# app_include_js = [
    # "/assets/clestra_app/js/qbom_configurator.bundle.js",
    # "/assets/clestra_app/js/final_product_tree_view.js",
# ]

doctype_css = {
    "Project Billing Master": "public/css/project_billing_master.css"
}
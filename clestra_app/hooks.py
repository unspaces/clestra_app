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
app_include_css = [
    "/assets/clestra_app/css/clestra_app_v3.css",
    "/assets/clestra_app/css/clestra_sales_order_v15.css",
    "/assets/clestra_app/css/frappe_overrides_v3.css",
    "/assets/clestra_app/css/grid_overrides_v11.css",
]
# app_include_js = [
    # "/assets/clestra_app/js/global_onload.js"
# ]
# app_include_js = "/assets/clestra_app/js/clestra_app.js"
app_include_js = [
    "/assets/clestra_app/js/quick_entry_custom_v6.js",
    "/assets/clestra_app/js/list_filter_patch_v1.js",
    "/assets/clestra_app/js/draggable_dialog_v1.js",
    "/assets/clestra_app/js/link_field_autoopen_v2.js",
    "/assets/clestra_app/js/copy_doc_autoname_v1.js",
    "/assets/clestra_app/js/formatters_qty_uom_v1.js",
    "/assets/clestra_app/js/remove_grid_filter_row_v3.js",
]

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
doctype_list_js = {
    "Currency Exchange": "public/js/currency_exchange_list.js",
    "Project": "public/js/project_list.js",
    "Item": "public/js/item_list.js",
}
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

# Re-apply custom DocPerm rules after every migrate, because DocType reloads
# wipe DocPerm rows and re-insert only those declared in the DocType's JSON.
# See clestra_app/utils/custom_permissions.py for the rule list.
after_migrate = [
    "clestra_app.utils.custom_permissions.ensure_custom_permissions",
    "clestra_app.utils.workspace_overrides.apply_workspace_overrides",
]

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
doc_events = {
    "Item": {
        "before_rename": "clestra_app.utils.item_rename.before_rename_item",
        "after_rename": "clestra_app.utils.item_rename.after_rename_item",
    },
    "Project": {
        "autoname": "clestra_app.utils.project_naming.autoname",
    },
}

# Scheduled Tasks
# ---------------
# 아래 항목들은 원래 erpnext/hooks.py에 직접 추가되어 있던 내용을 이전한 것임.
# upstream 병합 가능성을 높이기 위해 clestra_app 쪽으로 분리함.
scheduler_events = {
    "cron": {
        # 매일 10:01 — 환율 자동 업데이트 (Clestra 커스텀: update_cny_based_rates 포함)
        "1 10 * * *": [
            "clestra_app.utils.currency_exchange.update_exchange_rates",
            "clestra_app.utils.currency_exchange.update_cny_based_rates",
        ],
    },
    "daily": [
        # ERPNext upstream 버그 우회 (v15.29.0 기준):
        # upstream: "erpnext.assets.doctype.asset.asset_maintenance_log..." → ImportError (잘못된 경로)
        # correct: asset_maintenance_log/asset_maintenance_log.py 위치가 맞음
        # upstream 수정될 때까지 여기서 오버라이드. 만약 Asset Maintenance 사용 안 하면 이 줄은 제거해도 됨.
        "erpnext.assets.doctype.asset_maintenance_log.asset_maintenance_log.update_asset_maintenance_log_status",
    ],
}

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
doctype_js = {
    "Project": [
        "public/js/project.js",
        "public/js/project_merge.js",
    ],
    "Customer": "public/js/customer.js",
    "Item": "public/js/item.js",
    "BOM Creator": "public/js/bom_creator.js",
}

# Customer form dashboard customization — replaces erpnext/.../customer_dashboard.py
override_doctype_dashboards = {
    "Customer": "clestra_app.utils.customer_dashboard.get_dashboard_data",
}

# Replace upstream BOMCreator/BOMCreatorItem classes with Clestra forks that
# add door/leaf/panel domain logic (size cascades, hash-based BOM dedup, etc.).
# The full HEAD logic was lifted into clestra_app/overrides/bom_creator/ so the
# ERPNext source can be restored to pristine upstream.
override_doctype_class = {
    "BOM Creator": "clestra_app.overrides.bom_creator.bom_creator.BOMCreator",
    "BOM Creator Item": "clestra_app.overrides.bom_creator.bom_creator_item.BOMCreatorItem",
}

# Redirect upstream's whitelisted RPC endpoints (called from bom_creator.js /
# bom_configurator.bundle.js) to the Clestra implementations. Without this the
# JS calls would still hit the slim upstream functions that don't know about
# Clestra's extra params (idx, qty_custom, qty_prefix/suffix, exclude_fields).
override_whitelisted_methods = {
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.get_children":
        "clestra_app.overrides.bom_creator.bom_creator.get_children",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.add_item":
        "clestra_app.overrides.bom_creator.bom_creator.add_item",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.add_sub_assembly":
        "clestra_app.overrides.bom_creator.bom_creator.add_sub_assembly",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.duplicate":
        "clestra_app.overrides.bom_creator.bom_creator.duplicate",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.delete_node":
        "clestra_app.overrides.bom_creator.bom_creator.delete_node",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.delete_node_origin":
        "clestra_app.overrides.bom_creator.bom_creator.delete_node_origin",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_qty":
        "clestra_app.overrides.bom_creator.bom_creator.edit_qty",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_conditions":
        "clestra_app.overrides.bom_creator.bom_creator.edit_conditions",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_values":
        "clestra_app.overrides.bom_creator.bom_creator.edit_values",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.get_item_details":
        "clestra_app.overrides.bom_creator.bom_creator.get_item_details",
    "erpnext.manufacturing.doctype.bom_creator.bom_creator.get_bom_details":
        "clestra_app.overrides.bom_creator.bom_creator.get_bom_details",
}

# app_include_js = [
    # "/assets/clestra_app/js/qbom_configurator.bundle.js",
    # "/assets/clestra_app/js/final_product_tree_view.js",
# ]

doctype_css = {
    "Project Billing Master": "public/css/project_billing_master.css",
    "QR Item Lookup": "public/css/qr_item_lookup.css"
}
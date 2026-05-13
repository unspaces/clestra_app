// Clestra Project list view extensions
// Previously in apps/erpnext/.../project/project_list.js as a direct modification.
// Moved here on 2026-04-24 during upstream restoration.

// Project에서 name(문서 ID)은 시스템 자동 생성이라 리스트에서 숨김. 실제 표시는 project_name 등 다른 필드.
(function () {
    const original = frappe.listview_settings["Project"] || {};
    frappe.listview_settings["Project"] = Object.assign({}, original, {
        hide_name_column: true,
    });
})();

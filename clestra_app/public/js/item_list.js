// Clestra Item list view extensions
// Previously in apps/erpnext/.../item_list.js as direct modification.
// Moved here on 2026-05-10 during upstream restoration.

(function () {
    const original = frappe.listview_settings["Item"] || {};

    const original_refresh = original.refresh;

    frappe.listview_settings["Item"] = Object.assign({}, original, {
        hide_name_column: true,

        refresh(listview) {
            if (typeof original_refresh === "function") {
                try { original_refresh.call(this, listview); } catch (_) {}
            }

            // 1. Hide Status column (we don't track item status visually)
            let status_header_index = -1;
            listview.$result.find(".list-row-head .list-row-col").each(function (index) {
                if ($(this).text().trim() === "Status") {
                    status_header_index = index;
                    $(this).hide();
                    return false;
                }
            });
            if (status_header_index > -1) {
                listview.$result.find(".list-row").each(function () {
                    $(this).find(".list-row-col").eq(status_header_index).hide();
                });
            }

            // 2. Column widths for Item list view
            // Item.title_field = item_name → Subject column IS item_name.
            // Subject body cells have <a href> but no data-filter, so target the
            // Subject via .list-subject class (which is present in both header and body).
            const style = `
                /* Subject column (item_name, title field) — wide */
                [data-page-route="List/Item/List"] .list-row-head .list-subject,
                [data-page-route="List/Item/List"] .list-row .list-subject {
                    flex: 1 1 50% !important;
                    width: 50% !important;
                }
                /* item_code column ~25% */
                [data-page-route="List/Item/List"] .list-row-head .list-row-col:has([data-sort-by="item_code"]),
                [data-page-route="List/Item/List"] .list-row .list-row-col:has([data-filter^="item_code,"]) {
                    flex: 1 1 25% !important;
                    width: 25% !important;
                }
                /* Company column ~15% */
                [data-page-route="List/Item/List"] .list-row-head .list-row-col:has([data-sort-by="company"]),
                [data-page-route="List/Item/List"] .list-row .list-row-col:has([data-filter^="company,"]) {
                    flex: 1 1 15% !important;
                    width: 15% !important;
                }
            `;
            frappe.dom.set_style(style, "custom-item-list-style");
        },
    });
})();

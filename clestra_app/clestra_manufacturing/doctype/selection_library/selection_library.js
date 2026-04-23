// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Selection Library", {
    refresh(frm) {
        if (frm.is_new()) return;

        frm.add_custom_button(__("Merge into..."), () => {
            show_merge_dialog(frm);
        });
    },
});

function show_merge_dialog(frm) {
    const current_name = frm.doc.name;
    const current_opt = frm.doc.opt_name;

    const dialog = new frappe.ui.Dialog({
        title: __("Merge '{0}' into...", [current_name]),
        fields: [
            {
                fieldname: "target",
                label: __("Target Selection Library"),
                fieldtype: "Link",
                options: "Selection Library",
                reqd: 1,
                description: __("All references to '{0}' will be replaced with this value.", [current_name]),
                get_query: () => ({
                    filters: {
                        name: ["!=", current_name],
                    },
                }),
            },
            {
                fieldname: "same_opt_only",
                label: __("Limit to same Selection Name ({0})", [current_opt]),
                fieldtype: "Check",
                default: 1,
                onchange: function () {
                    const checked = dialog.get_value("same_opt_only");
                    dialog.fields_dict.target.get_query = () => ({
                        filters: {
                            name: ["!=", current_name],
                            ...(checked ? { opt_name: current_opt } : {}),
                        },
                    });
                    dialog.fields_dict.target.set_value("");
                },
            },
            {
                fieldtype: "HTML",
                options: `<div class="alert alert-warning" style="margin-top:10px;">
                    <strong>${__("Warning")}:</strong>
                    ${__("All Door Hardware Spec documents referencing '{0}' will be updated to use the target. This record will be deleted. This cannot be undone.", [current_name])}
                </div>`,
            },
        ],
        primary_action_label: __("Merge"),
        primary_action: (values) => {
            frappe.confirm(
                __("Merge '{0}' into '{1}'? All references will be updated and '{0}' will be deleted.", [
                    current_name,
                    values.target,
                ]),
                () => {
                    dialog.hide();
                    frappe.show_alert({
                        message: __("Merging..."),
                        indicator: "blue",
                    });
                    frappe.call({
                        method: "frappe.client.rename_doc",
                        args: {
                            doctype: "Selection Library",
                            old_name: current_name,
                            new_name: values.target,
                            merge: 1,
                        },
                        callback: (r) => {
                            if (r.exc) return;
                            frappe.show_alert({
                                message: __("Merged successfully"),
                                indicator: "green",
                            });
                            frappe.set_route("Form", "Selection Library", values.target);
                        },
                    });
                }
            );
        },
    });
    dialog.show();
}

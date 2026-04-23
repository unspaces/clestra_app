// Project Merge Extension
// Adds "Merge into..." button to Project form for consolidating duplicate projects.

frappe.ui.form.on("Project", {
    refresh(frm) {
        if (frm.is_new()) return;

        frm.add_custom_button(__("Merge into..."), () => {
            show_project_merge_dialog(frm);
        });
    },
});

function show_project_merge_dialog(frm) {
    const current_name = frm.doc.name;
    const current_title = frm.doc.project_name || "";

    const dialog = new frappe.ui.Dialog({
        title: __("Merge Project '{0}' into...", [current_name]),
        fields: [
            {
                fieldname: "target",
                label: __("Target Project"),
                fieldtype: "Link",
                options: "Project",
                reqd: 1,
                description: __(
                    "All references to '{0}' ({1}) will be replaced with the target project.",
                    [current_name, current_title]
                ),
                get_query: () => ({
                    filters: {
                        name: ["!=", current_name],
                    },
                }),
            },
            {
                fieldtype: "HTML",
                options: `<div class="alert alert-warning" style="margin-top:10px;">
                    <strong>${__("Warning")}:</strong>
                    ${__(
                        "All documents referencing '{0}' (Tasks, Timesheets, Sales Orders, Door Hardware Spec, etc.) will be updated to use the target project. This project will be deleted. This cannot be undone.",
                        [current_name]
                    )}
                </div>`,
            },
        ],
        primary_action_label: __("Merge"),
        primary_action: (values) => {
            frappe.confirm(
                __(
                    "Merge project '{0}' into '{1}'? All references will be updated and '{0}' will be deleted.",
                    [current_name, values.target]
                ),
                () => {
                    dialog.hide();
                    frappe.show_alert({
                        message: __("Merging..."),
                        indicator: "blue",
                    });
                    frappe.call({
                        method: "frappe.client.rename_doc",
                        args: {
                            doctype: "Project",
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
                            frappe.set_route("Form", "Project", values.target);
                        },
                    });
                }
            );
        },
    });
    dialog.show();
}

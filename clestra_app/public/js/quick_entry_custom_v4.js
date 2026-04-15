// /public/js/quick_entry_custom_v3.js

frappe.provide('frappe.ui.form');

if (frappe.ui.form.QuickEntryForm) {
    const standard_render_dialog = frappe.ui.form.QuickEntryForm.prototype.render_dialog;

    frappe.ui.form.QuickEntryForm.prototype.render_dialog = function() {
        standard_render_dialog.call(this);

        if (this.doctype === "Door Hardware Spec") {
            console.log("[DHS QE v3] initialized");
            this.bind_door_spec_events();
            this.bind_template_load_event();
        }
    };

    // HW Spec Code 자동 계산 (Select 필드)
    frappe.ui.form.QuickEntryForm.prototype.bind_door_spec_events = function() {
        let dialog = this.dialog;
        let fields = ["door_open_type", "door_set_type"];

        fields.forEach(fieldname => {
            let field = dialog.get_field(fieldname);
            if (field && field.$input) {
                field.$input.on("change", () => {
                    let values = dialog.get_values(true);
                    if (values && values.door_open_type && values.door_set_type) {
                        let open_code = (values.door_open_type === "Swing") ? "SW" : "SL";
                        let set_code = (values.door_set_type === "Single") ? "S" : "P";
                        dialog.set_value("hw_spec_code", `${open_code}-${set_code}-`);
                    }
                });
            }
        });
    };

    // Template 로드 (Link 필드)
    frappe.ui.form.QuickEntryForm.prototype.bind_template_load_event = function() {
        let dialog = this.dialog;
        let field = dialog.get_field("load_from_template");
        if (!field || !field.$input) {
            console.log("[DHS QE v3] load_from_template field not found");
            return;
        }
        console.log("[DHS QE v3] template event bound");

        let skip_fields = [
            "name", "owner", "creation", "modified", "modified_by",
            "docstatus", "idx", "doctype",
            "is_template", "template_name", "load_from_template",
            "project", "project_name", "hw_spec_code"
        ];
        let layout_types = ["Section Break", "Column Break", "Heading", "Tab Break"];

        field.$input.on("change awesomplete-selectcomplete", function() {
            let tpl_name = dialog.get_value("load_from_template");
            console.log("[DHS QE v3] template selected:", tpl_name);
            if (!tpl_name) return;

            frappe.call({
                method: "frappe.client.get",
                args: { doctype: "Door Hardware Spec", name: tpl_name },
                callback: function(r) {
                    if (!r.message) return;
                    let tpl = r.message;

                    let meta = frappe.get_meta("Door Hardware Spec");
                    meta.fields.forEach(function(df) {
                        if (skip_fields.includes(df.fieldname)) return;
                        if (layout_types.includes(df.fieldtype)) return;
                        if (tpl[df.fieldname] != null && tpl[df.fieldname] !== "") {
                            if (dialog.fields_dict[df.fieldname]) {
                                dialog.set_value(df.fieldname, tpl[df.fieldname]);
                            }
                        }
                    });

                    // Template 데이터에서 직접 읽어 hw_spec_code 계산
                    let open_type = tpl.door_open_type;
                    let set_type = tpl.door_set_type;
                    if (open_type && set_type) {
                        let open_code = (open_type === "Swing") ? "SW" : "SL";
                        let set_code = (set_type === "Single") ? "S" : "P";
                        dialog.set_value("hw_spec_code", `${open_code}-${set_code}-`);
                    }

                    frappe.show_alert({
                        message: __("Template '{0}' loaded", [tpl_name]),
                        indicator: "green"
                    });
                }
            });
        });
    };
}

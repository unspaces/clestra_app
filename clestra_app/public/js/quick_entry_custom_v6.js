// Clestra Quick Entry customizations (v6).
// Filename version-bump per cache-bust convention — browser cache-control is
// 1y so bumping the name is the only way to force a re-fetch when this
// file changes.

frappe.provide('frappe.ui.form');

// --- Defensive wrapper: install monkey-patch even if QuickEntryForm isn't
// defined yet at this script's load time. Re-install on first access.
(function () {
    function install_patch() {
        if (!frappe.ui.form.QuickEntryForm) return false;
        if (frappe.ui.form.QuickEntryForm.prototype.__clestra_qe_patched) return true;

        const standard_render_dialog = frappe.ui.form.QuickEntryForm.prototype.render_dialog;

        // QuickEntry dialog doesn't fire frappe.ui.form.on(...).onload / setup,
        // so doctype-level autofill (e.g. company from User.company) has to be
        // re-applied here for each doctype that needs it.
        const COMPANY_AUTOFILL_DOCTYPES = ["Item", "Project", "Customer"];

        frappe.ui.form.QuickEntryForm.prototype.render_dialog = function () {
            const result = standard_render_dialog.apply(this, arguments);
            const doctype = this.doctype;
            const dialog = this.dialog;

            console.log("[QE v6] render_dialog hooked, doctype:", doctype);

            if (COMPANY_AUTOFILL_DOCTYPES.includes(doctype)) {
                _autofill_company(dialog, doctype);
            }

            if (doctype === "Door Hardware Spec") {
                console.log("[DHS QE v6] initialized");
                this.bind_door_spec_events();
                this.bind_template_load_event();
            }

            return result;
        };

        // HW Spec Code 자동 계산 (Select 필드)
        frappe.ui.form.QuickEntryForm.prototype.bind_door_spec_events = function () {
            const dialog = this.dialog;
            const fields = ["door_open_type", "door_set_type"];

            fields.forEach((fieldname) => {
                const field = dialog.get_field(fieldname);
                if (field && field.$input) {
                    field.$input.on("change", () => {
                        const values = dialog.get_values(true);
                        if (values && values.door_open_type && values.door_set_type) {
                            const open_code = (values.door_open_type === "Swing") ? "SW" : "SL";
                            const set_code = (values.door_set_type === "Single") ? "S" : "P";
                            dialog.set_value("hw_spec_code", `${open_code}-${set_code}-`);
                        }
                    });
                }
            });
        };

        // Template 로드 (Link 필드)
        frappe.ui.form.QuickEntryForm.prototype.bind_template_load_event = function () {
            const dialog = this.dialog;
            const field = dialog.get_field("load_from_template");
            if (!field || !field.$input) {
                console.log("[DHS QE v6] load_from_template field not found");
                return;
            }
            console.log("[DHS QE v6] template event bound");

            const skip_fields = [
                "name", "owner", "creation", "modified", "modified_by",
                "docstatus", "idx", "doctype",
                "is_template", "template_name", "load_from_template",
                "project", "project_name", "hw_spec_code"
            ];
            const layout_types = ["Section Break", "Column Break", "Heading", "Tab Break"];

            field.$input.on("change awesomplete-selectcomplete", function () {
                const tpl_name = dialog.get_value("load_from_template");
                console.log("[DHS QE v6] template selected:", tpl_name);
                if (!tpl_name) return;

                frappe.call({
                    method: "frappe.client.get",
                    args: { doctype: "Door Hardware Spec", name: tpl_name },
                    callback: function (r) {
                        if (!r.message) return;
                        const tpl = r.message;

                        const meta = frappe.get_meta("Door Hardware Spec");
                        meta.fields.forEach(function (df) {
                            if (skip_fields.includes(df.fieldname)) return;
                            if (layout_types.includes(df.fieldtype)) return;
                            if (tpl[df.fieldname] != null && tpl[df.fieldname] !== "") {
                                if (dialog.fields_dict[df.fieldname]) {
                                    dialog.set_value(df.fieldname, tpl[df.fieldname]);
                                }
                            }
                        });

                        const open_type = tpl.door_open_type;
                        const set_type = tpl.door_set_type;
                        if (open_type && set_type) {
                            const open_code = (open_type === "Swing") ? "SW" : "SL";
                            const set_code = (set_type === "Single") ? "S" : "P";
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

        frappe.ui.form.QuickEntryForm.prototype.__clestra_qe_patched = true;
        console.log("[QE v6] monkey-patch installed");
        return true;
    }

    function _autofill_company(dialog, doctype) {
        // Defer one tick so dialog.fields_dict / inputs are fully attached.
        setTimeout(() => {
            const company_field = dialog.get_field && dialog.get_field("company");
            const current = dialog.get_value && dialog.get_value("company");
            console.log("[QE v6 company autofill]", doctype, "field:", !!company_field, "current:", current);
            if (!company_field || current) return;

            frappe.db.get_value("User", frappe.session.user, "company").then((r) => {
                const value = r && r.message && r.message.company;
                console.log("[QE v6 company autofill] User.company response:", value);
                if (value) {
                    dialog.set_value("company", value);
                }
            });
        }, 0);
    }

    // Try installing now. If QuickEntryForm isn't defined yet, retry on DOM
    // ready and again when frappe.app is ready.
    if (!install_patch()) {
        console.log("[QE v6] QuickEntryForm not yet defined — deferring");
        $(document).ready(() => {
            if (!install_patch()) {
                console.log("[QE v6] Still not defined after ready — final retry");
                $(document).on("startup", install_patch);
            }
        });
    }
})();

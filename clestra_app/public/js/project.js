// Clestra Project form extensions
// Previously these lived in apps/erpnext/.../project/project.js as direct modifications.
// Moved here on 2026-04-24 during upstream restoration.

frappe.ui.form.on("Project", {
    onload(frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value("User", frappe.session.user, "company").then((r) => {
                if (r && r.message && r.message.company) {
                    frm.set_value("company", r.message.company);
                }
            });
        }
    },

    validate(frm) {
        const pad_3_digits = (field_name) => {
            if (frm.doc[field_name]) {
                const val = frm.doc[field_name].toString().replace(/[^0-9]/g, "");
                if (val.length > 0 && val.length < 3) {
                    frm.set_value(field_name, val.padStart(3, "0"));
                }
            }
        };
        pad_3_digits("contract_no");
    },
});

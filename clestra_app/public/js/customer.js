// Clestra Customer form extensions
// Previously in apps/erpnext/.../customer.js as direct modification.
// Moved here on 2026-04-24 during upstream restoration.

frappe.ui.form.on("Customer", {
    onload(frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value("User", frappe.session.user, "company").then((r) => {
                if (r && r.message && r.message.company) {
                    frm.set_value("company", r.message.company);
                }
            });
        }
    },
});

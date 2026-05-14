// Clestra Item form extensions
// Previously in apps/erpnext/.../item.js as direct modification.
// Moved here on 2026-05-10 during upstream restoration.

frappe.ui.form.on("Item", {
    setup(frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value("User", frappe.session.user, "company").then((r) => {
                if (r && r.message && r.message.company) {
                    frm.set_value("company", r.message.company);
                }
            });
        }
    },
});

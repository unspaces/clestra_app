// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Value Settings", {
	refresh(frm) {
        
	},
    onload: function(frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value('User', frappe.session.user, 'company')
                .then(r => {
                    if (r && r.message && r.message.company) {
                        frm.set_value('company', r.message.company);
                    }
                });
        }
    },
});

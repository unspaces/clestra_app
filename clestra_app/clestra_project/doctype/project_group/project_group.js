// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Group", {
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
	setup: function (frm) {

        frm.set_query("building_address", function (doc) {
                return {
                    filters: {
                        link_doctype: "Customer",
                        link_name: doc.end_client,
                    },
                };
            });

	},

    refresh: function (frm) {

        
        frappe.dynamic_link = {doc: frm.doc, fieldname: 'end_client', doctype: "Customer"};

    }
});

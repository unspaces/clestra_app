// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Estimate Direct Cost", {
    onload: function(frm) {
        // setDefaultMarkdownPreview(frm);
        if (frm.is_new() && !frm.doc.company) {
			frappe.db.get_value('User', frappe.session.user, 'company')
				.then(r => {
					if (r && r.message && r.message.company) {
						frm.set_value('company', r.message.company);
					}
				});
		}
    },
	// refresh(frm) {

	// },
    labor_inst: function(frm) {
        frm.set_value('expense_item', frm.doc.labor_inst);
    },
    logis_handling: function(frm) {
        frm.set_value('expense_item', frm.doc.logis_handling);
    },
    equip_freight: function(frm) {
        frm.set_value('expense_item', frm.doc.equip_freight);
    },
    site_material: function(frm) {
        frm.set_value('expense_item', frm.doc.site_material);
    },
    waste_mngt: function(frm) {
        frm.set_value('expense_item', frm.doc.waste_mngt);
    },
    rate: function(frm) {
        frm.set_value('reg_rate', frm.doc.rate*1.45)
    }
});

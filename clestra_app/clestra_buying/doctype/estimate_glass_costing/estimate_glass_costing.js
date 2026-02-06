// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Estimate Glass Costing", {
// 	refresh(frm) {

// 	},
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

    glass_type: function(frm) {
            // 1. Glass Type 필드 값을 가져옵니다.
            let glass_type = frm.doc.glass_type;

            if (glass_type) {
                if (glass_type.toLowerCase().includes('clear') || glass_type.includes('일반')) {
                    frm.set_value('is_clear', 1);
                } else {
                    frm.set_value('is_clear', 0);
                }

                if (glass_type.toLowerCase().includes('laminated') || glass_type.includes('접합')) {
                    frm.set_value('is_laminated', 1);
                } else {
                    frm.set_value('is_laminated', 0);
                }
                
                if (glass_type.toLowerCase().includes('iron') || glass_type.includes('저철분')) {
                    frm.set_value('is_low_iron', 1);
                } else {
                    frm.set_value('is_low_iron', 0);
                }

                if (glass_type.toLowerCase().includes('tempered') || glass_type.includes('강화')) {
                    frm.set_value('is_tempered', 1);
                    frm.set_value('is_non_tempered', 0);

                    // frappe.show_alert({
                    //     message: __('Tempered option has been auto-checked.'),
                    //     indicator: 'blue'
                    // });
                } else {
                    frm.set_value('is_tempered', 0);
                    frm.set_value('is_non_tempered', 1);
                }
                
                if (glass_type.toLowerCase().includes('curv') || glass_type.includes('곡')) {
                    frm.set_value('is_curved', 1);
                } else {
                    frm.set_value('is_curved', 0);
                }

                if (glass_type.toLowerCase().includes('magic') || glass_type.includes('매직')) {
                    frm.set_value('is_magic', 1);
                } else {
                    frm.set_value('is_magic', 0);
                }

                if (glass_type.toLowerCase().includes('groov') || glass_type.includes('그루')) {
                    frm.set_value('has_grooving', 1);
                } else {
                    frm.set_value('has_grooving', 0);
                }

                if (glass_type.toLowerCase().includes('back-painted') || glass_type.includes('백페인트')) {
                    frm.set_value('is_back_painted', 1);
                } else {
                    frm.set_value('is_back_painted', 0);
                }

                if (glass_type.toLowerCase().includes('border painted') || glass_type.includes('테두리백페인트')) {
                    frm.set_value('is_border_painted', 1);
                } else {
                    frm.set_value('is_border_painted', 0);
                }
            }
        }
});

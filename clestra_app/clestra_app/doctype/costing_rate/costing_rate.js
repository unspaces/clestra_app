// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Costing Rate", {
    start_date(frm) {
        if (frm.doc.start_date) {
            const date = frappe.datetime.str_to_obj(frm.doc.start_date);
            const yymm = `${date.getFullYear().toString().slice(2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            frm.set_value('start_yymm', yymm);
        }
    }
});

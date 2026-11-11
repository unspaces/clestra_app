// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Detail Drawing", {
	refresh(frm) {
		if (frm.doc.drawing_pdf) {
			frm.add_custom_button(__("Open PDF"), () => window.open(frm.doc.drawing_pdf, "_blank"));
		}
	},
});

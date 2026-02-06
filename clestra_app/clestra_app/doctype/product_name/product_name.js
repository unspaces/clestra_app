// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Product Name", {
    naming_preference: function(frm) {
        // 선택에 따라 Naming Series 필드에 조합된 값을 저장
        if (frm.doc.naming_preference === 'Product Name') {
            frm.set_value('naming_series', frm.doc.product_name);
        } else if (frm.doc.naming_preference === 'Product Code') {
            frm.set_value('naming_series', frm.doc.product_code);
        } else if (frm.doc.naming_preference === 'Product Code (Product Name)') {
            frm.set_value('naming_series', frm.doc.product_code + '(' + frm.doc.product_name + ')');
        } else if (frm.doc.naming_preference === 'Product Name (Product Code)') {
            frm.set_value('naming_series', frm.doc.product_name + '(' + frm.doc.product_code + ')');
        }
    }
});
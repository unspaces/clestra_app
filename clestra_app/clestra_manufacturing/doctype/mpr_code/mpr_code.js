// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on('MPR Code', {
    order_type: function(frm) {
        update_mpr_code(frm);
    },
    country_code: function(frm) {
        update_mpr_code(frm);
    },
    local_currency: function(frm) {
        update_mpr_code(frm);
    },
});
    
function update_mpr_code(frm) {
    // 필드 매핑
    const order_type_map = {
        'Partition - New': '1', 'Ceiling': '2', 'After Sales (AS)': '3',
        'Clean Room': '4', 'Interior': '5', 'Wall Cladding (WC)': '6',
        'Dealer': '7'
    };
    
    const country_code_map = {
        'Gumi': 'K', 
        'Japan': 'J', 
        'Taicang': 'V', 
        'HongKong': 'W',
        'Singapore': 'G', 
        'France': '1', 
        'USA': 'F', 
        'Germany': '4',
        'Pune': 'P'
    };
    
    const local_currency_map = {
        'Without Region': '0', 'Shanghai': '1', 'Beijing': '2',
        'Other Cities in China': '3', 'BOYA Project': '4', 
        'Guangzhou/Shenzen': '5', 'Greenfloor Project': '6'
    };

    // 각 필드의 매핑 값 설정
    let mpr_code = '';
    mpr_code += (order_type_map[frm.doc.order_type] || '');
    mpr_code += (country_code_map[frm.doc.country_code] || '');
    mpr_code += (local_currency_map[frm.doc.local_currency] || '');

    // 계산된 MPR 코드를 mpr_code 필드에 설정
    frm.set_value('mpr', mpr_code);
}
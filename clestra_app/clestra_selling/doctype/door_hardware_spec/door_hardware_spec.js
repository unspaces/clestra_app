// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Door Hardware Spec", {
    // 필드 값이 변경될 때마다 즉시 실행
    door_open_type: function(frm) {
        update_hw_code(frm);
    },
    door_set_type: function(frm) {
        update_hw_code(frm);
    }
});

function update_hw_code(frm) {
    if (frm.doc.door_open_type && frm.doc.door_set_type) {
        let open_map = {"Swing": "SW", "Sliding": "SL"};
        let set_map = {"Single": "S", "Pair": "P"};

        let open_code = open_map[frm.doc.door_open_type] || "";
        let set_code = set_map[frm.doc.door_set_type] || "";

        if (open_code && set_code) {
            // set_value는 UI와 내부 데이터를 동시에 업데이트합니다.
            frm.set_value("hw_spec_code", `${open_code}-${set_code}-`);
        }
    }
}
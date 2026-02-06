// Copyright (c) 2025, Se Yong EOM and contributors

frappe.ui.form.on("RPS", {
    after_save: function (frm) {
        // 저장이 완료되면 서버의 on_update가 실행되어 페이지를 갱신합니다.
        frappe.show_alert({
            message: __("순위가 실시간으로 반영되었습니다."),
            indicator: "green",
        });
    }
});
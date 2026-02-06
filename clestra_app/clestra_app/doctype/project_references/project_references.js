// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project References", {
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
    refresh: function(frm) {
        // 버튼 비활성화 여부 설정
        frm.toggle_enable('open_link', frm.doc.link ? true : false);
    },

    link: function(frm) {
        // link 필드 변경 시 버튼 활성화 여부 설정
        frm.toggle_enable('open_link', frm.doc.link ? true : false);
    },
    open_link: function(frm) { // 'open_link'는 버튼의 필드명입니다
        // link 필드 값 가져오기
        let url = frm.doc.link;

        if (url) {
            // URL 유효성 검사
            if (isValidURL(url)) {
                // 새 탭에서 링크 열기
                window.open(url, '_blank');
            } else {
                frappe.msgprint(__('Please enter a valid URL in the Link field.'));
            }
        } else {
            frappe.msgprint(__('Please enter a URL in the Link field.'));
        }
    }
});

// URL 유효성 검사 함수
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}
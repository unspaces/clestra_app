const doctypes_to_apply = [
    "Project",
    "Project Group",
    "Project References",
    "Customer",
    "Clestra Sales Order",
    "Sales Order",
    "Formula Library",
    "BOM Creator",
    "BOM",
    "Project Billing Master",
    "Inspection",
    "Site Check",
    "Opportunities",
    "Glass Blind Purchase Order"
];

const set_default_company = function(frm) {
    // 1. 이미 회사가 설정되어 있거나, 새 문서가 아니거나, 필드가 없으면 중단
    if (!frm.is_new() || frm.doc.company || !frappe.meta.has_field(frm.doc.doctype, 'company')) {
        return;
    }

    // 2. [최적화] DB 호출 대신 세션에 캐시된 사용자 기본값 사용
    // DB 호출(get_value)은 비동기라 느릴 수 있으나, defaults는 즉시 값을 가져옵니다.
    let default_company = frappe.defaults.get_user_default("company");

    if (default_company) {
        frm.set_value('company', default_company);
    } else {
        // 만약 세션 기본값(User Permission 등)이 없고 User DocType의 커스텀 필드를 꼭 가져와야 한다면
        // 기존처럼 비동기 호출 유지 (필요한 경우에만 주석 해제하여 사용)
        /*
        frappe.db.get_value('User', frappe.session.user, 'company')
            .then(r => {
                if (r && r.message && r.message.company) {
                    frm.set_value('company', r.message.company);
                }
            });
        */
    }
};

// 3. 이벤트 바인딩
doctypes_to_apply.forEach(doctype => {
    frappe.ui.form.on(doctype, {
        onload: set_default_company
    });
});
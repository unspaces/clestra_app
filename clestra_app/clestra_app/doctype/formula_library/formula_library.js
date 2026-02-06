// // Copyright (c) 2024, Se Yong EOM and contributors
// // For license information, please see license.txt

frappe.ui.form.on("Formula Library", {
//     // 양식이 처음 로드될 때와 데이터가 새로고침될 때 모두 실행되도록 합니다.
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
//     refresh: function(frm) {
//         setDefaultMarkdownPreview(frm);
//     }
});

// function setDefaultMarkdownPreview(frm) {
//     // 1. 여기에 실제 Markdown 필드의 이름을 입력하세요.
//     var fieldname = 'markdown_2';

//     // 2. 에디터 렌더링 시간을 충분히 확보하기 위해 지연 시간을 500ms로 늘립니다.
//     //    만약 그래도 작동하지 않으면 1000으로 늘려서 시도해 보세요.
//     setTimeout(function() {

//         // data-fieldname 속성을 이용해 필드의 최상위 컨테이너를 직접 찾습니다.
//         // 이것이 frm.get_field() 보다 더 확실할 수 있습니다.
//         var $field_wrapper = $('div[data-fieldname="' + fieldname + '"]');

//         if ($field_wrapper.length === 0) {
//             return;
//         }

//         // 필드 컨테이너 안에서 '.markdown-toggle' 버튼을 찾습니다.
//         var $toggle_button = $field_wrapper.find('.markdown-toggle');

//         if ($toggle_button.length > 0) {

//             // 버튼의 텍스트가 'Preview'일 경우 (즉, 편집 모드일 경우)에만 클릭합니다.
//             if ($toggle_button.text().trim() === 'Preview') {
//                 $toggle_button.click();
//             } 
//         } else {
//             // 버튼을 찾지 못했을 경우 에러 메시지를 표시합니다.
//             console.error("Custom Script ERROR: Could not find the '.markdown-toggle' button inside '" + fieldname + "'.");
//         }
//     }, 200);
// }
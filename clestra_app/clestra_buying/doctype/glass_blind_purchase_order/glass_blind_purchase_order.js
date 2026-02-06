// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Glass Blind Purchase Order", {
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
        // 체크박스 옵션 리스트
        const thicknesses = ["5T", "6T", "8T", "10T", "10.76T", "12T", "12.76T", "16.76T"];

        // glass_thickness 필드를 타겟으로 지정합니다.
        let target_field = frm.get_field('glass_thickness');

        // 이전에 생성된 체크박스가 있다면 중복 생성을 방지하기 위해 삭제합니다.
        frm.fields_dict.glass_thickness.$wrapper.find('.thickness-checkbox-wrapper').remove();

        // 체크박스를 담을 컨테이너(div)를 생성합니다.
        let wrapper = $('<div class="thickness-checkbox-wrapper" style="margin-top: -10px; margin-bottom: 20px;"></div>');
        
        let checkbox_html = '<div class="row">';
        
        // 리스트를 순회하며 체크박스 HTML을 생성합니다.
        thicknesses.forEach((thickness, index) => {
            // 한 줄에 4개의 체크박스를 배치하고, 5번째부터는 새로운 줄에 배치합니다.
            if (index > 0 && index % 4 === 0) {
                checkbox_html += '</div><div class="row">';
            }
            
            checkbox_html += `
                <div class="col-sm-3">
                    <div class="checkbox">
                        <label>
                            <input type="checkbox" class="thickness-checkbox" value="${thickness}">
                            <span class="label-text">${thickness}</span>
                        </label>
                    </div>
                </div>
            `;
        });
        
        checkbox_html += '</div>'; // 마지막 줄 닫기
        
        // 생성된 HTML을 컨테이너에 추가하고, 타겟 필드 아래에 삽입합니다.
        wrapper.html(checkbox_html);
        target_field.$wrapper.append(wrapper);

        // --- 기능 구현 ---

        // 1. 폼 로드 시, 기존 값에 따라 체크박스 상태 업데이트
        function sync_checkboxes_from_field() {
            const current_values = (frm.doc.glass_thickness || "").split(', ').filter(Boolean);
            wrapper.find('.thickness-checkbox').each(function() {
                $(this).prop('checked', current_values.includes($(this).val()));
            });
        }

        // 2. 체크박스 클릭 시, 필드 값 업데이트
        function sync_field_from_checkboxes() {
            let selected_values = [];
            wrapper.find('.thickness-checkbox:checked').each(function() {
                selected_values.push($(this).val());
            });
            
            frm.set_value('glass_thickness', selected_values.join(', '));
        }

        // --- 이벤트 핸들러 연결 ---

        // 체크박스에 'change' 이벤트 리스너를 추가합니다.
        wrapper.on('change', '.thickness-checkbox', () => {
            sync_field_from_checkboxes();
        });

        // 폼이 처음 로드될 때 체크박스 상태를 동기화합니다.
        sync_checkboxes_from_field();
    },

    asap: function(frm) {
        // 1. 'asap' 체크박스가 체크되었는지 확인합니다 (체크 시 값은 1).
        if (frm.doc.asap == 1) {
            
            // 2. 'date' 필드에 값이 있는지 먼저 확인합니다.
            if (!frm.doc.date) {
                // 'date' 필드가 비어있으면 사용자에게 알리고, 체크를 해제합니다.
                frappe.msgprint({
                    title: __('필수 정보 누락'),
                    indicator: 'orange',
                    message: __('"작성일자"를 먼저 설정해주세요.')
                });
                frm.set_value('asap', 0); // 체크박스를 다시 해제
                return; // 함수 실행 중단
            }

            // 3. Frappe의 내장 함수를 사용하여 'date'에 1일을 더하기
            let new_date = frappe.datetime.add_days(frm.doc.date, 1);

            // 4. 계산된 날짜를 'on_site_date' 필드에 설정
            frm.set_value('on_site_date', new_date);
        }
        // 체크를 해제했을 때는 아무 동작도 하지 않아 사용자가 직접 날짜를 수정할 수 있습니다.
    },

    order_item: function(frm) {
        // order_item 필드가 변경될 때마다 실행됨
        if (frm.doc.order_item === "Glass") {
            frm.set_value('order_item_code', 'G');
        } else if (frm.doc.order_item === "Blind") {
            // 필요하다면 Blind일 때의 로직도 추가
            frm.set_value('order_item_code', 'B');
        } else {
            // 선택이 취소되거나 다른 값일 경우 초기화
            frm.set_value('order_item_code', '');
        }
    }
});
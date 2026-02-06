frappe.listview_settings['Project References'] = {
    hide_name_column: true,

   refresh: function(listview) {

        // --- 1. 컬럼 너비 조정 및 텍스트 잘림 문제 해결 ---
        const style = `
            /* [data-page-route]로 범위를 한정하여 Item 목록 뷰에만 적용 */
            
            /* item_code 컬럼 너비 (Title Field) */
            .list-row-head .list-subject,
            .list-row .list-subject {
                flex: 1 1 20% !important;
                width: 20% !important;
            }


            [data-page-route="List/Project References/List"] .list-row-head .list-row-col:has([data-sort-by="industry"]),
            [data-page-route="List/Project References/List"] .list-row .list-row-col:has([data-filter^="industry,"]) {
                flex: 1 1 10% !important;
                width: 10% !important;
            }

            [data-page-route="List/Project References/List"] .list-row-head .list-row-col:has([data-sort-by="product_type_filter"]),
            [data-page-route="List/Project References/List"] .list-row .list-row-col:has([data-filter^="product_type_filter,"]) {
                flex: 1 1 7% !important;
                width: 7% !important;
            }

        `;
        
        frappe.dom.set_style(style, 'custom-item-list-style');

        // 1. 설정: 적용할 필터 목록을 여기에 정의하세요.
        // source_doctype: 데이터를 가져올 DocType
        // source_field: 가져올 필드명 (보통 'name' 또는 특정 코드값)
        // target_filter: 리스트뷰의 필터 필드명 (data-fieldname)
        const filter_configs = [
            { 
                source_doctype: "Product Name", 
                source_field: "product_name", 
                target_filter: "product_type_filter" 
            },
            { 
                source_doctype: "Door Combi", 
                source_field: "door_combi", 
                target_filter: "door_filter" 
            },
            { 
                source_doctype: "Panel Type", 
                source_field: "name", 
                target_filter: "panel_type_filter" 
            },
            { 
                source_doctype: "Color", 
                source_field: "name", 
                target_filter: "color_filter" 
            },
            { 
                // Additional Features도 Color에서 가져오시는 것이 맞다면 그대로 유지
                source_doctype: "Additional Features", 
                source_field: "name", 
                target_filter: "additional_features_filter" 
            }
        ];

        // 2. 반복문을 통해 각 필터에 기능 적용
        filter_configs.forEach(config => {
            setup_filter_autocomplete(config.source_doctype, config.source_field, config.target_filter);
        });
    }
};

/**
 * 자동완성을 설정하는 재사용 가능한 함수
 */
function setup_filter_autocomplete(doctype, source_field, target_fieldname) {
    
    // 서버에서 목록 가져오기
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: doctype,
            fields: [source_field], // 동적으로 필드 지정
            limit_page_length: 0
        },
        callback: function(r) {
            if (r.message) {
                // 가져온 데이터에서 필요한 값만 추출하고, 빈 값(null/undefined) 제거
                const options = r.message
                    .map(d => d[source_field])
                    .filter(Boolean);

                // 실제 이벤트 바인딩 실행
                bind_awesomplete_to_field(target_fieldname, options);
            }
        }
    });
}

/**
 * 특정 필드(input)에 Awesomplete를 부착하는 함수
 */
function bind_awesomplete_to_field(fieldname, options) {
    // 이벤트 위임: 동적으로 생성되는 필터 입력창 감지
    $(document.body).on('focus', `input[data-fieldname="${fieldname}"]`, function() {
        let $input = $(this);

        // 이미 초기화되었다면 중단 (중복 방지)
        if ($input.data('awesomplete-init')) return;

        // Awesomplete 초기화
        let awesomplete = new Awesomplete(this, {
            list: options,
            minChars: 0,
            maxItems: 50
        });

        // 클릭 시 목록 펼치기
        $input.on('click', function() {
            awesomplete.evaluate();
        });

        // 항목 선택 완료 시, ERPNext가 변경을 감지하도록 트리거 발동
        this.addEventListener('awesomplete-selectcomplete', function(e) {
            setTimeout(() => {
                $input.trigger('input');
                $input.trigger('change');
            }, 100);
        });

        // 초기화 완료 플래그 설정
        $input.data('awesomplete-init', true);
    });
}
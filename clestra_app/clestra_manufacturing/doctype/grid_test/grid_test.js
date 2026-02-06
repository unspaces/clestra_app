// /frappe-bench/apps/YOUR_APP_NAME/YOUR_APP_NAME/doctype/grid_test/grid_test.js

frappe.ui.form.on('Grid Test', {
    refresh: function(frm) {
        const child_table_fieldname = 'po_items';
        const child_doctype_name = 'Project Billing Master Sub Item';

        const fields_to_display = [
            'product_type', 
            'item_code', 
            'item_name', 
            'size', 
            'virtual_field_1'
        ];
        const virtual_field_name = 'virtual_field_1';
        const label_for_virtual_field = '14F';

        if (!frm.fields_dict[child_table_fieldname] || !frm.fields_dict[child_table_fieldname].grid) {
            console.warn("Grid not ready for:", child_table_fieldname);
            return;
        }

        const grid = frm.fields_dict[child_table_fieldname].grid;

        // 1. 자식 Doctype의 원본 메타데이터에서 in_list_view 설정
        const child_meta = frappe.get_meta(child_doctype_name);
        child_meta.fields.forEach(df => {
            df.in_list_view = fields_to_display.includes(df.fieldname) ? 1 : 0;
        });
        // 자식 Doctype 원본 메타의 레이블도 변경 시도 (영향 없을 가능성 높음)
        // let virtual_field_in_child_meta = child_meta.fields.find(df => df.fieldname === virtual_field_name);
        // if (virtual_field_in_child_meta) {
        //     virtual_field_in_child_meta.label = label_for_virtual_field;
        // }


        // 2. grid.meta.fields의 컬럼 정의 직접 수정 (표시 여부 및 내부적인 레이블 설정)
        if (grid.meta && grid.meta.fields) {
            grid.meta.fields.forEach(column_def => {
                if (fields_to_display.includes(column_def.fieldname)) {
                    column_def.in_list_view = 1;
                    if (column_def.fieldname === virtual_field_name) {
                        column_def.label = label_for_virtual_field; // 내부적으로는 설정됨
                    }
                } else {
                    column_def.in_list_view = 0;
                }
            });
        } else {
            console.error("grid.meta or grid.meta.fields is not available!");
            return;
        }
        
        // 3. setup_visible_columns 오버라이드 (컬럼 순서 및 최종 필터링 보장)
        if (!grid.original_setup_visible_columns) {
            grid.original_setup_visible_columns = grid.setup_visible_columns;
        }
        grid.setup_visible_columns = function() {
            this.visible_columns = [];
            fields_to_display.forEach(fieldname => {
                let df = this.meta.fields.find(f => f.fieldname === fieldname);
                if (df && df.in_list_view) {
                    let col_width = df.width || (frappe.boot.small_screen ? 80 : 120);
                    this.visible_columns.push([df, col_width]);
                }
            });
            // console.log("Final visible_columns from override:", 
            //     this.visible_columns.map(col => `${col[0].fieldname} (Label: ${col[0].label})`)
            // );
        };

        // 4. 그리드 새로고침
        try {
            frm.refresh_field(child_table_fieldname);
            console.log(`Called frm.refresh_field('${child_table_fieldname}') for grid updates.`);

            // 5. DOM 직접 조작으로 레이블 설정
            setTimeout(() => {
                const grid_wrapper = frm.fields_dict[child_table_fieldname].grid.wrapper;
                const fieldname_for_selector = virtual_field_name; 
                const desired_label = label_for_virtual_field;

                // 컬럼 헤더 전체 div 찾기 (data-fieldname 기준)
                // 클래스 col-xs-120은 너비 관련이므로 빼도 되지만, 더 정확한 타겟팅 위해 포함 가능
                // const header_cell_div = $(grid_wrapper).find(`.grid-heading-row .column-header[data-fieldname="${fieldname_for_selector}"]`); 
                // 제공해주신 HTML 구조는 .column-header 클래스가 없는 "col" 클래스일 수 있습니다. 확인 필요.
                // 좀 더 일반적인 셀렉터는 다음과 같습니다:
                const header_cell_div = $(grid_wrapper).find(`.grid-heading-row [data-fieldname="${fieldname_for_selector}"]`);


                if (header_cell_div.length > 0) {
                    console.log(`DOM: Found header cell div for ${fieldname_for_selector}:`, header_cell_div[0]);

                    // ★★★ 실제 레이블을 담고 있는 '.static-area' div 찾기 ★★★
                    const static_area_div = header_cell_div.find('.static-area');

                    if (static_area_div.length > 0) {
                        static_area_div.text(desired_label);
                        console.log(`DOM: Set text of '.static-area' for ${fieldname_for_selector} to "${desired_label}"`);
                    } else {
                        console.error(`DOM: '.static-area' div not found within header_cell_div for ${fieldname_for_selector}. HTML structure might be different than expected.`);
                        // Fallback: header_cell_div 자체에 텍스트를 넣어본다 (만약 static-area가 없다면)
                        // header_cell_div.text(desired_label); // 이 경우 기존 다른 내용이 있다면 문제가 될 수 있음
                    }

                    // title 속성 변경 (툴팁)
                    header_cell_div.attr('title', desired_label);
                    console.log(`DOM: Set title attribute of header_cell_div for ${fieldname_for_selector} to "${desired_label}"`);

                } else {
                    console.error(`DOM: Header cell div for ${fieldname_for_selector} not found using selector. Searched for: .grid-heading-row [data-fieldname="${fieldname_for_selector}"]`);
                }
            }, 0); // 지연 시간 (DOM 렌더링 대기)

        } catch (e) {
            console.error("Error during frm.refresh_field or DOM manipulation:", e);
        }
    }
});
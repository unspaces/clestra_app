// 'Conditional Color Rule'은 Child Table의 DocType 이름입니다.
frappe.ui.form.on('Conditional Color Rules', {
    /**
     * is_else 필드의 값이 변경될 때마다 실행됩니다.
     */
    is_else: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn]; // 현재 행의 데이터 객체
        let grid = frm.get_field("conditional_color_rule").grid; // 테이블 그리드 객체
        
        // --- [오류 수정] ---
        // cdn(행의 고유 ID)을 사용해 특정 grid_row 객체를 가져옵니다.
        let grid_row = grid.grid_rows_by_docname[cdn];

        // grid_row 객체가 정상적으로 찾아졌는지 확인합니다.
        if (!grid_row) {
            console.error("Grid row not found for cdn:", cdn);
            return;
        }

        // is_else가 체크되었을 때
        if (row.is_else) {
            frappe.model.set_value(cdt, cdn, 'field_name', null);
            frappe.model.set_value(cdt, cdn, 'condition', null);
            frappe.model.set_value(cdt, cdn, 'value', null);
            
            // --- [오류 수정] ---
            // grid.set_df_property 대신 grid_row.set_field_property를 사용합니다.
            grid_row.set_field_property('field_name', 'read_only', 1);
            grid_row.set_field_property('condition', 'read_only', 1);
            grid_row.set_field_property('value', 'read_only', 1);

        } 
        // is_else가 체크 해제되었을 때
        else {
            // --- [오류 수정] ---
            // grid.set_df_property 대신 grid_row.set_field_property를 사용합니다.
            grid_row.set_field_property('field_name', 'read_only', 0);
            grid_row.set_field_property('condition', 'read_only', 0);
            grid_row.set_field_property('value', 'read_only', 0);
        }

        // UI 변경사항을 즉시 반영합니다.
        frm.refresh_field("conditional_color_rule");
    },
    
    /**
     * 페이지 로드 시, 이미 저장된 데이터의 UI 상태를 올바르게 설정합니다.
     */
    setup: function(frm) {
        // 테이블의 각 행이 렌더링될 때마다 이 함수가 실행됩니다.
        frm.get_field("conditional_color_rule").grid.wrapper.on('grid-row-render', function(e, grid_row) {
            // is_else 상태에 따라 read_only 속성을 설정합니다.
            if (grid_row.doc.is_else) {
                grid_row.set_field_property('field_name', 'read_only', 1);
                grid_row.set_field_property('condition', 'read_only', 1);
                grid_row.set_field_property('value', 'read_only', 1);
            } else {
                grid_row.set_field_property('field_name', 'read_only', 0);
                grid_row.set_field_property('condition', 'read_only', 0);
                grid_row.set_field_property('value', 'read_only', 0);
            }
        });
    }
});
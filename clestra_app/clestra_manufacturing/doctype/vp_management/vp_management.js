// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("VP Management", {
    refresh: function(frm) {
        // ... (기존의 calculate 버튼 로직 등) ...

        // VP Matrix 그리드 UI 설정 함수 호출
        setup_vp_matrix_grid(frm);
        setup_summary_grid(frm); 
    },
    
    calculate: function(frm) { // 버튼 필드명(Name)이 'calculate'일 경우 이 함수가 호출됨
        if (frm.is_dirty()) {
            frappe.throw(__("Please save the document before calculating."));
            return;
        }

        frappe.call({
            method: "calculate_vp_data", // 호출할 Python 메소드 (doc.py 내의 메소드)
            doc: frm.doc, // 현재 문서 객체를 전달 (서버에서 self로 접근)
            // args: {} // calculate_vp_data 메소드가 추가 인자를 받지 않으므로 비워둠
            callback: function(r) {
                // Python 메소드에서 frappe.msgprint를 사용했으므로,
                // 여기서는 추가적인 성공 메시지가 필수는 아님.
                // 다만, 에러가 발생하지 않았다면 폼을 리로드하여 변경된 child table을 보여주는 것이 좋음.
                if (r.exc) { // 에러가 발생한 경우
                    frappe.msgprint({
                        title: __('Calculation Error'),
                        indicator: 'red',
                        message: __('An error occurred during calculation. Please check server logs.')
                    });
                } else {
                    // Python에서 frappe.msgprint를 사용했으므로 여기서는 간단히 리로드만.
                    // Python의 frappe.msgprint가 먼저 표시될 것입니다.
                    frm.save(); // 변경된 데이터를 저장합니다.
                    // 저장이 완료된 후 reload
                    // frm.save()는 비동기이므로, then()을 사용하거나,
                    // Python측에서 self.save()를 하고 여기서는 frm.reload_doc()만 해도 됩니다.
                    // Python에서 self.save()를 하지 않았다면 여기서 frm.save() 필수.
                    // Python에서 self.save()를 했다면, 여기서는 frm.reload_doc()만으로 충분할 수 있으나,
                    // 데이터 일관성을 위해 여기서 save를 한번 더 호출하는 것이 안전할 수 있습니다.
                    // 여기서는 Python에서 self.save()를 호출하지 않는다고 가정하고 JS에서 저장.
                }
            },
            error: function(r) { // 통신 오류 등
                frappe.msgprint({
                    title: __('Server Call Error'),
                    indicator: 'red',
                    message: __('Could not connect to the server for calculation.')
                });
            },
            always: function() {
                // 필요시 버튼 비활성화 해제 등
            }
        });
    }
});
    

frappe.ui.form.on("VP Dimension Definition", {
	width_definition_add: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.product_section) { // Add row check
            frappe.model.set_value(cdt, cdn, 'type', "Width");
        }
	},
    height_definition_add: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.product_section) { // Add row check
            frappe.model.set_value(cdt, cdn, 'type', "Height");
        }
	},
});


function setup_vp_matrix_grid(frm) {
    const fieldname = "vp_matrix";

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid) {
        return;
    }

    if (!frm.doc[fieldname] || frm.doc[fieldname].length === 0) {
        frm.get_field(fieldname).$wrapper.hide();
        return;
    }
    frm.get_field(fieldname).$wrapper.show();

    // --- (단계 1, 2, 3: 데이터 준비 및 할당 - 이전과 동일) ---
    const width_values = (frm.doc.width_definition || [])
        .filter(d => d.type === 'Width' && d.value != null)
        .map(d => parseFloat(d.value))
        .sort((a, b) => a - b);
    
    const MAX_VIRTUAL_FIELDS = 20;
    let virtual_fields_mapping = []; 
    for (let i = 0; i < width_values.length; i++) {
        if (i < MAX_VIRTUAL_FIELDS) {
            virtual_fields_mapping.push({
                virtual_fieldname: `width_${i + 1}`,
                width_value: width_values[i],
                display_label: String(width_values[i])
            });
        }
    }
    
    const vp_lookup = {};
    (frm.doc.summary || []).forEach(summary_row => {
        vp_lookup[`${flt(summary_row.width)}_${flt(summary_row.height)}`] = cint(summary_row.vp);
    });

    (frm.doc[fieldname] || []).forEach(matrix_row => {
        const height_val = flt(matrix_row.value);
        for (let i = 1; i <= MAX_VIRTUAL_FIELDS; i++) {
            matrix_row[`width_${i}`] = 0;
        }
        virtual_fields_mapping.forEach(map => {
            const width_val = map.width_value;
            const vp_value = vp_lookup[`${width_val}_${height_val}`] || 0;
            matrix_row[map.virtual_fieldname] = vp_value;
        });
    });

    // --- 4. 표시할 필드 목록 및 너비 설정 정의 ---
    let final_fieldnames_to_display = ['value']; // 'Height\Width' 컬럼
    virtual_fields_mapping.forEach(map => {
        final_fieldnames_to_display.push(map.virtual_fieldname);
    });
    
    // 각 컬럼에 동일한 너비를 할당 (Bootstrap unit 1)
    const column_width_unit = 1;

    // --- 5. grid.setup_visible_columns 오버라이드 ---
    grid.setup_visible_columns = function() {
        this.visible_columns = [];
        const child_meta = frappe.get_meta(this.doctype);
        if (!child_meta) return;

        let total_col_size = 0;

        final_fieldnames_to_display.forEach(fname => {
            let df = child_meta.fields.find(d => d.fieldname === fname);
            if (df) {
                let df_for_column = { ...df };

                if (fname === 'value') {
                    df_for_column.label = __('Height\\Width'); // 백슬래시 이스케이프
                } else {
                    const map_entry = virtual_fields_mapping.find(m => m.virtual_fieldname === fname);
                    if (map_entry) {
                        df_for_column.label = map_entry.display_label;
                    }
                }
                this.visible_columns.push([df_for_column, df_for_column.columns || 1]);
                total_col_size += column_width_unit;
            }
        });
        
        // --- 그리드의 최대 너비 동적 계산 ---
        const BASE_GRID_WIDTH_PX = 800; // VP 매트릭스는 너비가 좁아도 되므로 기본값을 작게 설정
        const PIXELS_PER_COLUMN = 20; // 컬럼 하나당 추가할 픽셀 (조정 가능)
        
        // grid 객체에 계산된 너비 저장
        this._calculated_grid_width_px = BASE_GRID_WIDTH_PX + (this.visible_columns.length * PIXELS_PER_COLUMN);
    };

    // --- 6. 그리드 리셋/새로고침 ---
    if (grid.reset_grid) {
        grid.reset_grid();
    } else {
        grid.refresh();
    }

    // --- 7. DOM 조작 (라벨 강제 변경 및 숨김 처리, 너비 적용) ---
    setTimeout(() => {
        const grid_wrapper = frm.get_field(fieldname).$wrapper;
        if (!grid_wrapper) return;

        // idx와 check 필드 숨기기
        grid_wrapper.find('.grid-heading-row .row-check, .grid-heading-row .row-index, .grid-heading-row .col .justify-content-center').hide();
        grid_wrapper.find('.grid-body .row-check, .grid-body .row-index, .grid-body .col .btn-open-row').hide();

        // 헤더 라벨 강제 변경
        const value_header = grid_wrapper.find(`.grid-heading-row .col[data-fieldname="value"] .static-area`);
        if (value_header.length > 0) {
            value_header.html('Width' + '<br>' + 'Height');
        }
        virtual_fields_mapping.forEach(map => {
            const header_cell = grid_wrapper.find(`.grid-heading-row .col[data-fieldname="${map.virtual_fieldname}"] .static-area`);
            if (header_cell.length > 0) {
                header_cell.text(map.display_label);
            }
        });

        // 그리드 전체 너비 적용
        // const grid_instance = frm.fields_dict[fieldname]?.grid;
        // if (grid_instance && grid_instance._calculated_grid_width_px) {
        //     const width_px = grid_instance._calculated_grid_width_px + 'px';
        //     $(grid_instance.wrapper).find('.grid-heading-row > .grid-row').css('width', width_px);
        //     $(grid_instance.wrapper).find('.grid-body > .rows').css('width', width_px);
        // }
    }, 150);
}

function setup_summary_grid(frm) {
    const fieldname = "summary";

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid) {
        return;
    }

    // --- 1. idx와 check 필드를 DOM에서 직접 숨기기 ---
    // 이 작업은 그리드가 렌더링된 후에 실행되어야 하므로 setTimeout으로 감쌉니다.
    setTimeout(() => {
        const grid_wrapper = frm.get_field(fieldname).$wrapper;
        if (!grid_wrapper) return;

        grid_wrapper.find('.grid-heading-row .row-check, .grid-heading-row .row-index').hide();
        grid_wrapper.find('.grid-body .row-check, .grid-body .row-index').hide();
    }, 100);

    // --- 2. 표시할 필드 목록과 너비 설정 정의 ---
    // idx와 check는 제외하고, 표시할 필드만 나열합니다.
    const final_fieldnames_to_display = [
        "width", "height", "mt_cost", "labor_cost", "mfg_cost", "oh_cost", "vp"
    ];

    // 각 필드에 대한 컬럼 너비 (Bootstrap grid column unit, 1-12)
    const column_widths = {
        "width":       1,
        "height":      1,
        "mt_cost":     1.5,  // 15%에 가깝게 2 unit
        "labor_cost":  1.5,  // 15%에 가깝게 2 unit
        "mfg_cost":    1.5,  // 15%에 가깝게 2 unit
        "oh_cost":     1.5,  // 15%에 가깝게 2 unit
        "vp":          1,
    };

    // --- 3. grid.setup_visible_columns 오버라이드 ---
    grid.setup_visible_columns = function() {
        // this는 grid 객체
        this.visible_columns = [];
        const child_meta = frappe.get_meta(this.doctype);
        if (!child_meta) return;

        let total_col_size = 0;

        final_fieldnames_to_display.forEach(fname => {
            let df = child_meta.fields.find(d => d.fieldname === fname);
            if (df) {
                // 너비 설정 가져오기 (기본값: 1)
                const col_size = column_widths[fname] || 1;
                this.visible_columns.push([df, col_size]);
                total_col_size += col_size;
            }
        });
        
        // --- 4. 그리드의 최대 너비 동적 계산 및 저장 ---
        // Bootstrap의 기본 컬럼은 12개입니다. 이를 초과하면 그리드 너비를 늘려줍니다.
        const MAX_BOOTSTRAP_COLS = 12;
        const BASE_GRID_WIDTH_PX = 1000; // .container의 기본 너비와 유사
        const PIXELS_PER_EXTRA_COL_UNIT = 40; // 1 unit이 늘어날 때 추가할 픽셀 (조정 가능)
        
        this._calculated_grid_width_px = BASE_GRID_WIDTH_PX; // grid 객체에 계산된 너비 저장

        if (total_col_size > MAX_BOOTSTRAP_COLS) {
            const extra_col_units = total_col_size - MAX_BOOTSTRAP_COLS;
            this._calculated_grid_width_px += extra_col_units * PIXELS_PER_EXTRA_COL_UNIT;
        }
    };

    // --- 5. 그리드 리셋 및 DOM 너비 적용 ---
    if (grid.reset_grid) {
        grid.reset_grid();
    } else {
        grid.refresh();
    }
    
    // reset_grid가 완료된 후 DOM에 너비를 적용
    // setTimeout(() => {
    //     const grid_instance = frm.fields_dict[fieldname]?.grid;
    //     if (grid_instance && grid_instance.wrapper && grid_instance._calculated_grid_width_px) {
    //         // 그리드 헤더와 바디의 너비를 함께 조절
    //         const width_px = grid_instance._calculated_grid_width_px + 'px';
    //         $(grid_instance.wrapper).find('.grid-heading-row > .grid-row').css('width', width_px);
    //         $(grid_instance.wrapper).find('.grid-body > .rows').css('width', width_px);
    //     }
    // }, 150);
}
// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Clestra Sales Order", {
    refresh: function(frm) {
        custom_zone_field(frm);

        setTimeout(() => {
            let left_col_data_fieldname = 'column_break_mrxb';
            let right_col_data_fieldname = 'column_break_giyj';

            // frm.wrapper는 폼 전체의 최상위 div
            let $left_column = $(frm.wrapper).find(`.form-column[data-fieldname="${left_col_data_fieldname}"]`);
            let $right_column = $(frm.wrapper).find(`.form-column[data-fieldname="${right_col_data_fieldname}"]`);

            if ($left_column.length && $right_column.length) {
                $left_column.css({
                    'flex': '0 0 40%',
                    'max-width': '40%',
                });

                $right_column.css({
                    'flex': '0 0 60%',
                    'max-width': '60%',
                });
                // console.log("Column styles applied by finding within frm.wrapper.");
            } else {
                console.error("One or both Column elements not found within frm.wrapper. Check data-fieldnames.");
            }
        }, 0);
    }
});

function custom_zone_field(frm) {
    const fieldnames = ['finished_items'];
    fieldnames.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (grid && grid.wrapper) {
            grid.wrapper.off('click', '.grid-row .col[data-fieldname="zone_select"]');
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="zone_select"]', function(e) {
                
                if ($(e.target).is('button, a')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                let row_name = $(this).closest('.grid-row').attr('data-name');
                let grid_row_obj = grid.get_row(row_name);

                if (grid_row_obj && grid_row_obj.doc) {
                        zone_edit_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
                } else {
                        console.error("Could not find row object for clicked size field.");
                }
            });
            grid.wrapper.find('.col[data-fieldname="size"]').addClass('clickable');
        }
    });
}

function zone_edit_dialog(frm, child_doctype, child_docname) { // 파라미터 이름 명확화
    console.log("CSO: zone_edit_dialog called for doctype:", child_doctype, "name:", child_docname);

    const zones_in_order = frm.doc.zone_table || []; // 현재 Sales Order에 등록된 Zone 목록

    if (!zones_in_order.length) {
        frappe.show_alert({ message: __('No zones available in this order.'), indicator: 'orange' });
        return;
    }

    // 다이얼로그에 표시할 선택 옵션 생성
    const dialog_options = zones_in_order.map(zone_doc => {
        return {
            label: zone_doc.zone_label || zone_doc.name, // zone_label이 없으면 name으로 대체
            value: zone_doc.name // Sales Order Zone 행의 고유 name
        };
    });
    console.log("CSO: Dialog options for zone_edit_dialog:", dialog_options);

    const dialog = new frappe.ui.Dialog({
        title: __('Select Zone'),
        fields: [
            {
                fieldname: 'selected_zone_in_dialog', // 필드명 중복 방지를 위해 변경
                label: __('Zone'),
                fieldtype: 'Select',
                options: dialog_options,
                reqd: 1
            }
        ],
        primary_action_label: __('Select'),
        primary_action: function(values) {
            const selected_zone_name_from_dialog = values.selected_zone_in_dialog;
            console.log("CSO: Dialog primary action. Selected zone name:", selected_zone_name_from_dialog);

            // frappe.model.set_value를 사용하여 값 설정
            frappe.model.set_value(
                child_doctype,        // 자식 Doctype 이름 (예: "Sales Order Finished Items")
                child_docname,        // 자식 Doctype 행의 name
                'zone_linked',        // 업데이트할 필드명
                selected_zone_name_from_dialog // 선택된 Zone의 name
            ).then(() => {
                console.log("CSO: zone_linked value set successfully for", child_docname);
                // 그리드 새로고침하여 변경사항 반영
                // frm.refresh_field('finished_items'); // 이미 set_value 후 자동으로 refresh 될 수 있음
                // grid 객체가 있다면 grid.refresh()가 더 효율적일 수 있음
                const grid = frm.fields_dict.finished_items?.grid;
                if (grid) {
                    grid.refresh();
                } else {
                    frm.refresh_field('finished_items'); // fallback
                }
                dialog.hide();
            }).catch(err => {
                console.error("CSO: Error setting zone_linked value:", err);
            });
        }
    });
    dialog.show();
    console.log("CSO: Zone edit dialog shown.");
}
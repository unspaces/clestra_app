// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Clestra Sales Order", {
    // onload: function(frm) {
    //     if (frm.doc.zone_list) {
    //         frm.set_value('finish_list_name', frm.doc.default_finish_list_name);  // default_finish_list_name은 Doctype에 미리 설정한 값
    //     }
    // },
    refresh: function(frm) {
        // ================== 1. 상태 변수 초기화 ==================
        if (!frm.custom_state) {
            frm.custom_state = {
                selected_parent_item: null
            };
        }

        // ================== 2. Quick Entry 필드 설정 ==================
        // const project_name = frm.doc.project;
        // var so = frm.get_docfield("zone_test");
        // console.log(`[SETUP] 'zone_test' field found: ${so}.`);
        // so.get_route_options_for_new_doc = function (field) {
        //     return {
        //         "project": project_name,
        //     }
        // }

        // Quick Entry의 project필드에 프로젝트명 자동 입력
        let batch_field = frm.get_docfield("zone_list");
        batch_field.get_route_options_for_new_doc = function (row) {
            if (frm.is_new()) return;
            return {
                "project": frm.doc.project,
            };
        }

        let batch_field_2 = frm.get_docfield("finished_items", "zone_name");
        batch_field_2.get_route_options_for_new_doc = function (row) {
            if (frm.is_new()) return;
            return {
                "project": frm.doc.project,
            };
        }

        // ================== 3. 동적 쿼리 설정 ==================
        set_query_for_table(frm, 'finished_items', 'zone_name', 'project', frm.doc.project);
        // set_query_for_table(frm, 'zone_table', 'zone_name', 'project', frm.doc.project);
        set_query_for_row(frm, 'finished_items', 'item_code', 'product_section', 'product_section');
        frm.set_query('zone_list', function(){
            return {
                filters: {
                    'project': frm.doc.project,
                }
            }
        })

        // ================== 4. 그리드 설정 ==================
        setup_finished_items_grid(frm);

        // 'sub_assembly_items' 그리드 설정
        setup_duplicate_button_for_grid(frm, 'sub_assembly_items');
        // 'zone_table' 그리드 설정
        // customize_grid_display(frm, 'zone_table', 'hide', 'show');
        // Add Row 버튼 커스터마이징
        customize_add_row_button(frm, 'sub_assembly_items', 'hide');
        // customize_add_row_button(frm, 'zone_table', 'rename', 'Add Zone');

        // ================== 5. 레이아웃 조정 ==================
        setTimeout(() => {
            adjust_column_widths(frm, 'column_break_mrxb', '60%', 'column_break_giyj', '40%');
        }, 0);


        // const child_table_fieldname = 'finished_items';
        // frm.set_query('zone_linked', child_table_fieldname, function(doc, cdt, cdn) {
        //     // doc: 현재 Clestra Sales Order 문서 (부모)
        //     // cdt: 'Sales Order Finished Items' (자식 Doctype 이름)
        //     // cdn: 현재 행의 name (자식 문서의 고유 ID)
        //     let row = locals[cdt] && locals[cdt][cdn]; // 해당 행의 데이터 가져오기

        //     // console.log("Setting query for:", cdt, cdn, "Row data:", row);

        //     return {
        //         query: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.get_options_for_sales_order",
        //         filters: {
        //             // Python 메소드로 전달할 추가 필터 (선택 사항)
        //             // 예시:
        //             // 'company': doc.company,
        //             // if (row) { // 행 데이터가 있을 경우에만 필터 추가
        //             //    'item_group': row.item_group
        //             // }
        //         }
        //     };
        // });
    },

    project: function(frm) {
        // project 필드가 변경되면 Zone 필터 쿼리를 다시 설정합니다.
        frm.set_value('zone_list', null);
        (frm.doc.finished_items || []).forEach(d => d.zone_name = null);
        (frm.doc.sub_assembly_items || []).forEach(d => d.zone_name = null);
        frm.refresh_field(['finished_items', 'sub_assembly_items']);
        set_query_for_table(frm, 'finished_items', 'zone_name', 'project', frm.doc.project);
        // set_query_for_table(frm, 'zone_table', 'zone_name', 'project', frm.doc.project);
    },

    zone_list: function(frm) {
        filter_grids(frm);
    }
});

frappe.ui.form.on("Sales Order Zone", {
    // zone_table_add:function(frm, cdt, cdn) {
    //     set_default_project(frm, cdt, cdn);
    // },
});


frappe.ui.form.on('Sales Order Finished Items', {
    /**
     * 'finished_items' 테이블의 행에서 'zone_name' 필드 값이 변경될 때 실행됩니다.
     * @param {object} frm - 부모 폼 객체 (Clestra Sales Order)
     * @param {string} cdt - 자식 Doctype 이름 ('Clestra Sales Order Item')
     * @param {string} cdn - 현재 행의 고유 이름 (Child Doc Name)
     */
    zone_name: function(frm, cdt, cdn) {
        // 현재 행의 데이터를 가져옵니다.
        const currentRow = locals[cdt][cdn];
        const newZoneName = currentRow.zone_name;

        // zone_name이 비어있으면 아무 작업도 하지 않습니다.
        if (!newZoneName) {
            return;
        }

        // 'zone_table'에 이미 해당 zone_name이 있는지 확인합니다.
        // frm.doc.zone_table이 없거나 비어있을 경우를 대비하여 (frm.doc.zone_table || []) 사용
        // const isAlreadyExists = (frm.doc.zone_table || []).some(zone_row => zone_row.zone_name === newZoneName);

        // // 존재하지 않을 경우에만 'zone_table'에 새 행을 추가합니다.
        // if (!isAlreadyExists) {
        //     // 새 행을 추가합니다.
        //     const newZoneRow = frm.add_child('zone_table');
            
        //     // 새 행의 필드 값을 설정합니다.
        //     newZoneRow.zone_name = newZoneName;
            
        //     // 만약 'zone_table'에도 project 필드가 있다면, 부모 문서의 project 값을 복사합니다.
        //     if (frm.doc.project) {
        //         newZoneRow.project = frm.doc.project;
        //     }
            
        //     // 다른 필요한 필드가 있다면 여기서 값을 설정합니다.
        //     // newZoneRow.description = "Added from Finished Items";

        //     // 'zone_table' 그리드를 새로고침하여 변경사항을 화면에 즉시 반영합니다.
        //     frm.refresh_field('zone_table');

            // frappe.show_alert({
            //     message: __("'{0}' has been added to the Zone Table.", [newZoneName]),
            //     indicator: 'green'
            // }, 5);
        // }
    }
});


function set_default_project(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.project) { // Add row check
        frappe.model.set_value(cdt, cdn, 'project', frm.doc.project);
    }
}

function set_query_for_table(frm, table_fieldname, target_fieldname, filter_fieldname, filter_value) {
    frm.set_query(target_fieldname, table_fieldname, function(doc, cdt, cdn) {
        if (filter_value) {
            return {
                filters: {
                    [filter_fieldname] : filter_value
                }
            };
        } else {
            // 프로젝트가 선택되지 않았다면 아무 필터도 적용하지 않습니다.
            return { filters: {} };
        }
    });
}

function set_query_for_row(frm, table_fieldname, target_fieldname, filter_fieldname, filter_value) {
    frm.set_query(target_fieldname, table_fieldname, function(doc, cdt, cdn) {
        let row = locals[cdt][cdn]; // 현재 행의 데이터를 가져옵니다.
        if (row && row[filter_value]) {
            return {
                filters: {
                    [filter_fieldname]: row[filter_value]
                }
            };
        }
        return { filters: {} };
    });
}

function setup_duplicate_button_for_grid(frm, table_fieldname) {
    const grid = frm.fields_dict[table_fieldname].grid;
    const grid_wrapper = $(grid.wrapper);

    // 이미 버튼이 추가되었는지 확인하여 중복 생성을 방지
    if (grid_wrapper.find('.btn-custom-duplicate').length > 0) {
        return;
    }

    // 'Duplicate' 버튼 생성
    const duplicate_button = $('<button class="btn btn-secondary btn-xs btn-custom-duplicate" style="margin-right: 4px; display: none;">' + __('Duplicate') + '</button>');

    // 버튼 위치 지정: 'Add Row' 버튼 뒤 또는 그리드 버튼 영역의 맨 끝
    const add_row_button = grid_wrapper.find('.grid-add-row');
    if (add_row_button.length > 0) {
        add_row_button.after(duplicate_button);
    } else {
        grid_wrapper.find('.grid-buttons').append(duplicate_button);
    }

    // 버튼 클릭 이벤트
    duplicate_button.on('click', function() {
        const selected_docs = grid.get_selected_children();

        if (selected_docs.length === 0) {
            frappe.show_alert({ message: __('Please select rows to duplicate.'), indicator: 'orange' });
            return;
        }

        selected_docs.forEach(doc => {
            // Frappe의 기본 복제 기능을 사용하여 행 추가
            grid.add_new_row(null, null, true, doc, true);
        });

        frm.refresh_field(table_fieldname);
        frappe.show_alert({ message: __('Selected rows duplicated.'), indicator: 'green' });

        // 복제 후 모든 선택 해제
        grid.toggle_all_rows(false);
    });

    // 행의 체크박스(개별 또는 전체) 상태가 변경될 때마다 버튼 표시/숨김 처리
    grid_wrapper.on('change', '.grid-row-check, .grid-select-all', function() {
        toggle_duplicate_button(frm, table_fieldname);
    });
}

// Duplicate 버튼 보이기/숨기기 헬퍼 함수
function toggle_duplicate_button(frm, table_fieldname) {
    if (!frm.fields_dict[table_fieldname] || !frm.fields_dict[table_fieldname].grid) return;

    let grid = frm.fields_dict[table_fieldname].grid;
    let grid_wrapper = $(grid.wrapper);
    let duplicate_button = grid_wrapper.find('.btn-custom-duplicate');
    
    if (grid.get_selected_children().length > 0) {
        duplicate_button.show();
    } else {
        duplicate_button.hide();
    }
}

function customize_grid_display(frm, table_fieldname, check_action, idx_action) {
    const grid = frm.fields_dict[table_fieldname].grid;

    // 그리드가 존재하지 않거나, 이미 커스터마이징이 적용된 경우 중복 실행을 방지
    if (!grid || grid.is_customized) {
        return;
    }

    /**
     * 실제 스타일을 적용하는 헬퍼 함수
     * @param {object} grid_obj - 그리드 객체
     */
    const apply_styles = function(grid_obj) {
        if (!grid_obj.wrapper) return;
        
        const grid_wrapper = $(grid_obj.wrapper);
        
        // 헤더와 모든 행의 체크박스를 숨깁니다.
        if (check_action === 'hide' || check_action === 'show') {
            grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check')[check_action]();
        }
        
        // 헤더와 모든 행의 인덱스(순번)를 표시합니다.
        if (idx_action === 'hide' || idx_action === 'show') {
            grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index')[idx_action]();
        }
    };

    // --- Monkey-Patching: 그리드의 refresh 함수 확장 ---
    // 1. 기존의 refresh 함수를 백업합니다.
    const original_refresh = grid.refresh;

    // 2. grid.refresh 함수를 새로운 함수로 덮어씁니다.
    grid.refresh = function() {
        // 3. 백업해 둔 원래 refresh 함수를 먼저 실행합니다.
        original_refresh.apply(this, arguments);
        // 4. 원래 함수가 실행된 후, 우리의 커스텀 스타일을 적용합니다.
        apply_styles(this);
    };
    
    // 초기 로드 시에도 스타일을 한 번 적용해줍니다.
    apply_styles(grid);

    // 커스터마이징이 적용되었음을 표시하여, 폼 refresh 시 중복으로 덮어쓰는 것을 방지합니다.
    grid.is_customized = true;
}

function adjust_column_widths(frm, left_col_id, left_width, right_col_id, right_width) {
    let $left_column = $(frm.wrapper).find(`.form-column[data-fieldname="${left_col_id}"]`);
    let $right_column = $(frm.wrapper).find(`.form-column[data-fieldname="${right_col_id}"]`);
    if ($left_column.length && $right_column.length) {
        $left_column.css({ 'flex': `0 0 ${left_width}`, 'max-width': left_width });
        $right_column.css({ 'flex': `0 0 ${right_width}`, 'max-width': right_width });
    }
}

function filter_grids(frm) {
    const selected_zone = frm.doc.zone_list;
    const selected_parent_id = frm.custom_state.selected_parent_item;

    // 1. finished_items 그리드 필터링
    const finished_grid = frm.fields_dict['finished_items']?.grid;
    if (finished_grid) {
        let visible_count = 0;
        finished_grid.grid_rows.forEach(row => {
            const is_visible = !selected_zone || (row.doc.zone_name === selected_zone);
            $(row.row).toggle(is_visible);
            if (is_visible) visible_count++;
        });
        $(finished_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
    }
    
    // 2. sub_assembly_items 그리드 필터링
    const sub_assembly_grid = frm.fields_dict['sub_assembly_items']?.grid;
    const header_field = 'sub_assembly_header'; // 헤더 필드명
    
    if (sub_assembly_grid) {
        let visible_count = 0;
        // 동적 헤더 업데이트
        const header_wrapper = frm.get_field(header_field)?.$wrapper;
        if (header_wrapper) {
            if (selected_parent_id) {
                const parent_doc = (frm.doc.finished_items || []).find(d => d.name === selected_parent_id);
                header_wrapper.html(`<div class="sub-assembly-title">Sub-Assemblies for: ${parent_doc ? parent_doc.item_code : '...'}</div>`);
            } else {
                 header_wrapper.html(`<div class="sub-assembly-title">All Sub-Assembly Items ${selected_zone ? `in Zone: ${selected_zone}`:''}</div>`);
            }
        }

        sub_assembly_grid.grid_rows.forEach(row => {
            const matches_zone = !selected_zone || (row.doc.zone_name === selected_zone);
            const matches_parent = !selected_parent_id || (row.doc.parent_finished_item === selected_parent_id);
            
            const is_visible = matches_zone && matches_parent;
            $(row.row).toggle(is_visible);
            if (is_visible) visible_count++;
        });
        $(sub_assembly_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
    }
}


function setup_finished_items_grid(frm) {
    const parent_table = 'finished_items';
    const child_table = 'sub_assembly_items';
    const parent_link_field = 'parent_finished_item';
    const header_field = 'sub_assembly_header';

    const grid = frm.fields_dict[parent_table].grid;
    if (!grid || grid.is_fully_enhanced) {
        return; // 이미 설정되었으면 중복 실행 방지
    }

    const grid_wrapper = $(grid.wrapper);

    grid_wrapper.on('click', '.btn-edit-row', function() {
        // 클릭된 버튼이 속한 행과 컬럼을 찾습니다.
        const $open_row = $(this).closest('.grid-row');
        const $form_column = $open_row.closest('.form-column');

        if ($form_column.length > 0) {
            // 원래 스타일을 저장합니다.
            if (!$form_column.data('original-style')) {
                $form_column.data('original-style', {
                    'flex': $form_column.css('flex'),
                    'max-width': $form_column.css('max-width')
                });
            }
            // 컬럼 너비를 임시로 확장합니다.
            $form_column.css({
                'flex': '1 1 100%',
                'max-width': '100%',
                'transition': 'all 0.2s ease-in-out'
            });
        }
    });

    // --- [핵심 수정] 폼 필드에서 포커스가 벗어날 때(blur) 원래 스타일로 복원 ---
    // 사용자가 편집을 마치고 다른 곳을 클릭하면 원래 크기로 돌아옵니다.
    grid_wrapper.on('blur', '.form-control', function(e) {
        // 약간의 지연을 주어 다른 필드로 포커스가 이동하는 경우를 처리합니다.
        setTimeout(() => {
            // 현재 포커스가 여전히 그리드 내부에 있는지 확인합니다.
            if (!grid_wrapper.find('.form-control:focus').length) {
                // 포커스가 그리드 바깥으로 나갔다면 스타일을 복원합니다.
                $(frm.wrapper).find('.form-column').each(function() {
                    const $form_column = $(this);
                    const original_style = $form_column.data('original-style');
                    if (original_style) {
                        $form_column.css({
                            'flex': original_style.flex,
                            'max-width': original_style['max-width']
                        });
                        $form_column.removeData('original-style');
                    }
                });
            }
        }, 100);
    });

    // --- 1. 'Add Sub Item' 버튼 생성 및 툴바에 추가 ---
    if (grid_wrapper.find('.btn-add-sub-item').length === 0) {
            const add_sub_item_button = $(`<button class="btn btn-secondary btn-xs btn-add-sub-item" style="margin-right: 4px; display: none;"><i class="fa fa-chevron-right"></i> ${__('Add Sub Item')}
                                       </button>`);
            const add_row_button = grid_wrapper.find('.grid-add-row');
            if (add_row_button.length > 0) {
                add_row_button.after(add_sub_item_button);
            } else {
                grid_wrapper.find('.grid-buttons').append(add_sub_item_button);
            }
            // 버튼 클릭 이벤트
            add_sub_item_button.on('click', () => {
                // 선택된 부모가 있는지 확인
                if (!frm.custom_state.selected_parent_item) {
                    frappe.show_alert({
                        message: __('Please select a parent item from the grid first.'),
                        indicator: 'orange'
                    });
                    return;
                }

                // 새 자식 행을 추가하고, 선택된 부모의 name을 링크 필드에 설정
                const new_child = frm.add_child(child_table);
                new_child[parent_link_field] = frm.custom_state.selected_parent_item;
                frm.refresh_field(child_table);
                filter_child_grid(frm, child_table, parent_link_field, header_field);
            });
        }

    // --- 2. Master-Detail 클릭 이벤트 설정 ---
    $(grid.wrapper).on('click', '.grid-row', function(e) {
        if ($(e.target).closest('button').length > 0) return;

        const row_name = $(this).data('name');
        const add_sub_button = grid_wrapper.find('.btn-add-sub-item');

        if (frm.custom_state.selected_parent_item === row_name) {
            frm.custom_state.selected_parent_item = null;
            $(this).removeClass('selected-parent-row');
            add_sub_button.hide(); // 버튼 숨기기
        } else {
            frm.custom_state.selected_parent_item = row_name;
            $(grid.wrapper).find('.grid-row.selected-parent-row').removeClass('selected-parent-row');
            $(this).addClass('selected-parent-row');
            add_sub_button.show(); // 버튼 숨기기
        }
        filter_child_grid(frm, child_table, parent_link_field, header_field);
    });

    // --- 3. 통합 grid.refresh 몽키패치 ---
    const original_refresh = grid.refresh;
    grid.refresh = function() {
        original_refresh.apply(this, arguments);
        const grid_wrapper = $(this.wrapper);
        
        // 가. 그리드 스타일 적용 (체크박스 숨김, 인덱스 보임)
        // grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').hide();
        // grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').show();

        // 'Add Row' 버튼 이름 변경 -> 'Add Item'
        const add_row_button = grid_wrapper.find('.grid-add-row');
        if (add_row_button.length > 0) {
            add_row_button.html(`<i class="fa fa-plus"></i> ${__('Add Item')}`);
        }
        
        this.grid_rows.forEach(function(grid_row) {
            const $row = $(grid_row.row);
            const $row_wrapper = $(grid_row.wrapper);
            const $edit_button = $row.find('.btn-open-row');

            if ($edit_button.length > 0) {
                // 1. 원래 연필 버튼을 숨깁니다.
                $edit_button.html('<i class="fa fa-pencil-square-o"></i>');

                // 2. 각 행을 위한 새로운 버튼을 만듭니다.
                // $edit_button.css({
                //     'padding': '3px 10px',
                //     'line-height': '1',
                // });
                
                // $edit_button.off('click'); // 기존 클릭 이벤트 제거

                // 3. 새 버튼에 클릭 이벤트를 바인딩합니다.
                // $edit_button.on('click', function(e) {
                //     e.preventDefault();
                //     e.stopPropagation();

                //     if (!grid_row || !grid_row.doc) {
                //         frappe.msgprint(__('Unable to locate the selected row data.'));
                //         return;
                //     }
                //     const data = grid_row.doc;

                //     const dialog = new frappe.ui.Dialog({
                //         title: __("Finished Items: {0}", [data.item_code || __("Row {0}", [data.idx])]),
                //         fields: finished_item_dialog_fields(frm, data), // 이 함수는 별도로 정의되어 있어야 합니다.
                //         primary_action_label: __('Save'),
                //         primary_action: function(values) {
                //             const fields_to_update = finished_item_dialog_fields(frm, data).map(df => df.fieldname).filter(Boolean);

                //             fields_to_update.forEach(field => {
                //                 if (values.hasOwnProperty(field)) {
                //                     // grid_row 객체를 사용하여 모델 값을 설정합니다.
                //                     frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, values[field]);
                //                 }
                //             });
                            
                //             frm.refresh_field(parent_table);
                //             dialog.hide();
                //         }
                //     });

                //     dialog.show();
                // });
            }
        });

        // 나. 선택된 부모 행 스타일 유지
        if (frm.custom_state.selected_parent_item) {
            grid_wrapper.find(`.grid-row[data-name="${frm.custom_state.selected_parent_item}"]`).addClass('selected-parent-row');
        }

        // 나. 선택된 부모 행 스타일 유지
        const add_sub_button = grid_wrapper.find('.btn-add-sub-item');
        if (frm.custom_state.selected_parent_item) {
            add_sub_button.show();
        } else {
            add_sub_button.hide();
        }

        // 다. 각 행에 버튼 추가 (Add Sub, Duplicate)
        // this.grid_rows.forEach(row => {
        //     const button_container = $(row.row).find('.col[data-fieldname="item_code"]');
            
        //     // 'Add Sub' 버튼
        //     if (button_container.find('.btn-add-child').length === 0) {
        //         $(`<button class="btn btn-primary btn-xs btn-add-child" title="Add Sub-Assembly" style="margin-left: 10px;"><i class="fa fa-plus"></i></button>`)
        //             .on('click', (e) => {
        //                 e.stopPropagation();
        //                 const new_child = frm.add_child(child_table);
        //                 new_child[parent_link_field] = row.doc.name;
        //                 frm.refresh_field(child_table);
        //                 filter_child_grid(frm, child_table, parent_link_field, header_field);
        //             })
        //             .appendTo(button_container);
        //     }
        // });
        
        // 라. 'Duplicate' 버튼 설정 (전체 그리드 대상)
        setup_duplicate_button_for_grid(frm, parent_table);
    };

    grid.is_fully_enhanced = true; // 중복 실행 방지 플래그
    grid.refresh(); // 초기 실행
    filter_child_grid(frm, child_table, parent_link_field, header_field); // 초기 필터링
}

function filter_child_grid(frm, child_table, parent_link_field, header_field) {
    const child_grid = frm.fields_dict[child_table]?.grid;
    if (!child_grid) return;

    const selected_parent_id = frm.custom_state.selected_parent_item;
    let visible_count = 0;

    const header_field_obj = frm.get_field(header_field);
    if (header_field_obj) {
        const header_wrapper = header_field_obj.$wrapper;
        if (selected_parent_id) {
            const parent_doc = (frm.doc.finished_items || []).find(d => d.name === selected_parent_id);
            header_wrapper.html(`<div class="sub-assembly-title">Sub-Assemblies for: ${parent_doc ? (parent_doc.item_name || parent_doc.item_code) : '...'}</div>`);
        } else {
            header_wrapper.html(`<div class="sub-assembly-title">All Sub-Assembly Items</div>`);
        }
    }
    
    child_grid.grid_rows.forEach(row => {
        const row_element = $(row.row);
        if (selected_parent_id && row.doc[parent_link_field] !== selected_parent_id) {
            row_element.hide();
        } else {
            row_element.show();
            visible_count++;
        }
    });
    
    $(child_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
}

function customize_add_row_button(frm, table_fieldname, action, new_text = null) {
    const grid = frm.fields_dict[table_fieldname]?.grid;
    if (!grid) return;

    // 중복 실행 방지 플래그
    const flag = `is_add_row_btn_customized_${table_fieldname}`;
    if (grid[flag]) return;

    const original_refresh = grid.refresh;
    grid.refresh = function() {
        original_refresh.apply(this, arguments);
        
        const add_row_button = $(this.wrapper).find('.grid-add-row');
        if (add_row_button.length > 0) {
            if (action === 'hide') {
                add_row_button.hide();
            } else if (action === 'rename' && new_text) {
                // 버튼의 텍스트만 변경 (아이콘은 유지)
                add_row_button.html(`<i class="fa fa-plus"></i> ${__(new_text)}`);
            }
        }
    };

    grid[flag] = true;
    grid.refresh(); // 초기 실행
}


function finished_item_dialog_fields(frm, data) {
     // ... (function body remains the same) ...
    return [
        { label: __("General"), fieldtype: "Heading"},
        { fieldtype: "Section Break", hide_boder: 1},
        { label: __("Applicable Country"), fieldname: "app_country", fieldtype: "MultiSelect", default: data.app_country},
        { label: __("Disassembled"), fieldname: "disassembled", fieldtype: "Check", default: data.disassembled },
        { fieldtype: "Column Break" },
        { label: __("Zone"), fieldname: "zone", fieldtype: "Data", default: data.zone},
        { fieldtype: "Column Break" },
        { label: __("Color"), fieldname: "color", fieldtype: "Link", default: data.color, options: "Product Color" },
        { fieldtype: "Column Break" },
        

        { fieldtype: "Section Break" },
        { label: __("Panel"), fieldtype: "Heading"},
        { fieldtype: "Section Break", hide_boder: 1},
        { label: __("Product Keyword Prefix"), fieldname: "product_keyword_prefix", fieldtype: "Data", default: data.product_keyword_prefix},
        { label: __("Product Keyword Suffix"), fieldname: "product_keyword_suffix", fieldtype: "Data", default: data.product_keyword_suffix},
        { label: __("Show Qty in Brackets"), fieldname: "show_qty_bracket", fieldtype: "Check", default: data.show_qty_bracket },
        { fieldtype: "Column Break" },
        { label: __("Glass A (Outer)"), fieldname: "glass_a", fieldtype: "Link", default: data.glass_a, options: "Product Thickness"},
        { label: __("Glass B (Inner)"), fieldname: "glass_b", fieldtype: "Link", default: data.glass_b, options: "Product Thickness"},
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },
        
        { fieldtype: "Section Break" },
        { label: __("Size"), fieldtype: "Heading"},
        { fieldtype: "Section Break" },
        { label: __("Ceiling Visible Height"), fieldname: "ceiling_visible", fieldtype: "Int", default: data.ceiling_visible},
        { label: __("Width"), fieldname: "width", fieldtype: "Int", default: data.width},
        { label: "PW", fieldname: "pw", fieldtype: "Int", default: data.pw},
        // { label: "Leaf Width", fieldname: "leaf_width", fieldtype: "Int", default: data.leaf_width},
        { fieldtype: "Column Break" },
        { label: "Base Visible Height", fieldname: "base_visible_h", fieldtype: "Int", default: data.base_visible_h},
        { label: "CH", fieldname: "ch", fieldtype: "Int", default: data.ch},
        { label: "PH", fieldname: "ph", fieldtype: "Int", default: data.ph},
        // { label: "Leaf Height", fieldname: "leaf_height", fieldtype: "Int", default: data.leaf_height},
        { fieldtype: "Column Break" },
        { label: "Transom Rail Height (TRH)", fieldname: "panel_trh", fieldtype: "Int", default: data.panel_trh},
        { label: "Chair Rail Height (CRH)", fieldname: "panel_crh", fieldtype: "Int", default: data.panel_crh},
        { fieldtype: "Column Break" },
        { label: "ABL A", fieldname: "abl_a", fieldtype: "Int", default: data.abl_a},
        { label: "ABL B", fieldname: "abl_b", fieldtype: "Int", default: data.abl_b},
        { fieldtype: "Column Break" },

        { fieldtype: "Section Break" },
        { label: __("Door Unit"), fieldtype: "Heading"},
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },
        { label: __("Door Leaf A"), fieldtype: "Heading"},
        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Door Leaf B"), fieldtype: "Heading"},
        { fieldtype: "Section Break", hide_boder: 1},
        { label: __("Door Frame (Read Only)"), fieldname: "door_frame", fieldtype: "Link", default: data.door_frame, options: "Item", read_only: 1 },
        { label: __("Keeper"), fieldname: "keeper", fieldtype: "Link", default: data.keeper, options: "Selection Library"},
        { label: __("Keeper Glass A"), fieldname: "keeper_glass_a", fieldtype: "Link", default: data.keeper_glass_a, options: "Product Thickness"},
        { label: __("Keeper Glass B"), fieldname: "keeper_glass_b", fieldtype: "Link", default: data.keeper_glass_b, options: "Product Thickness"},
        { label: __("Door Options"), fieldname: "hw_options", fieldtype: "MultiSelect", default: data.hw_options},
        { label: __("Under Cut"), fieldname: "under_cut", fieldtype: "Int", default: data.under_cut},
        { fieldtype: "Column Break" },
        { label: __("Handle Direction"), fieldname: "handle_direct", fieldtype: "Link", default: data.handle_direct, options: "Selection Library"},
        { label: __("Hinge"), fieldname: "hinge", fieldtype: "Link", default: data.hinge, options: "Selection Library"},
        { label: __("Hinge Glass A"), fieldname: "hinge_glass_a", fieldtype: "Link", default: data.hinge_glass_a, options: "Product Thickness"},
        { label: __("Hinge Glass B"), fieldname: "hinge_glass_b", fieldtype: "Link", default: data.hinge_glass_b, options: "Product Thickness"},
        { fieldtype: "Column Break" },
        { label: __("Leaf A Item"), fieldname: "leaf_item_code", fieldtype: "Link", default: data.leaf_item_code, options: "Item", /* depends_on: "eval:!doc.door_frame" */ },
        { label: __("Leaf A Active Status"), fieldname: "leaf_act_status", fieldtype: "Link", default: data.leaf_act_status, options: "Selection Library"},
        { label: __("Leaf A Thk."), fieldname: "leaf_thk", fieldtype: "Link", default: data.leaf_thk, options: "Product Thickness"},
        { label: __("Leaf A Material"), fieldname: "leaf_material", fieldtype: "Link", default: data.leaf_material, options: "Selection Library"},
        { label: __("Leaf A Color"), fieldname: "leaf_color", fieldtype: "Link", default: data.leaf_color, options: "Product Color" },
        // { label: __("Leaf A Width"), fieldname: "leaf_a_width", fieldtype: "Int", default: data.leaf_a_width},
        // { label: __("Leaf A Height"), fieldname: "leaf_a_height", fieldtype: "Int", default: data.leaf_a_height},
        { label: __("Leaf A Glass A"), fieldname: "leaf_glass_a", fieldtype: "Link", default: data.leaf_glass_a, options: "Product Thickness"},
        { label: __("Leaf A Glass B"), fieldname: "leaf_glass_b", fieldtype: "Link", default: data.leaf_glass_b, options: "Product Thickness"},
        { label: __("Leaf A Auto Drop Seal"), fieldname: "auto_drop_seal", fieldtype: "Link", default: data.auto_drop_seal, options: "Selection Library"},
        { label: __("Is Pair Door"), fieldname: "is_pair_door", fieldtype: "Check", default: data.is_pair_door /* depends_on: "eval:!doc.door_frame" */ },
        { label: __("Equal Leaf Width"), fieldname: "equal_leaf_w", fieldtype: "Check", default: data.equal_leaf_w, depends_on: "eval:doc.is_pair_door == 1" },

        // Section Break for Leaf B, only shown if Is Pair Door is checked
        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Item"), fieldname: "leaf_b_item_code", fieldtype: "Link", default: data.leaf_b_item_code, options: "Item", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Active Status"), fieldname: "leaf_b_act_status", fieldtype: "Link", default: data.leaf_b_act_status, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Thk."), fieldname: "leaf_b_thk", fieldtype: "Link", default: data.leaf_b_thk, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Material"), fieldname: "leaf_b_material", fieldtype: "Link", default: data.leaf_b_material, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Color"), fieldname: "leaf_b_color", fieldtype: "Link", default: data.leaf_b_color, options: "Product Color", depends_on: "eval:doc.is_pair_door == 1" },
        // { label: __("Leaf B Width"), fieldname: "leaf_b_width", fieldtype: "Int", default: data.leaf_b_width, depends_on: "eval:doc.is_pair_door == 1" },
        // { label: __("Leaf B Height"), fieldname: "leaf_b_height", fieldtype: "Int", default: data.leaf_b_heightj, depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Glass A"), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Glass B"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Auto Drop Seal"), fieldname: "leaf_b_auto_drop_seal", fieldtype: "Link", default: data.leaf_b_auto_drop_seal, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },

        { fieldtype: "Section Break" },
        { label: __("Door Hardwares"), fieldtype: "Heading"},
        { fieldtype: "Section Break" },
        { label: __("Door HW Spec"), fieldname: "door_hw_spec_code", fieldtype: "Link", default: data.door_hw_spec_code, options: "Door Hardware Spec" },
        { label: __("Door Closer"), fieldname: "door_closer", fieldtype: "Link", default: data.door_closer, options: "Selection Library"},
        { label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Link", default: data.hinge_type, options: "Selection Library"},
        { label: __("Number of Hinge Holes"), fieldname: "hinge_num", fieldtype: "Link", default: data.hinge_num, options: "Selection Library"},
        { label: __("Flush Bolt"), fieldname: "flush_bolt", fieldtype: "Link", default: data.flush_bolt, options: "Selection Library"},
        { fieldtype: "Column Break" },
        { label: __("FGD Info"), fieldname: "fgd_info", fieldtype: "Link", default: data.fgd_info, options: "Selection Library"},
        { label: __("Tape & Seal Color"), fieldname: "tape_seal_color", fieldtype: "Link", default: data.tape_seal_color, options: "Selection Library"},
        { label: __("Fixing Screw Cap"), fieldname: "fix_screw_cap", fieldtype: "Link", default: data.fix_screw_cap, options: "Selection Library"},
        { label: __("Astragal"), fieldname: "astragal", fieldtype: "Link", default: data.astragal, options: "Selection Library"},
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },
        
        
    ];
}
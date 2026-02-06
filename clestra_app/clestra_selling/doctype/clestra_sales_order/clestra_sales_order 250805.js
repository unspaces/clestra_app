// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Clestra Sales Order", {
    // onload: function(frm) {
    //     if (frm.doc.zone_list) {
    //         frm.set_value('finish_list_name', frm.doc.default_finish_list_name);  // default_finish_list_name은 Doctype에 미리 설정한 값
    //     }
    // },
    refresh: function(frm) {
        customize_select_all_for_grid(frm, 'finished_items');
        
        // ================== 1. 상태 변수 초기화 ==================
        if (!frm.custom_state) {
            frm.custom_state = {
                selected_item: null
            };
        }

        frm.set_query('item_code', 'finished_items', function(doc, cdt, cdn) {
            // 현재 수정 중인 행(row)의 데이터를 가져옵니다.
            let row = locals[cdt][cdn];
            
            // 필터링할 특별한 product_section 값들을 배열로 정의
            const sub_item_section = ["Option", "Price Study", "Sub Contract"];

            // 1. [특별 조건] row.product_section이 sub_item_section 배열에 포함되는 경우
            if (row && sub_item_section.includes(row.product_section)) {

                if (row.indent_level == 1) {
                    row.indent_level = 2;
                }

                // product_type과 product_section 필터를 해제하고, item_group으로 필터링
                // TODO: '...' 부분에 필터링할 실제 Item Group 목록을 채워주세요.
                // 예: ['in', ['Services', 'Subcontracting', 'Options']]
                return {
                    filters: {
                        'item_group': ['in', row.product_section]
                    }
                };
            } 
            // 2. [일반 조건] 그 외의 모든 경우
            else {
                // frm.doc과 row의 값으로 Item을 필터링
                let filters = {};
                
                // 부모 문서(Clestra Sales Order)의 zone_product_type 값이 있을 경우에만 필터를 추가
                if (doc.zone_product_type) {
                    filters['product_type'] = doc.zone_product_type;
                }

                // 현재 행(row)의 product_section 값이 있을 경우에만 필터를 추가
                if (row && row.product_section) {
                    filters['product_section'] = row.product_section;
                }

                return {
                    filters: filters
                };
            }
        });

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
        // set_query_for_table(frm, 'finished_items', 'item_code', 'product_type', frm.doc.zone_product_type);
        // set_query_for_row(frm, 'finished_items', 'item_code', 'product_section', 'product_section');
        frm.set_query('zone_list', function(){
            return {
                filters: {
                    'project': frm.doc.project,
                }
            }
        })

        // ================== 4. 그리드 설정 ==================
        setup_finished_items_grid(frm);
        filter_grids(frm);

        // 'sub_assembly_items' 그리드 설정
        // setup_duplicate_button_for_grid(frm, 'sub_assembly_items');
        // 'zone_table' 그리드 설정
        // customize_grid_display(frm, 'zone_table', 'hide', 'show');
        // Add Row 버튼 커스터마이징
        // customize_add_row_button(frm, 'sub_assembly_items', 'hide');
        // customize_add_row_button(frm, 'zone_table', 'rename', 'Add Zone');

        // ================== 5. 레이아웃 조정 ==================
        // setTimeout(() => {
        //     adjust_column_widths(frm, 'column_break_mrxb', '60%', 'column_break_giyj', '40%');
        // }, 0);


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
        // project 필드가 변경되면 Zone 필터 쿼리를 다시 설정
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
    product_section: function(frm, cdt, cdn) {
        // 현재 행의 item_code와 item_name을 비웁니다.
        frappe.model.set_value(cdt, cdn, 'item_code', null);
        frappe.model.set_value(cdt, cdn, 'item_name', null);
        // 다른 관련 필드(예: description, rate 등)도 필요에 따라 비워줄 수 있습니다.
    },

    zone_name: function(frm, cdt, cdn) {
        // 현재 행의 데이터를 가져옵니다.
        const currentRow = locals[cdt][cdn];
        const newZoneName = currentRow.zone_name;

        // zone_name이 비어있으면 아무 작업도 하지 않습니다.
        if (!newZoneName) {
            return;
        }

        // 'zone_table'에 이미 해당 zone_name이 있는지 확인
        // frm.doc.zone_table이 없거나 비어있을 경우를 대비하여 (frm.doc.zone_table || []) 사용
        // const isAlreadyExists = (frm.doc.zone_table || []).some(zone_row => zone_row.zone_name === newZoneName);

        // // 존재하지 않을 경우에만 'zone_table'에 새 행을 추가
        // if (!isAlreadyExists) {
        //     // 새 행을 추가
        //     const newZoneRow = frm.add_child('zone_table');
            
        //     // 새 행의 필드 값을 설정
        //     newZoneRow.zone_name = newZoneName;
            
        //     // 만약 'zone_table'에도 project 필드가 있다면, 부모 문서의 project 값을 복사
        //     if (frm.doc.project) {
        //         newZoneRow.project = frm.doc.project;
        //     }
            
        //     // 다른 필요한 필드가 있다면 여기서 값을 설정
        //     // newZoneRow.description = "Added from Finished Items";

        //     // 'zone_table' 그리드를 새로고침하여 변경사항을 화면에 즉시 반영
        //     frm.refresh_field('zone_table');

            // frappe.show_alert({
            //     message: __("'{0}' has been added to the Zone Table.", [newZoneName]),
            //     indicator: 'green'
            // }, 5);
        // }
    },
    finished_items_add: function(frm, cdt, cdn) {
        set_default_zone(frm, cdt, cdn);
        let new_row = locals[cdt][cdn];

        // 3. [핵심 조건] 부모 참조 ID가 비어있는지 확인
        //    이 필드가 비어있다면, 'Add Item' 버튼으로 추가된 "메인 아이템"입니다.
        if (!new_row.fg_reference_id) {
            // 메인 아이템이므로, indent_level을 0으로 설정
            frappe.model.set_value(cdt, cdn, 'indent_level', 0);
        }
    }
});


function set_default_project(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.project) { // Add row check
        frappe.model.set_value(cdt, cdn, 'project', frm.doc.project);
    }
}

function set_default_zone(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (frm.doc.zone_list) {
        frappe.model.set_value(cdt, cdn, 'zone_name', frm.doc.zone_list);
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
        
        // 헤더와 모든 행의 인덱스(순번)를 표시
        if (idx_action === 'hide' || idx_action === 'show') {
            grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index')[idx_action]();
        }
    };

    // --- Monkey-Patching: 그리드의 refresh 함수 확장 ---
    // 1. 기존의 refresh 함수를 백업
    const original_refresh = grid.refresh;

    // 2. grid.refresh 함수를 새로운 함수로 덮어씁니다.
    grid.refresh = function() {
        // 3. 백업해 둔 원래 refresh 함수를 먼저 실행
        original_refresh.apply(this, arguments);
        // 4. 원래 함수가 실행된 후, 우리의 커스텀 스타일을 적용
        apply_styles(this);
    };
    
    // 초기 로드 시에도 스타일을 한 번 적용해줍니다.
    apply_styles(grid);

    // 커스터마이징이 적용되었음을 표시하여, 폼 refresh 시 중복으로 덮어쓰는 것을 방지
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
    // const selected_parent_id = frm.custom_state.selected_item;
    const finished_grid = frm.fields_dict['finished_items']?.grid;
    
    if (finished_grid) {
        let visible_count = 0;
        finished_grid.grid_rows.forEach(row => {
            const is_visible = !selected_zone || (row.doc.zone_name === selected_zone);
            // const row_selected = row.select(true);
			// const row_check_dom = row.row_check?.find(".grid-row-check").prop("checked", true);
            if (!is_visible && row.doc.__checked) {
                // row.select(false);
                row.doc.__checked = 0;
                $(row.row).find('.grid-row-check').prop('checked', false);
            }

            $(row.row).toggle(is_visible);
            if (is_visible) visible_count++;
            
        });
        
        $(finished_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
        finished_grid.refresh_check_html();
        // finished_grid.refresh();
    }
    
    // 2. sub_assembly_items 그리드 필터링
    // const sub_assembly_grid = frm.fields_dict['sub_assembly_items']?.grid;
    // const header_field = 'sub_assembly_header'; // 헤더 필드명
    
    // if (sub_assembly_grid) {
    //     let visible_count = 0;
    //     // 동적 헤더 업데이트
    //     const header_wrapper = frm.get_field(header_field)?.$wrapper;
    //     if (header_wrapper) {
    //         if (selected_parent_id) {
    //             const parent_doc = (frm.doc.finished_items || []).find(d => d.name === selected_parent_id);
    //             header_wrapper.html(`<div class="sub-assembly-title">Sub-Assemblies for: ${parent_doc ? parent_doc.item_code : '...'}</div>`);
    //         } else {
    //              header_wrapper.html(`<div class="sub-assembly-title">All Sub-Assembly Items ${selected_zone ? `in Zone: ${selected_zone}`:''}</div>`);
    //         }
    //     }

    //     sub_assembly_grid.grid_rows.forEach(row => {
    //         const matches_zone = !selected_zone || (row.doc.zone_name === selected_zone);
    //         const matches_parent = !selected_parent_id || (row.doc.parent_finished_item === selected_parent_id);
            
    //         const is_visible = matches_zone && matches_parent;
    //         $(row.row).toggle(is_visible);
    //         if (is_visible) visible_count++;
    //     });
    //     $(sub_assembly_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
    // }
}


function setup_finished_items_grid(frm) {
    const parent_table = 'finished_items';
    // const child_table = 'sub_assembly_items';
    // const parent_link_field = 'fg_item';
    // const header_field = 'sub_assembly_header';

    const grid = frm.fields_dict[parent_table].grid;
    if (!grid || grid.is_fully_enhanced) {
        return; // 이미 설정되었으면 중복 실행 방지
    }

    const grid_wrapper = $(grid.wrapper);

    grid_wrapper.on('click', '.btn-open-row', function() {
        // 'btn-open-row'는 Frappe 그리드의 기본 편집 버튼 클래스입니다.
        // 이 버튼이 클릭되면, Frappe가 내부적으로 행을 편집 모드로 전환합니다.
        // 우리는 그 직후에 Awesomplete를 적용해야 합니다.
        
        // 약간의 지연(setTimeout)을 주어 Frappe가 DOM을 완전히 렌더링할 시간을 줍니다.
        setTimeout(() => {
            const $row = $(this).closest('.grid-row');
            const row_name = $row.data('name');
            const grid_row = grid.grid_rows_by_docname[row_name];

            if (!grid_row) {
                console.error("Awesomplete: Could not find grid_row for", row_name);
                return;
            }

            // item_name 필드의 input 요소를 직접 찾습니다.
            // get_field() 대신 더 안정적인 DOM 탐색을 사용합니다.
            const $input = $row.find('[data-fieldname="item_name"] input.form-control');

            if (!$input.length) {
                console.error("Awesomplete: Could not find input for item_name in row", row_name);
                return;
            }

            // 이미 기능이 적용되었다면 다시 적용하지 않습니다.
            if ($input.data('awesomplete-enhanced')) {
                return;
            }
            $input.data('awesomplete-enhanced', true);
            console.log(`Awesomplete: Applying to row ${row_name}`);

            // Awesomplete 인스턴스를 생성합니다.
            let awesomplete = new Awesomplete($input.get(0), {
                minChars: 2,
                maxItems: 15,
                list: function(text, input) {
                    frappe.call({
                        method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.search_item_by_name",
                        args: {
                            txt: text,
                            product_section: grid_row.doc.product_section,
                            product_type: frm.doc.zone_product_type
                        },
                        callback: function(r) {
                            awesomplete.list = r.message || [];
                        }
                    });
                }
            });

            // 항목 선택 시 이벤트 처리
            $input.on("awesomplete-selectcomplete", function(e) {
                const selected_item_code = e.originalEvent.text.value;
                frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, 'item_code', selected_item_code);
            });
        }, 10); // 10ms 정도의 짧은 지연이면 충분합니다.
    });

    // grid_wrapper.on('click', '.btn-edit-row', function() {
    //     // 클릭된 버튼이 속한 행과 컬럼을 찾습니다.
    //     const $open_row = $(this).closest('.grid-row');
    //     const $form_column = $open_row.closest('.form-column');

    //     if ($form_column.length > 0) {
    //         // 원래 스타일을 저장
    //         if (!$form_column.data('original-style')) {
    //             $form_column.data('original-style', {
    //                 'flex': $form_column.css('flex'),
    //                 'max-width': $form_column.css('max-width')
    //             });
    //         }
    //         // 컬럼 너비를 임시로 확장
    //         $form_column.css({
    //             'flex': '1 1 100%',
    //             'max-width': '100%',
    //             'transition': 'all 0.2s ease-in-out'
    //         });
    //     }
    // });

    // $(grid.wrapper).on('click', '.grid-row', function(e) {
    //     if ($(e.target).closest('button').length > 0) return;

    //     const row_name = $(this).data('name');
    //     const add_sub_button = grid_wrapper.find('.btn-add-sub-item');

    //     if (frm.custom_state.selected_item === row_name) {
    //         frm.custom_state.selected_item = null;
    //         $(this).removeClass('selected-parent-row');
    //         add_sub_button.hide(); // 버튼 숨기기
    //     } else {
    //         frm.custom_state.selected_item = row_name;
    //         $(grid.wrapper).find('.grid-row.selected-parent-row').removeClass('selected-parent-row');
    //         $(this).addClass('selected-parent-row');
    //         add_sub_button.show(); // 버튼 숨기기
    //     }
    //     // filter_child_grid(frm, child_table, parent_link_field, header_field);
    // });

    // --- [핵심 수정] 폼 필드에서 포커스가 벗어날 때(blur) 원래 스타일로 복원 ---
    // 사용자가 편집을 마치고 다른 곳을 클릭하면 원래 크기로 돌아옵니다.
    // grid_wrapper.on('blur', '.form-control', function(e) {
    //     // 약간의 지연을 주어 다른 필드로 포커스가 이동하는 경우를 처리
    //     setTimeout(() => {
    //         // 현재 포커스가 여전히 그리드 내부에 있는지 확인
    //         if (!grid_wrapper.find('.form-control:focus').length) {
    //             // 포커스가 그리드 바깥으로 나갔다면 스타일을 복원
    //             $(frm.wrapper).find('.form-column').each(function() {
    //                 const $form_column = $(this);
    //                 const original_style = $form_column.data('original-style');
    //                 if (original_style) {
    //                     $form_column.css({
    //                         'flex': original_style.flex,
    //                         'max-width': original_style['max-width']
    //                     });
    //                     $form_column.removeData('original-style');
    //                 }
    //             });
    //         }
    //     }, 100);
    // });
    

    $(grid.wrapper).on('click', '.btn-add-sub-item-row', function(e) {
        e.stopPropagation();

        // 1. 클릭된 버튼이 속한 부모 행의 'name'과 'idx'를 가져옵니다.
        const $parent_row = $(this).closest('.grid-row');
        const parent_name = $parent_row.data('name');
        const parent_idx = $parent_row.data('idx');

        if (!parent_name) {
            frappe.show_alert({ message: __('Could not find the row data.'), indicator: 'red' });
            return;
        }

        // 2. 부모 행의 전체 데이터를 찾습니다.
        const parent_doc = (frm.doc.finished_items || []).find(d => d.name === parent_name);
        if (!parent_doc) {
            frappe.show_alert({ message: __('Parent item not found.'), indicator: 'red' });
            return;
        }

        // 3. 이 부모의 모든 자식들을 찾습니다.
        const children_of_parent = (frm.doc.finished_items || []).filter(
            d => d.fg_reference_id === parent_name
        );

        // 4. 행을 삽입할 위치(insert_after_idx)를 결정
        let insert_after_idx;
        if (children_of_parent.length > 0) {
            // 자식이 있다면, 자식들 중 가장 큰 idx를 찾습니다. 그 위치 다음에 삽입됩니다.
            insert_after_idx = Math.max(...children_of_parent.map(c => c.idx));
        } else {
            // 자식이 없다면, 부모 행 바로 다음에 삽입됩니다.
            insert_after_idx = parent_idx;
        }

        // 5. 새로 추가할 자식 행의 데이터 객체를 생성
        const new_child_data = {
            'indent_level': parseInt(1),
            'fg_reference_id': parent_doc.name,      // 부모의 고유 name
            'fg_item': parent_doc.item_code,         // 부모의 item_code
            'parent_row_no': parent_doc.idx,         // 부모의 행 번호(idx)
            'zone_name': parent_doc.zone_name        // 부모의 zone_name 상속
            // 필요한 다른 필드가 있다면 여기에 추가
        };

        // 6. 그리드의 정확한 위치에 새 행을 추가
        // add_new_row(insert_after_idx, callback, is_duplicate, doc)
        const new_row_doc = grid.add_new_row(insert_after_idx+1, null, null, new_child_data);

        frm.refresh_field(parent_table);
    });

    // --- 3. 통합 grid.refresh 몽키패치 ---
    const original_refresh = grid.refresh;
    grid.refresh = function() {
        original_refresh.apply(this, arguments);
        const grid_wrapper = $(this.wrapper);
        
        // 가. 그리드 스타일 적용 (체크박스 숨김, 인덱스 보임)
        // grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').hide();
        grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').hide();

        // 'Add Row' 버튼 이름 변경 -> 'Add Item'
        const add_row_button = grid_wrapper.find('.grid-add-row');
        if (add_row_button.length > 0) {
            add_row_button.html(`<i class="fa fa-plus"></i> ${__('Add Item')}`);
        }

        // 부모 - 자식 사이 bottom-border 스타일 변경
        // 1. 모든 행의 테두리 스타일을 먼저 기본값으로 초기화
        grid_wrapper.find('.grid-row').css('border-bottom', '');
        grid_wrapper.find('.grid-row .row .col').css('border-right', 'none');

        // 2. 각 행에 대해 스타일을 적용
        this.grid_rows.forEach(function(grid_row) {
            const $row = $(grid_row.row);
            const doc = grid_row.doc;

            // 각 행의 버튼 컨테이너를 찾습니다.
            const $button_container = $row.find('.row-check');

            // 그리드가 새로고침될 때마다 이전에 추가된 버튼을 제거 (중복 방지)
            $button_container.find('.btn-add-sub-item-row').remove();

            // 각 행의 스타일을 초기화
            $row.css({ 'border-bottom': '', 'margin-top': '', 'margin-bottom': '' });

            // 부모 행(indent_level == 0)에만 '하위 항목 추가' 버튼을 생성하고 스타일을 적용
            if (doc.indent_level === 0) {
                // 1. 버튼 HTML을 정의 position:absolute 스타일을 여기에 포함시킵니다.
                const $add_button_html = $(`
                    <button class="btn btn-xs btn-default btn-add-sub-item-row"
                            title="${__('Add Sub Item')}"
                            style="position: absolute; 
                                right: 5px; 
                                top: 50%; 
                                transform: translateY(-50%);
                                padding: 3px 6px; 
                                line-height: 1;">
                        <i class="fa fa-level-down"></i>
                    </button>
                `);

                // 2. 컨테이너($button_container)에 스타일을 적용하여 기준점으로 만들고, 체크박스를 중앙 정렬
                $button_container.css({
                    'position': 'relative',
                    'text-align': 'center'
                });
                
                // 3. 컨테이너에 버튼을 추가
                $button_container.append($add_button_html);

            } else {
                // 자식 행의 경우, 부모 행에 적용했을 수 있는 스타일을 초기화
                $button_container.css({
                    'position': '', // 'relative' 제거
                    'text-align': ''  // 'center' 제거 (기본값으로 돌아감)
                });
            }

        
            // 조건: indent_level이 1인 행
            if (doc.indent_level > 0) {

                $row.css('margin-top', '-4px');
                const previous_row_obj = (frm.doc.finished_items || []).find(d => d.idx === (doc.idx - 1));

                // 부모 행의 DOM 요소를 data-name 속성으로 찾습니다.
                const $previous_row = grid_wrapper.find(`.grid-row[data-name="${previous_row_obj.name}"]`);

                // 부모 행이 화면에 존재하면, 하단 테두리를 제거
                if ($previous_row.length > 0) {
                    $previous_row.css({
                        'border-bottom': 'none',
                        'margin-bottom': '-4px'
                    });
                }
            }

            const fields_to_bold = ['item_code', 'item_name'];
            const fontWeight = (doc.indent_level == 0 || doc.indent_level == null) ? 'bold' : 'normal';
            fields_to_bold.forEach(field => {
                const $cell = $row.find(`.col[data-fieldname="${field}"]`);
                if ($cell.length > 0) {
                    const $target_elements = $cell.find('input.form-control, .static-area');
                    $target_elements.css('font-weight', fontWeight);
                }
            });
        });
        
        
            // const $row_wrapper = $(grid_row.wrapper);
            // const $edit_button = $row.find('.btn-open-row');

            // if ($edit_button.length > 0) {
            //     // 1. 원래 연필 버튼을 숨깁니다.
            //     $edit_button.html('<i class="fa fa-pencil-square-o"></i>');

                // 2. 각 행을 위한 새로운 버튼을 만듭니다.
                // $edit_button.css({
                //     'padding': '3px 10px',
                //     'line-height': '1',
                // });
                
                // $edit_button.off('click'); // 기존 클릭 이벤트 제거

                // 3. 새 버튼에 클릭 이벤트를 바인딩
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
                //         fields: finished_item_dialog_fields(frm, data), // 이 함수는 별도로 정의되어 있어야 
                //         primary_action_label: __('Save'),
                //         primary_action: function(values) {
                //             const fields_to_update = finished_item_dialog_fields(frm, data).map(df => df.fieldname).filter(Boolean);

                //             fields_to_update.forEach(field => {
                //                 if (values.hasOwnProperty(field)) {
                //                     // grid_row 객체를 사용하여 모델 값을 설정
                //                     frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, values[field]);
                //                 }
                //             });
                            
                //             frm.refresh_field(parent_table);
                //             dialog.hide();
                //         }
                //     });

                //     dialog.show();
                // });
            // }

            
        // });
        

        // 나. 선택된 부모 행 스타일 유지
        // if (frm.custom_state.selected_item) {
        //     grid_wrapper.find(`.grid-row[data-name="${frm.custom_state.selected_item}"]`).addClass('selected-row');
        // }

        // 나. 선택된 부모 행 스타일 유지
        const add_sub_button = grid_wrapper.find('.btn-add-sub-item');
        if (frm.custom_state.selected_item) {
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

        // 마. 'Move to' 버튼 설정
        setup_move_to_button_for_grid(frm); 
    };

    grid.is_fully_enhanced = true; // 중복 실행 방지 플래그
    grid.refresh(); // 초기 실행
    // filter_child_grid(frm, child_table, parent_link_field, header_field); // 초기 필터링
}

/*
function filter_child_grid(frm, child_table, parent_link_field, header_field) {
    const child_grid = frm.fields_dict[child_table]?.grid;
    if (!child_grid) return;

    const selected_parent_id = frm.custom_state.selected_item;
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
    */

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

function customize_select_all_for_grid(frm, table_fieldname) {
    const grid = frm.fields_dict[table_fieldname]?.grid;
    if (!grid || grid.is_select_all_customized) {
        return;
    }

    // 기존의 check 이벤트 핸들러를 비활성화합니다.
    grid.wrapper.off("click", ".grid-row-check");

    // [핵심] grid.js의 setup_check()를 재정의(몽키패치)합니다.
    grid.setup_check = function() {
        this.wrapper.on("click", ".grid-row-check", (e) => {
            const $check = $(e.currentTarget);
            const checked = $check.prop("checked");
            const is_select_all = $check.parents(".grid-heading-row:first").length !== 0;
            const docname = $check.parents(".grid-row:first")?.attr("data-name");

            if (is_select_all) {
                // ============== 여기가 핵심 수정 부분 ==============
                // "전체 선택" 로직을 완전히 재정의합니다.
                
                // 1. 화면에 보이는 행들만 필터링합니다.
                const visible_rows = this.grid_rows.filter(row => $(row.row).is(':visible'));
                
                // 2. 보이는 행들에 대해서만 데이터 모델과 UI를 모두 변경합니다.
                visible_rows.forEach(row => {
                    // 데이터 모델 변경
                    row.doc.__checked = checked ? 1 : 0; 
                    // UI 체크박스 상태 변경
                    $(row.row).find('.grid-row-check').prop('checked', checked);
                });

            } else if (docname) {
                // 개별 행 선택 로직은 Frappe 기본 동작을 따릅니다.
                if (e.shiftKey && this.last_checked_docname) {
					this.check_range(docname, this.last_checked_docname, checked);
				}
                this.grid_rows_by_docname[docname].select(checked);
                this.last_checked_docname = docname;
            }

            // 헤더 체크박스 상태와 '삭제' 버튼 상태를 업데이트합니다.
            this.refresh_check_html(); 
            this.refresh_remove_rows_button();
        });
    };

    // 재정의된 setup_check 함수를 즉시 호출하여 새로운 이벤트 핸들러를 등록합니다.
    grid.setup_check();

    // refresh_check_html도 보이는 행 기준으로 작동하도록 보장합니다.
    grid.refresh_check_html = function() {
        if (!this.header_row || !this.header_row.global_checkbox) return;
        const visible_rows = this.grid_rows.filter(r => $(r.row).is(':visible'));
        const selected_visible_rows = visible_rows.filter(r => r.doc.__checked);
        const all_visible_are_checked = visible_rows.length > 0 && selected_visible_rows.length === visible_rows.length;
        this.header_row.global_checkbox.prop("checked", all_visible_are_checked);
    };

    grid.is_select_all_customized = true;
    console.log(`[Customize] Grid check functionality for '${table_fieldname}' has been customized.`);
}

function setup_move_to_button_for_grid(frm) {
    const table_fieldname = 'finished_items';
    const grid = frm.fields_dict[table_fieldname]?.grid;
    if (!grid) return;

    const grid_wrapper = $(grid.wrapper);

    // 이미 버튼이 추가되었는지 확인하여 중복 생성을 방지합니다.
    if (grid_wrapper.find('.btn-move-to').length > 0) {
        return;
    }

    // 'Move to' 버튼 생성
    const move_to_button = $(`<button class="btn btn-secondary btn-xs btn-move-to" style="margin-right: 4px; display: none;">
                                <i class="fa fa-arrow-right"></i> ${__('Move to')}
                              </button>`);

    // 'Duplicate' 버튼 옆에 버튼을 추가합니다.
    const duplicate_button = grid_wrapper.find('.btn-custom-duplicate');
    if (duplicate_button.length > 0) {
        duplicate_button.after(move_to_button);
    } else {
        // Duplicate 버튼이 없다면, 'Add Row' 버튼 뒤에 추가합니다.
        grid_wrapper.find('.grid-add-row').after(move_to_button);
    }

    // --- 버튼 클릭 이벤트 ---
    move_to_button.on('click', function() {
        // 1. 선택된 행들을 가져옵니다.
        const selected_rows = grid.get_selected_children();
        if (selected_rows.length === 0) {
            frappe.show_alert({ message: __('Please select rows to move.'), indicator: 'orange' });
            return;
        }

        // 2. 다이얼로그를 생성합니다.
        let dialog = new frappe.ui.Dialog({
            title: __('Move Selected Items to Zone'),
            fields: [
                {
                    label: __('Target Zone'),
                    fieldname: 'target_zone',
                    fieldtype: 'Link',
                    options: 'Zone', // Doctype 이름
                    reqd: 1,
                    // Dialog의 Link 필드에 동적 쿼리를 설정합니다.
                    get_query: function() {
                        return {
                            filters: {
                                'project': frm.doc.project
                            }
                        };
                    }
                }
            ],
            // 다이얼로그의 기본값을 현재 폼의 zone_list 값으로 설정합니다.
            primary_action_label: __('Move'),
            primary_action: (values) => {
                const target_zone = values.target_zone;
                if (!target_zone) {
                    frappe.show_alert({ message: __('Please select a target zone.'), indicator: 'red' });
                    return;
                }

                // 3. 선택된 모든 행의 zone_name 값을 변경합니다.
                selected_rows.forEach(row_doc => {
                    // 데이터 모델의 값을 직접 변경합니다.
                    frappe.model.set_value(row_doc.doctype, row_doc.name, 'zone_name', target_zone);
                    
                    // 만약 자식 아이템이 있다면, 자식의 zone_name도 함께 변경합니다.
                    const children = (frm.doc.finished_items || []).filter(d => d.fg_reference_id === row_doc.name);
                    children.forEach(child_doc => {
                        frappe.model.set_value(child_doc.doctype, child_doc.name, 'zone_name', target_zone);
                    });
                });
                
                // 4. 그리드를 새로고쳐 변경사항을 반영합니다.
                frm.refresh_field(table_fieldname);
                
                // 5. 현재 필터가 적용된 상태를 유지하기 위해 filter_grids를 다시 호출합니다.
                filter_grids(frm);
                
                frappe.show_alert({
                    message: __('{0} items moved to zone {1}', [selected_rows.length, target_zone]),
                    indicator: 'green'
                });

                dialog.hide();
            }
        });

        // 다이얼로그의 기본값을 설정합니다.
        dialog.set_value('target_zone', frm.doc.zone_list);
        dialog.show();
    });

    // --- 버튼 표시/숨김 로직 ---
    // 체크박스 상태가 변경될 때마다 Move to 버튼의 표시 여부를 결정합니다.
    grid_wrapper.on('change', '.grid-row-check, .grid-select-all', function() {
        if (grid.get_selected_children().length > 0) {
            move_to_button.show();
        } else {
            move_to_button.hide();
        }
    });
}
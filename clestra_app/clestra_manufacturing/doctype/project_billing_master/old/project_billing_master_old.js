// Copyright (c) 2024, Se Yong EOM and contributors

frappe.ui.form.on('Project Billing Master Sub Item', {
    panel_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Panel");
    },

    door_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Door");
    },

    sub_items_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Sub Items");
        fetch_and_set_print_fields(frm, cdt, cdn);
        calculate_and_set_size_field(frm, cdt, cdn);
    },

    detail_bom_items_add: function(frm, cdt, cdn) {
        frm.trigger("setup_toggle_sub_items");
    },

    item_code: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.parenttype === 'Project Billing Master' && row.parentfield === 'sub_items') {
            fetch_and_set_print_fields(frm, cdt, cdn);
        }
    },

    width: function(frm, cdt, cdn) { if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },
    uw: function(frm, cdt, cdn){ if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },
    pw: function(frm, cdt, cdn){ if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },
    ch: function(frm, cdt, cdn){ if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },
    uh: function(frm, cdt, cdn){ if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },
    ph: function(frm, cdt, cdn){ if(locals[cdt][cdn].parentfield === 'sub_items') { calculate_and_set_size_field(frm, cdt, cdn); } },

    indent_level(frm, cdt, cdn) {
        frm.trigger("setup_toggle_sub_items");
        const grid = frm.fields_dict["detail_bom_items"].grid;
        
        if (grid) { 
            const grid_row = grid.get_row(cdn);
            if(grid_row) {frm.trigger("setup_toggle_sub_items"); }
        }
    },
});

function hide_grid_columns(frm, table_field) {
    const grid = frm.fields_dict[table_field]?.grid;
    if (table_field === 'detail_bom_items') {
        if (grid.set_column_disp) {
            grid.set_column_disp("product_type", 0);
            grid.set_column_disp("item_code", 1);
            grid.set_column_disp("item_name", 0);
            grid.set_column_disp("lm", 1);
            grid.set_column_disp("color", 1);
            grid.set_column_disp("ch", 1);
            grid.set_column_disp("uh", 1);
            grid.set_column_disp("zone", 1);
            grid.set_column_disp("size", 0);
            grid.set_column_disp("width", 0);
            // grid.set_editable_grid_column_disp("lm", 1);
            // grid.set_editable_grid_column_disp("color", 1);
            // grid.set_editable_grid_column_disp("ch", 1);
            // grid.set_editable_grid_column_disp("uh", 1);
            // grid.set_editable_grid_column_disp("item_name", 0);
            // grid.set_editable_grid_column_disp("zone", 0);
            // grid.set_editable_grid_column_disp("size", 0);
            // grid.set_editable_grid_column_disp("width", 0);
        }
        console.log("Refreshing grid after attempting column display change.");
        
        grid.reset_grid();
        grid.refresh(); // 헤더와 데이터를 모두 새로고침
    }
    else if (table_field === 'panel_cover') {
        if (grid.set_column_disp) {
            grid.set_column_disp("product_keyword", 1);
            grid.set_column_disp("lm", 1);
            grid.set_column_disp("color", 1);
            grid.set_column_disp("ch", 1);
            grid.set_column_disp("uh", 1);
            grid.set_column_disp("item_name", 0);
            grid.set_column_disp("zone", 0);
            grid.set_column_disp("size", 0);
            grid.set_column_disp("width", 0);
            // grid.set_editable_grid_column_disp("lm", 1);
            // grid.set_editable_grid_column_disp("color", 1);
            // grid.set_editable_grid_column_disp("ch", 1);
            // grid.set_editable_grid_column_disp("uh", 1);
            // grid.set_editable_grid_column_disp("item_name", 0);
            // grid.set_editable_grid_column_disp("zone", 0);
            // grid.set_editable_grid_column_disp("size", 0);
            // grid.set_editable_grid_column_disp("width", 0);
        }
        console.log("Refreshing grid after attempting column display change.");
        
        grid.reset_grid();
        grid.refresh(); // 헤더와 데이터를 모두 새로고침
    }

    // if (grid && grid.wrapper) {
    //     if (table_field === 'panel_cover') {
    //         grid.wrapper.find('div[data-fieldname="item_name"]').hide();
    //         // grid.set_column_disp("product_keyword", true);
            
    //     } else if (table_field === 'door_cover') {
    //         grid.wrapper.find('div[data-fieldname="item_name"]').hide();
    //         grid.wrapper.find('div[data-fieldname="zone"]').hide();
    //         grid.wrapper.find('div[data-fieldname="depth"]').hide();
    //         grid.wrapper.find('div[data-fieldname="depth"]').hide();
    //         grid.wrapper.find('div[data-fieldname="abl_a"]').hide();
    //         grid.wrapper.find('div[data-fieldname="abl_b"]').hide();
    //         grid.wrapper.find('div[data-fieldname="qty"]').hide();
    
    //         grid.wrapper.find('div[data-fieldname="product_type"]').hide();
    //         grid.wrapper.find('div[data-fieldname="Color"]').hide();

    //     } else if (table_field == 'sub_items') {
    //         grid.wrapper.find('div[data-fieldname=""]').hide();
    //     }
    // }
}

function set_default_section(frm, cdt, cdn, section) {
    let row = locals[cdt][cdn];
    if (!row.section) {
        row.section = section;
    }
}

function fetch_and_set_print_fields(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    // Ensure item_code exists and it's the sub_items table
    if (row.item_code && row.parentfield === 'sub_items') {
        // console.log(`Fetching print fields for ${cdt} ${cdn} - Item: ${row.item_code}`);
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                filters: { name: row.item_code },
                fieldname: ["print_group", "print_order"] // Field names in Item Doctype
            },
            callback: function(r) {
                if (r.message) {
                    // console.log(`Setting print fields for ${cdn}:`, r.message);
                    // Use cur_frm.set_value for child table updates to trigger refresh correctly
                    frm.model.set_value(cdt, cdn, "print_group", r.message.print_group);
                    frm.model.set_value(cdt, cdn, "print_order", r.message.print_order);
                    // Refresh row or grid if needed immediately, otherwise rely on later refresh
                    // frm.get_field('sub_items').grid.refresh_row(cdn);
                } else {
                    // console.log(`No print fields found for item ${row.item_code}`);
                     frm.model.set_value(cdt, cdn, "print_group", null);
                     frm.model.set_value(cdt, cdn, "print_order", null);
                }
            }
        });
    }
}

// Function to calculate and set the 'size' field
function calculate_and_set_size_field(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    // Ensure it's the sub_items table
    if (row.parentfield === 'sub_items') {
        const size_parts = [];
        // Define the fields to check for the size string
        const size_field_keys = ['width', 'uw', 'pw', 'ch', 'uh', 'ph'];
        size_field_keys.forEach(key => {
            // Check if the field exists and has a non-zero/non-empty value
            if (row[key] != null && row[key] !== 0 && row[key] !== '') {
                 // Format: Use uppercase field name as prefix
                 size_parts.push(`${key.toUpperCase()}:${row[key]}`);
            }
        });

        const size_string = size_parts.join(', ');
        // console.log(`Setting size for ${cdn}: ${size_string}`);
        // Use cur_frm.set_value to ensure proper update and refresh triggers
        frm.model.set_value(cdt, cdn, "size", size_string);
        // Refresh row or grid if needed immediately
        // frm.get_field('sub_items').grid.refresh_row(cdn);
    }
}

frappe.ui.form.on('Project Billing Master', {
    onload: function (frm) {
        frm.fields_dict["po_items"].grid.get_field("app_country").get_query = function (doc, cdt, cdn) {
            return { filters: { "is_clestra": 1 } };
        };

        // const setup_pagination_wrapper = () => {
        //     const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
        //     // grid_pagination 객체가 생성되었는지 확인
        //     if (detail_bom_items_grid && detail_bom_items_grid.grid_pagination && !detail_bom_items_grid.grid_pagination._go_to_page_wrapped) {
        //         console.log("Wrapping detail_bom_items_grid.grid_pagination.go_to_page in onload.");
        //         detail_bom_items_grid.grid_pagination._go_to_page_wrapped = true; // 래핑 플래그 설정

        //         // 원래 go_to_page 함수 저장
        //         const original_go_to_page = detail_bom_items_grid.grid_pagination.go_to_page;

        //         // go_to_page 함수 래핑
        //         detail_bom_items_grid.grid_pagination.go_to_page = function() {
        //             console.log("Wrapped go_to_page called with arguments:", arguments);
        //             // 원래 go_to_page 함수 호출 (this 컨텍스트 유지 중요)
        //             original_go_to_page.apply(detail_bom_items_grid.grid_pagination, arguments);

        //             // go_to_page 실행 후 토글 설정 함수 호출
        //             // setTimeout으로 DOM 렌더링 시간 확보
        //             setTimeout(() => {
        //                 console.log("Triggering setup_toggle_sub_items after wrapped go_to_page");
        //                 frm.trigger("setup_toggle_sub_items");
        //             }, 150); // 딜레이
        //         };
        //         console.log("go_to_page wrapped successfully.");

        //     } else if (detail_bom_items_grid && detail_bom_items_grid.grid_pagination && detail_bom_items_grid.grid_pagination._go_to_page_wrapped) {
        //         console.log("go_to_page already wrapped.");
        //     } else {
        //         // 그리드나 페이지네이션 객체가 아직 준비되지 않았을 수 있음
        //         // console.warn("Summary grid or grid_pagination not ready yet for wrapping go_to_page in onload. Will retry on refresh potentially.");
        //         // 필요하다면 refresh에서 재시도 로직 추가 가능
        //     }
        // };

        // // 그리드가 즉시 준비되지 않을 수 있으므로 약간의 지연 후 시도
        // setTimeout(setup_pagination_wrapper, 500); // 0.5초 후 시도 (더 길게 필요할 수 있음)
    },

    refresh: function(frm) {
        // refresh 시에도 go_to_page 래핑 재시도 (onload에서 실패했을 경우 대비)
        const setup_pagination_wrapper_refresh = () => {
            const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
            // if (detail_bom_items_grid && detail_bom_items_grid.grid_pagination && !detail_bom_items_grid.grid_pagination._go_to_page_wrapped) {
            //     console.log("Wrapping go_to_page in refresh (retry or late init).");
                
            //     detail_bom_items_grid.grid_pagination._go_to_page_wrapped = true;
            //     const original_go_to_page = detail_bom_items_grid.grid_pagination.go_to_page;
            //     detail_bom_items_grid.grid_pagination.go_to_page = function() { /* ... 래핑 로직 (onload와 동일) ... */
            //         original_go_to_page.apply(detail_bom_items_grid.grid_pagination, arguments);
            //         setTimeout(() => { frm.trigger("setup_toggle_sub_items"); }, 150);
            //     };
            // }

            if (detail_bom_items_grid.grid_pagination.page_length !== 0) {
                console.log("Disabling pagination in get_sub_assembly_items callback.");
                detail_bom_items_grid.grid_pagination.page_length = 99999;

                // page_length 변경 후 refresh를 해야 비활성화된 상태로 렌더링됨
                console.log("Forcing detail_bom_items_grid.refresh() after setting page_length=0");
                detail_bom_items_grid.refresh();
            }
            frm.trigger("setup_toggle_sub_items");
        };

        // setTimeout(setup_pagination_wrapper_refresh, 50);
        setup_pagination_wrapper_refresh

        // Add initial row to product_type table if empty
        if (!frm.doc.po_items || frm.doc.po_items.length === 0) {
            frm.add_child('po_items');
            frm.refresh_field('po_items');
        }

        if (frm.fields_dict['door_cover']?.grid) {
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function() {
            return {
                filters: {}
            };
        };}

        // po_items 테이블의 bom_conditions 버튼 클릭 이벤트 처리
        if (frm.fields_dict['po_items']?.grid) {
            frm.fields_dict['po_items'].grid.wrapper.on('click', 'button[data-fieldname="bom_conditions"]', function() {
                // 클릭된 버튼이 속한 행 데이터 가져오기
                // let grid_row = frm.fields_dict['po_items'].grid.get_row($(this).closest('.grid-row').attr('data-name'));
                let row_name = $(this).closest('.grid-row').attr('data-name');
                let grid_row = frm.fields_dict['po_items'].grid.get_row(row_name);
                if (!grid_row) { frappe.msgprint(__('Unable to locate the selected row.')); return; }
                let data = grid_row.doc;

                let dialog = new frappe.ui.Dialog({
                    title: __("BOM Conditions"),
                    fields: [
                        {label: __("General"), fieldtype: "Heading"},
                        {label: __("Applicable Country"), fieldname: "app_country", fieldtype: "MultiSelect", default: data.app_country},
                        {label: __("Disassembled"), fieldname: "disassembled", fieldtype: "Check", default: data.disassembled},
                        // {label: 'Print Hide', fieldname: 'print_hide', default: data.print_hide, fieldtype: 'Check'}, // 프린트 숨김 처리 조건은 불필요
                        { fieldtype: "Column Break" },
                        { fieldtype: "Column Break" },

                        { fieldtype: "Section Break" },
				        { label: __("Panel"), fieldtype: "Heading"},
                        {label: __("Glass A(Outer)"), fieldname: "glass_a", fieldtype: "Link", default: data.glass_a, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 }};}},
                        {label: __("Glass B(Inner)"),fieldname: "glass_b", fieldtype: "Link", default: data.glass_b, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 }};}},
                        {label: __("Door HW Spec"), fieldname: "door_hw_spec_code", fieldtype: "Link", default: data.door_hw_spec_code, options: "Door Hardware Spec"},
                        {label: __("Color"), fieldname: "color", fieldtype: "Link", default: data.color, options: "Product Color"},

                        { label: __("Door Unit"), fieldtype: "Heading"},
                        {label: __("Door Unit Item"), fieldname: "linked_item", fieldtype: "Link", default: data.linked_item, options: "Item", read_only: 1},
                        {label: __("Door Closer"), fieldname: "door_closer", fieldtype: "Link", default: data.door_closer, options: "Selection Library", 
                            get_query: function() { return { filters: {opt_name: ["in", ["Door Closer", "YesNo"]], is_active: 1 }};}},
                        {label: __("Show Qty in Brackets"), fieldname: "show_qty_bracket", default: data.show_qty_bracket, fieldtype: "Check"},
                        {label: __("Handle Direction"), fieldname: "handle_direct", fieldtype: "link", default: data.handle_direct, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Handle Direction", is_active: 1}};}},
                        {label: __("Door Options"),fieldname: "hw_options", fieldtype: "Link", default: data.hw_options, options: "Hardware Options"},

                        { fieldtype: "Column Break" },
				        { label: __("Keeper"), fieldtype: "Heading"},
                        {label: __("Keeper"), fieldname: "keeper", fieldtype: "Link", default: data.keeper, options: "Selection Library",
                            get_query: function() { return { filters: {accy_opt: ["in", ["Hinge & Keeper", "Keeper"]], is_active: 1}};}},
                        {label: __("Keeper Glass A"), fieldname: "keeper_glass_a", fieldtype: "Link", default: data.keeper_glass_a, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
				        {label: __("Keeper Glass B"), fieldname: "keeper_glass_b", fieldtype: "Link", default: data.keeper_glass_b, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        
                        { fieldtype: "Column Break" },
                        { label: __("Hinge"), fieldtype: "Heading"},
                        {label: __("Hinge"), fieldname: "hinge", fieldtype: "Link", default: data.hinge, options: "Selection Library",
                            get_query: function() { return { filters: {accy_opt: ["in", ["Hinge & Keeper", "Hinge"]], is_active: 1}};}},
                        {label: __("Hinge Glass A"), fieldname: "hinge_glass_a", fieldtype: "Link", default: data.hinge_glass_a, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
				        {label: __("Hinge Glass B"), fieldname: "hinge_glass_b", fieldtype: "Link", default: data.hinge_glass_b, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        {label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Link", default: data.hinge, options: "Selection Library",
                            get_query: function() { return { filters: {accy_opt: "Hinge Type", is_active: 1}};}},
                        {label: __("Number of Hinge Holes"), fieldname: "hinge_num", fieldtype: "Link", default: data.hinge_num, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Number of Hinge Holes", is_active: 1}};}},

                        { fieldtype: "Column Break" },
                        { label: __("Leaf A"), fieldtype: "Heading"},
                        {label: __("Leaf A Item"), fieldname: "leaf_item_code", fieldtype: "Link", default: data.leaf_item_code, options: "Item", depends_on: "eval: !doc.linked_item || doc.linked_item.length == 0"},
                        {label: __("Leaf A Active Status"), fieldname: "leaf_act_status", fieldtype: "Link", default: data.leaf_act_status, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Leaf Active Status", is_active: 1}};}},
                        {label: __("Leaf A Thk."), fieldname: "leaf_thk", fieldtype: "Link", default: data.leaf_thk, options: "Product Thickness",
                            get_query: function() { return { filters: {type: "Leaf", is_active: 1}};}},
                        {label: __("Leaf A Color"), fieldname: "leaf_color", fieldtype: "Link", default: data.leaf_color, options: "Product Color"},
                        {label: __("Leaf A Glass A"), fieldname: "leaf_glass_a", fieldtype: "Link", default: data.leaf_glass_a, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        {label: __("Leaf A Glass B"), fieldname: "leaf_glass_b", fieldtype: "Link", default: data.leaf_glass_b, options: "Product Thickness",
                            get_query: function() { return { filters: {type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        {label: __("Leaf A Material"), fieldname: "leaf_material", fieldtype: "Link", default: data.leaf_material, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Leaf Material", is_active: 1}};}},
                        {label: __("Is Pair Door"), fieldname: "is_pair_door", fieldtype: "Check", default: data.is_pair_door, depends_on: "eval: !doc.linked_item"},
                        {label: __("Equal Leaf Width"), fieldname: "equal_leaf_w", fieldtype: "Check", default: data.equal_leaf_w, depends_on: "eval:doc.is_pair_door == 1"},

                        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
                        { label: __("Leaf B"), fieldtype: "Heading"},
                        {label: __("Leaf B Item"), fieldname: "linked_leaf_b", fieldtype: "Link", default: data.linked_leaf_b, options: "Item", depends_on: "eval:doc.is_pair_door == 1"},
                        {label: __("Leaf B Active Status"), fieldname: "leaf_b_act_status", fieldtype: "Link", default: data.leaf_b_act_status, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1",
                            get_query: function() { return { filters: {opt_name: "Leaf Active Status", is_active: 1}};}},
                        {label: __("Leaf B Thk."), fieldname: "leaf_b_thk", fieldtype: "Link", default: data.leaf_b_thk, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1",
                            get_query: function() { return { filters: {type: "Leaf", is_active: 1}};}},
                        {label: __("Leaf B Color"), fieldname: "leaf_b_color", fieldtype: "Link", default: data.leaf_b_color, options: "Product Color", depends_on: "eval:doc.is_pair_door == 1"},
                        {label: __("Leaf B Glass A."), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1",
                            get_query: function() { return { filters: {type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        {label: __("Leaf B Glass B"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1",
                            get_query: function() { return { filters: {type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1}};}},
                        {label: __("Leaf B Material"), fieldname: "leaf_material_b", fieldtype: "Link", default: data.leaf_material_b, options: "Selection Library" ,depends_on: "eval:doc.is_pair_door == 1",
                            get_query: function() { return { filters: {opt_name: "Leaf Material", is_active: 1}};}},

                        { fieldtype: "Column Break" },
                        {label: __("Door Hardwares"), fieldtype: "Heading"},
                        {label: __("Auto Drop Seal"), fieldname: "auto_drop_seal", fieldtype: "Link", default: data.auto_drop_seal, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Auto Drop Seal", is_active: 1}};}},
                        {label: __("Astragal"), fieldname: "astragal", fieldtype: "Link", default: data.astragal, options: "Selection Library",
                            Link: function() { return { filters: {opt_name: "Astragal", is_active: 1}};}},
                        {label: __("Flush Bolt"), fieldname: "flush_bolt", fieldtype: "Link", default: data.flush_bolt, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Flush Bolt", is_active: 1}};}},
                        {label: __("FGD Info"), fieldname: "fgd_info", fieldtype: "Link", default: data.tape, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "FGD", is_active: 1}};}},
                        {label: __("Tape & Seal Color"), fieldname: "tape_seal_color", fieldtype: "Link", default: data.tape_seal_color, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Tape & Seal Color", is_active: 1}};}},
                        {label: __("Fixing Screw Cap"), fieldname: "fix_screw_cap", fieldtype: "Link", default: data.fix_screw_cap, options: "Selection Library",
                            get_query: function() { return { filters: {opt_name: "Fixing Screw Cap", is_active: 1}};}},
                    ],
                    primary_action_label: __('Save'),
                    primary_action: function(data) {
                        
                        const fields = [
                            'color', 'glass_a', 'glass_b', 'linked_item', 'app_country', 'door_hw_spec_code',
                            'handle_direct', 'hw_options', 'keeper', 'keeper_glass_a', 'keeper_glass_b', 'hinge', 'hinge_glass_a', 'hinge_glass_b', 'hinge_type', 'hinge_type_custom', 'hinge_num', 'al_extend_strip',
                            'leaf_item_code', 'leaf_act_status', 'leaf_thk', 'leaf_color', 'leaf_glass_a', 'leaf_glass_b', 'leaf_material', 
                            'linked_leaf_b', 'leaf_b_act_status', 'leaf_b_thk', 'leaf_b_color', 'leaf_b_glass_a', 'leaf_b_glass_b', 'leaf_b_material',                        
                            'auto_drop_seal', 'astragal', 'flush_bolt', 'fgd_info', 'tape_seal_color', 'fix_screw_cap',
                            'is_pair_door', 'equal_leaf_w', 'print_hide', 'show_qty_bracket',
                        ];
                        
                        fields.forEach(field => {
                            frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, data[field]);
                        });

                        // 기존 row의 planned_qty, zone 값을 유지
                        let parent_door_hw_spec_code = grid_row.doc.door_hw_spec_code;
                        let parent_item_code = grid_row.doc.item_code;
                        let parent_planned_qty = grid_row.doc.planned_qty;
                        let parent_zone = grid_row.doc.zone;
                        let parent_handle_direct = grid_row.doc.handle_direct;
                        let parent_ch = grid_row.doc.ch;
                        let parent_ph = grid_row.doc.ph;
                        let parent_width = grid_row.doc.width;

                        // equal leaf width가 체크되어 있으면 부모의 width를 136으로 나눈 값으로 설정
                        if (data.equal_leaf_w && parent_width > 136) {
                            parent_width = (parent_width - 136) / 2;
                        } else {
                            parent_width = Math.max(parent_width, 0); // 음수가 되지 않도록 보정
                        }

                        function find_existing_item(frm, parent_row, field_name) {
                            let linked_name = parent_row[field_name];
                            return frm.doc.po_items.find(row => row.name === linked_name);
                        }

                        function add_or_update_item(frm, parent_row, field_name, values) {
                            let existing_row = find_existing_item(frm, parent_row, field_name);
                            
                            if (existing_row) {
                                Object.keys(values).forEach(key => {
                                    frappe.model.set_value(existing_row.doctype, existing_row.name, key, values[key]);
                                });
                            } else {
                                let new_row = frappe.model.add_child(frm.doc, "po_items");
                                Object.keys(values).forEach(key => {
                                    frappe.model.set_value(new_row.doctype, new_row.name, key, values[key]);
                                });
                                frappe.model.set_value(parent_row.doctype, parent_row.name, field_name, new_row.name);
                            }
                        }

                        // Leaf A 등록 시 자동으로 목록에 추가
                        if (data.leaf_item_code) {
                            add_or_update_item(frm, grid_row.doc, "leaf_item_ref",{
                                "door_hw_spec_code": parent_door_hw_spec_code,
                                "zone": parent_zone,
                                "linked_item": parent_item_code,
                                "planned_qty": parent_planned_qty,
                                "handle_direct": parent_handle_direct,
                                "width": parent_width,
                                "ch": parent_ch,
                                "ph": parent_ph,
                                "item_code": data.leaf_item_code,
                                "leaf_act_status": data.leaf_act_status,
                                "indent_level": 1,
                                "linked_item_ref": grid_row.doc.name,
                                "leaf_thk": data.leaf_thk,
                                "leaf_color": data.leaf_color,
                                "leaf_glass_thk": data.leaf_glass_thk,
                                "leaf_material": data.leaf_material,
                                "auto_drop_seal": data.auto_drop_seal,
                                "astragal": data.astragal,
                                "flush_bolt": data.flush_bolt,
                                "fgd_info": data.fgd_info,
                                "tape_seal_color": data.tape_seal_color,
                                "fix_screw_cap": data.fix_screw_cap
                            });
                        }

                        // Leaf B 등록 시 자동으로 목록에 추가, 필드 값은 B가 아닌 A에 입력
                        if (data.linked_leaf_b) {
                            add_or_update_item(frm, grid_row.doc, "leaf_b_name", {
                                "zone": parent_zone,
                                "linked_item": parent_item_code,
                                "planned_qty": parent_planned_qty,
                                "width": parent_width,
                                "ch": parent_ch,
                                "ph": parent_ph,
                                "item_code": data.linked_leaf_b,
                                "leaf_act_status": data.leaf_act_status_b,
                                "indent_level": 1,
                                "linked_item_ref": grid_row.doc.name,
                                "leaf_thk": data.leaf_thk_b,
                                "leaf_color": data.leaf_color_b,
                                "leaf_glass_thk": data.leaf_glass_thk_b,
                                "leaf_material": data.leaf_material_b,
                                "auto_drop_seal": data.auto_drop_seal,
                                "astragal": data.astragal,
                                "flush_bolt": data.flush_bolt,
                                "fgd_info": data.fgd_info,
                                "tape_seal_color": data.tape_seal_color,
                                "fix_screw_cap": data.fix_screw_cap
                            });
                        }

                        frm.refresh_field("po_items");
                        grid_row.refresh();

                        dialog.hide();
                    }
                });
                dialog.show();

                // MultiSelect 옵션 불러오기
                function set_multiselect_options(fieldname, targetdoctype, filtername, filtervalue, target_field) {
                    let filters = {};
                    filters[filtername] = filtervalue;
                    
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: targetdoctype,
                            filters: filters,
                            fields: [target_field]
                        },
                        callback: function(response) {
                            if (response && response.message) {
                                let options = response.message.map(d => ({ label: d[target_field], value: d[target_field] }));

                                // console.log(`[DEBUG] MultiSelect Options for ${fieldname}:`, options);
                
                                let field = dialog.fields_dict[fieldname];
                                if (field) {
                                    field.df.options = options;
                                    // field.refresh();
                                    field.set_data(options);
                                }
                            }
                        }
                    });
                }

                set_multiselect_options("app_country", "Country", "is_clestra", 1, "code");

                // 필드별 필터 조건을 설정하는 매핑
                // const field_filters = {
                //     "keeper": { accy_opt: ["Hinge & Keeper", "Keeper"] },
                //     "hinge": { accy_opt: ["Hinge & Keeper", "Hinge"] },
                //     "hinge_type": { accy_opt: "Hinge Type" },
                //     "glass_a": { type: ["Panel Glass", "Panel & Leaf Glass"] },
                //     "glass_b": { type: ["Panel Glass", "Panel & Leaf Glass"] },
                //     "leaf_thk": { type: "Leaf" },
                //     "leaf_thk_b": { type: "Leaf" },
                //     "leaf_glass_thk": { type: ["Leaf Glass", "Panel & Leaf Glass"] },
                //     "leaf_glass_thk_b": { type: ["Leaf Glass", "Panel & Leaf Glass"] },
                //     "door_hw_spec_code": { project: frm.doc.project },
                // };

                // 반복문을 활용하여 `get_query` 설정
                Object.entries(field_filters).forEach(([fieldname, filters]) => {
                    if (dialog.fields_dict[fieldname]) {
                        dialog.fields_dict[fieldname].get_query = function() {
                            let formatted_filters = {};
                            Object.entries(filters).forEach(([key, value]) => {
                                // 배열이면 `In` 조건을 적용
                                formatted_filters[key] = Array.isArray(value) ? ["in", value] : value;
                            });

                            return { filters: formatted_filters };
                        };
                    }
                });
            });
        }

        frm.trigger("update_grid_qty_view"); //SYEOM @ 241127 - Grid view Update

        // frm.trigger("setup_toggle_sub_items");

        const table_field_name = ['panel_cover', 'door_cover', 'sub_items'];
        table_field_name.forEach(function(table_field) {
            hide_grid_columns(frm, table_field);
            // const grid = frm.fields_dict[table_field]?.grid; // 그리드 존재 여부 확인
            // if (grid && !grid.hasOwnProperty('original_refresh_' + table_field)) { // 고유 플래그
            //     grid['original_refresh_' + table_field] = grid.refresh;
            //     grid.refresh = function(...args) {
            //         grid['original_refresh_' + table_field].apply(grid, args);
            //         hide_grid_columns(frm, table_field);
            //     };

            //     if(frm.doc[table_field]?.length > 0) {
            //         grid.refresh();
            //     }
            // }
            // if (grid && frm.doc[table_field]?.length > 0) { grid.refresh();}
            // const original_refresh = frm.fields_dict[table_field].grid.refresh;
            // frm.fields_dict[table_field].grid.refresh = function(...args) {
            //     original_refresh.apply(this, args);
            //     hide_grid_columns(frm, table_field);
            // };
            // frm.fields_dict[table_field].grid.refresh(); // 그리드를 강제로 리프레시
            // frm.refresh_field(table_field); // 테이블 필드 리프레시
        });
    },

    setup_queries(frm) {
        frm.set_query("bom_no", "po_items", (doc, cdt, cdn) => {
            var d = locals[cdt][cdn];
            if (d.item_code) {
                return {
                    query: "erpnext.controllers.queries.bom",
                    filters: { item: d.item_code, docstatus: 1 },
                };
            } else frappe.msgprint(__("Please enter Item first"));
        });
    },

    // get_items(frm) {
    // 	frm.clear_table("prod_plan_references");

    // 	frappe.call({
    // 		method: "get_items",
    // 		freeze: true,
    // 		doc: frm.doc,
    // 		callback: function () {
    // 			refresh_field("po_items");
    // 		},
    // 	});
    // },

    // combine_items(frm) {
    // 	frm.clear_table("prod_plan_references");

    // 	frappe.call({
    // 		method: "get_items",
    // 		freeze: true,
    // 		doc: frm.doc,
    // 		callback: function () {
    // 			frm.refresh_field("po_items");
    // 			if (frm.doc.sub_assembly_items.length > 0) {
    // 				frm.trigger("get_sub_assembly_items");
    // 			}
    // 		},
    // 	});
    // },

    get_sub_assembly_items(frm) {
        frm.dirty();
        frappe.call({
            method: "get_sub_assembly_items",
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                console.log("get_sub_assembly_items callback started");

                // 1. 필드 새로고침 (데이터 로드)
                refresh_field("detail_bom_items");

                // 2. 그리드 객체 가져오기
                const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;

                // 3. 페이지네이션 비활성화 적용
                if (detail_bom_items_grid && detail_bom_items_grid.df) {
                    if (detail_bom_items_grid.grid_pagination.page_length !== 0) {
                        console.log("Disabling pagination in get_sub_assembly_items callback.");
                        detail_bom_items_grid.grid_pagination.page_length = 99999;

                        // 4. *** 중요: 설정을 적용하기 위해 그리드 refresh 강제 호출 ***
                        // page_length 변경 후 refresh를 해야 비활성화된 상태로 렌더링됨
                        console.log("Forcing detail_bom_items_grid.refresh() after setting page_length=0");
                        detail_bom_items_grid.refresh();
                    }
                } else {
                    console.warn("Summary grid or grid.df not found in callback.");
                }

                frm.trigger("update_grid_qty_view"); 

                frm.trigger("setup_toggle_sub_items");
            },
            always: function () {
                frm._getting_sub_assembly_items = false; // 플래그 초기화
            },
        });
    },

    generate_billing(frm) {
        frm.dirty();
        frappe.call({
            method: "generate_billing",
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                console.log("generate_billing callback started");

                // 1. 필드 새로고침 (데이터 로드)
                refresh_field("panel_cover");
                refresh_field("door_cover");
                refresh_field("sub_items");

                // 2. 그리드 객체 가져오기
                const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;

                 // 3. 다른 UI 업데이트 //SYEOM @ 241127 - Grid view Update
                frm.trigger("update_grid_qty_view"); 
                frm.trigger("setup_toggle_sub_items");

            },
        });
    },

    setup_toggle_sub_items(frm) {
        const grid = frm.fields_dict['detail_bom_items']?.grid;
        const all_items = frm.doc.detail_bom_items || []; // 전체 데이터

        // 그리드나 데이터가 없으면 중단
        if (!grid || !grid.grid_rows || all_items.length === 0) {
            // console.warn("Summary Items grid/data not ready.");
            return;
        }

        // 1. _expanded 상태 초기화 (전체 데이터 대상)
        all_items.forEach(doc_row => {
            if (doc_row.indent_level === 0 && doc_row._expanded === undefined) {
                doc_row._expanded = false; // 기본값: 축소됨
            }
        });

        // 2. 모든 그리드 행(이제 전체 데이터와 동일)을 기준으로 버튼 생성 및 표시 상태 설정
        grid.grid_rows.forEach(function (grid_row) {
            const row_doc = grid_row.doc; // 행 데이터
            const $row_wrapper = $(grid_row.wrapper); // 행 DOM 요소

            if (!$row_wrapper.length) return;

            // 해당 행의 전체 데이터 찾기 (상태 접근용)
            const doc_data_row = all_items.find(d => d.name === row_doc.name);
            if (!doc_data_row) return;

            // --- 부모 행 (indent_level === 0) 처리 ---
            if (doc_data_row.indent_level === 0) {
                let $button_container = $row_wrapper.find('.row-check');
                 if (!$button_container.length) {
                     $button_container = $row_wrapper.find('div[data-col-idx="1"]');
                }

                if ($button_container.length > 0) {
                    $button_container.find('.toggle-sub-items').remove();

                    const is_expanded = doc_data_row._expanded;
                    const button_icon = is_expanded ? "▼" : "▶";
                    const $toggle_button = $(`
                        <button class="btn btn-xs btn-default toggle-sub-items"
                            title="Toggle Sub Items"
                            style="margin-right: 5px; font-size: 12px; padding: 0 5px; line-height: 1.2;">
                            ${button_icon}
                        </button>
                    `);
                    $button_container.prepend($toggle_button);

                    $toggle_button.off("click").on("click", function (e) {
                        e.stopPropagation();
                        const current_doc_row = all_items.find(d => d.name === row_doc.name);
                        if (!current_doc_row) return;

                        const new_expanded_state = !current_doc_row._expanded;
                        current_doc_row._expanded = new_expanded_state; // 상태 업데이트 (frm.doc)
                        $(this).html(new_expanded_state ? "▼" : "▶"); // 버튼 아이콘 업데이트

                        // 자손 토글 로직 (인덱스 기반)
                        const parent_idx = all_items.findIndex(d => d.name === current_doc_row.name);
                        if (parent_idx === -1) return;
                        let next_parent_idx = -1;
                        for (let i = parent_idx + 1; i < all_items.length; i++) {
                            if (all_items[i].indent_level === 0) {
                                next_parent_idx = i;
                                break;
                            }
                        }
                        const start_idx = parent_idx + 1;
                        const end_idx = (next_parent_idx === -1) ? all_items.length : next_parent_idx;

                        // 현재 페이지에 보이는 자손만 DOM 조작
                        for (let i = start_idx; i < end_idx; i++) {
                            const descendant_grid_row = grid.grid_rows.find(gr => gr.doc.name === all_items[i].name);
                            if (descendant_grid_row) {
                                const $descendant_wrapper = $(descendant_grid_row.wrapper);
                                if ($descendant_wrapper.length) {
                                     new_expanded_state ? $descendant_wrapper.show() : $descendant_wrapper.hide();
                                }
                            }
                        }
                    });
                }
            }
            // --- 자식/자손 행 (indent_level > 0) 처리 ---
            else {
                 $row_wrapper.find('.row-check .toggle-sub-items').remove();

                 // 초기 표시 상태 설정 (부모의 상태 확인)
                 let ancestor_parent_expanded = false;
                 let current_idx = all_items.findIndex(d => d.name === doc_data_row.name);
                 if (current_idx > -1) {
                    for (let i = current_idx - 1; i >= 0; i--) {
                        if (all_items[i].indent_level === 0) {
                            ancestor_parent_expanded = all_items[i]._expanded;
                            break;
                        }
                    }
                 }
                 ancestor_parent_expanded ? $row_wrapper.show() : $row_wrapper.hide();
            }
        });
    },
    
            // // indent_level > 0은 기본적으로 숨기기
            // if (row.indent_level > 0) {
            //     const $grid_row = frm.fields_dict['door_items'].grid.wrapper.find(`[data-name="${row.name}"]`);

            //     const parent_row = frm.doc.door_items.find(d =>
            //         d.name === row.production_plan_item && d.indent_level === 0
            //     );
            //     console.log("▶ Parent Row:", parent_row);

            //     if (!parent_row || !parent_row._expanded) {
            //         $grid_row.hide();
            //     } else {
            //         $grid_row.show();
            //         console.log("▶ Showing row:", row.name);
            //     }

            //     const $row_check = $(grid_row.wrapper).find('.row-check');
            //     $row_check.find('.toggle-sub-items').remove();
            // }

    //         grid_row.refresh();
    //     });
    // },

    //SYEOM @ 241127 - Qty in bracket on grid view
    update_grid_qty_view(frm) {
        frm.fields_dict["sub_items"].grid.grid_rows.forEach(function (row) {
            let item = row.doc;
            // Row의 필드에 안전하게 접근하기 위해 조건 확인
            if (!item || !row || !row.wrapper) {
                return; // 필드가 정의되지 않았으면 해당 Row 스킵
            }
    
            // qty 셀 DOM 요소 가져오기
            let $qty_cell = $(row.wrapper).find('[data-fieldname="qty"]');
    
            if ($qty_cell.length > 0) {
                // Bracket 스타일 추가 또는 제거
                if (item.show_qty_bracket) {
                    $qty_cell.addClass("qty-bracket"); // Bracket 스타일 추가
                } else {
                    $qty_cell.removeClass("qty-bracket"); // Bracket 스타일 제거
                }
            }
            // 개별 행 새로고침
            row.refresh();
        });
    },
});


frappe.ui.form.on("Project Billing Master Item", {
    item_code(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.call({
                method: "clestra_app.clestra_manufacturing.doctype.project_billing_master.project_billing_master.get_item_data",
                args: {
                    item_code: row.item_code,
                }, 
                callback: function (r) {
                    for (let key in r.message) {
                        frappe.model.set_value(cdt, cdn, key, r.message[key]);
                    }
                },
            });
        }
    },

    
});


frappe.ui.form.on('Door Hardware Spec Child', {
    hw_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.hw_code) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Door Hardware Spec',
                    fieldname: [
                        "by_gumi", "by_tc", "by_local", "open_type", "door_leaf_thk", 
                        "door_leaf_thk_custom", "set_type", "sliding_operation", 
                        "soft_closing", "guide_roller", "rail_cover", "hanging", 
                        "handle", "lockset_black_color", "lockset_h", "lockset_h_custom", 
                        "lockset_h_2nd", "lockset_h_2nd_custom", "dummy", "dummy_for_pair", 
                        "dummy_black_color", "mortise", "security_access_control", "wiring", 
                        "key_cylinder", "master_key", "master_key_number", "door_closer", 
                        "door_closer_name", "inactive_leaf", "al_strip", "auto_drop_seal", 
                        "other_auto_drop_seal", "ads_cover_painted", "for_lockset", 
                        "for_door_closer", "hinge_type", "butt", 
                        "custom_butt", "pivot", "custom_pivot", "hinge_other", 
                        "custom_hinge", "flush_bolt", "flush_bolt_type", "custom_flush_bolt", 
                        "uc", "color", "blind", "fgd_type", 
                        "3m_tape_and_form_seal_color", "tape_seal_color_gray", 
                        "tape_seal_color_white", "tape_seal_color_black", 
                        "fixing_screw_cap_color", "fix_screw_gray", "fix_screw_white", 
                        "fix_screw_black", "back_painted_border", "back_painted_no", 
                        "back_painted_yes", "note"
                    ],
                    filters: {
                        code: row.hw_code
                    }
                },
                callback: function(r) {
                    if (r.message) {
                        // Fetch된 값을 매핑하여 채우기
                        Object.keys(r.message).forEach(field => {
                            frappe.model.set_value(cdt, cdn, field, r.message[field]);
                        });
                        
                        frm.refresh_field("door_master");
                    }
                }
            });
        }
    }
});
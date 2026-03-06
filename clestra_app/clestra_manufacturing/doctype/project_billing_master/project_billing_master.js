// Copyright (c) 2024, Se Yong EOM and contributors
// erpnext/erpnext/manufacturing/doctype/project_billing_master/project_billing_master.js

frappe.ui.form.on('Project Billing Master', {
    onload: function (frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value('User', frappe.session.user, 'company')
                .then(r => {
                    if (r && r.message && r.message.company) {
                        frm.set_value('company', r.message.company);
                    }
                });
        };

        frm.fields_dict["po_items"].grid.get_field("app_country").get_query = function (doc, cdt, cdn) {
            return { filters: { "is_clestra": 1 } };
        };

        if (frm.fields_dict['door_cover']?.grid) {
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function () {
                return {
                    filters: {}
                };
            };
        }
    },

    refresh: function (frm) {
        frm.set_query('project', function (doc, cdt, cdn) {
            return {
                filters: {
                    'job_id': doc.job_id,
                    'contract_no': doc.contract_no
                }
            };
        });

        frm.set_query('sales_order', function (doc, cdt, cdn) {
            return {
                filters: {
                    'project': doc.project,
                }
            };
        });

        const child_table_for_billing = ['panel_cover', 'door_cover', 'sub_items'];
        const child_table_for_bom = ['detail_bom_items'];
        const child_table_to_reset = [...child_table_for_billing, ...child_table_for_bom];
        // 사용자 설정 초기화: 최초 1회만 실행 (매 refresh마다 5개 서버 호출 방지)
        if (!frm._grid_columns_initialized) {
            child_table_to_reset.forEach(fieldname => {
                const grid = frm.fields_dict[fieldname]?.grid;
                let selected_columns_for_grid = [];
                let value = {};
                value[grid.doctype] = selected_columns_for_grid;
                frappe.model.user_settings.save(frm.doctype, "GridView", value).then((r) => {
                    frappe.model.user_settings[frm.doctype] = r.message || r;
                    grid.reset_grid();
                });
            });
            frm._grid_columns_initialized = true;
        }

        const po_items_cols = ["item_code", "bom_no", "zone", "color", "ch", "width", "planned_qty", "bom_conditions"];
        const detail_bom_items_cols = ["old_idx", "item_code", "item_name", "size", "qty", "color", "remark", "zone"];
        const panel_cover_cols = ["old_idx", "product_keyword", "size", "color", "remark", "qty"];
        const door_cover_cols = ["old_idx", "door_hw_spec", "product_keyword", "size", "remark", "color", "qty"];
        const sub_items_cols = ["old_idx", "print_group", "print_order", "item_name", "size", "qty", "color", "remark"];

        set_custom_grid_columns(frm, 'po_items', po_items_cols, false);
        set_custom_grid_columns(frm, 'detail_bom_items', detail_bom_items_cols, true);
        set_custom_grid_columns(frm, 'panel_cover', panel_cover_cols, true);
        set_custom_grid_columns(frm, 'door_cover', door_cover_cols, true);
        set_custom_grid_columns(frm, 'sub_items', sub_items_cols, true);

        // --- Existing Refresh Logic ---
        // Setup toggles (call after grids are expected to be reset/refreshed)
        // Using a timeout here aligns with the grid reset timeout
        setTimeout(() => {
            // Group-based pagination for detail_bom_items grid
            const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
            if (detail_bom_items_grid) {
                setup_group_pagination(frm);
                detail_bom_items_grid.refresh();
                setTimeout(() => {
                    setup_detail_bom_grid(frm);

                    update_grid_qty_view(frm);
                    setup_qty_field(frm);
                    setup_size_field(frm);

                    child_table_for_billing.forEach(grid_name => {
                        const grid = frm.fields_dict[grid_name].grid;
                        if (grid && grid.wrapper) {
                            grid.wrapper.find('div.grid-heading-row .row-index').hide();
                            grid.wrapper.find('.row-index').hide();
                            // console.log(`[${grid_name}] Row index hidden.`);
                        }
                    });
                }, 200);
            }
        }, 100); // Small delay after grid resets are potentially queued

        if (!frm.doc.po_items || frm.doc.po_items.length === 0) {
            if (frappe.perm.has_perm(frm.doctype, 0, "write")) { // Check write permission for parent doctype
                frm.add_child('po_items');
                frm.refresh_field('po_items'); // Refresh the field to show the added row
            }
        }

        setup_po_items_grid(frm);

        // 초기 로드 시 버튼 상태 설정
        toggle_duplicate_button(frm);

        const grid = frm.fields_dict['po_items']?.grid;
        if (grid && grid.refresh) {
            // 이 호출이 onload에서 확장된 refresh 함수를 실행시킵니다.
            grid.refresh();
        }

        // Re-attach dynamic query for door_cover grid (ensure fieldname is correct 'hw_spec_code' vs 'door_hw_spec')
        if (frm.fields_dict['door_cover']?.grid) {
            // Assuming the Link field on the grid is 'hw_spec_code' as in this block
            // If the field is 'door_hw_spec', adjust the fieldname below
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function () {
                return { filters: {} }; // Re-apply query logic as needed
            };
            // Also ensure queries for other Link fields in door_cover are set up if necessary
        }

        frm.set_query("item_code", "po_items", function (doc, cdt, cdn) {
            const row = locals[cdt][cdn];
            let filters = {};

            // is_component_row 플래그를 확인하여 필터를 분기합니다.
            if (row && row.is_component_row) {
                // "Add Component"로 추가된 행일 경우
                filters = {
                    "item_group": ["in", ["Sub Contract", "Option", "Price Study"]]
                };
            } else {
                // "Add Row"로 추가된 일반 행일 경우
                filters = {
                    "item_group": ["=", "Finished Product"]
                };
            }

            // 최종 필터 객체를 반환합니다.
            return {
                filters: filters
            };
        });

        frm.set_query("bom_no", "po_items", (doc, cdt, cdn) => {
            var d = locals[cdt][cdn];
            if (d.item_code) {
                console.log("Company being sent:", doc.company);
                return {
                    query: "clestra_app.clestra_manufacturing.doctype.project_billing_master.project_billing_master.bom",
                    filters: { item: d.item_code, docstatus: 1, company: doc.company },
                };

            } else {
                frappe.msgprint(__("Please enter Item first"));
                return false; // Prevent query if no item code
            }
        });
    },

    update_grid_qty_js_string(frm) {
        // Special handling for grids using custom qty dialog/display
        const grid_fieldnames_with_custom_qty_display = ['door_cover']; // Add others if needed
        grid_fieldnames_with_custom_qty_display.forEach(fieldname => {
            const grid = frm.fields_dict[fieldname]?.grid;
            if (grid && grid.grid_rows) {
                grid.grid_rows.forEach(grid_row => {
                    let row_doc = grid_row.doc;
                    if (row_doc && grid_row.wrapper) {
                        const qty_string = generate_js_qty_string(row_doc);
                        let $qty_cell_static = $(grid_row.wrapper).find('[data-fieldname="qty"] .static-area');
                        if ($qty_cell_static.length > 0) {
                            $qty_cell_static.text(qty_string).show();
                            // Ensure the input area is hidden if this is display-only
                            $(grid_row.wrapper).find('[data-fieldname="qty"] .field-area').hide();
                            // console.log(`Row ${item.name}: updated custom qty display with "${qty_string}"`);
                        }
                    }
                });
                // console.log(`Initial/Updated Qty text set for grid: ${fieldname}`);
            }
        });
    },

    // --- Other Form-level event handlers ---

    get_sub_assembly_items(frm) {
        // ... (Keep existing get_sub_assembly_items function logic here) ...

        const selected_items = frm.fields_dict.po_items.grid.get_selected_children();
        const selected_names = selected_items.map(doc => doc.name);

        if (selected_names.length > 0) {
            // 선택된 행이 있을 경우, 사용자에게 작업 선택 다이얼로그 표시
            frappe.prompt(
                [
                    {
                        label: __('Choose an action for the selected items'),
                        fieldname: 'action',
                        fieldtype: 'Select',
                        options: [
                            { label: __('Append to existing items'), value: 'append' },
                            { label: __('Replace all items'), value: 'replace' }
                        ],
                        reqd: 1,
                        default: 'append'
                    }
                ],
                function (values) {
                    if (values && values.action) {
                        if (values.action === 'append') {
                            // 기존 항목에 추가
                            frm.events.call_get_sub_assembly_items(frm, selected_names, true);
                        } else {
                            // 전체 교체 (선택된 항목으로)
                            frm.events.call_get_sub_assembly_items(frm, selected_names, false);
                        }
                    }
                },
                __('BOM Generation Action'), // Dialog Title
                __('Confirm') // Primary Button Label
            );
        } else {
            // 선택된 행이 없을 경우, 전체 항목으로 교체 (기존 동작)
            frappe.confirm(
                __('This will clear all existing items in the BOM Details table and regenerate them. Are you sure you want to continue?'),
                () => {
                    frm.events.call_get_sub_assembly_items(frm, null, false);
                }
            );
        }
    },


    call_get_sub_assembly_items(frm, selected_names = null, append_only = false) {
        if (frm._getting_sub_assembly_items) return;
        frm._getting_sub_assembly_items = true;
        frm.dirty();

        let args = {
            append_only: append_only
        };

        if (selected_names) {
            args.selected_po_items = JSON.stringify(selected_names);
        }

        frappe.call({
            method: "get_sub_assembly_items",
            freeze: true,
            doc: frm.doc,
            args: args,
            callback: function (r) {
                // console.log("get_sub_assembly_items callback started");
                // Assuming the backend updates frm.doc.detail_bom_items directly.
                setTimeout(() => {
                    refresh_field("detail_bom_items"); // Refresh the field to show new data

                    const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
                    if (detail_bom_items_grid) {
                        setup_group_pagination(frm);
                    }
                    setup_detail_bom_grid(frm);

                    update_grid_qty_view(frm);
                    frm.trigger("update_grid_qty_js_string");
                }, 200);

            },
            always: function () {
                frm._getting_sub_assembly_items = false;
            },
        });
    },

    generate_billing: function (frm) {
        frm.dirty();
        frappe.call({
            method: "generate_billing",
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                // frappe.hide_progress();
                const panel_cover_cols = ["old_idx", "product_keyword", "size", "color", "remark", "qty"];
                const door_cover_cols = ["old_idx", "door_hw_spec", "product_keyword", "size", "remark", "qty"];
                const sub_items_cols = ["old_idx", "print_group", "print_order", "item_name", "size", "color", "remark", "qty"];

                // console.log("generate_billing callback started");
                set_custom_grid_columns(frm, 'panel_cover', panel_cover_cols, true);
                set_custom_grid_columns(frm, 'door_cover', door_cover_cols, true);
                set_custom_grid_columns(frm, 'sub_items', sub_items_cols, true);

                setTimeout(() => {
                    frm.trigger("update_grid_qty_js_string");
                    setup_detail_bom_grid(frm);
                    update_grid_qty_view(frm);
                    setup_qty_field(frm);
                    setup_size_field(frm);
                }, 100);
            },
            error: function (r) {
                // console.error("Error during generate_billing:", r);
                frappe.msgprint(__("Error generating billing data."));
            }
        });
    },

    sales_order: function (frm) {
        if (frm.doc.sales_order) {
            frappe.confirm(
                __('Do you want to load items from Sales Order {0}?', [frm.doc.sales_order]),
                () => {
                    frappe.call({
                        method: "get_sales_order_items",
                        doc: frm.doc,
                        freeze: true,
                        freeze_message: __('Loading Items from Sales Order...'),
                        callback: function (r) {
                            if (r.message) {
                                const data = r.message;

                                // [로그 추가] 서버에서 온 전체 데이터 확인
                                console.log("Server Response:", data);
                                console.log("Fetched Notes Value:", data.notes);

                                const items = data.items || [];

                                // [수정] 중요: Python은 "notes" 키로 보냈으므로 data.notes로 받아야 합니다.
                                const notes_val = data.notes || "";

                                if (items.length > 0) {
                                    frm.clear_table("po_items");

                                    items.forEach(item => {
                                        let row = frm.add_child("po_items");
                                        Object.assign(row, item);
                                    });

                                    frm.refresh_field("po_items");
                                    frappe.msgprint(__("Items loaded successfully from Sales Order."));
                                } else {
                                    frappe.msgprint(__("No finished items found in this Sales Order (checked filters)."));
                                }

                                const fields_to_set = [
                                    "notes", "sub_no", "serial_no", "revision",
                                    "shipping_method", "city", "country", "street_address",
                                    "ex_work_date", "on_site_date"
                                ];

                                fields_to_set.forEach(field => {
                                    // 데이터가 undefined가 아닐 때만 설정 (빈 문자열 포함)
                                    if (data[field] !== undefined) {
                                        frm.set_value(field, data[field]);
                                    }
                                });
                            }
                        }
                    });
                },
                () => {
                    // 아니오(No) 선택 시 로직
                }
            );
        }
    },
});

// --- Child Table Event Handlers (on Project Billing Master Sub Item) ---
frappe.ui.form.on("Project Billing Master Sub Item", {

    // show_qty_bracket field change
    show_qty_bracket: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        const parent_grid_fieldname = row?.parentfield; // Use optional chaining

        const possible_parent_grids = ["detail_bom_items", "door_cover", "panel_cover", "sub_items"];
        if (!parent_grid_fieldname || !possible_parent_grids.includes(parent_grid_fieldname)) {
            //  console.warn("show_qty_bracket: Parent grid fieldname not valid:", parent_grid_fieldname);
            return;
        }

        // Find the specific grid row object
        const grid = frm.fields_dict[parent_grid_fieldname]?.grid;
        // Use grid_rows_by_docname for efficient lookup by document name
        const grid_row = grid?.grid_rows_by_docname?.[cdn];

        if (grid_row && grid_row.wrapper && row) { // Add row check
            let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');
            if ($qty_cell.length > 0) {
                // Toggle the 'qty-bracket' class based on the boolean value of row.show_qty_bracket
                $qty_cell.toggleClass("qty-bracket", !!row.show_qty_bracket);
                console.log(`Toggled qty-bracket for row ${cdn} based on show_qty_bracket: ${!!row.show_qty_bracket}`);
            } else {
                // console.warn(`show_qty_bracket: Could not find cell for qty in row: ${cdn}`);
            }
        }
    },

    qty_prefix: function (frm, cdt, cdn) {
        update_specific_row_qty_display(frm, cdt, cdn)
    },

    qty_suffix: function (frm, cdt, cdn) {
        update_specific_row_qty_display(frm, cdt, cdn)
    },

    qty: function (frm, cdt, cdn) {
        update_specific_row_qty_display(frm, cdt, cdn)
    },

    // on_change handler for item_code in Project Billing Master Sub Item
    item_code: function (frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        // Check if this row belongs to the 'sub_items' table field of the parent doc
        if (row?.parenttype === 'Project Billing Master' && row.parentfield === 'sub_items') {
            // Fetch print_group and print_order from the Item doctype
            fetch_and_set_print_fields(frm, cdt, cdn);
        }
        // Add checks for other parentfields if item_code triggers logic there too
    },

    // on_change handler for indent_level in Project Billing Master Sub Item
    indent_level(frm, cdt, cdn) {
        // This handler seems intended to trigger the toggle logic when indent levels change.
        // Calling the trigger directly is fine, but it might cause the toggle logic
        // to run frequently. Ensure apply_toggle_logic is performant.
        // The main refresh handler already calls apply_toggle_logic via setup_detail_bom_grid.
        // You might only need this if indent_level can change *after* initial load/refresh.
        // const grid = frm.fields_dict["detail_bom_items"].grid;
        // if (grid) {
        //     const grid_row = grid.get_row(cdn); // get_row is for rendered rows, might be null if not visible
        //     if(grid_row) {
        setup_detail_bom_grid(frm); // Re-setup toggles based on new hierarchy
        //     }
        // }
    },

    // `_add` triggers for different child tables
    panel_cover_add: function (frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Panel");
    },
    door_cover_add: function (frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Door");
    },
    sub_items_add: function (frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Sub Items");
        // Automatically fetch print fields when a sub_items row is added
        fetch_and_set_print_fields(frm, cdt, cdn);
    },
    detail_bom_items_add: function (frm, cdt, cdn) {
        // When a detail_bom_items row is added, re-setup toggles
        setup_detail_bom_grid(frm);
    },

    // Add other field change handlers for Project Billing Master Sub Item if needed,
    // e.g., for size-related fields if set_size_field logic should run automatically
    // width: function(frm, cdt, cdn) { set_size_field(frm, cdt, cdn); },
    // leaf_width: function(frm, cdt, cdn) { set_size_field(frm, cdt, cdn); },
    // ... etc. - make sure generate_js_size_string uses the correct fields based on product_section
    // Ensure open_size_edit_dialog also uses these handlers or calls set_size_field logic on save.

    // Add on_change handlers for handle quantity fields if generate_js_qty_string should run automatically
    // rh_qty: function(frm, cdt, cdn) { /* Logic to update qty display */ },
    // ... etc. - or rely on the dialog update and update_grid_qty_view trigger.

});

// --- Child Table Event Handlers (on other child doctypes if they are used as grid options) ---

// Event handlers for the Doctype used by 'po_items' grid (assuming it's 'Project Billing Master Item')
frappe.ui.form.on("Project Billing Master Item", {
    // item_code change on 'po_items' grid
    item_code(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        // Check if this handler is for a row in the 'po_items' table
        if (row?.parenttype === 'Project Billing Master' && row.parentfield === 'po_items') {
            if (row.item_code) {
                frappe.call({
                    // Ensure this server-side method exists and returns the correct data (e.g., description, item_name, uom)
                    method: "clestra_app.clestra_manufacturing.doctype.project_billing_master.project_billing_master.get_item_data",
                    args: {
                        item_code: row.item_code,
                        company: frm.doc.company
                    },
                    callback: function (r) {
                        if (r.message) {
                            // Update relevant fields in the row using model.set_value
                            for (let key in r.message) {
                                // Check if the key exists as a field in the child doctype before setting
                                if (frappe.meta.has_field(cdt, key)) {
                                    frappe.model.set_value(cdt, cdn, key, r.message[key]);
                                }
                            }
                            // Refresh the grid row visually if model.set_value doesn't trigger it
                            // const grid_row = frm.fields_dict['po_items']?.grid?.grid_rows_by_docname?.[cdn];
                            // if(grid_row) grid_row.refresh();
                        } else {
                            // Clear dependent fields if item_code is cleared or not found
                            const fields_to_clear = ["description", "item_name", "stock_uom"]; // Add other fields to clear
                            fields_to_clear.forEach(field => {
                                if (frappe.meta.has_field(cdt, field)) {
                                    frappe.model.set_value(cdt, cdn, field, null);
                                }
                            });
                        }
                    },
                });

                // 2. [추가된 로직] Item 마스터 정보 조회 및 Door 로직 적용
                frappe.db.get_value('Item', row.item_code, ['product_section', 'door_open_type', 'door_set_type'])
                    .then(r => {
                        if (r && r.message) {
                            const item_data = r.message;

                            // 조건: product_section이 "Door"일 때만 값 설정
                            if (item_data.product_section === "Door") {
                                frappe.model.set_value(cdt, cdn, 'door_open_type', item_data.door_open_type || '');
                                frappe.model.set_value(cdt, cdn, 'door_set_type', item_data.door_set_type || '');
                            } else {
                                // Door가 아닌 경우 해당 필드 초기화 (필요 없다면 이 부분은 제거 가능)
                                frappe.model.set_value(cdt, cdn, 'door_open_type', '');
                                frappe.model.set_value(cdt, cdn, 'door_set_type', '');
                            }
                        }
                    });

            } else {
                // Clear dependent fields if item_code is cleared
                const fields_to_clear = ["description", "item_name", "stock_uom"]; // Add other fields to clear
                fields_to_clear.forEach(field => {
                    if (frappe.meta.has_field(cdt, field)) {
                        frappe.model.set_value(cdt, cdn, field, null);
                    }
                });
            }
        }
    },

    po_items_add: function (frm, cdt, cdn) {
        const site_location = frm.doc.country;

        if (site_location) {
            // console.log(`${site_location} is set, fetching country code...`);
            frappe.db.get_value('Country', { 'name': site_location }, 'code')
                .then(r => {
                    if (r && r.message && r.message.code) {
                        const country_code = r.message.code;

                        frappe.model.set_value(cdt, cdn, 'app_country', country_code);
                    } else {
                        // console.log(`No country found for site_location: ${site_location}`);
                    }
                })
                .catch(err => {
                    // console.error("Error fetching country code:", err);
                });
        }
    },

    // ★ bom_conditions Button 필드 클릭 핸들러 (Frappe 네이티브 방식)
    bom_conditions(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (!row) return;

        const data = row;
        const dialog_fields = get_bom_conditions_dialog_fields(frm, data);
        const fields_to_update = dialog_fields.map(df => df.fieldname).filter(Boolean);

        const dialog = new frappe.ui.Dialog({
            title: __("BOM Conditions for {0}", [data.item_code || __("Row {0}", [data.idx])]),
            fields: dialog_fields,
            primary_action_label: __('Save Conditions'),
            primary_action: function (values) {
                fields_to_update.forEach(field => {
                    frappe.model.set_value(cdt, cdn, field, values[field]);
                });

                handle_leaf_item_updates(frm, row, values);
                dialog.hide();
            }
        });

        // Setup dynamic MultiSelect and Link queries in the dialog
        setup_dialog_multiselect_pills(dialog, "app_country", "Country", { "is_clestra": 1 }, "code");
        setup_dialog_multiselect_pills(dialog, "hw_options", "Item", { "item_group": "Option" }, "item_code");
        setup_dialog_multiselect_pills(dialog, "price_study", "Item", { "item_group": "Price Study" }, "item_code");
        setup_dialog_multiselect_pills(dialog, "sub_contract", "Item", { "item_group": "Sub Contract" }, "item_code");
        setup_dialog_link_queries(frm, dialog, data);

        dialog.show();
    },
});

function setup_po_items_grid(frm) {
    const grid = frm.fields_dict['po_items'].grid;
    const grid_wrapper = $(grid.wrapper);

    // --- "Add Row"와 "Add Component" 버튼 추가 (중복 방지) ---
    if (grid_wrapper.find('.btn-add-component').length === 0) {
        const add_sub_item_button = $(`
            <button class="btn btn-secondary btn-xs btn-add-component" style="margin-right: 4px;">
                ${__('Add Sub Item')}
            </button>
        `);

        // Add Row 버튼 뒤, Delete 버튼 앞에 삽입
        const add_row_button = grid_wrapper.find('.grid-add-row');
        if (add_row_button.length > 0) {
            add_row_button.after(add_sub_item_button);
        } else {
            grid_wrapper.find('.grid-buttons').prepend(add_sub_item_button);
        }

        // 3. "Add Sub Item" 버튼 클릭 이벤트 핸들러
        add_sub_item_button.on('click', function () {
            // 새 행에 전달할 초기 데이터를 정의합니다.
            // is_component_row 플래그를 여기에 포함시킵니다.
            const initial_data = {
                is_component_row: 1
            };

            // grid.add_new_row를 사용하여 행을 '한 번만' 추가합니다.
            // 네 번째 인자로 초기 데이터를 전달합니다.
            const new_row = grid.add_new_row(null, null, false, initial_data);

            // is_component_row 플래그를 포함하여 초기 데이터를 설정합니다.
            $.extend(new_row, new_row_doc);

            frm.refresh_field('po_items');

            // 새 행으로 스크롤
            setTimeout(() => {
                const grid_row = grid.grid_rows_by_docname[new_row.name];
                if (grid_row) {
                    $(grid_row.row).find('[data-fieldname="item_code"]').focus();
                }
            }, 100);
        });
    }

    // 이미 버튼이 추가되었는지 확인 (refresh 시 중복 추가 방지)
    if (grid_wrapper.find('.btn-custom-duplicate').length === 0) {
        // Duplicate 버튼 생성
        const duplicate_button = $('<button class="btn btn-secondary btn-xs btn-custom-duplicate" style="margin-right: 4px; display: none;">' + __('Duplicate') + '</button>');

        // Add Row 버튼 뒤, Delete 버튼 앞에 삽입
        const add_row_button = grid_wrapper.find('.grid-add-row');
        if (add_row_button.length > 0) {
            add_row_button.after(duplicate_button);
        } else {
            grid_wrapper.find('.grid-buttons').append(duplicate_button);
        }

        // Duplicate 버튼 클릭 이벤트 (grid.add_new_row 사용)
        duplicate_button.on('click', function () {
            const selected_rows_docs = grid.get_selected_children(); // 체크된 행의 '문서 객체'를 가져옴

            if (selected_rows_docs.length === 0) {
                frappe.show_alert({ message: __('Please select rows to duplicate.'), indicator: 'orange' });
                return;
            }

            selected_rows_docs.forEach(function (doc) {
                grid.add_new_row(null, null, true, doc, true);
            });

            frm.refresh_field('po_items');
            frappe.show_alert({ message: __('Selected rows duplicated.'), indicator: 'green' });

            // 복제 후 선택 해제 및 버튼 숨김
            setTimeout(() => {
                (frm.doc['po_items'] || []).forEach(row_doc => {
                    row_doc.__checked = 0;
                    const grid_row = grid.get_row(row_doc.name);
                    if (grid_row) {
                        $(grid_row.row).find('.grid-row-check').prop('checked', false);
                    }
                });
            }, 100);
        });

        // 행의 체크박스(개별 또는 전체) 상태가 변경될 때마다 버튼 표시/숨김 처리
        grid_wrapper.on('change', '.grid-row-check, .grid-select-all', function () {
            toggle_duplicate_button(frm, 'po_items');
        });
    }

    // 행 선택/해제 시 Duplicate 버튼 보이기/숨기기 (블록 안의 change 이벤트에서 처리됨)

    // --- 3. 주석 처리된 구 grid.refresh 몽키패치 제거됨 ---
    grid.is_fully_enhanced = true;
    grid.refresh();
}


// Duplicate 버튼 보이기/숨기기 헬퍼 함수
function toggle_duplicate_button(frm) {
    if (!frm.fields_dict['po_items'] || !frm.fields_dict['po_items'].grid) return;

    let grid = frm.fields_dict['po_items'].grid;
    let grid_wrapper = $(grid.wrapper);
    let duplicate_button = grid_wrapper.find('.btn-custom-duplicate');

    if (grid.get_selected_children().length > 0) {
        duplicate_button.show();
    } else {
        duplicate_button.hide();
    }
}

function update_grid_qty_view(frm) {
    const grid_fieldnames_with_qty_styling = ['sub_items', 'detail_bom_items']; // Add other fieldnames here if needed
    grid_fieldnames_with_qty_styling.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (!grid) return;

        // grid_rows_by_docname 사용: 현재 페이지에 실제 렌더된 행만 처리 (stale 참조 방지)
        const rows_to_process = Object.values(grid.grid_rows_by_docname || {});
        if (rows_to_process.length === 0) return;

        rows_to_process.forEach(function (grid_row) {
            let item = grid_row.doc;

            if (!item || !grid_row.wrapper) {
                return;
            }

            const qty_val = flt(item.qty, grid.df.precision || 0);
            const qty_prefix = item.qty_prefix ? `${item.qty_prefix}` : "";
            const qty_suffix = item.qty_suffix ? `${item.qty_suffix}` : "";

            let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');

            if ($qty_cell.length > 0) {
                // Use toggleClass to add/remove based on show_qty_bracket
                const qty_string = `${qty_prefix}${qty_val}${qty_suffix}`;
                let $qty_cell_static = $qty_cell.find('.static-area');
                let $qty_cell_field = $qty_cell.find('.field-area');
                if ($qty_cell_static.length > 0) {
                    $qty_cell_static.text(qty_string).show();
                    $qty_cell_field.hide();
                }
                // console.log(`Row ${item.name}: Updated qty display with prefix "${qty_prefix}", value "${qty_val}", suffix "${qty_suffix}"`);
                $qty_cell.toggleClass("qty-bracket", !!item.show_qty_bracket);
                // console.log(`Row ${item.name}: toggled qty-bracket based on show_qty_bracket=${!!item.show_qty_bracket}`);s
            }
        });
    });
}

// --- Helper/Utility Functions (Should be outside frappe.ui.form.on block) ---
function set_custom_grid_columns(frm, fieldname, default_columns, hide_idx = false) {

    default_columns = Array.isArray(default_columns) ? default_columns : [];

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid || !grid.doctype) {
        // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Grid or grid.doctype not found.`);
        return;
    }

    const child_doctype_name = grid.doctype;
    const child_meta = frappe.get_meta(child_doctype_name); // Get global meta for the child doctype

    if (!child_meta || !child_meta.fields) {
        // console.error(`[CUSTOM GRID VIRTUAL][${fieldname}] Meta information or fields not found for child doctype: ${child_doctype_name}.`);
        return;
    }
    // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Child Doctype: ${child_doctype_name}`);

    // --- 1. Extract unique dynamic zone keys from all rows ---
    let all_unique_zone_names = [];
    if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
        frm.doc[fieldname].forEach(row_doc => {
            if (row_doc && row_doc.zone_qty && typeof row_doc.zone_qty === 'string') {
                try {
                    const zones_data_obj = JSON.parse(row_doc.zone_qty);
                    if (typeof zones_data_obj === 'object' && zones_data_obj !== null) {
                        Object.keys(zones_data_obj).forEach(key => {

                            const zone_detail = zones_data_obj[key];

                            if (key && zone_detail && typeof zone_detail === 'object' && flt(zone_detail.qty) > 0) {
                                if (!all_unique_zone_names.includes(key)) {
                                    all_unique_zone_names.push(key);
                                }
                            }
                        });
                    }
                } catch (e) {
                    // console.warn(`[V_FIELD_OBJ][${fieldname}] Error parsing zone_qty for row ${row_doc.name}:`, e);
                }
            }
        });
    }
    all_unique_zone_names.sort(); // Consistent order for mapping
    // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] All unique active zone keys (qty > 0):`, all_unique_zone_names);

    // --- 2. Map active zone keys to available virtual fields ---
    const MAX_VIRTUAL_FIELDS = 20; // Max number of pre-defined virtual_field_x
    let virtual_fields_mapping = []; // Stores { virtual_fieldname: 'virtual_field_x', original_zone_key: 'ZoneKeyA', display_label: 'Zone Key A' }
    let final_fieldnames_to_display = [...default_columns]; // Ensure default columns exist in meta

    for (let i = 0; i < all_unique_zone_names.length; i++) {
        if (i < MAX_VIRTUAL_FIELDS) {
            const original_zone_key = all_unique_zone_names[i];
            const vf_name = `zone_${i + 1}`;

            // Check if this virtual field exists in the child doctype's meta
            const virtual_field_meta_check = child_meta.fields.find(df => df.fieldname === vf_name);
            if (virtual_field_meta_check) {
                virtual_fields_mapping.push({
                    virtual_fieldname: vf_name,
                    display_label: frappe.model.unscrub(original_zone_key),  // Label for display
                    original_zone_key: original_zone_key
                });
                if (!final_fieldnames_to_display.includes(vf_name)) {
                    final_fieldnames_to_display.push(vf_name);
                }
            } else {
                // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Pre-defined virtual field "${vf_name}" not found in meta for ${child_doctype_name}. Cannot map zone key "${original_zone_key}".`);
            }
        } else {
            // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] More active zone keys (${all_unique_zone_names.length}) than available virtual fields (${MAX_VIRTUAL_FIELDS}). Some zones will not be displayed.`);
            break;
        }
    }
    // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Virtual fields mapping:`, virtual_fields_mapping);
    // Store this mapping on each row for the dialog to use (optional, but good for consistency)
    if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
        frm.doc[fieldname].forEach(row_doc_for_map_storage => {
            if (row_doc_for_map_storage) {
                // Store a copy of the mapping relevant to *this grid type* on each row.
                row_doc_for_map_storage._virtual_field_maps = [...virtual_fields_mapping];
            }
        });
    }

    // --- 3. Populate row data: Assign zone_qty values to corresponding virtual_field_x ---
    // This ensures the data is available in the `row_doc` for the grid to render.
    if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
        frm.doc[fieldname].forEach(row_doc => {
            // Clear all potential virtual field values for this row first
            for (let i = 0; i < MAX_VIRTUAL_FIELDS; i++) {
                if (row_doc) row_doc[`zone_${i + 1}`] = null; // Or 0 or ""
            }

            if (row_doc && row_doc.zone_qty && typeof row_doc.zone_qty === 'string') {
                try {
                    const zones_data_for_row = JSON.parse(row_doc.zone_qty);
                    if (typeof zones_data_for_row === 'object' && zones_data_for_row !== null) {
                        virtual_fields_mapping.forEach(map_info => {
                            const zone_detail_from_json = zones_data_for_row[map_info.original_zone_key];
                            if (zone_detail_from_json && typeof zone_detail_from_json === 'object') {
                                row_doc[map_info.virtual_fieldname] = flt(zone_detail_from_json.qty); // Assign qty to the virtual field
                            } else if (zone_detail_from_json && typeof zone_detail_from_json !== 'object') {
                                // Fallback for older format? {"11F": 5}
                                // console.warn(`[V_FIELD_OBJ][${fieldname}] Row ${row_doc.name}, zone ${map_info.original_zone_key}: zone_qty data is not an object. Value: ${zone_detail_from_json}`);
                            }
                        });
                    }
                } catch (e) {
                    // console.warn(`[V_FIELD_OBJ][${fieldname}] Error parsing/processing zone_qty for row ${row_doc.name} for data assignment:`, e);
                }
            }
        });

    }

    // --- 4. Modify grid.meta for labels and in_list_view status (for Configure Columns and grid internals) ---
    // This should be done *before* setup_visible_columns override if grid.meta is the source of truth for Configure Columns.
    if (grid.meta && grid.meta.fields) {
        // console.log(`[V_FIELD_GRID][${fieldname}] Modifying grid.meta.fields for labels and visibility.`);
        grid.meta.fields.forEach(grid_df_config => {
            // Default all to not in list view, then enable specific ones
            grid_df_config.in_list_view = 0; // Reset first

            if (final_fieldnames_to_display.includes(grid_df_config.fieldname)) {
                grid_df_config.in_list_view = 1; // Mark for display

                // const vf_map_entry = virtual_fields_mapping.find(vf => vf.virtual_fieldname === grid_df_config.fieldname);
                // if (vf_map_entry) {
                //     grid_df_config.label = vf_map_entry.display_label; // << 핵심 레이블 변경 in grid.meta
                //     console.log(`[V_FIELD_GRID][${fieldname}] In grid.meta: Label for ${grid_df_config.fieldname} set to "${grid_df_config.label}"`);
                // }
            }
        });
    } else {
        // console.warn(`[V_FIELD_GRID][${fieldname}] grid.meta or grid.meta.fields not available. Label changes via grid.meta might not work for Configure Columns.`);
    }

    // Store original setup_visible_columns if not already stored
    const original_setup_key = `_original_setup_visible_columns_${fieldname}`;
    if (!grid[original_setup_key] && typeof grid.setup_visible_columns === 'function') {
        grid[original_setup_key] = grid.setup_visible_columns;
    }


    // --- 5. Override grid.setup_visible_columns ---
    grid.setup_visible_columns = function () {
        this.visible_columns = [];
        this.visible_column_names = []; // Will be populated based on final_fieldnames_to_display

        const meta_to_use_in_override = this.meta || child_meta;
        if (!meta_to_use_in_override || !meta_to_use_in_override.fields) {
            // console.error(`[V_FIELD_GRID][${fieldname}] Meta not available in override. Aborting.`);
            return;
        }

        // Define column sizes
        const fixed_width_fields = ["item_code", "item_name", "product_type", "product_keyword", "door_hw_spec", "size", "zone", "qty", "print_group", "print_order"];
        const grid_specific_col_widths = {
            "po_items": { "row-index": 1, "item_code": 2, "bom_no": 2, "zone": 1, "color": 1, "ch": 1, "width": 1, "planned_qty": 1, "bom_conditions": 1 },
            "detail_bom_items": { "item_code": 2, "item_name": 2, "size": 2, "qty": 1, "color": 1, "remark": 1, "zone": 1 },
            "panel_cover": { "item_name": 2, "size": 2, "qty": 1, "color": 1, "remark": 2, "product_keyword": 2 },
            "door_cover": { "door_hw_spec": 2, "product_keyword": 2, "size": 2, "qty": 1, "color": 1, "remark": 1 },
            "sub_items": { "print_group": 2, "print_order": 1, "item_name": 2, "size": 1, "qty": 1, "color": 1, "remark": 1 },
        };
        const DEFAULT_COL_SIZE = 1; // Default Bootstrap col size for virtual fields
        const MAX_BOOTSTRAP_COLS = 10; // Bootstrap 기준 컬럼 수

        const get_column_size_for_df = (df_col, current_grid_fieldname) => {
            // Is it a virtual field we are using? Check by fieldname.
            if (virtual_fields_mapping.some(vf => vf.virtual_fieldname === df_col.fieldname)) {
                return DEFAULT_COL_SIZE;
            }
            const specific_grid_config = grid_specific_col_widths[current_grid_fieldname];
            if (specific_grid_config && specific_grid_config[df_col.fieldname]) {
                return Math.max(1, cint(specific_grid_config[df_col.fieldname]));
            }
            if (fixed_width_fields.includes(df_col.fieldname)) {
                // console.log(`[V_FIELD_GRID][${current_grid_fieldname}] Sizing field ${df_col.fieldname} to fixed 2`);
                return 2; // Common fixed width
            }
            const meta_columns = cint(df_col.columns);
            return meta_columns > 0 ? meta_columns : 1;
        };

        let total_col_size = 0; // 총 너비 계산용
        let number_of_visible_columns = 0;   // 실제 화면에 표시될 컬럼의 개수
        const max_grid_width = 11;

        final_fieldnames_to_display.forEach(fname_to_show => {
            let df_config = meta_to_use_in_override.fields.find(df => df.fieldname === fname_to_show);

            if (df_config) {
                let df_for_column = { ...df_config };
                df_for_column.in_list_view = 1;

                const virtual_map_entry = virtual_fields_mapping.find(vf => vf.virtual_fieldname === fname_to_show);
                if (virtual_map_entry) {
                    df_for_column.label = virtual_map_entry.display_label;
                }

                const col_size = get_column_size_for_df(df_for_column, fieldname);
                this.visible_columns.push([df_for_column, col_size]);
                total_col_size += col_size;
                number_of_visible_columns++;
            } else {
                // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Field '${fname_to_show}' (intended for display) not found in child meta during override. Skipping.`);
            }
        });

        // console.log(`[V_FIELD_GRID][${fieldname}] Override: Total colsize units: ${total_col_size}, Visible columns count: ${number_of_visible_columns}`);

        if (total_col_size > max_grid_width && this.visible_columns.length > 0) {
            const scale_fcator = max_grid_width / total_col_size;
            this.visible_columns.forEach(col => {
                col[1] = Math.max(1, Math.floor(col[1] * scale_fcator));
            });
        }

        // --- ★★★ 동적 max-width 계산 및 적용 (visible_columns 설정 후) ★★★ ---
        let data_row_max_width_px = 1250; // 기본 max-width (colsize 합 12개 이하일 때)
        const pixels_per_extra_col_unit = 60; // colsize 단위 1개가 늘어날 때마다 추가할 너비 (조정 가능)
        const pixels_per_extra_column_count = 100; // 또는 컬럼 개수당 추가할 너비

        if (total_col_size > MAX_BOOTSTRAP_COLS) {
            const extra_col_units = total_col_size - MAX_BOOTSTRAP_COLS;
            data_row_max_width_px += extra_col_units * pixels_per_extra_col_unit;
            // console.log(`[V_FIELD_GRID][${fieldname}] Colsize units (${total_col_size}) > ${MAX_BOOTSTRAP_COLS}. New max-width: ${data_row_max_width_px}px`);
            this._calculated_data_row_max_width = data_row_max_width_px;
        }

        // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Override: Final visible_columns (${this.visible_columns.length}):`,
        //     this.visible_columns.map(col => `${col[0].fieldname} (Label: ${col[0].label}, Width: ${col[1]})`)
        // );

    };

    // --- 6. Trigger a grid refresh/reset ---
    // This needs to happen AFTER the setup_visible_columns override is in place AND
    // AFTER the row_doc data for virtual fields has been populated.
    const current_grid_instance_for_refresh = frm.fields_dict[fieldname]?.grid;
    if (current_grid_instance_for_refresh === grid) { // Ensure instance is the same
        if (grid.reset_grid) { // Preferred method for column changes
            grid.reset_grid();
        } else if (grid.refresh) {
            grid.refresh();
        } else {
            // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] No reset_grid or refresh method on grid.`);
        }

        // // --- 7. DOM Manipulation for Header Labels (after grid reset/refresh) ---
        // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Attempting DOM manipulation for header labels.`);
        frm.refresh_field(fieldname);



        if (hide_idx && current_grid_instance_for_refresh.wrapper) {
            current_grid_instance_for_refresh.wrapper.find('div.grid-heading-row .row-index').hide();
            current_grid_instance_for_refresh.wrapper.find('.row-index').hide();
            // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Row index hidden because hide_idx is true.`);
        }

        const target_tables_for_width_adjustment = ["door_cover", "panel_cover", "sub_items"];
        if (target_tables_for_width_adjustment.includes(fieldname)) {
            setTimeout(() => {
                const grid_wrapper_for_dom = current_grid_instance_for_refresh.wrapper;
                if (!grid_wrapper_for_dom) {
                    // console.error(`[CUSTOM GRID VIRTUAL][${fieldname}] DOM: Grid wrapper not found. Cannot set header labels.`);
                    return;
                }

                // --- ★★★ .data-row에 동적 max-width 적용 ★★★ ---
                const calculated_width = grid._calculated_data_row_max_width; // grid 객체에서 가져옴
                if (calculated_width) {
                    const $dataRows = $(grid_wrapper_for_dom).find(`.form-grid`);
                    // console.log(`[V_FIELD_GRID][${fieldname}] DOM: Found ${$dataRows.length} .data-row elements.`);
                    if ($dataRows.length > 0) {
                        $dataRows.css('width', calculated_width + 'px');
                        // console.log(`[V_FIELD_GRID][${fieldname}] DOM: .data-row max-width set to ${calculated_width}px for ${$dataRows.length} rows.`);
                    }
                }

                virtual_fields_mapping.forEach(vf_map => {
                    const header_cell_div = $(grid_wrapper_for_dom).find(`.grid-heading-row .grid-row .col[data-fieldname="${vf_map.virtual_fieldname}"]`);
                    header_cell_div.attr('title', vf_map.display_label);
                    header_cell_div.attr('data-fieldname', vf_map.display_label);

                    const static_area_div = header_cell_div.find('.static-area');

                    if (static_area_div.length > 0) {
                        // Find the actual text container (often .static-area or a direct child span)
                        // const label_container = header_cell_div.find('.static-area').length ? header_cell_div.find('.static-area') : header_cell_div;
                        static_area_div.text(vf_map.display_label.toUpperCase());
                        // console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] DOM: Header label for "${vf_map.virtual_fieldname}" set to "${vf_map.display_label}".`);
                    } else {
                        // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] DOM: Header cell for "${vf_map.virtual_fieldname}" not found. Label not set via DOM.`);
                    }
                });
            }, 300);
        }

    } else {
        // console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Grid instance changed before refresh was called. DOM manipulation might fail.`);
    }
}

// --- Utility Functions ---

// Keep generate_js_qty_string function as is
function generate_js_qty_string(row_data) {
    const qty_parts = [];
    const get_val = (key) => row_data && row_data[key] != null ? row_data[key] : null;

    const qty = cint(get_val("qty")); // 'qty' 필드 값 (총수량) 가져오기
    const zone_qty_str = get_val("zone_qty"); // JSON 문자열
    const handle_direct = get_val("handle_direct"); // 'handle_direct' 필드 값 가져오기

    if (qty <= 0) return ""; // 수량이 0 이하인 경우 빈 문자열 반환

    let parsed_zone_qty = null;
    if (zone_qty_str) parsed_zone_qty = JSON.parse(zone_qty_str);

    let total_lh = 0;
    let total_rh = 0;
    let total_lhr = 0;
    let total_rhr = 0;
    let unassigned_handle_qty = 0; // zone_qty 내에 handle_direct가 없는 경우
    let has_any_handle_data = false;

    if (parsed_zone_qty && typeof parsed_zone_qty === 'object' && Object.keys(parsed_zone_qty).length > 0) {
        for (const zone_key in parsed_zone_qty) {
            if (parsed_zone_qty.hasOwnProperty(zone_key)) {
                if (parsed_zone_qty[zone_key].handle_details && typeof parsed_zone_qty[zone_key].handle_details === 'object') {
                    has_any_handle_data = true;
                    total_lh += cint(parsed_zone_qty[zone_key].handle_details.LH);
                    total_rh += cint(parsed_zone_qty[zone_key].handle_details.RH);
                    total_lhr += cint(parsed_zone_qty[zone_key].handle_details["LH-R"]);
                    total_rhr += cint(parsed_zone_qty[zone_key].handle_details["RH-R"]);
                } else {
                    unassigned_handle_qty += parsed_zone_qty[zone_key].qty;
                }
            }
        }

        if (has_any_handle_data) {
            if (total_lh > 0) qty_parts.push(`LH:${total_lh}`);
            if (total_rh > 0) qty_parts.push(`RH:${total_rh}`);
            if (total_lhr > 0) qty_parts.push(`LHR:${total_lhr}`);
            if (total_rhr > 0) qty_parts.push(`RHR:${total_rhr}`);
        }
    }

    // 모든 핸들별 수량이 0인데 qty는 0보다 큰 경우 (모든 존이 unassigned이고 handle_direct도 없는 경우)
    if (qty_parts.length === 0 && qty > 0) {
        if (handle_direct) {
            qty_parts.push(`${qty}`);
            if (handle_direct === 'LH') qty_parts.push(`LH:${qty}`);
            else if (handle_direct === 'RH') qty_parts.push(`RH:${qty}`);
            else if (handle_direct === 'LH-R') qty_parts.push(`LHR:${qty}`);
            else if (handle_direct === 'RH-R') qty_parts.push(`RHR:${qty}`);
            else { // 핸들 정보가 없으면 그냥 총 수량
                qty_parts.push(`${qty}`);
            }
        } else { // 핸들 정보가 없으면 그냥 총 수량
            qty_parts.push(`${qty}`);
        }
    }

    return qty_parts.join(", ") || ""; // 비어있으면 빈 문자열 반환
}

// Keep generate_js_size_string function as is
function generate_js_size_string(product_section, row_data) {
    const size_parts = [];
    const get_val = (key) => {
        const val = row_data ? row_data[key] : null;
        const int_val = cint(val);
        return isNaN(int_val) ? 0 : int_val;
    };

    if (product_section === "Door") {
        const w = get_val("width");
        const ch = get_val("ch");
        if (w > 0) size_parts.push(`W:${w}`); // Only add if > 0
        if (ch > 0) size_parts.push(`CH:${ch}`);
    } else if (product_section === "Leaf") {
        const lw = get_val("leaf_width");
        const lh = get_val("leaf_height");
        if (lw > 0) size_parts.push(`LW:${lw}`);
        if (lh > 0) size_parts.push(`LH:${lh}`);
    } else if (product_section === "Panel") {
        const w = get_val("width");
        const ch = get_val("ch");
        const pw = get_val("pw");
        const ph = get_val("ph");
        if (w > 0) size_parts.push(`W:${w}`);
        if (ch > 0) size_parts.push(`CH:${ch}`);
        if (pw > 0) size_parts.push(`PW:${pw}`);
        if (ph > 0) size_parts.push(`PH:${ph}`);
    }
    return size_parts.join(", ");
}

// Keep set_default_section function as is
function set_default_section(frm, cdt, cdn, value) {
    let row = locals[cdt][cdn];
    if (!row.product_section) { // Add row check
        frappe.model.set_value(cdt, cdn, 'product_section', value);
    }
}

// Keep fetch_and_set_print_fields function as is
function fetch_and_set_print_fields(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (row && row.item_code && row.parentfield === 'sub_items') { // Add row check
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                filters: { name: row.item_code },
                fieldname: ["print_group", "print_order"]
            },
            callback: function (r) {
                if (r.message) {
                    // Use model.set_value for child table fields
                    frm.model.set_value(cdt, cdn, "print_group", r.message.print_group);
                    frm.model.set_value(cdt, cdn, "print_order", r.message.print_order);
                } else {
                    frm.model.set_value(cdt, cdn, "print_group", null);
                    frm.model.set_value(cdt, cdn, "print_order", null);
                }
            }
        });
    }
}

// Keep open_size_edit_dialog function as is
function open_size_edit_dialog(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (!row) {
        frappe.msgprint(__("Could not find row data to edit size."));
        return;
    }

    const product_section = row.product_section; // Get product section from the row

    // --- Define Dialog Fields ---
    // Start with common fields or a section
    let dialog_fields = [
        { label: __("Dimensions"), fieldtype: "Heading" },
    ];

    // Dynamically add fields based on product_section
    // Use 'depends_on' or simple conditional logic
    if (product_section === "Door" || product_section === "Panel") {
        dialog_fields.push({ label: "Width", fieldname: "width", fieldtype: "Float", precision: "1", default: row.width });
        dialog_fields.push({ label: "CH", fieldname: "ch", fieldtype: "Float", precision: "1", default: row.ch || "" });
    }
    if (product_section === "Leaf") {
        dialog_fields.push({ label: "Leaf Width", fieldname: "leaf_width", fieldtype: "Float", precision: "1", default: row.leaf_width });
        dialog_fields.push({ label: "Leaf Height", fieldname: "leaf_height", fieldtype: "Float", precision: "1", default: row.leaf_height });
    }
    if (product_section === "Panel") {
        dialog_fields.push({ label: "Panel Width (PW)", fieldname: "pw", fieldtype: "Float", precision: "1", default: row.pw }); // Added PW
        dialog_fields.push({ label: "Panel Height (PH)", fieldname: "ph", fieldtype: "Float", precision: "1", default: row.ph }); // Added PH
    }
    // Add other potentially editable size fields if needed (e.g., under_cut?)

    // --- Create and Show Dialog ---
    let dialog = new frappe.ui.Dialog({
        title: __("Edit Size for {0}", [row.item_name || row.item_code]),
        fields: dialog_fields,
        primary_action_label: __('Update Size'),
        primary_action: function (values) {
            let updated_row_data = {}; // Store values for size string generation

            // --- Step 1: Update all model values based on dialog fields definition ---
            dialog_fields.forEach(df => {
                if (df.fieldname) { // Process only if fieldname is defined
                    const fieldname = df.fieldname;
                    // *** 수정: values 객체에 키가 없더라도 처리 ***
                    // values 객체에 해당 키가 있으면 그 값을 사용하고, 없으면 기본값(빈 문자열 '') 사용
                    let new_value = values.hasOwnProperty(fieldname) ? values[fieldname] : '';

                    // Explicitly convert empty string to 0 for Int fields
                    if (df.fieldtype === 'Int') {
                        if (new_value === '') {
                            new_value = 0; // Use 0 for empty Int fields
                            // console.log(`Field ${fieldname}: Converted '' to 0.`);
                        } else {
                            new_value = cint(new_value); // Ensure other values are integers
                        }
                    }
                    // Add similar explicit conversions for Float if needed

                    // Store the final intended value for size string
                    updated_row_data[fieldname] = new_value;

                    // Call set_value regardless of whether the key existed in 'values'
                    try {
                        frappe.model.set_value(cdt, cdn, fieldname, new_value);
                    } catch (e) {
                        // console.error(`Error setting value for ${fieldname}:`, e);
                    }

                } else if (df.fieldname) { // This else block seems redundant now
                }
            });
            Object.keys(row).forEach(key => {
                if (!updated_row_data.hasOwnProperty(key) && dialog_fields.find(df => df.fieldname === key)) {
                    // If a dialog field wasn't processed (e.g., only heading), grab original value
                    updated_row_data[key] = row[key];
                }
            });

            // --- Step 2: Update the 'size' field based on updated values ---
            const new_size_string = generate_js_size_string(product_section, updated_row_data);
            try {
                frappe.model.set_value(cdt, cdn, 'size', new_size_string);
            } catch (e) {
                //  console.error("Error setting value for size:", e);
            }

            // --- Step 3: Force Grid Row Refresh ---
            // console.log("Attempting to refresh grid row...");
            const grid = frm.fields_dict[row.parentfield]?.grid;
            if (grid) {
                const grid_row = grid.grid_rows_by_docname?.[cdn];
                if (grid_row) {
                    // console.log("Found grid row object, calling grid_row.refresh()");
                    grid_row.refresh();
                    frm.dirty();
                } else {
                    // console.warn("Grid row object not found for cdn:", cdn, ". Falling back to refreshing parent field:", row.parentfield);
                    if (row.parentfield) frm.refresh_field(row.parentfield);
                }
            } else {
                // console.warn("Grid object not found for parentfield:", row.parentfield);
            }

            // console.log("--- Dialog Update End ---");
            dialog.hide();
        }
    });

    dialog.show();
}


// Keep open_qty_edit_dialog function as is
function open_qty_edit_dialog(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (!row) {
        frappe.msgprint(__("Could not find row data to edit size."));
        return;
    }

    const parent_grid_fieldname = row.parentfield;
    const is_door_cover_grid = parent_grid_fieldname === "door_cover";

    let table_data_for_dialog = [];
    if (row.zone_qty && typeof row.zone_qty === 'string') {
        try {
            const existing_zone_qty_parsed = JSON.parse(row.zone_qty);
            if (typeof existing_zone_qty_parsed === 'object' && existing_zone_qty_parsed !== null) {
                Object.keys(existing_zone_qty_parsed).forEach(actual_zone_key => {
                    const zone_info = existing_zone_qty_parsed[actual_zone_key];
                    if (zone_info && typeof zone_info === 'object' && zone_info.handle_details && typeof zone_info.handle_details === 'object') {
                        // 각 핸들 방향에 대해 테이블 행 생성 (door_cover 경우)
                        Object.keys(zone_info.handle_details).forEach(handle_key => {
                            const qty_for_handle = cint(zone_info.handle_details[handle_key]);
                            if (qty_for_handle > 0) { // 수량이 있는 핸들만 표시
                                table_data_for_dialog.push({
                                    zone_name: actual_zone_key,
                                    handle_direct: handle_key, // LH, RH, LHR, RHR
                                    qty: qty_for_handle
                                });
                            }
                        });
                    }
                });
            }
        } catch (e) {
            // console.error("Dialog: Error parsing existing zone_qty for table:", e, row.zone_qty);
        }
    }

    // --- Define Dialog Fields ---
    // Start with common fields or a section
    let dialog_fields = [
        {
            fieldname: "zone_qty_table", label: __("Zone & Quantities"), fieldtype: "Table", data: table_data_for_dialog, fields: [
                { label: "Zone", fieldname: "zone_name", fieldtype: "Data", default: row.zone, in_list_view: 1, reqd: 1 },
                {
                    label: "Handle Direct", fieldname: "handle_direct", fieldtype: "Link", options: "Selection Library", default: is_door_cover_grid ? row.handle_direct : null, in_list_view: 1,
                    filters: { opt_name: "Handle Direction", is_active: 1 }
                },
                { label: "Quantity", fieldname: "qty", fieldtype: "Int", default: 0, in_list_view: 1, reqd: 1 }
            ]
        },
    ];

    // --- Create and Show Dialog ---
    let dialog = new frappe.ui.Dialog({
        title: __("Edit Handle Quantity for {0}", [row.item_name || row.item_code]),
        fields: dialog_fields,
        primary_action_label: __('Update'),
        primary_action: function (values) {
            // let updated_qty_data = {};
            const updated_table_rows = values.zone_qty_table || [];
            let new_zone_qty_json_obj = {};
            let calcualted_overall_qty = 0;

            // --- Step 1: Update all model values based on dialog fields definition ---
            updated_table_rows.forEach(table_row => {
                const actual_zone = cstr(table_row.zone_name).trim();
                const qty = cint(table_row.qty);
                const handle_direct = cstr(table_row.handle_direct).trim();

                if (actual_zone && qty > 0) {
                    if (!new_zone_qty_json_obj[actual_zone]) {
                        let mapped_vf_name = null;
                        // const map_entry = current_vf_map_for_dialog.find(m => m.original_zone_key === actual_zone);
                        const vf_map = (row._virtual_field_maps || []).find(m => m.original_zone_key === actual_zone);

                        if (vf_map) {
                            mapped_vf_name = vf_map.virtual_fieldname;
                        } else {
                            console.warn(`Dialog Update: No virtual field mapping found for new/existing zone "${actual_zone_name}". 'field' property might be incorrect in JSON.`);
                        }

                        new_zone_qty_json_obj[actual_zone] = {
                            field: mapped_vf_name,
                            qty: 0,
                            handle_details: {}
                        };
                    }

                    new_zone_qty_json_obj[actual_zone].qty += qty;
                    calcualted_overall_qty += qty;

                    if (is_door_cover_grid && handle_direct) {
                        new_zone_qty_json_obj[actual_zone].handle_details[handle_direct] = (new_zone_qty_json_obj[actual_zone].handle_details[handle_direct] || 0) + qty;
                    }
                }
            });

            const new_json_string = JSON.stringify(new_zone_qty_json_obj);
            if (row.zone_qty !== new_json_string) {
                frappe.model.set_value(cdt, cdn, 'zone_qty', new_json_string);
            }
            if (cint(row.qty) !== calcualted_overall_qty) {
                frappe.model.set_value(cdt, cdn, 'qty', calcualted_overall_qty);
            }

            setTimeout(() => {
                const door_cover_cols = ["door_hw_spec", "product_keyword", "size", "remark", "qty"]; // Include zone if it's a standard field and needed
                set_custom_grid_columns(frm, 'door_cover', door_cover_cols, true);

                // frm.trigger("update_grid_qty_view");
                update_grid_qty_view(frm);
                frm.trigger("update_grid_qty_js_string");

            }, 100); // Delay to ensure UI updates

            dialog.hide();
        }
    });
    dialog.show();
}


// Keep setup_qty_field function as is (ensure it's called by refresh)
function setup_qty_field(frm) {
    // Applies custom click handler and initial display for QTY field
    const grid_fieldnames_with_custom_qty_display = ['door_cover']; // Grids using custom qty dialog/display
    grid_fieldnames_with_custom_qty_display.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (grid && grid.wrapper) {
            // Remove previous click handler to avoid duplicates
            grid.wrapper.off('click', '.grid-row .col[data-fieldname="qty"]');
            // Add click handler to open custom qty dialog
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="qty"]', function (e) {
                // Prevent dialog if clicking interactive elements inside cell
                if ($(e.target).closest('button, a').length > 0) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation(); // Stop event propagation

                let row_name = $(this).closest('.grid-row').attr('data-name');
                let grid_row_obj = grid.get_row(row_name); // Get the grid row object

                if (grid_row_obj && grid_row_obj.doc) {
                    open_qty_edit_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
                } else {
                    console.error("Could not find row object for clicked qty field in grid:", fieldname);
                }
            });
            // Add a class to make it look clickable
            grid.wrapper.find('.col[data-fieldname="qty"]').addClass('clickable');

            if (grid.grid_rows) {
                grid.grid_rows.forEach(grid_row => {
                    if (grid_row.doc) {
                        const qty_string = generate_js_qty_string(grid_row.doc);
                        let $qty_cell_static = $(grid_row.wrapper).find('[data-fieldname="qty"] .static-area');
                        if ($qty_cell_static.length > 0) {
                            $qty_cell_static.text(qty_string).show();
                            $(grid_row.wrapper).find('[data-fieldname="qty"] .field-area').hide(); // Hide input
                        }
                    }
                });
                // console.log(`Initial Qty text set for grid: ${fieldname}`);
            }
        }
    });
}

// Keep setup_size_field function as is (ensure it's called by refresh)
function setup_size_field(frm) {
    const grid_fieldnames_with_size = ['detail_bom_items', 'panel_cover', 'door_cover', 'sub_items'];
    grid_fieldnames_with_size.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (grid && grid.wrapper) {
            grid.wrapper.off('click', '.grid-row .col[data-fieldname="size"]');
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="size"]', function (e) {

                if ($(e.target).is('button, a')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                let row_name = $(this).closest('.grid-row').attr('data-name');
                let grid_row_obj = grid.get_row(row_name);

                if (grid_row_obj && grid_row_obj.doc) {
                    open_size_edit_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
                } else {
                    console.error("Could not find row object for clicked size field.");
                }
            });
            grid.wrapper.find('.col[data-fieldname="size"]').addClass('clickable');
        }
    });
}

// Keep get_bom_conditions_dialog_fields function as is
function get_bom_conditions_dialog_fields(frm, data) {
    // ... (function body remains the same) ...
    return [
        { label: __("General"), fieldtype: "Heading" },
        { fieldtype: "Section Break", hide_border: 1 },
        { label: __("Applicable Country"), fieldname: "app_country", fieldtype: "MultiSelect", default: data.app_country },
        { label: __("Disassembled"), fieldname: "disassembled", fieldtype: "Check", default: data.disassembled },
        { fieldtype: "Column Break" },
        { label: __("Zone"), fieldname: "zone", fieldtype: "Data", default: data.zone },
        { fieldtype: "Column Break" },
        { label: __("Color"), fieldname: "color", fieldtype: "Link", default: data.color, options: "Product Color" },
        { label: __("Use Billing Color"), fieldname: "use_billing_color", fieldtype: "Check", default: data.use_billing_color },
        { fieldtype: "Column Break" },
        { label: __("Remark"), fieldname: "remark", fieldtype: "Small Text", default: data.remark, style: "height: 5% !important;" },

        { fieldtype: "Section Break" },
        { label: __("Panel"), fieldtype: "Heading" },
        { fieldtype: "Section Break", hide_border: 1 },
        { label: __("Product Keyword Prefix"), fieldname: "product_keyword_prefix", fieldtype: "Data", default: data.product_keyword_prefix },
        { label: __("Product Keyword Suffix"), fieldname: "product_keyword_suffix", fieldtype: "Data", default: data.product_keyword_suffix },
        { label: __("Show Qty in Brackets"), fieldname: "show_qty_bracket", fieldtype: "Check", default: data.show_qty_bracket },
        { fieldtype: "Column Break" },
        { label: __("Glass A"), fieldname: "glass_a", fieldtype: "Link", default: data.glass_a, options: "Product Thickness" },
        { label: __("Glass B"), fieldname: "glass_b", fieldtype: "Link", default: data.glass_b, options: "Product Thickness", description: "For double partitions only" },
        { fieldtype: "Column Break" },
        { label: __("CL/CH Type"), fieldname: "clch_type", fieldtype: "Link", default: data.clch_type, options: "Selection Library", filters: { opt_name: "CL CH Type" } },
        { label: __("Base Type"), fieldname: "base_type", fieldtype: "Link", default: data.base_type, options: "Selection Library", filters: { opt_name: "Base Type", is_active: 1 } },
        { fieldtype: "Column Break" },

        { fieldtype: "Section Break" },
        { label: __("Size"), fieldtype: "Heading" },
        { fieldtype: "Section Break" },
        { label: __("Ceiling Visible Height"), fieldname: "ceiling_visible", fieldtype: "Int", default: data.ceiling_visible },
        { label: "Width", fieldname: "width", fieldtype: "Float", precision: "1", default: data.width },
        { label: "PW", fieldname: "pw", fieldtype: "Float", precision: "1", default: data.pw },
        // { label: "Leaf Width", fieldname: "leaf_width", fieldtype: "Float", precision: "1", default: data.leaf_width},
        { fieldtype: "Column Break" },
        { label: "Base Visible Height", fieldname: "base_visible_h", fieldtype: "Int", default: data.base_visible_h },
        { label: "CH", fieldname: "ch", fieldtype: "Float", precision: "1", default: data.ch },
        { label: "PH", fieldname: "ph", fieldtype: "Float", precision: "1", default: data.ph },
        // { label: "Leaf Height", fieldname: "leaf_height", fieldtype: "Float", precision: "1", default: data.leaf_height},
        { fieldtype: "Column Break" },
        { label: "Transom Rail Height (TRH)", fieldname: "panel_trh", fieldtype: "Int", default: data.panel_trh },
        { label: "Chair Rail Height (CRH)", fieldname: "panel_crh", fieldtype: "Int", default: data.panel_crh },
        { fieldtype: "Column Break" },
        { label: "ABL A", fieldname: "abl_a", fieldtype: "Int", default: data.abl_a },
        { label: "ABL B", fieldname: "abl_b", fieldtype: "Int", default: data.abl_b },
        { label: "Depth", fieldname: "depth", fieldtype: "Int", default: data.depth },
        { fieldtype: "Column Break" },
        { label: "Open Width", fieldname: "open_width", fieldtype: "Float", precision: "1", default: data.open_width },
        { label: "Open Height", fieldname: "open_height", fieldtype: "Float", precision: "1", default: data.open_height },

        { fieldtype: "Section Break" },
        { label: __("Door Unit"), fieldtype: "Heading" },
        { fieldtype: "Column Break" },
        { label: __("Keeper & Hinge Side"), fieldtype: "Heading" },
        { fieldtype: "Column Break" },
        { label: __("Door Leaf A"), fieldtype: "Heading" },
        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Door Leaf B"), fieldtype: "Heading" },
        { fieldtype: "Section Break", hide_border: 1 },
        { label: __("Door Open Type"), fieldname: "door_open_type", fieldtype: "Select", default: data.door_open_type, options: "\nSwing\nSliding", read_only: 1 },
        { label: __("Door Set Type"), fieldname: "door_set_type", fieldtype: "Select", default: data.door_set_type, options: "\nSingle\nPair", read_only: 1 },
        { label: __("Door Frame (Read Only)"), fieldname: "door_frame", fieldtype: "Link", default: data.door_frame, options: "Item", read_only: 1 },
        { label: __("Handle Direction"), fieldname: "handle_direct", fieldtype: "Link", default: data.handle_direct, options: "Selection Library" },
        { label: __("Door Options"), fieldname: "hw_options", fieldtype: "MultiSelect", default: data.hw_options },
        { label: __("Outsourced"), fieldname: "sub_contract", fieldtype: "MultiSelect", default: data.sub_contract },
        { label: __("Price Study"), fieldname: "price_study", fieldtype: "MultiSelect", default: data.price_study },
        { label: __("Under Cut"), fieldname: "under_cut", fieldtype: "Int", default: data.under_cut },
        { fieldtype: "Column Break" },
        { label: __("Keeper Side"), fieldname: "keeper", fieldtype: "Link", default: data.keeper, options: "Selection Library" },
        { label: __("Keeper Glass A"), fieldname: "keeper_glass_a", fieldtype: "Link", default: data.keeper_glass_a, options: "Product Thickness" },
        { label: __("Keeper Glass B"), fieldname: "keeper_glass_b", fieldtype: "Link", default: data.keeper_glass_b, options: "Product Thickness" },
        { label: __("Hinge Side"), fieldname: "hinge", fieldtype: "Link", default: data.hinge, options: "Selection Library" },
        { label: __("Hinge Glass A"), fieldname: "hinge_glass_a", fieldtype: "Link", default: data.hinge_glass_a, options: "Product Thickness" },
        { label: __("Hinge Glass B"), fieldname: "hinge_glass_b", fieldtype: "Link", default: data.hinge_glass_b, options: "Product Thickness" },
        { fieldtype: "Column Break" },
        {
            label: __("Leaf A Item"), fieldname: "leaf_item_code", fieldtype: "Link", default: data.leaf_item_code, options: "Item",
            onchange: function () {
                const leaf_item_code = this.value;
                const dialog = this.dialog || cur_dialog;

                if (leaf_item_code) {
                    frappe.db.get_value("Item", leaf_item_code, ["leaf_act_status", "leaf_thk", "leaf_material"])
                        .then(r => {
                            if (r.message) {
                                const item_data = r.message;
                                // dialog.set_value를 사용하여 명확하게 값을 설정합니다.
                                dialog.set_value("leaf_act_status", item_data.leaf_act_status || "");
                                dialog.set_value("leaf_thk", item_data.leaf_thk || "");
                                dialog.set_value("leaf_material", item_data.leaf_material || "");
                            } else {
                                // 값이 없는 경우 필드를 비워줍니다.
                                dialog.set_value("leaf_act_status", "");
                                dialog.set_value("leaf_thk", "");
                                dialog.set_value("leaf_material", "");
                            }
                        })
                        .catch(err => {
                            console.error("Error fetching item details:", err);
                            // 에러 발생 시에도 필드를 비워줍니다.
                            dialog.set_value("leaf_act_status", "");
                            dialog.set_value("leaf_thk", "");
                            dialog.set_value("leaf_material", "");
                        });
                } else {
                    // leaf_item_code가 비워지면, 관련 필드들도 비웁니다.
                    dialog.set_value("leaf_act_status", "");
                    dialog.set_value("leaf_thk", "");
                    dialog.set_value("leaf_material", "");
                }
            }
        },
        { label: __("Leaf A Active Status"), fieldname: "leaf_act_status", fieldtype: "Link", default: data.leaf_act_status, options: "Selection Library" },
        { label: __("Leaf A Thk."), fieldname: "leaf_thk", fieldtype: "Link", default: data.leaf_thk, options: "Product Thickness" },
        { label: __("Leaf A Material"), fieldname: "leaf_material", fieldtype: "Link", default: data.leaf_material, options: "Selection Library" },
        { label: __("Leaf A Color"), fieldname: "leaf_color", fieldtype: "Link", default: data.leaf_color, options: "Product Color" },
        // { label: __("Leaf A Width"), fieldname: "leaf_a_width", fieldtype: "Float", precision: "1", default: data.leaf_a_width},
        // { label: __("Leaf A Height"), fieldname: "leaf_a_height", fieldtype: "Float", precision: "1", default: data.leaf_a_height},
        { label: __("Leaf A Glass A"), fieldname: "leaf_glass_a", fieldtype: "Link", default: data.leaf_glass_a, options: "Product Thickness" },
        { label: __("Leaf A Glass B"), fieldname: "leaf_glass_b", fieldtype: "Link", default: data.leaf_glass_b, options: "Product Thickness" },
        { label: __("Leaf A Auto Drop Seal"), fieldname: "auto_drop_seal", fieldtype: "Link", default: data.auto_drop_seal, options: "Selection Library" },
        { label: __("Is Pair Door"), fieldname: "is_pair_door", fieldtype: "Check", default: data.is_pair_door /* depends_on: "eval:!doc.door_frame" */ },
        { label: __("Equal Leaf Width"), fieldname: "equal_leaf_w", fieldtype: "Check", default: data.equal_leaf_w, depends_on: "eval:doc.is_pair_door == 1" },

        // Section Break for Leaf B, only shown if Is Pair Door is checked
        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
        {
            label: __("Leaf B Item"), fieldname: "leaf_b_item_code", fieldtype: "Link", default: data.leaf_b_item_code, options: "Item", depends_on: "eval:doc.is_pair_door == 1",
            onchange: function () {
                const leaf_item_code = this.value;
                const dialog = this.dialog || cur_dialog;

                if (leaf_item_code) {
                    frappe.db.get_value("Item", leaf_item_code, ["leaf_act_status", "leaf_thk", "leaf_material"])
                        .then(r => {
                            if (r.message) {
                                const item_data = r.message;
                                // dialog.set_value를 사용하여 명확하게 값을 설정합니다.
                                dialog.set_value("leaf_b_act_status", item_data.leaf_act_status || "");
                                dialog.set_value("leaf_b_thk", item_data.leaf_thk || "");
                                dialog.set_value("leaf_b_material", item_data.leaf_material || "");
                            } else {
                                // 값이 없는 경우 필드를 비워줍니다.
                                dialog.set_value("leaf_b_act_status", "");
                                dialog.set_value("leaf_b_thk", "");
                                dialog.set_value("leaf_b_material", "");
                            }
                        })
                        .catch(err => {
                            console.error("Error fetching item details:", err);
                            // 에러 발생 시에도 필드를 비워줍니다.
                            dialog.set_value("leaf_b_act_status", "");
                            dialog.set_value("leaf_b_thk", "");
                            dialog.set_value("leaf_b_material", "");
                        });
                } else {
                    // leaf_item_code가 비워지면, 관련 필드들도 비웁니다.
                    dialog.set_value("leaf_b_act_status", "");
                    dialog.set_value("leaf_b_thk", "");
                    dialog.set_value("leaf_b_material", "");
                }
            }
        },
        { label: __("Leaf B Active Status"), fieldname: "leaf_b_act_status", fieldtype: "Link", default: data.leaf_b_act_status, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Thk."), fieldname: "leaf_b_thk", fieldtype: "Link", default: data.leaf_b_thk, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Material"), fieldname: "leaf_b_material", fieldtype: "Link", default: data.leaf_b_material, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Color"), fieldname: "leaf_b_color", fieldtype: "Link", default: data.leaf_b_color, options: "Product Color", depends_on: "eval:doc.is_pair_door == 1" },
        // { label: __("Leaf B Width"), fieldname: "leaf_b_width", fieldtype: "Float", precision: "1", default: data.leaf_b_width, depends_on: "eval:doc.is_pair_door == 1" },
        // { label: __("Leaf B Height"), fieldname: "leaf_b_height", fieldtype: "Float", precision: "1", default: data.leaf_b_heightj, depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Glass A"), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Glass B"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Auto Drop Seal"), fieldname: "leaf_b_auto_drop_seal", fieldtype: "Link", default: data.leaf_b_auto_drop_seal, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },

        { fieldtype: "Section Break" },
        { label: __("Door Hardwares"), fieldtype: "Heading" },
        { fieldtype: "Section Break" },
        {
            label: __("Door HW Spec"), fieldname: "door_hw_spec", fieldtype: "Link", default: data.door_hw_spec, options: "Door Hardware Spec",
            get_query: function () {
                return {
                    filters: {
                        project: frm.doc.project,
                    }
                };
            }
        },
        { label: __("Door Closer"), fieldname: "door_closer", fieldtype: "Link", default: data.door_closer, options: "Selection Library" },
        { label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Link", default: data.hinge_type, options: "Selection Library" },
        { label: __("Number of Hinge Holes"), fieldname: "hinge_num", fieldtype: "Link", default: data.hinge_num, options: "Selection Library" },
        { label: __("Flush Bolt"), fieldname: "flush_bolt", fieldtype: "Link", default: data.flush_bolt, options: "Selection Library" },
        { fieldtype: "Column Break" },
        { label: __("FGD Info"), fieldname: "fgd_info", fieldtype: "Link", default: data.fgd_info, options: "Selection Library" },
        { label: __("Tape & Seal Color"), fieldname: "tape_seal_color", fieldtype: "Link", default: data.tape_seal_color, options: "Selection Library" },
        { label: __("Fixing Screw Cap"), fieldname: "fix_screw_cap", fieldtype: "Link", default: data.fix_screw_cap, options: "Selection Library" },
        { label: __("Key Cylinder"), fieldname: "key_cylinder", fieldtype: "Link", default: data.key_cylinder, options: "Selection Library" },
        { label: __("Astragal"), fieldname: "astragal", fieldtype: "Link", default: data.astragal, options: "Selection Library" },
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },


    ];
}

// Keep setup_dialog_multiselect function as is
function setup_dialog_multiselect(dialog, fieldname, target_doctype, filters = null, target_field) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: target_doctype,
            filters: filters,
            fields: [target_field],
            limit_page_length: 0
        },
        callback: function (response) {
            if (response && response.message) {
                let options = response.message.map(d => ({ label: d[target_field], value: d[target_field] }));
                let field = dialog.get_field(fieldname);
                if (field) {
                    field.set_data(options);
                }
            }
        }
    });
}

// 세션 레벨 캐시: 동일한 doctype+filters+field 조합은 한 번만 서버 호출
const _multiselect_options_cache = {};

function setup_dialog_multiselect_pills(dialog, fieldname, target_doctype, filters = null, target_field) {
    const cache_key = `${target_doctype}|${JSON.stringify(filters)}|${target_field}`;

    // 캐시에 있으면 서버 호출 없이 바로 UI 구성
    if (_multiselect_options_cache[cache_key]) {
        _build_multiselect_pills_ui(dialog, fieldname, _multiselect_options_cache[cache_key]);
        return;
    }

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: target_doctype,
            filters: filters,
            fields: [target_field],
            limit_page_length: 0
        },
        callback: function (response) {
            if (response && response.message) {
                let options = response.message.map(d => d[target_field]);
                // 캐시에 저장
                _multiselect_options_cache[cache_key] = options;
                _build_multiselect_pills_ui(dialog, fieldname, options);
            }
        }
    });
}

// UI 구성 로직을 별도 함수로 분리 (캐시 히트 시에도 재사용)
function _build_multiselect_pills_ui(dialog, fieldname, options) {
    let field = dialog.get_field(fieldname);

    if (!field) return;

    // 2. 기존 필드 요소 가져오기 및 숨기기
    let $field_wrapper = field.$wrapper;
    let $original_input = field.$input;
    $original_input.hide(); // 원본 입력창 숨김

    // 3. 커스텀 UI 컨테이너 생성
    let $container = $(`
                    <div class="form-control" style="
                        height: auto; 
                        min-height: 34px; 
                        padding: 8px; 
                        display: flex; 
                        flex-direction: column; 
                        gap: 8px; 
                        background-color: var(--control-bg);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                    ">
                        <input type="text" class="input-xs pill-input" style="
                            border: none; 
                            outline: none; 
                            width: 100%; 
                            background-color: transparent; 
                            font-size: var(--text-md);
                        " placeholder="${__('Select options...')}">
                        <div class="pills-area" style="display: flex; flex-wrap: wrap; gap: 5px;"></div>
                    </div>
                `);

    if ($field_wrapper.find('.pills-custom-container').length === 0) {
        $container.addClass('pills-custom-container');
        $field_wrapper.find('.control-input').append($container);
    }

    let $pills_area = $container.find('.pills-area');
    let $search_input = $container.find('.pill-input');

    // 4. 현재 저장된 값 불러오기
    let current_values = ($original_input.val() || "").split(',').map(v => v.trim()).filter(v => v !== "");

    function render_pills() {
        $pills_area.empty();
        current_values.forEach(value => {
            // 수정: 버튼에 type="button" 명시하여 폼 전송 방지
            let $pill = $(`
                            <span class="btn-group pill-group" style="margin: 0;">
                                <button type="button" class="btn btn-xs btn-default" style="cursor: default;">${value}</button>
                                <button type="button" class="btn btn-xs btn-default remove-pill">
                                    <i class="fa fa-times"></i>
                                </button>
                            </span>
                        `);
            // 값 참조를 위해 속성 저장 (필요시 사용)
            $pill.attr('data-value', value);
            $pills_area.append($pill);
        });

        let final_value = current_values.length > 0 ? current_values.join(', ') : "";
        console.log("Setting final value to:", final_value);

        $original_input.val(final_value).trigger('change');
        field.set_value(final_value);

    }

    // 초기 렌더링
    render_pills();

    // 5. Awesomplete 연결
    let awesomplete = new Awesomplete($search_input[0], {
        minChars: 0,
        maxItems: 99,
        autoFirst: true,
        list: options
    });

    // 6. 값 추가 이벤트
    $search_input.on('awesomplete-selectcomplete', function (e) {
        let selected_item = e.text || (e.originalEvent && e.originalEvent.text);
        if (!selected_item) return;

        let selected_value = selected_item.value;
        $search_input.val("");

        if (!current_values.includes(selected_value)) {
            current_values.push(selected_value);
            render_pills();
        }
    });

    $search_input.on('focus click', function () {
        awesomplete.evaluate();
    });

    // 7. 값 삭제 이벤트 (인덱스 기반 삭제로 변경 - 가장 확실한 방법)
    $pills_area.on('click', '.remove-pill', function (e) {
        // 이벤트 전파 및 기본 동작 방지 (매우 중요)
        e.preventDefault();
        e.stopPropagation();

        let $group = $(this).closest('.pill-group');
        let index = $group.index(); // 현재 Pill이 몇 번째인지 확인

        if (index > -1) {
            // 배열에서 해당 인덱스의 값을 직접 제거
            current_values.splice(index, 1);
            render_pills();
        }
    });

    // 8. 강제 입력 방지
    $search_input.on('blur keydown', function (e) {
        if (e.type === 'blur' || (e.type === 'keydown' && e.keyCode === 13)) {
            setTimeout(() => {
                $search_input.val("");
            }, 100);
        }
    });

    // 컨테이너 클릭 시 입력창 포커스
    $container.on('click', function (e) {
        if (e.target === this || e.target === $pills_area[0]) {
            $search_input.focus();
        }
    });
}


// Keep setup_dialog_link_queries function as is
function setup_dialog_link_queries(frm, dialog, data) {
    const field_query_map = {
        "glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "door_closer": { filters: { opt_name: ["in", ["Door Closer", "YesNo"]], is_active: 1 } },
        "handle_direct": { filters: { opt_name: "Handle Direction", is_active: 1 } },
        "keeper": { filters: { opt_name: ["in", ["Hinge & Keeper", "Keeper"]], is_active: 1 } },
        "keeper_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "keeper_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge": { filters: { opt_name: ["in", ["Hinge & Keeper", "Hinge"]], is_active: 1 } },
        "hinge_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_type": { filters: { opt_name: "Hinge Type", is_active: 1 } },
        "hinge_num": { filters: { opt_name: "Number of Hinge Holes", is_active: 1 } },
        "leaf_act_status": { filters: { opt_name: "Leaf Active Status", is_active: 1 } },
        "leaf_thk": { filters: { type: "Leaf", is_active: 1 } },
        "leaf_glass_a": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_glass_b": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_material": { filters: { opt_name: "Leaf Material", is_active: 1 } },
        "leaf_b_act_status": { filters: { opt_name: "Leaf Active Status", is_active: 1 } },
        "leaf_b_thk": { filters: { type: "Leaf", is_active: 1 } },
        "leaf_b_glass_a": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_b_glass_b": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_b_material": { filters: { opt_name: "Leaf Material", is_active: 1 } },
        "auto_drop_seal": { filters: { opt_name: "Auto Drop Seal", is_active: 1 } },
        "leaf_b_auto_drop_seal": { filters: { opt_name: "Auto Drop Seal", is_active: 1 } },
        "astragal": { filters: { opt_name: "YesNo", is_active: 1 } },
        "flush_bolt": { filters: { opt_name: "Flush Bolt", is_active: 1 } },
        "fgd_info": { filters: { opt_name: "FGD", is_active: 1 } },
        "tape_seal_color": { filters: { opt_name: "Tape & Seal Color", is_active: 1 } },
        "fix_screw_cap": { filters: { opt_name: "Fixing Screw Cap", is_active: 1 } },
        "key_cylinder": { filters: { opt_name: "YesNo", is_active: 1 } },
        // Add queries for Item Link fields if they are in the dialog fields list
        "leaf_item_code": { filters: { /* Add filters for leaf items if needed */ } },
        "leaf_b_item_code": { filters: { /* Add filters for leaf B items if needed */ } },
    };

    dialog.fields.forEach(df => {
        if (df.fieldtype === "Link" && field_query_map[df.fieldname]) {
            // Set the get_query method for the dialog field
            dialog.get_field(df.fieldname).get_query = function () {
                // You can add dynamic filters here if needed, based on the form or dialog values
                // Example: let current_dialog_values = this.dialog.get_values();
                return field_query_map[df.fieldname];
            };
        }
    });
}


// Keep handle_leaf_item_updates function as is
async function handle_leaf_item_updates(frm, parent_row_doc, dialog_values) {
    const table_fieldname = 'po_items'; // Confirm this is the correct fieldname

    let door_open_type = "";
    let door_set_type = "";

    try {
        const r = await frappe.db.get_value('Item', parent_row_doc.item_code, ['door_open_type', 'door_set_type']);
        if (r && r.message) {
            door_open_type = r.message.door_open_type;
            door_set_type = r.message.door_set_type;
        }
    } catch (e) {
        console.error("Failed to fetch item details", e);
    }

    const parent_context = {
        parent_row_no: parent_row_doc.idx,
        ch: parent_row_doc.ch,
        ph: parent_row_doc.ph,
        width: parent_row_doc.width,
        // leaf_a_width: dialog_values.leaf_a_width || parent_row_doc.leaf_a_width,
        zone: parent_row_doc.zone,
        planned_qty: parent_row_doc.planned_qty,
        door_hw_spec: parent_row_doc.door_hw_spec,
        door_open_type: door_open_type,
        door_set_type: door_set_type,
        door_frame: parent_row_doc.item_code,
        door_closer: parent_row_doc.door_closer,
        handle_direct: parent_row_doc.handle_direct,
        hw_options: parent_row_doc.hw_options,
        sub_contract: parent_row_doc.sub_contract,
        price_study: parent_row_doc.price_study,
        app_country: parent_row_doc.app_country,
        keeper: parent_row_doc.keeper,
        hinge: parent_row_doc.hinge,
        hinge_type: parent_row_doc.hinge_type,
        hinge_num: parent_row_doc.hinge_num,
        hinge_glass_a: parent_row_doc.hinge_glass_a,
        hinge_glass_b: parent_row_doc.hinge_glass_b,
        astragal: parent_row_doc.astragal,
        flush_bolt: parent_row_doc.flush_bolt,
        fgd_info: parent_row_doc.fgd_info,
        tape_seal_color: parent_row_doc.tape_seal_color,
        fix_screw_cap: parent_row_doc.fix_screw_cap,
        key_cylinder: parent_row_doc.key_cylinder,
        ceiling_visible: parent_row_doc.ceiling_visible,
        panel_trh: parent_row_doc.panel_trh,
        panel_crh: parent_row_doc.panel_crh,
        base_visible_h: parent_row_doc.base_visible_h,
        under_cut: parent_row_doc.under_cut,
        parentfield: table_fieldname // Ensure the new rows point to the correct parentfield
    };

    // Calculate leaf width based on parent width and equal width flag
    let leaf_width = cint(parent_context.width); // Default to parent width (as Int)
    if (dialog_values.is_pair_door && dialog_values.equal_leaf_w && leaf_width > 136) {
        const frame_allowance = 10; // Example calculation
        leaf_width = (leaf_width - frame_allowance) / 2;
    }
    leaf_width = Math.max(leaf_width, 0);

    // --- Leaf A ---
    // Check if leaf_item_code is selected in the dialog and is not empty/null
    if (dialog_values.leaf_item_code) {
        const leaf_a_values = {
            // Context from parent door row
            ...parent_context,
            // Leaf A specific values from dialog
            item_code: dialog_values.leaf_item_code,
            leaf_act_status: dialog_values.leaf_act_status,
            leaf_thk: dialog_values.leaf_thk,
            leaf_color: dialog_values.leaf_color,
            leaf_glass_a: dialog_values.leaf_glass_a,
            leaf_glass_b: dialog_values.leaf_glass_b,
            leaf_material: dialog_values.leaf_material,
            color: dialog_values.leaf_color || parent_row_doc.color,
            auto_drop_seal: dialog_values.auto_drop_seal,

            indent_level: cint(parent_row_doc.indent_level || 0) + 1, // Increase indent level
            width: leaf_width,
            is_leaf_item: 1, // Custom flag to identify Leaf items added this way
            leaf_name: 'A'
        };
        // Add or update the item in the target child table (e.g., 'po_items')
        add_or_update_child_item(frm, table_fieldname, parent_row_doc, leaf_a_values); // 'leaf_a_row_ref' is a field on the parent_row_doc
    } else {
        // If leaf_item_code is cleared in dialog, remove the existing Leaf A row
        remove_child_item(frm, table_fieldname, parent_row_doc, 'A');
    }

    // --- Leaf B ---
    // Check if is_pair_door is checked AND leaf_b_item_code is selected
    if (dialog_values.is_pair_door && dialog_values.leaf_b_item_code) {
        const leaf_b_values = {
            // Context from parent door row
            ...parent_context,
            // Leaf B specific values from dialog
            item_code: dialog_values.leaf_b_item_code,
            leaf_act_status: dialog_values.leaf_b_act_status,
            leaf_thk: dialog_values.leaf_b_thk,
            leaf_color: dialog_values.leaf_b_color,
            leaf_glass_a: dialog_values.leaf_b_glass_a,
            leaf_glass_b: dialog_values.leaf_b_glass_b,
            leaf_material: dialog_values.leaf_b_material,
            color: dialog_values.leaf_b_color || parent_row_doc.color,
            auto_drop_seal: dialog_values.leaf_b_auto_drop_seal,
            indent_level: cint(parent_row_doc.indent_level || 0) + 1, // Increase indent level
            width: leaf_width, // Using same calculated width as Leaf A
            is_leaf_item: 1, // Flag as a leaf item
            leaf_name: 'B'
        };
        add_or_update_child_item(frm, table_fieldname, parent_row_doc, leaf_b_values);
    } else {
        // If pair door is unchecked or leaf_b_item_code is cleared, remove Leaf B row
        remove_child_item(frm, table_fieldname, parent_row_doc, 'B');
    }
}


function add_or_update_child_item(frm, child_table_fieldname, parent_row_doc, child_values) {
    const child_doctype_name = frappe.get_meta(frm.doctype).fields.find(df => df.fieldname === child_table_fieldname)?.options;
    if (!child_doctype_name) {
        console.error(`add_or_update_child_item: Could not determine child doctype name for fieldname: ${child_table_fieldname}`);
        return;
    }
    // Save parent_row_doc first to ensure it has a valid name.
    // frm.save_or_update();

    setTimeout(() => {
        (frm.doc.items || []).forEach(row => {
            // fg_item 업데이트: 이전 아이템 코드를 새 아이템 코드로 변경
            if (row.fg_item === old_item_code) {
                frappe.model.set_value(row.doctype, row.name, 'fg_item', new_item_code);
            }

            if (row.fg_reference_id === old_item_name) {
                frappe.model.set_value(row.doctype, row.name, 'fg_reference_id', new_item_name);
            }
        });

        // frm.refresh_field("items");
        frm.refresh();
    }, 300);

    const parent_name = parent_row_doc.name;
    // const parent_row_no = parent_row_doc.idx;
    const leaf_type = child_values.leaf_name;

    let child_row = frm.doc[child_table_fieldname]?.find(row =>
        row.linked_item_ref === parent_name && row.leaf_name === leaf_type);

    // const bom_no = frappe.db.get_value("Item", child_values.item_code, "default_bom")
    // child_values.bom_no = bom_no ? bom_no.default_bom : null;

    Promise.all([
        // 1. Item 마스터의 Default BOM 조회
        frappe.db.get_value("Item", child_values.item_code, "default_bom"),

        // 2. 현재 회사(Company)에 맞는 Active BOM 조회
        frappe.db.get_value("BOM", {
            "item": child_values.item_code,
            "company": frm.doc.company, // 현재 문서의 Company 사용
            "is_active": 1,
            "docstatus": 1
        }, "name") // BOM 이름(ID) 조회
    ]).then(results => {
        const r_default = results[0];
        const r_company = results[1];

        // 결과 파싱
        const default_bom = (r_default && r_default.message) ? r_default.message.default_bom : null;
        const company_bom = (r_company && r_company.message) ? r_company.message.name : null;

        child_values.bom_no = company_bom || default_bom;

        // 1. Try to find existing child row using the stored name in the parent reference field
        if (child_row) {
            console.log(`add_or_update_leaf_item: 기존 Leaf '${leaf_type}' 행 업데이트: ${child_row.name}`);
            let changed = false;
            // child_values에 있는 모든 키에 대해 값을 업데이트합니다.
            Object.keys(child_values).forEach(key => {
                if (frappe.meta.has_field(child_doctype_name, key) && child_row[key] !== child_values[key]) {
                    frappe.model.set_value(child_doctype_name, child_row.name, key, child_values[key]);
                    changed = true;
                }
            });
            if (changed) {
                frm.dirty();
                // 업데이트 후 그리드 새로고침
                frm.refresh_field(child_table_fieldname);
            }
        } else {
            console.log(`add_or_update_leaf_item: 새 Leaf '${leaf_type}' 행을 부모 행(idx: ${parent_row_doc.idx}) 바로 아래에 추가합니다.`);

            const grid = frm.get_field(child_table_fieldname).grid;
            if (!grid) {
                console.error(`add_or_update_leaf_item: 그리드 객체를 찾을 수 없습니다: ${child_table_fieldname}`);
                return;
            }

            const insertion_index = (child_values.leaf_act_status === "Inactive")
                ? parent_row_doc.idx + 2
                : parent_row_doc.idx + 1;

            const new_child_row = grid.add_new_row(insertion_index, null, null, child_values);
            frappe.model.set_value(new_child_row.doctype, new_child_row.name, 'linked_item_ref', parent_row_doc.name);

            // UI에 변경사항을 확실히 반영하기 위해 그리드를 새로고칩니다.
            grid.refresh();
            frm.dirty();

            console.log(`add_or_update_leaf_item: 새 행 ${new_child_row.name} 추가 완료. linked_item_ref: ${new_child_row.linked_item_ref}`);
        }
    })
}

// Keep remove_child_item function as is (ensure it uses correct child_table_fieldname)
function remove_child_item(frm, child_table_fieldname, parent_row_doc, parent_ref_fieldname) {
    let child_row_name = parent_row_doc[parent_ref_fieldname];
    const child_doctype_name = frappe.get_meta(frm.doctype).fields.find(df => df.fieldname === child_table_fieldname)?.options;

    if (!child_row_name || !child_doctype_name) {
        // No child linked or child doctype not found, nothing to remove
        return;
    }

    let child_row_index = frm.doc[child_table_fieldname]?.findIndex(row => row && row.name === child_row_name); // Add row check

    if (child_row_index !== -1 && child_row_index !== undefined) {
        console.log(`remove_child_item: Removing child row: ${child_row_name} from ${child_table_fieldname}`);
        // Remove from Frappe's model locals (important for saving)
        frappe.model.remove_from_locals(child_doctype_name, child_row_name);
        // Remove from the doc array
        frm.doc[child_table_fieldname].splice(child_row_index, 1);

        // Clear the reference in the parent row
        frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, null);

        frm.dirty(); // Mark form dirty
        // The grid refresh is handled by setup_bom_conditions_button
    } else {
        // Row not found in doc array, but parent still has the reference.
        // Just clear the reference to fix the link.
        if (parent_row_doc[parent_ref_fieldname]) {
            console.warn(`remove_child_item: Child row with name ${child_row_name} not found in doc array for ${child_table_fieldname}, but reference exists in parent. Clearing parent reference.`);
            frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, null);
            frm.dirty();
        } else {
            // console.log(`remove_child_item: No child row or reference to remove for ${parent_ref_fieldname} in ${parent_row_doc.name}`);
        }
    }
}

function update_specific_row_qty_display(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const parent_grid_fieldname = row?.parentfield; // Use optional chaining

    const possible_parent_grids = ["detail_bom_items", "sub_items"];
    if (!parent_grid_fieldname || !possible_parent_grids.includes(parent_grid_fieldname)) {
        console.warn("show_qty_bracket: Parent grid fieldname not valid:", parent_grid_fieldname);
        return;
    }

    // Find the specific grid row object
    const grid = frm.fields_dict[parent_grid_fieldname]?.grid;
    // Use grid_rows_by_docname for efficient lookup by document name
    const grid_row = grid?.grid_rows_by_docname?.[cdn];

    const qty_val = flt(row.qty, grid.df.precision || 0);
    const qty_prefix = row.qty_prefix ? `${row.qty_prefix}` : "";
    const qty_suffix = row.qty_suffix ? `${row.qty_suffix}` : "";
    const qty_string = `${qty_prefix}${qty_val}${qty_suffix}`;

    if (grid_row && grid_row.wrapper && row) { // Add row check
        let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');
        if ($qty_cell.length > 0) {
            $qty_cell.text(qty_string).show();
            console.log(`Updated qty display for row ${cdn}: ${qty_string}`);
        } else {
            // console.warn(`show_qty_bracket: Could not find cell for qty in row: ${cdn}`);
        }
    }
}


// ============================================================
// 그룹 기반 Pagination: 부모(indent_level 0 또는 Leaf) + 자식을
// 하나의 그룹으로 묶어 페이지 경계에서 분리되지 않도록 처리
// ============================================================
function setup_group_pagination(frm) {
    const grid = frm.fields_dict['detail_bom_items']?.grid;
    if (!grid?.grid_pagination) return;
    if (grid._group_pagination_setup) return; // 중복 설정 방지

    const pagination = grid.grid_pagination;
    const GROUPS_PER_PAGE = 10; // 페이지당 부모 그룹 수

    // --- 1. BOM 그룹 계산 (부모 + 자식 묶음) ---
    grid._compute_bom_groups = function () {
        const data = this.data || [];
        const groups = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const is_parent = item.indent_level === 0 ||
                (item.indent_level == 1 && item.product_section === "Leaf");

            if (is_parent) {
                if (groups.length > 0) {
                    groups[groups.length - 1].end = i; // 이전 그룹의 끝
                }
                groups.push({ start: i, end: data.length });
            }
        }

        // 부모 없이 시작하는 행 처리 (edge case)
        if (groups.length === 0 && data.length > 0) {
            groups.push({ start: 0, end: data.length });
        }

        return groups;
    };

    // --- 2. 페이지별 행 범위 계산 ---
    grid._get_page_range = function (page_idx) {
        const groups = this._compute_bom_groups();
        const total_groups = groups.length;

        if (total_groups === 0) return { start: 0, end: 0 };

        const start_group = (page_idx - 1) * GROUPS_PER_PAGE;
        const end_group = Math.min(start_group + GROUPS_PER_PAGE, total_groups);

        if (start_group >= total_groups) return { start: 0, end: 0 };

        return {
            start: groups[start_group].start,
            end: end_group < total_groups ? groups[end_group].start : this.data.length
        };
    };

    // --- 3. 전체 페이지 수 계산 ---
    grid._get_total_pages = function () {
        const groups = this._compute_bom_groups();
        return Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
    };

    // --- 4. render_result_rows 오버라이드 ---
    // 원본 메서드(GridRow 생성자 포함)를 재활용하면서 렌더링 범위만 그룹 기반으로 변경
    const _orig_render = grid.render_result_rows;
    grid.render_result_rows = function ($rows, append_row) {
        const range = this._get_page_range(this.grid_pagination.page_index);

        // 원본 render_result_rows는 내부적으로 다음 값으로 범위를 결정:
        //   start = (page_index - 1) * page_length
        //   end   = get_result_length()
        // 이 값들을 임시로 조정하여 그룹 범위와 일치시킴
        const saved_pi = this.grid_pagination.page_index;
        const saved_pl = this.grid_pagination.page_length;
        const saved_grl = this.grid_pagination.get_result_length;

        // start = (page_index - 1) * 1 = range.start
        this.grid_pagination.page_length = 1;
        this.grid_pagination.page_index = range.start + 1;
        this.grid_pagination.get_result_length = () => range.end;

        _orig_render.call(this, $rows, append_row);

        // 원본 값 복원
        this.grid_pagination.page_index = saved_pi;
        this.grid_pagination.page_length = saved_pl;
        this.grid_pagination.get_result_length = saved_grl;
    };

    // --- 5. pagination 메서드 오버라이드 ---
    // render_pagination: 그룹 기반 total_pages로 UI 결정
    pagination.render_pagination = function () {
        const total_pages = grid._get_total_pages();
        if (total_pages <= 1) {
            this.wrapper.find(".grid-pagination").html("");
        } else {
            this.total_pages = total_pages;
            let $pagination_template = this.get_pagination_html();
            this.wrapper.find(".grid-pagination").html($pagination_template);
            this.prev_page_button = this.wrapper.find(".prev-page");
            this.next_page_button = this.wrapper.find(".next-page");
            this.$page_number = this.wrapper.find(".current-page-number");
            this.$total_pages = this.wrapper.find(".total-page-number");
            this.first_page_button = this.wrapper.find(".first-page");
            this.last_page_button = this.wrapper.find(".last-page");
            this.bind_pagination_events();
        }
    };

    pagination.update_page_numbers = function () {
        const new_total = grid._get_total_pages();
        if (this.total_pages !== new_total) {
            this.total_pages = new_total;
            this.render_pagination();
        }
    };

    pagination.get_result_length = function () {
        const range = grid._get_page_range(this.page_index);
        return range.end;
    };

    // render_next_page: 그룹 기반 total_pages 사용
    pagination.render_next_page = function () {
        const total_pages = grid._get_total_pages();
        if (this.page_index < total_pages) {
            this.page_index++;
            this.go_to_page();
        }
    };

    // render_prev_page
    pagination.render_prev_page = function () {
        if (this.page_index > 1) {
            this.page_index--;
            this.go_to_page();
        }
    };

    // --- 6. go_to_page 오버라이드 (페이지 전환 후 toggle/qty 재적용) ---
    pagination.go_to_page = function (index, from_refresh) {
        if (!index) {
            index = this.page_index;
        } else {
            this.page_index = index;
        }

        let $rows = $(this.grid.parent).find(".rows").empty();
        this.grid.grid_rows_by_docname = {};
        this.grid.render_result_rows($rows, true);

        if (this.$page_number) {
            this.$page_number.val(index);
            this.$page_number.css("width", (index.toString().length + 1) * 8 + "px");
        }

        this.update_page_numbers();

        if (!from_refresh) {
            this.grid.scroll_to_top();
        }

        // 페이지 전환 후 toggle 로직 및 qty view 재적용
        const grid_wrapper = $(this.grid.wrapper);
        grid_wrapper.find('div.grid-heading-row .row-index').addClass('visibility-hidden');
        grid_wrapper.find('.row-index').addClass('visibility-hidden');

        apply_toggle_logic(frm, this.grid);
        update_grid_qty_view(frm);
    };

    // go_to_last_page_to_add_row 수정
    pagination.go_to_last_page_to_add_row = function () {
        const total_pages = grid._get_total_pages();
        if (this.page_index !== total_pages) {
            this.go_to_page(total_pages);
        }
        frappe.utils.scroll_to(this.wrapper);
    };

    grid._group_pagination_setup = true;
}

function setup_detail_bom_grid(frm) {
    const grid = frm.fields_dict['detail_bom_items']?.grid;
    if (!grid || grid.is_fully_setup) return;

    // --- 1. 'Add Item' 버튼 생성 (최초 한 번만 실행) ---
    setup_add_item_button(frm);

    // --- 2. 통합 grid.refresh 몽키패치 ---
    const original_refresh = grid.refresh;
    grid.refresh = function () {
        original_refresh.apply(this, arguments);
        // refresh가 호출될 때마다 실행될 로직들
        const grid_wrapper = $(this.wrapper);
        const add_row_button = grid_wrapper.find('.grid-add-row');

        const add_item_button = this.custom_buttons ? this.custom_buttons.add_item : null;

        if (add_row_button.length > 0 && add_item_button) {
            add_row_button.after(add_item_button); // 위치를 다시 잡아주고
            add_row_button.hide(); // 'Add Row'를 숨깁니다.
        }

        grid_wrapper.find('div.grid-heading-row .row-index').addClass('visibility-hidden');
        grid_wrapper.find('.row-index').addClass('visibility-hidden');

        update_grid_qty_view(frm);

        // 가. 자식 행 토글 기능 적용 (기존 setup_toggle_sub_items의 로직)
        apply_toggle_logic(frm, this);

        // 나. 'Add Item' 버튼 표시/숨김 상태 업데이트
        toggle_add_item_button_visibility(frm);
    };

    grid.is_fully_setup = true;
    grid.refresh();
}

function setup_add_item_button(frm) {
    const grid = frm.fields_dict['detail_bom_items'].grid;

    // 이미 버튼 객체가 생성되었으면 다시 만들지 않음
    if (grid.custom_buttons && grid.custom_buttons.add_item) {
        return;
    }

    const add_item_button = $(`<button class="btn btn-secondary btn-xs btn-add-context-item" ...>Add Item</button>`);

    // const add_row_button = grid_wrapper.find('.grid-add-row');
    // add_row_button.after(add_item_button);
    // add_row_button.hide();

    add_item_button.on('click', () => {
        const all_items = frm.doc.detail_bom_items;
        // 현재 펼쳐진 부모를 찾습니다.
        const expanded_parent = all_items.find(item => item._expanded);

        if (!expanded_parent) {
            frappe.show_alert({
                message: __('Please expand a parent item to add a new item within it.'),
                indicator: 'orange'
            });
            return;
        }

        // 펼쳐진 부모의 자손들을 찾습니다.
        const parent_idx = all_items.findIndex(d => d.name === expanded_parent.name);
        let next_parent_idx = -1;
        for (let i = parent_idx + 1; i < all_items.length; i++) {
            const is_next_parent = all_items[i].indent_level === 0 || (all_items[i].indent_level === 1 && all_items[i].product_section === "Leaf");
            if (is_next_parent) {
                next_parent_idx = i;
                break;
            }
        }
        const children_end_idx = (next_parent_idx === -1) ? all_items.length : next_parent_idx;
        const children_rows = all_items.slice(parent_idx + 1, children_end_idx);

        let last_row_doc, insert_at_idx;

        if (children_rows.length > 0) {
            // 자손이 있으면 마지막 자손을 기준으로 함
            last_row_doc = children_rows[children_rows.length - 1];
            insert_at_idx = last_row_doc.idx + 1; // 마지막 자손 바로 다음에 삽입
        } else {
            // 자손이 없으면 부모를 기준으로 함
            last_row_doc = expanded_parent;
            insert_at_idx = last_row_doc.idx + 1; // 부모 바로 다음에 삽입
        }

        // 복사할 문서를 만들고, 특정 필드는 초기화
        const modified_doc = frappe.model.copy_doc(last_row_doc);
        modified_doc.item_code = '';
        modified_doc.item_name = '';
        modified_doc.description = '';
        modified_doc.qty = 1;
        // modified_doc.rate = 0;
        // modified_doc.amount = 0;

        // is_duplicate=false로 해야 새 __newname이 할당됨.
        // true로 하면 name까지 복사되어 중복 에러 발생.
        const new_row = grid.add_new_row(insert_at_idx, null, true, modified_doc, false);

        // 새 행이 보이도록 스크롤
        // $(new_row.wrapper).find('[data-fieldtype="Data"]').first().focus();
    });
    // 생성된 버튼 객체를 grid 객체에 저장하여 나중에 참조할 수 있도록 함
    if (!grid.custom_buttons) {
        grid.custom_buttons = {};
    }
    grid.custom_buttons.add_item = add_item_button;
}

function apply_toggle_logic(frm, grid_obj) {
    const all_items = frm.doc.detail_bom_items;
    if (!all_items) return;

    // --- 1. 상태 초기화 ---
    all_items.forEach(doc_row => {
        const is_potential_parent = doc_row.indent_level == 0 || (doc_row.indent_level == 1 && doc_row.product_section === "Leaf");
        if (is_potential_parent && doc_row._expanded === undefined) {
            doc_row._expanded = false; // Default to collapsed
        }
    });

    // grid_rows_by_docname을 사용하여 현재 페이지에 렌더된 행만 처리
    const rendered_rows = Object.values(grid_obj.grid_rows_by_docname || {});
    rendered_rows.forEach(function (grid_row) {
        const row_doc = grid_row.doc; // Doc associated with the visible grid row
        if (!row_doc) return;

        const $row_wrapper = $(grid_row.wrapper);
        if (!$row_wrapper.length) return;
        $row_wrapper.find('.toggle-sub-items').remove(); // [안정성] 모든 행의 토글 버튼을 일단 제거
        $row_wrapper.show(); // [안정성] 모든 행을 일단 보이게 초기화

        // if (row_doc.__islocal) {
        //     return; // 새로 추가된 빈 행은 더 이상 처리하지 않음
        // }

        // ... 부모 행/자식 행에 따른 토글 버튼 추가 및 숨김 처리 ...
        const doc_data_row = all_items.find(d => d.name === row_doc.name);
        if (!doc_data_row) return; // Should not happen if grid_rows are in sync

        const is_parent_row = doc_data_row.indent_level === 0 || (doc_data_row.indent_level === 1 && doc_data_row.product_section === "Leaf");

        if (is_parent_row) {
            // --- Parent Row ---
            const $button_container = $row_wrapper.find('.row-check'); // Target the checkbox container
            const is_expanded = doc_data_row._expanded;
            const button_icon = is_expanded ? '<i class="fa fa-chevron-down"></i>' : '<i class="fa fa-chevron-right"></i>';
            const $toggle_button = $(`
                <button class="btn btn-xs btn-default toggle-sub-items"
                    title="${__('Toggle Sub Items')}"
                    style="line-height: 1;">
                    ${button_icon}
                </button>
            `);

            $button_container.prepend($toggle_button); // Add button before checkbox

            // [핵심 수정] 토글 버튼 클릭 이벤트
            $toggle_button.off("click").on("click", function (e) {
                e.stopPropagation();
                const clicked_parent_doc = all_items.find(d => d.name === grid_row.doc.name);
                if (!clicked_parent_doc) return;

                const new_expanded_state = clicked_parent_doc._expanded;

                // 다른 모든 부모를 닫고, 현재 클릭된 부모의 상태를 업데이트
                all_items.forEach(item => {
                    const is_potential_parent = item.indent_level === 0 || (item.indent_level === 1 && item.product_section === "Leaf");
                    if (is_potential_parent) item._expanded = false;
                });
                clicked_parent_doc._expanded = !new_expanded_state;

                grid_obj.refresh();

                // // 버튼 아이콘 즉시 업데이트
                // $(this).html(new_expanded_state ? "▼" : "▶");
                // // 다른 부모 버튼 아이콘도 업데이트
                // grid_obj.grid_rows.forEach(gr => {
                //     if (gr.doc.name !== clicked_parent_doc.name) {
                //         $(gr.wrapper).find('.toggle-sub-items').html('▶');
                //     }
                // });

                // // Find children and toggle visibility
                // const parent_idx = all_items.findIndex(d => d.name === clicked_parent_doc.name);
                // if (parent_idx === -1) return;

                // // 다음 부모 행 찾기
                // let next_parent_idx = -1;
                // for (let i = parent_idx + 1; i < all_items.length; i++) {
                //     if (all_items[i].indent_level === 0 || (all_items[i].indent_level === 1 && all_items[i].product_section === "Leaf")) {
                //         next_parent_idx = i;
                //         break;
                //     }
                // }
                // const start_idx = parent_idx + 1;
                // const end_idx = (next_parent_idx === -1) ? all_items.length : next_parent_idx;

                // // 현재 페이지에 보이는 자손만 DOM 조작
                // for (let i = start_idx; i < end_idx; i++) {
                //     const descendant_grid_row = grid_obj.grid_rows.find(gr => gr.doc.name === all_items[i].name);
                //     if (descendant_grid_row) {
                //         $(descendant_grid_row.wrapper).toggle(new_expanded_state);
                //     }
                // }
            });
        } else {
            let parent_row = null;
            let current_idx = all_items.findIndex(d => d.name === doc_data_row.name);
            if (current_idx > -1) {
                // 자신의 부모를 위로 올라가며 찾습니다.
                for (let i = current_idx - 1; i >= 0; i--) {
                    if (all_items[i].indent_level < doc_data_row.indent_level) {
                        parent_row = all_items[i];
                        break;
                    }
                }
            }

            let top_level_parent_expanded = false;
            if (parent_row) {
                let top_parent_search_idx = all_items.findIndex(d => d.name === parent_row.name);
                for (let i = top_parent_search_idx; i >= 0; i--) {
                    const potential_top_parent = all_items[i];
                    const is_top_level_parent = potential_top_parent.indent_level === 0 || (potential_top_parent.indent_level === 1 && potential_top_parent.product_section === "Leaf");

                    if (is_top_level_parent) {
                        if (potential_top_parent._expanded) {
                            top_level_parent_expanded = true;
                        }
                        break; // 최상위 부모를 찾았으므로 중단
                    }
                }
            }

            // // 부모를 찾지 못했거나, 부모가 닫혀있으면 자식 행을 숨깁니다.
            // if (!parent_row || !parent_row._expanded) {
            //     $row_wrapper.hide();
            // } else {
            //     $row_wrapper.show(); // 부모가 펼쳐져 있으면 보이게 합니다.
            // }
            if (!top_level_parent_expanded) {
                $row_wrapper.hide();
            }
        }
    });
}

function toggle_add_item_button_visibility(frm) {
    const grid = frm.fields_dict['detail_bom_items']?.grid;
    if (!grid || !grid.custom_buttons || !grid.custom_buttons.add_item) return;

    // const has_expanded_parent = (frm.doc.detail_bom_items || []).some(item => item._expanded);
    const button = grid.custom_buttons.add_item;

    // 버튼을 항상 보이게 하고, 조건에 따라 disabled 속성만 변경
    button.show();
}
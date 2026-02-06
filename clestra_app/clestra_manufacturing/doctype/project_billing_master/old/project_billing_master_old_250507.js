// Copyright (c) 2024, Se Yong EOM and contributors
//erpnext/erpnext/manufacturing/doctype/project_billing_master/project_billing_master.js

frappe.ui.form.on('Project Billing Master', {
    onload: function (frm) {
        // Setup queries or initial settings that don't depend on grid structure yet
        frm.fields_dict["po_items"].grid.get_field("app_country").get_query = function (doc, cdt, cdn) {
            return { filters: { "is_clestra": 1 } };
        };

        if (frm.fields_dict['door_cover']?.grid) {
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function() {
                // Example: Add dynamic filters if needed based on parent form
                return {
                    filters: { /* Add relevant filters here if necessary */ }
                };
            };
        }

        // Setup Button Click Handlers
        setup_qty_field(frm);
        setup_size_field(frm);
        setup_bom_conditions_button(frm);

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
        console.log("Project Billing Master Refresh Triggered");

        // const grid_fieldnames_with_size = ['panel_cover', 'door_cover', 'sub_items'];
        // grid_fieldnames_with_size.forEach(fieldname => {
        //     const grid = frm.fields_dict[fieldname]?.grid;
        //     if (grid && grid.wrapper) {
        //         // Use event delegation on the grid wrapper
        //         // Remove previous listener first
        //         grid.wrapper.off('click', '.grid-row .col[data-fieldname="size"]');

        //         grid.wrapper.on('click', '.grid-row .col[data-fieldname="size"]', function(e) {
        //             // Don't trigger if clicking on an input/button inside the cell (if any)
        //             if ($(e.target).is('input, button, a')) {
        //                 return;
        //             }
        //             e.preventDefault();
        //             e.stopPropagation();

        //             let row_name = $(this).closest('.grid-row').attr('data-name');
        //             let grid_row_obj = grid.get_row(row_name);

        //             if (grid_row_obj && grid_row_obj.doc) {
        //                  // Call the dialog function
        //                  open_size_edit_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
        //             } else {
        //                  console.error("Could not find row object for clicked size field.");
        //             }
        //         });
        //         // Add a class to make it look clickable (optional)
        //         grid.wrapper.find('.col[data-fieldname="size"]').addClass('clickable'); // Add CSS for .clickable { cursor: pointer; text-decoration: underline; color: blue; }
        //     }
        // });

        // --- Define Desired Columns for Each Grid ---
        // These are the fieldnames from 'Project Billing Master Sub Item' Doctype
        const detail_bom_items_cols = [
            "item_code", "item_name", "size", "qty", "color", "remark", "zone"
        ]

        const panel_cover_cols = ["product_keyword", "size", "qty", "color", "remark"];
        const door_cover_cols = ["door_hw_spec_code", "product_keyword", "size", "qty", "remark"];
        const sub_items_cols = ["print_group", "print_order", "item_name", "size", "qty", "color", "remark"];

        set_custom_grid_columns(frm, 'panel_cover', panel_cover_cols);
        set_custom_grid_columns(frm, 'door_cover', door_cover_cols);
        set_custom_grid_columns(frm, 'sub_items', sub_items_cols);
        set_custom_grid_columns(frm, 'detail_bom_items', detail_bom_items_cols);

        // --- Existing Refresh Logic ---
        const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
        if (detail_bom_items_grid?.grid_pagination && detail_bom_items_grid.grid_pagination.page_length !== 99999) {
            console.log("Disabling pagination for detail_bom_items_grid.");
            detail_bom_items_grid.grid_pagination.page_length = 99999;
            // Refresh the grid to apply pagination change
            detail_bom_items_grid.refresh();
        }
        // Setup toggles after potentially refreshing the detail_bom_items grid
        frm.trigger("setup_toggle_sub_items");


        // Add initial row to po_items table if empty
        if (!frm.doc.po_items || frm.doc.po_items.length === 0) {
            // Check if the user has permission to create
            if (frappe.perm.has_perm(frm.doctype, 0, "write")) {
                 frm.add_child('po_items');
                 frm.refresh_field('po_items');
            }
        }

        // Re-attach dynamic query for door_cover grid if it exists
         if (frm.fields_dict['door_cover']?.grid) {
            frm.fields_dict['door_cover'].grid.get_field('hwl_spec_code').get_query = function() {
                return { filters: {} }; // Re-apply query logic as needed
            };
        }

        // Ensure button handlers are setup (can be called safely multiple times due to .off())
        setup_qty_field(frm);
        setup_size_field(frm);
        setup_bom_conditions_button(frm);

        // Update quantity view styles
        frm.trigger("update_grid_qty_view");

        console.log("Project Billing Master Refresh Completed");
    },

    setup_queries(frm) {
        // This query setup seems correct for 'po_items' table
        frm.set_query("bom_no", "po_items", (doc, cdt, cdn) => {
            var d = locals[cdt][cdn];
            if (d.item_code) {
                return {
                    query: "erpnext.controllers.queries.bom",
                    filters: { item: d.item_code, docstatus: 1 },
                };
            } else {
                 frappe.msgprint(__("Please enter Item first"));
                 return false; // Prevent query if no item code
            }
        });
        // Add other dynamic queries here if needed
    },

    get_sub_assembly_items(frm) {
        if (frm._getting_sub_assembly_items) return; // Prevent concurrent calls
        frm._getting_sub_assembly_items = true;
        frm.dirty(); // Mark form as dirty

        frappe.call({
            method: "get_sub_assembly_items", // Ensure this method exists server-side
            freeze: true,
            doc: frm.doc, // Pass the current form document
            callback: function (r) {
                console.log("get_sub_assembly_items callback started");
                // The backend should update frm.doc.detail_bom_items directly or return data to be merged.
                // Assuming the backend updates frm.doc directly:
                refresh_field("detail_bom_items"); // Refresh the field to show new data

                const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
                if (detail_bom_items_grid && detail_bom_items_grid.df) {
                    if (detail_bom_items_grid.grid_pagination.page_length !== 99999) {
                        console.log("Disabling pagination in get_sub_assembly_items callback.");
                        detail_bom_items_grid.grid_pagination.page_length = 99999;
                        // Refresh the grid to apply pagination change *after* data is loaded
                        detail_bom_items_grid.refresh();
                    }
                } else {
                    console.warn("Summary grid or grid.df not found in get_sub_assembly_items callback.");
                }
                frm.trigger("update_grid_qty_view");
                // Setup toggles after data is loaded and grid is refreshed
                frm.trigger("setup_toggle_sub_items");
            },
            always: function () {
                frm._getting_sub_assembly_items = false; // Reset flag
            },
        });
    },

    generate_billing(frm) {
        frm.dirty();
        frappe.call({
            method: "generate_billing", // Ensure this method exists server-side
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                console.log("generate_billing callback started");
                // Backend should update relevant fields like panel_cover, door_cover, sub_items
                // Refresh the fields to show the generated data
                refresh_field("panel_cover");
                refresh_field("door_cover");
                refresh_field("sub_items");

                // Trigger necessary UI updates after data load
                frm.trigger("update_grid_qty_view");
                frm.trigger("setup_toggle_sub_items"); // Refresh toggles if detail_bom_items might have changed indirectly

                // Re-apply column customizations as refresh_field might reset them
                frm.trigger("refresh"); // Easiest way to re-apply all refresh logic including column customization

            },
            error: function(r) {
                console.error("Error during generate_billing:", r);
                // Handle error appropriately, e.g., frappe.msgprint
            }
        });
    },

    setup_toggle_sub_items(frm) {
        const grid = frm.fields_dict['detail_bom_items']?.grid;
        if (!grid || !grid.grid_rows || !frm.doc.detail_bom_items) {
            // console.warn("Detail BOM Items grid/data not ready for toggle setup.");
            return;
        }
        const all_items = frm.doc.detail_bom_items; // Use frm.doc for consistent state

        // Ensure _expanded state exists (initialize if needed)
        all_items.forEach(doc_row => {
            const is_potential_parent = doc_row.indent_level === 0 || (doc_row.indent_level === 1 && doc_row.product_section === "Leaf");
            if (is_potential_parent && doc_row._expanded === undefined) {
                doc_row._expanded = false; // Default to collapsed
            }
        });

        // Process only the currently rendered rows for performance
        grid.grid_rows.forEach(function (grid_row) {
            const row_doc = grid_row.doc; // Doc associated with the visible grid row
            if (!row_doc) return;

            // Find the corresponding full data row in frm.doc.detail_bom_items using name
            const doc_data_row = all_items.find(d => d.name === row_doc.name);
            if (!doc_data_row) return; // Should not happen if grid_rows are in sync

            const $row_wrapper = $(grid_row.wrapper);
            if (!$row_wrapper.length) return;

            const $button_container = $row_wrapper.find('.row-check'); // Target the checkbox container
            $button_container.find('.toggle-sub-items').remove(); // Clean up previous buttons

            const is_parent_row = doc_data_row.indent_level === 0 || (doc_data_row.indent_level === 1 && doc_data_row.product_section === "Leaf");

            if (is_parent_row) {
                // --- Parent Row (indent_level === 0) ---
                if ($button_container.length > 0) {
                    const is_expanded = doc_data_row._expanded;
                    const button_icon = is_expanded ? "▼" : "▶";
                    const $toggle_button = $(`
                        <button class="btn btn-xs btn-default toggle-sub-items"
                            title="${__('Toggle Sub Items')}"
                            style="margin-right: 4px; padding: 1px 4px; line-height: 1;">
                            ${button_icon}
                        </button>
                    `);
                    $button_container.prepend($toggle_button); // Add button before checkbox

                    $toggle_button.off("click").on("click", function (e) {
                        e.stopPropagation(); // Prevent row selection

                        // Find the data row again to ensure we have the latest state
                        const current_doc_row = all_items.find(d => d.name === row_doc.name);
                        if (!current_doc_row) return;

                        const new_expanded_state = !current_doc_row._expanded;
                        current_doc_row._expanded = new_expanded_state; // Update state in frm.doc
                        $(this).html(new_expanded_state ? "▼" : "▶"); // 버튼 아이콘 업데이트

                        // Find children and toggle visibility (only for currently rendered rows)
                        const parent_idx = all_items.findIndex(d => d.name === current_doc_row.name);
                        if (parent_idx === -1) return;

                        let next_parent_idx = -1;
                        for (let i = parent_idx + 1; i < all_items.length; i++) {
                            if (all_items[i].indent_level === 0 || (all_items[i].indent_level === 1 && all_items[i].product_section === "Leaf")) {
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
            } else {
                // --- Child/Descendant Row (indent_level > 0) ---
                // Find the direct parent in the full data list
                let parent_row = null;
                let current_idx = all_items.findIndex(d => d.name === doc_data_row.name);
                 if (current_idx > -1) {
                    for (let i = current_idx - 1; i >= 0; i--) {
                        if (all_items[i].indent_level < doc_data_row.indent_level) {
                             parent_row = all_items[i];
                             break;
                        }
                    }
                 }

                // Hide if parent is collapsed or not found
                if (!parent_row || !parent_row._expanded) {
                    $row_wrapper.hide();
                } else {
                    $row_wrapper.show(); // Ensure it's visible if parent is expanded
                }
            }
        });
    },
});

function update_grid_qty_view(frm) {
    const grid = frm.fields_dict["sub_items"]?.grid;
    if (!grid || !grid.grid_rows) {
        // console.log("sub_items grid or rows not ready for update_grid_qty_view");
        return;
    }
    // console.log(`Updating qty view for ${grid.grid_rows.length} rows in sub_items (on refresh).`);

    grid.grid_rows.forEach(function (grid_row) {
        let item = grid_row.doc;
        if (!item || !grid_row.wrapper) {
            // console.warn("Skipping row update: item data or row wrapper missing.", grid_row);
            return;
        }

        // Target the column cell div
        let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');

        if ($qty_cell.length > 0) {
            // Use toggleClass for cleaner add/remove based on boolean value
            $qty_cell.toggleClass("qty-bracket", !!item.show_qty_bracket);
        } else {
            // console.warn(`Could not find cell for qty in row: ${item.name}`);
        }
        // DO NOT call grid_row.refresh() here.
    });
}


function set_custom_grid_columns(frm, fieldname, desired_columns) {
    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid || !grid.doctype) {
        // console.log(`Grid not found or not ready for customizing: ${fieldname}`);
        return;
    }

    if (grid._custom_columns_lock) {
        // console.log(`Custom column setup for ${fieldname} is already in progress. Skipping.`);
        return;
    }
    grid._custom_columns_lock = true; // Set lock

    const original_method_name = `original_setup_visible_columns_for_${fieldname}`;
    if (!grid[original_method_name]) {
        if (typeof grid.setup_visible_columns === "function") {
            grid[original_method_name] = grid.setup_visible_columns;
        } else {
            console.error(`setup_visible_columns not found for ${fieldname}. Cannot override.`);
            grid._custom_columns_lock = false; // Release lock
            return;
        }
    }

    // Override the setup function for *this specific grid instance*
    grid.setup_visible_columns = function() {
        if (this._is_calling_original_setup) {
            return;
        }

        try {
            // 1. Get all docfields for the child doctype
            const all_docfields = (this.meta && this.meta.fields) ? this.meta.fields : frappe.get_meta(this.doctype)?.fields;
            if (!all_docfields) {
                console.error(`Could not get docfields for ${this.doctype} in grid ${fieldname}. Cannot set custom columns.`);
                if (this[original_method_name]) { 
                    this._is_calling_original_setup = true;
                    this[original_method_name].apply(this);
                    delete this._is_calling_original_setup }
                else { this.visible_columns = []; }
                return;
            }

            // 2. Build the new visible_columns array based *only* on desired_columns
            const new_visible_columns = [];
            let total_assigned_width = 0;
            const max_grid_width = 11; // Max bootstrap cols available for content
            const fixed_width_fields = ["item_code", "item_name", "product_type", "product_keyword", "door_hw_spec_code", "size"]; // Fixed width fields
            const panel_cover_fields = ["qty", "color", "remark"]
            const door_cover_fields = ["qty", "remark"]
            const sub_items_fields = ["print_group"]

            desired_columns.forEach(fname => {
                const df = all_docfields.find(f => f.fieldname === fname);
                if (df && !df.hidden) {
                    // --- FIXED WIDTH CALCULATION ---
                    // Use df.columns if defined in Doctype, otherwise use a default value (e.g., 2).
                    let colsize;
                    if (fixed_width_fields.includes(df.fieldname)) {
                        // If the field is in our special list, force width to 2
                        colsize = 2;
                        // console.log(`Setting fixed width 2 for ${df.fieldname}`);
                    } else if (door_cover_fields.includes(df.fieldname) && fieldname === "door_cover") {
                        colsize = 2;
                    } else if (panel_cover_fields.includes(df.fieldname) && fieldname === "panel_cover") {
                        colsize = 2;
                    } else if (sub_items_fields.includes(df.fieldname) && fieldname === "sub_items") {
                        colsize = 2;
                    } else {
                        colsize = cint(df.columns) || 1; // Default to 2 if not specified
                    }

                    // --- END FIXED WIDTH CALCULATION ---
                    colsize = Math.max(1, colsize); // Ensure minimum width of 1
                    new_visible_columns.push([df, colsize]);
                    total_assigned_width += colsize;
                } else {
                     // console.warn(`Field "${fname}" requested for grid "${fieldname}" not found or is hidden in doctype ${grid.doctype}. It will be skipped.`);
                }
            });

            // 3. Optional: Adjust widths if total exceeds max grid width
            if (total_assigned_width > max_grid_width && new_visible_columns.length > 0) {
                const scale_factor = max_grid_width / total_assigned_width;
                new_visible_columns.forEach(col_config => {
                    col_config[1] = Math.max(1, Math.floor(col_config[1] * scale_factor));
                });
            }

            if (new_visible_columns.length === 0) {
                console.error(`No valid columns could be configured for ${fieldname} based on desired_columns. Grid will be empty or use fallback.`);
                 if (this[original_method_name]) { 
                    this._is_calling_original_setup = true;
                    this[original_method_name].apply(this);
                    delete this._is_calling_original_setup;
                } else { this.visible_columns = []; }
                 return;
            }

            // 4. Set the grid's properties based *only* on the desired columns
            this.visible_columns = new_visible_columns;
            this.visible_column_names = grid.visible_columns.map(col => col[0].fieldname);
            // grid.grid_columns = {};
            // grid.columns_list = [];

            // console.log(`Custom columns explicitly set for ${fieldname}:`, grid.visible_column_names);

        } catch (e) {
            console.error(`Error in custom setup_visible_columns (set_custom_grid_columns) for ${fieldname}:`, e); // Log the specific error
            if (this[original_method_name]) {
                console.log(`Falling back to original setup_visible_columns for ${fieldname} due to error.`);
                this._is_calling_original_setup = true;
                this[original_method_name].apply(this);
            }
        } finally {
            setTimeout(() => { grid.custom_columns_being_applied = false; }, 0);
        }
    };

    // Trigger a FULL grid rebuild using the overridden setup_visible_columns
    if (grid.reset_grid) {
        // console.log(`Triggering grid.reset_grid() for ${fieldname} to apply custom columns.`);
        grid.reset_grid();
    } else {
        console.warn(`grid.reset_grid() not found for ${fieldname}. Falling back to grid.refresh(). Columns might not apply correctly.`);
        grid.refresh();
    }

    frm.trigger("update_grid_qty_view");
}

function set_default_section(frm, cdt, cdn, product_section) {
    let row = locals[cdt][cdn];
    if (!row.product_section) {
        // Use frm.set_value for child tables to ensure reactivity
        frm.set_value(cdt, cdn, 'product_section', product_section);
    }
}

function fetch_and_set_print_fields(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    if (row.item_code && row.parentfield === 'sub_items') {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                filters: { name: row.item_code },
                fieldname: ["print_group", "print_order"]
            },
            callback: function(r) {
                if (r.message) {
                    frm.model.set_value(cdt, cdn, "print_group", r.message.print_group);
                    frm.model.set_value(cdt, cdn, "print_order", r.message.print_order);
                } else {
                     frm.model.set_value(cdt, cdn, "print_group", null);
                     frm.model.set_value(cdt, cdn, "print_order", null);
                }
                 // No explicit refresh needed here, model.set_value should handle it,
                 // or the grid refresh in the main form's refresh handler will cover it.
            }
        });
    }
}

// function set_size_field(frm, cdt, cdn) {
//     const row = locals[cdt][cdn];
//     if (row.parentfield === 'sub_items') {
//         const size_parts = [];
//         const size_field_keys = ['width', 'uw', 'pw', 'ch', 'uh', 'ph', 'leaf_width', 'leaf_height'];
//         size_field_keys.forEach(key => {
//             if (row[key] != null && row[key] !== 0 && row[key] !== '') {
//                  size_parts.push(`${key.toUpperCase()}:${row[key]}`);
//             }
//         });
//         const size_string = size_parts.join(', ');
//         frm.model.set_value(cdt, cdn, "size", size_string);
//     }
// }

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
         dialog_fields.push({ label: __("Width"), fieldname: "width", fieldtype: "Int", default: row.width });
    }
    if (product_section === "Door") {
         dialog_fields.push({ label: "CH", fieldname: "ch", fieldtype: "Int", default: row.ch || ""});
    }
    if (product_section === "Leaf") {
        dialog_fields.push({ label: __("Leaf Width"), fieldname: "leaf_width", fieldtype: "Int", default: row.leaf_width });
        dialog_fields.push({ label: __("Leaf Height"), fieldname: "leaf_height", fieldtype: "Int", default: row.leaf_height });
    }
     if (product_section === "Panel") {
        dialog_fields.push({ label: __("Panel Width (PW)"), fieldname: "pw", fieldtype: "Int", default: row.pw }); // Added PW
        dialog_fields.push({ label: __("Panel Height (PH)"), fieldname: "ph", fieldtype: "Int", default: row.ph }); // Added PH
    }
    // Add other potentially editable size fields if needed (e.g., under_cut?)

    // --- Create and Show Dialog ---
    let dialog = new frappe.ui.Dialog({
        title: __("Edit Size for {0}", [row.item_name || row.item_code]),
        fields: dialog_fields,
        primary_action_label: __('Update Size'),
        primary_action: function(values) {
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
                            console.log(`Field ${fieldname}: Converted '' to 0.`);
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
                        console.error(`Error setting value for ${fieldname}:`, e);
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
                 console.error("Error setting value for size:", e);
            }

            // --- Step 3: Force Grid Row Refresh ---
            console.log("Attempting to refresh grid row...");
            const grid = frm.fields_dict[row.parentfield]?.grid;
            if (grid) {
                const grid_row = grid.grid_rows_by_docname?.[cdn];
                if (grid_row) {
                    console.log("Found grid row object, calling grid_row.refresh()");
                    grid_row.refresh();
                    frm.dirty();
                } else {
                    console.warn("Grid row object not found for cdn:", cdn, ". Falling back to refreshing parent field:", row.parentfield);
                    if(row.parentfield) frm.refresh_field(row.parentfield);
                }
            } else {
                 console.warn("Grid object not found for parentfield:", row.parentfield);
            }

            console.log("--- Dialog Update End ---");
            dialog.hide();
        }
    });

    dialog.show();
}

function open_qty_edit_dialog(frm, cdt, cdn) {
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
        { label: "RH", fieldname: "rh_qty", fieldtype: "Int", default: row.rh_qty },
        { label: "LH", fieldname: "lh_qty", fieldtype: "Int", default: row.lh_qty },
        { label: "RHR", fieldname: "rhr_qty", fieldtype: "Int", default: row.rhr_qty },
        { label: "LHR", fieldname: "lhr_qty", fieldtype: "Int", default: row.lhr_qty },
    ];

    // --- Create and Show Dialog ---
    let dialog = new frappe.ui.Dialog({
        title: __("Edit Handle Quantity for {0}", [row.item_name || row.item_code]),
        fields: dialog_fields,
        primary_action_label: __('Update'),
        primary_action: function(values) {
            let updated_qty_data = { // Store values for qty string generation
                lh_qty: 0, // Initialize with 0
                rh_qty: 0,
                rhr_qty: 0,
                lhr_qty: 0
            };

            // --- Step 1: Update all model values based on dialog fields definition ---
            dialog_fields.forEach(df => {
                if (df.fieldname) { // Process only if fieldname is defined
                    const fieldname = df.fieldname;
                    let new_value_str = values.hasOwnProperty(fieldname) ? values[fieldname] : '';
                    // Convert empty string or invalid input to 0
                    let new_value_int = cint(new_value_str); // cint converts '', null, undefined to

                    updated_qty_data[fieldname] = new_value_int;

                    if (cint(row[fieldname]) !== new_value_int) {
                        changed = true;
                    }

                    // Update the model data for the individual field (e.g., lh_qty)
                    try {
                        frappe.model.set_value(cdt, cdn, fieldname, new_value_int);
                    } catch (e) {
                        console.error(`Error setting value for ${fieldname}:`, e);
                    }
                }
            });

            // --- Step 2: Update the 'size' field based on updated values ---
            const new_qty_string = generate_js_qty_string(updated_row_data);

            const grid = frm.fields_dict[row.parentfield]?.grid;
            const grid_row = grid?.grid_rows_by_docname?.[cdn];

            if (grid_row && grid_row.wrapper) {
                let $qty_cell_static = $(grid_row.wrapper).find('[data-fieldname="qty"] .static-area'); // Target static area
                if ($qty_cell_static.length > 0) {
                    $qty_cell_static.text(new_qty_string).show(); // Update text and ensure visible
                    // Also hide the input area if it was visible
                    $(grid_row.wrapper).find('[data-fieldname="qty"] .field-area').hide();
                    console.log("Updated grid cell text for qty.");
                } else {
                    console.warn("Could not find static-area for qty cell in row:", cdn);
                    // Fallback: Refresh row might work but could be less efficient
                    // grid_row.refresh_field('qty'); // This might not work as expected for display-only
                }
            }

            // Mark form dirty if changes were made
            if (changed) {
                frm.dirty();
            }
            dialog.hide();
        }
    });
    dialog.show();
}

function generate_js_qty_string(row_data) {
    const qty_parts = [];
    const get_val = (key) => row_data[key] ?? null; // Helper to get value or null

    const rh = get_val("rh_qty");
    const lh = get_val("lh_qty");
    const rhr = get_val("rhr_qty");
    const lhr = get_val("lhr_qty");

    if (lh > 0) qty_parts.push(`LH:${lh}`);
    if (rh > 0) qty_parts.push(`RH:${rh}`);
    if (lhr > 0) qty_parts.push(`LHR:${lhr}`);
    if (rhr > 0) qty_parts.push(`RHR:${rhr}`);

    // Add more sections or default formatting if needed
    return qty_parts.join(", ") || ""; // Return empty string if no parts
}

function generate_js_size_string(product_section, row_data) {
    const size_parts = [];
    const get_val = (key) => row_data[key] ?? null; // Helper to get value or null

    if (product_section === "Door") {
        const w = get_val("width");
        const ch = get_val("ch");
        if (w != null && w !== "" && w !== 0) size_parts.push(`W:${w}`);
        if (ch != null && ch !== "" && ch !== 0) size_parts.push(`CH:${ch}`);
    } else if (product_section === "Leaf") {
        const lw = get_val("leaf_width");
        const lh = get_val("leaf_height");
        if (lw != null && lw !== "" && lw !== 0) size_parts.push(`LW:${lw}`);
        if (lh != null && lh !== "" && lh !== 0) size_parts.push(`LH:${lh}`);
    } else if (product_section === "Panel") {
        const w = get_val("width");
        const pw = get_val("pw"); // Added PW
        const ph = get_val("ph"); // Added PH
        if (w != null && w !== "" && w !== 0) size_parts.push(`W:${w}`);
        if (pw != null && pw !== "" && pw !== 0) size_parts.push(`PW:${pw}`); // Added PW
        if (ph != null && ph !== "" && ph !== 0) size_parts.push(`PH:${ph}`);
    }
    // Add more sections or default formatting if needed
    return size_parts.join(", ");
}

function setup_qty_field(frm) {
    const grid_fieldnames_with_qty = ['door_cover'];
    grid_fieldnames_with_qty.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (grid && grid.wrapper) {
            grid.wrapper.off('click', '.grid-row .col[data-fieldname="qty"]');
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="qty"]', function(e) {
                if ($(e.target).is('button, a')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                let row_name = $(this).closest('.grid-row').attr('data-name');
                let grid_row_obj = grid.get_row(row_name);

                if (grid_row_obj && grid_row_obj.doc) {
                        open_qty_edit_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
                } else {
                        console.error("Could not find row object for clicked qty field.");
                }
            });
            // Add a class to make it look clickable (optional)
            grid.wrapper.find('.col[data-fieldname="qty"]').addClass('clickable');

            if (grid.grid_rows) {
                grid.grid_rows.forEach(grid_row => {
                   if (grid_row.doc) {
                       const qty_data = {
                            lh_qty: grid_row.doc.lh_qty,
                            rh_qty: grid_row.doc.rh_qty,
                            lhr_qty: grid_row.doc.lhr_qty,
                            rhr_qty: grid_row.doc.rhr_qty
                       };
                       const qty_string = generate_js_qty_string(qty_data);
                       let $qty_cell_static = $(grid_row.wrapper).find('[data-fieldname="qty"] .static-area');
                       if ($qty_cell_static.length > 0) {
                            $qty_cell_static.text(qty_string).show();
                            $(grid_row.wrapper).find('[data-fieldname="qty"] .field-area').hide(); // Hide input
                       }
                   }
                });
                console.log(`Initial Qty text set for grid: ${fieldname}`);
           }
        }
    });
}

function setup_size_field(frm) {
    const grid_fieldnames_with_size = ['detail_bom_items', 'panel_cover', 'door_cover', 'sub_items'];
    grid_fieldnames_with_size.forEach(fieldname => {
        const grid = frm.fields_dict[fieldname]?.grid;
        if (grid && grid.wrapper) {
            grid.wrapper.off('click', '.grid-row .col[data-fieldname="size"]');
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="size"]', function(e) {
                
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

// Function to setup the BOM Conditions button click listener
function setup_bom_conditions_button(frm) {
    const grid = frm.fields_dict['po_items']?.grid;
    if (grid && grid.wrapper) {
        // Use event delegation on the grid wrapper
        // Remove previous listener first to avoid duplicates if refresh is called multiple times
        grid.wrapper.off('click', '.grid-row .btn[data-fieldname="bom_conditions"]');

        grid.wrapper.on('click', '.grid-row .btn[data-fieldname="bom_conditions"]', function(e) {
            e.preventDefault(); // Prevent default button action
            e.stopPropagation(); // Stop event bubbling

            let row_name = $(this).closest('.grid-row').attr('data-name');
            let grid_row = grid.get_row(row_name); // Use grid's method to get row object

            if (!grid_row || !grid_row.doc) {
                frappe.msgprint(__('Unable to locate the selected row data.'));
                return;
            }
            let data = grid_row.doc; // The data for the clicked row

            // --- Create and Show Dialog ---
            let dialog = new frappe.ui.Dialog({
                title: __("BOM Conditions for {0}", [data.item_code || __("Row {0}", [data.idx])]),
                // size: 'large', // Consider making the dialog larger
                fields: get_bom_conditions_dialog_fields(frm, data), // Get fields from a helper function
                primary_action_label: __('Save Conditions'),
                primary_action: function(values) {
                    // --- Save Logic ---
                    const fields_to_update = get_bom_conditions_dialog_fields(frm, data).map(df => df.fieldname).filter(Boolean); // Get all fieldnames

                    fields_to_update.forEach(field => {
                        if (values.hasOwnProperty(field)) {
                            // Use frappe.model.set_value for child table updates
                            frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, values[field]);
                        }
                    });

                    // --- Auto Add/Update Leaf Items ---
                    // Logic to handle leaf A and B updates (extracted for clarity)
                    handle_leaf_item_updates(frm, grid_row.doc, values);

                    // Refresh the specific grid row visually
                    grid_row.refresh();
                    // Optionally refresh the entire grid field if structure changed (e.g., rows added)
                    frm.refresh_field("po_items");

                    dialog.hide();
                }
            });

            // --- Setup Dynamic Aspects of Dialog ---
            // Set MultiSelect options (example for app_country)
            setup_dialog_multiselect(dialog, "app_country", "Country", { "is_clestra": 1 }, "code");

            // Setup dynamic queries for Link fields within the dialog
            setup_dialog_link_queries(frm, dialog, data);

            dialog.show();
        });
    }
}

// Helper function to define fields for the BOM Conditions dialog
function get_bom_conditions_dialog_fields(frm, data) {
    // data is the current row data, frm is the main form
    return [
        // Use layout fields (Section Break, Column Break) for better organization
        { label: __("General"), fieldtype: "Heading"},
        { label: __("Applicable Country"), fieldname: "app_country", fieldtype: "MultiSelect", default: data.app_country},
        { label: __("Disassembled"), fieldname: "disassembled", fieldtype: "Check", default: data.disassembled },
        { fieldtype: "Column Break" },
        { fieldtype: "Column Break" },

        { fieldtype: "Section Break" },
        { label: __("Panel"), fieldtype: "Heading"},
        { label: __("Glass A (Outer)"), fieldname: "glass_a", fieldtype: "Link", default: data.glass_a, options: "Product Thickness"},
        { label: __("Glass B (Inner)"), fieldname: "glass_b", fieldtype: "Link", default: data.glass_b, options: "Product Thickness"},
        { label: __("Door HW Spec"), fieldname: "door_hw_spec_code", fieldtype: "Link", default: data.door_hw_spec_code, options: "Door Hardware Spec" },
        { label: __("Color"), fieldname: "color", fieldtype: "Link", default: data.color, options: "Product Color" },

        { label: __("Door Unit"), fieldtype: "Heading"},
        { label: __("Door Frame (Read Only)"), fieldname: "door_frame", fieldtype: "Link", default: data.door_frame, options: "Item", read_only: 1 },
        { label: __("Door Closer"), fieldname: "door_closer", fieldtype: "Link", default: data.door_closer, options: "Selection Library"},
        { label: __("Handle Direction"), fieldname: "handle_direct", fieldtype: "Link", default: data.handle_direct, options: "Selection Library"},
        { label: __("Door Options (Hardware)"), fieldname: "hw_options", fieldtype: "Link", default: data.hw_options, options: "Hardware Options" },
        { label: __("Show Qty in Brackets"), fieldname: "show_qty_bracket", fieldtype: "Check", default: data.show_qty_bracket },

        { fieldtype: "Column Break" },
        { label: __("Keeper"), fieldtype: "Heading"},
        { label: __("Keeper"), fieldname: "keeper", fieldtype: "Link", default: data.keeper, options: "Selection Library"},
        { label: __("Keeper Glass A"), fieldname: "keeper_glass_a", fieldtype: "Link", default: data.keeper_glass_a, options: "Product Thickness"},
        { label: __("Keeper Glass B"), fieldname: "keeper_glass_b", fieldtype: "Link", default: data.keeper_glass_b, options: "Product Thickness"},

        { fieldtype: "Column Break" },
        { label: __("Hinge"), fieldtype: "Heading"},
        { label: __("Hinge"), fieldname: "hinge", fieldtype: "Link", default: data.hinge, options: "Selection Library"},
        { label: __("Hinge Glass A"), fieldname: "hinge_glass_a", fieldtype: "Link", default: data.hinge_glass_a, options: "Product Thickness"},
        { label: __("Hinge Glass B"), fieldname: "hinge_glass_b", fieldtype: "Link", default: data.hinge_glass_b, options: "Product Thickness"},
        { label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Link", default: data.hinge_type, options: "Selection Library"}, // Corrected fieldname from default
        { label: __("Number of Hinge Holes"), fieldname: "hinge_num", fieldtype: "Link", default: data.hinge_num, options: "Selection Library"},


        { fieldtype: "Column Break" },
        { label: __("Leaf A"), fieldtype: "Heading"},
        // Depends on logic: Is leaf_item_code only relevant if door_frame is empty? Adjust depends_on if needed.
        { label: __("Leaf A Item"), fieldname: "leaf_item_code", fieldtype: "Link", default: data.leaf_item_code, options: "Item", /* depends_on: "eval:!doc.door_frame" */ },
        { label: __("Leaf A Active Status"), fieldname: "leaf_act_status", fieldtype: "Link", default: data.leaf_act_status, options: "Selection Library"},
        { label: __("Leaf A Thk."), fieldname: "leaf_thk", fieldtype: "Link", default: data.leaf_thk, options: "Product Thickness"},
        { label: __("Leaf A Color"), fieldname: "leaf_color", fieldtype: "Link", default: data.leaf_color, options: "Product Color" },
        { label: __("Leaf A Glass A"), fieldname: "leaf_glass_a", fieldtype: "Link", default: data.leaf_glass_a, options: "Product Thickness"},
        { label: __("Leaf A Glass B"), fieldname: "leaf_glass_b", fieldtype: "Link", default: data.leaf_glass_b, options: "Product Thickness"},
        { label: __("Leaf A Material"), fieldname: "leaf_material", fieldtype: "Link", default: data.leaf_material, options: "Selection Library"},
        { label: __("Is Pair Door"), fieldname: "is_pair_door", fieldtype: "Check", default: data.is_pair_door /* depends_on: "eval:!doc.door_frame" */ },
        { label: __("Equal Leaf Width"), fieldname: "equal_leaf_w", fieldtype: "Check", default: data.equal_leaf_w, depends_on: "eval:doc.is_pair_door == 1" },

        // Section Break for Leaf B, only shown if Is Pair Door is checked
        { fieldtype: "Column Break", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B"), fieldtype: "Heading"},
        { label: __("Leaf B Item"), fieldname: "leaf_b_item_code", fieldtype: "Link", default: data.leaf_b_item_code, options: "Item", depends_on: "eval:doc.is_pair_door == 1" }, // Renamed fieldname for clarity
        { label: __("Leaf B Active Status"), fieldname: "leaf_b_act_status", fieldtype: "Link", default: data.leaf_b_act_status, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Thk."), fieldname: "leaf_b_thk", fieldtype: "Link", default: data.leaf_b_thk, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Color"), fieldname: "leaf_b_color", fieldtype: "Link", default: data.leaf_b_color, options: "Product Color", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Glass A"), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Glass B"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Material"), fieldname: "leaf_b_material", fieldtype: "Link", default: data.leaf_b_material, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" }, // Renamed fieldname

        { fieldtype: "Column Break" },
        { label: __("Door Hardwares"), fieldtype: "Heading"},
        { label: __("Auto Drop Seal"), fieldname: "auto_drop_seal", fieldtype: "Link", default: data.auto_drop_seal, options: "Selection Library"},
        { label: __("Astragal"), fieldname: "astragal", fieldtype: "Link", default: data.astragal, options: "Selection Library"},
        { label: __("Flush Bolt"), fieldname: "flush_bolt", fieldtype: "Link", default: data.flush_bolt, options: "Selection Library"},
        { label: __("FGD Info"), fieldname: "fgd_info", fieldtype: "Link", default: data.fgd_info, options: "Selection Library"}, // Corrected default from tape
        { label: __("Tape & Seal Color"), fieldname: "tape_seal_color", fieldtype: "Link", default: data.tape_seal_color, options: "Selection Library"},
        { label: __("Fixing Screw Cap"), fieldname: "fix_screw_cap", fieldtype: "Link", default: data.fix_screw_cap, options: "Selection Library"},
    ];
}

// Helper function to set up MultiSelect options in the dialog
function setup_dialog_multiselect(dialog, fieldname, target_doctype, filters, target_field) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: target_doctype,
            filters: filters,
            fields: [target_field],
            limit_page_length: 0 // Get all options
        },
        callback: function(response) {
            if (response && response.message) {
                // Format for MultiSelectPill: {label: ..., value: ...}
                let options = response.message.map(d => ({ label: d[target_field], value: d[target_field] }));
                let field = dialog.get_field(fieldname); // Use dialog.get_field
                if (field) {
                    field.set_data(options); // Use set_data for MultiSelectPill
                }
            }
        }
    });
}

// Helper function to set up dynamic Link queries in the dialog
function setup_dialog_link_queries(frm, dialog, data) {
    // data is the current row data, frm is the main form
    const field_query_map = {
        // Panel & Door Options
        "glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "door_closer": { filters: { opt_name: ["in", ["Door Closer", "YesNo"]], is_active: 1 } },
        "handle_direct": { filters: { opt_name: "Handle Direction", is_active: 1 } },
        // Keeper & Hinge
        "keeper": { filters: { accy_opt: ["in", ["Hinge & Keeper", "Keeper"]], is_active: 1 } },
        "keeper_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "keeper_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge": { filters: { accy_opt: ["in", ["Hinge & Keeper", "Hinge"]], is_active: 1 } },
        "hinge_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_type": { filters: { accy_opt: "Hinge Type", is_active: 1 } },
        "hinge_num": { filters: { opt_name: "Number of Hinge Holes", is_active: 1 } },
        // Leaf A
        "leaf_act_status": { filters: { opt_name: "Leaf Active Status", is_active: 1 } },
        "leaf_thk": { filters: { type: "Leaf", is_active: 1 } },
        "leaf_glass_a": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_glass_b": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_material": { filters: { opt_name: "Leaf Material", is_active: 1 } },
        // Leaf B
        "leaf_b_act_status": { filters: { opt_name: "Leaf Active Status", is_active: 1 } },
        "leaf_b_thk": { filters: { type: "Leaf", is_active: 1 } },
        "leaf_b_glass_a": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_b_glass_b": { filters: { type: ["in", ["Leaf Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "leaf_b_material": { filters: { opt_name: "Leaf Material", is_active: 1 } },
        // Other Hardware
        "auto_drop_seal": { filters: { opt_name: "Auto Drop Seal", is_active: 1 } },
        "astragal": { filters: { opt_name: "Astragal", is_active: 1 } },
        "flush_bolt": { filters: { opt_name: "Flush Bolt", is_active: 1 } },
        "fgd_info": { filters: { opt_name: "FGD", is_active: 1 } },
        "tape_seal_color": { filters: { opt_name: "Tape & Seal Color", is_active: 1 } },
        "fix_screw_cap": { filters: { opt_name: "Fixing Screw Cap", is_active: 1 } },
    };

    dialog.fields.forEach(df => {
        if (df.fieldtype === "Link" && field_query_map[df.fieldname]) {
            dialog.get_field(df.fieldname).get_query = function() {
                // Add dynamic filters based on frm or data if needed here
                return field_query_map[df.fieldname];
            };
        }
    });
}

// Helper function to handle the logic for adding/updating Leaf A and Leaf B items
function handle_leaf_item_updates(frm, parent_row_doc, dialog_values) {
    const parent_context = {
        door_hw_spec_code: parent_row_doc.door_hw_spec_code,
        zone: parent_row_doc.zone,
        door_frame: parent_row_doc.item_code, // Link back to the parent door item
        planned_qty: parent_row_doc.planned_qty,
        handle_direct: parent_row_doc.handle_direct,
        ch: parent_row_doc.ch,
        ph: parent_row_doc.ph,
        width: parent_row_doc.width,
        parent_row_name: parent_row_doc.name, // Name of the row that opened the dialog
    };

    // Calculate leaf width based on parent width and equal width flag
    let leaf_width = parent_context.width; // Default to parent width
    if (dialog_values.is_pair_door && dialog_values.equal_leaf_w && parent_context.width > 136) {
        // Example calculation - adjust based on actual frame/gap size
        const frame_allowance = 10; // Example gap/frame width
        leaf_width = (parent_context.width - frame_allowance) / 2;
    }
    leaf_width = Math.max(leaf_width, 0); // Ensure non-negative


    // --- Leaf A ---
    if (dialog_values.leaf_item_code) {
        const leaf_a_values = {
            // Context from parent
            ...parent_context, // Spread parent context
            // Leaf A specific values from dialog
            item_code: dialog_values.leaf_item_code,
            leaf_act_status: dialog_values.leaf_act_status,
            leaf_thk: dialog_values.leaf_thk,
            leaf_color: dialog_values.leaf_color,
            leaf_glass_a: dialog_values.leaf_glass_a,
            leaf_glass_b: dialog_values.leaf_glass_b,
            leaf_material: dialog_values.leaf_material,
            // Common hardware from dialog
            auto_drop_seal: dialog_values.auto_drop_seal,
            astragal: dialog_values.astragal,
            flush_bolt: dialog_values.flush_bolt,
            fgd_info: dialog_values.fgd_info,
            tape_seal_color: dialog_values.tape_seal_color,
            fix_screw_cap: dialog_values.fix_screw_cap,
            // Specific attributes
            indent_level: (parent_row_doc.indent_level || 0) + 1, // Indent under parent
            width: leaf_width, // Calculated width
            is_leaf_item: 1, // Flag as a leaf item
            parent_door_item_ref: parent_context.parent_row_name // Link back to parent row name
        };
        // Add or update the item in the po_items table
        add_or_update_child_item(frm, 'po_items', parent_row_doc, 'leaf_a_row_ref', leaf_a_values); // 'leaf_a_row_ref' stores the name of the child row in the parent
    } else {
        // If leaf_item_code is cleared, potentially remove the existing Leaf A row? (Optional)
         remove_child_item(frm, 'po_items', parent_row_doc, 'leaf_a_row_ref');
    }

    // --- Leaf B ---
    if (dialog_values.is_pair_door && dialog_values.leaf_b_item_code) {
        const leaf_b_values = {
            // Context from parent
            ...parent_context, // Spread parent context
             // Leaf B specific values from dialog
            item_code: dialog_values.leaf_b_item_code,
            leaf_act_status: dialog_values.leaf_b_act_status,
            leaf_thk: dialog_values.leaf_b_thk,
            leaf_color: dialog_values.leaf_b_color,
            leaf_glass_a: dialog_values.leaf_b_glass_a,
            leaf_glass_b: dialog_values.leaf_b_glass_b,
            leaf_material: dialog_values.leaf_b_material,
            // Common hardware from dialog
            auto_drop_seal: dialog_values.auto_drop_seal,
            astragal: dialog_values.astragal,
            flush_bolt: dialog_values.flush_bolt,
            fgd_info: dialog_values.fgd_info,
            tape_seal_color: dialog_values.tape_seal_color,
            fix_screw_cap: dialog_values.fix_screw_cap,
            // Specific attributes
            indent_level: (parent_row_doc.indent_level || 0) + 1, // Indent under parent
            width: leaf_width, // Calculated width (same as A if equal, otherwise might need separate B width)
            is_leaf_item: 1, // Flag as a leaf item
            parent_door_item_ref: parent_context.parent_row_name // Link back to parent row name
        };
        add_or_update_child_item(frm, 'po_items', parent_row_doc, 'leaf_b_row_ref', leaf_b_values); // 'leaf_b_row_ref' stores the name of the child row in the parent
    } else {
         // If pair door is unchecked or leaf_b_item_code is cleared, remove Leaf B row
         remove_child_item(frm, 'po_items', parent_row_doc, 'leaf_b_row_ref');
    }
}


// Utility function to add or update a child item linked from a parent row
function add_or_update_child_item(frm, child_table_fieldname, parent_row_doc, parent_ref_fieldname, child_values) {
    const child_doctype = frappe.get_meta(frm.doctype).fields.find(df => df.fieldname === child_table_fieldname).options;
    let existing_child_row_name = parent_row_doc[parent_ref_fieldname];
    let child_row = null;

    // Try to find existing child row using the stored name
    if (existing_child_row_name) {
        child_row = frm.doc[child_table_fieldname]?.find(row => row.name === existing_child_row_name);
    }

    // If not found by stored name, try finding by unique combination (e.g., parent ref and item code) - Optional but robust
    if (!child_row) {
         child_row = frm.doc[child_table_fieldname]?.find(row =>
            row.parent_door_item_ref === child_values.parent_door_item_ref &&
            row.item_code === child_values.item_code &&
            row.is_leaf_item === 1 // Ensure it's a leaf added by this logic
        );
    }

    if (child_row) {
        // Update existing row
        console.log(`Updating existing child row: ${child_row.name}`);
        let changed = false;
        Object.keys(child_values).forEach(key => {
            if (child_row[key] !== child_values[key]) {
                 frappe.model.set_value(child_doctype, child_row.name, key, child_values[key]);
                 changed = true;
            }
        });
         // Store the name back in the parent ref field if it wasn't already set correctly
         if (parent_row_doc[parent_ref_fieldname] !== child_row.name) {
            frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, child_row.name);
        }

    } else {
        // Add new child row
        console.log(`Adding new child row for item: ${child_values.item_code}`);
        child_row = frappe.model.add_child(frm.doc, child_table_fieldname); // Add row to specified child table
        Object.keys(child_values).forEach(key => {
             // Use model.set_value to ensure triggers run if needed
             frappe.model.set_value(child_doctype, child_row.name, key, child_values[key]);
        });
        // Store the name of the new child row in the parent's reference field
        frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, child_row.name);
        console.log(`Added new row ${child_row.name}, linked via ${parent_ref_fieldname}`);
    }
}

// Utility function to remove a child item linked from a parent row
function remove_child_item(frm, child_table_fieldname, parent_row_doc, parent_ref_fieldname) {
    let child_row_name = parent_row_doc[parent_ref_fieldname];
    if (child_row_name) {
        let child_row_index = frm.doc[child_table_fieldname]?.findIndex(row => row.name === child_row_name);
        if (child_row_index !== -1 && child_row_index !== undefined) {
            console.log(`Removing child row: ${child_row_name}`);
            frappe.model.remove_from_locals(frappe.get_meta(frm.doctype).fields.find(df => df.fieldname === child_table_fieldname).options, child_row_name); // Remove from locals
            frm.doc[child_table_fieldname].splice(child_row_index, 1); // Remove from doc array
            // Clear the reference in the parent row
            frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, null);
            // frm.refresh_field(child_table_fieldname); // Refresh the grid field
        } else {
             // If row not found in doc (maybe already deleted?), just clear the reference
            frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, null);
        }
    }
}

frappe.ui.form.on('Project Billing Master Sub Item', {

    show_qty_bracket: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        const parent_grid_fieldname = row.parentfield;
        const target_grids = ["detail_bom_items", "door_cover", "panel_cover", "sub_items"];
        if (!parent_grid_fieldname || !target_grids.includes(parent_grid_fieldname)) return;

        const grid = frm.fields_dict[parent_grid_fieldname]?.grid;
        if (!grid || !grid.grid_rows) return;
        
        const grid_row = grid.grid_rows?.find(r => r.doc && r.doc.name === cdn);

        if (grid_row && grid_row.wrapper) {
            let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');
            if ($qty_cell.length > 0) {
                $qty_cell.toggleClass("qty-bracket", !!row.show_qty_bracket);
            }
        }
    },

    panel_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Panel");
    },

    door_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Door");
    },

    sub_items_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Sub Items");
        fetch_and_set_print_fields(frm, cdt, cdn);
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

    indent_level(frm, cdt, cdn) {
        frm.trigger("setup_toggle_sub_items");
        const grid = frm.fields_dict["detail_bom_items"].grid;

        if (grid) {
            const grid_row = grid.get_row(cdn);
            if(grid_row) {frm.trigger("setup_toggle_sub_items"); }
        }
    },
});


// Child Table Events
frappe.ui.form.on("Project Billing Master Item", {
    item_code(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.call({
                // Ensure this server-side method exists and returns the correct data
                method: "clestra_app.clestra_manufacturing.doctype.project_billing_master.project_billing_master.get_item_data",
                args: { item_code: row.item_code },
                callback: function (r) {
                    if (r.message) {
                        // Update relevant fields in the row
                        for (let key in r.message) {
                            // Check if the key exists as a field in the child doctype before setting
                            if (frappe.meta.has_field(cdt, key)) {
                                frappe.model.set_value(cdt, cdn, key, r.message[key]);
                            }
                        }
                    }
                },
            });
        } else {
             // Clear dependent fields if item_code is cleared
             const fields_to_clear = ["description", "item_name", "uom", /* other fields */];
             fields_to_clear.forEach(field => {
                 if (frappe.meta.has_field(cdt, field)) {
                    frappe.model.set_value(cdt, cdn, field, null);
                 }
             });
        }
    },
    // Add other child table triggers (qty, rate, etc.) if needed
});

// Child Table Events for Door Hardware Spec Child (if different from Project Billing Master Item)
frappe.ui.form.on('Door Hardware Spec Child', {
    hw_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.hw_code) {
            frappe.call({
                method: 'frappe.client.get_value', // Using standard get_value
                args: {
                    doctype: 'Door Hardware Spec', // Source Doctype
                    filters: { code: row.hw_code }, // Filter by the selected code
                    fieldname: [ // List all fields to fetch from Door Hardware Spec
                        "description", "by_gumi", "by_tc", "by_local", "open_type", "door_leaf_thk",
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
                        // Add any other fields needed from Door Hardware Spec
                    ]
                },
                callback: function(r) {
                    if (r.message) {
                        // Map fetched values to the corresponding fields in the child table row
                        Object.keys(r.message).forEach(field => {
                            // Check if the field exists in the 'Door Hardware Spec Child' Doctype
                            if (frappe.meta.has_field(cdt, field)) {
                                frappe.model.set_value(cdt, cdn, field, r.message[field]);
                            } else {
                                // Optional: Map to a differently named field if needed
                                // e.g., if (field === 'description') { frappe.model.set_value(cdt, cdn, 'hw_description', r.message[field]); }
                            }
                        });
                        // Refresh the parent field containing this child table
                        // Replace 'door_master' with the actual fieldname of the child table in the parent Doctype
                        // frm.refresh_field('door_master');
                    }
                }
            });
        } else {
            // Clear fields if hw_code is removed
             const fields_to_clear = [/* list fields from Door Hardware Spec Child to clear */];
             fields_to_clear.forEach(field => frappe.model.set_value(cdt, cdn, field, null));
            // frm.refresh_field('door_master');
        }
    }
});

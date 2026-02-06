// Copyright (c) 2024, Se Yong EOM and contributors
// erpnext/erpnext/manufacturing/doctype/project_billing_master/project_billing_master.js

frappe.ui.form.on('Project Billing Master', {
    onload: function (frm) {
        // Setup queries or initial settings that don't depend on grid structure yet
        frm.fields_dict["po_items"].grid.get_field("app_country").get_query = function (doc, cdt, cdn) {
            return { filters: { "is_clestra": 1 } };
        };

        if (frm.fields_dict['door_cover']?.grid) {
            // Note: 'hw_spec_code' query was here, but dialog uses 'door_hw_spec_code'. Ensure consistency.
            // Assuming you need a query for 'hwl_spec_code' on the grid itself
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function() {
                // Example: Add dynamic filters if needed based on parent form
                return {
                    filters: { /* Add relevant filters here if necessary */ }
                };
            };
             // Ensure get_query is set for any other Link fields in the door_cover grid
             // e.g., frm.fields_dict['door_cover'].grid.get_field('product_keyword').get_query = ...
        }

        // Setup Button Click Handlers (Ensure these functions exist elsewhere in your script)
        // These are called on refresh as well, which is generally safer to re-attach handlers.
        // setup_qty_field(frm); // Called on refresh
        // setup_size_field(frm); // Called on refresh
        // setup_bom_conditions_button(frm); // Called on refresh

        // Pagination wrapping logic (commented out by user, keep commented unless needed)
        // const setup_pagination_wrapper = () => { ... };
        // setTimeout(setup_pagination_wrapper, 500);
    },

    refresh: function(frm) {
        const child_table_fieldnames_to_reset = ['door_cover', 'sub_items', 'panel_cover', 'detail_bom_items'];
        child_table_fieldnames_to_reset.forEach(fieldname => {
            const grid = frm.fields_dict[fieldname]?.grid;
            selected_columns_for_grid = [];
            let value = {};
            value[grid.doctype] = selected_columns_for_grid;
            frappe.model.user_settings.save(frm.doctype, "GridView", value).then((r) => {
                frappe.model.user_settings[frm.doctype] = r.message || r;
                grid.reset_grid();
            });
        });

        console.log("Project Billing Master Refresh Triggered");

        // var grid = frm.fields_dict['door_cover'].grid;
        // console.log("In refresh - grid.df.fields (before frm.refresh_field):", JSON.parse(JSON.stringify(grid.meta.fields)));
        // frm.refresh_field('door_cover');

        // --- Define Desired Columns for Each Grid ---
        // These are the fieldnames from the child Doctype (e.g., 'Project Billing Master Sub Item')
        // Define columns including those you *always* want to see, even if Frappe's default doesn't include them.
        const detail_bom_items_cols = ["item_code", "item_name", "size", "qty", "color", "remark", "zone"]; // Include zone here if it's a standard field in the child doctype
        const panel_cover_cols = ["product_keyword", "size", "color", "remark", "qty"]; // Include zone if it's a standard field and needed
        const door_cover_cols = ["door_hw_spec_code", "product_keyword", "size", "remark", "qty"]; // Include zone if it's a standard field and needed
        const sub_items_cols = ["print_group", "print_order", "item_name", "size", "color", "remark", "qty"]; // Include zone if it's a standard field and needed

        // Apply custom column setup for each grid
        // This function will now call Frappe's default setup and merge/add our desired columns.
        set_custom_grid_columns(frm, 'detail_bom_items', detail_bom_items_cols);
        set_custom_grid_columns(frm, 'panel_cover', panel_cover_cols);
        set_custom_grid_columns(frm, 'door_cover', door_cover_cols);
        set_custom_grid_columns(frm, 'sub_items', sub_items_cols);

        // --- Existing Refresh Logic ---

        

        // Setup toggles (call after grids are expected to be reset/refreshed)
        // Using a timeout here aligns with the grid reset timeout
        setTimeout(() => {
            // Disable pagination for detail_bom_items grid if needed
            const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
            if (detail_bom_items_grid?.grid_pagination && detail_bom_items_grid.grid_pagination.page_length !== 99999) {
                console.log("Disabling pagination for detail_bom_items_grid.");
                detail_bom_items_grid.grid_pagination.page_length = 99999;

            }

            frm.trigger("setup_toggle_sub_items");
            frm.trigger("update_grid_qty_view");
        
            // Add initial row to po_items table if empty (ensure permissions check)
            if (!frm.doc.po_items || frm.doc.po_items.length === 0) {
                if (frappe.perm.has_perm(frm.doctype, 0, "write")) { // Check write permission for parent doctype
                    frm.add_child('po_items');
                    frm.refresh_field('po_items'); // Refresh the field to show the added row
                }
            }

            // Ensure button handlers are setup. Calling on refresh is fine as .off() removes previous listeners.
            setup_qty_field(frm); // Ensure this function exists and handles the qty click logic
            setup_size_field(frm); // Ensure this function exists and handles the size click logic
            setup_bom_conditions_button(frm); // Ensure this function exists and handles the bom_conditions click logic

        }, 100); // Small delay after grid resets are potentially queued


        // Re-attach dynamic query for door_cover grid (ensure fieldname is correct 'hw_spec_code' vs 'door_hw_spec_code')
        if (frm.fields_dict['door_cover']?.grid) {
            // Assuming the Link field on the grid is 'hw_spec_code' as in this block
            // If the field is 'door_hw_spec_code', adjust the fieldname below
            frm.fields_dict['door_cover'].grid.get_field('hw_spec_code').get_query = function() {
                return { filters: {} }; // Re-apply query logic as needed
            };
            // Also ensure queries for other Link fields in door_cover are set up if necessary
        }
        console.log("Project Billing Master Refresh Completed");
    },

    // --- Event handlers triggered by frm.trigger(...) ---

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
        // Add other form-level dynamic queries here if needed
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

    update_grid_qty_view(frm) {
        // This function updates the DOM based on show_qty_bracket
        // It should be called after the grid has rendered/refreshed and data is available.
        const grid_fieldnames_with_qty_styling = ['sub_items', 'detail_bom_items']; // Add other fieldnames here if needed
        grid_fieldnames_with_qty_styling.forEach(fieldname => {
            const grid = frm.fields_dict[fieldname]?.grid;
            if (!grid || !grid.grid_rows) {
                // console.log(`${fieldname} grid or rows not ready for update_grid_qty_view`);
                return;
            }
            // console.log(`Updating qty view for ${grid.grid_rows.length} rows in ${fieldname}.`);

            grid.grid_rows.forEach(function (grid_row) {
                let item = grid_row.doc;
                
                if (!item || !grid_row.wrapper) {
                    // console.warn("Skipping row update: item data or row wrapper missing.", grid_row);
                    return;
                }

                const qty_val = flt(item.qty, grid.df.precision || 0);
                const qty_prefix = item.qty_prefix ? `${item.qty_prefix}` : "";
                const qty_suffix = item.qty_suffix ? `${item.qty_suffix}` : "";

                let $qty_cell = $(grid_row.wrapper).find('[data-fieldname="qty"]');

                if ($qty_cell.length > 0) {
                    // Use toggleClass to add/remove based on show_qty_bracket
                    let $qty_cell_static = $qty_cell.find('.static-area');
                    $qty_cell_static.text(`${qty_prefix}${qty_val}${qty_suffix}`); // Update text with prefix/suffix
                    $qty_cell.toggleClass("qty-bracket", !!item.show_qty_bracket);
                    // console.log(`Row ${item.name}: toggled qty-bracket based on show_qty_bracket=${!!item.show_qty_bracket}`);
                }
            });
        });

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
                console.log(`Initial/Updated Qty text set for grid: ${fieldname}`);
            }
        });
    },

    // --- Other Form-level event handlers ---

    get_sub_assembly_items(frm) {
         // ... (Keep existing get_sub_assembly_items function logic here) ...
        if (frm._getting_sub_assembly_items) return;
        frm._getting_sub_assembly_items = true;
        frm.dirty();

        frappe.call({
            method: "get_sub_assembly_items",
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                console.log("get_sub_assembly_items callback started");
                // Assuming the backend updates frm.doc.detail_bom_items directly.
                setTimeout(() => {
                    refresh_field("detail_bom_items"); // Refresh the field to show new data

                    const detail_bom_items_grid = frm.fields_dict['detail_bom_items']?.grid;
                    if (detail_bom_items_grid?.grid_pagination) {
                        // Re-disable pagination if needed (refresh_field might reset it)
                        if (detail_bom_items_grid.grid_pagination.page_length !== 99999) {
                            console.log("Disabling pagination in get_sub_assembly_items callback.");
                            detail_bom_items_grid.grid_pagination.page_length = 99999;
                            // No explicit grid.refresh() here, refresh_field handles it,
                            // and the main refresh handler will re-apply column customs.
                        }
                    } else {
                        console.warn("Summary grid or grid.df not found in get_sub_assembly_items callback.");
                    }
                    // Trigger UI updates after data is loaded and fields refreshed
                    // These triggers will be picked up by the main refresh handler's setTimeout
                    
                    frm.trigger("update_grid_qty_view");
                    frm.trigger("setup_toggle_sub_items");
                }, 100);

            },
            always: function () {
                frm._getting_sub_assembly_items = false;
            },
        });
    },

    generate_billing: function(frm) {
        frm.dirty();
        frappe.call({
            method: "generate_billing",
            freeze: true,
            doc: frm.doc,
            callback: function (r) {
                // frappe.hide_progress();
                const panel_cover_cols = ["product_keyword", "size", "color", "remark", "qty"];
                const door_cover_cols = ["door_hw_spec_code", "product_keyword", "size", "remark", "qty"];
                const sub_items_cols = ["print_group", "print_order", "item_name", "size", "color", "remark", "qty"];

                console.log("generate_billing callback started");
                set_custom_grid_columns(frm, 'panel_cover', panel_cover_cols);
                set_custom_grid_columns(frm, 'door_cover', door_cover_cols);
                set_custom_grid_columns(frm, 'sub_items', sub_items_cols);

                // Backend should update relevant fields like panel_cover, door_cover, sub_items
                // Refresh the fields to show the generated data
                
                // refresh_field("panel_cover");
                // refresh_field("door_cover");
                // refresh_field("sub_items");

                setTimeout(() => {
                    frm.trigger("update_grid_qty_view");
                    frm.trigger("setup_toggle_sub_items");

                    setup_qty_field(frm);
                    setup_size_field(frm);
                }, 150);
            },
            error: function(r) {
                console.error("Error during generate_billing:", r);
                frappe.msgprint(__("Error generating billing data."));
            }
        });
    },
});


// --- Helper/Utility Functions (Should be outside frappe.ui.form.on block) ---
function set_custom_grid_columns(frm, fieldname, default_columns) {
    
    
    default_columns = Array.isArray(default_columns) ? default_columns : [];

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid || !grid.doctype) {
        console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Grid or grid.doctype not found.`);
        return;
    }

    const child_doctype_name = grid.doctype;
    const child_meta = frappe.get_meta(child_doctype_name); // Get global meta for the child doctype

    if (!child_meta || !child_meta.fields) {
        console.error(`[CUSTOM GRID VIRTUAL][${fieldname}] Meta information or fields not found for child doctype: ${child_doctype_name}.`);
        return;
    }
    console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Child Doctype: ${child_doctype_name}`);

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
                    console.warn(`[V_FIELD_OBJ][${fieldname}] Error parsing zone_qty for row ${row_doc.name}:`, e);
                }
            }
        });
    }
    all_unique_zone_names.sort(); // Consistent order for mapping
    console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] All unique active zone keys (qty > 0):`, all_unique_zone_names);

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
                console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Pre-defined virtual field "${vf_name}" not found in meta for ${child_doctype_name}. Cannot map zone key "${original_zone_key}".`);
            }
        } else {
            console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] More active zone keys (${all_unique_zone_names.length}) than available virtual fields (${MAX_VIRTUAL_FIELDS}). Some zones will not be displayed.`);
            break;
        }
    }
    console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Virtual fields mapping:`, virtual_fields_mapping);

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
            for (let i = 0; i <= MAX_VIRTUAL_FIELDS; i++) {
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
                    console.warn(`[V_FIELD_OBJ][${fieldname}] Error parsing/processing zone_qty for row ${row_doc.name} for data assignment:`, e);
                }
            }
        });

    }

    // --- 4. Modify grid.meta for labels and in_list_view status (for Configure Columns and grid internals) ---
    // This should be done *before* setup_visible_columns override if grid.meta is the source of truth for Configure Columns.
    if (grid.meta && grid.meta.fields) {
        console.log(`[V_FIELD_GRID][${fieldname}] Modifying grid.meta.fields for labels and visibility.`);
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
        console.warn(`[V_FIELD_GRID][${fieldname}] grid.meta or grid.meta.fields not available. Label changes via grid.meta might not work for Configure Columns.`);
    }

    // Store original setup_visible_columns if not already stored
    const original_setup_key = `_original_setup_visible_columns_${fieldname}`;
    if (!grid[original_setup_key] && typeof grid.setup_visible_columns === 'function') {
        grid[original_setup_key] = grid.setup_visible_columns;
    }


    // --- 5. Override grid.setup_visible_columns ---
    grid.setup_visible_columns = function() {
        this.visible_columns = [];
        this.visible_column_names = []; // Will be populated based on final_fieldnames_to_display

        const meta_to_use_in_override = this.meta || child_meta;
        if (!meta_to_use_in_override || !meta_to_use_in_override.fields) {
            console.error(`[V_FIELD_GRID][${fieldname}] Meta not available in override. Aborting.`);
            return;
        }

        // Define column sizes
        const fixed_width_fields = ["item_code", "item_name", "product_type", "product_keyword", "door_hw_spec_code", "size", "zone", "qty", "print_group", "print_order"];
        const grid_specific_col_widths = {
            "detail_bom_items": {"item_code":2, "item_name":2, "size":2, "qty":1, "color":1, "remark":1, "zone":1},
            "panel_cover": {"item_name":2, "size":2, "qty":1, "color":2, "remark":2, "product_keyword":2},
            "door_cover": {"door_hw_spec_code":2, "product_keyword":2, "size":2, "qty":2, "remark":1},
            "sub_items": {"print_group":1, "print_order":1, "item_name":2, "size":2, "qty":1, "color":1, "remark":1},
        };
        const DEFAULT_COL_SIZE = 1; // Default Bootstrap col size for virtual fields
        const MAX_BOOTSTRAP_COLS = 12; // Bootstrap 기준 컬럼 수

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
                console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Field '${fname_to_show}' (intended for display) not found in child meta during override. Skipping.`);
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
        let data_row_max_width_px = 1300; // 기본 max-width (colsize 합 12개 이하일 때)
        const pixels_per_extra_col_unit = 80; // colsize 단위 1개가 늘어날 때마다 추가할 너비 (조정 가능)
        const pixels_per_extra_column_count = 100; // 또는 컬럼 개수당 추가할 너비

        if (total_col_size > MAX_BOOTSTRAP_COLS) {
            const extra_col_units = total_col_size - MAX_BOOTSTRAP_COLS;
            data_row_max_width_px += extra_col_units * pixels_per_extra_col_unit;
            console.log(`[V_FIELD_GRID][${fieldname}] Colsize units (${total_col_size}) > ${MAX_BOOTSTRAP_COLS}. New max-width: ${data_row_max_width_px}px`);
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
            console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] No reset_grid or refresh method on grid.`);
        }

        // // --- 7. DOM Manipulation for Header Labels (after grid reset/refresh) ---
        console.log(`[CUSTOM GRID VIRTUAL][${fieldname}] Attempting DOM manipulation for header labels.`);
        frm.refresh_field(fieldname);

        const target_tables_for_width_adjustment = ["door_cover", "panel_cover", "sub_items"];
        if (target_tables_for_width_adjustment.includes(fieldname)) {
            setTimeout(() => {
                const grid_wrapper_for_dom = current_grid_instance_for_refresh.wrapper;
                if (!grid_wrapper_for_dom) {
                    console.error(`[CUSTOM GRID VIRTUAL][${fieldname}] DOM: Grid wrapper not found. Cannot set header labels.`);
                    return;
                }

                // --- ★★★ .data-row에 동적 max-width 적용 ★★★ ---
                const calculated_width = grid._calculated_data_row_max_width; // grid 객체에서 가져옴
                if (calculated_width) {
                    const $dataRows = $(grid_wrapper_for_dom).find(`.form-grid`);
                    console.log(`[V_FIELD_GRID][${fieldname}] DOM: Found ${$dataRows.length} .data-row elements.`);
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
                        console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] DOM: Header cell for "${vf_map.virtual_fieldname}" not found. Label not set via DOM.`);
                    }
                });
            }, 300);
        }

    } else {
        console.warn(`[CUSTOM GRID VIRTUAL][${fieldname}] Grid instance changed before refresh was called. DOM manipulation might fail.`);
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
                if  (parsed_zone_qty[zone_key].handle_details && typeof parsed_zone_qty[zone_key].handle_details === 'object') {
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

        // // unassigned_handle_qty를 handle_direct에 따라 분배
        // if (unassigned_handle_qty > 0 && handle_direct) {
        //     has_any_handle_data = true;
        //     if (handle_direct === 'LH') total_lh += unassigned_handle_qty;
        //     else if (handle_direct === 'RH') total_rh += unassigned_handle_qty;
        //     else if (handle_direct === 'LH-R') total_lhr += unassigned_handle_qty;
        //     else if (handle_direct === 'RH-R') total_rhr += unassigned_handle_qty;
        //     // 'Pair' 등의 경우는 이 로직에서 명시적으로 처리하지 않음, 필요시 추가
        // }

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
        const pw = get_val("pw");
        const ph = get_val("ph");
        if (w > 0) size_parts.push(`W:${w}`);
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
            callback: function(r) {
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

// function get_all_unique_zone_names_for_row(row_doc) {
//     let unique_zone_keys = [];
//     if (row_doc && row_doc.zone_qty && typeof row_doc.zone_qty === 'string') {
//         try {
//             const zones_data = JSON.parse(row_doc.zone_qty);
//             Object.keys(zones_data).forEach(key => {
//                 if (key && !unique_zone_keys.includes(key)) {
//                     unique_zone_keys.push(key);
//                 }
//             });
//         } catch (e) { console.warn("Error parsing zone_qty in get_all_unique_zone_names_for_row:", e); }
//     }
//     unique_zone_keys.sort();
//     return unique_zone_keys;
// }


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
            console.error("Dialog: Error parsing existing zone_qty for table:", e, row.zone_qty);
        }
    }

    // --- Define Dialog Fields ---
    // Start with common fields or a section
    let dialog_fields = [
        { fieldname: "zone_qty_table", label: __("Zone & Quantities"), fieldtype: "Table", data: table_data_for_dialog, fields: [
            { label: "Zone", fieldname: "zone_name", fieldtype: "Data", default: row.zone, in_list_view: 1, reqd: 1 },
            { label: "Handle Direct", fieldname: "handle_direct", fieldtype: "Link", options: "Selection Library", default: is_door_cover_grid ? row.handle_direct : null, in_list_view: 1,
                filters: { opt_name: "Handle Direction", is_active: 1 }},
            { label: "Quantity", fieldname: "qty", fieldtype: "Int", default: 0, in_list_view: 1, reqd: 1 }
        ]},
    ];

    // --- Create and Show Dialog ---
    let dialog = new frappe.ui.Dialog({
        title: __("Edit Handle Quantity for {0}", [row.item_name || row.item_code]),
        fields: dialog_fields,
        primary_action_label: __('Update'),
        primary_action: function(values) {
            // let updated_qty_data = {};
            const updated_table_rows = values.zone_qty_table || [];
            let new_zone_qty_json_obj = {};
            let calcualted_overall_qty = 0;
            // let current_vf_map_for_dialog = row._virtual_field_maps || [];
            // let dialog_unique_zone = [...new Set(updated_table_rows.map(row => row.zone).filter(Boolean))].sort();;

            // if (current_vf_map_for_dialog.length == 0 && dialog_unique_zone.length > 0) {
            //     console.warn("Dialog: row._virtual_field_maps not found. Creating temporary mapping from dialog zones.");
            //     current_vf_map_for_dialog = [];
            //     const MAX_VF = 20;
            //     for (let i = 0; i < dialog_unique_zone_names.length; i++) {
            //         if (i < MAX_VF) {
            //             current_vf_map_for_dialog.push({
            //                 virtual_fieldname: `zone_${i + 1}`,
            //                 original_zone_key: dialog_unique_zone_names[i],
            //                 display_label: frappe.model.unscrub(dialog_unique_zone_names[i])
            //             });
            //         } else break;
            //     }
            // }

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
            //         if (map_entry) {
            //             mapped_vf_name = map_entry.virtual_fieldname;
            //         } else {
            //             let next_vf_index = current_vf_map_for_dialog.length + 1;
            //             if (current_vf_map_for_dialog.filter(m => m.original_zone_key === actual_zone).length === 0 && next_vf_index <= 20) {
            //                 mapped_vf_name = `zone_${next_vf_index}`;
            //                 current_vf_map_for_dialog.push({
            //                     virtual_fieldname: mapped_vf_name,
            //                     original_zone_key: actual_zone,
            //                     display_label: ''
            //                 });
            //             } else {
            //                 console.warn(`Dialog: Zone "${actual_zone_name}" from table could not be mapped to a new virtual field.`);
            //             }
            //         }
            //         if (mapped_vf_name) {
            //             let zone_obj_entry = {
            //                 field: mapped_vf_name,
            //                 qty: qty,
            //             };
            //             if (is_door_cover_grid && handle_direct) {
            //                 zone_obj_entry.handle_direct = handle_direct;
            //             }
            //             new_zone_qty_json_obj[actual_zone] = zone_obj_entry;
            //         } calcualted_overall_qty += qty;
            //     }
            // });

            const new_json_string = JSON.stringify(new_zone_qty_json_obj);
            if (row.zone_qty !== new_json_string) {
                frappe.model.set_value(cdt, cdn, 'zone_qty', new_json_string);
            }
            if (cint(row.qty) !== calcualted_overall_qty) {
                frappe.model.set_value(cdt, cdn, 'qty', calcualted_overall_qty);
            }

            setTimeout(() => {
                const door_cover_cols = ["door_hw_spec_code", "product_keyword", "size", "remark", "qty"]; // Include zone if it's a standard field and needed
                set_custom_grid_columns(frm, 'door_cover', door_cover_cols);
                
                frm.trigger("update_grid_qty_view");

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
            grid.wrapper.on('click', '.grid-row .col[data-fieldname="qty"]', function(e) {
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
                console.log(`Initial Qty text set for grid: ${fieldname}`);
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

// Keep setup_bom_conditions_button function as is (ensure it's called by refresh)
function setup_bom_conditions_button(frm) {
    const grid = frm.fields_dict['po_items']?.grid;
    if (grid && grid.wrapper) {
        grid.wrapper.off('click', '.grid-row .btn[data-fieldname="bom_conditions"]'); // Remove previous
        grid.wrapper.on('click', '.grid-row .btn[data-fieldname="bom_conditions"]', function(e) {
            e.preventDefault();
            e.stopPropagation();

            let row_name = $(this).closest('.grid-row').attr('data-name');
            let grid_row = grid.get_row(row_name);

            if (!grid_row || !grid_row.doc) {
                frappe.msgprint(__('Unable to locate the selected row data.'));
                return;
            }
            let data = grid_row.doc;

            let dialog = new frappe.ui.Dialog({
                title: __("BOM Conditions for {0}", [data.item_code || __("Row {0}", [data.idx])]),
                fields: get_bom_conditions_dialog_fields(frm, data),
                primary_action_label: __('Save Conditions'),
                primary_action: function(values) {
                    const fields_to_update = get_bom_conditions_dialog_fields(frm, data).map(df => df.fieldname).filter(Boolean);

                    fields_to_update.forEach(field => {
                        if (values.hasOwnProperty(field)) {
                            frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, values[field]);
                        }
                    });

                    // Handle leaf item updates based on dialog values
                    handle_leaf_item_updates(frm, grid_row.doc, values);

                    // Refresh the grid row visually
                    grid_row.refresh();
                     // Refresh the entire grid field to show added/removed children
                    frm.refresh_field("po_items");

                    dialog.hide();
                }
            });

            // Setup dynamic MultiSelect and Link queries in the dialog
            setup_dialog_multiselect(dialog, "app_country", "Country", { "is_clestra": 1 }, "code");
            setup_dialog_multiselect(dialog, "hw_options", "Hardware Options", null, "name1");
            setup_dialog_link_queries(frm, dialog, data);

            dialog.show();
        });
    }
}

// Keep get_bom_conditions_dialog_fields function as is
function get_bom_conditions_dialog_fields(frm, data) {
     // ... (function body remains the same) ...
    return [
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
        { label: __("Door Options"), fieldname: "hw_options", fieldtype: "MultiSelect", default: data.hw_options},
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
        { label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Link", default: data.hinge_type, options: "Selection Library"},
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
        { label: __("Leaf B Item"), fieldname: "leaf_b_item_code", fieldtype: "Link", default: data.leaf_b_item_code, options: "Item", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Active Status"), fieldname: "leaf_b_act_status", fieldtype: "Link", default: data.leaf_b_act_status, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Thk."), fieldname: "leaf_b_thk", fieldtype: "Link", default: data.leaf_b_thk, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Color"), fieldname: "leaf_b_color", fieldtype: "Link", default: data.leaf_b_color, options: "Product Color", depends_on: "eval:doc.is_pair_door == 1" },
        { label: __("Leaf B Glass A"), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Glass B"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness", depends_on: "eval:doc.is_pair_door == 1"},
        { label: __("Leaf B Material"), fieldname: "leaf_b_material", fieldtype: "Link", default: data.leaf_b_material, options: "Selection Library", depends_on: "eval:doc.is_pair_door == 1" },

        { fieldtype: "Column Break" },
        { label: __("Door Hardwares"), fieldtype: "Heading"},
        { label: __("Auto Drop Seal"), fieldname: "auto_drop_seal", fieldtype: "Link", default: data.auto_drop_seal, options: "Selection Library"},
        { label: __("Astragal"), fieldname: "astragal", fieldtype: "Link", default: data.astragal, options: "Selection Library"},
        { label: __("Flush Bolt"), fieldname: "flush_bolt", fieldtype: "Link", default: data.flush_bolt, options: "Selection Library"},
        { label: __("FGD Info"), fieldname: "fgd_info", fieldtype: "Link", default: data.fgd_info, options: "Selection Library"},
        { label: __("Tape & Seal Color"), fieldname: "tape_seal_color", fieldtype: "Link", default: data.tape_seal_color, options: "Selection Library"},
        { label: __("Fixing Screw Cap"), fieldname: "fix_screw_cap", fieldtype: "Link", default: data.fix_screw_cap, options: "Selection Library"},
    ];
}

// Keep setup_dialog_multiselect function as is
function setup_dialog_multiselect(dialog, fieldname, target_doctype, filters=null, target_field) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: target_doctype,
            filters: filters,
            fields: [target_field],
            limit_page_length: 0
        },
        callback: function(response) {
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


// Keep setup_dialog_link_queries function as is
function setup_dialog_link_queries(frm, dialog, data) {
    const field_query_map = {
        "glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "door_closer": { filters: { opt_name: ["in", ["Door Closer", "YesNo"]], is_active: 1 } },
        "handle_direct": { filters: { opt_name: "Handle Direction", is_active: 1 } },
        "keeper": { filters: { accy_opt: ["in", ["Hinge & Keeper", "Keeper"]], is_active: 1 } },
        "keeper_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "keeper_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge": { filters: { accy_opt: ["in", ["Hinge & Keeper", "Hinge"]], is_active: 1 } },
        "hinge_glass_a": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_glass_b": { filters: { type: ["in", ["Panel Glass", "Panel & Leaf Glass"]], is_active: 1 } },
        "hinge_type": { filters: { accy_opt: "Hinge Type", is_active: 1 } },
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
        "astragal": { filters: { opt_name: "Astragal", is_active: 1 } },
        "flush_bolt": { filters: { opt_name: "Flush Bolt", is_active: 1 } },
        "fgd_info": { filters: { opt_name: "FGD", is_active: 1 } },
        "tape_seal_color": { filters: { opt_name: "Tape & Seal Color", is_active: 1 } },
        "fix_screw_cap": { filters: { opt_name: "Fixing Screw Cap", is_active: 1 } },
        // Add queries for Item Link fields if they are in the dialog fields list
        "leaf_item_code": { filters: { /* Add filters for leaf items if needed */ } },
        "leaf_b_item_code": { filters: { /* Add filters for leaf B items if needed */ } },
    };

    dialog.fields.forEach(df => {
        if (df.fieldtype === "Link" && field_query_map[df.fieldname]) {
            // Set the get_query method for the dialog field
            dialog.get_field(df.fieldname).get_query = function() {
                // You can add dynamic filters here if needed, based on the form or dialog values
                // Example: let current_dialog_values = this.dialog.get_values();
                return field_query_map[df.fieldname];
            };
        }
    });
}


// Keep handle_leaf_item_updates function as is
function handle_leaf_item_updates(frm, parent_row_doc, dialog_values) {
     // ... (function body remains the same) ...
     // Note: This function adds/removes rows in 'po_items'.
     // The 'po_items' table might not be the one where the dialog was opened (e.g., dialog for door_cover opens for a row in po_items)
     // Ensure 'po_items' is the correct child table fieldname where Leaf A/B should be added.
    const child_table_fieldname_for_leaves = 'po_items'; // Confirm this is the correct fieldname

    const parent_context = {
        door_hw_spec_code: parent_row_doc.door_hw_spec_code,
        zone: parent_row_doc.zone,
        door_frame: parent_row_doc.item_code, // Link back to the parent door item
        planned_qty: parent_row_doc.planned_qty, // Assuming this exists and is needed
        handle_direct: parent_row_doc.handle_direct, // Assuming this exists and is needed
        ch: parent_row_doc.ch, // Assuming this exists and is needed
        ph: parent_row_doc.ph, // Assuming this exists and is needed
        width: parent_row_doc.width, // Assuming this exists and is needed
        parent_row_name: parent_row_doc.name, // Name of the row that opened the dialog (in its original grid)
        parentfield: child_table_fieldname_for_leaves // Ensure the new rows point to the correct parentfield
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
            color: dialog_values.leaf_color,
            ceiling_visible: dialog_values.ceiling_visible,
            under_cut: dialog_values.under_cut,
            // Common hardware from dialog
            auto_drop_seal: dialog_values.auto_drop_seal, astragal: dialog_values.astragal,
            flush_bolt: dialog_values.flush_bolt, fgd_info: dialog_values.fgd_info,
            tape_seal_color: dialog_values.tape_seal_color, fix_screw_cap: dialog_values.fix_screw_cap,
            // Specific attributes for the child row
            indent_level: cint(parent_row_doc.indent_level || 0) + 1, // Increase indent level
            width: leaf_width,
            is_leaf_item: 1, // Custom flag to identify Leaf items added this way
            parent_door_item_ref: parent_context.parent_row_name // Link back to parent row name in the original grid (e.g. po_items)
        };
        // Add or update the item in the target child table (e.g., 'po_items')
        add_or_update_child_item(frm, child_table_fieldname_for_leaves, parent_row_doc, 'leaf_a_row_ref', leaf_a_values); // 'leaf_a_row_ref' is a field on the parent_row_doc
    } else {
        // If leaf_item_code is cleared in dialog, remove the existing Leaf A row
         remove_child_item(frm, child_table_fieldname_for_leaves, parent_row_doc, 'leaf_a_row_ref');
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
            color: dialog_values.leaf_b_color,
            ceiling_visible: dialog_values.ceiling_visible,
            under_cut: dialog_values.under_cut,
            // Common hardware from dialog
            auto_drop_seal: dialog_values.auto_drop_seal, astragal: dialog_values.astragal,
            flush_bolt: dialog_values.flush_bolt, fgd_info: dialog_values.fgd_info,
            tape_seal_color: dialog_values.tape_seal_color, fix_screw_cap: dialog_values.fix_screw_cap,
            // Specific attributes
            indent_level: cint(parent_row_doc.indent_level || 0) + 1, // Increase indent level
            width: leaf_width, // Using same calculated width as Leaf A
            is_leaf_item: 1, // Flag as a leaf item
            parent_door_item_ref: parent_context.parent_row_name // Link back to parent row name
        };
        add_or_update_child_item(frm, child_table_fieldname_for_leaves, parent_row_doc, 'leaf_b_row_ref', leaf_b_values); // 'leaf_b_row_ref' is a field on the parent_row_doc
    } else {
         // If pair door is unchecked or leaf_b_item_code is cleared, remove Leaf B row
         remove_child_item(frm, child_table_fieldname_for_leaves, parent_row_doc, 'leaf_b_row_ref');
    }
}


// Keep add_or_update_child_item function as is (ensure it uses correct child_table_fieldname)
function add_or_update_child_item(frm, child_table_fieldname, parent_row_doc, parent_ref_fieldname, child_values) {
    const child_doctype_name = frappe.get_meta(frm.doctype).fields.find(df => df.fieldname === child_table_fieldname)?.options;
    if (!child_doctype_name) {
         console.error(`add_or_update_child_item: Could not determine child doctype name for fieldname: ${child_table_fieldname}`);
         return;
    }

    let existing_child_row_name = parent_row_doc[parent_ref_fieldname];
    let child_row = null;

    // 1. Try to find existing child row using the stored name in the parent reference field
    if (existing_child_row_name) {
        child_row = frm.doc[child_table_fieldname]?.find(row => row.name === existing_child_row_name);
    }

    // 2. If not found by stored name (or stored name was null/invalid), try finding by unique combination
    // This is a fallback in case the parent reference was not saved correctly or data is old.
    // Adjust the find condition based on what makes a Leaf item unique under a parent Door item.
    if (!child_row && child_values.parent_door_item_ref && child_values.item_code && child_values.is_leaf_item === 1) {
         child_row = frm.doc[child_table_fieldname]?.find(row =>
             row.parent_door_item_ref === child_values.parent_door_item_ref &&
             row.item_code === child_values.item_code &&
             row.is_leaf_item === 1 // Confirm it's a leaf item added by this logic
             // You might need more conditions here if item_code isn't sufficient to distinguish Leaf A from Leaf B if item_code is the same
             // e.g., add a field like 'leaf_type: "A"' or 'leaf_type: "B"' to child_values
         );
         if (child_row) {
              console.warn(`add_or_update_child_item: Found child row by fallback search ${child_row.name}. Updating parent ref field.`);
             // If found by fallback, ensure the parent reference field is updated for next time
             frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, child_row.name);
         }
    }


    if (child_row) {
        // Update existing row
        console.log(`add_or_update_child_item: Updating existing child row: ${child_row.name}`);
        let changed = false;
        Object.keys(child_values).forEach(key => {
            // Check if the field exists in the child doctype before setting
            if (frappe.meta.has_field(child_doctype_name, key)) {
                // Compare current value with new value to avoid unnecessary model updates
                if (child_row[key] !== child_values[key]) {
                     frappe.model.set_value(child_doctype_name, child_row.name, key, child_values[key]);
                     changed = true;
                }
            } else {
                 // console.warn(`add_or_update_child_item: Field "${key}" does not exist in child doctype "${child_doctype_name}". Cannot set value.`);
            }
        });
        if (changed) {
             frm.dirty(); // Mark form dirty if any value changed
             // The grid refresh is handled by setup_bom_conditions_button
        }


    } else {
        // Add new child row
        console.log(`add_or_update_child_item: Adding new child row for item: ${child_values.item_code} in table ${child_table_fieldname}`);
        child_row = frappe.model.add_child(frm.doc, child_table_fieldname); // Add row to specified child table
        Object.keys(child_values).forEach(key => {
             // Check if the field exists in the child doctype before setting
            if (frappe.meta.has_field(child_doctype_name, key)) {
                 // Use model.set_value to ensure triggers run if needed
                 frappe.model.set_value(child_doctype_name, child_row.name, key, child_values[key]);
            } else {
                 // console.warn(`add_or_update_child_item: Field "${key}" does not exist in child doctype "${child_doctype_name}". Cannot set value.`);
            }
        });
        // Store the name of the new child row in the parent's reference field
        frappe.model.set_value(parent_row_doc.doctype, parent_row_doc.name, parent_ref_fieldname, child_row.name);
        console.log(`add_or_update_child_item: Added new row ${child_row.name} in ${child_table_fieldname}, linked via ${parent_ref_fieldname} on parent ${parent_row_doc.name}`);
         frm.dirty(); // Mark form dirty as a new row was added
         // The grid refresh is handled by setup_bom_conditions_button
    }
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


// --- Child Table Event Handlers (on Project Billing Master Sub Item) ---
frappe.ui.form.on('Project Billing Master Sub Item', {

    // show_qty_bracket field change
    show_qty_bracket: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        const parent_grid_fieldname = row?.parentfield; // Use optional chaining

        const possible_parent_grids = ["detail_bom_items", "door_cover", "panel_cover", "sub_items"];
        if (!parent_grid_fieldname || !possible_parent_grids.includes(parent_grid_fieldname)) {
             console.warn("show_qty_bracket: Parent grid fieldname not valid:", parent_grid_fieldname);
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

    qty_prefix: function(frm, cdt, cdn) {
        update_grid_qty_view(frm);
    },

    qty_suffix: function(frm, cdt, cdn) {
        update_grid_qty_view(frm);
    },

    // on_change handler for item_code in Project Billing Master Sub Item
    item_code: function(frm, cdt, cdn) {
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
        // Calling the trigger directly is fine, but it might cause setup_toggle_sub_items
        // to run frequently. Ensure setup_toggle_sub_items is performant.
        // The main refresh handler already calls setup_toggle_sub_items.
        // You might only need this if indent_level can change *after* initial load/refresh.
        // const grid = frm.fields_dict["detail_bom_items"].grid;
        // if (grid) {
        //     const grid_row = grid.get_row(cdn); // get_row is for rendered rows, might be null if not visible
        //     if(grid_row) {
                 frm.trigger("setup_toggle_sub_items"); // Re-setup toggles based on new hierarchy
        //     }
        // }
    },

    // `_add` triggers for different child tables
    panel_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Panel");
    },
    door_cover_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Door");
    },
    sub_items_add: function(frm, cdt, cdn) {
        set_default_section(frm, cdt, cdn, "Sub Items");
        // Automatically fetch print fields when a sub_items row is added
        fetch_and_set_print_fields(frm, cdt, cdn);
    },
    detail_bom_items_add: function(frm, cdt, cdn) {
        // When a detail_bom_items row is added, re-setup toggles
        frm.trigger("setup_toggle_sub_items");
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
                    args: { item_code: row.item_code },
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
    // Add other field change handlers for Project Billing Master Item if needed
});
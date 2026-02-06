function set_custom_grid_columns(frm, fieldname, default_columns) {
    default_columns = Array.isArray(default_columns) ? default_columns : [];

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid || !grid.doctype) {
        console.warn(`[V_FIELD_GRID][${fieldname}] Grid or grid.doctype not found.`);
        return;
    }

    const child_doctype_name = grid.doctype;
    const global_child_meta = frappe.get_meta(child_doctype_name);

    if (!global_child_meta) {
        console.error(`[V_FIELD_GRID][${fieldname}] Global meta not found for child Doctype: ${child_doctype_name}.`);
        return;
    }

    // --- 1. Extract unique dynamic zone keys for THIS SPECIFIC child table ---
    let all_unique_zone_keys_for_this_grid = [];
    if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
        frm.doc[fieldname].forEach(row => {
            if (row && row.zone_qty && typeof row.zone_qty === 'string') {
                try {
                    const zones_data = JSON.parse(row.zone_qty);
                    Object.keys(zones_data).forEach(key => {
                        if (key && flt(zones_data[key]) > 0 && !all_unique_zone_keys_for_this_grid.includes(key)) {
                            all_unique_zone_keys_for_this_grid.push(key);
                        }
                    });
                } catch (e) { /* console.warn(`[V_FIELD_GRID][${fieldname}] Error parsing zone_qty for row ${row.name}:`, e); */ }
            }
        });
    }
    all_unique_zone_keys_for_this_grid.sort();
    console.log(`[V_FIELD_GRID][${fieldname}] Unique active zone keys for this grid:`, all_unique_zone_keys_for_this_grid);

    const MAX_VIRTUAL_FIELDS = 20;
    let virtual_fields_mapping = []; // Stores { virtual_fieldname: 'virtual_field_x', display_label: 'ZoneKeyLabel', original_zone_key: 'ZoneKey' }

    // --- 2. Map dynamic zone keys to available virtual fields and prepare display list ---
    let final_fieldnames_to_show_in_order = [...default_columns];

    for (let i = 0; i < all_unique_zone_keys_for_this_grid.length; i++) {
        if (i < MAX_VIRTUAL_FIELDS) {
            const zone_key = all_unique_zone_keys_for_this_grid[i];
            const vf_name = `virtual_field_${i + 1}`;

            const vf_meta_check = global_child_meta.fields.find(df => df.fieldname === vf_name);
            if (vf_meta_check) {
                virtual_fields_mapping.push({
                    virtual_fieldname: vf_name,
                    display_label: frappe.model.unscrub(zone_key),
                    original_zone_key: zone_key
                });
                if (!final_fieldnames_to_show_in_order.includes(vf_name)) {
                    final_fieldnames_to_show_in_order.push(vf_name);
                }
            } else {
                console.warn(`[V_FIELD_GRID][${fieldname}] Virtual field "${vf_name}" not found in global meta. Cannot map zone "${zone_key}".`);
            }
        } else { break; }
    }
    console.log(`[V_FIELD_GRID][${fieldname}] Final fieldnames to display (ordered):`, final_fieldnames_to_show_in_order);

    // --- 3. Update row data: assign zone_qty values to corresponding virtual_field_x ---
    if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
        frm.doc[fieldname].forEach(row_doc => {
            for (let i = 0; i < MAX_VIRTUAL_FIELDS; i++) {
                if(row_doc) row_doc[`virtual_field_${i + 1}`] = null;
            }
            if (row_doc && row_doc.zone_qty && typeof row_doc.zone_qty === 'string') {
                try {
                    const zones_data_for_row = JSON.parse(row_doc.zone_qty);
                    virtual_fields_mapping.forEach(vf_map => {
                        if (zones_data_for_row.hasOwnProperty(vf_map.original_zone_key)) {
                            row_doc[vf_map.virtual_fieldname] = zones_data_for_row[vf_map.original_zone_key];
                        }
                    });
                } catch (e) { /* ... */ }
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

            if (final_fieldnames_to_show_in_order.includes(grid_df_config.fieldname)) {
                grid_df_config.in_list_view = 1; // Mark for display

                const vf_map_entry = virtual_fields_mapping.find(vf => vf.virtual_fieldname === grid_df_config.fieldname);
                if (vf_map_entry) {
                    grid_df_config.label = vf_map_entry.display_label; // << 핵심 레이블 변경 in grid.meta
                    console.log(`[V_FIELD_GRID][${fieldname}] In grid.meta: Label for ${grid_df_config.fieldname} set to "${grid_df_config.label}"`);
                }
            }
        });
    } else {
        console.warn(`[V_FIELD_GRID][${fieldname}] grid.meta or grid.meta.fields not available. Label changes via grid.meta might not work for Configure Columns.`);
    }

    const original_method_key = `_original_setup_visible_columns_for_${fieldname}_vf_final`;
    if (!grid[original_method_key] && typeof grid.setup_visible_columns === 'function') {
        grid[original_method_key] = grid.setup_visible_columns;
    }

    // --- 5. Override setup_visible_columns to build the visible_columns array for rendering ---
    grid.setup_visible_columns = function() {
        this.visible_columns = [];
        this.visible_column_names = [];

        // console.log(`[V_FIELD_GRID][${fieldname}] Running OVERRIDDEN setup_visible_columns`);

        // Use this.meta (the grid instance's meta) as it might have been updated.
        // Fallback to global_child_meta if this.meta is not fully populated or available.
        const source_meta_for_df = this.meta && this.meta.fields && this.meta.fields.length > 0 ? this.meta : global_child_meta;

        if (!source_meta_for_df || !source_meta_for_df.fields) {
            console.error(`[V_FIELD_GRID][${fieldname}] Source meta for DF not available in override. Aborting.`);
            return;
        }

        // --- Column Size Calculation Logic ---
        const fixed_width_fields_cfg = ["item_code", "item_name", "size", "qty", "color", "remark", "zone", "print_group", "print_order", "product_keyword", "door_hw_spec_code"];
        const grid_specific_col_widths = { // Bootstrap col-sm-X, sum should be around 11-12 to leave space for action button
            "default": { "item_code": 2, "item_name": 3, "size": 1, "qty": 1, "color": 1, "remark": 2, "zone": 1, "print_group":1, "print_order":1, "product_keyword":2, "door_hw_spec_code":2 },
            "door_cover": { "item_name":2, "product_keyword":2, "door_hw_spec_code":2, "size": 1, "qty": 1, "remark": 2 }, // Customize per grid
            "sub_items": { "item_name":3, "size":1, "qty":1, "color":1, "remark":2, "print_group":1, "print_order":1 }
            // Add other grids if they need specific sizing
        };
        const VIRTUAL_FIELD_COL_SIZE = 1; // Default colsize for virtual fields

        const get_column_size_for_df = (df, current_grid_fieldname) => {
            // 1. Is it a mapped virtual field?
            if (virtual_fields_mapping.some(vf => vf.virtual_fieldname === df.fieldname)) {
                return VIRTUAL_FIELD_COL_SIZE;
            }
            // 2. Grid-specific width?
            const specific_grid_config = grid_specific_col_widths[current_grid_fieldname] || grid_specific_col_widths["default"];
            if (specific_grid_config && specific_grid_config[df.fieldname]) {
                return specific_grid_config[df.fieldname];
            }
            // 3. General fixed width?
            // if (fixed_width_fields_cfg.includes(df.fieldname)) return 2; // Example fixed width
            // 4. Default from df.columns or 1
            return cint(df.columns) || 1;
        };

        let total_col_size = 0;
        final_fieldnames_to_show_in_order.forEach(fname_to_show => {
            let df_config = source_meta_for_df.fields.find(df => df.fieldname === fname_to_show);

            if (df_config) {
                let df_for_column = { ...df_config }; // Work with a copy
                df_for_column.in_list_view = 1;     // Ensure it's displayable

                const vf_map_entry = virtual_fields_mapping.find(vf => vf.virtual_fieldname === fname_to_show);
                if (vf_map_entry) {
                    df_for_column.label = vf_map_entry.display_label; // Set label from our mapping

                    if (df_for_column.fieldtype === 'Data' || df_for_column.fieldtype === 'Read Only') {
                        df_for_column.formatter = function(value, col_df) {
                            const num_val = flt(value);
                            if (num_val === 0 && !col_df.print_hide_if_no_value) return "";
                            if (frappe.utils.format_number && col_df.precision !== undefined) {
                                return frappe.utils.format_number(num_val, null, col_df.precision);
                            }
                            return num_val;
                        };
                    }
                }

                const colsize = get_column_size_for_df(df_for_column, fieldname);
                this.visible_columns.push([df_for_column, colsize]);
                this.visible_column_names.push(fname_to_show);
                total_col_size += colsize;
            }
        });
        console.log(`[V_FIELD_GRID][${fieldname}] Override: Total calculated colsize: ${total_col_size}`);
        // console.log(`[V_FIELD_GRID][${fieldname}] Override: Final visible_columns (Labels):`,
        //     this.visible_columns.map(col => `${col[0].fieldname} (Label: ${col[0].label}, Width: ${col[0].width}, ColSize: ${col[1]})`)
        // );

        // Adjust last column size if total exceeds standard (e.g., 12 for Bootstrap), or implement more complex logic
        // This is a very basic adjustment, might need refinement
        const MAX_GRID_COLS = 12; // Typical Bootstrap grid
        const ACTION_BUTTON_COL_SIZE = 1; // Approximate size for the last action button column
        const AVAILABLE_COLS = MAX_GRID_COLS - ACTION_BUTTON_COL_SIZE;

        if (total_col_size > AVAILABLE_COLS && this.visible_columns.length > 0) {
            // console.warn(`[V_FIELD_GRID][${fieldname}] Total colsize ${total_col_size} exceeds available ${AVAILABLE_COLS}. May need to adjust col sizes.`);
            // Simple strategy: proportionally reduce or cap, or reduce last few columns
            // For now, we'll just log it. A more robust solution would be to adjust sizes.
        }
    };

    // --- 6. Trigger grid refresh/reset ---
    // console.log(`[V_FIELD_GRID][${fieldname}] Queuing grid reset.`);
    setTimeout(() => {
        const current_grid_instance = frm.fields_dict[fieldname]?.grid;
        if (current_grid_instance === grid) {
            if (grid.reset_grid) {
                try {
                    grid.reset_grid(); // This should use the overridden setup_visible_columns
                } catch (e) { console.error(`[V_FIELD_GRID][${fieldname}] Error in grid.reset_grid():`, e); }
            } else if (grid.refresh) {
                try { grid.refresh(); } catch (e) { console.error(`[V_FIELD_GRID][${fieldname}] Error in grid.refresh():`, e); }
            }

            // --- Optional: DOM Manipulation for Labels (if above methods are not 100% reliable for display) ---
            // setTimeout(() => {
            //     if (grid.wrapper) {
            //         virtual_fields_mapping.forEach(vf_map => {
            //             const header_cell_div = $(grid.wrapper).find(`.grid-heading-row [data-fieldname="${vf_map.virtual_fieldname}"]`);
            //             if (header_cell_div.length > 0) {
            //                 const static_area = header_cell_div.find('.static-area .value') || header_cell_div.find('.static-area');
            //                 if (static_area.length > 0) static_area.text(vf_map.display_label);
            //                 header_cell_div.attr('title', vf_map.display_label);
            //             }
            //         });
            //     }
            // }, 150); // Delay for DOM

        } else {
            // console.warn(`[V_FIELD_GRID][${fieldname}] Grid instance changed before reset was called.`);
        }
    }, 250); // Delay for all setup
}
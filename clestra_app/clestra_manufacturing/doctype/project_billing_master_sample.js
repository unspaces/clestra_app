// ... set_custom_grid_columns 함수 내부, grid.setup_visible_columns = function() { ...
        console.log(`[CUSTOM GRID] set_custom_grid_columns: Running custom setup_visible_columns override for ${fieldname}`);

        let frappe_base_columns = [];
        let frappe_base_column_names = [];

        // --- 1. Call the original Frappe setup_visible_columns method ---
        // 원본 함수를 호출하여 Frappe 기본 로직에 따라 visible_columns를 구성하게 합니다.
        // 이 결과를 기본 베이스로 사용하되, 오류 발생 시 빈 배열로 시작합니다.
        if (this[original_method_name]) {
            // console.log(`[CUSTOM GRID] set_custom_grid_columns: Calling original Frappe setup_visible_columns for ${fieldname}.`);
            this._is_calling_original_setup = true; // 플래그 설정
            try {
                this[original_method_name].apply(this);
                frappe_base_columns = Array.isArray(this.visible_columns) ? [...this.visible_columns] : [];
                frappe_base_column_names = Array.isArray(this.visible_column_names) ? [...this.visible_column_names] : [];
                console.log(`[CUSTOM GRID] set_custom_grid_columns: Original Frappe setup for ${fieldname} resulted in columns:`, frappe_base_column_names);
            } catch (e_orig) {
                console.error(`[CUSTOM GRID] set_custom_grid_columns: Error executing original Frappe setup_visible_columns for ${fieldname}:`, e_orig);
                // 원본 함수 실행 중 오류 발생 시, 기본 컬럼 목록을 비웁니다.
                frappe_base_columns = [];
                frappe_base_column_names = [];
                 console.warn(`[CUSTOM GRID] set_custom_grid_columns: Original setup failed, starting with empty columns.`);
            } finally {
                delete this._is_calling_original_setup; // 플래그 해제
            }
        } else {
            console.warn(`[CUSTOM GRID] set_custom_grid_columns: No original Frappe setup_visible_columns method found for ${fieldname}. Starting with an empty base.`);
        }


        // --- 2. Get all docfields for the child doctype ---
        // frappe.get_meta를 통해 최신 Doctype 정의를 가져옵니다.
        const meta_from_server = frappe.get_meta(this.doctype);
        const all_docfields = (meta_from_server && meta_from_server.fields) ? meta_from_server.fields : [];

        if (!all_docfields || all_docfields.length === 0) {
            console.error(`[CUSTOM GRID] set_custom_grid_columns: Could not get docfields for ${this.doctype} in grid ${fieldname}. Cannot set custom columns.`);
            // docfields를 가져오지 못하면 커스텀 컬럼 추가 없이 원본 결과를 사용 (아마 비어있겠지만)
            this.visible_columns = frappe_base_columns;
            this.visible_column_names = frappe_base_column_names;
            return;
        }
        // console.log(`[CUSTOM GRID] set_custom_grid_columns: All docfields for ${this.doctype} (${fieldname}):`, JSON.parse(JSON.stringify(all_docfields)));


        // --- 3. Get all dynamic zone lists ---
        // Only if the child doctype actually has the zone_qty field
        let all_dynamic_zones = [];
        const has_zone_qty_field_in_meta = all_docfields.some(df => df.fieldname === 'zone_qty');

        if (has_zone_qty_field_in_meta && frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
            all_dynamic_zones = frm.doc[fieldname]
                .filter(row => row && typeof row === 'object' && row.zone_qty)
                .map(row => {
                    try {
                        if (typeof row.zone_qty === 'string' && row.zone_qty.trim()) {
                             // Safely parse JSON, handle potential errors
                            return Object.keys(JSON.parse(row.zone_qty));
                        }
                         return []; // Handle empty or invalid zone_qty string
                    } catch (e) {
                        // console.warn(`[CUSTOM GRID] set_custom_grid_columns: Error parsing zone_qty for a row in ${fieldname}:`, row.zone_qty, e);
                        return []; // Handle JSON parsing errors
                    }
                })
                .flat() // Flatten array of arrays
                .filter((zone, index, self) => zone && self.indexOf(zone) === index) // Remove duplicates and empty/null zones
                .sort(); // Sort zone names alphabetically
        }
        console.log(`[CUSTOM GRID] set_custom_grid_columns: All unique dynamic zones found for ${fieldname}:`, all_dynamic_zones);


        // --- 4. Build the final combined visible columns list ---
        // Prioritize default_columns order, then Frappe base columns not in defaults, then dynamic zones.
        let final_visible_columns = [];
        let final_visible_column_names = [];
        let added_fieldnames = new Set(); // Use a Set for efficient checking

        // Helper arrays/objects for column width logic
        const fixed_width_fields = ["item_code", "item_name", "product_type", "product_keyword", "door_hw_spec_code", "size", "zone"];
        const grid_specific_widths = {
             "panel_cover": {"qty":2, "color":2, "remark":2},
             "door_cover": {"qty":2, "remark":2},
             "sub_items": {"print_group":2}
             // Add other grids as needed
        };
        // Helper to get column size
        const get_column_size = (df, fieldname, grid_specific_widths, fixed_width_fields) => {
             let colsize;
            if (fixed_width_fields.includes(df.fieldname)) { colsize = 2; }
            else if (grid_specific_widths[fieldname] && grid_specific_widths[fieldname][df.fieldname]) {
                colsize = grid_specific_widths[fieldname][df.fieldname];
            }
            else { colsize = cint(df.columns) || 1; } // Use original columns from meta or default to 1
            return Math.max(1, colsize); // Ensure minimum width of 1
        };


        // 4.1. Add columns from the `default_columns` list first
        default_columns.forEach(fname => {
            // Only add if not already in our final list
            if (!added_fieldnames.has(fname)) {
                // Get the DocField from Frappe's meta - this is the preferred source
                let df_from_meta = frappe.meta.get_docfield(this.doctype, fname, this.frm ? this.frm.docname : null);

                if (df_from_meta) {
                    // Use the DocField directly from meta, but ensure it's visible for this grid setup
                    // Create a shallow copy if we need to modify properties specific to this grid view without affecting meta cache
                    let df_to_use = { ...df_from_meta };
                    df_to_use.in_list_view = 1; // Force this column to be visible in the list view

                    let colsize = get_column_size(df_to_use, fieldname, grid_specific_widths, fixed_width_fields);

                    final_visible_columns.push([df_to_use, colsize]);
                    final_visible_column_names.push(fname);
                    added_fieldnames.add(fname);
                    // console.log(`[CUSTOM GRID] set_custom_grid_columns: Added default column (from meta): ${fname} for ${fieldname}`);
                    // console.log(`[CUSTOM GRID] set_custom_grid_columns: DF for default column "${fname}":`, JSON.parse(JSON.stringify(df_to_use)));

                } else {
                    console.warn(`[CUSTOM GRID] set_custom_grid_columns: Default column "${fname}" requested for grid "${fieldname}" not found in Doctype's meta. Skipping.`);
                }
            }
        });


        // 4.2. Add any columns from Frappe's original base list that are NOT in our default list
        frappe_base_columns.forEach(col_config => {
             const df = col_config[0];
             const colsize = col_config[1];
             const fname = df ? df.fieldname : null;

             if (fname && !added_fieldnames.has(fname)) {
                 // Add the column from Frappe's base as is if not already added
                 final_visible_columns.push(col_config); // Use Frappe's original [df, colsize] tuple
                 final_visible_column_names.push(fname);
                 added_fieldnames.add(fname);
                 // console.log(`[CUSTOM GRID] set_custom_grid_columns: Added Frappe base column NOT in defaults: ${fname} for ${fieldname}`);
             }
        });


        // 4.3. Add dynamic zone columns
        all_dynamic_zones.forEach(zone_fname => {
             // Only add if this dynamic column name is NOT already in the list
            if (!added_fieldnames.has(zone_fname)) {
                 // Create a comprehensive docfield object for the dynamic column
                 // Ensure all standard DocField properties are included with sensible defaults/nulls
                 let df_dynamic = {
                    fieldname: zone_fname,
                    label: frappe.model.unscrub(zone_fname), // e.g., "Zone A"
                    fieldtype: 'Int', // Or 'Data'
                    // --- Essential DocField properties for grid rendering ---
                    reqd: 0, hidden: 0, read_only: 1, in_list_view: 1, allow_on_submit: 0,
                    no_copy: 1, print_hide: 1, report_hide: 0, search_index: 0, in_filter: 0,
                    unique: 0, bold: 0, collapsible: 0, collapsible_depends_on: null, colour: null,
                    columns: 0, default: null, description: `Quantity for zone ${frappe.model.unscrub(zone_fname)}`,
                    fetch_from: null, fetch_if_empty: 0, hide_border: 0, hide_days: 0, hide_seconds: 0,
                    ignore_user_permissions: 0, ignore_xss_filter: 0, in_global_search: 0, in_preview: 0,
                    in_standard_filter: 0, is_custom_field: 1, // Mark as custom/dynamic
                    length: 0, linked_document_type: null, non_negative: 0, options: null,
                    permlevel: 0, precision: '', print_width: null, remember_last_selected_value: 0,
                    show_dashboard: 0, show_preview_popup: 0, sort_options: 0, translatable: 0,
                    is_virtual: 0, allow_bulk_edit: 0, print_hide_if_no_value: 1,
                     // Explicitly set depends_on related properties to null if they don't apply
                    depends_on: null, mandatory_depends_on: null, read_only_depends_on: null, hidden_depends_on: null,
                    // --- End essential properties ---

                    width: 80, // Suggested width
                    formatter: function(value, col_df_in_formatter, options, doc_row) {
                         if (doc_row && doc_row.zone_qty) {
                            try {
                                const zones_data = JSON.parse(doc_row.zone_qty || '{}');
                                return cint(zones_data[col_df_in_formatter.fieldname]) || 0;
                            } catch (e) { return "Err"; }
                        }
                        return 0;
                    }
                 };
                 let colsize_dynamic = 1; // Fixed column size for dynamic zone quantity

                 final_visible_columns.push([df_dynamic, colsize_dynamic]);
                 final_visible_column_names.push(zone_fname);
                 added_fieldnames.add(zone_fname);
                 console.log(`[CUSTOM GRID] set_custom_grid_columns: Added dynamic zone column: ${zone_fname} for ${fieldname}.`);
                 // console.log(`[CUSTOM GRID] set_custom_grid_columns: DF for dynamic column "${zone_fname}":`, JSON.parse(JSON.stringify(df_dynamic)));
            } else {
                 // console.log(`[CUSTOM GRID] set_custom_grid_columns: Dynamic zone "${zone_fname}" for ${fieldname} already in Frappe's base or default columns.`);
            }
        });


        // 5. Set the grid's visible columns
        if (final_visible_columns.length > 0) {
            this.visible_columns = final_visible_columns;
            this.visible_column_names = final_visible_column_names;
            console.log(`[CUSTOM GRID] set_custom_grid_columns: Final combined columns set for ${fieldname}:`, this.visible_column_names);
        } else {
             console.warn(`[CUSTOM GRID] set_custom_grid_columns: No columns could be configured for ${fieldname} (Frappe base empty, no defaults found, no dynamic zones). Grid might be empty.`);
            this.visible_columns = [];
            this.visible_column_names = [];
        }

        // The grid rendering logic (triggered by reset_grid/refresh) will automatically use the new this.visible_columns and this.visible_column_names.
        // We do NOT call the original method again here.
    };

    // --- Trigger a FULL grid rebuild using the overridden setup_visible_columns ---
    console.log(`[CUSTOM GRID] set_custom_grid_columns: Triggering grid reset for ${fieldname} (queued)`);
    setTimeout(() => {
        // Before calling, ensure the grid object is still valid and attached to the form
        const current_grid_in_frm = frm.fields_dict[fieldname]?.grid;
        if (current_grid_in_frm === grid) { // Check if the grid instance is the same one we overrode
            if (grid.reset_grid) {
                grid.reset_grid();
                // console.log(`[CUSTOM GRID] set_custom_grid_columns: grid.reset_grid() executed for ${fieldname}.`);
            } else if (grid.refresh) {
                 // Fallback if reset_grid method is not available
                grid.refresh();
                // console.log(`[CUSTOM GRID] set_custom_grid_columns: grid.refresh() (fallback) executed for ${fieldname}.`);
            } else {
                console.warn(`[CUSTOM GRID] set_custom_grid_columns: Neither reset_grid nor refresh method found on grid object for ${fieldname}. Cannot trigger rebuild.`);
            }
        } else {
             console.warn(`[CUSTOM GRID] set_custom_grid_columns: Grid object for ${fieldname} seems to have changed or been removed before reset/refresh could be executed.`);
        }
    }, 50); // A small delay (e.g., 50ms) can sometimes help avoid race conditions

    // Keep other triggers if needed (called by main refresh handler)
    // frm.trigger("update_grid_qty_view");
    // frm.trigger("setup_toggle_sub_items");
}

// ... (Keep all other helper functions and event handlers as they were in your last full code) ...
// generate_js_qty_string, generate_js_size_string, set_default_section,
// fetch_and_set_print_fields, open_size_edit_dialog, open_qty_edit_dialog,
// setup_qty_field, setup_size_field, setup_bom_conditions_button,
// Project Billing Master Sub Item handlers, Project Billing Master Item handlers,
// Door Hardware Spec Child handlers (if applicable)
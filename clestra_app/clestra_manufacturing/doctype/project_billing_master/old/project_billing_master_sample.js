function set_custom_grid_columns(frm, fieldname, default_columns) {
    default_columns = Array.isArray(default_columns) ? default_columns : [];

    const grid = frm.fields_dict[fieldname]?.grid;
    if (!grid || !grid.doctype) {
        console.warn(`[CUSTOM GRID][${fieldname}] set_custom_grid_columns: Grid or grid.doctype not found.`);
        return;
    }
    const child_doctype_name = grid.doctype; // Child Doctype 이름 가져오기
    const meta_for_child = frappe.get_meta(child_doctype_name);

    if (!meta_for_child) {
        console.error(`[CUSTOM GRID][${fieldname}] set_custom_grid_columns: Meta information not found for child doctype: ${child_doctype_name}. Cannot proceed.`);
        return;
    }

    // 원본 setup_visible_columns 함수 백업 (최초 1회만)
    const original_method_name = `original_setup_visible_columns_for_${fieldname}`;
    if (!grid[original_method_name]) {
        if (typeof grid.setup_visible_columns === "function") {
            grid[original_method_name] = grid.setup_visible_columns;
        } else {
            console.error(`[CUSTOM GRID][${fieldname}] set_custom_grid_columns: setup_visible_columns method not found on grid. Cannot override.`);
            return;
        }
    }

    // Grid의 setup_visible_columns 함수 오버라이드
    grid.setup_visible_columns = function() {
        if (this._is_calling_original_setup) {
             console.log(`[CUSTOM GRID][${fieldname}] Original setup is already being called. Returning.`);
            return;
        }

        console.log(`[CUSTOM GRID][${fieldname}] Running custom setup_visible_columns override (Manual Build)`);

        // 1. Get dynamic zone names from current data first
        let all_dynamic_zones = [];
        if (frm.doc[fieldname] && Array.isArray(frm.doc[fieldname])) {
            all_dynamic_zones = frm.doc[fieldname]
                .filter(row => row && typeof row === 'object' && row.zone_qty)
                .map(row => {
                    try {
                        if (typeof row.zone_qty === 'string' && row.zone_qty.trim()) {
                            const zones_data = JSON.parse(row.zone_qty);
                            // 유효한 키 (필드명으로 사용 가능)만 필터링하고, 값이 0보다 큰 경우만 컬럼으로 추가 (선택 사항)
                            return Object.keys(zones_data).filter(key => key && typeof key === 'string' && key.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) && flt(zones_data[key]) > 0);
                        }
                        return [];
                    } catch (e) {
                         console.warn(`[CUSTOM GRID][${fieldname}] Error parsing zone_qty for a row:`, row.zone_qty, e);
                        return [];
                    }
                })
                .flat()
                .filter((zone, index, self) => zone && self.indexOf(zone) === index) // Remove duplicates and empty strings
                .sort(); // Sort zone names alphabetically
        }
        console.log(`[CUSTOM GRID][${fieldname}] Unique dynamic zones found:`, all_dynamic_zones);

        // 2. Get the 'qty' field definition from meta to use as a template
        const qty_df_template = frappe.meta.get_docfield(child_doctype_name, 'qty', this.frm ? this.frm.docname : null);
        if (!qty_df_template) {
            console.warn(`[CUSTOM GRID][${fieldname}] 'qty' field template not found for ${child_doctype_name}. Dynamic fields will use minimal definition.`);
        } else {
            console.log(`[CUSTOM GRID][${fieldname}] 'qty' field template found.`);
        }


        // --- 3. Add or update dynamic zone fields in client-side meta ---
        // This step is crucial for Frappe's rendering logic to find the field definition
        console.log(`[CUSTOM GRID][${fieldname}] Starting to add/update dynamic fields in meta...`);
        all_dynamic_zones.forEach((zone_fname, index) => {
            console.log(`[CUSTOM GRID][${fieldname}] Processing dynamic zone: ${zone_fname} (index ${index})`);
             const dynamic_fieldname = zone_fname;

            // Check if the field already exists in meta by fieldname
            // We need to get it using get_docfield by fieldname and docname/formname
            const existing_df_in_meta = frappe.meta.get_docfield(child_doctype_name, dynamic_fieldname, this.frm ? this.frm.docname : null);

            if (!existing_df_in_meta) {
                console.log(`[CUSTOM GRID][${fieldname}] Field "${dynamic_fieldname}" not found in meta. Creating and adding.`);

                let df_dynamic;

                if (qty_df_template) {
                    console.log(`[CUSTOM GRID][${fieldname}] Using 'qty' template for "${dynamic_fieldname}".`);
                    // Copy properties from the 'qty' field template
                    df_dynamic = { ...qty_df_template };
                    // --- CRITICAL FIX: REMOVE NAME TO FORCE UNIQUE ID GENERATION ---
                    // Ensure name, if copied, is removed to allow frappe.meta.add_field to generate a new one
                    if (df_dynamic.name) delete df_dynamic.name;
                    // --- CRITICAL FIX END ---

                     // Override specific properties for the dynamic field
                    df_dynamic.fieldname = dynamic_fieldname;
                    df_dynamic.label = frappe.model.unscrub(dynamic_fieldname);
                    df_dynamic.description = `Quantity for zone ${frappe.model.unscrub(dynamic_fieldname)}`;
                    df_dynamic.fieldtype = 'Float'; // Ensure it's a numeric type (qty is Float usually)
                    df_dynamic.read_only = 1; // Quantities are calculated, not edited directly in this column
                    df_dynamic.hidden = 0; // Make it visible
                    df_dynamic.in_list_view = 1; // Make it visible in list view
                    df_dynamic.is_virtual = 1; // Mark as virtual field (not in DB)
                    df_dynamic.columns = 0; // Reset columns property, grid colsize will control width
                    df_dynamic.width = 80; // Suggested width (DocField width)
                    df_dynamic.is_custom_field = 1; // Explicitly mark as custom/dynamic
                    // Ensure no conflicting dependencies are copied
                     df_dynamic.depends_on = null;
                    df_dynamic.mandatory_depends_on = null;
                    df_dynamic.read_only_depends_on = null;
                    df_dynamic.hidden_depends_on = null;


                    // Define the custom formatter for the dynamic column
                    df_dynamic.formatter = function(value, col_df_in_formatter, options, doc_row) {
                         if (doc_row && doc_row.zone_qty) {
                            try {
                                const zones_data = JSON.parse(doc_row.zone_qty || '{}');
                                // 동적 필드의 fieldname을 키로 사용하여 JSON 데이터에서 값을 가져옴
                                const qty = flt(zones_data[col_df_in_formatter.fieldname]) || 0;
                                // 수량이 0이면 빈 문자열 반환하여 칸을 비워둠
                                // Use format_number for consistency if available, fallback to direct value
                                if (frappe.utils.format_number) {
                                    return qty === 0 ? "" : frappe.utils.format_number(qty, col_df_in_formatter.precision || cint(meta_for_child.precision('qty')) || 0);
                                } else {
                                     return qty === 0 ? "" : qty;
                                }
                            } catch (e) {
                                // JSON 파싱 오류 시 에러 표시
                                console.error(`[CUSTOM GRID][${fieldname}] Formatter error for ${col_df_in_formatter.fieldname} in row ${doc_row?.name}:`, e, doc_row?.zone_qty);
                                return "Err";
                            }
                        }
                        return ""; // zone_qty 필드 자체가 없는 경우
                    };


                } else {
                     console.log(`[CUSTOM GRID][${fieldname}] Using minimal definition for "${dynamic_fieldname}".`);
                    // Fallback: If 'qty' field template is not found, create a minimal definition
                    df_dynamic = {
                        fieldname: dynamic_fieldname,
                        label: frappe.model.unscrub(dynamic_fieldname),
                        fieldtype: 'Float', // Default to Float for quantities
                        reqd: 0, hidden: 0, read_only: 1, in_list_view: 1,
                        description: `Quantity for zone ${frappe.model.unscrub(dynamic_fieldname)}`,
                        is_virtual: 1,
                        width: 80,
                        columns: 0, // Use colsize
                        is_custom_field: 1,
                         // Minimal formatter
                         formatter: function(value, col_df_in_formatter, options, doc_row) {
                             if (doc_row && doc_row.zone_qty) {
                                try {
                                    const zones_data = JSON.parse(doc_row.zone_qty || '{}');
                                    const qty = flt(zones_data[col_df_in_formatter.fieldname]) || 0;
                                     return qty === 0 ? "" : qty;
                                } catch (e) {
                                    console.error(`[CUSTOM GRID][${fieldname}] Formatter error (fallback) for ${col_df_in_formatter.fieldname} in row ${doc_row?.name}:`, e, doc_row?.zone_qty);
                                    return "Err";
                                }
                            }
                            return "";
                        }
                    };
                }

                // Add the dynamic field definition to the child doctype's meta cache
                frappe.meta.add_field(child_doctype_name, df_dynamic);
                console.log(`[CUSTOM GRID][${fieldname}] Successfully added dynamic field "${dynamic_fieldname}" to meta. Generated Name: ${df_dynamic.name}`); // Log the generated name

                 // Verify it can be retrieved from meta immediately after adding
                 const added_df_check = frappe.meta.get_docfield(child_doctype_name, dynamic_fieldname, this.frm ? this.frm.docname : null);
                 if (added_df_check) {
                      console.log(`[CUSTOM GRID][${fieldname}] Verified field "${dynamic_fieldname}" successfully retrieved from meta. Name: ${added_df_check.name}`);
                 } else {
                     console.error(`[CUSTOM GRID][${fieldname}] !!! Verification FAILED: Field "${dynamic_fieldname}" NOT retrieved from meta immediately after adding.`);
                 }


            } else {
                 // Field already exists in meta (e.g., from previous refresh or already added)
                 console.log(`[CUSTOM GRID][${fieldname}] Dynamic field "${dynamic_fieldname}" already exists in meta (Name: ${existing_df_in_meta.name}). Ensuring in_list_view = 1.`);
                 // Ensure it's marked as visible in list view
                 if (cint(existing_df_in_meta.in_list_view) !== 1) {
                     existing_df_in_meta.in_list_view = 1;
                      console.log(`[CUSTOM GRID][${fieldname}] Updated in_list_view for "${dynamic_fieldname}" in meta.`);
                 }
                 // Optional: Update formatter or other properties if needed (e.g. if logic changes)
                 // example: existing_df_in_meta.formatter = function(...) { ... };
            }
        });
        console.log(`[CUSTOM GRID][${fieldname}] Finished adding/updating dynamic fields in meta.`);


        // --- CRITICAL STEP: Update docfields cache for each grid row ---
        // This ensures each GridRow instance has the latest field list including dynamic fields
        console.log(`[CUSTOM GRID][${fieldname}] Updating docfields cache for each grid row...`);
        const grid_rows = grid.grid_rows || []; // Get all grid rows that have been rendered
        grid_rows.forEach(grid_row => {
            if (grid_row && grid_row.doc && grid_row.doc.name) {
                // frappe.meta.make_docfield_copy_for(doctype, name, fields_list)
                // This function updates the *provided* fields_list with a fresh copy from meta for that docname
                try {
                    frappe.meta.make_docfield_copy_for(
                        child_doctype_name,     // Doctype name of the child table row
                        grid_row.doc.name,      // Name (unique ID) of the child table row
                        grid_row.docfields      // The docfields array owned by this specific GridRow instance
                    );
                     // console.log(`[CUSTOM GRID][${fieldname}] Updated docfields for row: ${grid_row.doc.name}`);
                } catch (e) {
                    console.error(`[CUSTOM GRID][${fieldname}] Error updating docfields for row ${grid_row.doc?.name}:`, e);
                }
            } else {
                 console.warn(`[CUSTOM GRID][${fieldname}] Skipping docfields update for invalid grid row.`);
            }
        });
         console.log(`[CUSTOM GRID][${fieldname}] Finished updating docfields cache for grid rows.`);


        // 4. Determine the list of *all* fieldnames that should be visible
        // Get Frappe's standard list_view fields from meta *after* potentially adding dynamic fields
        // Use frappe.get_meta to get the latest meta object which should now include added fields
        const current_meta_for_child = frappe.get_meta(child_doctype_name); // Get potentially updated meta
        let frappe_current_list_view_fieldnames = (current_meta_for_child && Array.isArray(current_meta_for_child.fields))
            ? current_meta_for_child.fields
                .filter(df => cint(df.in_list_view) === 1) // in_list_view가 1인 필드만 선택
                .map(df => df.fieldname)
            : [];
        console.log(`[CUSTOM GRID][${fieldname}] Frappe's current list_view fieldnames from meta (incl. dynamic):`, frappe_current_list_view_fieldnames);


        // 원하는 순서로 최종 필드명 목록 구성: default_columns -> 현재 메타의 list_view 필드 중 default에 없는 것 -> (이 경우는 동적필드는 이미 포함됨)
        const desired_fieldname_order = [
             // 1. default_columns에 정의된 필드 중 메타에 존재하는 필드
             ...default_columns.filter(fname => frappe.meta.has_field(child_doctype_name, fname)),
             // 2. 현재 메타의 in_list_view 필드 중 default_columns에 없는 필드 (기존 Frappe 필드 및 동적 필드 포함)
             ...frappe_current_list_view_fieldnames.filter(fname => !default_columns.includes(fname)),
             // Note: Adding dynamic_zones again here is redundant if frappe_current_list_view_fieldnames includes them.
             // If not, it ensures they are added at the end. Keep it for robustness if meta refresh is inconsistent.
             // Also, ensure the dynamic field names derived from zone_qty are still valid fieldnames after any potential sanitization/scrubbing.
             ...all_dynamic_zones.filter(fname => !desired_fieldname_order.includes(fname) && frappe.meta.has_field(child_doctype_name, fname)) // Ensure it's in meta
        ];

        // 최종 사용될 고유 필드명 목록 (순서 유지)
        const unique_desired_fieldnames = [...new Set(desired_fieldname_order)];
        console.log(`[CUSTOM GRID][${fieldname}] Final unique desired fieldnames (ordered):`, unique_desired_fieldnames);


        // 5. Build the final visible_columns array with [df, colsize] pairs
        let final_visible_columns = [];

        // 컬럼 너비 계산 로직
        const fixed_width_fields = ["item_code", "item_name", "product_type", "product_keyword", "door_hw_spec_code", "size", "qty", "color", "remark", "zone", "print_group", "print_order"]; // Added item_name, product_keyword
        const grid_specific_widths = {
             "panel_cover": {"item_name":3, "size":2, "qty":2, "color":2, "remark":2, "product_keyword":2},
             "door_cover": {"item_name":3, "size":2, "qty":2, "remark":2, "door_hw_spec_code": 2, "product_keyword": 2},
             "sub_items": {"print_group":2, "print_order":2, "item_name":3, "size":2, "qty":2, "color":2, "remark":2},
             "detail_bom_items": {"item_code":2, "item_name":3, "size":2, "qty":2, "color":2, "remark":2, "zone":2}
             // 동적 zone 컬럼은 기본적으로 1 또는 2가 적당
        };

       // Helper to get column size
       const get_column_size = (df, current_fieldname, grid_specific_widths, fixed_width_fields, is_dynamic_zone) => {
           // 그리드별 특정 폭 확인
           if (grid_specific_widths[current_fieldname] && grid_specific_widths[current_fieldname][df.fieldname]) {
                return Math.max(1, cint(grid_specific_widths[current_fieldname][df.fieldname]));
           }
           // 동적 zone 필드는 고정 폭
           if (is_dynamic_zone) { return 2; } // Zone 이름 + 수량 표시를 위해 2가 적당할 수 있음

           // 고정 폭 필드 확인
           if (fixed_width_fields.includes(df.fieldname)) { return 2; }

           // 메타 정보의 columns 속성 또는 기본값 사용
           return Math.max(1, cint(df.columns) || 1);
       };

        console.log(`[CUSTOM GRID][${fieldname}] Building final visible_columns array from ordered fieldnames...`);
        unique_desired_fieldnames.forEach(fname => {
            // 메타에서 DocField 객체를 가져옵니다 (add_field로 동적 필드도 메타에 있습니다)
            // this.frm 또는 grid.frm 을 docname 인수로 사용해야 합니다.
            const df_from_meta = frappe.meta.get_docfield(child_doctype_name, fname, this.frm ? this.frm.docname : null);

            if (df_from_meta) {
                const df_to_use = df_from_meta; // Use the df directly from meta.

                // Ensure it's marked as visible for list view (add_field and earlier check should ensure this)
                df_to_use.in_list_view = 1; // Re-confirm

                // Determine if this is a dynamic zone field
                const is_dynamic_zone = all_dynamic_zones.includes(fname);

                // Calculate column size using the helper
                const colsize = get_column_size(df_to_use, fieldname, grid_specific_widths, fixed_width_fields, is_dynamic_zone);

                // Add the [df, colsize] pair to the final list
                final_visible_columns.push([df_to_use, colsize]);
                // console.log(`[CUSTOM GRID][${fieldname}] Added field "${fname}" with colsize ${colsize} to final list.`);

            } else {
                // This indicates a logic error if a fieldname in unique_desired_fieldnames is not in meta
                console.error(`[CUSTOM GRID][${fieldname}] !!! FATAL: Field "${fname}" was in unique_desired_fieldnames but not found in meta. This should not happen.`);
            }
        });
        console.log(`[CUSTOM GRID][${fieldname}] Finished building final visible_columns array. Count: ${final_visible_columns.length}. Expected: ${unique_desired_fieldnames.length}`);


        // 6. Set the grid's visible columns and names
        if (final_visible_columns.length > 0) {
            this.visible_columns = final_visible_columns;
            this.visible_column_names = unique_desired_fieldnames; // Use the determined list of fieldnames
            console.log(`[CUSTOM GRID][${fieldname}] Final visible columns set. Count: ${this.visible_columns.length}`, this.visible_column_names);
            // console.log(`[CUSTOM GRID][${fieldname}] Final visible_columns array structure:`, JSON.parse(JSON.stringify(this.visible_columns)));
        } else {
             console.warn(`[CUSTOM GRID][${fieldname}] No valid columns could be configured. Grid might be empty.`);
            this.visible_columns = [];
            this.visible_column_names = [];
        }

        // We do NOT call the original setup_visible_columns again here.
    };

    // --- Trigger a FULL grid rebuild using the overridden setup_visible_columns ---
    // Schedule a refresh call. This refresh will use the overridden method setup above.
    console.log(`[CUSTOM GRID][${fieldname}] Overriding setup_visible_columns and queuing grid.refresh()`);
    // Use a slightly longer delay if necessary, or call this after data loading callbacks complete.
    // Adding a unique key to setTimeout might help identify which timeout runs last if multiple are queued.
     setTimeout(() => {
        const current_grid_in_frm = frm.fields_dict[fieldname]?.grid;
         // setTimeout 내에서 grid 객체가 여전히 유효한지 확인
         // this.grid (오버라이드 시점)와 frm.fields_dict[fieldname]?.grid (setTimeout 시점)가 동일한 인스턴스인지 확인
        if (current_grid_in_frm && current_grid_in_frm === grid) {
             console.log(`[CUSTOM GRID][${fieldname}] Triggering grid refresh via reset_grid()...`);
            // Use reset_grid if available, it's designed for rebuilding the grid entirely
            if (grid.reset_grid) {
                try {
                    grid.reset_grid();
                    console.log(`[CUSTOM GRID][${fieldname}] grid.reset_grid() executed.`);
                } catch(e) {
                     console.error(`[CUSTOM GRID][${fieldname}] Error during grid.reset_grid():`, e);
                }
            } else if (grid.refresh) {
                 // Fallback if reset_grid method is not available
                 console.log(`[CUSTOM GRID][${fieldname}] Triggering grid refresh via refresh() (fallback)...`);
                try {
                    grid.refresh();
                    console.log(`[CUSTOM GRID][${fieldname}] grid.refresh() (fallback) executed.`);
                } catch(e) {
                     console.error(`[CUSTOM GRID][${fieldname}] Error during grid.refresh() (fallback):`, e);
                }
            } else {
                console.warn(`[CUSTOM GRID][${fieldname}] Neither reset_grid nor refresh method found on grid object. Cannot trigger rebuild.`);
            }
        } else {
             console.warn(`[CUSTOM GRID][${fieldname}] Grid object seems to have changed or been removed before reset/refresh could be executed.`);
        }
     }, 250); // Increased delay again. Adjust if needed.
}
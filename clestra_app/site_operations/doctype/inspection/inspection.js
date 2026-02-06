// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Inspection", {
    inspection_type: function (frm) {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Inspection List Builder",
                name: frm.doc.inspection_type,
            },
            callback: function (data) {
                frm.clear_table("items");
                let inspection_object = data.message.inspection_object;
                for (let i in inspection_object) {
                    let row = frm.add_child("items");
                    row.section = inspection_object[i].section;
                    row.check_item = inspection_object[i].check_item;
                }
                frm.refresh_field("items");
            },
        });
    },
    
    refresh: function(frm) {
        // Add initial row to product_type table if empty
        if (!frm.doc.product_type || frm.doc.product_type.length === 0) {
            frm.add_child('product_type');
            frm.refresh_field('product_type');
        }

        // Hide "Add Row" button in product_type table
        frm.get_field('product_type').grid.cannot_add_rows = true;

        // Override grid refresh methods to hide columns
        const original_refresh = frm.fields_dict['product_type'].grid.refresh;
        frm.fields_dict['product_type'].grid.refresh = function(...args) {
            original_refresh.apply(this, args);
            hide_grid_columns(frm);
        };

        const original_items_refresh = frm.fields_dict['items'].grid.refresh;
        frm.fields_dict['items'].grid.refresh = function(...args) {
            original_items_refresh.apply(this, args);
            hide_grid_columns(frm);
        };

        // Initial grid refresh
        frm.fields_dict['product_type'].grid.refresh();
        frm.fields_dict['items'].grid.refresh();

        frm.refresh_field('product_type');
        frm.refresh_field('items');

        // Event for image attachment toggle in items grid
        frm.fields_dict['items'].grid.wrapper.on('change', '.input-attached-image', function() {
            let selected_row = frappe.get_doc('Inspection Items', frm.fields_dict['items'].grid.get_selected().name);
            frappe.model.set_value(selected_row.doctype, selected_row.name, 'image_uploaded', selected_row.attach_image ? 1 : 0);
        });

        // Inspector field filtering to show only enabled users
        frm.fields_dict['inspector'].get_query = function() {
            return {
                query: "frappe.core.doctype.user.user.user_query",
                filters: { 'enabled': 1 }
            };
        };
    }
});

function hide_grid_columns(frm) {
    // Hide row checkboxes and No. columns in grids
    const grids = ['product_type', 'items'];
    grids.forEach(grid_name => {
        const grid = frm.fields_dict[grid_name].grid;
        if (grid && grid.wrapper) {
            grid.wrapper.find('div.grid-heading-row .grid-row-check').hide();
            grid.wrapper.find('div.grid-heading-row .sortable-handle').hide();
            grid.wrapper.find('.grid-row-check').hide();
            grid.wrapper.find('.sortable-handle').hide();
        }
    });
}

frappe.ui.form.on('Inspection Items', {
    attach_image: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'image_uploaded', row.attach_image ? 1 : 0);
    },
    o_check: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if(row.o_check) {
            frappe.model.set_value(cdt, cdn, 'x_check', 0);
        }
    },
    x_check: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if(row.x_check) {
            frappe.model.set_value(cdt, cdn, 'o_check', 0);
        }
    }
});
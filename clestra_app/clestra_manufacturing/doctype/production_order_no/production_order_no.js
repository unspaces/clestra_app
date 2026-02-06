// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Production Order No", {
    country: function(frm) {
        update_job_id_creation(frm);
    },
    factory: function(frm) {
        update_job_id_creation(frm);
    },
    refresh: function(frm) {
        if (frm.is_new()) {
            update_job_id_creation(frm);
        }
    }
});

function update_job_id_creation(frm) {
    // Mapping of countries to their respective codes
    const country_map = {
        'Korea': '0',
        'Japan': '1',
        'HK': '2',
        'SGP': '3',
        'China': '4',
        'France': '7',
        'USA': '8'
    };

    // Mapping of factories to their respective codes
    const factory_map = {
        'Gumi': '1',
        'Taicang': '2',
        'France': '3'
    };

    // Generate Job ID prefix by combining country and factory codes
    let po_no_prefix = '';
    po_no_prefix += country_map[frm.doc.country] || '';
    po_no_prefix += factory_map[frm.doc.factory] || '';

    // Call server-side function to get the next 3-digit sequence
    frappe.call({
        method: "clestra_app.clestra_manufacturing.doctype.production_order_no.production_order_no.get_next_sequence",
        args: {
            "prefix": po_no_prefix
        },
        callback: function(r) {
            if (r.message) {
                // Set the full Job ID (2-digit prefix + 3-digit sequence)
                frm.set_value('po_no', po_no_prefix + r.message);
            }
        }
    });
}
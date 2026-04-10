"""
Migrate data from Sales Order Zone child table to Zone doctype.

Sales Order Zone had fields (ch, ph, clch_type, ceiling_visible, base_type, base_visible_h,
zone_overall_color, zone_color_*) that Zone doctype didn't have.
Now that Zone doctype has these fields, we copy the data over.
"""
import frappe


def execute():
    # Get all Sales Order Zone rows that have a valid zone_name (Link to Zone)
    zone_summary_rows = frappe.db.sql("""
        SELECT
            sz.zone_name,
            sz.ch, sz.ph,
            sz.clch_type, sz.ceiling_visible,
            sz.base_type, sz.base_visible_h,
            sz.zone_overall_color,
            sz.zone_color_frame, sz.zone_color_transom,
            sz.zone_color_leaf, sz.zone_color_lipseal,
            sz.zone_color_panel, sz.zone_color_clch,
            sz.zone_color_base, sz.zone_color_junction,
            sz.total_lm, sz.total_square_m
        FROM `tabSales Order Zone` sz
        WHERE sz.zone_name IS NOT NULL AND sz.zone_name != ''
        ORDER BY sz.modified DESC
    """, as_dict=True)

    if not zone_summary_rows:
        return

    # Group by zone_name, keep the latest (first due to ORDER BY modified DESC)
    seen = set()
    for row in zone_summary_rows:
        zone_id = row.zone_name
        if zone_id in seen:
            continue
        seen.add(zone_id)

        # Check Zone exists
        if not frappe.db.exists("Zone", zone_id):
            continue

        update_fields = {}
        field_list = [
            "ch", "ph", "clch_type", "ceiling_visible", "base_type", "base_visible_h",
            "zone_overall_color",
            "zone_color_frame", "zone_color_transom", "zone_color_leaf", "zone_color_lipseal",
            "zone_color_panel", "zone_color_clch", "zone_color_base", "zone_color_junction"
        ]

        for field in field_list:
            val = row.get(field)
            if val is not None and val != "" and val != 0:
                update_fields[field] = val

        # Also update lm/square_m if they have values
        if row.get("total_lm"):
            update_fields["lm"] = row.total_lm
        if row.get("total_square_m"):
            update_fields["square_m"] = row.total_square_m

        if update_fields:
            frappe.db.set_value("Zone", zone_id, update_fields, update_modified=False)

    frappe.db.commit()
    print(f"Migrated data for {len(seen)} zones from Sales Order Zone to Zone doctype.")

# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProductionOrderNo(Document):
	pass

@frappe.whitelist()
def get_next_sequence(prefix):
    # Fetch the highest current Job ID with the matching prefix
    last_job = frappe.db.sql("""
        SELECT `2digits`
        FROM `tabProduction Order No`
        WHERE `2digits` LIKE %s
        ORDER BY `2digits` DESC
        LIMIT 1
    """, (prefix + '%'), as_dict=True)

    # Extract the sequence number and increment it
    if last_job:
        last_sequence = int(last_job[0]["2digits"][-3:])
        next_sequence = last_sequence + 1
    else:
        next_sequence = 1  # Start from 001 if no matching record

    # Format the number as a 3-digit zero-padded string
    next_sequence_str = f"{next_sequence:03}"

    return next_sequence_str
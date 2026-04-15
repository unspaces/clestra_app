"""
Set Item.image for Items whose name matches a private uploaded file
basename and ends with `-TC`.

Match rule: File is private, file_name (without extension) equals Item name,
and that name ends with `-TC`.
"""
import os

import frappe


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def execute():
    files = frappe.db.sql(
        """
        SELECT name AS file_docname, file_name, file_url
        FROM `tabFile`
        WHERE is_private = 1
          AND file_name IS NOT NULL
          AND file_name != ''
        """,
        as_dict=True,
    )

    if not files:
        print("No private File records found.")
        return

    updated = 0
    unchanged = 0
    no_item = 0
    for f in files:
        base, ext = os.path.splitext(f.file_name)
        if ext.lower() not in IMAGE_EXTS:
            continue
        if not base.endswith("-TC"):
            continue

        if not frappe.db.exists("Item", base):
            no_item += 1
            continue

        current = frappe.db.get_value("Item", base, "image")
        if current == f.file_url:
            unchanged += 1
            continue

        frappe.db.set_value(
            "Item", base, "image", f.file_url, update_modified=False
        )
        updated += 1
        print(f"Updated {base}: {current or '(empty)'} -> {f.file_url}")

    frappe.db.commit()
    print(
        f"Done. Updated: {updated}, Unchanged: {unchanged}, "
        f"No matching Item: {no_item}"
    )

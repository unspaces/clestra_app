"""
Move files linked from Item.image from /private/files/ to /files/ (public).

Changing File.is_private triggers Frappe's handle_is_private_changed,
which physically relocates the file and updates file_url. We then sync
Item.image to the new URL.
"""
import frappe


def execute():
    items = frappe.db.sql(
        """
        SELECT name, image
        FROM `tabItem`
        WHERE image LIKE '/private/files/%'
        """,
        as_dict=True,
    )

    if not items:
        print("No Items with private image links.")
        return

    moved = 0
    missing = 0
    failed = 0
    for item in items:
        file_name = frappe.db.get_value("File", {"file_url": item.image}, "name")
        if not file_name:
            print(f"No File record for {item.name} image {item.image}")
            missing += 1
            continue

        try:
            file_doc = frappe.get_doc("File", file_name)
            if file_doc.is_private:
                file_doc.is_private = 0
                file_doc.save(ignore_permissions=True)

            new_url = file_doc.file_url
            if new_url != item.image:
                frappe.db.set_value(
                    "Item", item.name, "image", new_url, update_modified=False
                )
            frappe.db.commit()
            moved += 1
            print(f"{item.name}: {item.image} -> {new_url}")
        except Exception as e:
            frappe.db.rollback()
            print(f"Failed for {item.name} ({item.image}): {e}")
            failed += 1

    print(f"Done. Moved: {moved}, Missing File record: {missing}, Failed: {failed}")

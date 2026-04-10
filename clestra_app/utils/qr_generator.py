# Copyright (c) 2026, Se Yong EOM and contributors
# Shared QR code generation utility — used by both QR Item Lookup and Packing List systems.

import frappe
import io
import pyqrcode


def generate_qr_code(label, data, attached_to_doctype=None, attached_to_name=None, scale=6):
	"""Generate a QR code PNG and save it as a Frappe File.

	Args:
		label: A short label for the filename (e.g. pallet name, token)
		data: The content to encode in the QR code (e.g. URL)
		attached_to_doctype: DocType to attach the file to
		attached_to_name: Document name to attach the file to
		scale: QR code module size in pixels (default 6)

	Returns:
		file_url: URL path of the saved file
	"""
	# Check if already generated for this label + doctype
	if attached_to_doctype and attached_to_name:
		existing = frappe.db.get_value(
			"File",
			{
				"file_name": f"qr_{label}.png",
				"attached_to_doctype": attached_to_doctype,
				"attached_to_name": attached_to_name,
			},
			"file_url"
		)
		if existing:
			return existing

	qr = pyqrcode.create(data, error="M")
	buffer = io.BytesIO()
	qr.png(buffer, scale=scale, module_color=[0, 0, 0], background=[255, 255, 255])
	png_data = buffer.getvalue()

	file_doc = frappe.get_doc({
		"doctype": "File",
		"file_name": f"qr_{label}.png",
		"content": png_data,
		"is_private": 0,
	})

	if attached_to_doctype and attached_to_name:
		file_doc.attached_to_doctype = attached_to_doctype
		file_doc.attached_to_name = attached_to_name

	file_doc.save(ignore_permissions=True)

	return file_doc.file_url

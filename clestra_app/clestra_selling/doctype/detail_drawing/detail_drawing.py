# Copyright (c) 2026, Se Yong EOM and contributors
# For license information, please see license.txt

import os

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, now_datetime

DOCTYPE = "Detail Drawing"
PDF_FIELD = "drawing_pdf"


class DetailDrawing(Document):
	def validate(self):
		self.detail_code = (self.detail_code or "").strip()
		if self.drawing_pdf and self.has_value_changed(PDF_FIELD):
			self.pdf_version = cint(self.pdf_version) + 1
			self.pdf_updated_on = now_datetime()


@frappe.whitelist(methods=["POST"])
def upload_pdf():
	"""Bulk upload hook: attach one PDF to the drawing whose code matches the file name."""
	return _attach_uploaded_pdf(create_missing=False)


@frappe.whitelist(methods=["POST"])
def upload_pdf_create_missing():
	"""Same as upload_pdf, but creates a new drawing when no code matches."""
	return _attach_uploaded_pdf(create_missing=True)


def _attach_uploaded_pdf(create_missing: bool) -> dict:
	# Set by frappe.handler.upload_file before it calls the `method` given by the uploader.
	content = getattr(frappe.local, "uploaded_file", None)
	filename = os.path.basename(getattr(frappe.local, "uploaded_filename", None) or "")
	if not content or not filename:
		frappe.throw(_("No file received"))
	return attach_pdf(filename, content, create_missing)


def attach_pdf(filename: str, content: bytes, create_missing: bool = False) -> dict:
	code, ext = os.path.splitext(filename)
	code = code.strip()
	result = {"file_name": filename, "code": code}

	if ext.lower() != ".pdf":
		return {**result, "status": "invalid", "message": _("Not a PDF file")}

	frappe.has_permission(DOCTYPE, "write", throw=True)

	# MariaDB matching is case-insensitive, so "+d-fpdu-...pdf" finds "+D-FPDU-..."
	name = frappe.db.get_value(DOCTYPE, {"name": code}, "name")
	created = False
	if not name:
		if not create_missing:
			return {**result, "status": "not_found", "message": _("No drawing with this code")}
		frappe.has_permission(DOCTYPE, "create", throw=True)
		doc = frappe.get_doc({"doctype": DOCTYPE, "detail_code": code}).insert()
		name, created = doc.name, True

	doc = frappe.get_doc(DOCTYPE, name)
	doc.check_permission("write")
	result["code"] = doc.name

	from frappe.core.doctype.file.utils import get_content_hash

	if doc.drawing_pdf:
		current_hash = frappe.db.get_value(
			"File",
			{"file_url": doc.drawing_pdf, "attached_to_doctype": DOCTYPE, "attached_to_name": doc.name},
			"content_hash",
		)
		if current_hash and current_hash == get_content_hash(content):
			return {**result, "status": "unchanged", "message": _("Same PDF is already attached")}

	had_pdf = bool(doc.drawing_pdf)
	file_doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": filename,
			"attached_to_doctype": DOCTYPE,
			"attached_to_name": doc.name,
			"attached_to_field": PDF_FIELD,
			"is_private": 1,
			"content": content,
		}
	).insert()

	doc.drawing_pdf = file_doc.file_url
	doc.save()

	status = "created" if created else ("replaced" if had_pdf else "attached")
	return {**result, "status": status, "pdf_version": doc.pdf_version}

# Copyright (c) 2026, Se Yong EOM and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from clestra_app.clestra_selling.doctype.detail_drawing.detail_drawing import attach_pdf

CODE = "+D-TEST-C26-FGD54N-001"


def _pdf(text: str) -> bytes:
	return f"%PDF-1.4\n% {text}\n%%EOF\n".encode()


class TestDetailDrawing(FrappeTestCase):
	def setUp(self):
		frappe.delete_doc_if_exists("Detail Drawing", CODE, force=True)

	def test_not_found_without_create(self):
		res = attach_pdf(f"{CODE}.pdf", _pdf("a"))
		self.assertEqual(res["status"], "not_found")
		self.assertFalse(frappe.db.exists("Detail Drawing", CODE))

	def test_create_replace_unchanged(self):
		res = attach_pdf(f"{CODE}.pdf", _pdf("a"), create_missing=True)
		self.assertEqual(res["status"], "created")
		self.assertEqual(res["pdf_version"], 1)

		res = attach_pdf(f"{CODE}.pdf", _pdf("a"))
		self.assertEqual(res["status"], "unchanged")

		res = attach_pdf(f"{CODE.lower()}.PDF", _pdf("b"))
		self.assertEqual(res["status"], "replaced")
		self.assertEqual(res["code"], CODE)
		self.assertEqual(frappe.db.get_value("Detail Drawing", CODE, "pdf_version"), 2)

	def test_rejects_non_pdf(self):
		res = attach_pdf(f"{CODE}.dwg", b"x", create_missing=True)
		self.assertEqual(res["status"], "invalid")

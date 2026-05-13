// Clestra: when copying a document via frappe.model.copy_doc,
// auto-assign the new document name to "<original-name>-Copy".
// Previously this lived as a direct line in
// apps/frappe/.../create_new.js. Moved here on 2026-05-11 to keep
// the upstream file pristine.

(function () {
	"use strict";

	if (!frappe || !frappe.model || typeof frappe.model.copy_doc !== "function") {
		return;
	}
	if (frappe.model.__clestra_copy_doc_autoname_patched) return;

	const original = frappe.model.copy_doc;

	frappe.model.copy_doc = function (doc, from_amend, parent_doc, parentfield) {
		const newdoc = original.call(this, doc, from_amend, parent_doc, parentfield);
		// Only stamp __newname for top-level copies (not recursive child-row copies)
		if (newdoc && doc && !parent_doc && !newdoc.__newname) {
			newdoc.__newname = doc.name + "-Copy";
		}
		return newdoc;
	};

	frappe.model.__clestra_copy_doc_autoname_patched = true;
})();

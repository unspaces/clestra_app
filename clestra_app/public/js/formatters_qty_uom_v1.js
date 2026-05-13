// Clestra: render Float/Int fields whose options is the literal "qty"
// alongside the parent doc's stock_uom (e.g., "12.5 ea").
// Previously this lived as inline edits in
// apps/frappe/.../form/formatters.js. Moved here on 2026-05-11.

(function () {
	"use strict";

	if (!frappe || !frappe.form || !frappe.form.formatters) return;
	if (frappe.form.formatters.__clestra_qty_uom_patched) return;

	function withQtyUom(originalFn) {
		return function (value, docfield, options, doc) {
			if (docfield && docfield.options === "qty" && doc && doc.stock_uom) {
				const v = value == null || value === "" ? 0 : value;
				return "<div>" + v + " " + doc.stock_uom + "</div>";
			}
			return originalFn.call(this, value, docfield, options, doc);
		};
	}

	if (typeof frappe.form.formatters.Float === "function") {
		frappe.form.formatters.Float = withQtyUom(frappe.form.formatters.Float);
	}
	if (typeof frappe.form.formatters.Int === "function") {
		frappe.form.formatters.Int = withQtyUom(frappe.form.formatters.Int);
	}

	frappe.form.formatters.__clestra_qty_uom_patched = true;
})();

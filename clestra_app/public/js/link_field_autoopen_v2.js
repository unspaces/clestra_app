(function () {
	"use strict";

	const SELECTOR = '.frappe-control[data-fieldtype="Link"] input.input-with-feedback, '
		+ '.frappe-control[data-fieldtype="Dynamic Link"] input.input-with-feedback, '
		+ 'input.input-with-feedback[data-fieldtype="Link"], '
		+ 'input.input-with-feedback[data-fieldtype="Dynamic Link"]';

	function getControl(el) {
		const wrapper = el.closest(".frappe-control");
		return wrapper && wrapper.fieldobj;
	}

	function showAllOptions(el) {
		if (!el || el.disabled || el.readOnly) return;
		if (document.activeElement !== el) return;

		const control = getControl(el);
		if (!control || !control.awesomplete) return;

		const doctype = control.get_options && control.get_options();
		if (!doctype) return;

		const args = {
			txt: "",
			doctype: doctype,
			ignore_user_permissions: control.df && control.df.ignore_user_permissions,
			reference_doctype: (control.get_reference_doctype && control.get_reference_doctype()) || "",
			page_length: (frappe.boot && frappe.boot.sysdefaults && cint(frappe.boot.sysdefaults.link_field_results_limit)) || 20,
		};

		if (control.set_custom_query) {
			control.set_custom_query(args);
		}

		frappe.call({
			type: "POST",
			method: "frappe.desk.search.search_link",
			no_spinner: true,
			args: args,
			callback: function (r) {
				if (document.activeElement !== el) return;
				if (!r.message) return;

				let list = r.message;
				if (control.merge_duplicates) {
					list = control.merge_duplicates(list);
				}

				control.awesomplete.list = list;
				control.awesomplete.evaluate();
				if (list.length > 0 && control.awesomplete.ul) {
					control.awesomplete.open();
				}
			},
		});
	}

	$(document).on("focus", SELECTOR, function () {
		const el = this;
		setTimeout(function () { showAllOptions(el); }, 0);
	});

	$(document).on("mousedown", SELECTOR, function () {
		const el = this;
		if (document.activeElement !== el) return;
		setTimeout(function () { showAllOptions(el); }, 0);
	});
})();

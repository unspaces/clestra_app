// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

const DETAIL_DRAWING_METHOD = "clestra_app.clestra_selling.doctype.detail_drawing.detail_drawing";

frappe.listview_settings["Detail Drawing"] = {
	add_fields: ["drawing_pdf", "check_status"],

	get_indicator(doc) {
		const colors = { Done: "green", Review: "orange", Pending: "gray" };
		const status = doc.check_status || "Pending";
		return [__(status), colors[status] || "gray", `check_status,=,${status}`];
	},

	// One-click PDF open from the list, mainly for sales.
	button: {
		show: (doc) => !!doc.drawing_pdf,
		get_label: () => __("PDF"),
		get_description: (doc) => __("Open {0}", [doc.name]),
		action: (doc) => window.open(doc.drawing_pdf, "_blank"),
	},

	onload(listview) {
		if (!frappe.model.can_write("Detail Drawing")) return;
		listview.page.add_inner_button(__("Bulk Upload PDFs"), () =>
			open_bulk_upload_dialog(listview)
		);
	},
};

function open_bulk_upload_dialog(listview) {
	const d = new frappe.ui.Dialog({
		title: __("Bulk Upload Drawing PDFs"),
		fields: [
			{
				fieldtype: "HTML",
				options: `<p class="text-muted">${__(
					"Each PDF is matched to a drawing by its file name. For example, <b>+D-FPDU-C26-FGD54N-001.pdf</b> goes to drawing <b>+D-FPDU-C26-FGD54N-001</b>. Uploading a new PDF for a drawing replaces it, and the old one stays in that drawing's attachments."
				)}</p>`,
			},
			{
				fieldname: "create_missing",
				fieldtype: "Check",
				label: __("Create a new drawing when no code matches"),
				default: 0,
			},
		],
		primary_action_label: __("Select PDFs"),
		primary_action(values) {
			d.hide();
			start_upload(listview, !!values.create_missing);
		},
	});
	d.show();
}

function start_upload(listview, create_missing) {
	const results = [];
	const uploader = new frappe.ui.FileUploader({
		dialog_title: __("Select drawing PDFs"),
		method: `${DETAIL_DRAWING_METHOD}.${
			create_missing ? "upload_pdf_create_missing" : "upload_pdf"
		}`,
		allow_multiple: true,
		make_attachments_public: false,
		disable_file_browser: true,
		allow_web_link: false,
		allow_take_photo: false,
		allow_toggle_private: false,
		allow_google_drive: false,
		restrictions: { allowed_file_types: [".pdf"] },
		on_success(_file_doc, r) {
			if (r && r.message && r.message.status) results.push(r.message);
		},
	});

	uploader.dialog.onhide = () => {
		if (!results.length) return;
		show_summary(results);
		listview.refresh();
	};
}

function show_summary(results) {
	const labels = {
		created: __("New drawing created"),
		attached: __("PDF attached"),
		replaced: __("PDF replaced (new version)"),
		unchanged: __("Same PDF already attached"),
		not_found: __("No matching drawing code"),
		invalid: __("Not a PDF"),
	};
	const counts = {};
	results.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));

	const count_rows = Object.keys(labels)
		.filter((k) => counts[k])
		.map((k) => `<tr><td>${labels[k]}</td><td class="text-right">${counts[k]}</td></tr>`)
		.join("");

	const problems = results.filter((r) => ["not_found", "invalid"].includes(r.status));
	const problem_rows = problems
		.map(
			(r) =>
				`<tr><td>${frappe.utils.escape_html(r.file_name)}</td><td>${
					labels[r.status]
				}</td></tr>`
		)
		.join("");

	frappe.msgprint({
		title: __("Upload result: {0} file(s)", [results.length]),
		indicator: problems.length ? "orange" : "green",
		message: `
			<table class="table table-bordered table-sm">${count_rows}</table>
			${
				problems.length
					? `<p><b>${__("Check these files")}</b></p>
					   <table class="table table-bordered table-sm">${problem_rows}</table>`
					: ""
			}`,
	});
}

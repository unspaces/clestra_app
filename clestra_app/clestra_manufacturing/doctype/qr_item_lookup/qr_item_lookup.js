// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on('QR Item Lookup', {
	refresh: function(frm) {
		// Custom grid columns for items table (similar to PBM detail_bom_items)
		const items_cols = [
			"item_code", "item_name", "product_section",
			"zone", "color", "size", "qty",
			"product_position_desc", "print_count"
		];
		setup_qr_grid_columns(frm, 'items', items_cols);

		// Hide row index and add/delete controls
		const grid = frm.fields_dict['items']?.grid;
		if (grid) {
			grid.cannot_add_rows = true;
			grid.wrapper.find('.grid-add-row, .grid-remove-rows').hide();
		}

		// Inject print buttons into grid rows after render
		setTimeout(() => setup_print_buttons(frm), 300);

		// Add "Print All Labels" button
		if (frm.doc.items && frm.doc.items.length) {
			frm.add_custom_button(__('Print All Labels'), () => {
				print_all_labels(frm);
			}, __('Actions'));

			frm.add_custom_button(__('Print Selected'), () => {
				print_selected_labels(frm);
			}, __('Actions'));
		}
	}
});

function setup_qr_grid_columns(frm, fieldname, columns) {
	const grid = frm.fields_dict[fieldname]?.grid;
	if (!grid || !grid.doctype) return;

	const child_meta = frappe.get_meta(grid.doctype);
	if (!child_meta || !child_meta.fields) return;

	// Reset user column settings then apply custom columns
	child_meta.fields.forEach(df => {
		df.in_list_view = columns.includes(df.fieldname) ? 1 : 0;
		if (df.fieldname === 'print_count') {
			df.columns = 1;
		}
	});
	grid.reset_grid();
}

function setup_print_buttons(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid || !grid.grid_rows) return;

	grid.grid_rows.forEach(grid_row => {
		if (!grid_row.wrapper) return;

		const $editCol = grid_row.wrapper.find('.btn-open-row').closest('.col');
		if (!$editCol.length || $editCol.find('.print-row-btn').length) return;

		const row_doc = grid_row.doc;
		const printCount = row_doc.print_count || 0;

		const $printBtn = $(`
			<span class="print-row-btn" title="${__('Print QR Label')}" data-row-name="${row_doc.name}">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="6 9 6 2 18 2 18 9"></polyline>
					<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
					<rect x="6" y="14" width="12" height="8"></rect>
				</svg>
				${printCount > 0 ? `<span class="print-count-badge">${printCount}</span>` : ''}
			</span>
		`);

		$editCol.find('.btn-open-row').before($printBtn);

		$printBtn.on('click', function(e) {
			e.stopPropagation();
			e.preventDefault();
			print_single_label(frm, row_doc);
		});
	});
}

function print_single_label(frm, row_doc) {
	// Increment print count via API
	frappe.call({
		method: 'clestra_app.clestra_manufacturing.qr_code_api.increment_print_count',
		args: {
			qr_lookup_name: frm.doc.name,
			child_row_name: row_doc.name
		},
		callback: (r) => {
			if (r.message) {
				// Update local count
				row_doc.print_count = r.message.print_count;
				frm.dirty();
				frm.refresh_fields();
				setTimeout(() => setup_print_buttons(frm), 200);
			}
		}
	});

	// Open print window
	open_label_print_window(frm, [row_doc]);
}

function print_all_labels(frm) {
	const items = frm.doc.items || [];
	if (!items.length) return;

	// Increment print count for all
	frappe.call({
		method: 'clestra_app.clestra_manufacturing.qr_code_api.increment_print_count_bulk',
		args: {
			qr_lookup_name: frm.doc.name,
			child_row_names: JSON.stringify(items.map(r => r.name))
		},
		callback: (r) => {
			if (r.message) {
				r.message.forEach(upd => {
					const row = items.find(i => i.name === upd.name);
					if (row) row.print_count = upd.print_count;
				});
				frm.dirty();
				frm.refresh_fields();
				setTimeout(() => setup_print_buttons(frm), 200);
			}
		}
	});

	open_label_print_window(frm, items);
}

function print_selected_labels(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid) return;

	const selected = grid.get_selected_children();
	if (!selected || !selected.length) {
		frappe.msgprint(__('Please select rows to print.'));
		return;
	}

	// Increment print count for selected
	frappe.call({
		method: 'clestra_app.clestra_manufacturing.qr_code_api.increment_print_count_bulk',
		args: {
			qr_lookup_name: frm.doc.name,
			child_row_names: JSON.stringify(selected.map(r => r.name))
		},
		callback: (r) => {
			if (r.message) {
				r.message.forEach(upd => {
					const row = (frm.doc.items || []).find(i => i.name === upd.name);
					if (row) row.print_count = upd.print_count;
				});
				frm.dirty();
				frm.refresh_fields();
				setTimeout(() => setup_print_buttons(frm), 200);
			}
		}
	});

	open_label_print_window(frm, selected);
}

function open_label_print_window(frm, items) {
	const pbm = frm.doc.pbm || '';
	const project = frm.doc.project || '';

	// Resolve Item.item_code from Item.name for all items
	const itemLinks = [...new Set(items.map(i => i.item_code).filter(Boolean))];

	frappe.call({
		method: 'clestra_app.clestra_manufacturing.qr_code_api.resolve_item_codes',
		args: { item_links: JSON.stringify(itemLinks) },
		async: false,
		callback: (r) => {
			const codeMap = r.message || {};
			items.forEach(item => {
				item._display_code = codeMap[item.item_code] || item.item_code;
			});
		}
	});

	let labelsHtml = '';
	items.forEach(item => {
		const qrImg = item.qr_image
			? `<img src="${item.qr_image}">`
			: `<div class="no-qr">No QR</div>`;

		labelsHtml += `
			<div class="sticker">
				<div class="item-code">${item._display_code || item.item_code || ''}</div>
				<div class="item-name">${item.item_name || ''}</div>
				<div class="qr">${qrImg}</div>
			</div>
		`;
	});

	const printWindow = window.open('', '_blank');
	printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>QR Labels - ${pbm}</title>
<style>
	@page { size: 40mm 40mm; margin: 0; }
	* { margin: 0; padding: 0; box-sizing: border-box; }
	body {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	}
	.sticker {
		width: 40mm; height: 40mm; padding: 1mm;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		text-align: center;
		page-break-after: always;
	}
	.sticker:last-child { page-break-after: auto; }
	.item-code { font-size: 9px; font-weight: 700; color: #000; word-break: break-all; line-height: 1.2; }
	.item-name { font-size: 6px; color: #555; margin-top: 0.5mm; line-height: 1.2; max-width: 38mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
	.qr { margin: 1mm 0; }
	.qr img { width: 22mm; height: 22mm; display: block; }
	.no-qr { width: 22mm; height: 22mm; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #999; }
</style>
</head>
<body>
	${labelsHtml}
	<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
	printWindow.document.close();
}

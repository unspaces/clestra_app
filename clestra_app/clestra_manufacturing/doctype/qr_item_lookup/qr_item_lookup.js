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
	const siteUrl = frappe.urllib.get_base_url();
	const pbm = frm.doc.pbm || '';
	const project = frm.doc.project || '';

	let labelsHtml = '';
	items.forEach(item => {
		const qrImgSrc = item.qr_image
			? `<img src="${item.qr_image}" style="width:100px;height:100px;">`
			: `<div style="width:100px;height:100px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">No QR</div>`;

		labelsHtml += `
			<div class="qr-label">
				<div class="qr-label-image">${qrImgSrc}</div>
				<div class="qr-label-info">
					<div class="qr-label-item-code">${item.item_code || ''}</div>
					<div class="qr-label-item-name">${item.item_name || ''}</div>
					<div class="qr-label-details">
						${item.zone ? `<span>Zone: ${item.zone}</span>` : ''}
						${item.color ? `<span>Color: ${item.color}</span>` : ''}
						${item.size ? `<span>Size: ${item.size}</span>` : ''}
						${item.qty ? `<span>Qty: ${item.qty}</span>` : ''}
					</div>
					<div class="qr-label-position">
						${item.product_position_desc ? `Pos: ${item.product_position_desc}` : ''}
					</div>
				</div>
			</div>
		`;
	});

	const printWindow = window.open('', '_blank');
	printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>QR Labels - ${pbm}</title>
<style>
	@media print {
		@page { margin: 5mm; }
		body { margin: 0; }
	}
	body {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		margin: 10px;
	}
	.print-header {
		text-align: center;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid #ddd;
		font-size: 12px;
		color: #666;
	}
	.qr-labels-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.qr-label {
		display: flex;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 8px;
		width: 280px;
		page-break-inside: avoid;
	}
	.qr-label-image {
		flex-shrink: 0;
		margin-right: 8px;
	}
	.qr-label-image img {
		display: block;
	}
	.qr-label-info {
		flex: 1;
		min-width: 0;
		font-size: 11px;
	}
	.qr-label-item-code {
		font-weight: 700;
		font-size: 13px;
		margin-bottom: 2px;
		word-break: break-all;
	}
	.qr-label-item-name {
		color: #555;
		margin-bottom: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.qr-label-details span {
		display: inline-block;
		background: #f0f0f0;
		padding: 1px 5px;
		border-radius: 3px;
		margin: 1px 2px 1px 0;
		font-size: 10px;
	}
	.qr-label-position {
		margin-top: 3px;
		font-size: 10px;
		color: #666;
	}
</style>
</head>
<body>
	<div class="print-header">
		PBM: ${pbm} | Project: ${project} | ${items.length} label(s) | ${new Date().toLocaleString()}
	</div>
	<div class="qr-labels-grid">${labelsHtml}</div>
	<script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
	printWindow.document.close();
}

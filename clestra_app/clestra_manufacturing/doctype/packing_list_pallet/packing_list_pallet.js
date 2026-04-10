// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on('Packing List Pallet', {
	refresh: function(frm) {
		if (frm.is_new()) return;

		// Pallet QR print
		frm.add_custom_button(__('Print Pallet QR'), () => {
			open_pallet_qr_print(frm);
		}, __('Print'));

		// All item QR print
		if (frm.doc.items && frm.doc.items.length) {
			frm.add_custom_button(__('Print All Item QR'), () => {
				print_item_qrs(frm, frm.doc.items);
			}, __('Print'));

			frm.add_custom_button(__('Print Selected Item QR'), () => {
				const grid = frm.fields_dict['items']?.grid;
				const selected = grid?.get_selected_children();
				if (!selected || !selected.length) {
					frappe.msgprint(__('Please select items to print.'));
					return;
				}
				print_item_qrs(frm, selected);
			}, __('Print'));
		}

		// Add items from PBM
		frm.add_custom_button(__('Add Items from PBM'), () => {
			show_pbm_item_selector(frm);
		}, __('Actions'));

		// Scan page link
		frm.add_custom_button(__('Open Scanner'), () => {
			window.open(`/scan?pallet=${frm.doc.name}`, '_blank');
		}, __('Actions'));
	}
});

function show_pbm_item_selector(frm) {
	// Get the packing list to find linked PBMs
	if (!frm.doc.packing_list) {
		frappe.msgprint(__('Please set the Project Packing List first.'));
		return;
	}

	frappe.call({
		method: 'frappe.client.get',
		args: {
			doctype: 'Project Packing List',
			name: frm.doc.packing_list,
		},
		callback: (r) => {
			if (!r.message) return;
			const ppl = r.message;
			const pbm_list = (ppl.pbm_items || []).map(p => p.project_billing_master);

			if (!pbm_list.length) {
				frappe.msgprint(__('No PBMs linked to this Packing List.'));
				return;
			}

			// Let user pick a PBM
			const d = new frappe.ui.Dialog({
				title: __('Select PBM'),
				fields: [
					{
						fieldname: 'pbm',
						fieldtype: 'Select',
						label: __('Project Billing Master'),
						options: pbm_list.join('\n'),
						reqd: 1,
					}
				],
				primary_action_label: __('Load Items'),
				primary_action: (values) => {
					d.hide();
					load_pbm_items_for_selection(frm, values.pbm);
				}
			});
			d.show();
		}
	});
}

function load_pbm_items_for_selection(frm, pbm_name) {
	frappe.call({
		method: 'clestra_app.clestra_manufacturing.doctype.packing_list_pallet.packing_list_pallet.get_pbm_detail_items',
		args: { pbm_name: pbm_name, pallet_name: frm.doc.name },
		callback: (r) => {
			if (!r.message || !r.message.length) {
				frappe.msgprint(__('No unassigned items found in this PBM.'));
				return;
			}

			const items = r.message;
			const fields = [
				{
					fieldname: 'items_html',
					fieldtype: 'HTML',
				}
			];

			const d = new frappe.ui.Dialog({
				title: __('Select Items to Add — {0}', [pbm_name]),
				fields: fields,
				size: 'extra-large',
				primary_action_label: __('Add Selected'),
				primary_action: () => {
					const checked = [];
					d.$wrapper.find('input.item-check:checked').each(function() {
						const idx = $(this).data('idx');
						checked.push(items[idx]);
					});

					if (!checked.length) {
						frappe.msgprint(__('No items selected.'));
						return;
					}

					checked.forEach(item => {
						const row = frm.add_child('items');
						row.item_code = item.item_code;
						row.item_name = item.item_name;
						row.project_billing_master = pbm_name;
						row.zone = item.zone;
						row.parent_product_code = item.fg_item_code || item.parent_item_code || '';
						row.qty = item.qty || 1;
					});

					frm.refresh_field('items');
					frm.dirty();
					d.hide();
					frappe.show_alert({message: __("{0} items added", [checked.length]), indicator: 'green'});
				}
			});

			// Build checkbox table
			let html = '<div style="max-height:400px;overflow:auto;">';
			html += '<table class="table table-bordered table-sm" style="font-size:12px;">';
			html += `<thead><tr>
				<th><input type="checkbox" class="check-all"></th>
				<th>${__('Item Code')}</th>
				<th>${__('Item Name')}</th>
				<th>${__('Zone')}</th>
				<th>${__('Size')}</th>
				<th>${__('Qty')}</th>
				<th>${__('Status')}</th>
			</tr></thead><tbody>`;

			items.forEach((item, i) => {
				const statusBadge = item.assigned
					? `<span class="badge badge-warning">${__('Assigned')}</span>`
					: `<span class="badge badge-success">${__('Available')}</span>`;
				html += `<tr>
					<td><input type="checkbox" class="item-check" data-idx="${i}" ${item.assigned ? 'disabled' : ''}></td>
					<td>${item.item_code || ''}</td>
					<td>${item.item_name || ''}</td>
					<td>${item.zone || ''}</td>
					<td>${item.size || ''}</td>
					<td>${item.qty || ''}</td>
					<td>${statusBadge}</td>
				</tr>`;
			});
			html += '</tbody></table></div>';

			d.fields_dict.items_html.$wrapper.html(html);

			// Check-all handler
			d.$wrapper.on('change', '.check-all', function() {
				const checked = $(this).prop('checked');
				d.$wrapper.find('.item-check:not(:disabled)').prop('checked', checked);
			});

			d.show();
		}
	});
}

function open_pallet_qr_print(frm) {
	const printWindow = window.open('', '_blank');
	printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Pallet QR — ${frm.doc.name}</title>
<style>
	@page { size: 50mm 50mm; margin: 2mm; }
	body { font-family: sans-serif; text-align: center; margin: 0; padding: 2mm; }
	.logo { font-size: 8px; font-weight: bold; color: #333; margin-bottom: 1mm; }
	.qr img { width: 38mm; height: 38mm; }
	.label { font-size: 9px; font-weight: bold; margin-top: 1mm; }
	.project { font-size: 7px; color: #666; }
</style></head>
<body>
	<div class="logo">eClestra</div>
	<div class="qr">${frm.doc.pallet_qr_image
		? `<img src="${frm.doc.pallet_qr_image}">`
		: '<div style="width:38mm;height:38mm;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8px;">No QR</div>'
	}</div>
	<div class="label">${frm.doc.name}</div>
	<div class="project">${frm.doc.project_name || ''}</div>
	<script>window.onload = function() { window.print(); }</script>
</body></html>`);
	printWindow.document.close();
}

function print_item_qrs(frm, items) {
	let labelsHtml = '';
	items.forEach(item => {
		const qrImg = item.item_qr_image
			? `<img src="${item.item_qr_image}" style="width:22mm;height:22mm;">`
			: '<div style="width:22mm;height:22mm;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:6px;">No QR</div>';
		labelsHtml += `<div class="item-label">
			${qrImg}
			<div class="item-code">${item.item_code || ''}</div>
		</div>`;
	});

	const printWindow = window.open('', '_blank');
	printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Item QR Labels — ${frm.doc.name}</title>
<style>
	@page { margin: 3mm; }
	body { font-family: sans-serif; margin: 0; padding: 2mm; }
	.grid { display: flex; flex-wrap: wrap; gap: 2mm; }
	.item-label {
		width: 30mm; height: 30mm;
		border: 0.5px solid #ddd;
		text-align: center;
		padding: 1mm;
		page-break-inside: avoid;
	}
	.item-code { font-size: 6px; font-weight: bold; margin-top: 1mm; word-break: break-all; }
</style></head>
<body>
	<div class="grid">${labelsHtml}</div>
	<script>window.onload = function() { window.print(); }</script>
</body></html>`);
	printWindow.document.close();
}

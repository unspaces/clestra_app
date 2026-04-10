// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Packing List', {
	refresh: function(frm) {
		render_pallet_qr_list(frm);
		setup_items_toolbar(frm);
		inject_load_btn_to_pbm_grid(frm);

		const grid = frm.fields_dict['items']?.grid;
		if (grid) {
			// Desired column order with widths (total ~10)
			const colConfig = {
				"pallet_no": 1,
				"qty": 1,
				"item_name": 3,
				"size": 2,
				"color": 1,
				"remark": 2,
			};
			const cols = Object.keys(colConfig);
			const meta = frappe.get_meta(grid.doctype);
			if (meta && meta.fields) {
				meta.fields.forEach(df => {
					if (cols.includes(df.fieldname)) {
						df.in_list_view = 1;
						df.columns = colConfig[df.fieldname];
					} else {
						df.in_list_view = 0;
						df.columns = 0;
					}
				});

				// Reorder meta.fields so cols appear first in the desired order
				const ordered = [];
				cols.forEach(fn => {
					const df = meta.fields.find(f => f.fieldname === fn);
					if (df) ordered.push(df);
				});
				meta.fields.forEach(df => {
					if (!cols.includes(df.fieldname)) ordered.push(df);
				});
				meta.fields = ordered;

				grid.reset_grid();
			}

			// Hook grid page changes + refresh to re-inject buttons
			if (!frm._ppl_grid_hooked) {
				const origChangePage = grid.change_page?.bind(grid);
				if (origChangePage) {
					grid.change_page = function(dir) {
						origChangePage(dir);
						setTimeout(() => reinject_buttons(frm), 100);
					};
				}
				const origRefresh = grid.refresh?.bind(grid);
				if (origRefresh) {
					grid.refresh = function() {
						origRefresh();
						setTimeout(() => reinject_buttons(frm), 100);
					};
				}
				// Catch row collapse via wrapper click delegation
				grid.wrapper.on('click', '.grid-collapse-row, .btn-open-row, .grid-form-heading, .row-index', function() {
					setTimeout(() => reinject_buttons(frm), 200);
				});
				frm._ppl_grid_hooked = true;
			}
		}

		setTimeout(() => reinject_buttons(frm), 300);

		// Render item_name + handle_direct in grid
		setTimeout(() => render_item_name_display(frm), 400);
	},

	project: function(frm) {
		if (!frm.doc.project) return;
		frappe.call({
			method: 'clestra_app.clestra_manufacturing.doctype.project_packing_list.project_packing_list.get_pbm_list',
			args: { project: frm.doc.project },
			callback: (r) => {
				if (!r.message || !r.message.length) {
					frappe.msgprint(__('No PBMs found for this project.'));
					return;
				}
				frm.clear_table('pbm_items');
				r.message.forEach(pbm => {
					const row = frm.add_child('pbm_items');
					row.project_billing_master = pbm.name;
					row.pbm_name = pbm.name;
					row.door_count = pbm.door_count || 0;
					row.leaf_count = pbm.leaf_count || 0;
					row.panel_count = pbm.panel_count || 0;
					row.sub_items_count = pbm.sub_items_count || 0;
				});
				frm.refresh_field('pbm_items');
				frm.dirty();
			}
		});
	}
});

frappe.ui.form.on('Packing List Detail', {
	form_render: function(frm) {
		setTimeout(() => reinject_buttons(frm), 100);
	},
	pallet_no: function(frm) {
		setTimeout(() => reinject_buttons(frm), 100);
	}
});

// ============================================================
// Load Items button in pbm_items grid footer
// ============================================================
function inject_load_btn_to_pbm_grid(frm) {
	const grid = frm.fields_dict['pbm_items']?.grid;
	if (!grid || !grid.wrapper) return;

	// Hide Add Row and Delete buttons
	grid.wrapper.find('.grid-add-row, .grid-remove-rows, .grid-remove-all-rows').hide();

	const $footer = grid.wrapper.find('.grid-footer');
	if (!$footer.length || $footer.find('.ppl-load-btn').length) return;

	const $btn = $(`<button class="btn btn-xs btn-primary ppl-load-btn">
		<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:3px;">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>
		</svg>${__('Load Items')}</button>`);

	$btn.on('click', () => load_items_from_pbms(frm));
	$footer.prepend($btn);
}

function reinject_buttons(frm) {
	setup_row_buttons(frm);
	hide_grid_row_index(frm);
	render_item_name_display(frm);
	render_pallet_no_display(frm);
}

// ============================================================
// Render item_name + handle_direct combined in grid
// ============================================================
function render_item_name_display(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid || !grid.grid_rows) return;

	grid.grid_rows.forEach(grid_row => {
		if (!grid_row.wrapper || !grid_row.doc) return;
		const doc = grid_row.doc;
		if (!doc.handle_direct) return;

		const $cell = $(grid_row.wrapper).find('[data-fieldname="item_name"] .static-area');
		if ($cell.length) {
			const combined = `${doc.item_name || ''} <span style="color:#718096;font-size:0.85em;">[${doc.handle_direct}]</span>`;
			$cell.html(combined);
		}
	});
}

function render_pallet_no_display(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid || !grid.grid_rows) return;

	const prefix = frm.doc.pallet_prefix || '#';

	grid.grid_rows.forEach(grid_row => {
		if (!grid_row.wrapper || !grid_row.doc) return;
		const pno = cint(grid_row.doc.pallet_no);
		const $cell = $(grid_row.wrapper).find('[data-fieldname="pallet_no"] .static-area');
		if (!$cell.length) return;

		const displayHtml = pno > 0
			? `<span class="ppl-pallet-label" style="font-weight:600;color:#2b6cb0;">${prefix}${pno}</span>`
			: `<span class="ppl-pallet-label" style="color:#a0aec0;">—</span>`;
		$cell.html(displayHtml);

		// MutationObserver: if Frappe resets the text, re-apply immediately
		if (!$cell.data('ppl-observed')) {
			const observer = new MutationObserver(() => {
				if (!$cell.find('.ppl-pallet-label').length) {
					const currentPno = cint(grid_row.doc.pallet_no);
					const html = currentPno > 0
						? `<span class="ppl-pallet-label" style="font-weight:600;color:#2b6cb0;">${prefix}${currentPno}</span>`
						: `<span class="ppl-pallet-label" style="color:#a0aec0;">—</span>`;
					$cell.html(html);
				}
			});
			observer.observe($cell[0], { childList: true, characterData: true, subtree: true });
			$cell.data('ppl-observed', true);
		}
	});
}

// ============================================================
// Toolbar
// ============================================================
function setup_items_toolbar(frm) {
	const wrapper = frm.fields_dict.items_toolbar?.$wrapper;
	if (!wrapper) return;

	const prefix = frm.doc.pallet_prefix || '#';

	const palletNos = new Set();
	(frm.doc.items || []).forEach(r => {
		if (r.pallet_no && r.pallet_no > 0) palletNos.add(r.pallet_no);
	});
	const sortedPallets = Array.from(palletNos).sort((a, b) => a - b);
	const unassignedCount = (frm.doc.items || []).filter(r => !r.pallet_no || r.pallet_no === 0).length;
	const pbmList = (frm.doc.pbm_items || []).map(r => r.project_billing_master).filter(Boolean);

	const totalItems = (frm.doc.items || []).length;

	let html = '<div class="ppl-toolbar">';

	// --- Action bar ---
	html += '<div class="ppl-actions">';
	html += `<button class="btn btn-sm btn-default ppl-edit-btn">
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:3px;">
			<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
		</svg>${__('Assign Pallet')}</button>`;
	html += `<button class="btn btn-sm btn-default ppl-split-btn">
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:3px;">
			<line x1="12" y1="2" x2="12" y2="22"></line><polyline points="17 7 12 2 7 7"></polyline><polyline points="17 17 12 22 7 17"></polyline>
		</svg>${__('Split Qty')}</button>`;
	if (pbmList.length > 1) {
		html += `<div class="ppl-pbm-filter-wrap">
			<label>${__('PBM')}</label>
			<select class="form-control input-sm ppl-pbm-filter">
				<option value="">${__('All')}</option>`;
		pbmList.forEach(p => { html += `<option value="${p}">${p}</option>`; });
		html += `</select></div>`;
	}
	html += '</div>';

	// --- Filter tabs ---
	if (totalItems > 0) {
		html += '<div class="ppl-filter-bar">';
		html += `<span class="ppl-filter-label">${__('Filter')}:</span>`;
		html += `<div class="ppl-filter-tabs">`;
		html += `<button class="ppl-tab active" data-pallet="all">${__('All')} <em>${totalItems}</em></button>`;
		if (unassignedCount > 0) {
			html += `<button class="ppl-tab ppl-tab-warn" data-pallet="0">${__('Unassigned')} <em>${unassignedCount}</em></button>`;
		}
		sortedPallets.forEach(p => {
			const count = (frm.doc.items || []).filter(r => cint(r.pallet_no) === p).length;
			html += `<button class="ppl-tab" data-pallet="${p}">${prefix}${p} <em>${count}</em></button>`;
		});
		html += `</div>`;
		html += '</div>';
	}

	html += '</div>';
	wrapper.html(html);

	// --- Event handlers ---
	wrapper.find('.ppl-edit-btn').on('click', () => show_pallet_assign_dialog(frm));
	wrapper.find('.ppl-split-btn').on('click', () => show_split_dialog(frm));

	wrapper.find('.ppl-pbm-filter').on('change', function() {
		frm._ppl_pbm_filter = $(this).val();
		apply_filters(frm);
	});

	wrapper.find('.ppl-tab').on('click', function() {
		wrapper.find('.ppl-tab').removeClass('active');
		$(this).addClass('active');
		frm._ppl_pallet_filter = String($(this).data('pallet'));
		apply_filters(frm);
	});
}

// ============================================================
// Load PBM items (checked rows in pbm_items only)
// ============================================================
function load_items_from_pbms(frm) {
	const pbmGrid = frm.fields_dict['pbm_items']?.grid;
	const selected = pbmGrid?.get_selected_children();

	if (!selected || !selected.length) {
		frappe.msgprint(__('Please check the PBMs you want to load in the Billing Masters table.'));
		return;
	}

	const pbmNames = selected.map(r => r.project_billing_master).filter(Boolean);
	if (!pbmNames.length) {
		frappe.msgprint(__('Selected PBM rows have no Project Billing Master set.'));
		return;
	}

	const existingItems = (frm.doc.items || []).map(r => ({source_row_name: r.source_row_name}));

	frappe.call({
		method: 'clestra_app.clestra_manufacturing.doctype.project_packing_list.project_packing_list.load_pbm_items',
		args: {
			pbm_names: JSON.stringify(pbmNames),
			existing_items_json: JSON.stringify(existingItems),
		},
		freeze: true,
		freeze_message: __('Loading items...'),
		callback: (r) => {
			if (!r.message || !r.message.length) {
				frappe.msgprint(__('No new items found.'));
				return;
			}

			r.message.forEach(item => {
				const row = frm.add_child('items');
				row.pbm_name = item.pbm_name;
				row.source_table = item.source_table;
				row.source_row_name = item.source_row_name;
				row.item_code = item.item_code;
				row.item_name = item.item_name;
				row.handle_direct = item.handle_direct;
				row.product_section = item.product_section;
				row.product_keyword = item.product_keyword;
				row.zone = item.zone;
				row.color = item.color;
				row.size = item.size;
				row.qty = item.qty;
				row.combined_qty = item.combined_qty;
				row.combined_from = item.combined_from;
				row.remark = item.remark;
				row.parent_item_code = item.parent_item_code;
				row.item_qr_token = item.item_qr_token;
				row.item_qr_image = item.item_qr_image;
				row.pallet_no = 0;
			});

			frm.refresh_field('items');
			frm.dirty();
			setup_items_toolbar(frm);
			setTimeout(() => reinject_buttons(frm), 200);
			frappe.show_alert({message: __("{0} items loaded", [r.message.length]), indicator: 'green'});
		}
	});
}

// ============================================================
// Generate Pallet QR (without full save)
// ============================================================
function generate_pallet_qrs(frm) {
	const count = cint(frm.doc.pallet_count);
	if (!count || count <= 0) {
		frappe.msgprint(__('Set "Number of Pallets to Create" first.'));
		return;
	}

	frappe.call({
		method: 'clestra_app.clestra_manufacturing.doctype.project_packing_list.project_packing_list.generate_pallet_qrs',
		args: { ppl_name: frm.doc.name, pallet_count: count },
		freeze: true,
		freeze_message: __('Creating Pallet QR codes...'),
		callback: (r) => {
			if (r.message) {
				if (r.message.pallet_qr_tokens) {
					frm.doc.pallet_qr_tokens = r.message.pallet_qr_tokens;
				}
				render_pallet_qr_list(frm);
				setup_items_toolbar(frm);
				frappe.show_alert({message: r.message.message, indicator: r.message.status === 'success' ? 'green' : 'orange'});
			}
		}
	});
}

// ============================================================
// Pallet QR list (rendered in pallet_qr_list HTML field)
// ============================================================
function render_pallet_qr_list(frm) {
	const wrapper = frm.fields_dict.pallet_qr_list?.$wrapper;
	if (!wrapper) return;

	const prefix = frm.doc.pallet_prefix || '#';
	let tokens = {};
	try {
		tokens = JSON.parse(frm.doc.pallet_qr_tokens || '{}');
	} catch(e) {}

	const keys = Object.keys(tokens).sort((a, b) => cint(a) - cint(b));

	if (!keys.length) {
		wrapper.html(`<div class="text-muted" style="padding:8px 0;font-size:12px;">
			${__('No pallets created yet. Set the count above and click "Create Pallet QR".')}
		</div>`);
		return;
	}

	const qrIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
		<rect x="3" y="3" width="7" height="7" rx="1"></rect>
		<rect x="14" y="3" width="7" height="7" rx="1"></rect>
		<rect x="14" y="14" width="7" height="7" rx="1"></rect>
		<rect x="3" y="14" width="7" height="7" rx="1"></rect>
	</svg>`;

	let html = '<div class="ppl-pallet-chips">';
	keys.forEach(key => {
		const data = tokens[key];
		const label = `${prefix}${key}`;
		const hasQr = !!data.qr_image;
		html += `<span class="ppl-pallet-chip ${hasQr ? 'has-qr' : ''}" data-pallet="${key}" title="${hasQr ? __('Click to print') : __('QR not generated')}">
			<span class="ppl-chip-icon">${qrIcon}</span>
			<span class="ppl-chip-label">${label}</span>
		</span>`;
	});
	html += '</div>';

	wrapper.html(html);

	// Print on chip click
	wrapper.find('.ppl-pallet-chip.has-qr').on('click', function() {
		const pno = cint($(this).data('pallet'));
		print_pallet_qr(frm, pno);
	});

	// Inject "Create Pallet QR" button next to pallet_count field
	if (!frm.is_new()) {
		const $palletCountField = frm.fields_dict.pallet_count?.$wrapper;
		if ($palletCountField && !$palletCountField.find('.ppl-create-pallet-qr-btn').length) {
			const $btn = $(`<button class="btn btn-xs btn-primary ppl-create-pallet-qr-btn" style="margin-left:8px;vertical-align:middle;">${__('Create Pallet QR')}</button>`);
			$btn.on('click', () => generate_pallet_qrs(frm));
			$palletCountField.find('.control-input-wrapper, .control-input').first().append($btn);
		}
	}
}

// ============================================================
// Assign pallet dialog (uses prefix)
// ============================================================
function show_pallet_assign_dialog(frm) {
	const grid = frm.fields_dict['items']?.grid;
	const selected = grid?.get_selected_children();

	if (!selected || !selected.length) {
		frappe.msgprint(__('Select items using checkboxes first.'));
		return;
	}

	const prefix = frm.doc.pallet_prefix || '#';
	let optionLines = [`0|||${__('Unassigned')}`];
	for (let i = 1; i <= 30; i++) {
		optionLines.push(`${i}|||${prefix}${i}`);
	}

	const d = new frappe.ui.Dialog({
		title: __('Assign Pallet to {0} item(s)', [selected.length]),
		fields: [
			{
				fieldname: 'pallet_no',
				fieldtype: 'Select',
				label: __('Pallet'),
				options: optionLines.map(o => o.split('|||')[0]).join('\n'),
				default: '1',
				reqd: 1,
			},
			{
				fieldname: 'pallet_label_html',
				fieldtype: 'HTML',
			}
		],
		primary_action_label: __('Assign'),
		primary_action: (values) => {
			const palletNo = cint(values.pallet_no);
			selected.forEach(row => {
				frappe.model.set_value(row.doctype, row.name, 'pallet_no', palletNo);
			});
			frm.refresh_field('items');
			frm.dirty();
			d.hide();
			setup_items_toolbar(frm);
			setTimeout(() => reinject_buttons(frm), 200);
			const label = palletNo === 0 ? __('Unassigned') : `${prefix}${palletNo}`;
			frappe.show_alert({message: __("{0} items → {1}", [selected.length, label]), indicator: 'green'});
		}
	});

	// Show preview label
	const updateLabel = () => {
		const val = cint(d.get_value('pallet_no'));
		const label = val === 0 ? __('Unassigned') : `${prefix}${val}`;
		d.fields_dict.pallet_label_html.$wrapper.html(
			`<div style="padding:8px 0;font-size:1.1em;font-weight:600;">${__('Selected')}: ${label}</div>`
		);
	};
	d.$wrapper.on('change', '[data-fieldname="pallet_no"]', updateLabel);
	d.show();
	updateLabel();
}

// ============================================================
// Split qty dialog
// ============================================================
function show_split_dialog(frm) {
	const grid = frm.fields_dict['items']?.grid;
	const selected = grid?.get_selected_children();

	if (!selected || selected.length !== 1) {
		frappe.msgprint(__('Select exactly one item to split.'));
		return;
	}

	const item = selected[0];
	const prefix = frm.doc.pallet_prefix || '#';
	const totalQty = flt(item.qty);

	// Build pallet options with prefix labels
	let palletOptionHtml = '<option value="0">— Unassigned —</option>';
	for (let i = 1; i <= 30; i++) {
		palletOptionHtml += `<option value="${i}">${prefix}${i}</option>`;
	}

	const d = new frappe.ui.Dialog({
		title: __('Split Qty — {0}', [item.item_code]),
		fields: [
			{ fieldtype: 'HTML', fieldname: 'split_content' },
		],
		primary_action_label: __('Split'),
		primary_action: () => {
			// Collect rows
			const splits = [];
			const usedPallets = new Set();
			let hasError = false;

			d.$wrapper.find('.split-row').each(function() {
				const pallet = cint($(this).find('.split-pallet').val());
				const qty = flt($(this).find('.split-qty').val());
				if (qty <= 0) return;

				if (pallet > 0 && usedPallets.has(pallet)) {
					frappe.msgprint(__('Pallet {0}{1} is selected more than once.', [prefix, pallet]));
					hasError = true;
					return false;
				}
				if (pallet > 0) usedPallets.add(pallet);
				splits.push({ pallet_no: pallet, qty: qty });
			});

			if (hasError) return;

			if (!splits.length) {
				frappe.msgprint(__('Enter at least one split row.'));
				return;
			}

			const splitTotal = splits.reduce((s, x) => s + x.qty, 0);
			if (splitTotal > totalQty) {
				frappe.msgprint(__('Split total ({0}) exceeds original qty ({1}).', [splitTotal, totalQty]));
				return;
			}

			frappe.call({
				method: 'clestra_app.clestra_manufacturing.doctype.project_packing_list.project_packing_list.split_item',
				args: {
					ppl_name: frm.doc.name,
					row_name: item.name,
					splits_json: JSON.stringify(splits),
				},
				freeze: true,
				callback: (r) => {
					if (r.message && r.message.status === 'success') {
						d.hide();
						frm.reload_doc();
						frappe.show_alert({message: r.message.message, indicator: 'green'});
					}
				}
			});
		}
	});

	function buildContent() {
		let html = `
		<div class="split-dialog-wrap" style="font-family:var(--font-stack);font-size:13px;">
			<div style="padding:6px 0 10px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;">
				<strong>${item.item_code}</strong> — ${item.item_name || ''}
				<div style="margin-top:4px;">
					<span style="font-weight:600;">Total Qty: ${totalQty}</span>
					<span class="split-remaining" style="margin-left:12px;color:#718096;"></span>
				</div>
			</div>
			<div class="split-rows-container"></div>
			<div style="margin-top:8px;">
				<button class="btn btn-xs btn-default split-add-row-btn">+ ${__('Add Row')}</button>
			</div>
			<div style="margin-top:6px;font-size:12px;color:#a0aec0;">
				${__('Remaining qty will be kept as unassigned automatically.')}
			</div>
		</div>`;
		return html;
	}

	function buildRow(idx) {
		return `
		<div class="split-row" data-idx="${idx}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
			<span style="min-width:18px;font-weight:600;color:#718096;">${idx}.</span>
			<select class="form-control input-sm split-pallet" style="width:140px;">${palletOptionHtml}</select>
			<input type="number" class="form-control input-sm split-qty" placeholder="Qty" style="width:90px;" min="0" step="1" value="0">
			<button class="btn btn-xs btn-danger split-remove-row" style="padding:2px 6px;" title="${__('Remove')}">✕</button>
		</div>`;
	}

	function updateRemaining() {
		let assigned = 0;
		d.$wrapper.find('.split-row').each(function() {
			assigned += flt($(this).find('.split-qty').val());
		});
		const remaining = totalQty - assigned;
		const color = remaining < 0 ? '#e53e3e' : '#718096';
		d.$wrapper.find('.split-remaining').html(
			`<span style="color:${color};font-weight:600;">${__('Remaining')}: ${remaining}</span>`
		);
	}

	d.fields_dict.split_content.$wrapper.html(buildContent());

	const $container = d.$wrapper.find('.split-rows-container');

	// Add initial row
	$container.append(buildRow(1));

	// Add Row button
	d.$wrapper.find('.split-add-row-btn').on('click', () => {
		const nextIdx = $container.find('.split-row').length + 1;
		$container.append(buildRow(nextIdx));
		updateRemaining();
	});

	// Remove row (delegated)
	$container.on('click', '.split-remove-row', function() {
		$(this).closest('.split-row').remove();
		// Re-number
		$container.find('.split-row').each(function(i) {
			$(this).attr('data-idx', i + 1).find('span:first').text((i + 1) + '.');
		});
		updateRemaining();
	});

	// Update remaining on qty change
	$container.on('input change', '.split-qty', updateRemaining);

	d.show();
	updateRemaining();
}

// ============================================================
// Grid row filtering (cint for safe comparison)
// ============================================================
function apply_filters(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid || !grid.grid_rows) return;

	const palletFilter = frm._ppl_pallet_filter;
	const pbmFilter = frm._ppl_pbm_filter;

	grid.grid_rows.forEach(row => {
		if (!row.wrapper) return;
		const doc = row.doc;
		let show = true;

		if (palletFilter !== undefined && palletFilter !== 'all') {
			show = show && (cint(doc.pallet_no) === cint(palletFilter));
		}
		if (pbmFilter) {
			show = show && (doc.pbm_name === pbmFilter);
		}
		row.wrapper.toggle(show);
	});
}

// ============================================================
// Row buttons
// ============================================================
function setup_row_buttons(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (!grid || !grid.grid_rows) return;

	const prefix = frm.doc.pallet_prefix || '#';

	// First row of each pallet group
	const firstRowOfPallet = {};
	(frm.doc.items || []).forEach(item => {
		const pno = cint(item.pallet_no);
		if (pno > 0 && !firstRowOfPallet[pno]) {
			firstRowOfPallet[pno] = item.name;
		}
	});

	grid.grid_rows.forEach(grid_row => {
		if (!grid_row.wrapper || !grid_row.doc) return;
		const $row = $(grid_row.wrapper);
		const doc = grid_row.doc;
		const pno = cint(doc.pallet_no);

		// Pallet QR button (inside row-check, after checkbox, first row of each pallet group)
		const $check = $row.find('.row-check, .grid-row-check').first();
		if ($check.length && pno > 0 && firstRowOfPallet[pno] === doc.name) {
			if (!$check.find('.pallet-qr-btn').length) {
				// Make row-check flex-column so button goes below checkbox
				$check.css({'display': 'flex', 'flex-direction': 'column', 'align-items': 'center', 'gap': '2px'});
				$check.append(`<div class="pallet-qr-btn" title="${__('Print Pallet QR')}: ${prefix}${pno}" data-pallet="${pno}"
					style="cursor:pointer;display:flex;align-items:center;gap:1px;">
					<span style="font-size:9px;font-weight:700;color:#2b6cb0;">P</span>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2b6cb0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="3" width="7" height="7" rx="1"></rect>
						<rect x="14" y="3" width="7" height="7" rx="1"></rect>
						<rect x="14" y="14" width="7" height="7" rx="1"></rect>
						<rect x="3" y="14" width="7" height="7" rx="1"></rect>
					</svg>
				</div>`);
				$check.find('.pallet-qr-btn').on('click', (e) => {
					e.stopPropagation();
					e.preventDefault();
					print_pallet_qr(frm, pno);
				});
			}
		}

		// Item QR button (right, all rows)
		const $editCol = $row.find('.btn-open-row').closest('.col');
		if ($editCol.length && !$editCol.find('.item-qr-btn').length) {
			const $itemBtn = $(`<span class="item-qr-btn" title="${__('Print Item QR')}" style="cursor:pointer;opacity:0.5;margin-right:4px;">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="6 9 6 2 18 2 18 9"></polyline>
					<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
					<rect x="6" y="14" width="12" height="8"></rect>
				</svg>
			</span>`);
			$itemBtn.on('click', (e) => {
				e.stopPropagation();
				print_item_qr(frm, doc);
			});
			$itemBtn.hover(function(){ $(this).css('opacity','1'); }, function(){ $(this).css('opacity','0.5'); });
			$editCol.find('.btn-open-row').before($itemBtn);
		}
	});
}

function hide_grid_row_index(frm) {
	const grid = frm.fields_dict['items']?.grid;
	if (grid && grid.wrapper) {
		grid.wrapper.find('.row-index').hide();
		grid.wrapper.find('.grid-heading-row .grid-row>.col-xs-1:first-child').hide();
	}
}

// ============================================================
// Print functions
// ============================================================
function print_pallet_qr(frm, palletNo) {
	let qrImageUrl = '';
	let palletLabel = '';
	try {
		const tokens = JSON.parse(frm.doc.pallet_qr_tokens || '{}');
		const data = tokens[String(palletNo)];
		if (data) {
			qrImageUrl = data.qr_image || '';
			palletLabel = data.label || '';
		}
	} catch(e) {}

	if (!qrImageUrl) {
		frappe.msgprint(__('Pallet QR not generated yet. Click "Generate Pallet QR" first.'));
		return;
	}

	const prefix = frm.doc.pallet_prefix || '#';
	if (!palletLabel) palletLabel = `${prefix}${palletNo}`;
	const items = (frm.doc.items || []).filter(r => cint(r.pallet_no) === palletNo);

	// Split project name near the middle for natural line break
	const fullName = frm.doc.project_name || '';
	let projectHtml = fullName;
	if (fullName.length > 10) {
		const mid = Math.ceil(fullName.length / 2);
		// Find nearest space around midpoint for natural break
		let breakIdx = mid;
		for (let offset = 0; offset < 10; offset++) {
			if (fullName[mid + offset] === ' ') { breakIdx = mid + offset; break; }
			if (mid - offset >= 0 && fullName[mid - offset] === ' ') { breakIdx = mid - offset; break; }
		}
		projectHtml = fullName.substring(0, breakIdx).trim() + '<br>' + fullName.substring(breakIdx).trim();
	}

	const w = window.open('', '_blank');
	w.document.write(`<!DOCTYPE html><html><head><title>Pallet ${palletLabel}</title>
<style>
	@page { size: 50mm 50mm; margin: 0; }
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html, body { width: 50mm; height: 50mm; overflow: hidden; }
	.sticker {
		width: 50mm;
		height: 50mm;
		padding: 1.5mm;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		text-align: center;
		page-break-inside: avoid;
	}
	.project {
		font-size: 10px;
		font-weight: 700;
		color: #1a365d;
		line-height: 1.2;
		margin-bottom: 1mm;
		max-width: 47mm;
		overflow: hidden;
	}
	.qr { flex-shrink: 0; }
	.qr img { width: 32mm; height: 32mm; display: block; }
	.pallet-name {
		font-size: 12px;
		font-weight: 700;
		color: #000;
		margin-top: 1mm;
		line-height: 1.2;
		word-wrap: break-word;
		max-width: 47mm;
	}
	.item-count { font-size: 10px; color: #555; line-height: 1; }
</style></head><body>
<div class="sticker">
	<div class="project">${projectHtml}</div>
	<div class="qr"><img src="${qrImageUrl}"></div>
	<div class="pallet-name">${palletLabel}</div>
	<div class="item-count">${items.length} items</div>
</div>
	<script>window.onload=function(){window.print();}</script>
</body></html>`);
	w.document.close();
}

function print_item_qr(frm, doc) {
	if (!doc.item_qr_image) {
		frappe.msgprint(__('Item QR not available. Save the document to auto-generate.'));
		return;
	}

	const prefix = frm.doc.pallet_prefix || '#';
	const palletLabel = doc.pallet_no > 0 ? `${prefix}${doc.pallet_no}` : '';

	// sub_items: show parent_item_code, others: show item_name
	const isSubItem = doc.source_table === 'sub_items';
	const subLabel = isSubItem ? (doc.parent_item_code || '') : (doc.item_name || '');

	const w = window.open('', '_blank');
	w.document.write(`<!DOCTYPE html><html><head><title>Item QR - ${doc.item_code}</title>
<style>
	@page { size: 40mm 40mm; margin: 0; }
	* { margin: 0; padding: 0; box-sizing: border-box; }
	html, body { width: 40mm; height: 40mm; overflow: hidden; }
	.sticker {
		width: 40mm; height: 40mm; padding: 1mm;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		text-align: center;
	}
	.item-code { font-size: 9px; font-weight: 700; color: #000; word-break: break-all; line-height: 1.2; }
	.sub-label { font-size: 7px; color: #555; margin-top: 0.5mm; line-height: 1.2; max-width: 38mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.qr { margin: 1mm 0; }
	.qr img { width: 22mm; height: 22mm; display: block; }
	.pallet-label { font-size: 8px; font-weight: 600; color: #2b6cb0; }
</style></head><body>
<div class="sticker">
	<div class="item-code">${doc.item_code || ''}</div>
	${subLabel ? `<div class="sub-label">(${subLabel})</div>` : ''}
	<div class="qr"><img src="${doc.item_qr_image}"></div>
	${palletLabel ? `<div class="pallet-label">${palletLabel}</div>` : ''}
</div>
	<script>window.onload=function(){window.print();}</script>
</body></html>`);
	w.document.close();
}

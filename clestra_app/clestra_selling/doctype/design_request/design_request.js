// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Design Request", {
	onload: function(frm) {
		setup_dr_product_table_buttons(frm);
	},
	refresh(frm) {
		setup_dr_product_grid(frm)

		if (!frm.doc.dr_product_table || frm.doc.dr_product_table.length === 0) {
			if (frappe.perm.has_perm(frm.doctype, 0, "write")) { // Check write permission for parent doctype
				frm.add_child('dr_product_table');
				frm.refresh_field('dr_product_table'); // Refresh the field to show the added row
			}
		}

		frm.set_query('door_hw_spec', 'dr_product_table', function (doc, cdt, cdn) {
			return {
				filters: {
					'project': doc.project
				}
			};
		});
	},
});

function setup_dr_product_grid(frm) {
	const parent_table = 'dr_product_table';
	const grid = frm.fields_dict[parent_table].grid;

	if (!grid) return;

	// ====================================================================
	// 1. item_name의 커스텀 검색 기능 
	// ====================================================================
	grid.wrapper.on('focusin', '[data-fieldname="item_name"] input', function () {
		const $input = $(this);

		if ($input.data('awesomplete-enhanced')) return;
		$input.data('awesomplete-enhanced', true);

		const input_element = $input.get(0);
		let awesomplete = new Awesomplete(input_element, {
			minChars: 0, maxItems: 15,
			// list: [],
			// filter: () => true,
			filter: function (text, input) {
			// 1. Suggestion 텍스트 (목록에 있는 아이템 이름)
			// text는 보통 객체({label:..., value:...})일 수 있으므로 처리
			var suggestionText = (text.label || text).toString();

			// 2. 사용자가 입력한 값을 공백 기준으로 쪼갬 (빈칸 제거)
			var searchTerms = input.trim().split(/\s+/);

			// 3. 모든 검색어(term)가 suggestionText에 포함되어 있는지 검사 (Case-insensitive)
			return searchTerms.every(function (term) {
				return suggestionText.toLowerCase().indexOf(term.toLowerCase()) > -1;
			});
		},
			replace: function (suggestion) {
				// suggestion 객체는 { label: "...", value: "..." } 형태입니다.
				// input의 값을 선택된 항목의 label로 설정합니다.
				this.input.value = suggestion.label;
			}
		});
		$input.data('awesomplete-instance', awesomplete);

		input_element.addEventListener("awesomplete-select", function (e) {
			// 기본 동작(input 값 변경 및 이벤트 종료)을 막습니다.
			e.preventDefault();

			const row_name = $input.closest('.grid-row').data('name');
			const grid_row = grid.grid_rows_by_docname[row_name];
			if (!grid_row) return;

			const { label, value } = e.text;

			awesomplete.close();

			frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, 'item_name', null).then(() => {
				// 이제 item_name과 item_code를 순차적으로 설정합니다.
				frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, 'item_name', label).then(() => {
					// item_code는 item_name이 설정된 후에 설정해야,
					// item_code 변경 시 item_name이 자동으로 덮어쓰여지는 것을 방지함
					frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, 'item_code', value);
				});
			});
		});

		const keydown_handler = (e) => {
			if (awesomplete.ul.offsetParent) {
				const keys = { 40: 'next', 38: 'previous', 13: 'select', 27: 'close' };
				if (e.keyCode in keys) {
					e.stopImmediatePropagation();
					e.preventDefault();
					awesomplete[keys[e.keyCode]]();
				}
			}
		};
		input_element.addEventListener('keydown', keydown_handler, true);

		// [핵심] Awesomplete 초기화로 인해 잃어버릴 수 있는 포커스를 즉시 재설정합니다.
		setTimeout(() => {
			$input.focus();
		}, 0);
	});

	// ====================================================================
	// 2. input 이벤트 핸들러: item_name의 서버 검색만 담당
	// ====================================================================
	grid.wrapper.on('input', '[data-fieldname="item_name"] input', frappe.utils.debounce(function () {
		const $input = $(this);
		const row_name = $input.closest('.grid-row').data('name');
		const grid_row = grid.grid_rows_by_docname[row_name];
		if (!grid_row) return;

		const last_selected_label = $input.data('last-selected-label');
		const current_value = $input.val();

		if (last_selected_label && last_selected_label === current_value) {
			// 플래그를 초기화하여, 사용자가 수동으로 수정하기 시작하면 다시 검색이 가능하도록 합니다.
			$input.data('last-selected-label', null);
			return;
		}

		// focusin에서 미리 생성해둔 Awesomplete 인스턴스를 가져옵니다.
		const awesomplete = $input.data('awesomplete-instance');
		if (!awesomplete) return;

		const term = $input.val();
		if (term.length < 2) {
			awesomplete.close();
			return;
		}

		frappe.call({
			method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.search_item_by_name",
			args: { txt: term, product_section: "Door", product_type: grid_row.doc.prod_type },
			callback: (r) => {
				awesomplete.list = r.message || [];
				awesomplete.evaluate();
			}
		});

	}, 300));

	let is_applying = false; // [핵심] 무한 루프 방지용 플래그

	// ============================================================
	// 3. 커스터마이징 로직 (스타일, 버튼, 이벤트 등 통합)
	// ============================================================
	const apply_dom_customizations = () => {
		if (is_applying) return; // 이미 실행 중이면 중단
		is_applying = true;

		try {
			const grid_wrapper = $(grid.wrapper);

			// 가. 그리드 스타일 적용 (체크박스 보임, 인덱스 숨김)
			// grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').hide();
			// grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').hide();
			// grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').attr('style', 'display: none !important');
			// 체크박스 숨김 (필요시 주석 해제)
			// grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').attr('style', 'display: none !important');

			// 'Add Row' -> 'Add Item' 버튼 이름 변경
			const add_row_button = grid_wrapper.find('.grid-add-row');
			if (add_row_button.length > 0 && !add_row_button.data('renamed')) {
				add_row_button.html(`<i class="fa fa-plus"></i> ${__('Add Item')}`);
				add_row_button.data('renamed', true);
			}

			const COL_RESIZE_CONFIG = {
				'prod_type': '18%',
				'button_size': '11%',
				'button_panel': '11%',
				'button_door': '11%',
				'button_glass': '11%',
				'button_color': '11%',
				'button_hw': '17%',
			};
			const CHECK_COL_WIDTH = "5%";
			const INDEX_COL_WIDTH = "5%";

			const force_col_width = ($elements, width) => {
				$elements.each(function() {
					// 기존 스타일을 가져오되, 우리가 설정한 flex가 아닌 경우에만 덮어씁니다.
					// 이는 불필요한 DOM 조작을 줄여 Observer 루프를 방지하는 효과도 있습니다.
					let currentStyle = $(this).attr('style') || '';
					if (!currentStyle.includes(`flex: 0 0 ${width} !important`)) {
						let newStyle = currentStyle.replace(/flex:[^;]+;?/g, '')
												.replace(/max-width:[^;]+;?/g, '')
												.replace(/width:[^;]+;?/g, '');
						$(this).attr('style', newStyle + `flex: 0 0 ${width} !important; max-width: ${width} !important; width: ${width} !important;`);
					}
				});
			};

			// 2-3. 체크박스 컬럼 리사이징
			const $check_cols = grid_wrapper.find('.row-check');
			if ($check_cols.length) {
				force_col_width($check_cols, CHECK_COL_WIDTH);
			}
			
			// 2-4. 인덱스 컬럼 리사이징
			const $index_cols = grid_wrapper.find('.row-index');
			if ($index_cols.length) {
				force_col_width($index_cols, INDEX_COL_WIDTH);
			}

			// 2-1. 데이터 컬럼 리사이징 (Body)
			Object.entries(COL_RESIZE_CONFIG).forEach(([field, width]) => {
				const $cols = grid_wrapper.find(`.grid-body .col[data-fieldname="${field}"]`);
				if ($cols.length) {
					force_col_width($cols, width);
				}
			});

			// 2-2. 헤더 컬럼 리사이징 (Header)
			if (grid.header_row) {
				const $header_cols = $(grid.header_row.wrapper).find('.col');
				grid.docfields.forEach((df, idx) => {
					if (COL_RESIZE_CONFIG[df.fieldname]) {
						let $target_header = $header_cols.filter(`[data-fieldname="${df.fieldname}"]`);
						if ($target_header.length) {
							force_col_width($target_header, COL_RESIZE_CONFIG[df.fieldname]);
						}
					}
				});
			}

		} finally {
			setTimeout(() => {
				is_applying = false;
			}, 0);
		}
	};

	// ============================================================
	// 4. 몽키패치 (Monkey Patch) - 초기 로드 및 수동 refresh 대응
	// ============================================================
	const original_refresh = grid.refresh;
	grid.refresh = function () {
		original_refresh.apply(this, arguments);
		setTimeout(apply_dom_customizations, 50);
	};

	// 초기 실행
	apply_dom_customizations();
	grid.is_fully_enhanced = true;

	grid.refresh();
	
}

function setup_dr_product_table_buttons(frm) {
	const parent_table = 'dr_product_table';
	const grid = frm.fields_dict[parent_table].grid;

	const interval_id = setInterval(() => {
		if (!grid || !grid.wrapper) {
			clearInterval(interval_id);
			return;
		}

		// 버튼 설정 정의: 필드명, 표시 텍스트, 사용할 필드 생성 함수
		const button_configs = [
			{ fieldname: "button_size", label: "Size", fields_func: size_button_dialog_fields },
			{ fieldname: "button_panel", label: "Panel", fields_func: panel_button_dialog_fields },
			{ fieldname: "button_door", label: "Door", fields_func: door_button_dialog_fields },
			{ fieldname: "button_color", label: "Color", fields_func: color_button_dialog_fields },
			{ fieldname: "button_hw", label: "Hardware", fields_func: hw_button_dialog_fields },
		];

		button_configs.forEach(config => {
			// 처리되지 않은 버튼 찾기
			const unhandled_buttons = $(grid.wrapper).find(`[data-fieldname="${config.fieldname}"]:not(.enhanced-button)`);

			unhandled_buttons.each(function() {
				const $edit_button = $(this);
				const grid_row_element = $edit_button.closest('.grid-row');
				const grid_row_name = grid_row_element.data('name');
				const grid_row = grid.grid_rows_by_docname[grid_row_name];

				if (grid_row) {
					// 아이콘 및 라벨 변경
					$edit_button.html(`<div class="field-area"><button class="btn btn-xs btn-default input-sm" style="margin: 0;">${config.label}</button></div>`);
					
					$edit_button.off('click');

					// 클릭 이벤트 바인딩
					$edit_button.on('click', function(e) {
						e.preventDefault();
						e.stopPropagation();

						const data = grid_row.doc;
						// 설정된 함수(config.fields_func)를 호출하여 필드 구성
						const dialog_fields = config.fields_func(frm, data);

						const dialog = new frappe.ui.Dialog({
							title: __("{0} Information", [config.label || __("Row {0}" )]),
							fields: dialog_fields,
							primary_action_label: __('Save'),
							primary_action: function(values) {
								// 다이얼로그에 정의된 모든 필드명을 추출
								const fields_to_update = dialog_fields.map(df => df.fieldname).filter(Boolean);

								fields_to_update.forEach(field => {
									if (values.hasOwnProperty(field)) {
										// 해당 행(grid_row)의 값을 업데이트
										frappe.model.set_value(grid_row.doc.doctype, grid_row.doc.name, field, values[field]);
									}
								});

								dialog.hide();
							}
						});

						dialog.show();
					});

					// 처리 완료 플래그 클래스 추가
					$edit_button.addClass('enhanced-button');
				}
			});
		});
	}, 250); 
}

function size_button_dialog_fields(frm, data) {
	return [
		{ label: __("Ceiling Height (CH)"), fieldname: "ch", fieldtype: "Int", default: data.ch},
		{ label: __("Panel Height (PH)"), fieldname: "ph", fieldtype: "Int", default: data.ph},
		{ fieldtype: "Column Break" },
		{ label: __("Ceiling Visible Height"), fieldname: "ceiling_visible", fieldtype: "Int", default: data.ceiling_visible},
		{ label: __("Base Visible Height"), fieldname: "base_visible_h", fieldtype: "Int", default: data.base_visible_h},
		{ fieldtype: "Column Break" },
		{ label: __("Chair Rail Height (CRH)"), fieldname: "crh", fieldtype: "Int", default: data.crh},
		{ label: __("Transom Rail Height (TRH)"), fieldname: "trh", fieldtype: "Int", default: data.trh},
	];
}

function panel_button_dialog_fields(frm, data) {
	return [
		{ label: __("Panel Type"), fieldname: "panel_type", fieldtype: "Select", default: data.panel_type, options: "\nSVo\nSVc\nKDV"},
		{ fieldtype: "Column Break" },
		//Panel Size
		// { fieldtype: "Section Break"},
		// { label: __("Panel Size"), fieldtype: "Heading"},
		// { fieldtype: "Section Break", hide_border: 1},
		// { label: __("Panel Height (PH)"), fieldname: "ph", fieldtype: "Float", default: data.ph},
		// { label: __("Ceiling Visible Height"), fieldname: "ceiling_visible", fieldtype: "Int", default: data.ceiling_visible},
		// { label: __("Base Visible Height"), fieldname: "base_visible_h", fieldtype: "Int", default: data.base_visible_h},
		// { fieldtype: "Column Break" },
		// { label: __("CRH"), fieldname: "crh", fieldtype: "Int", default: data.crh},
		// { label: __("TRH"), fieldname: "trh", fieldtype: "Int", default: data.trh},
		// { fieldtype: "Column Break" },
		//Panel Spec
		{ fieldtype: "Section Break"},
		{ label: __("Panel Spec"), fieldtype: "Heading"},
		{ fieldtype: "Section Break", hide_border: 1},
		{ label: __("Ceiling Type"), fieldname: "cl_ch_type", fieldtype: "Link", default: data.cl_ch_type, options: "Selection Library", filters: { opt_name: "CL CH Type"}},
		{ label: __("Base Type"), fieldname: "base_type", fieldtype: "Link", default: data.base_type, options: "Selection Library", filters: { opt_name: "Base Type"}},
		{ fieldtype: "Column Break" },
		{ fieldtype: "Column Break" },
		//Panel Glass
		{ fieldtype: "Section Break"},
		{ label: __("Panel Glass"), fieldtype: "Heading"},
		{ fieldtype: "Section Break", hide_border: 1},
		// { label: __("Glass Spec Type"), fieldname: "glass_spec_type", fieldtype: "Select", default: data.glass_spec_type, options: "\nStandard\nCustomize"},
		{ label: __("Layer"), fieldname: "layer", fieldtype: "Select", default: data.layer, options: "\nSingle\nDouble"},
		{ label: __("Grooving"), fieldname: "grooving", fieldtype: "Select", default: data.grooving, options: "\nGrooving\nNon-Grooving"},
		{ fieldtype: "Column Break" },
		{ label: __("Glass Thickness"), fieldname: "glass_thk", fieldtype: "Select", default: data.glass_thk, options: "\n5\n6\n7\n8\n10\n10.76\n12\n12.76\n16.76"},
		{ label: __("Glass Type"), fieldname: "glass_type", fieldtype: "Link", default: data.glass_type, options: "Selection Library", filters: { opt_name: "Glass Type"}},
		{ label: __("Sealing"), fieldname: "sealing", fieldtype: "Select", default: data.sealing, options: "\n3M Tape\nGrooving Seal\nCaulking Tape"},
		//Panel Power Column
		{ fieldtype: "Section Break"},
		{ label: __("Panel Power Column (P/C)"), fieldtype: "Heading"},
		{ fieldtype: "Section Break", hide_border: 1},
		{ label: __("Include Power Column (P/C)"), fieldname: "include_power_column", fieldtype: "Check", default: data.include_power_column},
		{ fieldtype: "Section Break", depends_on: "eval:doc.include_power_column == 1"},
		{ label: __("P/C Cutout"), fieldname: "pc_cutout", fieldtype: "Select", default: data.pc_cutout, options: "No\nYes"},
		{ label: __("Pipe Box"), fieldname: "pipe_box", fieldtype: "Select", default: data.pipe_box, options: "No\nYes"},
		{ fieldtype: "Column Break" },
		{ label: __("Booking System"), fieldname: "booking_system", fieldtype: "Select", default: data.booking_system, options: "No\nYes"},
		{ fieldtype: "Section Break"},
	];
}

function door_button_dialog_fields(frm, data) {
	return [
		{ label: __("Door"), fieldtype: "Heading"},
		{ label: __("Door Code"), fieldname: "door_item_code", fieldtype: "Link", default: data.door_item_code, options: "Item", filters: { product_section: "Door", item_group: "Finished Product", product_type: data.prod_type},
			onchange: function () {
				const item_code = this.value;
				const dialog = this.dialog || cur_dialog;
				if (item_code) {
					frappe.db.get_value("Item", item_code, "item_name")
						.then(r => {
							if (r.message) {
								const item_data = r.message;
								// dialog.set_value를 사용하여 명확하게 값을 설정합니다.
								dialog.set_value("door_item_name", item_data.item_name || "");
							} else {
								// 값이 없는 경우 필드를 비워줍니다.
								dialog.set_value("door_item_name", "");
							}
						})
				}
			},
		},
		{ label: __("Door Name"), fieldname: "door_item_name", fieldtype: "Data", default: data.door_item_name},
		{ label: __("Leaf"), fieldtype: "Heading"},
		{ label: __("Leaf Code"), fieldname: "leaf_item_code", fieldtype: "Link", default: data.leaf_item_code, options: "Item", filters: { product_section: "Leaf", item_group: "Finished Product"},
			onchange: function () {
				const item_code = this.value;
				const dialog = this.dialog || cur_dialog;
				if (item_code) {
					frappe.db.get_value("Item", item_code, ["item_name"])
						.then(r => {
							if (r.message) {
								const item_data = r.message;
								// dialog.set_value를 사용하여 명확하게 값을 설정합니다.
								dialog.set_value("leaf_item_name", item_data.item_name || "");
							} else {
								// 값이 없는 경우 필드를 비워줍니다.
								dialog.set_value("leaf_item_name", "");
							}
						})
				}
			},
		},
		{ label: __("Leaf Name"), fieldname: "leaf_item_name", fieldtype: "Data", default: data.leaf_item_name},
		// { label: __("Leaf Thickness"), fieldname: "leaf_thk", fieldtype: "Data", default: data.leaf_thk},
		{ fieldtype: "Section Break"},
		{ label: __("Leaf Glass"), fieldtype: "Heading"},
		// { fieldtype: "Section Break", hide_border: 1},
		{ label: __("Glass Type"), fieldname: "leaf_glass_type", fieldtype: "Link", default: data.glass_type, options: "Selection Library", filters: { opt_name: "Glass Type"}},
		{ label: __("Leaf Glass Thickness"), fieldtype: "Heading"},
		{ label: __("Leaf Glass A (Outer)"), fieldname: "leaf_glass_a", fieldtype: "Link", default: data.leaf_glass_a, options: "Product Thickness"},
		{ label: __("Leaf Glass B (Inner)"), fieldname: "leaf_glass_b", fieldtype: "Link", default: data.leaf_glass_b, options: "Product Thickness"},
		{ label: __("Leaf B Glass A (Outer)"), fieldname: "leaf_b_glass_a", fieldtype: "Link", default: data.leaf_b_glass_a, options: "Product Thickness"},
		{ label: __("Leaf B Glass B (Inner)"), fieldname: "leaf_b_glass_b", fieldtype: "Link", default: data.leaf_b_glass_b, options: "Product Thickness"},
	];
}


function color_button_dialog_fields(frm, data) {
	return [
		{ fieldtype: "Section Break", hide_border: 1},
		{ label: __("Main Color"), fieldtype: "Heading"},
		{ label: __("Color"), fieldname: "color", fieldtype: "Link", default: data.color, options: "Product Color",
			onchange: function () {
				const main_color = this.value;
				const dialog = this.dialog || cur_dialog;
				if (main_color) {
					dialog.set_value("color_frame", main_color || "");
					dialog.set_value("color_transom", main_color || "");
					dialog.set_value("color_leaf", main_color || "");
					dialog.set_value("color_lip_seal", main_color || "");
					dialog.set_value("color_panel", main_color || "");
					dialog.set_value("color_clch", main_color || "");
					dialog.set_value("color_base", main_color || "");
					dialog.set_value("color_junction", main_color || "");
								
				} else {
					// 값이 없는 경우 필드를 비워줍니다.
					dialog.set_value("color_frame", "");
					dialog.set_value("color_transom", "");
					dialog.set_value("color_leaf", "");
					dialog.set_value("color_lip_seal", "");
					dialog.set_value("color_panel", "");
					dialog.set_value("color_clch", "");
					dialog.set_value("color_base", "");
					dialog.set_value("color_junction", "");
				}
			},
		},
		{ fieldtype: "Column Break" },
		{ label: __("Door Color"), fieldtype: "Heading"},
		{ label: __("Frame"), fieldname: "color_frame", fieldtype: "Link", default: data.color_frame, options: "Product Color"},
		{ label: __("Transom Color"), fieldname: "color_transom", fieldtype: "Link", default: data.color_transom, options: "Product Color"},
		
		{ label: __("Leaf Color"), fieldtype: "Heading"},
		{ label: __("Leaf"), fieldname: "color_leaf", fieldtype: "Link", default: data.color_leaf, options: "Product Color"},
		{ label: __("Lip Seal Color"), fieldname: "color_lip_seal", fieldtype: "Link", default: data.color_lip_seal, options: "Product Color"},
		
		{ fieldtype: "Column Break" },
		{ label: __("Panel Color"), fieldtype: "Heading"},
		{ label: __("Panel"), fieldname: "color_panel", fieldtype: "Link", default: data.color_panel, options: "Product Color"},

		{ label: __("Sub Colors"), fieldtype: "Heading"},
		{ label: __("CL/CH"), fieldname: "color_clch", fieldtype: "Link", default: data.color_clch, options: "Product Color"},
		{ label: __("Base"), fieldname: "color_base", fieldtype: "Link", default: data.color_base, options: "Product Color"},
		{ label: __("Junction"), fieldname: "color_junction", fieldtype: "Link", default: data.color_junction, options: "Product Color"},
	];
}

function hw_button_dialog_fields(frm, data) {
	return [
		{ label: __("Door Open Type"), fieldname: "door_open_type", fieldtype: "Select", default: data.door_open_type, options: "\nSwing\nSliding"},
		{ label: __("Door Set Type"), fieldname: "door_set_type", fieldtype: "Select", default: data.door_set_type, options: "\nSingle\nPair"},
		{ fieldtype: "Section Break"},
		{ label: __("Handle"), fieldtype: "Heading"},
		{ label: "Mortise", fieldname: "mortise", fieldtype: "Data", default: data.mortise },
		{ label: "Handle", fieldname: "handle", fieldtype: "Data", default: data.handle },
		{ label: "Handle Painting Required", fieldname: "handle_painting_req", fieldtype: "Check", default: data.handle_painting_req },
		{ label: __("Handle Painting Color"), fieldname: "handle_paint_color", fieldtype: "Link", default: data.handle_paint_color, options: "Product Color", depends_on: "eval:doc.handle_painting_req == 1"},
		{ label: __("Lockset Height"), fieldname: "lockset_h", fieldtype: "Select", default: data.lockset_h, options: "\n900\n950\n1000\n1050\n1100\nCustom"},
		{ label: __("Lockset Custom Height"), fieldname: "lockset_h_custom", fieldtype: "Int", default: data.lockset_h_custom, depends_on: "eval:doc.lockset_h == 1"},
		{ fieldtype: "Section Break"},
		{ label: __("Key Cylinder"), fieldtype: "Heading"},
		{ label: "Key Cylinder", fieldname: "key_cylinder", fieldtype: "Data", default: data.key_cylinder },
		{ label: "Key Cylinder Painting Required", fieldname: "key_cylinder_painting_req", fieldtype: "Check", default: data.key_cylinder_painting_req },
		{ label: __("Key Cylinder Painting Color"), fieldname: "key_cylinder_paint_color", fieldtype: "Link", default: data.key_cylinder_paint_color, options: "Product Color", depends_on: "eval:doc.key_cylinder_painting_req == 1"},
		{ fieldtype: "Section Break"},
		{ label: __("MK"), fieldtype: "Heading"},
		{ label: "MK", fieldname: "mk", fieldtype: "Data", default: data.mk },
		{ fieldtype: "Section Break" },
		{ label: __("Hinge Side"), fieldtype: "Heading"},
		{ label: __("Hinge Type"), fieldname: "hinge_type", fieldtype: "Select", default: data.hinge_type, options: "\nButt - Standard\nButt - Standard (Black Color)\nButt - Concealed Hinge (OPW)\nPivot - CL-200\nPivot - CL-300 (Standard)\nPivot - CL-300 (Std., Black Color)\nPivot - CL-300 (Frame Fix)\nPivot - CL-300 (Frame Fix, Black Color)\nPivot - CL-300AS\nPivot - CL-300AS_BC (Black Color)\nPivot - CL-400 Floor Type\nPivot - CL-400 Floor (Black Color)\nPivot - CL-400 Groove Type\nPivot - CL-400 Groove Type (Black Color)\nPivot - M195\nFloor Hinge\nStremler\nCustom"},
		{ label: "Hinge Painting Required", fieldname: "hinge_painting_req", fieldtype: "Check", default: data.hinge_painting_req },
		{ label: __("Hinge Painting Color"), fieldname: "hinge_paint_color", fieldtype: "Link", default: data.hinge_paint_color, options: "Product Color", depends_on: "eval:doc.hinge_painting_req == 1"},
		{ fieldtype: "Section Break"},
		{ label: __("Door Closer"), fieldtype: "Heading"},
		{ label: "Door Closer", fieldname: "door_closer", fieldtype: "Select", default: data.door_closer, options: "N\nY"},
		{ fieldtype: "Section Break"},
		{ label: __("Auto Drop Seal"), fieldtype: "Heading"},
		{ label: "Auto Drop Seal", fieldname: "auto_drop_seal", fieldtype: "Select", default: data.auto_drop_seal, options: "\nCDCM\nAthmer M1B\nGEZE\nOther"},
		{ label: "Other Auto Drop Seal", fieldname: "other_auto_drop_seal", fieldtype: "Data", default: data.other_auto_drop_seal, depends_on: "eval:doc.auto_drop_seal == 'Other'"},
		{ fieldtype: "Section Break" },
		{ label: __("FGD"), fieldtype: "Heading"},
		{ label: "FGD Type", fieldname: "fgd_type", fieldtype: "Select", default: data.fgd_type, options: "\n3M Tape + Screw (Std.)\n3M Tape + 3M Tape"},
		{ fieldtype: "Column Break" },
		{ label: __("3M Tape and Form Seal Color"), fieldtype: "Heading"},
		{ label: "Standard (Gray)", fieldname: "tape_seal_color_gray", fieldtype: "Check", default: data.tape_seal_color_gray },
		{ label: "White", fieldname: "tape_seal_color_white", fieldtype: "Check", default: data.tape_seal_color_white },
		{ label: "Black", fieldname: "tape_seal_color_black", fieldtype: "Check", default: data.tape_seal_color_black },
		{ label: __("Fixing Screw Cap Color"), fieldtype: "Heading"},
		{ label: "Standard (Gray)", fieldname: "fix_screw_gray", fieldtype: "Check", default: data.fix_screw_gray },
		{ label: "White", fieldname: "fix_screw_white", fieldtype: "Check", default: data.fix_screw_white },
		{ label: "Black", fieldname: "fix_screw_black", fieldtype: "Check", default: data.fix_screw_black },
		{ label: __("Back Painted Border"), fieldtype: "Heading"},
		{ label: "Back Painted Border", fieldname: "back_painted_border", fieldtype: "Select", default: data.back_painted_border, options: "N\nY"},
	];
}

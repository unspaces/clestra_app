
frappe.ui.form.on("Clestra Quotation", {
	onload: function (frm) {
		setup_item_table_buttons(frm);
		if (frm.is_new() && !frm.doc.company) {
			frappe.db.get_value('User', frappe.session.user, 'company')
				.then(r => {
					if (r && r.message && r.message.company) {
						frm.set_value('company', r.message.company);
					}
				});
		}
	},


	refresh: function (frm) {
		setup_item_grid(frm)
	},
});

frappe.ui.form.on("Clestra Quotation Item", {
	item_code: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		if (row.item_code) {
			// Quotation Pricing Doctype에서 item_code가 일치하는 target_price를 가져옴
			frappe.db.get_value('Quotation Pricing', {'item_code': row.item_code}, 'target_price')
				.then(r => {
					if (r && r.message) {
						frappe.model.set_value(cdt, cdn, 'rate', r.message.target_price);
						
						frm.refresh_field('items');
					}
				});
			frappe.db.get_value('Item', row.item_code, 'stock_uom')
				.then(r => {
					if (r && r.message) {
						frappe.model.set_value(cdt, cdn, 'uom', r.message.stock_uom);
						frm.refresh_field('items');
					}
				});
			frappe.db.get_list('VP Rate', {
				filters: {'company': frm.doc.company},
				fields: ['rate'],
				order_by: 'creation desc', // 생성일 역순 (최신순)
				limit: 1 // 1개만 가져옴
			}).then(res => {
				if (res && res.length > 0) {
					frappe.model.set_value(cdt, cdn, 'vp_rate', res[0].rate);
				}
			});
			refresh_row_rate(frm, cdt, cdn);
		} else {
			frappe.model.set_value(cdt, cdn, 'rate', 0);
		}
	},
	ch: function(frm, cdt, cdn) { refresh_row_rate(frm, cdt, cdn); },
    width: function(frm, cdt, cdn) { refresh_row_rate(frm, cdt, cdn); },

	// glass_type_a: function(frm, cdt, cdn) {fetch_glass_rate(frm, cdt, cdn, 'glass_type_a', 'glass_thk_a', 'glass_cost_a');},
    // glass_thk_a: function(frm, cdt, cdn) {fetch_glass_rate(frm, cdt, cdn, 'glass_type_a', 'glass_thk_a', 'glass_cost_a');},
    // glass_type_b: function(frm, cdt, cdn) {fetch_glass_rate(frm, cdt, cdn, 'glass_type_b', 'glass_thk_b', 'glass_cost_b');},
    // glass_thk_b: function(frm, cdt, cdn) {fetch_glass_rate(frm, cdt, cdn, 'glass_type_b', 'glass_thk_b', 'glass_cost_b');},

    glass_cost_a: function(frm, cdt, cdn) { refresh_row_rate(frm, cdt, cdn); },
    glass_cost_b: function(frm, cdt, cdn) { refresh_row_rate(frm, cdt, cdn); },

	qty: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'amount', flt(row.qty) * flt(row.rate));
    }
});


function setup_item_grid(frm) {
	const parent_table = 'items';
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

			// 'Add Row' -> 'Add Item' 버튼 이름 변경
			const add_row_button = grid_wrapper.find('.grid-add-row');
			if (add_row_button.length > 0 && !add_row_button.data('renamed')) {
				add_row_button.html(`<i class="fa fa-plus"></i> ${__('Add Item')}`);
				add_row_button.data('renamed', true);
			}

			const COL_RESIZE_CONFIG = {
				'item_code': '15%',
				'qty': '10%',
				'ch': '10%',
				'width': '10%',
				'glass_btn': '10%',
				'rate': '10%',
				'amount': '10%',
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


function setup_item_table_buttons(frm) {
	const parent_table = 'items';
	const grid = frm.fields_dict[parent_table].grid;

	const interval_id = setInterval(() => {
		if (!grid || !grid.wrapper) {
			clearInterval(interval_id);
			return;
		}

		// 버튼 설정 정의: 필드명, 표시 텍스트, 사용할 필드 생성 함수
		const button_configs = [
			{ fieldname: "glass_btn", label: "Glass", fields_func: glass_btn_dialog_fields }
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


function glass_btn_dialog_fields(frm, data) {
	return [
		{label: ("Tempered Glass A"), fieldname: "tempered_glass_a", fieldtype: "Check", default: data.tempered_glass_a},
		{label: ("Glass Type A"), fieldname: "glass_type_a", fieldtype: "Link", options: "Selection Library", default: data.glass_type_a,
			get_query: function() {
				let operator = cur_dialog.get_value("tempered_glass_a") ? "like" : "not like";
				return {filters: [["Selection Library", "opt_name", "=", "Glass Type"], ["Selection Library", "opt_value", operator, "%Tempered%"]]};
			},
			onchange: () => update_dialog_glass_cost(cur_dialog, "a")
		},
		{label: ("Thickness A"), fieldname: "glass_thk_a", fieldtype: "Select", default: data.glass_thk_a, options: "\n5\n6\n8\n10\n12",
			onchange: () => update_dialog_glass_cost(cur_dialog, "a")
		},
		{label: ("Glass Cost A"), fieldname: "glass_cost_a", fieldtype: "Currency", default: data.glass_cost_a, read_only: 1},
		{label: ("Double Partitions"), fieldname: "is_double_partitions", fieldtype: "Check", default: data.is_double_partitions},
		{ fieldtype: "Column Break" },
		{label: ("Tempered Glass B"), fieldname: "tempered_glass_b", fieldtype: "Check", default: data.tempered_glass_b, depends_on: "eval:doc.is_double_partitions == 1"},
		{label: ("Glass Type B"), fieldname: "glass_type_b", fieldtype: "Link", options: "Selection Library", default: data.glass_type_b, depends_on: "eval:doc.is_double_partitions == 1",
			get_query: function() {
				let operator = cur_dialog.get_value("tempered_glass_b") ? "like" : "not like";
				return {filters: [["Selection Library", "opt_name", "=", "Glass Type"], ["Selection Library", "opt_value", operator, "%Tempered%"]]};
			}
		},
		{label: ("Thickness B"), fieldname: "glass_thk_b", fieldtype: "Select", default: data.glass_thk_b, options: "\n5\n6\n8\n10\n12", depends_on: "eval:doc.is_double_partitions == 1"},
		{label: ("Glass Cost B"), fieldname: "glass_cost_b", fieldtype: "Currency", default: data.glass_cost_b, read_only: 1, depends_on: "eval:doc.is_double_partitions == 1"}
	]
}

function refresh_row_rate(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (!row.item_code || !row.ch || !row.width) return;

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.clestra_quotation.clestra_quotation.get_row_total_rate",
        args: {
            doc_context: row // row의 모든 데이터를 서버로 전송
        },
        callback: function(r) {
            if (r.message && !r.message.error) {
				if (r.message.results) {
                    for (let fieldname in r.message.results) {
                        frappe.model.set_value(cdt, cdn, fieldname, r.message.results[fieldname]);
                    }
                }
                
                // 1. rate 업데이트
                frappe.model.set_value(cdt, cdn, 'rate', flt(r.message.rate));
                const new_amount = flt(row.qty) * flt(r.message.rate);

                frappe.model.set_value(cdt, cdn, 'amount', new_amount);

				frm.fields_dict['items'].grid.refresh();
            }
        }
    });
}

function fetch_glass_rate(frm, cdt, cdn, type_fld, thk_fld, target_fld) {
    const row = locals[cdt][cdn];
    const glass_type = row[type_fld];
    const thk = row[thk_fld];

    if (glass_type && thk) {
        frappe.db.get_value('Estimate Glass Costing', 
            {
                'glass_type': glass_type,
                'thk': thk
            }, 
            'rate', 
            (r) => {
                const rate = (r && r.rate !== undefined) ? flt(r.rate) : 0;
                
                // 1. 그리드의 해당 로우에 유리 단가 입력
                frappe.model.set_value(cdt, cdn, target_fld, rate);
                
                // 2. [중요] 유리 단가가 바뀐 후, 즉시 전체 단가(Target Price) 재계산 실행
                refresh_row_rate(frm, cdt, cdn);
            }
        );
    } else {
        frappe.model.set_value(cdt, cdn, target_fld, 0);
        // 값이 비워질 때도 재계산 실행
        refresh_row_rate(frm, cdt, cdn);
    }
}


function update_dialog_glass_cost(dialog, suffix) {
    const glass_type = dialog.get_value(`glass_type_${suffix}`);
    const glass_thk = dialog.get_value(`glass_thk_${suffix}`);
    const cost_fieldname = `glass_cost_${suffix}`;

    if (glass_type && glass_thk) {
        frappe.db.get_value('Estimate Glass Costing', 
            { 'glass_type': glass_type, 'thk': glass_thk }, 
            'rate', 
            (r) => {
                const rate = (r && r.rate !== undefined) ? flt(r.rate) : 0;
                dialog.set_value(cost_fieldname, rate);
            }
        );
    } else {
        // 조건이 맞지 않으면 단가를 0으로 초기화
        dialog.set_value(cost_fieldname, 0);
    }
}
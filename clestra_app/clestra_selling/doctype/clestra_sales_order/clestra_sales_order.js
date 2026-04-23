// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Clestra Sales Order", {
	onload: function (frm) {
		if (frm.is_new() && !frm.doc.company) {
			frappe.db.get_value('User', frappe.session.user, 'company')
				.then(r => {
					if (r && r.message && r.message.company) {
						frm.set_value('company', r.message.company);
					}
				});
		}
	},

	validate: function(frm) {
		// 포맷팅 함수 정의
		const format_digits = (num, field_name) => {
			if (frm.doc[field_name]) {
				let val = frm.doc[field_name].toString().replace(/[^0-9]/g, '');
				if (val.length > 0 && val.length < num) {
					frm.set_value(field_name, val.padStart(num, '0'));
				}
			}
		};

		// 각 필드에 적용
		// format_3_digits('contract_no');
		format_digits(3, 'sub_no');
		format_digits(2, 'contract_no');
	},

	after_save: function (frm) {

		if (frm.doc.zone_selected) {
			// frm.refresh_field("zone_selected")가 fetch를 트리거합니다.
			frm.refresh_field("zone_selected");
		}
	},

	on_site_date: function (frm) {
		if (frm.doc.on_site_date) {
			const new_date = frappe.datetime.add_days(frm.doc.on_site_date, -1);
			frm.set_value('ex_work_date', new_date);
		}
	},

	company: function (frm) {
		if (frm.doc.company == "Clestra Korea") {
			frm.set_value('set_warehouse', 'All Warehouses - GUMI');
		}
	},

	factory_currency: function (frm) {
		if (frm.doc.factory_currency == frm.doc.local_currency) {
			frm.set_value('exchange_rate', 1);
		}
	},

	local_currency: function (frm) {
		if (frm.doc.local_currency == "KRW") {
			frappe.db.get_list('VP Rate', {
				filters: {
					'company': frm.doc.company,
				},
				fields: ['rate'],
				order_by: 'creation desc', // 생성일 역순 (최신순)
				limit: 1 // 1개만 가져옴
			}).then(res => {
				if (res && res.length > 0) {
					const vp_kr = res[0].rate;
					frm.set_value('point_value', vp_kr);
				}
			});
		}
	},

	add_door_hw_spec: function (frm) {
		if (!frm.doc.project) {
			frappe.msgprint({
				title: __('Project Required'),
				indicator: 'orange',
				message: __('Please select a Project before creating a new Door Hardware Spec.')
			});
			return;
		}

		// Quick Entry 다이얼로그 — 페이지 이동 없이 HW Spec 생성
		// 저장 성공 후 hw_spec_mapping 빈 슬롯에 매핑 + hw_check_N 자동 체크
		frappe.ui.form.make_quick_entry(
			"Door Hardware Spec",
			function (doc) {
				// after_insert 콜백: doc은 방금 생성된 Door Hardware Spec 문서
				let mapping = {};
				try { mapping = JSON.parse(frm.doc.hw_spec_mapping || '{}'); } catch (e) { mapping = {}; }

				for (let i = 1; i <= 10; i++) {
					const key = `hw_check_${i}`;
					if (!mapping[key]) {
						mapping[key] = doc.name;
						frm.set_value(key, 1);
						break;
					}
				}
				frm.set_value('hw_spec_mapping', JSON.stringify(mapping));

				if (typeof render_hw_spec_summary === 'function') {
					render_hw_spec_summary(frm);
				}

				frappe.show_alert({
					message: __('HW Spec "{0}" added and checked.', [doc.name]),
					indicator: 'green'
				});
			},
			function (dialog) {
				// init_callback: 다이얼로그 생성 직후 project 자동 입력
				dialog.set_value('project', frm.doc.project);
			}
		);
	},
	setup_sales_order(frm) {
		if (!frm.is_new()) {
			frappe.dynamic_link = { original_doc_name: frm.doc.name };
		} else if (frm.doc.finished_items?.length && !frm.is_duplicate_processed) {
			frm.trigger("prompt_for_project_on_duplicate");
		}
	},
	refresh: function (frm) {
		frm.trigger("setup_sales_order");
		customize_select_all_for_grid(frm, 'finished_items');

		// ================== 1. 상태 변수 초기화 ==================
		if (!frm.custom_state) {
			frm.custom_state = {
				selected_item: null
			};
		}

		setTimeout(() => {
			if (!frm.custom_tab_handler_attached) {
				// 폼 내부의 탭 버튼(.nav-link)에 클릭 이벤트를 연결합니다.

				const $tab_buttons = $(frm.wrapper).find('a[role="tab"]');
				// console.log("Found tab buttons:", $tab_buttons.length); // [디버깅] 탭을 몇 개 찾았는지 확인

				$tab_buttons.on('click', function() {
					// console.log("Tab clicked!"); // [디버깅] 클릭 이벤트가 발생하는지 확인
					
					if (frm.is_dirty()) {
						// console.log("Auto-saving due to tab change...");
						// frm.save('Save');
						debounced_auto_save(frm);
					}
				});
				frm.custom_tab_handler_attached = true; // 핸들러가 연결되었음을 표시
			}
		}, 10);

		frm.set_query('item_code', 'finished_items', function (doc, cdt, cdn) {
			// 현재 수정 중인 행(row)의 데이터를 가져옵니다.
			let row = locals[cdt][cdn];

			// set_warehouse에 따라 Item.company 결정
			// "... - GUMI"  → Clestra Korea
			// "... - TC"    → Taicang Factory
			const resolve_company_from_warehouse = (warehouse) => {
				if (!warehouse) return null;
				if (/-\s*GUMI\b/i.test(warehouse)) return "Clestra Korea";
				if (/-\s*TC\b/i.test(warehouse)) return "Taicang Factory";
				return null;
			};
			const item_company = resolve_company_from_warehouse(doc.set_warehouse);

			// 필터링할 특별한 product_section 값들을 배열로 정의
			const sub_item_section = ["Option", "Price Study", "Sub Contract"];

			// 1. [특별 조건] row.product_section이 sub_item_section 배열에 포함되는 경우
			if (row && sub_item_section.includes(row.product_section)) {
				row.indent_level = cint(row.parent_row_no) > 0 ? 2 : 0;

				// product_type과 product_section 필터를 해제하고, item_group으로 필터링
				const base_filters = { 'item_group': ['in', row.product_section] };
				if (item_company) base_filters['company'] = item_company;
				return { filters: base_filters };
			}
			// 2. [일반 조건] 그 외의 모든 경우
			else {
				// frm.doc과 row의 값으로 Item을 필터링
				let filters = {};

				// 부모 문서(Clestra Sales Order)의 zone_product_type 값이 있을 경우에만 필터를 추가
				if (doc.zone_product_type) {
					filters['product_type'] = doc.zone_product_type;
				}

				// 현재 행(row)의 product_section 값이 있을 경우에만 필터를 추가
				if (row && row.product_section) {
					filters['product_section'] = row.product_section;
				}

				// set_warehouse 기준 Item.company 필터 (GUMI→Clestra Korea, TC→Taicang Factory)
				if (item_company) {
					filters['company'] = item_company;
				}

				return {
					filters: {
						...filters,
						item_group: ['=', 'Finished Product']
					}
				};
			}
		});

		// frm.set_query('door_hw_spec', 'finished_items', function (doc, cdt, cdn) {
		// 	return {
		// 		filters: {
		// 			'project': doc.project
		// 		}
		// 	};
		// });

		// Quick Entry의 project필드에 프로젝트명 자동 입력
		let batch_field = frm.get_docfield("zone_selected");
		batch_field.get_route_options_for_new_doc = function (row) {
			if (frm.is_new()) return;
			return {
				"project": frm.doc.project,
			};
		}

		let batch_field_2 = frm.get_docfield("finished_items", "zone_name");
		batch_field_2.get_route_options_for_new_doc = function (row) {
			if (frm.is_new()) return;
			return {
				"project": frm.doc.project,
			};
		}

		// ================== 3. 동적 쿼리 설정 ==================
		set_query_for_table(frm, 'finished_items', 'zone_name', 'project', frm.doc.project);
		frm.set_query('zone_selected', function () {
			return {
				filters: {
					'project': frm.doc.project,
				}
			}
		})

		frm.set_query('print_filter_zone', function () {
			return {
				filters: {
					'project': frm.doc.project,
				}
			}
		})

		frm.set_query('zone_selected_computation', function () {
			return {
				filters: {
					'project': frm.doc.project,
				}
			}
		})

		// ================== 4. 그리드 설정 ==================
		// setup_zone_summary_grid(frm); // zone_summary_new_html로 대체
		render_new_zone_summary(frm);
		setup_finished_items_grid(frm);
		setup_group_selection_for_grid(frm);
		apply_visibility_rules(frm);
		update_all_planned_qty_visibility(frm);
		apply_all_dimension_rule_readonly(frm);
		clickable_unit_price_column(frm);

		// ================== 5. HTML 렌더 ==================
		render_hw_spec_summary(frm);
		render_computation(frm);
		render_codes_sum(frm);

		// Manufacturer Discount 버튼에 클릭 이벤트 핸들러 추가
		frm.get_field('apply_factory_discount').$input.on('click', () => {
			open_bulk_discount_dialog(frm);
		});


	},

	prompt_for_project_on_duplicate: function (frm) {
		// let original_sales_order_name = null;
		const original_doc = frm.doc;
		const original_sales_order_name = frappe.dynamic_link?.original_doc_name;

		// frappe.show_alert({ message: __('original_doc.name: {0}', [original_sales_order_name]), indicator: 'blue' });

		let dialog = new frappe.ui.Dialog({
			title: __("Duplicate Sales Order to New Project"),
			fields: [
				{
					label: __("Original Project"),
					fieldname: "original_project",
					fieldtype: "Link",
					options: "Project",
					default: original_doc.project,
					read_only: 1,
					description: __("This is the project from the original document.")
				},
				{
					label: __("New Project"),
					fieldname: "new_project",
					fieldtype: "Link",
					options: "Project",
					reqd: 1,
					description: __("Select the target project for this new Sales Order.")
				},
			],
			primary_action_label: __("Duplicate and Update"),
			primary_action: (values) => {
				// 다이얼로그가 다시 뜨지 않도록 플래그를 설정합니다.
				frm.is_duplicate_processed = true;
				dialog.hide();

				frappe.show_alert({ message: __('Processing duplication... Please wait.'), indicator: 'blue' });

				// --- 2. 서버 스크립트 호출 ---
				frappe.call({
					method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.duplicate_sales_order",
					args: {

						original_sales_order_name: original_sales_order_name,
						new_project_name: values.new_project
					},
					callback: function (r) {
						if (r.message) {
							const data = r.message;

							// --- 3. 서버로부터 받은 정보로 프론트엔드 업데이트 ---
							console.log("Server response:", data);

							const original_so_data = frm.doc;
							const original_items_map = new Map();
							(original_so_data.finished_items || []).forEach(item => {
								original_items_map.set(item.name, item);
							});

							// 3-1. 메인 Project 필드 업데이트
							frm.set_value("project", values.new_project);

							// 3-2. 'finished_items' 테이블 업데이트
							const finished_items = frm.doc.finished_items || [];
							let items_updated = false;

							finished_items.forEach(row => {
								const original_row = original_items_map.get(row.name);

								if (original_row) {
									original_zone_name = original_row.zone_name;
									if (original_zone_name && data.zone_map[original_zone_name]) {
										row.zone_name = data.zone_map[original_zone_name];
										console.log(`Updated zone_name for row ${row.name}: ${original_zone_name} -> ${row.zone_name}`);
										items_updated = true;
									}
								}

								// 원본 Spec에 해당하는 새 Spec이 있는지 확인
								if (row.door_hw_spec && data.spec_map[row.door_hw_spec]) {
									row.door_hw_spec = data.spec_map[row.door_hw_spec];
									items_updated = true;
								}
							});

							if (items_updated) {
								frm.refresh_field("finished_items");
							}

							frappe.show_alert({ message: __('Duplication complete! Please review and save.'), indicator: 'green' });
							// frm.dirty(); // 폼을 '수정됨' 상태로 만들어 저장 버튼 활성화
						}
					},
					error: function (r) {
						frappe.show_alert({ message: __('An error occurred during duplication.'), indicator: 'red' });
						console.error("Duplication Error:", r);
					}
				});
			},
		});

		dialog.show();
	},

	project: function (frm) {

		if (frm.custom_state) {
			frm.custom_state.hw_spec_map = {};
		}

		// project 필드가 변경되면 Zone 필터 쿼리를 다시 설정
		frm.set_value('zone_selected', null);

		if (frm.is_duplicate_processed) {
			// 플래그를 다시 false로 초기화하여, 다음 번에 사용자가 직접 변경할 때는 정상 작동하도록 합니다.
			frm.is_duplicate_processed = false;
			return;
		}

		(frm.doc.finished_items || []).forEach(d => d.zone_name = null);
		// (frm.doc.sub_assembly_items || []).forEach(d => d.zone_name = null);
		frm.refresh_field(['finished_items', 'sub_assembly_items']);
		set_query_for_table(frm, 'finished_items', 'zone_name', 'project', frm.doc.project);
		// set_query_for_table(frm, 'zone_table', 'zone_name', 'project', frm.doc.project);
	},

	zone_selected: function (frm, cdt, cdn) {

		// [수정] Zone 선택 시 페이지네이션 제어 및 필터링 적용
		const grid = frm.fields_dict['finished_items'].grid;
		
		if (grid) {
			if (frm.doc.zone_selected) {
				// Zone이 선택되면 모든 데이터를 한 페이지에 불러와서 필터링 (Pagination 비활성화 효과)
				grid.grid_pagination.page_length = 9999;
			} else {
				// Zone 해제 시 기본 페이지네이션 복구 (기본값 50)
				grid.grid_pagination.page_length = 50;
			}
			
			// 그리드를 새로고침하면 refresh 내부에서 apply_visibility_rules가 호출됨
			grid.refresh();
		}

		// apply_visibility_rules(frm); // grid.refresh() 안에서 호출되므로 중복 제거
		update_zone_summary_table(frm);
	}
});

const debounced_auto_save = frappe.utils.debounce((frm) => {
	// 문서에 저장되지 않은 변경사항이 있을 때만 저장합니다.
	if (frm.is_dirty()) {
		console.log("Auto-saving changes...");
		frappe.call({
			method: 'frappe.desk.form.save.savedocs',
			args: {
				doc: frm.doc,
				action: 'Save'
			},
			callback: function(r) {
				// 4. 저장이 완료되면 UI를 업데이트
				console.log("Auto-save successful.");
				
				// 4-1. 폼의 상태를 최신으로 갱신 (중요!)
				//      - r.docs[0]에는 서버에서 저장된 최신 doc 데이터가 들어있음
				//      - frm.refresh_from_server()와 유사한 동작
				$(frm.wrapper).trigger("rebuild-form-state");
				frm.refresh_fields();
				
				// 4-2. 'Saved' 메시지를 잠시 보여줌
				frm.page.set_indicator(__("Saved"), "green");
				// 0.1초 후에 메시지 지움
				setTimeout(() => frm.page.clear_indicator(), 100);
			},
			error: function(r) {
				// 5. 에러 발생 시 처리
				console.error("Auto-save failed:", r);
				frm.page.set_indicator(__("Save Failed"), "red");
			}
		});
	}
}, 300);


function trigger_auto_save_if_complete(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	// item_code, item_name, ch, width 값이 모두 있을 때만 저장 실행
	if (row.item_code && row.item_name && row.height && row.planned_qty) {
		debounced_auto_save(frm);
	}
}


function update_zone_summary_table(frm) {
	// const selected_zone = frm.doc.zone_selected;
	const all_items = frm.doc.finished_items || [];

	let grand_total_lm = 0;
	let grand_total_square_m = 0;
	all_items.forEach(item => {
		grand_total_lm += flt(item.lm);
		grand_total_square_m += flt(item.square_m);
	});

	frm.doc.grand_total_lm = grand_total_lm;
	frm.doc.grand_total_square_m = grand_total_square_m;
	frm.refresh_field('grand_total_lm');
	frm.refresh_field('grand_total_square_m');

	const color_fields = [
        'color_frame', 'color_transom', 'color_leaf', 'color_lipseal', 
        'color_panel', 'color_clch', 'color_base', 'color_junction'
    ];

	const cl_base_fields = [
		'clch_type', 'ceiling_visible', 'base_type', 'base_visible_h'
	]

	const zone_summary_map = {};
	
	all_items.forEach(item => {
		// 필터링된 뷰가 아니므로 모든 Zone을 계산
		if (item.zone_name) {
			const zone = item.zone_name;
			if (!zone_summary_map[zone]) {
				zone_summary_map[zone] = { 
					lm: 0, 
					square_m: 0, 
					colors: new Set(),
					ch_set: new Set(), 
					ph_set: new Set(),
					detail_colors: {}, 
					clch_type: null, 
					ceiling_visible: 0, 
					base_type: null, 
					base_visible_h: 0 
				};
			}
			zone_summary_map[zone].lm += flt(item.lm);
			zone_summary_map[zone].square_m += flt(item.square_m);
			if (item.color) {
				zone_summary_map[zone].colors.add(item.color);
			}
			if (item.ch) {
				zone_summary_map[zone].ch_set.add(item.ch);
			}
			if (item.ph) {
				zone_summary_map[zone].ph_set.add(item.ph);
			}

			if (cint(item.indent_level) === 0 && Object.keys(zone_summary_map[zone].detail_colors).length === 0) {
                color_fields.forEach(field => {
                    // finished_items의 필드명 -> zone_summary의 필드명 (prefix: zone_)
                    zone_summary_map[zone].detail_colors[`zone_${field}`] = item[field];
                });
				cl_base_fields.forEach(field => {
					zone_summary_map[zone][field] = item[field];
				});
            }
		}
	});

	// Zone doctype에 직접 업데이트
	for (const [zone_id, data] of Object.entries(zone_summary_map)) {
		let update = {
			lm: data.lm,
			square_m: data.square_m,
			zone_overall_color: Array.from(data.colors).join(', '),
			ch: Array.from(data.ch_set).join(', '),
			ph: Array.from(data.ph_set).join(', ')
		};
		Object.assign(update, data.detail_colors);
		cl_base_fields.forEach(f => {
			let val = data[f];
			if ((f === 'ceiling_visible' || f === 'base_visible_h') && (val === null || val === undefined)) val = 0;
			update[f] = val;
		});

		frappe.call({
			method: 'frappe.client.set_value',
			args: { doctype: 'Zone', name: zone_id, fieldname: update },
			async: false
		});
	}

	// DB 업데이트 후 HTML 집계 화면도 다시 렌더링 (자동 업데이트)
	if (typeof render_new_zone_summary === 'function') {
		render_new_zone_summary(frm);
	}
}

frappe.ui.form.on("Sales Order Zone", {
	// sales_order_zone_add: function (frm, cdt, cdn) {
	// 	frm.refresh_field('zone_summary');
	// }
});


frappe.ui.form.on("Sales Order Finished Items", {
	// Edit 다이얼로그가 열릴 때도 dimension_rule readonly 적용
	form_render: function (frm, cdt, cdn) {
		setTimeout(() => apply_dimension_rule_to_edit_dialog(frm, cdt, cdn), 100);
	},
	item_code: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.item_code && !row.product_section) {
			frappe.db.get_value("Item", row.item_code, "product_section", (r) => {
				if (r && r.product_section) {
					frappe.model.set_value(cdt, cdn, 'product_section', r.product_section);
				}
			});
		}
		// Item.dimension_rule에 따라 height/width readonly 토글
		apply_dimension_rule_readonly(frm, cdt, cdn);
		update_calculated_price(frm, cdt, cdn);
		// trigger_auto_save_if_complete(frm, cdt, cdn);
	},

	item_name: function (frm, cdt, cdn) {
		update_calculated_price(frm, cdt, cdn);
		// trigger_auto_save_if_complete(frm, cdt, cdn);
	},

	height: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const h_value = flt(row.height);

		// height → ch/ph 직접 할당(순환 핸들러 재트리거 방지).
		// frappe.model.set_value는 비동기라 height가 0으로 초기화되는 버그 발생 (feedback_height_sync.md).
		if (row.product_section == 'Door' && h_value) {
			row.ch = h_value;
			row.ph = 0;
			frm.refresh_field('finished_items');
		}
		else if (row.product_section == 'Panel' && h_value) {
			row.ch = 0;
			row.ph = h_value;
			frm.refresh_field('finished_items');
		}

		calculate_row_values(frm, cdt, cdn);
		update_calculated_price(frm, cdt, cdn);
		update_zone_summary_table(frm);
	},

	ch: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const ch_value = flt(row.ch);

		// ch → height 직접 할당(순환 방지)
		if (ch_value && flt(row.height) !== ch_value) {
			row.height = ch_value;
			frm.refresh_field('finished_items');
		}

		update_zone_summary_table(frm);
	},

	ph: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const ph_value = flt(row.ph);

		// ph → height 직접 할당(순환 방지)
		if (ph_value && flt(row.height) !== ph_value) {
			row.height = ph_value;
			frm.refresh_field('finished_items');
		}

		update_zone_summary_table(frm);
	},

	width: function (frm, cdt, cdn) {
		calculate_row_values(frm, cdt, cdn);
		update_calculated_price(frm, cdt, cdn);
		// trigger_auto_save_if_complete(frm, cdt, cdn);
	},

	planned_qty: function (frm, cdt, cdn) {
		const currentRow = locals[cdt][cdn];

		// 1. 변경된 행이 부모 아이템(indent_level == 0)인지 확인합니다.
		if (currentRow.indent_level === 0) {
			const parent_name = currentRow.name;
			const new_qty = currentRow.planned_qty;

			// 2. 전체 finished_items 목록을 순회하여 이 부모를 참조하는 모든 자식들을 찾습니다.
			(frm.doc.finished_items || []).forEach(row => {
				// 부모를 참조하는 자식 행인지 확인
				if (row.fg_reference_id === parent_name) {
					// 3. 자식 행의 qty 값을 부모의 새 qty 값으로 업데이트합니다.
					// set_value는 자동으로 화면을 갱신합니다.
					frappe.model.set_value(row.doctype, row.name, 'planned_qty', new_qty);
				}
			});

			// 변경사항이 화면에 즉시 반영되도록 그리드를 새로고침합니다.
			frm.refresh_field('finished_items');
		} else {

		}
		// planned_qty 변경 시 vp_amount과 price 재계산
		const row = locals[cdt][cdn];
		const qty = flt(row.planned_qty) || 1;
		if (row.vp) {
			frappe.model.set_value(cdt, cdn, 'vp_amount', flt(row.vp) * qty);
		}
		if (row.calc_price) {
			frappe.model.set_value(cdt, cdn, 'price', flt(row.calc_price) * qty);
		}
		update_grand_total_vp(frm);

		trigger_auto_save_if_complete(frm, cdt, cdn);
		update_calculated_price(frm, cdt, cdn);
	},

	calc_price: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const qty = flt(row.planned_qty) || 1;
		frappe.model.set_value(cdt, cdn, 'price', flt(row.calc_price) * qty);
	},

	vp: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const qty = flt(row.planned_qty) || 1;
		frappe.model.set_value(cdt, cdn, 'vp_amount', flt(row.vp) * qty);
		update_grand_total_vp(frm);
	},

	product_section: function (frm, cdt, cdn) {
		// 현재 행의 item_code와 item_name을 비웁니다.
		// frappe.model.set_value(cdt, cdn, 'item_code', null);
		// frappe.model.set_value(cdt, cdn, 'item_name', null);

		const grid = frm.get_field('finished_items').grid;
		const grid_row = grid.grid_rows_by_docname[cdn];
		if (grid_row) {
			render_door_hardware_details(frm, grid_row);
		}

		// 만약 "Door"가 아니게 되면, 저장된 값을 지웁니다.
		const row = locals[cdt][cdn];

		if (row.product_section !== 'Door') {
			frappe.model.set_value(cdt, cdn, 'door_hw_spec', null);
			frappe.model.set_value(cdt, cdn, 'keeper', null);
			frappe.model.set_value(cdt, cdn, 'hinge', null);
			frappe.model.set_value(cdt, cdn, 'undercut', null);

			if (row.product_section == 'Option' || row.product_section == 'Price Study' || row.product_section == 'Sub Contract') {
			frappe.model.set_value(cdt, cdn, 'height', 0);
			frappe.model.set_value(cdt, cdn, 'width', 0);
		}

			frm.refresh_field('finished_items');
		}

		

		const sub_item_section = ["Option", "Price Study", "Sub Contract"];

		if (row && sub_item_section.includes(row.product_section)) {
			const new_indent = cint(row.parent_row_no) > 0 ? 2 : 0;
			frappe.model.set_value(cdt, cdn, 'indent_level', new_indent);
		}
		
		// planned_qty 필드 표시/숨김 처리
		if (grid_row) {
			toggle_planned_qty_field(grid_row, row.product_section);
		}
		
		update_calculated_price(frm, cdt, cdn);
	},

	zone_name: function (frm, cdt, cdn) {
		// 현재 행의 데이터를 가져옵니다.
		const currentRow = locals[cdt][cdn];
		const newZoneName = currentRow.zone_name;

		// zone_name이 비어있으면 아무 작업도 하지 않습니다.
		if (!newZoneName) {
			return;
		}
		
		// zone_name 변경 시 zone_summary 업데이트
		update_zone_summary_table(frm);
	},
	
	lm: function (frm, cdt, cdn) {
		// lm 값이 변경될 때마다 zone_summary의 total_lm 업데이트
		update_zone_summary_table(frm);
	},
	
	square_m: function (frm, cdt, cdn) {
		// square_m 값이 변경될 때마다 zone_summary의 total_square_m 업데이트
		update_zone_summary_table(frm);
	},
	
	color: function (frm, cdt, cdn) {
		// color 값이 변경될 때마다 zone_summary의 zone_color 업데이트
		update_zone_summary_table(frm);
	},

	finished_items_add: function (frm, cdt, cdn) {

		if (frm.is_duplicating) {
			// 복제 기능에 의해 행이 추가된 경우, 값 복사 로직을 실행하지 않고 종료합니다.
			// renumber_finished_items(frm);
			console.log("finished_items_add event triggered during duplication, skipping value copy.");
			return;
		}

		// 1. 기본 Zone 설정 함수를 먼저 호출
		set_default_zone(frm, cdt, cdn);
		// 2. 방금 추가된 새로운 행의 데이터를 가져옴
		let new_row = locals[cdt][cdn];

		// 3. 부모 참조 ID가 없는 경우 (메인 아이템인 경우)에만 복제 로직을 실행
		if (!new_row.fg_reference_id) {
			// 메인 아이템이므로, indent_level을 0으로 설정
			frappe.model.set_value(cdt, cdn, 'indent_level', 0);

			// --- 🔥 새로운 행 값 복제 로직 시작 🔥 ---

			// 3-1. 복제할 값을 찾을 기준이 되는 zone_name을 가져옴.
			const current_zone = frm.doc.zone_selected;
			if (!current_zone) {
				// Zone이 설정되지 않았다면 사용자에게 메시지를 보여주고 복제 로직을 중단합니다.
				frappe.msgprint({
					title: __('Zone Not Selected'),
					indicator: 'orange', // 주황색 느낌표 아이콘
					message: __('Please select a Zone in the "Zone List" field above before adding new items.')
				});

				// 추가된 빈 행은 그대로 두고, 이후 로직만 중단합니다.
				apply_visibility_rules(frm); // 필요하다면 호출

				return;
			}

			// 3-2. 현재 그리드에 있는 모든 행들 중에서,
			//      - 같은 zone_name을 가지고 있고,
			//      - 방금 추가된 새 행이 아니며,
			//      - 부모 아이템(indent_level == 0)인 첫 번째 행 검색
			const source_row = [...(frm.doc.finished_items || [])].reverse().find(row =>
				row.zone_name === current_zone &&
				row.name !== new_row.name &&
				cint(row.indent_level) === 0
			);

			// 3-3. 복제할 소스 행(source_row)을 찾았다면, 값을 복사
			if (source_row) {
				// console.log("Found a source row to copy from:", source_row);

				// 복사에서 제외할 필드 목록
				const exclude_fields = new Set([
					'name', 'doctype', 'parent', 'parenttype', 'parentfield', 'idx', // 시스템 필드
					'product_section', 'item_code', 'item_name', // 명시적으로 제외할 필드
					'vp', 'price', 'remark',
					'fg_reference_id', 'parent_row_no', 'indent_level', // 그룹 관련 필드
					'lm', 'square_m', 'calc_price', 'calc_price_unit', // 계산 필드
					'__checked', '_expanded' // UI 상태 필드
				]);

				let values_to_copy = {};
				// source_row의 모든 속성을 순회
				for (const key in source_row) {
					// 객체 자신의 속성이며, 제외 목록에 없는 경우에만 복사 대상에 추가
					if (Object.prototype.hasOwnProperty.call(source_row, key) && !exclude_fields.has(key)) {
						values_to_copy[key] = source_row[key];
					}
				}

				// console.log("Values to be copied:", values_to_copy);

				// 찾은 값들을 새로운 행에 한 번에 설정
				frappe.model.set_value(cdt, cdn, values_to_copy);
			}
			// --- 🔥 새로운 행 값 복제 로직 끝 🔥 ---
		}
		reorder_items_client_side(frm);

		// 4. 가시성 규칙 적용
		apply_visibility_rules(frm);
		
		// 5. planned_qty 필드 표시/숨김 처리
		const grid = frm.get_field('finished_items').grid;
		const grid_row = grid.grid_rows_by_docname[cdn];
		if (grid_row && new_row) {
			toggle_planned_qty_field(grid_row, new_row.product_section);
		}
	},
	
	finished_items_remove: function(frm, cdt, cdn) {
		// 행이 삭제될 때도 가시성 규칙 적용
		apply_visibility_rules(frm);
		
		// 행이 삭제될 때 zone_summary 업데이트
		update_zone_summary_table(frm);
	},
});

// Item.dimension_rule + Item.include_lm에 따라 해당 행의 height/width 편집 가능 여부 설정
// - include_lm=1 → dimension_rule 무시, 둘 다 편집 가능
// - WIDTH  → height readonly + height=0 (width만 변경 가능)
// - HEIGHT → width readonly + width=0 (height만 변경 가능)
// - NONE   → 둘 다 readonly + 둘 다 0
// - ALL/미설정 → 둘 다 편집 가능
function apply_dimension_rule_readonly(frm, cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row) return;

	const grid = frm.fields_dict['finished_items']?.grid;
	const grid_row = grid && grid.grid_rows_by_docname[row.name];
	if (!grid_row) return;

	const apply_block = ($cell, editable) => {
		$cell.toggleClass('force-readonly-cell', !editable);
		// input 자체에 readonly + tabindex=-1 → 키보드 입력 및 Tab 이동 차단
		$cell.find('input').each(function () {
			if (editable) {
				$(this).prop('readonly', false).removeAttr('tabindex');
			} else {
				$(this).prop('readonly', true).attr('tabindex', '-1');
			}
		});
	};

	const set_editable = (rule, include_lm) => {
		// include_lm 체크 시 dimension_rule 무시
		if (include_lm) rule = null;

		const height_editable = rule !== 'WIDTH' && rule !== 'NONE';
		const width_editable = rule !== 'HEIGHT' && rule !== 'NONE';

		grid_row.toggle_editable('height', height_editable);
		grid_row.toggle_editable('width', width_editable);

		const $row = $(grid_row.row);
		apply_block($row.find('.col[data-fieldname="height"]'), height_editable);
		apply_block($row.find('.col[data-fieldname="width"]'), width_editable);

		// readonly인 필드 값을 0으로 초기화 (직접 할당으로 순환 핸들러 재트리거 방지)
		let changed = false;
		if (!height_editable && flt(row.height) !== 0) {
			row.height = 0;
			changed = true;
		}
		if (!width_editable && flt(row.width) !== 0) {
			row.width = 0;
			changed = true;
		}
		if (changed) frm.refresh_field('finished_items');
	};

	if (!row.item_code) {
		set_editable(null, false);
		return;
	}

	// row.item_code는 Item.name 또는 raw item_code 가능성 → 두 가지 조회 fallback
	frappe.db.get_value('Item', row.item_code, ['dimension_rule', 'include_lm'], (r) => {
		if (r && Object.keys(r).length) {
			set_editable(r.dimension_rule || null, !!cint(r.include_lm));
			return;
		}
		frappe.db.get_list('Item', {
			filters: { item_code: row.item_code },
			fields: ['dimension_rule', 'include_lm'],
			limit: 1
		}).then(items => {
			if (items && items.length) {
				set_editable(items[0].dimension_rule || null, !!cint(items[0].include_lm));
			} else {
				set_editable(null, false);
			}
		});
	});
}

// 그리드 전체 행에 dimension_rule readonly 규칙 적용 (refresh 시 호출)
function apply_all_dimension_rule_readonly(frm) {
	const grid = frm.fields_dict['finished_items']?.grid;
	if (!grid) return;
	grid.grid_rows.forEach(grid_row => {
		if (grid_row.doc) {
			apply_dimension_rule_readonly(frm, grid_row.doc.doctype, grid_row.doc.name);
		}
	});
}

// Edit 다이얼로그에서도 dimension_rule에 따라 width/height를 차단.
function apply_dimension_rule_to_edit_dialog(frm, cdt, cdn) {
	const row = locals[cdt] && locals[cdt][cdn];
	if (!row || !row.item_code) return;

	const grid = frm.fields_dict['finished_items']?.grid;
	const grid_row = grid && grid.grid_rows_by_docname[cdn];
	if (!grid_row) return;

	// grid_row.grid_form이 현재 열린 Edit 다이얼로그.
	// 없으면 DOM에서 직접 찾기.
	const $form_wrapper = grid_row.grid_form && grid_row.grid_form.wrapper
		? $(grid_row.grid_form.wrapper)
		: $('.grid-row-open-form').last();
	if (!$form_wrapper.length) return;

	const resolve = (rule, include_lm) => {
		if (include_lm) rule = null;
		const height_editable = rule !== 'WIDTH' && rule !== 'NONE';
		const width_editable = rule !== 'HEIGHT' && rule !== 'NONE';

		const lock = (fieldname, editable) => {
			// grid_form의 fields_dict를 통해 docfield를 직접 수정하면 가장 확실
			if (grid_row.grid_form && grid_row.grid_form.fields_dict[fieldname]) {
				const field = grid_row.grid_form.fields_dict[fieldname];
				field.df.read_only = editable ? 0 : 1;
				if (typeof field.refresh === 'function') field.refresh();
			}
			// DOM에도 직접 적용 (backup)
			const $ctrl = $form_wrapper.find(`[data-fieldname="${fieldname}"]`);
			$ctrl.toggleClass('force-readonly-cell', !editable);
			$ctrl.find('input, textarea').each(function () {
				if (editable) {
					$(this).prop('readonly', false).prop('disabled', false).removeAttr('tabindex');
				} else {
					$(this).prop('readonly', true).attr('tabindex', '-1');
				}
			});
		};
		lock('height', height_editable);
		lock('width', width_editable);
	};

	frappe.db.get_value('Item', row.item_code, ['dimension_rule', 'include_lm'], (r) => {
		if (r && Object.keys(r).length) {
			resolve(r.dimension_rule || null, !!cint(r.include_lm));
		} else {
			frappe.db.get_list('Item', {
				filters: { item_code: row.item_code },
				fields: ['dimension_rule', 'include_lm'],
				limit: 1
			}).then(items => {
				if (items && items.length) {
					resolve(items[0].dimension_rule || null, !!cint(items[0].include_lm));
				}
			});
		}
	});
}

// 다이얼로그 내부에서도 force-readonly-cell 입력 차단 (body level delegated)
if (!$(document.body).data('dim_rule_dialog_bound')) {
	$(document.body).data('dim_rule_dialog_bound', true);
	$(document.body).on('keydown', '.grid-row-open-form .force-readonly-cell input, .grid-row-open-form .force-readonly-cell textarea', function (e) {
		const allowed = [9, 27, 37, 38, 39, 40];
		if (!allowed.includes(e.keyCode)) {
			e.preventDefault();
			e.stopPropagation();
		}
	});
	$(document.body).on('focusin', '.grid-row-open-form .force-readonly-cell input, .grid-row-open-form .force-readonly-cell textarea', function () {
		$(this).blur();
	});
	$(document.body).on('mousedown click', '.grid-row-open-form .force-readonly-cell input, .grid-row-open-form .force-readonly-cell textarea', function (e) {
		e.preventDefault();
		e.stopPropagation();
	});
}

function toggle_planned_qty_field(grid_row, product_section) {
	if (!grid_row || !grid_row.row) return;

	// 컬럼은 항상 표시, Option/Price Study/Sub Contract만 값(input/static)을 숨김
	const allowed_sections = ['Door', 'Leaf', 'Panel', ''];
	const should_show_value = allowed_sections.includes(product_section);

	const $cell = $(grid_row.row).find('.col[data-fieldname="planned_qty"]');
	if (!$cell.length) return;

	$cell.show(); // 컬럼 자체는 항상 표시
	// 값(input, static-area)만 표시/숨김
	$cell.find('.field-area, .static-area').css('visibility', should_show_value ? '' : 'hidden');
}

// grid의 모든 행에 대해 planned_qty 필드 표시/숨김 처리
function update_all_planned_qty_visibility(frm) {
	const grid = frm.fields_dict['finished_items']?.grid;
	if (!grid) return;
	
	grid.grid_rows.forEach(grid_row => {
		if (grid_row.doc) {
			toggle_planned_qty_field(grid_row, grid_row.doc.product_section);
		}
	});
}


function set_default_project(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	if (!row.project) { // Add row check
		frappe.model.set_value(cdt, cdn, 'project', frm.doc.project);
	}
}

function set_default_zone(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	if (frm.doc.zone_selected) {
		frappe.model.set_value(cdt, cdn, 'zone_name', frm.doc.zone_selected);
		frappe.model.set_value(cdt, cdn, 'product_type', frm.doc.zone_product_type)
	}
}

function set_query_for_table(frm, table_fieldname, target_fieldname, filter_fieldname, filter_value) {
	frm.set_query(target_fieldname, table_fieldname, function (doc, cdt, cdn) {
		if (filter_value) {
			return {
				filters: {
					[filter_fieldname]: filter_value
				}
			};
		} else {
			// 프로젝트가 선택되지 않았다면 아무 필터도 적용하지 않습니다.
			return { filters: {} };
		}
	});
}

function set_query_for_row(frm, table_fieldname, target_fieldname, filter_fieldname, filter_value) {
	frm.set_query(target_fieldname, table_fieldname, function (doc, cdt, cdn) {
		let row = locals[cdt][cdn]; // 현재 행의 데이터를 가져옵니다.
		if (row && row[filter_value]) {
			return {
				filters: {
					[filter_fieldname]: row[filter_value]
				}
			};
		}
		return { filters: {} };
	});
}

function reorder_items_client_side(frm) {
	const items = frm.doc.finished_items || [];
	if (items.length === 0) return;

	const name_to_idx_map = {};
	let is_dirty = false;

	// 1. 현재 그리드 순서대로 idx 재할당 (UI상 순서 보정)
	items.forEach((row, index) => {
		let new_idx = index + 1;
		
		// idx가 변경되었다면 업데이트
		if (row.idx !== new_idx) {
			row.idx = new_idx;
			// 로컬 데이터 동기화 (locals는 Frappe 데이터 저장소)
			if (locals[row.doctype] && locals[row.doctype][row.name]) {
				locals[row.doctype][row.name].idx = new_idx;
			}
			is_dirty = true;
		}
		
		// 맵 생성
		name_to_idx_map[row.name] = new_idx;
	});

	// 2. fg_reference_id를 이용하여 parent_row_no 업데이트
	items.forEach(row => {
		// 자식 아이템: 부모가 존재하면 parent_row_no 업데이트
		if (row.fg_reference_id && name_to_idx_map[row.fg_reference_id]) {
			const new_parent_row_no = name_to_idx_map[row.fg_reference_id];
			
			if (cint(row.parent_row_no) !== new_parent_row_no) {
				row.parent_row_no = new_parent_row_no;
				
				// 로컬 데이터 동기화
				if (locals[row.doctype] && locals[row.doctype][row.name]) {
					locals[row.doctype][row.name].parent_row_no = new_parent_row_no;
				}
				is_dirty = true;
			}
		} 
		// 부모 아이템: parent_row_no가 있으면 제거
		else if (cint(row.indent_level) === 0) {
			if (cint(row.parent_row_no)) {
				row.parent_row_no = 0; // Integer 필드 초기화
				
				if (locals[row.doctype] && locals[row.doctype][row.name]) {
					locals[row.doctype][row.name].parent_row_no = 0;
				}
				is_dirty = true;
			}
		}
	});

	// 3. 변경 사항 반영
    if (is_dirty) {
        frm.dirty();
    }
}

function setup_duplicate_button_for_grid(frm, table_fieldname) {
	const grid = frm.fields_dict[table_fieldname].grid;
	const grid_wrapper = $(grid.wrapper);

	// 이미 버튼이 추가되었는지 확인하여 중복 생성을 방지
	if (grid_wrapper.find('.btn-custom-duplicate').length > 0) {
		return;
	}

	// 'Duplicate' 버튼 생성
	const duplicate_button = $('<button class="btn btn-secondary btn-xs btn-custom-duplicate" style="margin-right: 4px; display: none;">' + __('Duplicate') + '</button>');

	// 버튼 위치 지정: 'Add Row' 버튼 뒤 또는 그리드 버튼 영역의 맨 끝
	const add_row_button = grid_wrapper.find('.grid-add-row');
	if (add_row_button.length > 0) {
		add_row_button.after(duplicate_button);
	} else {
		grid_wrapper.find('.grid-buttons').append(duplicate_button);
	}

	// 버튼 클릭 이벤트
	duplicate_button.on('click', function () {
		const selected_docs = grid.get_selected_children();
		if (selected_docs.length === 0) {
			frappe.show_alert({ message: __('Please select rows to duplicate.'), indicator: 'orange' });
			return;
		}

		frm.is_duplicating = true;

		// --- 1. 부모 행과 자식 행을 분리 ---
		const parent_docs_to_duplicate = selected_docs.filter(d => cint(d.indent_level) === 0);
		const children_docs_to_duplicate = selected_docs.filter(d => cint(d.indent_level) > 0);

		// --- 2. 새로운 부모-자식 관계를 매핑할 객체 ---
		// Key: 원본 부모의 name, Value: 새로 복제된 부모의 doc 객체
		const original_to_new_parent_map = {};

		// --- 3. 부모 행들을 먼저 복제 ---
		parent_docs_to_duplicate.forEach(original_parent_doc => {
			// 복제할 데이터에서 fg_reference_id를 제거합니다.
			let new_parent_data = frappe.model.copy_doc(original_parent_doc);
			delete new_parent_data.name; // 새 name을 할당받도록 name 제거
			new_parent_data.fg_reference_id = null;
			new_parent_data.indent_level = 0; // 명시적으로 0 설정
			new_parent_data.parent_row_no = null; // 부모 행이므로 parent_row_no 제거

			if (!new_parent_data.remark) {
				new_parent_data.remark = `Duplicated`;
			}

			// 새 행을 추가하고, 반환된 doc 객체를 받습니다.
			const new_parent_row_doc = grid.add_new_row(null, null, null, new_parent_data);

			// 맵에 "원본 부모 name" -> "새 부모 doc"을 저장합니다.
			original_to_new_parent_map[original_parent_doc.name] = new_parent_row_doc;
		});

		// --- 4. 자식 행들을 복제하고 새 부모와 연결 ---
		children_docs_to_duplicate.forEach(original_child_doc => {
			// 이 자식의 원본 부모를 찾습니다.
			const original_parent_name = original_child_doc.fg_reference_id;

			// 맵에서 새로 복제된 부모를 찾습니다.
			let new_parent_row_doc = original_to_new_parent_map[original_parent_name];

			// 만약 선택된 자식의 부모가 함께 선택되지 않았다면, 복제하지 않고 건너뜁니다.
			if (!new_parent_row_doc) {
				const all_current_rows = grid.get_data();

				// 선택된 자식의 idx보다 작은 행들 중에서,
				// indent_level이 0인 가장 마지막 부모를 찾습니다.
				let closest_parent = null;
				for (let i = original_child_doc.idx - 2; i >= 0; i--) {
					const row_above = all_current_rows[i];
					if (row_above && cint(row_above.indent_level) === 0) {
						closest_parent = row_above;
						break; // 가장 가까운 부모를 찾았으므로 루프 중단
					}
				}

				if (closest_parent) {
					// 찾은 부모를 '새로운' 부모로 지정합니다.
					// 이 경우는 부모가 복제된 것이 아니므로, 그냥 기존 부모 객체를 사용합니다.
					new_parent_row_doc = closest_parent;
					console.log(`Child-only duplication: Found closest parent '${closest_parent.name}' for child '${original_child_doc.name}'.`);
				} else {
					// 가장 가까운 부모조차 찾지 못하면 복제를 건너뜁니다.
					console.warn(`Could not find a parent for duplicating child '${original_child_doc.name}'. Skipping.`);
					return;
				}
			}

			let new_child_data = frappe.model.copy_doc(original_child_doc);
			delete new_child_data.name;

			// [요구사항 2] 새 부모의 정보로 업데이트
			new_child_data.parent_row_no = new_parent_row_doc.idx;
			new_child_data.fg_reference_id = new_parent_row_doc.name;

			// 새 자식 행을 추가합니다.
			grid.add_new_row(null, null, null, new_child_data);
			
		});


		// --- 5. 최종 처리 ---
		frm.refresh_field(table_fieldname);
		// frappe.show_alert({ message: __('Selected rows duplicated.'), indicator: 'green' });

		setTimeout(() => {
			// 1. 그리드의 모든 행(UI 객체와 데이터)을 순회합니다.
			//    frm.doc[table_fieldname]을 사용해야 복제된 새 행을 포함한 모든 데이터를 가져올 수 있습니다.
			(frm.doc[table_fieldname] || []).forEach(row_doc => {
				// 2. 데이터 모델의 __checked 상태를 0으로 강제 설정합니다.
				if (row_doc.__checked) {
					row_doc.__checked = 0;
				}

				// 3. UI 체크박스의 checked 속성을 false로 강제 설정합니다.
				const grid_row = grid.get_row(row_doc.name);
				if (grid_row) {
					$(grid_row.row).find('.grid-row-check').prop('checked', false);
				}
			});

			// 4. 그리드 헤더의 '전체 선택' 체크박스도 해제합니다.
			if (grid.header_row && grid.header_row.global_checkbox) {
				grid.header_row.global_checkbox.prop('checked', false);
			}

			toggle_duplicate_button(frm, table_fieldname);
			toggle_move_to_button(frm, table_fieldname);
			$(grid.wrapper).find('.highlight-row').removeClass('highlight-row');
			frm.is_duplicating = false;
		}, 100);
	});

	// 행의 체크박스(개별 또는 전체) 상태가 변경될 때마다 버튼 표시/숨김 처리
	grid_wrapper.on('change', '.grid-row-check, .grid-select-all', function () {
		toggle_duplicate_button(frm, table_fieldname);
	});
}

// Duplicate 버튼 보이기/숨기기 헬퍼 함수
function toggle_duplicate_button(frm, table_fieldname) {
	if (!frm.fields_dict[table_fieldname] || !frm.fields_dict[table_fieldname].grid) return;

	let grid = frm.fields_dict[table_fieldname].grid;
	let grid_wrapper = $(grid.wrapper);
	let duplicate_button = grid_wrapper.find('.btn-custom-duplicate');

	if (grid.get_selected_children().length > 0) {
		duplicate_button.show();
	} else {
		duplicate_button.hide();
	}
}

function customize_grid_display(frm, table_fieldname, check_action, idx_action) {
	const grid = frm.fields_dict[table_fieldname].grid;

	// 그리드가 존재하지 않거나, 이미 커스터마이징이 적용된 경우 중복 실행을 방지
	if (!grid || grid.is_customized) {
		return;
	}

	/**
	 * 실제 스타일을 적용하는 헬퍼 함수
	 * @param {object} grid_obj - 그리드 객체
	 */
	const apply_styles = function (grid_obj) {
		if (!grid_obj.wrapper) return;

		const grid_wrapper = $(grid_obj.wrapper);

		// 헤더와 모든 행의 체크박스를 숨깁니다.
		if (check_action === 'hide' || check_action === 'show') {
			grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check')[check_action]();
		}

		// 헤더와 모든 행의 인덱스(순번)를 표시
		if (idx_action === 'hide' || idx_action === 'show') {
			grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index')[idx_action]();
		}
	};

	// --- Monkey-Patching: 그리드의 refresh 함수 확장 ---
	// 1. 기존의 refresh 함수를 백업
	const original_refresh = grid.refresh;

	// 2. grid.refresh 함수를 새로운 함수로 덮어씁니다.
	grid.refresh = function () {
		// 3. 백업해 둔 원래 refresh 함수를 먼저 실행
		original_refresh.apply(this, arguments);
		// 4. 원래 함수가 실행된 후, 우리의 커스텀 스타일을 적용
		apply_styles(this);
	};

	// 초기 로드 시에도 스타일을 한 번 적용해줍니다.
	apply_styles(grid);

	// 커스터마이징이 적용되었음을 표시하여, 폼 refresh 시 중복으로 덮어쓰는 것을 방지
	grid.is_customized = true;
}

function adjust_column_widths(frm, left_col_id, left_width, right_col_id, right_width) {
	let $left_column = $(frm.wrapper).find(`.form-column[data-fieldname="${left_col_id}"]`);
	let $right_column = $(frm.wrapper).find(`.form-column[data-fieldname="${right_col_id}"]`);
	if ($left_column.length && $right_column.length) {
		$left_column.css({ 'flex': `0 0 ${left_width}`, 'max-width': left_width });
		$right_column.css({ 'flex': `0 0 ${right_width}`, 'max-width': right_width });
	}
}

function setup_zone_summary_grid(frm) {
	const table_fieldname = 'zone_summary';
	const grid = frm.fields_dict[table_fieldname]?.grid;

	// 중복 생성을 방지하기 위한 플래그
	if (grid.is_zone_summary_setup) {
		highlight_selected_zone_row(frm, grid);
		return;
	}

	const grid_wrapper = $(grid.wrapper);
	const $grid_buttons = grid_wrapper.find('.grid-buttons');
	$grid_buttons.css('width', '100%');

	const add_zone_button = $(`<button class="btn btn-secondary btn-xs btn-add-zone" style="margin-right: 4px;">
								<i class="fa fa-plus"></i> ${__('Add Zone')}
							</button>`);

	const duplicate_zone_button = $(`<button class="btn btn-secondary btn-xs btn-duplicate-zone" style="margin-right: 4px;"> ${__('Duplicate')} </button>`);

	const delete_zone_button = $(`<button class="btn btn-danger btn-xs btn-delete-zone" style="margin-left: auto; margin-right: 4px; display: none;">
								<i class="fa fa-trash"></i> ${__('Delete Zone')}
							</button>`);

	// grid_wrapper.find('.grid-add-row').after(delete_zone_button).after(duplicate_zone_button).after(add_zone_button);
	grid_wrapper.find('.grid-add-row').after(duplicate_zone_button).after(add_zone_button);
	grid_wrapper.find('.grid-buttons').append(delete_zone_button);


	// 4. 버튼에 클릭 이벤트 핸들러 연결
	add_zone_button.on('click', (e) => {
		e.preventDefault(); // 기본 동작(폼 제출 등) 방지
		open_add_zone_dialog(frm, null);
		setTimeout(() => {
			frm.refresh_field('zone_summary');
		}, 100);
	});

	duplicate_zone_button.on('click', (e) => {
		e.preventDefault();
		const source_zone = frm.doc.zone_selected;
		if (!source_zone) {
			frappe.msgprint({
				title: __('No Zone Selected'),
				indicator: 'orange',
				message: __('Please select a Zone to duplicate.')
			});
			return;
		}
		// 복제할 Zone 이름을 넘겨주며 다이얼로그 호출
		open_add_zone_dialog(frm, source_zone);
	});

	delete_zone_button.on('click', (e) => {
		e.preventDefault();
		const selected_zone_id = frm.doc.zone_selected;
		if (!selected_zone_id) {
			frappe.msgprint({
				title: __('No Zone Selected'),
				indicator: 'orange',
				message: __('Please select a Zone to delete.')
			});
			return;
		}

		// 1. 경고 메시지 표시 및 확인
		frappe.confirm(
			__("All Finished Items and sub items registered to the Zone will be deleted."),
			() => {
				// 'Yes' 클릭 시 실행
				perform_zone_and_items_deletion(frm, selected_zone_id);
			},
			() => {
				// 'No' 클릭 시 실행
				return;
			},
			__('Confirm Deletion')
		);
	});

	grid_wrapper.on('mousedown', '.grid-row', function (e) {
		if (e.which !== 1) return;
		
		// console.log(">>> Zone Summary Row Clicked!")
		// 입력 필드나 버튼 클릭 시에는 행 선택 이벤트가 발생하지 않도록 예외 처리
		// if ($(e.target).closest('input, button, a').length > 0) {
			// 	return;
			// }

		update_zone_summary_table(frm);

		e.preventDefault();
		e.stopPropagation();
			
		const $clicked_row = $(this); // 클릭된 행을 변수에 저장
		const row_name = $clicked_row.attr('data-name');
		// const row_name = $(this).attr('data-name');
		
		const grid_row_obj = grid.get_row(row_name);

		if (!grid_row_obj || !grid_row_obj.doc) return;
		const row_doc = grid_row_obj.doc;

		if (!row_doc) return;

		// 현재 설정된 zone_selected 값 확인
		const current_zone = frm.doc.zone_selected;

		// 3. 토글 로직: 이미 선택된 Zone을 다시 클릭했는지 확인
		if (current_zone === row_doc.zone_name) {
			// [해제] 선택된 Zone을 다시 클릭 -> 필터 초기화
			frm.set_value('zone_selected', null);
			frm.set_value('zone_product_type', null);
			// frappe.show_alert({ message: __('No Zone selected'), indicator: 'gray' });
		} else {
			// [선택] 다른 Zone을 클릭 -> 필터 적용
			// 1. 값 업데이트
			frm.set_value('zone_selected', row_doc.zone_name);
			frm.set_value('zone_product_type', row_doc.product_type);
			// frappe.show_alert({ message: __('Zone: {0} selected', [row_doc.zone_name]), indicator: 'blue' });
		}

		setTimeout(() => {
			frm.fields_dict["zone_summary"].grid.wrapper.find('.editable-row').removeClass('editable-row');
			// console.log("Forcibly removed 'editable-row' class.");

			$clicked_row.find('.static-area').show();

			// 3. [하이라이트 적용] 이제 모든 데이터가 보이는 상태이므로, 하이라이트 함수를 호출합니다.
			highlight_selected_zone_row(frm, grid);
			toggle_duplicate_zone_button(frm, grid);
			toggle_delete_zone_button(frm, grid);

			setup_grid_column_interaction(frm, 'zone_summary', ['ch', 'ph', 'zone_color']);
			
		}, 150); // 0ms 딜레이로 충분합니다.
	});

	const original_refresh = grid.refresh;
	grid.refresh = function () {
		original_refresh.apply(this, arguments);
		const grid_wrapper = $(this.wrapper);
		grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').hide();
		grid_wrapper.find('.row-check').hide();
		// grid_wrapper.find('.grid-row-check').hide();
		// grid_wrapper.find('div.grid-heading-row .sortable-handle').hide();
		// grid_wrapper.find('.sortable-handle').hide();
		// grid_wrapper.find('.grid-add-row').hide();
		// grid_wrapper.find('.grid-remove-rows').hide();

		// grid_wrapper.find('.sortable-handle').hide();
		grid_wrapper.find('.grid-row-check').hide();
		grid_wrapper.find('.grid-add-row').hide();
		grid_wrapper.find('.grid-remove-rows').hide();

		// 톱니바퀴 column 및 필드 영역 제거
		// grid_wrapper.find('div.col:last-child').remove();
		// grid_wrapper.find('.btn-open-row').hide();

		// 톱니바퀴 column 및 필드 div로 제거
		// grid_wrapper.find('div[class="col grid-static-col d-flex justify-content-center"]').remove();
		// grid_wrapper.find('div[class="col"]').remove();

		// 입력 필드 제어 +
		grid_wrapper.find('div.field-area').remove();
		// setTimeout(() => {
			// grid_wrapper.find('.field-area > .form-group.frappe-control').remove();
			// grid_wrapper.find('.awesomplete').remove();
		// }, 100);

		const COL_RESIZE_CONFIG = {
			'zone': '12%',
			'product_type': '15%',
			'zone_color': '11%',
			'total_lm': '6%',
			'total_square_m': '6%',
			'ch':'8%',
			'ph':'8%',
			'clch_type': '10%',
			'ceiling_visible': '6%',
			'base_type': '10%',
			'base_visible_h': '6%'
		};

		// const index_col_width = "8%";

		// 1. 헤더의 체크박스 컬럼 너비를 설정합니다.
		// grid_wrapper.find('.grid-heading-row .row-index').css({
		// 	'width': index_col_width,
		// 	'flex': `0 0 ${index_col_width}`, // Flexbox 환경 대응
		// 	'max-width': index_col_width   // Flexbox 환경 대응
		// });

		// 2. 각 데이터 행의 체크박스 컬럼 너비를 설정합니다.
		// grid_wrapper.find('.grid-body .row-index').css({
		// 	'width': index_col_width,
		// 	'flex': `0 0 ${index_col_width}`,
		// 	'max-width': index_col_width
		// });

		grid_wrapper.find('div[class="col grid-static-col d-flex justify-content-center"]').replaceWith(function() {
			return `<div class="col grid-static-col col-xs-1 " data-fieldname="zone_color" data-fieldtype="Data" title="Color"><div class="static-area ellipsis">Color</div></div>`;
		});
		this.grid_rows.forEach(function (grid_row) {
			const doc = grid_row.doc;
			const $row = $(grid_row.row);

			// 데이터 가져오기 (값이 없으면 0이나 빈 문자열 처리)
			const val = (doc.zone_color !== undefined && doc.zone_color !== null) ? doc.zone_color : 0;

			// 해당 행의 마지막 컬럼(우측 끝)을 찾아서 교체
			const $target_col = $row.find('div[class="col"]');
			
			if ($target_col.length > 0) {
				$target_col.replaceWith(`
					<div class="col grid-static-col col-xs-1 text-right" 
						 data-fieldname="zone_color" 
						 data-fieldtype="Int">
						<div class="static-area ellipsis">
							<div style="text-align: right">${val}</div>
						</div>
					</div>
				`);
			}
		});

		const force_col_width = ($elements, width) => {
			// 기존에 flex 스타일이 있다면 제거하고 새로 적용하여 중복 방지
			$elements.each(function() {
				let style = $(this).attr('style') || '';
				// 기존 flex, max-width, width 스타일이 있다면 문자열에서 제거 (정규식 사용)
				style = style.replace(/flex:[^;]+;?/g, '')
							.replace(/max-width:[^;]+;?/g, '')
							.replace(/width:[^;]+;?/g, '');
				
				// 깨끗해진 스타일에 새 스타일 추가
				$(this).attr('style', style + `flex: 0 0 ${width} !important; max-width: ${width} !important; width: ${width} !important;`);
			});
		};

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

		grid_wrapper.find('.static-area').css('display', '');

		highlight_selected_zone_row(frm, this);
		toggle_duplicate_zone_button(frm, this);
		toggle_delete_zone_button(frm, this);
	}

	highlight_selected_zone_row(frm, grid);
	grid.is_zone_summary_setup = true;
	grid.refresh();
}


function perform_zone_and_items_deletion(frm, zone_name) {
	const finished_items_table = 'finished_items';
	const finished_items_grid = frm.fields_dict[finished_items_table]?.grid;
	const items_to_remove_names = [];
	
	const items_to_remove_docs = (frm.doc[finished_items_table] || []).filter(row => {
		// row.zone_name이 Link 필드의 ID와 일치하는지 확인
		if (row.zone_name === zone_name) {
			items_to_remove_names.push(row.name);
			return true; // 제거 대상
		}
		return false; // 유지 대상
	});

	if (items_to_remove_docs.length > 0) {
		// 2. 데이터 모델에서 해당 행들을 clear_doc으로 제거
		items_to_remove_docs.forEach(row => {
			frappe.model.clear_doc(row.doctype, row.name);
		});
		
		// 3. 배열에서 제거 (UI 갱신을 위해 중요)
		frm.doc[finished_items_table] = frm.doc[finished_items_table].filter(row => 
			!items_to_remove_names.includes(row.name)
		);
		frm.refresh_field(finished_items_table);
		
		// 해당 Zone을 선택 해제
		frm.set_value('zone_selected', null);
		frm.set_value('zone_product_type', null);
	}

	// 4. Zone Summary에서 해당 Zone 행 제거
	const summary_row_doc = (frm.doc.zone_summary || []).find(r => r.zone_name === zone_name);
	if (summary_row_doc) {
		frappe.model.clear_doc(summary_row_doc.doctype, summary_row_doc.name);
		
		frm.doc.zone_summary = frm.doc.zone_summary.filter(row => row.zone_name !== zone_name);
		frm.refresh_field('zone_summary');
	}
	
	// 4. (선택 사항) 서버에서 실제 Zone 문서도 삭제
	// Zone Summary에서만 제거하고 실제 Zone 문서는 남겨둠
	// Zone 문서까지 삭제하는 경우  frappe.call을 주석 해제
	/*
	frappe.call({
		method: "frappe.client.delete",
		args: {
			doctype: "Zone",
			name: zone_name
		},
		callback: function(r) {
			if (r.message) {
				console.log(`Zone document ${zone_name} deleted from database.`);
			}
		}
	});
	*/
	
	frappe.show_alert({
		message: __('Zone {0} and associated items have been deleted.', [zone_name]),
		indicator: 'green'
	});
}


function toggle_delete_zone_button(frm, grid) {
	const delete_button = $(grid.wrapper).find('.btn-delete-zone');
	// Zone이 선택된 경우에만 버튼을 표시
	if (frm.doc.zone_selected) {
		delete_button.show();
	} else {
		delete_button.hide();
	}
}


function toggle_duplicate_zone_button(frm, grid) {
	const duplicate_button = $(grid.wrapper).find('.btn-duplicate-zone');
	if (frm.doc.zone_selected) {
		duplicate_button.show();
	} else {
		duplicate_button.hide();
	}
}


function highlight_selected_zone_row(frm, grid) {
	if (!grid) return;

	const current_selected_zone = frm.doc.zone_selected;

	// 모든 행을 순회하며 스타일 적용/해제
	grid.grid_rows.forEach(grid_row => {
		const doc = grid_row.doc;
		const $row = $(grid_row.row);
		const $zone_cell = $row.find('[data-fieldname="zone_name"]');

		// 기존 아이콘 제거
		$zone_cell.find('.zone-indicator-icon').remove();

		if (current_selected_zone && doc.zone_name === current_selected_zone) {
			// [선택됨] 스타일 적용
			$row.css('background-color', '#d9f7be'); // 연한 녹색/파란색 배경
			$row.attr('style', function (i, s) { return (s || '') + 'background-color: #d9f7be !important; border-bottom-left-radius: var(--border-radius); border-bottom-right-radius: var(--border-radius); overflow: hidden;' });
			$row.addClass('is-selected-zone');

			// 시각적 아이콘 추가 (체크 표시)
			const icon_html = `<span class="zone-indicator-icon" style="margin-left:5px; color:green;">
				<i class="fa fa-check-circle"></i>
			</span>`;
			$static_area = $zone_cell.find('.static-area').append(icon_html);

		} else {
			// [선택 안됨] 스타일 초기화
			$row.css('background-color', '');
			$row.removeClass('is-selected-zone');
		}
	});
}


function open_add_zone_dialog(frm, source_zone) {
	// 다이얼로그를 열기 전에 프로젝트가 선택되었는지 확인
	if (!frm.doc.project) {
		frappe.msgprint(__("Please select a Project first."));
		return;
	}

	// let default_zone_name = '';
	let default_product_type = '';

	// 복제 모드인 경우
	if (source_zone) {
		const source_row = (frm.doc.zone_summary || []).find(r => r.zone_name === source_zone);
		if (source_row) {
			// default_zone_name = ''; // 복제 시 기본 이름 제안
			default_product_type = source_row.product_type;
		}
	}

	let dialog = new frappe.ui.Dialog({
		title: source_zone ? __('Duplicate Zone: {0}', [source_zone]) : __('Add New Zone'),
		fields: [
			{
				label: __('Project'),
				fieldname: 'project',
				fieldtype: 'Link',
				options: 'Project',
				default: frm.doc.project,
				read_only: 1
			},
			{
				label: __('Product Type'),
				fieldname: 'product_type',
				fieldtype: 'Link',
				options: "Selection Library", // 옵션 목록
				filters: { opt_name: "Product Type" },
				reqd: 1,
				read_only: source_zone ? 1 : 0,
				default: default_product_type,
			},
			{
				label: __('Zone Name'), // 사용자가 입력하는 Zone 코드/이름
				fieldname: 'zone_name',
				fieldtype: 'Data',
				reqd: 1
			}			
		],
		primary_action_label: source_zone ? __('Duplicate ') : __('Add'),
		primary_action: (values) => {
			// 사용자가 'Create' 버튼을 눌렀을 때 실행

			// 버튼을 비활성화하여 중복 클릭 방지
			dialog.get_primary_btn().prop('disabled', true).html(frappe.utils.icon('loader'));

			// 1. 중복 Zone 이름 확인
			const existing_zones = (frm.doc.zone_summary || []).map(r => r.zone_name);
			if (existing_zones.includes(values.zone_name)) {
				frappe.msgprint({
					title: __('Warning: Zone Exists'),
					indicator: 'red',
					message: __('A Zone with the name "{0}" already exists in the summary table.', [values.zone_name])
				});
				dialog.get_primary_btn().prop('disabled', false).html(dialog.primary_action_label);
				return;
			}

			if (source_zone) {
				// --- 복제 로직 실행 ---
				duplicate_zone_and_items(frm, source_zone, values.zone_name, values.product_type)
					.then(() => {
						dialog.hide();
						frappe.show_alert({ message: __('Zone duplicated and items copied successfully.'), indicator: 'green' });
					})
					.catch(error_message => {
						dialog.get_primary_btn().prop('disabled', false).html(dialog.primary_action_label);
						frappe.show_alert({ message: error_message, indicator: 'red' });
						console.error("Duplication failed:", error_message);
					});
			} else {
				// 서버의 Python 함수를 호출합니다.
				frappe.call({
					method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.create_zone_and_add_to_summary",
					args: {
						project: values.project,
						zone_name: values.zone_name,
						product_type: values.product_type,
						sales_order: frm.doc.name
					},
					callback: function (r) {
						if (r.message) {
							dialog.hide();
							frappe.show_alert({ message: __('New Zone added successfully.'), indicator: 'green' });

							// 새 Zone 자동 선택
							frm.doc.zone_selected = r.message.name;
							frm.doc.zone_product_type = r.message.product_type;
							frm.refresh_field('zone_selected');
							frm.refresh_field('zone_product_type');

							// new-zone-list 재렌더 (서버에서 최신 목록 가져옴)
							if (typeof render_new_zone_summary === 'function') {
								render_new_zone_summary(frm);
							}

							// finished_items 필터링 반영
							if (typeof apply_visibility_rules === 'function') {
								apply_visibility_rules(frm);
							}
						}
					},
					error: function () {
						// 에러 발생 시 버튼을 다시 활성화
						dialog.get_primary_btn().prop('disabled', false).html(__('Add'));
					}
				});
			}
		}
	});

	dialog.show();
}

async function duplicate_zone_and_items(frm, source_zone, new_zone_name, new_product_type) {
	
	// 1. 서버에 Zone 복제 및 Finished Items 복제 요청 (Python 함수 호출)
	const server_result = await frappe.call({
		method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.duplicate_zone_with_items",
		args: {
			project: frm.doc.project,
			sales_order_docname: frm.doc.name,
			source_zone: source_zone,
			new_zone_name: new_zone_name,
			new_product_type: new_product_type
		}
	});

	const data = server_result.message;

	if (!data || !data.new_zone_name_id) {
		throw new Error(data ? data.error : __('Failed to receive new Zone data from server.'));
	}
	
	// 2. Zone은 서버에서 이미 생성됨
	const new_zone_id = data.new_zone_name_id;

	// 3. Finished Items 복제 결과를 클라이언트측 Finished Items 테이블에 반영
	if (data.duplicated_items_data && data.duplicated_items_data.length > 0) {
		
		data.duplicated_items_data.forEach(item => {
			// 클라이언트측 Finished Items 테이블에 새 행 추가
			const new_row = frm.add_child('finished_items', item);
		});

	}

	// 4. UI 및 데이터 갱신
	frm.refresh_field('zone_summary');
	frm.refresh_field('finished_items');
	
	// 5. 복제된 Zone을 자동으로 선택
	frm.set_value('zone_selected', new_zone_id);
	frm.set_value('zone_product_type', new_product_type);

	apply_visibility_rules(frm);

	// frm.dirty(); // 폼을 저장 상태로 변경
}

function setup_grid_column_interaction(frm, grid_name, target_fields, is_editable=false) {
	const grid = frm.fields_dict[grid_name]?.grid;
	
	if (!grid) return;

	if (grid[`is_${grid_name}_interaction_setup`]) return;

	const grid_wrapper = $(grid.wrapper);

	const field_selectors = target_fields.map(f => `.col[data-fieldname="${f}"]`).join(', ');

	// [1] 마우스 오버 시 팝오버 표시
	grid_wrapper.on('mouseenter', field_selectors, function() {
		const $cell = $(this);
		const fieldname = $cell.attr('data-fieldname');
		
		// [수정 1] 화면의 텍스트($static_area.text()) 대신 데이터 모델(doc)에서 값을 가져옵니다.
		const row_name = $cell.closest('.grid-row').attr('data-name');
		const row = grid.get_row(row_name);
		
		if (!row || !row.doc) return;

		let text = row.doc[fieldname]; 
		
		if (!text || (typeof text !== 'string') || !text.trim()) return;

		// title 속성 제거
		$cell.removeAttr('title');
		$cell.find('.static-area').removeAttr('title');

		if (!$cell.data('bs.popover')) {
			$cell.popover({
				content: text,         // 원본 데이터 사용
				trigger: 'hover',
				placement: 'auto',
				container: 'body',
				html: false,           
				animation: true,
				// [수정 2] 템플릿에 white-space: pre-wrap; 이 있어야 \n이 줄바꿈으로 보입니다.
				template: `
					<div class="popover remark-popover" role="tooltip">
						<div class="arrow"></div>
						<h3 class="popover-header"></h3>
						<div class="popover-body"></div>
					</div>
				`
			});

			$cell.popover('show');
		}
	});

	// [2] 클릭 시 다이얼로그 열기 (기존과 동일)
	if (is_editable){
		grid_wrapper.on('click', field_selectors, function(e) {
			e.preventDefault();
			e.stopPropagation();

			$(this).popover('hide');

			const $cell = $(this);
			const fieldname = $cell.attr('data-fieldname');
			const field_label = $cell.attr('title') || fieldname;

			const row_name = $cell.closest('.grid-row').attr('data-name');
			const row = grid.get_row(row_name);
			
			if (!row || !row.doc) return;
			const doc = row.doc;

			let d = new frappe.ui.Dialog({
				title: __('Edit {0}', [field_label]),
				fields: [
					{
						label: field_label,
						fieldname: 'input_value',
						fieldtype: 'Text',
						default: doc[fieldname],
						reqd: 0
					}
				],
				primary_action_label: __('Update'),
				primary_action: (values) => {
					frappe.model.set_value(doc.doctype, doc.name, fieldname, values.input_value);
					d.hide();
				}
			});

			d.show();
		});
	}

	// 스타일은 clestra_sales_order.css로 이동 (grid-interaction-popover, remark 셀 cursor 등)

	grid[`is_${grid_name}_interaction_setup`] = true;
}


function setup_finished_items_grid(frm) {
	const parent_table = 'finished_items';
	const grid = frm.fields_dict[parent_table].grid;

	if (!grid) return;

	if (grid.grid_pagination) {
		if (frm.doc.zone_selected) {
			grid.grid_pagination.page_length = 9999;
		} else {
			grid.grid_pagination.page_length = 50; // 기본값
		}
	}
	
	// finished-items border 제거는 clestra_sales_order.css로 이동

	// grid-heading-row sticky 위치를 scroll 방향에 따라 form-tabs-list와 동일하게 토글.
	// 아래 스크롤 → header-sticky-up (top = navbar - 18px)
	// 위로 스크롤 → header-sticky-down (top = navbar + page-head - 18px)
	if (!frm._grid_header_sticky_bound) {
		frm._grid_header_sticky_bound = true;
		let last_scroll = 0;
		$(window).on('scroll.finished_items_header', frappe.utils.throttle(() => {
			const $heading = grid.wrapper.find('.grid-heading-row');
			if (!$heading.length) return;
			const current_scroll = document.documentElement.scrollTop;
			if (current_scroll > 0 && last_scroll <= current_scroll) {
				$heading.removeClass('header-sticky-down').addClass('header-sticky-up');
			} else {
				$heading.removeClass('header-sticky-up').addClass('header-sticky-down');
			}
			last_scroll = current_scroll;
		}, 100));
	}

	// force-readonly-cell 내부 input에 대한 delegated keyboard/focus 차단 핸들러.
	// Frappe이 DOM을 재렌더해서 readonly 속성이 휘발되어도 이 핸들러는 계속 동작.
	if (!grid._force_readonly_bound) {
		grid._force_readonly_bound = true;
		const $w = grid.wrapper;

		// 키보드 입력 차단 (Tab/Shift+Tab/화살표/Esc만 통과)
		$w.on('keydown', '.force-readonly-cell input', function (e) {
			const allowed = [9, 27, 37, 38, 39, 40]; // Tab, Esc, Arrows
			if (!allowed.includes(e.keyCode)) {
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// 포커스 차단: force-readonly-cell 내 input에 focus가 오면 즉시 blur.
		// tabindex="-1"로 이미 Tab 순서에서 제외되지만, 수동 focus/click 등 예외 경로 대비.
		$w.on('focusin', '.force-readonly-cell input', function () {
			$(this).blur();
		});

		// 클릭/마우스다운도 차단 (CSS pointer-events가 휘발된 경우 대비)
		$w.on('mousedown click', '.force-readonly-cell input, .force-readonly-cell .static-area', function (e) {
			e.preventDefault();
			e.stopPropagation();
		});
	}

	if (grid.is_fully_enhanced) return;

	grid.wrapper.on('focusin', '[data-fieldname="item_code"] input', function () {
		const $input = $(this);
		if ($input.data('tab-fix-applied')) return;
		$input.data('tab-fix-applied', true);

		const row_name = $input.closest('.grid-row').data('name');
		const grid_row = grid.grid_rows_by_docname[row_name];
		if (!grid_row) return;

		// --- 1. 'item_code' (Link 필드)에 대한 로직 ---
		const input_element_on_item_code = $input.get(0);

		const control = grid_row.get_field('item_code');

		if (!control || !control.awesomplete) return;

		const keydown_handler = function (e) {
			if (control.awesomplete.ul.offsetParent) {
				if (e.keyCode === 13 || e.keyCode === 9) { // Tab key
					e.stopPropagation();
					e.stopImmediatePropagation();
					e.preventDefault();

					// 2. 수동으로 Awesomplete 기능 실행
					if (e.keyCode === 13) {
						control.awesomplete.select(); // 아이템 선택
					} else {
						control.awesomplete.close(); // 목록 닫기
					}
				}
			}
		};

		input_element_on_item_code.removeEventListener('keydown', input_element_on_item_code._keydown_handler, true);
		input_element_on_item_code.addEventListener('keydown', keydown_handler, true);
		input_element_on_item_code._keydown_handler = keydown_handler;

	});

	// ====================================================================
	// 1. item_name의 커스텀 검색 기능
	// ====================================================================
	// 스타일(Awesomplete z-index, indent, readonly 셀, VP 배지 등)은 clestra_sales_order.css로 이동

	grid.wrapper.on('focusin', '[data-fieldname="item_name"] input', function () {
		const $input = $(this);

		if ($input.data('awesomplete-enhanced')) return;
		$input.data('awesomplete-enhanced', true);

		const input_element = $input.get(0);
		let awesomplete = new Awesomplete(input_element, {
			minChars: 0, maxItems: 15,
			filter: function (text, input) {
				var suggestionText = (text.label || text).toString();
				var searchTerms = input.trim().split(/\s+/);
				return searchTerms.every(function (term) {
					return suggestionText.toLowerCase().indexOf(term.toLowerCase()) > -1;
				});
			},
			replace: function (suggestion) {
				this.input.value = suggestion.label;
			}
		});
		$input.data('awesomplete-instance', awesomplete);
		// 서버에서 받은 전체 결과를 캐시 (Awesomplete의 e.text는 label/value만 노출하므로 추가 필드는 여기서 조회)
		$input.data('search-results-cache', []);

		input_element.addEventListener("awesomplete-select", function (e) {
			e.preventDefault();

			const row_name = $input.closest('.grid-row').data('name');
			const grid_row = grid.grid_rows_by_docname[row_name];
			if (!grid_row) return;

			const suggestion = e.text;
			const label = suggestion.label;
			const value = suggestion.value;

			// Awesomplete의 e.text는 product_section 누락 → 캐시에서 조회
			const cache = $input.data('search-results-cache') || [];
			const full_item = cache.find(it => it.value === value);
			const effective_section = (full_item && full_item.product_section) || '';

			awesomplete.close();
			$input.data('last-selected-label', label);
			$input.val(label);

			const cdt = grid_row.doc.doctype;
			const cdn = grid_row.doc.name;

			// product_section 먼저 설정
			const set_section_promise = effective_section
				? frappe.model.set_value(cdt, cdn, 'product_section', effective_section)
				: Promise.resolve();

			Promise.resolve(set_section_promise).then(() => {
				// item_code 설정 (fetch_from이 item_name을 Item.item_name으로 덮어쓸 수 있음)
				return frappe.model.set_value(cdt, cdn, 'item_code', value);
			}).then(() => {
				// Item.item_name이 비어있을 때 fetch_from이 item_name을 비워버리는 문제 방지:
				// 선택한 label로 item_name을 명시적으로 설정
				const current_name = locals[cdt][cdn] && locals[cdt][cdn].item_name;
				if (current_name !== label) {
					return frappe.model.set_value(cdt, cdn, 'item_name', label);
				}
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

		// set_warehouse에 따라 company 결정 (item_code set_query와 동일 규칙)
		const resolve_company_from_warehouse = (warehouse) => {
			if (!warehouse) return null;
			if (/-\s*GUMI\b/i.test(warehouse)) return "Clestra Korea";
			if (/-\s*TC\b/i.test(warehouse)) return "Taicang Factory";
			return null;
		};
		const item_company = resolve_company_from_warehouse(frm.doc.set_warehouse);

		frappe.call({
			method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.search_item_by_name",
			args: {
				txt: term,
				product_section: grid_row.doc.product_section,
				product_type: frm.doc.zone_product_type,
				company: item_company
			},
			callback: (r) => {
				const results = r.message || [];
				// 전체 결과를 캐시에 저장 (select 시 product_section 등 추가 속성 조회용)
				$input.data('search-results-cache', results);
				awesomplete.list = results;
				awesomplete.evaluate();
			}
		});

	}, 300));

	// ============================================================
	// 3. 공통 로직 함수화: Add Sub Item 실행 함수
	// ============================================================
	const execute_add_sub_item = (target_row_name) => {
		// 1-2. 부모 행의 전체 데이터를 찾습니다.
		// const child_doctype = grid.doctype; // 자식 Doctype 이름 (예: "Sales Order Finished Items")
		// const parent_doc = locals[child_doctype] && locals[child_doctype][parent_name];
		let target_doc = null;
		const grid_row_obj = grid.grid_rows_by_docname[target_row_name];

		if (grid_row_obj && grid_row_obj.doc) {
			target_doc = grid_row_obj.doc;
		} else if (grid.data) {
			target_doc = grid.data.find(d => d.name === target_row_name);
		}

		if (!target_doc) {
			frappe.show_alert({ message: __('Row not found.'), indicator: 'red' });
			return;
		}

		// [핵심 수정] 타겟 행의 레벨을 확인하여 '진짜 부모'를 결정합니다.
		let parent_doc = null;
		
		if (cint(target_doc.indent_level) > 0) {
			const real_parent_name = target_doc.fg_reference_id;
			
			// 부모 문서 찾기
			if (grid.grid_rows_by_docname[real_parent_name]) {
				parent_doc = grid.grid_rows_by_docname[real_parent_name].doc;
			} else if (grid.data) {
				parent_doc = grid.data.find(d => d.name === real_parent_name);
			}
		} else {
			// Case B: 부모 행에서 엔터를 친 경우 -> 자기 자신이 부모입니다.
			parent_doc = target_doc;
		}

		if (!parent_doc) {
			frappe.show_alert({ message: __('Parent item not found.'), indicator: 'red' });
			return;
		}

		const parent_name = parent_doc.name;

		// 2. 이 부모의 모든 자식들을 찾습니다.
		const all_data = grid.data || frm.doc.finished_items || [];
		const children_of_parent = all_data.filter(
			d => d.fg_reference_id === parent_name
		);

		let source_doc; // 값을 복사해 올 소스 문서
		let insert_after_idx; // 새 행을 삽입할 위치

		// 2-1. 기존 자식이 있는지 여부에 따라 소스와 삽입 위치를 결정합니다.
		if (children_of_parent.length > 0) {
			// 자식이 있으면, 마지막 자식을 찾습니다.
			const last_child = children_of_parent.reduce((last, current) => {
				return (current.idx > last.idx) ? current : last;
			});
			source_doc = last_child; // 소스는 마지막 자식
			insert_after_idx = last_child.idx; // 삽입 위치는 마지막 자식 다음
			// console.log("Source for copy: Last child row.", source_doc);
		} else {
			// 자식이 없으면, 소스는 부모입니다.
			source_doc = parent_doc; // 소스는 부모
			insert_after_idx = parent_doc.idx; // 삽입 위치는 부모 다음
			// console.log("Source for copy: Parent row.", source_doc);
		}

		// 2-2. 복사에서 제외할 필드 목록
		const exclude_fields = new Set([
			'name', 'doctype', 'parent', 'parenttype', 'parentfield', 'idx',
			'product_section', 'item_code', 'item_name',
			'vp', 'price',
			'lm', 'square_m', 'calc_price', 'calc_price_unit',
			'__checked', '_expanded'
		]);

		// 2-3. 결정된 소스(source_doc)를 사용하여 값을 복사할 객체를 만듭니다.
		let new_child_data = {};
		for (const key in source_doc) {
			if (Object.prototype.hasOwnProperty.call(source_doc, key) && !exclude_fields.has(key)) {
				new_child_data[key] = source_doc[key];
			}
		}

		// 2-4. 자식 행으로서 반드시 가져야 할 고유 필드들을 설정 (덮어쓰기)
		Object.assign(new_child_data, {
			'indent_level': 1,
			'fg_reference_id': parent_doc.name,
			'fg_item': parent_doc.item_code,
			'parent_row_no': parent_doc.idx,
			'zone_name': parent_doc.zone_name,
			'planned_qty': parent_doc.planned_qty
		});

		// product_section은 exclude_fields에 있어 부모에서 복사되지 않으므로 product_section에 포커스.
		// item_code의 focusin 자기-재포커스 경합을 차단하기 위해 capture phase focusin guard 사용.
		const focus_guard_until = Date.now() + 800;
		let newRowNameRef = null;

		const get_ps_input = ($row) => {
			const $cell = $row.find('.col[data-fieldname="product_section"]');
			let $inp = $cell.find('.field-area input:visible, .field-area select:visible').first();
			if (!$inp.length) $inp = $cell.find('input, select').first();
			return $inp;
		};

		const focusin_guard = (ev) => {
			if (Date.now() > focus_guard_until) {
				document.removeEventListener('focusin', focusin_guard, true);
				return;
			}
			const target = ev.target;
			if (!target || !target.closest) return;

			const $targetRow = $(target).closest('.grid-row');
			if (!$targetRow.length) return;
			if (newRowNameRef && $targetRow.attr('data-name') !== newRowNameRef) return;

			if (!target.closest('.col[data-fieldname="item_code"]')) return;

			// item_code로 가는 포커스를 product_section으로 리디렉트
			const $ps = get_ps_input($targetRow);
			if ($ps.length) {
				ev.stopPropagation();
				target.blur();
				setTimeout(() => $ps[0].focus(), 0);
			}
		};
		document.addEventListener('focusin', focusin_guard, true);

		const new_row_doc = grid.add_new_row(insert_after_idx + 1, null, null, new_child_data);

		setTimeout(() => {
			const new_grid_row = new_row_doc && new_row_doc.name
				? grid.grid_rows_by_docname[new_row_doc.name]
				: grid.grid_rows[grid.grid_rows.length - 1];
			if (!new_grid_row) return;
			newRowNameRef = new_grid_row.doc ? new_grid_row.doc.name : null;

			new_grid_row.toggle_editable_row(true);
			const $newRow = $(new_grid_row.row);
			$newRow.find('.col[data-fieldname="product_section"] .static-area').trigger('click');

			const $ps = get_ps_input($newRow);
			if ($ps.length) {
				$ps[0].focus();
				requestAnimationFrame(() => $ps[0].focus());
			}
		}, 100);

		setTimeout(() => {
			document.removeEventListener('focusin', focusin_guard, true);
		}, 850);
	}

	// ============================================================
	// 4. 이벤트 리스너 등록 (키보드 단축키)
	// ============================================================
	grid.wrapper.on('keydown', 'input', function(e) {
		// ERPNext 기본 단축키인 Ctrl + Enter를 가로챕니다.
		if (e.which === 13) {
			const $input = $(this);
			// const isDropdownOpen = $input.attr('aria-expanded') === 'true' || $input.siblings('ul').is(':visible');
			const isDropdownOpen = $input.attr('aria-expanded') === 'true' || 
                                   $input.closest('.awesomplete').find('ul').is(':visible');

			if (isDropdownOpen) {
				// 목록이 열려있으면 엔터키는 '아이템 선택'용이므로, 행 추가를 하지 않고 종료합니다.
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			// 1. 클릭된 버튼이 속한 부모 행 정보를 가져옴
			const $current_row = $(this).closest('.grid-row');
			const current_row_name = $current_row.attr('data-name');

			if (current_row_name) {
				execute_add_sub_item(current_row_name);
			}
		}
	});


	// [중복 실행 방지] Observer가 이미 붙어있으면 종료
	if (grid.is_observer_attached) return;

	let is_applying = false; // [핵심] 무한 루프 방지용 플래그
	
	// ============================================================
	// 5. 커스터마이징 로직 (스타일, 버튼, 이벤트 등 통합)
	// ============================================================
	const apply_dom_customizations = () => {
		if (is_applying) return; // 이미 실행 중이면 중단
		is_applying = true;

		try {
			const grid_wrapper = $(grid.wrapper);

			// 가. 그리드 스타일 적용 (체크박스 보임, 인덱스 숨김)
			// grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').hide();
			// grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').hide();
			grid_wrapper.find('.grid-heading-row .row-index, .grid-body .row-index').attr('style', 'display: none !important');
			// 체크박스 숨김 (필요시 주석 해제)
			// grid_wrapper.find('.grid-heading-row .row-check, .grid-body .row-check').attr('style', 'display: none !important');

			// 'Add Row' -> 'Add Item' 버튼 이름 변경 + 클릭 핸들러 최적화
			const add_row_button = grid_wrapper.find('.grid-add-row');
			if (add_row_button.length > 0 && !add_row_button.data('renamed')) {
				add_row_button.html(`<i class="fa fa-plus"></i> ${__('Add Item')}`);
				add_row_button.data('renamed', true);

				// Frappe 기본 핸들러는 go_to_last_page_to_add_row()로 전체 행을 재렌더하여 지연 발생.
				// 이를 건너뛰고 add_new_row만 호출하도록 교체.
				add_row_button.off('click').on('click', function (e) {
					e.preventDefault();
					e.stopImmediatePropagation();
					// go_to_last_page 플래그 없이 add_new_row 호출 → 전체 재렌더 스킵
					grid.add_new_row(null, null, true);
					return false;
				});
			}

			// 부모 - 자식 사이 bottom-border 스타일 변경
			// 1. 모든 행의 테두리 스타일을 먼저 기본값으로 초기화
			grid_wrapper.find('.grid-row').css('border-bottom', 'none');
			grid_wrapper.find('.grid-row .row .col, .grid-row .row .row-check, .grid-row .row .row-index').css({
				'border-right': 'none',
				'border-right-width': '0',
				'border-right-style': 'none',
				'border-right-color': 'transparent'
			});
			
			// 헤더 행의 테두리도 제거
			grid_wrapper.find('.grid-heading-row .col, .grid-heading-row .row-check, .grid-heading-row .row-index').css({
				'border-right': 'none',
				'border-right-width': '0',
				'border-right-style': 'none',
				'border-right-color': 'transparent'
			});

			const COL_RESIZE_CONFIG = {
				'item_code': '15%',
				'item_name': '32%',
				'height': '7%',
				'width': '7%',
				'planned_qty': '5%'
			};
			const CHECK_COL_WIDTH = "8%";

			const force_col_width = ($elements, width) => {
				$elements.each(function() {
					// 기존 스타일을 가져오되, 우리가 설정한 flex가 아닌 경우에만 덮어씁니다.
					// 이는 불필요한 DOM 조작을 줄여 Observer 루프를 방지하는 효과도 있습니다.
					let currentStyle = $(this).attr('style') || '';
					if (!currentStyle.includes(`flex: 0 0 ${width} !important`)) {
						let newStyle = currentStyle.replace(/flex:[^;]+;?/g, '')
												   .replace(/max-width:[^;]+;?/g, '')
												   .replace(/width:[^;]+;?/g, '')
												   .replace(/border-right[^;]*:[^;]+;?/g, '');
						$(this).attr('style', newStyle + `flex: 0 0 ${width} !important; max-width: ${width} !important; width: ${width} !important; border-right: none !important; border-right-width: 0 !important; border-right-style: none !important;`);
					}
				});
			};

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

			// 2-3. 체크박스 컬럼 리사이징
			const $check_cols = grid_wrapper.find('.row-check');
			if ($check_cols.length) {
				force_col_width($check_cols, CHECK_COL_WIDTH);
			}
			
			// 2-4. 인덱스 컬럼 리사이징 (기존 코드에 있던 부분)
			const index_col_width = "8%";
			grid_wrapper.find('.row-index').css({
				'width': index_col_width,
				'flex': `0 0 ${index_col_width}`,
				'max-width': index_col_width
			});


			// 2. 각 행에 대해 스타일을 적용
			grid.grid_rows.forEach(function (grid_row) {
				const doc = grid_row.doc;
				const $row = $(grid_row.row);

				// render_door_spec_link(frm, grid_row);
				render_door_hardware_details(frm, grid_row);

				// 이미 커스터마이징된 행인지 확인 (flag 체크)
				// if ($row.data('customized')) return;

				// item_code, item_name 이 입력된 상태에서는 product_section 필드를 편집 불가능하게 설정
				if (doc.item_code && doc.item_name)
					grid_row.toggle_editable('product_section', false);

				// indent_level 별 클래스 부여 → CSS로 그룹 구분선/들여쓰기 표시
				// grid_row.row = .data-row 이므로 상위 .grid-row에도 클래스 부여
				const $grid_row_el = $row.closest('.grid-row');
				const lvl = cint(doc.indent_level);
				if (lvl === 0) {
					$row.addClass('is-parent-row').removeClass('is-child-row is-sub-2');
					$grid_row_el.addClass('is-parent-row').removeClass('is-child-row is-sub-2');
				} else {
					$row.addClass('is-child-row').removeClass('is-parent-row');
					$grid_row_el.addClass('is-child-row').removeClass('is-parent-row');
					if (lvl >= 2) {
						$row.addClass('is-sub-2');
						$grid_row_el.addClass('is-sub-2');
					} else {
						$row.removeClass('is-sub-2');
						$grid_row_el.removeClass('is-sub-2');
					}
				}

				// VP Management로 vp가 업데이트된 행: item_code 셀에 VP 배지 표시
				$row.find('.col[data-fieldname="item_code"] .vp-badge').remove();
				if (cint(doc.use_vp) === 1) {
					const $ic_static = $row.find('.col[data-fieldname="item_code"] .static-area');
					if ($ic_static.length) {
						$ic_static.append('<span class="vp-badge" title="VP Management">VP</span>');
					}
				}

				// product_section == "Leaf" AND indent_level > 0 → 보라색 텍스트
				if (doc.product_section === 'Leaf' && cint(doc.indent_level) > 0) {
					$row.addClass('leaf-sub-row');
					$grid_row_el.addClass('leaf-sub-row');
				} else {
					$row.removeClass('leaf-sub-row');
					$grid_row_el.removeClass('leaf-sub-row');
				}

				// 각 행의 버튼 컨테이너를 찾습니다.
				const $button_container = $row.find('.row-check');
				// 그리드가 새로고침될 때마다 이전에 추가된 버튼을 제거 (중복 방지)
				$button_container.find('.toggle-sub-items').remove();
				$button_container.find('.btn-add-sub-item-row').remove();

				// 각 행의 스타일을 초기화
				$row.css({ 'border-bottom': ''});
				$row.find('.row .col, .row .row-check, .row .row-index').css({
					'border-right': 'none',
					'border-right-width': '0',
					'border-right-style': 'none',
					'border-right-color': 'transparent'
				});

				// 부모 행(indent_level == 0)에만 '하위 항목 추가' 버튼을 생성하고 스타일을 적용
				if (doc.indent_level === 0) {
					const fields_to_bold = ['item_code', 'item_name'];
					const fontWeight = 'bold';
					fields_to_bold.forEach(field => {
						const $cell = $row.find(`.col[data-fieldname="${field}"]`);
						$cell.find('input.form-control, .static-area').css('font-weight', fontWeight);
					});

					if (doc._expanded === undefined) {
						doc._expanded = true;
					}
					const icon = doc._expanded ? '<i class="fa fa-chevron-down"></i>' : '<i class="fa fa-chevron-right"></i>';
					const $toggle_button = $(`
						<button class="btn btn-xs btn-default toggle-sub-items" title="${__('Toggle Sub Items')}"
								style="position: absolute;
									left: 5px;
									padding: 3px 2px; 
									line-height: 1;">
							${icon}
						</button>
					`);

					// 4. 'Add Sub Item' 버튼 HTML 생성
					const $$add_sub_item_button = $(`
						<button class="btn btn-xs btn-default btn-add-sub-item-row"
								title="${__('Add Sub Item')}"
								style="position: absolute; 
									right: 5px; 
									padding: 3px 6px; 
									line-height: 1;">
							<i class="fa fa-level-down"></i>
						</button>
					`);

					// 2. 컨테이너($button_container)에 스타일을 적용하여 기준점으로 만들고, 체크박스를 중앙 정렬
					$button_container.css({
						'position': 'relative',
						'text-align': 'center'
					});

					// 3. 컨테이너에 버튼을 추가
					$button_container.prepend($$add_sub_item_button);
					$button_container.append($toggle_button);

					// 토글 버튼 클릭 이벤트
					$toggle_button.on('click', function (e) {
						e.stopPropagation();
						// 현재 부모 행의 확장 상태를 반전시킵니다.
						doc._expanded = !doc._expanded;
						// 아이콘을 즉시 변경합니다.
						$(this).find('i').toggleClass('fa-chevron-right fa-chevron-down');
						// 변경된 상태에 따라 모든 행의 표시 여부를 다시 계산합니다.
						apply_visibility_rules(frm);
					});

					// ===================================================================
					// ================== Add Sub Item Row 버튼 커스터마이징 ==================
					// ==================================================================
					$$add_sub_item_button.on('click', function (e) {
						// 1. 클릭된 버튼이 속한 부모 행의 'name'과 'idx'를 가져옵니다.
						const $parent_row = $(this).closest('.grid-row');
						const parent_name = $parent_row.attr('data-name');
						// const parent_idx = $parent_row.data('idx');

						if (!parent_name) {
							// frappe.show_alert({ message: __('Could not find the row data.'), indicator: 'red' });
							return;
						}
						execute_add_sub_item(parent_name);
					});
				} else {
					// 자식 행의 경우, 부모 행에 적용했을 수 있는 스타일을 초기화
					$button_container.css({
						'position': '', // 'relative' 제거
						'text-align': ''  // 'center' 제거 (기본값으로 돌아감)
					});
					let rowColor = '';
					if (doc.product_section === 'Option') {
						rowColor = '#0047AB'; // 파란색
					} else if (doc.product_section === 'Sub Contract') {
						rowColor = '#228B22'; // 초록색
					} else if (doc.product_section === 'Price Study') {
						rowColor = '#FF5C00';
						// rowColor = '#FF4D00'; // 주황색
					}

					if (rowColor) {
						// !important를 사용하여 다른 스타일을 덮어씀
						// input 필드, 정적 텍스트 영역 등 텍스트가 표시되는 모든 곳에 적용
						$row.find('.col, input, .static-area, .static-area a').css('color', rowColor);
						
						// 만약 input 텍스트 색상이 잘 안 먹힌다면 아래처럼 구체적으로 지정
						// $row.find('input.form-control').css('color', rowColor);
					} else {
						// 기본 색상으로 복구 (재활용된 DOM일 수 있으므로)
						$row.find('.col, input, .static-area').css('color', '');
					}
				}

				// 조건: indent_level이 1인 행
				if ((cint(doc.indent_level)) > 0) {

					// $row.css('margin-top', '-4px');
					const previous_row_doc = (frm.doc.finished_items || []).find(d => d.idx === (doc.idx - 1));
					if (previous_row_doc) {
						// 부모 행의 DOM 요소를 data-name 속성으로 찾습니다.
						const $previous_row = grid_wrapper.find(`.grid-row[data-name="${previous_row_doc.name}"]`);	
						// 부모 행이 화면에 존재하면, 하단 테두리를 제거
						if ($previous_row.length > 0) {
							$previous_row.css({
								'border-bottom': 'none',
								// 'margin-bottom': '-4px'
							});
						}	
					}
				}

				// dimension_rule readonly 재적용 (DOM 재렌더 후 force-readonly-cell 클래스 유지)
				if (doc.item_code) {
					apply_dimension_rule_readonly(frm, doc.doctype, doc.name);
				}

				// [완료 플래그 설정] Observer가 다시 호출되어도 이 행은 건너뜀
				$row.data('customized', true);
			});

			// apply_all_grid_rules(frm);

			setup_duplicate_button_for_grid(frm, parent_table);
			setup_move_to_button_for_grid(frm);
			setup_grid_column_interaction(frm, 'finished_items', ['remark'], true);
			apply_visibility_rules(frm);


			// 나. 선택된 부모 행 스타일 유지
			const add_sub_button = grid_wrapper.find('.btn-add-sub-item');
			if (frm.custom_state.selected_item) {
				add_sub_button.show();
			} else {
				add_sub_button.hide();
			}
		} finally {
			setTimeout(() => {
				is_applying = false;
			}, 0);
		}
	};

	// ============================================================
	// 6. 몽키패치 (Monkey Patch) - 초기 로드 및 수동 refresh 대응
	// ============================================================
	const original_refresh = grid.refresh;
	grid.refresh = function () {
		original_refresh.apply(this, arguments);
		setTimeout(apply_dom_customizations, 50);
	};


	// ============================================================
	// 7. MutationObserver (핵심: 페이지네이션 등 DOM 변경 감지)
	// ============================================================
	const grid_body = grid.wrapper.find('.grid-body')[0];
	
	if (grid_body) {
		const observer = new MutationObserver(function(mutations) {
			// 변경 사항 중에 grid-row 추가/삭제가 있는지 확인 (최적화)
			const hasRowChanges = mutations.some(m => 
				m.type === 'childList' && 
				(m.addedNodes.length > 0 || m.removedNodes.length > 0)
			);

			if (hasRowChanges) {
				// 이미 실행 중이면 requestAnimationFrame이 중복 호출되지 않도록 방어
				if (!is_applying) {
					window.requestAnimationFrame(() => {
						apply_dom_customizations();
					});
				}
			}
		});

		observer.observe(grid_body, { childList: true, subtree: true });
		grid.is_observer_attached = true; 
	}

	// 그리드 전체 Tab/Shift+Tab 핸들러
	// - Tab on last input: 다음 행 편집 모드 전환 (Frappe 기본 동작 보강)
	// - Shift+Tab on first input: 이전 행의 remark로 이동
	if (!grid._gridTabHandlerSet) {
		grid._gridTabHandlerSet = true;
		const gridBodyEl = grid.wrapper.find('.grid-body')[0];
		if (gridBodyEl) {
			gridBodyEl.addEventListener('keydown', function (e) {
				if (e.key !== 'Tab') return;

				const active = document.activeElement;
				if (!active) return;

				// 현재 포커스가 어느 grid-row에 있는지 찾기
				const $gridRow = $(active).closest('.grid-row');
				if (!$gridRow.length) return;
				const docName = $gridRow.attr('data-name');
				if (!docName) return;

				const currentGridRow = grid.grid_rows_by_docname[docName];
				if (!currentGridRow) return;
				const $currentRow = $(currentGridRow.row);
				const currentIdx = currentGridRow.doc.idx; // 1-based

				// ---- Tab (forward) ----
				if (!e.shiftKey) {
					const isLastInput = active.hasAttribute('data-last-input') || !!active.closest('[data-fieldname="remark"]');
					if (!isLastInput) return; // 마지막 input이 아니면 기본 동작

					// 다음 행으로 이동
					const nextGridRow = grid.grid_rows[currentIdx]; // 0-based next
					if (nextGridRow && $(nextGridRow.row).is(':visible')) {
						e.preventDefault();
						e.stopImmediatePropagation();
						nextGridRow.toggle_editable_row(true);
						setTimeout(() => {
							const $nextRow = $(nextGridRow.row);
							let $inp = $nextRow.find('.col[data-fieldname="item_code"] .field-area input:visible');
							if (!$inp.length) {
								$inp = $nextRow.find('.field-area input:visible, .field-area textarea:visible, .field-area select:visible').first();
							}
							if ($inp.length) $inp.first().focus();
						}, 200);
					} else if (!nextGridRow) {
						e.preventDefault();
						e.stopImmediatePropagation();

						// 현재 행이 sub item이면 Add Sub Item 실행, 아니면 Add Item
						const curDoc = currentGridRow.doc;
						if (cint(curDoc.indent_level) > 0) {
							// execute_add_sub_item 내부에서 product_section 포커스 처리 (capture phase guard 포함)
							execute_add_sub_item(curDoc.name);
						} else {
							// [해결 방식]
							// 1) document 캡처 단계에서 focusin을 감시 → item_code로 가는 포커스를 product_section으로 리디렉트
							// 2) add_new_row로 신규 행 생성 (Frappe가 기본적으로 item_code를 포커스하려 해도 가로챔)
							// 3) 일정 시간(800ms) 후 가드 해제
							// 이 방식은 item_code의 focusin 자기-재포커스 경합을 capture phase에서 선제적으로 차단함.
							const focus_guard_until = Date.now() + 800;
							let newRowNameRef = null; // 생성된 새 행을 식별하는 data-name

							const get_product_section_input = ($row) => {
								const $cell = $row.find('.col[data-fieldname="product_section"]');
								let $inp = $cell.find('.field-area input:visible, .field-area select:visible').first();
								if (!$inp.length) $inp = $cell.find('input, select').first();
								return $inp;
							};

							const focusin_guard = (ev) => {
								if (Date.now() > focus_guard_until) {
									document.removeEventListener('focusin', focusin_guard, true);
									return;
								}
								const target = ev.target;
								if (!target || !target.closest) return;

								const $targetRow = $(target).closest('.grid-row');
								if (!$targetRow.length) return;
								if (newRowNameRef && $targetRow.attr('data-name') !== newRowNameRef) return;

								const in_item_code_cell = target.closest('.col[data-fieldname="item_code"]');
								if (!in_item_code_cell) return;

								// item_code로 가는 포커스 차단 → product_section으로 리디렉트
								const $ps = get_product_section_input($targetRow);
								if ($ps.length) {
									ev.stopPropagation();
									target.blur();
									setTimeout(() => $ps[0].focus(), 0);
								}
							};
							document.addEventListener('focusin', focusin_guard, true);

							// add_new_row는 동기적으로 doc을 반환. grid_rows_by_docname도 즉시 populate됨.
							const new_doc = grid.add_new_row(null, null, true);
							if (new_doc && new_doc.name) {
								newRowNameRef = new_doc.name;
								const newRow = grid.grid_rows_by_docname[new_doc.name]
									|| grid.grid_rows[grid.grid_rows.length - 1];
								if (newRow) {
									newRow.toggle_editable_row(true);
									requestAnimationFrame(() => {
										const $newRow = $(newRow.row);
										$newRow.find('.col[data-fieldname="product_section"] .static-area').trigger('click');
										const $ps = get_product_section_input($newRow);
										if ($ps.length) $ps[0].focus();
									});
								}
							}

							// 안전장치: 800ms 후 guard 확실히 제거
							setTimeout(() => {
								document.removeEventListener('focusin', focusin_guard, true);
							}, 850);
						}
					}
					return;
				}

				// ---- Shift+Tab (backward) ----
				const firstInput = $currentRow.find('.field-area input:visible, .field-area textarea:visible, .field-area select:visible').first()[0];
				if (active !== firstInput) return; // 첫 input이 아니면 Frappe 기본 동작

				const prevIdx = currentIdx - 2; // 1-based → 0-based 이전 행
				if (prevIdx < 0) return; // 첫 행이면 기본 동작 (그리드 밖으로)

				const prevGridRow = grid.grid_rows[prevIdx];
				if (!prevGridRow) return;
				if (!$(prevGridRow.row).is(':visible')) return;

				e.preventDefault();
				e.stopImmediatePropagation();

				// 이전 행의 remark로 이동
				const $prevRowEl = $(prevGridRow.row);
				$prevRowEl.attr('tabindex', '-1').focus();

				prevGridRow.toggle_editable_row(true);
				setTimeout(() => {
					let $inp = $prevRowEl.find('.col[data-fieldname="remark"] .field-area input, .col[data-fieldname="remark"] .field-area textarea');
					if (!$inp.length) {
						$inp = $prevRowEl.find('.field-area input:visible, .field-area textarea:visible').last();
					}
					if ($inp.length) $inp.first().focus();
					$prevRowEl.removeAttr('tabindex');
				}, 200);
			}, true);
		}
	}

	// 초기 실행
	apply_dom_customizations();
	grid.is_fully_enhanced = true;

	grid.refresh();
}


function renumber_items(frm) {
    const items = frm.doc.finished_items || [];
    if (items.length === 0) return;

    // 1. 현재 배열 순서대로 idx 재할당 및 Name-Idx 맵 생성
    const name_to_idx_map = {};
    items.forEach((row, index) => {
        row.idx = index + 1; // 1부터 시작
        name_to_idx_map[row.name] = row.idx;
    });

    // 2. fg_reference_id(부모 이름)를 이용해 parent_row_no 업데이트
    items.forEach(row => {
        if (row.fg_reference_id && name_to_idx_map[row.fg_reference_id]) {
            // 부모의 새로운 idx를 찾아 할당
            row.parent_row_no = name_to_idx_map[row.fg_reference_id];
        } else {
            // 부모가 없거나(최상위), 찾을 수 없으면 null 처리
            row.parent_row_no = null; 
        }
    });

    // 3. 그리드 갱신 (값 변경 반영)
    frm.refresh_field('finished_items');
}


function apply_visibility_rules(frm) {
	const selected_zone = frm.doc.zone_selected;
	const fi_grid = frm.fields_dict['finished_items']?.grid;

	if (!fi_grid) return;

	let visible_count = 0;
	let last_parent_is_expanded = true;

	fi_grid.grid_rows.forEach(row => {
		const doc = row.doc;
		const $row = $(row.row);

		const is_zone_match = !selected_zone || (doc.zone_name === selected_zone);
		let should_be_visible = false;

		if (cint(doc.indent_level) == 0) {
			should_be_visible = is_zone_match;
			last_parent_is_expanded = doc._expanded === true;
		} else {
			should_be_visible = is_zone_match && last_parent_is_expanded;
		}

		$row.toggle(should_be_visible);

		const $subRow = $row.next('.custom-subrow');
		if ($subRow.length) {
			// 서브 행은 자신의 부모(메인 행)가 보일 때만 보여야 합니다.
			$subRow.toggle(should_be_visible);
		}

		if (!should_be_visible && row.doc.__checked) {
			// row.select(false);
			row.doc.__checked = 0;
			$row.find('.grid-row-check').prop('checked', false);
		}

		if (should_be_visible) visible_count++;

	});

	$(fi_grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
	fi_grid.refresh_check_html();

}

function customize_select_all_for_grid(frm, table_fieldname) {
	const grid = frm.fields_dict[table_fieldname]?.grid;
	if (!grid || grid.is_select_all_customized) {
		return;
	}

	// 기존의 check 이벤트 핸들러를 비활성화합니다.
	grid.wrapper.off("click", ".grid-row-check");

	// [핵심] grid.js의 setup_check()를 재정의(몽키패치)합니다.
	grid.setup_check = function () {
		this.wrapper.on("click", ".grid-row-check", (e) => {
			const $check = $(e.currentTarget);
			const checked = $check.prop("checked");
			const is_select_all = $check.parents(".grid-heading-row:first").length !== 0;
			const docname = $check.parents(".grid-row:first")?.attr("data-name");

			if (is_select_all) {
				// "전체 선택" 로직을 완전히 재정의합니다.

				// 1. 화면에 보이는 행들만 필터링합니다.
				const visible_rows = this.grid_rows.filter(row => $(row.row).is(':visible'));

				// 2. 보이는 행들에 대해서만 데이터 모델과 UI를 모두 변경합니다.
				visible_rows.forEach(row => {
					// 데이터 모델 변경
					row.doc.__checked = checked ? 1 : 0;
					// UI 체크박스 상태 변경
					$(row.row).find('.grid-row-check').prop('checked', checked);
				});

			} else if (docname) {
				// 개별 행 선택 로직은 Frappe 기본 동작을 따릅니다.
				if (e.shiftKey && this.last_checked_docname) {
					this.check_range(docname, this.last_checked_docname, checked);
				}
				this.grid_rows_by_docname[docname].select(checked);
				this.last_checked_docname = docname;
			}

			// 헤더 체크박스 상태와 '삭제' 버튼 상태를 업데이트합니다.
			this.refresh_check_html();
			this.refresh_remove_rows_button();

			if (typeof toggle_duplicate_button === 'function') {
				toggle_duplicate_button(frm, table_fieldname);
			}
			if (typeof toggle_move_to_button === 'function') {
				toggle_move_to_button(frm, table_fieldname);
			}
		});
	};

	// 재정의된 setup_check 함수를 즉시 호출하여 새로운 이벤트 핸들러를 등록합니다.
	grid.setup_check();

	// refresh_check_html도 보이는 행 기준으로 작동하도록 보장합니다.
	grid.refresh_check_html = function () {
		if (!this.header_row || !this.header_row.global_checkbox) return;
		const visible_rows = this.grid_rows.filter(r => $(r.row).is(':visible'));
		const selected_visible_rows = visible_rows.filter(r => r.doc.__checked);
		const all_visible_are_checked = visible_rows.length > 0 && selected_visible_rows.length === visible_rows.length;
		this.header_row.global_checkbox.prop("checked", all_visible_are_checked);
	};

	grid.is_select_all_customized = true;
}


function setup_move_to_button_for_grid(frm) {
	const table_fieldname = 'finished_items';
	const grid = frm.fields_dict[table_fieldname]?.grid;
	if (!grid) return;

	// 중복 생성을 방지하기 위한 플래그
	if (grid.is_move_to_button_setup) {
		return;
	}

	const grid_wrapper = $(grid.wrapper);

	// 'Move to' 버튼 생성
	const move_to_button = $(`<button class="btn btn-secondary btn-xs btn-move-to" style="margin-right: 4px; display: none;">
								<i class="fa fa-arrow-right"></i> ${__('Move to')}
							</button>`);

	const duplicate_button = grid_wrapper.find('.btn-custom-duplicate');
	if (duplicate_button.length > 0) {
		duplicate_button.after(move_to_button);
	} else {
		grid_wrapper.find('.grid-add-row').after(move_to_button);
	}

	// --- 버튼 클릭 이벤트 ---
	move_to_button.on('click', function () {
		const selected_rows = grid.get_selected_children();
		if (selected_rows.length === 0) {
			frappe.show_alert({ message: __('Please select rows to move.'), indicator: 'orange' });
			return;
		}

		let dialog = new frappe.ui.Dialog({
			title: __('Move Selected Items to Zone'),
			fields: [
				{
					label: __('Target Zone'),
					fieldname: 'target_zone',
					fieldtype: 'Link',
					options: 'Zone',
					reqd: 1,
					get_query: function () {
						if (!frm.doc.project) {
							return { filters: { name: '__non_existent_project__' } };
						}
						return { filters: { 'project': frm.doc.project } };
					}
				}
			],
			primary_action_label: __('Move'),
			primary_action: (values) => {
				const target_zone = values.target_zone;
				if (!target_zone) return;

				const update_promises = [];
				selected_rows.forEach(row_doc => {
					update_promises.push(frappe.model.set_value(row_doc.doctype, row_doc.name, 'zone_name', target_zone));
					const children = (frm.doc.finished_items || []).filter(d => d.fg_reference_id === row_doc.name);
					children.forEach(child_doc => {
						update_promises.push(frappe.model.set_value(child_doc.doctype, child_doc.name, 'zone_name', target_zone));
					});
				});

				Promise.all(update_promises).then(() => {
					frm.refresh_field(table_fieldname);
					apply_visibility_rules(frm);
					grid.toggle_all_rows(false);

					if (typeof toggle_duplicate_button === 'function') {
						toggle_duplicate_button(frm, table_fieldname);
					}
					if (typeof toggle_move_to_button === 'function') {
						toggle_move_to_button(frm, table_fieldname);
					}

					frappe.show_alert({
						message: __('{0} items moved to zone {1}', [selected_rows.length, target_zone]),
						indicator: 'green'
					});
				});
				dialog.hide();
			}
		});
		dialog.set_value('target_zone', frm.doc.zone_selected);
		dialog.show();
	});

	// 설정 완료 플래그
	grid.is_move_to_button_setup = true;
	// console.log("'Move to' button has been set up.");
}

function toggle_move_to_button(frm, table_fieldname = 'finished_items') {
	const grid = frm.fields_dict[table_fieldname]?.grid;
	if (!grid) return;

	const move_to_button = $(grid.wrapper).find('.btn-move-to');

	if (grid.get_selected_children().length > 0) {
		move_to_button.show();
	} else {
		move_to_button.hide();
	}
}

function calculate_row_values(frm, cdt, cdn) {
	const row = locals[cdt][cdn];

	// lm 계산을 위한 최소 필수 값: item_code, width, planned_qty
	// square_m 계산을 위해서는 추가로 height도 필요
	if (!row.item_code || !row.width || !row.planned_qty) {
		// 최소 필수 값이 없으면 계산을 중단하고 초기화
		frappe.model.set_value(cdt, cdn, 'lm', 0);
		frappe.model.set_value(cdt, cdn, 'square_m', 0);
		return;
	}

	// 서버에 계산을 요청합니다.
	frappe.call({
		method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.calculate_and_get_row_values",
		args: {
			item_code: row.item_code,
			height: row.height || 0,  // height가 없으면 0으로 전달
			width: row.width,
			qty: row.planned_qty
		},
		callback: function (r) {
			if (r.message) {
				const values = r.message;
					// 서버에서 받은 결과로 화면의 필드를 업데이트합니다.
				// 이 값은 임시 값이며, 최종 저장 시 서버에서 다시 계산됩니다.
				frappe.model.set_value(cdt, cdn, 'lm', values.lm);
				frappe.model.set_value(cdt, cdn, 'square_m', values.square_m);
				
				// lm과 square_m이 변경되었으므로 zone_summary도 업데이트
				// (lm 이벤트 핸들러가 호출되므로 중복일 수 있지만, 확실성을 위해 추가)
				// update_zone_summary_table(frm);
			}
		}
	});
}


// function render_door_spec_link(frm, grid_row) {
// 	const doc = grid_row.doc;
// 	const cdt = grid_row.doc.doctype;
// 	const cdn = grid_row.doc.name;

// 	const $cell = $(grid_row.row).find('[data-fieldname="item_code"]');
// 	// $cell.find('.door-spec-control-wrapper').remove();

// 	// 기존 컨트롤 제거
//     $cell.find('.input-max-width').remove();

// 	if (doc.product_section === 'Door') {
// 		// const $container = $('<div class="door-spec-control-wrapper" style="margin-top: 5px; width: 90%;"></div>');
// 		// $cell.append($container);

// 		const control = frappe.ui.form.make_control({
// 			df: {
// 				fieldname: 'door_hw_spec',
// 				fieldtype: 'Link',
// 				default: doc.door_hw_spec || null,
// 				options: 'Door Hardware Spec',
// 				placeholder: 'HW Spec',
// 				onchange: function() {
// 					const val = control.get_value();
// 					frappe.model.set_value(cdt, cdn, 'door_hw_spec', val);
// 				},
// 				get_query: () => ({ filters: { 'project': frm.doc.project } }),
// 			},
// 			parent: $cell,
// 			render_input: true,
// 		});

// 		control.refresh();
// 		control.set_value(doc.door_hw_spec);
// 	}
// }

function render_door_hardware_details(frm, grid_row) {
	const doc = grid_row.doc;
	const $row = $(grid_row.row);
	const $subRow = $row.next('.custom-subrow');

	const show_subrow = ['Door', 'Panel', 'Leaf'].includes(doc.product_section);

	if (!show_subrow) {
        if ($subRow.length) $subRow.hide();
        const $wrap = $subRow.find('.hk-wrapper');
        $wrap.empty();
        return;
    }

	if ($subRow.length) {
		$subRow.show();
		const $wrap = $subRow.find('.hk-wrapper');
		ensure_hw_controls(frm, grid_row, $wrap);
	} else {
		const $newSubRow = $(`
		<div class="custom-subrow" style="margin-left: -15px; margin-right: -15px;">
			<div class="hk-wrapper" style="display:flex; gap:8px; align-items:center; flex-wrap:nowrap;"></div>
		</div>
		`);
		$row.after($newSubRow);
		$newSubRow.css({ 'padding-left': '17.5%' });

		const $wrap = $newSubRow.find('.hk-wrapper');
		ensure_hw_controls(frm, grid_row, $wrap);
	}
}

function ensure_hw_controls(frm, grid_row, $wrap) {
	const doc = grid_row.doc;
	const cdt = doc.doctype;
	const cdn = doc.name;

	const is_panel = doc.product_section === 'Panel';
	const is_door = doc.product_section === 'Door';
	const is_leaf = doc.product_section === 'Leaf';

	// ============================================================
	// HTML 디스플레이 방식: focusable input 없이 span으로 표시, 클릭 시 Dialog
	// ============================================================
	const cached_doc_name = $wrap.data('docname');
	if (cached_doc_name === cdn && $wrap.children().length) {
		// 같은 문서 — 값만 갱신
		_update_subrow_display($wrap, doc, is_door, is_panel, is_leaf);
		return;
	}

	// 새로 생성 또는 문서 변경 시 전체 재렌더링
	$wrap.empty();
	$wrap.data('docname', cdn);

	const cell_style = 'cursor:pointer; padding:4px 8px; border:1px solid var(--border-color, #d1d8dd); border-radius:var(--border-radius, 4px); background:var(--control-bg, #fff); min-height:28px; display:flex; align-items:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
	const label_style = 'font-size:9px; color:var(--text-muted, #8d99a6); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
	const val_style = 'font-size:var(--text-sm, 12px); color:var(--text-color, #36414C); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
	const placeholder_style = 'font-size:var(--text-sm, 12px); color:var(--text-light, #b8c2cc);';

	const make_cell = (label, field, basis, visible, link_doctype) => {
		const val = doc[field] || '';
		const display = visible ? '' : 'display:none;';
		const dt_attr = link_doctype ? ` data-link-doctype="${link_doctype}"` : '';
		return `<div class="hw-cell" data-hw-field="${field}"${dt_attr} style="flex:0 0 ${basis}; ${display}">
			<div style="${label_style}">${label}</div>
			<div class="hw-val" style="${cell_style}">
				${val ? `<span style="${val_style}">${frappe.utils.escape_html(val)}</span>` : `<span style="${placeholder_style}">${label}</span>`}
			</div>
		</div>`;
	};

	// CL & Base 는 고정 텍스트
	const cl_base_val = [doc.clch_type, doc.base_type].filter(Boolean).join(' / ') || '';
	const cl_base_display = (is_door || is_panel) ? '' : 'display:none;';
	const cl_base_cell = `<div class="hw-cell" data-hw-field="cl_base" style="flex:0 0 13%; ${cl_base_display}">
		<div style="${label_style}">CL &amp; Base</div>
		<div class="hw-val" style="${cell_style}">
			${cl_base_val ? `<span style="${val_style}">${frappe.utils.escape_html(cl_base_val)}</span>` : `<span style="${placeholder_style}">CL &amp; Base</span>`}
		</div>
	</div>`;

	const html = [
		make_cell('HW Spec', 'door_hw_spec', '15%', is_door, 'Door Hardware Spec'),
		make_cell('Keeper', 'keeper', '13%', is_door, 'Selection Library'),
		make_cell('Hinge', 'hinge', '13%', is_door, 'Selection Library'),
		make_cell('Undercut', 'under_cut', '5%', is_door),
		make_cell('Handle', 'handle_direct', '5%', is_door, 'Selection Library'),
		make_cell('Color', 'color', '13%', is_door || is_panel, 'Product Color'),
		make_cell('Glass A', 'glass_a', '13%', is_panel || is_leaf, 'Product Thickness'),
		make_cell('Glass B', 'glass_b', '13%', is_panel || is_leaf, 'Product Thickness'),
		cl_base_cell
	].join('');

	$wrap.html(html);

	// Link 필드 title 비동기 resolve
	_resolve_subrow_link_titles($wrap, doc);

	// ============================================================
	// 클릭 이벤트: 각 셀 클릭 시 해당 Dialog 열기
	// ============================================================
	$wrap.off('click', '.hw-cell').on('click', '.hw-cell', function (e) {
		e.preventDefault();
		e.stopPropagation();
		const field = $(this).data('hw-field');
		const row_doc = locals[cdt][cdn];

		if (field === 'door_hw_spec') {
			_open_hw_spec_dialog(frm, cdt, cdn, row_doc);
		} else if (field === 'keeper') {
			_open_hw_detail_dialog(frm, cdt, cdn, row_doc, 'Keeper Side', 'keeper', ['Hinge & Keeper', 'Keeper']);
		} else if (field === 'hinge') {
			_open_hw_detail_dialog(frm, cdt, cdn, row_doc, 'Hinge Side', 'hinge', ['Hinge & Keeper', 'Hinge']);
		} else if (field === 'under_cut') {
			_open_undercut_dialog(frm, cdt, cdn, row_doc);
		} else if (field === 'handle_direct') {
			_open_handle_dialog(frm, cdt, cdn, row_doc);
		} else if (field === 'color') {
			_open_color_details_dialog(frm, cdt, cdn, row_doc);
		} else if (field === 'cl_base') {
			_open_clbasetype_detail_dialog(frm, cdt, cdn, row_doc);
		} else if (field === 'glass_a') {
			_open_glass_dialog(frm, cdt, cdn, row_doc, 'Glass A (Outer)', 'glass_a');
		} else if (field === 'glass_b') {
			_open_glass_dialog(frm, cdt, cdn, row_doc, 'Glass B (Inner)', 'glass_b');
		}
	});
}

// Glass A/B 선택 다이얼로그
function _open_glass_dialog(frm, cdt, cdn, row_doc, title, fieldname) {
	frappe.prompt([
		{
			label: title,
			fieldname: fieldname,
			fieldtype: 'Link',
			options: 'Product Thickness',
			default: row_doc[fieldname] || '',
			get_query: () => ({
				filters: [['type', 'in', ['Panel Glass', 'Panel & Leaf Glass']]]
			})
		}
	], (values) => {
		frappe.model.set_value(cdt, cdn, fieldname, values[fieldname] || null);
	}, __(title), __('Save'));
}

// subrow 값 갱신 (리렌더링 없이)
function _update_subrow_display($wrap, doc, is_door, is_panel, is_leaf) {
	is_leaf = is_leaf || doc.product_section === 'Leaf';
	const val_style = 'font-size:var(--text-sm, 12px); color:var(--text-color, #36414C); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
	const placeholder_style = 'font-size:var(--text-sm, 12px); color:var(--text-light, #b8c2cc);';

	const update_cell = (field, label, val) => {
		const $cell = $wrap.find(`[data-hw-field="${field}"] .hw-val`);
		if (!$cell.length) return;
		$cell.html(val
			? `<span style="${val_style}">${frappe.utils.escape_html(String(val))}</span>`
			: `<span style="${placeholder_style}">${label}</span>`
		);
	};

	update_cell('door_hw_spec', 'HW Spec', doc.door_hw_spec);
	update_cell('keeper', 'Keeper', doc.keeper);
	update_cell('hinge', 'Hinge', doc.hinge);
	update_cell('under_cut', 'Undercut', doc.under_cut);
	update_cell('handle_direct', 'Handle', doc.handle_direct);
	update_cell('color', 'Color', doc.color);
	update_cell('glass_a', 'Glass A', doc.glass_a);
	update_cell('glass_b', 'Glass B', doc.glass_b);

	const cl_base_val = [doc.clch_type, doc.base_type].filter(Boolean).join(' / ') || '';
	update_cell('cl_base', 'CL &amp; Base', cl_base_val);

	// visibility 토글
	$wrap.find('[data-hw-field="door_hw_spec"]').toggle(is_door);
	$wrap.find('[data-hw-field="keeper"]').toggle(is_door);
	$wrap.find('[data-hw-field="hinge"]').toggle(is_door);
	$wrap.find('[data-hw-field="under_cut"]').toggle(is_door);
	$wrap.find('[data-hw-field="handle_direct"]').toggle(is_door);
	$wrap.find('[data-hw-field="color"]').toggle(is_door || is_panel);
	$wrap.find('[data-hw-field="glass_a"]').toggle(is_panel || is_leaf);
	$wrap.find('[data-hw-field="glass_b"]').toggle(is_panel || is_leaf);
	$wrap.find('[data-hw-field="cl_base"]').toggle(is_door || is_panel);

	// Link 필드 title 비동기 resolve
	_resolve_subrow_link_titles($wrap, doc);
}

// ============================================================
// Link 필드 title resolve (name 대신 title_field 표시)
// ============================================================
const _link_title_cache = {};

function _resolve_subrow_link_titles($wrap, doc) {
	$wrap.find('.hw-cell[data-link-doctype]').each(function () {
		const $cell = $(this);
		const field = $cell.data('hw-field');
		const doctype = $cell.data('link-doctype');
		const name = doc[field];
		if (!name || !doctype) return;

		const cache_key = `${doctype}::${name}`;

		// 캐시에 있으면 즉시 적용
		if (_link_title_cache[cache_key]) {
			$cell.find('.hw-val span').first().text(_link_title_cache[cache_key]);
			return;
		}

		// title_field 확인
		const meta = frappe.get_meta(doctype);
		const title_field = meta?.title_field;
		if (!title_field || title_field === 'name') {
			// title_field가 없거나 name 자체이면 그대로 표시
			return;
		}

		// 비동기로 title 가져오기
		frappe.db.get_value(doctype, name, title_field).then(r => {
			const title = r?.message?.[title_field];
			if (title) {
				_link_title_cache[cache_key] = title;
				$cell.find('.hw-val span').first().text(title);
			}
		});
	});
}

// ============================================================
// Dialog 함수들 (ensure_hw_controls에서 분리)
// ============================================================

function _open_hw_spec_dialog(frm, cdt, cdn, row_doc) {
	let mapping = {};
	try { mapping = JSON.parse(frm.doc.hw_spec_mapping || '{}'); } catch (e) { mapping = {}; }
	const allowed_specs = [];
	Object.keys(mapping).forEach(check_field => {
		if (frm.doc[check_field]) allowed_specs.push(mapping[check_field]);
	});
	const filters = { project: frm.doc.project };
	if (allowed_specs.length > 0) {
		filters['name'] = ['in', allowed_specs];
	} else {
		filters['name'] = ['in', ['no_match']];
	}

	let d = new frappe.ui.Dialog({
		title: __('Door Hardware Spec'),
		fields: [{
			label: __('HW Spec'),
			fieldname: 'door_hw_spec',
			fieldtype: 'Link',
			options: 'Door Hardware Spec',
			default: row_doc.door_hw_spec,
			get_query: () => ({ filters: filters })
		}],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			frappe.model.set_value(cdt, cdn, 'door_hw_spec', values.door_hw_spec);
			d.hide();
			frm.save();
		}
	});
	d.show();
}

function _open_hw_detail_dialog(frm, cdt, cdn, row_doc, title, field_prefix, filter_list) {
	let d = new frappe.ui.Dialog({
		title: title,
		fields: [
			{
				label: title,
				fieldname: field_prefix,
				fieldtype: 'Link',
				options: 'Selection Library',
				default: row_doc[field_prefix],
				get_query: () => ({ filters: { opt_name: ['in', filter_list], is_active: 1 } })
			},
			{
				label: `${title} Glass A (Outer)`,
				fieldname: `${field_prefix}_glass_a`,
				fieldtype: 'Link',
				options: 'Product Thickness',
				default: row_doc[`${field_prefix}_glass_a`],
				get_query: () => ({ filters: { type: ['in', ["Panel Glass","Panel & Leaf Glass"]], is_active: 1 } })
			},
			{
				label: `${title} Glass B (Inner)`,
				fieldname: `${field_prefix}_glass_b`,
				fieldtype: 'Link',
				options: 'Product Thickness',
				default: row_doc[`${field_prefix}_glass_b`],
				get_query: () => ({ filters: { type: ['in', ["Panel Glass","Panel & Leaf Glass"]], is_active: 1 } })
			}
		],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			frappe.model.set_value(cdt, cdn, {
				[field_prefix]: values[field_prefix],
				[`${field_prefix}_glass_a`]: values[`${field_prefix}_glass_a`],
				[`${field_prefix}_glass_b`]: values[`${field_prefix}_glass_b`]
			});
			d.hide();
			frm.save();
		}
	});
	d.show();
}

function _open_undercut_dialog(frm, cdt, cdn, row_doc) {
	let d = new frappe.ui.Dialog({
		title: __('Undercut'),
		fields: [{
			label: __('Undercut'),
			fieldname: 'under_cut',
			fieldtype: 'Int',
			default: row_doc.under_cut,
		}],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			const v = values.under_cut;
			frappe.model.set_value(cdt, cdn, 'under_cut', (v === undefined || v === null || v === '') ? null : cint(v));
			d.hide();
			frm.save();
		}
	});
	d.show();
}

function _open_handle_dialog(frm, cdt, cdn, row_doc) {
	let d = new frappe.ui.Dialog({
		title: __('Handle Direction'),
		fields: [{
			label: __('Handle Direction'),
			fieldname: 'handle_direct',
			fieldtype: 'Link',
			options: 'Selection Library',
			default: row_doc.handle_direct,
			get_query: () => ({ filters: { opt_name: 'Handle Direction', is_active: 1 } })
		}],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			frappe.model.set_value(cdt, cdn, 'handle_direct', values.handle_direct);
			d.hide();
			frm.save();
		}
	});
	d.show();
}

function _open_color_details_dialog(frm, cdt, cdn, row_doc) {
	let d = new frappe.ui.Dialog({
		title: __('Edit Detailed Colors'),
		fields: [
			{
				label: __('Overall Color'),
				fieldname: 'color',
				fieldtype: 'Link',
				options: 'Product Color',
				default: row_doc.color,
				reqd: 0,
				onchange: function() {
					const val = this.get_value();
					if (row_doc.color !== val) {
						d.set_values({
							'color_frame': val, 'color_transom': val,
							'color_leaf': val, 'color_lipseal': 'STD',
							'color_panel': val, 'color_clch': val,
							'color_base': val, 'color_junction': val
						});
					}
				}
			},
			{ fieldtype: 'Section Break', label: __('Details') },
			{ fieldtype: 'Column Break' },
			{ label: 'Frame', fieldname: 'color_frame', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_frame },
			{ label: 'Transom', fieldname: 'color_transom', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_transom },
			{ label: 'Leaf', fieldname: 'color_leaf', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_leaf },
			{ label: 'Lipseal', fieldname: 'color_lipseal', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_lipseal },
			{ fieldtype: 'Column Break' },
			{ label: 'Panel', fieldname: 'color_panel', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_panel },
			{ label: 'CL/CH', fieldname: 'color_clch', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_clch },
			{ label: 'Base', fieldname: 'color_base', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_base },
			{ label: 'Junction', fieldname: 'color_junction', fieldtype: 'Link', options: 'Product Color', default: row_doc.color_junction }
		],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			frappe.model.set_value(cdt, cdn, values);
			d.hide();
			frm.save();
		}
	});
	d.show();
}

function _open_clbasetype_detail_dialog(frm, cdt, cdn, row_doc) {
	let d = new frappe.ui.Dialog({
		title: __("Ceiling & Base Details"),
		fields: [
			{
				label: 'Ceiling Type', fieldname: 'clch_type', fieldtype: 'Link',
				options: 'Selection Library', default: row_doc.clch_type,
				get_query: () => ({ filters: { opt_name: 'CL CH Type', is_active: 1 } })
			},
			{ label: 'Ceiling Visible Height', fieldname: 'ceiling_visible', fieldtype: 'Int', default: row_doc.ceiling_visible },
			{ fieldtype: 'Column Break' },
			{
				label: 'Base Type', fieldname: 'base_type', fieldtype: 'Link',
				options: 'Selection Library', default: row_doc.base_type,
				get_query: () => ({ filters: { opt_name: 'Base Type', is_active: 1 } })
			},
			{ label: 'Base Visible Height', fieldname: 'base_visible_h', fieldtype: 'Int', default: row_doc.base_visible_h },
		],
		primary_action_label: __('Update'),
		primary_action: (values) => {
			frappe.model.set_value(cdt, cdn, values);
			d.hide();
			frm.save();
		}
	});
	d.show();
}


function manage_grid_visibility(frm) {
	const table_fieldname = 'finished_items';
	const grid = frm.fields_dict[table_fieldname]?.grid;
	if (!grid) return;

	const selected_zone = frm.doc.zone_selected;
	const all_items = frm.doc.finished_items || [];
	let visible_count = 0;

	// 1. 모든 데이터 행을 순회하며 각 행이 보여야 할지 최종 결정합니다.
	all_items.forEach((doc, index) => {
		let should_be_visible = true;

		// 조건 1: Zone 필터
		if (selected_zone && doc.zone_name !== selected_zone) {
			should_be_visible = false;
		}

		// 조건 2: 부모-자식 토글 상태
		if (should_be_visible && doc.indent_level > 0) {
			// 자신의 직계 부모를 위로 올라가며 찾습니다.
			let parent_doc = null;
			for (let i = index - 1; i >= 0; i--) {
				if (all_items[i].indent_level < doc.indent_level) {
					// 최상위 부모(indent_level 0)를 찾을 때까지 계속 올라갑니다.
					if (all_items[i].indent_level === 0) {
						parent_doc = all_items[i];
						break;
					}
				}
			}

			// 부모를 찾았고, 그 부모가 닫혀있으면('._expanded'가 false이면) 숨깁니다.
			if (parent_doc && !parent_doc._expanded) {
				should_be_visible = false;
			}
		}

		// 2. 결정된 상태를 실제 DOM에 적용합니다.
		const grid_row = grid.grid_rows_by_docname[doc.name];
		if (grid_row) {
			$(grid_row.row).toggle(should_be_visible);
			if (should_be_visible) {
				visible_count++;
			}
		}
	});

	// 3. "No Data" 메시지 및 헤더 체크박스 상태를 업데이트합니다.
	$(grid.wrapper).find('.grid-empty').toggle(visible_count === 0);
	grid.refresh_check_html();
}


function update_calculated_price(frm, cdt, cdn) {
	const row = locals[cdt][cdn];

	// item_code는 필수입니다.
	if (!row.item_code) {
		frappe.model.set_value(cdt, cdn, 'calc_price', 0);
		frappe.model.set_value(cdt, cdn, 'calc_price_unit', null);
		return;
	}

	// 서버에 계산을 요청합니다.
	frappe.call({
		method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.get_calculated_price",
		args: {
			item_code: row.item_code,
			product_section: row.product_section,
			height: row.height,
			width: row.width,
			qty: row.planned_qty
		},
		callback: function (r) {
			if (r.message) {
				const price = r.message.price;
				const unit = r.message.unit;
				const current_row = locals[cdt][cdn];
				const qty = flt(current_row.planned_qty) || 1;

				if (r.message.use_vp) {
					frappe.model.set_value(cdt, cdn, 'vp', price);
					frappe.model.set_value(cdt, cdn, 'use_vp', r.message.use_vp);
					frappe.model.set_value(cdt, cdn, 'vp_amount', flt(price) * qty);
					frappe.model.set_value(cdt, cdn, 'calc_price', 0);
					frappe.model.set_value(cdt, cdn, 'price', 0);
					update_grand_total_vp(frm);
				} else {
					frappe.model.set_value(cdt, cdn, 'calc_price', price);
					frappe.model.set_value(cdt, cdn, 'calc_price_unit', unit);
					frappe.model.set_value(cdt, cdn, 'price', flt(price) * qty);
				}
			}
		}
	});
}

function open_price_discount_dialog(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	if (!row) {
		frappe.msgprint(__("Could not find row data to edit price and discount."));
		return;
	}

	// --- Define Dialog Fields ---
	// Start with common fields or a section
	let dialog_fields = [
		{ label: "VP", fieldname: "vp", fieldtype: "Float", precision: "0", default: row.vp, readonly: true },
		{ label: "Price", fieldname: "price", fieldtype: "Float", precision: "0", default: row.price, readonly: true },
		{ label: "Manufacturer Discount", fieldname: "manufacturer_dc", fieldtype: "Percent", precision: "1", default: row.manufacturer_dc || 0 }
	];

	// Dynamically add fields based on product_section
	// Use 'depends_on' or simple conditional logic


	// --- Create and Show Dialog ---
	let dialog = new frappe.ui.Dialog({
		title: __("Edit Price and Discount"),
		fields: dialog_fields,
		primary_action_label: __('Update'),
		primary_action: function (values) {
			frappe.model.set_value(cdt, cdn, {
				manufacturer_dc: values.manufacturer_dc
			}).then(() => {
				// set_value가 성공적으로 완료된 후 실행할 로직
				console.log("Values updated successfully for row:", cdn);

				// 부모 테이블 필드를 새로고침하여 계산 등을 트리거합니다.
				frm.refresh_field(row.parentfield); // 'finished_items'와 같은 테이블 필드 이름
			});

			dialog.hide();
		}
	});

	dialog.show();
}


function clickable_unit_price_column(frm) {
	// Applies custom click handler and initial display for QTY field
	const grid_fieldnames = ['finished_items']; // Grids using custom qty dialog/display
	grid_fieldnames.forEach(fieldname => {
		const grid = frm.fields_dict[fieldname]?.grid;
		if (grid && grid.wrapper) {
			// Remove previous click handler to avoid duplicates
			if (!grid || !grid.is_clickable_unit_price_customized) {
				return;
			}

			// Add click handler to open custom qty dialog
			grid.wrapper.on('click', '.grid-row .col[data-fieldname="calc_price"]', function (e) {
				// Prevent dialog if clicking interactive elements inside cell
				if ($(e.target).closest('button, a').length > 0) {
					return;
				}
				e.preventDefault();
				e.stopPropagation(); // Stop event propagation

				let row_name = $(this).closest('.grid-row').attr('data-name');
				let grid_row_obj = grid.get_row(row_name); // Get the grid row object

				if (grid_row_obj && grid_row_obj.doc) {
					open_price_discount_dialog(frm, grid_row_obj.doc.doctype, grid_row_obj.doc.name);
				} else {
					console.error("Could not find row object for clicked calc_price field in grid:", fieldname);
				}
			});

			grid.is_clickable_unit_price_customized = true;
			grid.refresh(); // Initial refresh to apply any visual changes
		}
	});

}


function render_hw_spec_summary(frm) {
    const wrapper = frm.get_field("hw_spec_summary").$wrapper;

    if (!frm.doc.project) {
        wrapper.html('<p class="text-muted">' + __('Please select a Project.') + '</p>');
        // 프로젝트 없으면 체크박스 숨김
        for (let i = 1; i <= 10; i++) {
            frm.set_df_property(`hw_check_${i}`, 'hidden', 1);
        }
        frm.set_value('hw_spec_mapping', '{}'); // 매핑 초기화
        return;
    }

    wrapper.html('<p class="text-muted">' + __('Loading...') + '</p>');

    // 서버에서 Door Hardware Spec 목록을 가져옵니다.
    frappe.db.get_list("Door Hardware Spec", {
        filters: { 'project': frm.doc.project },
        fields: [
            "name", "hw_spec_code", "door_leaf_thk", "lockset_h", "handle", "mortise",
            "security_access_control", "wiring", "key_cylinder", "master_key",
            "auto_drop_seal", "door_closer", "al_strip", "for_lockset", "for_door_closer",
            "flush_bolt", "butt", "pivot", "blind",
            "tape_seal_color", "fix_screw_cap",
            "back_painted_no", "back_painted_yes",
        ],
        order_by: "creation asc",
        limit: 20
    }).then(specs => {
        // ----------------------------------------------------------------
        // 1. 매핑 정보 로드 및 갱신 (JSON 필드 사용)
        // ----------------------------------------------------------------
        let saved_mapping = {};
        try {
            // 저장된 JSON 문자열을 객체로 변환
            saved_mapping = JSON.parse(frm.doc.hw_spec_mapping || '{}');
        } catch (e) {
            saved_mapping = {};
        }

        // 현재 DB에 존재하는 Spec ID 목록
        const current_spec_ids = specs.map(s => s.name);
        
        // 새로운 매핑 객체 (유효한 것만 담음)
        let new_mapping = {};
        // 사용 가능한 체크박스 슬롯 (순서대로)
        let available_slots = [];
        for(let i=1; i<=10; i++) available_slots.push(`hw_check_${i}`);

        // A. 기존 매핑 유지: 이미 매핑된 Spec이 여전히 유효하다면 자리 유지
        // (saved_mapping 구조: { "hw_check_1": "SPEC-001", ... })
        for (const [field, spec_name] of Object.entries(saved_mapping)) {
            if (current_spec_ids.includes(spec_name)) {
                new_mapping[field] = spec_name;
                // 사용된 슬롯 제거
                available_slots = available_slots.filter(s => s !== field);
            } else {
                // 더 이상 존재하지 않는 Spec이면 해당 체크박스 값 초기화
                frm.set_value(field, 0);
            }
        }

        // B. 신규 매핑: 매핑되지 않은 새 Spec들을 남은 슬롯에 할당
        specs.forEach(spec => {
            // 이미 매핑된 Spec인지 확인 (Object.values로 값 검색)
            const is_mapped = Object.values(new_mapping).includes(spec.name);
            
            if (!is_mapped && available_slots.length > 0) {
                // 빈 슬롯 중 가장 앞번호 가져오기
                const next_slot = available_slots.shift();
                new_mapping[next_slot] = spec.name;
            }
        });

        // C. 매핑 정보 저장 (JSON 문자열로 변환하여 필드에 저장)
        const new_mapping_str = JSON.stringify(new_mapping);
        if (frm.doc.hw_spec_mapping !== new_mapping_str) {
            frm.set_value('hw_spec_mapping', new_mapping_str);
            // dirty 상태 방지를 원하면 저장 로직 추가 필요하지만, 보통은 그대로 둡니다.
        }

        // ----------------------------------------------------------------
        // 2. UI 업데이트 (체크박스 라벨/숨김 처리) 및 필터 리스트 생성
        // ----------------------------------------------------------------
        const checked_spec_ids = [];

        // 1번부터 10번까지 슬롯 순회
        for (let i = 1; i <= 10; i++) {
            const fieldname = `hw_check_${i}`;
            const mapped_spec_name = new_mapping[fieldname];

            if (mapped_spec_name) {
                const spec_data = specs.find(s => s.name === mapped_spec_name);
                if (spec_data) {
                    frm.set_df_property(fieldname, 'hidden', 0);
                    frm.set_df_property(fieldname, 'label', spec_data.hw_spec_code);

                    // 이벤트 핸들러 연결 (중복 방지)
                    if (!frm.fields_dict[fieldname].is_handler_set) {
                        frm.set_df_property(fieldname, 'onchange', () => {
                            // 체크박스 변경 시 UI 다시 그리기 (재귀 호출)
                            render_hw_spec_summary(frm);
                        });
                        frm.fields_dict[fieldname].is_handler_set = true;
                    }

                    // 체크박스 라벨 옆에 "새 탭으로 열기" 아이콘 버튼 주입
                    const $field_wrapper = frm.fields_dict[fieldname].$wrapper;
                    if ($field_wrapper) {
                        $field_wrapper.find('.hw-spec-open-btn').remove();
                        const $label_area = $field_wrapper.find('.label-area').first();
                        if ($label_area.length) {
                            const open_url = `/app/door-hardware-spec/${encodeURIComponent(spec_data.name)}`;
                            $label_area.after(
                                `<a href="${open_url}" target="_blank" rel="noopener"
                                    class="hw-spec-open-btn text-muted"
                                    title="${__('Open in new tab')}"
                                    style="margin-left:6px;cursor:pointer;display:inline-flex;align-items:center;">
                                    <svg class="icon icon-sm" style="width:14px;height:14px;"><use href="#icon-external-link"></use></svg>
                                </a>`
                            );
                        }
                    }

                    // 체크되어 있다면 필터 리스트에 추가
                    if (frm.doc[fieldname]) {
                        checked_spec_ids.push(mapped_spec_name);
                    }
                }
            } else {
                // 매핑된 Spec이 없으면 숨김 및 체크 해제
                frm.set_df_property(fieldname, 'hidden', 1);
                const $field_wrapper = frm.fields_dict[fieldname].$wrapper;
                if ($field_wrapper) $field_wrapper.find('.hw-spec-open-btn').remove();
                if (frm.doc[fieldname]) {
                    frm.set_value(fieldname, 0);
                }
            }
        }

        // ----------------------------------------------------------------
        // 4. HTML 렌더링 (체크된 항목만)
        // ----------------------------------------------------------------
        if (checked_spec_ids.length === 0) {
            wrapper.html('<p class="text-muted">' + __('Please select hardware specifications above.') + '</p>');
            return;
        }

        // 체크된 ID에 해당하는 Spec 데이터만 필터링
        const filtered_specs = specs.filter(spec => checked_spec_ids.includes(spec.name));

        // 데이터 가공 (processed_specs 생성)
        let processed_specs = filtered_specs.map(spec => {
            const tape_seal_value = spec.tape_seal_color || '-';
            let fix_screw_value = '-';
            if (spec.fix_screw_cap) {
                fix_screw_value = (spec.fix_screw_cap === 'Gray') ? 'Standard' : '#PAINT';
            }
            const back_painted_value = spec.back_painted_yes ? 'Yes' : (spec.back_painted_no ? 'No' : '-');

            return {
                name: spec.name,
                hw_spec_code: spec.hw_spec_code,
                'Door Leaf Thickness': spec.door_leaf_thk,
                'Handle Height': spec.lockset_h,
                'Handle Type': spec.handle,
                'Mortise': spec.mortise,
                'Security & Access Control': spec.security_access_control,
                'Wiring Device': spec.wiring,
                'Key Cylinder': spec.key_cylinder,
                'Master Key': spec.master_key,
                'Auto Drop Seal': spec.auto_drop_seal,
                'Door Closer': spec.door_closer,
                'Al. Strip for 40T, 44T': spec.al_strip,
                'Al. Case': spec.for_lockset || spec.for_door_closer,
                'Flush Bolt': spec.flush_bolt,
                'Hinge': spec.butt || spec.pivot,
                'Door Blind': spec.blind,
                '3M Tape and Foam Seal': tape_seal_value,
                'Fixing Screw Cap': fix_screw_value,
                'Back Painted Boarder': back_painted_value,
            };
        });

        // 테이블 생성
        const chunk_size = 5;
        const spec_chunks = [];
        for (let i = 0; i < processed_specs.length; i += chunk_size) {
            spec_chunks.push(processed_specs.slice(i, i + chunk_size));
        }

        const all_tables_html = spec_chunks.map(chunk => {
            if (chunk.length === 0) return "";
            const num_specs = chunk.length;

            const property_col_width_percent = 20;
            const spec_col_width_percent = 20 * num_specs;
            const total_width_percent = property_col_width_percent + spec_col_width_percent;

            const property_min_width = 180;
            const spec_min_width = 150;
            const total_min_width = property_min_width + (num_specs * spec_min_width);

            const labels_in_order = Object.keys(chunk[0]).filter(k => !['name', 'hw_spec_code'].includes(k));

            let header_html = `<th style="min-width: ${property_min_width}px;">Property</th>`;
            chunk.forEach(spec => {
                header_html += `<th style="min-width: ${spec_min_width}px;"><a href="/app/door-hardware-spec/${spec.name}" target="_blank">${spec.hw_spec_code}</a></th>`;
            });

            let body_html = labels_in_order.map(label => {
                let row_cells_html = `<td style="font-weight: 500;">${label}</td>`;
                chunk.forEach(spec => {
                    row_cells_html += `<td>${spec[label] || '-'}</td>`;
				});
				return `<tr>${row_cells_html}</tr>`;
			}).join('');

			return `
				<div class="table-responsive">
					<table class="table table-bordered table-sm" style="width: ${total_width_percent}%; min-width: ${total_min_width}px; table-layout: fixed; margin-bottom: 25px;">
						<thead style="background-color: #e9ecef;"><tr>${header_html}</tr></thead>
						<tbody>${body_html}</tbody>
					</table>
				</div>
			`;
		}).join('');

		wrapper.html(all_tables_html);
	});
}

async function render_computation(frm) {
    const wrapper = frm.get_field("computation").$wrapper;
    wrapper.empty();

    if (!frm.doc.name || !frm.doc.finished_items?.length) {
        wrapper.html('<p class="text-muted">' + __('No items to compute.') + '</p>');
        return;
    }

    wrapper.html('<p class="text-muted">' + __('Calculating...') + '</p>');

    try {
        const r = await frappe.call({
            method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.get_computation_data",
            args: { doc: frm.doc }
        });

        if (!r.message || !r.message.by_type) return wrapper.html('<p class="text-muted">No data found.</p>');

        const data = r.message;
        const format_num = (num) => num ? num.toLocaleString('en-US') : '0';
        const ptypes = Object.keys(data.by_type);

        if (ptypes.length === 0) {
            return wrapper.html('<p class="text-muted">No items with Product Type found.</p>');
        }

        // --- 1. 탭 헤더 생성 (Summary 제외) ---
        let tabs_html = `<ul class="nav nav-tabs" role="tablist" style="margin-bottom: 20px;">`;
        
        ptypes.forEach((ptype, idx) => {
            // ID에 특수문자가 섞이지 않도록 안전하게 변환
            const safe_id = ptype.replace(/[^a-z0-9]/gi, '_');
            tabs_html += `
            <li class="nav-item">
                <a class="nav-link ${idx === 0 ? 'active' : ''}" 
                   data-toggle="tab" 
                   data-target="#tab-${safe_id}" 
                   href="javascript:void(0)" 
                   role="tab">${ptype}</a>
            </li>`;
        });
        tabs_html += `</ul>`;

        // --- 2. 탭 컨텐츠 컨테이너 ---
        let content_html = `<div class="tab-content">`;

        // 테이블 생성 헬퍼 함수
        const generate_tables = (type_data) => {
            let html = `<div style="margin-bottom: 15px; font-size: 1.1em;"><strong>VP Multiplier: ${data.vp_multiplier}</strong></div>`;
            
            type_data.groups.forEach(group => {
                html += `
                <table class="table table-bordered table-sm" style="margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="width: 15%; text-align: center;">${group.title}</th>
                            <th style="width: 25%;">Description</th>
                            <th style="width: 20%; text-align: right;">Cost</th>
                            <th style="width: 20%; text-align: right;">Sales</th>
                            <th style="width: 20%; text-align: right;">Discount</th>
                        </tr>
                    </thead>
                    <tbody>`;
                
                group.rows.forEach(row => {
                    let btn = (row.code === 'AA10' && type_data.aa10_details.length > 0) ? 
                        `<button class="btn btn-xs btn-link btn-aa10-toggle" style="padding:0;"><i class="fa fa-chevron-down"></i></button>` : '';
                    
                    html += `
                    <tr>
                        <td class="text-center">${row.code} ${btn}</td>
                        <td>${row.label}</td>
                        <td class="text-right">${format_num(row.summary.cost)}</td>
                        <td class="text-right">${format_num(row.summary.sales)}</td>
                        <td class="text-right">${format_num(row.summary.discount)}</td>
                    </tr>`;

                    if (row.code === 'AA10' && type_data.aa10_details.length > 0) {
                        html += `<tr class="aa10-detail-row" style="display:none; background-color: #fafafa;">
                            <td colspan="5">
                                <table class="table table-sm" style="margin:0;">
                                    ${type_data.aa10_details.map(d => `
                                        <tr>
                                            <td style="width:40%; padding-left:20px;">- ${d.item_code}</td>
                                            <td style="width:20%;" class="text-right">${format_num(d.cost)}</td>
                                            <td style="width:20%;" class="text-right">${format_num(d.sales)}</td>
                                            <td style="width:20%;" class="text-right">${format_num(d.discount)}</td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </td>
                        </tr>`;
                    }
                });

                html += `</tbody>
                    <tfoot style="font-weight: bold; background-color: #eee;">
                        <tr>
                            <td colspan="2">Total ${group.title}</td>
                            <td class="text-right">${format_num(group.total.cost)}</td>
                            <td class="text-right">${format_num(group.total.sales)}</td>
                            <td class="text-right">${format_num(group.total.discount)}</td>
                        </tr>
                    </tfoot>
                </table>`;
            });

            // Grand Total Table
            html += `
            <table class="table table-bordered table-sm">
                <tr style="background-color: #444; color: #fff; font-weight: bold;">
                    <td style="width: 40%;">GRAND TOTAL</td>
                    <td style="width: 20%;" class="text-right">${format_num(type_data.grand_total.cost)}</td>
                    <td style="width: 20%;" class="text-right">${format_num(type_data.grand_total.sales)}</td>
                    <td style="width: 20%;" class="text-right">${format_num(type_data.grand_total.discount)}</td>
                </tr>
            </table>`;
            return html;
        };

        // --- 3. Product Type별 탭 패널 생성 ---
        ptypes.forEach((ptype, idx) => {
            const safe_id = ptype.replace(/[^a-z0-9]/gi, '_');
            content_html += `
            <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" 
                 id="tab-${safe_id}" 
                 role="tabpanel">${generate_tables(data.by_type[ptype])}</div>`;
        });
        content_html += `</div>`;

        wrapper.html(tabs_html + content_html);

        // AA10 상세 토글 이벤트 연결
        wrapper.find('.btn-aa10-toggle').on('click', function() {
            $(this).closest('tr').next('.aa10-detail-row').toggle();
            $(this).find('i').toggleClass('fa-chevron-down fa-chevron-up');
        });

        // 숨겨진 필드 값 업데이트 (전체 합계 기준 데이터 유지)
        if (data.all) {
            frm.set_value({
                'total_aa10_cost': data.all.groups.find(g => g.title === 'A')?.rows.find(r => r.code === 'AA10')?.summary.cost || 0,
                'total_manufacturer_dc': data.all.grand_total.discount
            });
        }

    } catch (e) {
        console.error(e);
        wrapper.html('<p class="text-danger">Error rendering computation summary.</p>');
    }
}

async function render_codes_sum(frm) {
    const wrapper = frm.get_field("codes_sum").$wrapper;
    wrapper.empty();

    if (!frm.doc.finished_items?.length) {
        wrapper.html('<p class="text-muted">' + __('No items to summarize.') + '</p>');
        return;
    }

    wrapper.html('<p class="text-muted">' + __('Loading Summary...') + '</p>');

    try {
        const r = await frappe.call({
            method: "clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.get_codes_sum_data",
            args: {
                doc_dict: frm.doc,
                view_type: "product_type" // Product Type별 데이터 요청
            }
        });

        if (!r.message || !r.message.by_type) {
            wrapper.html('<p class="text-danger">' + __('Could not generate summary.') + '</p>');
            return;
        }

        const data = r.message.by_type;
        const ptypes = Object.keys(data);
        const format_num = (num, decimals = 2) => {
            if (num === null || num === undefined || isNaN(num)) return '';
            return parseFloat(num).toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        };

        // --- 1. 탭 헤더 생성 (라우팅 오류 방지를 위해 data-target 사용) ---
        let tabs_html = `<ul class="nav nav-tabs" role="tablist" style="margin-bottom: 15px;">`;
        ptypes.forEach((ptype, idx) => {
            const safe_id = ptype.replace(/[^a-z0-9]/gi, '_');
            tabs_html += `
            <li class="nav-item">
                <a class="nav-link ${idx === 0 ? 'active' : ''}" 
                   data-toggle="tab" 
                   data-target="#codes-tab-${safe_id}" 
                   href="javascript:void(0)" 
                   role="tab">${ptype}</a>
            </li>`;
        });
        tabs_html += `</ul>`;

        // --- 2. 탭 컨텐츠 컨테이너 ---
        let content_html = `<div class="tab-content">`;

        ptypes.forEach((ptype, idx) => {
            const safe_id = ptype.replace(/[^a-z0-9]/gi, '_');
            const group = data[ptype];
            
            let body_html = group.rows.map(row => `
                <tr>
                    <td>${row.item_code || ''}</td>
                    <td>${row.item_name || ''}</td>
                    <td class="text-right">${format_num(row.height, 0)}</td>
                    <td class="text-right">${format_num(row.width, 0)}</td>
                    <td class="text-right" style="font-weight: bold;">${format_num(row.planned_qty, 0)}</td>
                    <td class="text-right">${format_num(row.lm, 2)}</td>
                    <td class="text-right">${format_num(row.square_m, 2)}</td>
                    <td class="text-right">${format_num(row.planned_qty > 0 ? flt(row.vp_amount) / row.planned_qty : 0, 0)}</td>
                    <td class="text-right">${format_num(row.vp_amount, 0)}</td>
                    <td class="text-right">${format_num(row.planned_qty > 0 ? flt(row.price) / row.planned_qty : 0, 0)}</td>
                    <td class="text-right">${format_num(row.price, 0)}</td>
                </tr>
            `).join('');

            content_html += `
            <div class="tab-pane fade ${idx === 0 ? 'show active' : ''}" id="codes-tab-${safe_id}" role="tabpanel">
                <div class="table-responsive">
                    <table class="table table-bordered table-sm">
                        <thead style="background-color: #f8f9fa;">
                            <tr>
                                <th>CODE</th><th>Item Name</th><th>CH</th><th>Width</th><th>Qty</th>
                                <th>LM</th><th>M²</th><th>VP</th><th>Total VPs</th><th>Price</th><th>Total Price</th>
                            </tr>
                        </thead>
                        <tbody>${body_html}</tbody>
                        <tfoot style="font-weight: bold; background-color: #343a40; color: white;">
                            <tr>
                                <td colspan="5">Total (${ptype})</td>
                                <td class="text-right">${format_num(group.total.lm, 2)}</td>
                                <td class="text-right">${format_num(group.total.square_m, 2)}</td>
                                <td></td>
                                <td class="text-right">${format_num(group.total.vp_amount, 0)}</td>
                                <td></td>
                                <td class="text-right">${format_num(group.total.price, 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;
        });

        content_html += `</div>`;
        wrapper.html(tabs_html + content_html);

    } catch (error) {
        console.error("Error rendering codes summary:", error);
        wrapper.html('<p class="text-danger">' + __('An error occurred while generating the summary.') + '</p>');
    }
}



function setup_group_selection_for_grid(frm) {
	const table_fieldname = 'finished_items';
	const grid = frm.fields_dict[table_fieldname]?.grid;

	if (!grid || grid.is_group_selection_setup) {
		return;
	}

	// [1] 하이라이트 적용 함수
	const apply_highlight = function (frm, fieldname) {
		const grid_obj = frm.fields_dict[fieldname]?.grid;
		if (!grid_obj) return;

		grid_obj.grid_rows.forEach(grid_row => {
			const doc = grid_row.doc;
			const $row = $(grid_row.row);
			
			if (doc.__checked) {
				$row.addClass('highlight-row');
				// 다음 형제가 서브 행이면 같이 칠함
				const $subRow = $row.next('.custom-subrow');
				if ($subRow.length) $subRow.addClass('highlight-row');
			} else {
				$row.removeClass('highlight-row');
				// 다음 형제가 서브 행이면 같이 지움
				const $subRow = $row.next('.custom-subrow');
				if ($subRow.length) $subRow.removeClass('highlight-row');
			}
		});
	};

	// [2] 클릭 이벤트 핸들러 (그룹 선택 로직 강화)
	grid.wrapper.on('click', '.grid-row-check', function (e) {
		const $checkbox = $(this);
		const row_name = $checkbox.closest('.grid-row').data('name');
		const is_checked = $checkbox.is(':checked');

		// 현재 그리드에 있는 모든 데이터를 대상으로 검색 (필터링된 데이터 포함)
		const all_rows = frm.doc[table_fieldname] || [];
		const clicked_row_doc = all_rows.find(d => d.name === row_name);

		if (!clicked_row_doc) return;

		// Ctrl/Cmd 키 누름 여부
		const is_individual_select = e.ctrlKey || e.metaKey || e.shiftKey; 

		const is_parent = cint(clicked_row_doc.indent_level) === 0;

		if (is_individual_select || !is_parent) {
			// [개별 선택] Ctrl/Shift 또는 자식 행: 해당 행만 체크/해제
			clicked_row_doc.__checked = is_checked ? 1 : 0;
		} else {
			// [그룹 선택] 부모 행: idx 정렬 후 연속된 indent_level>0 행을 자식으로 수집
			// (fg_reference_id는 부모 저장 시 name이 바뀌면 stale이 될 수 있어 사용하지 않음)
			const sorted = [...all_rows].sort((a, b) => (a.idx || 0) - (b.idx || 0));
			const parent_pos = sorted.findIndex(d => d.name === clicked_row_doc.name);

			const rows_in_group = [clicked_row_doc];
			for (let i = parent_pos + 1; i < sorted.length; i++) {
				if (cint(sorted[i].indent_level) > 0) {
					rows_in_group.push(sorted[i]);
				} else {
					break;
				}
			}

			rows_in_group.forEach(row_doc => {
				row_doc.__checked = is_checked ? 1 : 0;

				const grid_row = grid.get_row(row_doc.name);
				if (grid_row) {
					$(grid_row.row).find('.grid-row-check').prop('checked', is_checked);
				}
			});
		}

		// 후처리: 헤더 체크박스 갱신, 버튼 표시, 하이라이트 적용
		grid.refresh_check_html();
		if (typeof toggle_duplicate_button === 'function') toggle_duplicate_button(frm, table_fieldname);
		if (typeof toggle_move_to_button === 'function') toggle_move_to_button(frm, table_fieldname);
		
		apply_highlight(frm, table_fieldname);
	});

	// [3] Grid Refresh 오버라이드
	const original_refresh = grid.refresh;
	grid.refresh = function() {
		original_refresh.apply(this, arguments);
		
		// [FIX] 그리드가 갱신된 직후 하이라이트 로직을 다시 실행합니다.
		// 삭제 후에는 데이터(d.__checked)는 없거나 0인데 DOM에 클래스만 남은 상태이므로,
		// 이 함수가 실행되면서 removeClass('highlight-row')가 호출되어 잔상을 지워줍니다.
		
		// 삭제 후 갱신될 때는 기본 모드(Group Mode)로 재계산하는 것이 안전합니다.
		// (삭제 시 Ctrl 키 상태를 알 수 없으므로)
		setTimeout(() => {
			apply_highlight(frm, table_fieldname, false); 
		}, 50);
	};

	// 하이라이트 CSS(.highlight-row)는 clestra_sales_order.css로 이동

	// 8. 중복 실행 방지 플래그 설정
	grid.is_group_selection_setup = true;
	// console.log("Group selection and highlight feature has been set up.");
}


function open_bulk_discount_dialog(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Apply Manufacturer Discount in Bulk'),
		fields: [
			{
				label: __('Discount Scope'),
				fieldname: 'discount_scope',
				fieldtype: 'Select',
				options: [
					{ label: __("Select Scope..."), value: "", disabled: true },
					"Door",
					"Panel",
					"Door & Panel",
					"Product Type"
				],
				reqd: 1,
				onchange: () => {
					// 'Product Type'을 선택했을 때만 멀티셀렉트 필드를 보여줍니다.
					const scope = dialog.get_value('discount_scope');
					dialog.set_df_property('product_type_list', 'hidden', scope !== 'Product Type');
				}
			},
			{
				label: __('Product Type'),
				fieldname: 'product_type_list',
				fieldtype: 'MultiSelect', // MultiSelect 타입 사용
				hidden: 1, // 기본적으로 숨김
			},
			{
				label: __('Discount Rate'),
				fieldname: 'discount_rate',
				fieldtype: 'Percent',
				reqd: 1
			}
		],
		primary_action_label: __('Apply'),
		primary_action: (values) => {
			const scope = values.discount_scope;
			const rate = values.discount_rate;
			const types = values.product_type_list;
			const items_table = frm.doc.finished_items || [];

			// 업데이트할 행들을 담을 배열
			let rows_to_update = [];

			if (scope === 'Door') {
				rows_to_update = items_table.filter(row =>
					row.product_section === "Door" || row.product_section === "Leaf"
				);
			} else if (scope === 'Panel') {
				rows_to_update = items_table.filter(row =>
					row.product_section === "Panel"
				);
			} else if (scope === 'Door & Panel') {
				rows_to_update = items_table.filter(row =>
					["Door", "Leaf", "Panel"].includes(row.product_section)
				);
			} else if (scope === 'Product Type') {
				if (!types || types.length === 0) {
					frappe.msgprint(__("Please select at least one Product Type."));
					return; // 함수 종료
				}
				const type_list = types.split(',').map(s => s.trim());
				rows_to_update = items_table.filter(row =>
					type_list.includes(row.product_type) &&
					["Door", "Leaf", "Panel"].includes(row.product_section)
				);
			}

			if (rows_to_update.length === 0) {
				frappe.show_alert({
					message: __("No items found for the selected scope."),
					indicator: 'orange'
				});
				return;
			}

			// 확인 다이얼로그를 띄워 사용자에게 최종 확인을 받습니다.
			frappe.confirm(
				__('Are you sure you want to apply a {0}% discount to {1} items?', [rate, rows_to_update.length]),
				() => {
					// 'Yes'를 클릭했을 때 실행
					const update_promises = rows_to_update.map(row =>
						frappe.model.set_value(row.doctype, row.name, 'manufacturer_dc', rate)
					);

					Promise.all(update_promises).then(() => {
						frm.refresh_field('finished_items');
						frappe.show_alert({
							message: __('Discount applied successfully.'),
							indicator: 'green'
						});
						dialog.hide();
					});
				}
			);
		}
	});

	setup_dialog_multiselect(
		dialog, "product_type_list", "Selection Library", { "opt_name": "Product Type" }, "opt_value");

	dialog.show();
}


function setup_dialog_multiselect(dialog, fieldname, target_doctype, filters = null, target_field) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: target_doctype,
			filters: filters,
			fields: [target_field],
			limit_page_length: 0
		},
		callback: function (response) {
			if (response && response.message) {
				let options = response.message.map(d => ({ label: d[target_field], value: d[target_field] }));
				let field = dialog.get_field(fieldname);
				if (field) {
					field.set_data(options);
				}
			}
		}
	});
}

function update_grand_total_vp(frm) {
	let total = 0;
	(frm.doc.finished_items || []).forEach(row => {
		total += flt(row.vp_amount);
	});
	frm.set_value('grand_total_vp', total);
}


// ====================================================================
// Zone Summary HTML 렌더링
// ====================================================================

function render_new_zone_summary(frm) {
	// new-zone-list CSS는 clestra_sales_order.css로 이동

	const wrapper = frm.fields_dict.zone_summary_new_html?.$wrapper;
	if (!wrapper || !frm.doc.project) return;

	// Zone doctype에서 조회 후 캐시
	frappe.call({
		method: 'clestra_app.clestra_selling.doctype.clestra_sales_order.clestra_sales_order.get_zones_for_project',
		args: { project: frm.doc.project, sales_order: frm.doc.name },
		async: false,
		callback: function(r) {
			frm._zone_list = r.message || [];
		}
	});

	// zone_summary child table의 집계 값을 Zone 데이터에 병합
	const summary_map = {};
	(frm.doc.zone_summary || []).forEach(s => {
		if (s.zone_name) summary_map[s.zone_name] = s;
	});
	(frm._zone_list || []).forEach(z => {
		const s = summary_map[z.name];
		if (s) {
			z.lm = s.total_lm || 0;
			z.square_m = s.total_square_m || 0;
			z.zone_overall_color = s.zone_overall_color || z.zone_overall_color || '';
			z.ch = s.ch || '';
			z.ph = s.ph || '';
			z.clch_type = s.clch_type || '';
			z.ceiling_visible = s.ceiling_visible || '';
			z.base_type = s.base_type || '';
			z.base_visible_h = s.base_visible_h || '';
		}
	});

	_render_zone_html(frm, wrapper, frm._zone_list || []);
}


function _render_zone_html(frm, wrapper, zones) {
	const selected_zone = frm.doc.zone_selected;

	let html = `
	<div class="frappe-control">
		<div class="grid-buttons" style="display:flex;gap:6px;margin-bottom:8px;">
			<button class="btn btn-xs btn-default btn-new-add-zone">
				<svg class="icon icon-sm"><use href="#icon-add"></use></svg> ${__('Add Zone')}
			</button>
			<button class="btn btn-xs btn-default btn-new-dup-zone">${__('Duplicate')}</button>
			<button class="btn btn-xs btn-danger btn-new-del-zone" style="margin-left:auto;${selected_zone ? '' : 'display:none;'}">
				<svg class="icon icon-sm"><use href="#icon-delete"></use></svg> ${__('Delete')}
			</button>
		</div>`;

	if (zones.length > 0) {
		html += `
		<div class="new-zone-list" style="border:1px solid var(--border-color, #d1d8dd);border-radius:var(--border-radius, 6px);">
			<div class="list-row-head">
				<div class="list-row-col" style="flex:2">Zone</div>
				<div class="list-row-col" style="flex:2">Prod. Type</div>
				<div class="list-row-col" style="flex:1.5">Color</div>
				<div class="list-row-col" style="flex:1;text-align:right">L/M</div>
				<div class="list-row-col" style="flex:1;text-align:right">M²</div>
				<div class="list-row-col" style="flex:1;text-align:center">CH</div>
				<div class="list-row-col" style="flex:1;text-align:center">PH</div>
				<div class="list-row-col" style="flex:1.5">CL/CH</div>
				<div class="list-row-col" style="flex:1;text-align:center">CL Vis.</div>
				<div class="list-row-col" style="flex:1.5">Base</div>
				<div class="list-row-col" style="flex:1;text-align:center">Base Vis.</div>
			</div>`;

		zones.forEach(z => {
			const is_active = selected_zone && z.name === selected_zone;
			html += `
			<div class="list-row zone-row" data-zone="${frappe.utils.escape_html(z.name || '')}"
				 style="cursor:pointer;${is_active ? 'background:var(--highlight-color);' : ''}">
				<div class="list-row-col ellipsis" style="flex:2;font-weight:600;">
					${is_active ? '<i class="fa fa-check-circle text-success" style="margin-right:4px;"></i>' : ''}
					${frappe.utils.escape_html(z.zone_name || '')}
				</div>
				<div class="list-row-col ellipsis" style="flex:2">${frappe.utils.escape_html(z.product_type || '')}</div>
				<div class="list-row-col ellipsis" style="flex:1.5">${frappe.utils.escape_html(z.zone_overall_color || '')}</div>
				<div class="list-row-col" style="flex:1;text-align:right">${flt(z.lm, 2)}</div>
				<div class="list-row-col" style="flex:1;text-align:right">${flt(z.square_m, 2)}</div>
				<div class="list-row-col" style="flex:1;text-align:center">${frappe.utils.escape_html(z.ch || '')}</div>
				<div class="list-row-col" style="flex:1;text-align:center">${frappe.utils.escape_html(z.ph || '')}</div>
				<div class="list-row-col ellipsis" style="flex:1.5">${frappe.utils.escape_html(z.clch_type || '')}</div>
				<div class="list-row-col" style="flex:1;text-align:center">${z.ceiling_visible || ''}</div>
				<div class="list-row-col ellipsis" style="flex:1.5">${frappe.utils.escape_html(z.base_type || '')}</div>
				<div class="list-row-col" style="flex:1;text-align:center">${z.base_visible_h || ''}</div>
			</div>`;
		});

		html += `</div>`;
	} else {
		html += `<div class="text-muted text-center" style="padding:24px;border:1px dashed var(--border-color);border-radius:var(--border-radius);">
			${__('No zones yet. Click "Add Zone" to get started.')}
		</div>`;
	}

	html += `</div>`;
	wrapper.html(html);

	// Zone row click → 서버 통신 없이 즉시 필터링
	wrapper.find('.zone-row').on('click', function () {
		const zone_name = $(this).data('zone');
		if (frm.doc.zone_selected === zone_name) {
			frm.doc.zone_selected = null;
			frm.doc.zone_product_type = null;
		} else {
			frm.doc.zone_selected = zone_name;
			const zone_row = zones.find(z => z.name === zone_name);
			frm.doc.zone_product_type = zone_row ? zone_row.product_type : null;
		}
		_render_zone_html(frm, wrapper, zones);
		apply_visibility_rules(frm);
	});

	// Toolbar buttons
	wrapper.find('.btn-new-add-zone').on('click', () => open_add_zone_dialog(frm, null));
	wrapper.find('.btn-new-dup-zone').on('click', () => {
		if (!selected_zone) {
			frappe.msgprint({ title: __('No Zone Selected'), indicator: 'orange', message: __('Please select a Zone first.') });
			return;
		}
		open_add_zone_dialog(frm, selected_zone);
	});
	wrapper.find('.btn-new-del-zone').on('click', () => {
		if (!selected_zone) return;
		frappe.confirm(
			__("All items in this zone will be deleted."),
			() => {
				perform_zone_and_items_deletion(frm, selected_zone);
				frm.doc.zone_selected = null;
				frm.doc.zone_product_type = null;
				frm._zone_list = (frm._zone_list || []).filter(z => z.name !== selected_zone);
				_render_zone_html(frm, wrapper, frm._zone_list);
				apply_visibility_rules(frm);
				frm.save();
			}
		);
	});
}
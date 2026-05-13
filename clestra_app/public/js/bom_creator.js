// Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
frappe.provide("erpnext.bom");

frappe.ui.form.on("BOM Creator", {
	setup(frm) {
		frm.trigger("set_queries");
	},

	setup_bom_creator(frm) {
		frm.dashboard.clear_comment();

		if (!frm.is_new()) {
			if (!frappe.bom_configurator || frappe.bom_configurator.bom_configurator !== frm.doc.name) {
				frm.trigger("build_tree");
			}
		} else if (frm.doc.items?.length && !frm.is_duplicate_processed) {
			frm.trigger("prompt_for_new_item_on_duplicate");
		} else if (!frm.doc.items?.length) {
			let $parent = $(frm.fields_dict["bom_creator"].wrapper);
			$parent.empty();
			frm.trigger("make_new_entry");
		}
	},

	build_tree(frm) {
		let $parent = $(frm.fields_dict["bom_creator"].wrapper);
		$parent.empty();
		frm.toggle_enable("item_code", false);

		frappe.require("bom_configurator.bundle.js").then(() => {
			frappe.bom_configurator = new frappe.ui.BOMConfigurator({
				wrapper: $parent,
				page: $parent,
				frm: frm,
				bom_configurator: frm.doc.name,
			});
		});
	},

	expand_all(frm) {
		if (frappe.bom_configurator && frappe.bom_configurator.tree_view) {
			const tree = frappe.bom_configurator.tree_view.tree;

			if (tree && tree.root_node) {
				tree.load_children(tree.root_node, true);
			}
		}
	},

	make_new_entry(frm) {
		frappe.db.get_value('User', frappe.session.user, 'company').then(r => {
			let default_company = (r && r.message && r.message.company)
				? r.message.company
				: '';

			let dialog = new frappe.ui.Dialog({
				title: __("Multi-level BOM Creator"),
				fields: [
					{
						label: __("Name"),
						fieldtype: "Data",
						fieldname: "name",
						reqd: 1,
					},
					{ fieldtype: "Column Break" },
					{
						label: __("Company"),
						fieldtype: "Link",
						fieldname: "company",
						options: "Company",
						reqd: 1,
						read_only: 1,
						default: default_company
					},
					{ fieldtype: "Section Break" },
					{
						label: __("Item Code (Final Product)"),
						fieldtype: "Link",
						fieldname: "item_code",
						options: "Item",
						reqd: 1,
					},
					{ fieldtype: "Column Break" },
					{
						label: __("Quantity"),
						fieldtype: "Float",
						fieldname: "qty",
						reqd: 1,
						default: 1.0,
					},
					{ fieldtype: "Section Break" },
					{
						label: __("Currency"),
						fieldtype: "Link",
						fieldname: "currency",
						options: "Currency",
						reqd: 1,
						default: frappe.defaults.get_global_default("currency"),
					},
					{ fieldtype: "Column Break" },
					{
						label: __("Conversion Rate"),
						fieldtype: "Float",
						fieldname: "conversion_rate",
						reqd: 1,
						default: 1.0,
					},
				],
				
				primary_action_label: __("Create"),
				primary_action: (values) => {
					values.doctype = frm.doc.doctype;
					
					frappe.db.insert(values).then((doc) => {
						frappe.set_route("Form", doc.doctype, doc.name);
					});
				},
			});	

		dialog.fields_dict.item_code.get_query = function() {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: {
					company: dialog.get_value("company")
				}
			};
		};
		dialog.show();
		});
	},

	set_queries(frm) {
		frm.set_query("bom_no", "items", function (doc, cdt, cdn) {
			let item = frappe.get_doc(cdt, cdn);
			return {
				filters: {
					item: item.item_code,
				},
			};
		});
		frm.set_query("item_code", "items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
			};
		});
		frm.set_query("fg_item", "items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
			};
		});
	},

	refresh(frm) {
		frm.trigger("setup_bom_creator");
		frm.trigger("set_root_item");
		frm.trigger("add_custom_buttons");
		frm.trigger("update_grid_qty_view"); //SYEOM @ 241127 - Grid view Update
	},

	prompt_for_new_item_on_duplicate(frm) {
		const old_item_code = frm.doc.item_code;
		const old_doc_name = frm.doc.name;

		let dialog = new frappe.ui.Dialog({
			title: __("Duplicate BOM Creator"),
			fields: [
				{
					label: __("Item Code (Final Product)"),
					fieldtype: "Link",
					fieldname: "item_code",
					options: "Item",
					default: old_item_code,
					reqd: 1,
				},
			],
			primary_action_label: __("Create"),
			primary_action: (values) => {
				frm.is_duplicate_processed = true;
				dialog.hide();

				const new_item_code = values.item_code;

				// fg_item, fg_reference_id 를 동기적으로 먼저 업데이트
				(frm.doc.items || []).forEach(row => {
					if (row.fg_item === old_item_code) {
						frappe.model.set_value(row.doctype, row.name, 'fg_item', new_item_code);
					}
					if (row.fg_reference_id === old_doc_name) {
						frappe.model.set_value(row.doctype, row.name, 'fg_reference_id', new_item_code);
					}
				});

				// item_code 변경 (Link fetch 포함)
				frm.set_value("item_code", new_item_code);
				frm.dirty();
			},
		});

		dialog.fields_dict.item_code.get_query = "erpnext.controllers.queries.item_query";
		dialog.show();
	},

	set_root_item(frm) {
		if (frm.is_new() && frm.doc.items?.length) {
			frappe.model.set_value(frm.doc.items[0].doctype, frm.doc.items[0].name, "is_root", 1);
		}
	},

	add_custom_buttons(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Rebuild Tree"), () => {
				frm.trigger("build_tree");
			});
		}

		if (!frm.is_new()) {
			frm.add_custom_button(__("Expand All"), () => {
				frm.trigger("expand_all");
			});
		}

		// 행 번호 재정렬 버튼 추가
		// if (!frm.is_new()) {
		// 	frm.add_custom_button(__("Renumber Rows"), () => {
		// 		frm.trigger("renumber_items");
		// 	}).addClass("btn-secondary");
		// }

		if (frm.doc.docstatus === 1 && frm.doc.status !== "Completed") {
			frm.add_custom_button(__("Create Multi-level BOM"), () => {
				frm.trigger("create_multi_level_bom");
			});
		}
	},

	// 그리드 행 번호를 DOM 순서에 따라 재정렬하는 함수
	renumber_items(frm) {
		const grid = frm.get_field("items").grid;
		if (!grid || !grid.grid_rows) {
			frappe.show_alert({ message: __("Grid not available."), indicator: "orange" });
			return;
		}

		// 1. DOM에서 현재 보이는 행(.grid-row)들을 순서대로 가져옵니다.
		const $rows = $(grid.parent).find(".grid-row:visible");
		let new_data_order = [];
		let new_idx_mapping = {}; // 키: doc.name, 값: 새로운 idx

		// 2. 첫 번째 순회: DOM 순서를 기반으로 새로운 idx를 할당하고, 매핑을 생성합니다.
		$rows.each((index, row_element) => {
			const doc_name = $(row_element).attr("data-name");
			const grid_row = grid.grid_rows_by_docname[doc_name];

			if (grid_row) {
				const doc = grid_row.doc;
				const new_idx = index + 1;

				doc.idx = new_idx; // 데이터 객체에 새로운 idx 할당
				new_idx_mapping[doc_name] = new_idx; // 매핑 정보 저장 (name -> new_idx)
				new_data_order.push(doc); // 새로운 순서의 데이터 배열에 추가
			}
		});

		// 3. 두 번째 순회: 새로운 idx 매핑을 사용하여 parent_row_no를 업데이트합니다.
		new_data_order.forEach(doc => {
			if (doc.fg_reference_id) { // 부모의 name(고유 ID)이 있는 경우
				const parent_new_idx = new_idx_mapping[doc.fg_reference_id];
				if (parent_new_idx !== undefined) {
					// 매핑에서 찾은 부모의 새 idx를 parent_row_no에 할당
					doc.parent_row_no = parent_new_idx;
				} else {
					// 부모를 찾지 못한 경우 (예: 필터링된 상태), 0으로 초기화
					doc.parent_row_no = 0;
				}
			} else {
				// 최상위 행은 부모가 없으므로 0으로 설정
				doc.parent_row_no = 0;
			}
		});

		// 4. Frappe 프레임워크의 내부 데이터를 업데이트합니다.
		frm.doc.items = new_data_order;

		// 5. 그리드를 새로고침하여 화면에 변경사항을 반영합니다.
		frm.refresh_field("items");

		// 6. 사용자에게 알림을 표시하고 문서를 '저장 필요' 상태로 만듭니다.
		frappe.msgprint({
			title: __("Success"),
			message: __("Items have been renumbered. Please save the document to apply changes."),
			indicator: "green"
		});
		frm.dirty(); // form을 dirty 상태로 만들어 저장 버튼이 활성화되도록 함
	},

	create_multi_level_bom(frm) {
		frm.call({
			method: "enqueue_create_boms",
			doc: frm.doc,
		});
	},

	//SYEOM @ 241127 - Qty in brackets on grid view
	update_grid_qty_view(frm) {
		frm.fields_dict["items"].grid.grid_rows.forEach(function (row) {
			let item = row.doc;
			// Row의 필드에 안전하게 접근하기 위해 조건 확인
			if (!item || !row || !row.wrapper) {
				return; // 필드가 정의되지 않았으면 해당 Row 스킵
			}
	
			// qty 셀 DOM 요소 가져오기
			let $qty_cell = $(row.wrapper).find('[data-fieldname="qty"]');
	
			if ($qty_cell.length > 0) {
				// brackets 스타일 추가 또는 제거
				if (item.show_qty_bracket) {
					$qty_cell.addClass("qty-bracket"); // bracket 스타일 추가
				} else {
					$qty_cell.removeClass("qty-bracket"); // bracket 스타일 제거
				}
			}
			// 개별 행 새로고침
			row.refresh();
		});
	},
});

frappe.ui.form.on("BOM Creator Item", {
	
	item_code(frm, cdt, cdn) {
		let item = frappe.get_doc(cdt, cdn);
		if (item.item_code && item.is_root) {
			frappe.model.set_value(cdt, cdn, "fg_item", item.item_code);
		}
		// SYEOM @ 241127 - Item 도큐타입에서 print_hide 값 가져오기
		if (item.item_code) {
			frappe.db.get_value("Item", item.item_code, ["print_hide", "show_qty_bracket","color"]).then((r) => {
				if (r && r.message) {
					frappe.model.set_value(cdt, cdn, "print_hide", r.message.print_hide);
					frappe.model.set_value(cdt, cdn, "show_qty_bracket", r.message.show_qty_bracket);
					frappe.model.set_value(cdt, cdn, "color", r.message.color);
			
					// Grid 업데이트
					frm.trigger("update_grid_qty_view");
				}
			});
		}
	},

	show_qty_bracket(frm, cdt, cdn) {
		frm.trigger("update_grid_qty_view"); // Grid 업데이트
	},

	qty(frm, cdt, cdn) {
		frm.trigger("update_grid_qty_view"); // Grid 업데이트
	},

	do_not_explode(frm, cdt, cdn) {
		let item = frappe.get_doc(cdt, cdn);
		if (!item.do_not_explode) {
			frm.call({
				method: "get_default_bom",
				doc: frm.doc,
				args: {
					item_code: item.item_code,
				},
				callback(r) {
					if (r.message) {
						frappe.model.set_value(cdt, cdn, "bom_no", r.message);
					}
				},
			});
		} else {
			frappe.model.set_value(cdt, cdn, "bom_no", "");
		}
	},
});

erpnext.bom.BomConfigurator = class BomConfigurator extends erpnext.TransactionController {
	conversion_rate(doc) {
		if (this.frm.doc.currency === this.get_company_currency()) {
			this.frm.set_value("conversion_rate", 1.0);
		} else {
			erpnext.bom.update_cost(doc);
		}
	}

	buying_price_list(doc) {
		this.apply_price_list();
	}

	plc_conversion_rate(doc) {
		if (!this.in_apply_price_list) {
			this.apply_price_list(null, true);
		}
	}

	conversion_factor(doc, cdt, cdn) {
		if (frappe.meta.get_docfield(cdt, "stock_qty", cdn)) {
			var item = frappe.get_doc(cdt, cdn);
			frappe.model.round_floats_in(item, ["qty", "conversion_factor"]);
			item.stock_qty = flt(item.qty * item.conversion_factor, precision("stock_qty", item));
			refresh_field("stock_qty", item.name, item.parentfield);
			this.toggle_conversion_factor(item);
		}
	}
};

// Helper function for toggling fields
// function toggle_custom_fields(grid_row, field) {
//     const custom_field_name = `custom_${field}`;
//     const field_name_custom = `${field}_custom`;

//     if (grid_row.doc[custom_field_name]) {
//         // Custom Mode 활성화
//         grid_row.toggle_display(field_name_custom, true);
//         grid_row.toggle_display(field, false);
//     } else {
//         // 기본값 모드 활성화
//         grid_row.toggle_display(field_name_custom, false);
//         grid_row.toggle_display(field, true);
//     }
// }

extend_cscript(cur_frm.cscript, new erpnext.bom.BomConfigurator({ frm: cur_frm }));
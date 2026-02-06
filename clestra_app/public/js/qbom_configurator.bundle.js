class QBOMConfigurator {
	constructor({ wrapper, page, frm, qbom_configurator }) {
		this.$wrapper = $(wrapper);
		this.page = page;
		this.qbom_configurator = qbom_configurator;
		this.frm = frm;

		this.make();
		this.prepare_layout();
		this.bind_events();
	}

	add_qboms() {
		this.frm.call({
			method: "add_qboms",
			freeze: true,
			doc: this.frm.doc,
		});
	}

	make() {
		let options = {
			...this.tree_options(),
			...this.tree_methods(),
		};

		frappe.views.trees["QBOM Configurator"] = new frappe.views.TreeView(options);
		this.tree_view = frappe.views.trees["QBOM Configurator"];
	}

	bind_events() {
		frappe.views.trees["QBOM Configurator"].events = {
			frm: this.frm,
			add_item: this.add_item,
			add_sub_assembly: this.add_sub_assembly,
			get_sub_assembly_modal_fields: this.get_sub_assembly_modal_fields,
			convert_to_sub_assembly: this.convert_to_sub_assembly,
			delete_node: this.delete_node,
			edit_item: this.edit_item,
			load_tree: this.load_tree,
			set_default_qty: this.set_default_qty,
		};
	}

	tree_options() {
		return {
			parent: this.$wrapper.get(0),
			body: this.$wrapper.get(0),
			doctype: "QBOM Configurator",
			page: this.page,
			expandable: true,
			title: __("Configure Product Assembly"),
			breadcrumb: "Clestra App",
			get_tree_nodes: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.get_children",
			root_label: this.frm.doc.item_code,
			disable_add_node: true,
			get_tree_root: false,
			show_expand_all: false,
			extend_toolbar: false,
			do_not_make_page: true,
			do_not_setup_menu: true,
		};
	}

	tree_methods() {
		let frm_obj = this;
		let view = frappe.views.trees["QBOM Configurator"];
		let treeviewContainer = this.$wrapper; 

		return {
			onload: function (me) {
				me.args["parent_id"] = frm_obj.frm.doc.name;
				me.args["parent"] = frm_obj.frm.doc.item_code;
				me.parent = frm_obj.$wrapper.get(0);
				me.body = frm_obj.$wrapper.get(0);
				me.make_tree();
			},
			onrender(node) {
				const qty = node.data.qty || frm_obj.frm.doc.qty;
				const uom = node.data.uom || frm_obj.frm.doc.uom;
				const docname = node.data.name || frm_obj.frm.doc.name;

				let vp = frm_obj.frm.doc.vp;
				// let rate = node.data.rate || frm_obj.frm.doc.rate;
				// let amount = node.data.amount || frm_obj.frm.doc.amount;
				
				// If node is the root item, use raw_material_cost for amount
				let rate, amount;
				if (node.data.value === frm_obj.frm.doc.item_code) {
					amount = frm_obj.frm.doc.amount;
					rate = frm_obj.frm.doc.rate;
				} else {
					amount = node.data.amount;
					rate = node.data.rate;
				}

				let total_amount = frm_obj.frm.doc.raw_material_cost;
				
				// Format values for display
				// let formatted_rate = frappe.format(rate, {fieldtype: "Currency", currency: frm_obj.frm.doc.currency});
				let formatted_rate = frappe.format(rate, {fieldtype: "Float", precision: 2}); // 소수점 두 자리까지 표시
				let formatted_amount = frappe.format(amount, { fieldtype: "Currency", currency: frm_obj.frm.doc.currency, precision: 0});
				let formatted_total_amount = frappe.format(total_amount, {fieldtype: "Currency", currency: frm_obj.frm.doc.currency, precision: 0});

				$(`
					<div class="pill small pull-right bom-qty-pill"
						style="background-color: var(--bg-white);
							color: var(--text-on-gray);
							font-weight:450;
							margin-right: 40px;
							display: inline-flex;
							min-width: 128px;
							border: 1px solid var(--bg-gray);
						">
							<div style="padding-right:5px" data-qbom-qty-docname="${docname}">${qty} ${uom}</div>
							<div class="item-rate" style="padding-left:12px; padding-right:5px; border-left:1px solid var(--bg-gray)">
								${formatted_rate}
							</div>
							<div class="fg-item-amt" style="padding-left:12px; border-left:1px solid var(--bg-gray)">
								${formatted_amount}
							</div>
					</div>

				`).insertBefore(node.$ul);

				// Display value point on the right top of treeview
				if (!$('.value-point-display').length) {
					let valuePointDiv = $(`
						<div class="vp-wrapper" style="display: flex; justify-content: flex-end; align-items: right; width: 100%;">
							<div class="pill small qbom-qty-pill value-point-display"
								style="background-color: var(--bg-white);
									color: var(--text-on-gray);
									font-weight: 450;
									margin-top: 10px;
									margin-right: 40px;
									min-width: 55px;
									border: 1px solid var(--bg-gray);">
								VP: ${vp}
							</div>
						</div>
						<div class="vp-line" style="border-bottom: 1px solid var(--bg-gray); margin-left: 5px; margin-right: 5px; margin-top: 10px;"></div>
					`);

					// Append directly inside the treeview container
					$(treeviewContainer).prepend(valuePointDiv);
				} else {
					$('.value-point-display').html(`VP: ${vp}`);
				}

				// Display total_amount on the right bottom of treeview
				if (!$('.total-amount-display').length) {
					let totalAmountDiv = $(`
						<div class="total-amount-line" style="border-top: 1px solid var(--bg-gray); margin-left: 5px; margin-right: 5px; margin-top: 10px;"></div>
						<div class="total-amount-wrapper" style="display: inline-flex; justify-content: flex-end; align-items: right; width: 100%;">
							<div class="pill small qbom-qty-pill total-amount-display"
								style="background-color: var(--bg-white);
									color: var(--text-on-gray);
									font-weight: 450;
									margin-top: 10px;
									margin-right: 40px;
									min-width: 120px;
									border: 1px solid var(--bg-gray);
									display: inline-flex;
									white-space: nowrap;">
								Total Amount: ${formatted_total_amount}
							</div>
						</div>
						`);

						// Append directly inside the treeview container
						$(treeviewContainer).append(totalAmountDiv);
				}
			},
			toolbar: this.frm?.doc.docstatus === 0
					? [
							{
								label: `${frappe.utils.icon("edit", "sm")} ${__("Edit")}`,
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];
									view.events.edit_item(node, view);
								},
								btnClass: "hidden-xs",
							},
							{
								label: `${frappe.utils.icon("add", "sm")} ${__("Raw Material")}`,
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];
									view.events.add_item(node, view);
								},
								condition: function (node) {
									return node.expandable;
								},
								btnClass: "hidden-xs",
							},
							{
								label: `${frappe.utils.icon("add", "sm")} ${__("Sub Assembly")}`,
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];
									view.events.add_sub_assembly(node, view);
								},
								condition: function (node) {
									return node.expandable;
								},
								btnClass: "hidden-xs",
							},
							{
								label: __("Expand All"),
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];

									if (!node.expanded) {
										view.tree.load_children(node, true);
										$(node.parent[0]).find(".tree-children").show();
										node.$toolbar.find(".expand-all-btn").html("Collapse All");
									} else {
										node.$tree_link.trigger("click");
										node.$toolbar.find(".expand-all-btn").html("Expand All");
									}
								},
								condition: function (node) {
									return node.expandable && node.is_root;
								},
								btnClass: "hidden-xs expand-all-btn",
							},
							{
								label: `${frappe.utils.icon("move", "sm")} ${__("Sub Assembly")}`,
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];
									view.events.convert_to_sub_assembly(node, view);
								},
								condition: function (node) {
									return !node.expandable;
								},
								btnClass: "hidden-xs",
							},
							{
								label: `${frappe.utils.icon("delete", "sm")} ${__("Item")}`,
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];
									view.events.delete_node(node, view);
								},
								condition: function (node) {
									return !node.is_root;
								},
								btnClass: "hidden-xs",
							},
					  ]
					: [
							{
								label: __("Expand All"),
								click: function (node) {
									let view = frappe.views.trees["QBOM Configurator"];

									if (!node.expanded) {
										view.tree.load_children(node, true);
										$(node.parent[0]).find(".tree-children").show();
										node.$toolbar.find(".expand-all-btn").html("Collapse All");
									} else {
										node.$tree_link.trigger("click");
										node.$toolbar.find(".expand-all-btn").html("Expand All");
									}
								},
								condition: function (node) {
									return node.expandable && node.is_root;
								},
								btnClass: "hidden-xs expand-all-btn",
							},
					  ],
		};
	}

	add_item(node, view) {

		frappe.prompt(
			[
				{ label: __("Item"), fieldname: "item_code", fieldtype: "Link", options: "Item", reqd: 1 },
				{ label: __("Qty"), fieldname: "qty", default: 1.0, fieldtype: "Float", reqd: 1, precision: 2 },
				{ label: __("Rate"), fieldname: "rate", default: 1.0, fieldtype: "Float", reqd: 1, precision: 2 },
				{ label: __("Excluding VP calculation"), default: 0, fieldname: "excluding_vp", fieldtype: "Check" },
				// { label: __("Amount"), fieldname: "amount", fieldtype: "Float", read_only: 1 }
			],
			(data) => {
				if (!node.data.parent_id) {
					node.data.parent_id = this.frm.doc.name;
				}

				// let vp = this.frm.doc.vp;
				// let excluding_vp = data.excluding_vp;
				// let amount;
				// if (data.excluding_vp == 1) {
				// 	amount = flt(data.rate) * flt(data.qty);
				// }else{
				// 	amount = flt(data.rate) * flt(data.qty) * vp;
				// }
	
				// // amount 필드에 계산된 값을 설정
				// data.amount = amount;
				
				frappe.call({
					method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.add_item",
					args: {
						parent: node.data.parent_id,
						fg_item: node.data.value,
						item_code: data.item_code,
						fg_reference_id: node.data.name || this.frm.doc.name,
						qty: data.qty,
						rate: data.rate,
						excluding_vp: data.excluding_vp
					},
					callback: (r) => {
						view.events.load_tree(r, node);
					},
				});
			},
			__("Add Item"),
			__("Add")
		);
	}

	add_sub_assembly(node, view) {
		let dialog = new frappe.ui.Dialog({
			fields: view.events.get_sub_assembly_modal_fields(),
			title: __("Add Sub Assembly"),
		});

		dialog.show();
		view.events.set_default_qty(dialog);

		dialog.set_primary_action(__("Add"), () => {
			let qbom_item = dialog.get_values();

			if (!node.data?.parent_id) {
				node.data.parent_id = this.frm.doc.name;
			}
	
			frappe.call({
				method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.add_sub_assembly",
				args: {
					parent: node.data.parent_id,
					fg_item: node.data.value,
					fg_reference_id: node.data.name || this.frm.doc.name,
					qbom_item: qbom_item,
				},
				callback: (r) => {
					view.events.load_tree(r, node);
				},
			});
	
			dialog.hide();
		});
	}
	
	get_sub_assembly_modal_fields(read_only = false) {
		return [
			{
				label: __("Sub Assembly Item"),
				fieldname: "item_code",
				fieldtype: "Link",
				options: "Item",
				reqd: 1,
				read_only: read_only,
			},
			{ fieldtype: "Column Break" },
			{
				label: __("Qty"),
				fieldname: "qty",
				default: 1.0,
				fieldtype: "Float",
				precision: 2,
				reqd: 1,
				read_only: read_only,
			},
			{ fieldtype: "Section Break" },
			{
				label: __("Raw Materials"),
				fieldname: "items",
				fieldtype: "Table",
				reqd: 1,
				fields: [
					{
						label: __("Item"),
						fieldname: "item_code",
						fieldtype: "Link",
						options: "Item",
						reqd: 1,
						in_list_view: 1,
					},
					{
						label: __("Qty"),
						fieldname: "qty",
						default: 1.0,
						fieldtype: "Float",
						precision: 2,
						reqd: 1,
						in_list_view: 1,
					},
				],
			},
		];
	}
	
	convert_to_sub_assembly(node, view) {
		let dialog = new frappe.ui.Dialog({
			fields: view.events.get_sub_assembly_modal_fields(true),
			title: __("Add Sub Assembly"),
		});
	
		dialog.set_values({
			item_code: node.data.value,
			qty: node.data.qty,
		});
	
		dialog.show();
		view.events.set_default_qty(dialog);
	
		dialog.set_primary_action(__("Add"), () => {
			let qbom_item = dialog.get_values();
	
			frappe.call({
				method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.add_sub_assembly",
				args: {
					parent: node.data.parent_id,
					fg_item: node.data.value,
					qbom_item: qbom_item,
					fg_reference_id: node.data.name || this.frm.doc.name,
					convert_to_sub_assembly: true,
				},
				callback: (r) => {
					node.expandable = true;
					view.events.load_tree(r, node);
				},
			});
	
			dialog.hide();
		});
	}
	
	set_default_qty(dialog) {
		dialog.fields_dict.items.grid.fields_map.item_code.onchange = function (event) {
			if (event) {
				let name = $(event.currentTarget).closest(".grid-row").attr("data-name");
				let item_row = dialog.fields_dict.items.grid.grid_rows_by_docname[name].doc;
				item_row.qty = 1;
				dialog.fields_dict.items.grid.refresh();
			}
		};
	}
	
	delete_node(node, view) {
		frappe.confirm(__("Are you sure you want to delete this Item?"), () => {
			frappe.call({
				method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.delete_node",
				args: {
					parent: node.data.parent_id,
					fg_item: node.data.value,
					doctype: node.data.doctype,
					docname: node.data.name,
				},
				callback: (r) => {
					view.events.load_tree(r, node.parent_node);
				},
			});
		});
	}
	
	edit_item(node, view) {
		let item_code = node.data.value; //현재 아이템 코드
		let qty, rate, excluding_vp;
		// let qty = node.data.qty || this.frm.doc.qty;
		// let rate = node.data.rate || this.frm.doc.rate;
		// let excluding_vp = node.data.excluding_vp || this.frm.doc.excluding_vp;

		if (node.data.value === this.frm.doc.item_code) {
            // 루트 아이템의 경우, this.frm.doc의 값을 사용
            qty = this.frm.doc.qty;
            rate = this.frm.doc.rate;
			excluding_vp = this.frm.doc.excluding_vp;
        } else {
			qty = node.data.qty;
			rate = node.data.rate;
			excluding_vp = node.data.excluding_vp;
		}

		// Log initial values before prompt
		// console.log("Initial item data:", { excluding_vp });

		let fields = [
			{ label: __("Item"), fieldname: "item_code", default: item_code, fieldtype: "Link", options: "Item", reqd: 1 },
			{ label: __("Qty"), fieldname: "qty", default: qty, fieldtype: "Float", reqd: 1, precision: 2 },
			{ label: __("Rate"), fieldname: "rate", default: rate, fieldtype: "Float", reqd: 1, precision: 2 },
			{ label: __("Excluding VP calculation"), fieldname: "excluding_vp", default: excluding_vp, fieldtype: "Check" },
			// { label: __("Amount"), fieldname: "amount", fieldtype: "Float", read_only: 1 }
		]

		frappe.prompt(fields, 
			(data) => {
				let doctype = node.data.doctype || this.frm.doc.doctype;
				let docname = node.data.name || this.frm.doc.name;
				let parent_id = node.data.parent_id || this.frm.doc.name;

				// let vp = this.frm.doc.vp;
				// let excluding_vp = data.excluding_vp;
				// let amount = excluding_vp ? flt(data.rate) * flt(data.qty) : flt(data.rate) * flt(data.qty) * vp;

				// amount 필드에 계산된 값을 설정
				// data.amount = amount;

				// 입력된 데이터를 다시 콘솔 로그로 확인
				// console.log("Prompt data:", data);

				// frappe.call의 요청 파라미터를 로그로 출력
				// console.log("frappe.call request args:", {
				// 	item_code: item_code,
				// 	qty: data.qty,
				// 	rate: data.rate,
				// 	parent_id: parent_id
				// });
		
				frappe.call({
					method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.edit_item",
					args: {
						doctype: doctype,
						docname: docname,
						parent: parent_id,
						item_code: data.item_code,
						qty: data.qty,
						rate: data.rate,
						amount: data.amount,
						excluding_vp: data.excluding_vp
					},
					callback: (r) => {
						console.log("edit_item response", r);
						node.data.item_code = data.item_code;
						node.data.qty = data.qty;
						node.data.rate = data.rate;
						node.data.excluding_vp = data.excluding_vp; // node.data에 excluding_vp 저장

						let uom = node.data.uom || this.frm.doc.uom;

						// Update HTML with new values
						$(node.parent.get(0)).find(`[data-qbom-qty-docname='${docname}']`).html(data.qty + " " + uom);
						$(node.parent.get(0)).find(`.item-rate`).html(data.rate);

						// Refresh HTML with new values
						view.events.load_tree(r, node);
					},
				});
			},
				__("Edit Item"),
				__("Update"));
			}

	// edit_docname() {
	// 	let new_docname = node.data.name || this.frm.doc.name;

	// 	// Add Name field only for root items
	// 	fields.unshift({ label: __("Name"), fieldname: "new_docname", default: new_docname, fieldtype: "Data", reqd: 1 });

	// 	frappe.prompt(fields, (data) => {
	// 		let docname = node.data.name || this.frm.doc.name;

	// 		frappe.call({
	// 			method: "clestra_app.clestra_app.doctype.qbom_creator.qbom_creator.edit_item",
	// 			args: {
	// 				doctype: doctype,
	// 				docname: docname,
	// 				new_docname: data.new_docname,
				
	// 			},
	// 			callback: (r) => {
	// 					// Redirect to the new docname if it has been changed
	// 					if (docname != data.new_docname) {
	// 						frappe.set_route("Form", doctype, data.new_docname);
	// 					} else {
	// 						frappe.set_route("Form", doctype, docname);
	// 					} 
	// 				},
	// 			})
	// 	});
	// }

	prepare_layout() {
		let main_div = $(this.page)[0];

		main_div.style.marginBottom = "15px";
		$(main_div).find(".tree-children")[0].style.minHeight = "370px";
		$(main_div).find(".tree-children")[0].style.maxHeight = "370px";
		$(main_div).find(".tree-children")[0].style.overflowY = "auto";
	}

	load_tree(response, node) {
		let item_row = "";
		let parent_dom = "";
		let rate, amount, excluding_vp = "";
		let total_amount = response.message.raw_material_cost;

		frappe.views.trees["QBOM Configurator"].tree.load_children(node);

		while (node) {
			item_row = response.message.items.filter((item) => item.name === node.data.name);
			rate = node.data.rate !== undefined ? node.data.rate : 0;

			if (item_row?.length) {
				node.data.amount = item_row[0].amount;
				amount = node.data.amount;
				rate = node.data.rate; //!== undefined ? node.data.rate : 0;
				excluding_vp = node.data.excluding_vp;
			} else {
				// rate = this.frm.doc.rate;
				// amount = this.frm.doc.amount;
				rate = response.message.rate;
				amount = response.message.amount;
				excluding_vp = response.message.excluding_vp;
			}

			parent_dom = $(node.parent.get(0));

			let formatted_amount = frappe.format(amount, {
				fieldtype: "Currency",
				currency: this.frm.doc.currency,
				precision: 0
			});

			// let formatted_rate = frappe.format(rate, {
			// 	fieldtype: "Currency",
			//    currency: this.frm.doc.currency,
		   	// });

			let formatted_rate = frappe.format(rate, {
				precision: 2 // 소수점 두 자리까지 표시
			});

			// total_amount를 포맷
			let formatted_total_amount = frappe.format(total_amount, {
				fieldtype: "Currency",
				currency: this.frm.doc.currency,
				precision: 0
			});

			$($(parent_dom).find(".fg-item-amt")[0]).html(formatted_amount);
			$($(parent_dom).find(".item-rate")[0]).html(formatted_rate);
			$('.total-amount-display').html(`Total Amount: ${formatted_total_amount}`);

			node = node.parent_node;
		}
	}
}

frappe.ui.QBOMConfigurator = QBOMConfigurator;
// Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
frappe.provide("erpnext.bom");

// ERPNext's bom_creator.js is loaded automatically as the doctype's standard
// JS (via meta._add_code) BEFORE this file (which is loaded via the doctype_js
// hook). Both files register frappe.ui.form.on("BOM Creator", {...}) handlers,
// and frappe chains them — so every event fires twice, creating duplicate
// dialogs (e.g. make_new_entry opening multiple times).
// Clear ERPNext's handlers so only Clestra's complete override runs.
frappe.ui.form.handlers["BOM Creator"] = {};
frappe.ui.form.handlers["BOM Creator Item"] = {};
console.log("[BOM Creator clestra_app] cleared upstream handlers");

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
		} else if (!frm.doc.items?.length && !frm.is_new_entry_prompted) {
			// refresh() can fire multiple times during initial form load — guard
			// against opening the make_new_entry dialog more than once.
			frm.is_new_entry_prompted = true;
			let $parent = $(frm.fields_dict["bom_creator"].wrapper);
			$parent.empty();
			frm.trigger("make_new_entry");
		}
	},

	build_tree(frm) {
		// Bare rebuild — the BOMConfigurator widget always renders in its
		// default collapsed state (only root + immediate children visible).
		// This is what the user expects from the "Rebuild Tree" button.
		// State preservation across server operations (delete / edit_conditions
		// / edit_qty etc. — all of which call the bundle's _bom_reload_tree
		// helper that under the hood calls tree.load_children(root, true)) is
		// handled by _patch_tree_load_children, which wraps that exact call
		// path to capture expansion state then restore it. The Rebuild Tree
		// button bypasses that wrap by going through this build_tree directly.
		return frm.events._create_bom_configurator(frm);
	},

	_create_bom_configurator(frm) {
		// Install the global frappe.call interceptor once so we can track which
		// node was just edited via edit_conditions/edit_values/edit_qty — the
		// drift bundle.js then fires _bom_reload_tree() unconditionally, but
		// we'd rather refresh only the affected node.
		frm.events._install_call_interceptor();

		let $parent = $(frm.fields_dict["bom_creator"].wrapper);
		// Lock min-height to the current height before emptying so the
		// surrounding form layout doesn't collapse and pull the Comments
		// section up into the BOM tree slot during the rebuild.
		const original_height = $parent.outerHeight();
		if (original_height > 0) {
			$parent.css("min-height", original_height + "px");
		}
		$parent.empty();
		frm.toggle_enable("item_code", false);
		return frappe.require("bom_configurator.bundle.js").then(() => {
			frappe.bom_configurator = new frappe.ui.BOMConfigurator({
				wrapper: $parent,
				page: $parent,
				frm: frm,
				bom_configurator: frm.doc.name,
			});
			// Install the load_children wrapper so subsequent reload-tree calls
			// preserve user's expansion context. _wait_for_tree polls until the
			// bundle's async onload → make_tree has produced a root_node, so we
			// don't wait longer than necessary on a warm cache.
			frm.events._wait_for_tree(frm, 2000).then((tree) => {
				if (tree) frm.events._patch_tree_load_children(frm);
				// Release the height lock once the tree has filled the slot.
				if (original_height > 0) {
					$parent.css("min-height", "");
				}
			});
		});
	},

	_install_call_interceptor() {
		if (window._clestra_bom_call_intercepted) return;
		window._clestra_bom_call_intercepted = true;
		const edit_methods = new Set([
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_conditions",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_values",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.edit_qty",
		]);
		const structural_methods = new Set([
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.add_item",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.add_sub_assembly",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.duplicate",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.delete_node",
			"erpnext.manufacturing.doctype.bom_creator.bom_creator.delete_node_origin",
		]);
		const orig = frappe.call.bind(frappe);
		frappe.call = function (...call_args) {
			// frappe.call supports two signatures:
			//   frappe.call({method, args, callback, ...})           (object form)
			//   frappe.call("method.path", args, callback)           (shorthand)
			// Pass everything through untouched; only sniff the object form
			// for our specific target methods (the previous single-arg
			// wrapper dropped the args payload of shorthand callers like
			// base_list.js's `frappe.call("...get_list_settings", {doctype})`
			// which crashed server-side as "missing argument 'doctype'").
			const opts = call_args[0];
			if (opts && typeof opts === "object" && opts.method) {
				if (edit_methods.has(opts.method)) {
					// Targeted single-node refresh path: stash docname + the
					// args we sent (already contains the new field values),
					// so _patch_tree_load_children's wrap redraws just that
					// row's pills without a follow-up server fetch (direct
					// reads on child-table rows trip "not enough permissions"
					// via frappe.client.get since they require a parent context).
					window._clestra_last_edited_docname = (opts.args && opts.args.docname) || null;
					window._clestra_last_edited_args = opts.args || null;
				} else if (structural_methods.has(opts.method)) {
					// Subtree-only refresh path: fg_reference_id identifies
					// the parent whose direct children just changed (add: new
					// child's parent; delete: the deleted node's parent;
					// duplicate: the source/destination parent). The wrap
					// will reload just that subtree via load_children deep on
					// the matching tree node, so unrelated branches and the
					// user's expansion state elsewhere stay untouched.
					window._clestra_last_subtree_parent_ref =
						(opts.args && opts.args.fg_reference_id) || null;
				}
			}
			return orig(...call_args);
		};
	},

	async _wait_for_tree(frm, timeout = 2000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const tree = window.frappe?.bom_configurator?.tree_view?.tree;
			if (tree && tree.root_node) return tree;
			await new Promise((r) => setTimeout(r, 30));
		}
		return null;
	},

	_patch_tree_load_children(frm) {
		const tree = window.frappe?.bom_configurator?.tree_view?.tree;
		if (!tree || tree._clestra_load_children_wrapped) return;
		const original = tree.load_children.bind(tree);
		tree._clestra_original_load_children = original;
		const $widget = $(frm.fields_dict["bom_creator"].wrapper);
		tree.load_children = async function (node, deep) {
			if (deep && node === tree.root_node) {
				// (1) Edit-only refreshes (edit_conditions/edit_values/edit_qty):
				// targeted single-node redraw, no tree teardown.
				const edited_docname = window._clestra_last_edited_docname;
				if (edited_docname) {
					window._clestra_last_edited_docname = null;
					frm.events._refresh_single_node(frm, edited_docname);
					return;
				}
				// (2) Structural changes (add_item / add_sub_assembly /
				// delete / duplicate): always do a full widget rebuild plus
				// expansion-state restore. We tried a subtree-only path
				// keyed off fg_reference_id, but it failed in edge cases
				// (e.g., re-adding under a node that had just been emptied
				// by a delete — render_children_of_all_nodes' parent-node
				// lookup misses when data is empty, leaving the new
				// children un-rendered). Full rebuild is reliable and the
				// visibility:hidden + _expand_to dance hides the
				// intermediate collapsed state so the user only ever sees
				// "old tree → new tree, both expanded the same way".
				window._clestra_last_subtree_parent_ref = null;
				const expanded_names = frm.events._capture_expanded_names();
				$widget.css("visibility", "hidden");
				try {
					await frm.events._create_bom_configurator(frm);
					const new_tree = await frm.events._wait_for_tree(frm, 3000);
					if (new_tree && expanded_names.size > 0) {
						await frm.events._expand_to(frm, expanded_names);
					}
				} finally {
					$widget.css("visibility", "visible");
				}
				return;
			}
			return original(node, deep);
		};
		tree._clestra_load_children_wrapped = true;
	},

	async _refresh_subtree(frm, tree, parent_docname) {
		// Find the tree node whose data.name == parent_docname, then
		// deep-reload its subtree. Returns true if we found and refreshed
		// the node, false if the parent isn't currently in the tree (caller
		// falls back to full rebuild). The deep load on a non-root node
		// passes through to the original implementation (root isn't touched
		// here, so the top-level pill-destruction we have to work around in
		// the wrap's root case doesn't apply).
		if (!tree || !tree.nodes) return false;
		let parent_node = null;
		for (const key in tree.nodes) {
			const n = tree.nodes[key];
			if (n && n.data && n.data.name === parent_docname) {
				parent_node = n;
				break;
			}
		}
		if (!parent_node || parent_node === tree.root_node) return false;
		const original = tree._clestra_original_load_children
			|| tree.load_children.bind(tree);
		await original(parent_node, true);

		// Patch up parent state for the previously-leaf case. If
		// parent_node had no children before this refresh (the bundle's
		// initial render saw is_expandable=0 and made it a leaf TreeNode
		// with expandable=false and a hidden empty $ul), render_node_children
		// fills the $ul with new children but its terminal expand_node
		// call skips the visibility toggle since node.expandable is still
		// false. Without this fix-up the user sees no change in the tree
		// after Add Item / Add Sub Assembly on a previously-childless node.
		if (parent_node.$ul && parent_node.$ul.children().length > 0) {
			parent_node.expandable = true;
			parent_node.expanded = true;
			if (parent_node.data) parent_node.data.expandable = 1;
			parent_node.$ul.show();
			if (parent_node.parent) {
				$(parent_node.parent).addClass("opened");
			}
			if (tree.icon_set && parent_node.$tree_link) {
				const $icon_wrap = parent_node.$tree_link.find(".icon").parent();
				if ($icon_wrap.length) {
					$icon_wrap.html(tree.icon_set.open);
				}
			}
		}

		return true;
	},

	_refresh_single_node(frm, docname) {
		const tree = window.frappe?.bom_configurator?.tree_view?.tree;
		if (!tree || !tree.nodes || !tree.on_render) return;
		let target_node = null;
		for (const key in tree.nodes) {
			const node = tree.nodes[key];
			if (node && node.data && node.data.name === docname) {
				target_node = node;
				break;
			}
		}
		if (!target_node) return;
		// Apply the field updates we sent to the server. Server-side
		// edit_conditions/edit_values/edit_qty persists exactly these values,
		// so the local node.data should match. (Plus syncing the matching
		// row in frm.doc.items keeps form-level save & validation consistent.)
		const args = window._clestra_last_edited_args || {};
		window._clestra_last_edited_args = null;
		const ignore_keys = new Set(["cmd", "doctype", "docname", "parent", "doc"]);
		for (const k in args) {
			if (ignore_keys.has(k)) continue;
			target_node.data[k] = args[k];
		}
		if (frm.doc.items) {
			const row = frm.doc.items.find((r) => r.name === docname);
			if (row) {
				for (const k in args) {
					if (ignore_keys.has(k)) continue;
					row[k] = args[k];
				}
			}
		}
		// Remove the old pills the bundle's onrender inserted before $ul,
		// then redraw them with the fresh data. Both pills are keyed by
		// docname so we target only this node.
		$(`[data-bom-qty-docname="${docname}"]`).closest(".bom-qty-pill").remove();
		$(`[data-bom-conditions-docname="${docname}"]`).remove();
		tree.on_render(target_node);
	},

	async expand_all(frm) {
		// Hide the BOM tree slot for the entire rebuild + recursive load so
		// the user sees the final expanded state appear in one step rather
		// than rebuild → closed → expanding flicker.
		const $parent = $(frm.fields_dict["bom_creator"].wrapper);
		$parent.css("visibility", "hidden");
		try {
			await frm.events._create_bom_configurator(frm);
			const tree = await frm.events._wait_for_tree(frm, 3000);
			if (!tree) return;
			// Recursively load_children at each unloaded internal node. We
			// deliberately AVOID the deep tree.load_children(root, true) path
			// because its render_children_of_all_nodes calls
			// render_node_children(root, top_level_data) which does
			// root.$ul.empty() — this destroys the bundle's freshly-rendered
			// top-level <li>s and their condition pills, and the
			// re-creation that follows somehow doesn't reliably re-fire the
			// pill insertion (top-level conditions go missing). Walking with
			// single-level loads preserves the bundle's initial render of
			// root's children (pills and all) and only expands deeper levels.
			await frm.events._expand_subtree(frm, tree, tree.root_node);
		} finally {
			$parent.css("visibility", "visible");
		}
	},

	async _expand_subtree(frm, tree, node) {
		if (!node || !node.expandable) return;
		// If not yet loaded, a single-level load fetches and renders this
		// node's direct children (firing on_render for each, which inserts
		// pills). load_children also calls expand_node at the end so the
		// $ul becomes visible.
		if (!node.loaded) {
			await tree.load_children(node);
		} else if (!node.expanded && node.$ul) {
			tree.toggle_node(node);
		}
		if (!node.$ul) return;
		const child_links = node.$ul.children("li").children(".tree-link").get();
		for (const link of child_links) {
			const child_node = $(link).data("node");
			if (child_node && child_node.expandable) {
				await frm.events._expand_subtree(frm, tree, child_node);
			}
		}
	},

	_capture_expanded_names() {
		const tree = window.frappe?.bom_configurator?.tree_view?.tree;
		const out = new Set();
		if (!tree || !tree.nodes) return out;
		Object.values(tree.nodes).forEach((node) => {
			if (node && node.expanded && node.data && node.data.name) {
				out.add(node.data.name);
			}
		});
		return out;
	},

	async _expand_all_after_rebuild(frm) {
		const tree = window.frappe?.bom_configurator?.tree_view?.tree;
		if (!tree || !tree.root_node) return;
		await frm.events._walk_and_expand(frm, tree, tree.root_node, () => true);
	},

	async _expand_to(frm, name_set) {
		const tree = window.frappe?.bom_configurator?.tree_view?.tree;
		if (!tree || !tree.root_node) return;
		await frm.events._walk_and_expand(
			frm,
			tree,
			tree.root_node,
			(node) => node === tree.root_node || (node.data && node.data.name && name_set.has(node.data.name)),
		);
	},

	async _walk_and_expand(frm, tree, node, predicate) {
		if (!node || !node.expandable) return;
		if (!predicate(node)) return;
		if (!node.loaded) {
			await tree.load_children(node);
		}
		if (!node.expanded && node.$ul) {
			tree.toggle_node(node);
		}
		if (!node.$ul) return;
		const child_links = node.$ul.children("li").children(".tree-link").get();
		for (const link of child_links) {
			const child_node = $(link).data("node");
			if (child_node) {
				await frm.events._walk_and_expand(frm, tree, child_node, predicate);
			}
		}
	},

	make_new_entry(frm) {
		// Belt-and-suspenders: in addition to the setup_bom_creator-level
		// guard, also block here in case refresh re-enters before the dialog
		// finishes rendering.
		if (window._clestra_bom_new_entry_open) {
			console.log("[BOM Creator make_new_entry] skipped — already open");
			return;
		}
		window._clestra_bom_new_entry_open = true;
		console.log("[BOM Creator make_new_entry] opening dialog");
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
		dialog.onhide = () => {
			window._clestra_bom_new_entry_open = false;
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
		frm.trigger("apply_items_indent_display");
	},

	apply_items_indent_display(frm) {
		// Mirrors PBM's apply_po_items_indent_display: wrap items grid.refresh
		// to paint a ↳ prefix + padding-left on rows where indent_level > 0.
		// Previously lived in public/js/bom_creator_indent.js as an app_include_js
		// handler, but the top-of-file handler clearance
		// (frappe.ui.form.handlers["BOM Creator"] = {}) wiped its refresh
		// registration. Inlining here means it survives the clearance.
		setTimeout(() => {
			const grid = frm.fields_dict["items"]?.grid;
			if (!grid || grid._indent_display_setup) return;

			const original_refresh = grid.refresh.bind(grid);
			grid.refresh = function () {
				original_refresh();
				_apply_bom_creator_indent(grid);
			};
			grid._indent_display_setup = true;
			grid.refresh();
		}, 300);
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

function _apply_bom_creator_indent(grid) {
	// Paint ↳ prefix + padding-left on items grid rows where indent_level > 0.
	// Same approach as PBM's apply_po_items_indent_display.
	if (!grid.grid_rows) return;
	grid.grid_rows.forEach((grid_row) => {
		if (!grid_row.doc) return;
		const level = cint(grid_row.doc.indent_level);
		const $static = $(grid_row.wrapper)
			.find('[data-fieldname="item_code"] .static-area')
			.first();
		if (!$static.length) return;

		$static.find(".bom-indent-prefix").remove();

		if (level > 0) {
			const padding = level * 16;
			const prefix = $(
				'<span class="bom-indent-prefix" style="color: var(--text-muted); margin-right: 4px;">↳</span>'
			);
			$static.css("padding-left", padding + "px").prepend(prefix);
		} else {
			$static.css("padding-left", "");
		}
	});
}

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
# Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class BOMCreatorItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		abl_a: DF.Link | None
		abl_b: DF.Link | None
		amount: DF.Currency
		app_country: DF.Data | None
		astragal: DF.Link | None
		auto_drop_seal: DF.Link | None
		base_amount: DF.Currency
		base_rate: DF.Currency
		base_visible_h: DF.Link | None
		bom_created: DF.Check
		bom_no: DF.Link | None
		ceiling_visible: DF.Link | None
		ch: DF.Link | None
		color: DF.Link | None
		conversion_factor: DF.Float
		depth: DF.Link | None
		description: DF.SmallText | None
		disassembled: DF.Check
		do_not_explode: DF.Check
		door_closer: DF.Link | None
		door_frame: DF.Data | None
		door_open_type: DF.Literal["", "Swing", "Sliding"]
		door_set_type: DF.Literal["", "Single", "Pair"]
		equal_leaf_w: DF.Check
		exclude_fields: DF.Data | None
		fg_item: DF.Link
		fg_reference_id: DF.Data | None
		fgd_info: DF.Link | None
		fix_screw_cap: DF.Link | None
		flush_bolt: DF.Data | None
		for_pair_door: DF.Check
		glass_a: DF.Data | None
		glass_b: DF.Data | None
		handle_direct: DF.Data | None
		hinge: DF.Link | None
		hinge_glass_a: DF.Data | None
		hinge_glass_b: DF.Data | None
		hinge_num: DF.Link | None
		hinge_type: DF.Link | None
		hw_options: DF.Link | None
		indent_level: DF.Int
		instruction: DF.SmallText | None
		is_expandable: DF.Check
		is_panel_cover: DF.Check
		item_code: DF.Link
		item_group: DF.Link | None
		item_name: DF.Data | None
		keeper: DF.Link | None
		keeper_glass_a: DF.Data | None
		keeper_glass_b: DF.Data | None
		key_cylinder: DF.Link | None
		leaf_act_status: DF.Link | None
		leaf_color: DF.Link | None
		leaf_glass_a: DF.Data | None
		leaf_glass_b: DF.Data | None
		leaf_height: DF.Link | None
		leaf_item_code: DF.Link | None
		leaf_material: DF.Data | None
		leaf_thk: DF.Data | None
		leaf_width: DF.Link | None
		open_height: DF.Link | None
		open_width: DF.Link | None
		panel_crh: DF.Link | None
		panel_trh: DF.Link | None
		parent: DF.Data
		parent_row_no: DF.Data | None
		parentfield: DF.Data
		parenttype: DF.Data
		ph: DF.Link | None
		price_study: DF.Link | None
		print_hide: DF.Check
		pw: DF.Link | None
		qty: DF.Float
		qty_custom: DF.Link | None
		qty_prefix: DF.Data | None
		qty_suffix: DF.Data | None
		rate: DF.Currency
		show_qty_bracket: DF.Check
		source_warehouse: DF.Link | None
		sourced_by_supplier: DF.Check
		stock_qty: DF.Float
		stock_uom: DF.Link | None
		sub_contract: DF.Link | None
		tape_seal_color: DF.Link | None
		under_cut: DF.Link | None
		uom: DF.Link | None
		use_billing_color: DF.Check
		use_unit: DF.Check
		width: DF.Link | None
	# end: auto-generated types

	pass

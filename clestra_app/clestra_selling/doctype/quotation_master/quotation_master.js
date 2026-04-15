// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Master", {
    onload: function (frm) {
        if (frm.is_new() && !frm.doc.company) {
            frappe.db.get_value('User', frappe.session.user, 'company')
                .then(r => {
                    if (r && r.message && r.message.company) {
                        frm.set_value('company', r.message.company);
                    }
                });
        }
        if (frm.is_new()) {
            fetch_all_quotation_values(frm);

            // VP Rate 불러오기
            frappe.db.get_list('VP Rate', {
                filters: {
                    'company': frm.doc.company,
                },
                fields: ['rate'],
                order_by: 'creation desc',
                limit: 1
            }).then(res => {
                if (res && res.length > 0) {
                    const vp_kr = res[0].rate;
                    frm.set_value('vp_rate', vp_kr);
                }
            });
        }
    },
    refresh(frm) {
        set_glass_type_filter(frm, 'glass_type_a');
        set_glass_type_filter(frm, 'glass_type_b');
        apply_all_skip_states(frm);
        setup_cost_code_formula_filter(frm);
        setup_formula_hover(frm);
        render_desc_variable_buttons(frm);

    },
    item_code: function (frm) {
        update_vp(frm, 'item_code', 'item_vp');
        load_description_template(frm);
    },
    refresh_vp: function (frm) {
        update_vp(frm, 'item_code', 'item_vp');
    },

    inst_type: function (frm) {
        update_installation_cost(frm);
    },

    total_cost: function (frm) {
        const target_price = frm.doc.total_cost / (1 - frm.doc.mat_margin);
        const target_price_ceil = Math.ceil(target_price / 1000) * 1000;
        frm.set_value('target_price', target_price_ceil);
    },
    target_price: function (frm) {
        const diff = frm.doc.target_price - frm.doc.total_cost;
        frm.set_value('difference', diff);
    },
    difference: function (frm) {
        const margin_calc = frm.doc.target_price ? (frm.doc.difference / frm.doc.target_price) * 100 : 0;
        frm.set_value('margin_rate', margin_calc);
    },

    aa10_formula: function (frm) {
        populate_aa10_item(frm);
        calc_field(frm, 'aa10_formula', 'aa10_result');
    },
    aa10_calc: function (frm) { recalc_all(frm); },
    aa10_skip: function (frm) { handle_skip(frm, 'aa10'); },

    ac40_formula: function (frm) { calc_field(frm, 'ac40_formula', 'ac40_result'); },
    ac40_calc: function (frm) { recalc_all(frm); },
    ac40_skip: function (frm) { handle_skip(frm, 'ac40'); },

    ab20_formula: function (frm) { calc_field(frm, 'ab20_formula', 'ab20_result'); },
    ab20_calc: function (frm) { recalc_all(frm); },
    ab20_skip: function (frm) { handle_skip(frm, 'ab20'); },

    ab44_formula: function (frm) { update_expense_and_calc(frm, "Glass Cleaning Fee", 'ab44_formula', 'ab44_result'); },
    ab44_calc: function (frm) { recalc_all(frm); },
    ab44_skip: function (frm) { handle_skip(frm, 'ab44'); },

    ac33_formula: function (frm) { update_expense_and_calc(frm, "Silicone & Caulking Works", 'ac33_formula', 'ac33_result'); },
    ac33_calc: function (frm) { recalc_all(frm); },
    ac33_skip: function (frm) { handle_skip(frm, 'ac33'); },

    ab30_formula: function (frm) { update_expense_and_calc(frm, "1-Ton Truck Freight", 'ab30_formula', 'ab30_result'); },
    ab30_calc: function (frm) { recalc_all(frm); },
    ab30_skip: function (frm) { handle_skip(frm, 'ab30'); },

    ac34_formula: function (frm) { calc_field(frm, 'ac34_formula', 'ac34_result'); },
    ac34_calc: function (frm) { recalc_all(frm); },
    ac34_skip: function (frm) { handle_skip(frm, 'ac34'); },

    ad43_formula: function (frm) { calc_field(frm, 'ad43_formula', 'ad43_result'); },
    ad43_calc: function (frm) { recalc_all(frm); },
    ad43_skip: function (frm) { handle_skip(frm, 'ad43'); },

    ad41_formula: function (frm) { calc_field(frm, 'ad41_formula', 'ad41_result'); },
    ad41_calc: function (frm) { recalc_all(frm); },
    ad41_skip: function (frm) { handle_skip(frm, 'ad41'); },

    ab52_formula: function (frm) { calc_field(frm, 'ab52_formula', 'ab52_result'); },
    ab52_calc: function (frm) { recalc_all(frm); },
    ab52_skip: function (frm) { handle_skip(frm, 'ab52'); },

    sp1_formula: function (frm) { calc_field(frm, 'sp1_formula', 'sp1_result'); },
    sp1_calc: function (frm) { recalc_all(frm); },
    sp1_skip: function (frm) { handle_skip(frm, 'sp1'); },

    is_tempered: function (frm) {
        frm.set_value('glass_type_a', '');
        set_glass_type_a_filter(frm);
    },

    is_tempered_b: function (frm) {
        frm.set_value('glass_type_b', '');
        set_glass_type_b_filter(frm);
    },

    glass_type_a: function (frm) { fetch_glass_rate(frm, 'glass_type_a', 'glass_thk_a', 'glass_cost_a'); },
    glass_thk_a: function (frm) { fetch_glass_rate(frm, 'glass_type_a', 'glass_thk_a', 'glass_cost_a'); },

    glass_type_b: function (frm) { fetch_glass_rate(frm, 'glass_type_b', 'glass_thk_b', 'glass_cost_b'); },
    glass_thk_b: function (frm) { fetch_glass_rate(frm, 'glass_type_b', 'glass_thk_b', 'glass_cost_b'); },
});

// === Child Table (Clestra Quotation Child) 이벤트 ===
frappe.ui.form.on("Clestra Quotation Child", {
    variable: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        let is_vp = row.variable && row.variable.endsWith('_vp');
        frappe.model.set_value(cdt, cdn, 'use_vp', is_vp ? 1 : 0);

        if (is_vp && (row.item_code || frm.doc.item_code)) {
            fetch_row_vp(frm, cdt, cdn);
        }
    },
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.use_vp && row.item_code) {
            fetch_row_vp(frm, cdt, cdn);
        }
    },
    ch: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.use_vp && (row.item_code || frm.doc.item_code)) {
            fetch_row_vp(frm, cdt, cdn);
        }
    },
    width: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.use_vp && (row.item_code || frm.doc.item_code)) {
            fetch_row_vp(frm, cdt, cdn);
        }
    }
});

// === Child Table (Quotation Cost Code Item) 이벤트 ===
const COST_CODE_LABELS = {
    'AA10': 'Factory',
    'AC40': 'Glass',
    'AB20': 'Install',
    'AB44': 'Cleaning',
    'AC33': 'Caulking',
    'AB30': 'Transp.',
    'AC34': 'HW',
    'AD43': 'Waste',
    'AD41': 'Contingency',
    'AB52': 'PM',
    'SP1':  'Royalty',
    'AC35': 'Coverings / 3M Film',
    'AD37': 'Timber Doors & Filler Piece',
    'AC36': 'Blinds',
    'AD71': 'Ductwork & Piping'
};

frappe.ui.form.on("Quotation Cost Code Item", {
    formula: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.formula) {
            frappe.model.set_value(cdt, cdn, 'result', 0);
            return;
        }
        calc_cost_code_row(frm, cdt, cdn);
    },
    cost_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        frappe.model.set_value(cdt, cdn, 'label', COST_CODE_LABELS[row.cost_code] || '');
        setup_cost_code_formula_filter(frm);
    }
});

// ─── VP 관련 ───

function fetch_row_vp(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let item_code = row.item_code || frm.doc.item_code;
    let height = row.ch || frm.doc.ch;
    let width = row.width || frm.doc.width;

    if (!item_code) return;

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.get_vp",
        args: {
            item_code: item_code,
            height: height,
            width: width
        },
        callback: function (r) {
            if (r.message && r.message.price) {
                frappe.model.set_value(cdt, cdn, 'value', r.message.price);
            }
        }
    });
}

function update_vp(frm, item_field, target_field) {
    const item_code = frm.doc[item_field];

    if (!item_code) {
        frm.set_value(target_field, 0);
        frm.set_df_property(target_field, 'description', '');
        return;
    }

    const section = frm.doc.product_section;
    const vp_width = section === "Panel" ? (frm.doc.is_pc ? frm.doc.pc_uw : frm.doc.pw)
        : section === "Door" ? frm.doc.unit_width
        : frm.doc.width;

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.get_vp",
        args: {
            item_code: item_code,
            height: frm.doc.ch,
            width: vp_width
        },
        callback: function (r) {
            if (r.message) {
                frm.set_value(target_field, r.message.price || 0);

                if (r.message.reason) {
                    const msg = `<span style="color:orange; font-weight:bold;">⚠️ ${r.message.reason}</span>`;
                    frm.set_df_property(target_field, 'description', msg);
                } else {
                    frm.set_df_property(target_field, 'description', '');
                }
            }
        }
    });
}

// ─── Formula / Skip 관련 ───

function set_missing_message(frm, formula_field, missing_vars) {
    let detail_field = formula_field.split('_')[0] + '_formula_detail';
    let target_field = frm.fields_dict[detail_field] ? detail_field : formula_field.split('_')[0] + '_formula';

    if (!frm.fields_dict[target_field]) return;

    if (missing_vars && missing_vars.length > 0) {
        const msg = `<span style="color:red; font-weight:bold;">⚠️ Missing Variables: ${missing_vars.join(', ')}</span>`;
        frm.set_df_property(target_field, 'description', msg);
    } else {
        frm.set_df_property(target_field, 'description', '');
    }
}

const SKIP_CODES = ['aa10', 'ac40', 'ab20', 'ab44', 'ac33', 'ab30', 'ac34', 'ad43', 'ad41', 'ab52', 'sp1'];

function handle_skip(frm, code) {
    const is_skipped = frm.doc[code + '_skip'];
    apply_skip_state(frm, code, is_skipped);
    if (is_skipped) {
        frm.set_value(code + '_result', 0);
        set_missing_message(frm, code + '_formula', []);
        sum_fields(frm);
    }
}

function apply_skip_state(frm, code, is_skipped) {
    frm.set_df_property(code + '_formula', 'read_only', is_skipped ? 1 : 0);
    frm.refresh_field(code + '_formula');
}

function apply_all_skip_states(frm) {
    SKIP_CODES.forEach(code => {
        apply_skip_state(frm, code, frm.doc[code + '_skip']);
    });
}

function get_skipped_result_fields(frm) {
    let skipped = [];
    SKIP_CODES.forEach(code => {
        if (frm.doc[code + '_skip']) {
            skipped.push(code + '_result');
        }
    });
    return skipped;
}

function calc_field(frm, formula_field, target_field) {
    const formula_name = frm.doc[formula_field];
    if (!formula_name) {
        frm.set_value(target_field, 0);
        set_missing_message(frm, formula_field, []);
        sum_fields(frm);
        return;
    }

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.calculate_cost",
        args: {
            field: target_field,
            formula_name: formula_name,
            doc: frm.doc,
            skip_fields: get_skipped_result_fields(frm)
        },
        callback: function (r) {
            if (r.message && typeof r.message === 'object' && r.message.status) {
                if (r.message.status === 'success') {
                    frm.set_value(target_field, r.message.result || 0);
                    set_missing_message(frm, formula_field, []);
                    sum_fields(frm);
                } else if (r.message.status === 'missing_vars') {
                    set_missing_message(frm, formula_field, r.message.missing_vars);
                }
            } else if (r.message !== undefined) {
                frm.set_value(target_field, r.message);
                set_missing_message(frm, formula_field, []);
                sum_fields(frm);
            }
        }
    });
}

function update_expense_and_calc(frm, expense_item_name, formula_field, target_field) {
    if (!frm.doc[formula_field]) {
        frm.set_value(target_field, 0);
        sum_fields(frm);
        return;
    }

    frappe.db.get_value('Estimate Direct Cost',
        { 'expense_item': expense_item_name },
        'rate',
        (r) => {
            frm.doc.expense_rate = r ? flt(r.rate) : 0;
            calc_field(frm, formula_field, target_field);
        }
    );
}

function sum_fields(frm) {
    let total = 0;
    const fields_to_sum = [
        'aa10_result', 'ab20_result', 'ab30_result', 'ab44_result',
        'ac33_result', 'ac34_result', 'ac40_result', 'ad41_result', 'ad43_result',
        'ab52_result', 'sp1_result'
    ];

    fields_to_sum.forEach(field => {
        total += flt(frm.doc[field]);
    });

    // cost_code_items child table의 result도 합산
    (frm.doc.cost_code_items || []).forEach(row => {
        total += flt(row.result);
    });

    frm.set_value('total_cost', total);
}

// ─── Expense Item 매핑 + Recalc ───

const EXPENSE_ITEM_MAP = {
    'ab44': 'Glass Cleaning Fee',
    'ac33': 'Silicone & Caulking Works',
    'ab30': '1-Ton Truck Freight',
};

function recalc_all(frm) {
    SKIP_CODES.forEach(code => {
        if (frm.doc[code + '_skip']) return;

        const formula_field = code + '_formula';
        const result_field = code + '_result';

        if (EXPENSE_ITEM_MAP[code]) {
            update_expense_and_calc(frm, EXPENSE_ITEM_MAP[code], formula_field, result_field);
        } else {
            calc_field(frm, formula_field, result_field);
        }
    });

    // cost_code_items도 재계산
    recalc_all_cost_code_rows(frm);

    frappe.show_alert({
        message: __('All formulas have been recalculated.'),
        indicator: 'green'
    }, 3);
}

// ─── 초기값 로드 ───

function fetch_all_quotation_values(frm) {
    const field_map = {
        'Material Margin': 'mat_margin',
        'Material Rate': 'mat_rate',
        'Glass Rate': 'glass_rate',
        'Installation Rate': 'inst_rate',
        'Other Rate': 'other_rate',
        'Buffer Rate': 'buffer_rate',
        'PM Reserve Rate': 'pm_reserve_rate',
        'CH': 'ch',
        'LH': 'lh',
        'Standard CH': 'stnd_ch',
        'Width': 'width',
        'Royalty Rate': 'royalty_rate',
    };

    const categories = Object.keys(field_map);

    frappe.db.get_list('Quotation Value Settings', {
        filters: { 'category': ['in', categories] },
        fields: ['category', 'value'],
        order_by: 'creation desc',
    }).then(results => {
        if (results && results.length > 0) {
            results.forEach(row => {
                const target_field = field_map[row.category];
                if (target_field) {
                    frm.set_value(target_field, row.value);
                }
            });
        }
    });
}

// ─── 설치비 ───

function update_installation_cost(frm) {
    if (!frm.doc.item_code || !frm.doc.inst_type) {
        frm.set_value('inst_cost', 0);
        return;
    }

    const type_mapping = {
        'Metro - New Installation': 'metro_new_inst',
        'Metro - Dismantle': 'metro_dismantle',
        'Metro - Reinstallation': 'metro_reinst',
        'Regional - New Installation': 'reg_new_inst',
        'Regional - Dismantle': 'reg_dismantle',
        'Regional - Reinstallation': 'reg_reinst'
    };

    const target_column = type_mapping[frm.doc.inst_type];

    if (!target_column) {
        frappe.msgprint(__('정의되지 않은 설치 타입입니다.'));
        return;
    }

    const search_item = frm.doc.item_code;
    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.get_installation_cost",
        args: {
            item_code: search_item,
            field: target_column
        },
        callback: function (r) {
            if (r.message) {
                frm.set_value('inst_cost', r.message);
            } else {
                frm.set_value('inst_cost', 0);
            }
        }
    });
}

// ─── AA10 Item 자동 생성 ───

function populate_aa10_item(frm) {
    const formula_name = frm.doc.aa10_formula;
    if (!formula_name) {
        frm.clear_table('aa10_item');
        frm.refresh_field('aa10_item');
        return;
    }

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.get_formula_variables",
        args: { formula_name: formula_name },
        callback: function (r) {
            if (!r.message) return;

            const needed_vars = r.message;
            let current_rows = frm.doc.aa10_item || [];
            let seen_vars = new Set();
            let to_remove = [];

            current_rows.forEach(row => {
                const v = (row.variable || "").trim();
                if (v && needed_vars.includes(v) && !seen_vars.has(v)) {
                    seen_vars.add(v);
                } else {
                    to_remove.push(row.row_id || row.name);
                }
            });

            to_remove.forEach(id_or_name => {
                const grid = frm.get_field('aa10_item').grid;
                if (grid.grid_rows_by_docname[id_or_name]) {
                    grid.grid_rows_by_docname[id_or_name].remove();
                }
            });

            const variable_defaults = {
                'pc_cut_out': { item_code: 'OPT-054', use_vp: 1 },
                'door_closer_cutout': { item_code: 'OPT-019', use_vp: 1 },
                'reinforcement': { item_code: 'OPT-064', use_vp: 1 },
                'extend_strip': { item_code: 'OPT-098', use_vp: 1 },
                'spacer': { item_code: 'S-AC-011', use_vp: 1 },
                'FGD_sticking': { item_code: 'OPT-083', use_vp: 1 },
                'C2SG_sticking': { item_code: 'OPT-078', use_vp: 1 },
                'MDF_FGD_reinf': { item_code: 'P-ET-161', use_vp: 1 },
                'MDF_FGD_reinf_cutout': { item_code: 'P-ET-219', use_vp: 1 },
                'MDF_FGD_rock_wool': { use_vp: 1, value: 122 },
            };

            needed_vars.forEach(v => {
                if (!seen_vars.has(v)) {
                    let row = frm.add_child('aa10_item');
                    row.variable = v;
                    const defaults = variable_defaults[v];
                    if (defaults) {
                        if (defaults.item_code) row.item_code = defaults.item_code;
                        row.use_vp = defaults.use_vp;
                        row.value = defaults.value || 0;
                    } else {
                        row.use_vp = v.endsWith('_vp') ? 1 : 0;
                        row.value = 0;
                    }
                }
            });

            frm.refresh_field('aa10_item');
        }
    });
}

// ─── 유리 필터 / 단가 ───

function set_glass_type_filter(frm, fld_name) {
    frm.set_query(fld_name, function () {
        let operator = frm.doc.is_tempered_a ? "like" : "not like";
        return {
            filters: [
                ["Selection Library", "opt_name", "=", "Glass Type"],
                ["Selection Library", "opt_value", operator, "%Tempered%"]
            ]
        };
    });
}

function fetch_glass_rate(frm, type_fld, thk_fld, target_fld) {
    const glass_type = frm.doc[type_fld];
    const thk = frm.doc[thk_fld];

    if (glass_type && thk) {
        frappe.db.get_value('Estimate Glass Costing',
            { 'glass_type': glass_type, 'thk': thk },
            'rate',
            (r) => {
                if (r && r.rate !== undefined) {
                    frm.set_value(target_fld, r.rate);
                } else {
                    frm.set_value(target_fld, 0);
                }
            }
        );
    } else {
        frm.set_value(target_fld, 0);
    }
}

// ─── Description Template ───

function load_description_template(frm) {
    const section = frm.doc.product_section;
    if (!section || frm.doc.quotation_desc) return;

    const category = 'Description - ' + section;
    frappe.db.get_value('Quotation Value Settings',
        { 'category': category, 'is_active': 1 },
        'description_template',
        (r) => {
            if (r && r.description_template) {
                frm.set_value('quotation_desc', r.description_template);
            }
        }
    );
}

// ─── Description Variable Buttons ───

const DESC_VARIABLES = [
    { label: 'Item Code', var: 'item_code' },
    { label: 'Item Name', var: 'item_name' },
    { label: 'CH', var: 'ch' },
    { label: 'Width', var: 'width' },
    { label: 'Qty', var: 'qty' },
    { label: 'Rate', var: 'rate' },
    { label: 'Glass Type A', var: 'glass_type_a' },
    { label: 'Glass Thk A', var: 'glass_thk_a' },
    { label: 'Glass Type B', var: 'glass_type_b' },
    { label: 'Glass Thk B', var: 'glass_thk_b' },
];

function render_desc_variable_buttons(frm) {
    const wrapper = frm.fields_dict.desc_variables_html;
    if (!wrapper) return;

    const buttons_html = DESC_VARIABLES.map(v =>
        `<button class="btn btn-xs btn-default desc-var-btn" data-var="${v.var}" style="margin:2px;">${v.label}</button>`
    ).join(' ');

    wrapper.$wrapper.html(`
        <div style="margin-bottom:8px;">
            <label class="control-label" style="font-size:11px; color:#888;">Click to insert variable</label>
            <div>${buttons_html}</div>
        </div>
    `);

    wrapper.$wrapper.find('.desc-var-btn').on('click', function () {
        const var_tag = `{${$(this).data('var')}}`;
        const ctrl = frm.fields_dict.quotation_desc;
        if (!ctrl || !ctrl.quill) return;

        const quill = ctrl.quill;
        const selection = quill.getSelection(true);
        const index = selection ? selection.index : quill.getLength();
        quill.insertText(index, var_tag);
        quill.setSelection(index + var_tag.length);
    });
}

// ─── Cost Code Child Table ───

function calc_cost_code_row(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    const code = (row.cost_code || '').toLowerCase();
    const expense_item = EXPENSE_ITEM_MAP[code];

    if (expense_item) {
        frappe.db.get_value('Estimate Direct Cost',
            { 'expense_item': expense_item },
            'rate',
            (r) => {
                frm.doc.expense_rate = r ? flt(r.rate) : 0;
                _calc_cost_code_row(frm, cdt, cdn);
            }
        );
    } else {
        _calc_cost_code_row(frm, cdt, cdn);
    }
}

function _calc_cost_code_row(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_master.quotation_master.calculate_cost",
        args: {
            field: row.cost_code + '_result',
            formula_name: row.formula,
            doc: frm.doc,
            skip_fields: get_skipped_result_fields(frm)
        },
        callback: function (r) {
            if (r.message && r.message.status === 'success') {
                frappe.model.set_value(cdt, cdn, 'result', r.message.result || 0);
                sum_fields(frm);
            } else if (r.message && r.message.status === 'missing_vars') {
                frappe.show_alert({
                    message: __(`${row.cost_code}: Missing variables - ${r.message.missing_vars.join(', ')}`),
                    indicator: 'orange'
                }, 5);
            }
        }
    });
}

function recalc_all_cost_code_rows(frm) {
    (frm.doc.cost_code_items || []).forEach(row => {
        if (row.formula) {
            calc_cost_code_row(frm, row.doctype, row.name);
        }
    });
}

function setup_cost_code_formula_filter(frm) {
    frm.set_query('formula', 'cost_code_items', function (doc, cdt, cdn) {
        let row = locals[cdt][cdn];
        let code = row.cost_code || '';
        return {
            filters: [
                ["Formula Library", "category", "=", "Quotation"],
                ["Formula Library", "formula_name", "like", `%${code}%`]
            ]
        };
    });
}

// Grid Recalculate 버튼 + Formula Hover Tooltip
function setup_formula_hover(frm) {
    if (!frm.fields_dict.cost_code_items) return;
    const grid = frm.fields_dict.cost_code_items.grid;

    // Recalculate 버튼 (중복 추가 방지)
    if (!grid.wrapper.find('.btn-recalc-cost-codes').length) {
        grid.add_custom_button(__('Recalculate'), function () {
            recalc_all_cost_code_rows(frm);
            frappe.show_alert({ message: __('Cost Code items recalculated.'), indicator: 'green' }, 3);
        }, 'btn-recalc-cost-codes');
    }

    // 단일 tooltip div
    if (!$('#formula-hover-tip').length) {
        $('body').append(`<div id="formula-hover-tip" style="
            display:none; position:fixed; z-index:1060;
            background:#222; color:#eee; padding:8px 12px;
            border-radius:6px; font-size:12px; max-width:500px;
            white-space:pre-wrap; font-family:monospace;
            box-shadow:0 2px 8px rgba(0,0,0,.3); pointer-events:none;
        "></div>`);
    }

    const $tip = $('#formula-hover-tip');
    let hover_row_name = null;

    $(grid.wrapper).off('mouseenter.formula_hover mouseleave.formula_hover');

    $(grid.wrapper).on('mouseenter.formula_hover', '.rows .col[data-fieldname="formula"]', function () {
        const $col = $(this);
        const row_name = $col.closest('.grid-row').attr('data-name');
        if (!row_name) return;

        const row = (frm.doc.cost_code_items || []).find(r => r.name === row_name);
        if (!row || !row.formula) return;

        hover_row_name = row_name;

        frappe.db.get_value('Formula Library', row.formula, 'formula', (r) => {
            if (hover_row_name !== row_name) return;
            if (!r || !r.formula) return;

            const rect = $col[0].getBoundingClientRect();
            $tip.text(r.formula).show();

            requestAnimationFrame(() => {
                if (hover_row_name !== row_name) { $tip.hide(); return; }
                $tip.css({
                    top: rect.top - $tip.outerHeight() - 8,
                    left: rect.left + (rect.width / 2) - ($tip.outerWidth() / 2),
                });
            });
        });
    });

    $(grid.wrapper).on('mouseleave.formula_hover', '.rows .col[data-fieldname="formula"]', function () {
        hover_row_name = null;
        $tip.hide();
    });
}

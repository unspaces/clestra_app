// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Pricing", {
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
                order_by: 'creation desc', // 생성일 역순 (최신순)
                limit: 1 // 1개만 가져옴
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
        sum_fields(frm);
    },
    item_code: function (frm) {
        update_vp(frm, 'item_code', 'item_vp');
        update_installation_cost(frm);
    },

    total_cost: function (frm) {
        const target_price = frm.doc.total_cost / (1 - frm.doc.mat_margin);
        // 1,000원 단위 올림 계산
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
    aa10_calc: function (frm) { calc_field(frm, 'aa10_formula', 'aa10_result'); },

    ab20_formula: function (frm) { calc_field(frm, 'ab20_formula', 'ab20_result'); },
    ab20_calc: function (frm) { calc_field(frm, 'ab20_formula', 'ab20_result'); },

    ac40_formula: function (frm) { calc_field(frm, 'ac40_formula', 'ac40_result'); },
    ac40_calc: function (frm) { calc_field(frm, 'ac40_formula', 'ac40_result'); },

    ab44_formula: function (frm) { update_expense_and_calc(frm, "Glass Cleaning Fee", 'ab44_formula', 'ab44_result'); },
    ab44_calc: function (frm) { update_expense_and_calc(frm, "Glass Cleaning Fee", 'ab44_formula', 'ab44_result'); },

    ac33_formula: function (frm) { update_expense_and_calc(frm, "Silicone & Caulking Works", 'ac33_formula', 'ac33_result'); },
    ac33_calc: function (frm) { update_expense_and_calc(frm, "Silicone & Caulking Works", 'ac33_formula', 'ac33_result'); },

    ab30_formula: function (frm) { update_expense_and_calc(frm, "1-Ton Truck Freight", 'ab30_formula', 'ab30_result'); },
    ab30_calc: function (frm) { update_expense_and_calc(frm, "1-Ton Truck Freight", 'ab30_formula', 'ab30_result'); },

    ac34_formula: function (frm) { calc_field(frm, 'ac34_formula', 'ac34_result'); },
    ac34_calc: function (frm) { calc_field(frm, 'ac34_formula', 'ac34_result'); },

    ad43_formula: function (frm) { calc_field(frm, 'ad43_formula', 'ad43_result'); },
    ad43_calc: function (frm) { calc_field(frm, 'ad43_formula', 'ad43_result'); },

    ad41_formula: function (frm) { calc_field(frm, 'ad41_formula', 'ad41_result'); },
    ad41_calc: function (frm) { calc_field(frm, 'ad41_formula', 'ad41_result'); },

    ab52_formula: function (frm) { calc_field(frm, 'ab52_formula', 'ab52_result'); },
    ab52_calc: function (frm) { calc_field(frm, 'ab52_formula', 'ab52_result'); },

    sp1_formula: function (frm) { calc_field(frm, 'sp1_formula', 'sp1_result'); },
    sp1_calc: function (frm) { calc_field(frm, 'sp1_formula', 'sp1_result'); },

    inst_type: function (frm) { update_installation_cost(frm); },

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

    // --- 유리 B 세트 트리거 ---
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

function fetch_row_vp(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let item_code = row.item_code || frm.doc.item_code;
    let height = row.ch || frm.doc.ch;
    let width = row.width || frm.doc.width;

    if (!item_code) return;

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_pricing.quotation_pricing.get_vp",
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
        return;
    }

    frappe.call({
        // .get_vp 로 변경된 부분 확인
        method: "clestra_app.clestra_selling.doctype.quotation_pricing.quotation_pricing.get_vp",
        args: {
            item_code: item_code,
            height: frm.doc.ch,
            width: frm.doc.width
        },
        callback: function (r) {
            if (r.message) {
                frm.set_value(target_field, r.message.price || 0);
            }
        }
    });
}

function set_missing_message(frm, formula_field, missing_vars) {
    // formula_field 예: 'ac40_formula' 또는 'ac40_calc'
    let detail_field = formula_field.split('_')[0] + '_formula_detail';
    let target_field = frm.fields_dict[detail_field] ? detail_field : formula_field.split('_')[0] + '_formula';

    // Check if the corresponding field really exists on the form
    if (!frm.fields_dict[target_field]) return;

    if (missing_vars && missing_vars.length > 0) {
        const msg = `<span style="color:red; font-weight:bold;">⚠️ Missing Variables: ${missing_vars.join(', ')}</span>`;
        frm.set_df_property(target_field, 'description', msg);
    } else {
        frm.set_df_property(target_field, 'description', '');
    }
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
        method: "clestra_app.clestra_selling.doctype.quotation_pricing.quotation_pricing.calculate_cost",
        args: {
            field: target_field,
            formula_name: formula_name,
            doc: frm.doc
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
    // 수식이 비어있으면 0으로 초기화 후 리턴
    if (!frm.doc[formula_field]) {
        frm.set_value(target_field, 0);
        sum_fields(frm);
        return;
    }

    // 1. Estimate Direct Cost Doctype에서 단가(rate) 가져오기
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

    frm.set_value('total_cost', total);
}

function fetch_all_quotation_values(frm) {
    // 1. [카테고리명 : 타겟필드명] 매핑 정보 정의
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
        'Royalty Rate': 'royalty_rate'
    };

    // 2. 카테고리 이름들만 추출 (['Material Margin', 'Material Rate', ...])
    const categories = Object.keys(field_map);

    // 3. 단 한 번의 호출로 모든 값 가져오기
    frappe.db.get_list('Quotation Value Settings', {
        filters: { 'category': ['in', categories] },
        fields: ['category', 'value'],
        order_by: 'creation desc',
        // 'is_active': 1, // 활성화된 것만
        // 'is_default': 1 // 그중에서도 기본값인 것만
    }).then(results => {
        if (results && results.length > 0) {
            // 결과 데이터를 순회하며 해당하는 필드에 값 입력
            results.forEach(row => {
                const target_field = field_map[row.category];
                if (target_field) {
                    frm.set_value(target_field, row.value);
                }
            });
        }
    });
}

function update_installation_cost(frm) {
    // 1. 필수 값(아이템 코드, 설치 타입) 확인
    if (!frm.doc.item_code || !frm.doc.inst_type) {
        frm.set_value('inst_cost', 0);
        return;
    }

    // 2. 설치 타입 레이블과 "Estimate Installation Cost" 필드명 매핑
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

    // 3. Estimate Installation Cost 문서에서 매칭되는 아이템의 단가 가져오기
    frappe.db.get_value('Estimate Installation Cost',
        { 'item_code': frm.doc.item_code },
        target_column,
        (r) => {
            if (r && r[target_column] !== undefined) {
                // 가져온 값을 inst_cost 필드에 설정
                frm.set_value('inst_cost', r[target_column]);
            } else {
                // 해당 아이템에 대한 설정 데이터가 없을 경우
                frm.set_value('inst_cost', 0);
                console.log("No installation cost found for item: " + frm.doc.item_code);
            }
        }
    );
}

function populate_aa10_item(frm) {
    const formula_name = frm.doc.aa10_formula;
    if (!formula_name) {
        frm.clear_table('aa10_item');
        frm.refresh_field('aa10_item');
        return;
    }

    frappe.call({
        method: "clestra_app.clestra_selling.doctype.quotation_pricing.quotation_pricing.get_formula_variables",
        args: { formula_name: formula_name },
        callback: function (r) {
            if (!r.message) return;

            const needed_vars = r.message;
            let current_rows = frm.doc.aa10_item || [];
            let seen_vars = new Set();
            let to_remove = [];

            // 1. Identify which rows to keep and stay consistent with variable list
            current_rows.forEach(row => {
                const v = (row.variable || "").trim();
                if (v && needed_vars.includes(v) && !seen_vars.has(v)) {
                    seen_vars.add(v);
                } else {
                    to_remove.push(row.row_id || row.name);
                }
            });

            // 2. Remove invalid or duplicate rows
            to_remove.forEach(id_or_name => {
                const grid = frm.get_field('aa10_item').grid;
                if (grid.grid_rows_by_docname[id_or_name]) {
                    grid.grid_rows_by_docname[id_or_name].remove();
                }
            });

            // 3. Add missing variables
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

function set_glass_type_filter(frm, fld_name) {
    frm.set_query(fld_name, function () {
        // 체크박스 상태에 따라 'like'와 'not like'를 결정합니다.
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

    // 두 값이 모두 있을 때만 실행
    if (glass_type && thk) {
        frappe.db.get_value('Estimate Glass Costing',
            {
                'glass_type': glass_type,
                'thk': thk
            },
            'rate',
            (r) => {
                if (r && r.rate !== undefined) {
                    frm.set_value(target_fld, r.rate);
                } else {
                    // 일치하는 데이터가 없는 경우 0으로 세팅
                    frm.set_value(target_fld, 0);
                    console.log(`No rate found for ${glass_type} / ${thk}`);
                }
            }
        );
    } else {
        // 입력값이 하나라도 비면 단가를 0으로 초기화
        frm.set_value(target_fld, 0);
    }
}


// Copyright (c) 2026, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Pricing", {
    onload: function(frm) {
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
				fields: ['value'],
				order_by: 'creation desc', // 생성일 역순 (최신순)
				limit: 1 // 1개만 가져옴
			}).then(res => {
				if (res && res.length > 0) {
					const vp_kr = res[0].value;
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
    item_code: function(frm) {
        update_vp(frm, 'item_code', 'item_vp');
        update_installation_cost(frm);
    },
    clch_item_code: function(frm) {update_vp(frm, 'clch_item_code', 'clch_vp');},
    base_item_code: function (frm) {update_vp(frm, 'base_item_code', 'base_vp');},
    joint_item_code: function (frm) {update_vp(frm, 'joint_item_code', 'joint_vp');},
    leveler_item_code: function (frm) {update_vp(frm, 'leveler_item_code', 'leveler_vp');},

    total_cost: function(frm) {
        const target_price = frm.doc.total_cost / (1 -frm.doc.mat_margin);
        // 1,000원 단위 올림 계산
        const target_price_ceil = Math.ceil(target_price/1000)*1000;
        frm.set_value('target_price', target_price_ceil);
    },
    target_price: function(frm) {
        const diff = frm.doc.target_price - frm.doc.total_cost;
        frm.set_value('difference', diff);
    },
    difference: function(frm) {
        const margin_calc = frm.doc.target_price ? (frm.doc.difference / frm.doc.target_price) * 100 : 0;
        frm.set_value('margin_rate', margin_calc);
    },

    aa10_formula: function(frm) {calc_field(frm, 'aa10_formula', 'aa10_result');},
    ab20_formula: function(frm) {calc_field(frm, 'ab20_formula', 'ab20_result');},
    ac40_formula: function(frm) {calc_field(frm, 'ac40_formula', 'ac40_result');},
    ab44_formula: function(frm) {update_expense_and_calc(frm, "Glass Cleaning Fee", 'ab44_formula', 'ab44_result');},
    ac33_formula: function(frm) {update_expense_and_calc(frm, "Silicone & Caulking Works", 'ac33_formula', 'ac33_result');},
    ab30_formula: function(frm) {update_expense_and_calc(frm, "1-Ton Truck Freight", 'ab30_formula', 'ab30_result');},
    ad43_formula: function(frm) {calc_field(frm, 'ad43_formula', 'ad43_result');},
    ad41_formula: function(frm) {calc_field(frm, 'ad41_formula', 'ad41_result');},
    ab52_formula: function(frm) {calc_field(frm, 'ab52_formula', 'ab52_result');},
    sp1_formula: function(frm) {calc_field(frm, 'sp1_formula', 'sp1_result');},

    inst_type: function(frm) {update_installation_cost(frm);},

    is_tempered: function(frm) {
        frm.set_value('glass_type_a', '');
        set_glass_type_a_filter(frm);
    },

    is_tempered_b: function(frm) {
        frm.set_value('glass_type_b', '');
        set_glass_type_b_filter(frm);
    },

    glass_type_a: function(frm) {fetch_glass_rate(frm, 'glass_type_a', 'glass_thk_a', 'glass_cost_a');},
    glass_thk_a: function(frm) {fetch_glass_rate(frm, 'glass_type_a', 'glass_thk_a', 'glass_cost_a');},

    // --- 유리 B 세트 트리거 ---
    glass_type_b: function(frm) {fetch_glass_rate(frm, 'glass_type_b', 'glass_thk_b', 'glass_cost_b');},
    glass_thk_b: function(frm) {fetch_glass_rate(frm, 'glass_type_b', 'glass_thk_b', 'glass_cost_b');},
});

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

function calc_field(frm, formula_field, target_field) {
    const formula_name = frm.doc[formula_field];
    if (!formula_name) {
        frm.set_value(target_field, 0);
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
            if (r.message !== undefined) {
                frm.set_value(target_field, r.message);
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

function sum_fields (frm) {
    let total = 0;
    const fields_to_sum = [
        'aa10_result', 'ab20_result', 'ab30_result', 'ab44_result',
        'ac33_result', 'ac40_result', 'ad41_result', 'ad43_result',
        'ab52_result', 'sp1_result'
    ];

    fields_to_sum.forEach(field => {
        total += frm.doc[field];
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
        'CH': 'ch',
        'Width': 'width'
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

function set_glass_type_filter(frm, fld_name) {
    frm.set_query(fld_name, function() {
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


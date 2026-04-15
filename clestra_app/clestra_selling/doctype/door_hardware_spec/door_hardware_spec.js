// Copyright (c) 2025, Se Yong EOM and contributors
// For license information, please see license.txt

// ── 공통: Template 값 로드 (콜백 방식) ──
function _dhs_load_template(tpl_name, set_value_fn, on_done) {
    if (!tpl_name) return;

    var skip_fields = [
        "name", "owner", "creation", "modified", "modified_by",
        "docstatus", "idx", "doctype",
        "is_template", "template_name", "load_from_template",
        "project", "project_name", "hw_spec_code"
    ];
    var layout_types = ["Section Break", "Column Break", "Heading", "Tab Break"];

    frappe.call({
        method: "frappe.client.get",
        args: { doctype: "Door Hardware Spec", name: tpl_name },
        callback: function(r) {
            if (!r.message) return;
            var tpl = r.message;

            var meta = frappe.get_meta("Door Hardware Spec");
            meta.fields.forEach(function(df) {
                if (skip_fields.includes(df.fieldname)) return;
                if (layout_types.includes(df.fieldtype)) return;
                if (tpl[df.fieldname] != null && tpl[df.fieldname] !== "") {
                    set_value_fn(df.fieldname, tpl[df.fieldname]);
                }
            });

            frappe.show_alert({
                message: __("Template '{0}' loaded", [tpl_name]),
                indicator: "green"
            });

            if (on_done) on_done();
        }
    });
}

// ── Form 이벤트 ──
frappe.ui.form.on("Door Hardware Spec", {
    refresh: function(frm) {
        toggle_project_reqd(frm);
        setup_template_filter(frm);
    },

    is_template: function(frm) {
        toggle_project_reqd(frm);
        if (frm.doc.is_template) {
            frm.set_value("project", "");
            frm.set_value("project_name", "");
            frm.set_value("load_from_template", "");
        }
    },

    load_from_template: function(frm) {
        _dhs_load_template(frm.doc.load_from_template, function(fieldname, value) {
            frm.set_value(fieldname, value);
        }, function() {
            frm.dirty();
        });
    },

    door_open_type: function(frm) {
        update_hw_code(frm);
    },
    door_set_type: function(frm) {
        update_hw_code(frm);
    }
});

function toggle_project_reqd(frm) {
    var is_tpl = frm.doc.is_template;
    frm.toggle_reqd("project", !is_tpl);
    frm.toggle_display("project_section", !is_tpl);
}

function setup_template_filter(frm) {
    frm.set_query("load_from_template", function() {
        return {
            filters: { is_template: 1 }
        };
    });
}

function update_hw_code(frm) {
    if (frm.doc.door_open_type && frm.doc.door_set_type) {
        var open_map = {"Swing": "SW", "Sliding": "SL"};
        var set_map = {"Single": "S", "Pair": "P"};

        var open_code = open_map[frm.doc.door_open_type] || "";
        var set_code = set_map[frm.doc.door_set_type] || "";

        if (open_code && set_code) {
            frm.set_value("hw_spec_code", open_code + "-" + set_code + "-");
        }
    }
}

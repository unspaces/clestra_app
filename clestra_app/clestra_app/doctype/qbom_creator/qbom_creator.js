frappe.provide("erpnext.qbom");

frappe.ui.form.on("QBOM Creator", {
    setup(frm) {
        frm.trigger("set_queries");
    },

    setup_qbom_creator(frm) {
        frm.dashboard.clear_comment();

        if (!frm.is_new()) {
            if (!frappe.qbom_configurator || frappe.qbom_configurator.qbom_configurator !== frm.doc.name) {
                frm.trigger("build_tree");
            }
        } else if (!frm.doc.items?.length) {
            let $parent = $(frm.fields_dict["qbom_creator"].wrapper);
            $parent.empty();
            frm.trigger("make_new_entry");
        }
    },

    build_tree(frm) {
        let $parent = $(frm.fields_dict["qbom_creator"].wrapper);
        $parent.empty();
        frm.toggle_enable("item_code", false);

        frappe.require("qbom_configurator.bundle.js").then(() => {
            frappe.qbom_configurator = new frappe.ui.QBOMConfigurator({
                wrapper: $parent,
                page: $parent,
                frm: frm,
                qbom_configurator: frm.doc.name,
            });
        });
    },

    make_new_entry(frm) {
        let dialog = new frappe.ui.Dialog({
            title: __("Multi-level QBOM Creator"),
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
                    default: frappe.defaults.get_user_default("Company"),
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
                    label: __("VP"),
                    fieldtype: "Link",
                    fieldname: "vp_id",
                    options: "VP",
                    reqd: 1,
                    default: frappe.defaults.get_global_default("vp"),
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

        dialog.fields_dict.item_code.get_query = "erpnext.controllers.queries.item_query";
        dialog.show();
    },

    set_queries(frm) {
        frm.set_query("qbom_no", "items", function (doc, cdt, cdn) {
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
        frm.trigger("setup_qbom_creator");
        frm.trigger("set_root_item");
        frm.trigger("add_custom_buttons");
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

        if (frm.doc.docstatus === 1 && frm.doc.status !== "Completed") {
            frm.add_custom_button(__("Create Multi-level QBOM"), () => {
                frm.trigger("create_multi_level_qbom");
            });
        }
    },

    create_multi_level_qbom(frm) {
        frm.call({
            method: "enqueue_create_qboms",
            doc: frm.doc,
        });
    },
});

frappe.ui.form.on("QBOM Creator Item", {
    item_code(frm, cdt, cdn) {
        let item = frappe.get_doc(cdt, cdn);
        if (item.item_code && item.is_root) {
            frappe.model.set_value(cdt, cdn, "fg_item", item.item_code);
        }
    },

    do_not_explode(frm, cdt, cdn) {
        let item = frappe.get_doc(cdt, cdn);
        if (!item.do_not_explode) {
            frm.call({
                method: "get_default_qbom",
                doc: frm.doc,
                args: {
                    item_code: item.item_code,
                },
                callback(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, "qbom_no", r.message);
                    }
                },
            });
        } else {
            frappe.model.set_value(cdt, cdn, "qbom_no", "");
        }
    },
});
// Copyright (c) 2024, Se Yong EOM and contributors
// For license information, please see license.txt

frappe.ui.form.on('Final Product', {
    refresh: function(frm) {
        // 트리 구조에서 노드를 추가할 수 있는 버튼을 추가
        frm.add_custom_button(__('Add Node'), function() {
            let parent_node = frm.selected_node ? frm.selected_node.value : null;

            frappe.prompt([
                {'fieldname': 'node_name', 'fieldtype': 'Data', 'label': 'Node Name', 'reqd': 1},
                {'fieldname': 'node_type', 'fieldtype': 'Select', 'label': 'Node Type', 'options': 'Final Product\nSub Assembly', 'reqd': 1},
                {'fieldname': 'quantity', 'fieldtype': 'Float', 'label': 'Quantity', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'width', 'fieldtype': 'Float', 'label': 'Width', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'height', 'fieldtype': 'Float', 'label': 'Height', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'depth', 'fieldtype': 'Float', 'label': 'Depth', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'}
            ], function(values) {
                // 최상위 노드 생성 처리: 부모 노드가 없으면 최상위 노드를 생성
                frappe.call({
                    method: "clestra_app.clestra_app.doctype.final_product.final_product.add_tree_node",
                    args: {
                        parent_node: parent_node,  // 부모 노드가 없으면 null로 설정
                        node_type: values.node_type,
                        node_name: values.node_name,
                        quantity: values.quantity,
                        width: values.width,
                        height: values.height,
                        depth: values.depth
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(__('Node Added: ' + r.message));
                            frm.reload_doc();  // 폼을 리로드하여 변경사항을 반영
                        }
                    }
                });
            }, __('Add New Node'), __('Add'));
        });
    }
});
frappe.ui.form.on('Final Product', {
    refresh: function(frm) {
        // 트리 구조에서 노드를 추가할 수 있는 버튼을 추가
        frm.add_custom_button(__('Add Node'), function() {
            let selected_node = frm.fields_dict['final_products'] ? frm.fields_dict['final_products'].tree.get_selected_node() : null;

            // selected_node가 null일 때 최상위 노드로 간주
            if (!selected_node) {
                frappe.msgprint(__('No node selected. Adding a root node.'));
            }

            frappe.prompt([
                {'fieldname': 'node_name', 'fieldtype': 'Data', 'label': 'Node Name', 'reqd': 1},
                {'fieldname': 'node_type', 'fieldtype': 'Select', 'label': 'Node Type', 'options': 'Final Product\nSub Assembly', 'reqd': 1},
                {'fieldname': 'quantity', 'fieldtype': 'Float', 'label': 'Quantity', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'width', 'fieldtype': 'Float', 'label': 'Width', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'height', 'fieldtype': 'Float', 'label': 'Height', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'},
                {'fieldname': 'depth', 'fieldtype': 'Float', 'label': 'Depth', 'depends_on': 'eval:doc.node_type=="Sub Assembly"'}
            ], function(values) {
                // 부모 노드가 없으면 최상위 노드를 생성
                let parent_node = selected_node ? selected_node.value : null;

                frappe.call({
                    method: "your_app.your_module.doctype.final_product.final_product.add_tree_node",
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
                        } else {
                            frappe.msgprint(__('Error adding node.'));
                        }
                    }
                });
            }, __('Add New Node'), __('Add'));
        });
    }
});
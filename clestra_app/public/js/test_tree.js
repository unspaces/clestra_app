
frappe.treeview_settings['Final Product'] = {
    // 트리 구조를 불러올 때 사용하는 API 메소드
    get_tree_nodes: "clestra_app.clestra_app.doctype.final_product.final_product.get_children", 

    // 트리 뷰의 이름
    breadcrumb: 'Product Plan',

    // 필터 설정 (예: Panel, Door, Etc)
    filters: [
        {
            fieldname: 'item_type',
            fieldtype: 'Select',
            options: 'Panel\nDoor\nEtc',
            label: __('Item Type'),
        }
    ],

    // 새로운 항목을 추가할 때의 동작
    onrender: function(node) {
        if(node.data.is_group) {
            // 그룹 노드를 클릭했을 때의 동작
        }
    }
};
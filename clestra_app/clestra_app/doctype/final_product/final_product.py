# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.utils.nestedset import NestedSet


class FinalProduct(NestedSet):
	pass

@frappe.whitelist()
def add_tree_node(parent_node=None, node_type=None, node_name=None, quantity=None, width=None, height=None, depth=None):
    """
    트리 구조에서 노드를 추가하는 메서드
    """
    # 노드 이름이 비어있는지 확인
    if not node_name:
        frappe.throw(_("Node Name cannot be empty"))

    # 부모 노드가 없는 경우, 최상위 노드를 생성
    if not parent_node and node_type == 'Final Product':
        new_node = frappe.get_doc({
            'doctype': 'Final Product',
            'product_name': node_name,
            'is_group': 1,  # 최상위 노드는 항상 그룹이어야 함
        })
    elif parent_node and node_type == 'Sub Assembly':
        # Sub Assembly 추가
        new_node = frappe.get_doc({
            'doctype': 'Sub Assembly',
            'sub_assembly_name': node_name,
            'quantity': quantity,
            'width': width,
            'height': height,
            'depth': depth,
            'parent_final_product': parent_node  # 부모 Final Product를 참조
        })
    else:
        frappe.throw(_("Invalid node type or missing parent node"))

    # 데이터 저장
    new_node.insert()
    frappe.db.commit()

    return new_node.name
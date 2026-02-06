# Copyright (c) 2024, Se Yong EOM and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ProjectReferences(Document):
     
    def before_save(self):
        # 값이 있는 행만 가져와서 리스트로 만들고 바로 join
        self.product_type_filter = ", ".join(
            [row.product_type for row in self.product_type if row.product_type]
        )
        
        values = [
            frappe.db.get_value("Door Combi", row.door_combi, "door_combi") 
            for row in self.door 
            if row.door_combi
        ]
        valid_values = [v for v in values if v]
        self.door_filter = ", ".join(valid_values)

        self.panel_type_filter = ", ".join(
            [row.panel_type for row in self.panel_type if row.panel_type]
        )
        self.color_filter = ", ".join(
            [row.color for row in self.color if row.color]
        )
        self.additional_features_filter = ", ".join(
            [row.add_feat for row in self.add_feat if row.add_feat]
        )


# @frappe.whitelist 데코레이터를 붙여야 Client Script에서 호출할 수 있습니다.
@frappe.whitelist()
def get_projects_with_door(doctype, txt, searchfield, start, page_len, filters):
    # Client Script에서 전달한 필터 값(door_model)을 가져옵니다.
    door_model_value = filters.get('door_model')

    if not door_model_value:
        return []

    # [수정 필요] 'Project Summary Door'는 실제 자식 테이블 DocType 이름으로 변경해야 합니다.
    # [수정 필요] 'door_model'은 자식 테이블 내의 실제 Link 필드 이름으로 변경해야 합니다.
    child_doctype = 'Project Summary Door'
    link_field_in_child = 'door_model'

    # 자식 테이블에서 특정 door_model 값을 가진 레코드들의 부모(parent) 리스트를 가져옵니다.
    project_names = frappe.get_all(
        child_doctype,
        filters={
            link_field_in_child: door_model_value
        },
        pluck='parent', # 'parent' 필드 값만 추출합니다.
        distinct=True
    )

    if not project_names:
        return []

    # 찾은 부모(Project Summary) 이름들을 기반으로 리스트 뷰 쿼리를 반환합니다.
    # 이 쿼리는 'Project Summary'의 'name' 필드가 project_names 리스트에 포함된 것들만 필터링합니다.
    return frappe.get_list(
        'Project Summary',
        filters={'name': ['in', project_names]},
        fields=['name', 'customer', 'status'], # 리스트뷰에 보여줄 필드들
        order_by='modified desc'
    )
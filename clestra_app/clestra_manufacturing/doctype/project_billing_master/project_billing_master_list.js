frappe.listview_settings['Project Billing Master'] = {
    refresh: function(listview) {

        // --- 1. 컬럼 너비 조정 및 텍스트 잘림 문제 해결 ---
        const style = `
            /* [data-page-route]로 범위를 한정하여 Item 목록 뷰에만 적용 */
            
            /* item_code 컬럼 너비 (Title Field) */
            .list-row-head .list-subject,
            .list-row .list-subject {
                flex: 1 1 13% !important;
                width: 13% !important;
            }

            [data-page-route="List/Project Billing Master/List"] .list-row-head .list-row-col:has([data-sort-by="project"]),
            [data-page-route="List/Project Billing Master/List"] .list-row .list-row-col:has([data-filter^="project,"]) {
                flex: 1 1 20% !important;
                width: 20% !important;
            }

            [data-page-route="List/Project Billing Master/List"] .list-row-head .list-row-col:has([data-sort-by="contract_no"]),
            [data-page-route="List/Project Billing Master/List"] .list-row .list-row-col:has([data-filter^="contract_no,"]) {
                flex: 1 1 2% !important;
                width: 2% !important;
                text-align: right !important;
            }

            // [data-page-route="List/Project Billing Master/List"] .list-row-head .list-row-col:has([data-sort-by="revision_no"]),
            // [data-page-route="List/Project Billing Master/List"] .list-row .list-row-col:has([data-filter^="revision_no,"]) {
            //     flex: 1 1 5% !important;
            //     width: 5% !important;
            // }

        `;
        
        frappe.dom.set_style(style, 'custom-item-list-style');
    }
};
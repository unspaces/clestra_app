frappe.listview_settings['Clestra Sales Order'] = {
    refresh: function(listview) {

        // --- 1. 컬럼 너비 조정 및 텍스트 잘림 문제 해결 ---
        const style = `
            /* [data-page-route]로 범위를 한정하여 Item 목록 뷰에만 적용 */
            
            /* item_code 컬럼 너비 (Title Field) */
            .list-row-head .list-subject,
            .list-row .list-subject {
                flex: 1 1 15% !important;
                width: 15% !important;
            }

            [data-page-route="List/Clestra Sales Order/List"] .list-row-head .list-row-col:has([data-sort-by="contract_no"]),
            [data-page-route="List/Clestra Sales Order/List"] .list-row .list-row-col:has([data-filter^="contract_no,"]) {
                flex: 1 1 4% !important;
                width: 4% !important;
            }

            [data-page-route="List/Clestra Sales Order/List"] .list-row-head .list-row-col:has([data-sort-by="serial_no"]),
            [data-page-route="List/Clestra Sales Order/List"] .list-row .list-row-col:has([data-filter^="serial_no,"]) {
                flex: 1 1 1% !important;
                width: 1% !important;
            }

            [data-page-route="List/Clestra Sales Order/List"] .list-row-head .list-row-col:has([data-sort-by="revision_no"]),
            [data-page-route="List/Clestra Sales Order/List"] .list-row .list-row-col:has([data-filter^="revision_no,"]) {
                flex: 1 1 5% !important;
                width: 5% !important;
            }

        `;
        
        frappe.dom.set_style(style, 'custom-item-list-style');
    }
};
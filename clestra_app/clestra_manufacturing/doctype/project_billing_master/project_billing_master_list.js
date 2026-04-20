frappe.listview_settings['Project Billing Master'] = {
    onload: function(listview) {
        // finished_item_code 검색 버튼 추가
        if (!listview._finished_item_search_added) {
            listview.page.add_inner_button(__('Search Finished Item'), function() {
                frappe.prompt({
                    label: __('Item Code (exact match)'),
                    fieldname: 'item_code',
                    fieldtype: 'Data',
                    reqd: 1,
                }, function(values) {
                    const val = values.item_code.trim();
                    if (val) {
                        // 1) Item 테이블에서 해당 item_code의 모든 name 조회 (company 무관)
                        frappe.xcall('frappe.client.get_list', {
                            doctype: 'Item',
                            filters: [['item_code', '=', val]],
                            fields: ['name'],
                            limit_page_length: 0
                        }).then(function(items) {
                            const item_names = (items || []).map(i => i.name);
                            // 입력값 자체도 포함 (이미 전체 name 형식인 경우 대응)
                            if (!item_names.includes(val)) item_names.push(val);

                            // 2) PBM 자식 테이블에서 item_code IN (name 리스트)로 조회
                            const existing_filters = listview.get_filters_for_args();
                            const all_filters = existing_filters.concat(
                                [['Project Billing Master Item', 'item_code', 'in', item_names]]
                            );

                            return frappe.xcall('frappe.client.get_list', {
                                doctype: 'Project Billing Master',
                                filters: all_filters,
                                fields: ['name'],
                                limit_page_length: 0
                            });
                        }).then(function(data) {
                            if (data && data.length > 0) {
                                // JOIN 중복 제거
                                const names = [...new Set(data.map(d => d.name))];
                                listview.filter_area.clear(false);
                                listview.filter_area.add('Project Billing Master', 'name', 'in', names);
                                listview.refresh().then(() => {
                                    frappe.show_alert({
                                        message: __('Found {0} documents with "{1}"', [names.length, val]),
                                        indicator: 'blue'
                                    });
                                });
                            } else {
                                frappe.show_alert({
                                    message: __('No documents found with "{0}"', [val]),
                                    indicator: 'orange'
                                });
                            }
                        });
                    }
                }, __('Search Finished Item Code'), __('Search'));
            });
            listview._po_item_search_added = true;
        }
    },
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
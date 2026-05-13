frappe.listview_settings['Currency Exchange'] = {
    refresh: function(listview) {
        listview.page.add_inner_button(__('Update Missing Data'), function() {
            frappe.confirm('마지막 업데이트 이후부터 오늘까지의 누락된 환율을 가져오시겠습니까?', () => {
                frappe.call({
                    method: "clestra_app.utils.currency_exchange.sync_missing_rates",
                    freeze: true,
                    freeze_message: __("데이터를 가져오는 중입니다..."),
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(r.message);
                            listview.refresh();
                        }
                    }
                });
            });
        });
    }
};

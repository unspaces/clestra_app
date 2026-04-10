frappe.listview_settings['Quotation Pricing'] = {
    formatters: {
        margin_rate: function(value, df, doc) {
            return value !== null && value !== undefined 
                ? `<span>${flt(value, 2)}%</span>` 
                : '';
        }
    }
};
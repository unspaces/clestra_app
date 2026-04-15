frappe.listview_settings['Quotation Master'] = {
    formatters: {
        margin_rate: function(value, df, doc) {
            return value !== null && value !== undefined 
                ? `<span>${flt(value, 2)}%</span>` 
                : '';
        }
    }
};
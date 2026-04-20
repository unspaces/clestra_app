// BOM Creator의 items 테이블 item_code 컬럼에 indent_level에 따른 들여쓰기 + ↳ 프리픽스 표시

frappe.ui.form.on('BOM Creator', {
    refresh: function (frm) {
        setTimeout(() => _setup_bom_creator_items_indent(frm), 300);
    },
});

function _setup_bom_creator_items_indent(frm) {
    const grid = frm.fields_dict['items']?.grid;
    if (!grid || grid._indent_display_setup) return;

    const original_refresh = grid.refresh.bind(grid);
    grid.refresh = function () {
        original_refresh();
        _apply_bom_creator_indent(grid);
    };
    grid._indent_display_setup = true;
    grid.refresh();
}

function _apply_bom_creator_indent(grid) {
    if (!grid.grid_rows) return;
    grid.grid_rows.forEach(grid_row => {
        if (!grid_row.doc) return;
        const level = cint(grid_row.doc.indent_level);
        const $static = $(grid_row.wrapper).find('[data-fieldname="item_code"] .static-area').first();
        if (!$static.length) return;

        $static.find('.bom-indent-prefix').remove();

        if (level > 0) {
            const padding = level * 16;
            const prefix = $('<span class="bom-indent-prefix" style="color: var(--text-muted); margin-right: 4px;">↳</span>');
            $static.css('padding-left', padding + 'px').prepend(prefix);
        } else {
            $static.css('padding-left', '');
        }
    });
}

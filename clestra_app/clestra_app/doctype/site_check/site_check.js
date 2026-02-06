frappe.ui.form.on("Site Check", {
    onload: function (frm) {
        // finish_list_name에 기본값 설정
        if (!frm.doc.finish_list_name) {
            frm.set_value('finish_list_name', frm.doc.default_finish_list_name);  // default_finish_list_name은 Doctype에 미리 설정한 값
        }

        // 새 문서일 때만 fetch_finish_material_data 실행
        if (frm.is_new() && frm.doc.finish_list_name) {
            fetch_finish_material_data(frm);
        }
    },

    finish_list_name: function (frm) {
        // finish_list_name이 변경될 때마다 데이터를 불러오는 함수 호출
        fetch_finish_material_data(frm);
    },
    
    refresh(frm) {
        function setup_field(field_name) {
            if (!frm.doc[field_name] || frm.doc[field_name].length === 0) {
                frm.add_child(field_name);
                frm.refresh_field(field_name);
            }

            frm.get_field(field_name).grid.cannot_add_rows = true;

            const original_refresh = frm.fields_dict[field_name].grid.refresh;
            frm.fields_dict[field_name].grid.refresh = function(...args) {
                original_refresh.apply(this, args);
                hide_grid_columns(frm, field_name);
            };

            frm.fields_dict[field_name].grid.refresh();
            frm.refresh_field(field_name);
        }

        setup_field('product_type');
        setup_field('product_features');
        setup_field('door_type');

        // Add the click event listener to the "Next" button
        frm.fields_dict["go_to_details"].$input.on("click", function() {
            // Switch to the 'site-check-details_tab'
            $('a[href="#site-check-details_tab"]').click();
        });

        // Add the click event listener to the "Next" button
        frm.fields_dict["go_to_others"].$input.on("click", function() {
            // Switch to the 'site-check-details_tab'
            $('a[href="#site-check-others_tab"]').click();
        });
    },
});

function fetch_finish_material_data(frm) {
    frappe.call({
        method: "frappe.client.get",
        args: {
            doctype: "Finish Material List Builder",
            name: frm.doc.finish_list_name,
        },
        callback: function (data) {
            frm.clear_table("finish_material");
            let finish_material = data.message.finish_material;
            for (var i in finish_material) {
                frm.add_child("finish_material");
                frm.fields_dict.finish_material.get_value()[i].finish_area = finish_material[i].finish_area;
                frm.fields_dict.finish_material.get_value()[i].material = finish_material[i].material;
            }
            frm.refresh();
        },
    });
}

function hide_grid_columns(frm, field_name) {
    const grid = frm.fields_dict[field_name].grid;
    if (grid && grid.wrapper) {
        grid.wrapper.find('.grid-row-check').hide();
        grid.wrapper.find('.sortable-handle').hide();
        grid.wrapper.find('div.grid-heading-row .grid-row-check').hide();
        grid.wrapper.find('div.grid-heading-row .sortable-handle').hide();
    }
}
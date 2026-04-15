// /public/js/quick_entry_custom.js

frappe.provide('frappe.ui.form');

if (frappe.ui.form.QuickEntryForm) {
    // 1. 기존의 render_dialog 함수를 보관합니다.
    const standard_render_dialog = frappe.ui.form.QuickEntryForm.prototype.render_dialog;

    // 2. render_dialog 함수를 덮어씁니다.
    frappe.ui.form.QuickEntryForm.prototype.render_dialog = function() {
        // 원래 Frappe가 수행하던 로직을 먼저 실행합니다.
        standard_render_dialog.call(this);

        // 3. 세용님의 "Door Hardware Spec"일 때만 커스텀 로직을 실행합니다.
        if (this.doctype === "Door Hardware Spec") {
            console.log("Door Hardware Spec Quick Entry logic initialized.");
            this.bind_door_spec_events();
        }
    };

    // 4. 이벤트 바인딩 및 계산 로직을 프로토타입에 추가합니다.
    frappe.ui.form.QuickEntryForm.prototype.bind_door_spec_events = function() {
        let dialog = this.dialog;
        let fields = ["door_open_type", "door_set_type"];

        fields.forEach(fieldname => {
            let field = dialog.get_field(fieldname);
            if (field) {
                // jQuery를 사용하여 입력값 변경을 감지합니다.
                field.$input.on("change", () => {
                    let values = dialog.get_values();

                    if (values && values.door_open_type && values.door_set_type) {
                        let open_code = (values.door_open_type === "Swing") ? "SW" : "SL";
                        let set_code = (values.door_set_type === "Single") ? "S" : "P";

                        // 결과값을 hw_spec_code 필드에 주입합니다.
                        dialog.set_value("hw_spec_code", `${open_code}-${set_code}-`);
                    }
                });
            }
        });
    };
}

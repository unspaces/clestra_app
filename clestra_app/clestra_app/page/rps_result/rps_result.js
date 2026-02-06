frappe.pages['rps-result'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		// title: '2025 커피바위보',
		single_column: true
	});

	// Add Google Font CSS link to the document head
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap";
    document.head.appendChild(fontLink);

    frappe.call({
        method: "clestra_app.clestra_app.page.rps_result.rps_result.get_rps_data",
        callback: function(response) {
            const { data, total_games } = response.message;
            const html = `
                <div style="font-family: 'Noto Sans KR', serif; margin: 20px;">
                    <!-- Header Section -->
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
                        <h1 style="text-align: center; font-size: 2em; margin-bottom: 10px;">2025 커피바위보</h1>
                        <p style="text-align: center; color: #6c757d;">1등: 이 세상 제일 착한 사람</p>
                    </div>

                    <!-- Participant Table -->
                    <table style="text-align: center; width: 100%; margin-top: 20px; border-collapse: collapse; font-size: 0.9em; background: white; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #f8f9fa; color: #343a40;">
                                <th style="padding: 10px; border-bottom: 1px solid #e9ecef;">순위</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e9ecef;">이름</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e9ecef;">횟수</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e9ecef;">확률</th>
                                <th style="padding: 10px; border-bottom: 1px solid #e9ecef;">날짜</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((row, index) => `
                                <tr>
                                    <td style="padding: 10px;">${index + 1}</td>
                                    <td style="padding: 10px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa fa-user-circle" style="font-size: 20px; color: #007bff; margin-right: 8px;"></i> 
                                        ${row.name}
                                    </td>
                                    <td style="padding: 10px; color: ${getBadgeColor(row.lose_count)}; font-weight: bold;">${row.lose_count}</td>
                                    <td style="padding: 10px; color: ${getBadgeColor(parseFloat(row.lose_probability))}; font-weight: bold;">${row.lose_probability}</td>
                                    <td style="padding: 10px;">${row.dates || "없음"}</td>
                                </tr>
                            `).join('')}
                            <tr style="background: #f8f9fa;">
                                <td colspan="2" style="padding: 10px; font-weight: bold;">현재까지 진행된 게임 수</td>
                                <td style="padding: 10px; font-weight: bold;">${total_games}</td>
                                <td colspan="2"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            page.main.html(html);

			// Add button to the right corner
            page.set_secondary_action("Export to Web Page", function () {
                const renderedHtml = `
                    <html>
                        <head>${document.head.innerHTML}</head>
                        <body>${$(html).html()}</body>
                    </html>
                `;
                const route = "rps"; // The route of the Web Page in ERPNext

                frappe.call({
                    method: "clestra_app.clestra_app.page.rps_result.rps_result.update_web_page_content",
                    args: {
                        route: route,
                        html_content: renderedHtml,
                    },
                    callback: function (response) {
                        if (response.message === "success") {
                            frappe.show_alert({
                                message: __("Web Page updated successfully."),
                                indicator: "green",
                            });
                        } else {
                            frappe.show_alert({
                                message: __("Failed to update Web Page."),
                                indicator: "red",
                            });
                        }
                    },
                    error: function () {
                        frappe.show_alert({
                            message: __("An error occurred while updating the Web Page."),
                            indicator: "red",
                        });
                    },
                });
            });
        }
    });

    function getBadgeColor(value) {
        if (value > 50) return "#dc3545"; // Red for high values
        if (value > 20) return "#ffc107"; // Yellow for medium values
        return "#28a745"; // Green for low values
    }
};
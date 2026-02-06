frappe.pages["yearly-calendar"].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Yearly Calendar",
        single_column: true,
    });

    // Inject HTML structure (Select 박스를 HTML 내부에 직접 포함)
    $(page.body).html(`
        <style>
            .calendar-container {
                overflow: auto;
                max-height: 90vh;
            }
            .sticky-header {
                position: sticky;
                top: 0;
                z-index: 1020;
                background: white; /* 헤더 배경색 지정 */
            }
            .controls-wrapper {
                padding: 10px 15px;
                background-color: #f7fafc;
                border-bottom: 1px solid #d1d8dd;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .table-header-wrapper {
                position: sticky;
                top: 0px; /* 컨트롤 바 아래에 위치하도록 조정 필요 시 수정 */
                z-index: 1020;
                margin-bottom: 0;
                background: white;
            }
            .calendar-table thead th {
                z-index: 1020;
                background: #f8f9fa; /* 헤더 배경색 명시 */
            }
            .calendar-table {
                margin-bottom: 0;
            }
            .table {
                margin-top: 0;
            }
        </style>

        <div class="calendar-container">
            <div class="controls-wrapper sticky-header">
                <label for="year-select" style="margin-bottom: 0; font-weight: bold;">Select Year:</label>
                <select id="year-select" class="form-control" style="width: 120px; display: inline-block;">
                    <option value="2025" >2025</option>
                    <option value="2026" selected>2026</option>
                </select>
            </div>

            <div class="table-header-wrapper">
                <table class="table table-bordered calendar-table">
                    <thead>
                        <tr>
                            <th class="text-center">1 Jan</th>
                            <th class="text-center">2 Feb</th>
                            <th class="text-center">3 Mar</th>
                            <th class="text-center">4 Apr</th>
                            <th class="text-center">5 May</th>
                            <th class="text-center">6 Jun</th>
                            <th class="text-center">7 Jul</th>
                            <th class="text-center">8 Aug</th>
                            <th class="text-center">9 Sep</th>
                            <th class="text-center">10 Oct</th>
                            <th class="text-center">11 Nov</th>
                            <th class="text-center">12 Dec</th>
                        </tr>
                    </thead>
                </table>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered calendar-table" style="margin-bottom: 50px">
                    <tbody id="calendar-body">
                        </tbody>
                </table>
            </div>
        </div>
    `);

    // 2. Select 박스 이벤트 리스너 등록
    $('#year-select').on('change', function() {
        const selectedYear = $(this).val();
        fetchYearlyEvents(selectedYear);
    });

    // Add button to the right corner
    page.set_secondary_action("Update Web Page", function () {
        // 1. 현재 페이지의 body 내용을 복제 (화면에는 영향 없음)
        const $clone = $(page.body).clone();

        // 2. 저장하고 싶지 않은 요소 제거
        // (1) 연도 선택 박스 (.controls-wrapper) 제거
        $clone.find('.controls-wrapper').remove();

        // (2) <div class="calendar-container"> 태그 자체를 제거하고 그 안의 내용물(Table 등)만 남김 (Unwrap)
        $clone.find('.calendar-container').contents().unwrap();

        const renderedHtml = `
            <html>
                <head>${document.head.innerHTML}</head>
                <body>${$clone.html()}</body>
            </html>
        `;
        const route = "yearly-calendar"; 

        frappe.call({
            method: "clestra_app.clestra_app.page.yearly_calendar.yearly_calendar.update_web_page_content",
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

    // 3. 초기 로드 (기본값 2025)
    fetchYearlyEvents("2026");

    function fetchYearlyEvents(year) {
        frappe.call({
            method: "clestra_app.clestra_app.page.yearly_calendar.yearly_calendar.get_yearly_events",
            args: { year },
            callback: function (response) {
                if (response.message) {
                    renderCalendar(response.message, year); // 연도 전달
                } else {
                    frappe.show_alert({
                        message: __("No events found for the selected year."),
                        indicator: "orange",
                    });
                    renderCalendar([], year); // 빈 달력 렌더링 시에도 연도 전달
                }
            },
            error: function (error) {
                console.error("Error fetching events:", error);
                renderCalendar([], year);
            },
        });
    }

    function renderCalendar(events, year) {
        // 4. 연도에 따른 윤년 계산 및 요일 시작점 처리를 위해 year 사용
        const currentYearInt = parseInt(year);
        
        // 윤년 계산
        const isLeap = (currentYearInt % 4 === 0 && currentYearInt % 100 !== 0) || (currentYearInt % 400 === 0);
        const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        let tbody = "";
    
        for (let day = 1; day <= 31; day++) {
            tbody += "<tr>";
            for (let month = 0; month < 12; month++) {
                if (day <= daysInMonth[month]) {
                    // 선택된 연도를 기준으로 Date 객체 생성
                    const date = new Date(Date.UTC(currentYearInt, month, day)); 
                    const weekday = weekdays[date.getUTCDay()];
                    
                    let dateClass = "";
                    let customStyle = "";
                
                    if (weekday === "일") {
                        dateClass = "text-danger";
                    } else if (weekday === "토") {
                        customStyle = "color: var(--blue-600)";
                    }

                    const eventsOnDate = events.filter((e) => {
                        const startDate = new Date(e.starts_on);
                        const endDate = e.ends_on ? new Date(e.ends_on) : startDate;
                        return (
                            date.toISOString().split("T")[0] === startDate.toISOString().split("T")[0] ||
                            (date >= startDate && date <= endDate)
                        );
                    });

                    let eventsHTML = "";
                    if (eventsOnDate.length > 0) {
                        if (eventsOnDate.some(event => event.event_category && 
                            (event.event_category.toLowerCase() === "holiday" || event.event_category.toLowerCase() === "dayoff"))) {
                            dateClass = "text-danger"; 
                        }

                        eventsHTML = eventsOnDate
                            .map((event) => {
                                return `<div class="event" data-event='${JSON.stringify(event)}' style="
                                    background-color: ${getEventCategoryBackgroundColor(event.event_category)} !important;
                                    color: ${getEventCategoryTextColor(event.event_category)} !important;
                                    white-space: normal;
                                    word-wrap: break-word;
                                    word-break: break-word;
                                    max-width: 100px;
                                    margin-bottom: 5px;
                                    padding: 3px;
                                    border-radius: 4px;">
                                    ${event.subject}
                                </div>`;
                            })
                            .join("");
                    }

                    tbody += `
                        <td class="text-center" data-date="${date.toISOString().split("T")[0]}" style="cursor: pointer;">
                            <div class="date-event d-flex flex-column align-items-start" style="gap: 5px; justify-content: flex-start; height: 100%;">
                                <span class="date ${dateClass}" style="display: flex; justify-content: center; align-items: center; gap: 4px; ${customStyle}">
                                    <span>${day}</span> <span>${weekday}</span>
                                </span>
                                ${eventsHTML}
                            </div>
                        </td>`;
                } else {
                    tbody += "<td></td>";
                }
            }
            tbody += "</tr>";
        }
    
        $("#calendar-body").html(tbody);
    
        $("#calendar-body").off("click", "td[data-date]");
        $("#calendar-body").on("click", "td[data-date]", function (e) {
            if ($(e.target).hasClass("event")) return;
            const date = $(this).data("date");
            addEventDialog(date);
        });
    
        $("#calendar-body").on("click", ".event", function () {
            const event = JSON.parse($(this).attr("data-event"));
            editDialog(event);
        });
    }

    function getEventCategoryBackgroundColor(category) {
        if (!category) return "#28a745";
        const lowerCaseCategory = category.toLowerCase();
        if (lowerCaseCategory.includes("seminar") || lowerCaseCategory.includes("workshop")) return "#ffc107";
        if (lowerCaseCategory.includes("conference")) return "#007bff";
        if (lowerCaseCategory.includes("holiday") || lowerCaseCategory.includes("dayoff")) return "#dc3545";
        return "#28a745";
    }
    
    function getEventCategoryTextColor(category) {
        if (!category) return "#ffffff";
        const lowerCaseCategory = category.toLowerCase();
        if (lowerCaseCategory.includes("seminar") || lowerCaseCategory.includes("workshop")) return "#000000";
        if (lowerCaseCategory.includes("conference")) return "#ffffff";
        if (lowerCaseCategory.includes("holiday") || lowerCaseCategory.includes("dayoff")) return "#ffffff";
        return "#ffffff";
    }

    let addEventDialogInstance = null;
    function addEventDialog(date) {
        if (!addEventDialogInstance) {
            addEventDialogInstance = new frappe.ui.Dialog({
                title: __("Add Event"),
                fields: [
                    { fieldname: "subject", label: __("Event Title"), fieldtype: "Small Text", reqd: 1 },
                    { fieldname: "event_category", label: __("Category"), fieldtype: "Select", options: "Meeting\nSeminar\nWorkshop\nConference\nTraining\nHoliday\nDayoff\nEvent\nOther", reqd: 1 },
                    { fieldname: "send_reminder", label: __("Send Reminder"), fieldtype: "Check", default: 0 },
                    { fieldname: "repeat_this_event", label: __("Repeat this Event"), fieldtype: "Check", default: 0 },
                    { fieldname: "all_day", label: __("All Day"), fieldtype: "Check", default: 0 },
                    { fieldname: "starts_on", label: __("Start Date"), fieldtype: "Datetime", reqd: 1, default: `${date} 09:00:00` },
                    { fieldname: "ends_on", label: __("End Date"), fieldtype: "Datetime", default: `${date} 18:00:00` },
                    { fieldname: "color", label: __("Color"), fieldtype: "Color",},
                    { fieldname: "description", label: __("Description"), fieldtype: "Text Editor" },
                ],
            });

            addEventDialogInstance.set_primary_action(__("Save"), () => {
                let values = addEventDialogInstance.get_values();
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Event",
                            subject: values.subject,
                            event_category: values.event_category,
                            event_type: "Public",
                            send_reminder: values.send_reminder ? 1 : 0,
                            repeat_this_event: values.repeat_this_event ? 1 : 0,
                            all_day: values.all_day ? 1 : 0,
                            starts_on: values.starts_on,
                            ends_on: values.ends_on,
                            color: values.color,
                            description: values.description,
                        },
                    },
                    callback: (response) => {
                        if (response.message) {
                            frappe.show_alert({ message: __("Event added successfully."), indicator: "green" });
                            // 현재 선택된 연도로 리프레시
                            fetchYearlyEvents($("#year-select").val()); 
                            addEventDialogInstance.hide();
                            addEventDialogInstance = null;
                        } else {
                            frappe.msgprint(__("Failed to add event. Please try again."), __("Error"));
                        }
                    },
                });
            });
        }
        addEventDialogInstance.set_values({
            starts_on: `${date} 09:00:00`,
            ends_on: `${date} 18:00:00`,
        });
        addEventDialogInstance.show();
    }

    let editEventDialogInstance = null;
    function editDialog(event) {
        if (editEventDialogInstance) editEventDialogInstance.hide();

        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Event", name: event.name },
            callback: function (response) {
                if (response.message) {
                    const currentEvent = response.message;
                    if (!editEventDialogInstance) {
                        editEventDialogInstance = new frappe.ui.Dialog({
                            title: __("Edit Event"),
                            fields: [
                                { fieldname: "subject", label: __("Event Title"), fieldtype: "Small Text", reqd: 1, default: currentEvent.subject },
                                { fieldname: "event_category", label: __("Category"), fieldtype: "Select", options: "Meeting\nSeminar\nWorkshop\nConference\nTraining\nHoliday\nDayoff\nEvent\nOther", default: currentEvent.event_category },
                                { fieldname: "send_reminder", label: __("Send Reminder"), fieldtype: "Check", default: currentEvent.send_reminder ? 1 : 0 },
                                { fieldname: "repeat_this_event", label: __("Repeat this Event"), fieldtype: "Check", default: currentEvent.repeat_this_event ? 1 : 0 },
                                { fieldname: "all_day", label: __("All Day"), fieldtype: "Check", default: currentEvent.all_day ? 1 : 0 },
                                { fieldname: "starts_on", label: __("Start Date"), fieldtype: "Datetime", reqd: 1, default: currentEvent.starts_on },
                                { fieldname: "ends_on", label: __("End Date"), fieldtype: "Datetime", default: currentEvent.ends_on },
                                { fieldname: "color", label: __("Color"), fieldtype: "Color", default: currentEvent.color },
                                { fieldname: "description", label: __("Description"), fieldtype: "Text Editor", default: currentEvent.description },
                            ],
                            primary_action_label: __("Save"),
                            primary_action(values) {
                                frappe.call({
                                    method: "frappe.client.set_value",
                                    args: {
                                        doctype: "Event",
                                        name: currentEvent.name,
                                        fieldname:{
                                            subject: values.subject,
                                            event_category: values.event_category,
                                            event_type: "Public",
                                            send_reminder: values.send_reminder ? 1 : 0,
                                            repeat_this_event: values.repeat_this_event ? 1 : 0,
                                            all_day: values.all_day ? 1 : 0,
                                            starts_on: values.starts_on,
                                            ends_on: values.ends_on,
                                            color: values.color,
                                            description: values.description,
                                        }
                                    },
                                    callback: function () {
                                        frappe.show_alert({ message: __("Event updated successfully."), indicator: "green" });
                                        fetchYearlyEvents($("#year-select").val());
                                        editEventDialogInstance.hide();
                                    },
                                });
                            },
                            secondary_action_label: __("Delete"),
                            secondary_action() {
                                frappe.confirm(
                                    __("Are you sure you want to delete this event?"),
                                    function () {
                                        frappe.call({
                                            method: "frappe.client.delete",
                                            args: { doctype: "Event", name: event.name },
                                            callback: function () {
                                                frappe.show_alert({ message: __("Event deleted successfully."), indicator: "green" });
                                                fetchYearlyEvents($("#year-select").val());
                                                editEventDialogInstance.hide();    
                                            },
                                        });
                                    }
                                );
                            },
                        });
                        editEventDialogInstance.onhide = () => { editEventDialogInstance = null; };
                    }
                    editEventDialogInstance.set_values({
                        subject: currentEvent.subject,
                        event_category: currentEvent.event_category,
                        send_reminder: currentEvent.send_reminder ? 1 : 0,
                        repeat_this_event: currentEvent.repeat_this_event ? 1 : 0,
                        all_day: currentEvent.all_day ? 1 : 0,
                        starts_on: currentEvent.starts_on,
                        ends_on: currentEvent.ends_on,
                        color: currentEvent.color,
                        description: currentEvent.description,
                    });
                    editEventDialogInstance.show();
                }
            }
        });
    }
};
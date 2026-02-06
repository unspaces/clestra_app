import frappe
from pytz import timezone, utc
from frappe.utils import getdate


@frappe.whitelist()
def update_web_page_content(route, html_content):
    """
    Update the `main_section_html` field of a Web Page by its route.
    """
    try:
        # Get the web page by route
        web_page = frappe.get_doc("Web Page", {"route": route})
        
        # Update the main_section_html field
        web_page.main_section_html = html_content
        web_page.save()
        frappe.db.commit()

        return "success"
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Failed to update Web Page content")
        return "error"


import frappe
from pytz import timezone, utc
from frappe.utils import getdate

@frappe.whitelist()
def get_yearly_events(year):
    """
    Fetch events for the given year, including recurring events.
    """
    try:
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"

        # Fetch events overlapping with the given year
        events = frappe.db.sql(
            """
            SELECT name, subject, starts_on, ends_on, all_day, color, event_category
            FROM `tabEvent`
            WHERE (
                (DATE(starts_on) BETWEEN %(start)s AND %(end)s)
                OR (DATE(ends_on) BETWEEN %(start)s AND %(end)s)
                OR (
                    DATE(starts_on) <= %(start)s
                    AND DATE(ends_on) >= %(end)s
                )
            )
            AND status = 'Open'
            ORDER BY starts_on
            """,
            {"start": start_date, "end": end_date},
            as_dict=True,
        )

        # Get the user's timezone
        user_timezone = timezone(frappe.db.get_value("User", frappe.session.user, "time_zone") or "UTC")

        # Convert event times to user's timezone
        for event in events:
            event["starts_on"] = convert_to_timezone(event["starts_on"], user_timezone)
            if event.get("ends_on"):
                event["ends_on"] = convert_to_timezone(event["ends_on"], user_timezone)

        # Process recurring events
        events = process_recurring_events(events, start_date, end_date)

        return events

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Yearly Calendar Error")
        frappe.throw(_("Unable to fetch events. Please check the logs for more details."))


def convert_to_timezone(dt_str, target_timezone):
    """
    Convert a datetime string to the target timezone.
    """
    dt = utc.localize(frappe.utils.get_datetime(dt_str))  # Localize the UTC time
    return dt.astimezone(target_timezone).strftime("%Y-%m-%d %H:%M:%S")


def process_recurring_events(events, start_date, end_date):
    """
    Expand recurring events to include occurrences within the given date range.
    """
    expanded_events = []
    for event in events:
        if event.get("repeat_this_event"):
            repeat_till = event.get("repeat_till") or "3000-01-01"
            if getdate(repeat_till) >= getdate(start_date):
                # Logic for expanding recurring events (Daily, Weekly, Monthly, Yearly)
                expanded_events.append(event)  # Placeholder for actual recurring logic
        else:
            expanded_events.append(event)

    return expanded_events

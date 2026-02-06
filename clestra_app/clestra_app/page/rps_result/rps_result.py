import frappe

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
    

@frappe.whitelist()
def get_rps_data():
    # Retrieve data from the RPS doctype
    fixed_names = ["송원성", "이수진", "오정민", "김순근", "엄세용", "이승진"]
    total_games = frappe.db.count("RPS")
    data = []

    for name in fixed_names:
        lose_dates = frappe.db.get_list(
            "RPS",
            filters={"person": name},
            fields=["lose_date"],
            order_by="lose_date"
        )
        lose_count = len(lose_dates)
        lose_probability = (lose_count / total_games * 100) if total_games > 0 else 0

        data.append({
            "name": name,
            "lose_count": lose_count,
            "lose_probability": f"{lose_probability:.2f}%",
            "dates": ", ".join([d["lose_date"].strftime('%m월 %d일') for d in lose_dates])
        })

    # Sort by lose_count descending
    sorted_data = sorted(data, key=lambda x: x["lose_count"], reverse=True)

    return {
        "data": sorted_data,
        "total_games": total_games
    }
# Copyright (c) 2025, Se Yong EOM and contributors
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class RPS(Document):
    def on_update(self):
        sync_rps_ranking_page()

    def after_delete(self):
        sync_rps_ranking_page()

def sync_rps_ranking_page():
    """연도별 데이터를 집계하여 웹 페이지 업데이트"""
    route = "rps"
    years = [2025, 2026] # 선택 가능한 연도 목록
    current_year = now_datetime().year
    
    # 각 연도별 데이터 수집
    year_data_map = {}
    for year in years:
        year_data_map[year] = get_rps_data_by_year(year)
    
    html_content = generate_mobile_html(year_data_map, current_year)
    
    try:
        web_page = frappe.get_doc("Web Page", {"route": route})
        web_page.main_section_html = html_content
        web_page.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "RPS Ranking Update Failed")

def get_rps_data_by_year(year):
    """특정 연도의 데이터만 필터링하여 가져옴"""
    fixed_names = ["송원성", "이수진", "오정민", "김순근", "엄세용", "이승진"]
    
    # 해당 연도의 총 게임 수 계산
    total_games = frappe.db.count("RPS", filters={
        "lose_date": ["between", [f"{year}-01-01", f"{year}-12-31"]]
    })
    
    data = []
    for name in fixed_names:
        # 해당 연도의 패배 기록만 필터링
        lose_dates = frappe.db.get_list(
            "RPS",
            filters={
                "person": name,
                "lose_date": ["between", [f"{year}-01-01", f"{year}-12-31"]]
            },
            fields=["lose_date"],
            order_by="lose_date"
        )
        
        lose_count = len(lose_dates)
        prob = (lose_count / total_games * 100) if total_games > 0 else 0
        formatted_dates = [f"{d['lose_date'].month}월 {d['lose_date'].day}일" for d in lose_dates]

        data.append({
            "name": name,
            "lose_count": lose_count,
            "lose_probability": f"{prob:.2f}%",
            "dates": ", ".join(formatted_dates)
        })

    # 정렬 및 공동 순위 계산
    sorted_data = sorted(data, key=lambda x: (-x["lose_count"], x["name"]))
    current_rank = 1
    for i, row in enumerate(sorted_data):
        if i > 0 and row['lose_count'] == sorted_data[i-1]['lose_count']:
            row['rank'] = sorted_data[i-1]['rank']
        else:
            row['rank'] = i + 1
            
    return {"data": sorted_data, "total_games": total_games}

def generate_mobile_html(year_data_map, current_year):
    """연도별 섹션을 포함한 HTML 생성"""
    year_sections = ""
    year_buttons = ""
    
    for year, payload in year_data_map.items():
        data = payload['data']
        total = payload['total_games']
        
        # 상단 연도 선택 버튼
        is_active = "background: #1e3a8a; color: white;" if year == current_year else "background: #e2e8f0; color: #475569;"
        year_buttons += f"""
            <button onclick="switchYear({year})" id="btn-{year}" style="border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.3s; {is_active}">{year}년</button>
        """
        
        rows_html = ""
        for row in data:
            all_dates = row['dates'].replace(", ", "<br>") if row['dates'] else "-"
            is_first = row['rank'] == 1 and row['lose_count'] > 0
            rank_display = f"👑 {row['rank']}" if is_first else str(row['rank'])
            color = "#e53e3e" if is_first else "#2d3748"

            rows_html += f"""
                <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 15px 5px; text-align: center; font-weight: 800; color: {color};">{rank_display}</td>
                    <td style="padding: 15px 5px; text-align: left;">
                        <div style="font-weight: 600; font-size: 14px; color: #1a202c;">{row['name']}</div>
                        <div style="font-size: 11px; color: #718096;">{row['lose_probability']}</div>
                    </td>
                    <td style="padding: 15px 5px; text-align: center; font-weight: 700; color: {color};">{row['lose_count']}회</td>
                    <td style="padding: 15px 5px; text-align: center; font-size: 11px; color: #4a5568; line-height: 1.5;">
                        <div style="max-height: 100px; overflow-y: auto;">{all_dates}</div>
                    </td>
                </tr>
            """
            
        display_style = "display: block;" if year == current_year else "display: none;"
        year_sections += f"""
            <div id="year-{year}" class="year-content" style="{display_style}">
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 20px; border-radius: 20px; color: white; text-align: center; margin-bottom: 15px; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">
                    <h2 style="margin: 0; font-size: 1.5rem;">☕ {year} 커피바위보</h2>
                    <p style="margin: 5px 0 0; font-size: 0.9rem; opacity: 0.9;">해당 연도 총 {total}번의 대결</p>
                </div>
                <div style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                        <thead>
                            <tr>
                                <th style="width: 20%; background: #f8fafc; padding: 12px 5px; font-size: 12px; color: #64748b; text-align: center;">순위</th>
                                <th style="width: 30%; background: #f8fafc; padding: 12px 5px; font-size: 12px; color: #64748b; text-align: left;">이름</th>
                                <th style="width: 20%; background: #f8fafc; padding: 12px 5px; font-size: 12px; color: #64748b; text-align: center;">횟수</th>
                                <th style="width: 30%; background: #f8fafc; padding: 12px 5px; font-size: 12px; color: #64748b; text-align: center;">기록</th>
                            </tr>
                        </thead>
                        <tbody>{rows_html}</tbody>
                    </table>
                </div>
            </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
            body {{ font-family: -apple-system, sans-serif; background: #f7fafc; margin: 0; padding: 12px; }}
        </style>
        <script>
            function switchYear(year) {{
                document.querySelectorAll('.year-content').forEach(el => el.style.display = 'none');
                document.getElementById('year-' + year).style.display = 'block';
                
                document.querySelectorAll('button[id^="btn-"]').forEach(btn => {{
                    btn.style.background = '#e2e8f0';
                    btn.style.color = '#475569';
                }});
                const activeBtn = document.getElementById('btn-' + year);
                activeBtn.style.background = '#1e3a8a';
                activeBtn.style.color = 'white';
            }}
        </script>
    </head>
    <body>
        <div style="max-width: 480px; margin: 0 auto;">
            <div style="margin-bottom: 15px; display: flex; gap: 8px;">
                {year_buttons}
            </div>
            {year_sections}
            <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">최종 업데이트: {now_datetime().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
    </body>
    </html>
    """
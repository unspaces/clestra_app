# Clestra custom Currency Exchange automation.
# Previously these lived in apps/erpnext/.../currency_exchange.py (direct modification).
# Moved here on 2026-04-24 as part of upstream-restoration migration.

import logging
import xml.etree.ElementTree as ET
from datetime import datetime

import frappe
import requests
from frappe.utils import add_days, getdate, nowdate

logger = frappe.logger("currency_exchange", allow_site=True)
logger.setLevel(logging.DEBUG)


# bench execute clestra_app.utils.currency_exchange.update_exchange_rates --args "['20260121']"
@frappe.whitelist()
def update_exchange_rates(target_date=None):
	API_KEY = "05BHRKHPU3TLGJBY1WL5"  # Bank of Korea ECOS API key
	BASE_URL = f"https://ecos.bok.or.kr/api/StatisticSearch/{API_KEY}/xml/kr/1/2/731Y001/D"

	# JPY is 100-yen basis in ECOS; multiplier applied downstream if needed.
	currencies = {
		"USD": "0000001",
		"JPY": "0000002",
		"CNY": "0000053",
		"HKD": "0000015",
	}

	today = target_date if target_date else datetime.now().strftime("%Y%m%d")

	for currency_code, item_code in currencies.items():
		url = f"{BASE_URL}/{today}/{today}/{item_code}/?/?/?"

		try:
			response = requests.get(url)
			response.raise_for_status()

			root = ET.fromstring(response.content)
			data_value_element = root.find(".//DATA_VALUE")
			time_element = root.find(".//TIME")

			if data_value_element is not None and time_element is not None:
				rate = float(data_value_element.text)
				date_str = time_element.text
				rate_date = datetime.strptime(date_str, "%Y%m%d").date()

				if not frappe.db.exists(
					"Currency Exchange",
					{"from_currency": "KRW", "to_currency": currency_code, "date": rate_date},
				):
					new_rate = frappe.get_doc({
						"doctype": "Currency Exchange",
						"from_currency": "KRW",
						"to_currency": currency_code,
						"exchange_rate": rate,
						"date": rate_date,
						"source": "Bank of Korea ECOS",
						"for_selling": 1,
						"for_buying": 1,
					})
					new_rate.insert()
					frappe.db.commit()
					logger.info(
						f"[Exchange Rate Update] Successfully created exchange rate for "
						f"{currency_code} on {rate_date}"
					)
				else:
					logger.info(
						f"[Exchange Rate Update] Exchange rate for {currency_code} on "
						f"{rate_date} already exists."
					)
			else:
				error_message = root.find(".//MESSAGE")
				if error_message is not None:
					logger.error(
						f"[Exchange Rate Update] BOK API Error for {currency_code}: {error_message.text}"
					)
				else:
					logger.error(
						f"[Exchange Rate Update] DATA_VALUE not found in API response for {currency_code}"
					)

		except requests.exceptions.RequestException as e:
			logger.error(f"[Exchange Rate Update] HTTP Request failed for {currency_code}: {e}")
		except ET.ParseError as e:
			logger.error(f"[Exchange Rate Update] XML Parsing failed for {currency_code}: {e}")
		except Exception as e:
			logger.error(f"[Exchange Rate Update] An unexpected error occurred for {currency_code}: {e}")


def update_cny_based_rates():
	API_KEY = "25KfhDZ12Ly93sM1RCAGILUQlvQZUWDk"  # APILayer key

	headers = {"apikey": API_KEY}
	FROM_CURRENCY = "CNY"
	params = {
		"base": FROM_CURRENCY,
		"symbols": "HKD,USD,SGD,JPY,EUR",
	}

	try:
		url = "https://api.apilayer.com/exchangerates_data/latest"
		response = requests.get(url, headers=headers, params=params)
		response.raise_for_status()

		data = response.json()

		if data.get("success"):
			rates = data.get("rates", {})
			rate_date_str = data.get("date")
			rate_date = datetime.strptime(rate_date_str, "%Y-%m-%d").date()

			for to_currency, rate in rates.items():
				if not frappe.db.exists(
					"Currency Exchange",
					{"from_currency": FROM_CURRENCY, "to_currency": to_currency, "date": rate_date},
				):
					new_rate = frappe.get_doc({
						"doctype": "Currency Exchange",
						"from_currency": FROM_CURRENCY,
						"to_currency": to_currency,
						"exchange_rate": rate,
						"date": rate_date,
						"source": "exchangerate.host",
						"for_selling": 1,
						"for_buying": 1,
					})
					new_rate.insert(ignore_permissions=True)
					frappe.db.commit()
					logger.info(
						f"Successfully created currency exchange for {FROM_CURRENCY}->{to_currency} "
						f"on {rate_date} (Rate: {rate})"
					)
				else:
					logger.info(
						f"Currency exchange for {FROM_CURRENCY}->{to_currency} on {rate_date} already exists."
					)
		else:
			error_info = data.get("error", {})
			error_message = f"API Error Code {error_info.get('code')}: {error_info.get('info')}"
			logger.error(error_message)

	except requests.exceptions.RequestException as e:
		logger.error(f"HTTP Request failed: {e}")
	except Exception:
		logger.error(f"[Exchange Rate Update] An unexpected error occurred: {frappe.get_traceback()}")


@frappe.whitelist()
def sync_missing_rates():
	last_date_record = frappe.db.get_value(
		"Currency Exchange",
		{"from_currency": "KRW", "source": "Bank of Korea ECOS"},
		"date",
		order_by="date desc",
	)

	if not last_date_record:
		return "기존 데이터가 없습니다. 수동으로 시작 날짜를 지정해야 합니다."

	start_date = add_days(last_date_record, 1)
	end_date = getdate(nowdate())

	current_date = start_date
	updated_count = 0

	while current_date <= end_date:
		date_str = current_date.strftime("%Y%m%d")
		update_exchange_rates(target_date=date_str)
		current_date = add_days(current_date, 1)
		updated_count += 1

	return f"{updated_count}일간의 데이터 확인 및 업데이트를 완료했습니다."

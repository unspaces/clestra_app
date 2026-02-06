import frappe
import logging

# Logger 설정
logger = frappe.logger("Email Signature", allow_site=True)
logger.setLevel(logging.DEBUG)

@frappe.whitelist()
def get_signature_options():
    """
    Fetches Division and Footer options from the Email Signature Doctype.
    """
    try:
        # Fetch enabled Email Signature documents
        signature_docs = frappe.get_all(
            "Email Signature",
            fields=[
                "code", "division", "address", "company_name",
                "website", "address_region", "company_name_region",
                "footer_name", "footer_image", "footer_link"
            ]
        )

        divisions = []
        footers = []

        for doc in signature_docs:
            if not (doc.footer_name or "").strip():
                divisions.append({
                    "code": doc.code,
                    "label": doc.division,
                    "address": doc.address or "",
                    "company_name": doc.company_name or "",
                    "website": doc.website or "",
                    "address_region": doc.address_region or "",
                    "company_name_region": doc.company_name_region or ""
                })
                logger.debug(f"Division added: {doc.division}")

            else:
                footers.append({
                    "code": doc.code,
                    "label": doc.footer_name,
                    "image_url": doc.footer_image or "",
                    "link_url": doc.footer_link or ""
                })
                logger.debug(f"Footer added: {doc.footer_name}")

        # Sort divisions and footers alphabetically by label/code for consistency
        divisions.sort(key=lambda x: x.get('label') or x.get('code', ''))
        footers.sort(key=lambda x: x.get('label') or x.get('code', ''))

        return {
            "divisions": divisions,
            "footers": footers
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Email Signature Page Error")
        return {
            "error": str(e),
            "divisions": [],
            "footers": []
        }
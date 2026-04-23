"""
Strip product/model-name prefixes from Item.item_name for Finished Product
items belonging to Clestra Korea.

Two strip modes:
- LITERAL_STRIPS: exact substring removed from the start (kept in user-given form)
- DASH_PREFIXES: each prefix removed together with its trailing dash, e.g. `Mplus-`

LITERAL strips are checked first (so e.g. `Mplus_...` is handled before
considering generic `Mplus-` rules), then dash prefixes ordered by length
desc so that more specific prefixes (e.g. `BTJ6 (CR)`) win over `BTJ6`.
"""
import frappe


# Stripped exactly as written, including trailing space/underscore.
LITERAL_STRIPS = [
    "M1 ",
    "Mplus_",
]

# Each becomes `{prefix}-` and is stripped together with the dash.
DASH_PREFIXES = [
    "Mplus(C88)",
    "P85 SYNOPS",
    "BTJ6 (CR)",
    "FIZZ BOX",
    "Mplus",
    "ALTO",
    "LOFT",
    "P85A",
    "P86A",
    "P89L",
    "P61A",
    "BTJ6",
    "DO1",
    "P81",
    "M1",
]


def execute():
    # Order dash prefixes by length desc so longer matches win.
    dash_strips = sorted(
        (f"{p}-" for p in DASH_PREFIXES), key=len, reverse=True
    )

    items = frappe.db.sql(
        """
        SELECT name, item_name
        FROM `tabItem`
        WHERE item_group = 'Finished Product'
          AND company = 'Clestra Korea'
          AND item_name IS NOT NULL
          AND item_name != ''
        """,
        as_dict=True,
    )

    if not items:
        print("No items to process.")
        return

    updated = 0
    by_prefix = {}
    for item in items:
        original = item.item_name
        new_name = None
        used_prefix = None

        for lit in LITERAL_STRIPS:
            if original.startswith(lit):
                new_name = original[len(lit):]
                used_prefix = lit
                break

        if new_name is None:
            for dash in dash_strips:
                if original.startswith(dash):
                    new_name = original[len(dash):]
                    used_prefix = dash
                    break

        if new_name is None or new_name == original or not new_name:
            continue

        frappe.db.set_value(
            "Item", item.name, "item_name", new_name, update_modified=False
        )
        updated += 1
        by_prefix[used_prefix] = by_prefix.get(used_prefix, 0) + 1

    frappe.db.commit()

    print(f"Done. Updated item_name on {updated} Items.")
    for p, c in sorted(by_prefix.items(), key=lambda x: -x[1]):
        print(f"  {p!r}: {c}")

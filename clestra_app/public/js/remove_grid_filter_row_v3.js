// Clestra: kill the grid header filter/search row entirely — except inside
// Project Billing Master's `detail_bom_items` table field, where the filter
// row stays visible for searching the BOM line items.
//
// Layers:
//   1. CSS hides .filter-row visually (with an exception for detail_bom_items).
//   2. MutationObserver removes .filter-row from the DOM the moment it is
//      inserted, again skipping detail_bom_items.

(function () {
	"use strict";

	function isAllowed(el) {
		// Allow .filter-row to live inside the detail_bom_items table field.
		return !!el.closest('[data-fieldname="detail_bom_items"]');
	}

	function killOne(el) {
		if (isAllowed(el)) return false;
		const heading = el.closest(".grid-heading-row");
		if (heading) heading.classList.remove("with-filter");
		el.remove();
		return true;
	}

	function killFilterRows(root) {
		root = root || document;
		if (!root.querySelectorAll) return;
		for (const el of root.querySelectorAll(".filter-row")) {
			killOne(el);
		}
	}

	function startObserver() {
		if (window.__clestra_filter_row_observer) return;
		const observer = new MutationObserver(function (mutations) {
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (node.nodeType !== 1) continue;
					if (node.classList && node.classList.contains("filter-row")) {
						killOne(node);
						continue;
					}
					if (typeof node.querySelectorAll === "function") {
						for (const inner of node.querySelectorAll(".filter-row")) {
							killOne(inner);
						}
					}
				}
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		window.__clestra_filter_row_observer = observer;
	}

	function init() {
		killFilterRows(document);
		startObserver();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}

	if (typeof $ === "function") {
		$(document).on("app_ready form-load form-render", function () {
			killFilterRows(document);
		});
	}
})();

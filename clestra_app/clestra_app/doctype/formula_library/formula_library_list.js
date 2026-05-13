frappe.listview_settings["Formula Library"] = {
	onload: function (list_view) {
		// Frappe core's shift+click range selection builds a selector using
		// `encodeURIComponent(name)`, but the DOM stores raw `data-name`.
		// Any doc whose name contains space/`/`/`?`/`,`/unicode etc. fails to
		// match, so only URL-safe names get checked in the range. Fix it by
		// handling shift+click on the capture phase with raw-name matching.
		list_view.$result[0].addEventListener(
			"click",
			(e) => {
				const cb = e.target.closest(".list-row-checkbox");
				if (!cb || !e.shiftKey) return;

				const cursor = list_view.$checkbox_cursor;
				if (!cursor || cursor[0] === cb) return;

				const name_cursor = cursor[0].getAttribute("data-name");
				const name_target = cb.getAttribute("data-name");
				const idx_1 = list_view.data.findIndex((d) => d.name === name_cursor);
				const idx_2 = list_view.data.findIndex((d) => d.name === name_target);
				if (idx_1 < 0 || idx_2 < 0) return;

				const [lo, hi] = idx_1 < idx_2 ? [idx_1, idx_2] : [idx_2, idx_1];
				const between = new Set(
					list_view.data.slice(lo + 1, hi).map((d) => d.name)
				);

				list_view.$result.find(".list-row-checkbox").each(function () {
					if (between.has(this.getAttribute("data-name"))) {
						this.checked = true;
					}
				});
			},
			true
		);
	},
};

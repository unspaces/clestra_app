frappe.provide("clestra.patches");

clestra.patches.patch_set_standard_filter = function () {
	const BaseList = frappe.views && frappe.views.BaseList;
	if (!BaseList || !BaseList.prototype.set_standard_filter) return;
	if (BaseList.prototype._clestra_patched_set_standard_filter) return;

	const original = BaseList.prototype.set_standard_filter;

	BaseList.prototype.set_standard_filter = function (filters) {
		if (Array.isArray(filters)) {
			filters = filters.map((f) => {
				if (Array.isArray(f) && f[2] === "like" && typeof f[3] === "string") {
					const stripped = f[3].replace(/^%+|%+$/g, "");
					return [f[0], f[1], f[2], stripped, ...f.slice(4)];
				}
				return f;
			});
		}
		return original.call(this, filters);
	};

	BaseList.prototype._clestra_patched_set_standard_filter = true;
};

$(document).on("app_ready startup", clestra.patches.patch_set_standard_filter);
clestra.patches.patch_set_standard_filter();

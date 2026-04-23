(function () {
	"use strict";

	const MIN_VISIBLE = 40;

	function attachDrag($modal) {
		const $dialog = $modal.find(".modal-dialog").first();
		const $header = $modal.find(".modal-header").first();
		if (!$dialog.length || !$header.length) return;
		if ($header.data("clestra-draggable")) return;
		$header.data("clestra-draggable", true);

		const dialogEl = $dialog[0];
		const headerEl = $header[0];
		const modalEl = $modal[0];

		headerEl.style.cursor = "move";
		headerEl.style.touchAction = "none";
		headerEl.style.userSelect = "none";

		let dragging = false;
		let startPX = 0, startPY = 0;
		let startLeft = 0, startTop = 0;
		let minLeft = 0, maxLeft = 0, minTop = 0, maxTop = 0;
		let width = 0, height = 0;
		let activePointerId = null;

		function onPointerDown(e) {
			if (e.button !== undefined && e.button !== 0) return;
			if (e.target.closest(".modal-actions, button, a, input, select, textarea")) {
				return;
			}

			const rect = dialogEl.getBoundingClientRect();
			startLeft = rect.left;
			startTop = rect.top;
			width = rect.width;
			height = rect.height;

			startPX = e.clientX;
			startPY = e.clientY;

			minLeft = 0;
			maxLeft = window.innerWidth - MIN_VISIBLE;
			minTop = 0;
			maxTop = window.innerHeight - MIN_VISIBLE;

			dialogEl.style.transition = "none";
			dialogEl.style.margin = "0";
			dialogEl.style.position = "fixed";
			dialogEl.style.left = startLeft + "px";
			dialogEl.style.top = startTop + "px";
			dialogEl.style.width = width + "px";
			dialogEl.style.willChange = "left, top";

			headerEl.style.position = "static";
			modalEl.style.overflow = "hidden";
			document.body.style.userSelect = "none";

			dragging = true;
			activePointerId = e.pointerId;
			try { headerEl.setPointerCapture(e.pointerId); } catch (_) {}

			headerEl.addEventListener("pointermove", onPointerMove);
			headerEl.addEventListener("pointerup", onPointerUp);
			headerEl.addEventListener("pointercancel", onPointerUp);

			if (e.cancelable) e.preventDefault();
		}

		function onPointerMove(e) {
			if (!dragging || e.pointerId !== activePointerId) return;
			const dx = e.clientX - startPX;
			const dy = e.clientY - startPY;
			let left = startLeft + dx;
			let top = startTop + dy;
			if (left < minLeft - width + MIN_VISIBLE) left = minLeft - width + MIN_VISIBLE;
			else if (left > maxLeft) left = maxLeft;
			if (top < minTop) top = minTop;
			else if (top > maxTop) top = maxTop;
			dialogEl.style.left = left + "px";
			dialogEl.style.top = top + "px";
		}

		function onPointerUp(e) {
			if (e.pointerId !== activePointerId) return;
			dragging = false;
			activePointerId = null;
			try { headerEl.releasePointerCapture(e.pointerId); } catch (_) {}
			dialogEl.style.willChange = "";
			dialogEl.style.transition = "";
			headerEl.style.position = "";
			modalEl.style.overflow = "";
			document.body.style.userSelect = "";
			headerEl.removeEventListener("pointermove", onPointerMove);
			headerEl.removeEventListener("pointerup", onPointerUp);
			headerEl.removeEventListener("pointercancel", onPointerUp);
		}

		function reset() {
			dragging = false;
			activePointerId = null;
			dialogEl.style.position = "";
			dialogEl.style.left = "";
			dialogEl.style.top = "";
			dialogEl.style.margin = "";
			dialogEl.style.width = "";
			dialogEl.style.willChange = "";
			dialogEl.style.transition = "";
			dialogEl.style.transform = "";
			headerEl.style.position = "";
			modalEl.style.overflow = "";
			document.body.style.userSelect = "";
		}

		headerEl.addEventListener("pointerdown", onPointerDown);
		$modal.data("clestra-drag-reset", reset);
	}

	$(document).on("shown.bs.modal", function (e) {
		attachDrag($(e.target));
	});

	$(document).on("hidden.bs.modal", function (e) {
		const reset = $(e.target).data("clestra-drag-reset");
		if (reset) reset();
	});
})();

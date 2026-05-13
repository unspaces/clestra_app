# Upstream Drift Inventory

Files in `apps/frappe/` or `apps/erpnext/` that intentionally differ from
the upstream pristine version because the change can't be cleanly migrated
to clestra_app (e.g., Vue files compiled at build time).

These should be re-applied if the Frappe/ERPNext version is updated.

## Frappe

### `frappe/public/js/form_builder/components/controls/FetchFromControl.vue`

**Why drift:** Vue SFC compiled into `desk.bundle.js` at build time;
runtime monkey-patching isn't practical.

**Diff summary:**
- Adds null/undefined guards when splitting `props.value` on `.`.
- Suppresses emit of an empty string `""` when current value is already
  falsy (prevents reactive churn that resets the field unexpectedly).

**Bug?** Yes — this is a genuine fix for an upstream bug. Candidate for
upstream PR.

**Effort to migrate properly:** N/A (file is compiled). Either keep the
drift, or upstream the fix.

---

## Wave 1 Trade-offs (intentional behavior loss)

### `.ellipsis` global 2-line truncate — DROPPED

**Original Clestra change** (in `frappe/public/scss/desk/global.scss`):

```scss
.ellipsis {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    word-break: break-word;
    // (instead of upstream's `white-space: nowrap`)
}
```

**Why dropped:** Applying `display: -webkit-box` + `white-space: normal`
globally to every `.ellipsis` element broke listview row layout — text in
columns overlapped vertically because rows have a fixed 40 px height
that no longer accommodated the 2-line content.

**Re-introduction guidance:** if 2-line ellipsis is needed in a specific
context (form field, dialog body, dashboard card), scope it narrowly:

```css
/* Apply only to form sections, not listviews */
.frappe-control .ellipsis,
.form-section-heading .ellipsis {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    word-break: break-word;
}
```

### `.ellipsis` website word-break (CJK readability) — DROPPED

**Original Clestra change** (in `frappe/public/scss/website/index.scss`):

- Changed web `.ellipsis` to use `word-break: keep-all; overflow-wrap: break-word; white-space: normal`.

**Why dropped:** Tied to the same global `.ellipsis` namespace; same
listview-breakage risk if the desk and web bundles ever share a layout.
If CJK wrap is needed in a web page, add a per-page or per-template
stylesheet instead.

---

(Append new drift entries here as they arise.)

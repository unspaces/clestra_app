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

## ERPNext

### `erpnext/public/js/bom_configurator/bom_configurator.bundle.js`

**Why drift:** The BOM Creator tree widget UI (drag/drop, tree label
rewriting, hardware/leaf/panel field handling). +1117 lines vs
upstream v15.29.0. Mass-redefines `erpnext.bom.BomConfigurator`.

**Why not migrated to clestra_app:**
- `apps.txt` order is **frappe → clestra_app → erpnext**, so any class
  override in `app_include_js` from clestra_app is overwritten when
  erpnext's bundle runs after.
- Deferring via `$(document).ready` would work but adds a race-condition
  surface and needs end-to-end test coverage we don't have yet.
- The Clestra version is so divergent that a clean subclass approach
  isn't practical — it's effectively a different widget.

**Workaround:** keep direct edits; re-apply manually on ERPNext upgrade.

### Frappe `tree.js` / `treeview.js` / `treeview.py` / `tree.scss`

**Why drift (committed only — no current local edits):** The Frappe tree
widget was modified to integrate BOM Creator semantics (`idx`,
`parent_row_no`) for node identity and child loading. The mods cross
the Frappe ↔ ERPNext boundary and aren't easy to localize.

- `frappe/public/js/frappe/ui/tree.js` — 120-line diff vs v15.33.0.
  `get_nodes(value, idx, is_root)`, `get_all_nodes(...)`, `idx`-based
  node lookup, `render_children_of_all_nodes` using `parent_row_no`.
- `frappe/public/js/frappe/views/treeview.js` — 47-line diff.
- `frappe/desk/treeview.py` — 77-line diff.
- `frappe/public/scss/desk/tree.scss` — 9-line diff (visual).

**Why not migrated:** would require either patching Frappe's tree widget
at runtime (fragile) or shipping a clestra_app tree widget that BOM
Creator references explicitly (large rewrite).

**Workaround:** keep direct edits; re-apply manually on Frappe upgrade.

### `erpnext/manufacturing/doctype/bom_creator/*` — migrated to clestra_app

The server logic (`bom_creator.py`, `bom_creator_item.py`), form script
(`bom_creator.js`), and Custom Fields (80 on BOM Creator + 78 on
BOM Creator Item) **are now migrated** into clestra_app:

- `clestra_app/overrides/bom_creator/bom_creator.py` — BOMCreator class
  override via `override_doctype_class`; 11 whitelisted module-level
  functions exposed via `override_whitelisted_methods`.
- `clestra_app/overrides/bom_creator/bom_creator_item.py` — BOMCreatorItem
  class override.
- `clestra_app/public/js/bom_creator.js` — wired via `doctype_js`.
- `clestra_app/patches/add_bom_creator_custom_fields.py` — 158 Custom
  Fields.

The ERPNext-side `.json` / `.py` / `.js` files are restored to upstream.
The only remaining ERPNext drift is the bundle.js noted above.

---

(Append new drift entries here as they arise.)

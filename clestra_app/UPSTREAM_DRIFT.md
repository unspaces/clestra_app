# Upstream Drift Inventory

Files in `apps/frappe/` or `apps/erpnext/` that intentionally differ from
the upstream pristine version because the change can't be cleanly migrated
to clestra_app (e.g., Vue files compiled at build time).

These should be re-applied if the Frappe/ERPNext version is updated.

## Frappe

### SCSS / CSS migrations (Wave 13, 2026-05-14)

Four Frappe core CSS/SCSS files had inline Clestra customizations now
replaced by `app_include_css` files in clestra_app. The Frappe sources
are restored to upstream-pristine v15.33.0.

| File | Drift | clestra_app equivalent |
|---|---|---|
| `frappe/public/css/bootstrap.css` | `@media print { .no-word-break { word-break: keep-all; white-space: normal; } }` | `public/css/frappe_overrides_v3.css` — same rule, scoped to `@media print` |
| `frappe/public/scss/desk/global.scss` | `.ellipsis` with 2-line clamp via `-webkit-box` + `word-break: break-word` | (Wave 1 trade-off — DROPPED, see entry above). Restored upstream `white-space: nowrap` |
| `frappe/public/scss/website/index.scss` | `.ellipsis` with `word-break: keep-all` + `white-space: normal` for CJK | (Wave 1 trade-off — DROPPED). Restored upstream |
| `frappe/public/scss/common/grid.scss` | (4 separate customizations, -76 lines) | `public/css/grid_overrides_v15.css` |

`grid.scss` breakdown:
- Flexible row heights (`min-height: 32px; height: auto; max-height: 50px`)
  → `grid_overrides_v15.css` section 2 (`.form-grid .grid-row .grid-static-col ...`)
- `.qty-bracket` pseudo-elements rendering "(123)" around qty
  → `grid_overrides_v15.css` section 3
- `.no-word-break` desk-wide utility class
  → `grid_overrides_v15.css` section 4
- `.grid-overflow-no-ellipsis { word-break: keep-all }` for CJK columns
  → `grid_overrides_v15.css` section 5
- Touch-area expansion `::before` on `.toggle-sub-items` — DROPPED
  (minor UX nicety, not migrated)
- Heading `.no-word-break` print-media duplicate of bootstrap.css rule — DROPPED
  (same rule lived in 2 files; one copy now lives in frappe_overrides_v3.css)

### Form core JS migrations (Wave 12, 2026-05-14)

Six Frappe core files had inline Clestra customizations that have now
been replaced by clestra_app monkey-patches loaded via `app_include_js`.
The Frappe files are restored to upstream-pristine v15.33.0.

| File | Drift summary | clestra_app equivalent |
|---|---|---|
| `frappe/hooks.py` | `check_for_update` was commented out of weekly scheduler | none — restored. Weekly update check now fires (cosmetic notice only) |
| `form/dashboard.js` | `colspan = 22 / n_indicators` (Bootstrap has no col-22 — was effectively broken) | none — restored to upstream `colspan = 12 / n_indicators` |
| `form/form.js` | `div_class = "col-md-30"` (Bootstrap has no col-md-30 — was effectively broken) | none — restored to upstream `col-md-12` |
| `model/create_new.js` | `newdoc.__newname = doc.name + "-Copy"` to auto-name copied docs | `public/js/copy_doc_autoname_v1.js` — wraps `frappe.model.copy_doc` with the same suffix |
| `form/grid.js` | `show_search: false` + defensive throw/log around docfield lookup | `public/js/remove_grid_filter_row_v3.js` — CSS hides `.filter-row` + MutationObserver removes it from DOM (with exception for PBM `detail_bom_items`) |
| `form/formatters.js` | Float/Int formatter branches that append `stock_uom` when `docfield.options === "qty"` | `public/js/formatters_qty_uom_v1.js` — `withQtyUom` wraps `frappe.form.formatters.Float` and `.Int` |

All three patch files are registered in `clestra_app/hooks.py`
`app_include_js`. Idempotent — each guards re-application with a
`__clestra_*_patched` flag.

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

### `erpnext/public/js/utils.js` — Item indent prefix moved to per-doctype handlers

**Original drift:** `frappe.form.link_formatters["Item"]` had a branch
that, when `doc.indent_level > 0`, prepended `└ ` plus full-width spaces
to the rendered item_code. This made BOM/Production Plan-style nested
displays visible in any grid that rendered Item link cells.

**Why restore:** the same effect is now produced more cleanly by
per-doctype DOM handlers in clestra_app, each of which paints a `↳`
prefix and `padding-left` on the static-area span of indented grid rows.
The global link_formatter approach also painted indent on item lookups
that shouldn't show them (e.g. report filters, autocomplete results).

**Where indent visualization lives now:**
- Project Billing Master (items, sub_items, panel_cover, door_cover,
  detail_bom_items): `apply_po_items_indent_display()` in
  `clestra_manufacturing/doctype/project_billing_master/project_billing_master.js`
  — wraps `grid.refresh` and paints `.po-indent-prefix` spans.
- BOM Creator (items): `_apply_bom_creator_indent()` in
  `public/js/bom_creator_indent.js` (loaded via `app_include_js`).
  Mirrors the PBM pattern with `.bom-indent-prefix` span.
- Clestra Sales Order (finished_items): class-based — adds
  `is-parent-row` / `is-child-row` / `is-sub-2` classes to grid rows
  for CSS-driven indent + grouping. No `↳` prefix; visual separation
  is via color/border instead.

**Data verification (eclestra 2026-05-14):**
- BOM Item: 0 rows with `indent_level > 0` (zero impact)
- PBM Item: 534 rows (covered by `apply_po_items_indent_display`)
- PBM Sub Item: 21,453 rows (covered by sub_items grid.refresh wrapper)
- BOM Creator Item: 10,459 rows (covered by `bom_creator_indent.js`)
- Sales Order Finished Items: 120 rows (covered by class-based CSS)
- Quotation Item: 0 rows (zero impact)

**If BOM doctype gains indented items in the future:** add a small
`bom_indent.js` mirroring `bom_creator_indent.js` (or generalize that
file to handle multiple doctypes) and register in `app_include_js`.
Don't reintroduce the utils.js drift.

### `erpnext/hooks.py` — known upstream bug worked around in clestra_app

**Upstream bug (ERPNext v15.29.0):** the `daily` scheduler entry points at
`erpnext.assets.doctype.asset.asset_maintenance_log.update_asset_maintenance_log_status`
but the actual module is at
`erpnext.assets.doctype.asset_maintenance_log.asset_maintenance_log` (the
DocType is its own folder, not under `asset/`).

**Effect:** `bench migrate` logs `ImportError: No module named
'erpnext.assets.doctype.asset.asset_maintenance_log'` once per day at the
scheduled time. Daily scheduler keeps going — other jobs still run.

**Workaround:** `clestra_app/hooks.py` registers the correct path in its own
`scheduler_events.daily`. Both fire daily — upstream's raises, clestra's
runs. Log noise but functionally correct.

**Why not fix in apps/erpnext:** keeping a 1-line drift fix in ERPNext also
works, but the workaround keeps ERPNext fully pristine for safer upgrades.
Remove this entry from clestra_app/hooks.py once upstream fixes the typo.

### `erpnext/templates/includes/footer/footer_extension.html` — dormant

The file is in the upstream tree but no `{% include %}` references it
anywhere in frappe/erpnext/hrms/payments. Restoring upstream's "uncommented"
state vs Clestra's "commented out" state has no visible effect. Kept clean
for cleanliness, no clestra_app override needed.

### `frappe/website/website_theme/standard/standard.json` — kept as drift

**Why drift:** Restoring upstream's older snapshot of the Standard Website
Theme reverts:
- `theme_url`: `/files/website_theme/standard_style.css` (current,
  Frappe v15-generated) → `/assets/css/standard_style.css` (older path
  that doesn't exist in this site).
- `theme_scss`: drops the `@import "erpnext/public/scss/website"` line
  the site relies on.
- `ignored_apps`, `js`: fields added in newer Frappe versions.

**Effect of restoring:** `bench migrate` would write the broken
`theme_url` into the DB record, the website would then fail to load
CSS, and the rendered pages would lose the ERPNext-augmented styles.

**Workaround:** Keep this file at HEAD. The drift is a stale snapshot of
modern Frappe behavior in a file that pre-Wave was just out of sync with
upstream, not a Clestra customization per se. Revisit once Frappe v16 is
adopted or if a clean Website Theme record can be sourced.

### `erpnext/.gitignore` — site-specific entries moved to bench root (Wave 14, 2026-05-15)

Previously had Clestra-specific entries that didn't belong in a per-app
gitignore: `sites/eclestra/public/files/`, `sites/*/private/backups/`,
`chromium/`, `env/`, etc. Restored to upstream-pristine. Equivalent
patterns already live in `/home/frappe/frappe-bench/.gitignore` (bench
root) which covers the entire workspace.

### `erpnext/projects/dashboard_chart/project_summary/project_summary.json` — `is_public` reset

Clestra previously set `is_public: 0` (chart hidden from non-System workspaces).
Restoring upstream brings it back to `is_public: 1`. Effect: Project Summary
chart appears on Projects workspace for all users. Acceptable for most
Clestra users; if hiding is needed later, set via Customize Dashboard.

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

# Migration Lessons — BOM Creator Wave (2026-05-13)

This wave required far more reactive fixing than expected. Capturing the
root causes here so the same shape of pain doesn't recur on the next
override-with-drift wave (Production Plan, BOM, etc.).

## What actually went wrong

The lift-and-shift of `bom_creator.py` / `bom_creator.js` was textually
correct, and on clean operational data the migrated code worked. The
cascade of fixes that followed came from four distinct sources, in
this rough proportion:

1. **Drift-boundary state coupling (≈45%)**
   We kept `bom_configurator.bundle.js` and the Frappe tree widget
   (`tree.js`, `treeview.js`, `treeview.py`, `tree.scss`) as drift. The
   bundle calls `_bom_reload_tree()` after every server-mutating RPC,
   which under the hood calls `tree.load_children(root, true)`. The
   Clestra-modified `render_children_of_all_nodes` in `tree.js` does
   `root.$ul.empty()` and re-creates top-level `<li>`s — the bundle's
   `onrender` hook is supposed to re-add the condition pills, but
   doesn't fire reliably enough in the deep-load path. We can't change
   the bundle (drift) or the tree widget (drift), so we had to
   monkey-patch `tree.load_children` from clestra_app to (a) intercept
   the deep-from-root pattern, (b) rebuild the whole BOMConfigurator
   instead of going through render_children_of_all_nodes, and
   (c) re-expand the captured node set after the rebuild.

2. **Data corruption created during my own testing (≈25%)**
   While testing duplicate → delete-with-children flows, the original
   delete recursion (which had a `get_children` `parent_row_no = "None"`
   string-filter bug) succeeded at deleting parents but missed grandchildren.
   The leftover grandchildren had `fg_reference_id=NULL` pointing at
   nothing — orphans. Every subsequent operation then hit
   `validate_items` throwing "At row N: set Parent Row No for item …".
   The fix was a self-heal pass in `reorder_items_hierarchically` that
   promotes orphans back to top-level and normalises their `fg_item`.
   On the operational data the user runs day-to-day, this code path
   was not hit because no orphans existed.

3. **Second-order bugs I introduced trying to fix (1) and (2) (≈20%)**
   The most consequential one: I swapped `add_item` / `add_sub_assembly`
   from `save → reorder → save` to `reorder → save`, thinking it
   would let reorder repair stale data before validate ran. But Frappe's
   `Document.set_new_name` only assigns names to freshly-appended child
   rows DURING the first `save()`. Before save, those new rows have
   `name = None`. `renumber_and_update_parent_links` keyed its parent-ref
   lookup by `item.name`, so the new rows fell out of the dict and got
   their `parent_row_no` blanked to None — which then tripped
   `validate_items`. Original order didn't have this problem because the
   first `save()` named the rows before reorder ran. Required a
   second fix (renumber falls back to `item.fg_reference_id` when
   `item.name` is missing) to undo the damage.

4. **UX expectations that came up during integration (≈10%)**
   Single-node refresh on `edit_conditions`, layout reflow suppression
   on rebuild (lock `$parent` min-height), Expand All without
   collapse-then-expand flicker, tree-state preservation across saves —
   none of these were strict migration bugs; the original code didn't
   handle them either, but the user noticed them now that we were
   actively touching the widget.

## What the upfront analysis missed

- **The drift boundary is a state-management contract, not just code
  that lives elsewhere.** Listing "bundle.js stays as drift" wasn't
  enough; we should have traced every server RPC call site to its
  client-side callback and mapped what tree-state changes it triggers.
  That would have shown `_bom_reload_tree`'s deep load was a problem
  before user testing surfaced it.
- **Frappe's Document save lifecycle.** `set_new_name` assigning child
  names mid-save is the kind of framework invariant that the migrated
  code relied on implicitly. Lift-and-shift "preserves behavior" only
  if you also preserve the call order around `save()`. We should have
  flagged the `save → reorder → save` sequence as load-bearing and not
  reordered it.
- **The previous deployment's data state was the baseline, not the
  source code.** Operational data was clean. The migration testing
  itself (failed deletes leaving orphans) was what produced the
  stale state that exercised the long-quiet branches in the helpers.
  Subsequent failures looked like "original code bugs" but were really
  "data we corrupted ourselves" + "branches that were latent because
  nobody had bad data before."

## Checklist for the next override-with-drift wave

Apply this before kicking off Production Plan / BOM / similar migrations:

1. **Map the RPC ↔ tree-state callback graph for the drift bundle.**
   For each whitelisted server method we redirect, list:
   - Which JS function calls it
   - What its `callback:` does to tree/form state (`_bom_reload_tree`,
     `frm.refresh`, manual DOM ops, …)
   - Which tree-widget method that callback invokes and what side-effects
     that has on existing nodes (pills, $ul visibility, idx-based lookup
     in `tree.nodes`, etc.)

2. **Identify load-bearing call orderings in the original code.**
   For each function that does
   `mutate → save → repair → save` (or any other multi-step
   integrity dance), note WHY. Document each `save()` site as either
   "validation gate" (don't move) or "persistence" (movable). Don't
   refactor these orderings unless you've proven the validation
   contract still holds.

3. **Treat `frappe.call`-style monkey patches as global state.**
   Always pass `(...args)` through verbatim. Both object form
   `frappe.call({method, args, callback})` and shorthand
   `frappe.call("method", args, callback)` are in active use across
   Frappe/ERPNext; dropping the second arg silently breaks listviews.

4. **Snapshot a known-clean state of the operational data before
   any migration testing.** If we have to repair stale data later,
   start from the snapshot so we know which corruption was already
   there vs. created by our test runs.

5. **Run an explicit UI smoke matrix on a non-trivial document before
   declaring the wave done.** For BOM Creator that matrix would have
   been: open → expand all → collapse → edit qty/conditions/values →
   add item to root / non-root → add sub-assembly to leaf / internal →
   delete leaf / non-leaf / with children / without children → duplicate
   leaf / internal → save. Half of the fixes in this wave would have
   surfaced before commit.

6. **Don't accept "lift-and-shift preserves behavior" without testing
   the previously-quiet code paths.** Defensive branches (orphan
   handling, recursion termination, empty-data renders) are exactly
   the ones that go untested in production and break first under
   migration.

7. **Inventory list-view & form-layout Property Setters before
   declaring the wave done.** Property Setters created via Customize
   Form UI live only as DB rows and are invisible to the Wave's
   "restore upstream JSON + write Custom Field patch" loop. If they
   aren't codified into a `add_<doctype>_property_setters.py` patch,
   they vanish on fresh installs and silently degrade the UX (missing
   search-filter chips, wrong list columns, narrow grid widths,
   `allow_rename` lost, etc.). For each doctype in the wave:

   ```sql
   SELECT doc_type, field_name, property, property_type, value
   FROM `tabProperty Setter`
   WHERE doc_type IN ('<DocType>', '<Child DocType>')
   ORDER BY doc_type, field_name, property;
   ```

   Categorize each row:
   - **Field-level** (`doctype_or_field='DocField'`,
     `field_name` set): `in_standard_filter`, `in_list_view`,
     `length` (column width), `options`, `default`, `read_only`, etc.
   - **DocType-level** (`doctype_or_field='DocType'`,
     `field_name=NULL`): `allow_rename`, `naming_rule`, `autoname`,
     `states`, etc. These are the easiest to miss because they
     don't appear in field-by-field comparisons.

   Pattern for the patch: see
   [add_bom_creator_property_setters.py](clestra_app/patches/add_bom_creator_property_setters.py)
   — separate `_ensure_field_property_setter()` /
   `_ensure_doctype_property_setter()` helpers, idempotent
   (update-if-different-value, skip-if-equal), commit + clear_cache
   at the end. Wave 7 found 9 DB-only field-level + 1 doctype-level
   PSes for BOM Creator that were silent and only surfaced during
   post-Wave verification.

---

(Append new drift entries here as they arise.)

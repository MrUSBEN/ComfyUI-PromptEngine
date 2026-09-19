# ComfyUI-PromptEngine

A ComfyUI custom node that generates varied, logically consistent image prompt variables instead of flat random ones. It picks genre, location, action, characters, camera, lighting, and more using a tag system that stops nonsensical combos (like desert gear showing up underwater) — then hands you a batch of ready-to-use variable dumps you can feed into your own LLM prompt-writer.

## What it does

- Runs an 8-step pipeline (genre → location → action → character → camera → environment → lighting → medium), where each step's picks are filtered by tags so later choices stay consistent with earlier ones.
- Generates as many variations as you want in one run (`count`), returned as a proper list you can index into downstream.
- Handles multiple characters automatically — solo, duo, or group actors each get their own outfit/condition/expression fields.
- Comes with a base dataset of ~590 hand-written items across 19 categories, a portion of which are already hand-tagged with real `required_tags`/`exclude_tags` cross-references (see the Changelog).
- Includes a full in-node editor — dataset CRUD, batch tools, taxonomy management, a pipeline visualizer, export/import for sharing or backing up custom lists, and optional local-LLM assistance — so you rarely need to touch the underlying JSON files by hand.
- Your customized dataset lives in a gitignored `data/` folder, bootstrapped once from tracked defaults — pulling future updates to this repo never overwrites your own edits.

## Installing

1. Download/unzip this into your ComfyUI custom nodes folder, so the path looks like:
   ```
   ComfyUI/custom_nodes/ComfyUI-PromptEngine/
   ```
2. Restart ComfyUI.
3. Add the **"Prompt Engine"** node to your graph (search for it, or find it under the "Prompt Engine" category).

## Using the node

The node has no inputs — just three settings:

| Setting | What it does |
|---|---|
| `seed` | Controls randomness. Same seed + count = same batch every time. |
| `count` | How many prompt variations to generate in one run. |
| `wildcard_rate` | Chance (0–1) that any given pick ignores the filters and goes fully random, for happy accidents. Default is 10%. |

It outputs a **list** of text blocks (one per generated variation) plus the same data as a JSON string. Wire the list output into whatever indexing/loop node you're using downstream to pull items out one at a time.

## Editing the dataset

Click **"📝 Edit Dataset"** on the node to open the editor — no file editing required:

- **Browse & edit** any of the 19 lists, add/edit/delete items individually, or select multiple rows with the checkboxes for bulk editing/deleting.
- **Unified tag editor** — every tag-editing screen (single item, batch add, bulk edit) shows one list per taxonomy tag with a `— / Tag / Req / Excl` toggle, instead of three separate duplicated lists.
- **Batch Add** — paste a bunch of new item names at once (one per line or comma-separated), either apply shared tags to all of them, or let a local LLM suggest tags per item for you to review.
- **Export / Import** — export any list (or a full backup) as a portable JSON bundle to share with others or back up; importing runs a duplicate check against your existing data (by ID and by a combined name+tag similarity) so you only need to review genuinely ambiguous items, not re-approve everything.
- **Manage Taxonomy** — add, rename, or delete the tags themselves. Renaming/deleting shows exactly which items are affected before anything changes, and both are fully undoable.
- **Pipeline view** — click "Pipeline" on any item to see where it sits in the 8-step chain and which other steps its tags affect.
- **Undo** — every change (single, batch, or taxonomy edit) can be undone from the relevant panel's footer.
- **LLM Settings** — optionally point the editor at a local LLM (LM Studio, Ollama, or any OpenAI-compatible endpoint) to get tag/required/exclude suggestions instead of tagging everything by hand.

## How the tag system works, briefly

Each item has three tag fields:
- `tags` — what it is (contributes to later filtering).
- `required_tags` — only shows up if at least one of these tags is already active from an earlier step.
- `exclude_tags` — blocks any later item that carries one of these tags.

You don't need to touch this to use the node — it's only relevant if you're adding your own items and want them to interact correctly with the rest of the dataset. The taxonomy editor's tag picker prevents typos and duplicate tags for you either way, and the "Req"/"Excl" options are automatically disabled per-tag if that tag isn't actually producible earlier/later in the pipeline for the list you're editing.

## Changelog

<details>
<summary><strong>Click to expand — full history of every feature and fix</strong></summary>

<br>

**v1.0 — Core engine**
- Single no-input ComfyUI node with `seed`/`count`/`wildcard_rate` widgets.
- 8-step tag-filtered selection pipeline (genre → location → action → character → camera → environment → lighting → medium).
- Multi-character support: actors carry a `character_count` field, and outfit/condition/expression loop per character for duo/group picks.
- Base dataset generated: 19 lists, 587 items total, each following the `id`/`name`/`tags`/`required_tags`/`exclude_tags` schema.
- Fixed a list-output bug (`OUTPUT_IS_LIST` wasn't set) that caused downstream indexer nodes to receive the whole batch wrapped as a single item instead of a real list.

**v1.1 — Dataset editor**
- In-node "📝 Edit Dataset" button opening a full CRUD editor: add, edit, delete items per list.
- Tag picker constrained to the taxonomy — no free-text tag entry, so typos and duplicate tag names are structurally impossible.
- Live validator: duplicate IDs, missing fields, empty-tag warnings, and "unreachable tag" warnings (a `required_tags`/`exclude_tags` value nothing in the dataset ever produces).
- Dropdown reordered to match true pipeline execution order instead of the original spec's section grouping.

**v1.2 — Batch tools & undo**
- **Batch Add** (flood-fill): paste multiple item names at once, comma- or newline-separated, apply shared tags to all of them in one save.
- Checkboxes on every row for multi-select; bulk **"Edit tags on selected"** (add or remove) and **"Delete selected."**
- Full **undo system** covering single edits, batch add, batch edit, and batch delete — a 25-entry history stack, reset per list.
- Save/Cancel/Apply rows duplicated at both the top and bottom of every panel with a long tag list, so you're never stuck scrolling to find the button.

**v1.3 — Taxonomy management & pipeline visualizer**
- **"🏷️ Manage Taxonomy"** panel: add new tags or categories, with an exact-duplicate check (blocking) and a fuzzy-similarity check (warns, requires confirmation) to stop near-duplicate tags like `coast` vs `coastal`.
- **Rename** and **delete** tags directly from the editor. Both cascade correctly through every item in the dataset that references the tag, not just the taxonomy list itself.
- Delete specifically checks usage first: if a tag is in use anywhere, it shows every affected item (list, item name, which field) and requires an explicit "delete anyway" confirmation.
- Taxonomy undo is snapshot-based — it restores the taxonomy file *and* every dataset file a rename/delete cascaded into, verified with a real rename/cascade/undo round-trip against the live dataset.
- **Pipeline flowchart view**: click "Pipeline" on any item (or preview it while editing) to see the 8-step chain with the current step highlighted, which earlier step supplies each `required_tag`, and which later step each `exclude_tag` would block — including a warning if a chosen tag isn't actually producible in that direction.

**v1.4 — LLM integration**
- **LLM Settings panel**: backend preset dropdown (LM Studio / Ollama / OpenAI / Custom, auto-filling the base URL), API key field, and a model dropdown populated live from the backend — for LM Studio this uses their native `v1` REST API, showing every model on disk and which one is actually loaded, not just the last-used one.
- **Auto-unload toggle** + manual **"Unload now"** button (LM Studio only for now), for limited-RAM setups that can't keep a model resident all the time.
- **Batch Add → "Suggest tags with LLM"** mode: paste names, the model proposes `tags` per item (constrained to the taxonomy — anything outside it is silently dropped and flagged), reviewed and editable before saving.
- **Multi-select → "🪄 LLM Assist"**: proposes `required_tags`/`exclude_tags` for existing items, constrained to only tags that are actually producible earlier/later in the pipeline for that list — the model can't suggest a logically backwards or unreachable constraint even if it tried.
- Large selections are automatically split into batches of 15 items per request, so a big multi-select doesn't send one oversized call.

**v1.5 — Reliability fixes & UI unification**
- Fixed a real bug where a slow or hung LLM request could freeze ComfyUI's entire web server (blocking call inside an async route handler) — LLM calls now run in a background thread, verified with a live test proving the server stays responsive throughout.
- Timeout and connection-refused errors are now distinguishable, with a specific message for each instead of one generic failure.
- Added a configurable request timeout (was previously hardcoded); fixed a bug where the setting displayed as saved but was silently dropped on every save and always reverted to the 60s default.
- **Unified tag editor** rolled out to every tag-editing surface (single item form, Batch Add's shared-tags mode, and bulk "Edit tags on selected") — previously only the LLM Assist review screen had this; the others still showed three duplicated category lists.

**v1.6 — Hand-tagged seed data**
- `genres_list`: 27 of 30 items given real `exclude_tags` (era/climate conflicts — e.g. Tropical Adventure excludes `snow`/`cold`).
- `locations_list`: 22 of 35 items given both `required_tags` and `exclude_tags` (e.g. the space station requires `futuristic`/`sci-fi`; the cathedral requires `ancient`/`medieval`/`vintage`).
- Both directions verified against the live engine with 200–300 trial runs at `wildcard_rate=0`, confirming zero incorrect picks leaked through in either direction.
- This seed data also serves as the few-shot grounding examples the LLM Assist feature uses when suggesting tags for the remaining lists.

**Misc**
- Project folder renamed to `ComfyUI-PromptEngine` to match the repository name.

**v1.7 — Character-count robustness, safe updates, and export/import**
- Fixed a real gap where custom-added `actors_list` items (via the editor form, batch add, or LLM suggest) never got a `character_count` set, silently defaulting to solo behavior regardless of their tags. Now derived automatically from the item's own social-context tag (`solo`→1, `duo`→2, `group`→3, `crowd`→0) whenever it's missing, on every save path — an explicit stored value still always wins if you want to hand-override it.
- **Safe update structure**: the live `data/` folder is now bootstrapped once from a tracked `data_defaults/` folder and then gitignored — a future `git pull` for code/feature updates can never overwrite your customized dataset, verified with a real test simulating an upstream content update against a customized local copy.
- **Export**: per-list export as a self-contained bundle (only the taxonomy tags actually used by that list's items are included, not your whole taxonomy), plus a full-dataset backup export (all 19 lists + full taxonomy).
- **Import**: a three-way diff against your existing data — new items import automatically, exact ID matches are skipped by default, and "possible duplicates" (similar name *and* tag profile) are flagged for a manual decision (skip / merge / import as separate). Taxonomy tags the bundle references that don't exist locally get the same reuse-or-add-as-new choice as the taxonomy manager.
- The duplicate-detection scoring combines name-text similarity with tag-set overlap rather than either alone — pure name matching missed real duplicates worded differently, and naive tag-overlap alone caused false positives between unrelated items sharing common tags. Fixed by requiring name similarity to clear a floor before tag overlap counts; verified against both failure modes plus a 35-item self-import stress test with zero false positives.

</details>

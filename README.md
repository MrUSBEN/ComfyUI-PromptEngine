# Prompt Engine — ComfyUI Node

A ComfyUI custom node that generates varied, logically consistent image prompt variables instead of flat random ones. It picks genre, location, action, characters, camera, lighting, and more using a tag system that stops nonsensical combos (like desert gear showing up underwater) — then hands you a batch of ready-to-use variable dumps you can feed into your own LLM prompt-writer.

## What it does

- Runs an 8-step pipeline (genre → location → action → character → camera → environment → lighting → medium), where each step's picks are filtered by tags so later choices stay consistent with earlier ones.
- Generates as many variations as you want in one run (`count`), returned as a list you can index into.
- Handles multiple characters automatically — solo, duo, or group actors each get their own outfit/condition/expression fields.
- Comes with a base dataset of ~590 hand-written items across 19 categories, ready to use out of the box.
- Includes a full in-node editor so you never have to touch the underlying JSON files by hand.

## Installing

1. Download/unzip this into your ComfyUI custom nodes folder, so the path looks like:
   ```
   ComfyUI/custom_nodes/prompt_engine/
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

- **Browse & edit** any of the 19 lists, add/edit/delete items individually.
- **Batch Add** — paste a bunch of new item names at once (one per line or comma-separated), apply shared tags to all of them in one go.
- **Multi-select** — check off multiple items to bulk-edit or bulk-delete them.
- **Manage Taxonomy** — add, rename, or delete the tags themselves. Renaming/deleting warns you and shows exactly which items will be affected if the tag is currently in use, so you can't accidentally break something without knowing.
- **Pipeline view** — click "Pipeline" on any item to see where it sits in the 8-step chain and which other steps its tags affect.
- **Undo** — every change (single or batch) can be undone from the footer, including taxonomy edits.

## How the tag system works, briefly

Each item has three tag fields:
- `tags` — what it is (contributes to later filtering).
- `required_tags` — only shows up if at least one of these tags is already active from an earlier step.
- `exclude_tags` — blocks any later item that carries one of these tags.

You don't need to touch this to use the node — it's only relevant if you're adding your own items and want them to interact correctly with the rest of the dataset. The taxonomy editor's tag picker prevents typos and duplicate tags for you either way.

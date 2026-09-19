import difflib
from datetime import datetime, timezone

FORMAT_VERSION = 1
NAME_SIMILARITY_FLOOR = 0.60  # names must be at least this similar before tag overlap even counts
SIMILARITY_THRESHOLD = 0.68   # combined score required once the floor is cleared — see diff_items()


def _tags_used_by(items):
    used = set()
    for it in items:
        used.update(it.get("tags", []))
        used.update(it.get("required_tags", []))
        used.update(it.get("exclude_tags", []))
    return used


def build_export_bundle(list_name, items, full_taxonomy):
    """A single-list export. taxonomy_subset only includes categories/tags actually
    referenced by these items, so sharing 10 items doesn't drag your whole taxonomy along."""
    used_tags = _tags_used_by(items)
    subset = {cat: [t for t in tags if t in used_tags] for cat, tags in full_taxonomy.items()}
    subset = {cat: tags for cat, tags in subset.items() if tags}
    return {
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "list_name": list_name,
        "items": items,
        "taxonomy_subset": subset,
    }


def build_full_backup(all_lists, full_taxonomy):
    """A whole-dataset backup: every list plus the complete taxonomy. No subsetting
    needed since it's already everything."""
    return {
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "lists": all_lists,
        "taxonomy": full_taxonomy,
    }


def _similarity(item_a, item_b):
    """Combines name text similarity with tag-set overlap (Jaccard) — but only once the
    names already clear a minimum similarity floor on their own. Without that floor, two
    completely unrelated items that just happen to share a common tag combination (very
    common in a tag-based dataset) could rack up enough Jaccard score to look like a
    duplicate despite having nothing in common by name. Tag overlap is a booster once
    names are already plausibly close — it can't manufacture a match by itself.
    e.g. 'Rain-soaked back alley' vs 'Rain-slicked city alleyway': name ratio 0.71 (clears
    the floor), tag overlap then correctly confirms it as a duplicate.
    'Diving into a tactical dodge roll' vs 'Vaulting over an obstacle': name ratio only
    0.48 (below the floor) despite identical tags — correctly NOT flagged."""
    name_ratio = difflib.SequenceMatcher(None, item_a["name"].lower(), item_b["name"].lower()).ratio()
    if name_ratio < NAME_SIMILARITY_FLOOR:
        return 0.0
    tags_a, tags_b = set(item_a.get("tags", [])), set(item_b.get("tags", []))
    jaccard = len(tags_a & tags_b) / len(tags_a | tags_b) if (tags_a | tags_b) else 0.0
    return 0.5 * name_ratio + 0.5 * jaccard


def diff_items(incoming_items, existing_items):
    """Sorts incoming items into three buckets:
    - new_items: no meaningful overlap with anything existing — safe to auto-import
    - exact_duplicates: identical id already present — skipped by default
    - possible_duplicates: no id match, but a suspiciously similar name+tag profile
      exists — needs a human call
    """
    existing_by_id = {it["id"]: it for it in existing_items}
    new_items, exact_duplicates, possible_duplicates = [], [], []

    for inc in incoming_items:
        if inc["id"] in existing_by_id:
            exact_duplicates.append({"incoming": inc, "existing": existing_by_id[inc["id"]]})
            continue

        best_match, best_score = None, 0.0
        for ex in existing_items:
            score = _similarity(inc, ex)
            if score > best_score:
                best_match, best_score = ex, score

        if best_match and best_score >= SIMILARITY_THRESHOLD:
            possible_duplicates.append({"incoming": inc, "existing": best_match, "similarity": round(best_score, 2)})
        else:
            new_items.append(inc)

    return {"new_items": new_items, "exact_duplicates": exact_duplicates, "possible_duplicates": possible_duplicates}


def diff_taxonomy_subset(incoming_subset, local_taxonomy):
    """For every tag in an imported bundle's taxonomy_subset, figures out whether the
    importer already has it, whether it looks suspiciously like an existing tag under a
    different name, or whether it's genuinely new and safe to add automatically."""
    local_all_tags = set(t for tags in local_taxonomy.values() for t in tags)
    already_have, similar_conflicts, new_tags = [], [], []

    for category, tags in incoming_subset.items():
        for tag in tags:
            if tag in local_all_tags:
                already_have.append(tag)
                continue
            similar = [t for t in local_all_tags if difflib.SequenceMatcher(None, tag, t).ratio() >= 0.75]
            if similar:
                similar_conflicts.append({"tag": tag, "category": category, "similar_to": similar})
            else:
                new_tags.append({"tag": tag, "category": category})

    return {"already_have": already_have, "similar_conflicts": similar_conflicts, "new_tags": new_tags}


def apply_import(incoming_items, incoming_subset, existing_items, local_taxonomy, tag_decisions, item_decisions):
    """Applies a reviewed import: remaps any incoming tags the person chose to treat as
    an existing tag under a different name, adds genuinely new tags to the taxonomy,
    then resolves each item as import / merge / skip per the reviewed decisions.
    Returns (updated_items, updated_taxonomy, summary)."""
    taxonomy = {k: list(v) for k, v in local_taxonomy.items()}
    tag_remap = {}

    diff_tax = diff_taxonomy_subset(incoming_subset, local_taxonomy)
    for tag in diff_tax["already_have"]:
        tag_remap[tag] = tag

    for conflict in diff_tax["similar_conflicts"]:
        tag = conflict["tag"]
        decision = tag_decisions.get(tag, "add_as_new")
        if decision.startswith("use_existing:"):
            tag_remap[tag] = decision.split("use_existing:", 1)[1]
        else:
            taxonomy.setdefault(conflict["category"], [])
            if tag not in taxonomy[conflict["category"]]:
                taxonomy[conflict["category"]].append(tag)
            tag_remap[tag] = tag

    for new in diff_tax["new_tags"]:
        taxonomy.setdefault(new["category"], [])
        if new["tag"] not in taxonomy[new["category"]]:
            taxonomy[new["category"]].append(new["tag"])
        tag_remap[new["tag"]] = new["tag"]

    def remap(item):
        item = dict(item)
        for field in ("tags", "required_tags", "exclude_tags"):
            item[field] = [tag_remap.get(t, t) for t in item.get(field, [])]
        return item

    remapped = [remap(it) for it in incoming_items]
    diff = diff_items(remapped, existing_items)

    updated_items = list(existing_items)
    existing_by_id = {it["id"]: i for i, it in enumerate(updated_items)}
    summary = {"imported": 0, "merged": 0, "skipped": 0}

    def union(a, b):
        seen = []
        for v in list(a or []) + list(b or []):
            if v not in seen:
                seen.append(v)
        return seen

    for item in diff["new_items"]:
        updated_items.append(item)
        existing_by_id[item["id"]] = len(updated_items) - 1
        summary["imported"] += 1

    for dup in diff["exact_duplicates"] + diff["possible_duplicates"]:
        inc, exist = dup["incoming"], dup["existing"]
        decision = item_decisions.get(inc["id"], "skip")
        if decision == "merge":
            idx = existing_by_id[exist["id"]]
            merged = dict(updated_items[idx])
            for field in ("tags", "required_tags", "exclude_tags"):
                merged[field] = union(merged.get(field), inc.get(field))
            updated_items[idx] = merged
            summary["merged"] += 1
        elif decision == "import_as_new":
            new_id = inc["id"]
            if new_id in existing_by_id:
                new_id, suffix = f"{inc['id']}_imported", 2
                while new_id in existing_by_id:
                    new_id = f"{inc['id']}_imported_{suffix}"
                    suffix += 1
            new_item = dict(inc)
            new_item["id"] = new_id
            updated_items.append(new_item)
            existing_by_id[new_id] = len(updated_items) - 1
            summary["imported"] += 1
        else:
            summary["skipped"] += 1

    return updated_items, taxonomy, summary

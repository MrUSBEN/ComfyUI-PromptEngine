import os
import json
import difflib

TAXONOMY_PATH = os.path.join(os.path.dirname(__file__), "data", "taxonomy.json")

DATASET_LISTS = [
    "genres_list", "locations_list", "environmental_props_list", "weather_effects_list",
    "time_period_list", "dynamic_actions_list", "actors_list", "outfits_list",
    "clothing_condition_list", "body_expressions_list", "camera_angles_list",
    "camera_framing_list", "lens_and_fx_list", "key_lighting_list", "secondary_light_list",
    "atmospheric_fx_list", "color_palettes_list", "moods_list", "art_mediums_list",
]  # kept for backward compatibility; __init__.py now sources the pipeline-ordered
   # version from pipeline.py for anything user-facing (dropdowns, etc.)

SIMILARITY_THRESHOLD = 0.75  # difflib ratio above this triggers a "looks similar" warning


def load_taxonomy():
    with open(TAXONOMY_PATH, "r") as f:
        return json.load(f)


def save_taxonomy(taxonomy):
    with open(TAXONOMY_PATH, "w") as f:
        json.dump(taxonomy, f, indent=2)


def all_valid_tags(taxonomy=None):
    taxonomy = taxonomy or load_taxonomy()
    return set(tag for tags in taxonomy.values() for tag in tags)


def find_similar_tags(new_tag, taxonomy=None):
    """Returns existing tags that closely resemble new_tag (possible duplicates in spirit)."""
    existing = sorted(all_valid_tags(taxonomy))
    return [t for t in existing if difflib.SequenceMatcher(None, new_tag, t).ratio() >= SIMILARITY_THRESHOLD]


def add_tag(category, tag, confirm=False):
    """
    Returns dict: {"ok": bool, "error": str|None, "similar": [tags]}
    - Exact duplicate (anywhere in the taxonomy) -> always blocked.
    - Fuzzy-similar tags -> blocked unless confirm=True, so the caller can show
      the similar tags and let the user explicitly proceed.
    """
    taxonomy = load_taxonomy()
    tag = tag.strip().lower()

    if not tag:
        return {"ok": False, "error": "Tag cannot be empty.", "similar": []}

    if category not in taxonomy:
        return {"ok": False, "error": f"Unknown category '{category}'.", "similar": []}

    if tag in all_valid_tags(taxonomy):
        return {"ok": False, "error": f"Tag '{tag}' already exists in the taxonomy.", "similar": []}

    similar = find_similar_tags(tag, taxonomy)
    if similar and not confirm:
        return {"ok": False, "error": None, "similar": similar}

    taxonomy[category].append(tag)
    save_taxonomy(taxonomy)
    return {"ok": True, "error": None, "similar": []}


def rename_tag_in_taxonomy(old_tag, new_tag, confirm=False):
    """Renames a tag in place within its category. Returns which category it lived in
    so the caller can cascade the rename through dataset items."""
    taxonomy = load_taxonomy()
    old_tag = old_tag.strip().lower()
    new_tag = new_tag.strip().lower()

    if not new_tag:
        return {"ok": False, "error": "New tag name cannot be empty.", "similar": []}

    owning_category = next((cat for cat, tags in taxonomy.items() if old_tag in tags), None)
    if owning_category is None:
        return {"ok": False, "error": f"Tag '{old_tag}' not found in taxonomy.", "similar": []}

    if new_tag == old_tag:
        return {"ok": False, "error": "New name is the same as the current name.", "similar": []}

    other_tags = all_valid_tags(taxonomy) - {old_tag}
    if new_tag in other_tags:
        return {"ok": False, "error": f"Tag '{new_tag}' already exists in the taxonomy.", "similar": []}

    similar = [t for t in find_similar_tags(new_tag, taxonomy) if t != old_tag]
    if similar and not confirm:
        return {"ok": False, "error": None, "similar": similar}

    idx = taxonomy[owning_category].index(old_tag)
    taxonomy[owning_category][idx] = new_tag
    save_taxonomy(taxonomy)
    return {"ok": True, "error": None, "similar": [], "category": owning_category}


def delete_tag_from_taxonomy(tag):
    taxonomy = load_taxonomy()
    tag = tag.strip().lower()
    for cat, tags in taxonomy.items():
        if tag in tags:
            tags.remove(tag)
            save_taxonomy(taxonomy)
            return {"ok": True, "error": None, "category": cat}
    return {"ok": False, "error": f"Tag '{tag}' not found in taxonomy."}


def add_category(category_name):
    taxonomy = load_taxonomy()
    category_name = category_name.strip()
    if not category_name:
        return {"ok": False, "error": "Category name cannot be empty."}
    if category_name in taxonomy:
        return {"ok": False, "error": f"Category '{category_name}' already exists."}
    taxonomy[category_name] = []
    save_taxonomy(taxonomy)
    return {"ok": True, "error": None}

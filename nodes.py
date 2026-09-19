import os
import json
import random
import shutil
from collections import OrderedDict

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEFAULTS_DIR = os.path.join(os.path.dirname(__file__), "data_defaults")


def _bootstrap_data_dir():
    """On first run (data/ doesn't exist yet — e.g. a fresh install), copies the
    shipped default dataset in. If data/ already exists, this does nothing at all —
    data/ is gitignored specifically so a `git pull` for code updates can never
    overwrite a person's customized dataset, since git never tracks it once it's
    been created locally."""
    if not os.path.exists(DATA_DIR) and os.path.exists(DEFAULTS_DIR):
        shutil.copytree(DEFAULTS_DIR, DATA_DIR)


_bootstrap_data_dir()

# Maps pipeline field name -> dataset list filename (without .json)
STEP_6_PROP_KEYS = ["environmental_prop", "weather", "time_period"]
STEP_6_LIST_KEYS = ["environmental_props_list", "weather_effects_list", "time_period_list"]

STEP_7_PROP_KEYS = ["key_light", "secondary_light", "atmospheric_fx", "color_palette", "mood"]
STEP_7_LIST_KEYS = ["key_lighting_list", "secondary_light_list", "atmospheric_fx_list",
                     "color_palettes_list", "moods_list"]


def infer_character_count(item):
    """Derives how many characters an actors_list item represents from its own
    social-context tag, so custom-added items work correctly even when nothing ever
    explicitly set character_count on them. An explicit stored value always wins —
    this is only the fallback for when the field is missing entirely."""
    tags = set(item.get("tags", []))
    if "crowd" in tags:
        return 0
    if "group" in tags:
        return 3
    if "duo" in tags:
        return 2
    if "solo" in tags:
        return 1
    return 1  # no social-context tag present — safest default is a single character


def load_dataset():
    """Reads every list file fresh from disk. Cheap enough (~600 small items total)
    to do on every node execution, so dataset edits are picked up immediately."""
    dataset = {}
    for fname in os.listdir(DATA_DIR):
        if fname.endswith(".json"):
            with open(os.path.join(DATA_DIR, fname), "r") as f:
                dataset[fname[:-5]] = json.load(f)
    return dataset


def filter_candidates(target_list, active_tags, active_exclusions, exclude_ids=None):
    exclude_ids = exclude_ids or set()
    valid = []
    for item in target_list:
        if item.get("id") in exclude_ids:
            continue
        item_tags = set(item.get("tags", []))
        item_exclusions = set(item.get("exclude_tags", []))
        item_required = set(item.get("required_tags", []))

        if item_required and not item_required.intersection(active_tags):
            continue
        if item_tags.intersection(active_exclusions):
            continue
        if item_exclusions.intersection(active_tags):
            continue
        valid.append(item)
    return valid


def select_item(list_key, dataset, active_tags, active_exclusions, rng, wildcard_rate, exclude_ids=None):
    target_list = dataset.get(list_key, [])
    if not target_list:
        return None

    if rng.random() < wildcard_rate:
        selected = rng.choice(target_list)
    else:
        candidates = filter_candidates(target_list, active_tags, active_exclusions, exclude_ids)
        selected = rng.choice(candidates) if candidates else rng.choice(target_list)

    active_tags.update(selected.get("tags", []))
    active_exclusions.update(selected.get("exclude_tags", []))
    return selected


def generate_one(dataset, rng, wildcard_rate):
    active_tags = set()
    active_exclusions = set()
    fields = OrderedDict()

    # Step 1: Genre
    genre = select_item("genres_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["genre"] = genre["name"]

    # Step 2: Location
    location = select_item("locations_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["location"] = location["name"]

    # Step 3: Dynamic action
    action = select_item("dynamic_actions_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["dynamic_action"] = action["name"]

    # Step 4: Actors + per-character outfit/condition/expression
    actors = select_item("actors_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["actors"] = actors["name"]
    character_count = actors.get("character_count")
    if character_count is None:
        character_count = infer_character_count(actors)

    if character_count == 1:
        outfit = select_item("outfits_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
        condition = select_item("clothing_condition_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
        expression = select_item("body_expressions_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
        fields["outfit"] = outfit["name"]
        fields["clothing_condition"] = condition["name"]
        fields["body_expression"] = expression["name"]
    elif character_count > 1:
        used_outfit_ids = set()
        for c in range(1, character_count + 1):
            outfit = select_item("outfits_list", dataset, active_tags, active_exclusions, rng,
                                  wildcard_rate, exclude_ids=used_outfit_ids)
            used_outfit_ids.add(outfit.get("id"))
            condition = select_item("clothing_condition_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
            expression = select_item("body_expressions_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
            fields[f"character_{c}_outfit"] = outfit["name"]
            fields[f"character_{c}_condition"] = condition["name"]
            fields[f"character_{c}_expression"] = expression["name"]
    # character_count == 0 (crowd/background) -> no per-character fields

    # Step 5: Camera & optics
    angle = select_item("camera_angles_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    framing = select_item("camera_framing_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    lens_fx = select_item("lens_and_fx_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["camera_angle"] = angle["name"]
    fields["camera_framing"] = framing["name"]
    fields["lens_fx"] = lens_fx["name"]

    # Step 6: Environmental context
    for field_key, list_key in zip(STEP_6_PROP_KEYS, STEP_6_LIST_KEYS):
        picked = select_item(list_key, dataset, active_tags, active_exclusions, rng, wildcard_rate)
        fields[field_key] = picked["name"]

    # Step 7: Lighting & mood
    for field_key, list_key in zip(STEP_7_PROP_KEYS, STEP_7_LIST_KEYS):
        picked = select_item(list_key, dataset, active_tags, active_exclusions, rng, wildcard_rate)
        fields[field_key] = picked["name"]

    # Step 8: Medium
    medium = select_item("art_mediums_list", dataset, active_tags, active_exclusions, rng, wildcard_rate)
    fields["art_medium"] = medium["name"]

    return fields


def format_fields(fields):
    return "\n".join(f"{k}: {v}" for k, v in fields.items())


class PromptEngineNode:
    """Single no-input node. Runs the tag-filtered 8-step selection pipeline
    `count` times and returns a list of formatted variable dumps."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "count": ("INT", {"default": 1, "min": 1, "max": 1000}),
                "wildcard_rate": ("FLOAT", {"default": 0.10, "min": 0.0, "max": 1.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("LIST", "STRING")
    RETURN_NAMES = ("prompt_list", "prompt_list_json")
    OUTPUT_IS_LIST = (True, False)
    FUNCTION = "run"
    CATEGORY = "Prompt Engine"

    def run(self, seed, count, wildcard_rate):
        dataset = load_dataset()
        results = []
        for i in range(count):
            rng = random.Random(seed + i)
            fields = generate_one(dataset, rng, wildcard_rate)
            results.append(format_fields(fields))
        return (results, json.dumps(results, indent=2))


NODE_CLASS_MAPPINGS = {
    "PromptEngineNode": PromptEngineNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PromptEngineNode": "Prompt Engine",
}

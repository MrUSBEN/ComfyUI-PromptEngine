PIPELINE_STEPS = [
    {"step": 1, "label": "Genre", "lists": ["genres_list"]},
    {"step": 2, "label": "Location", "lists": ["locations_list"]},
    {"step": 3, "label": "Action", "lists": ["dynamic_actions_list"]},
    {"step": 4, "label": "Character", "lists": ["actors_list", "outfits_list", "clothing_condition_list", "body_expressions_list"]},
    {"step": 5, "label": "Camera", "lists": ["camera_angles_list", "camera_framing_list", "lens_and_fx_list"]},
    {"step": 6, "label": "Environment", "lists": ["environmental_props_list", "weather_effects_list", "time_period_list"]},
    {"step": 7, "label": "Lighting", "lists": ["key_lighting_list", "secondary_light_list", "atmospheric_fx_list", "color_palettes_list", "moods_list"]},
    {"step": 8, "label": "Medium", "lists": ["art_mediums_list"]},
]

DATASET_LISTS = [name for s in PIPELINE_STEPS for name in s["lists"]]


def step_for_list(list_name):
    for s in PIPELINE_STEPS:
        if list_name in s["lists"]:
            return s["step"]
    return None


def get_tag_producers(all_lists):
    """tag -> sorted list of list_names whose items carry that tag in their own 'tags' field."""
    producers = {}
    for list_name, items in all_lists.items():
        for it in items:
            for tag in it.get("tags", []):
                producers.setdefault(tag, set()).add(list_name)
    return {k: sorted(v) for k, v in producers.items()}


def get_tag_usage(all_lists, tag):
    """Every item anywhere in the dataset that references `tag` in tags/required_tags/exclude_tags.
    Used to warn before a tag is deleted or renamed out of the taxonomy."""
    usage = []
    for list_name, items in all_lists.items():
        for it in items:
            fields = [f for f in ("tags", "required_tags", "exclude_tags") if tag in it.get(f, [])]
            if fields:
                usage.append({"list": list_name, "id": it.get("id"), "name": it.get("name"), "fields": fields})
    return usage

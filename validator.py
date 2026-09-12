from .taxonomy import all_valid_tags


def validate_list(items):
    """Validate a single list's items in isolation. Returns (errors, warnings)."""
    errors, warnings = [], []
    seen_ids = set()
    valid_tags = all_valid_tags()

    for idx, it in enumerate(items):
        label = it.get("id") or f"(row {idx})"

        if not it.get("id"):
            errors.append(f"{label}: missing 'id'")
        elif it["id"] in seen_ids:
            errors.append(f"Duplicate id: '{it['id']}'")
        else:
            seen_ids.add(it["id"])

        if not it.get("name"):
            errors.append(f"{label}: missing 'name'")

        tags = set(it.get("tags", []))
        required = set(it.get("required_tags", []))
        exclude = set(it.get("exclude_tags", []))

        bad_tags = (tags | required | exclude) - valid_tags
        if bad_tags:
            errors.append(f"{label}: unknown tag(s) not in taxonomy: {sorted(bad_tags)}")

        if not tags:
            warnings.append(f"{label}: has zero tags — will behave as a near-wildcard, "
                             f"showing up regardless of context")

    return errors, warnings


def validate_full_dataset(all_lists):
    """
    all_lists: dict of {list_name: [items]}
    Returns {list_name: {"errors": [...], "warnings": [...]}}
    Adds a cross-list check: required_tags / exclude_tags that no item
    anywhere in the dataset ever produces via its own 'tags' field.
    """
    produced_tags = set()
    for items in all_lists.values():
        for it in items:
            produced_tags.update(it.get("tags", []))

    results = {}
    for list_name, items in all_lists.items():
        errors, warnings = validate_list(items)
        for it in items:
            label = it.get("id") or it.get("name", "?")
            unreachable = (set(it.get("required_tags", [])) | set(it.get("exclude_tags", []))) - produced_tags
            if unreachable:
                warnings.append(
                    f"{label}: references tag(s) {sorted(unreachable)} that no item in the "
                    f"whole dataset ever produces — this condition can never be triggered"
                )
        results[list_name] = {"errors": errors, "warnings": warnings}
    return results

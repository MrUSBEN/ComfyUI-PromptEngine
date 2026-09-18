import os
import json
import socket
import urllib.request
import urllib.error

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "data", "llm_config.json")

PRESETS = {
    "lm_studio": {"label": "LM Studio", "base_url": "http://localhost:1234/v1"},
    "ollama": {"label": "Ollama", "base_url": "http://localhost:11434/v1"},
    "openai": {"label": "OpenAI", "base_url": "https://api.openai.com/v1"},
    "custom": {"label": "Custom", "base_url": ""},
}

DEFAULT_CONFIG = {
    "preset": "lm_studio",
    "base_url": PRESETS["lm_studio"]["base_url"],
    "api_key": "",
    "model": "",
    "auto_unload": False,
    "timeout_seconds": 60,  # applies to chat completion / suggestion calls specifically
}


def load_config():
    if not os.path.exists(CONFIG_PATH):
        return dict(DEFAULT_CONFIG)
    with open(CONFIG_PATH, "r") as f:
        cfg = json.load(f)
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    return merged


def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def _native_root(base_url):
    """LM Studio's native v1 REST API lives at the server root, not under /v1
    (which is reserved for the OpenAI-compatible surface). Strip a trailing /v1."""
    return base_url[:-3] if base_url.rstrip("/").endswith("/v1") else base_url.rstrip("/")


def _http_json(url, method="GET", body=None, api_key=None, timeout=10):
    """Raises TimeoutError if the request exceeds `timeout`, or ConnectionError if the
    server can't be reached at all (e.g. LM Studio isn't running) — kept distinct so
    callers can show the person a message that actually matches what happened."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except socket.timeout:
        raise TimeoutError(f"Request to {url} timed out after {timeout}s. "
                            f"For large batches, try increasing the timeout in LLM Settings.")
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        raise ConnectionError(f"Could not reach {url} ({reason}). Is the server actually running?")


def list_models(cfg):
    """Returns {"ok": True, "models": [...]}, where each model is
    {"id": str, "loaded": bool, "instance_id": str|None}.
    Uses LM Studio's native v1 API when the preset is lm_studio (richer info,
    including which instance is loaded so it can be unloaded later); otherwise
    falls back to the standard OpenAI-compatible /models listing.
    Uses a short fixed timeout (15s) regardless of the configured chat timeout,
    since a model listing should always be fast — if it's not, the server
    likely isn't reachable at all, which is worth reporting quickly."""
    try:
        if cfg.get("preset") == "lm_studio":
            root = _native_root(cfg["base_url"])
            data = _http_json(f"{root}/api/v1/models", api_key=cfg.get("api_key"), timeout=15)
            models = []
            for m in data.get("models", []):
                loaded_instances = m.get("loaded_instances", [])
                models.append({
                    "id": m.get("key"),
                    "display_name": m.get("display_name", m.get("key")),
                    "loaded": len(loaded_instances) > 0,
                    "instance_id": loaded_instances[0]["id"] if loaded_instances else None,
                })
            return {"ok": True, "models": models}
        else:
            data = _http_json(f"{cfg['base_url'].rstrip('/')}/models", api_key=cfg.get("api_key"), timeout=15)
            models = [{"id": m.get("id"), "display_name": m.get("id"), "loaded": None, "instance_id": None}
                      for m in data.get("data", [])]
            return {"ok": True, "models": models}
    except (TimeoutError, socket.timeout, ConnectionError) as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def unload_model(cfg, instance_id):
    if cfg.get("preset") != "lm_studio":
        return {"ok": False, "error": "Unload is only supported for the LM Studio backend right now."}
    if not instance_id:
        return {"ok": False, "error": "That model isn't currently loaded, nothing to unload."}
    try:
        root = _native_root(cfg["base_url"])
        result = _http_json(f"{root}/api/v1/models/unload", method="POST",
                             body={"instance_id": instance_id}, api_key=cfg.get("api_key"), timeout=15)
        return {"ok": True, "instance_id": result.get("instance_id", instance_id)}
    except (TimeoutError, socket.timeout, ConnectionError) as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def chat_completion(cfg, system_prompt, user_prompt, temperature=0.2):
    timeout = cfg.get("timeout_seconds", 60)
    try:
        body = {
            "model": cfg.get("model", ""),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }
        data = _http_json(f"{cfg['base_url'].rstrip('/')}/chat/completions", method="POST",
                           body=body, api_key=cfg.get("api_key"), timeout=timeout)
        content = data["choices"][0]["message"]["content"]
        return {"ok": True, "content": content}
    except (TimeoutError, socket.timeout, ConnectionError) as e:
        return {"ok": False, "error": str(e), "was_timeout": isinstance(e, (TimeoutError, socket.timeout))}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def build_required_exclude_prompt(list_name, required_candidates, exclude_candidates, examples):
    req_str = ", ".join(sorted(required_candidates)) or "(none available)"
    exc_str = ", ".join(sorted(exclude_candidates)) or "(none available)"
    examples_block = ""
    if examples:
        examples_block = "\nExamples of how required_tags/exclude_tags have been used elsewhere in this dataset:\n" + \
            "\n".join(
                f'- "{ex.get("name")}" (tags: {", ".join(ex.get("tags", []))}) -> '
                f'required_tags: {", ".join(ex.get("required_tags", []))}; exclude_tags: {", ".join(ex.get("exclude_tags", []))}'
                for ex in examples
            )
    return f"""You are helping set up cross-item filtering rules for a ComfyUI prompt-generation dataset.
Items are picked in a fixed pipeline order. For items in the list "{list_name}":

required_tags: a tag here means the item is only eligible if that tag is already active from something picked earlier in the pipeline. You may ONLY choose from these earlier-available tags: {req_str}

exclude_tags: a tag here blocks anything picked later in the pipeline that carries that tag. You may ONLY choose from these later-occurring tags: {exc_str}

Only add a required_tag or exclude_tag when there's a genuine, meaningful dependency or conflict — most items need few or none. Do not force a match just because a tag happens to be available.
{examples_block}
Respond with ONLY a JSON array, no markdown fences, no extra text, in this exact shape:
[{{"name": "<item name exactly as given>", "required_tags": [...], "exclude_tags": [...]}}, ...]
Return exactly one object per input item, in the same order as given. Empty arrays are fine and expected for most items."""


def suggest_required_exclude(cfg, list_name, items, required_candidates, exclude_candidates, examples):
    system_prompt = build_required_exclude_prompt(list_name, required_candidates, exclude_candidates, examples)
    user_prompt = "Set required_tags/exclude_tags for these items:\n" + "\n".join(
        f'{i + 1}. "{it["name"]}" (tags: {", ".join(it.get("tags", []))})' for i, it in enumerate(items)
    )
    result = chat_completion(cfg, system_prompt, user_prompt, temperature=0.2)
    if not result["ok"]:
        return result

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"Model did not return valid JSON: {e}", "raw": raw}

    suggestions = []
    for item in parsed:
        req = item.get("required_tags", [])
        exc = item.get("exclude_tags", [])
        suggestions.append({
            "name": item.get("name", ""),
            "required_tags": [t for t in req if t in required_candidates],
            "exclude_tags": [t for t in exc if t in exclude_candidates],
            "dropped_required": [t for t in req if t not in required_candidates],
            "dropped_exclude": [t for t in exc if t not in exclude_candidates],
        })
    return {"ok": True, "suggestions": suggestions}
    taxonomy_block = "\n".join(f"{cat}: {', '.join(tags)}" for cat, tags in taxonomy.items())
    examples_block = ""
    if example_items:
        examples_block = "\nExamples already in this list (match this style and tagging density):\n" + \
            "\n".join(f'- "{it.get("name")}" -> tags: {", ".join(it.get("tags", []))}' for it in example_items)
    return f"""You are a tagging assistant for a ComfyUI prompt-generation dataset.
You must only use tags from this exact taxonomy, grouped by category:
{taxonomy_block}
{examples_block}
Never invent a tag that is not listed above. Pick only tags that genuinely describe each item.
Respond with ONLY a JSON array, no markdown code fences, no extra text, in this exact shape:
[{{"name": "<item name exactly as given>", "tags": ["tag1", "tag2"]}}, ...]
Return exactly one object per input item, in the same order as given."""


def build_suggest_prompt(taxonomy, example_items):
    taxonomy_block = "\n".join(f"{cat}: {', '.join(tags)}" for cat, tags in taxonomy.items())
    examples_block = ""
    if example_items:
        examples_block = "\nExamples already in this list (match this style and tagging density):\n" + \
            "\n".join(f'- "{it.get("name")}" -> tags: {", ".join(it.get("tags", []))}' for it in example_items)
    return f"""You are a tagging assistant for a ComfyUI prompt-generation dataset.
You must only use tags from this exact taxonomy, grouped by category:
{taxonomy_block}
{examples_block}
Never invent a tag that is not listed above. Pick only tags that genuinely describe each item.
Respond with ONLY a JSON array, no markdown code fences, no extra text, in this exact shape:
[{{"name": "<item name exactly as given>", "tags": ["tag1", "tag2"]}}, ...]
Return exactly one object per input item, in the same order as given."""


def suggest_tags(cfg, taxonomy, item_names, example_items):
    system_prompt = build_suggest_prompt(taxonomy, example_items)
    user_prompt = "Tag these items:\n" + "\n".join(f"{i + 1}. {name}" for i, name in enumerate(item_names))
    result = chat_completion(cfg, system_prompt, user_prompt, temperature=0.2)
    if not result["ok"]:
        return result

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"Model did not return valid JSON: {e}", "raw": raw}

    all_tags = set(tag for tags in taxonomy.values() for tag in tags)
    suggestions = []
    for item in parsed:
        proposed = item.get("tags", [])
        suggestions.append({
            "name": item.get("name", ""),
            "tags": [t for t in proposed if t in all_tags],
            "dropped": [t for t in proposed if t not in all_tags],
        })
    return {"ok": True, "suggestions": suggestions}

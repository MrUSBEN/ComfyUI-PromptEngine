import os
import json

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, DATA_DIR
from .taxonomy import load_taxonomy, save_taxonomy, add_tag, add_category, rename_tag_in_taxonomy, delete_tag_from_taxonomy
from .validator import validate_list, validate_full_dataset
from .pipeline import PIPELINE_STEPS, DATASET_LISTS, get_tag_producers, get_tag_usage
from . import llm_backend

WEB_DIRECTORY = "web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

# ---- Backend API routes for the in-node dataset editor ----
try:
    from server import PromptServer
    from aiohttp import web

    routes = PromptServer.instance.routes

    def _list_path(name):
        safe_name = os.path.basename(name)  # prevent path traversal
        return os.path.join(DATA_DIR, f"{safe_name}.json")

    def _read_all_lists():
        all_lists = {}
        for name in DATASET_LISTS:
            path = _list_path(name)
            if os.path.exists(path):
                with open(path, "r") as f:
                    all_lists[name] = json.load(f)
        return all_lists

    # In-memory undo stack for taxonomy operations (add/rename/delete tag, add category).
    # Each entry snapshots the taxonomy AND every dataset list, since rename/delete cascade
    # into item data. Resets on ComfyUI restart, which is an acceptable tradeoff for an
    # editing convenience feature.
    _taxonomy_history = []
    _TAXONOMY_HISTORY_LIMIT = 20

    def _snapshot_all():
        return {"taxonomy": load_taxonomy(), "lists": _read_all_lists()}

    def _push_taxonomy_history(snapshot):
        _taxonomy_history.append(snapshot)
        if len(_taxonomy_history) > _TAXONOMY_HISTORY_LIMIT:
            _taxonomy_history.pop(0)

    def _restore_snapshot(snapshot):
        save_taxonomy(snapshot["taxonomy"])
        for name, items in snapshot["lists"].items():
            with open(_list_path(name), "w") as f:
                json.dump(items, f, indent=2)

    def _cascade_rename(old_tag, new_tag):
        """Replaces old_tag with new_tag in every item's tags/required_tags/exclude_tags
        across every list, deduping in case new_tag was already present. Returns affected count."""
        affected = 0
        for name in DATASET_LISTS:
            path = _list_path(name)
            if not os.path.exists(path):
                continue
            with open(path, "r") as f:
                items = json.load(f)
            changed = False
            for it in items:
                for field in ("tags", "required_tags", "exclude_tags"):
                    vals = it.get(field, [])
                    if old_tag in vals:
                        seen, deduped = set(), []
                        for v in (new_tag if v == old_tag else v for v in vals):
                            if v not in seen:
                                seen.add(v)
                                deduped.append(v)
                        it[field] = deduped
                        changed = True
                        affected += 1
            if changed:
                with open(path, "w") as f:
                    json.dump(items, f, indent=2)
        return affected

    def _cascade_delete(tag):
        affected = 0
        for name in DATASET_LISTS:
            path = _list_path(name)
            if not os.path.exists(path):
                continue
            with open(path, "r") as f:
                items = json.load(f)
            changed = False
            for it in items:
                for field in ("tags", "required_tags", "exclude_tags"):
                    vals = it.get(field, [])
                    if tag in vals:
                        it[field] = [v for v in vals if v != tag]
                        changed = True
                        affected += 1
            if changed:
                with open(path, "w") as f:
                    json.dump(items, f, indent=2)
        return affected

    @routes.get("/prompt_engine/taxonomy")
    async def get_taxonomy(request):
        return web.json_response(load_taxonomy())

    @routes.post("/prompt_engine/taxonomy/add_tag")
    async def post_add_tag(request):
        body = await request.json()
        snapshot = _snapshot_all()
        result = add_tag(body.get("category", ""), body.get("tag", ""), confirm=body.get("confirm", False))
        if result.get("ok"):
            _push_taxonomy_history(snapshot)
        return web.json_response(result)

    @routes.post("/prompt_engine/taxonomy/add_category")
    async def post_add_category(request):
        body = await request.json()
        snapshot = _snapshot_all()
        result = add_category(body.get("category_name", ""))
        if result.get("ok"):
            _push_taxonomy_history(snapshot)
        return web.json_response(result)

    @routes.post("/prompt_engine/taxonomy/rename_tag")
    async def post_rename_tag(request):
        body = await request.json()
        old_tag = body.get("old_tag", "").strip().lower()
        new_tag = body.get("new_tag", "").strip().lower()
        confirm = body.get("confirm", False)

        snapshot = _snapshot_all()
        result = rename_tag_in_taxonomy(old_tag, new_tag, confirm=confirm)
        if not result["ok"]:
            return web.json_response(result)

        result["affected_items"] = _cascade_rename(old_tag, new_tag)
        _push_taxonomy_history(snapshot)
        return web.json_response(result)

    @routes.post("/prompt_engine/taxonomy/delete_tag")
    async def post_delete_tag(request):
        body = await request.json()
        tag = body.get("tag", "").strip().lower()
        confirm = body.get("confirm", False)

        usage = get_tag_usage(_read_all_lists(), tag)
        if usage and not confirm:
            return web.json_response({"ok": False, "in_use": True, "usage": usage, "count": len(usage)})

        snapshot = _snapshot_all()
        result = delete_tag_from_taxonomy(tag)
        if not result["ok"]:
            return web.json_response(result)

        result["affected_items"] = _cascade_delete(tag)
        _push_taxonomy_history(snapshot)
        return web.json_response(result)

    @routes.post("/prompt_engine/taxonomy/undo")
    async def post_taxonomy_undo(request):
        if not _taxonomy_history:
            return web.json_response({"ok": False, "error": "Nothing to undo."})
        snapshot = _taxonomy_history.pop()
        _restore_snapshot(snapshot)
        return web.json_response({"ok": True})

    @routes.get("/prompt_engine/lists")
    async def get_lists(request):
        return web.json_response(DATASET_LISTS)

    @routes.get("/prompt_engine/list/{name}")
    async def get_list(request):
        name = request.match_info["name"]
        path = _list_path(name)
        if not os.path.exists(path):
            return web.json_response({"error": "list not found"}, status=404)
        with open(path, "r") as f:
            items = json.load(f)
        return web.json_response(items)

    @routes.post("/prompt_engine/list/{name}")
    async def save_list(request):
        name = request.match_info["name"]
        path = _list_path(name)
        body = await request.json()
        items = body.get("items", [])

        errors, warnings = validate_list(items)
        if errors:
            return web.json_response({"ok": False, "errors": errors, "warnings": warnings}, status=400)

        with open(path, "w") as f:
            json.dump(items, f, indent=2)

        return web.json_response({"ok": True, "errors": [], "warnings": warnings})

    @routes.get("/prompt_engine/validate_all")
    async def validate_all(request):
        results = validate_full_dataset(_read_all_lists())
        return web.json_response(results)

    @routes.get("/prompt_engine/pipeline")
    async def get_pipeline(request):
        return web.json_response(PIPELINE_STEPS)

    @routes.get("/prompt_engine/tag_producers")
    async def get_tag_producers_route(request):
        return web.json_response(get_tag_producers(_read_all_lists()))

    @routes.get("/prompt_engine/llm/presets")
    async def get_llm_presets(request):
        return web.json_response(llm_backend.PRESETS)

    @routes.get("/prompt_engine/llm/config")
    async def get_llm_config(request):
        return web.json_response(llm_backend.load_config())

    @routes.post("/prompt_engine/llm/config")
    async def post_llm_config(request):
        body = await request.json()
        cfg = llm_backend.load_config()
        cfg.update({k: body[k] for k in ("preset", "base_url", "api_key", "model", "auto_unload") if k in body})
        llm_backend.save_config(cfg)
        return web.json_response({"ok": True, "config": cfg})

    @routes.post("/prompt_engine/llm/list_models")
    async def post_llm_list_models(request):
        body = await request.json()
        cfg = {**llm_backend.load_config(), **body}
        return web.json_response(llm_backend.list_models(cfg))

    @routes.post("/prompt_engine/llm/unload")
    async def post_llm_unload(request):
        body = await request.json()
        cfg = llm_backend.load_config()
        return web.json_response(llm_backend.unload_model(cfg, body.get("instance_id")))

    @routes.post("/prompt_engine/llm/suggest_tags")
    async def post_llm_suggest_tags(request):
        body = await request.json()
        list_name = body.get("list_name", "")
        item_names = body.get("item_names", [])
        cfg = llm_backend.load_config()
        taxonomy = load_taxonomy()

        path = _list_path(list_name)
        example_items = []
        if os.path.exists(path):
            with open(path, "r") as f:
                existing = json.load(f)
            example_items = existing[:5]

        result = llm_backend.suggest_tags(cfg, taxonomy, item_names, example_items)

        if result.get("ok") and cfg.get("auto_unload") and cfg.get("preset") == "lm_studio":
            models_result = llm_backend.list_models(cfg)
            if models_result.get("ok"):
                match = next((m for m in models_result["models"] if m["id"] == cfg.get("model")), None)
                if match and match.get("instance_id"):
                    unload_result = llm_backend.unload_model(cfg, match["instance_id"])
                    result["auto_unloaded"] = unload_result.get("ok", False)

        return web.json_response(result)

except ImportError:
    # Allows the package to be imported standalone (e.g. for testing) outside ComfyUI
    pass

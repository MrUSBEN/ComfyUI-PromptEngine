import { app } from "../../scripts/app.js";

const API = "/prompt_engine";
let taxonomyCache = null;
let pipelineCache = null;
let tagProducersCache = null;

/** fetch + .json() wrapped so a network failure (server down, connection dropped,
 * request aborted) always surfaces as a normal {ok:false, error} result instead of
 * throwing an unhandled promise rejection that silently kills the calling function
 * with no visible feedback at all. */
async function fetchJsonSafe(url, options) {
    try {
        const res = await fetch(url, options);
        return await res.json();
    } catch (e) {
        return { ok: false, error: `Could not reach the ComfyUI server, or the connection was interrupted: ${e.message}` };
    }
}

function injectStyles() {
    if (document.getElementById("prompt-engine-editor-styles")) return;
    const style = document.createElement("style");
    style.id = "prompt-engine-editor-styles";
    style.textContent = `
    .pe-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000;
        display: flex; align-items: center; justify-content: center; }
    .pe-modal { background: #202020; color: #e0e0e0; width: 980px; max-width: 96vw;
        max-height: 88vh; border-radius: 8px; display: flex; flex-direction: column;
        font-family: sans-serif; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5); position: relative; }
    .pe-header { padding: 12px 16px; display: flex; align-items: center; gap: 10px;
        border-bottom: 1px solid #3a3a3a; flex-wrap: wrap; }
    .pe-header select { background: #2c2c2c; color: #e0e0e0; border: 1px solid #444;
        padding: 4px 8px; border-radius: 4px; }
    .pe-close { margin-left: auto; cursor: pointer; font-size: 20px; color: #aaa; }
    .pe-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
    .pe-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .pe-table th, .pe-table td { border-bottom: 1px solid #333; padding: 6px 8px; text-align: left; vertical-align: top; }
    .pe-table th { color: #999; font-weight: 500; }
    .pe-tag-chip { display: inline-block; background: #34405a; color: #bcd; border-radius: 3px;
        padding: 1px 6px; margin: 1px; font-size: 11px; }
    .pe-actions button { margin-right: 6px; margin-bottom: 4px; }
    .pe-btn { background: #3a3a3a; color: #eee; border: 1px solid #555; border-radius: 4px;
        padding: 5px 10px; cursor: pointer; font-size: 12px; }
    .pe-btn:hover { background: #484848; }
    .pe-btn-primary { background: #3b6ea5; border-color: #3b6ea5; }
    .pe-btn-primary:hover { background: #4a80bd; }
    .pe-btn-danger { background: #7a3b3b; border-color: #7a3b3b; }
    .pe-footer { padding: 10px 16px; border-top: 1px solid #3a3a3a; display: flex; justify-content: space-between; align-items: center; }
    .pe-form-overlay { position: absolute; inset: 0; background: #202020; padding: 16px; overflow-y: auto; z-index: 20; }
    .pe-field { margin-bottom: 12px; }
    .pe-field label { display: block; margin-bottom: 4px; color: #aaa; font-size: 12px; }
    .pe-field input[type=text] { width: 100%; background: #2c2c2c; color: #eee; border: 1px solid #444;
        border-radius: 4px; padding: 6px 8px; box-sizing: border-box; }
    .pe-field textarea { width: 100%; min-height: 140px; background: #2c2c2c; color: #eee; border: 1px solid #444;
        border-radius: 4px; padding: 6px 8px; box-sizing: border-box; font-family: monospace; font-size: 12px; }
    .pe-tag-group { margin-bottom: 10px; }
    .pe-tag-group-title { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .pe-tag-option { display: inline-flex; align-items: center; margin: 2px 6px 2px 0; font-size: 12px; }
    .pe-tag-option input { margin-right: 4px; }
    .pe-warning { color: #d9b34a; font-size: 12px; margin: 4px 0; }
    .pe-error { color: #e06060; font-size: 12px; margin: 4px 0; }
    .pe-taxo-panel { position: absolute; inset: 0; background: #202020; padding: 16px; overflow-y: auto; z-index: 20; }
    .pe-taxo-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 12px; flex-wrap: wrap; }
    .pe-taxo-row select, .pe-taxo-row input[type=text] { background: #2c2c2c; color: #eee; border: 1px solid #444;
        border-radius: 4px; padding: 6px 8px; }
    .pe-similar-list { background: #2c2c2c; border: 1px solid #444; border-radius: 4px; padding: 8px; margin: 8px 0; }
    .pe-batch-bar { display: flex; align-items: center; gap: 10px; background: #2a2a2a; border: 1px solid #444;
        border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; font-size: 12px; }
    .pe-flow-wrap { margin: 12px 0; }
    .pe-flow-row { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 6px; }
    .pe-flow-step { min-width: 88px; flex-shrink: 0; text-align: center; font-size: 11px; padding: 8px 4px;
        background: #2c2c2c; border: 1px solid #444; border-radius: 6px; color: #ccc; }
    .pe-flow-step .pe-flow-step-num { display: block; color: #888; font-size: 10px; }
    .pe-flow-current { background: #3b6ea5; border-color: #3b6ea5; color: #fff; }
    .pe-flow-supplier { background: #2f6b4f; border-color: #2f6b4f; color: #fff; }
    .pe-flow-blocked { background: #7a3b3b; border-color: #7a3b3b; color: #fff; }
    .pe-flow-arrow { align-self: center; color: #666; flex-shrink: 0; }
    .pe-flow-detail { font-size: 12px; margin-top: 8px; }
    .pe-flow-detail .pe-tag-chip { background: #2c2c2c; border: 1px solid #444; }
    .pe-tag-with-actions { display: inline-flex; align-items: center; margin: 2px; }
    .pe-tag-mini-btn { background: none; border: none; color: #999; cursor: pointer; font-size: 11px;
        padding: 0 3px; line-height: 1; }
    .pe-tag-mini-btn:hover { color: #eee; }
    .pe-usage-list { background: #2c2c2c; border: 1px solid #444; border-radius: 4px; padding: 8px;
        margin: 8px 0; max-height: 140px; overflow-y: auto; font-size: 11px; }
    .pe-toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
    .pe-toggle input { opacity: 0; width: 0; height: 0; }
    .pe-toggle-slider { position: absolute; inset: 0; background: #444; border-radius: 20px; cursor: pointer; transition: 0.15s; }
    .pe-toggle-slider:before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; bottom: 3px;
        background: #eee; border-radius: 50%; transition: 0.15s; }
    .pe-toggle input:checked + .pe-toggle-slider { background: #3b6ea5; }
    .pe-toggle input:checked + .pe-toggle-slider:before { transform: translateX(16px); }
    .pe-model-row { display: flex; align-items: center; gap: 4px; font-size: 12px; padding: 3px 0; }
    .pe-model-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .pe-tristate-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: 12px; }
    .pe-tristate-tag { flex: 1; color: #ddd; }
    .pe-tristate-btn { background: #2c2c2c; color: #999; border: 1px solid #444; border-radius: 4px;
        padding: 2px 8px; cursor: pointer; font-size: 11px; min-width: 30px; }
    .pe-tristate-btn:disabled { opacity: 0.25; cursor: not-allowed; }
    .pe-tristate-btn.pe-tristate-req.active { background: #2f6b4f; border-color: #2f6b4f; color: #fff; }
    .pe-tristate-btn.pe-tristate-excl.active { background: #7a3b3b; border-color: #7a3b3b; color: #fff; }
    .pe-tristate-btn.pe-tristate-neutral.active { background: #444; color: #ccc; }
    `;
    document.head.appendChild(style);
}

async function getTaxonomy(force) {
    if (taxonomyCache && !force) return taxonomyCache;
    const res = await fetch(`${API}/taxonomy`);
    taxonomyCache = await res.json();
    return taxonomyCache;
}

async function getPipeline() {
    if (pipelineCache) return pipelineCache;
    const res = await fetch(`${API}/pipeline`);
    pipelineCache = await res.json();
    return pipelineCache;
}

async function getTagProducers(force) {
    if (tagProducersCache && !force) return tagProducersCache;
    const res = await fetch(`${API}/tag_producers`);
    tagProducersCache = await res.json();
    return tagProducersCache;
}

function invalidateDatasetCaches() {
    tagProducersCache = null; // tag production can change whenever items change
}

function tagCheckboxGroup(taxonomy, groupName, selected) {
    const wrap = document.createElement("div");
    for (const [category, tags] of Object.entries(taxonomy)) {
        const box = document.createElement("div");
        box.className = "pe-tag-group";
        const title = document.createElement("div");
        title.className = "pe-tag-group-title";
        title.textContent = category;
        box.appendChild(title);
        const optWrap = document.createElement("div");
        for (const tag of tags) {
            const label = document.createElement("label");
            label.className = "pe-tag-option";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = tag;
            cb.name = groupName;
            cb.checked = selected.includes(tag);
            label.appendChild(cb);
            label.append(tag);
            optWrap.appendChild(label);
        }
        box.appendChild(optWrap);
        wrap.appendChild(box);
    }
    return wrap;
}

/** One row per tag instead of two duplicated lists: each tag gets a neutral/Req/Excl
 * tri-state control. A tag only gets enabled buttons for directions it's actually a
 * valid candidate for (so a tag that can only ever be a required_tag doesn't even show
 * a clickable Excl button). Returns an accessor object rather than requiring the caller
 * to re-query checkboxes later. */
function renderTriStateTags(container, requiredCandidates, excludeCandidates, initialRequired, initialExcluded) {
    const allTags = [...new Set([...requiredCandidates, ...excludeCandidates])].sort();
    const state = {};
    allTags.forEach(t => {
        if (initialRequired.includes(t)) state[t] = "required";
        else if (initialExcluded.includes(t)) state[t] = "excluded";
        else state[t] = null;
    });

    function render() {
        container.innerHTML = "";
        if (!allTags.length) {
            container.innerHTML = `<span style="color:#888;font-size:12px;">No candidate tags available in either direction.</span>`;
            return;
        }
        allTags.forEach(t => {
            const canReq = requiredCandidates.includes(t);
            const canExcl = excludeCandidates.includes(t);
            const row = document.createElement("div");
            row.className = "pe-tristate-row";
            row.innerHTML = `
                <span class="pe-tristate-tag">${t}</span>
                <button class="pe-tristate-btn pe-tristate-neutral ${state[t] === null ? "active" : ""}" data-tag="${t}" data-state="">\u2014</button>
                <button class="pe-tristate-btn pe-tristate-req ${state[t] === "required" ? "active" : ""}" data-tag="${t}" data-state="required" ${canReq ? "" : "disabled"}>Req</button>
                <button class="pe-tristate-btn pe-tristate-excl ${state[t] === "excluded" ? "active" : ""}" data-tag="${t}" data-state="excluded" ${canExcl ? "" : "disabled"}>Excl</button>
            `;
            container.appendChild(row);
        });
        container.querySelectorAll(".pe-tristate-btn").forEach(btn => btn.addEventListener("click", () => {
            if (btn.disabled) return;
            state[btn.dataset.tag] = btn.dataset.state || null;
            render();
        }));
    }
    render();

    return {
        getRequired: () => allTags.filter(t => state[t] === "required"),
        getExcluded: () => allTags.filter(t => state[t] === "excluded"),
    };
}

function readCheckedTags(container, groupName) {
    return Array.from(container.querySelectorAll(`input[name="${groupName}"]:checked`)).map(cb => cb.value);
}

/** Flat (ungrouped) checkbox list, for pre-filtered candidate sets like the
 * required/exclude assist's direction-constrained tags, which don't map to taxonomy categories. */
function flatTagCheckboxGroup(tagList, groupName, selected) {
    const wrap = document.createElement("div");
    for (const tag of [...tagList].sort()) {
        const label = document.createElement("label");
        label.className = "pe-tag-option";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = tag;
        cb.name = groupName;
        cb.checked = selected.includes(tag);
        label.appendChild(cb);
        label.append(tag);
        wrap.appendChild(label);
    }
    if (!tagList.length) wrap.innerHTML = `<span style="color:#888;font-size:12px;">No candidates available for this direction.</span>`;
    return wrap;
}

function slugify(name) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const LLM_ASSIST_BATCH_SIZE = 15; // keeps each request small regardless of total selection size

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/** Renders the 8-step pipeline chain into `container`, highlighting currentListName's step,
 * any earlier step that supplies one of requiredTags, and any later step that would be
 * blocked by one of excludeTags. */
async function renderPipelineFlow(container, currentListName, requiredTags, excludeTags) {
    const pipeline = await getPipeline();
    const producers = await getTagProducers();

    const currentStepObj = pipeline.find(s => s.lists.includes(currentListName));
    const currentStep = currentStepObj ? currentStepObj.step : null;

    const supplierSteps = {}; // step -> [tags]
    const blockedSteps = {};  // step -> [tags]
    const unmetRequired = [];
    const unmatchedExclude = [];

    for (const tag of (requiredTags || [])) {
        const lists = producers[tag] || [];
        const steps = lists.map(l => pipeline.find(s => s.lists.includes(l))?.step).filter(s => s && (currentStep === null || s < currentStep));
        if (steps.length === 0) { unmetRequired.push(tag); continue; }
        for (const s of steps) { (supplierSteps[s] ||= []).push(tag); }
    }
    for (const tag of (excludeTags || [])) {
        const lists = producers[tag] || [];
        const steps = lists.map(l => pipeline.find(s => s.lists.includes(l))?.step).filter(s => s && (currentStep === null || s > currentStep));
        if (steps.length === 0) { unmatchedExclude.push(tag); continue; }
        for (const s of steps) { (blockedSteps[s] ||= []).push(tag); }
    }

    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "pe-flow-wrap";
    const row = document.createElement("div");
    row.className = "pe-flow-row";

    pipeline.forEach((s, i) => {
        if (i > 0) {
            const arrow = document.createElement("span");
            arrow.className = "pe-flow-arrow";
            arrow.textContent = "\u2192";
            row.appendChild(arrow);
        }
        const box = document.createElement("div");
        let cls = "pe-flow-step";
        if (s.step === currentStep) cls += " pe-flow-current";
        else if (supplierSteps[s.step]) cls += " pe-flow-supplier";
        else if (blockedSteps[s.step]) cls += " pe-flow-blocked";
        box.className = cls;
        const tagsHere = [...(supplierSteps[s.step] || []), ...(blockedSteps[s.step] || [])];
        box.innerHTML = `<span class="pe-flow-step-num">Step ${s.step}</span>${s.label}` +
            (tagsHere.length ? `<div style="margin-top:4px;font-size:10px;opacity:0.85">${tagsHere.join(", ")}</div>` : "");
        row.appendChild(box);
    });
    wrap.appendChild(row);

    const detail = document.createElement("div");
    detail.className = "pe-flow-detail";
    let html = "";
    if ((requiredTags || []).length) {
        html += `<div><strong>Requires:</strong> ` + (requiredTags.map(t =>
            unmetRequired.includes(t)
                ? `<span class="pe-tag-chip">${t} \u2014 not produced by anything earlier</span>`
                : `<span class="pe-tag-chip">${t}</span>`
        ).join(" ")) + `</div>`;
    }
    if ((excludeTags || []).length) {
        html += `<div style="margin-top:4px"><strong>Blocks downstream:</strong> ` + (excludeTags.map(t =>
            unmatchedExclude.includes(t)
                ? `<span class="pe-tag-chip">${t} \u2014 nothing later currently carries this</span>`
                : `<span class="pe-tag-chip">${t}</span>`
        ).join(" ")) + `</div>`;
    }
    if (!(requiredTags || []).length && !(excludeTags || []).length) {
        html = `<div style="color:#888">No required_tags or exclude_tags set \u2014 this item has no filtering effect and isn't gated by anything.</div>`;
    }
    detail.innerHTML = html;
    wrap.appendChild(detail);
    container.appendChild(wrap);
}

async function openEditor() {
    injectStyles();
    const taxonomy = await getTaxonomy();
    const listsRes = await fetch(`${API}/lists`);
    const listNames = await listsRes.json();

    const overlay = document.createElement("div");
    overlay.className = "pe-overlay";
    overlay.innerHTML = `
      <div class="pe-modal">
        <div class="pe-header">
          <strong>Prompt Engine — Dataset Editor</strong>
          <select id="pe-list-select"></select>
          <button class="pe-btn" id="pe-manage-taxonomy">\u{1F3F7}\uFE0F Manage Taxonomy</button>
          <button class="pe-btn" id="pe-batch-add">\u{1F30A} Batch Add</button>
          <button class="pe-btn" id="pe-llm-settings">\u2699\uFE0F LLM Settings</button>
          <span class="pe-close" id="pe-close">&times;</span>
        </div>
        <div class="pe-body" id="pe-body"></div>
        <div class="pe-footer">
          <span id="pe-status"></span>
          <div>
            <button class="pe-btn" id="pe-undo">\u21A9 Undo last change</button>
            <button class="pe-btn pe-btn-primary" id="pe-add-item">+ Add item</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const select = overlay.querySelector("#pe-list-select");
    for (const name of listNames) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    }

    let currentItems = [];
    let selectedIdx = new Set();
    let history = [];

    async function loadList(name) {
        const res = await fetch(`${API}/list/${name}`);
        currentItems = await res.json();
        selectedIdx = new Set();
        history = [];
        renderTable();
    }

    /** Applies newItems, saves, and — only on success — pushes the pre-change state
     * onto the undo stack. On failure, rolls currentItems back automatically. */
    async function commitAndTrack(newItems) {
        const previous = currentItems.slice();
        currentItems = newItems;
        const result = await saveCurrentList();
        if (result.ok) {
            history.push(previous);
            if (history.length > 25) history.shift();
        } else {
            currentItems = previous;
        }
        return result;
    }

    async function undoLast() {
        const status = overlay.querySelector("#pe-status");
        if (!history.length) {
            status.innerHTML = `<span style="color:#888">Nothing to undo.</span>`;
            return;
        }
        currentItems = history.pop();
        selectedIdx = new Set();
        const result = await saveCurrentList();
        if (result.ok) status.innerHTML = `<span style="color:#7ac47a">Undone.</span>`;
    }

    function batchBarHTML() {
        return `<div class="pe-batch-bar">
            <span>${selectedIdx.size} selected</span>
            <button class="pe-btn pe-btn-primary pe-batch-edit-btn">Edit tags on selected</button>
            <button class="pe-btn pe-batch-llm-assist-btn">\u{1FA84} LLM Assist (required/exclude)</button>
            <button class="pe-btn pe-btn-danger pe-batch-delete-btn">Delete selected</button>
        </div>`;
    }

    function renderTable() {
        const body = overlay.querySelector("#pe-body");
        body.innerHTML = "";

        if (selectedIdx.size > 0) body.insertAdjacentHTML("beforeend", batchBarHTML());

        const table = document.createElement("table");
        table.className = "pe-table";
        table.innerHTML = `<thead><tr><th><input type="checkbox" id="pe-select-all"></th>
            <th>Name</th><th>Tags</th><th>Required</th><th>Exclude</th><th></th></tr></thead>`;
        const tbody = document.createElement("tbody");
        currentItems.forEach((item, idx) => {
            const tr = document.createElement("tr");
            const chips = (arr) => (arr || []).map(t => `<span class="pe-tag-chip">${t}</span>`).join(" ");
            tr.innerHTML = `
                <td><input type="checkbox" class="pe-row-check" data-idx="${idx}" ${selectedIdx.has(idx) ? "checked" : ""}></td>
                <td>${item.name}<br><span style="color:#777;font-size:11px">${item.id}</span></td>
                <td>${chips(item.tags)}</td>
                <td>${chips(item.required_tags)}</td>
                <td>${chips(item.exclude_tags)}</td>
                <td class="pe-actions">
                    <button class="pe-btn" data-action="edit" data-idx="${idx}">Edit</button>
                    <button class="pe-btn" data-action="flow" data-idx="${idx}">Pipeline</button>
                    <button class="pe-btn pe-btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
                </td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);

        if (selectedIdx.size > 0) body.insertAdjacentHTML("beforeend", batchBarHTML());

        body.querySelector("#pe-select-all").addEventListener("change", (e) => {
            selectedIdx = e.target.checked ? new Set(currentItems.map((_, i) => i)) : new Set();
            renderTable();
        });
        body.querySelectorAll(".pe-row-check").forEach(cb => cb.addEventListener("change", () => {
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) selectedIdx.add(idx); else selectedIdx.delete(idx);
            renderTable();
        }));
        body.querySelectorAll(".pe-batch-edit-btn").forEach(btn => btn.addEventListener("click", () => openBatchEditForm()));
        body.querySelectorAll(".pe-batch-llm-assist-btn").forEach(btn => btn.addEventListener("click", () => openRequiredExcludeAssistForm()));
        body.querySelectorAll(".pe-batch-delete-btn").forEach(btn => btn.addEventListener("click", async () => {
            if (!confirm(`Delete ${selectedIdx.size} item(s)?`)) return;
            const newItems = currentItems.filter((_, idx) => !selectedIdx.has(idx));
            selectedIdx = new Set();
            await commitAndTrack(newItems);
        }));
        body.querySelectorAll('[data-action="edit"]').forEach(btn =>
            btn.addEventListener("click", () => openItemForm(parseInt(btn.dataset.idx))));
        body.querySelectorAll('[data-action="flow"]').forEach(btn =>
            btn.addEventListener("click", () => openFlowPanel(parseInt(btn.dataset.idx))));
        body.querySelectorAll('[data-action="delete"]').forEach(btn =>
            btn.addEventListener("click", async () => {
                if (!confirm("Delete this item?")) return;
                const newItems = currentItems.slice();
                newItems.splice(parseInt(btn.dataset.idx), 1);
                selectedIdx = new Set();
                await commitAndTrack(newItems);
            }));
    }

    function openFlowPanel(idx) {
        const item = currentItems[idx];
        const panel = document.createElement("div");
        panel.className = "pe-form-overlay";
        panel.innerHTML = `<h3 style="margin-top:0">Pipeline placement — ${item.name}</h3>
            <div id="pe-flow-container"></div>
            <div style="margin-top:16px;"><button class="pe-btn" id="pe-flow-close">Close</button></div>`;
        overlay.querySelector(".pe-modal").appendChild(panel);
        renderPipelineFlow(panel.querySelector("#pe-flow-container"), select.value, item.required_tags, item.exclude_tags);
        panel.querySelector("#pe-flow-close").addEventListener("click", () => panel.remove());
    }

    function openItemForm(idx = null) {
        const isNew = idx === null;
        const item = isNew ? { id: "", name: "", tags: [], required_tags: [], exclude_tags: [] } : currentItems[idx];

        const formOverlay = document.createElement("div");
        formOverlay.className = "pe-form-overlay";
        const actionRowHTML = `
          <div style="margin:8px 0;">
            <button class="pe-btn pe-btn-primary pe-form-save">Save item</button>
            <button class="pe-btn pe-form-cancel">Cancel</button>
          </div>`;
        formOverlay.innerHTML = `
          ${actionRowHTML}
          <div class="pe-field">
            <label>Name (natural text sent to the LLM synthesizer)</label>
            <input type="text" id="pe-form-name" value="${item.name.replace(/"/g, '&quot;')}">
          </div>
          <div class="pe-field">
            <label>ID (auto-generated, editable)</label>
            <input type="text" id="pe-form-id" value="${item.id}">
          </div>
          <div class="pe-field"><label>Tags — this item's own traits</label><div id="pe-tags-tags"></div></div>
          <div class="pe-field"><label>Required tags — at least one must already be active</label><div id="pe-tags-required"></div></div>
          <div class="pe-field"><label>Exclude tags — invalidates this item if active</label><div id="pe-tags-exclude"></div></div>
          <button class="pe-btn" id="pe-form-preview-flow">View in pipeline</button>
          <div id="pe-form-flow-container"></div>
          <div id="pe-form-msgs" style="margin-top:10px;"></div>
          ${actionRowHTML}
        `;
        overlay.querySelector(".pe-modal").appendChild(formOverlay);

        formOverlay.querySelector("#pe-tags-tags").appendChild(tagCheckboxGroup(taxonomy, "pe-tags", item.tags || []));
        formOverlay.querySelector("#pe-tags-required").appendChild(tagCheckboxGroup(taxonomy, "pe-required", item.required_tags || []));
        formOverlay.querySelector("#pe-tags-exclude").appendChild(tagCheckboxGroup(taxonomy, "pe-exclude", item.exclude_tags || []));

        formOverlay.querySelector("#pe-form-preview-flow").addEventListener("click", () => {
            renderPipelineFlow(
                formOverlay.querySelector("#pe-form-flow-container"),
                select.value,
                readCheckedTags(formOverlay, "pe-required"),
                readCheckedTags(formOverlay, "pe-exclude"),
            );
        });

        const nameInput = formOverlay.querySelector("#pe-form-name");
        const idInput = formOverlay.querySelector("#pe-form-id");
        if (isNew) {
            nameInput.addEventListener("input", () => { idInput.value = slugify(nameInput.value); });
        }

        formOverlay.querySelectorAll(".pe-form-cancel").forEach(btn => btn.addEventListener("click", () => formOverlay.remove()));
        formOverlay.querySelectorAll(".pe-form-save").forEach(btn => btn.addEventListener("click", async () => {
            const newItem = {
                id: idInput.value.trim(),
                name: nameInput.value.trim(),
                tags: readCheckedTags(formOverlay, "pe-tags"),
                required_tags: readCheckedTags(formOverlay, "pe-required"),
                exclude_tags: readCheckedTags(formOverlay, "pe-exclude"),
            };
            if (!newItem.id || !newItem.name) {
                formOverlay.querySelector("#pe-form-msgs").innerHTML = `<div class="pe-error">Name and ID are required.</div>`;
                return;
            }
            const newItems = isNew
                ? [...currentItems, newItem]
                : currentItems.map((it, i) => (i === idx ? newItem : it));

            const result = await commitAndTrack(newItems);
            if (result.ok) {
                formOverlay.remove();
            } else {
                formOverlay.querySelector("#pe-form-msgs").innerHTML =
                    result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
            }
        }));
    }

    function openBatchAddForm() {
        const panel = document.createElement("div");
        panel.className = "pe-form-overlay";
        const actionRowHTML = `
          <div style="margin:8px 0;">
            <button class="pe-btn pe-btn-primary pe-batch-save">Add items</button>
            <button class="pe-btn pe-batch-cancel">Cancel</button>
          </div>`;
        panel.innerHTML = `
          <h3 style="margin-top:0">Batch add to ${select.value}</h3>
          ${actionRowHTML}
          <div class="pe-field">
            <label>Item names — one per line, or comma-separated</label>
            <textarea id="pe-batch-names" placeholder="Rain-slicked back alley\nFoggy pine forest clearing\n...&#10;&#10;or: Rain-slicked back alley, Foggy pine forest clearing, ..."></textarea>
          </div>
          <div style="margin-bottom:10px;">
            <button class="pe-btn pe-btn-primary" id="pe-batch-mode-shared">Apply shared tags</button>
            <button class="pe-btn" id="pe-batch-mode-suggest">Suggest tags with LLM</button>
          </div>

          <div id="pe-batch-shared-mode">
            <div class="pe-field"><label>Shared tags — applied to every new item</label><div id="pe-batch-tags"></div></div>
            <div class="pe-field"><label>Shared required tags</label><div id="pe-batch-required"></div></div>
            <div class="pe-field"><label>Shared exclude tags</label><div id="pe-batch-exclude"></div></div>
            <button class="pe-btn" id="pe-batch-preview-flow">Preview placement in pipeline</button>
            <div id="pe-batch-flow-container"></div>
          </div>

          <div id="pe-batch-suggest-mode" style="display:none;">
            <button class="pe-btn pe-btn-primary" id="pe-batch-suggest-btn">\u{1FA84} Suggest tags</button>
            <div id="pe-batch-suggest-status" style="margin:6px 0;"></div>
            <div id="pe-batch-suggest-review"></div>
          </div>

          <div id="pe-batch-msgs" style="margin-top:10px;"></div>
          ${actionRowHTML}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        let batchMode = "shared";
        let suggestedItems = null; // [{id, name, tags, required_tags, exclude_tags, dropped}]

        panel.querySelector("#pe-batch-tags").appendChild(tagCheckboxGroup(taxonomy, "pe-b-tags", []));
        panel.querySelector("#pe-batch-required").appendChild(tagCheckboxGroup(taxonomy, "pe-b-required", []));
        panel.querySelector("#pe-batch-exclude").appendChild(tagCheckboxGroup(taxonomy, "pe-b-exclude", []));

        function setMode(mode) {
            batchMode = mode;
            panel.querySelector("#pe-batch-shared-mode").style.display = mode === "shared" ? "" : "none";
            panel.querySelector("#pe-batch-suggest-mode").style.display = mode === "suggest" ? "" : "none";
            panel.querySelector("#pe-batch-mode-shared").className = "pe-btn" + (mode === "shared" ? " pe-btn-primary" : "");
            panel.querySelector("#pe-batch-mode-suggest").className = "pe-btn" + (mode === "suggest" ? " pe-btn-primary" : "");
        }
        panel.querySelector("#pe-batch-mode-shared").addEventListener("click", () => setMode("shared"));
        panel.querySelector("#pe-batch-mode-suggest").addEventListener("click", () => setMode("suggest"));

        panel.querySelector("#pe-batch-preview-flow").addEventListener("click", () => {
            renderPipelineFlow(
                panel.querySelector("#pe-batch-flow-container"),
                select.value,
                readCheckedTags(panel, "pe-b-required"),
                readCheckedTags(panel, "pe-b-exclude"),
            );
        });

        function getNames() {
            return panel.querySelector("#pe-batch-names").value.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
        }

        function renderSuggestReview() {
            const container = panel.querySelector("#pe-batch-suggest-review");
            container.innerHTML = "";
            suggestedItems.forEach((item, idx) => {
                const row = document.createElement("div");
                row.className = "pe-tag-group";
                const chips = item.tags.map(t => `<span class="pe-tag-chip">${t}</span>`).join(" ") || "<span style=\"color:#888\">no tags</span>";
                const droppedNote = item.dropped && item.dropped.length
                    ? `<div class="pe-warning">Model also suggested (not in taxonomy, ignored): ${item.dropped.join(", ")}</div>` : "";
                row.innerHTML = `
                    <div class="pe-tag-group-title">${item.name}</div>
                    <div>${chips}</div>
                    ${droppedNote}
                    <button class="pe-btn" data-edit-idx="${idx}" style="margin-top:6px;">Edit tags</button>
                    <div class="pe-edit-tags-${idx}"></div>
                `;
                container.appendChild(row);
            });
            container.querySelectorAll("[data-edit-idx]").forEach(btn => btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.editIdx);
                const target = container.querySelector(`.pe-edit-tags-${idx}`);
                if (target.childElementCount) { target.innerHTML = ""; return; }
                const picker = tagCheckboxGroup(taxonomy, `pe-suggest-edit-${idx}`, suggestedItems[idx].tags);
                target.appendChild(picker);
                const applyBtn = document.createElement("button");
                applyBtn.className = "pe-btn pe-btn-primary";
                applyBtn.textContent = "Apply";
                applyBtn.style.marginTop = "6px";
                applyBtn.addEventListener("click", () => {
                    suggestedItems[idx].tags = readCheckedTags(target, `pe-suggest-edit-${idx}`);
                    renderSuggestReview();
                });
                target.appendChild(applyBtn);
            }));
        }

        panel.querySelector("#pe-batch-suggest-btn").addEventListener("click", async () => {
            const names = getNames();
            const status = panel.querySelector("#pe-batch-suggest-status");
            if (!names.length) { status.innerHTML = `<div class="pe-error">Enter at least one item name first.</div>`; return; }

            const batches = chunkArray(names, LLM_ASSIST_BATCH_SIZE);
            const allSuggestions = [];
            let lastAutoUnloaded;

            for (let b = 0; b < batches.length; b++) {
                status.innerHTML = batches.length > 1
                    ? `Batch ${b + 1} of ${batches.length} (${batches[b].length} items)...`
                    : `Asking the model to tag ${batches[b].length} item(s)...`;

                const res = await fetchJsonSafe(`${API}/llm/suggest_tags`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ list_name: select.value, item_names: batches[b] }),
                });

                if (!res.ok) {
                    status.innerHTML = `<div class="pe-error">${res.error}` +
                        (b > 0 ? ` (batch ${b + 1} of ${batches.length}; ${allSuggestions.length} item(s) from earlier batches are still available to review below)` : "") +
                        `</div>`;
                    if (allSuggestions.length === 0) return;
                    break;
                }
                allSuggestions.push(...res.suggestions);
                lastAutoUnloaded = res.auto_unloaded;
            }

            const existingIds = new Set(currentItems.map(it => it.id));
            suggestedItems = allSuggestions.map(s => {
                let id = slugify(s.name), suffix = 2;
                while (existingIds.has(id)) { id = `${slugify(s.name)}_${suffix++}`; }
                existingIds.add(id);
                return { id, name: s.name, tags: s.tags, required_tags: [], exclude_tags: [], dropped: s.dropped };
            });
            if (suggestedItems.length === names.length) {
                status.innerHTML = lastAutoUnloaded !== undefined
                    ? `<span style="color:#7ac47a">Done. Model ${lastAutoUnloaded ? "was" : "could not be"} auto-unloaded.</span>`
                    : `<span style="color:#7ac47a">Done \u2014 review below, then click Add items.</span>`;
            }
            renderSuggestReview();
        });

        panel.querySelectorAll(".pe-batch-cancel").forEach(btn => btn.addEventListener("click", () => panel.remove()));
        panel.querySelectorAll(".pe-batch-save").forEach(btn => btn.addEventListener("click", async () => {
            const msgs = panel.querySelector("#pe-batch-msgs");
            let newItems;

            if (batchMode === "suggest") {
                if (!suggestedItems || !suggestedItems.length) {
                    msgs.innerHTML = `<div class="pe-error">Click "Suggest tags" first, or switch to "Apply shared tags".</div>`;
                    return;
                }
                newItems = suggestedItems.map(({ dropped, ...item }) => item);
            } else {
                const lines = getNames();
                if (!lines.length) { msgs.innerHTML = `<div class="pe-error">Enter at least one item name.</div>`; return; }
                const sharedTags = readCheckedTags(panel, "pe-b-tags");
                const sharedRequired = readCheckedTags(panel, "pe-b-required");
                const sharedExclude = readCheckedTags(panel, "pe-b-exclude");
                const existingIds = new Set(currentItems.map(it => it.id));
                newItems = lines.map(name => {
                    let id = slugify(name), suffix = 2;
                    while (existingIds.has(id)) { id = `${slugify(name)}_${suffix++}`; }
                    existingIds.add(id);
                    return { id, name, tags: [...sharedTags], required_tags: [...sharedRequired], exclude_tags: [...sharedExclude] };
                });
            }

            const result = await commitAndTrack(currentItems.concat(newItems));
            if (result.ok) {
                panel.remove();
            } else {
                msgs.innerHTML = result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
            }
        }));
    }

    function openRequiredExcludeAssistForm() {
        const panel = document.createElement("div");
        panel.className = "pe-form-overlay";
        const actionRowHTML = `
          <div style="margin:8px 0;">
            <button class="pe-btn pe-btn-primary pe-rea-apply">Apply to selected</button>
            <button class="pe-btn pe-rea-cancel">Cancel</button>
          </div>`;
        panel.innerHTML = `
          <h3 style="margin-top:0">LLM Assist \u2014 required/exclude tags for ${selectedIdx.size} item(s)</h3>
          <p style="color:#888;font-size:12px;">Each tag below is shown once \u2014 pick Req, Excl, or leave it neutral. Only tags that are actually producible earlier (Req) or later (Excl) in the pipeline for ${select.value} are selectable in that direction. Nothing saves until you click Apply, and this only adds to each item's existing tags.</p>
          ${actionRowHTML}
          <div id="pe-rea-status"></div>
          <div id="pe-rea-review"></div>
          ${actionRowHTML}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        const selected = Array.from(selectedIdx).map(idx => currentItems[idx]);
        let reviewItems = null; // [{name, required_tags, exclude_tags, dropped_required, dropped_exclude}]
        let controllers = []; // one renderTriStateTags() accessor per review row, in order

        async function renderReview() {
            const pipelineData = await getPipeline();
            const producers = await getTagProducers();
            const currentStep = pipelineData.find(s => s.lists.includes(select.value))?.step;
            const fullRequired = new Set(), fullExclude = new Set();
            for (const [tag, lists] of Object.entries(producers)) {
                const steps = lists.map(l => pipelineData.find(s => s.lists.includes(l))?.step).filter(Boolean);
                if (steps.some(s => s < currentStep)) fullRequired.add(tag);
                if (steps.some(s => s > currentStep)) fullExclude.add(tag);
            }
            const requiredCandidates = [...fullRequired];
            const excludeCandidates = [...fullExclude];

            const container = panel.querySelector("#pe-rea-review");
            container.innerHTML = "";
            controllers = [];
            reviewItems.forEach((item) => {
                const row = document.createElement("div");
                row.className = "pe-tag-group";
                const droppedNotes = [
                    item.dropped_required?.length ? `Dropped (not a valid required candidate): ${item.dropped_required.join(", ")}` : "",
                    item.dropped_exclude?.length ? `Dropped (not a valid exclude candidate): ${item.dropped_exclude.join(", ")}` : "",
                ].filter(Boolean);
                row.innerHTML = `
                    <div class="pe-tag-group-title">${item.name}</div>
                    ${droppedNotes.map(n => `<div class="pe-warning">${n}</div>`).join("")}
                    <div class="pe-rea-tristate-container" style="margin-top:6px;"></div>
                `;
                container.appendChild(row);
                controllers.push(renderTriStateTags(
                    row.querySelector(".pe-rea-tristate-container"),
                    requiredCandidates, excludeCandidates,
                    item.required_tags, item.exclude_tags,
                ));
            });
        }

        (async () => {
            const status = panel.querySelector("#pe-rea-status");
            const batches = chunkArray(selected, LLM_ASSIST_BATCH_SIZE);
            const allSuggestions = [];
            let lastAutoUnloaded;

            for (let b = 0; b < batches.length; b++) {
                status.innerHTML = batches.length > 1
                    ? `Batch ${b + 1} of ${batches.length} (${batches[b].length} items)...`
                    : `Asking the model about ${batches[b].length} item(s)...`;

                const res = await fetchJsonSafe(`${API}/llm/suggest_required_exclude`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        list_name: select.value,
                        items: batches[b].map(it => ({ name: it.name, tags: it.tags })),
                    }),
                });

                if (!res.ok) {
                    status.innerHTML = `<div class="pe-error">${res.error}` +
                        (b > 0 ? ` (batch ${b + 1} of ${batches.length}; ${allSuggestions.length} item(s) from earlier batches are still available to review below)` : "") +
                        `</div>`;
                    if (allSuggestions.length === 0) return;
                    break;
                }
                allSuggestions.push(...res.suggestions);
                lastAutoUnloaded = res.auto_unloaded;
            }

            reviewItems = allSuggestions;
            if (reviewItems.length === selected.length) {
                status.innerHTML = lastAutoUnloaded !== undefined
                    ? `<span style="color:#7ac47a">Done. Model ${lastAutoUnloaded ? "was" : "could not be"} auto-unloaded.</span>`
                    : `<span style="color:#7ac47a">Done \u2014 review below, then click Apply.</span>`;
            }
            await renderReview();
        })();

        panel.querySelectorAll(".pe-rea-cancel").forEach(btn => btn.addEventListener("click", () => panel.remove()));
        panel.querySelectorAll(".pe-rea-apply").forEach(btn => btn.addEventListener("click", async () => {
            if (!reviewItems) return;
            const union = (a, b) => Array.from(new Set([...(a || []), ...b]));
            const newItems = currentItems.map((it, idx) => {
                const pos = Array.from(selectedIdx).indexOf(idx);
                if (pos === -1 || !controllers[pos]) return it;
                return {
                    ...it,
                    required_tags: union(it.required_tags, controllers[pos].getRequired()),
                    exclude_tags: union(it.exclude_tags, controllers[pos].getExcluded()),
                };
            });
            const result = await commitAndTrack(newItems);
            if (result.ok) {
                selectedIdx = new Set();
                panel.remove();
                renderTable();
            } else {
                panel.querySelector("#pe-rea-status").innerHTML = result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
            }
        }));
    }

    function openBatchEditForm() {
        const panel = document.createElement("div");
        panel.className = "pe-form-overlay";
        const actionRowHTML = `
          <div style="margin:8px 0;">
            <button class="pe-btn pe-btn-primary pe-be-save">Add tags to selected</button>
            <button class="pe-btn pe-btn-danger pe-be-remove">Remove tags from selected</button>
            <button class="pe-btn pe-be-cancel">Cancel</button>
          </div>`;
        panel.innerHTML = `
          <h3 style="margin-top:0">Apply tags to ${selectedIdx.size} selected item(s)</h3>
          <p style="color:#888;font-size:12px;">Check the tags you want, then either add them to every selected item's existing tags, or remove them if the items already have them \u2014 nothing else on the item is touched either way.</p>
          ${actionRowHTML}
          <div class="pe-field"><label>Tags</label><div id="pe-be-tags"></div></div>
          <div class="pe-field"><label>Required tags</label><div id="pe-be-required"></div></div>
          <div class="pe-field"><label>Exclude tags</label><div id="pe-be-exclude"></div></div>
          <div id="pe-be-msgs"></div>
          ${actionRowHTML}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        panel.querySelector("#pe-be-tags").appendChild(tagCheckboxGroup(taxonomy, "pe-be-tags", []));
        panel.querySelector("#pe-be-required").appendChild(tagCheckboxGroup(taxonomy, "pe-be-required", []));
        panel.querySelector("#pe-be-exclude").appendChild(tagCheckboxGroup(taxonomy, "pe-be-exclude", []));

        panel.querySelectorAll(".pe-be-cancel").forEach(btn => btn.addEventListener("click", () => panel.remove()));

        async function applyBatchEdit(mode) {
            const chosenTags = readCheckedTags(panel, "pe-be-tags");
            const chosenRequired = readCheckedTags(panel, "pe-be-required");
            const chosenExclude = readCheckedTags(panel, "pe-be-exclude");
            if (!chosenTags.length && !chosenRequired.length && !chosenExclude.length) {
                panel.querySelector("#pe-be-msgs").innerHTML = `<div class="pe-error">Select at least one tag.</div>`;
                return;
            }
            const union = (a, b) => Array.from(new Set([...(a || []), ...b]));
            const subtract = (a, b) => (a || []).filter(t => !b.includes(t));
            const combine = mode === "remove" ? subtract : union;

            const newItems = currentItems.map((it, idx) => {
                if (!selectedIdx.has(idx)) return it;
                return {
                    ...it,
                    tags: combine(it.tags, chosenTags),
                    required_tags: combine(it.required_tags, chosenRequired),
                    exclude_tags: combine(it.exclude_tags, chosenExclude),
                };
            });
            const result = await commitAndTrack(newItems);
            if (result.ok) {
                selectedIdx = new Set();
                panel.remove();
                renderTable();
            } else {
                panel.querySelector("#pe-be-msgs").innerHTML = result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
            }
        }

        panel.querySelectorAll(".pe-be-save").forEach(btn => btn.addEventListener("click", () => applyBatchEdit("add")));
        panel.querySelectorAll(".pe-be-remove").forEach(btn => btn.addEventListener("click", () => applyBatchEdit("remove")));
    }

    async function saveCurrentList() {
        const name = select.value;
        const res = await fetch(`${API}/list/${name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: currentItems }),
        });
        const result = await res.json();
        invalidateDatasetCaches();
        const status = overlay.querySelector("#pe-status");
        if (result.ok) {
            status.innerHTML = result.warnings.length
                ? result.warnings.map(w => `<div class="pe-warning">${w}</div>`).join("")
                : `<span style="color:#7ac47a">Saved.</span>`;
            renderTable();
        } else {
            status.innerHTML = result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
        }
        return result;
    }

    select.addEventListener("change", () => loadList(select.value));
    overlay.querySelector("#pe-close").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#pe-add-item").addEventListener("click", () => openItemForm(null));
    overlay.querySelector("#pe-undo").addEventListener("click", () => undoLast());
    overlay.querySelector("#pe-manage-taxonomy").addEventListener("click", () => openTaxonomyPanel());
    overlay.querySelector("#pe-batch-add").addEventListener("click", () => openBatchAddForm());
    overlay.querySelector("#pe-llm-settings").addEventListener("click", () => openLlmSettingsPanel());

    function openLlmSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "pe-taxo-panel";
        const closeRow = `<div style="margin-bottom:8px;"><button class="pe-btn pe-llm-close">Close</button></div>`;
        panel.innerHTML = `
          <h3 style="margin-top:0">LLM Settings</h3>
          ${closeRow}
          <div class="pe-field">
            <label>Backend preset</label>
            <select id="pe-llm-preset"></select>
          </div>
          <div class="pe-field">
            <label>Base URL</label>
            <input type="text" id="pe-llm-base-url">
          </div>
          <div class="pe-field">
            <label>API key (leave blank for most local setups)</label>
            <input type="text" id="pe-llm-api-key">
          </div>
          <div class="pe-field">
            <label>Model</label>
            <div style="display:flex; gap:8px;">
              <select id="pe-llm-model" style="flex:1;"></select>
              <button class="pe-btn" id="pe-llm-refresh">Refresh models</button>
            </div>
            <div id="pe-llm-model-list" style="margin-top:6px;"></div>
          </div>
          <div class="pe-field" style="display:flex; align-items:center; gap:10px;">
            <label class="pe-toggle" style="margin:0;">
              <input type="checkbox" id="pe-llm-auto-unload">
              <span class="pe-toggle-slider"></span>
            </label>
            <span style="font-size:12px;">Auto-unload model after each Suggest-tags call (LM Studio only)</span>
          </div>
          <div class="pe-field">
            <label>Request timeout (seconds) \u2014 applies to suggest/assist calls; raise this for large batches</label>
            <input type="text" id="pe-llm-timeout" style="width:80px;">
          </div>
          <div style="margin-bottom:10px;">
            <button class="pe-btn" id="pe-llm-unload-now">Unload now</button>
            <button class="pe-btn" id="pe-llm-test">Test connection</button>
          </div>
          <div id="pe-llm-msgs"></div>
          ${closeRow.replace('pe-llm-close">Close', 'pe-llm-close pe-llm-save">Save')}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        const presetSelect = panel.querySelector("#pe-llm-preset");
        const baseUrlInput = panel.querySelector("#pe-llm-base-url");
        const apiKeyInput = panel.querySelector("#pe-llm-api-key");
        const modelSelect = panel.querySelector("#pe-llm-model");
        const autoUnloadCb = panel.querySelector("#pe-llm-auto-unload");
        const timeoutInput = panel.querySelector("#pe-llm-timeout");
        const msgs = panel.querySelector("#pe-llm-msgs");

        let currentCfg = null;
        let presets = null;

        (async () => {
            presets = await fetchJsonSafe(`${API}/llm/presets`);
            currentCfg = await fetchJsonSafe(`${API}/llm/config`);
            if (currentCfg.error || presets.error) {
                msgs.innerHTML = `<div class="pe-error">Could not load LLM settings: ${currentCfg.error || presets.error}</div>`;
                return;
            }

            presetSelect.innerHTML = Object.entries(presets)
                .map(([key, p]) => `<option value="${key}">${p.label}</option>`).join("");
            presetSelect.value = currentCfg.preset;
            baseUrlInput.value = currentCfg.base_url;
            apiKeyInput.value = currentCfg.api_key;
            autoUnloadCb.checked = !!currentCfg.auto_unload;
            timeoutInput.value = currentCfg.timeout_seconds || 60;
            if (currentCfg.model) {
                modelSelect.innerHTML = `<option value="${currentCfg.model}">${currentCfg.model}</option>`;
            }
        })();

        presetSelect.addEventListener("change", () => {
            if (presets && presets[presetSelect.value]) {
                baseUrlInput.value = presets[presetSelect.value].base_url;
            }
        });

        function readFormCfg() {
            return {
                preset: presetSelect.value,
                base_url: baseUrlInput.value.trim(),
                api_key: apiKeyInput.value.trim(),
                model: modelSelect.value || "",
                auto_unload: autoUnloadCb.checked,
                timeout_seconds: parseInt(timeoutInput.value, 10) || 60,
            };
        }

        async function refreshModels(showMsg) {
            const cfg = readFormCfg();
            msgs.innerHTML = showMsg ? "Checking..." : "";
            const res = await fetchJsonSafe(`${API}/llm/list_models`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
            });
            const listDiv = panel.querySelector("#pe-llm-model-list");
            if (!res.ok) {
                if (showMsg) msgs.innerHTML = `<div class="pe-error">${res.error}</div>`;
                listDiv.innerHTML = "";
                return;
            }
            const previousSelection = modelSelect.value;
            modelSelect.innerHTML = res.models.map(m =>
                `<option value="${m.id}">${m.display_name || m.id}${m.loaded ? " (loaded)" : ""}</option>`).join("");
            if (res.models.some(m => m.id === previousSelection)) modelSelect.value = previousSelection;

            listDiv.innerHTML = res.models.map(m => `
                <div class="pe-model-row">
                    <span class="pe-model-dot" style="background:${m.loaded ? '#2f6b4f' : '#555'}"></span>
                    ${m.display_name || m.id}${m.loaded === null ? "" : (m.loaded ? " \u2014 loaded" : " \u2014 not loaded")}
                </div>`).join("");
            if (showMsg) msgs.innerHTML = `<span style="color:#7ac47a">Found ${res.models.length} model(s).</span>`;
        }

        panel.querySelector("#pe-llm-refresh").addEventListener("click", () => refreshModels(true));
        panel.querySelector("#pe-llm-test").addEventListener("click", () => refreshModels(true));

        panel.querySelector("#pe-llm-unload-now").addEventListener("click", async () => {
            const cfg = readFormCfg();
            if (cfg.preset !== "lm_studio") {
                msgs.innerHTML = `<div class="pe-warning">Unload is only supported for LM Studio right now.</div>`;
                return;
            }
            const modelsRes = await fetchJsonSafe(`${API}/llm/list_models`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
            });
            if (!modelsRes.ok) {
                msgs.innerHTML = `<div class="pe-error">${modelsRes.error}</div>`;
                return;
            }
            const match = modelsRes.models.find(m => m.id === modelSelect.value);
            if (!match || !match.instance_id) {
                msgs.innerHTML = `<div class="pe-warning">Selected model isn't currently loaded.</div>`;
                return;
            }
            const res = await fetchJsonSafe(`${API}/llm/unload`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instance_id: match.instance_id }),
            });
            msgs.innerHTML = res.ok
                ? `<span style="color:#7ac47a">Unloaded.</span>`
                : `<div class="pe-error">${res.error}</div>`;
            refreshModels(false);
        });

        panel.querySelectorAll(".pe-llm-close").forEach(btn => btn.addEventListener("click", () => panel.remove()));
        panel.querySelectorAll(".pe-llm-save").forEach(btn => btn.addEventListener("click", async () => {
            const cfg = readFormCfg();
            const res = await fetchJsonSafe(`${API}/llm/config`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
            });
            if (res.ok) {
                msgs.innerHTML = `<span style="color:#7ac47a">Saved.</span>`;
            } else {
                msgs.innerHTML = `<div class="pe-error">${res.error || "Could not save settings."}</div>`;
            }
        }));
    }

    function openTaxonomyPanel() {
        const panel = document.createElement("div");
        panel.className = "pe-taxo-panel";
        const categories = Object.keys(taxonomy);
        const closeAndUndoRow = `
          <div style="margin-bottom:8px;">
            <button class="pe-btn pe-taxo-close">Close</button>
            <button class="pe-btn pe-taxo-undo">\u21A9 Undo last taxonomy change</button>
          </div>`;
        panel.innerHTML = `
          <h3 style="margin-top:0">Manage Taxonomy</h3>
          ${closeAndUndoRow}
          <div class="pe-taxo-row">
            <div>
              <label style="display:block;font-size:12px;color:#aaa;margin-bottom:4px;">Category</label>
              <select id="pe-taxo-category">
                ${categories.map(c => `<option value="${c}">${c}</option>`).join("")}
                <option value="__new__">+ New category...</option>
              </select>
            </div>
            <div id="pe-taxo-newcat-wrap" style="display:none;">
              <label style="display:block;font-size:12px;color:#aaa;margin-bottom:4px;">New category name</label>
              <input type="text" id="pe-taxo-newcat">
            </div>
            <div>
              <label style="display:block;font-size:12px;color:#aaa;margin-bottom:4px;">New tag</label>
              <input type="text" id="pe-taxo-newtag" placeholder="e.g. rainforest">
            </div>
            <button class="pe-btn pe-btn-primary" id="pe-taxo-add">Add tag</button>
          </div>
          <div id="pe-taxo-msgs"></div>
          <h4>Current taxonomy</h4>
          <p style="color:#888;font-size:12px;">Click \u270e to rename a tag (cascades through every item using it), or \u2715 to delete it. Both warn you first if the tag is currently in use anywhere in the dataset.</p>
          <div id="pe-taxo-current"></div>
          ${closeAndUndoRow}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        function renderCurrent() {
            const wrap = panel.querySelector("#pe-taxo-current");
            wrap.innerHTML = "";
            for (const [cat, tags] of Object.entries(taxonomy)) {
                const box = document.createElement("div");
                box.className = "pe-tag-group";
                box.innerHTML = `<div class="pe-tag-group-title">${cat}</div>` +
                    tags.map(t => `
                        <span class="pe-tag-with-actions">
                            <span class="pe-tag-chip">${t}</span>
                            <button class="pe-tag-mini-btn" data-action="rename" data-tag="${t}" title="Rename">\u270e</button>
                            <button class="pe-tag-mini-btn" data-action="delete" data-tag="${t}" title="Delete">\u2715</button>
                        </span>`).join(" ");
                wrap.appendChild(box);
            }
            wrap.querySelectorAll('[data-action="rename"]').forEach(btn =>
                btn.addEventListener("click", () => openRenameForm(btn.dataset.tag)));
            wrap.querySelectorAll('[data-action="delete"]').forEach(btn =>
                btn.addEventListener("click", () => openDeleteConfirm(btn.dataset.tag)));
        }
        renderCurrent();

        async function refreshAfterCascadingChange() {
            Object.assign(taxonomy, await getTaxonomy(true));
            invalidateDatasetCaches();
            renderCurrent();
            await loadList(select.value); // dataset items may have changed underneath the current table
        }

        function openRenameForm(oldTag) {
            const sub = document.createElement("div");
            sub.className = "pe-form-overlay";
            sub.style.zIndex = "30";
            sub.innerHTML = `
              <h4 style="margin-top:0">Rename tag '${oldTag}'</h4>
              <div class="pe-field">
                <label>New name</label>
                <input type="text" id="pe-rename-input" value="${oldTag}">
              </div>
              <div id="pe-rename-msgs"></div>
              <div style="margin-top:12px;">
                <button class="pe-btn pe-btn-primary" id="pe-rename-save">Rename</button>
                <button class="pe-btn" id="pe-rename-cancel">Cancel</button>
              </div>
            `;
            panel.appendChild(sub);
            sub.querySelector("#pe-rename-cancel").addEventListener("click", () => sub.remove());

            const doRename = async (confirm) => {
                const newTag = sub.querySelector("#pe-rename-input").value.trim().toLowerCase();
                return { newTag, res: await (await fetch(`${API}/taxonomy/rename_tag`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ old_tag: oldTag, new_tag: newTag, confirm }),
                })).json() };
            };

            sub.querySelector("#pe-rename-save").addEventListener("click", async () => {
                const msgs = sub.querySelector("#pe-rename-msgs");
                const { newTag, res } = await doRename(false);
                if (!res.ok && res.similar && res.similar.length) {
                    msgs.innerHTML = `
                        <div class="pe-similar-list">
                          <div class="pe-warning">'${newTag}' looks similar to existing tag(s): ${res.similar.join(", ")}.
                          Confirm if this is genuinely meant to be distinct.</div>
                          <button class="pe-btn pe-btn-primary" id="pe-rename-confirm-anyway">Rename anyway</button>
                        </div>`;
                    msgs.querySelector("#pe-rename-confirm-anyway").addEventListener("click", async () => {
                        const { res: confirmed } = await doRename(true);
                        if (confirmed.ok) {
                            sub.remove();
                            await refreshAfterCascadingChange();
                            panel.querySelector("#pe-taxo-msgs").innerHTML =
                                `<span style="color:#7ac47a">Renamed to '${newTag}', updating ${confirmed.affected_items} item field(s).</span>`;
                        } else {
                            msgs.innerHTML = `<div class="pe-error">${confirmed.error}</div>`;
                        }
                    });
                    return;
                }
                if (!res.ok) { msgs.innerHTML = `<div class="pe-error">${res.error}</div>`; return; }
                sub.remove();
                await refreshAfterCascadingChange();
                panel.querySelector("#pe-taxo-msgs").innerHTML =
                    `<span style="color:#7ac47a">Renamed to '${newTag}', updating ${res.affected_items} item field(s).</span>`;
            });
        }

        function openDeleteConfirm(tag) {
            const sub = document.createElement("div");
            sub.className = "pe-form-overlay";
            sub.style.zIndex = "30";
            sub.innerHTML = `<h4 style="margin-top:0">Checking usage of '${tag}'...</h4>`;
            panel.appendChild(sub);

            (async () => {
                const res = await (await fetch(`${API}/taxonomy/delete_tag`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tag, confirm: false }),
                })).json();

                if (res.ok) {
                    // wasn't in use, already deleted
                    sub.remove();
                    await refreshAfterCascadingChange();
                    panel.querySelector("#pe-taxo-msgs").innerHTML =
                        `<span style="color:#7ac47a">Deleted '${tag}' (it wasn't used anywhere in the dataset).</span>`;
                    return;
                }

                if (res.in_use) {
                    sub.innerHTML = `
                      <h4 style="margin-top:0;color:#e06060">'${tag}' is used by ${res.count} item(s)</h4>
                      <p style="font-size:12px;color:#aaa;">Deleting it will strip it from every one of these. This can't be undone except via "Undo last taxonomy change" right after.</p>
                      <div class="pe-usage-list">
                        ${res.usage.map(u => `<div>${u.list} \u2192 <strong>${u.name}</strong> (${u.fields.join(", ")})</div>`).join("")}
                      </div>
                      <div style="margin-top:12px;">
                        <button class="pe-btn pe-btn-danger" id="pe-delete-confirm-anyway">Delete anyway, strip from ${res.count} item(s)</button>
                        <button class="pe-btn" id="pe-delete-cancel">Cancel</button>
                      </div>
                    `;
                    sub.querySelector("#pe-delete-cancel").addEventListener("click", () => sub.remove());
                    sub.querySelector("#pe-delete-confirm-anyway").addEventListener("click", async () => {
                        const confirmed = await (await fetch(`${API}/taxonomy/delete_tag`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tag, confirm: true }),
                        })).json();
                        if (confirmed.ok) {
                            sub.remove();
                            await refreshAfterCascadingChange();
                            panel.querySelector("#pe-taxo-msgs").innerHTML =
                                `<span style="color:#7ac47a">Deleted '${tag}', updated ${confirmed.affected_items} item field(s).</span>`;
                        } else {
                            sub.innerHTML = `<div class="pe-error">${confirmed.error}</div>
                                <button class="pe-btn" id="pe-delete-cancel2">Close</button>`;
                            sub.querySelector("#pe-delete-cancel2").addEventListener("click", () => sub.remove());
                        }
                    });
                } else {
                    sub.innerHTML = `<div class="pe-error">${res.error || "Could not delete tag."}</div>
                        <button class="pe-btn" id="pe-delete-cancel3">Close</button>`;
                    sub.querySelector("#pe-delete-cancel3").addEventListener("click", () => sub.remove());
                }
            })();
        }

        const catSelect = panel.querySelector("#pe-taxo-category");
        const newCatWrap = panel.querySelector("#pe-taxo-newcat-wrap");
        catSelect.addEventListener("change", () => {
            newCatWrap.style.display = catSelect.value === "__new__" ? "block" : "none";
        });

        panel.querySelectorAll(".pe-taxo-undo").forEach(btn => btn.addEventListener("click", async () => {
            const res = await (await fetch(`${API}/taxonomy/undo`, { method: "POST" })).json();
            const msgs = panel.querySelector("#pe-taxo-msgs");
            if (res.ok) {
                await refreshAfterCascadingChange();
                msgs.innerHTML = `<span style="color:#7ac47a">Undone.</span>`;
            } else {
                msgs.innerHTML = `<span style="color:#888">${res.error}</span>`;
            }
        }));

        panel.querySelector("#pe-taxo-add").addEventListener("click", async () => {
            const msgs = panel.querySelector("#pe-taxo-msgs");
            msgs.innerHTML = "";
            let category = catSelect.value;
            const newTag = panel.querySelector("#pe-taxo-newtag").value.trim().toLowerCase();

            if (category === "__new__") {
                const newCatName = panel.querySelector("#pe-taxo-newcat").value.trim();
                if (!newCatName) { msgs.innerHTML = `<div class="pe-error">New category name is required.</div>`; return; }
                const catRes = await (await fetch(`${API}/taxonomy/add_category`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ category_name: newCatName }),
                })).json();
                if (!catRes.ok) { msgs.innerHTML = `<div class="pe-error">${catRes.error}</div>`; return; }
                category = newCatName;
            }

            if (!newTag) { msgs.innerHTML = `<div class="pe-error">Tag cannot be empty.</div>`; return; }

            const doAdd = async (confirm) => {
                const res = await (await fetch(`${API}/taxonomy/add_tag`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ category, tag: newTag, confirm }),
                })).json();
                return res;
            };

            let res = await doAdd(false);
            if (!res.ok && res.similar && res.similar.length) {
                msgs.innerHTML = `
                    <div class="pe-similar-list">
                      <div class="pe-warning">'${newTag}' looks similar to existing tag(s): ${res.similar.join(", ")}.
                      Reuse one of those instead, or confirm this is genuinely a new, distinct tag.</div>
                      <button class="pe-btn pe-btn-primary" id="pe-taxo-confirm-anyway">Add anyway</button>
                    </div>`;
                msgs.querySelector("#pe-taxo-confirm-anyway").addEventListener("click", async () => {
                    const confirmed = await doAdd(true);
                    if (confirmed.ok) {
                        Object.assign(taxonomy, await getTaxonomy(true));
                        renderCurrent();
                        msgs.innerHTML = `<span style="color:#7ac47a">Added '${newTag}' to ${category}.</span>`;
                    } else {
                        msgs.innerHTML = `<div class="pe-error">${confirmed.error}</div>`;
                    }
                });
                return;
            }

            if (!res.ok) { msgs.innerHTML = `<div class="pe-error">${res.error}</div>`; return; }

            Object.assign(taxonomy, await getTaxonomy(true));
            renderCurrent();
            catSelect.innerHTML = Object.keys(taxonomy).map(c => `<option value="${c}">${c}</option>`).join("") +
                `<option value="__new__">+ New category...</option>`;
            panel.querySelector("#pe-taxo-newtag").value = "";
            msgs.innerHTML = `<span style="color:#7ac47a">Added '${newTag}' to ${category}.</span>`;
        });

        panel.querySelectorAll(".pe-taxo-close").forEach(btn => btn.addEventListener("click", () => panel.remove()));
    }

    await loadList(listNames[0]);
}

app.registerExtension({
    name: "PromptEngine.DatasetEditor",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PromptEngineNode") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            this.addWidget("button", "📝 Edit Dataset", null, () => openEditor());
            return r;
        };
    },
});

import { app } from "../../scripts/app.js";

const API = "/prompt_engine";
let taxonomyCache = null;
let pipelineCache = null;
let tagProducersCache = null;

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

function readCheckedTags(container, groupName) {
    return Array.from(container.querySelectorAll(`input[name="${groupName}"]:checked`)).map(cb => cb.value);
}

function slugify(name) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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
          <div class="pe-field"><label>Shared tags — applied to every new item</label><div id="pe-batch-tags"></div></div>
          <div class="pe-field"><label>Shared required tags</label><div id="pe-batch-required"></div></div>
          <div class="pe-field"><label>Shared exclude tags</label><div id="pe-batch-exclude"></div></div>
          <button class="pe-btn" id="pe-batch-preview-flow">Preview placement in pipeline</button>
          <div id="pe-batch-flow-container"></div>
          <div id="pe-batch-msgs" style="margin-top:10px;"></div>
          ${actionRowHTML}
        `;
        overlay.querySelector(".pe-modal").appendChild(panel);

        panel.querySelector("#pe-batch-tags").appendChild(tagCheckboxGroup(taxonomy, "pe-b-tags", []));
        panel.querySelector("#pe-batch-required").appendChild(tagCheckboxGroup(taxonomy, "pe-b-required", []));
        panel.querySelector("#pe-batch-exclude").appendChild(tagCheckboxGroup(taxonomy, "pe-b-exclude", []));

        panel.querySelector("#pe-batch-preview-flow").addEventListener("click", () => {
            renderPipelineFlow(
                panel.querySelector("#pe-batch-flow-container"),
                select.value,
                readCheckedTags(panel, "pe-b-required"),
                readCheckedTags(panel, "pe-b-exclude"),
            );
        });

        panel.querySelectorAll(".pe-batch-cancel").forEach(btn => btn.addEventListener("click", () => panel.remove()));
        panel.querySelectorAll(".pe-batch-save").forEach(btn => btn.addEventListener("click", async () => {
            const msgs = panel.querySelector("#pe-batch-msgs");
            const lines = panel.querySelector("#pe-batch-names").value.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
            if (!lines.length) { msgs.innerHTML = `<div class="pe-error">Enter at least one item name.</div>`; return; }

            const sharedTags = readCheckedTags(panel, "pe-b-tags");
            const sharedRequired = readCheckedTags(panel, "pe-b-required");
            const sharedExclude = readCheckedTags(panel, "pe-b-exclude");

            const existingIds = new Set(currentItems.map(it => it.id));
            const newItems = lines.map(name => {
                let id = slugify(name), suffix = 2;
                while (existingIds.has(id)) { id = `${slugify(name)}_${suffix++}`; }
                existingIds.add(id);
                return { id, name, tags: [...sharedTags], required_tags: [...sharedRequired], exclude_tags: [...sharedExclude] };
            });

            const result = await commitAndTrack(currentItems.concat(newItems));
            if (result.ok) {
                panel.remove();
            } else {
                msgs.innerHTML = result.errors.map(e => `<div class="pe-error">${e}</div>`).join("");
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

/* Voice queue — Dexie prototype of nexus's /admin/voice-queue.
   Same interaction model (mic capture -> memo cards, #tags, include/exclude
   filters, merge, undo, trash), with everything that needs a server dropped:
   no auth, no Redis, no Cloudflare enrichment, no sync queue. Data lives in
   this browser's IndexedDB only.

   Backup JSON is the same {tags, voiceQueue} shape April and nexus use, so a
   file exported here imports into nexus (and the other way round). Import is
   idempotent: records are keyed by uuid, and the newer updatedAt wins. */

const db = new Dexie('VoiceQueueDB');
db.version(1).stores({ items: 'id,status,createdAt,updatedAt,deletedAt', tags: 'id,order' });

const TAG_COLORS = ['lime', 'sky', 'pink', 'amber', 'violet', 'teal', 'coral', 'ice'];
const TRASH_RETENTION_MS = 30 * 24 * 3600 * 1000;
const COMMIT_SILENCE_MS = 2000;
const UNDO_MAX = 5;

const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_DONE = '<svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg>';
const ICON_UNDO = '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>';
const ICON_CHECK_SMALL = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"/></svg>';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const nowIso = () => new Date().toISOString();
const fmt = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
// A #hashtag can't contain a space but a tag's name can, so both sides are
// slugified before comparing ("Ready to Start" matches #ready-to-start).
const slugifyTagName = name => String(name).toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

let items = [];
let tags = [];
const tagById = id => tags.find(t => t.id === id);

function loadSessionState(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveSessionState(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let itemsEditingId = null;
let itemsEditDraft = null;
const itemsExpandedIds = new Set();
let selectedIds = new Set(loadSessionState('vq_selectedIds', []));
const DONE_FILTERS = ['hide', 'all', 'only'];
let doneFilter = loadSessionState('vq_doneFilter', 'hide');
let trashFilter = loadSessionState('vq_trashFilter', false);
let tagFilter = new Map(loadSessionState('vq_tagFilter', []));
let undoQueue = loadSessionState('vq_undoQueue', []);

/* ── Storage ── */
async function loadAll() {
  const [rawItems, rawTags] = await Promise.all([db.items.toArray(), db.tags.orderBy('order').toArray()]);
  tags = rawTags;
  const byUpdated = (a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
  items = [
    ...rawItems.filter(it => !it.deletedAt).sort(byUpdated),
    ...rawItems.filter(it => it.deletedAt).sort(byUpdated),
  ];
}

async function purgeExpiredTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const expired = (await db.items.toArray()).filter(it => it.deletedAt && new Date(it.deletedAt).getTime() < cutoff);
  if (expired.length) await db.items.bulkDelete(expired.map(it => it.id));
}

// Applies a patch in memory and persists it, bumping updatedAt.
async function patchItem(item, patch) {
  Object.assign(item, patch, { updatedAt: nowIso() });
  await db.items.put({ ...item });
  return item;
}

function newItem({ text, title = null, tags: tagIds = [], llmTags = [] }) {
  const now = nowIso();
  return { id: uuid(), text, title, tags: tagIds, llmTags, status: 'queued', deletedAt: null, summary: null, summaryPoints: [], createdAt: now, updatedAt: now };
}

async function createItem(fields) {
  const item = newItem(fields);
  await db.items.put({ ...item });
  items.unshift(item);
  return item;
}

async function createTag(name, color, llm) {
  const order = tags.length ? Math.max(...tags.map(t => t.order)) + 1 : 0;
  const tag = { id: uuid(), name: llm ? slugifyTagName(name).slice(0, 24) : name.trim(), color, order, ...(llm ? { llm: true } : {}) };
  await db.tags.put(tag);
  tags.push(tag);
  return tag;
}

/* ── Feedback ── */
function showError(message, duration = 3500, ok = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (ok ? ' ok' : '');
  el.textContent = message;
  el.title = 'Click to dismiss';
  el.addEventListener('click', () => el.remove());
  $('toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

async function guarded(label, fn) {
  try { return await fn(); }
  catch (e) {
    console.warn(label, e);
    showError(label + ' — ' + (e && e.message ? e.message : 'storage error'), 6000);
    await loadAll().catch(() => {});
    renderItems();
  }
}

/* ── Undo ── */
function pushUndo(label, changes, meta) {
  undoQueue.push({ id: Date.now() + '-' + Math.random(), label, changes, meta });
  if (undoQueue.length > UNDO_MAX) undoQueue.shift();
  saveSessionState('vq_undoQueue', undoQueue);
  renderUndoPanel();
}

async function applyUndo(entryId) {
  const idx = undoQueue.findIndex(e => e.id === entryId);
  if (idx === -1) return;
  const entry = undoQueue[idx];
  const isTagChange = entry.meta && entry.meta.type === 'tags';
  await guarded("Couldn't undo", async () => {
    for (const c of entry.changes) {
      const item = items.find(i => i.id === c.id);
      if (!item) continue;
      await patchItem(item, isTagChange ? { tags: c.prevTags, llmTags: c.prevLlmTags } : { status: c.prevStatus, deletedAt: c.prevDeletedAt });
    }
    if (entry.meta && entry.meta.type === 'merge' && entry.meta.createdId) {
      await db.items.delete(entry.meta.createdId);
      items = items.filter(i => i.id !== entry.meta.createdId);
    }
  });
  undoQueue.splice(idx, 1);
  saveSessionState('vq_undoQueue', undoQueue);
  renderItems();
  renderUndoPanel();
}

function renderUndoPanel() {
  $('undo-panel').classList.toggle('show', undoQueue.length > 0);
  $('undo-peek').dataset.count = undoQueue.length;
  $('undo-list').innerHTML = [...undoQueue].reverse().map(e =>
    `<div class="undo-row"><span>${esc(e.label)}</span><button class="btn" data-undo-id="${e.id}">Undo</button></div>`
  ).join('');
}

/* ── Filtering ── */
function activeIncludeTagIds() { return [...tagFilter].filter(([, m]) => m === 'include').map(([id]) => id); }

function visibleItems() {
  if (trashFilter) return items.filter(it => it.deletedAt);
  let base = items.filter(it => !it.deletedAt);
  if (doneFilter === 'only') base = base.filter(it => it.status === 'done');
  else if (doneFilter !== 'all') base = base.filter(it => it.status !== 'done');
  const includeIds = activeIncludeTagIds();
  const excludeIds = [...tagFilter].filter(([, m]) => m === 'exclude').map(([id]) => id);
  if (includeIds.length) base = base.filter(it => includeIds.every(id => (it.tags || []).includes(id)));
  if (excludeIds.length) base = base.filter(it => !(it.tags || []).some(id => excludeIds.includes(id)));
  return base;
}

function renderTagFilterChips() {
  const used = new Set(items.filter(it => !it.deletedAt).flatMap(it => it.tags || []));
  $('tag-filter-chips').innerHTML = tags.filter(t => used.has(t.id)).map(t => {
    const state = tagFilter.get(t.id) || 'off';
    const cls = 'tag-chip f-' + t.color + ' ' + state + (t.llm ? ' llm-tag' : '');
    return `<button type="button" class="${cls}" data-tag="${t.id}" draggable="true">${t.llm ? '✨ ' : ''}${esc(t.name)}</button>`;
  }).join('');
}

function updateDoneToggle() {
  const doneCount = items.filter(it => it.status === 'done' && !it.deletedAt).length;
  const btn = $('toggle-done');
  btn.textContent = 'Done';
  btn.dataset.state = doneFilter;
  btn.hidden = trashFilter || (doneCount === 0 && doneFilter === 'hide');
}

function updateTrashToggle() {
  const trashCount = items.filter(it => it.deletedAt).length;
  const btn = $('toggle-trash');
  btn.textContent = trashFilter ? 'Back to active' : 'Trash';
  btn.classList.toggle('include', trashFilter);
  btn.hidden = trashCount === 0 && !trashFilter;
}

function updateFilterCount() {
  $('filter-count').textContent = trashFilter
    ? items.filter(it => it.deletedAt).length + ' in trash'
    : visibleItems().length + ' shown';
}

function updateSelectionBar() {
  $('selection-bar').classList.toggle('show', selectedIds.size > 0);
  $('selection-count').textContent = selectedIds.size + ' selected';
  saveSessionState('vq_selectedIds', [...selectedIds]);
}

/* ── Rendering ── */
function renderItemView(it) {
  const hasTitle = !!(it.title && it.title.trim());
  const expanded = itemsExpandedIds.has(it.id);
  const selected = selectedIds.has(it.id);
  const trashed = !!it.deletedAt;
  const itemLlmTags = new Set(it.llmTags || []);
  const tagsHtml = (it.tags || []).map(id => {
    const t = tagById(id);
    if (!t) return '';
    const isLlm = itemLlmTags.has(id);
    return `<span class="cell-tag t-${t.color}${isLlm ? ' llm-tag' : ''}" draggable="true" data-tag="${id}" data-item="${it.id}">${isLlm ? '✨ ' : ''}${esc(t.name)}</span>`;
  }).join('');
  const statusBadge = trashed ? '<span class="cell-tag status-trashed">Trashed</span>'
    : it.status === 'done' ? '<span class="cell-tag status-done">Done</span>' : '';
  const timeLabel = it.updatedAt !== it.createdAt ? 'Updated ' + fmt(it.updatedAt) : fmt(it.createdAt);
  const actionButtons = trashed ? `
      <button class="act-restore" data-id="${it.id}" title="Restore">${ICON_UNDO}</button>
      <button class="act-delete" data-id="${it.id}" title="Delete forever">${ICON_DELETE}</button>
    ` : `
      <button class="act-edit" data-id="${it.id}" title="Edit">${ICON_EDIT}</button>
      <button class="act-done" data-id="${it.id}" title="${it.status === 'done' ? 'Undo' : 'Done'}">${it.status === 'done' ? ICON_UNDO : ICON_DONE}</button>
      <button class="act-delete" data-id="${it.id}" title="Delete">${ICON_DELETE}</button>
    `;
  const summary = (it.summaryPoints && it.summaryPoints.length)
    ? `<ul class="item-summary-list">${it.summaryPoints.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
    : (it.summary ? `<div class="item-summary">✨ ${esc(it.summary)}</div>` : '');
  return `
    <div class="item ${hasTitle ? 'has-title' : ''} ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''}" data-id="${it.id}">
      ${selected ? `<div class="item-select-badge">${ICON_CHECK_SMALL}</div>` : ''}
      <div class="item-header-actions">${actionButtons}</div>
      <div class="item-content">
        <div class="item-head">
          ${hasTitle ? '<span class="item-caret">▸</span>' : ''}
          <div class="item-title ${hasTitle ? '' : 'untitled'}" ${hasTitle ? 'data-role="toggle"' : ''}>${hasTitle ? esc(it.title) : ''}</div>
        </div>
        <div class="item-text">${esc(it.text)}</div>
        ${summary}
        <div class="item-footer">
          <div class="item-tags">${statusBadge}${tagsHtml}</div>
          <div class="item-time" title="Created ${fmt(it.createdAt)}">${timeLabel}</div>
        </div>
      </div>
      <div class="item-swipe-actions">${actionButtons}</div>
    </div>`;
}

function renderItemEdit(it) {
  return `<div class="item editing" data-id="${it.id}">
    <textarea class="edit-unified" placeholder="# Title (optional)

Body text... #tag or ##ai-tag, inline or their own line, all work">${esc(itemsEditDraft.raw)}</textarea>
  </div>`;
}

function renderItems() {
  const visible = visibleItems();
  const emptyMsg = trashFilter ? 'Trash is empty.' : items.length ? 'Nothing unfinished -- nice.' : 'No voice memos yet. Tap the mic to record one.';
  $('list').innerHTML = visible.length
    ? visible.map(it => it.id === itemsEditingId ? renderItemEdit(it) : renderItemView(it)).join('')
    : `<div class="empty">${emptyMsg}</div>`;
  updateDoneToggle();
  updateTrashToggle();
  updateFilterCount();
  renderTagFilterChips();
}

/* ── Editing ── */
function draftFromItem(it) {
  const titleLine = it.title ? '# ' + it.title + '\n\n' : '';
  // Round-trips the summary block from an imported memo; editing it replaces summaryPoints.
  const summaryBlock = (it.summaryPoints && it.summaryPoints.length)
    ? '\n\n## Summary\n' + it.summaryPoints.map(p => '- ' + p).join('\n')
    : '';
  // ##tag if this memo carries it as an AI tag, #tag if typed by hand.
  const itemLlmTags = new Set(it.llmTags || []);
  const tagNames = (it.tags || []).map(id => ({ id, tag: tagById(id) })).filter(x => x.tag)
    .map(x => (itemLlmTags.has(x.id) ? '##' : '#') + slugifyTagName(x.tag.name));
  const tagLine = tagNames.length ? '\n\n' + tagNames.join(' ') : '';
  return titleLine + it.text + summaryBlock + tagLine;
}

function extractSummaryBlock(text) {
  const lines = (text || '').split('\n');
  const markerIdx = lines.findIndex(l => l.trim().toLowerCase() === '## summary');
  if (markerIdx === -1) return { rest: text, points: [] };
  const points = [];
  let i = markerIdx + 1;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    const m = line.match(/^-\s*(.*)$/);
    if (!m) break;
    if (m[1]) points.push(m[1].slice(0, 80));
  }
  return { rest: [...lines.slice(0, markerIdx), ...lines.slice(i)].join('\n'), points };
}

function parseDraft(raw) {
  const lines = raw.split('\n');
  let title = '', bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const m = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (m) { title = m[1].trim(); bodyStart = i + 1; }
    break;
  }
  return { title, bodyRaw: lines.slice(bodyStart).join('\n') };
}

// ## marks an AI-style tag reference, # a regular one. {1,2} is greedy, so
// "##foo" is captured whole rather than read as a stray "#" plus "#foo".
const HASHTAG_RE = /(#{1,2})([a-z0-9][\w-]*)/gi;
function extractHashtags(text) {
  const found = [];
  const cleaned = (text || '')
    .replace(HASHTAG_RE, (_, hashes, name) => { found.push({ name: name.toLowerCase(), llm: hashes.length === 2 }); return ''; })
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const byName = new Map();
  for (const ref of found) if (!byName.has(ref.name)) byName.set(ref.name, ref);
  return { cleaned, tagRefs: [...byName.values()] };
}

// Returns {id, llm} per resolved ref; llm = this occurrence was written ##tag.
async function resolveTagRefs(refs) {
  const resolved = [];
  for (const ref of refs) {
    const name = slugifyTagName(ref.name);
    let tag = tags.find(t => slugifyTagName(t.name) === name);
    if (!tag) tag = await createTag(name, TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)], ref.llm);
    resolved.push({ id: tag.id, llm: ref.llm });
  }
  return resolved;
}

function autoResizeTextarea(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function startEditItem(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  itemsEditingId = id;
  itemsEditDraft = { raw: draftFromItem(it) };
  renderItems();
  const ta = document.querySelector('.item.editing .edit-unified');
  if (ta) { autoResizeTextarea(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function syncEditDraftFromDom() {
  if (!itemsEditingId) return;
  const ta = document.querySelector('.item.editing .edit-unified');
  if (ta) itemsEditDraft.raw = ta.value;
}

async function saveEditItem() {
  if (!itemsEditingId) return;
  syncEditDraftFromDom();
  const item = items.find(i => i.id === itemsEditingId);
  const raw = itemsEditDraft.raw;
  itemsEditingId = null;
  itemsEditDraft = null;
  if (!item) { renderItems(); return; }

  await guarded("Couldn't save that edit", async () => {
    const { title, bodyRaw } = parseDraft(raw);
    const { rest: bodyWithoutSummary, points: summaryPoints } = extractSummaryBlock(bodyRaw);
    const titleParsed = extractHashtags(title);
    const textParsed = extractHashtags(bodyWithoutSummary);
    const resolved = await resolveTagRefs([...titleParsed.tagRefs, ...textParsed.tagRefs]);
    const patch = {
      title: titleParsed.cleaned.trim() || null,
      text: textParsed.cleaned.trim() || ' ',
      tags: [...new Set(resolved.map(r => r.id))],
      llmTags: [...new Set(resolved.filter(r => r.llm).map(r => r.id))],
      summaryPoints,
    };
    // Opened Edit and clicked straight back out: don't bump updatedAt for nothing.
    // Tags compare as sets, summaryPoints in order.
    const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
    const sameOrder = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const unchanged =
      patch.title === (item.title ?? null) &&
      patch.text === item.text &&
      sameSet(patch.tags, item.tags || []) &&
      sameSet(patch.llmTags, item.llmTags || []) &&
      sameOrder(patch.summaryPoints, item.summaryPoints || []);
    if (!unchanged) await patchItem(item, patch);
    renderItems();
  });
  renderItems();
}

/* ── Toolbar: selection, undo, filters ── */
async function copySelectionAsJson() {
  const selected = items.filter(it => selectedIds.has(it.id));
  const json = JSON.stringify({ instructions: selected.map(it => it.text) }, null, 2);
  const btn = $('btn-copy-selection');
  try {
    await navigator.clipboard.writeText(json);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1200);
  } catch { alert("Couldn't copy to clipboard -- your browser may be blocking it."); }
}

$('btn-copy-selection').addEventListener('click', copySelectionAsJson);
$('btn-clear-selection').addEventListener('click', () => { selectedIds.clear(); updateSelectionBar(); renderItems(); });

$('undo-panel').addEventListener('click', e => {
  const undoBtn = e.target.closest('[data-undo-id]');
  if (undoBtn) { applyUndo(undoBtn.dataset.undoId); return; }
  if (e.target.closest('#undo-peek')) $('undo-panel').classList.toggle('expanded');
});

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input') return;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (!undoQueue.length) return;
    e.preventDefault();
    applyUndo(undoQueue[undoQueue.length - 1].id);
  }
});

document.addEventListener('mousedown', e => {
  if (!itemsEditingId) return;
  if (e.target.closest('.item.editing')) return;
  saveEditItem();
});

$('btn-bulk-merge').addEventListener('click', () => guarded("Couldn't merge", async () => {
  const selected = items.filter(it => selectedIds.has(it.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (selected.length < 2) return;
  const changes = selected.map(it => ({ id: it.id, prevStatus: it.status, prevDeletedAt: it.deletedAt }));
  const created = await createItem({
    text: selected.map(it => it.text).join('\n\n'),
    tags: [...new Set(selected.flatMap(it => it.tags || []))],
    llmTags: [...new Set(selected.flatMap(it => it.llmTags || []))],
  });
  const now = nowIso();
  for (const it of selected) await patchItem(it, { deletedAt: now });
  selectedIds.clear();
  updateSelectionBar();
  pushUndo('Merged ' + selected.length + ' into one', changes, { type: 'merge', createdId: created.id });
  renderItems();
}));

$('btn-bulk-done').addEventListener('click', () => guarded("Couldn't mark done", async () => {
  const changes = [];
  for (const id of [...selectedIds]) {
    const item = items.find(i => i.id === id);
    if (!item || item.status === 'done') continue;
    changes.push({ id, prevStatus: item.status, prevDeletedAt: item.deletedAt });
    await patchItem(item, { status: 'done' });
    if (doneFilter === 'hide') selectedIds.delete(id);
  }
  updateSelectionBar();
  if (changes.length) pushUndo('Marked ' + changes.length + ' done', changes);
  renderItems();
}));

$('btn-bulk-delete').addEventListener('click', () => guarded("Couldn't delete", async () => {
  const changes = [];
  for (const id of [...selectedIds]) {
    const item = items.find(i => i.id === id);
    if (!item) continue;
    if (item.deletedAt) {
      await db.items.delete(id);
      items = items.filter(i => i.id !== id);
    } else {
      changes.push({ id, prevStatus: item.status, prevDeletedAt: null });
      await patchItem(item, { deletedAt: nowIso() });
    }
  }
  selectedIds.clear();
  updateSelectionBar();
  if (changes.length) pushUndo('Deleted ' + changes.length, changes);
  renderItems();
}));

$('toggle-done').addEventListener('click', () => {
  doneFilter = DONE_FILTERS[(DONE_FILTERS.indexOf(doneFilter) + 1) % DONE_FILTERS.length];
  saveSessionState('vq_doneFilter', doneFilter);
  renderItems();
});

$('toggle-trash').addEventListener('click', () => {
  trashFilter = !trashFilter;
  saveSessionState('vq_trashFilter', trashFilter);
  renderItems();
});

const TAG_FILTER_CYCLE = { off: 'include', include: 'exclude', exclude: 'off' };
$('tag-filter-chips').addEventListener('click', e => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const id = chip.dataset.tag;
  const next = TAG_FILTER_CYCLE[tagFilter.get(id) || 'off'];
  next === 'off' ? tagFilter.delete(id) : tagFilter.set(id, next);
  saveSessionState('vq_tagFilter', [...tagFilter]);
  renderItems();
});

/* ── Drag tags on/off cards ── */
$('tag-filter-chips').addEventListener('dragstart', e => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  e.dataTransfer.setData('text/plain', chip.dataset.tag);
  e.dataTransfer.effectAllowed = 'copy';
});

$('list').addEventListener('dragstart', e => {
  const badge = e.target.closest('.cell-tag[data-item]');
  if (!badge) return;
  e.dataTransfer.setData('application/x-vq-tag-remove', JSON.stringify({ tagId: badge.dataset.tag, itemId: badge.dataset.item }));
  e.dataTransfer.effectAllowed = 'move';
});

document.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-vq-tag-remove')) e.preventDefault(); });

document.addEventListener('drop', e => {
  if (!e.dataTransfer.types.includes('application/x-vq-tag-remove')) return;
  e.preventDefault();
  let payload;
  try { payload = JSON.parse(e.dataTransfer.getData('application/x-vq-tag-remove')); } catch { return; }
  const { tagId, itemId } = payload;
  if (e.target.closest('.item[data-id="' + itemId + '"]')) return;
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  guarded("Couldn't remove that tag", async () => {
    const prev = { tags: item.tags || [], llmTags: item.llmTags || [] };
    await patchItem(item, { tags: prev.tags.filter(t => t !== tagId), llmTags: prev.llmTags.filter(t => t !== tagId) });
    pushUndo('Untagged', [{ id: itemId, prevTags: prev.tags, prevLlmTags: prev.llmTags }], { type: 'tags' });
    renderItems();
  });
});

$('list').addEventListener('dragover', e => {
  const card = e.target.closest('.item:not(.editing)');
  if (!card) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  card.classList.add('drag-over');
});
$('list').addEventListener('dragleave', e => {
  const card = e.target.closest('.item');
  if (card) card.classList.remove('drag-over');
});
$('list').addEventListener('drop', e => {
  const card = e.target.closest('.item:not(.editing)');
  if (!card) return;
  e.preventDefault();
  card.classList.remove('drag-over');
  const tagId = e.dataTransfer.getData('text/plain');
  const item = items.find(i => i.id === card.dataset.id);
  if (!tagId || !item || (item.tags || []).includes(tagId)) return;
  guarded("Couldn't attach that tag", async () => {
    const prev = { tags: item.tags || [], llmTags: item.llmTags || [] };
    await patchItem(item, { tags: [...prev.tags, tagId] });
    pushUndo('Tagged', [{ id: item.id, prevTags: prev.tags, prevLlmTags: prev.llmTags }], { type: 'tags' });
    renderItems();
  });
});

/* ── Card clicks ── */
$('list').addEventListener('click', async e => {
  if (!e.target.closest('.item-swipe-actions')) document.querySelectorAll('.item.swiped-open').forEach(c => c.classList.remove('swiped-open'));

  const editBtn = e.target.closest('.act-edit');
  const doneBtn = e.target.closest('.act-done');
  const delBtn = e.target.closest('.act-delete');
  const restoreBtn = e.target.closest('.act-restore');
  const titleToggle = e.target.closest('.item-title[data-role="toggle"]');
  const card = e.target.closest('.item:not(.editing)');

  if (editBtn) {
    startEditItem(editBtn.dataset.id);
  } else if (doneBtn) {
    const item = items.find(i => i.id === doneBtn.dataset.id);
    if (!item) return;
    await guarded("Couldn't update that item", async () => {
      const prevStatus = item.status;
      const nextStatus = prevStatus === 'done' ? 'queued' : 'done';
      await patchItem(item, { status: nextStatus });
      if (nextStatus === 'done' && doneFilter === 'hide') selectedIds.delete(item.id);
      updateSelectionBar();
      pushUndo(nextStatus === 'done' ? 'Marked done' : 'Marked active', [{ id: item.id, prevStatus, prevDeletedAt: item.deletedAt }]);
      renderItems();
    });
  } else if (restoreBtn) {
    const item = items.find(i => i.id === restoreBtn.dataset.id);
    if (!item) return;
    await guarded("Couldn't restore that item", async () => {
      const prevDeletedAt = item.deletedAt;
      await patchItem(item, { deletedAt: null });
      pushUndo('Restored', [{ id: item.id, prevStatus: item.status, prevDeletedAt }]);
      renderItems();
    });
  } else if (delBtn) {
    const id = delBtn.dataset.id;
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (itemsEditingId === id) { itemsEditingId = null; itemsEditDraft = null; }
    itemsExpandedIds.delete(id);
    selectedIds.delete(id);
    await guarded("Couldn't delete that item", async () => {
      // First delete moves to trash; deleting from trash purges for good.
      if (item.deletedAt) {
        await db.items.delete(id);
        items = items.filter(i => i.id !== id);
      } else {
        await patchItem(item, { deletedAt: nowIso() });
        pushUndo('Deleted', [{ id, prevStatus: item.status, prevDeletedAt: null }]);
      }
      updateSelectionBar();
      renderItems();
    });
  } else if (titleToggle) {
    const id = titleToggle.closest('.item').dataset.id;
    itemsExpandedIds.has(id) ? itemsExpandedIds.delete(id) : itemsExpandedIds.add(id);
    renderItems();
  } else if (card) {
    const id = card.dataset.id;
    selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    updateSelectionBar();
    renderItems();
  }
});

let swipeStartX = null, swipeCardId = null;
$('list').addEventListener('touchstart', e => {
  const card = e.target.closest('.item:not(.editing)');
  if (!card) return;
  swipeStartX = e.touches[0].clientX;
  swipeCardId = card.dataset.id;
}, { passive: true });
$('list').addEventListener('touchend', e => {
  if (swipeStartX === null || !swipeCardId) return;
  const card = document.querySelector('.item[data-id="' + swipeCardId + '"]');
  const endX = (e.changedTouches[0] || {}).clientX ?? swipeStartX;
  const dx = endX - swipeStartX;
  if (card && Math.abs(dx) > 40) {
    e.preventDefault();
    if (dx < 0) card.classList.add('swiped-open'); else card.classList.remove('swiped-open');
  }
  swipeStartX = null; swipeCardId = null;
});

$('list').addEventListener('input', e => {
  const ta = e.target.closest('.edit-unified');
  if (ta) autoResizeTextarea(ta);
});

/* ── Mic capture (Web Speech API) ── */
const micSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
let recognition = null, micListening = false, micShouldListen = false;
let pendingBuffer = '', commitTimer = null, commitDeadline = null;

function setMicListening(on) {
  micListening = on;
  $('mic-fab').classList.toggle('live', on);
  $('mic-dot').classList.toggle('on', on);
  $('mic-dot').classList.toggle('off', !on);
  if (!on) renderSpeechBubble('', '');
  $('mic-panel').classList.toggle('show', on);
  $('sheet-backdrop').classList.toggle('show', on);
}

function renderSpeechBubble(pending, interim) {
  const parts = [];
  if (pending) parts.push(esc(pending));
  if (interim) parts.push('<span class="interim">' + esc(interim) + '</span>');
  $('speech-bubble').innerHTML = parts.join(' ');
}

async function submitItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await guarded("Couldn't save that memo", async () => {
    const { cleaned, tagRefs } = extractHashtags(trimmed);
    const resolved = await resolveTagRefs(tagRefs);
    // A memo recorded while filtered to a tag lands where it was recorded instead of vanishing from view.
    const tagIds = [...new Set([...resolved.map(r => r.id), ...activeIncludeTagIds()])];
    const llmTagIds = [...new Set(resolved.filter(r => r.llm).map(r => r.id))];
    await createItem({ text: cleaned || trimmed, tags: tagIds, llmTags: llmTagIds });
    renderItems();
  });
}

function scheduleCommit() {
  if (commitTimer) clearTimeout(commitTimer);
  commitDeadline = Date.now() + COMMIT_SILENCE_MS;
  commitTimer = setTimeout(() => {
    commitTimer = null; commitDeadline = null;
    if (pendingBuffer.trim()) { submitItem(pendingBuffer); pendingBuffer = ''; renderSpeechBubble('', ''); }
  }, COMMIT_SILENCE_MS);
}

function flushPendingBuffer() {
  if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; }
  commitDeadline = null;
  if (pendingBuffer.trim()) { submitItem(pendingBuffer); renderSpeechBubble('', ''); }
  pendingBuffer = '';
}

setInterval(() => {
  const el = $('mic-countdown');
  if (commitDeadline === null) { el.textContent = ''; return; }
  el.textContent = Math.ceil(Math.max(0, commitDeadline - Date.now()) / 1000) + 's';
}, 100);

function createRecognition() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.onstart = () => setMicListening(true);
  rec.onresult = event => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const t = result[0].transcript;
      if (result.isFinal) pendingBuffer += (pendingBuffer ? ' ' : '') + t;
      else interim += t;
    }
    renderSpeechBubble(pendingBuffer, interim);
    scheduleCommit();
  };
  rec.onerror = event => {
    console.warn('speech recognition error', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      micShouldListen = false;
      flushPendingBuffer();
      setMicListening(false);
      // Safari raises service-not-allowed when Siri/Dictation is off, even with the site's mic permission granted.
      alert('Speech recognition was blocked (' + event.error + '). Allow the microphone for this site, and on Safari make sure Siri & Dictation is turned on.');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showError('Mic error: ' + event.error);
    }
  };
  rec.onend = () => {
    if (micShouldListen) {
      try { rec.start(); }
      catch (e) { console.warn('failed to restart recognition', e); flushPendingBuffer(); setMicListening(false); }
    } else { flushPendingBuffer(); setMicListening(false); }
  };
  return rec;
}

$('mic-fab').addEventListener('click', () => {
  if (!micSupported) { alert("Speech recognition isn't available in this browser. Try Chrome or Safari."); return; }
  if (micListening) { micShouldListen = false; if (recognition) recognition.stop(); }
  else {
    micShouldListen = true;
    if (!recognition) recognition = createRecognition();
    try { recognition.start(); }
    catch (e) { console.warn('failed to start recognition', e); showError("Couldn't start the mic: " + (e.message || e.name)); }
  }
});

$('sheet-backdrop').addEventListener('click', () => {
  if (!micListening) return;
  micShouldListen = false;
  if (recognition) recognition.stop();
});

/* ── Manage tags ── */
function openTagsModal() {
  renderTagsModal();
  $('tags-modal').classList.add('show');
  $('tags-modal-backdrop').classList.add('show');
}
function closeTagsModal() {
  $('tags-modal').classList.remove('show');
  $('tags-modal-backdrop').classList.remove('show');
}

function renderTagsModal() {
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));
  $('tags-modal-body').innerHTML = sorted.length
    ? sorted.map(t => `<div class="tag-row" data-id="${t.id}">
        <span class="tag-dot" style="background:var(--tag-${t.color})"></span>
        <input type="text" class="tag-name-input" value="${esc(t.name)}" data-id="${t.id}" data-orig="${esc(t.name)}" maxlength="24">
        <button type="button" class="btn tag-delete-btn" data-id="${t.id}">Delete</button>
      </div>`).join('')
    : '<div class="tags-empty">No tags yet. Say or type #something to make one.</div>';
}

$('btn-manage-tags').addEventListener('click', () => { $('menu-dropdown').hidden = true; openTagsModal(); });
$('tags-modal-close').addEventListener('click', closeTagsModal);
$('tags-modal-backdrop').addEventListener('click', closeTagsModal);

$('tags-modal-body').addEventListener('change', async e => {
  const input = e.target.closest('.tag-name-input');
  if (!input) return;
  const tag = tagById(input.dataset.id);
  const orig = input.dataset.orig;
  const raw = input.value.trim();
  const name = tag && tag.llm ? slugifyTagName(raw).slice(0, 24) : raw;
  if (!tag || !name || name === orig) { input.value = orig; return; }
  await guarded("Couldn't rename that tag", async () => {
    tag.name = name;
    await db.tags.put({ ...tag });
    input.value = name;
    input.dataset.orig = name;
    renderItems();
  });
});

$('tags-modal-body').addEventListener('click', async e => {
  const deleteBtn = e.target.closest('.tag-delete-btn');
  if (!deleteBtn) return;
  const id = deleteBtn.dataset.id;
  const tag = tagById(id);
  if (!tag) return;
  if (!confirm('Delete the tag "' + tag.name + '"? It will be removed from every memo using it.')) return;
  await guarded("Couldn't delete that tag", async () => {
    const touched = items.filter(it => (it.tags || []).includes(id) || (it.llmTags || []).includes(id));
    for (const it of touched) {
      it.tags = (it.tags || []).filter(t => t !== id);
      it.llmTags = (it.llmTags || []).filter(t => t !== id);
    }
    await db.items.bulkPut(touched.map(it => ({ ...it })));
    await db.tags.delete(id);
    tags = tags.filter(t => t.id !== id);
    tagFilter.delete(id);
    saveSessionState('vq_tagFilter', [...tagFilter]);
    renderTagsModal();
    renderItems();
  });
});

/* ── Menu ── */
$('btn-menu').addEventListener('click', e => {
  e.stopPropagation();
  $('menu-dropdown').hidden = !$('menu-dropdown').hidden;
});
document.addEventListener('click', e => {
  if (!$('menu-dropdown').hidden && !e.target.closest('.menu-wrap')) $('menu-dropdown').hidden = true;
});
$('menu-dropdown').addEventListener('click', e => { if (e.target.closest('#toggle-done, #toggle-trash')) $('menu-dropdown').hidden = true; });

/* ── Backup: export / import / reset ── */
function exportBackup() {
  const payload = { app: 'voice-queue', exportedAt: nowIso(), tags, voiceQueue: items };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = 'voice-queue-' + nowIso().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showError('Backup exported', 2000, true);
}

function normalizeTag(raw) {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: String(raw.id || uuid()),
    name: raw.name.trim(),
    color: TAG_COLORS.includes(raw.color) ? raw.color : TAG_COLORS[0],
    order: Number.isFinite(raw.order) ? raw.order : 0,
    ...(raw.llm ? { llm: true } : {}),
  };
}

function normalizeItem(raw) {
  if (!raw || typeof raw.text !== 'string' || !raw.text.length) return null;
  const createdAt = raw.createdAt || nowIso();
  return {
    id: String(raw.id || uuid()),
    text: raw.text,
    title: raw.title ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    llmTags: Array.isArray(raw.llmTags) ? raw.llmTags : [],
    status: raw.status === 'done' ? 'done' : 'queued', // April's "held" folds into queued
    deletedAt: raw.deletedAt ?? null,
    summary: raw.summary ?? null,
    summaryPoints: Array.isArray(raw.summaryPoints) ? raw.summaryPoints : [],
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
  };
}

async function importBackup(file, { replace }) {
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { alert("That file isn't valid JSON."); return; }
  const incomingTags = (Array.isArray(data.tags) ? data.tags : []).map(normalizeTag).filter(Boolean);
  const incomingItems = (Array.isArray(data.voiceQueue) ? data.voiceQueue : []).map(normalizeItem).filter(Boolean);
  if (!incomingTags.length && !incomingItems.length) { alert('Nothing to import in that file (expected {tags, voiceQueue}).'); return; }

  await guarded("Couldn't import that file", async () => {
    if (replace) await Promise.all([db.items.clear(), db.tags.clear()]);
    const existingTags = replace ? [] : await db.tags.toArray();
    const existingItems = replace ? [] : await db.items.toArray();

    // A tag with the same name but a different id (e.g. made separately in
    // nexus) maps onto the existing one instead of duplicating it.
    const idMap = new Map();
    const tagsToAdd = [];
    for (const t of incomingTags) {
      const sameId = existingTags.find(x => x.id === t.id);
      const sameName = existingTags.find(x => slugifyTagName(x.name) === slugifyTagName(t.name));
      if (sameId) idMap.set(t.id, sameId.id);
      else if (sameName) idMap.set(t.id, sameName.id);
      else { idMap.set(t.id, t.id); tagsToAdd.push(t); existingTags.push(t); }
    }
    const remap = ids => [...new Set(ids.map(id => idMap.get(id) ?? id))];

    const byId = new Map(existingItems.map(it => [it.id, it]));
    const itemsToPut = [];
    for (const it of incomingItems) {
      const current = byId.get(it.id);
      if (current && String(current.updatedAt) >= String(it.updatedAt)) continue; // idempotent: newer-or-equal wins
      itemsToPut.push({ ...it, tags: remap(it.tags), llmTags: remap(it.llmTags) });
    }
    await db.tags.bulkPut(tagsToAdd);
    await db.items.bulkPut(itemsToPut);

    await loadAll();
    const liveIds = new Set(items.map(it => it.id));
    selectedIds.forEach(id => { if (!liveIds.has(id)) selectedIds.delete(id); });
    tagFilter.forEach((_, id) => { if (!tagById(id)) tagFilter.delete(id); });
    undoQueue = [];
    saveSessionState('vq_undoQueue', undoQueue);
    saveSessionState('vq_tagFilter', [...tagFilter]);
    updateSelectionBar();
    renderUndoPanel();
    renderItems();
    showError('Imported ' + itemsToPut.length + ' memo(s), ' + tagsToAdd.length + ' new tag(s)', 3000, true);
  });
}

let importReplace = false;
$('btn-export').addEventListener('click', () => { $('menu-dropdown').hidden = true; exportBackup(); });
$('btn-import').addEventListener('click', () => { importReplace = false; $('menu-dropdown').hidden = true; $('import-file').click(); });
$('btn-reset-import').addEventListener('click', () => {
  $('menu-dropdown').hidden = true;
  if (!confirm('This wipes all voice memos and tags in this browser, then loads the file you pick. Continue?')) return;
  importReplace = true;
  $('import-file').click();
});
$('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) importBackup(file, { replace: importReplace });
});

$('btn-reset').addEventListener('click', async () => {
  $('menu-dropdown').hidden = true;
  if (!confirm('Delete ALL voice memos and tags in this browser? Export a backup first if you want to keep them.')) return;
  await guarded("Couldn't reset", async () => {
    await Promise.all([db.items.clear(), db.tags.clear()]);
    items = []; tags = [];
    selectedIds.clear(); tagFilter.clear(); undoQueue = [];
    ['vq_selectedIds', 'vq_tagFilter', 'vq_undoQueue'].forEach(k => { try { sessionStorage.removeItem(k); } catch {} });
    updateSelectionBar();
    renderUndoPanel();
    renderItems();
  });
});

/* ── Init ── */
async function init() {
  setMicListening(false);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  try {
    await purgeExpiredTrash();
    await loadAll();
  } catch (e) {
    console.error('Voice queue init failed', e);
    showError('Storage failed to open: ' + (e && e.message ? e.message : e), 8000);
  }
  const liveIds = new Set(items.map(it => it.id));
  selectedIds.forEach(id => { if (!liveIds.has(id)) selectedIds.delete(id); });
  tagFilter.forEach((_, id) => { if (!tagById(id)) tagFilter.delete(id); });
  renderUndoPanel();
  updateSelectionBar();
  renderItems();
}
init();

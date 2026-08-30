/* TableVault — table of tables. Each table has its own `config` (name/icon/
   color/fields), stored in the `tables` IndexedDB store, and its rows live in
   the `records` store tagged with a `tableId`. Legacy data from older versions
   of this app (a multi-vault schema, then a single-table-only schema) is
   migrated in automatically the first time the app runs, so existing data
   isn't lost. */

const db = new Dexie('PromptTrackDB');
db.version(1).stores({ vaults:'++id,name', entries:'++id,tableId,createdAt' });
db.version(2).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId' });
db.version(3).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId', records:'++id,createdAt' });
db.version(4).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId', records:'++id,tableId,createdAt', tableDefs:'++id,createdAt' });

const COLORS = [
  {name:'Lime',  val:'#b8ff57', lightVal:'#61a300', dim:'rgba(184,255,87,.13)'},
  {name:'Sky',   val:'#57c4ff', lightVal:'#0077b6', dim:'rgba(87,196,255,.13)'},
  {name:'Pink',  val:'#ff7eb3', lightVal:'#c9184a', dim:'rgba(255,126,179,.13)'},
  {name:'Amber', val:'#ffb84d', lightVal:'#b5651d', dim:'rgba(255,184,77,.13)'},
  {name:'Violet',val:'#b57bff', lightVal:'#6a0dad', dim:'rgba(181,123,255,.13)'},
  {name:'Teal',  val:'#3fe0c5', lightVal:'#008080', dim:'rgba(63,224,197,.13)'},
  {name:'Coral', val:'#ff6b6b', lightVal:'#d00000', dim:'rgba(255,107,107,.13)'},
  {name:'Ice',   val:'#ddeeff', lightVal:'#4682b4', dim:'rgba(221,238,255,.10)'},
];
const FTYPES = ['text','number','date','url','boolean','select','progress','textarea'];
const THEME_KEY = 'tablevault-theme';
const CONFIG_KEY = 'tablevault-config-v1';
const VIEW_KEY = 'tablevault-view-v1';
const CURRENT_TABLE_KEY = 'tablevault-current-table';

let config = null, entries = [], tagF = [], editEntryId = null, selColor = 'Lime';
let groupField = '', collapsedGroups = {};
let sortKey = null, sortDir = 1;
let currentTableId = null;

const gc = n => {
  const named = COLORS.find(c=>c.name===n);
  const isLight = document.documentElement.classList.contains('light');
  if(named) {
    const val = isLight ? named.lightVal : named.val;
    return { ...named, val, dim: hexToRgba(val, isLight ? 0.12 : 0.13) };
  }
  if(typeof n === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(n)) return {name:n,val:n,dim:hexToRgba(n,0.14)};
  const def = COLORS[0];
  const val = isLight ? def.lightVal : def.val;
  return { ...def, val, dim: hexToRgba(val, isLight ? 0.12 : 0.13) };
};
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Stable cross-device row identity for sync-client.js merges — crypto.randomUUID()
// requires a secure context, which a plain http://<lan-ip> page on a phone isn't.
const genUid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,10);
function viewKey(){
  return VIEW_KEY+':'+currentTableId;
}
function loadViewState(){
  tagF = []; groupField = ''; collapsedGroups = {}; sortKey = null; sortDir = 1;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(viewKey())); } catch {}
  if(!stored) return;
  tagF = Array.isArray(stored.tagF) ? stored.tagF : [];
  groupField = stored.groupField || '';
  sortKey = stored.sortKey ?? null;
  sortDir = stored.sortDir === -1 ? -1 : 1;
}
function saveViewState(){
  localStorage.setItem(viewKey(), JSON.stringify({tagF, groupField, sortKey, sortDir}));
}
const om = id => document.getElementById(id).classList.add('open');
const cm = id => document.getElementById(id).classList.remove('open');
const bdClose = (e,id) => { if(e.target.id===id) cm(id); };

async function init() {
  initTheme();
  const migrated = await migrateToTablesIfNeeded();
  const savedId = Number(localStorage.getItem(CURRENT_TABLE_KEY)) || null;
  if(savedId && await db.tableDefs.get(savedId)){
    await openTable(savedId);
  } else {
    await goHome();
  }
  if(migrated) toast('Imported your existing tables','success');
}

/* ── CONFIG (per table) ── */
function defaultFields(){
  return [{key:'title',label:'Title',type:'text',options:[]},{key:'notes',label:'Notes',type:'textarea',options:[]}];
}
function defaultConfig(){
  return {name:'My Table', icon:'📋', color:'Lime', fields:defaultFields()};
}
function loadConfigFromRow(row){
  config = {id:row.id, name:row.name||'My Table', icon:row.icon||'📋', color:row.color||'Lime'};
  config.fields = (row.fields&&row.fields.length ? row.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
}
function saveConfig(patch){
  config = Object.assign({}, config, patch);
  db.tableDefs.update(currentTableId, {...patch, updatedAt:Date.now()});
}
function renderTitle(){
  const el = document.getElementById('app-title');
  if(el) el.textContent = config.name||'';
  document.title = 'Notes';
}

/* ── NAVIGATION: table of tables ── */
async function goHome(){
  currentTableId = null;
  localStorage.removeItem(CURRENT_TABLE_KEY);
  document.getElementById('table-view').style.display = 'none';
  document.getElementById('home-view').style.display = 'flex';
  await renderTablesHome();
}
async function openTable(id){
  const row = await db.tableDefs.get(id);
  if(!row){ toast('Table not found','error'); await goHome(); return; }
  currentTableId = id;
  localStorage.setItem(CURRENT_TABLE_KEY, String(id));
  loadConfigFromRow(row);
  loadViewState();
  entries = await db.records.where('tableId').equals(id).toArray();
  document.getElementById('home-view').style.display = 'none';
  document.getElementById('table-view').style.display = 'flex';
  renderTitle();
  renderGroupingSelect();
  initCPs();
  renderTable();
}
async function createTable(){
  const id = await db.tableDefs.add({...defaultConfig(), createdAt:Date.now(), uid:genUid()});
  await openTable(id);
  toast('Table created — customize it in Settings','success');
}
async function renderTablesHome(){
  const list = await db.tableDefs.orderBy('createdAt').toArray();
  const el = document.getElementById('tables-list');
  if(!list.length){
    el.innerHTML = '<div class="empty-state" style="display:flex;padding-top:60px;"><div class="empty-icon">🗂️</div><h3>No tables yet</h3><p>Tap + to create your first table.</p></div>';
    return;
  }
  const counts = {};
  await Promise.all(list.map(async t=>{ counts[t.id] = await db.records.where('tableId').equals(t.id).count(); }));
  el.innerHTML = list.map(t=>`
    <div class="table-item" onclick="openTable(${t.id})">
      <div class="table-item-icon">${esc(t.icon||'📋')}</div>
      <div class="table-item-name">${esc(t.name||'Untitled')}</div>
      <div class="table-item-count">${counts[t.id]||0}</div>
      <button class="row-menu-btn" title="More" onclick="event.stopPropagation();showTableCtx(event,${t.id})">⋮</button>
    </div>`).join('');
}
function showTableCtx(e,id){
  showCtx(e.clientX,e.clientY,[
    {l:'🗑  Delete',f:()=>deleteTable(id),d:true},
  ]);
}
async function deleteTable(id){
  if(!confirm('Delete this table and all its records? This cannot be undone.')) return;
  await db.records.where('tableId').equals(id).delete();
  await db.tableDefs.delete(id);
  localStorage.removeItem(VIEW_KEY+':'+id);
  if(currentTableId===id){ currentTableId=null; localStorage.removeItem(CURRENT_TABLE_KEY); }
  await renderTablesHome();
  toast('Table deleted','error');
}

/* ── ONE-TIME MIGRATION FROM OLDER VERSIONS OF THIS APP ── */
async function migrateToTablesIfNeeded(){
  if(await db.tableDefs.count() > 0) return false;
  let migratedAny = false;
  let firstNewId = null;

  const storedConfig = (() => { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; } })();
  if(storedConfig){
    const fields = (storedConfig.fields&&storedConfig.fields.length ? storedConfig.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
    const id = await db.tableDefs.add({name:storedConfig.name||'My Table', icon:storedConfig.icon||'📋', color:storedConfig.color||'Lime', fields, createdAt:Date.now(), uid:genUid()});
    const orphanRecords = (await db.records.toArray()).filter(r=>r.tableId==null);
    if(orphanRecords.length) await db.records.bulkPut(orphanRecords.map(r=>({...r, tableId:id})));
    localStorage.removeItem(CONFIG_KEY);
    firstNewId = id;
    migratedAny = true;
  }

  const oldVaults = await db.vaults.toArray();
  if(oldVaults.length){
    oldVaults.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    for(const v of oldVaults){
      const fields = (v.fields&&v.fields.length ? v.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
      const id = await db.tableDefs.add({name:v.name||'My Table', icon:v.icon||'📋', color:v.color||'Lime', fields, createdAt:v.createdAt||Date.now(), uid:genUid()});
      const oldEntries = await db.entries.where('tableId').equals(v.id).toArray();
      if(oldEntries.length){
        await db.records.bulkAdd(oldEntries.map(e=>({data:e.data||{}, tableId:id, createdAt:e.createdAt||Date.now()})));
      }
      if(firstNewId===null) firstNewId = id;
      migratedAny = true;
    }
  }

  if(!migratedAny){
    firstNewId = await db.tableDefs.add({...defaultConfig(), createdAt:Date.now(), uid:genUid()});
  }
  if(!localStorage.getItem(CURRENT_TABLE_KEY) && firstNewId!==null){
    localStorage.setItem(CURRENT_TABLE_KEY, String(firstNewId));
  }
  return migratedAny;
}

/* ── TABLE RENDER ── */
function renderGroupingSelect(){
  const el=document.getElementById('grouping-row');
  if(!el) return;
  const c = gc(config.color);
  const options = [{key:'', label:'None'}].concat(
    config.fields.filter(f=>f.type==='select').map(f=>({key:f.key,label:f.label}))
  );
  el.innerHTML = `<div class="tag-group">
    <div class="tag-group-label">Grouping</div>
    <div class="tag-group-chips">${options.map(opt=>{
      const on = opt.key===groupField;
      return `<div class="tag-chip${on?' active':''}" style="${on?`background:${c.val};border-color:${c.val};`:''}" onclick="setGrouping('${CSS.escape(opt.key)}')">${esc(opt.label)}</div>`;
    }).join('')}</div>
  </div>`;
}
function setGrouping(key){
  groupField = key;
  collapsedGroups = {};
  saveViewState();
  renderGroupingSelect();
  renderTable();
}
function toggleTopSearch(){
  const el = document.getElementById('top-search');
  const willOpen = !el.classList.contains('open');
  el.classList.toggle('open', willOpen);
  if(willOpen) setTimeout(()=>document.getElementById('search-input')?.focus(), 120);
}
function toggleGroup(encodedName){
  const name = decodeURIComponent(encodedName);
  collapsedGroups[name] = !collapsedGroups[name];
  renderTable();
}
function setSort(key){
  if(sortKey===key){ sortDir = -sortDir; }
  else { sortKey = key; sortDir = 1; }
  saveViewState();
  renderTable();
}
function sortArrow(key){
  if(sortKey!==key) return '<span class="sort-arrow">↕</span>';
  return `<span class="sort-arrow active">${sortDir===1?'↑':'↓'}</span>`;
}
function sortEntries(list, fields){
  const arr = [...list];
  if(!sortKey){ arr.sort((a,b)=>b.createdAt-a.createdAt); return arr; }
  const field = fields.find(f=>f.key===sortKey);
  arr.sort((a,b)=>{
    let av=a.data?.[sortKey], bv=b.data?.[sortKey];
    if(field?.type==='number'||field?.type==='progress'){ av=parseFloat(av)||0; bv=parseFloat(bv)||0; }
    else if(field?.type==='boolean'){ av=av?1:0; bv=bv?1:0; }
    else if(field?.type==='date'){ av=av?new Date(av).getTime():0; bv=bv?new Date(bv).getTime():0; }
    else { av=String(av??'').toLowerCase(); bv=String(bv??'').toLowerCase(); }
    if(av<bv) return -1*sortDir;
    if(av>bv) return 1*sortDir;
    return 0;
  });
  return arr;
}
function formatDate(val){
  const d = new Date(val);
  if(isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fieldCellHtml(field, val, c){
  if(field.type==='boolean') return val ? '<span class="cell-bool yes">✓</span>' : '<span class="cell-bool no">✗</span>';
  if(field.type==='select') return val ? `<span class="cell-tag" style="background:${c.dim};color:${c.val};">${esc(val)}</span>` : '<span class="cell-empty">—</span>';
  if(field.type==='progress'){
    const pv = Math.min(100, parseInt(val)||0);
    return `<div class="cell-progress"><div class="prog-wrap"><div class="prog-fill" style="width:${pv}%;background:${c.val};"></div></div><span class="cell-progress-label">${pv}%</span></div>`;
  }
  if(field.type==='url') return val ? `<a href="${esc(val)}" target="_blank" rel="noopener" class="cell-link" onclick="event.stopPropagation()">${esc(val)}</a>` : '<span class="cell-empty">—</span>';
  if(field.type==='date') return val ? esc(formatDate(val)) : '<span class="cell-empty">—</span>';
  if(field.type==='textarea'){
    if(val===undefined || val===null || val==='') return '<span class="cell-empty">—</span>';
    const str = String(val);
    const truncated = str.length>30 ? str.slice(0,30)+'…' : str;
    return str.length>30 ? `<span title="${esc(str)}">${esc(truncated)}</span>` : esc(truncated);
  }
  return (val!==undefined && val!==null && val!=='') ? esc(String(val)) : '<span class="cell-empty">—</span>';
}
function renderThead(fields){
  const ths = fields.map(f=>`<th onclick="setSort('${f.key}')">${esc(f.label)}${sortArrow(f.key)}</th>`).join('');
  document.getElementById('table-head').innerHTML = `<tr>${ths}<th class="actions-h"></th></tr>`;
}
function renderRow(r, fields, c){
  const tds = fields.map(f=>`<td>${fieldCellHtml(f, r.data?.[f.key], c)}</td>`).join('');
  return `<tr onclick="openEditRecord(${r.id})">${tds}<td class="actions" onclick="event.stopPropagation()"><button class="row-menu-btn" title="More" onclick="showEntryCtx(event,${r.id})">⋮</button></td></tr>`;
}
function renderTable(){
  const fields = config.fields;
  const c = gc(config.color);
  renderThead(fields);
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';

  const tagGroups = new Map();
  entries.forEach(r=>{
    getRecordMetaGroups(fields,r).forEach(group=>{
      const list = tagGroups.get(group.key) || {label:group.label, chips:new Set()};
      group.values.forEach(value=>list.chips.add(value));
      tagGroups.set(group.key,list);
    });
  });
  renderTagRow('tags-row',[...tagGroups.entries()].map(([key, group])=>({key,label:group.label,tags:[...group.chips]})),tagF,config.color,tag=>{
    const i=tagF.indexOf(tag); i>=0?tagF.splice(i,1):tagF.push(tag); saveViewState(); renderTable();
  });

  let list = entries.filter(r=>{
    const recordTags = getRecordMetaGroups(fields,r).flatMap(group=>group.values);
    if(tagF.length && !tagF.every(t=>recordTags.includes(t))) return false;
    if(q){
      const txt = Object.values(r.data||{}).join(' ').toLowerCase();
      if(!txt.includes(q)) return false;
    }
    return true;
  });
  list = sortEntries(list, fields);

  const scroll = document.getElementById('table-scroll');
  const body = document.getElementById('table-body');

  if(!list.length){
    body.innerHTML = '';
    scroll.classList.add('empty');
    document.getElementById('empty-icon').textContent = config.icon || '🗂️';
    document.getElementById('empty-title').textContent = entries.length ? 'No results' : 'No records yet';
    document.getElementById('empty-sub').textContent = entries.length ? 'Try different filters.' : 'Tap + to add your first record.';
    return;
  }
  scroll.classList.remove('empty');

  if(groupField){
    const grouped = new Map();
    list.forEach(r=>{
      const value = getGroupValue(fields, r, groupField);
      const key = value || 'Ungrouped';
      const rows = grouped.get(key) || [];
      rows.push(r);
      grouped.set(key, rows);
    });
    const sortedGroups = [...grouped.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    const colspan = fields.length + 1;
    body.innerHTML = sortedGroups.map(([groupName, rows])=>{
      const collapsed = !!collapsedGroups[groupName];
      const encodedName = encodeURIComponent(groupName);
      const headRow = `<tr class="group-row" onclick="toggleGroup('${encodedName}')">
        <td colspan="${colspan}"><span class="group-toggle">${collapsed?'▸':'▾'}</span>${esc(groupName)}<span class="group-count">${rows.length}</span></td>
      </tr>`;
      const bodyRows = collapsed ? '' : rows.map(r=>renderRow(r, fields, c)).join('');
      return headRow + bodyRows;
    }).join('');
    return;
  }
  body.innerHTML = list.map(r=>renderRow(r, fields, c)).join('');
}
function renderTagRow(elId,tags,active,colorName,fn) {
  const c=gc(colorName);
  const el=document.getElementById(elId);
  if(!tags.length){el.innerHTML='';return;}
  const normalizedGroups = tags.map(group=>{
    if(typeof group === 'string') return {label:'Tags', tags:[group]};
    return {label:group.label||'Tags', tags:Array.isArray(group.tags)?group.tags:[]};
  });
  el.innerHTML=normalizedGroups.map(group=>{
    return `<div class="tag-group">
      <div class="tag-group-label">${esc(group.label)}</div>
      <div class="tag-group-chips">${group.tags.map(tag=>{
        const on=active.includes(tag);
        return `<div class="tag-chip${on?' active':''}" style="${on?`background:${c.val};border-color:${c.val};`:''}" onclick='(${fn.toString()})("${CSS.escape(tag)}")'>${esc(tag)}</div>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}

/* ── SETTINGS (name / icon / color / backup) ── */
function openSettingsModal(){
  document.getElementById('ts-name').value = config.name;
  document.getElementById('ts-icon').value = config.icon || '';
  selColor = config.color || 'Lime';
  updateCP('cp-settings');
  om('m-settings');
}
function saveSettings(){
  const name = document.getElementById('ts-name').value.trim();
  if(!name){ toast('Enter a name','error'); return; }
  const icon = document.getElementById('ts-icon').value.trim() || '📋';
  saveConfig({name, icon, color:selColor});
  cm('m-settings');
  renderTitle();
  renderTable();
  toast('Saved!','success');
}
function confirmClearRecords(){
  if(!confirm('Delete all records in this table? This cannot be undone.')) return;
  db.records.where('tableId').equals(currentTableId).delete().then(()=>{
    entries = [];
    cm('m-settings');
    renderTable();
    toast('All records cleared','error');
  });
}

function openDeviceSync(){
  if(typeof ImagoSync==='undefined'){ toast('Sync client failed to load','error'); return; }
  const relayUrl = `http://${location.hostname}:8791`;
  ImagoSync.openSyncModal({ relayUrl, db, tables:['records','tableDefs'] });
}

/* ── FIELDS ── */
function openFieldsModal(){
  renderFieldsEd(config.fields);
  om('m-fields');
}
function renderFieldsEd(fields){
  document.getElementById('fields-ed').innerHTML=fields.map((f,i)=>{
    const field=normalizeField(f,i);
    const options = (field.options||[]).join(', ');
    return `
    <div class="field-row${i===0?' primary':''}${field.type==='select'?' wrap':''}" data-key="${esc(field.key)}" draggable="true" ondragstart="fieldDragStart(event)" ondragend="fieldDragEnd(event)" ondragover="fieldDragOver(event)" ondrop="fieldDrop(event)">
      ${i===0?'<span class="field-badge">Title</span>':'<span class="field-grip">⠿</span>'}
      <input type="text" value="${esc(field.label)}" placeholder="Field name" data-k="label">
      <select data-k="type"${i===0?' disabled':''} onchange="handleFieldTypeChange()">
        ${FTYPES.map(t=>`<option value="${t}"${field.type===t?' selected':''}>${t}</option>`).join('')}
      </select>
      ${i===0?'<div style="width:22px;"></div>':`<button class="field-del" onclick="delField(this)">✕</button>`}
      ${field.type==='select'?`<div class="field-options"><input type="text" value="${esc(options)}" placeholder="Options, separated by commas" data-k="options"></div>`:''}
    </div>`;
  }).join('');
}
let fieldDragEl=null;
function fieldDragStart(e){
  if(e.target.closest('input,select,textarea,button')){
    e.preventDefault();
    return;
  }
  fieldDragEl=e.currentTarget;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain','');
}
function fieldDragOver(e){
  if(!fieldDragEl) return;
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const row=e.currentTarget;
  if(row===fieldDragEl) return;
  const rect=row.getBoundingClientRect();
  const before=(e.clientY-rect.top)<rect.height/2;
  row.parentNode.insertBefore(fieldDragEl, before?row:row.nextSibling);
}
function fieldDrop(e){
  e.preventDefault();
}
function fieldDragEnd(){
  if(fieldDragEl) renderFieldsEd(getFieldsFromEd());
  fieldDragEl=null;
}
function addField(){
  const fields=getFieldsFromEd();
  fields.push({key:'f_'+Date.now(),label:'',type:'text',options:[]});
  renderFieldsEd(fields);
}
function delField(el){
  const fields=getFieldsFromEd();
  const row=el.closest('.field-row');
  const i=[...row.parentNode.children].indexOf(row);
  fields.splice(i,1); renderFieldsEd(fields);
}
function handleFieldTypeChange(){
  renderFieldsEd(getFieldsFromEd());
}
function getFieldsFromEd(){
  return [...document.querySelectorAll('#fields-ed .field-row')].map((row,i)=>{
    return normalizeField({
      key:row.dataset.key||('f_'+Date.now()+'_'+i),
      label:row.querySelector('[data-k="label"]').value.trim()||'Field',
      type:row.querySelector('[data-k="type"]').value,
      options:parseSelectOptions(row.querySelector('[data-k="options"]')?.value||''),
    },i);
  });
}
function saveFields(){
  const fields=getFieldsFromEd();
  if(!fields[0]?.label){toast('Title field needs a name','error');return;}
  saveConfig({fields});
  cm('m-fields');
  renderGroupingSelect();
  renderTable();
  toast('Fields updated!','success');
}

/* ── RECORD MODAL ── */
function openAddRecordModal(){
  editEntryId=null;
  document.getElementById('m-rec-ttl').textContent='Add Record';
  document.getElementById('rec-save-btn').textContent='Add';
  om('m-record');
  buildRecForm({});
}
async function openEditRecord(id){
  editEntryId=id;
  const r=await db.records.get(id); if(!r) return;
  document.getElementById('m-rec-ttl').textContent='Edit Record';
  document.getElementById('rec-save-btn').textContent='Save';
  om('m-record');
  buildRecForm(r.data||{});
}
function buildRecForm(data){
  const fields=config.fields.length ? config.fields : [{key:'title',label:'Title',type:'text'}];
  const c=gc(config.color);
  const fhtml=fields.map(f=>{
    const field = normalizeField(f);
    const val=data[field.key]!==undefined?data[field.key]:'';
    let inp='';
    if(field.type==='textarea'){
      inp=`<div class="md-editor-container">
        <textarea class="ftextarea" data-k="${field.key}" oninput="handleMdInput(this)" onkeydown="handleMdKeydown(event,this)" onfocus="mdSetEditing(this,true)" onblur="mdSetEditing(this,false)">${esc(String(val))}</textarea>
        <div class="md-preview" onclick="handleMdPreviewClick(event,this)"></div>
      </div>`;
    } else if(field.type==='boolean'){
      inp=`<div style="display:flex;gap:16px;margin-top:2px;">${['true','false'].map(bv=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="radio" name="b_${field.key}" data-k="${field.key}" value="${bv}"${String(val)===bv||(bv==='false'&&val==='')?'checked':''} style="accent-color:${c.val};">${bv==='true'?'Yes':'No'}</label>`).join('')}</div>`;
    } else if(field.type==='progress'){
      const pv=parseInt(val)||0;
      inp=`<div style="margin-top:4px;"><div style="display:flex;align-items:center;gap:10px;"><input type="range" min="0" max="100" step="1" value="${pv}" data-k="${field.key}" style="flex:1;accent-color:${c.val};" oninput="document.getElementById('po_${field.key}').textContent=this.value+'%';document.getElementById('pb_${field.key}').style.width=this.value+'%'"><span id="po_${field.key}" style="font-size:13px;font-weight:600;color:${c.val};min-width:38px;">${pv}%</span></div><div class="prog-wrap" style="margin-top:6px;"><div class="prog-fill" id="pb_${field.key}" style="width:${pv}%;background:${c.val};"></div></div></div>`;
    } else if(field.type==='select'){
      const opts=(field.options||[]).map(opt=>`<option value="${esc(opt)}"${String(val)===opt?' selected':''}>${esc(opt)}</option>`).join('');
      inp=`<select class="fselect" data-k="${field.key}"><option value="">Select…</option>${opts}</select>`;
    } else if(field.type==='number'){
      inp=`<input class="finput" type="number" data-k="${field.key}" value="${esc(String(val))}">`;
    } else if(field.type==='date'){
      inp=`<input class="finput" type="date" data-k="${field.key}" value="${esc(String(val))}">`;
    } else if(field.type==='url'){
      inp=`<input class="finput" type="url" data-k="${field.key}" value="${esc(String(val))}" placeholder="https://…">`;
    } else {
      inp=`<input class="finput" type="text" data-k="${field.key}" value="${esc(String(val))}">`;
    }
    const rowClass = field.type==='textarea' ? 'rfrow rfrow-full' : 'rfrow';
    return `<div class="${rowClass}"><div class="rflabel">${esc(field.label)}<span class="type-badge">${field.type}</span></div>${inp}</div>`;
  }).join('');
  document.getElementById('rec-form').innerHTML=fhtml;
  document.querySelectorAll('#rec-form .md-editor-container').forEach(initMdEditor);
}
function autoGrowTextarea(el){
  el.style.height='auto';
  el.style.height=el.scrollHeight+'px';
}

/* ── MARKDOWN TEXTAREA (preview + checkbox toggling + cursor mapping) ──
   Every rendered line/token carries data-raw-start / data-prefix / data-raw
   attributes pointing back at its exact offset in the raw textarea value, so
   a click in the preview can place the real caret at the matching spot. */
const MD_TOKEN_RE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\+\+([^+\n]+)\+\+|\*([^*\n]+)\*|_([^_\n]+)_|(?<=^|\s)#([a-zA-Z0-9_-]+)/g;
function tokenizeMdLine(content){
  const tokens=[];
  let last=0, m;
  MD_TOKEN_RE.lastIndex=0;
  while((m=MD_TOKEN_RE.exec(content))){
    if(m.index>last) tokens.push({kind:'plain', text:content.slice(last,m.index), rawStart:last});
    if(m[1]!==undefined) tokens.push({kind:'link', text:m[1], href:m[2], rawStart:m.index+1});
    else if(m[3]!==undefined) tokens.push({kind:'bold', text:m[3], rawStart:m.index+2});
    else if(m[4]!==undefined) tokens.push({kind:'bold', text:m[4], rawStart:m.index+2});
    else if(m[5]!==undefined) tokens.push({kind:'underline', text:m[5], rawStart:m.index+2});
    else if(m[6]!==undefined) tokens.push({kind:'italic', text:m[6], rawStart:m.index+1});
    else if(m[7]!==undefined) tokens.push({kind:'italic', text:m[7], rawStart:m.index+1});
    else if(m[8]!==undefined) tokens.push({kind:'tag', text:m[8], rawStart:m.index+1});
    last=m.index+m[0].length;
  }
  if(last<content.length) tokens.push({kind:'plain', text:content.slice(last), rawStart:last});
  return tokens;
}
function renderMdTokens(tokens,c){
  return tokens.map(t=>{
    const dr=`data-raw="${t.rawStart}" data-rawlen="${t.text.length}"`;
    const body=esc(t.text);
    if(t.kind==='link') return `<a href="${esc(t.href)}" target="_blank" rel="noopener noreferrer" ${dr}>${body}</a>`;
    if(t.kind==='bold') return `<strong ${dr}>${body}</strong>`;
    if(t.kind==='italic') return `<em ${dr}>${body}</em>`;
    if(t.kind==='underline') return `<u ${dr}>${body}</u>`;
    if(t.kind==='tag') return `<span class="md-tag" style="background:${c.dim};color:${c.val};" ${dr}>#${body}</span>`;
    return `<span ${dr}>${body}</span>`;
  }).join('');
}
function mdRenderHtml(text){
  if(!text) return '';
  const c = gc(config.color);
  const lines = text.split('\n');
  let lineStart = 0;
  return lines.map((line,index)=>{
    const attrsFor = prefixLen => `data-line="${index}" data-raw-start="${lineStart}" data-prefix="${prefixLen}"`;
    let out;
    if(line.startsWith('##### ')){
      out=`<h5 ${attrsFor(6)}>${renderMdTokens(tokenizeMdLine(line.substring(6)),c)}</h5>`;
    } else if(line.startsWith('#### ')){
      out=`<h4 ${attrsFor(5)}>${renderMdTokens(tokenizeMdLine(line.substring(5)),c)}</h4>`;
    } else if(line.startsWith('### ')){
      out=`<h3 ${attrsFor(4)}>${renderMdTokens(tokenizeMdLine(line.substring(4)),c)}</h3>`;
    } else if(line.startsWith('- [ ] ')){
      out=`<div class="md-check" ${attrsFor(6)}><input type="checkbox"> <span>${renderMdTokens(tokenizeMdLine(line.substring(6)),c)}</span></div>`;
    } else if(line.startsWith('- [x] ')){
      out=`<div class="md-check is-checked" ${attrsFor(6)}><input type="checkbox" checked> <span>${renderMdTokens(tokenizeMdLine(line.substring(6)),c)}</span></div>`;
    } else if(line.startsWith('- ')||line.startsWith('* ')){
      out=`<div class="md-bullet" ${attrsFor(2)}><span>•</span> <span>${renderMdTokens(tokenizeMdLine(line.substring(2)),c)}</span></div>`;
    } else if(line){
      out=`<p ${attrsFor(0)}>${renderMdTokens(tokenizeMdLine(line),c)}</p>`;
    } else {
      out=`<br ${attrsFor(0)}/>`;
    }
    lineStart += line.length+1;
    return out;
  }).join('');
}
function mdRawOffsetFromPoint(x,y){
  let node,offset;
  if(document.caretPositionFromPoint){
    const pos=document.caretPositionFromPoint(x,y);
    if(!pos) return null;
    node=pos.offsetNode; offset=pos.offset;
  } else if(document.caretRangeFromPoint){
    const range=document.caretRangeFromPoint(x,y);
    if(!range) return null;
    node=range.startContainer; offset=range.startOffset;
  } else return null;
  const el = node.nodeType===3 ? node.parentElement : node;
  if(!el) return null;
  const lineEl = el.closest('[data-line]');
  if(!lineEl) return null;
  const lineStart = parseInt(lineEl.getAttribute('data-raw-start'))||0;
  const prefixLen = parseInt(lineEl.getAttribute('data-prefix'))||0;
  const tokenEl = el.closest('[data-raw]');
  const tokenStart = tokenEl ? parseInt(tokenEl.getAttribute('data-raw'))||0 : 0;
  return lineStart+prefixLen+tokenStart+offset;
}
function updateMdPreview(container){
  const ta = container.querySelector('textarea');
  container.querySelector('.md-preview').innerHTML = mdRenderHtml(ta.value);
}
function initMdEditor(container){
  const ta = container.querySelector('textarea');
  updateMdPreview(container);
  container.classList.toggle('is-editing', !ta.value);
  autoGrowTextarea(ta);
}
function handleMdInput(ta){
  autoGrowTextarea(ta);
  updateMdPreview(ta.closest('.md-editor-container'));
}
function mdSetEditing(ta, focused){
  const container = ta.closest('.md-editor-container');
  updateMdPreview(container);
  if(focused){ container.classList.add('is-editing'); autoGrowTextarea(ta); }
  else if(ta.value){ container.classList.remove('is-editing'); }
}
function handleMdKeydown(e, ta){
  if(e.key!=='Enter') return;
  const start=ta.selectionStart, end=ta.selectionEnd, value=ta.value;
  const beforeCursor=value.substring(0,start);
  const lastNewline=beforeCursor.lastIndexOf('\n');
  const currentLine=beforeCursor.substring(lastNewline+1);
  let prefix='';
  if(currentLine.trimStart().startsWith('- [ ] ')) prefix='- [ ] ';
  else if(currentLine.trimStart().startsWith('- [x] ')) prefix='- [ ] ';
  else if(currentLine.trimStart().startsWith('- ')) prefix='- ';
  else if(currentLine.trimStart().startsWith('* ')) prefix='* ';
  if(!prefix) return;
  e.preventDefault();
  if(currentLine.trim()===prefix.trim()){
    ta.value = value.substring(0,lastNewline+1) + value.substring(end);
    ta.selectionStart = ta.selectionEnd = lastNewline+1;
  } else {
    const insertion='\n'+prefix;
    ta.value = value.substring(0,start)+insertion+value.substring(end);
    ta.selectionStart = ta.selectionEnd = start+insertion.length;
  }
  handleMdInput(ta);
}
function handleMdPreviewClick(e, previewEl){
  const container = previewEl.closest('.md-editor-container');
  const ta = container.querySelector('textarea');
  const checkRow = e.target.closest('.md-check');
  if(checkRow){
    e.stopPropagation();
    const lineIndex = parseInt(checkRow.getAttribute('data-line'));
    const lines = ta.value.split('\n');
    const line = lines[lineIndex];
    if(line.startsWith('- [ ] ')) lines[lineIndex]=line.replace('- [ ] ','- [x] ');
    else if(line.startsWith('- [x] ')) lines[lineIndex]=line.replace('- [x] ','- [ ] ');
    ta.value = lines.join('\n');
    updateMdPreview(container);
    return;
  }
  if(e.target.closest('a')){ e.stopPropagation(); return; }
  const raw = mdRawOffsetFromPoint(e.clientX, e.clientY);
  container.classList.add('is-editing');
  ta.focus();
  autoGrowTextarea(ta);
  if(raw!=null){
    const pos = Math.max(0, Math.min(ta.value.length, raw));
    ta.selectionStart = ta.selectionEnd = pos;
  }
}
async function saveRecord(){
  const fields=config.fields;
  const data={};
  fields.forEach(f=>{
    if(f.type==='boolean'){const el=document.querySelector(`input[name="b_${f.key}"]:checked`);data[f.key]=el?el.value==='true':false;}
    else{const el=document.querySelector(`[data-k="${f.key}"]`);data[f.key]=el?el.value:'';}
  });
  if(editEntryId){await db.records.update(editEntryId,{data,updatedAt:Date.now()});toast('Updated!','success');}
  else{await db.records.add({data,tableId:currentTableId,createdAt:Date.now(),updatedAt:Date.now(),uid:genUid()});toast('Record added!','success');}
  cm('m-record');
  entries=await db.records.where('tableId').equals(currentTableId).toArray();
  renderTable();
}

/* ── CTX MENU ── */
let ctxFns=[];
function showEntryCtx(e,id){
  showCtx(e.clientX,e.clientY,[
    {l:'✏️  Edit',f:()=>openEditRecord(id)},
    {sep:true},
    {l:'🗑  Delete',f:()=>deleteEntry(id),d:true},
  ]);
}
async function deleteEntry(id){
  if(!confirm('Delete this record?')) return;
  await db.records.delete(id);
  entries=entries.filter(r=>r.id!==id);
  renderTable(); toast('Deleted','error');
}
function showCtx(x,y,items){
  ctxFns=items;
  const m=document.getElementById('ctx');
  m.innerHTML=items.map((item,i)=>item.sep?'<div class="ctx-sep"></div>':`<div class="ctx-item${item.d?' danger':''}" onclick="fireCtx(${i})">${item.l}</div>`).join('');
  m.style.display='block';
  const vw=window.innerWidth,vh=window.innerHeight,mw=m.offsetWidth,mh=m.offsetHeight;
  m.style.left=Math.min(x,vw-mw-10)+'px';
  m.style.top=Math.min(y,vh-mh-10)+'px';
}
function fireCtx(i){ctxFns[i]?.f?.();document.getElementById('ctx').style.display='none';}
document.addEventListener('click',()=>document.getElementById('ctx').style.display='none');

/* ── COLOR PICKER ── */
function initCPs(){
  const id='cp-settings';
  const el=document.getElementById(id);
  if(!el) return;
  el.innerHTML='';
  COLORS.forEach(c=>{
    const s=document.createElement('div');
    s.className='cswatch'; s.dataset.c=c.name;
    s.style.background=c.val; s.title=c.name;
    s.onclick=()=>{selColor=c.name;updateCP(id);};
    el.appendChild(s);
  });
  updateCP(id);
}
function updateCP(pid){
  document.querySelectorAll(`#${pid} .cswatch`).forEach(s=>{
    const c=COLORS.find(x=>x.name===s.dataset.c);
    s.style.borderColor=s.dataset.c===selColor?c.val:'transparent';
    s.style.transform=s.dataset.c===selColor?'scale(1.2)':'scale(1)';
  });
}

/* ── THEME ── */
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || 'light';
  applyTheme(theme);
}
function applyTheme(theme){
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme(){
  applyTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
  renderTable();
  initCPs();
}

/* ── BACKUP / RESTORE ── */
function downloadJson(payload, filename){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}
function exportBackup(){
  try {
    const payload = { type:'tablevault-backup', version:2, timestamp:Date.now(), config, entries };
    downloadJson(payload, `tablevault-backup-${new Date().toISOString().slice(0,10)}.json`);
    toast('Backup exported!','success');
  } catch(err) {
    console.error(err);
    toast('Export failed','error');
  }
}
function importBackup(){
  const input = document.getElementById('backup-file-input');
  input.value = '';
  input.click();
}
async function handleBackupFile(event){
  const file = event.target.files?.[0];
  if(!file) return;
  if(!confirm('Replace all current records with the data from this backup? This cannot be undone.')){
    event.target.value=''; return;
  }
  try {
    const snapshot = JSON.parse(await file.text());
    const parsed = parseBackupJson(snapshot);
    if(!parsed){ toast('Invalid backup file','error'); return; }
    saveConfig(parsed.config);
    await db.records.where('tableId').equals(currentTableId).delete();
    if(parsed.entries.length) await db.records.bulkAdd(parsed.entries.map(e=>({...e, tableId:currentTableId})));
    entries = await db.records.where('tableId').equals(currentTableId).toArray();
    renderTitle();
    renderGroupingSelect();
    renderTable();
    toast(`Imported ${parsed.entries.length} record${parsed.entries.length!==1?'s':''}`,'success');
  } catch(err) {
    console.error(err);
    toast('Import failed','error');
  } finally {
    event.target.value = '';
  }
}
function parseBackupJson(snapshot){
  // Current single-table backup format.
  if(snapshot?.type==='tablevault-backup' && snapshot.config){
    const fields=(snapshot.config.fields&&snapshot.config.fields.length ? snapshot.config.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
    const ents=(snapshot.entries||[]).map(e=>({data:e.data||{}, createdAt:e.createdAt||Date.now()}));
    return {config:{name:snapshot.config.name||'My Table', icon:snapshot.config.icon||'📋', color:snapshot.config.color||'Lime', fields}, entries:ents};
  }
  // Legacy full-app backup with multiple tables — take the earliest one.
  if(snapshot?.type==='imago-tablevault-backup' && Array.isArray(snapshot.vaults)){
    const sorted=[...snapshot.vaults].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    const primary=sorted[0]; if(!primary) return null;
    const fields=(primary.fields&&primary.fields.length ? primary.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
    const ents=(snapshot.entries||[]).filter(e=>e.tableId===primary.id).map(e=>({data:e.data||{}, createdAt:e.createdAt||Date.now()}));
    return {config:{name:primary.name||'My Table', icon:primary.icon||'📋', color:primary.color||'Lime', fields}, entries:ents};
  }
  // Legacy single-table export.
  if(snapshot?.type==='imago-tablevault-table-backup' && snapshot.vault){
    const v=snapshot.vault;
    const fields=(v.fields&&v.fields.length ? v.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
    const ents=(snapshot.entries||[]).map(e=>({data:e.data||{}, createdAt:e.createdAt||Date.now()}));
    return {config:{name:v.name||'My Table', icon:v.icon||'📋', color:v.color||'Lime', fields}, entries:ents};
  }
  return null;
}

/* ── HELPERS ── */
function getRecordMetaGroups(fields, record){
  const groups = [];
  fields.filter(f=>f.type==='select').forEach(f=>{
    const value = record?.data?.[f.key];
    if(value!==undefined && value!==null && value!=='') groups.push({key:f.key, label:f.label, values:[String(value)]});
  });
  return groups;
}
function getGroupValue(fields, record, groupKey){
  const field = fields.find(f=>f.key===groupKey && f.type==='select');
  if(!field) return '';
  const value = record?.data?.[field.key];
  return value!==undefined && value!==null && value!=='' ? String(value) : 'Ungrouped';
}
function normalizeField(field, idx=0){
  const incomingType = field?.type === 'status' ? 'select' : field?.type;
  const safeType = incomingType === 'rating' ? 'number' : (incomingType || 'text');
  const next = {
    ...field,
    key:field?.key || (idx===0 ? 'title' : `f_${Date.now()}_${idx}`),
    label:field?.label || (idx===0 ? 'Title' : 'Field'),
    type:safeType,
    options:Array.isArray(field?.options) ? parseSelectOptions(field.options.join(',')) : parseSelectOptions(field?.options || ''),
  };
  if(next.type !== 'select') next.options = [];
  return next;
}
function parseSelectOptions(value){
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(v=>String(v).trim()).filter(Boolean))];
}
function hexToRgba(hex, alpha){
  let raw = hex.replace('#','');
  if(raw.length === 3) raw = raw.split('').map(ch=>ch+ch).join('');
  if(raw.length !== 6) {
    const isLight = document.documentElement.classList.contains('light');
    return isLight ? `rgba(97,163,0,${alpha})` : `rgba(184,255,87,${alpha})`;
  }
  const num = parseInt(raw,16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── TOAST ── */
let tT;
function toast(msg,type='success'){
  document.getElementById('tmsg').textContent=msg;
  document.getElementById('tdot').style.background=type==='success'?'#57e5a0':'#ff5c5c';
  const el=document.getElementById('toast');
  el.classList.add('show'); clearTimeout(tT);
  tT=setTimeout(()=>el.classList.remove('show'),2400);
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')['m-settings','m-fields','m-record'].forEach(cm);
});

init().catch(async err => {
  if(err?.name === 'VersionError'){
    const reset = confirm('This browser has a Notes database saved at a newer schema version than this app knows how to open, so it can\'t be upgraded automatically. Reset local data and start fresh?');
    if(reset){
      try {
        await db.delete();
        location.reload();
        return;
      } catch(delErr){
        console.error('Failed to delete stale PromptTrackDB', delErr);
      }
    }
  }
  console.error('TableVault init failed', err);
  const msg = err?.message || err?.name || 'Startup failed';
  try { toast(msg, 'error'); } catch {}
});

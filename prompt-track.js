/* TableVault — single table, row-based data manager.
   Data model: one `config` (name/icon/color/fields) persisted in localStorage,
   plus a `records` store in IndexedDB for the rows. Legacy multi-table data
   (from the old "table of tables" version) is migrated in automatically the
   first time the app runs, so existing data isn't lost. */

const db = new Dexie('PromptTrackDB');
db.version(1).stores({ vaults:'++id,name', entries:'++id,tableId,createdAt' });
db.version(2).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId' });
db.version(3).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId', records:'++id,createdAt' });

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

let config = null, entries = [], tagF = [], editEntryId = null, selColor = 'Lime';
let groupField = '', collapsedGroups = {};
let sortKey = null, sortDir = 1;

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
const om = id => document.getElementById(id).classList.add('open');
const cm = id => document.getElementById(id).classList.remove('open');
const bdClose = (e,id) => { if(e.target.id===id) cm(id); };

async function init() {
  initTheme();
  loadConfig();
  const migrated = await migrateLegacyIfNeeded();
  renderTitle();
  entries = await db.records.toArray();
  renderGroupingSelect();
  initCPs();
  renderTable();
  if(migrated) toast('Imported your existing table','success');
}

/* ── CONFIG (the single table) ── */
function defaultFields(){
  return [{key:'title',label:'Title',type:'text',options:[]},{key:'notes',label:'Notes',type:'textarea',options:[]}];
}
function defaultConfig(){
  return {name:'My Table', icon:'📋', color:'Lime', fields:defaultFields()};
}
function loadConfig(){
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch {}
  config = Object.assign(defaultConfig(), stored||{});
  config.fields = (config.fields&&config.fields.length ? config.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
}
function saveConfig(patch){
  config = Object.assign({}, config, patch);
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
function renderTitle(){
  const el = document.getElementById('app-title');
  if(el) el.textContent = (config.icon||'')+' '+(config.name||'');
  document.title = 'Prompt Track';
}

/* ── ONE-TIME MIGRATION FROM OLD MULTI-TABLE VERSION ── */
async function migrateLegacyIfNeeded(){
  const alreadyConfigured = localStorage.getItem(CONFIG_KEY) !== null;
  const existingRecords = await db.records.count();
  if(alreadyConfigured || existingRecords>0) return false;
  const oldVaults = await db.vaults.toArray();
  if(!oldVaults.length) return false;
  oldVaults.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const primary = oldVaults[0];
  const fields = (primary.fields&&primary.fields.length ? primary.fields : defaultFields()).map((f,i)=>normalizeField(f,i));
  saveConfig({name:primary.name||'My Table', icon:primary.icon||'📋', color:primary.color||'Lime', fields});
  const oldEntries = await db.entries.where('tableId').equals(primary.id).toArray();
  if(oldEntries.length){
    await db.records.bulkAdd(oldEntries.map(e=>({data:e.data||{}, createdAt:e.createdAt||Date.now()})));
  }
  return true;
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
    const i=tagF.indexOf(tag); i>=0?tagF.splice(i,1):tagF.push(tag); renderTable();
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
  db.records.clear().then(()=>{
    entries = [];
    cm('m-settings');
    renderTable();
    toast('All records cleared','error');
  });
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
    <div class="field-row${i===0?' primary':''}${field.type==='select'?' wrap':''}" data-i="${i}">
      ${i===0?'<span class="field-badge">Title</span>':'<span style="color:var(--muted2);cursor:grab;font-size:14px;">⠿</span>'}
      <input type="text" value="${esc(field.label)}" placeholder="Field name" data-k="label">
      <select data-k="type"${i===0?' disabled':''} onchange="handleFieldTypeChange()">
        ${FTYPES.map(t=>`<option value="${t}"${field.type===t?' selected':''}>${t}</option>`).join('')}
      </select>
      ${i===0?'<div style="width:22px;"></div>':`<button class="field-del" onclick="delField(${i})">✕</button>`}
      ${field.type==='select'?`<div class="field-options"><input type="text" value="${esc(options)}" placeholder="Options, separated by commas" data-k="options"></div>`:''}
    </div>`;
  }).join('');
}
function addField(){
  const fields=getFieldsFromEd();
  fields.push({key:'f_'+Date.now(),label:'',type:'text',options:[]});
  renderFieldsEd(fields);
}
function delField(i){
  const fields=getFieldsFromEd(); fields.splice(i,1); renderFieldsEd(fields);
}
function handleFieldTypeChange(){
  renderFieldsEd(getFieldsFromEd());
}
function getFieldsFromEd(){
  const ex = config.fields || [];
  return [...document.querySelectorAll('#fields-ed .field-row')].map((row,i)=>normalizeField({
    key:ex[i]?.key||('f_'+Date.now()+'_'+i),
    label:row.querySelector('[data-k="label"]').value.trim()||'Field',
    type:row.querySelector('[data-k="type"]').value,
    options:parseSelectOptions(row.querySelector('[data-k="options"]')?.value||''),
  },i));
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
  buildRecForm({});
  om('m-record');
}
async function openEditRecord(id){
  editEntryId=id;
  const r=await db.records.get(id); if(!r) return;
  document.getElementById('m-rec-ttl').textContent='Edit Record';
  document.getElementById('rec-save-btn').textContent='Save';
  buildRecForm(r.data||{});
  om('m-record');
}
function buildRecForm(data){
  const fields=config.fields.length ? config.fields : [{key:'title',label:'Title',type:'text'}];
  const c=gc(config.color);
  const fhtml=fields.map(f=>{
    const field = normalizeField(f);
    const val=data[field.key]!==undefined?data[field.key]:'';
    let inp='';
    if(field.type==='textarea'){
      inp=`<textarea class="ftextarea" data-k="${field.key}">${esc(String(val))}</textarea>`;
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
    return `<div class="rfrow"><div class="rflabel">${esc(field.label)}<span class="type-badge">${field.type}</span></div>${inp}</div>`;
  }).join('');
  document.getElementById('rec-form').innerHTML=fhtml;
}
async function saveRecord(){
  const fields=config.fields;
  const data={};
  fields.forEach(f=>{
    if(f.type==='boolean'){const el=document.querySelector(`input[name="b_${f.key}"]:checked`);data[f.key]=el?el.value==='true':false;}
    else{const el=document.querySelector(`[data-k="${f.key}"]`);data[f.key]=el?el.value:'';}
  });
  if(editEntryId){await db.records.update(editEntryId,{data});toast('Updated!','success');}
  else{await db.records.add({data,createdAt:Date.now()});toast('Record added!','success');}
  cm('m-record');
  entries=await db.records.toArray();
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
    await db.records.clear();
    if(parsed.entries.length) await db.records.bulkAdd(parsed.entries);
    entries = await db.records.toArray();
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

init().catch(err => {
  console.error('TableVault init failed', err);
  const msg = err?.message || err?.name || 'Startup failed';
  try { toast(msg, 'error'); } catch {}
});

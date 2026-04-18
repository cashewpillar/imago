const db = new Dexie('TableVaultDB');
db.version(1).stores({ vaults:'++id,name', entries:'++id,tableId,createdAt' });
db.version(2).stores({ vaults:'++id,name,sourceTrackerId', entries:'++id,tableId,createdAt,sourceRowUid,sourceTrackerId' });

const COLORS = [
  {name:'Lime',  val:'#b8ff57',dim:'rgba(184,255,87,.13)'},
  {name:'Sky',   val:'#57c4ff',dim:'rgba(87,196,255,.13)'},
  {name:'Pink',  val:'#ff7eb3',dim:'rgba(255,126,179,.13)'},
  {name:'Amber', val:'#ffb84d',dim:'rgba(255,184,77,.13)'},
  {name:'Violet',val:'#b57bff',dim:'rgba(181,123,255,.13)'},
  {name:'Teal',  val:'#3fe0c5',dim:'rgba(63,224,197,.13)'},
  {name:'Coral', val:'#ff6b6b',dim:'rgba(255,107,107,.13)'},
  {name:'Ice',   val:'#ddeeff',dim:'rgba(221,238,255,.10)'},
];
const FTYPES = ['text','number','date','url','boolean','select','progress','textarea'];
const THEME_KEY = 'tablevault-theme';

let vaults=[], currentVaultId=null, allEntries=[], homeTagF=[], recTagF=[], editEntryId=null, selColor='Lime';
let editTableTags=[];
let recGroupField='', collapsedGroups={};
let activeTopSearch='';

const gc = n => {
  const named = COLORS.find(c=>c.name===n);
  if(named) return named;
  if(typeof n === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(n)) return {name:n,val:n,dim:hexToRgba(n,0.14)};
  return COLORS[0];
};
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const om = id => document.getElementById(id).classList.add('open');
const cm = id => document.getElementById(id).classList.remove('open');
const bdClose = (e,id) => { if(e.target.id===id) cm(id); };

async function init() {
  initTheme();
  await loadVaults();
  renderHome();
  initCPs();
}

async function loadVaults() {
  vaults = (await db.vaults.toArray()).map(normalizeVault);
  await Promise.all(vaults.map(async v => { v._count = await db.entries.where('tableId').equals(v.id).count(); }));
}

/* ── HOME ── */
async function renderHome() {
  const q = document.getElementById('home-search').value.toLowerCase();
  const allTags = new Set(); vaults.forEach(v=>(v.tags||[]).forEach(t=>allTags.add(t)));
  renderTagRow('home-tags',[...allTags],homeTagF,'Lime',tag=>{
    const i=homeTagF.indexOf(tag); i>=0?homeTagF.splice(i,1):homeTagF.push(tag); renderHome();
  });
  const list = vaults.filter(v=>{
    if(homeTagF.length && !homeTagF.every(t=>(v.tags||[]).includes(t))) return false;
    if(q && !v.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const grid = document.getElementById('home-grid');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state"><div class="empty-icon">🗂️</div><h3>${vaults.length?'No results':'No tables yet'}</h3><p>${vaults.length?'Try different filters.':'Tap + to create your first table.'}</p></div>`;
    return;
  }
  grid.innerHTML = list.map(v=>{
    const c=gc(v.color);
    const tagsHtml=(v.tags||[]).map(t=>`<span class="tc-tag" style="background:${c.dim};color:${c.val};">${esc(t)}</span>`).join('');
    return `<div class="table-card" onclick="openVault(${v.id})">
      <div class="tc-stripe" style="background:${c.val};"></div>
      <div class="tc-icon">${v.icon||'📋'}</div>
      <div class="tc-name">${esc(v.name)}</div>
      ${tagsHtml?`<div class="tc-tags">${tagsHtml}</div>`:''}
      <div class="tc-footer">
        <span class="tc-count" style="background:${c.dim};color:${c.val};">${v._count} record${v._count!==1?'s':''}</span>
        <button class="tc-menu" onclick="event.stopPropagation();showVaultCtx(event,${v.id})">⋮</button>
      </div>
    </div>`;
  }).join('');
}

function goHome() {
  document.getElementById('screen-records').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  document.getElementById('rec-search').value='';
  recTagF=[];
  closeTopSearch('rec');
  loadVaults().then(renderHome);
}

/* ── RECORDS ── */
async function openVault(id) {
  currentVaultId=id;
  allEntries = await db.entries.where('tableId').equals(id).toArray();
  allEntries.sort((a,b)=>b.createdAt-a.createdAt);
  const v=vaults.find(x=>x.id===id);
  document.getElementById('rec-screen-title').textContent=(v?.icon||'')+' '+(v?.name||'');
  recTagF=[]; document.getElementById('rec-search').value='';
  recGroupField='';
  collapsedGroups={};
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-records').classList.add('active');
  renderGroupingSelect(v?.fields||[]);
  renderRecords();
}

function renderRecords() {
  const v=vaults.find(x=>x.id===currentVaultId);
  const fields=v?.fields||[];
  const c=gc(v?.color);
  const q=document.getElementById('rec-search').value.toLowerCase();
  const tagGroups = new Map();
  allEntries.forEach(r=>{
    getRecordMetaGroups(fields,r).forEach(group=>{
      const list = tagGroups.get(group.key) || {label:group.label, chips:new Set()};
      group.values.forEach(value=>list.chips.add(value));
      tagGroups.set(group.key,list);
    });
  });
  renderTagRow('rec-tags',[...tagGroups.entries()].map(([key, group])=>({key,label:group.label,tags:[...group.chips]})),recTagF,v?.color||'Lime',tag=>{
    const i=recTagF.indexOf(tag); i>=0?recTagF.splice(i,1):recTagF.push(tag); renderRecords();
  });
  const list=allEntries.filter(r=>{
    const recordTags = getRecordMetaGroups(fields,r).flatMap(group=>group.values);
    if(recTagF.length && !recTagF.every(t=>recordTags.includes(t))) return false;
    if(q){
      const txt=Object.values(r.data||{}).join(' ').toLowerCase();
      if(!txt.includes(q)) return false;
    }
    return true;
  });
  const grid=document.getElementById('rec-grid');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state"><div class="empty-icon">${v?.icon||'🗂️'}</div><h3>${allEntries.length?'No results':'No records yet'}</h3><p>${allEntries.length?'Try different filters.':'Tap + to add your first record.'}</p></div>`;
    return;
  }
  if(recGroupField){
    const grouped = new Map();
    list.forEach(r=>{
      const value = getGroupValue(fields, r, recGroupField);
      const key = value || 'Ungrouped';
      const rows = grouped.get(key) || [];
      rows.push(r);
      grouped.set(key, rows);
    });
    const sortedGroups = [...grouped.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    grid.innerHTML = `<div class="group-list">${sortedGroups.map(([groupName, rows])=>{
      const collapsed = !!collapsedGroups[groupName];
      const encodedName = encodeURIComponent(groupName);
      return `<div class="group-block">
        <div class="group-head" onclick="toggleGroup('${encodedName}')">
          <span class="group-toggle">${collapsed?'▸':'▾'}</span>
          <span class="group-title">${esc(groupName)}</span>
          <span class="group-count">${rows.length}</span>
          </div>
        ${collapsed ? '' : `<div class="group-cards">${rows.map(r=>renderRecordCard(r, fields, c)).join('')}</div>`}
      </div>`;
    }).join('')}</div>`;
    return;
  }
  grid.innerHTML=list.map(r=>renderRecordCard(r, fields, c)).join('');
}

function renderRecordCard(r, fields, c){
    const title=fields[0]?String(r.data?.[fields[0].key]||'—'):'—';
    const metaGroups = getRecordMetaGroups(fields,r);
    const preview=fields.slice(1,4).map(f=>{
      let val=r.data?.[f.key];
      if(val===undefined||val===null||val==='') return '';
      if(f.type==='boolean') val=val?'✓ Yes':'✗ No';
      if(f.type==='select') return '';
      if(f.type==='progress') return `<div class="rc-frow"><span class="rc-fkey">${esc(f.label)}</span><span class="rc-fval" style="display:flex;align-items:center;gap:5px;"><div class="prog-wrap" style="flex:1;"><div class="prog-fill" style="width:${Math.min(100,parseInt(val)||0)}%;background:${c.val};"></div></div><span style="font-size:10px;color:var(--muted);flex-shrink:0;">${val}%</span></span></div>`;
      if(f.type==='url') val='🔗 '+val;
      return `<div class="rc-frow"><span class="rc-fkey">${esc(f.label)}</span><span class="rc-fval">${esc(String(val))}</span></div>`;
    }).filter(Boolean).join('');
    const tagsHtml=metaGroups.length ? `<div class="rc-meta">${metaGroups.map(group=>`
      <div class="rc-meta-group">
        <div class="rc-meta-label">${esc(group.label)}</div>
        <div class="rc-meta-tags">${group.values.map(t=>`<span class="rc-tag" style="background:${c.dim};color:${c.val};">${esc(t)}</span>`).join('')}</div>
      </div>`).join('')}</div>` : '';
    const date=new Date(r.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<div class="rec-card" onclick="openEditRecord(${r.id})">
      <div class="rc-stripe" style="background:${c.val};"></div>
      <div class="rc-header"><div class="rc-title">${esc(title)}</div>
        <button class="rc-menu" onclick="event.stopPropagation();showEntryCtx(event,${r.id})">⋮</button></div>
      ${preview?`<div class="rc-fields">${preview}</div>`:''}
      ${tagsHtml}
      <div class="rc-date">${date}</div>
    </div>`;
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
function renderGroupingSelect(fields){
  const el=document.getElementById('rec-group-by');
  if(!el) return;
  const options = [{key:'', label:'No grouping'}].concat(
    fields.filter(f=>f.type==='select').map(f=>({key:f.key,label:`Group: ${f.label}`}))
  );
  el.innerHTML = options.map(opt=>`<option value="${esc(opt.key)}"${opt.key===recGroupField?' selected':''}>${esc(opt.label)}</option>`).join('');
}
function handleGroupingChange(){
  recGroupField=document.getElementById('rec-group-by')?.value||'';
  collapsedGroups={};
  renderRecords();
}
function toggleTopSearch(scope){
  const targetId = scope === 'home' ? 'home-top-search' : 'rec-top-search';
  const inputId = scope === 'home' ? 'home-search' : 'rec-search';
  const target = document.getElementById(targetId);
  if(!target) return;
  const willOpen = !target.classList.contains('open');
  ['home','rec'].forEach(name=>{
    if(name !== scope) closeTopSearch(name);
  });
  target.classList.toggle('open', willOpen);
  activeTopSearch = willOpen ? scope : '';
  if(willOpen) setTimeout(()=>document.getElementById(inputId)?.focus(), 120);
}
function closeTopSearch(scope){
  const targetId = scope === 'home' ? 'home-top-search' : 'rec-top-search';
  const target = document.getElementById(targetId);
  target?.classList.remove('open');
  if(activeTopSearch === scope) activeTopSearch = '';
}
function toggleGroup(encodedName){
  const name = decodeURIComponent(encodedName);
  collapsedGroups[name]=!collapsedGroups[name];
  renderRecords();
}

/* ── NEW TABLE ── */
let editVaultId=null;
function openNewTableModal(){
  editVaultId=null; selColor='Lime';
  document.getElementById('m-table-ttl').textContent='New Table';
  document.getElementById('tbl-save-btn').textContent='Create';
  document.getElementById('tbl-name').value='';
  document.getElementById('tbl-icon').value='';
  updateCP('cp1'); om('m-table');
  setTimeout(()=>document.getElementById('tbl-name').focus(),120);
}
async function saveTable(){
  const name=document.getElementById('tbl-name').value.trim();
  if(!name){toast('Enter a table name','error');return;}
  const icon=document.getElementById('tbl-icon').value.trim()||'📋';
  const id=await db.vaults.add({name,icon,color:selColor,fields:[{key:'title',label:'Title',type:'text',options:[]},{key:'notes',label:'Notes',type:'textarea',options:[]}],tags:[],createdAt:Date.now()});
  cm('m-table'); await loadVaults(); renderHome(); openVault(id); toast('Table created!','success');
}

/* ── SETTINGS ── */
function openSettingsModal(){
  const v=vaults.find(x=>x.id===currentVaultId); if(!v) return;
  document.getElementById('ts-name').value=v.name;
  document.getElementById('ts-icon').value=v.icon||'';
  editTableTags=[...(v.tags||[])];
  selColor=v.color||'Lime'; updateCP('cp2'); om('m-settings');
  renderTableTagPills();
}
async function saveSettings(){
  const name=document.getElementById('ts-name').value.trim();
  if(!name){toast('Enter a name','error');return;}
  const icon=document.getElementById('ts-icon').value.trim()||'📋';
  const tags=[...editTableTags];
  await db.vaults.update(currentVaultId,{name,icon,color:selColor,tags});
  cm('m-settings'); await loadVaults();
  const v=vaults.find(x=>x.id===currentVaultId);
  document.getElementById('rec-screen-title').textContent=(v?.icon||'')+' '+(v?.name||'');
  renderRecords(); toast('Saved!','success');
}
async function confirmDeleteTable(){
  if(!confirm('Delete this table and all its records?')) return;
  await db.entries.where('tableId').equals(currentVaultId).delete();
  await db.vaults.delete(currentVaultId);
  cm('m-settings'); await loadVaults(); goHome(); toast('Table deleted','error');
}

/* ── FIELDS ── */
function openFieldsModal(){
  const v=vaults.find(x=>x.id===currentVaultId);
  renderFieldsEd(v?.fields||[]);
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
  const v=vaults.find(x=>x.id===currentVaultId); const ex=v?.fields||[];
  return [...document.querySelectorAll('#fields-ed .field-row')].map((row,i)=>normalizeField({
    key:ex[i]?.key||('f_'+Date.now()+'_'+i),
    label:row.querySelector('[data-k="label"]').value.trim()||'Field',
    type:row.querySelector('[data-k="type"]').value,
    options:parseSelectOptions(row.querySelector('[data-k="options"]')?.value||''),
  },i));
}
async function saveFields(){
  const fields=getFieldsFromEd();
  if(!fields[0]?.label){toast('Title field needs a name','error');return;}
  await db.vaults.update(currentVaultId,{fields});
  const i=vaults.findIndex(x=>x.id===currentVaultId);
  if(i>=0) vaults[i].fields=fields;
  cm('m-fields'); renderRecords(); toast('Fields updated!','success');
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
  const r=await db.entries.get(id); if(!r) return;
  document.getElementById('m-rec-ttl').textContent='Edit Record';
  document.getElementById('rec-save-btn').textContent='Save';
  buildRecForm(r.data||{});
  om('m-record');
}
function buildRecForm(data){
  const v=vaults.find(x=>x.id===currentVaultId);
  const fields=v?.fields||[{key:'title',label:'Title',type:'text'}];
  const c=gc(v?.color);
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
function renderTableTagPills(){
  const v=vaults.find(x=>x.id===currentVaultId); const c=gc(v?.color);
  const el=document.getElementById('ts-tag-pills');
  if(!el) return;
  el.innerHTML=editTableTags.map((t,i)=>`<span class="tpill" style="background:${c.dim};color:${c.val};">${esc(t)}<span class="tpill-x" onclick="rmTableTag(${i})">×</span></span>`).join('');
}
function rmTableTag(i){
  editTableTags.splice(i,1);
  renderTableTagPills();
}
function handleTableTag(e){
  if(e.key==='Enter'||e.key===','){
    e.preventDefault();
    const val=e.target.value.trim().replace(/,/g,'');
    if(val&&!editTableTags.includes(val)){editTableTags.push(val);renderTableTagPills();}
    e.target.value='';
  } else if(e.key==='Backspace'&&!e.target.value&&editTableTags.length){
    editTableTags.pop();
    renderTableTagPills();
  }
}
async function saveRecord(){
  const v=vaults.find(x=>x.id===currentVaultId); const fields=v?.fields||[];
  const data={};
  fields.forEach(f=>{
    if(f.type==='boolean'){const el=document.querySelector(`input[name="b_${f.key}"]:checked`);data[f.key]=el?el.value==='true':false;}
    else{const el=document.querySelector(`[data-k="${f.key}"]`);data[f.key]=el?el.value:'';}
  });
  if(editEntryId){await db.entries.update(editEntryId,{data});toast('Updated!','success');}
  else{await db.entries.add({tableId:currentVaultId,data,createdAt:Date.now()});toast('Record added!','success');}
  cm('m-record');
  allEntries=await db.entries.where('tableId').equals(currentVaultId).toArray();
  allEntries.sort((a,b)=>b.createdAt-a.createdAt);
  const vi=vaults.findIndex(x=>x.id===currentVaultId); if(vi>=0) vaults[vi]._count=allEntries.length;
  renderRecords();
}

/* ── CTX ── */
let ctxFns=[];
function showVaultCtx(e,id){
  showCtx(e.clientX,e.clientY,[
    {l:'⚙️  Settings',f:()=>{currentVaultId=id;openSettingsModal();}},
    {sep:true},
    {l:'🗑  Delete',f:()=>deleteVaultDirect(id),d:true},
  ]);
}
function showEntryCtx(e,id){
  showCtx(e.clientX,e.clientY,[
    {l:'✏️  Edit',f:()=>openEditRecord(id)},
    {sep:true},
    {l:'🗑  Delete',f:()=>deleteEntry(id),d:true},
  ]);
}
async function deleteVaultDirect(id){
  if(!confirm('Delete this table and all its records?')) return;
  await db.entries.where('tableId').equals(id).delete();
  await db.vaults.delete(id);
  await loadVaults(); renderHome(); toast('Deleted','error');
}
async function deleteEntry(id){
  if(!confirm('Delete this record?')) return;
  await db.entries.delete(id);
  allEntries=allEntries.filter(r=>r.id!==id);
  const vi=vaults.findIndex(x=>x.id===currentVaultId); if(vi>=0) vaults[vi]._count=allEntries.length;
  renderRecords(); toast('Deleted','error');
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

/* ── COLOR PICKERS ── */
function initCPs(){
  ['cp1','cp2'].forEach(id=>{
    const el=document.getElementById(id);
    COLORS.forEach(c=>{
      const s=document.createElement('div');
      s.className='cswatch'; s.dataset.c=c.name; s.dataset.p=id;
      s.style.background=c.val; s.title=c.name;
      s.onclick=()=>{selColor=c.name;updateCP(id);};
      el.appendChild(s);
    });
    updateCP(id);
  });
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
  document.documentElement.classList.toggle('light', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme(){
  applyTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
}

/* ── IMPORT ── */
async function importSnapshot(){
  const input = document.getElementById('snapshot-file-input');
  if(input) input.value = '';
  input?.click();
}
async function handleSnapshotFile(event){
  const file = event.target.files?.[0];
  if(!file) return;
  if(!confirm('Replace current TableVault data with supported content from the selected snapshot? Unsupported organize data and linked-table fields will be skipped.')) return;
  try{
    const snapshot = JSON.parse(await file.text());
    const payload = buildImportPayload(snapshot);
    await db.transaction('rw', db.vaults, db.entries, async()=>{
      await db.entries.clear();
      await db.vaults.clear();
      for(const vault of payload.vaults){
        const {_sourceTrackerId, ...vaultRecord} = vault;
        const id = await db.vaults.add(vaultRecord);
        const entries = (payload.entriesByTracker.get(vault._sourceTrackerId)||[]).map(entry=>({...entry,tableId:id}));
        if(entries.length) await db.entries.bulkAdd(entries);
      }
    });
    currentVaultId = null;
    allEntries = [];
    homeTagF = [];
    recTagF = [];
    await loadVaults();
    renderHome();
    goHome();
    toast(`Imported ${payload.vaults.length} tables and ${payload.entryCount} records`,'success');
  } catch(err){
    console.error(err);
    toast('Snapshot import failed','error');
  } finally {
    event.target.value = '';
  }
}
function buildImportPayload(snapshot){
  const tables = Array.isArray(snapshot?.tables) ? snapshot.tables : [];
  const columns = Array.isArray(snapshot?.tracker_columns) ? snapshot.tracker_columns : [];
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  const colsByTracker = new Map();
  const rowsByTracker = new Map();
  columns.forEach(col=>{
    const list = colsByTracker.get(col.tracker_id) || [];
    list.push(col);
    colsByTracker.set(col.tracker_id,list);
  });
  rows.forEach(row=>{
    const list = rowsByTracker.get(row.tracker_id) || [];
    list.push(row);
    rowsByTracker.set(row.tracker_id,list);
  });

  let entryCount = 0;
  const vaults = tables.map(table=>{
    const meta = safeJson(table.table_meta_json,{});
    const fields = (colsByTracker.get(table.id)||[])
      .slice()
      .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
      .map((col,idx)=>mapSnapshotColumn(col,idx))
      .filter(Boolean);
    const safeFields = fields.length ? fields : [{key:'title',label:'Title',type:'text',options:[]}];
    const entries = (rowsByTracker.get(table.id)||[]).map(row=>{
      const values = safeJson(row.values_json,{});
      const data = {};
      safeFields.forEach(field=>{
        const raw = values[field.key];
        if(field.type === 'boolean') data[field.key] = raw === true || raw === 'true';
        else if(field.type === 'number' || field.type === 'progress') data[field.key] = raw ?? '';
        else data[field.key] = raw ?? '';
      });
      return {
        data,
        createdAt: parseSnapshotTime(row.created_at, row.updated_at),
      };
    });
    entryCount += entries.length;
    rowsByTracker.set(table.id, entries);
    return {
      _sourceTrackerId: table.id,
      name: table.name || 'Untitled',
      icon: meta.icon || '📋',
      color: meta.color || 'Lime',
      fields: safeFields,
      tags: table.tag ? [table.tag] : [],
      createdAt: parseSnapshotTime(table.created_at),
    };
  });

  return {vaults, entriesByTracker: rowsByTracker, entryCount};
}
function mapSnapshotColumn(col, idx){
  if(col.linked_tracker_id) return null;
  const mappedType = mapSnapshotFieldType(col.field_type);
  if(!mappedType) return null;
  return normalizeField({
    key: col.field_key || `f_${Date.now()}_${idx}`,
    label: col.label || 'Field',
    type: mappedType,
    options: mappedType === 'select' ? safeJson(col.options_json,[]) : [],
  }, idx);
}
function mapSnapshotFieldType(type){
  if(type === 'status') return 'select';
  if(['text','number','date','url','boolean','select','progress','textarea'].includes(type)) return type;
  return null;
}
function parseSnapshotTime(...values){
  for(const value of values){
    if(!value) continue;
    const time = new Date(value).getTime();
    if(Number.isFinite(time)) return time;
  }
  return Date.now();
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
function normalizeVault(v){
  return {
    ...v,
    fields:(v.fields||[]).map((field,idx)=>normalizeField(field,idx)),
    tags:Array.isArray(v.tags)?v.tags.filter(Boolean):[],
  };
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
function safeJson(value, fallback){
  if(typeof value !== 'string') return fallback;
  try{return JSON.parse(value);}catch{return fallback;}
}
function hexToRgba(hex, alpha){
  let raw = hex.replace('#','');
  if(raw.length === 3) raw = raw.split('').map(ch=>ch+ch).join('');
  if(raw.length !== 6) return `rgba(184,255,87,${alpha})`;
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
  if(e.key==='Escape')['m-table','m-settings','m-fields','m-record'].forEach(cm);
});

init().catch(err => {
  console.error('TableVault init failed', err);
  const msg = err?.message || err?.name || 'Startup failed';
  try { toast(msg, 'error'); } catch {}
});

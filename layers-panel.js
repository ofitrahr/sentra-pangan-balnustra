// ============================================================
// layers-panel.js — Katalog kiri (Data Input / Hasil Analisis) + panel kanan
// (workspace: stack layer aktif, drag-drop, urutan/z-index, visibility, opacity).
// Menggantikan buildDynamicGroups()/updateExtraLegend() lama di app.js.
// Bergantung pada variabel/fungsi top-level di app.js (CATALOG, map, fsnMode,
// choroplethVar, showLabels, polyLayer, glyphLayerGroup, renderFSN,
// updateLegendTitle, buildAndShowLayer) -- diakses langsung by name karena
// app.js & file ini sama-sama classic <script> (berbagi 1 global scope).
// ============================================================

const FSN_GLYPH_ID = '__fsn_glyph';
const FSN_CHOROPLETH_ID = '__fsn_choropleth';
const CHOROPLETH_VARS = [
  { value: 'produksi_padi', label: 'Produksi Padi' },
  { value: 'kapasitas_pengolahan', label: 'Kapasitas Pengolahan' },
  { value: 'produksi_beras', label: 'Produksi Beras' },
  { value: 'kebutuhan_beras', label: 'Konsumsi' },
];
const KOMODITAS_LABELS = { padi: 'Padi', pertanian: 'Pertanian (umum)', umum: 'Umum / Lintas Komoditas' };

// Palet kategorikal tervalidasi (skill dataviz, references/palette.md) -- urutan
// slot TETAP (bukan siklus acak), sudah lolos cek pemisahan buta-warna adjacent.
const CATEGORICAL_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const MAX_CATEGORICAL_VALUES = 8; // di atas ini: terlalu ramai untuk dibedakan, field di-exclude dari pilihan

const activeStack = [];       // array terurut of layer-id (termasuk id semu FSN)
const activeLayers = {};      // id -> Leaflet layer object (non-FSN)
const layerVisible = {};      // id -> bool
const layerOpacity = {};      // id -> 0..1
const layerSymbology = {};    // id -> {field, type:'categorical'|'numeric', meta} atau null (tunggal/default)
const layerFieldsCache = {};  // id -> hasil discoverFields() (dihitung sekali per layer)

function isFsnId(id){ return id===FSN_GLYPH_ID || id===FSN_CHOROPLETH_ID; }

function fsnCatalogEntry(){ return CATALOG.layers.find(l=>l.render_type==='fsn_drilldown'); }

function cardLabel(id){
  if(id===FSN_GLYPH_ID) return 'Rantai Pasok Padi — Glyph 4-Tahap';
  if(id===FSN_CHOROPLETH_ID) return 'Rantai Pasok Padi — Choropleth';
  const e = CATALOG.layers.find(l=>l.id===id);
  return e ? e.label : id;
}
function cardColor(id){
  if(isFsnId(id)){
    const cat = CATALOG.categories.find(c=>c.id==='fsn');
    return cat ? cat.color : '#555';
  }
  const e = CATALOG.layers.find(l=>l.id===id);
  if(!e) return '#555';
  const cat = CATALOG.categories.find(c=>c.id===e.category);
  return (e.style && e.style.color) || (cat ? cat.color : '#555');
}

// ---------------- Bootstrap ----------------
function initLayersPanel(){
  renderCatalogPanel();
  renderStackPanel();
  setupContainerDnD();
  updateLegend();

  // auto-drag kartu default_visible:true ke workspace (mis. FSN Glyph)
  CATALOG.layers.forEach(l=>{
    if(!l.default_visible) return;
    const id = l.render_type==='fsn_drilldown' ? FSN_GLYPH_ID : l.id;
    addToStack(id);
  });
}

// ---------------- Katalog kiri ----------------
function renderCatalogPanel(){
  const pinnedContainer = document.getElementById('catalog-pinned-groups');
  const inputContainer = document.getElementById('catalog-input-groups');
  const analysisContainer = document.getElementById('catalog-analysis-groups');
  pinnedContainer.innerHTML = '';
  inputContainer.innerHTML = '';
  analysisContainer.innerHTML = '';

  // -- Batas Administrasi: layer basemap yang selalu ditampilkan di atas --
  const pinnedLayers = CATALOG.layers.filter(l=>l.pinned);
  pinnedLayers.forEach(l=>{
    pinnedContainer.appendChild(buildCatalogCard({ id:l.id, label:l.label, count:l.count, download_url:l.download_url }));
  });

  // -- Data Input: grouped by category (layer pinned tidak diulang di sini) --
  const byCat = {};
  CATALOG.layers.filter(l=>l.kind==='input' && !l.pinned).forEach(l=>{
    (byCat[l.category] = byCat[l.category] || []).push(l);
  });
  CATALOG.categories.forEach(cat=>{
    const layers = byCat[cat.id];
    if(!layers || !layers.length) return;
    inputContainer.appendChild(buildCatalogGroup(cat.label, cat.color, layers.map(l=>({
      id:l.id, label:l.label, count:l.count, download_url:l.download_url
    }))));
  });

  // -- Hasil Analisis: grouped by komoditas --
  const byKom = {};
  const fsnEntry = fsnCatalogEntry();
  if(fsnEntry){
    byKom.padi = byKom.padi || [];
    byKom.padi.push({ id:FSN_GLYPH_ID, label:'Rantai Pasok Padi — Glyph 4-Tahap', count:null });
    byKom.padi.push({ id:FSN_CHOROPLETH_ID, label:'Rantai Pasok Padi — Choropleth', count:null });
  }
  CATALOG.layers.filter(l=>l.kind==='analysis' && l.render_type!=='fsn_drilldown').forEach(l=>{
    const kom = l.komoditas || 'umum';
    (byKom[kom] = byKom[kom] || []).push({ id:l.id, label:l.label, count:l.count });
  });
  const fsnColor = (CATALOG.categories.find(c=>c.id==='fsn')||{}).color || '#2B5F5A';
  Object.keys(byKom).forEach(kom=>{
    analysisContainer.appendChild(buildCatalogGroup(KOMODITAS_LABELS[kom] || kom, fsnColor, byKom[kom]));
  });

  attachCatalogCardHandlers();
}

function buildCatalogCard(item){
  const added = activeStack.includes(item.id);
  const card = document.createElement('div');
  card.className = 'catalog-card' + (added ? ' added' : '');
  card.draggable = !added;
  card.dataset.layerid = item.id;
  const cntTxt = item.count!=null ? ` <span class="cnt">(${item.count})</span>` : '';
  const dlTxt = item.download_url ? ` <a class="dl-link" href="${item.download_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">&#8681;</a>` : '';
  card.innerHTML = `<span class="drag-dot">&#8942;&#8942;</span><span class="card-label">${item.label}${cntTxt}${dlTxt}</span><button class="add-btn" title="Tambah ke peta" ${added?'disabled':''}>+</button>`;
  return card;
}

function buildCatalogGroup(label, color, items){
  const details = document.createElement('details');
  details.className = 'cat-group';
  const summary = document.createElement('summary');
  summary.innerHTML = `<span class="catname"><span class="catdot" style="background:${color}"></span>${label}</span>`;
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'cat-body';
  items.forEach(item=> body.appendChild(buildCatalogCard(item)));
  details.appendChild(body);
  return details;
}

function attachCatalogCardHandlers(){
  document.querySelectorAll('.catalog-card').forEach(card=>{
    const id = card.dataset.layerid;
    if(card.classList.contains('added')) return;
    card.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    const btn = card.querySelector('.add-btn');
    if(btn) btn.addEventListener('click', ()=> addToStack(id));
  });
}

// ---------------- Panel kanan: workspace stack ----------------
function renderStackPanel(){
  const el = document.getElementById('workspace-stack');
  el.innerHTML = '';
  if(!activeStack.length){
    el.innerHTML = '<div class="empty-hint">Tarik layer dari katalog kiri ke sini, atau klik tombol &ldquo;+&rdquo;.</div>';
    return;
  }
  activeStack.forEach(id=>{
    const visible = layerVisible[id] !== false;
    const opacity = layerOpacity[id] != null ? layerOpacity[id] : 1;
    const symbolizable = isSymbolizable(id);
    const item = document.createElement('div');
    item.className = 'stack-item' + (visible ? '' : ' hidden-layer');
    item.draggable = true;
    item.dataset.layerid = id;
    item.innerHTML = `
      <span class="drag-handle">&#8942;&#8942;</span>
      <span class="stack-dot" style="background:${cardColor(id)}"></span>
      <span class="stack-label">${cardLabel(id)}</span>
      ${symbolizable ? '<button class="symbology-btn" title="Ubah simbologi">&#127912;</button>' : ''}
      <button class="vis-btn" title="Tampil/sembunyikan">${visible?'&#128065;':'&#128683;'}</button>
      <input type="range" class="opacity-slider" min="0" max="1" step="0.05" value="${opacity}" title="Transparansi">
      <button class="remove-btn" title="Hapus dari peta">&times;</button>`;
    el.appendChild(item);

    if(id===FSN_CHOROPLETH_ID){
      const sub = document.createElement('div');
      sub.className = 'stack-item-sub';
      sub.innerHTML = CHOROPLETH_VARS.map(v=>`<label><input type="radio" name="__choro_var" value="${v.value}" ${choroplethVar===v.value?'checked':''}> ${v.label}</label>`).join('');
      el.appendChild(sub);
      sub.querySelectorAll('input[type=radio]').forEach(r=>{
        r.addEventListener('change', e=>{ choroplethVar = e.target.value; renderFSN(); updateLegend(); });
      });
    }
    if(symbolizable && stackSymbologyPanelOpen === id){
      el.appendChild(buildSymbologyPanel(id));
    }
  });
  attachStackItemHandlers();
}

let stackSymbologyPanelOpen = null; // id kartu yang sedang membuka panel pilihan simbologi

function attachStackItemHandlers(){
  document.querySelectorAll('#workspace-stack .stack-item').forEach(item=>{
    const id = item.dataset.layerid;
    item.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/x-stack-reorder', id);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', ()=> item.classList.remove('dragging'));
    item.querySelector('.vis-btn').addEventListener('click', ()=>{
      setLayerVisible(id, layerVisible[id]===false);
    });
    item.querySelector('.opacity-slider').addEventListener('input', e=>{
      setLayerOpacity(id, parseFloat(e.target.value));
    });
    item.querySelector('.remove-btn').addEventListener('click', ()=> removeFromStack(id));
    const symBtn = item.querySelector('.symbology-btn');
    if(symBtn) symBtn.addEventListener('click', ()=>{
      stackSymbologyPanelOpen = (stackSymbologyPanelOpen===id) ? null : id;
      renderStackPanel();
    });
  });
}

// ---------------- Simbologi dinamis ----------------
const SYMBOLIZABLE_RENDER_TYPES = ['point', 'line', 'polygon', 'choropleth_polygon'];

function isSymbolizable(id){
  if(isFsnId(id)) return false;
  const entry = CATALOG.layers.find(l=>l.id===id);
  return !!entry && SYMBOLIZABLE_RENDER_TYPES.includes(entry.render_type);
}

function isNumber(v){ return typeof v==='number' && isFinite(v); }

async function discoverFields(id){
  if(layerFieldsCache[id]) return layerFieldsCache[id];
  const entry = CATALOG.layers.find(l=>l.id===id);
  const gj = await loadData(entry.data_url);
  const fields = {}; // key -> Set of raw values seen

  if(entry.render_type === 'choropleth_polygon'){
    const skip = new Set(['nama_desa', 'nama_kecamatan', 'nama_kabkot', entry.value_field]);
    gj.features.forEach(f=>{
      Object.entries(f.properties||{}).forEach(([k,v])=>{
        if(skip.has(k)) return;
        (fields[k] = fields[k] || new Set()).add(v);
      });
    });
  } else {
    gj.features.forEach(f=>{
      const pu = parsePU(f.properties && f.properties.pu);
      Object.entries(pu).forEach(([k,v])=>{
        (fields[k] = fields[k] || new Set()).add(v);
      });
    });
  }

  const result = [];
  Object.entries(fields).forEach(([key, valueSet])=>{
    const values = [...valueSet].filter(v=>v!=null && v!=='');
    if(!values.length) return;
    const allNumeric = values.every(isNumber);
    if(allNumeric){
      result.push({ key, label:key, type:'numeric', min:Math.min(...values), max:Math.max(...values) });
    } else if(values.length <= MAX_CATEGORICAL_VALUES){
      const uniq = [...new Set(values.map(String))].sort();
      result.push({ key, label:key, type:'categorical', values:uniq });
    }
    // field dengan kardinalitas tinggi & bukan numerik (mis. alamat) dilewati -- tidak cocok disimbologikan
  });
  layerFieldsCache[id] = result;
  return result;
}

function featureValueFor(entry, feature, key){
  if(entry.render_type === 'choropleth_polygon') return feature.properties ? feature.properties[key] : undefined;
  const pu = parsePU(feature.properties && feature.properties.pu);
  return pu[key];
}

function numericColorScale(val, min, max, baseHex){
  const t = max>min ? (val-min)/(max-min) : 0;
  const base = hexToRgb(baseHex);
  const light = {r:205, g:226, b:251}; // step 100 dari ramp sequential biru (references/palette.md)
  const r = light.r + (base.r-light.r)*t, g = light.g + (base.g-light.g)*t, b = light.b + (base.b-light.b)*t;
  return `rgb(${r|0},${g|0},${b|0})`;
}
function hexToRgb(hex){
  const h = hex.replace('#','');
  return { r:parseInt(h.substring(0,2),16), g:parseInt(h.substring(2,4),16), b:parseInt(h.substring(4,6),16) };
}
function categoricalColorFor(value, values){
  const idx = values.indexOf(String(value));
  return CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length];
}

function buildSymbologyPanel(id){
  const wrap = document.createElement('div');
  wrap.className = 'stack-item-sub symbology-panel';
  wrap.innerHTML = '<span class="sym-loading">Memuat daftar atribut&hellip;</span>';
  discoverFields(id).then(fields=>{
    const current = layerSymbology[id];
    const options = ['<option value="">Tunggal (warna kategori)</option>']
      .concat(fields.map(f=>`<option value="${f.key}" ${current&&current.field===f.key?'selected':''}>${f.label} (${f.type==='numeric'?'numerik':'kategorikal'})</option>`));
    wrap.innerHTML = `<label class="sym-label">Warnai berdasarkan:</label>
      <select class="symbology-select">${options.join('')}</select>
      ${!fields.length ? '<div class="sym-empty">Tidak ada atribut yang cocok disimbologikan.</div>' : ''}`;
    wrap.querySelector('.symbology-select').addEventListener('change', e=>{
      applySymbology(id, e.target.value || null, fields);
    });
  });
  return wrap;
}

function applySymbology(id, field, fields){
  const entry = CATALOG.layers.find(l=>l.id===id);
  const layer = activeLayers[id];
  if(!layer) return;

  if(!field){
    layerSymbology[id] = null;
    const catColor = cardColor(id);
    layer.eachLayer(l=>{ if(l.setStyle) l.setStyle({ fillColor: catColor, color: entry.render_type==='line' ? catColor : (l.options.color||catColor) }); });
    applyOpacity(id);
    updateLegend();
    return;
  }

  const meta = fields.find(f=>f.key===field);
  if(!meta) return;
  layerSymbology[id] = { field, type:meta.type, meta };
  const baseColor = cardColor(id);

  layer.eachLayer(l=>{
    const val = featureValueFor(entry, l.feature, field);
    let color;
    if(meta.type==='numeric'){
      color = isNumber(val) ? numericColorScale(val, meta.min, meta.max, baseColor) : '#c9c2ab';
    } else {
      color = val!=null ? categoricalColorFor(val, meta.values) : '#c9c2ab';
    }
    if(l.setStyle) l.setStyle({ fillColor: color, color: entry.render_type==='line' ? color : '#fff' });
  });
  applyOpacity(id);
  updateLegend();
}

function getDragAfterElement(container, y){
  const items = [...container.querySelectorAll('.stack-item:not(.dragging)')];
  return items.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if(offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

function setupContainerDnD(){
  const stackEl = document.getElementById('workspace-stack');
  stackEl.addEventListener('dragover', e=>{
    e.preventDefault();
    const dragging = stackEl.querySelector('.stack-item.dragging');
    if(!dragging) return;
    const after = getDragAfterElement(stackEl, e.clientY);
    if(after == null) stackEl.appendChild(dragging); else stackEl.insertBefore(dragging, after);
  });
  stackEl.addEventListener('drop', e=>{
    e.preventDefault();
    const reorderId = e.dataTransfer.getData('text/x-stack-reorder');
    if(reorderId){
      const newOrder = Array.from(stackEl.querySelectorAll('.stack-item')).map(it=>it.dataset.layerid);
      activeStack.length = 0;
      activeStack.push(...newOrder);
      applyStackOrder();
      updateLegend();
      return;
    }
    const newId = e.dataTransfer.getData('text/plain');
    if(newId) addToStack(newId);
  });
}

// ---------------- Stack operations ----------------
async function addToStack(id){
  if(activeStack.includes(id)) return;

  if(isFsnId(id)){
    const other = id===FSN_GLYPH_ID ? FSN_CHOROPLETH_ID : FSN_GLYPH_ID;
    if(activeStack.includes(other)) removeFromStack(other);
    activeStack.push(id);
    layerVisible[id] = true; layerOpacity[id] = 1;
    fsnMode = id===FSN_GLYPH_ID ? 'glyph' : 'choropleth';
    await renderFSN();
  } else {
    const entry = CATALOG.layers.find(l=>l.id===id);
    if(!entry) return;
    const cat = CATALOG.categories.find(c=>c.id===entry.category);
    activeStack.push(id);
    layerVisible[id] = true; layerOpacity[id] = 1;
    try{
      activeLayers[id] = await buildAndShowLayer(entry, cat ? cat.color : '#555');
    } catch(err){
      console.error(err);
      alert('Gagal memuat layer "'+entry.label+'": '+err.message);
      activeStack.splice(activeStack.indexOf(id), 1);
      delete layerVisible[id]; delete layerOpacity[id];
      renderStackPanel(); renderCatalogPanel();
      return;
    }
  }
  applyStackOrder();
  renderStackPanel();
  renderCatalogPanel();
  updateLegend();
}

function removeFromStack(id){
  const idx = activeStack.indexOf(id);
  if(idx===-1) return;
  activeStack.splice(idx, 1);
  delete layerVisible[id]; delete layerOpacity[id];
  delete layerSymbology[id]; delete layerFieldsCache[id];
  if(stackSymbologyPanelOpen === id) stackSymbologyPanelOpen = null;

  if(isFsnId(id)){
    fsnMode = 'off';
    renderFSN();
  } else if(activeLayers[id]){
    map.removeLayer(activeLayers[id]);
    delete activeLayers[id];
  }
  renderStackPanel();
  renderCatalogPanel();
  updateLegend();
}

function setLayerVisible(id, visible){
  layerVisible[id] = visible;
  if(isFsnId(id)){
    setFsnGroupsOpacity(visible ? (layerOpacity[id]!=null?layerOpacity[id]:1) : 0);
  } else if(activeLayers[id]){
    const layer = activeLayers[id];
    if(visible){ if(!map.hasLayer(layer)) map.addLayer(layer); applyOpacity(id); }
    else { map.removeLayer(layer); }
  }
  renderStackPanel();
  updateLegend();
}

function setLayerOpacity(id, val){
  layerOpacity[id] = val;
  if(isFsnId(id)) setFsnGroupsOpacity(val);
  else applyOpacity(id);
}

function applyOpacity(id){
  const layer = activeLayers[id];
  if(!layer || !layer.eachLayer) return;
  const val = layerOpacity[id] != null ? layerOpacity[id] : 1;
  layer.eachLayer(l=>{
    if(l.setStyle){
      if(l._baseFillOpacity == null) l._baseFillOpacity = l.options.fillOpacity != null ? l.options.fillOpacity : 1;
      if(l._baseStrokeOpacity == null) l._baseStrokeOpacity = l.options.opacity != null ? l.options.opacity : 1;
      l.setStyle({ fillOpacity: l._baseFillOpacity * val, opacity: l._baseStrokeOpacity * val });
    } else if(l.setOpacity){
      l.setOpacity(val);
    }
  });
}

function setFsnGroupsOpacity(val){
  [polyLayer, glyphLayerGroup].forEach(group=>{
    if(!group || !group.eachLayer) return;
    group.eachLayer(l=>{
      if(l.setStyle){
        if(l._baseFillOpacity == null) l._baseFillOpacity = l.options.fillOpacity != null ? l.options.fillOpacity : 1;
        if(l._baseStrokeOpacity == null) l._baseStrokeOpacity = l.options.opacity != null ? l.options.opacity : 1;
        l.setStyle({ fillOpacity: l._baseFillOpacity * val, opacity: l._baseStrokeOpacity * val });
      } else if(l.setOpacity){
        l.setOpacity(val);
      } else if(l._icon){
        l._icon.style.opacity = val;
      }
    });
  });
}

function bringGroupToFront(group){
  if(!group) return;
  if(group.eachLayer) group.eachLayer(l=>{ if(l.bringToFront) l.bringToFront(); });
  else if(group.bringToFront) group.bringToFront();
}
function applyStackOrder(){
  [...activeStack].reverse().forEach(id=>{
    if(isFsnId(id)){
      bringGroupToFront(polyLayer);
      bringGroupToFront(glyphLayerGroup);
    } else if(activeLayers[id]){
      bringGroupToFront(activeLayers[id]);
    }
  });
}

// ---------------- Legend (satu sumber, ikuti urutan activeStack) ----------------
function legendSymbol(id){
  if(id===FSN_GLYPH_ID) return null; // ditangani lewat #legend-glyph-block khusus
  if(id===FSN_CHOROPLETH_ID) return null; // ditangani lewat #legend-choropleth-block khusus
  const entry = CATALOG.layers.find(l=>l.id===id);
  const color = cardColor(id);
  if(entry.render_type==='point') return `<div style="width:9px;height:9px;border-radius:50%;background:${color};border:1px solid #fff;"></div>`;
  if(entry.render_type==='line'){
    const dash = entry.style && entry.style.dashArray ? entry.style.dashArray.replace(' ',',') : '0';
    const weight = entry.style ? entry.style.weight*0.8 : 2.5;
    return `<svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="${color}" stroke-width="${weight}" stroke-dasharray="${dash}"/></svg>`;
  }
  if(entry.render_type==='density_grid' || entry.render_type==='choropleth_polygon') return `<div style="width:12px;height:12px;background:${color};opacity:0.7;"></div>`;
  if(entry.render_type==='flow_lines' || entry.render_type==='flow_routed'){
    return `<svg width="26" height="12"><line x1="1" y1="10" x2="10" y2="10" stroke="${color}" stroke-width="1.5" opacity="0.4"/><line x1="10" y1="6" x2="18" y2="6" stroke="${color}" stroke-width="3.5" opacity="0.6"/><line x1="18" y1="2" x2="25" y2="2" stroke="${color}" stroke-width="6" opacity="0.85"/></svg>`;
  }
  return `<svg width="16" height="10"><rect x="1" y="1" width="14" height="8" fill="none" stroke="${color}" stroke-width="1.3" stroke-dasharray="3,2"/></svg>`;
}
function legendBlockFor(id){
  const sym = layerSymbology[id];
  if(!sym) return `<div class="legend-item">${legendSymbol(id)}<span>${cardLabel(id)}</span></div>`;

  const baseColor = cardColor(id);
  if(sym.type === 'numeric'){
    const grad = `linear-gradient(90deg, rgb(205,226,251) 0%, ${baseColor} 100%)`;
    return `<div class="legend-sym-block">
      <div class="legend-sym-title">${cardLabel(id)} <span class="legend-sym-field">(${sym.field})</span></div>
      <div class="gradient-bar" style="background:${grad}"></div>
      <div class="gradient-labels"><span>${sym.meta.min}</span><span>${sym.meta.max}</span></div>
    </div>`;
  }
  const rows = sym.meta.values.map((v,i)=>`<div class="legend-item"><div style="width:9px;height:9px;border-radius:50%;background:${CATEGORICAL_PALETTE[i%CATEGORICAL_PALETTE.length]};"></div><span>${v}</span></div>`).join('');
  return `<div class="legend-sym-block">
    <div class="legend-sym-title">${cardLabel(id)} <span class="legend-sym-field">(${sym.field})</span></div>
    ${rows}
  </div>`;
}
function updateLegend(){
  updateLegendTitle();
  const el = document.getElementById('legend-extra-block');
  const items = activeStack
    .filter(id=>!isFsnId(id))
    .map(id=>legendBlockFor(id));
  el.innerHTML = items.length ? items.join('') : 'Tarik layer ke workspace panel untuk menampilkan di peta &amp; legenda ini.';
}

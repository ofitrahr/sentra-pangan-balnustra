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

const activeStack = [];       // array terurut of layer-id (termasuk id semu FSN)
const activeLayers = {};      // id -> Leaflet layer object (non-FSN)
const layerVisible = {};      // id -> bool
const layerOpacity = {};      // id -> 0..1

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
  const inputContainer = document.getElementById('catalog-input-groups');
  const analysisContainer = document.getElementById('catalog-analysis-groups');
  inputContainer.innerHTML = '';
  analysisContainer.innerHTML = '';

  // -- Data Input: grouped by category --
  const byCat = {};
  CATALOG.layers.filter(l=>l.kind==='input').forEach(l=>{
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

function buildCatalogGroup(label, color, items){
  const details = document.createElement('details');
  details.className = 'cat-group';
  const summary = document.createElement('summary');
  summary.innerHTML = `<span class="catname"><span class="catdot" style="background:${color}"></span>${label}</span>`;
  details.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'cat-body';
  items.forEach(item=>{
    const added = activeStack.includes(item.id);
    const card = document.createElement('div');
    card.className = 'catalog-card' + (added ? ' added' : '');
    card.draggable = !added;
    card.dataset.layerid = item.id;
    const cntTxt = item.count!=null ? ` <span class="cnt">(${item.count})</span>` : '';
    const dlTxt = item.download_url ? ` <a class="dl-link" href="${item.download_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">&#8681;</a>` : '';
    card.innerHTML = `<span class="drag-dot">&#8942;&#8942;</span><span class="card-label">${item.label}${cntTxt}${dlTxt}</span><button class="add-btn" title="Tambah ke peta" ${added?'disabled':''}>+</button>`;
    body.appendChild(card);
  });
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
    const item = document.createElement('div');
    item.className = 'stack-item' + (visible ? '' : ' hidden-layer');
    item.draggable = true;
    item.dataset.layerid = id;
    item.innerHTML = `
      <span class="drag-handle">&#8942;&#8942;</span>
      <span class="stack-dot" style="background:${cardColor(id)}"></span>
      <span class="stack-label">${cardLabel(id)}</span>
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
  });
  attachStackItemHandlers();
}

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
  });
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
  return `<svg width="16" height="10"><rect x="1" y="1" width="14" height="8" fill="none" stroke="${color}" stroke-width="1.3" stroke-dasharray="3,2"/></svg>`;
}
function updateLegend(){
  updateLegendTitle();
  const el = document.getElementById('legend-extra-block');
  const items = activeStack
    .filter(id=>!isFsnId(id))
    .map(id=>`<div class="legend-item">${legendSymbol(id)}<span>${cardLabel(id)}</span></div>`);
  el.innerHTML = items.length ? items.join('') : 'Tarik layer ke workspace panel untuk menampilkan di peta &amp; legenda ini.';
}

// ============================================================
// app.js — WebGIS FSN Padi & Infrastruktur NTT
// Dashboard shell: baca catalog.json, fetch data sesuai kebutuhan (lazy-load),
// render layer sesuai `render_type`-nya. Nambah layer baru = nambah entri di
// catalog.json, TIDAK PERLU ubah file ini (kecuali render_type-nya benar2 baru).
// ============================================================

const STAGE_HEX = {
  produksi_padi: [43,95,90], kapasitas_pengolahan: [78,139,122],
  produksi_beras: [201,150,44], kebutuhan_beras: [176,68,46],
};
const STAGE_LABELS = { produksi_padi:'Produksi Padi', kapasitas_pengolahan:'Kapasitas Pengolahan', produksi_beras:'Produksi Beras', kebutuhan_beras:'Konsumsi (Kebutuhan Beras)' };

const map = L.map('map', {zoomControl:false, minZoom:6}).setView([-8.9, 121.3], 8);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom:19, subdomains:'abcd'
}).addTo(map);

function choroColor(val, min, max, varname){
  const t = max>min ? (val-min)/(max-min) : 0;
  const base = STAGE_HEX[varname] || [176,68,46];
  const r1=240,g1=236,b1=224;
  const r=r1+(base[0]-r1)*t, g=g1+(base[1]-g1)*t, b=b1+(base[2]-b1)*t;
  return `rgb(${r|0},${g|0},${b|0})`;
}

// ---- simple in-memory cache for fetched data (biar tidak fetch ulang) ----
const dataCache = {};
async function loadData(url){
  if(dataCache[url]) return dataCache[url];
  const res = await fetch(url);
  if(!res.ok) throw new Error('Gagal memuat '+url+' ('+res.status+')');
  const json = await res.json();
  dataCache[url] = json;
  return json;
}

// ================= CATALOG BOOTSTRAP =================
let CATALOG = null;

async function boot(){
  CATALOG = await loadData('catalog.json');
  document.getElementById('boot-status').style.display = 'none';
  buildDynamicGroups();
  await initFSN();
}
boot().catch(err=>{
  document.getElementById('boot-status').textContent = 'Gagal memuat catalog.json: ' + err.message;
});

// ================= FSN (drill-down 3 level) =================
let drillLevel = 'kabupaten';
let selKab = null, selKec = null;
let fsnMode = 'glyph';
let choroplethVar = 'produksi_padi';
let showLabels = false;

let polyLayer = L.layerGroup().addTo(map);
let glyphLayerGroup = L.layerGroup().addTo(map);
let labelLayerGroup = L.layerGroup();
let glyphMarkers = {};

let FSN_URLS = null;
let KAB_POINTS = null, KAB_POLYGONS = null;
let KEC_POINTS = null, KEC_BOUNDARY = null;
let DESA_POINTS = null, DESA_BOUNDARY = null;

async function initFSN(){
  const fsnEntry = CATALOG.layers.find(l => l.render_type === 'fsn_drilldown');
  if(!fsnEntry) return;
  FSN_URLS = fsnEntry.urls;
  // hanya muat level kabupaten dulu -- kecamatan & desa di-load saat drill terjadi
  [KAB_POINTS, KAB_POLYGONS] = await Promise.all([
    loadData(FSN_URLS.kabupaten_points), loadData(FSN_URLS.kabupaten_polygons)
  ]);
  renderFSN();
}
async function ensureKecData(){
  if(KEC_POINTS && KEC_BOUNDARY) return;
  [KEC_POINTS, KEC_BOUNDARY] = await Promise.all([
    loadData(FSN_URLS.kecamatan_points), loadData(FSN_URLS.kecamatan_boundary)
  ]);
}
async function ensureDesaData(){
  if(DESA_POINTS && DESA_BOUNDARY) return;
  [DESA_POINTS, DESA_BOUNDARY] = await Promise.all([
    loadData(FSN_URLS.desa_points), loadData(FSN_URLS.desa_boundary)
  ]);
}

function tierBadge(tier){
  const bg = tier==='Unggul' ? '#2B5F5A' : (tier==='Sedang' ? '#B8A97E' : '#c9c2ab');
  return `<span class="popup-badge" style="background:${bg}">${tier}</span>`;
}
function fsnPopupHTML(p, nameField, extraHint){
  return `<div class="popup-title">${p[nameField]}</div>
    <div class="popup-row"><span>Produksi Padi</span><span class="val">${p.produksi_padi.toLocaleString('id-ID')} ton ${tierBadge(p.produksi_padi_tier)}</span></div>
    <div class="popup-row"><span>Kapasitas Pengolahan</span><span class="val">${p.kapasitas_pengolahan.toLocaleString('id-ID')} ton/thn ${tierBadge(p.kapasitas_pengolahan_tier)}</span></div>
    <div class="popup-row"><span>Produksi Beras</span><span class="val">${p.produksi_beras.toLocaleString('id-ID')} ton ${tierBadge(p.produksi_beras_tier)}</span></div>
    <div class="popup-row"><span>Konsumsi</span><span class="val">${p.kebutuhan_beras.toLocaleString('id-ID')} ton/thn ${tierBadge(p.kebutuhan_beras_tier)}</span></div>
    ${p.swasembada!=null ? `<div class="divider"></div><div class="popup-row"><span>Tingkat Swasembada</span><span class="val">${p.swasembada} ${p.swasembada>=1?'(Surplus)':'(Defisit)'}</span></div>` : ''}
    ${extraHint ? `<div class="popup-hint">${extraHint}</div>` : ''}`;
}
function glyphIconHTML(p){
  const cellSize = 11, gap=1;
  const cellStyle = (stage, x, y) => {
    const lit = p[stage+'_tier']==='Unggul';
    const color = lit ? {produksi_padi:'#2B5F5A',kapasitas_pengolahan:'#4E8B7A',produksi_beras:'#C9962C',kebutuhan_beras:'#B0442E'}[stage] : '#e5ddc8';
    const op = lit ? 0.95 : 0.55;
    return `position:absolute; left:${x}px; top:${y}px; width:${cellSize}px; height:${cellSize}px; background:${color}; opacity:${op}; border-radius:2.5px; border:0.5px solid rgba(255,255,255,0.8);`;
  };
  return `<div style="position:relative; width:${cellSize*2+gap}px; height:${cellSize*2+gap}px; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <div style="${cellStyle('produksi_padi',0,0)}"></div><div style="${cellStyle('kapasitas_pengolahan',cellSize+gap,0)}"></div>
    <div style="${cellStyle('produksi_beras',0,cellSize+gap)}"></div><div style="${cellStyle('kebutuhan_beras',cellSize+gap,cellSize+gap)}"></div>
  </div>`;
}
function makeGlyphMarker(p, lat, lon){
  const cellSize=11, gap=1;
  const icon = L.divIcon({ className:'glyph-wrap', html:glyphIconHTML(p), iconSize:[cellSize*2+gap, cellSize*2+gap], iconAnchor:[cellSize+gap/2, cellSize+gap/2] });
  return L.marker([lat, lon], {icon});
}
function kecOf(kab){ return KEC_POINTS.filter(k=>k.kabkot===kab); }
function desaOf(kab, kec){ return DESA_POINTS.filter(d=>d.kabkot===kab && d.kecamatan===kec); }

function updateBreadcrumb(){
  const el = document.getElementById('breadcrumb');
  let html = `<span class="crumb ${drillLevel==='kabupaten'?'current':''}" onclick="window.__goto('kabupaten')">NTT</span>`;
  if(selKab) html += `<span class="sep">&rsaquo;</span><span class="crumb ${drillLevel==='kecamatan'?'current':''}" onclick="window.__goto('kecamatan')">${selKab}</span>`;
  if(selKec) html += `<span class="sep">&rsaquo;</span><span class="crumb current">${selKec}</span>`;
  el.innerHTML = html;
}
window.__goto = function(level){
  if(level==='kabupaten'){ selKab=null; selKec=null; drillLevel='kabupaten'; map.setView([-8.9,121.3],8); renderFSN(); }
  else if(level==='kecamatan'){ selKec=null; drillLevel='kecamatan'; zoomToKab(selKab); renderFSN(); }
};
function zoomToKab(kab){
  const feat = KAB_POLYGONS.features.find(f=>f.properties.nama_kabkot===kab);
  if(feat){ const l = L.geoJSON(feat); map.fitBounds(l.getBounds(), {padding:[40,40]}); }
}
function zoomToKec(kab, kec){
  const feat = KEC_BOUNDARY.features.find(f=>f.properties.nama_kabkot===kab && f.properties.nama_kecamatan===kec);
  if(feat){ const l = L.geoJSON(feat); map.fitBounds(l.getBounds(), {padding:[50,50]}); }
}
function choroStyle(rec){
  let minmax;
  if(drillLevel==='kabupaten') minmax = KAB_POINTS;
  else if(drillLevel==='kecamatan') minmax = kecOf(selKab);
  else minmax = desaOf(selKab, selKec);
  const vals = minmax.map(x=>x[choroplethVar]);
  const min = Math.min(...vals), max = Math.max(...vals);
  return { color:'#1C2B24', weight:0.8, opacity:0.6, fillOpacity:0.78, fillColor: choroColor(rec[choroplethVar], min, max, choroplethVar) };
}
function renderLabels(list, nameField){
  labelLayerGroup.clearLayers();
  list.forEach(p=>{
    const icon = L.divIcon({ className:'kab-label',
      html:`<div style="font-size:10px; font-weight:600; color:#1C2B24; text-shadow:0 1px 2px rgba(255,255,255,0.9), 0 -1px 2px rgba(255,255,255,0.9), 1px 0 2px rgba(255,255,255,0.9), -1px 0 2px rgba(255,255,255,0.9); white-space:nowrap; pointer-events:none;">${p[nameField]}</div>`,
      iconSize:[0,0], iconAnchor:[-8,4] });
    L.marker([p.lat, p.lon], {icon, interactive:false}).addTo(labelLayerGroup);
  });
  if(showLabels && !map.hasLayer(labelLayerGroup)) map.addLayer(labelLayerGroup);
}
function updateLegendTitle(){
  document.getElementById('choropleth-divider').style.display = fsnMode==='choropleth' ? 'block' : 'none';
  document.getElementById('choropleth-picker').style.display = fsnMode==='choropleth' ? 'block' : 'none';
  document.getElementById('legend-glyph-block').style.display = fsnMode==='glyph' ? 'block' : 'none';
  document.getElementById('legend-choropleth-block').style.display = fsnMode==='choropleth' ? 'block' : 'none';
  if(fsnMode==='choropleth'){
    document.getElementById('legend-title').textContent = 'Legenda \u2014 ' + STAGE_LABELS[choroplethVar];
    const stageRgb = STAGE_HEX[choroplethVar];
    document.querySelector('#legend-choropleth-block .gradient-bar').style.background = `linear-gradient(90deg, #F0ECE0 0%, rgb(${stageRgb[0]},${stageRgb[1]},${stageRgb[2]}) 100%)`;
  } else if(fsnMode==='glyph'){
    document.getElementById('legend-title').textContent = 'Legenda \u2014 Glyph 4-Tahap';
  } else {
    document.getElementById('legend-title').textContent = 'Legenda';
  }
}

async function renderFSN(){
  polyLayer.clearLayers(); glyphLayerGroup.clearLayers(); glyphMarkers = {};
  updateBreadcrumb();
  if(fsnMode==='off'){ updateLegendTitle(); return; }

  if(drillLevel==='kabupaten'){
    const gj = L.geoJSON(KAB_POLYGONS, { style: f => fsnMode==='choropleth' ? choroStyle(f.properties) : { color:'#1C2B24', weight:0.8, opacity:0.5, fillOpacity:0.06, fillColor:'#fff' } });
    gj.eachLayer(l=>{
      l.bindTooltip(l.feature.properties.wilayah, {sticky:true});
      l.on('click', async ()=>{ selKab = l.feature.properties.wilayah; drillLevel='kecamatan'; zoomToKab(selKab); await ensureKecData(); renderFSN(); });
    });
    gj.addTo(polyLayer);
    if(fsnMode==='glyph'){
      KAB_POINTS.forEach(p=>{
        const m = makeGlyphMarker(p, p.lat, p.lon);
        m.bindPopup(fsnPopupHTML(p, 'wilayah', 'Klik area kabupaten (bukan glyph) untuk lihat rincian kecamatan &rarr;'));
        m.addTo(glyphLayerGroup); glyphMarkers[p.wilayah] = m;
      });
    }
    renderLabels(KAB_POINTS, 'wilayah');

  } else if(drillLevel==='kecamatan'){
    await ensureKecData();
    const kecList = kecOf(selKab);
    const kecFeatures = KEC_BOUNDARY.features.filter(f=>f.properties.nama_kabkot===selKab);
    const gj = L.geoJSON({type:'FeatureCollection', features:kecFeatures}, {
      style: f => { if(fsnMode!=='choropleth') return { color:'#1C2B24', weight:0.8, opacity:0.55, fillOpacity:0.08, fillColor:'#fff' };
        const rec = kecList.find(k=>k.kecamatan===f.properties.nama_kecamatan);
        return rec ? choroStyle(rec) : { color:'#1C2B24', weight:0.5, opacity:0.3, fillOpacity:0, fillColor:'#fff' }; }
    });
    gj.eachLayer(l=>{
      const rec = kecList.find(k=>k.kecamatan===l.feature.properties.nama_kecamatan);
      l.bindTooltip(l.feature.properties.nama_kecamatan, {sticky:true});
      if(rec) l.on('click', async ()=>{ selKec = rec.kecamatan; drillLevel='desa'; zoomToKec(selKab, selKec); await ensureDesaData(); renderFSN(); });
    });
    gj.addTo(polyLayer);
    if(fsnMode==='glyph'){
      kecList.forEach(p=>{
        const m = makeGlyphMarker(p, p.lat, p.lon);
        m.bindPopup(fsnPopupHTML(p, 'kecamatan', 'Klik area kecamatan (bukan glyph) untuk lihat rincian desa/kelurahan &rarr;'));
        m.addTo(glyphLayerGroup); glyphMarkers[p.kecamatan] = m;
      });
    }
    renderLabels(kecList, 'kecamatan');

  } else if(drillLevel==='desa'){
    await ensureDesaData();
    const desaList = desaOf(selKab, selKec);
    const desaFeatures = DESA_BOUNDARY.features.filter(f=>f.properties.nama_kabkot===selKab && f.properties.nama_kecamatan===selKec);
    const gj = L.geoJSON({type:'FeatureCollection', features:desaFeatures}, {
      style: f => { if(fsnMode!=='choropleth') return { color:'#1C2B24', weight:0.7, opacity:0.5, fillOpacity:0.08, fillColor:'#fff' };
        const rec = desaList.find(d=>d.desa===f.properties.nama_desa);
        return rec ? choroStyle(rec) : { color:'#1C2B24', weight:0.4, opacity:0.3, fillOpacity:0, fillColor:'#fff' }; }
    });
    gj.eachLayer(l=>{
      const rec = desaList.find(d=>d.desa===l.feature.properties.nama_desa);
      l.bindTooltip(l.feature.properties.nama_desa, {sticky:true});
      if(rec) l.bindPopup(fsnPopupHTML(rec, 'desa', null));
    });
    gj.addTo(polyLayer);
    if(fsnMode==='glyph'){
      desaList.forEach(p=>{
        const m = makeGlyphMarker(p, p.lat, p.lon);
        m.bindPopup(fsnPopupHTML(p, 'desa', null));
        m.addTo(glyphLayerGroup); glyphMarkers[p.desa] = m;
      });
    }
    renderLabels(desaList, 'desa');
  }
  updateLegendTitle();
}

document.querySelectorAll('input[name=mode]').forEach(r=> r.addEventListener('change', e=>{ fsnMode = e.target.value; renderFSN(); }));
document.querySelectorAll('input[name=var]').forEach(r=> r.addEventListener('change', e=>{ choroplethVar = e.target.value; renderFSN(); }));
document.getElementById('chk-labels').addEventListener('change', e=>{
  showLabels = e.target.checked;
  if(showLabels) map.addLayer(labelLayerGroup); else map.removeLayer(labelLayerGroup);
});

// ================= GENERIC LAYERS (dibangun dari catalog.json) =================
const activeLayers = {}; // id -> Leaflet layer object (sudah ada di peta)

function popupFromPU(nm, puStr, color){
  let obj = {};
  try{ obj = JSON.parse(puStr); }catch(e){}
  let rows = Object.entries(obj).map(([k,v])=>`<div class="popup-row"><span>${k}</span><span class="val">${v}</span></div>`).join('');
  return `<span class="popup-cat-tag" style="background:${color}">Infrastruktur</span><div class="popup-title">${nm}</div>${rows}`;
}

async function buildAndShowLayer(entry, catColor){
  const gj = await loadData(entry.data_url);
  const color = (entry.style && entry.style.color) || catColor;
  let layer;

  if(entry.render_type === 'density_grid'){
    layer = L.geoJSON(gj, { style: f => ({ stroke:false, fillColor:`rgba(${entry.color_rgb},${(0.15+0.65*Math.min(f.properties.pct_cover/60,1)).toFixed(2)})`, fillOpacity:1 }) });
    layer.eachLayer(l=> l.bindPopup(`<div class="popup-title">${entry.label}</div><div class="popup-row"><span>Estimasi tutupan sel</span><span class="val">${l.feature.properties.pct_cover}%</span></div>`));
  } else if(entry.render_type === 'choropleth_polygon'){
    const vals = gj.features.map(f=>f.properties[entry.value_field]);
    const maxV = Math.max(...vals);
    layer = L.geoJSON(gj, { style: f => ({ color:color, weight:0.3, opacity:0.4, fillColor:color,
      fillOpacity: f.properties[entry.value_field]>0 ? (0.15+0.75*Math.sqrt(f.properties[entry.value_field]/maxV)) : 0 }) });
    layer.eachLayer(l=>{ const p=l.feature.properties;
      l.bindPopup(`<div class="popup-title">${p.nama_desa||p.nama_kecamatan||''}</div><div class="popup-row"><span>${entry.label}</span><span class="val">${p[entry.value_field]}</span></div>`); });
  } else if(entry.render_type === 'point'){
    layer = L.geoJSON(gj, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius:4, fillColor:color, color:'#fff', weight:0.8, fillOpacity:0.85 }) });
    layer.eachLayer(l=>{ const p=l.feature.properties; l.bindPopup(popupFromPU(p.nm, p.pu, color)); });
  } else if(entry.render_type === 'line'){
    const st = entry.style || {};
    layer = L.geoJSON(gj, { style: { color:color, weight:st.weight||2, opacity:st.opacity||0.75, dashArray:st.dashArray||null } });
    layer.eachLayer(l=>{ const p=l.feature.properties; l.bindPopup(popupFromPU(p.nm, p.pu, color)); });
  } else if(entry.render_type === 'polygon'){
    layer = L.geoJSON(gj, { style: { color:color, weight:1.2, opacity:0.8, fillColor:color, fillOpacity:0.08, dashArray:'4 3' } });
    layer.eachLayer(l=>{ const p=l.feature.properties; l.bindPopup(popupFromPU(p.nm, p.pu, color)); });
  } else {
    console.warn('render_type tidak dikenal:', entry.render_type);
    return null;
  }
  layer.addTo(map);
  return layer;
}

function updateExtraLegend(){
  const el = document.getElementById('legend-extra-block');
  const items = Object.keys(activeLayers).map(id=>{
    const entry = CATALOG.layers.find(l=>l.id===id);
    const cat = CATALOG.categories.find(c=>c.id===entry.category);
    const color = (entry.style && entry.style.color) || (cat ? cat.color : '#555');
    let symbol;
    if(entry.render_type==='point') symbol = `<div style="width:9px;height:9px;border-radius:50%;background:${color};border:1px solid #fff;"></div>`;
    else if(entry.render_type==='line'){
      const dash = entry.style && entry.style.dashArray ? entry.style.dashArray.replace(' ',',') : '0';
      symbol = `<svg width="22" height="10"><line x1="1" y1="5" x2="21" y2="5" stroke="${color}" stroke-width="${entry.style?entry.style.weight*0.8:2.5}" stroke-dasharray="${dash}"/></svg>`;
    } else if(entry.render_type==='density_grid' || entry.render_type==='choropleth_polygon'){
      symbol = `<div style="width:12px;height:12px;background:${color};opacity:0.7;"></div>`;
    } else symbol = `<svg width="16" height="10"><rect x="1" y="1" width="14" height="8" fill="none" stroke="${color}" stroke-width="1.3" stroke-dasharray="3,2"/></svg>`;
    return `<div class="legend-item">${symbol}<span>${entry.label}</span></div>`;
  });
  el.innerHTML = items.length ? items.join('') : 'Centang layer di panel kanan untuk menampilkan di peta &amp; legenda ini.';
}

function buildDynamicGroups(){
  const container = document.getElementById('dynamic-groups');
  const byCategory = {};
  CATALOG.layers.forEach(l=>{
    if(l.render_type === 'fsn_drilldown') return; // sudah ditangani terpisah di atas
    (byCategory[l.category] = byCategory[l.category] || []).push(l);
  });

  CATALOG.categories.forEach(cat=>{
    const layers = byCategory[cat.id];
    if(!layers || layers.length===0) return;
    const details = document.createElement('details');
    details.className = 'cat-group';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="catname"><span class="catdot" style="background:${cat.color}"></span>${cat.label}</span><span class="toggle-all" data-cat="${cat.id}">semua/tidak</span>`;
    details.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'cat-body';
    layers.forEach(entry=>{
      const label = document.createElement('label');
      const cntTxt = entry.count!=null ? ` <span class="cnt">(${entry.count})</span>` : '';
      const dlTxt = entry.download_url ? ` <a class="dl-link" href="${entry.download_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">&#8681; unduh asli</a>` : '';
      label.innerHTML = `<input type="checkbox" data-layerid="${entry.id}" ${entry.default_visible?'checked':''}> ${entry.label}${cntTxt}${dlTxt}`;
      body.appendChild(label);
    });
    details.appendChild(body);
    container.appendChild(details);
  });

  container.querySelectorAll('input[type=checkbox]').forEach(chk=>{
    chk.addEventListener('change', async e=>{
      const id = e.target.dataset.layerid;
      const entry = CATALOG.layers.find(l=>l.id===id);
      const cat = CATALOG.categories.find(c=>c.id===entry.category);
      if(e.target.checked){
        const parentLabel = e.target.closest('label');
        const dot = document.createElement('span'); dot.className='loading-dot'; parentLabel.appendChild(dot);
        try{
          activeLayers[id] = await buildAndShowLayer(entry, cat.color);
        } catch(err){
          console.error(err); alert('Gagal memuat layer "'+entry.label+'": '+err.message);
          e.target.checked = false;
        }
        dot.remove();
      } else if(activeLayers[id]){
        map.removeLayer(activeLayers[id]);
        delete activeLayers[id];
      }
      updateExtraLegend();
    });
  });

  container.querySelectorAll('.toggle-all').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const cat = e.target.dataset.cat;
      const boxes = Array.from(container.querySelectorAll('input[type=checkbox]')).filter(b=>CATALOG.layers.find(l=>l.id===b.dataset.layerid).category===cat);
      const anyUnchecked = boxes.some(b=>!b.checked);
      boxes.forEach(b=>{ if(b.checked !== anyUnchecked){ b.checked = anyUnchecked; b.dispatchEvent(new Event('change')); } });
    });
  });
}

// ================= Search (kabupaten/kecamatan/desa) =================
const searchBox = document.getElementById('search-box');
const searchResults = document.getElementById('search-results');
searchBox.addEventListener('input', async e=>{
  const q = e.target.value.trim().toLowerCase();
  searchResults.innerHTML='';
  if(q.length<2 || !KAB_POINTS) return;
  await ensureKecData(); // butuh utk pencarian kecamatan/desa
  let matches = [];
  KAB_POINTS.forEach(p=>{ if(p.wilayah.toLowerCase().includes(q)) matches.push({label:p.wilayah+' (kabupaten)', action: async ()=>{ selKab=p.wilayah; selKec=null; drillLevel='kecamatan'; zoomToKab(selKab); await ensureKecData(); renderFSN(); }}); });
  KEC_POINTS.forEach(p=>{ if(p.kecamatan.toLowerCase().includes(q)) matches.push({label:p.kecamatan+' ('+p.kabkot+')', action: async ()=>{ selKab=p.kabkot; selKec=null; drillLevel='kecamatan'; zoomToKab(selKab); await ensureKecData(); renderFSN(); setTimeout(()=>zoomToKec(selKab,p.kecamatan),300); }}); });
  if(matches.length<15 && DESA_POINTS){
    DESA_POINTS.forEach(p=>{ if(matches.length<15 && p.desa.toLowerCase().includes(q)) matches.push({label:p.desa+' ('+p.kecamatan+', '+p.kabkot+')', action: async ()=>{ selKab=p.kabkot; selKec=p.kecamatan; drillLevel='desa'; zoomToKec(selKab,selKec); await ensureDesaData(); renderFSN(); }}); });
  }
  matches.slice(0,10).forEach(m=>{
    const div = document.createElement('div');
    div.style.cssText='padding:5px 6px;cursor:pointer;border-radius:4px;font-size:11.5px;';
    div.textContent = m.label;
    div.onmouseover=()=>div.style.background='#EFE6D0';
    div.onmouseout=()=>div.style.background='transparent';
    div.onclick=m.action;
    searchResults.appendChild(div);
  });
});

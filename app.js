// ============================================================
// app.js — WebGIS FSN Padi & Infrastruktur NTT
// Dashboard shell: baca catalog.json, fetch data sesuai kebutuhan (lazy-load),
// render layer sesuai `render_type`-nya. Nambah layer baru = nambah entri di
// catalog.json, TIDAK PERLU ubah file ini (kecuali render_type-nya benar2 baru).
// ============================================================

const STAGE_HEX = {
  produksi_padi: [42,120,214], kapasitas_pengolahan: [27,175,122],
  produksi_beras: [237,161,0], kebutuhan_beras: [227,73,72],
};
const STAGE_LABELS = { produksi_padi:'Produksi Padi', kapasitas_pengolahan:'Kapasitas Pengolahan', produksi_beras:'Produksi Beras', kebutuhan_beras:'Konsumsi (Kebutuhan Beras)' };

const map = L.map('map', {zoomControl:false, minZoom:6}).setView([-8.9, 121.3], 8);
L.control.zoom({position:'bottomright'}).addTo(map);
let baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom:19, subdomains:'abcd'
}).addTo(map);
// dipanggil dari toggle tema light/dark di index.html spy basemap ikut ganti
// (voyager terang <-> dark_matter gelap), bukan cuma warna chrome UI-nya.
window.__setBaseTiles = function(url){
  if(baseTileLayer) map.removeLayer(baseTileLayer);
  baseTileLayer = L.tileLayer(url, { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom:19, subdomains:'abcd' }).addTo(map);
  baseTileLayer.bringToBack();
};

function choroColor(val, min, max, varname){
  const t = max>min ? (val-min)/(max-min) : 0;
  const base = STAGE_HEX[varname] || [227,73,72];
  const r1=249,g1=249,b1=247;
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
  await initFSNData();
  initLayersPanel();
}
boot().catch(err=>{
  document.getElementById('boot-status').textContent = 'Gagal memuat catalog.json: ' + err.message;
});

// ================= FSN (drill-down 3 level) =================
let drillLevel = 'kabupaten';
let selKab = null, selKec = null;
let fsnMode = 'off';
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

async function initFSNData(){
  const fsnEntry = CATALOG.layers.find(l => l.render_type === 'fsn_drilldown');
  if(!fsnEntry) return;
  FSN_URLS = fsnEntry.urls;
  // hanya muat level kabupaten dulu -- kecamatan & desa di-load saat drill terjadi
  [KAB_POINTS, KAB_POLYGONS] = await Promise.all([
    loadData(FSN_URLS.kabupaten_points), loadData(FSN_URLS.kabupaten_polygons)
  ]);
  // catatan: TIDAK render di sini -- fsnMode='off' sampai kartu Glyph/Choropleth
  // di-drag ke workspace panel (lihat layers-panel.js addToStack()). initLayersPanel()
  // akan auto-drag kartu yang default_visible:true di catalog.json.
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
  const bg = tier==='Unggul' ? '#2A78D6' : (tier==='Sedang' ? '#8A93A3' : '#c3c2b7');
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
    const color = lit ? {produksi_padi:'#2A78D6',kapasitas_pengolahan:'#1BAF7A',produksi_beras:'#EDA100',kebutuhan_beras:'#E34948'}[stage] : '#dfe3e8';
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

// catatan: kontrol mode Glyph/Choropleth & pilihan variabel choropleth sekarang
// ada di dalam kartu FSN pada workspace-panel (lihat layers-panel.js), bukan
// radio button statis lagi -- fsnMode/choroplethVar diubah dari sana.
document.getElementById('chk-labels').addEventListener('change', e=>{
  showLabels = e.target.checked;
  if(showLabels) map.addLayer(labelLayerGroup); else map.removeLayer(labelLayerGroup);
});

// ================= GENERIC LAYERS (dibangun dari catalog.json) =================
// Registry layer aktif (activeLayers), katalog kiri, workspace-stack panel kanan,
// drag-drop, dan legend sekarang semua ditangani layers-panel.js -- buildAndShowLayer()
// di bawah ini dipanggil dari sana, tidak diubah strukturnya.

function parsePU(puVal){
  // beberapa file (hasil geopandas.to_file GeoJSON) menyimpan "pu" sebagai objek
  // JSON native, bukan string ter-escape seperti konvensi asli -- tangani dua-duanya.
  if(puVal == null) return {};
  if(typeof puVal === 'object') return puVal;
  try{ return JSON.parse(puVal); }catch(e){ return {}; }
}
function popupFromPU(nm, puVal, color){
  const obj = parsePU(puVal);
  // baris pendek (key:value) tampil sejajar; baris panjang (rundown kegiatan,
  // keterangan, dll -- makin umum sejak popup rute/titik survei menyertakan
  // rundown penuh) ditumpuk vertikal spy tdk kepepet/overflow lebar popup.
  let rows = Object.entries(obj).map(([k,v])=>{
    const isLong = typeof v === 'string' && (v.length > 48 || v.includes('<br>'));
    return isLong
      ? `<div class="popup-row popup-row-block"><span>${k}</span><span class="val">${v}</span></div>`
      : `<div class="popup-row"><span>${k}</span><span class="val">${v}</span></div>`;
  }).join('');
  // tombol "Show Rundown" -- cuma muncul kalau fitur py properti "Hari" (skema
  // ruas rute itinerary survei), buka tabel rundown hari tsb di tab terpisah
  // (bukan panel peta) spy bisa dibaca berdampingan & ditutup independen.
  const rundownBtn = obj.Hari
    ? `<button class="popup-rundown-btn" onclick="window.open('rundown.html?hari=${obj.Hari}','_blank')">Show Rundown Hari ${obj.Hari} &rarr;</button>`
    : '';
  return `<span class="popup-cat-tag" style="background:${color}">Infrastruktur</span><div class="popup-title">${nm}</div>${rows}${rundownBtn}`;
}

async function buildAndShowLayer(entry, catColor){
  if(entry.render_type === 'ruler_tool'){
    return activateRulerTool();
  }
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
    // radius/fill_color per-fitur opsional (dibakar saat export, spt pola
    // categorical_fill_polygon) -- layer lain yg tdk py properti ini jalan
    // spt biasa pakai style seragam dari catalog.json.
    layer = L.geoJSON(gj, { pointToLayer: (f, latlng) => L.circleMarker(latlng, {
      radius: f.properties.radius || 4, fillColor: f.properties.fill_color || color,
      color:'#fff', weight:0.8, fillOpacity:0.85 }) });
    layer.eachLayer(l=>{
      const p=l.feature.properties;
      l.bindPopup(popupFromPU(p.nm, p.pu, color));
      // label permanen opsional (bkn hover) -- dikontrol per-layer via catalog.json
      // "show_labels":true, spy tdk membanjiri peta dgn teks utk layer titik besar
      // (Pasar dll) yg tdk memintanya.
      if(entry.show_labels && p.nm){
        l.bindTooltip(p.nm, { permanent:true, direction:'right', offset:[6,0], className:'pt-label-tooltip' });
      }
    });
  } else if(entry.render_type === 'line'){
    const st = entry.style || {};
    const baseStyle = { color:color, weight:st.weight||2, opacity:st.opacity||0.75, dashArray:st.dashArray||null };
    layer = L.geoJSON(gj, { style: baseStyle });
    layer.eachLayer(l=>{
      const p=l.feature.properties;
      l.bindPopup(popupFromPU(p.nm, p.pu, color));
      // highlight hover/klik: klik menyala persist (spy tetap terlihat selagi
      // popup terbuka & dibandingkan dgn ruas lain), hover menyala sementara.
      const glow = { weight:(baseStyle.weight||2)+3, opacity:1 };
      l.on('mouseover', ()=>{ if(!l._selected){ l.setStyle(glow); l.bringToFront(); } });
      l.on('mouseout', ()=>{ if(!l._selected) l.setStyle(baseStyle); });
      l.on('click', ()=>{
        layer.eachLayer(other=>{ other._selected=false; other.setStyle(baseStyle); });
        l._selected = true; l.setStyle(glow); l.bringToFront();
      });
      l.on('popupclose', ()=>{ l._selected=false; l.setStyle(baseStyle); });
    });
  } else if(entry.render_type === 'polygon'){
    // BUGFIX (2026-08-06): sblmnya style di sini di-hardcode total, entry.style
    // di catalog.json (mis. administrasi_* yg minta outline-only tanpa dash)
    // diabaikan sepenuhnya -- semua layer 'polygon' kepaksa dashed+fill sama.
    const st = entry.style || {};
    layer = L.geoJSON(gj, { style: {
      color: st.color || color, weight: st.weight ?? 1.2, opacity: st.opacity ?? 0.8,
      fillColor: st.fillColor || st.color || color, fillOpacity: st.fillOpacity ?? 0.08,
      dashArray: st.dashArray !== undefined ? st.dashArray : '4 3',
    } });
    layer.eachLayer(l=>{ const p=l.feature.properties; l.bindPopup(popupFromPU(p.nm, p.pu, st.color || color)); });
  } else if(entry.render_type === 'categorical_fill_polygon'){
    // Poligon berwarna statis per kategori (properti "fill_color" sdh dibakar
    // saat publish, BUKAN via fitur simbologi interaktif yg dinonaktifkan).
    // Legend kategorinya didefinisikan statis di catalog.json (legend_categories).
    layer = L.geoJSON(gj, { style: f => ({ color:'#3a3a34', weight:1, opacity:0.55,
      fillColor: f.properties.fill_color || color, fillOpacity:0.75 }) });
    layer.eachLayer(l=>{ const p=l.feature.properties; l.bindPopup(popupFromPU(p.nm, p.pu, p.fill_color || color)); });
  } else if(entry.render_type === 'flow_lines' || entry.render_type === 'flow_routed'){
    // Gravity model / desire-line: LineString asal->tujuan, ketebalan & opacity
    // sebanding flow_norm (0-1). Garis putus-putus = bukan rute jalan riil
    // (real_route=false), baik krn lintas pulau (tdk ada jalan darat) maupun
    // krn graph jalan pulau tsb belum berhasil di-fetch -- dibedakan di teks
    // popup, bukan di style (keduanya sama2 "estimasi", beda alasan saja).
    layer = L.geoJSON(gj, { style: f => {
      const t = f.properties.flow_norm || 0;
      return { color: color, weight: 1 + 6*t, opacity: 0.2 + 0.65*t,
        dashArray: f.properties.real_route ? null : '5 4' };
    }});
    layer.eachLayer(l=>{
      const p = l.feature.properties;
      const jarakTxt = p.real_route
        ? `${p.distance_km} km (jaringan jalan)`
        : (p.crosses_water
          ? `${p.distance_km} km (lintas pulau, estimasi jarak lurus)`
          : `${p.distance_km} km (estimasi jarak lurus, rute jalan belum tersedia)`);
      l.bindPopup(`<span class="popup-cat-tag" style="background:${color}">Gravity Model</span>
        <div class="popup-title">${p.origin_nm} &rarr; ${p.dest_nm}</div>
        <div class="popup-row"><span>Jenis tujuan</span><span class="val">${p.dest_type}</span></div>
        <div class="popup-row"><span>Estimasi flow (relatif)</span><span class="val">${(p.flow_norm*100).toFixed(0)}%</span></div>
        <div class="popup-row"><span>Jarak</span><span class="val">${jarakTxt}</span></div>`);
    });
  } else {
    console.warn('render_type tidak dikenal:', entry.render_type);
    return null;
  }
  layer.addTo(map);
  return layer;
}

// ================= Alat Ukur Jarak (Ruler, multi-segmen) =================
// Aktif hanya selagi kartu "Alat Ukur Jarak" ada di workspace-panel (lihat
// activateRulerTool() dipanggil dari buildAndShowLayer(), deactivateRulerTool()
// dipanggil eksplisit dari removeFromStack() di layers-panel.js -- BUKAN lewat
// event 'remove' Leaflet, krn event itu juga terpicu saat toggle visibility
// (mata tersembunyi), yg TIDAK seharusnya menghapus pengukuran, hanya saat
// kartu benar2 ditutup/dikembalikan ke panel kiri sesuai permintaan user).
//
// Model data: rulerTraces[] = segmen yg SUDAH diselesaikan (klik kanan/Enter),
// rulerCurrentPoints[] = titik segmen yg SEDANG digambar. Undo menghapus titik
// dari segmen berjalan; kalau segmen berjalan kosong, undo "membuka lagi"
// segmen terakhir yg sudah selesai (dikeluarkan dari rulerTraces, jadi
// current lagi) -- rantai undo yg konsisten lintas batas segmen.
let rulerLayerGroup = null, rulerActive = false;
let rulerCurrentPoints = [], rulerTraces = [], rulerTraceSeq = 0;
let rulerPreviewLine = null, rulerPreviewLabel = null;

function formatDistance(m){
  if(m < 1000) return Math.round(m) + ' m';
  return (m/1000).toFixed(2) + ' km';
}
function traceLength(points){
  let total = 0;
  for(let i=1;i<points.length;i++) total += map.distance(points[i-1], points[i]);
  return total;
}
// warna beda per segmen (siklus palet kategorikal yg sama dgn dipakai layer
// lain) supaya beberapa pengukuran yg tumpang tindih tetap mudah dibedakan.
function traceColor(idx){ return CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length]; }

function rulerPointIcon(num, color){
  return L.divIcon({ className:'ruler-point-icon',
    html:`<div style="width:20px;height:20px;border-radius:50%;background:${color};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4);border:2px solid #fff;">${num}</div>`,
    iconSize:[20,20], iconAnchor:[10,10] });
}
function rulerSegmentLabel(latlng, text, color){
  return L.marker(latlng, { interactive:false, icon: L.divIcon({ className:'ruler-seg-label',
    html:`<div style="transform:translate(-50%,-50%); background:#fff; border:1px solid ${color}; color:#222; font-size:10px; font-weight:600; padding:1px 6px; border-radius:10px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.15);">${text}</div>`,
    iconSize:[0,0] }) });
}
// traceId null = segmen sedang berjalan (belum ada tombol hapus di badge-nya);
// traceId terisi = segmen selesai, badge dpt tombol ✕ hapus (lewat window.__rulerDeleteTrace,
// pola yg sama dgn window.__goto di breadcrumb -- onclick inline di divIcon HTML).
function rulerTotalBadge(latlng, text, color, traceId){
  const delBtn = traceId!=null ? `<span onclick="window.__rulerDeleteTrace(${traceId})" title="Hapus segmen ini" style="cursor:pointer; margin-left:6px; opacity:0.85;">&times;</span>` : '';
  return L.marker(latlng, { interactive: traceId!=null, icon: L.divIcon({ className:'ruler-total-badge',
    html:`<div style="transform:translate(16px,-10px); background:${color}; color:#fff; font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:10px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.25); pointer-events:auto;">Total: ${text}${delBtn}</div>`,
    iconSize:[0,0] }) });
}

function drawTrace(points, color, traceId){
  points.forEach((pt, i)=>{
    L.marker(pt, { interactive:false, icon: rulerPointIcon(i+1, color) }).addTo(rulerLayerGroup);
    if(i>0){
      const prev = points[i-1];
      L.polyline([prev, pt], { color, weight:3, opacity:0.85, dashArray: traceId==null ? '2 6' : null }).addTo(rulerLayerGroup);
      const mid = L.latLng((prev.lat+pt.lat)/2, (prev.lng+pt.lng)/2);
      rulerSegmentLabel(mid, formatDistance(map.distance(prev, pt)), color).addTo(rulerLayerGroup);
    }
  });
  const total = traceLength(points);
  if(points.length > 1){
    rulerTotalBadge(points[points.length-1], formatDistance(total), color, traceId).addTo(rulerLayerGroup);
  }
  return total;
}

function renderRuler(){
  if(!rulerLayerGroup) return;
  rulerLayerGroup.clearLayers();
  rulerPreviewLine = null; rulerPreviewLabel = null;

  rulerTraces.forEach((t, i)=> drawTrace(t.points, traceColor(i), t.id));
  const currentColor = traceColor(rulerTraces.length);
  if(rulerCurrentPoints.length) drawTrace(rulerCurrentPoints, currentColor, null);

  const statusEl = document.getElementById('ruler-current-status');
  if(statusEl) statusEl.textContent = rulerCurrentPoints.length===0 ? 'Klik di peta utk mulai segmen baru.'
    : (rulerCurrentPoints.length===1 ? 'Klik titik berikutnya…' : `${formatDistance(traceLength(rulerCurrentPoints))} (${rulerCurrentPoints.length} titik) — klik kanan/Enter utk selesai`);

  const undoBtn = document.querySelector('.ruler-undo-btn');
  if(undoBtn) undoBtn.disabled = rulerCurrentPoints.length===0 && rulerTraces.length===0;
  const finishBtn = document.querySelector('.ruler-finish-btn');
  if(finishBtn) finishBtn.disabled = rulerCurrentPoints.length < 2;
  const clearBtn = document.querySelector('.ruler-clear-btn');
  if(clearBtn) clearBtn.disabled = rulerCurrentPoints.length===0 && rulerTraces.length===0;

  const listEl = document.getElementById('ruler-trace-list');
  if(listEl){
    listEl.innerHTML = rulerTraces.length ? rulerTraces.map((t,i)=>
      `<div class="ruler-trace-row"><span class="ruler-trace-dot" style="background:${traceColor(i)}"></span><span class="ruler-trace-label">Segmen ${i+1}: ${formatDistance(traceLength(t.points))}</span><button class="ruler-trace-del" onclick="window.__rulerDeleteTrace(${t.id})" title="Hapus segmen ini">&times;</button></div>`
    ).join('') : '<div class="ruler-trace-empty">Belum ada segmen selesai.</div>';
  }
  const grandTotalEl = document.getElementById('ruler-grand-total-val');
  if(grandTotalEl){
    const grand = rulerTraces.reduce((s,t)=>s+traceLength(t.points),0) + traceLength(rulerCurrentPoints);
    grandTotalEl.textContent = formatDistance(grand);
  }
}

// Klik & klik-kanan ditangkap di level DOM (capture phase) pada container
// peta, BUKAN via map.on('click'/'contextmenu', ...). Alasan: layer lain yg
// interaktif (mis. poligon FSN kabupaten/kecamatan dgn drill-down, atau layer
// manapun yg bindPopup) sudah menghentikan propagasi klik ke Leaflet map
// click event begitu klik jatuh di atas fitur tsb -- akibatnya ruler tidak
// akan pernah dapat klik yg jatuh di atas layer lain. Capture phase
// memastikan ruler SELALU dapat klik duluan, apa pun yg ada di bawahnya,
// kecuali tombol kontrol Leaflet (zoom dll) yg sengaja dilewatkan.
function onRulerDomClick(domEvent){
  if(domEvent.target.closest('.leaflet-control')) return;
  domEvent.stopPropagation();
  rulerCurrentPoints.push(map.mouseEventToLatLng(domEvent));
  renderRuler();
}
function onRulerDomContextMenu(domEvent){
  if(domEvent.target.closest('.leaflet-control')) return;
  domEvent.preventDefault(); // cegah context menu browser
  domEvent.stopPropagation();
  finalizeCurrentTrace();
}
function onRulerDomMouseMove(domEvent){
  if(!rulerCurrentPoints.length || !rulerLayerGroup) return;
  if(domEvent.target.closest('.leaflet-control')) return;
  const latlng = map.mouseEventToLatLng(domEvent);
  const last = rulerCurrentPoints[rulerCurrentPoints.length-1];
  const color = traceColor(rulerTraces.length);
  if(rulerPreviewLine){ rulerLayerGroup.removeLayer(rulerPreviewLine); }
  if(rulerPreviewLabel){ rulerLayerGroup.removeLayer(rulerPreviewLabel); }
  rulerPreviewLine = L.polyline([last, latlng], { color, weight:2, opacity:0.5, dashArray:'4 4', interactive:false }).addTo(rulerLayerGroup);
  rulerPreviewLabel = rulerSegmentLabel(latlng, formatDistance(map.distance(last, latlng)), color).addTo(rulerLayerGroup);
}
function onRulerKeydown(e){
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if(tag==='INPUT' || tag==='TEXTAREA') return; // jangan ganggu ketikan normal (mis. search box)
  if(e.key === 'Backspace'){ e.preventDefault(); rulerUndo(); }
  else if(e.key === 'Escape'){ rulerCancelCurrent(); }
  else if(e.key === 'Enter'){ finalizeCurrentTrace(); } // alternatif klik-kanan (lbh nyaman utk trackpad)
}

function finalizeCurrentTrace(){
  if(rulerCurrentPoints.length >= 2){
    rulerTraces.push({ id: ++rulerTraceSeq, points: rulerCurrentPoints });
  }
  rulerCurrentPoints = [];
  renderRuler();
}
function rulerUndo(){
  if(rulerCurrentPoints.length){
    rulerCurrentPoints.pop();
  } else if(rulerTraces.length){
    rulerCurrentPoints = rulerTraces.pop().points; // buka lagi segmen terakhir utk diedit
  } else {
    return;
  }
  renderRuler();
}
function rulerCancelCurrent(){ rulerCurrentPoints = []; renderRuler(); } // Esc: batalkan segmen yg sedang dibuat saja
function rulerClearAll(){ rulerTraces = []; rulerCurrentPoints = []; renderRuler(); } // tombol "Hapus Semua"
function rulerDeleteTrace(id){ rulerTraces = rulerTraces.filter(t=>t.id!==id); renderRuler(); }
window.__rulerDeleteTrace = rulerDeleteTrace; // dipanggil dari onclick inline di badge peta & daftar panel

function activateRulerTool(){
  rulerCurrentPoints = []; rulerTraces = []; rulerTraceSeq = 0;
  rulerActive = true;
  rulerLayerGroup = L.layerGroup();
  const container = map.getContainer();
  container.addEventListener('click', onRulerDomClick, true);
  container.addEventListener('contextmenu', onRulerDomContextMenu, true);
  container.addEventListener('mousemove', onRulerDomMouseMove, true);
  document.addEventListener('keydown', onRulerKeydown);
  map.doubleClickZoom.disable(); // cegah klik ganda nambah titik sekaligus zoom peta
  container.style.cursor = 'crosshair';
  return rulerLayerGroup.addTo(map);
}
function deactivateRulerTool(){
  if(!rulerActive) return;
  rulerActive = false;
  const container = map.getContainer();
  container.removeEventListener('click', onRulerDomClick, true);
  container.removeEventListener('contextmenu', onRulerDomContextMenu, true);
  container.removeEventListener('mousemove', onRulerDomMouseMove, true);
  document.removeEventListener('keydown', onRulerKeydown);
  map.doubleClickZoom.enable();
  container.style.cursor = '';
  rulerCurrentPoints = []; rulerTraces = [];
  rulerPreviewLine = null; rulerPreviewLabel = null;
  if(rulerLayerGroup){ rulerLayerGroup.clearLayers(); }
}

// ================= Search (kabupaten/kecamatan/desa) =================
const searchBox = document.getElementById('search-box');
const searchResults = document.getElementById('search-results');
searchBox.addEventListener('input', async e=>{
  const q = e.target.value.trim().toLowerCase();
  searchResults.innerHTML='';
  if(q.length<2) return;

  // -- cari layer (data input / hasil analisis, termasuk 2 kartu FSN) --
  let layerMatches = [];
  CATALOG.layers.forEach(l=>{
    if(l.render_type==='fsn_drilldown') return; // diwakili oleh 2 pseudo-card di bawah
    if(l.label.toLowerCase().includes(q)) layerMatches.push({ tag:'layer', label:l.label, action: ()=> addToStack(l.id) });
  });
  [FSN_GLYPH_ID, FSN_CHOROPLETH_ID].forEach(id=>{
    if(cardLabel(id).toLowerCase().includes(q)) layerMatches.push({ tag:'layer', label:cardLabel(id), action: ()=> addToStack(id) });
  });

  // -- cari lokasi (kabupaten/kecamatan/desa) --
  let locMatches = [];
  if(KAB_POINTS){
    await ensureKecData();
    KAB_POINTS.forEach(p=>{ if(p.wilayah.toLowerCase().includes(q)) locMatches.push({tag:'lokasi', label:p.wilayah+' (kabupaten)', action: async ()=>{ selKab=p.wilayah; selKec=null; drillLevel='kecamatan'; zoomToKab(selKab); await ensureKecData(); renderFSN(); }}); });
    KEC_POINTS.forEach(p=>{ if(p.kecamatan.toLowerCase().includes(q)) locMatches.push({tag:'lokasi', label:p.kecamatan+' ('+p.kabkot+')', action: async ()=>{ selKab=p.kabkot; selKec=null; drillLevel='kecamatan'; zoomToKab(selKab); await ensureKecData(); renderFSN(); setTimeout(()=>zoomToKec(selKab,p.kecamatan),300); }}); });
    if(locMatches.length<12 && DESA_POINTS){
      DESA_POINTS.forEach(p=>{ if(locMatches.length<12 && p.desa.toLowerCase().includes(q)) locMatches.push({tag:'lokasi', label:p.desa+' ('+p.kecamatan+', '+p.kabkot+')', action: async ()=>{ selKab=p.kabkot; selKec=p.kecamatan; drillLevel='desa'; zoomToKec(selKab,selKec); await ensureDesaData(); renderFSN(); }}); });
    }
  }

  const matches = [...layerMatches.slice(0,8), ...locMatches.slice(0,8)];
  if(!matches.length){
    searchResults.innerHTML = '<div class="search-empty">Tidak ada layer/lokasi yang cocok.</div>';
    return;
  }
  matches.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<span class="search-tag ${m.tag}">${m.tag==='layer'?'layer':'lokasi'}</span><span>${m.label}</span>`;
    div.onclick = ()=>{ m.action(); searchBox.value=''; searchResults.innerHTML=''; };
    searchResults.appendChild(div);
  });
});

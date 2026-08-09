// ============================================================
// layout.js — "Layout Peta": mode print-composer di atas peta interaktif.
// Ambil snapshot #map (html2canvas), taruh di board 1600x1132 (~A3 landscape
// @96dpi), user tambah & geser elemen (judul, legend, skala, dst), lalu
// export seluruh board jadi 1 file JPG (html2canvas lagi, kali ini atas
// #layout-board yg isinya sudah murni gambar+HTML, bukan Leaflet live).
//
// Ketergantungan eksternal baru: html2canvas (CDN) -- satu-satunya cara
// praktis rasterize tile basemap (gambar cross-origin) + layer vektor
// Leaflet jadi 1 gambar statis. Tile CARTO yg dipakai project ini sudah
// CORS-friendly (dicek manual sblm milih pendekatan ini), makanya tileLayer
// di app.js ditambah `crossOrigin:true` spy html2canvas bisa baca kanvasnya.
// ============================================================
(function(){
  const overlay = document.getElementById('layout-overlay');
  const board = document.getElementById('layout-board');
  const btnOpen = document.getElementById('btn-layout-peta');
  let selected = null;

  btnOpen.addEventListener('click', openLayout);
  document.getElementById('lo-close').addEventListener('click', closeLayout);
  document.getElementById('lo-recapture').addEventListener('click', captureMapIntoBoard);
  document.getElementById('lo-export').addEventListener('click', exportLayout);
  document.getElementById('lo-add-title').addEventListener('click', ()=> addTextElement('lo-title-box', 'Judul Peta', 40, 20));
  document.getElementById('lo-add-subtitle').addEventListener('click', ()=> addTextElement('lo-subtitle-box', 'Subjudul / keterangan singkat', 40, 68));
  document.getElementById('lo-add-kop').addEventListener('click', ()=> addTextElement('lo-kop-box', 'KEMENTERIAN PEKERJAAN UMUM\nBPIW WILAYAH II', 660, 20));
  document.getElementById('lo-add-source').addEventListener('click', ()=> addTextElement('lo-source-box', 'Sumber: WebGIS Sentra Pangan Balnustra -- diolah dari data BIG, KKP, BPS, dan Kementerian PU.', 40, 1095));
  document.getElementById('lo-add-legend').addEventListener('click', addLegendElement);
  document.getElementById('lo-add-scalebar').addEventListener('click', addScaleBarElement);
  document.getElementById('lo-add-northarrow').addEventListener('click', addNorthArrowElement);
  document.getElementById('lo-add-inset').addEventListener('click', addInsetMapElement);

  board.addEventListener('pointerdown', (e)=>{
    if(e.target === board) deselectAll();
  });

  function openLayout(){
    overlay.classList.add('active');
    if(!board.querySelector('.lo-map-frame')){
      captureMapIntoBoard();
    }
  }
  function closeLayout(){
    overlay.classList.remove('active');
  }

  // ---------------- capture peta ----------------
  async function captureMapIntoBoard(){
    const existingFrame = board.querySelector('.lo-map-frame');
    const frameRect = existingFrame ? {
      left: existingFrame.style.left, top: existingFrame.style.top,
      width: existingFrame.style.width, height: existingFrame.style.height,
    } : { left:'40px', top:'110px', width:'1520px', height:'970px' };

    const loading = document.createElement('div');
    loading.className = 'lo-loading';
    loading.textContent = 'Mengambil snapshot peta...';
    board.appendChild(loading);

    try{
      const mapEl = document.getElementById('map');
      const canvas = await html2canvas(mapEl, { useCORS:true, allowTaint:false, logging:false, backgroundColor:'#EAF0F5' });
      const dataUrl = canvas.toDataURL('image/png');

      if(existingFrame) existingFrame.remove();
      const frame = document.createElement('div');
      frame.className = 'lo-element lo-map-frame';
      frame.style.left = frameRect.left; frame.style.top = frameRect.top;
      frame.style.width = frameRect.width; frame.style.height = frameRect.height;
      frame.style.zIndex = 1;
      const img = document.createElement('img');
      img.src = dataUrl;
      frame.appendChild(img);
      board.insertBefore(frame, board.firstChild);
      makeInteractive(frame, {resizable:true});
    }catch(err){
      alert('Gagal mengambil snapshot peta: ' + err.message + '\n\nKemungkinan ada tile/layer yang gagal di-load lintas-domain (CORS). Coba lagi, atau tutup layer yang barusan ditambahkan.');
      console.error(err);
    }
    loading.remove();
  }

  // ---------------- elemen: teks bebas ----------------
  function addTextElement(cls, text, x, y){
    const el = document.createElement('div');
    el.className = 'lo-element ' + cls;
    el.style.left = x+'px'; el.style.top = y+'px'; el.style.zIndex = 10;
    const inner = document.createElement('div');
    inner.className = 'lo-textbox';
    inner.contentEditable = 'true';
    inner.textContent = text;
    el.appendChild(inner);
    board.appendChild(el);
    makeInteractive(el);
    return el;
  }

  // ---------------- elemen: legend (kloning legend live) ----------------
  function addLegendElement(){
    const live = document.getElementById('legend');
    const el = document.createElement('div');
    el.className = 'lo-element lo-legend-box';
    el.style.left = '1330px'; el.style.top = '110px'; el.style.zIndex = 10;
    el.innerHTML = live.innerHTML;
    board.appendChild(el);
    makeInteractive(el, {resizable:true});
  }

  // ---------------- elemen: skala batang ----------------
  function addScaleBarElement(){
    const { niceMeters, label } = computeNiceScale();
    const el = document.createElement('div');
    el.className = 'lo-element lo-scalebar-box';
    el.style.left = '60px'; el.style.top = '1040px'; el.style.zIndex = 10;
    el.dataset.niceMeters = niceMeters;
    el.innerHTML = `<div class="lo-scalebar-bar">${'<div></div>'.repeat(4)}</div><div class="lo-scalebar-label"><span>0</span><span>${label}</span></div>`;
    board.appendChild(el);
    makeInteractive(el);
  }
  function computeNiceScale(){
    // rumus standar Leaflet L.Control.Scale: meter/pixel di lat tengah peta saat ini
    const zoom = map.getZoom();
    const lat = map.getCenter().lat;
    const metersPerPixel = 156543.03392 * Math.cos(lat*Math.PI/180) / Math.pow(2, zoom);
    const barPixelWidth = 200; // lebar bar di board (px)
    const rawMeters = metersPerPixel * barPixelWidth;
    const niceValues = [10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000,20000,25000,50000,100000,200000,250000,500000,1000000,2000000];
    const niceMeters = niceValues.reduce((a,b)=> Math.abs(b-rawMeters)<Math.abs(a-rawMeters) ? b : a);
    const label = niceMeters >= 1000 ? (niceMeters/1000)+' km' : niceMeters+' m';
    return { niceMeters, label };
  }

  // ---------------- elemen: arah utara ----------------
  function addNorthArrowElement(){
    const el = document.createElement('div');
    el.className = 'lo-element lo-north-box';
    el.style.left = '1500px'; el.style.top = '110px'; el.style.zIndex = 10;
    el.innerHTML = '&#8593;<div class="lo-n-letter">U</div>';
    board.appendChild(el);
    makeInteractive(el);
  }

  // ---------------- elemen: peta inset ----------------
  function addInsetMapElement(){
    const el = document.createElement('div');
    el.className = 'lo-element lo-inset-frame';
    el.style.left = '60px'; el.style.top = '110px'; el.style.width = '220px'; el.style.height = '220px'; el.style.zIndex = 10;
    const mapDiv = document.createElement('div');
    mapDiv.className = 'lo-inset-map';
    el.appendChild(mapDiv);
    board.appendChild(el);
    makeInteractive(el, {resizable:true});

    const bounds = map.getBounds();
    const insetMap = L.map(mapDiv, { zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { crossOrigin:true, subdomains:'abcd' }).addTo(insetMap);
    L.rectangle(bounds, { color:'#D03B3B', weight:2, fillOpacity:0.12 }).addTo(insetMap);
    insetMap.fitBounds([[-11.5,113.5],[-7.5,125.5]]); // konteks kasar Bali-Nusra
    setTimeout(()=> insetMap.invalidateSize(), 150);
  }

  // ---------------- interaksi umum: drag, resize, select, hapus ----------------
  function makeInteractive(el, opts){
    opts = opts || {};

    const toolbar = document.createElement('div');
    toolbar.className = 'lo-element-toolbar';
    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.title = 'Hapus elemen';
    delBtn.addEventListener('pointerdown', (e)=> e.stopPropagation());
    delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if(el===selected) selected=null; el.remove(); });
    toolbar.appendChild(delBtn);
    el.appendChild(toolbar);

    let dragging = false, startX=0, startY=0, origLeft=0, origTop=0;
    el.addEventListener('pointerdown', (e)=>{
      if(e.target.closest('.lo-element-toolbar') || e.target.classList.contains('lo-resize-handle') || e.target.isContentEditable) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      origLeft = el.offsetLeft; origTop = el.offsetTop;
      el.setPointerCapture(e.pointerId);
      select(el);
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e)=>{
      if(!dragging) return;
      el.style.left = (origLeft + (e.clientX - startX)) + 'px';
      el.style.top = (origTop + (e.clientY - startY)) + 'px';
    });
    el.addEventListener('pointerup', ()=>{ dragging = false; });
    el.addEventListener('click', (e)=> e.stopPropagation());

    if(opts.resizable){
      const handle = document.createElement('div');
      handle.className = 'lo-resize-handle';
      el.appendChild(handle);
      let resizing = false, startW=0, startH=0;
      handle.addEventListener('pointerdown', (e)=>{
        e.stopPropagation();
        resizing = true;
        startX = e.clientX; startY = e.clientY;
        startW = el.offsetWidth; startH = el.offsetHeight;
        handle.setPointerCapture(e.pointerId);
        select(el);
      });
      handle.addEventListener('pointermove', (e)=>{
        if(!resizing) return;
        el.style.width = Math.max(60, startW + (e.clientX - startX)) + 'px';
        el.style.height = Math.max(30, startH + (e.clientY - startY)) + 'px';
      });
      handle.addEventListener('pointerup', ()=>{ resizing = false; });
    }
  }
  function select(el){
    deselectAll();
    selected = el;
    el.classList.add('selected');
  }
  function deselectAll(){
    if(selected) selected.classList.remove('selected');
    selected = null;
  }

  // ---------------- export ----------------
  async function exportLayout(){
    deselectAll();
    const toolbars = board.querySelectorAll('.lo-element-toolbar, .lo-resize-handle');
    toolbars.forEach(x=> x.style.visibility = 'hidden');
    try{
      const canvas = await html2canvas(board, { useCORS:true, scale:2, logging:false, backgroundColor:'#ffffff' });
      canvas.toBlob((blob)=>{
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'layout-peta-' + new Date().toISOString().slice(0,10) + '.jpg';
        a.click();
        setTimeout(()=> URL.revokeObjectURL(a.href), 4000);
      }, 'image/jpeg', 0.92);
    }catch(err){
      alert('Gagal export: ' + err.message);
      console.error(err);
    }
    toolbars.forEach(x=> x.style.visibility = '');
  }
})();

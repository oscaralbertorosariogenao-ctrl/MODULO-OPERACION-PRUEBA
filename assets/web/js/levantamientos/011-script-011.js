
/* ==========================================================
   LOTEKA · FIX DEFINITIVO FOTOS BACKEND_CERO EN LEVANTAMIENTOS
   - Trabaja sobre el HTML funcional sin cambiar diseño/base.
   - Busca fotos en buckets: levantamientos y levatamientos.
   - Rutas soportadas: agencia/LEV-x, agencia/id, agencia/sb-id.
   - Muestra fotos en el formulario/detalle y permite ampliarlas.
   - Evita que el overlay "Actualizando" se quede pegado.
   ========================================================== */
(function(){
  const BUCKETS = ['levantamientos','levatamientos'];
  const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i;
  const PHOTO_CACHE = new Map();
  const MAX_AUTO_MS = 8500;

  const LABEL_ALIASES = [
    ['Caja registradora / Gaveta', ['caja registradora gaveta','caja registradora','gaveta','caja-registradora-gaveta','caja_registradora_gaveta']],
    ['Puerta enrollable / Eléctrica', ['puerta enrollable electrica','puerta enrollable','puerta electrica','puerta eléctrica','puerta-enrollable-electrica']],
    ['Pintura / Filtraciones', ['pintura filtraciones','pintura','filtracion','filtraciones']],
    ['Hierros / Cristales', ['hierros cristales','hierro','hierros','cristal','cristales']],
    ['Publicidades', ['publicidad','publicidades']],
    ['Taburete', ['taburete','taburetes']],
    ['Abanico', ['abanico','abanicos']],
    ['Toldo', ['toldo','toldos']],
    ['Pecho', ['pecho']],
    ['Piso', ['piso']],
    ['Cables de la calle', ['cables de la calle','cables-calle','cable calle']],
    ['Estructura eléctrica', ['estructura electrica','estructura eléctrica','estructura-electrica']],
    ['Conectores', ['conectores','conector']],
    ['Fuentes y cables de equipos', ['fuentes cables equipos','fuentes-y-cables','fuentes','cables equipos']],
    ['Luces', ['luces','luz']],
    ['Inversor', ['inversor','inverter']],
    ['Baterías', ['bateria','baterias','batería','baterías']],
    ['Printer', ['printer','impresora']],
    ['Scanner', ['scanner','escaner','escáner']],
    ['Máquina de venta', ['maquina de venta','máquina de venta','maquina','terminal']],
    ['2da pantalla', ['2da pantalla','segunda pantalla','2da-pantalla']],
    ['Pantalla ATM', ['pantalla atm','atm']]
  ];

  function txt(v){ return String(v ?? '').trim(); }
  function esc(v){ return txt(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function strip(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function slug(v){ return strip(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function digits(v){ const d = txt(v).match(/\d+/g); return d ? d.join('') : ''; }
  function unique(arr){ return [...new Set((arr || []).map(txt).filter(Boolean))]; }
  function encodePath(path){ return txt(path).split('/').map(encodeURIComponent).join('/'); }

  function getBase(){
    const cfg = (typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) ? ltkBridgeConfig : {};
    return txt(cfg.backendCeroUrl || (typeof LTK_DEFAULT_BACKEND_CERO_URL !== 'undefined' ? LTK_DEFAULT_BACKEND_CERO_URL : '')).replace(/\/$/, '');
  }
  function getKey(){
    const cfg = (typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) ? ltkBridgeConfig : {};
    return txt(cfg.anonKey || (typeof LTK_DEFAULT_BACKEND_CERO_ANON_KEY !== 'undefined' ? LTK_DEFAULT_BACKEND_CERO_ANON_KEY : ''));
  }
  function publicUrl(bucket, path){ return `${getBase()}/archivos/v1/object/public/${bucket}/${encodePath(path)}`; }

  function normalizeLevCode(v){
    const raw = txt(v);
    if(!raw) return '';
    const m = raw.match(/LEV[-_\s]*(\d+)/i);
    if(m) return `LEV-${Number(m[1])}`;
    const d = digits(raw);
    if(d) return `LEV-${Number(d)}`;
    return raw.toUpperCase();
  }

  function getAgencyCandidates(record){
    const raw = record?.raw || {};
    const values = [record?.agency, record?.agencia, record?.codigo_agencia, record?.agencyCode, raw.codigo_agencia, raw.agencia, raw.agency, raw.numero_agencia, raw.numero, raw.go];
    const out = [];
    values.forEach(v => {
      const clean = txt(v);
      const d = digits(clean);
      if(clean) out.push(clean);
      if(d){ out.push(String(Number(d))); out.push(d); out.push(d.padStart(4,'0')); }
    });
    return unique(out);
  }

  function getLevCodeCandidates(record){
    const raw = record?.raw || {};
    const values = [record?.code, record?.codigo, raw.codigo, raw.code, raw.levantamiento, raw.codigo_levantamiento, raw.lev, record?.id, raw.id];
    const out = [];
    values.forEach(v => {
      const clean = txt(v);
      if(!clean) return;
      out.push(clean);
      out.push(normalizeLevCode(clean));
      const noSb = clean.replace(/^sb[-_]?/i,'');
      if(noSb !== clean){ out.push(noSb); out.push(normalizeLevCode(noSb)); }
      const d = digits(clean);
      if(d){ out.push(`LEV-${Number(d)}`); out.push(String(Number(d))); out.push(d); }
    });
    return unique(out);
  }

  function guessLabelFromName(name){
    const s = slug(txt(name).replace(IMG_RE,''));
    let best = '';
    let bestScore = 0;
    LABEL_ALIASES.forEach(([label, aliases]) => {
      aliases.forEach(a => {
        const aa = slug(a);
        let score = 0;
        if(s === aa) score = 100;
        else if(s.startsWith(aa + ' ') || s.startsWith(aa + '-')) score = 80;
        else if(s.includes(aa)) score = Math.min(70, aa.length);
        if(score > bestScore){ bestScore = score; best = label; }
      });
    });
    return best || txt(name).replace(IMG_RE,'').replace(/[-_]+/g,' ');
  }

  function photoFromAny(value, fallbackLabel=''){
    if(!value) return null;
    if(typeof value === 'string'){
      let v = txt(value);
      if(!v) return null;
      try { if(/^[\[{]/.test(v)) return null; } catch(e){}
      if(/^https?:\/\//i.test(v)) return { url:v, label:fallbackLabel || guessLabelFromName(v.split('/').pop() || v), source:'row' };
      if(IMG_RE.test(v)) return { url: v.includes('/') ? publicUrl(BUCKETS[0], v) : '', path:v, label:fallbackLabel || guessLabelFromName(v), source:'row' };
      return null;
    }
    if(typeof value === 'object'){
      const url = txt(value.url || value.href || value.link || value.publicUrl || value.public_url || value.signedUrl || value.signed_url || value.path || value.name || value.filename || value.fileName);
      if(!url) return null;
      const label = txt(value.label || value.title || value.name || value.filename || value.fileName || fallbackLabel || guessLabelFromName(url.split('/').pop() || url));
      if(/^https?:\/\//i.test(url)) return { url, label, source:'row' };
      if(IMG_RE.test(url)) return { url: publicUrl(BUCKETS[0], url), path:url, label, source:'row' };
    }
    return null;
  }

  function photosFromRow(row){
    const photos = [];
    const keys = ['fotos','fotos_json','photos','imagenes','imágenes','evidencias','gallery','archivos','attachments','files'];
    keys.forEach(k => {
      const val = row?.[k];
      if(!val) return;
      try{
        const arr = Array.isArray(val) ? val : (typeof val === 'string' && /^[\[{]/.test(val.trim()) ? JSON.parse(val) : [val]);
        arr.forEach(x => { const p = photoFromAny(x); if(p?.url) photos.push(p); });
      }catch(e){ const p = photoFromAny(val); if(p?.url) photos.push(p); }
    });
    Object.keys(row || {}).forEach(k => {
      if(/foto|photo|imagen|image|evidencia|archivo/i.test(k) && row[k]){
        const p = photoFromAny(row[k], guessLabelFromName(k));
        if(p?.url) photos.push(p);
      }
    });
    return dedupe(photos);
  }

  function dedupe(list){
    const map = new Map();
    (list || []).forEach(p => {
      if(!p || !p.url) return;
      const key = p.url;
      if(!map.has(key)) map.set(key, p);
    });
    return [...map.values()];
  }

  async function listarchivos(bucket, prefix){
    const base = getBase(), key = getKey();
    if(!base || !key || !bucket || !prefix) return [];
    const cacheKey = `${bucket}|${prefix}`;
    if(PHOTO_CACHE.has(cacheKey)) return PHOTO_CACHE.get(cacheKey);
    let photos = [];
    try{
      const res = await fetch(`${base}/archivos/v1/object/list/${encodeURIComponent(bucket)}`, {
        method:'POST',
        headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ prefix: prefix.replace(/\/$/,''), limit:200, offset:0, sortBy:{ column:'name', order:'asc' } })
      });
      if(res.ok){
        const rows = await res.json();
        photos = (rows || []).filter(x => x && x.name && IMG_RE.test(x.name)).map(x => {
          const path = `${prefix.replace(/\/$/,'')}/${x.name}`;
          return { label: guessLabelFromName(x.name), url: publicUrl(bucket, path), path, bucket, fileName:x.name, source:'archivos' };
        });
      }
    }catch(e){ console.warn('No se pudo leer archivos', bucket, prefix, e); }
    PHOTO_CACHE.set(cacheKey, photos);
    return photos;
  }

  async function findarchivosPhotos(record){
    const agencies = getAgencyCandidates(record);
    const levs = getLevCodeCandidates(record);
    const prefixes = [];
    agencies.forEach(a => levs.forEach(l => prefixes.push(`${a}/${l}`)));
    const output = [];
    for(const bucket of BUCKETS){
      for(const prefix of unique(prefixes)){
        const got = await listarchivos(bucket, prefix);
        if(got.length) output.push(...got);
      }
      if(output.length) break;
    }
    return dedupe(output);
  }

  function matchPhoto(gallery, label){
    const target = slug(label);
    if(!target) return '';
    let best = null, bestScore = 0;
    (gallery || []).forEach(p => {
      const hay = slug(`${p.label || ''} ${p.fileName || ''} ${p.path || ''}`);
      let score = 0;
      if(hay === target) score = 100;
      else if(hay.startsWith(target + ' ')) score = 90;
      else if(hay.includes(target)) score = 70;
      else {
        for(const [canonical, aliases] of LABEL_ALIASES){
          if(slug(canonical) === target && aliases.some(a => hay.includes(slug(a)))) score = 65;
        }
      }
      if(score > bestScore){ bestScore = score; best = p; }
    });
    return best?.url || '';
  }

  function applyPhotos(record, incoming=[]){
    if(!record) return record;
    record.gallery = dedupe([...(record.gallery || []), ...photosFromRow(record.raw || {}), ...(incoming || [])]);
    record.evidenceCount = Math.max(Number(record.evidenceCount || 0), record.gallery.length);
    ['structure','electrical'].forEach(group => {
      if(Array.isArray(record[group])) record[group] = record[group].map(row => ({...row, photoUrl: row.photoUrl || matchPhoto(record.gallery, row.item || row.name)}));
    });
    if(Array.isArray(record.equipment)) record.equipment = record.equipment.map(row => ({...row, photoUrl: row.photoUrl || matchPhoto(record.gallery, row.name || row.item)}));
    return record;
  }

  async function hydrate(record, force=false){
    if(!record) return record;
    if(record.__ltkPhotosReady && !force) return record;
    const archivos = await findarchivosPhotos(record);
    applyPhotos(record, archivos);
    record.__ltkPhotosReady = true;
    try{
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)){
        const idx = levRecords.findIndex(x => String(x.id) === String(record.id));
        if(idx >= 0) levRecords[idx] = record;
        if(typeof levSave === 'function') levSave();
      }
    }catch(e){}
    return record;
  }
  window.ltkHydratePhotosForLev = hydrate;

  const prevBuild = window.ltkBuildLevRecord;
  if(typeof prevBuild === 'function'){
    window.ltkBuildLevRecord = function(row, detailsByLev, position){
      const rec = prevBuild(row, detailsByLev, position);
      rec.raw = {...(rec.raw || {}), ...(row || {})};
      return applyPhotos(rec, photosFromRow(row || {}));
    };
  }

  function ensureViewer(){
    let modal = document.getElementById('ltkPhotoViewerModal');
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ltkPhotoViewerModal';
    modal.innerHTML = `<div class="ltk-photo-viewer-backdrop" onclick="ltkClosePhotoViewer()"></div><div class="ltk-photo-viewer-card"><button type="button" class="ltk-photo-viewer-close" onclick="ltkClosePhotoViewer()"><i class="fas fa-xmark"></i></button><img id="ltkPhotoViewerImg" alt="Foto del levantamiento"><div id="ltkPhotoViewerCaption"></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }
  window.ltkOpenPhotoViewer = function(url, label='Foto'){
    const modal = ensureViewer();
    const img = document.getElementById('ltkPhotoViewerImg');
    const cap = document.getElementById('ltkPhotoViewerCaption');
    if(img) img.src = url;
    if(cap) cap.textContent = label;
    modal.classList.add('open');
  };
  window.ltkClosePhotoViewer = function(){ document.getElementById('ltkPhotoViewerModal')?.classList.remove('open'); };

  function thumb(url, label){
    if(!url) return `<span class="ltk-lev-no-photo">Sin foto</span>`;
    return `<button type="button" class="ltk-lev-photo-link" onclick="ltkOpenPhotoViewer('${esc(url)}','${esc(label)}')"><img src="${esc(url)}" alt="${esc(label)}"></button>`;
  }
  function rowsWithPhotos(rows, gallery, emptyLabel='Sin información registrada.'){
    return Array.isArray(rows) && rows.length ? rows.map(row => {
      const label = row.item || row.name || '-';
      const state = row.state || row.available || '-';
      const url = row.photoUrl || matchPhoto(gallery, label);
      return `<tr><td><strong>${esc(label)}</strong></td><td><span class="lev-state-pill ${typeof levStateClass === 'function' ? levStateClass(state) : ''}">${esc(state)}</span></td><td>${thumb(url, label)}</td></tr>`;
    }).join('') : `<tr><td colspan="3"><div class="lev-empty">${esc(emptyLabel)}</div></td></tr>`;
  }

  function enhanceDetail(id){
    const body = document.getElementById('levDetailBody');
    if(!body) return;
    let item = null;
    try{ item = (typeof levRecords !== 'undefined' && Array.isArray(levRecords)) ? levRecords.find(row => String(row.id) === String(id) || String(row.code) === String(id)) : null; }catch(e){}
    if(!item) return;
    const gallery = item.gallery || [];
    const sections = body.querySelectorAll('.lev-section');
    const patchTable = (sectionIndex, headers, rows) => {
      const table = sections[sectionIndex]?.querySelector('table');
      if(!table) return;
      const head = table.querySelector('thead tr');
      const tb = table.querySelector('tbody');
      if(head) head.innerHTML = headers.map(h => `<th>${h}</th>`).join('') + '<th>Foto</th>';
      if(tb) tb.innerHTML = rowsWithPhotos(rows, gallery);
    };
    patchTable(0, ['Elemento','Estado'], item.structure);
    patchTable(1, ['Componente','Estado'], item.electrical);

    const grid = body.querySelector('.lev-gallery-grid');
    if(grid){
      grid.innerHTML = gallery.length ? gallery.map(p => `<div class="lev-gallery-card"><button type="button" class="lev-gallery-thumb ltk-gallery-button" onclick="ltkOpenPhotoViewer('${esc(p.url)}','${esc(p.label)}')"><img src="${esc(p.url)}" alt="${esc(p.label)}"></button><div class="meta"><strong>${esc(p.label)}</strong><span>Foto recibida desde Jotform / backend futuro.</span></div></div>`).join('') : '<div class="lev-empty" style="padding:18px;">Sin fotografías vinculadas.</div>';
    }
  }

  const prevOpen = window.levOpenDetail;
  window.levOpenDetail = async function(id){
    let item = null;
    try{ item = (typeof levRecords !== 'undefined' && Array.isArray(levRecords)) ? levRecords.find(row => String(row.id) === String(id) || String(row.code) === String(id)) : null; }catch(e){}
    if(item) await hydrate(item, false);
    if(typeof prevOpen === 'function') prevOpen(id);
    setTimeout(() => enhanceDetail(item?.id || id), 60);
  };

  const prevAgencyView = window.agencyViewLev;
  window.agencyViewLev = async function(id){
    let item = null;
    try{
      const list = [];
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)) list.push(...levRecords);
      const key = typeof LEV_STORAGE_KEY !== 'undefined' ? LEV_STORAGE_KEY : 'loteka_operaciones_levantamientos_v2';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if(Array.isArray(stored)) list.push(...stored);
      item = list.find(row => String(row.id) === String(id) || String(row.code) === String(id));
    }catch(e){}
    if(item) await hydrate(item, false);
    if(typeof prevAgencyView === 'function') prevAgencyView(id);
    setTimeout(() => enhanceDetail(item?.id || id), 80);
  };

  const prevSync = window.ltkSyncAllFromBackendCero;
  if(typeof prevSync === 'function'){
    window.ltkSyncAllFromBackendCero = async function(){
      try{
        await prevSync();
        const list = (typeof levRecords !== 'undefined' && Array.isArray(levRecords)) ? levRecords.slice(0, 80) : [];
        for(const item of list){ await hydrate(item, false); }
        if(typeof levSave === 'function') levSave();
        if(typeof levRender === 'function') levRender();
        return true;
      }finally{
        try{ ltkHideAutoSyncOverlay(); }catch(e){}
      }
    };
  }

  window.ltkAutoSync = async function(forceOverlay=false, label='Actualizando'){
    if(window.__ltkAutoSyncBusy) return;
    window.__ltkAutoSyncBusy = true;
    if(forceOverlay && typeof ltkShowAutoSyncOverlay === 'function') ltkShowAutoSyncOverlay(label);
    let timeoutId;
    try{
      const timeout = new Promise(resolve => { timeoutId = setTimeout(resolve, MAX_AUTO_MS); });
      await Promise.race([window.ltkSyncAllFromBackendCero ? window.ltkSyncAllFromBackendCero() : Promise.resolve(), timeout]);
    }catch(e){ console.warn('AutoSync no bloqueante:', e); }
    finally{
      clearTimeout(timeoutId);
      window.__ltkAutoSyncBusy = false;
      if(typeof ltkHideAutoSyncOverlay === 'function') ltkHideAutoSyncOverlay();
    }
  };

  const css = document.createElement('style');
  css.textContent = `
    .ltk-lev-photo-link{display:inline-flex;align-items:center;justify-content:center;width:96px;height:68px;border:0;border-radius:12px;overflow:hidden;background:#f7fbff;box-shadow:0 8px 20px rgba(19,54,91,.10);cursor:pointer;padding:0}
    .ltk-lev-photo-link img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .18s ease}.ltk-lev-photo-link:hover img{transform:scale(1.05)}
    .ltk-lev-no-photo{display:inline-flex;align-items:center;justify-content:center;width:96px;height:42px;border:1px dashed #c8d7e6;border-radius:12px;color:#7890a5;font-weight:800;font-size:12px;background:#fbfdff}
    .lev-table-clean th:nth-child(3),.lev-table-clean td:nth-child(3){text-align:center;width:126px}.ltk-gallery-button{border:0;width:100%;height:100%;padding:0;cursor:pointer;background:transparent}.ltk-gallery-button img{width:100%;height:100%;object-fit:cover;display:block}
    #ltkPhotoViewerModal{position:fixed;inset:0;z-index:999999;display:none;align-items:center;justify-content:center;padding:22px}#ltkPhotoViewerModal.open{display:flex}.ltk-photo-viewer-backdrop{position:absolute;inset:0;background:rgba(4,17,29,.78);backdrop-filter:blur(4px)}.ltk-photo-viewer-card{position:relative;max-width:min(1080px,96vw);max-height:92vh;background:#071827;border-radius:22px;padding:14px;box-shadow:0 28px 90px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:10px}.ltk-photo-viewer-card img{max-width:100%;max-height:78vh;object-fit:contain;border-radius:16px;background:#000}.ltk-photo-viewer-close{position:absolute;right:12px;top:12px;width:42px;height:42px;border:0;border-radius:999px;background:#fff;color:#0b2239;cursor:pointer;font-size:18px;box-shadow:0 10px 24px rgba(0,0,0,.25)}#ltkPhotoViewerCaption{color:#fff;font-weight:800;text-align:center;padding:2px 46px 4px}.ltk-auto-overlay:not(.show){display:none!important;opacity:0!important;pointer-events:none!important}
  `;
  document.head.appendChild(css);

  // Si al cargar quedó pegado de una versión anterior, lo apagamos sin romper la sincronización.
  setTimeout(() => { try{ ltkHideAutoSyncOverlay(); }catch(e){} }, 12000);
})();

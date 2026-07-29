
/* ==========================================================
   LOTEKA · FOTOS JOTFORM EN LEVANTAMIENTOS
   - Lee fotos desde archivos bucket: levantamientos
   - Ruta esperada: codigo_agencia / codigo_levantamiento / archivo.jpg
     Ejemplo: 1000/LEV-5/pecho-1777042469497.jpg
   - Muestra fotos dentro de OPERACIONES > LEVANTAMIENTOS > Ver
   - También quedan visibles desde GESTIÓN DE AGENCIAS > AGENCIAS > CONSULTA AGENCIA > LEVANTAMIENTOS > Ver
   - No altera módulos existentes; solo hidrata evidencias fotográficas.
   ========================================================== */
(function(){
  const LTK_LEV_BUCKET = 'levantamientos';
  const PHOTO_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i;
  const PHOTO_LABELS = [
    ['caja registradora / gaveta', ['caja registradora','gaveta','caja-registradora','caja_registradora']],
    ['puerta enrollable / eléctrica', ['puerta enrollable','puerta electrica','puerta eléctrica','puerta-enrollable','puerta-electrica']],
    ['pintura / filtraciones', ['pintura','filtracion','filtraciones','pintura-filtraciones']],
    ['hierros / cristales', ['hierro','hierros','cristal','cristales','hierros-cristales']],
    ['publicidades', ['publicidad','publicidades']],
    ['taburete', ['taburete','taburetes']],
    ['abanico', ['abanico','abanicos']],
    ['toldo', ['toldo','toldos']],
    ['pecho', ['pecho']],
    ['piso', ['piso']],
    ['inversor', ['inversor','inverter']],
    ['baterías', ['bateria','baterias','batería','baterías']],
    ['printer', ['printer','impresora']],
    ['scanner', ['scanner','escaner','escáner']],
    ['máquina de venta', ['maquina de venta','máquina de venta','maquina','terminal']],
    ['2da pantalla', ['2da pantalla','segunda pantalla','2da-pantalla']],
    ['pantalla atm', ['pantalla atm','atm']]
  ];
  function cleanText(v){ return String(v ?? '').trim(); }
  function onlyDigits(v){ return cleanText(v).replace(/\D+/g,''); }
  function esc(v){ return cleanText(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function stripAccents(v){ return cleanText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function slug(v){ return stripAccents(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
  function normCode(v){
    const raw = cleanText(v);
    if(!raw) return '';
    const m = raw.match(/LEV[-\s]*\d+/i);
    if(m) return m[0].toUpperCase().replace(/\s+/g,'-');
    return raw.toUpperCase();
  }
  function publicUrl(path){
    const base = cleanText((((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}) && ((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}).backendCeroUrl) || (typeof LTK_DEFAULT_BACKEND_CERO_URL !== 'undefined' ? LTK_DEFAULT_BACKEND_CERO_URL : '') || '').replace(/\/$/, '');
    return base ? `${base}/archivos/v1/object/public/${LTK_LEV_BUCKET}/${String(path).split('/').map(encodeURIComponent).join('/')}` : path;
  }
  function guessLabelFromName(name){
    const s = slug(name).replace(/\b\d{8,}\b/g,' ').replace(/\b(jpg|jpeg|png|webp|gif|bmp|heic|heif)\b/g,' ').trim();
    for(const [label, keys] of PHOTO_LABELS){
      if(keys.some(k => s.includes(slug(k)))) return label.replace(/(^|\s|\/)\S/g, m => m.toUpperCase());
    }
    return cleanText(name).replace(PHOTO_EXT_RE,'').replace(/[-_]+/g,' ').replace(/\b\d{8,}\b/g,'').trim() || 'Foto del levantamiento';
  }
  function findPhotoForLabel(gallery, label){
    const wanted = slug(label);
    return (gallery || []).find(p => slug(p.label || p.name || p.fileName || p.path || '').includes(wanted) || wanted.includes(slug(p.label || p.name || p.fileName || p.path || '')))?.url || '';
  }
  function normalizePhoto(raw, fallbackLabel='Foto del levantamiento'){
    if(!raw) return null;
    if(typeof raw === 'string'){
      const url = raw.startsWith('http') || raw.startsWith('data:') ? raw : publicUrl(raw.replace(/^\/+/,''));
      return { label: guessLabelFromName(raw) || fallbackLabel, url, path: raw };
    }
    const path = raw.path || raw.fullPath || raw.file_path || raw.archivos_path || raw.name || raw.url || raw.publicUrl || '';
    const url = raw.publicUrl || raw.public_url || raw.url || (path ? publicUrl(path) : '');
    const label = raw.label || raw.item || raw.campo || raw.field || raw.nombre || guessLabelFromName(path) || fallbackLabel;
    return url ? { label, url, path, fileName: raw.name || '' } : null;
  }
  function photosFromRow(row){
    const photos=[];
    const keys=['fotos','fotos_json','photos','imagenes','evidencias','gallery','archivos','attachments'];
    keys.forEach(k => {
      const val = row && row[k];
      if(!val) return;
      try{
        const arr = Array.isArray(val) ? val : (typeof val === 'string' && /^[\[{]/.test(val.trim()) ? JSON.parse(val) : [val]);
        arr.forEach(x => { const p=normalizePhoto(x); if(p) photos.push(p); });
      }catch(e){ const p=normalizePhoto(val); if(p) photos.push(p); }
    });
    Object.keys(row || {}).forEach(k => {
      if(/foto|photo|imagen|image|evidencia|archivo/i.test(k) && row[k]){
        const p = normalizePhoto(row[k], guessLabelFromName(k));
        if(p) photos.push({...p, label: p.label || guessLabelFromName(k)});
      }
    });
    return dedupePhotos(photos);
  }
  function dedupePhotos(list){
    const map = new Map();
    (list || []).forEach(p => {
      if(!p || !p.url) return;
      const key = p.url;
      if(!map.has(key)) map.set(key, p);
    });
    return Array.from(map.values());
  }
  async function listarchivos(prefix){
    const base = cleanText((((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}) && ((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}).backendCeroUrl) || (typeof LTK_DEFAULT_BACKEND_CERO_URL !== 'undefined' ? LTK_DEFAULT_BACKEND_CERO_URL : '') || '').replace(/\/$/, '');
    const key = cleanText((((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}) && ((typeof ltkBridgeConfig !== 'undefined' && ltkBridgeConfig) || {}).anonKey) || (typeof LTK_DEFAULT_BACKEND_CERO_ANON_KEY !== 'undefined' ? LTK_DEFAULT_BACKEND_CERO_ANON_KEY : '') || '');
    if(!base || !key || !prefix) return [];
    const res = await fetch(`${base}/archivos/v1/object/list/${LTK_LEV_BUCKET}`, {
      method:'POST',
      headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ prefix, limit:100, offset:0, sortBy:{ column:'name', order:'asc' } })
    });
    if(!res.ok) return [];
    const rows = await res.json();
    return (rows || []).filter(x => x && x.name && PHOTO_EXT_RE.test(x.name)).map(x => ({
      label: guessLabelFromName(x.name),
      url: publicUrl(`${prefix.replace(/\/$/,'')}/${x.name}`),
      path: `${prefix.replace(/\/$/,'')}/${x.name}`,
      fileName: x.name
    }));
  }
  async function fetchPhotosForLev(record){
    const agency = onlyDigits(record?.agency || record?.agencia || record?.codigo_agencia || record?.raw?.codigo_agencia || '');
    const code = normCode(record?.code || record?.codigo || record?.raw?.codigo || record?.id || '');
    const candidates = [];
    if(agency && code) candidates.push(`${agency}/${code}`);
    if(agency && record?.id) candidates.push(`${agency}/${normCode(record.id).replace(/^SB-/,'')}`);
    let photos=[];
    for(const prefix of [...new Set(candidates)]){
      const got = await listarchivos(prefix);
      photos = photos.concat(got);
      if(photos.length) break;
    }
    return dedupePhotos(photos);
  }
  function applyPhotos(record, incoming){
    if(!record) return record;
    const gallery = dedupePhotos([...(record.gallery || []), ...photosFromRow(record.raw || {}), ...(incoming || [])]);
    record.gallery = gallery;
    record.evidenceCount = Math.max(Number(record.evidenceCount || 0), gallery.filter(p => p.url).length);
    ['structure','electrical'].forEach(group => {
      if(Array.isArray(record[group])) record[group] = record[group].map(row => ({...row, photoUrl: row.photoUrl || findPhotoForLabel(gallery, row.item || row.name)}));
    });
    if(Array.isArray(record.equipment)) record.equipment = record.equipment.map(row => ({...row, photoUrl: row.photoUrl || findPhotoForLabel(gallery, row.name || row.item)}));
    return record;
  }
  window.ltkHydratePhotosForLev = async function(record){
    if(!record) return record;
    if(record.__photosHydrated) return record;
    const stored = await fetchPhotosForLev(record);
    applyPhotos(record, stored);
    record.__photosHydrated = true;
    try{
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)){
        const idx = levRecords.findIndex(x => String(x.id) === String(record.id));
        if(idx >= 0) levRecords[idx] = record;
        if(typeof levSave === 'function') levSave();
      }
    }catch(e){}
    return record;
  };
  const originalBuild = window.ltkBuildLevRecord;
  if(typeof originalBuild === 'function'){
    window.ltkBuildLevRecord = function(row, detailsByLev, position){
      const record = originalBuild(row, detailsByLev, position);
      record.raw = {...(record.raw || {}), ...(row || {})};
      applyPhotos(record, photosFromRow(row || {}));
      return record;
    };
  }
  const originalSync = window.ltkSyncAllFromBackendCero;
  if(typeof originalSync === 'function'){
    window.ltkSyncAllFromBackendCero = async function(){
      await originalSync();
      try{
        if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)){
          const recent = levRecords.slice(0, 60);
          await Promise.all(recent.map(item => window.ltkHydratePhotosForLev(item)));
          if(typeof levSave === 'function') levSave();
          if(typeof levRender === 'function') levRender();
        }
      }catch(e){ console.warn('Fotos de levantamientos: no se pudieron hidratar todas las evidencias.', e); }
    };
  }
  const originalLevOpenDetail = window.levOpenDetail;
  window.levOpenDetail = async function(id){
    let item = null;
    try{ item = (typeof levRecords !== 'undefined' && Array.isArray(levRecords)) ? levRecords.find(row => String(row.id) === String(id)) : null; }catch(e){}
    if(item) await window.ltkHydratePhotosForLev(item);
    if(typeof originalLevOpenDetail === 'function') originalLevOpenDetail(id);
    setTimeout(() => enhanceOpenDetailWithPhotos(id), 80);
  };
  function photoThumb(url, label){
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="ltk-lev-photo-link"><img src="${esc(url)}" alt="${esc(label)}"></a>` : `<span class="ltk-lev-no-photo">Sin foto</span>`;
  }
  function rowsWithPhotos(rows, gallery){
    return (rows && rows.length) ? rows.map(row => {
      const label = row.item || row.name || '-';
      const state = row.state || row.available || '-';
      const url = row.photoUrl || findPhotoForLabel(gallery, label);
      return `<tr><td><strong>${esc(label)}</strong></td><td><span class="lev-state-pill ${typeof levStateClass === 'function' ? levStateClass(state) : ''}">${esc(state)}</span></td><td>${photoThumb(url, label)}</td></tr>`;
    }).join('') : `<tr><td colspan="3"><div class="lev-empty">Sin información registrada.</div></td></tr>`;
  }
  function enhanceOpenDetailWithPhotos(id){
    const body = document.getElementById('levDetailBody');
    if(!body) return;
    let item = null;
    try{ item = (typeof levRecords !== 'undefined' && Array.isArray(levRecords)) ? levRecords.find(row => String(row.id) === String(id)) : null; }catch(e){}
    if(!item) return;
    const gallery = item.gallery || [];
    const sections = body.querySelectorAll('.lev-section');
    if(sections[0]){
      const table = sections[0].querySelector('table');
      if(table){
        const head = table.querySelector('thead tr');
        const tb = table.querySelector('tbody');
        if(head) head.innerHTML = '<th>Elemento</th><th>Estado</th><th>Foto</th>';
        if(tb) tb.innerHTML = rowsWithPhotos(item.structure, gallery);
      }
    }
    if(sections[1]){
      const table = sections[1].querySelector('table');
      if(table){
        const head = table.querySelector('thead tr');
        const tb = table.querySelector('tbody');
        if(head) head.innerHTML = '<th>Componente</th><th>Estado</th><th>Foto</th>';
        if(tb) tb.innerHTML = rowsWithPhotos(item.electrical, gallery);
      }
    }
    const galleryGrid = body.querySelector('.lev-gallery-grid');
    if(galleryGrid && gallery.length){
      galleryGrid.innerHTML = gallery.map(p => `<div class="lev-gallery-card"><div class="lev-gallery-thumb"><img src="${esc(p.url)}" alt="${esc(p.label)}" style="width:100%;height:100%;object-fit:cover;"></div><div class="meta"><strong>${esc(p.label)}</strong><span>Foto recibida desde Jotform / backend futuro archivos.</span></div></div>`).join('');
    }
  }
  const originalAgencyViewLev = window.agencyViewLev;
  window.agencyViewLev = async function(id){
    let item = null;
    try{
      const all = [];
      if(typeof levRecords !== 'undefined' && Array.isArray(levRecords)) all.push(...levRecords);
      const key = typeof LEV_STORAGE_KEY !== 'undefined' ? LEV_STORAGE_KEY : 'loteka_operaciones_levantamientos_v2';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if(Array.isArray(stored)) all.push(...stored);
      item = all.find(row => String(row.id) === String(id) || String(row.code) === String(id));
    }catch(e){}
    if(item) await window.ltkHydratePhotosForLev(item);
    if(typeof originalAgencyViewLev === 'function') originalAgencyViewLev(id);
    setTimeout(() => enhanceOpenDetailWithPhotos(item?.id || id), 100);
  };
  const css = document.createElement('style');
  css.textContent = `
    .ltk-lev-photo-link{display:inline-flex;width:92px;height:66px;border-radius:12px;overflow:hidden;border:1px solid #d7e3ef;background:#f7fbff;box-shadow:0 8px 20px rgba(19,54,91,.08)}
    .ltk-lev-photo-link img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .18s ease}
    .ltk-lev-photo-link:hover img{transform:scale(1.05)}
    .ltk-lev-no-photo{display:inline-flex;align-items:center;justify-content:center;width:92px;height:42px;border:1px dashed #c8d7e6;border-radius:12px;color:#7890a5;font-weight:800;font-size:12px;background:#fbfdff}
    .lev-table-clean th:nth-child(3), .lev-table-clean td:nth-child(3){text-align:center;width:120px;}
  `;
  document.head.appendChild(css);
})();

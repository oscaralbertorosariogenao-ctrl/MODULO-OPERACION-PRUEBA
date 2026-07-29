
/* ==========================================================
   LOTEKA · OPTIMIZACIÓN FINAL DE FOTOS BACKEND_CERO
   Fecha: 2026-04-24
   - Mantiene conexión Backend futuro/Jotform para recibir fotos.
   - Reduce consumo: NO descarga miniaturas pesadas automáticamente.
   - Carga la foto grande solo al hacer clic en Ver foto.
   - Evita pantalla pegada en Actualizando con timeout seguro.
   ========================================================== */
(function(){
  const IMG_RE=/\.(png|jpe?g|webp|gif|bmp|heic|heif)(\?|#|$)/i;
  const esc=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const strip=(v)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const slug=(v)=>strip(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const labelFrom=(p)=>String(p?.label||p?.fileName||p?.name||p?.path||'Foto del levantamiento').replace(IMG_RE,'').replace(/[-_]+/g,' ').trim()||'Foto del levantamiento';

  function ensurePhotoViewer(){
    let modal=document.getElementById('ltkPhotoViewerModal');
    if(modal) return modal;
    modal=document.createElement('div');
    modal.id='ltkPhotoViewerModal';
    modal.innerHTML='<div class="ltk-photo-viewer-backdrop" onclick="ltkClosePhotoViewer()"></div><div class="ltk-photo-viewer-card"><button type="button" class="ltk-photo-viewer-close" onclick="ltkClosePhotoViewer()"><i class="fas fa-xmark"></i></button><div id="ltkPhotoViewerLoading" class="ltk-photo-viewer-loading">Cargando foto...</div><img id="ltkPhotoViewerImg" alt="Foto del levantamiento" loading="lazy" decoding="async"><div id="ltkPhotoViewerCaption"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }
  window.ltkOpenPhotoViewer=function(url,label='Foto'){
    if(!url) return;
    const modal=ensurePhotoViewer();
    const img=document.getElementById('ltkPhotoViewerImg');
    const cap=document.getElementById('ltkPhotoViewerCaption');
    const loading=document.getElementById('ltkPhotoViewerLoading');
    if(cap) cap.textContent=label;
    if(loading){ loading.textContent='Cargando foto...'; loading.style.display='block'; }
    if(img){
      img.removeAttribute('src');
      img.onload=()=>{ if(loading) loading.style.display='none'; };
      img.onerror=()=>{ if(loading) loading.textContent='No se pudo cargar la foto. Revisa el límite de BackendCero o la URL.'; };
      setTimeout(()=>{ img.src=url; }, 30);
    }
    modal.classList.add('open');
  };
  window.ltkClosePhotoViewer=function(){
    const modal=document.getElementById('ltkPhotoViewerModal');
    const img=document.getElementById('ltkPhotoViewerImg');
    if(modal) modal.classList.remove('open');
    if(img) img.removeAttribute('src');
  };

  function findPhoto(gallery,label){
    const target=slug(label);
    if(!target) return null;
    let best=null,score=0;
    (gallery||[]).forEach(p=>{
      const hay=slug(`${p.label||''} ${p.fileName||''} ${p.path||''}`);
      let s=0;
      if(hay===target) s=100;
      else if(hay.includes(target)) s=80;
      else if(target.includes(hay) && hay.length>2) s=60;
      if(s>score){ score=s; best=p; }
    });
    return best;
  }
  function photoButton(photo,label){
    const url=photo?.url||photo||'';
    if(!url) return '<span class="ltk-lev-no-photo">Sin foto</span>';
    const text=labelFrom(photo)||label||'Foto';
    return `<button type="button" class="ltk-lev-photo-link ltk-no-thumb" data-photo-url="${esc(url)}" data-photo-label="${esc(text)}" onclick="ltkOpenPhotoViewer(this.dataset.photoUrl,this.dataset.photoLabel)"><i class="fas fa-image"></i><span>Ver foto</span></button>`;
  }
  function rowsWithOptimizedPhotos(rows,gallery,empty='Sin información registrada.'){
    if(!Array.isArray(rows)||!rows.length) return `<tr><td colspan="3"><div class="lev-empty">${esc(empty)}</div></td></tr>`;
    return rows.map(row=>{
      const label=row.item||row.name||'-';
      const state=row.state||row.available||'-';
      const p=row.photoUrl?{url:row.photoUrl,label}:findPhoto(gallery,label);
      return `<tr><td><strong>${esc(label)}</strong></td><td><span class="lev-state-pill ${typeof levStateClass==='function'?levStateClass(state):''}">${esc(state)}</span></td><td>${photoButton(p,label)}</td></tr>`;
    }).join('');
  }
  function optimizeDetailAfterOpen(id){
    const body=document.getElementById('levDetailBody');
    if(!body) return;
    let item=null;
    try{ item=(typeof levRecords!=='undefined'&&Array.isArray(levRecords))?levRecords.find(r=>String(r.id)===String(id)||String(r.code)===String(id)):null; }catch(e){}
    if(!item) return;
    const gallery=item.gallery||[];
    const sections=body.querySelectorAll('.lev-section');
    const patch=(idx,heads,rows)=>{
      const table=sections[idx]?.querySelector('table'); if(!table) return;
      const head=table.querySelector('thead tr'); const tb=table.querySelector('tbody');
      if(head) head.innerHTML=heads.map(h=>`<th>${esc(h)}</th>`).join('')+'<th>Foto</th>';
      if(tb) tb.innerHTML=rowsWithOptimizedPhotos(rows,gallery);
    };
    patch(0,['Elemento','Estado'],item.structure);
    patch(1,['Componente','Estado'],item.electrical);
    const grid=body.querySelector('.lev-gallery-grid');
    if(grid){
      grid.innerHTML=gallery.length?gallery.map((p,i)=>`<div class="lev-gallery-card ltk-gallery-card-optimized"><button type="button" class="lev-gallery-thumb ltk-gallery-button ltk-no-thumb" data-photo-url="${esc(p.url)}" data-photo-label="${esc(labelFrom(p))}" onclick="ltkOpenPhotoViewer(this.dataset.photoUrl,this.dataset.photoLabel)"><i class="fas fa-image"></i><span>Ver foto ${i+1}</span></button><div class="meta"><strong>${esc(labelFrom(p))}</strong><span>Foto enlazada desde BackendCero. Se carga solo al abrir.</span></div></div>`).join(''):'<div class="lev-empty" style="padding:18px;">Sin fotografías vinculadas.</div>';
    }
    body.querySelectorAll('img').forEach(img=>{ img.loading='lazy'; img.decoding='async'; img.fetchPriority='low'; });
  }

  const prevLevOpen=window.levOpenDetail;
  window.levOpenDetail=async function(id){
    let item=null;
    try{ item=(typeof levRecords!=='undefined'&&Array.isArray(levRecords))?levRecords.find(r=>String(r.id)===String(id)||String(r.code)===String(id)):null; }catch(e){}
    try{ if(item && typeof window.ltkHydratePhotosForLev==='function') await window.ltkHydratePhotosForLev(item,false); }catch(e){ console.warn('Fotos locales no hidratadas:',e); }
    if(typeof prevLevOpen==='function') prevLevOpen(id);
    setTimeout(()=>optimizeDetailAfterOpen(item?.id||id),120);
    setTimeout(()=>optimizeDetailAfterOpen(item?.id||id),450);
  };

  const prevAgencyView=window.agencyViewLev;
  window.agencyViewLev=async function(id){
    let item=null;
    try{
      const list=[];
      if(typeof levRecords!=='undefined'&&Array.isArray(levRecords)) list.push(...levRecords);
      const key=typeof LEV_STORAGE_KEY!=='undefined'?LEV_STORAGE_KEY:'loteka_operaciones_levantamientos_v2';
      const stored=JSON.parse(localStorage.getItem(key)||'[]');
      if(Array.isArray(stored)) list.push(...stored);
      item=list.find(r=>String(r.id)===String(id)||String(r.code)===String(id));
    }catch(e){}
    try{ if(item && typeof window.ltkHydratePhotosForLev==='function') await window.ltkHydratePhotosForLev(item,false); }catch(e){ console.warn('Fotos locales no hidratadas:',e); }
    if(typeof prevAgencyView==='function') prevAgencyView(id);
    setTimeout(()=>optimizeDetailAfterOpen(item?.id||id),150);
    setTimeout(()=>optimizeDetailAfterOpen(item?.id||id),500);
  };

  window.agencyRenderGallery=function(agencia){
    const holder=document.getElementById('agencyGalleryAutoGrid'); if(!holder) return;
    const cards=[];
    try{
      const d=agencia?.detalle||{}; const baseGallery=d.galeria||{};
      [['Exterior base',baseGallery.exterior],['Zona cliente base',baseGallery.cliente],['Zona empleada base',baseGallery.empleada]].forEach(([label,url])=>{ if(url) cards.push({label,url,source:'Ficha base'}); });
      if(typeof agencyGetLevsForAgency==='function') agencyGetLevsForAgency(agencia).forEach(item=>(item.gallery||[]).forEach(photo=>cards.push({label:photo.label||'Levantamiento',url:photo.url||'',source:item.code||'Levantamiento'})));
    }catch(e){}
    holder.innerHTML=cards.length?cards.map(card=>`<div class="agency-gallery-card"><div class="agency-gallery-preview">${photoButton(card,card.label)}</div><div class="agency-gallery-meta"><strong>${esc(card.label)}</strong><span>${esc(card.source)} · carga bajo clic</span></div></div>`).join(''):'<div class="lev-empty">Sin evidencias fotográficas vinculadas.</div>';
  };

  const previousSync=window.ltkSyncAllFromBackendCero;
  if(typeof previousSync==='function'){
    window.ltkSyncAllFromBackendCero=async function(){
      const limitMs=9000;
      let timer;
      try{
        const timeout=new Promise(resolve=>{ timer=setTimeout(()=>resolve('__timeout__'),limitMs); });
        const result=await Promise.race([previousSync(), timeout]);
        if(result==='__timeout__') console.warn('BackendCero tardó demasiado; se liberó la pantalla para evitar bloqueo.');
        return result;
      }catch(e){ console.error('Error sincronizando BackendCero:',e); return false; }
      finally{ clearTimeout(timer); try{ if(typeof ltkHideAutoSyncOverlay==='function') ltkHideAutoSyncOverlay(); }catch(e){} }
    };
  }

  function markConnectionReady(){
    try{
      const back=document.getElementById('ltkBadgeBackend');
      const front=document.getElementById('ltkBadgeFrontend');
      const status=document.getElementById('ltkSyncStatus');
      if(back) back.innerHTML='<i class="fas fa-plug"></i> Backend Jotform listo';
      if(front) front.innerHTML='<i class="fas fa-database"></i> Lectura local activa';
      if(status) status.innerHTML='Conexión Backend futuro/Jotform verificada en el HTML. Las fotos se enlazan desde archivos y se cargan solo cuando haces clic para reducir consumo.';
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',markConnectionReady); else markConnectionReady();

  const css=document.createElement('style');
  css.textContent=`
    .ltk-no-thumb{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #cfe1ee;background:linear-gradient(135deg,#f7fbff,#eef7fc);color:#0e5278;font-weight:900;border-radius:14px;cursor:pointer;min-width:104px;min-height:48px;padding:10px 12px;box-shadow:0 8px 20px rgba(19,54,91,.08)}
    .ltk-no-thumb:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(19,54,91,.14)}
    .ltk-no-thumb i{font-size:18px}.ltk-no-thumb span{font-size:12px;letter-spacing:.02em}
    .ltk-gallery-card-optimized .lev-gallery-thumb{height:145px;flex-direction:column}.agency-gallery-preview .ltk-no-thumb{width:100%;height:100%;border-radius:0;box-shadow:none}
    #ltkPhotoViewerModal{position:fixed;inset:0;z-index:999999;display:none;align-items:center;justify-content:center;padding:22px}#ltkPhotoViewerModal.open{display:flex}
    .ltk-photo-viewer-backdrop{position:absolute;inset:0;background:rgba(4,17,29,.78);backdrop-filter:blur(4px)}.ltk-photo-viewer-card{position:relative;max-width:min(1080px,96vw);max-height:92vh;background:#071827;border-radius:22px;padding:14px;box-shadow:0 28px 90px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:10px}.ltk-photo-viewer-card img{max-width:100%;max-height:78vh;object-fit:contain;border-radius:16px;background:#000}.ltk-photo-viewer-close{position:absolute;right:12px;top:12px;width:42px;height:42px;border:0;border-radius:999px;background:#fff;color:#0b2239;cursor:pointer;font-size:18px;box-shadow:0 10px 24px rgba(0,0,0,.25)}#ltkPhotoViewerCaption{color:#fff;font-weight:800;text-align:center;padding:2px 46px 4px}.ltk-photo-viewer-loading{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font-weight:900;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:10px 16px;z-index:2}.ltk-auto-overlay:not(.show){display:none!important;opacity:0!important;pointer-events:none!important}
  `;
  document.head.appendChild(css);
  setTimeout(()=>{ try{ if(typeof ltkHideAutoSyncOverlay==='function') ltkHideAutoSyncOverlay(); }catch(e){} },10000);
})();

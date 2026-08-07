
(function(){
  'use strict';
  var nativeAlert = window.alert ? window.alert.bind(window) : null;
  function esc(v){ try{ if(typeof escapeHtml === 'function') return escapeHtml(v); }catch(e){} return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function ensureToastWrap(){ var wrap=document.getElementById('goToastWrap'); if(!wrap){ wrap=document.createElement('div'); wrap.id='goToastWrap'; wrap.className='go-toast-wrap'; document.body.appendChild(wrap); } return wrap; }
  window.goToast = window.lotekaToast = function(title,text,tone,ms){
    var wrap=ensureToastWrap(); var item=document.createElement('div'); var t=tone||'info';
    var icon={success:'fa-circle-check',warning:'fa-triangle-exclamation',danger:'fa-circle-xmark',info:'fa-circle-info'}[t]||'fa-circle-info';
    item.className='go-toast '+t;
    item.innerHTML='<div class="go-toast-icon"><i class="fas '+icon+'"></i></div><div><div class="go-toast-title">'+esc(title||'Aviso')+'</div><div class="go-toast-text">'+esc(text||'')+'</div></div><button type="button" class="go-toast-close" aria-label="Cerrar"><i class="fas fa-xmark"></i></button>';
    wrap.appendChild(item);
    function close(){ item.style.animation='goToastOut .22s ease forwards'; setTimeout(function(){ if(item&&item.parentNode) item.parentNode.removeChild(item); },240); }
    item.querySelector('.go-toast-close').addEventListener('click',close);
    setTimeout(close, ms || 4300); return item;
  };
  // Alertas visuales sin tocar el canal de notificaciones Supabase/PWA.
  window.alert = function(message){ try{ window.lotekaToast('Aviso del sistema', message || '', 'warning', 5200); }catch(e){ if(nativeAlert) nativeAlert(message); } };

  function ensureConfirm(){
    var modal=document.getElementById('goConfirmModal');
    if(modal) return modal;
    modal=document.createElement('div'); modal.id='goConfirmModal'; modal.className='go-confirm-backdrop';
    modal.innerHTML='<div class="go-confirm-card" role="dialog" aria-modal="true"><div class="go-confirm-head"><div class="go-confirm-mark"><i class="fas fa-triangle-exclamation"></i></div><div><h3 class="go-confirm-title" id="goConfirmTitle">Confirmar acción</h3><p class="go-confirm-text" id="goConfirmText">Verifica antes de continuar.</p></div></div><div class="go-confirm-body"><div class="go-confirm-note" id="goConfirmNote">Esta acción puede afectar registros del sistema.</div></div><div class="go-confirm-actions"><button type="button" class="go-confirm-btn" id="goConfirmCancel"><i class="fas fa-xmark"></i> Cancelar</button><button type="button" class="go-confirm-btn danger" id="goConfirmAccept"><i class="fas fa-trash-can"></i> Confirmar</button></div></div>';
    document.body.appendChild(modal); return modal;
  }
  window.goConfirm = window.lotekaConfirm = function(opts){
    opts=opts||{}; var modal=ensureConfirm();
    modal.querySelector('#goConfirmTitle').textContent=opts.title||'Confirmar acción';
    modal.querySelector('#goConfirmText').textContent=opts.text||'Verifica antes de continuar.';
    modal.querySelector('#goConfirmNote').textContent=opts.note||'Esta acción puede afectar registros del sistema.';
    var accept=modal.querySelector('#goConfirmAccept'), cancel=modal.querySelector('#goConfirmCancel');
    accept.className='go-confirm-btn '+(opts.tone==='primary'?'primary':'danger');
    accept.innerHTML='<i class="fas '+(opts.icon||'fa-check')+'"></i> '+(opts.confirmText||'Confirmar');
    cancel.innerHTML='<i class="fas fa-xmark"></i> '+(opts.cancelText||'Cancelar');
    return new Promise(function(resolve){
      function done(v){ modal.classList.remove('open'); accept.onclick=cancel.onclick=null; modal.onclick=null; document.removeEventListener('keydown',key); resolve(v); }
      function key(ev){ if(ev.key==='Escape') done(false); }
      accept.onclick=function(){done(true)}; cancel.onclick=function(){done(false)}; modal.onclick=function(ev){ if(ev.target===modal) done(false); }; document.addEventListener('keydown',key); modal.classList.add('open');
    });
  };

  function val(fn,fallback){ try{ var v=fn(); return (v==null||v==='')?fallback:v; }catch(e){ return fallback; } }
  function uniqMedia(values){
    var seen={};
    return (Array.isArray(values)?values:[]).map(function(item){
      if(typeof item==='string') return String(item||'').trim();
      return String((item&&(item.url_r2||item.url||item.publicUrl||item.public_url))||'').trim();
    }).filter(function(url){ if(!url||seen[url]) return false; seen[url]=1; return true; });
  }
  async function fetchR2Evidence(reference){
    var client=window.lotekaSupabase||window.supabaseClient||window.__supabaseClient||null;
    if(!client||typeof client.rpc!=='function') return [];
    var clean=String(reference||'').trim();
    var result=await client.rpc('rpc_operacion_evidencias_v2',{p_operacion:clean});
    if(result.error) throw result.error;
    var rows=Array.isArray(result.data)?result.data:[];
    if(rows.length) return rows;

    // v808.24: si R2 tiene archivos creados por clientes antiguos pero faltan
    // metadatos en operacion_evidencias, el backend los reconcilia una sola vez.
    try{
      var headers=typeof window.lotekaGetApiAuthHeaders==='function'?await window.lotekaGetApiAuthHeaders():{};
      headers=Object.assign({},headers,{'Content-Type':'application/json'});
      var recovery=await fetch('/api/r2-evidence-reconcile',{method:'POST',headers:headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify({operacion:clean})});
      var payload=await recovery.json().catch(function(){return {};});
      if(recovery.ok && Number(payload.registered||0)>0){
        result=await client.rpc('rpc_operacion_evidencias_v2',{p_operacion:clean});
        if(result.error) throw result.error;
        rows=Array.isArray(result.data)?result.data:[];
      }
    }catch(recoveryError){
      console.warn('[Grupo Ortiz] No se pudieron reconciliar evidencias huérfanas de R2:',recoveryError);
    }
    return rows;
  }
  function attachR2EvidenceToDetail(op,rows){
    rows=(Array.isArray(rows)?rows:[]).filter(function(row){return row&&row.url_r2;});
    var report=rows.filter(function(row){return String(row.etapa||'').toUpperCase()==='REPORTE';});
    var result=rows.filter(function(row){return String(row.etapa||'').toUpperCase()!=='REPORTE';});
    op.images=uniqMedia([].concat(Array.isArray(op.images)?op.images:[],report));
    op.resultImages=uniqMedia([].concat(Array.isArray(op.resultImages)?op.resultImages:[],result));
    op.r2Evidence=rows.slice();
    op.evidenciasR2=rows.slice();
    return op;
  }
  function mediaBlock(list,title){ try{ if(Array.isArray(list)&&list.length&&typeof renderMediaGrid==='function') return '<div class="go-detail-media">'+renderMediaGrid(list,{title:'',minWidth:155,height:135})+'</div>'; }catch(e){} return '<div class="go-detail-empty">Sin '+esc(title||'archivos')+' registrados.</div>'; }
  function buildTimeline(op){
    var status=String(op.status||'Pendiente');
    var steps=[
      {label:'Creación', icon:'fa-plus', state:'done', text:'Reporte registrado en el sistema operacional.', date:val(function(){return formatDate(op.createdAt)},'')},
      {label:'Asignación', icon:'fa-user-check', state:(op.assignedAt||op.technician&&op.technician!=='Sin asignar')?'done':(status==='Reportado'?'active':''), text:(op.technician&&op.technician!=='Sin asignar')?'Responsable: '+val(function(){return getAssigneeDisplayName(op.technician,op.type)},op.technician):'Pendiente de asignación.', date:op.assignedAt?val(function(){return formatDate(op.assignedAt)},''):''},
      {label:'En proceso', icon:'fa-spinner', state:(op.startedAt||status==='En proceso'||status==='Completado')?'done':(status==='Asignado'?'active':''), text:(status==='En proceso'||status==='Completado')?'La operación fue tomada para seguimiento.':'Aún no ha iniciado proceso.', date:op.startedAt?val(function(){return formatDate(op.startedAt)},''):''},
      {label:'Completado', icon:'fa-flag-checkered', state:(status==='Completado'||status==='Resuelto por soporte remoto')?'done':'', text:(status==='Completado'||status==='Resuelto por soporte remoto')?'Operación resuelta con cierre registrado.':'Pendiente de cierre con evidencia.', date:op.completedAt?val(function(){return formatDate(op.completedAt)},''):''}
    ];
    return '<div class="go-detail-timeline">'+steps.map(function(s){return '<div class="go-detail-step '+s.state+'"><div class="go-detail-step-icon"><i class="fas '+s.icon+'"></i></div><div class="go-detail-step-body"><strong>'+esc(s.label)+'</strong><p>'+esc(s.text)+'</p>'+(s.date?'<small>'+esc(s.date)+'</small>':'')+'</div></div>';}).join('')+'</div>';
  }
  var originalShowDetail = window.showDetail;
  window.showDetail = async function(id){
    try{
      var loaded = (typeof loadOperations==='function' ? loadOperations() : []).find(function(item){
        return String(item.id)===String(id) || String(item.code||item.codigo||'')===String(id);
      });
      if(!loaded){ if(typeof originalShowDetail==='function') return originalShowDetail(id); return; }
      if(typeof currentDetailOperationId !== 'undefined') currentDetailOperationId=id;
      var op = (typeof enrichOperationWithAgencyContext==='function') ? enrichOperationWithAgencyContext(loaded) : loaded;
      try{
        var evidenceRows=await fetchR2Evidence(op.id||op.code||op.codigo||id);
        attachR2EvidenceToDetail(op,evidenceRows);
        attachR2EvidenceToDetail(loaded,evidenceRows);
        try{
          if(typeof loadOperations==='function' && typeof saveOperations==='function'){
            var all=loadOperations();
            var idx=all.findIndex(function(item){return String(item.id)===String(loaded.id)||String(item.code||item.codigo||'')===String(loaded.code||loaded.codigo||id);});
            if(idx>=0){ all[idx]=loaded; saveOperations(all); }
          }
        }catch(cacheError){ console.warn('[Grupo Ortiz] No se pudo actualizar la caché de evidencias:',cacheError); }
      }catch(evidenceError){
        console.error('[Grupo Ortiz] No se pudieron consultar las evidencias R2 del expediente:',evidenceError);
        try{ window.lotekaToast('Evidencias no disponibles',evidenceError.message||String(evidenceError),'warning',6500); }catch(_e){}
      }
      var agency = val(function(){return findAgencyRecord(op.agency)}, null);
      var assigned = val(function(){return getAssigneeDisplayName(op.technician,op.type)}, op.technician||'Sin asignar');
      var location = val(function(){return getOperationLocation(op)}, op.agency||'-');
      var reporter = val(function(){return getOperationReporter(op)}, op.reporter||'Sistema');
      var specific = val(function(){return getOperationSpecificTypes(op)}, Array.isArray(op.selectedTypes)?op.selectedTypes:[]);
      var assignTime = val(function(){return getAssignmentTimeLabel(op)}, '-');
      var responseTime = val(function(){return getResponseTimeLabel(op)}, '-');
      var resolveTime = val(function(){return getResolutionTimeLabel(op)}, '-');
      var statusHtml=val(function(){return statusBadge(op.status)}, '<span class="go-detail-pill">'+esc(op.status||'Reportado')+'</span>');
      var mapsUrl = agency ? val(function(){return buildAgencyMapsSearchUrl(agency)}, '#') : '#';
      var dirUrl = agency ? val(function(){return buildAgencyMapsDirectionsUrl(agency)}, '#') : '#';
      var geo = agency ? val(function(){return formatAgencyGeoText(agency)}, 'Sin coordenadas') : 'Sin coordenadas registradas';
      var modal=document.getElementById('detailModalBackdrop'); var content=document.getElementById('detailContent'); if(!modal||!content){ if(typeof originalShowDetail==='function') return originalShowDetail(id); return; }
      var printBtn=document.getElementById('detailPrintBtn'); if(printBtn && typeof printOperation==='function') printBtn.onclick=function(){ printOperation(id); };
      content.innerHTML='<div class="go-detail-shell"><section class="go-detail-hero"><div class="go-detail-top"><div><span class="go-detail-kicker"><i class="fas fa-clipboard-check"></i> Expediente de operación</span><h2 class="go-detail-title">'+esc(op.title||'Operación sin título')+'</h2><p class="go-detail-sub">'+esc(op.description||'Sin descripción registrada.')+'</p></div><div class="go-detail-code"><span>Código</span><strong>'+esc(op.code||id)+'</strong><div class="go-status-wrap" style="margin-top:10px">'+statusHtml+'</div></div></div><div class="go-detail-kpis"><div class="go-detail-kpi"><span>Agencia</span><strong>'+esc(location)+'</strong></div><div class="go-detail-kpi"><span>Responsable</span><strong>'+esc(assigned)+'</strong></div><div class="go-detail-kpi"><span>Respuesta</span><strong>'+esc(responseTime)+'</strong></div><div class="go-detail-kpi"><span>Resolución</span><strong>'+esc(resolveTime)+'</strong></div></div></section><section class="go-detail-body"><div class="go-detail-panel"><h4><i class="fas fa-circle-info"></i> Información general</h4><div class="go-detail-grid"><div class="go-detail-field"><span>Tipo</span><b>'+esc(op.type||'Operación')+'</b></div><div class="go-detail-field"><span>Reportado por</span><b>'+esc(reporter)+'</b></div><div class="go-detail-field"><span>Grupo</span><b>'+esc(op.grupo || (agency && agency.grupo) || 'No registrado')+'</b></div><div class="go-detail-field"><span>Asignación</span><b>'+esc(assignTime)+'</b></div><div class="go-detail-field"><span>Respuesta</span><b>'+esc(responseTime)+'</b></div><div class="go-detail-field"><span>Fecha de reporte</span><b>'+esc(val(function(){return formatDate(op.createdAt)},'-'))+'</b></div><div class="go-detail-field"><span>Última actualización</span><b>'+esc(val(function(){return formatDate(op.completedAt||op.startedAt||op.assignedAt||op.createdAt)},'-'))+'</b></div><div class="go-detail-field full"><span>Tipos seleccionados</span><div class="go-detail-pillrow">'+(specific&&specific.length?specific.map(function(x){return '<span class="go-detail-pill"><i class="fas fa-tag"></i>'+esc(x)+'</span>';}).join(''):'<span class="go-detail-pill">Sin tipo específico</span>')+'</div></div></div>'+(agency?'<div class="go-detail-actions"><a class="btn btn-primary" href="'+esc(mapsUrl)+'" target="_blank" rel="noopener"><i class="fas fa-location-dot"></i> Ver ubicación</a><a class="btn btn-secondary" href="'+esc(dirUrl)+'" target="_blank" rel="noopener"><i class="fas fa-route"></i> Cómo llegar</a></div>':'')+'</div><div class="go-detail-panel"><h4><i class="fas fa-clock-rotate-left"></i> Seguimiento</h4>'+buildTimeline(op)+'</div><div class="go-detail-panel"><h4><i class="fas fa-image"></i> Evidencia inicial</h4>'+mediaBlock(op.images,'evidencia inicial')+'</div><div class="go-detail-panel"><h4><i class="fas fa-square-check"></i> Evidencia de resultado</h4>'+mediaBlock(op.resultImages,'evidencia de resultado')+'</div><div class="go-detail-panel" style="grid-column:1/-1"><h4><i class="fas fa-map-location-dot"></i> Datos de ubicación</h4><div class="go-detail-grid"><div class="go-detail-field"><span>Referencia</span><b>'+esc(agency ? (agency.direccion||agency.nombre||op.agency) : (op.agency||'-'))+'</b></div><div class="go-detail-field"><span>Coordenadas</span><b>'+esc(geo)+'</b></div></div></div></section></div>';
      modal.classList.remove('hidden');
    }catch(err){ console.error('Detalle v211 falló, usando detalle original:',err); if(typeof originalShowDetail==='function') return originalShowDetail(id); }
  };

  var originalDelete = window.deleteOperation;
  window.deleteOperation = async function(id){
    var op = (typeof loadOperations==='function' ? loadOperations() : []).find(function(item){return String(item.id)===String(id);});
    var ok = await window.lotekaConfirm({title:'Eliminar operación',text:'Vas a eliminar '+(op?(op.code+' · '+op.title):'esta operación')+'.',note:'Esta acción quitará el registro del listado y sincronizará la eliminación con el backend configurado.',confirmText:'Eliminar',icon:'fa-trash-can'});
    if(!ok){ window.lotekaToast('Acción cancelada','La operación no fue eliminada.','info',2800); return; }
    if(typeof originalDelete==='function') originalDelete(id);
    window.lotekaToast('Operación eliminada','El registro fue eliminado correctamente.','success');
  };

  var originalSaveEdited = window.saveEditedOperation;
  if(typeof originalSaveEdited==='function'){
    window.saveEditedOperation = async function(){ var before=(typeof loadOperations==='function'?JSON.stringify(loadOperations()):''); var r=await originalSaveEdited.apply(this,arguments); setTimeout(function(){ try{ var after=(typeof loadOperations==='function'?JSON.stringify(loadOperations()):''); if(after!==before) window.lotekaToast('Cambios guardados','La operación fue actualizada correctamente.','success'); }catch(e){} },250); return r; };
  }
  window.addEventListener('DOMContentLoaded', function(){
    var btn=document.getElementById('saveOperationBtn'); if(btn && !btn.dataset.goV211Toast){ btn.dataset.goV211Toast='1'; btn.addEventListener('click', function(){ var before=(typeof loadOperations==='function'?JSON.stringify(loadOperations()):''); setTimeout(function(){ try{ var after=(typeof loadOperations==='function'?JSON.stringify(loadOperations()):''); if(after!==before) window.lotekaToast('Operación registrada','El nuevo reporte fue guardado correctamente.','success'); }catch(e){} },650); }, true); }
  });
})();

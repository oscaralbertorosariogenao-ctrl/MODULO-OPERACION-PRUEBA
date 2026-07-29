
(function(){
  'use strict';
  if(window.__lotekaV301AgencyOperationalMovementsFix) return;
  window.__lotekaV301AgencyOperationalMovementsFix = true;

  function txt(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return txt(v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];}); }
  function digits(v){ return txt(v).replace(/\D+/g,''); }
  function norm(v){ return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function arr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function fmtDate(value){
    if(!value) return '-';
    try{
      var d = new Date(String(value).length === 10 ? String(value) + 'T00:00:00' : value);
      return Number.isNaN(d.getTime()) ? txt(value) : d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'});
    }catch(e){ return txt(value) || '-'; }
  }
  function fmtDateTime(value){
    if(!value) return '-';
    try{
      var d = new Date(String(value).length === 10 ? String(value) + 'T00:00:00' : value);
      return Number.isNaN(d.getTime()) ? txt(value) : d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    }catch(e){ return txt(value) || '-'; }
  }
  function agencyNumber(agencia){
    return digits(agencia && (agencia.numero || agencia.codigo || agencia.agencia || agencia.go || (agencia.detalle && (agencia.detalle.go || agencia.detalle.numeroVisible))));
  }
  function operationAgencyCandidates(record){
    return [
      record && record.agency_number,
      record && record.agencia,
      record && record.agency,
      record && record.agencia_label,
      record && record.location,
      record && record.codigo_agencia,
      record && record.agencyCode,
      record && record.numero_agencia,
      record && record.agencyNumber,
      record && record.go,
      record && record.ltk
    ].map(txt).filter(Boolean);
  }
  function operationMatchesAgency(record, agencia){
    var num = agencyNumber(agencia);
    if(!num) return false;
    var padded = num.padStart(4,'0');
    var candidates = operationAgencyCandidates(record);
    return candidates.some(function(value){
      var valueDigits = digits(value);
      return valueDigits === num ||
             valueDigits === padded ||
             valueDigits.indexOf(padded) !== -1 ||
             valueDigits.indexOf(num) !== -1 ||
             norm(value).indexOf(norm(num)) !== -1 ||
             norm(value).indexOf(norm(padded)) !== -1;
    });
  }
  function normalizeOpForAgency(row){
    row = row || {};
    var status = row.status || row.estado || 'Pendiente';
    var type = row.type || row.tipo || 'Avería';
    var selected = arr(row.selectedTypes && row.selectedTypes.length ? row.selectedTypes : row.trabajos_seleccionados);
    if(!selected.length && row.titulo) selected = [row.titulo];
    return Object.assign({}, row, {
      id: row.id || row.$id || row.backendCero_id || row.codigo || '',
      code: row.code || row.codigo || row.id || '',
      type: type,
      tipo: type,
      title: row.title || row.titulo || row.categoria || 'Reporte',
      description: row.description || row.descripcion || '',
      status: status,
      estado: status,
      agency: row.agency || row.agencia_label || row.agencia || row.location || '',
      agency_number: row.agency_number || row.agencia || row.codigo_agencia || '',
      grupo: row.grupo || row.group || '',
      technician: row.technician || row.tecnico || row.asignado_a || row.responsable || row.owner || row.supplier || row.suplidor || 'Sin asignar',
      selectedTypes: selected,
      createdAt: row.createdAt || row.fecha_creacion || row.creado_en || row.created_at || '',
      updatedAt: row.updatedAt || row.actualizado_en || row.updated_at || '',
      completedAt: row.completedAt || row.fecha_completado || row.completado_en || row.closedAt || '',
      images: arr(row.images && row.images.length ? row.images : row.fotos_reportadas || row.foto_url),
      resultImages: arr(row.resultImages && row.resultImages.length ? row.resultImages : row.fotos_evidencia)
    });
  }
 function readStoredOperations(){
  /*
    OPERACIONES / CAPA A2 - Paso 5A:
    Centro de consultas/agencias ya no usa operations_records.
    Usa memoria segura alimentada por Supabase/loadOperations().
  */
  try{
    if(typeof window.loadOperations === 'function'){
      var loaded = window.loadOperations();
      if(Array.isArray(loaded)) return loaded.map(normalizeOpForAgency);
    }
  }catch(e){}

  try{
    if(Array.isArray(window.operations)){
      return window.operations.map(normalizeOpForAgency);
    }
  }catch(e){}

  try{
    if(typeof operations !== 'undefined' && Array.isArray(operations)){
      return operations.map(normalizeOpForAgency);
    }
  }catch(e){}

  try{
    if(Array.isArray(window.__lotekaOperationsMemory)){
      return window.__lotekaOperationsMemory.map(normalizeOpForAgency);
    }
  }catch(e){}

  return [];
}

  window.agencyRecordMatches = operationMatchesAgency;
  window.agencyLoadOperationsRecords = readStoredOperations;
  window.agencyGetWorksForAgency = function(agencia){
    return readStoredOperations()
      .filter(function(item){ return norm(item.type || item.tipo) === 'trabajo' && operationMatchesAgency(item, agencia); })
      .sort(function(a,b){ return new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0); });
  };
  window.agencyGetOperationsForAgency = function(agencia){
    return readStoredOperations()
      .filter(function(item){ return operationMatchesAgency(item, agencia); })
      .sort(function(a,b){ return new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0); });
  };
  window.agencyRenderDashboard = function(agencia){
    var works = window.agencyGetWorksForAgency(agencia);
    var ops = window.agencyGetOperationsForAgency(agencia);
    var levs = [];
    try{ levs = typeof window.agencyGetLevsForAgency === 'function' ? window.agencyGetLevsForAgency(agencia) : []; }catch(e){ levs = []; }
    var pending = ops.filter(function(item){ return !norm(item.status || item.estado).includes('complet'); }).length +
      levs.filter(function(item){ var st = norm(item.workflowStatus || item.estado || item.status); return !st.includes('complet') && !st.includes('archiv'); }).length;
    var latestLev = levs[0];
    var latestOp = ops[0];
    var latestWork = works[0];
    var latestTech = (latestLev && (latestLev.technician || latestLev.responsible)) || (latestOp && latestOp.technician) || '-';
    var set = function(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; };
    set('detalleAgenciaTrabajos', works.length);
    set('detalleAgenciaLevantamientos', levs.length);
    set('detalleAgenciaPendientes', pending);
    set('detalleAgenciaUltimoTecnico', latestTech);

    var summary = document.getElementById('agencyDashboardSummary');
    if(summary){
      summary.innerHTML = 'La agencia <strong>' + esc(String((agencia && agencia.numero) || '').padStart(4,'0')) + '</strong> tiene <strong>' +
        esc(String(ops.length)) + '</strong> movimiento(s) operativo(s), <strong>' + esc(String(works.length)) +
        '</strong> trabajo(s) y <strong>' + esc(String(levs.length)) + '</strong> levantamiento(s) técnico(s) vinculados. ' +
        'El último movimiento quedó en estado <strong>' + esc((latestOp && (latestOp.status || latestOp.estado)) || 'Sin movimientos') + '</strong>.';
    }

    var timeline = document.getElementById('agencyDashboardTimeline');
    if(timeline){
      var items = [];
      ops.slice(0,4).forEach(function(item){
        var label = (item.type || item.tipo || 'Operación') + ' · ' + (item.status || item.estado || 'Pendiente');
        items.push('<div class="lev-mini-item"><div><strong>' + esc(item.code || item.codigo || item.id || 'Operación') + '</strong><span>' + esc((item.title || item.titulo || 'Movimiento operativo') + ' · ' + label) + '</span></div><b>' + esc(fmtDateTime(item.completedAt || item.updatedAt || item.createdAt)) + '</b></div>');
      });
      if(latestLev){
        items.push('<div class="lev-mini-item"><div><strong>' + esc(latestLev.code || 'Levantamiento') + '</strong><span>' + esc(latestLev.executiveSummary || latestLev.type || latestLev.category || '') + '</span></div><b>' + esc(fmtDate(latestLev.visitDate || latestLev.submittedAt || '')) + '</b></div>');
      }
      timeline.innerHTML = items.length ? items.join('') : '<div class="lev-empty">Sin movimientos registrados.</div>';
    }
  };

  function rerenderOpenAgency(){
    try{
      if(typeof window.agenciaDetalleActualIndex !== 'undefined' && window.agenciaDetalleActualIndex !== null && Array.isArray(window.agencias)){
        var agencia = window.agencias[window.agenciaDetalleActualIndex];
        if(agencia && typeof window.agencyRenderDashboard === 'function') window.agencyRenderDashboard(agencia);
        if(agencia && typeof window.agencyRenderWorks === 'function') window.agencyRenderWorks(agencia);
      }
    }catch(e){}
  }
  var oldSync = window.syncOperationsFromBackendCero;
  if(typeof oldSync === 'function' && !oldSync.__lotekaV301AgencyMovementsWrapped){
    window.syncOperationsFromBackendCero = async function(){
      var r = await oldSync.apply(this, arguments);
      setTimeout(rerenderOpenAgency, 120);
      return r;
    };
    window.syncOperationsFromBackendCero.__lotekaV301AgencyMovementsWrapped = true;
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(rerenderOpenAgency, 800); });
})();

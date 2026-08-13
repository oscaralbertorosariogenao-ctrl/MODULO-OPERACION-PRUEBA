
(function(){
  'use strict';

  const OPS_TABLE = 'reportes_operaciones';
  const EVIDENCE_TABLE = 'operacion_evidencias';
  const SUPABASE_URL = 'https://tnymrjxdhzdmpcbilftj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueW1yanhkaHpkbXBjYmlsZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.YXG9juChbJUUdsdy01Qkoh9X0-MijewD5aQbKnG9Itk';
  let opsClient = null;
  let opsRealtimeChannel = null;
  let opsRefreshBusy = false;

  function client(){
    if(window.lotekaSupabase) return window.lotekaSupabase;
    if(opsClient) return opsClient;
    if(window.supabase && window.supabase.createClient){
      opsClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return opsClient;
    }
    return null;
  }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function arr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [v].filter(Boolean) : []); }
  function uniqueUrls(values){
    const seen = new Set();
    return arr(values).map(function(item){
      if(typeof item === 'string') return txt(item);
      if(item && typeof item === 'object') return txt(item.url_r2 || item.url || item.publicUrl || item.public_url);
      return '';
    }).filter(function(url){
      if(!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }
  function evidenceRowsForStage(rows, stage){
    return arr(rows).filter(function(row){ return txt(row && row.etapa).toUpperCase() === stage; });
  }
  function attachR2Evidence(op, rows){
    rows = arr(rows).filter(function(row){ return row && !row.eliminado_en && txt(row.url_r2); });
    const reportUrls = uniqueUrls(evidenceRowsForStage(rows, 'REPORTE'));
    const resultUrls = uniqueUrls(rows.filter(function(row){ return txt(row.etapa).toUpperCase() !== 'REPORTE'; }));
    op.images = uniqueUrls([].concat(arr(op.images), reportUrls));
    op.resultImages = uniqueUrls([].concat(arr(op.resultImages), resultUrls));
    op.r2Evidence = rows.slice();
    op.evidenciasR2 = rows.slice();
    return op;
  }
  async function fetchEvidenceByOperationIds(ids){
    const sb = client();
    const map = new Map();
    const cleanIds = Array.from(new Set(arr(ids).map(txt).filter(Boolean)));
    if(!sb || !cleanIds.length) return map;
    for(let i=0;i<cleanIds.length;i+=200){
      const chunk = cleanIds.slice(i,i+200);
      const response = await sb.from(EVIDENCE_TABLE)
        .select('id,operacion_id,incidencia_id,usuario_id,etapa,storage_provider,bucket,object_key,url_r2,nombre_archivo,mime_type,tamano_bytes,comentario,metadata,creado_en,eliminado_en')
        .in('operacion_id', chunk)
        .is('eliminado_en', null)
        .order('creado_en', { ascending:true });
      if(response.error){
        console.warn('[LOTEKA] No se pudieron hidratar evidencias R2:', response.error);
        continue;
      }
      (response.data || []).forEach(function(row){
        const id = txt(row.operacion_id);
        if(!id) return;
        if(!map.has(id)) map.set(id, []);
        map.get(id).push(row);
      });
    }
    return map;
  }
  function nowIso(){ return new Date().toISOString(); }
  function safeJsonClone(v){ try{ return JSON.parse(JSON.stringify(v)); }catch(e){ return v; } }
  function toast(title, body, tone){
    try{ if(typeof showToastNotification === 'function') showToastNotification(title, body, tone || 'info'); }
    catch(e){ console.warn(title, body); }
  }
  function refreshOpsUI(){
    ['renderOperations','renderDashboard','renderHistory','renderReports','renderAgencyReports','renderOwnerReports','renderSpecificReports','populateAdvancedReportDropdowns'].forEach(function(fn){
      try{ if(typeof window[fn] === 'function') window[fn](); else if(typeof eval(fn) === 'function') eval(fn)(); }catch(e){}
    });
  }
  function normalizeStatus(value){
    const v = txt(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(v.includes('soporte') || v.includes('remot')) return 'Resuelto por soporte remoto';
    if(v.includes('incid')) return 'En incidencia';
    if(v.includes('complet') || v.includes('cerrad') || v.includes('finaliz')) return 'Completado';
    if(v.includes('proceso') || v.includes('inici')) return 'En proceso';
    if(v.includes('asign')) return 'Asignado';
    return 'Reportado';
  }
  const TERMINAL_OPERATION_STATUSES = Object.freeze(['Completado','Resuelto por soporte remoto']);
  const ACTIVE_OPERATION_STATUSES = Object.freeze(['Asignado','En proceso','En incidencia']);
  function isTerminalOperationStatus(value){ return TERMINAL_OPERATION_STATUSES.includes(normalizeStatus(value)); }
  function isActiveOperationStatus(value){ return ACTIVE_OPERATION_STATUSES.includes(normalizeStatus(value)); }

  // Fuente canónica de estados para la web moderna. El legacy anterior conserva
  // sus adaptadores hasta migrarlo por dominio, pero los módulos nuevos deben usar esto.
  const operationStatusApi = Object.freeze({
    normalizeOperationStatus: normalizeStatus,
    isTerminalOperationStatus,
    isActiveOperationStatus,
    terminalStatuses: TERMINAL_OPERATION_STATUSES,
    activeStatuses: ACTIVE_OPERATION_STATUSES
  });
  if(window.GOApp){
    window.GOApp.operations = window.GOApp.operations || {};
    window.GOApp.operations.status = operationStatusApi;
    try{ window.GOApp.modules && window.GOApp.modules.register('operations.status', { version:'1.0.0', api:operationStatusApi }); }catch(_error){}
  }
  function normalizeAgency(value){
    if(typeof normalizeAgencyNumber === 'function') return normalizeAgencyNumber(value);
    const d = txt(value).replace(/\D/g,'');
    return d ? d.padStart(4,'0') : txt(value);
  }
  function makeCode(index){ return 'OP-' + String(Number(index || 0) + 1).padStart(4, '0'); }
  function dataUrlInfo(dataUrl){
    const raw = txt(dataUrl);
    const m = raw.match(/^data:([^;]+);base64,(.+)$/);
    if(!m) return null;
    const extMap = { 'image/jpeg':'jpg', 'image/jpg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif' };
    return { contentType: m[1], base64: m[2], extension: extMap[m[1]] || 'jpg' };
  }
  async function uploadOneToR2(value, operationReference, stage){
    const raw = txt(value);
    if(!raw || !raw.startsWith('data:')) return raw;
    const info = dataUrlInfo(raw);
    if(!info) return raw;
    if(!operationReference) throw new Error('No se puede subir evidencia sin una operación persistida.');
    const res = await fetch('/api/r2-upload', {
      method: 'POST',
      headers: await window.lotekaGetApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        operacion_id: operationReference,
        codigo: operationReference,
        folder: operationReference,
        etapa: stage || 'SEGUIMIENTO',
        origen: 'web-legacy-bridge-v80825',
        filename: 'evidencia-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + info.extension,
        contentType: info.contentType,
        base64: info.base64
      })
    });
    const json = await res.json().catch(function(){ return {}; });
    if(!res.ok || !json.ok || !json.url || !json.evidencia) throw new Error(json.message || json.error || 'La evidencia no quedó confirmada en R2 + Supabase.');
    return json.url;
  }
  function opStateNormText(value){
    return txt(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function normalizeWorkArray(value){
    if(Array.isArray(value)){
      return value.map(function(item){
        if(typeof item === 'string') return txt(item);
        if(item && typeof item === 'object') return txt(item.name || item.nombre || item.titulo || item.title || item.descripcion || item.description || '');
        return '';
      }).filter(Boolean);
    }
    if(typeof value === 'string'){
      try{
        const parsed = JSON.parse(value);
        if(Array.isArray(parsed)) return normalizeWorkArray(parsed);
      }catch(e){}
      return value.split(/[|,;]/).map(txt).filter(Boolean);
    }
    return [];
  }

  function getOperationWorkListForAgencyState(op){
    op = op || {};
    const works = []
      .concat(normalizeWorkArray(op.trabajos_seleccionados))
      .concat(normalizeWorkArray(op.selectedTypes))
      .concat(normalizeWorkArray(op.selected_types))
      .concat(normalizeWorkArray(op.workTypes))
      .concat(normalizeWorkArray(op.tipos))
      .concat(normalizeWorkArray(op.tipo_trabajo));
    const deduped = [];
    const seen = new Set();
    works.forEach(function(item){
      const clean = txt(item);
      const key = opStateNormText(clean);
      if(!clean || seen.has(key)) return;
      seen.add(key);
      deduped.push(clean);
    });
    return deduped;
  }

  function getGeneratedAgencyOperationalState(op, works){
    op = op || {};
    works = Array.isArray(works) ? works : getOperationWorkListForAgencyState(op);
    const operationType = opStateNormText(op.type || op.tipo || '');
    const operationStatus = normalizeStatus(op.status || op.estado || 'Reportado');
    if(!operationType.includes('trab')) return '';
    if(operationStatus === 'Completado') return '';
    const hay = works.map(opStateNormText).join(' | ');
    if(hay.includes('trabajo a agencia nueva')) return 'EN CONSTRUCCIÓN';
    if(hay.includes('remodelacion a agencia')) return 'REMODELACIÓN';
    return '';
  }

  function agencyNumberForOperationalState(value){
    const raw = txt(value);
    if(!raw) return '';
    try{
      if(typeof normalizeAgency === 'function'){
        const n = txt(normalizeAgency(raw));
        if(n) return n;
      }
    }catch(e){}
    const digits = raw.replace(/\D+/g, '');
    if(!digits) return raw;
    const num = Number(digits);
    return Number.isFinite(num) ? String(num) : digits.replace(/^0+/, '') || digits;
  }

  function applyAgencyOperationalStateLocal(agencyValue, newState, payload){
    const agencyNum = agencyNumberForOperationalState(agencyValue);
    if(!agencyNum) return;

    const updateOne = function(a){
      if(!a) return false;
      const candidates = [a.numero, a.codigo, a.agencia, a.numero_agencia, a.num_agencia, a.id_agencia, a.id, a.nombre].map(agencyNumberForOperationalState).filter(Boolean);
      if(!candidates.includes(agencyNum)) return false;
      if(!a.detalle) a.detalle = {};
      const uiState = normalizeOperationalStateForAgency(newState);
      a.estado_operativo = uiState;
      a.estadoOperativo = uiState;
      a.estado = uiState;
      a.status = uiState;
      a.estado_agencia = uiState;
      a.detalle.estadoOperativo = uiState;
      a.estado_operativo_operacion_id = payload.id;
      a.estado_operativo_motivo = buildAgencyOperationalStateMotive(payload) || payload.estado_operativo_generado || '';
      a.estado_operativo_actualizado_en = nowIso();
      return true;
    };

    try{ if(Array.isArray(window.agencias)) window.agencias.forEach(updateOne); }catch(e){}
    try{ if(typeof agencias !== 'undefined' && Array.isArray(agencias)) agencias.forEach(updateOne); }catch(e){}

    ['agencyMapRefresh','renderAgencies','renderAgencyList','renderDashboard','refreshUI'].forEach(function(fn){
      try{ if(typeof window[fn] === 'function') window[fn](); else if(typeof eval(fn) === 'function') eval(fn)(); }catch(e){}
    });
  }

  async function findAgencyForOperationalState(sb, agencyValue){
    const normalized = agencyNumberForOperationalState(agencyValue);
    const candidates = [txt(agencyValue), normalized, normalized ? String(Number(normalized)) : ''].filter(Boolean);
    const columns = ['numero','codigo','agencia','numero_agencia','num_agencia','id_agencia','id'];
    for(const col of columns){
      for(const value of candidates){
        try{
          const { data, error } = await sb.from('agencias').select('*').eq(col, value).limit(1);
          if(error) continue;
          if(Array.isArray(data) && data.length) return { row:data[0], column:col, value:value };
        }catch(e){}
      }
    }
    return null;
  }

  function buildAgencyOperationalStateMotive(payload){
    payload = payload || {};
    const works = normalizeWorkArray(payload.trabajos_seleccionados);
    const base = txt(payload.titulo || payload.title || payload.estado_operativo_generado || 'Trabajo operativo');
    const extra = works.length ? (' · ' + works.join(' | ')) : '';
    return (base + extra).slice(0, 500);
  }

  async function applyAgencyOperationalStateFromPayload(payload, savedRow){
    try{
      const newState = txt(payload && payload.estado_operativo_generado);
      if(!payload || !payload.afecta_estado_operativo || !newState) return false;
      const sb = client();
      if(!sb) return false;
      const agencyValue = txt(payload.agencia || payload.agencia_label || '');
      if(!agencyValue) return false;

      const found = await findAgencyForOperationalState(sb, agencyValue);
      if(!found){
        applyAgencyOperationalStateLocal(agencyValue, newState, payload);
        toast('Estado operativo local', 'No encontré la agencia en Supabase, pero actualicé la vista local.', 'warning');
        return false;
      }

      const before = txt(found.row.estado_operativo || found.row.estadoOperativo || found.row.estado || 'Activa');
      const normalizedAgencyState = normalizeOperationalStateForAgency(newState);
      const updatePayload = {
        estado_operativo: normalizedAgencyState,
        estadoOperativo: normalizedAgencyState,
        estado: normalizedAgencyState,
        status: normalizedAgencyState,
        estado_agencia: normalizedAgencyState,
        estado_operativo_operacion_id: txt(payload.id),
        estado_operativo_motivo: txt(buildAgencyOperationalStateMotive(payload) || payload.titulo || payload.estado_operativo_generado),
        estado_operativo_actualizado_en: nowIso(),
        estado_operativo_actualizado_por: currentOperationReporterName()
      };

      let updateResult = await sb.from('agencias').update(updatePayload).eq(found.column, found.value);
      if(updateResult.error){
        const missing = missingColumnFromSupabaseErrorV303 ? missingColumnFromSupabaseErrorV303(updateResult.error) : '';
        if(missing && Object.prototype.hasOwnProperty.call(updatePayload, missing)){
          delete updatePayload[missing];
          updateResult = await sb.from('agencias').update(updatePayload).eq(found.column, found.value);
        }
      }
      if(updateResult.error){
        const fallbackPayload = {
          estado_operativo: normalizedAgencyState,
          estado_operativo_operacion_id: txt(payload.id),
          estado_operativo_motivo: txt(buildAgencyOperationalStateMotive(payload) || payload.titulo || payload.estado_operativo_generado),
          estado_operativo_actualizado_en: nowIso(),
          estado_operativo_actualizado_por: currentOperationReporterName()
        };
        updateResult = await sb.from('agencias').update(fallbackPayload).eq(found.column, found.value);
      }
      if(updateResult.error) throw updateResult.error;

      try{
        await sb.from('agencia_estados_historial').insert({
          agencia: agencyNumberForOperationalState(agencyValue),
          estado_anterior: before || null,
          estado_nuevo: normalizedAgencyState,
          motivo: txt(buildAgencyOperationalStateMotive(payload) || payload.titulo || ''),
          operacion_id: txt(payload.id),
          operacion_codigo: txt(payload.codigo),
          usuario: (window.lotekaAuthState && window.lotekaAuthState.user && (window.lotekaAuthState.user.email || window.lotekaAuthState.user.id)) || 'Sistema web',
          usuario_nombre: (window.lotekaAuthState && window.lotekaAuthState.perfil && (window.lotekaAuthState.perfil.nombre || window.lotekaAuthState.perfil.nombre_completo)) || 'Sistema web'
        });
      }catch(historyError){
        console.warn('[LOTEKA] No se pudo guardar historial de estado operativo:', historyError);
      }

      applyAgencyOperationalStateLocal(agencyValue, newState, payload);
      toast('Estado operativo actualizado', 'Agencia ' + agencyNumberForOperationalState(agencyValue) + ' → ' + normalizedAgencyState, 'success');
      return true;
    }catch(error){
      console.error('[LOTEKA] No se pudo aplicar estado operativo de agencia:', error);
      toast('Estado operativo no actualizado', error && error.message ? error.message : 'Revisa tabla agencias.', 'warning');
      return false;
    }
  }

  async function uploadListToR2(list, operationReference, stage){
    const output = [];
    for(const item of arr(list)) output.push(await uploadOneToR2(item, operationReference, stage));
    return output.filter(Boolean);
  }
  function currentOperationReporterName(){
    try{
      const st = window.lotekaAuthState || {};
      const perfil = st.perfil || {};
      const user = st.user || {};
      return txt(
        perfil.nombre_completo ||
        perfil.nombre ||
        perfil.name ||
        perfil.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        'Sistema web'
      );
    }catch(e){
      return 'Sistema web';
    }
  }

  function normalizeOperationalStateForAgency(value){
    const v = opStateNormText(value);
    if(v.includes('constru') || v.includes('creacion') || v.includes('apertura')) return 'EN CONSTRUCCIÓN';
    if(v.includes('proceso')) return 'EN PROCESO';
    if(v.includes('remodel')) return 'REMODELACIÓN';
    if(v.includes('cerrad') || v.includes('desactiv') || v.includes('inactiv')) return 'DESACTIVADA/CERRADA';
    return 'ACTIVA';
  }

  function opToPayload(op){
    const normalized = (typeof enrichOperationWithAgencyContext === 'function') ? enrichOperationWithAgencyContext(op || {}) : (op || {});
    const reported = arr(normalized.images);
    const evidence = arr(normalized.resultImages);
    const mainPhoto = evidence[0] || reported[0] || normalized.foto_url || '';
    const id = txt(normalized.id || normalized.backendCero_id || normalized.$id || (crypto.randomUUID ? crypto.randomUUID() : ('op-' + Date.now())));
    const selectedWorks = getOperationWorkListForAgencyState(normalized);
    const generatedOperationalState = getGeneratedAgencyOperationalState(normalized, selectedWorks);
    return {
      id,
      codigo: txt(normalized.code || id).slice(0, 80),
      tipo: txt(normalized.type || 'Avería').slice(0, 80),
      titulo: txt(normalized.title || normalized.categoria || 'Reporte').slice(0, 500),
      descripcion: txt(normalized.description || normalized.descripcion || '').slice(0, 5000),
      estado: normalizeStatus(normalized.status || normalized.estado || 'Reportado'),
      agencia: txt(normalized.agency_number || normalized.agencia || normalizeAgency(normalized.agency || '') || normalized.agency || '').slice(0, 255),
      agencia_label: txt(normalized.agency_label || normalized.agency || '').slice(0, 255),
      grupo: txt(normalized.grupo || '').slice(0, 255),
      tecnico: txt(normalized.technician || normalized.asignado_a || 'Sin asignar').slice(0, 255),
      encargado: txt(normalized.created_by || normalized.reportado_por_nombre || currentOperationReporterName()).slice(0, 255),
      creado_por: txt(normalized.created_by || normalized.reportado_por_nombre || currentOperationReporterName()).slice(0, 255),
      reportado_por_nombre: txt(normalized.reportado_por_nombre || normalized.created_by || currentOperationReporterName()).slice(0, 255),
      foto_url: txt(mainPhoto).slice(0, 2000),
      fotos_reportadas: reported,
      fotos_evidencia: evidence,
      fecha_creacion: normalized.createdAt || normalized.fecha_creacion || normalized.fecha_reporte || nowIso(),
      fecha_asignacion: normalized.assignedAt || normalized.fecha_asignacion || null,
      fecha_inicio: normalized.startedAt || normalized.fecha_inicio || null,
      fecha_completado: normalized.completedAt || normalized.closedAt || normalized.fecha_completado || null,
      tiempo_asignacion: Number.isFinite(getAssignmentMinutes(normalized)) ? Math.round(getAssignmentMinutes(normalized)) : null,
      tiempo_asignacion_label: Number.isFinite(getAssignmentMinutes(normalized)) ? formatMinutesHuman(getAssignmentMinutes(normalized)) : null,
      tiempo_respuesta: Number.isFinite(getResponseMinutes(normalized)) ? Math.round(getResponseMinutes(normalized)) : null,
      tiempo_respuesta_label: Number.isFinite(getResponseMinutes(normalized)) ? formatMinutesHuman(getResponseMinutes(normalized)) : null,
      tiempo_resolucion: Number.isFinite(getResolutionMinutes(normalized)) ? formatMinutesHuman(getResolutionMinutes(normalized)) : txt(normalized.resolutionTime || '').slice(0, 255),
      tiempo_resolucion_minutos: Number.isFinite(getResolutionMinutes(normalized)) ? Math.round(getResolutionMinutes(normalized)) : null,
      historial: Array.isArray(normalized.history) ? normalized.history : [],
      source: txt(normalized.source || 'web_operacional').slice(0, 80),
      trabajos_seleccionados: selectedWorks,
      categoria_visible: txt(normalized.categoria_visible || normalized.categoriaVisible || '').slice(0, 120),
      problema_reportado: txt(normalized.problema_reportado || normalized.problemaReportado || '').slice(0, 255),
      estado_agencia_reportado: txt(normalized.estado_agencia_reportado || normalized.estadoAgenciaReportado || normalized.problema_reportado || '').slice(0, 255),
      trabajo_a_realizar: txt(normalized.trabajo_a_realizar || normalized.trabajoARealizar || '').slice(0, 255),
      origen_reporte: txt(normalized.origen_reporte || normalized.origenReporte || normalized.source || 'web_operacional').slice(0, 120),
      reportado_por_rol: txt(normalized.reportado_por_rol || normalized.reportadoPorRol || '').slice(0, 120),
      asignacion_trabajo_fecha: normalized.asignacion_trabajo_fecha || normalized.asignacionTrabajoFecha || null,
      asignacion_trabajo_usuario: txt(normalized.asignacion_trabajo_usuario || normalized.asignacionTrabajoUsuario || '').slice(0, 255),
      asignacion_trabajo_comentario: txt(normalized.asignacion_trabajo_comentario || normalized.asignacionTrabajoComentario || '').slice(0, 1000),
      afecta_estado_operativo: !!generatedOperationalState,
      estado_operativo_generado: generatedOperationalState || null,
      estado_operativo_aplicado: !!generatedOperationalState,
      actualizado_en: nowIso(),
      actualizado_por: window.lotekaAuthState && window.lotekaAuthState.user ? window.lotekaAuthState.user.id : null
    };
  }
  function rowToOp(row, index, existing){
    existing = existing || {};
    const agencyNumber = normalizeAgency(row.agencia || existing.agency_number || existing.agency || '');
    const createdAt = row.reportado_at || row.fecha_creacion || existing.createdAt || nowIso();
    const reported = arr(row.fotos_reportadas).length ? arr(row.fotos_reportadas) : arr(existing.images || row.foto_url);
    const evidence = arr(row.fotos_evidencia).length ? arr(row.fotos_evidencia) : arr(existing.resultImages);
    const op = {
      ...existing,
      id: row.id || existing.id || (crypto.randomUUID ? crypto.randomUUID() : ('op-' + Date.now())),
      backendCero_id: row.id || existing.backendCero_id || null,
      $id: row.id || existing.$id || null,
      code: row.codigo || existing.code || makeCode(index),
      type: row.tipo || existing.type || 'Avería',
      title: row.titulo || existing.title || 'Reporte',
      agency: row.agencia_label || existing.agency || (agencyNumber && typeof normalizeAgencyLabel === 'function' ? normalizeAgencyLabel(agencyNumber) : agencyNumber),
      agency_number: agencyNumber,
      agency_label: row.agencia_label || existing.agency_label || '',
      grupo: row.grupo || existing.grupo || '',
      technician: row.tecnico || existing.technician || 'Sin asignar',
            status: normalizeStatus(row.estado || existing.status || 'Reportado'),
      description: row.descripcion || existing.description || '',
      selectedTypes: Array.isArray(existing.selectedTypes) && existing.selectedTypes.length ? existing.selectedTypes : (normalizeWorkArray(row.trabajos_seleccionados).length ? normalizeWorkArray(row.trabajos_seleccionados) : (row.titulo ? [row.titulo] : [])),
      categoria_visible: row.categoria_visible || existing.categoria_visible || existing.categoriaVisible || '',
      categoriaVisible: row.categoria_visible || existing.categoriaVisible || existing.categoria_visible || '',
      problema_reportado: row.problema_reportado || existing.problema_reportado || existing.problemaReportado || '',
      problemaReportado: row.problema_reportado || existing.problemaReportado || existing.problema_reportado || '',
      estado_agencia_reportado: row.estado_agencia_reportado || existing.estado_agencia_reportado || existing.estadoAgenciaReportado || '',
      estadoAgenciaReportado: row.estado_agencia_reportado || existing.estadoAgenciaReportado || existing.estado_agencia_reportado || '',
      trabajo_a_realizar: row.trabajo_a_realizar || existing.trabajo_a_realizar || existing.trabajoARealizar || '',
      trabajoARealizar: row.trabajo_a_realizar || existing.trabajoARealizar || existing.trabajo_a_realizar || '',
      origen_reporte: row.origen_reporte || existing.origen_reporte || existing.origenReporte || '',
      origenReporte: row.origen_reporte || existing.origenReporte || existing.origen_reporte || '',
      reportado_por_rol: row.reportado_por_rol || existing.reportado_por_rol || existing.reportadoPorRol || '',
      reportadoPorRol: row.reportado_por_rol || existing.reportadoPorRol || existing.reportado_por_rol || '',
      asignacion_trabajo_fecha: row.asignacion_trabajo_fecha || existing.asignacion_trabajo_fecha || existing.asignacionTrabajoFecha || null,
      asignacionTrabajoFecha: row.asignacion_trabajo_fecha || existing.asignacionTrabajoFecha || existing.asignacion_trabajo_fecha || null,
      asignacion_trabajo_usuario: row.asignacion_trabajo_usuario || existing.asignacion_trabajo_usuario || existing.asignacionTrabajoUsuario || '',
      asignacionTrabajoUsuario: row.asignacion_trabajo_usuario || existing.asignacionTrabajoUsuario || existing.asignacion_trabajo_usuario || '',
      asignacion_trabajo_comentario: row.asignacion_trabajo_comentario || existing.asignacion_trabajo_comentario || existing.asignacionTrabajoComentario || '',
      asignacionTrabajoComentario: row.asignacion_trabajo_comentario || existing.asignacionTrabajoComentario || existing.asignacion_trabajo_comentario || '',
      createdAt: row.reportado_at || createdAt,
      assignedAt: row.asignado_at || row.fecha_asignacion || existing.assignedAt || null,
      startedAt: row.iniciado_at || row.fecha_inicio || existing.startedAt || null,
      completedAt: row.completado_at || row.fecha_completado || row.resuelto_remoto_at || existing.completedAt || null,
      technicianId: row.tecnico_id || existing.technicianId || null,
      reporterId: row.reportado_por_id || existing.reporterId || null,
      assignerId: row.asignado_por_id || existing.assignerId || null,
      operationOriginId: row.operacion_origen_id || existing.operationOriginId || null,
      closedAt: row.fecha_completado || existing.closedAt || null,
      responseTime: row.tiempo_respuesta_label || existing.responseTime || '',
      tiempo_respuesta: row.tiempo_respuesta ?? existing.tiempo_respuesta ?? null,
      tiempo_respuesta_label: row.tiempo_respuesta_label || existing.tiempo_respuesta_label || '',
      resolutionTime: row.tiempo_resolucion || existing.resolutionTime || '',
      images: reported,
      resultImages: evidence,
      history: Array.isArray(row.historial) ? row.historial : (Array.isArray(existing.history) ? existing.history : []),
      source: row.source || 'web_operacional',
      afecta_estado_operativo: !!row.afecta_estado_operativo || !!existing.afecta_estado_operativo,
      estado_operativo_generado: row.estado_operativo_generado || existing.estado_operativo_generado || '',
      estado_operativo_aplicado: !!row.estado_operativo_aplicado || !!existing.estado_operativo_aplicado,
      nombre_encargado: row.reportado_por_nombre || row.creado_por || row.encargado || existing.nombre_encargado || existing.created_by || '',
      created_by: row.creado_por || row.reportado_por_nombre || row.encargado || existing.created_by || existing.nombre_encargado || '',
      reportado_por_nombre: row.reportado_por_nombre || row.creado_por || row.encargado || existing.reportado_por_nombre || existing.created_by || existing.nombre_encargado || ''
    };
    return (typeof enrichOperationWithAgencyContext === 'function') ? enrichOperationWithAgencyContext(op) : op;
  }
  async function fetchAllOps(){
    const sb = client();
    if(!sb) throw new Error('Supabase no está disponible.');
    let from = 0, all = [];
    while(true){
      const { data, error } = await sb.from(OPS_TABLE).select('*').order('fecha_creacion', { ascending: false }).range(from, from + 999);
      if(error) throw error;
      const chunk = Array.isArray(data) ? data : [];
      all = all.concat(chunk);
      if(chunk.length < 1000) break;
      from += 1000;
      if(from > 50000) break;
    }
    return all;
  }
  function applyRealtimeOperationRowV300(payload){
    try{
      payload = payload || {};
      const eventType = String(payload.eventType || '').toUpperCase();
      const row = payload.new || payload.old || {};
      const rowId = txt(row.id || row.$id || row.codigo || '');
      if(!rowId || typeof loadOperations !== 'function' || typeof saveOperations !== 'function') return false;

      const current = loadOperations() || [];
      const existingIndex = current.findIndex(function(op){
        return txt(op.id) === rowId || txt(op.backendCero_id) === rowId || txt(op.$id) === rowId || txt(op.code) === rowId || txt(op.codigo) === rowId;
      });

      if(eventType === 'DELETE'){
        const nextDelete = current.filter(function(op, idx){
          return idx !== existingIndex && txt(op.id) !== rowId && txt(op.backendCero_id) !== rowId && txt(op.$id) !== rowId;
        });
        saveOperations(nextDelete);
        refreshOpsUI();
        return true;
      }

      if(!payload.new) return false;
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const mapped = rowToOp(payload.new, existingIndex >= 0 ? existingIndex : 0, existing);
      const next = current.slice();
      if(existingIndex >= 0) next[existingIndex] = mapped;
      else next.unshift(mapped);

      saveOperations(next);
      try{ if(typeof evaluateOperationNotifications === 'function') evaluateOperationNotifications(next); }catch(e){}
      refreshOpsUI();
      return true;
    }catch(error){
      console.warn('[LOTEKA] No se pudo aplicar realtime incremental de operaciones:', error);
      return false;
    }
  }

  function missingColumnFromSupabaseErrorV303(error){
    const msg = txt(error && (error.message || error.details || error.hint || ''));
    const m =
      msg.match(/Could not find the '([^']+)' column/i) ||
      msg.match(/'([^']+)'\s+column/i) ||
      msg.match(/column\s+"([^"]+)"/i);
    return m ? m[1] : '';
  }

  async function safeUpsertOperationPayload(sb, payload){
    let current = { ...(payload || {}) };

    for(let i = 0; i < 12; i++){
      const result = await sb.from(OPS_TABLE).upsert(current, { onConflict: 'id' }).select('*').single();

      if(!result.error) return result;

      const missing = missingColumnFromSupabaseErrorV303(result.error);
      const code = txt(result.error.code);

      if((code === 'PGRST204' || missing) && missing && Object.prototype.hasOwnProperty.call(current, missing)){
        console.warn('[LOTEKA] Campo removido del payload de reportes_operaciones porque no existe:', missing);
        delete current[missing];
        continue;
      }

      return result;
    }

    return {
      data: null,
      error: new Error('No se pudo guardar la operación en Supabase.')
    };
  }

  window.syncOperationsFromBackendCero = syncOperationsFromBackendCero = async function syncOperationsFromSupabaseV300(opts){
    opts = opts || {};
    try{
      const rows = await fetchAllOps();
      const evidenceByOperation = await fetchEvidenceByOperationIds(rows.map(function(row){ return row.id; }));
      const local = (typeof loadOperations === 'function') ? loadOperations() : [];
      const existingById = new Map(local.map(function(op){ return [txt(op.id), op]; }));
      const merged = rows.map(function(row, index){
        const op = rowToOp(row, index, existingById.get(txt(row.id)));
        return attachR2Evidence(op, evidenceByOperation.get(txt(row.id)) || []);
      });
      if(typeof saveOperations === 'function') saveOperations(merged);
      try{ if(typeof evaluateOperationNotifications === 'function') evaluateOperationNotifications(merged); }catch(e){}
      refreshOpsUI();
      if(!opts.silent && !opts.skipSuccessToast) toast('Operaciones conectadas', 'Datos actualizados desde Supabase.', 'success');
      return true;
    }catch(error){
      console.error('[LOTEKA] Error leyendo operaciones desde Supabase:', error);
      if(!opts.silent) toast('Supabase no cargó Operaciones', error && error.message ? error.message : 'Revisa la tabla reportes_operaciones.', 'warning');
      return false;
    }
  };
  window.syncOperationToBackendCero = syncOperationToBackendCero = async function syncOperationToSupabaseV300(op){
    try{
      const sb = client();
      if(!sb) throw new Error('Supabase no está disponible.');
      if(!op) return null;
      const pendingReported = arr(op.images);
      const pendingEvidence = arr(op.resultImages);
      // Persistir primero la operación: operacion_evidencias nunca debe apuntar a un registro inexistente.
      op.images = pendingReported.filter(function(item){ return !txt(item).startsWith('data:'); });
      op.resultImages = pendingEvidence.filter(function(item){ return !txt(item).startsWith('data:'); });
      let payload = opToPayload(op);
      op.id = payload.id;
      op.backendCero_id = payload.id;
      op.$id = payload.id;
      let saved = await safeUpsertOperationPayload(sb, payload);
      if(saved.error) throw saved.error;
      const operationReference = txt((saved.data && (saved.data.codigo || saved.data.id)) || payload.codigo || payload.id);
      op.images = await uploadListToR2(pendingReported, operationReference, 'REPORTE');
      op.resultImages = await uploadListToR2(pendingEvidence, operationReference, 'SEGUIMIENTO');
      payload = opToPayload(op);
      saved = await safeUpsertOperationPayload(sb, payload);
      const data = saved.data, error = saved.error;
      if(error) throw error;
      try{ await applyAgencyOperationalStateFromPayload(payload, data); }catch(stateError){ console.warn('[LOTEKA] Estado operativo omitido:', stateError); }
      try{ if(typeof syncAgenciesFromBackendCero === 'function') setTimeout(function(){ syncAgenciesFromBackendCero(); }, 450); }catch(e){}
      try{ refreshOpsUI(); }catch(e){}
      return data;
    }catch(error){
      console.error('[LOTEKA] Error sincronizando operación con Supabase:', error);
      toast('No se guardó en Supabase', error && error.message ? error.message : 'La operación quedó local.', 'warning');
      return null;
    }
  };
  window.deleteOperationFromBackendCero = deleteOperationFromBackendCero = async function deleteOperationFromSupabaseV300(id){
    try{
      const sb = client();
      if(!sb || !id) return;
      const { error } = await sb.from(OPS_TABLE).delete().eq('id', id);
      if(error) throw error;
    }catch(error){
      console.error('[LOTEKA] Error eliminando operación en Supabase:', error);
      toast('No se eliminó en Supabase', error && error.message ? error.message : 'Revisa permisos.', 'warning');
    }
  };
  window.initializeRealtimeSync = initializeRealtimeSync = function initializeRealtimeSupabaseV300(){
    const sb = client();
    if(!sb || opsRealtimeChannel) return;
    try{
      opsRealtimeChannel = sb.channel('loteka-operaciones-reportes-operaciones-v80822')
        .on('postgres_changes', { event: '*', schema: 'public', table: OPS_TABLE }, function(payload){
          const row = payload.new || payload.old || {};
          if(payload.eventType === 'INSERT') toast('Nuevo reporte recibido', (row.codigo || row.id || 'Operación') + ' · ' + (row.agencia || 'Sin agencia'), 'success');
          if(payload.eventType === 'UPDATE') toast('Operación actualizada', (row.codigo || row.id || 'Operación') + ' · ' + (row.estado || ''), row.estado === 'Completado' ? 'success' : 'info');
          if(payload.eventType === 'DELETE') toast('Operación eliminada', row.codigo || row.id || 'Registro removido', 'warning');
          const appliedIncrementally = applyRealtimeOperationRowV300(payload);
          if(!appliedIncrementally && !opsRefreshBusy){
            opsRefreshBusy = true;
            setTimeout(function(){ opsRefreshBusy = false; window.syncOperationsFromBackendCero({ silent:true, skipSuccessToast:true }); }, 1200);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: EVIDENCE_TABLE }, function(){
          if(opsRefreshBusy) return;
          opsRefreshBusy = true;
          setTimeout(function(){
            opsRefreshBusy = false;
            window.syncOperationsFromBackendCero({ silent:true, skipSuccessToast:true });
          }, 350);
        })
        .subscribe(function(status){ console.info('[LOTEKA] Realtime Operaciones/Evidencias Supabase:', status); });
    }catch(error){
      console.error('[LOTEKA] No se pudo activar realtime de operaciones:', error);
    }
  };
  window.lotekaSyncOperacionesSupabase = function(){ return window.syncOperationsFromBackendCero({ silent:false, skipSuccessToast:false }); };
  function boot(){
    try{ window.initializeRealtimeSync(); }catch(e){}
    setTimeout(function(){ window.syncOperationsFromBackendCero({ silent:true, skipSuccessToast:true }); }, 1200);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

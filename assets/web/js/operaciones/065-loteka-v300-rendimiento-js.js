
(function(){
  'use strict';

  if(window.__lotekaRendimientoV300RepairApplied) return;
  window.__lotekaRendimientoV300RepairApplied = true;

  var REND_TABLE = 'reportes_operaciones';
  var cache = [];
  var cacheMeta = {
    source: 'sin cargar',
    localTotal: 0,
    supabaseTotal: 0,
    combinedTotal: 0,
    completedTotal: 0,
    filteredTotal: 0,
    averiasTotal: 0,
    trabajosTotal: 0,
    responsablesTotal: 0,
    lastError: ''
  };
  var cacheAt = 0;
  var loadingPromise = null;
  var activeView = 'general';
  var activePeriod = 'week';
  var activeDetail = '';
  var currentRows = [];
  var currentAll = [];

  function byId(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function low(v){
    return clean(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();
  }
  function esc(v){
    return clean(v).replace(/[&<>'"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }
  function arr(v){
    if(Array.isArray(v)) return v.filter(function(x){ return clean(x); });
    if(v == null || v === '') return [];
    if(typeof v === 'string'){
      try{
        var parsed = JSON.parse(v);
        if(Array.isArray(parsed)) return parsed.filter(function(x){ return clean(x); });
      }catch(_e){}
      return v.split(',').map(function(x){ return clean(x); }).filter(Boolean);
    }
    return [v].filter(function(x){ return clean(x); });
  }
  function dateObj(v){
    if(!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function value(o, keys){
    o = o || {};
    for(var i=0;i<keys.length;i++){
      var k = keys[i];
      if(o[k] !== undefined && o[k] !== null && clean(o[k]) !== '') return o[k];
    }
    return '';
  }
  function numberValue(v){
    if(v === null || v === undefined || v === '') return null;
    if(typeof v === 'string' && /[a-zñáéíóú]/i.test(v)){
      var h = v.match(/(\d+)\s*h/i);
      var m = v.match(/(\d+)\s*min/i);
      var d = v.match(/(\d+)\s*d/i);
      var total = 0;
      if(d) total += Number(d[1]) * 1440;
      if(h) total += Number(h[1]) * 60;
      if(m) total += Number(m[1]);
      return total || null;
    }
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function minutesBetween(a,b){
    a = dateObj(a); b = dateObj(b);
    if(!a || !b || b < a) return null;
    return Math.round((b.getTime() - a.getTime()) / 60000);
  }
  function setHtml(id, html){
    var el = byId(id);
    if(el) el.innerHTML = html;
  }
  function fmtDate(v){
    var d = dateObj(v);
    if(!d) return 'Sin dato';
    try{
      return d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'});
    }catch(_e){
      return d.toLocaleDateString();
    }
  }
  function fmtMinutes(m){
    if(m == null || isNaN(m) || m < 0) return 'Sin dato';
    m = Math.round(Number(m));
    if(m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var r = m % 60;
    if(h < 24) return h + ' h' + (r ? ' ' + r + ' min' : '');
    var d = Math.floor(h / 24);
    var hh = h % 24;
    return d + ' d' + (hh ? ' ' + hh + ' h' : '');
  }
  function avg(rows, key){
    var vals = rows.map(function(x){ return x[key]; }).filter(function(v){ return v != null && !isNaN(v); });
    if(!vals.length) return null;
    return Math.round(vals.reduce(function(sum,n){ return sum + Number(n); }, 0) / vals.length);
  }
  function groupBy(rows, fn){
    return rows.reduce(function(map,row){
      var key = clean(fn(row)) || 'Sin dato';
      (map[key] = map[key] || []).push(row);
      return map;
    }, {});
  }
  function uniqKey(o){
    return clean(value(o, ['id','backendCero_id','$id','codigo','code','referencia'])) ||
      clean(value(o, ['titulo','title'])) + '|' + clean(value(o, ['agencia','agency'])) + '|' + clean(value(o, ['fecha_creacion','createdAt']));
  }
  function mergeUnique(){
    var map = new Map();
    Array.prototype.slice.call(arguments).forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(item){
        if(!item || typeof item !== 'object') return;
        var key = uniqKey(item);
        if(!key) return;
        var current = map.get(key) || {};
        map.set(key, Object.assign({}, current, item));
      });
    });
    return Array.from(map.values());
  }
  function safeResolveName(v, type){
    var raw = clean(v);
    try{
      if(typeof window.lotekaResolveRealUserName === 'function'){
        var a = window.lotekaResolveRealUserName(raw);
        if(clean(a)) return clean(a);
      }
    }catch(_e){}
    try{
      if(typeof window.getAssigneeDisplayName === 'function'){
        var b = window.getAssigneeDisplayName(raw, type || '');
        if(clean(b)) return clean(b);
      }
    }catch(_e){}
    return raw;
  }

  function opCode(o){
    return clean(value(o, ['code','codigo','referencia','id','$id'])) || 'OP-S/D';
  }
  function opTitle(o){
    return clean(value(o, [
      'title','titulo','categoria_visible','categoriaVisible','problema_reportado','problemaReportado',
      'trabajo_a_realizar','trabajoARealizar','description','descripcion'
    ])) || 'Operación completada';
  }
  function opDescription(o){
    return clean(value(o, ['description','descripcion','observaciones','comentario','problema_reportado','problemaReportado'])) || '';
  }
  function opAgency(o){
    var agency = clean(value(o, ['agency','agencia','agencia_label','agencyLabel','agencia_nombre','agencia_numero','agency_number','numero_agencia']));
    var group = clean(value(o, ['grupo','group','grupo_codigo','grupo_nombre']));
    if(!agency) agency = 'Sin agencia';
    return group && low(agency).indexOf(low(group)) < 0 ? agency + ' · ' + group : agency;
  }
  function opAgencyOnly(o){
    return clean(value(o, ['agency','agencia','agencia_label','agencyLabel','agencia_nombre','agencia_numero','agency_number','numero_agencia'])) || 'Sin agencia';
  }
  function opGroup(o){
    var g = clean(value(o, ['grupo','group','grupo_codigo','grupo_nombre']));
    if(g) return g;
    var a = opAgency(o);
    var m = a.match(/grupo\s*([0-9]{1,3})/i) || a.match(/·\s*([0-9]{1,3})/);
    return m ? m[1] : '';
  }
  function opStatus(o){
    return clean(value(o, ['status','estado','estado_operacion'])) || '';
  }
  function isCompleted(o){
    var s = low(opStatus(o));
    return s.indexOf('complet') >= 0 ||
      s.indexOf('cerrad') >= 0 ||
      s.indexOf('finaliz') >= 0 ||
      !!completedDate(o);
  }
  function createdDate(o){
    return value(o, ['createdAt','fecha_creacion','created_at','fecha_reporte','creado_en','created']);
  }
  function assignedDate(o){
    return value(o, ['assignedAt','fecha_asignacion','assigned_at','asignado_en']);
  }
  function startedDate(o){
    return value(o, ['startedAt','fecha_inicio','started_at','iniciado_en']);
  }
  function completedDate(o){
    return value(o, [
      'completedAt','fecha_completado','completed_at','closedAt','closed_at','fecha_cierre',
      'fecha_resuelto','completado_en','updated_at','actualizado_en','fecha_actualizacion'
    ]);
  }
  function specificTypes(o){
    var selected = arr(value(o, ['selectedTypes','trabajos_seleccionados','averias_seleccionadas','tipos_seleccionados']));
    if(selected.length) return selected;
    var t = opTitle(o);
    return t ? [t] : [];
  }
  function classify(o){
    var joined = low([
      value(o, ['type','tipo','categoria','operation_type']),
      value(o, ['categoria_visible','categoriaVisible','categoria_rendimiento','rendimiento_categoria']),
      specificTypes(o).join(' '),
      opTitle(o),
      opDescription(o)
    ].join(' '));

    if(joined.indexOf('aver') >= 0 || joined.indexOf('falla') >= 0 || joined.indexOf('internet') >= 0 || joined.indexOf('printer') >= 0) return 'Avería';
    if(joined.indexOf('trab') >= 0 || joined.indexOf('remodel') >= 0 || joined.indexOf('agencia nueva') >= 0 ||
       joined.indexOf('constru') >= 0 || joined.indexOf('toldo') >= 0 || joined.indexOf('pintura') >= 0 ||
       joined.indexOf('publicidad') >= 0 || joined.indexOf('instalaci') >= 0 || joined.indexOf('fabricaci') >= 0) return 'Trabajo';
    return low(value(o, ['type','tipo'])) === 'trabajo' ? 'Trabajo' : 'Avería';
  }
  function affectsAgencyState(o){
    var joined = low([
      value(o, ['afecta_estado_operativo','estado_operativo_generado','estado_operativo','estado_agencia_reportado','estadoAgenciaReportado']),
      value(o, ['categoria_visible','categoriaVisible','categoria_rendimiento']),
      value(o, ['trabajo_a_realizar','trabajoARealizar']),
      specificTypes(o).join(' '),
      opTitle(o),
      opDescription(o)
    ].join(' '));
    return joined.indexOf('agencia nueva') >= 0 ||
      joined.indexOf('constru') >= 0 ||
      joined.indexOf('remodel') >= 0 ||
      joined.indexOf('activaci') >= 0 ||
      joined.indexOf('cerr') >= 0 ||
      joined.indexOf('desactiv') >= 0 ||
      value(o, ['afecta_estado_operativo']) === true;
  }
  function responsibleRaw(o){
    return clean(value(o, [
      'technician','tecnico','tecnico_nombre','tecnicoName',
      'responsable','responsable_nombre','responsableName',
      'suplidor','suplidor_nombre','proveedor','proveedor_nombre',
      'assignedTo','asignado_a','asignado'
    ]));
  }
  function supplierHint(o){
    return [
      value(o, ['suplidor','suplidor_nombre','proveedor','proveedor_nombre','supplier','supplier_name']),
      value(o, ['responsable_tipo','tipo_responsable','asignado_tipo','tipo_asignado','rol_responsable','categoria_responsable']),
      responsibleRaw(o)
    ].join(' ');
  }
  function isSupplier(o){
    var s = low(supplierHint(o));
    return s.indexOf('suplidor') >= 0 ||
      s.indexOf('proveedor') >= 0 ||
      s.indexOf('servicio') >= 0 ||
      s.indexOf('servicios') >= 0 ||
      s.indexOf('srl') >= 0 ||
      s.indexOf('constructora') >= 0 ||
      s.indexOf('e-gret') >= 0 ||
      s.indexOf('egret') >= 0;
  }
  function responsibleName(o){
    var raw = responsibleRaw(o);
    return safeResolveName(raw, classify(o)) || 'Sin responsable';
  }
  function responsibleType(o){
    if(isSupplier(o)) return 'Suplidor de servicios';
    var raw = low(value(o, ['responsable_tipo','tipo_responsable','rol_responsable','tipo_asignado']));
    if(raw.indexOf('tecn') >= 0 || low(responsibleRaw(o)).indexOf('tecn') >= 0) return 'Técnico';
    return classify(o) === 'Avería' ? 'Técnico' : 'Responsable operativo';
  }
  function stageMinutes(o, keys, a, b){
    for(var i=0;i<keys.length;i++){
      var n = numberValue(value(o, [keys[i]]));
      if(n != null) return Math.round(n);
    }
    return minutesBetween(a,b);
  }
  function review(row){
    if(!row._completed) return 'Sin completar';
    if(!row._completedAt) return 'Sin dato';
    if(row._responseMinutes == null || row._resolutionMinutes == null) return 'Sin dato';
    if(row._type === 'Avería'){
      if(row._responseMinutes > 240 || row._resolutionMinutes > 480) return 'Fuera de rango';
      if(row._responseMinutes > 120 || row._resolutionMinutes > 240) return 'Requiere revisión';
      return 'Dentro del rango';
    }
    if(row._resolutionMinutes > 4320) return 'Fuera de rango';
    if(row._resolutionMinutes > 1440 || row._responseMinutes > 360) return 'Requiere revisión';
    return 'Dentro del rango';
  }
  function normalize(o){
    o = o || {};
    var type = classify(o);
    var created = createdDate(o);
    var assigned = assignedDate(o);
    var started = startedDate(o);
    var completed = completedDate(o);
    var row = Object.assign({}, o);
    row._id = clean(value(o, ['id','backendCero_id','$id'])) || opCode(o);
    row._code = opCode(o);
    row._type = type;
    row._title = opTitle(o);
    row._description = opDescription(o);
    row._agency = opAgency(o);
    row._agencyOnly = opAgencyOnly(o);
    row._group = opGroup(o);
    row._responsible = responsibleName(o);
    row._responsibleType = responsibleType(o);
    row._supplier = isSupplier(o);
    row._status = opStatus(o) || 'Completado';
    row._specificTypes = specificTypes(o);
    row._createdAt = created;
    row._assignedAt = assigned;
    row._startedAt = started;
    row._completedAt = completed;
    row._completed = isCompleted(o);
    row._affectsAgency = affectsAgencyState(o);
    row._assignmentMinutes = stageMinutes(o, ['tiempo_asignacion_minutos','tiempo_asignacion_min','tiempo_asignacion'], created, assigned);
    row._responseMinutes = stageMinutes(o, ['tiempo_respuesta_minutos','tiempo_respuesta_min','tiempo_respuesta'], assigned, started);
    row._resolutionMinutes = stageMinutes(o, ['tiempo_resolucion_minutos','tiempo_resolucion_min','tiempo_ejecucion_min','tiempo_resolucion'], started, completed);
    row._review = review(row);
    row._searchText = low([
      row._code,row._type,row._title,row._description,row._agency,row._group,row._responsible,row._responsibleType,row._specificTypes.join(' ')
    ].join(' '));
    return row;
  }

  function localOperationSources(){
    var sources = [];
    try{ if(typeof window.loadOperations === 'function') sources.push(window.loadOperations()); }catch(e){}
    try{ if(typeof loadOperations === 'function') sources.push(loadOperations()); }catch(e){}
    try{ if(Array.isArray(window.operations)) sources.push(window.operations); }catch(e){}
    try{ if(Array.isArray(window.__lotekaOperationsMemory)) sources.push(window.__lotekaOperationsMemory); }catch(e){}
    try{ if(Array.isArray(window.OPERATIONS)) sources.push(window.OPERATIONS); }catch(e){}
    try{ if(Array.isArray(window.operaciones)) sources.push(window.operaciones); }catch(e){}
    return mergeUnique.apply(null, sources);
  }
  function supabaseClient(){
    var candidates = [
      window.lotekaSupabase,
      window.supabaseClient,
      window.supabase
    ];
    for(var i=0;i<candidates.length;i++){
      if(candidates[i] && typeof candidates[i].from === 'function') return candidates[i];
    }
    return null;
  }
  async function directSupabaseRows(){
    var sb = supabaseClient();
    if(!sb) return [];
    var all = [];
    var from = 0;
    try{
      while(from < 5000){
        var res = await sb.from(REND_TABLE).select('*').range(from, from + 999);
        if(res.error) throw res.error;
        var chunk = Array.isArray(res.data) ? res.data : [];
        all = all.concat(chunk);
        if(chunk.length < 1000) break;
        from += 1000;
      }
    }catch(error){
      cacheMeta.lastError = clean(error && (error.message || error.details || error.hint)) || String(error);
      console.warn('[LOTEKA Rendimiento] Consulta directa a Supabase falló:', error);
    }
    return all;
  }

  async function cargarOperacionesParaRendimiento(force){
    if(loadingPromise) return loadingPromise;
    if(!force && cache.length && Date.now() - cacheAt < 15000) return cache;

    loadingPromise = (async function(){
      cacheMeta.lastError = '';
      var localBefore = localOperationSources();
      cacheMeta.localTotal = localBefore.length;
      var afterSync = [];

      if(force || localBefore.length < 2){
        try{
          if(typeof window.syncOperationsFromBackendCero === 'function'){
            await window.syncOperationsFromBackendCero({ silent:true, skipSuccessToast:true });
          }else if(typeof syncOperationsFromBackendCero === 'function'){
            await syncOperationsFromBackendCero({ silent:true, skipSuccessToast:true });
          }
        }catch(error){
          console.warn('[LOTEKA Rendimiento] No se pudo refrescar Gestión de operaciones:', error);
        }
        afterSync = localOperationSources();
      }

      var supabaseRows = await directSupabaseRows();
      cacheMeta.supabaseTotal = supabaseRows.length;

      var combined = mergeUnique(localBefore, afterSync, supabaseRows);
      if(!combined.length) combined = localOperationSources();

      var normalized = combined.map(normalize).sort(function(a,b){
        var da = dateObj(a._completedAt || a._createdAt);
        var db = dateObj(b._completedAt || b._createdAt);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });

      cache = normalized;
      cacheAt = Date.now();
      cacheMeta.combinedTotal = normalized.length;
      cacheMeta.completedTotal = normalized.filter(function(x){ return x._completed; }).length;
      cacheMeta.source = supabaseRows.length ? 'Gestión de operaciones + Supabase/reportes_operaciones' : 'Gestión de operaciones / memoria';
      loadingPromise = null;
      return cache;
    })();

    try{
      return await loadingPromise;
    }finally{
      loadingPromise = null;
    }
  }

  function periodRange(){
    var now = new Date();
    var end = new Date(now); end.setHours(23,59,59,999);
    var start = null;
    if(activePeriod === 'today'){
      start = new Date(now); start.setHours(0,0,0,0);
      return [start,end,'Hoy'];
    }
    if(activePeriod === 'month'){
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [start,end,'Este mes'];
    }
    if(activePeriod === 'range'){
      var d1 = byId('rendFechaDesdeV300') && byId('rendFechaDesdeV300').value;
      var d2 = byId('rendFechaHastaV300') && byId('rendFechaHastaV300').value;
      start = d1 ? new Date(d1 + 'T00:00:00') : null;
      end = d2 ? new Date(d2 + 'T23:59:59') : end;
      return [start,end,'Rango seleccionado'];
    }
    var day = now.getDay();
    var diff = day === 0 ? 6 : day - 1;
    start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0,0,0,0);
    return [start,end,'Semana actual'];
  }
  function periodMetricTitle(kind){
    var base = kind === 'averia' ? 'AVERÍAS COMPLETAS' : 'TRABAJOS COMPLETOS';
    if(activePeriod === 'today') return base + ' HOY';
    if(activePeriod === 'month') return base + ' ESTE MES';
    if(activePeriod === 'range') return base + ' EN RANGO';
    return base + ' ESTA SEMANA';
  }
  function filteredRows(all){
    var range = periodRange();
    var start = range[0], end = range[1];
    var q = low(byId('rendSearchV300') && byId('rendSearchV300').value);
    var g = low(byId('rendGrupoV300') && byId('rendGrupoV300').value);
    var r = low(byId('rendResponsableV300') && byId('rendResponsableV300').value);
    var rev = clean(byId('rendRevisionV300') && byId('rendRevisionV300').value);
    var completed = all.filter(function(row){
      if(!row._completed) return false;
      var d = dateObj(row._completedAt || row._createdAt);
      if(start && (!d || d < start)) return false;
      if(end && (!d || d > end)) return false;
      if(q && row._searchText.indexOf(q) < 0) return false;
      if(g && low([row._group,row._agency].join(' ')).indexOf(g) < 0) return false;
      if(r && low(row._responsible).indexOf(r) < 0) return false;
      if(rev && row._review !== rev) return false;
      return true;
    });

    var order = clean(byId('rendOrdenV300') && byId('rendOrdenV300').value) || 'completadas';
    if(order === 'respuesta'){
      completed.sort(function(a,b){ return (a._responseMinutes == null ? 999999 : a._responseMinutes) - (b._responseMinutes == null ? 999999 : b._responseMinutes); });
    }else if(order === 'resolucion'){
      completed.sort(function(a,b){ return (a._resolutionMinutes == null ? 999999 : a._resolutionMinutes) - (b._resolutionMinutes == null ? 999999 : b._resolutionMinutes); });
    }else if(order === 'duracion'){
      completed.sort(function(a,b){ return (b._resolutionMinutes || 0) - (a._resolutionMinutes || 0); });
    }else{
      completed.sort(function(a,b){
        var da = dateObj(a._completedAt || a._createdAt);
        var db = dateObj(b._completedAt || b._createdAt);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    }
    return completed;
  }
  function viewRows(rows, view){
    if(view === 'averias') return rows.filter(function(x){ return x._type === 'Avería'; });
    if(view === 'trabajos') return rows.filter(function(x){ return x._type === 'Trabajo'; });
    if(view === 'estado-agencia') return rows.filter(function(x){ return x._type === 'Trabajo' && x._affectsAgency; });
    return rows;
  }
  function chip(label, tone){
    return '<span class="rend-chip-v300 '+esc(tone || 'muted')+'">'+esc(label)+'</span>';
  }
  function reviewTone(v){
    if(v === 'Dentro del rango') return 'ok';
    if(v === 'Fuera de rango') return 'danger';
    if(v === 'Requiere revisión') return 'warn';
    return 'muted';
  }
  function typeChip(row){
    if(row._type === 'Avería') return chip('Avería','issue');
    if(row._affectsAgency) return chip('Trabajo / Estado agencia','work');
    return chip('Trabajo','work');
  }
  function opButton(row, label){
    return '<button type="button" class="rend-consult-btn-v300" data-rend-op-id="'+esc(row._id)+'" data-rend-op-code="'+esc(row._code)+'">'+esc(label || 'Consultar')+'</button>';
  }
  function kpis(rows, type){
    var totalText = type === 'averia' ? 'Averías completadas esta semana' : 'Trabajos completados esta semana';
    var resolveText = type === 'averia' ? 'PROM. RESOLUCIÓN' : 'PROM. EJECUCIÓN';
    return ''+
      '<div class="rend-kpi-v300"><span>'+esc(periodMetricTitle(type))+'</span><strong>'+rows.length+'</strong><small>'+esc(totalText)+'</small></div>'+
      '<div class="rend-kpi-v300"><span>PROM. ASIGNACIÓN</span><strong>'+esc(fmtMinutes(avg(rows,'_assignmentMinutes')))+'</strong><small>Tiempo en asignar la operación</small><em>Reportado → Asignado</em></div>'+
      '<div class="rend-kpi-v300"><span>PROM. RESPUESTA</span><strong>'+esc(fmtMinutes(avg(rows,'_responseMinutes')))+'</strong><small>Tiempo en tomar la operación</small><em>Asignado → En proceso</em></div>'+
      '<div class="rend-kpi-v300"><span>'+resolveText+'</span><strong>'+esc(fmtMinutes(avg(rows,'_resolutionMinutes')))+'</strong><small>Tiempo en resolver / ejecutar</small><em>En proceso → Cerrada</em></div>';
  }
  function miniItem(left, sub, right, tone){
    return '<div class="rend-mini-item-v300"><div><strong>'+esc(left)+'</strong><span>'+esc(sub)+'</span></div>'+chip(right,tone || 'muted')+'</div>';
  }
  function topResponsibleData(rows, limit, kind){
    var grouped = groupBy(rows, function(x){ return x._responsible; });
    var list = Object.keys(grouped).map(function(name){
      var xs = grouped[name];
      var supplier = xs.some(function(x){ return x._supplier; });
      return {
        name:name,
        rows:xs,
        supplier:supplier,
        type:supplier ? 'Suplidor de servicios' : (xs[0] && xs[0]._responsibleType || 'Responsable operativo'),
        total:xs.length,
        avgAssign:avg(xs,'_assignmentMinutes'),
        avgResp:avg(xs,'_responseMinutes'),
        avgResolve:avg(xs,'_resolutionMinutes'),
        averias:xs.filter(function(x){ return x._type === 'Avería'; }).length,
        trabajos:xs.filter(function(x){ return x._type === 'Trabajo'; }).length
      };
    });
    if(kind === 'averia') list = list.filter(function(x){ return !x.supplier; });
    var order = clean(byId('rendOrdenV300') && byId('rendOrdenV300').value) || 'completadas';
    list.sort(function(a,b){
      if(order === 'respuesta') return (a.avgResp == null ? 999999 : a.avgResp) - (b.avgResp == null ? 999999 : b.avgResp);
      if(order === 'resolucion') return (a.avgResolve == null ? 999999 : a.avgResolve) - (b.avgResolve == null ? 999999 : b.avgResolve);
      if(order === 'duracion') return (b.avgResolve || 0) - (a.avgResolve || 0);
      return b.total - a.total;
    });
    return list.slice(0, limit || 5);
  }
  function renderTopList(rows, kind){
    var list = topResponsibleData(rows, 5, kind);
    if(!list.length) return '<div class="rend-no-data-v300">Sin responsables para este periodo.</div>';
    return list.map(function(item,i){
      return '<div class="rend-mini-row-v300">'+
        '<div class="rend-rank-v300">'+(i+1)+'</div>'+
        '<div><b>'+esc(item.name)+'</b><small>'+esc(item.type)+' · '+item.total+' completada(s) · respuesta '+esc(fmtMinutes(item.avgResp))+'</small></div>'+
        '<button type="button" class="rend-consult-btn-v300" data-rend-person="'+esc(item.name)+'">Consultar</button>'+
      '</div>';
    }).join('');
  }
  function renderReviewList(rows){
    var list = rows.filter(function(x){ return x._review !== 'Dentro del rango'; })
      .sort(function(a,b){ return (b._resolutionMinutes || 0) - (a._resolutionMinutes || 0); })
      .slice(0,5);
    if(!list.length) return '<div class="rend-no-data-v300">Sin casos para revisión.</div>';
    return list.map(function(x){
      return '<div class="rend-mini-row-v300">'+
        '<div class="rend-rank-v300">!</div>'+
        '<div><b>'+esc(x._code)+' · '+esc(x._agencyOnly)+'</b><small>'+esc(x._title)+'</small></div>'+
        chip(x._review, reviewTone(x._review))+
        opButton(x,'Consultar')+
      '</div>';
    }).join('');
  }
  function renderGeneral(rows){
    var averias = rows.filter(function(x){ return x._type === 'Avería'; });
    var trabajos = rows.filter(function(x){ return x._type === 'Trabajo'; });
    setHtml('rendGeneralPeriodLabelV300', esc(periodRange()[2]));

    setHtml('rendGeneralAveriasTotalV300', averias.length);
    setHtml('rendGeneralAveriasAsignacionV300', esc(fmtMinutes(avg(averias,'_assignmentMinutes'))));
    setHtml('rendGeneralAveriasRespuestaV300', esc(fmtMinutes(avg(averias,'_responseMinutes'))));
    setHtml('rendGeneralAveriasResolucionV300', esc(fmtMinutes(avg(averias,'_resolutionMinutes'))));

    setHtml('rendGeneralTrabajosTotalV300', trabajos.length);
    setHtml('rendGeneralTrabajosAsignacionV300', esc(fmtMinutes(avg(trabajos,'_assignmentMinutes'))));
    setHtml('rendGeneralTrabajosRespuestaV300', esc(fmtMinutes(avg(trabajos,'_responseMinutes'))));
    setHtml('rendGeneralTrabajosResolucionV300', esc(fmtMinutes(avg(trabajos,'_resolutionMinutes'))));

    setHtml('rendTopAveriasV300', renderTopList(averias,'averia'));
    setHtml('rendTopTrabajosV300', renderTopList(trabajos,'trabajo'));
    setHtml('rendReviewAveriasV300', renderReviewList(averias));
    setHtml('rendReviewTrabajosV300', renderReviewList(trabajos));
  }
  function rankingCard(item, index, kind){
    return '<div class="rend-rank-card-v300">'+
      '<div class="rend-rank-number-v300">#'+(index+1)+'</div>'+
      '<div class="rend-rank-content-v300">'+
        '<strong>'+esc(item.name)+'</strong>'+
        '<span>'+esc(item.type)+' · '+item.total+' completada(s)</span>'+
        '<div class="rend-rank-meta-v300">'+
          chip('Asignación '+fmtMinutes(item.avgAssign),'muted')+
          chip('Respuesta '+fmtMinutes(item.avgResp),'ok')+
          chip((kind === 'trabajo' ? 'Ejecución ' : 'Resolución ') + fmtMinutes(item.avgResolve), kind === 'trabajo' && item.avgResolve > 1440 ? 'warn' : 'ok')+
          chip(item.averias+' avería(s)','issue')+
          chip(item.trabajos+' trabajo(s)','work')+
        '</div>'+
      '</div>'+
      '<button type="button" class="rend-consultar-v300" data-rend-person="'+esc(item.name)+'">Consultar</button>'+
    '</div>';
  }
  function renderResponsables(rows){
    var averias = rows.filter(function(x){ return x._type === 'Avería'; });
    var trabajos = rows.filter(function(x){ return x._type === 'Trabajo'; });
    var topA = topResponsibleData(averias, 10, 'averia');
    var topT = topResponsibleData(trabajos, 10, 'trabajo');
    setHtml('rendRankingAveriasV300', topA.length ? topA.map(function(x,i){ return rankingCard(x,i,'averia'); }).join('') : '<div class="rend-no-data-v300">Sin responsables de averías para este periodo.</div>');
    setHtml('rendRankingTrabajosV300', topT.length ? topT.map(function(x,i){ return rankingCard(x,i,'trabajo'); }).join('') : '<div class="rend-no-data-v300">Sin responsables de trabajos para este periodo.</div>');
  }
  function renderSingleBlock(targetId, rows, kind){
    var title = kind === 'averia' ? 'Top responsables de averías' : 'Top responsables de trabajos';
    var html = '<div class="rend-kpi-grid-v300">'+kpis(rows, kind)+'</div>'+
      '<div class="rend-mini-grid-v300">'+
        '<div><h5>'+esc(title)+'</h5><div class="rend-mini-list-v300">'+renderTopList(rows, kind)+'</div></div>'+
        '<div><h5>Requieren revisión</h5><div class="rend-mini-list-v300">'+renderReviewList(rows)+'</div></div>'+
      '</div>';
    setHtml(targetId, html);
  }
  function renderTabs(rows){
    renderGeneral(rows);
    renderResponsables(rows);
    renderSingleBlock('rendAveriasContentV300', viewRows(rows,'averias'), 'averia');
    renderSingleBlock('rendTrabajosContentV300', viewRows(rows,'trabajos'), 'trabajo');

    var estadoRows = viewRows(rows,'estado-agencia');
    var html = '<div class="rend-kpi-grid-v300">'+kpis(estadoRows, 'trabajo')+'</div>'+
      '<div class="rend-mini-grid-v300">'+
        '<div><h5>Responsables / suplidores</h5><div class="rend-mini-list-v300">'+renderTopList(estadoRows,'trabajo')+'</div></div>'+
        '<div><h5>Agencias afectadas</h5><div class="rend-mini-list-v300">'+renderAgencyAffected(estadoRows)+'</div></div>'+
      '</div>';
    setHtml('rendEstadoAgenciaContentV300', html);
  }
  function renderAgencyAffected(rows){
    var grouped = groupBy(rows, function(x){ return x._agency; });
    var list = Object.keys(grouped).map(function(k){ return {agency:k, rows:grouped[k]}; })
      .sort(function(a,b){ return b.rows.length - a.rows.length; }).slice(0,5);
    if(!list.length) return '<div class="rend-no-data-v300">Sin cambios de estado de agencia en este periodo.</div>';
    return list.map(function(item){
      var last = item.rows[0] || {};
      return miniItem(item.agency, item.rows.length+' trabajo(s) completado(s) · último: '+(last._code || '-'), 'Consultar', 'work');
    }).join('');
  }
  function detailTitle(view){
    if(view === 'averias') return ['Detalle de averías completadas','Solo averías completadas en el periodo seleccionado.'];
    if(view === 'trabajos') return ['Detalle de trabajos completados','Solo trabajos completados en el periodo seleccionado.'];
    if(view === 'estado-agencia') return ['Detalle de estado de agencia','Trabajos completados que afectaron estado operativo de agencias.'];
    return ['Detalle completo','Solo operaciones completadas según filtros aplicados.'];
  }
  function renderDetailRows(rows){
    if(!rows.length) return '<tr><td colspan="10" class="muted-empty">Sin operaciones completadas para mostrar.</td></tr>';
    return rows.map(function(x){
      return '<tr>'+
        '<td><span class="rend-code-v300">'+esc(x._code)+'</span></td>'+
        '<td>'+typeChip(x)+'</td>'+
        '<td>'+esc(x._agency)+'</td>'+
        '<td><strong>'+esc(x._responsible)+'</strong><br><small>'+esc(x._responsibleType)+'</small></td>'+
        '<td>'+esc(fmtDate(x._completedAt))+'</td>'+
        '<td>'+chip(fmtMinutes(x._assignmentMinutes),'muted')+'</td>'+
        '<td>'+chip(fmtMinutes(x._responseMinutes),'ok')+'</td>'+
        '<td>'+chip(fmtMinutes(x._resolutionMinutes), x._type === 'Trabajo' && x._resolutionMinutes > 1440 ? 'warn' : 'ok')+'</td>'+
        '<td>'+chip(x._review, reviewTone(x._review))+'</td>'+
        '<td>'+opButton(x,'Consultar')+'</td>'+
      '</tr>';
    }).join('');
  }
  function showDetailTable(view){
    activeDetail = view || activeView || 'general';
    var rows = viewRows(currentRows, activeDetail);
    if(activeDetail === 'responsables') rows = currentRows;
    var t = detailTitle(activeDetail);
    setHtml('rendDetailTitleV300', esc(t[0]));
    setHtml('rendDetailSubtitleV300', esc(t[1]));
    setHtml('rendDetailBodyV300', renderDetailRows(rows));
    var box = byId('rendDetailTableWrapV300');
    if(box) box.classList.add('open');
    setTimeout(function(){
      try{ box && box.scrollIntoView({behavior:'smooth',block:'start'}); }catch(_e){}
    },50);
  }
  function openView(name){
    activeView = name || 'general';
    document.querySelectorAll('#vista-ops-rendimiento .rend-tabs-v300 button').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-rend-view') === activeView);
    });
    document.querySelectorAll('#vista-ops-rendimiento .rend-view-v300').forEach(function(view){
      view.classList.remove('active');
    });
    var map = {
      general:'rendViewGeneralV300',
      responsables:'rendViewResponsablesV300',
      averias:'rendViewAveriasV300',
      trabajos:'rendViewTrabajosV300',
      'estado-agencia':'rendViewEstadoAgenciaV300'
    };
    var el = byId(map[activeView] || map.general);
    if(el) el.classList.add('active');
  }
  async function render(force){
    var root = byId('vista-ops-rendimiento');
    if(!root || root.classList.contains('hidden')) return;
    var all = await cargarOperacionesParaRendimiento(!!force);
    currentAll = all;
    currentRows = filteredRows(all);
    cacheMeta.filteredTotal = currentRows.length;
    cacheMeta.averiasTotal = currentRows.filter(function(x){ return x._type === 'Avería'; }).length;
    cacheMeta.trabajosTotal = currentRows.filter(function(x){ return x._type === 'Trabajo'; }).length;
    cacheMeta.responsablesTotal = Object.keys(groupBy(currentRows,function(x){ return x._responsible; })).length;

    renderTabs(currentRows);

    var empty = byId('rendEmptyV300');
    if(empty) empty.classList.toggle('show', currentRows.length === 0);

    var openDetail = byId('rendDetailTableWrapV300');
    if(openDetail && openDetail.classList.contains('open')) showDetailTable(activeDetail || activeView);
  }

  function sheetRows(name){
    return currentRows.filter(function(x){ return x._responsible === name; });
  }
  function sheetCards(rows, supplier){
    var display = supplier ? rows.filter(function(x){ return x._type === 'Trabajo'; }) : rows;
    return '<div class="rend-sheet-grid-v300">'+
      '<div class="rend-sheet-card-v300"><small>'+(supplier ? esc(periodMetricTitle('trabajo')) : 'OP. COMPLETAS ESTA SEMANA')+'</small><strong>'+display.length+'</strong><span>Operaciones completadas esta semana</span></div>'+
      '<div class="rend-sheet-card-v300"><small>PROM. ASIGNACIÓN</small><strong>'+esc(fmtMinutes(avg(display,'_assignmentMinutes')))+'</strong><span>Tiempo en asignar la operación<br>Reportado → Asignado</span></div>'+
      '<div class="rend-sheet-card-v300"><small>PROM. RESPUESTA</small><strong>'+esc(fmtMinutes(avg(display,'_responseMinutes')))+'</strong><span>Tiempo en tomar la operación<br>Asignado → En proceso</span></div>'+
      '<div class="rend-sheet-card-v300"><small>'+(supplier ? 'PROM. EJECUCIÓN' : 'PROM. RESOLUCIÓN')+'</small><strong>'+esc(fmtMinutes(avg(display,'_resolutionMinutes')))+'</strong><span>Tiempo en resolver / ejecutar<br>En proceso → Cerrada</span></div>'+
    '</div>';
  }
  function rowsPanel(title, rows){
    if(!rows.length) return '<div class="rend-no-data-v300">Sin '+esc(title.toLowerCase())+' para este periodo.</div>';
    return '<div class="rend-card-list-v300">'+rows.slice(0,10).map(function(x){
      return '<div class="rend-time-row-v300">'+
        '<div class="rend-rank-v300">'+esc(x._code).replace(/^OP-/,'')+'</div>'+
        '<div><b>'+esc(x._agency)+'</b><small>'+esc(x._title)+' · '+esc(fmtDate(x._completedAt))+'</small></div>'+
        chip(x._review, reviewTone(x._review))+
        opButton(x,'Consultar')+
      '</div>';
    }).join('')+'</div>';
  }
  function timePanel(rows){
    var averias = rows.filter(function(x){ return x._type === 'Avería'; });
    var trabajos = rows.filter(function(x){ return x._type === 'Trabajo'; });
    function block(title, list, tone){
      return '<div class="rend-sheet-panel-v300"><h4>'+esc(title)+'</h4>'+
        '<div class="rend-card-list-v300">'+
          miniItem('Prom. asignación', fmtMinutes(avg(list,'_assignmentMinutes')), title, tone)+
          miniItem('Prom. respuesta', fmtMinutes(avg(list,'_responseMinutes')), title, tone)+
          miniItem('Prom. resolución / ejecución', fmtMinutes(avg(list,'_resolutionMinutes')), title, tone)+
        '</div></div>';
    }
    return '<div class="rend-sheet-two-v300">'+block('Averías', averias, 'issue')+block('Trabajos', trabajos, 'work')+'</div>';
  }
  function agenciesPanel(rows){
    var grouped = groupBy(rows, function(x){ return x._agency; });
    var list = Object.keys(grouped).map(function(k){ return {agency:k, rows:grouped[k]}; })
      .sort(function(a,b){ return b.rows.length - a.rows.length; });
    if(!list.length) return '<div class="rend-no-data-v300">Sin agencias atendidas.</div>';
    return '<div class="table-wrap"><table class="rend-table-v300"><thead><tr><th>Agencia</th><th>Grupo</th><th>Operaciones</th><th>Averías</th><th>Trabajos</th><th>Última operación</th></tr></thead><tbody>'+
      list.map(function(item){
        var last = item.rows[0] || {};
        return '<tr><td>'+esc(item.agency)+'</td><td>'+esc(last._group || '-')+'</td><td>'+item.rows.length+'</td><td>'+item.rows.filter(function(x){ return x._type === 'Avería'; }).length+'</td><td>'+item.rows.filter(function(x){ return x._type === 'Trabajo'; }).length+'</td><td>'+esc(last._code || '-')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function openSheet(name){
    var rows = sheetRows(name);
    if(!rows.length) return;
    var supplier = rows.some(function(x){ return x._supplier; });
    var workRows = rows.filter(function(x){ return x._type === 'Trabajo'; });
    var issueRows = rows.filter(function(x){ return x._type === 'Avería'; });

    setHtml('rendSheetNameV300', esc(name));
    setHtml('rendSheetSubtitleV300', esc((supplier ? 'Suplidor de servicios · Trabajos completados' : 'Técnico / responsable · Averías y trabajos separados') + ' · ' + periodRange()[2]));

    var issueTab = byId('rendSheetTabAveriasV300');
    if(issueTab) issueTab.classList.toggle('hidden', supplier);

    setHtml('rendSheetResumenV300',
      sheetCards(rows, supplier) +
      '<div class="rend-sheet-two-v300">'+
        '<div class="rend-sheet-panel-v300"><h4>Averías</h4>'+ (supplier ? '<div class="rend-no-data-v300">No aplica para suplidores de servicios.</div>' : rowsPanel('Averías', issueRows)) +'</div>'+
        '<div class="rend-sheet-panel-v300"><h4>Trabajos</h4>'+rowsPanel('Trabajos', workRows)+'</div>'+
      '</div>'
    );
    setHtml('rendSheetAveriasV300', supplier ? '<div class="rend-no-data-v300">No aplica para suplidores de servicios.</div>' : rowsPanel('Averías', issueRows));
    setHtml('rendSheetTrabajosV300', rowsPanel('Trabajos', workRows));
    setHtml('rendSheetOperacionesV300', '<div class="table-wrap"><table class="rend-table-v300"><thead><tr><th>Código</th><th>Tipo</th><th>Agencia</th><th>Fecha completada</th><th>Asignación</th><th>Respuesta</th><th>Resolución/Ejecución</th><th>Revisión</th><th>Ver</th></tr></thead><tbody>'+renderDetailRows(supplier ? workRows : rows).replace(/<td><strong>.*?<\/td>/g,'')+'</tbody></table></div>');
    setHtml('rendSheetTiemposV300', timePanel(supplier ? workRows : rows));
    setHtml('rendSheetAgenciasV300', agenciesPanel(supplier ? workRows : rows));

    document.querySelectorAll('#rendSheetTabsV300 button').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-sheet-tab') === 'resumen');
    });
    document.querySelectorAll('#vista-ops-rendimiento .rend-sheet-view-v300').forEach(function(view){
      view.classList.remove('active');
    });
    var resumen = byId('rendSheetResumenV300');
    if(resumen) resumen.classList.add('active');

    var sheet = byId('rendSheetV300');
    if(sheet){ sheet.classList.add('open'); sheet.setAttribute('aria-hidden','false'); }
  }
  function closeSheet(){
    var sheet = byId('rendSheetV300');
    if(sheet){ sheet.classList.remove('open'); sheet.setAttribute('aria-hidden','true'); }
  }
  function consultOperation(id, code){
    var row = currentAll.concat(currentRows).find(function(x){
      return clean(x._id) === clean(id) || clean(x._code) === clean(code);
    });
    var opId = row ? (row.id || row.backendCero_id || row.$id || row._id || row._code) : (id || code);
    try{
      if(typeof window.showDetail === 'function') return window.showDetail(opId);
      if(typeof showDetail === 'function') return showDetail(opId);
      if(typeof window.openOperationDetail === 'function') return window.openOperationDetail(opId);
      if(typeof window.verOperacion === 'function') return window.verOperacion(opId);
    }catch(error){
      console.warn('[LOTEKA Rendimiento] No se pudo abrir detalle real:', error);
    }
  }

  function bind(){
    document.querySelectorAll('#vista-ops-rendimiento .rend-tabs-v300 button').forEach(function(btn){
      if(btn.__rendV300Bound) return;
      btn.__rendV300Bound = true;
      btn.addEventListener('click', function(){
        openView(btn.getAttribute('data-rend-view'));
        render(false);
      });
    });

    document.querySelectorAll('#rendPeriodButtonsV300 button').forEach(function(btn){
      if(btn.__rendV300Bound) return;
      btn.__rendV300Bound = true;
      btn.addEventListener('click', function(){
        activePeriod = btn.getAttribute('data-period') || 'week';
        document.querySelectorAll('#rendPeriodButtonsV300 button').forEach(function(item){
          item.classList.toggle('active', item === btn);
        });
        var adv = byId('rendAdvancedPanelV300');
        if(adv && activePeriod === 'range') adv.classList.add('open');
        render(false);
      });
    });

    var toggle = byId('rendAdvancedToggleV300');
    if(toggle && !toggle.__rendV300Bound){
      toggle.__rendV300Bound = true;
      toggle.addEventListener('click', function(){
        var panel = byId('rendAdvancedPanelV300');
        if(panel) panel.classList.toggle('open');
      });
    }

    ['rendSearchV300','rendFechaDesdeV300','rendFechaHastaV300','rendGrupoV300','rendResponsableV300','rendRevisionV300','rendOrdenV300'].forEach(function(id){
      var el = byId(id);
      if(el && !el.__rendV300Bound){
        el.__rendV300Bound = true;
        el.addEventListener(id === 'rendSearchV300' ? 'input' : 'change', function(){ render(false); });
      }
    });

    var clear = byId('rendClearFiltersV300');
    if(clear && !clear.__rendV300Bound){
      clear.__rendV300Bound = true;
      clear.addEventListener('click', function(){
        ['rendSearchV300','rendFechaDesdeV300','rendFechaHastaV300','rendGrupoV300','rendResponsableV300','rendRevisionV300'].forEach(function(id){
          var el = byId(id); if(el) el.value = '';
        });
        activePeriod = 'week';
        document.querySelectorAll('#rendPeriodButtonsV300 button').forEach(function(btn){
          btn.classList.toggle('active', btn.getAttribute('data-period') === 'week');
        });
        render(true);
      });
    }

    var apply = byId('rendApplyFiltersV300');
    if(apply && !apply.__rendV300Bound){
      apply.__rendV300Bound = true;
      apply.addEventListener('click', function(){ render(true); });
    }

    document.querySelectorAll('#vista-ops-rendimiento [data-rend-detail]').forEach(function(btn){
      if(btn.__rendV300Bound) return;
      btn.__rendV300Bound = true;
      btn.addEventListener('click', function(){ showDetailTable(btn.getAttribute('data-rend-detail')); });
    });

    var hide = byId('rendHideDetailV300');
    if(hide && !hide.__rendV300Bound){
      hide.__rendV300Bound = true;
      hide.addEventListener('click', function(){
        var box = byId('rendDetailTableWrapV300');
        if(box) box.classList.remove('open');
      });
    }

    document.addEventListener('click', function(e){
      var person = e.target && e.target.closest ? e.target.closest('[data-rend-person]') : null;
      if(person){
        e.preventDefault();
        openSheet(person.getAttribute('data-rend-person'));
        return;
      }

      var op = e.target && e.target.closest ? e.target.closest('[data-rend-op-id],[data-rend-op-code]') : null;
      if(op){
        e.preventDefault();
        consultOperation(op.getAttribute('data-rend-op-id'), op.getAttribute('data-rend-op-code'));
      }
    }, true);

    var close = byId('rendCloseSheetV300');
    if(close && !close.__rendV300Bound){
      close.__rendV300Bound = true;
      close.addEventListener('click', closeSheet);
    }

    var sheet = byId('rendSheetV300');
    if(sheet && !sheet.__rendV300Bound){
      sheet.__rendV300Bound = true;
      sheet.addEventListener('click', function(e){ if(e.target === sheet) closeSheet(); });
    }

    document.querySelectorAll('#rendSheetTabsV300 button').forEach(function(btn){
      if(btn.__rendV300Bound) return;
      btn.__rendV300Bound = true;
      btn.addEventListener('click', function(){
        if(btn.classList.contains('hidden')) return;
        var tab = btn.getAttribute('data-sheet-tab');
        document.querySelectorAll('#rendSheetTabsV300 button').forEach(function(item){ item.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('#vista-ops-rendimiento .rend-sheet-view-v300').forEach(function(view){ view.classList.remove('active'); });
        var map = {
          resumen:'rendSheetResumenV300',
          averias:'rendSheetAveriasV300',
          trabajos:'rendSheetTrabajosV300',
          operaciones:'rendSheetOperacionesV300',
          tiempos:'rendSheetTiemposV300',
          agencias:'rendSheetAgenciasV300'
        };
        var view = byId(map[tab]);
        if(view) view.classList.add('active');
      });
    });
  }
  function open(link){
    document.querySelectorAll('[id^="vista-"]').forEach(function(node){ node.classList.add('hidden'); });
    document.querySelectorAll('.view').forEach(function(node){ node.classList.add('hidden'); });

    var wrap = byId('vista-ops-rendimiento');
    var view = byId('rendimientoView');
    if(wrap) wrap.classList.remove('hidden');
    if(view) view.classList.remove('hidden');

    document.querySelectorAll('.sidebar-link,.menu a').forEach(function(a){ a.classList.remove('active'); });
    var activeLink = link || byId('navRendimientoOperativo');
    if(activeLink && activeLink.classList) activeLink.classList.add('active');

    try{ if(typeof window.setSidebarSectionOpen === 'function') window.setSidebarSectionOpen('operaciones'); }catch(_e){}
    bind();
    openView(activeView || 'general');
    setTimeout(function(){ render(true); }, 40);
    return false;
  }

  window.cargarOperacionesParaRendimiento = cargarOperacionesParaRendimiento;
  window.lotekaOpenRendimientoOperativoV252 = open;
  window.lotekaRenderRendimientoOperativoV252 = render;
  window.lotekaOpenRendimientoOperativoV300 = open;
  window.lotekaRenderRendimientoOperativoV300 = render;
  window.lotekaDiagnosticoRendimiento = async function(){
    var all = await cargarOperacionesParaRendimiento(true);
    var rows = filteredRows(all);
    var info = {
      fuente: cacheMeta.source,
      tabla_real: REND_TABLE,
      total_fuente_local: cacheMeta.localTotal,
      total_supabase: cacheMeta.supabaseTotal,
      total_combinadas: cacheMeta.combinedTotal,
      total_completadas: cacheMeta.completedTotal,
      total_filtradas_periodo: rows.length,
      total_averias: rows.filter(function(x){ return x._type === 'Avería'; }).length,
      total_trabajos: rows.filter(function(x){ return x._type === 'Trabajo'; }).length,
      responsables_encontrados: Object.keys(groupBy(rows,function(x){ return x._responsible; })).length,
      periodo_activo: activePeriod,
      filtros: {
        busqueda: byId('rendSearchV300') && byId('rendSearchV300').value || '',
        grupo: byId('rendGrupoV300') && byId('rendGrupoV300').value || '',
        responsable: byId('rendResponsableV300') && byId('rendResponsableV300').value || '',
        revision: byId('rendRevisionV300') && byId('rendRevisionV300').value || '',
        orden: byId('rendOrdenV300') && byId('rendOrdenV300').value || ''
      },
      ultimo_error: cacheMeta.lastError || ''
    };
    console.log('[LOTEKA] Diagnóstico Rendimiento:', info);
    console.table(rows.slice(0,25).map(function(x){
      return {
        codigo:x._code,
        tipo:x._type,
        estado:x._status,
        agencia:x._agency,
        grupo:x._group,
        responsable:x._responsible,
        resp_tipo:x._responsibleType,
        completado:x._completedAt,
        asignacion:fmtMinutes(x._assignmentMinutes),
        respuesta:fmtMinutes(x._responseMinutes),
        resolucion:fmtMinutes(x._resolutionMinutes),
        revision:x._review
      };
    }));
    return info;
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setTimeout(bind, 800);
  setTimeout(bind, 1800);
})();

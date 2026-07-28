import { PAGE_SIZE, TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';

function errorText(error){
  return [error?.message,error?.details,error?.hint].filter(Boolean).join(' ');
}
function missingColumn(error){
  const text = errorText(error);
  const patterns = [
    /column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i,
    /Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i,
    /schema cache.*['"]([a-zA-Z0-9_]+)['"]/i,
    /column \"([a-zA-Z0-9_]+)\"/i
  ];
  for(const pattern of patterns){ const match = text.match(pattern); if(match) return match[1]; }
  return '';
}
function notNullColumn(error){
  const match = errorText(error).match(/null value in column ["']([a-zA-Z0-9_]+)["']/i);
  return match?.[1] || '';
}
function cleanSearch(value){
  return String(value || '').trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').slice(0,120);
}
function compactPayload(payload){
  return Object.fromEntries(Object.entries(payload || {}).filter(([,value]) => value !== undefined));
}
function defaultValueFor(column){
  const now = new Date().toISOString();
  const defaults = {
    estado:'Pendiente', tipo:'Avería', prioridad:'Media', tecnico:'Sin asignar',
    titulo:'Operación móvil', descripcion:'Operación creada desde la aplicación móvil',
    agencia:'', grupo:'', encargado:'', creado_por:'app_movil',
    fecha_creacion:now, creado_en:now, actualizado_en:now,
    historial:[], fotos_reportadas:[], fotos_evidencia:[]
  };
  return Object.hasOwn(defaults,column) ? defaults[column] : undefined;
}
function isInvalidUuid(error){
  return String(error?.code || '') === '22P02' && /uuid/i.test(errorText(error));
}
function isDuplicateCode(error){
  return String(error?.code || '') === '23505' && /codigo|code|unique/i.test(errorText(error));
}
function minimalOperationPayload(payload){
  const allowed = [
    'id','codigo','tipo','titulo','descripcion','estado','prioridad','agencia','agencia_label','grupo','tecnico','encargado',
    'encargado_telefono','telefono_encargado','whatsapp_encargado','creado_por','creado_por_nombre','reportado_por',
    'reportado_por_nombre','usuario_nombre','usuario_creador','foto_url','fotos_reportadas','fotos_evidencia','evidencia_estado',
    'evidencia_archivos_seleccionados','trabajos_seleccionados','averias_seleccionadas','tipos_seleccionados','trabajo_a_realizar','origen_reporte','reportado_por_rol',
    'categoria_visible','problema_reportado','estado_agencia_reportado','source','historial','fecha_creacion','creado_en','actualizado_en',
    'fecha_asignacion','asignacion_codigo','asignacion_comentario'
  ];
  const result = {};
  for(const key of allowed){ if(Object.hasOwn(payload,key) && payload[key] !== undefined) result[key] = payload[key]; }
  return result;
}

async function queryOperationsPage({ page, pageSize, filters }){
  const sb = await getSupabase();
  const search = cleanSearch(filters.search);
  let searchFields = ['codigo','agencia','titulo','descripcion'];
  const disabledFilters = new Set();
  const orderCandidates = ['fecha_creacion','creado_en','created_at','codigo',null];
  let orderIndex = 0;

  for(let attempt = 0; attempt < 20; attempt += 1){
    const orderColumn = orderCandidates[orderIndex];
    let query = sb.from(TABLES.operations).select('*', { count:'exact' });
    if(filters.status && filters.status !== 'Todos' && !disabledFilters.has('estado')) query = query.eq('estado', filters.status);
    if(filters.type && filters.type !== 'Todos' && !disabledFilters.has('tipo')) query = query.eq('tipo', filters.type);
    if(filters.technician && !disabledFilters.has('tecnico')) query = query.ilike('tecnico', `%${cleanSearch(filters.technician)}%`);
    if(filters.group && !disabledFilters.has('grupo')) query = query.ilike('grupo', `%${cleanSearch(filters.group)}%`);
    if(filters.dateFrom && !disabledFilters.has('fecha_creacion')) query = query.gte('fecha_creacion', `${filters.dateFrom}T00:00:00`);
    if(filters.dateTo && !disabledFilters.has('fecha_creacion')) query = query.lte('fecha_creacion', `${filters.dateTo}T23:59:59.999`);
    if(search && searchFields.length) query = query.or(searchFields.map(field => `${field}.ilike.%${search}%`).join(','));
    if(orderColumn) query = query.order(orderColumn,{ascending:false});
    const from = page * pageSize;
    const response = await query.range(from,from + pageSize - 1);
    if(!response.error) return {...response,from};

    const missing = missingColumn(response.error);
    if(missing){
      if(searchFields.includes(missing)){ searchFields = searchFields.filter(field => field !== missing); continue; }
      if(['estado','tipo','tecnico','grupo','fecha_creacion'].includes(missing)){ disabledFilters.add(missing); continue; }
      if(orderColumn === missing && orderIndex < orderCandidates.length - 1){ orderIndex += 1; continue; }
    }
    if(orderColumn && /does not exist|schema cache|Could not find/i.test(errorText(response.error)) && orderIndex < orderCandidates.length - 1){ orderIndex += 1; continue; }
    throw response.error;
  }
  throw new Error('No se pudo adaptar la consulta de operaciones al esquema actual.');
}


export async function listOperationCatalog({ activeOnly = true } = {}){
  const sb = await getSupabase();
  let query = sb
    .from(TABLES.operationCatalog)
    .select('id,tipo,nombre,descripcion,categoria,prioridad_sugerida,requiere_evidencia,orden,activo')
    .order('tipo',{ascending:true})
    .order('orden',{ascending:true})
    .order('nombre',{ascending:true});
  if(activeOnly) query = query.eq('activo',true);
  const { data, error } = await query;
  if(error) throw error;
  return (data || []).map((row,index) => ({
    id:String(row.id || ''),
    type:String(row.tipo || 'Avería'),
    name:String(row.nombre || '').trim(),
    description:String(row.descripcion || '').trim(),
    category:String(row.categoria || 'General').trim(),
    priority:String(row.prioridad_sugerida || 'Media').trim(),
    requiresEvidence:Boolean(row.requiere_evidencia),
    order:Number.isFinite(Number(row.orden)) ? Number(row.orden) : index + 1,
    active:row.activo !== false
  })).filter(item => item.name);
}

export async function listOperations({ page = 0, pageSize = PAGE_SIZE, filters = {} } = {}){
  const response = await queryOperationsPage({page,pageSize,filters});
  return {
    data:response.data || [], count:response.count || 0, page, pageSize,
    hasMore:response.from + (response.data?.length || 0) < (response.count || 0)
  };
}

export async function getOperation(reference){
  const sb = await getSupabase();
  let response = await sb.from(TABLES.operations).select('*').eq('id', reference).maybeSingle();
  if(response.error || !response.data) response = await sb.from(TABLES.operations).select('*').eq('codigo', reference).maybeSingle();
  if(response.error) throw response.error;
  return response.data;
}

async function listWithOrderFallback(limit){
  const sb = await getSupabase();
  for(const column of ['fecha_creacion','creado_en','created_at','codigo',null]){
    let query = sb.from(TABLES.operations).select('*').limit(limit);
    if(column) query = query.order(column,{ascending:false});
    const response = await query;
    if(!response.error) return response.data || [];
    if(!missingColumn(response.error) && !/does not exist|schema cache|Could not find/i.test(errorText(response.error))) throw response.error;
  }
  return [];
}

export async function getRecentOperations(limit = 8){ return listWithOrderFallback(limit); }
export async function getOperationsForStats(limit = 1000){ return listWithOrderFallback(limit); }

export async function getNextOperationCode(){
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.operations).select('codigo').not('codigo','is',null).limit(5000);
  if(error) throw error;
  let max = 0;
  for(const row of data || []){
    const match = String(row.codigo || '').match(/^OP-(\d+)$/i);
    if(match) max = Math.max(max, Number(match[1]));
  }
  return `OP-${String(max + 1).padStart(4,'0')}`;
}

export async function safeInsertOperation(payload){
  const sb = await getSupabase();
  let current = compactPayload(payload);
  let minimalMode = false;

  for(let attempt = 0; attempt < 60; attempt += 1){
    const { data, error } = await sb.from(TABLES.operations).insert(current).select('*').maybeSingle();
    if(!error) return data || current;

    const missing = missingColumn(error);
    if(missing && Object.hasOwn(current,missing)){ delete current[missing]; continue; }

    if(isInvalidUuid(error) && Object.hasOwn(current,'id')){ delete current.id; continue; }

    if(isDuplicateCode(error) && Object.hasOwn(current,'codigo')){
      current.codigo = await getNextOperationCode();
      continue;
    }

    const required = notNullColumn(error);
    if(required && (!Object.hasOwn(current,required) || current[required] === null || current[required] === '')){
      const fallback = defaultValueFor(required);
      if(fallback !== undefined){ current[required] = fallback; continue; }
    }

    if(String(error?.code || '') === '23514'){
      const text = errorText(error).toLowerCase();
      if(text.includes('prioridad')){ current.prioridad = 'Media'; continue; }
      if(text.includes('estado')){ current.estado = 'Pendiente'; continue; }
      if(text.includes('tipo')){ current.tipo = 'Avería'; continue; }
    }

    if(!minimalMode && /^(22|23|42|PGRST)/.test(String(error?.code || ''))){
      current = minimalOperationPayload(current);
      minimalMode = true;
      continue;
    }

    throw error;
  }
  throw new Error('No se pudo adaptar el registro a la estructura actual de reportes_operaciones.');
}

export async function safeUpdateOperation(reference, patch){
  const sb = await getSupabase();
  let current = compactPayload(patch);
  for(let attempt = 0; attempt < 40; attempt += 1){
    let query = sb.from(TABLES.operations).update(current);
    query = String(reference).startsWith('OP-') ? query.eq('codigo',reference) : query.eq('id',reference);
    const { data, error } = await query.select('*').maybeSingle();
    if(!error) return data;
    const missing = missingColumn(error);
    if(missing && Object.hasOwn(current,missing)){ delete current[missing]; continue; }
    if(isInvalidUuid(error) && !String(reference).startsWith('OP-')){
      query = sb.from(TABLES.operations).update(current).eq('codigo',reference);
      const fallback = await query.select('*').maybeSingle();
      if(!fallback.error) return fallback.data;
    }
    throw error;
  }
  throw new Error('No se pudo actualizar la operación.');
}

import { PAGE_SIZE, TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
function missingColumn(error){
  const text = [error?.message,error?.details,error?.hint].filter(Boolean).join(' ');
  const patterns = [/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i,/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i,/schema cache.*['"]([a-zA-Z0-9_]+)['"]/i];
  for(const pattern of patterns){ const match = text.match(pattern); if(match) return match[1]; }
  return '';
}
function cleanSearch(value){ return String(value || '').trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').slice(0,120); }
export async function listOperations({ page = 0, pageSize = PAGE_SIZE, filters = {} } = {}){
  const sb = await getSupabase();
  let query = sb.from(TABLES.operations).select('*', { count:'exact' });
  if(filters.status && filters.status !== 'Todos') query = query.eq('estado', filters.status);
  if(filters.type && filters.type !== 'Todos') query = query.eq('tipo', filters.type);
  if(filters.technician) query = query.ilike('tecnico', `%${cleanSearch(filters.technician)}%`);
  if(filters.group) query = query.ilike('grupo', `%${cleanSearch(filters.group)}%`);
  if(filters.dateFrom) query = query.gte('fecha_creacion', `${filters.dateFrom}T00:00:00`);
  if(filters.dateTo) query = query.lte('fecha_creacion', `${filters.dateTo}T23:59:59.999`);
  const search = cleanSearch(filters.search);
  if(search) query = query.or(`codigo.ilike.%${search}%,agencia.ilike.%${search}%,agencia_label.ilike.%${search}%,titulo.ilike.%${search}%,descripcion.ilike.%${search}%`);
  const from = page * pageSize;
  const { data, error, count } = await query.order('fecha_creacion', { ascending:false }).range(from, from + pageSize - 1);
  if(error) throw error;
  return { data:data || [], count:count || 0, page, pageSize, hasMore:from + (data?.length || 0) < (count || 0) };
}
export async function getOperation(reference){
  const sb = await getSupabase();
  let response = await sb.from(TABLES.operations).select('*').eq('id', reference).maybeSingle();
  if(response.error || !response.data) response = await sb.from(TABLES.operations).select('*').eq('codigo', reference).maybeSingle();
  if(response.error) throw response.error;
  return response.data;
}
export async function getRecentOperations(limit = 8){
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.operations).select('*').order('fecha_creacion', { ascending:false }).limit(limit);
  if(error) throw error; return data || [];
}
export async function getOperationsForStats(limit = 1000){
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.operations).select('id,codigo,estado,tipo,tecnico,agencia,agencia_label,grupo,fecha_creacion,fecha_completado,fotos_evidencia,evidencia_estado').order('fecha_creacion',{ascending:false}).limit(limit);
  if(error) throw error; return data || [];
}
export async function getNextOperationCode(){
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.operations).select('codigo').not('codigo','is',null).order('fecha_creacion',{ascending:false}).limit(1000);
  if(error) throw error;
  let max = 0;
  for(const row of data || []){ const match = String(row.codigo || '').match(/^OP-(\d+)$/i); if(match) max = Math.max(max, Number(match[1])); }
  return `OP-${String(max + 1).padStart(4,'0')}`;
}
export async function safeInsertOperation(payload){
  const sb = await getSupabase(); let current = { ...payload };
  for(let attempt = 0; attempt < 35; attempt += 1){
    const { data, error } = await sb.from(TABLES.operations).insert(current).select('*').single();
    if(!error) return data;
    const missing = missingColumn(error);
    if(missing && Object.hasOwn(current, missing)){ delete current[missing]; continue; }
    throw error;
  }
  throw new Error('No se pudo adaptar el registro a la estructura actual de reportes_operaciones.');
}
export async function safeUpdateOperation(reference, patch){
  const sb = await getSupabase(); let current = { ...patch };
  for(let attempt = 0; attempt < 30; attempt += 1){
    let query = sb.from(TABLES.operations).update(current);
    query = String(reference).startsWith('OP-') ? query.eq('codigo', reference) : query.eq('id', reference);
    const { data, error } = await query.select('*').maybeSingle();
    if(!error) return data;
    const missing = missingColumn(error);
    if(missing && Object.hasOwn(current, missing)){ delete current[missing]; continue; }
    throw error;
  }
  throw new Error('No se pudo actualizar la operación.');
}

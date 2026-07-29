import { PAGE_SIZE, TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
function clean(value){ return String(value || '').trim().replace(/[,%()]/g,' ').replace(/\s+/g,' ').slice(0,120); }
function normalized(value){ return String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function isActiveAgency(row){
  if(!row || row.activo === false) return false;
  return !/(CERR|DESACT|INACT)/.test(normalized(row.estado_operativo || row.estado));
}
function isOperationalGroup(row){
  if(!row) return false;
  const code = String(row.codigo || row.numero || '').replace(/\D/g,'').padStart(2,'0');
  return code !== '00' && !/(CERR|DESACT|INACT)/.test(normalized(row.nombre || row.codigo));
}
async function allAgencyGroupIds(){
  const sb = await getSupabase();
  const ids = new Set();
  const pageSize = 1000;
  for(let from=0; from<50000; from+=pageSize){
    const { data, error } = await sb.from(TABLES.agencies)
      .select('grupo_id,activo,estado,estado_operativo')
      .order('numero',{ascending:true})
      .range(from,from+pageSize-1);
    if(error) throw error;
    const rows = data || [];
    rows.filter(isActiveAgency).forEach(row => { if(row.grupo_id) ids.add(String(row.grupo_id)); });
    if(rows.length < pageSize) break;
  }
  return ids;
}
export async function listAgencies({ page = 0, pageSize = PAGE_SIZE, filters = {} } = {}){
  const sb = await getSupabase();
  let query = sb.from(TABLES.agencies).select('*,grupos(id,codigo,nombre,encargado,telefono)', { count:'exact' });
  const search = clean(filters.search);
  if(search) query = query.or(`numero.ilike.%${search}%,nombre.ilike.%${search}%,direccion.ilike.%${search}%`);
  if(filters.groupId) query = query.eq('grupo_id', filters.groupId);
  if(filters.status && filters.status !== 'Todos') query = query.eq('estado', filters.status);
  else if(!filters.includeInactive) query = query.eq('activo', true);
  const from = page * pageSize;
  let response = await query.order('numero',{ascending:true}).range(from, from + pageSize - 1);
  if(response.error){
    query = sb.from(TABLES.agencies).select('*', { count:'exact' });
    if(search) query = query.or(`numero.ilike.%${search}%,nombre.ilike.%${search}%,direccion.ilike.%${search}%`);
    if(filters.groupId) query = query.eq('grupo_id', filters.groupId);
    if(filters.status && filters.status !== 'Todos') query = query.eq('estado', filters.status);
    else if(!filters.includeInactive) query = query.eq('activo', true);
    response = await query.order('numero',{ascending:true}).range(from, from + pageSize - 1);
  }
  if(response.error) throw response.error;
  const rows = (response.data || []).filter(row => filters.includeInactive || isActiveAgency(row));
  return { data:rows, count:response.count || rows.length, page, pageSize, hasMore:from + (response.data?.length || 0) < (response.count || 0) };
}
export async function getAgency(reference){
  const sb = await getSupabase();
  let response = await sb.from(TABLES.agencies).select('*,grupos(id,codigo,nombre,encargado,telefono,correo)').eq('id', reference).maybeSingle();
  if(response.error || !response.data) response = await sb.from(TABLES.agencies).select('*,grupos(id,codigo,nombre,encargado,telefono,correo)').eq('numero', reference).maybeSingle();
  if(response.error){
    response = await sb.from(TABLES.agencies).select('*').eq('id', reference).maybeSingle();
    if(response.error || !response.data) response = await sb.from(TABLES.agencies).select('*').eq('numero', reference).maybeSingle();
  }
  if(response.error) throw response.error; return response.data;
}
export async function listAgencyCoordinates({ groupId = '', limit = 1500 } = {}){
  const sb = await getSupabase();
  let query = sb.from(TABLES.agencies).select('id,numero,nombre,grupo_id,estado,estado_operativo,activo,direccion,latitud,longitud').eq('activo',true).not('latitud','is',null).not('longitud','is',null).limit(limit);
  if(groupId) query = query.eq('grupo_id', groupId);
  const { data, error } = await query;
  if(error) throw error; return (data || []).filter(isActiveAgency);
}
export async function listGroups(){
  const sb = await getSupabase();
  const [groupsResponse, activeGroupIds] = await Promise.all([
    sb.from(TABLES.groups).select('*').order('codigo',{ascending:true}).limit(1000),
    allAgencyGroupIds()
  ]);
  if(groupsResponse.error) throw groupsResponse.error;
  return (groupsResponse.data || []).filter(group => isOperationalGroup(group) && activeGroupIds.has(String(group.id)));
}

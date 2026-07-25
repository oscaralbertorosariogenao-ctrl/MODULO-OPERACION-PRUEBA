import { PAGE_SIZE, TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
function clean(value){ return String(value || '').trim().replace(/[,%()]/g,' ').replace(/\s+/g,' ').slice(0,120); }
export async function listAgencies({ page = 0, pageSize = PAGE_SIZE, filters = {} } = {}){
  const sb = await getSupabase();
  let query = sb.from(TABLES.agencies).select('*,grupos(id,codigo,nombre,encargado,telefono)', { count:'exact' });
  const search = clean(filters.search);
  if(search) query = query.or(`numero.ilike.%${search}%,nombre.ilike.%${search}%,direccion.ilike.%${search}%`);
  if(filters.groupId) query = query.eq('grupo_id', filters.groupId);
  if(filters.status && filters.status !== 'Todos') query = query.eq('estado', filters.status);
  const from = page * pageSize;
  let response = await query.order('numero',{ascending:true}).range(from, from + pageSize - 1);
  if(response.error){
    query = sb.from(TABLES.agencies).select('*', { count:'exact' });
    if(search) query = query.or(`numero.ilike.%${search}%,nombre.ilike.%${search}%,direccion.ilike.%${search}%`);
    if(filters.groupId) query = query.eq('grupo_id', filters.groupId);
    response = await query.order('numero',{ascending:true}).range(from, from + pageSize - 1);
  }
  if(response.error) throw response.error;
  return { data:response.data || [], count:response.count || 0, page, pageSize, hasMore:from + (response.data?.length || 0) < (response.count || 0) };
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
  let query = sb.from(TABLES.agencies).select('id,numero,nombre,grupo_id,estado,estado_operativo,direccion,latitud,longitud').not('latitud','is',null).not('longitud','is',null).limit(limit);
  if(groupId) query = query.eq('grupo_id', groupId);
  const { data, error } = await query;
  if(error) throw error; return data || [];
}
export async function listGroups(){
  const sb = await getSupabase(); const { data, error } = await sb.from(TABLES.groups).select('*').order('codigo',{ascending:true}).limit(1000);
  if(error) throw error; return data || [];
}

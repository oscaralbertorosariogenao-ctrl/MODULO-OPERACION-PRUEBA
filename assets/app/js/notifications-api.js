import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
export async function findSerial(serial){
  const sb = await getSupabase(); const value = String(serial || '').trim();
  if(!value) return null;
  let response = await sb.from(TABLES.serials).select('*,productos(id,codigo,nombre,categoria,tipo_producto,requiere_serial),agencias(id,numero,nombre,direccion),grupos(id,codigo,nombre),despachos(id,codigo,estado)').ilike('serial', value).limit(1).maybeSingle();
  if(response.error) response = await sb.from(TABLES.serials).select('*').ilike('serial', value).limit(1).maybeSingle();
  if(response.error) throw response.error;
  return response.data;
}
export async function listAgencyEquipment(agencyId, limit = 100){
  const sb = await getSupabase();
  let response = await sb.from(TABLES.serials).select('*,productos(id,codigo,nombre,categoria,tipo_producto)').eq('agencia_id', agencyId).limit(limit);
  if(response.error) response = await sb.from(TABLES.serials).select('*').eq('agencia_id', agencyId).limit(limit);
  if(response.error) throw response.error; return response.data || [];
}

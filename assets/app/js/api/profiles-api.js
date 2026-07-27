import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';

function isActive(profile){
  const value = profile?.activo;
  if(value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  const status = String(profile?.estado || profile?.estatus || profile?.status || '').toLowerCase();
  return !/inactiv|bloque|suspend|cancel/.test(status);
}
function technicianText(profile){
  return [
    profile?.roles?.nombre, profile?.puestos?.nombre, profile?.rol, profile?.rol_nombre,
    profile?.puesto, profile?.puesto_nombre, profile?.departamento, profile?.cargo,
    profile?.usuario_login, profile?.nombre_completo, profile?.nombre
  ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

export async function listTechnicians(){
  const sb = await getSupabase();
  let response = await sb.from(TABLES.profiles).select('*,roles(nombre),puestos(nombre)').limit(2000);
  if(response.error) response = await sb.from(TABLES.profiles).select('*').limit(2000);
  if(response.error) throw response.error;
  const active = (response.data || []).filter(isActive);
  const technicians = active.filter(profile => /tecn/i.test(technicianText(profile)));
  return technicians.length ? technicians : active.filter(profile => !/admin|encargado/i.test(technicianText(profile)));
}

export async function listAssignableProfiles(){ return listTechnicians(); }

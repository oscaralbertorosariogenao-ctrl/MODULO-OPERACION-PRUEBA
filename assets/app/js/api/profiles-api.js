import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';

function isActive(profile){
  const value = profile?.activo;
  if(value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
  const status = String(profile?.estado || profile?.estatus || profile?.status || '').toLowerCase();
  return !/inactiv|bloque|suspend|cancel/.test(status);
}
function normalized(value){ return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }

export async function listTechnicians(){
  const sb = await getSupabase();
  const profilesResult = await sb.from(TABLES.profiles).select('*').limit(2000);
  if(profilesResult.error) throw profilesResult.error;
  const active=(profilesResult.data || []).filter(isActive);
  const roleIds=[...new Set(active.map(p=>p.rol_id).filter(Boolean))];
  const positionIds=[...new Set(active.map(p=>p.puesto_id).filter(Boolean))];
  const [rolesResult,positionsResult,permissionsResult]=await Promise.all([
    roleIds.length?sb.from('roles').select('id,nombre').in('id',roleIds):Promise.resolve({data:[],error:null}),
    positionIds.length?sb.from('puestos').select('id,nombre').in('id',positionIds):Promise.resolve({data:[],error:null}),
    roleIds.length?sb.from(TABLES.rolesPermissions).select('rol_id,permisos(codigo)').in('rol_id',roleIds):Promise.resolve({data:[],error:null})
  ]);
  const roleMap=new Map((rolesResult.error ? [] : (rolesResult.data || [])).map(row=>[String(row.id),row.nombre]));
  const positionMap=new Map((positionsResult.error ? [] : (positionsResult.data || [])).map(row=>[String(row.id),row.nombre]));
  const executionRoles=new Set();
  if(!permissionsResult.error){
    (permissionsResult.data || []).forEach(row=>{ const code=String(row?.permisos?.codigo || ''); if(['iniciar_operacion','subir_evidencia_operacion','cerrar_operacion'].includes(code)) executionRoles.add(String(row.rol_id)); });
  }
  const decorate=profile=>({...profile,roles:{nombre:roleMap.get(String(profile.rol_id)) || ''},puestos:{nombre:positionMap.get(String(profile.puesto_id)) || ''}});
  const textFor=profile=>normalized(`${roleMap.get(String(profile.rol_id)) || ''} ${positionMap.get(String(profile.puesto_id)) || ''} ${profile.departamento || ''} ${profile.cargo || ''}`);
  let technicians=executionRoles.size ? active.filter(profile=>executionRoles.has(String(profile.rol_id))) : [];
  if(!technicians.length) technicians=active.filter(profile=>/tecnic|soporte|mantenimiento|instalador|auxiliar.*operaci/.test(textFor(profile)));
  return technicians.map(decorate);
}

export async function listAssignableProfiles(){ return listTechnicians(); }

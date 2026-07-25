import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
export async function listTechnicians(){
  const sb = await getSupabase();
  const fields = 'id,nombre_completo,nombre,correo,email,telefono,telefono_whatsapp,usuario_login,departamento,activo,rol_id,puesto_id,grupo_asignado,roles(nombre),puestos(nombre)';
  let { data, error } = await sb.from(TABLES.profiles).select(fields).eq('activo',true).limit(1000);
  if(error){ ({ data, error } = await sb.from(TABLES.profiles).select('*').eq('activo',true).limit(1000)); }
  if(error) throw error;
  return (data || []).filter(profile => {
    const searchable = [profile?.roles?.nombre,profile?.puestos?.nombre,profile?.departamento,profile?.usuario_login,profile?.nombre_completo]
      .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return /tecn/i.test(searchable);
  });
}
export async function listAssignableProfiles(){ return listTechnicians(); }

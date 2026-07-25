import { TABLES } from './config.js';
import { getSupabase } from './supabase-client.js';
import { buildPermissionSet } from './permissions.js';
import { AppError, ERROR_TYPES } from './errors.js';
async function resolveIdentity(identity){
  const value = String(identity || '').trim();
  if(value.includes('@')) return value.toLowerCase();
  const sb = await getSupabase();
  for(const column of ['usuario_login','correo','email']){
    const { data, error } = await sb.from(TABLES.profiles).select('correo,email').ilike(column, value).limit(1);
    if(!error && data?.[0]) return String(data[0].correo || data[0].email || '').trim().toLowerCase();
  }
  throw new AppError('No se pudo resolver ese usuario. Prueba con tu correo autorizado.', { type:ERROR_TYPES.validation });
}
export async function signIn(identity, password){
  if(!String(password || '')) throw new AppError('Escribe tu contraseña.', { type:ERROR_TYPES.validation });
  const sb = await getSupabase();
  const email = await resolveIdentity(identity);
  const { data, error } = await sb.auth.signInWithPassword({ email, password:String(password) });
  if(error || !data?.session || !data?.user) throw new AppError('Correo, usuario o contraseña incorrectos.', { type:ERROR_TYPES.sessionInvalid, cause:error });
  return hydrateAuthenticatedUser(data.session, data.user);
}
export async function loadProfile(user){
  const sb = await getSupabase();
  const select = 'id,nombre_completo,nombre,correo,email,telefono,telefono_whatsapp,usuario_login,departamento,activo,rol_id,puesto_id,grupo_asignado,agencia_asignada,roles(nombre),puestos(nombre)';
  let result = await sb.from(TABLES.profiles).select(select).eq('id', user.id).maybeSingle();
  if(result.error || !result.data){
    result = await sb.from(TABLES.profiles).select(select).or(`correo.eq.${user.email},email.eq.${user.email}`).limit(1).maybeSingle();
  }
  if(result.error) throw result.error;
  if(!result.data) throw new AppError('Tu cuenta está autenticada, pero no tiene un perfil operativo.', { type:ERROR_TYPES.data, recoverable:false });
  if(result.data.activo === false) throw new AppError('Tu perfil está inactivo. Contacta al administrador.', { type:ERROR_TYPES.permission, recoverable:false });
  return result.data;
}
export async function loadPermissions(profile){
  if(!profile?.rol_id) return buildPermissionSet([], profile);
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.rolesPermissions).select('permisos(codigo)').eq('rol_id', profile.rol_id);
  if(error) throw error;
  return buildPermissionSet(data, profile);
}
export async function hydrateAuthenticatedUser(session, user){
  const profile = await loadProfile(user);
  const permissions = await loadPermissions(profile);
  return { session, user, profile, permissions };
}
export async function restoreSession(){
  const sb = await getSupabase();
  const { data, error } = await sb.auth.getSession();
  if(error) throw error;
  if(!data?.session?.user) return null;
  const { data:userData, error:userError } = await sb.auth.getUser();
  if(userError || !userData?.user){ await sb.auth.signOut(); return null; }
  return hydrateAuthenticatedUser(data.session, userData.user);
}
export async function signOut(){ const sb = await getSupabase(); await sb.auth.signOut(); }
export async function onAuthChange(callback){
  const sb = await getSupabase();
  const { data } = sb.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data?.subscription?.unsubscribe();
}

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { AppError, ERROR_TYPES } from './errors.js';
let client = null;
async function waitForLibrary(timeoutMs = 17000){
  if(globalThis.supabase?.createClient) return globalThis.supabase;
  const loader = globalThis.__goSupabaseLibraryReady;
  if(loader){
    try{
      const library = await Promise.race([
        loader,
        new Promise((_,reject) => setTimeout(() => reject(new Error('Tiempo agotado.')),timeoutMs))
      ]);
      if(library?.createClient) return library;
    }catch(error){
      throw new AppError(
        navigator.onLine
          ? 'No se pudo cargar el cliente seguro de Supabase. Actualiza la aplicación e inténtalo otra vez.'
          : 'La aplicación no terminó de instalar sus archivos para trabajar sin conexión. Conéctate una vez y actualízala.',
        { type:ERROR_TYPES.network, recoverable:false, cause:error }
      );
    }
  }
  const started = Date.now();
  while(!globalThis.supabase?.createClient){
    if(Date.now() - started > timeoutMs) throw new AppError('No se pudo cargar el cliente seguro de Supabase.', { type:ERROR_TYPES.network, recoverable:false });
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  return globalThis.supabase;
}
export async function getSupabase(){
  if(client) return client;
  const library = await waitForLibrary();
  client = library.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'go-v805-auth' },
    realtime:{ params:{ eventsPerSecond:8 } }, global:{ headers:{ 'X-Client-Info':'grupo-ortiz-v805-mobile' } }
  });
  return client;
}
export function getExistingSupabase(){ return client; }
export async function getAccessToken(){
  const sb = await getSupabase();
  const { data, error } = await sb.auth.getSession();
  if(error || !data?.session?.access_token) throw new AppError('Sesión requerida.', { type:ERROR_TYPES.sessionInvalid });
  return data.session.access_token;
}
export async function getApiAuthHeaders(extra = {}){ return { ...extra, Authorization:`Bearer ${await getAccessToken()}` }; }

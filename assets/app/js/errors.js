export const ERROR_TYPES = Object.freeze({
  sessionInvalid:'SESSION_INVALID', sessionExpired:'SESSION_EXPIRED', permission:'PERMISSION_DENIED', network:'NETWORK',
  supabase:'SUPABASE', rpc:'RPC', r2:'R2', camera:'CAMERA', gps:'GPS', data:'DATA', validation:'VALIDATION', unknown:'UNKNOWN'
});
export class AppError extends Error{
  constructor(message, { type = ERROR_TYPES.unknown, code = '', cause = null, recoverable = true, details = null } = {}){
    super(message); this.name = 'AppError'; this.type = type; this.code = code; this.cause = cause; this.recoverable = recoverable; this.details = details;
  }
}
export function classifyError(error, fallback = 'No se pudo completar la acción.'){
  if(error instanceof AppError) return error;
  const message = String(error?.message || error || fallback);
  const code = String(error?.code || '');
  if(!navigator.onLine || /failed to fetch|network|load failed/i.test(message)) return new AppError('No hay conexión estable. Revisa internet e inténtalo otra vez.', { type:ERROR_TYPES.network, code, cause:error });
  if(/jwt|session|refresh token|auth session missing/i.test(message)) return new AppError('Tu sesión venció. Inicia sesión nuevamente.', { type:ERROR_TYPES.sessionExpired, code, cause:error });
  if(code === '42501' || /permission denied|row-level security|not allowed/i.test(message)) return new AppError('No tienes permiso para realizar esta acción.', { type:ERROR_TYPES.permission, code, cause:error });
  if(/^PGRST|^22|^23|^42/.test(code)) return new AppError('Supabase rechazó la operación. Los datos no pudieron guardarse.', { type:ERROR_TYPES.supabase, code, cause:error });
  return new AppError(fallback || message, { type:ERROR_TYPES.unknown, code, cause:error });
}
export function safeErrorMessage(error){ return classifyError(error).message; }
export function logError(context, error){
  const classified = classifyError(error);
  console.error(`[Grupo Ortiz] ${context}`, { type:classified.type, code:classified.code, message:classified.message, cause:error });
  return classified;
}

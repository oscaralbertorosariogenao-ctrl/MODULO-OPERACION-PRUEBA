import { R2_UPLOAD_ENDPOINT } from '../config.js';
import { getApiAuthHeaders } from '../supabase-client.js';
import { AppError, ERROR_TYPES } from '../errors.js';
export async function uploadEvidenceFile(file, operationCode, { description = '', onProgress = null } = {}){
  if(!file) throw new AppError('Selecciona una evidencia.', { type:ERROR_TYPES.validation });
  const form = new FormData();
  form.append('file', file, file.name || `evidencia-${Date.now()}.jpg`);
  form.append('codigo', operationCode || 'app-movil-v805');
  form.append('folder', operationCode || 'operaciones');
  form.append('origen', 'app-movil-v805');
  if(description) form.append('descripcion', description);
  onProgress?.(10);
  const response = await fetch(R2_UPLOAD_ENDPOINT, { method:'POST', headers:await getApiAuthHeaders(), body:form, cache:'no-store', credentials:'same-origin' });
  onProgress?.(85);
  const raw = await response.text(); let data = {};
  try{ data = raw ? JSON.parse(raw) : {}; }catch{ data = {}; }
  if(!response.ok || data.ok === false) throw new AppError(data.message || data.error || 'R2 rechazó la evidencia.', { type:ERROR_TYPES.r2, code:String(response.status) });
  const url = data.url || data.publicUrl || data.public_url || data.location;
  if(!url) throw new AppError('R2 recibió el archivo, pero no devolvió una URL pública.', { type:ERROR_TYPES.r2 });
  onProgress?.(100); return url;
}

import { R2_UPLOAD_ENDPOINT } from '../config.js';
import { getApiAuthHeaders } from '../supabase-client.js';
import { AppError, ERROR_TYPES } from '../errors.js';

export async function uploadEvidenceFileDetailed(file, operationReference, {
  description = '', stage = 'SEGUIMIENTO', incidentId = '', source = 'app-movil-v808.21', onProgress = null
} = {}){
  if(!file) throw new AppError('Selecciona una evidencia.', { type:ERROR_TYPES.validation });
  if(!operationReference) throw new AppError('No se pudo identificar el reporte u operación.', { type:ERROR_TYPES.validation });
  const form = new FormData();
  form.append('file', file, file.name || `evidencia-${Date.now()}.jpg`);
  form.append('operacion_id', operationReference);
  form.append('codigo', operationReference);
  form.append('folder', operationReference);
  form.append('etapa', String(stage || 'SEGUIMIENTO').toUpperCase());
  form.append('origen', source);
  if(description) form.append('descripcion', description);
  if(incidentId) form.append('incidencia_id', incidentId);
  onProgress?.(10);
  const response = await fetch(R2_UPLOAD_ENDPOINT, { method:'POST', headers:await getApiAuthHeaders(), body:form, cache:'no-store', credentials:'same-origin' });
  onProgress?.(85);
  const raw = await response.text(); let data = {};
  try{ data = raw ? JSON.parse(raw) : {}; }catch{ data = {}; }
  if(!response.ok || data.ok === false){ const detail=[data.message,data.error].filter(Boolean).join(' · '); throw new AppError(detail || `R2 rechazó la evidencia (HTTP ${response.status}).`, { type:ERROR_TYPES.r2, code:String(response.status) }); }
  const url = data.url || data.publicUrl || data.public_url || data.location;
  if(!url) throw new AppError('R2 recibió el archivo, pero no devolvió una URL pública.', { type:ERROR_TYPES.r2 });
  onProgress?.(100);
  return { ...data, url, publicUrl:url, evidence:data.evidencia || null };
}

export async function uploadEvidenceFile(file, operationReference, options = {}){
  const result = await uploadEvidenceFileDetailed(file,operationReference,options);
  return result.url;
}

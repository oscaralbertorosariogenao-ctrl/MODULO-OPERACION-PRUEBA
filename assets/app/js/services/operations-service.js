import { OPERATION_STATUSES, OPERATION_TYPES } from '../config.js';
import { normalizeOperationStatus, isTerminalOperationStatus, isActiveOperationStatus, TERMINAL_OPERATION_STATUSES, ACTIVE_OPERATION_STATUSES } from '../operation-status.js';
export { normalizeOperationStatus, isTerminalOperationStatus, isActiveOperationStatus, TERMINAL_OPERATION_STATUSES, ACTIVE_OPERATION_STATUSES } from '../operation-status.js';
import { reportOperation, safeUpdateOperation, getOperation, assignOperationRpc, startOperationRpc, completeOperationRpc, resolveRemoteOperationRpc } from '../api/operations-api.js';
function text(value){ return String(value ?? '').trim(); }
export const normalizeStatus = normalizeOperationStatus;

export function normalizeOperation(row = {}){
  const r2Rows = Array.isArray(row._r2_evidencias) ? row._r2_evidencias : (Array.isArray(row.evidenciasR2) ? row.evidenciasR2 : []);
  const r2Reported = r2Rows.filter(item => text(item?.etapa).toUpperCase() === 'REPORTE');
  const r2Result = r2Rows.filter(item => text(item?.etapa).toUpperCase() !== 'REPORTE');
  const evidence = normalizeMedia([...(normalizeMedia(row.fotos_evidencia || row.resultImages || row.evidencias)), ...r2Result]);
  const reported = normalizeMedia([...(normalizeMedia(row.fotos_reportadas || row.images || row.foto_url)), ...r2Reported]);
  return {
    ...row,
    id:text(row.id), code:text(row.codigo || row.code || row.id), type:text(row.tipo || row.type || 'Avería'),
    title:text(row.titulo || row.title || row.categoria || 'Operación'), description:text(row.descripcion || row.description || row.detalle),
    status:normalizeOperationStatus(row.estado || row.status),
    agencyNumber:text(row.agencia || row.agency_number || row.numero_agencia), agencyLabel:text(row.agencia_label || row.agency || row.nombre_agencia),
    group:text(row.grupo || row.grupo_nombre), technician:text(row.tecnico || row.technician || row.asignado_a || 'Sin asignar'),
    manager:text(row.encargado || row.nombre_encargado || row.reportado_por_nombre), managerPhone:text(row.encargado_telefono || row.telefono_encargado || row.whatsapp_encargado),
    creator:text(row.creado_por_nombre || row.reportado_por_nombre || row.creado_por || row.usuario_nombre),
    createdAt:row.reportado_at || row.fecha_creacion || row.creado_en || row.created_at || null, assignedAt:row.asignado_at || row.fecha_asignacion || null,
    startedAt:row.iniciado_at || row.fecha_inicio || null, completedAt:row.completado_at || row.fecha_completado || row.resuelto_remoto_at || null,
    technicianId:text(row.tecnico_id), reporterId:text(row.reportado_por_id), assignerId:text(row.asignado_por_id),
    originOperationId:text(row.operacion_origen_id), source:text(row.origen_reporte || row.source),
    diagnosis:text(row.diagnostico || row.diagnosis || row.comentario_diagnostico), work:text(row.trabajo_a_realizar || row.trabajoARealizar),
    reportedMedia:reported, evidenceMedia:evidence, history:Array.isArray(row.historial) ? row.historial : [],
    equipment:Array.isArray(row.equipos) ? row.equipos : [], serials:Array.isArray(row.seriales) ? row.seriales : []
  };
}
export function normalizeMedia(value){
  let list = value;
  if(typeof list === 'string'){ try{ list = JSON.parse(list); }catch{ list = [list]; } }
  if(!Array.isArray(list)) list = list ? [list] : [];
  return [...new Set(list.map(item => {
    if(typeof item === 'string') return item;
    return item?.url_r2 || item?.url || item?.publicUrl || item?.public_url || '';
  }).map(text).filter(Boolean))];
}
export function operationElapsed(operation){
  const start = new Date(operation.createdAt || Date.now()).getTime();
  const end = operation.completedAt ? new Date(operation.completedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if(minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60); if(hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}
export function isOverdue(operation, hours = 24){
  if(isTerminalOperationStatus(operation.status)) return false;
  const created = new Date(operation.createdAt || 0).getTime(); return Boolean(created && Date.now() - created > hours * 3600000);
}
export function computeStats(rows){
  const operations=(rows || []).map(normalizeOperation); const today=new Date();
  const isToday=value => { const date=new Date(value || 0); return date.toDateString() === today.toDateString(); };
  return {
    total:operations.length,
    reported:operations.filter(op => op.status === 'Reportado').length,
    pending:operations.filter(op => op.status === 'Reportado').length,
    unassigned:operations.filter(op => op.status === 'Reportado').length,
    assigned:operations.filter(op => op.status === 'Asignado').length,
    inProgress:operations.filter(op => op.status === 'En proceso').length,
    incidents:operations.filter(op => op.status === 'En incidencia').length,
    completedToday:operations.filter(op => op.status === 'Completado' && isToday(op.completedAt)).length,
    remoteToday:operations.filter(op => op.status === 'Resuelto por soporte remoto' && isToday(op.completedAt)).length,
    pendingEvidence:operations.filter(op => op.status === 'En proceso' && !op.evidenceMedia.length).length,
    activeTechnicians:new Set(operations.filter(op => isActiveOperationStatus(op.status) && !/sin asignar/i.test(op.technician)).map(op => op.technician)).size
  };
}
export function primaryAction(operation, canAction){
  const op = normalizeOperation(operation);
  if(op.status === 'Reportado' && canAction('operations.assign')) return { action:'open-assignment', label:'Asignar reporte', tone:'primary' };
  if(op.status === 'Asignado' && canAction('operations.start')) return { action:'start-operation', label:'Iniciar operación', tone:'primary' };
  if(op.status === 'En proceso' && !op.evidenceMedia.length && canAction('operations.evidence')) return { action:'open-evidence', label:'Agregar evidencia', tone:'primary' };
  if(op.status === 'En proceso' && canAction('operations.finish')) return { action:'finish-operation', label:'Finalizar operación', tone:'success' };
  return null;
}
function historyEntry(action, profile, detail = '', extra = {}){
  return { fecha:new Date().toISOString(), accion:action, usuario:text(profile?.usuario_login || profile?.correo || profile?.email), nombre:text(profile?.nombre_completo || profile?.nombre || profile?.correo), detalle:text(detail), ...extra };
}

function makeClientId(){
  if(globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for(let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function makeAssignmentCode(){
  const year = new Date().getFullYear();
  const sequence = String(Date.now()).slice(-4);
  return `ASG-${year}-${sequence}`;
}
export async function createOperation(input, context){
  const agency=input.agency || {};
  const operationType=OPERATION_TYPES.includes(input.type) ? input.type : 'Avería';
  const selectedTypes=[...new Set((Array.isArray(input.selectedTypes) ? input.selectedTypes : [input.selectedTypes]).map(text).filter(Boolean))];
  const result=await reportOperation({
    agencyNumber:text(agency.numero || input.agencyNumber),
    agencyLabel:text(agency.nombre || input.agencyLabel),
    group:text(agency.grupos?.nombre || agency.grupo || input.group),
    type:operationType,
    title:text(input.title || selectedTypes[0] || `Reporte de ${operationType}`),
    description:text(input.description || selectedTypes.join(', ')),
    category:text(input.category || ''),
    problem:text(input.problem || selectedTypes.join(' | ')),
    work:text(input.work || (operationType === 'Trabajo' ? selectedTypes.join(' | ') : '')),
    source:input.originOperationId ? 'TECNICO_EN_OPERACION' : 'APP_MOVIL',
    originOperationId:text(input.originOperationId)
  });
  return await getOperation(result.operacion_id || result.codigo);
}
async function updateWithHistory(reference, patch, action, detail, profile, historyExtra = {}){
  const current = normalizeOperation(await getOperation(reference));
  const history = [...current.history, historyEntry(action, profile, detail, historyExtra)];
  return safeUpdateOperation(reference, { ...patch, historial:history, actualizado_en:new Date().toISOString() });
}
async function appendHistoryBestEffort(reference, action, detail, profile, historyExtra = {}){
  try{ return await updateWithHistory(reference, {}, action, detail, profile, historyExtra); }
  catch(error){ console.warn('[Grupo Ortiz] La transición canónica quedó guardada; no se pudo actualizar el historial legacy:',error?.message || error); return null; }
}
export function assignOperation(reference, technicianId, comment){
  return assignOperationRpc(reference, technicianId, comment);
}
export function reassignOperation(reference, technicianId, comment){
  return assignOperationRpc(reference, technicianId, comment);
}
export async function startOperation(reference, profile){ const updated=await startOperationRpc(reference); await appendHistoryBestEffort(reference, 'Operación iniciada', '', profile); return getOperation(updated?.id || updated?.codigo || reference); }
export function addComment(reference, comment, profile){ return updateWithHistory(reference, {}, 'Comentario agregado', comment, profile, { tipo:'comentario' }); }
export function addDiagnosis(reference, diagnosis, profile){ return updateWithHistory(reference, { diagnostico:text(diagnosis) }, 'Diagnóstico registrado', diagnosis, profile, { tipo:'diagnostico' }); }
export async function addEvidence(reference, urls, description, profile){
  const current = normalizeOperation(await getOperation(reference));
  try{
    return await updateWithHistory(reference, { fotos_evidencia:[...current.evidenceMedia, ...urls], evidencia_estado:'confirmada', evidencia_archivos_seleccionados:urls.length }, 'Evidencia cargada', description || `${urls.length} archivo(s)`, profile, { tipo:'evidencia', urls });
  }catch(error){
    // operacion_evidencias ya fue confirmada por /api/r2-upload; este espejo legacy no puede convertir un éxito canónico en falso error.
    console.warn('[Grupo Ortiz] Evidencia canónica guardada; no se pudo actualizar el espejo legacy fotos_evidencia:',error?.message || error);
    return getOperation(reference);
  }
}
export async function finishOperation(reference, finalComment, profile){
  const current = normalizeOperation(await getOperation(reference));
  if(current.status !== 'En proceso') throw new Error('Solo se puede finalizar una operación en proceso.');
  if(!current.evidenceMedia.length) throw new Error('La operación necesita al menos una evidencia confirmada para finalizar.');
  const updated=await completeOperationRpc(reference,finalComment);
  await appendHistoryBestEffort(reference, 'Operación finalizada', finalComment, profile, { tipo:'finalizacion' });
  return getOperation(updated?.id || updated?.codigo || reference);
}
export async function closeByWhatsApp(reference, { reason, comment, manager, phone, channel = 'WhatsApp' }, profile){
  const current = normalizeOperation(await getOperation(reference));
  if(['Completado','Resuelto por soporte remoto'].includes(current.status)) throw new Error('La operación ya está resuelta.');
  const detail = { motivo:text(reason), comentario:text(comment), encargado:text(manager), telefono:text(phone), canal:text(channel || 'WhatsApp'), usuario:text(profile?.nombre_completo || profile?.correo), fecha:new Date().toISOString(), evidencia_requerida:false };
  const updated=await resolveRemoteOperationRpc(reference,{channel:detail.canal,comment:detail.comentario});
  await appendHistoryBestEffort(reference, 'Resuelto por soporte remoto', detail.comentario, profile, { tipo:'soporte_remoto', ...detail });
  return getOperation(updated?.id || updated?.codigo || reference);
}
export { OPERATION_STATUSES, OPERATION_TYPES };

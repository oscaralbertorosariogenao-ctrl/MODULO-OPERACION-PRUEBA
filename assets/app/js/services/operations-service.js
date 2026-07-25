import { OPERATION_STATUSES, OPERATION_TYPES, PRIORITIES } from '../config.js';
import { getNextOperationCode, safeInsertOperation, safeUpdateOperation, getOperation } from '../api/operations-api.js';
function text(value){ return String(value ?? '').trim(); }
export function normalizeStatus(value){
  const raw = text(value).toLowerCase();
  if(raw.includes('complet') || raw.includes('cerrad') || raw.includes('finaliz')) return 'Completado';
  if(raw.includes('proceso') || raw.includes('inici')) return 'En proceso';
  if(raw.includes('asign')) return 'Asignada';
  return 'Pendiente';
}
export function normalizeOperation(row = {}){
  const evidence = normalizeMedia(row.fotos_evidencia || row.resultImages || row.evidencias);
  const reported = normalizeMedia(row.fotos_reportadas || row.images || row.foto_url);
  return {
    ...row,
    id:text(row.id), code:text(row.codigo || row.code || row.id), type:text(row.tipo || row.type || 'Avería'),
    title:text(row.titulo || row.title || row.categoria || 'Operación'), description:text(row.descripcion || row.description || row.detalle),
    status:normalizeStatus(row.estado || row.status), priority:text(row.prioridad || row.priority || 'Media'),
    agencyNumber:text(row.agencia || row.agency_number || row.numero_agencia), agencyLabel:text(row.agencia_label || row.agency || row.nombre_agencia),
    group:text(row.grupo || row.grupo_nombre), technician:text(row.tecnico || row.technician || row.asignado_a || 'Sin asignar'),
    manager:text(row.encargado || row.nombre_encargado || row.reportado_por_nombre), managerPhone:text(row.encargado_telefono || row.telefono_encargado || row.whatsapp_encargado),
    creator:text(row.creado_por_nombre || row.reportado_por_nombre || row.creado_por || row.usuario_nombre),
    createdAt:row.fecha_creacion || row.creado_en || row.created_at || null, assignedAt:row.fecha_asignacion || null,
    startedAt:row.fecha_inicio || null, completedAt:row.fecha_completado || null,
    diagnosis:text(row.diagnostico || row.diagnosis || row.comentario_diagnostico), work:text(row.trabajo_a_realizar || row.trabajoARealizar),
    reportedMedia:reported, evidenceMedia:evidence, history:Array.isArray(row.historial) ? row.historial : [],
    equipment:Array.isArray(row.equipos) ? row.equipos : [], serials:Array.isArray(row.seriales) ? row.seriales : []
  };
}
export function normalizeMedia(value){
  let list = value;
  if(typeof list === 'string'){ try{ list = JSON.parse(list); }catch{ list = [list]; } }
  if(!Array.isArray(list)) list = list ? [list] : [];
  return [...new Set(list.map(item => typeof item === 'string' ? item : item?.url).map(text).filter(Boolean))];
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
  if(normalizeStatus(operation.status) === 'Completado') return false;
  const created = new Date(operation.createdAt || 0).getTime(); return Boolean(created && Date.now() - created > hours * 3600000);
}
export function computeStats(rows){
  const operations = (rows || []).map(normalizeOperation); const today = new Date();
  const isToday = value => { const date = new Date(value || 0); return date.toDateString() === today.toDateString(); };
  return {
    total:operations.length,
    pending:operations.filter(op => op.status === 'Pendiente').length,
    unassigned:operations.filter(op => op.status !== 'Completado' && (!op.technician || /sin asignar/i.test(op.technician))).length,
    assigned:operations.filter(op => op.status === 'Asignada').length,
    inProgress:operations.filter(op => op.status === 'En proceso').length,
    completedToday:operations.filter(op => op.status === 'Completado' && isToday(op.completedAt || op.fecha_completado || op.actualizado_en)).length,
    overdue:operations.filter(op => isOverdue(op)).length,
    pendingEvidence:operations.filter(op => op.status === 'En proceso' && !op.evidenceMedia.length).length,
    activeTechnicians:new Set(operations.filter(op => ['Asignada','En proceso'].includes(op.status) && !/sin asignar/i.test(op.technician)).map(op => op.technician)).size
  };
}
export function primaryAction(operation, canAction){
  const op = normalizeOperation(operation);
  if(op.status === 'Pendiente' && canAction('operations.assign')) return { action:'open-assignment', label:'Asignar operación', tone:'primary' };
  if(op.status === 'Asignada' && canAction('operations.start')) return { action:'start-operation', label:'Iniciar operación', tone:'primary' };
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
  const code = await getNextOperationCode(); const now = new Date().toISOString();
  const profile = context.profile || {}; const agency = input.agency || {};
  const payload = {
    id:makeClientId(), codigo:code, tipo:OPERATION_TYPES.includes(input.type) ? input.type : 'Avería', titulo:text(input.title),
    descripcion:text(input.description), estado:'Pendiente', prioridad:PRIORITIES.includes(input.priority) ? input.priority : 'Media',
    agencia:text(agency.numero || input.agencyNumber), agencia_label:text(agency.nombre || input.agencyLabel), grupo:text(agency.grupos?.nombre || input.group),
    tecnico:text(input.technician || 'Sin asignar'), encargado:text(agency.grupos?.encargado || input.manager),
    encargado_telefono:text(agency.grupos?.telefono || agency.telefono || input.managerPhone),
    creado_por:text(profile.usuario_login || profile.correo || context.user?.email), creado_por_nombre:text(profile.nombre_completo || profile.nombre || context.user?.email),
    reportado_por_nombre:text(profile.nombre_completo || profile.nombre || context.user?.email),
    fotos_reportadas:input.reportedMedia || [], fotos_evidencia:[], fecha_creacion:now, creado_en:now, actualizado_en:now,
    source:'app_movil_v805', trabajos_seleccionados:input.work ? [text(input.work)] : [], trabajo_a_realizar:text(input.work),
    historial:[historyEntry('Operación creada desde app móvil', profile, text(input.description))]
  };
  if(input.technician && !/sin asignar/i.test(input.technician)){
    payload.estado = 'Asignada'; payload.fecha_asignacion = now; payload.asignacion_codigo = makeAssignmentCode();
    payload.historial.push(historyEntry('Operación asignada', profile, input.technician, { codigo_asignacion:payload.asignacion_codigo }));
  }
  return safeInsertOperation(payload);
}
async function updateWithHistory(reference, patch, action, detail, profile, historyExtra = {}){
  const current = normalizeOperation(await getOperation(reference));
  const history = [...current.history, historyEntry(action, profile, detail, historyExtra)];
  return safeUpdateOperation(reference, { ...patch, historial:history, actualizado_en:new Date().toISOString() });
}
export function assignOperation(reference, technician, comment, profile){
  const code = makeAssignmentCode(); const now = new Date().toISOString();
  return updateWithHistory(reference, { tecnico:text(technician), estado:'Asignada', fecha_asignacion:now, asignacion_codigo:code, asignacion_comentario:text(comment) }, 'Operación asignada', `${technician}${comment ? ` · ${comment}` : ''}`, profile, { codigo_asignacion:code });
}
export function reassignOperation(reference, technician, comment, profile){
  const code = makeAssignmentCode(); const now = new Date().toISOString();
  return updateWithHistory(reference, { tecnico:text(technician), estado:'Asignada', fecha_asignacion:now, asignacion_codigo:code, asignacion_comentario:text(comment) }, 'Operación reasignada', `${technician}${comment ? ` · ${comment}` : ''}`, profile, { codigo_asignacion:code });
}
export function startOperation(reference, profile){ return updateWithHistory(reference, { estado:'En proceso', fecha_inicio:new Date().toISOString() }, 'Operación iniciada', '', profile); }
export function addComment(reference, comment, profile){ return updateWithHistory(reference, {}, 'Comentario agregado', comment, profile, { tipo:'comentario' }); }
export function addDiagnosis(reference, diagnosis, profile){ return updateWithHistory(reference, { diagnostico:text(diagnosis) }, 'Diagnóstico registrado', diagnosis, profile, { tipo:'diagnostico' }); }
export async function addEvidence(reference, urls, description, profile){
  const current = normalizeOperation(await getOperation(reference));
  return updateWithHistory(reference, { fotos_evidencia:[...current.evidenceMedia, ...urls], evidencia_estado:'confirmada', evidencia_archivos_seleccionados:urls.length }, 'Evidencia cargada', description || `${urls.length} archivo(s)`, profile, { tipo:'evidencia', urls });
}
export async function finishOperation(reference, finalComment, profile){
  const current = normalizeOperation(await getOperation(reference));
  if(current.status !== 'En proceso') throw new Error('Solo se puede finalizar una operación en proceso.');
  if(!current.evidenceMedia.length) throw new Error('La operación necesita al menos una evidencia confirmada para finalizar.');
  return updateWithHistory(reference, { estado:'Completado', fecha_completado:new Date().toISOString(), comentario_final:text(finalComment), resuelto_por:text(profile?.nombre_completo || profile?.correo) }, 'Operación finalizada', finalComment, profile, { tipo:'finalizacion' });
}
export async function closeByWhatsApp(reference, { reason, comment, manager, phone }, profile){
  const current = normalizeOperation(await getOperation(reference));
  if(current.status === 'Completado') throw new Error('La operación ya está completada.');
  const detail = { motivo:text(reason), comentario:text(comment), encargado:text(manager), telefono:text(phone), usuario:text(profile?.nombre_completo || profile?.correo), fecha:new Date().toISOString(), evidencia_requerida:false };
  return updateWithHistory(reference, { estado:'Completado', fecha_completado:detail.fecha, cierre_whatsapp:true, cierre_sin_evidencia:true, cierre_whatsapp_detalle:detail, comentario_cierre_whatsapp:detail.comentario }, 'Cierre por WhatsApp', detail.comentario, profile, { tipo:'cierre_whatsapp', ...detail });
}
export { OPERATION_STATUSES, OPERATION_TYPES, PRIORITIES };

import { normalizeOperation, isOverdue } from './operations-service.js';
import { isGroupManager } from '../permissions.js';

export function deriveOperationalAlerts(rows, profile = null){
  const operations = (rows || []).map(normalizeOperation);
  if(isGroupManager(profile)) return deriveGroupAlerts(operations);

  const alerts = [];
  const unassigned = operations.filter(op => op.status !== 'Completado' && (!op.technician || /sin asignar/i.test(op.technician)));
  const overdue = operations.filter(op => isOverdue(op));
  const withoutEvidence = operations.filter(op => op.status === 'En proceso' && !op.evidenceMedia.length);
  const recentCompleted = operations.filter(op => op.status === 'Completado' && Date.now() - new Date(op.completedAt || op.actualizado_en || 0).getTime() < 86400000);
  if(unassigned.length) alerts.push({ id:'derived-unassigned', type:'warning', title:`${unassigned.length} operación(es) sin asignar`, message:'Requieren revisión y asignación de técnico.', route:'/operations', filter:'Pendiente' });
  if(overdue.length) alerts.push({ id:'derived-overdue', type:'danger', title:`${overdue.length} operación(es) atrasadas`, message:'Superan 24 horas sin completarse.', route:'/operations' });
  if(withoutEvidence.length) alerts.push({ id:'derived-evidence', type:'info', title:`${withoutEvidence.length} en proceso sin evidencia`, message:'Revisa el seguimiento antes de finalizar.', route:'/operations', filter:'En proceso' });
  if(recentCompleted.length) alerts.push({ id:'derived-completed', type:'success', title:`${recentCompleted.length} completada(s) recientemente`, message:'Finalizadas durante las últimas 24 horas.', route:'/operations', filter:'Completado' });
  return alerts;
}

function deriveGroupAlerts(operations){
  const alerts = [];
  const pending = operations.filter(op => op.status === 'Pendiente');
  const inProgress = operations.filter(op => op.status === 'En proceso');
  const overdue = operations.filter(op => isOverdue(op));
  const recentCompleted = operations.filter(op => op.status === 'Completado' && Date.now() - new Date(op.completedAt || op.actualizado_en || 0).getTime() < 86400000);

  if(overdue.length) alerts.push({ id:'derived-group-overdue', type:'danger', title:`${overdue.length} operación(es) atrasadas en tu grupo`, message:'Revisa el seguimiento de las agencias correspondientes.', route:'/operations' });
  if(pending.length) alerts.push({ id:'derived-group-pending', type:'warning', title:`${pending.length} operación(es) pendientes`, message:'Operaciones registradas en tus grupos que todavía no han iniciado.', route:'/operations', filter:'Pendiente' });
  if(inProgress.length) alerts.push({ id:'derived-group-progress', type:'info', title:`${inProgress.length} operación(es) en proceso`, message:'Consulta el progreso de los trabajos activos de tus grupos.', route:'/operations', filter:'En proceso' });
  if(recentCompleted.length) alerts.push({ id:'derived-group-completed', type:'success', title:`${recentCompleted.length} completada(s) recientemente`, message:'Trabajos finalizados en tus grupos durante las últimas 24 horas.', route:'/operations', filter:'Completado' });
  return alerts;
}

export function filterNotificationsForProfile(items, profile, userId){
  const values = items || [];
  if(!isGroupManager(profile)) return values;
  const currentUserId = String(userId || profile?.id || '').trim();
  return values.filter(item => {
    if(String(item?.id || '').startsWith('derived-')) return true;
    const targetUserId = String(item?.usuario_id || '').trim();
    return Boolean(currentUserId && targetUserId && targetUserId === currentUserId);
  });
}

export function notificationPermission(){ return 'Notification' in globalThis ? Notification.permission : 'unsupported'; }
export async function requestNotificationPermission(){ if(!('Notification' in globalThis)) return 'unsupported'; return Notification.requestPermission(); }

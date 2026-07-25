import { normalizeOperation, isOverdue } from './operations-service.js';
export function deriveOperationalAlerts(rows){
  const operations = (rows || []).map(normalizeOperation); const alerts = [];
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
export function notificationPermission(){ return 'Notification' in globalThis ? Notification.permission : 'unsupported'; }
export async function requestNotificationPermission(){ if(!('Notification' in globalThis)) return 'unsupported'; return Notification.requestPermission(); }

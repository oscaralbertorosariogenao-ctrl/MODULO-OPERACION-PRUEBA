import { normalizeOperation } from './operations-service.js';
import { isTerminalOperationStatus } from '../operation-status.js';
import { isGroupManager } from '../permissions.js';

export function deriveOperationalAlerts(rows, profile = null){
  const operations=(rows || []).map(normalizeOperation);
  const alerts=[];
  const reported=operations.filter(op => op.status === 'Reportado');
  const incidents=operations.filter(op => op.status === 'En incidencia');
  const inProgress=operations.filter(op => op.status === 'En proceso');
  const recentCompleted=operations.filter(op => isTerminalOperationStatus(op.status) && Date.now() - new Date(op.completedAt || 0).getTime() < 86400000);
  if(reported.length) alerts.push({id:'derived-reported',type:'warning',title:`${reported.length} reporte(s) sin asignar`,message:'Esperan revisión y asignación.',route:'/operations',filter:'Reportado'});
  if(incidents.length) alerts.push({id:'derived-incidents',type:'danger',title:`${incidents.length} operación(es) en incidencia`,message:'Necesitan revisión para continuar.',route:'/operations',filter:'En incidencia'});
  if(inProgress.length) alerts.push({id:'derived-progress',type:'info',title:`${inProgress.length} operación(es) en proceso`,message:'Trabajos actualmente activos.',route:'/operations',filter:'En proceso'});
  if(recentCompleted.length) alerts.push({id:'derived-completed',type:'success',title:`${recentCompleted.length} resuelta(s) recientemente`,message:'Finalizadas durante las últimas 24 horas.',route:'/operations'});
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

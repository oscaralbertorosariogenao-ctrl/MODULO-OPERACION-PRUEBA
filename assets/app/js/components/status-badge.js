import { el } from './dom.js';
import { normalizeStatus } from '../services/operations-service.js';
export function statusBadge(status){
  const normalized=normalizeStatus(status);
  const tone=normalized === 'Completado' || normalized === 'Resuelto por soporte remoto' ? 'complete'
    : normalized === 'En proceso' ? 'progress'
    : normalized === 'En incidencia' ? 'danger'
    : normalized === 'Asignado' ? 'assigned' : 'pending';
  return el('span',{class:`badge badge-${tone}`,text:normalized,'aria-label':`Estado: ${normalized}`});
}

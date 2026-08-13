import { el } from './dom.js';
import { normalizeOperationStatus, isTerminalOperationStatus } from '../operation-status.js';
export function statusBadge(status){
  const normalized=normalizeOperationStatus(status);
  const tone=isTerminalOperationStatus(normalized) ? 'complete'
    : normalized === 'En proceso' ? 'progress'
    : normalized === 'En incidencia' ? 'danger'
    : normalized === 'Asignado' ? 'assigned' : 'pending';
  return el('span',{class:`badge badge-${tone}`,text:normalized,'aria-label':`Estado: ${normalized}`});
}

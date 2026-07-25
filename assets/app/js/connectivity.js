import { el } from './dom.js';
import { normalizeStatus } from '../services/operations-service.js';
export function statusBadge(status){
  const normalized = normalizeStatus(status); const tone = normalized === 'Completado' ? 'complete' : normalized === 'En proceso' ? 'progress' : normalized === 'Asignada' ? 'assigned' : 'pending';
  return el('span',{class:`badge badge-${tone}`,text:normalized,'aria-label':`Estado: ${normalized}`});
}

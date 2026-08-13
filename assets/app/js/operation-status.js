function text(value){
  return String(value ?? '').trim();
}

export const TERMINAL_OPERATION_STATUSES = Object.freeze([
  'Completado',
  'Resuelto por soporte remoto'
]);

export const ACTIVE_OPERATION_STATUSES = Object.freeze([
  'Asignado',
  'En proceso',
  'En incidencia'
]);

export function normalizeOperationStatus(value){
  const raw = text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(raw.includes('soporte') || raw.includes('remot')) return 'Resuelto por soporte remoto';
  if(raw.includes('incid')) return 'En incidencia';
  if(raw.includes('complet') || raw.includes('cerrad') || raw.includes('finaliz')) return 'Completado';
  if(raw.includes('proceso') || raw.includes('inici')) return 'En proceso';
  if(raw.includes('asign')) return 'Asignado';
  return 'Reportado';
}

export function isTerminalOperationStatus(value){
  return TERMINAL_OPERATION_STATUSES.includes(normalizeOperationStatus(value));
}

export function isActiveOperationStatus(value){
  return ACTIVE_OPERATION_STATUSES.includes(normalizeOperationStatus(value));
}

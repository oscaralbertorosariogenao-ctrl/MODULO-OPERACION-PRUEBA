import { PERMISSIONS } from './config.js';
const ACTION_PERMISSION = Object.freeze({
  'home.view':PERMISSIONS.home,
  'operations.view':PERMISSIONS.operations,'operations.create':PERMISSIONS.operations,'operations.assign':PERMISSIONS.operations,
  'operations.reassign':PERMISSIONS.operations,'operations.start':PERMISSIONS.operations,'operations.comment':PERMISSIONS.operations,
  'operations.diagnose':PERMISSIONS.operations,'operations.evidence':PERMISSIONS.operations,'operations.finish':PERMISSIONS.operations,
  'operations.close':PERMISSIONS.operations,'operations.closeWhatsapp':PERMISSIONS.operations,
  'agencies.view':PERMISSIONS.agencies,'agencies.detail':PERMISSIONS.agencies,'agencies.map':PERMISSIONS.agencies,
  'equipment.view':PERMISSIONS.equipment,'technicians.view':PERMISSIONS.operations,'notifications.view':PERMISSIONS.operations,'profile.view':null
});
export function normalizeRole(profile){ return String(profile?.roles?.nombre || profile?.rol || profile?.role || '').trim(); }
export function isAdministrator(profile){ return /administrador|admin/i.test(normalizeRole(profile)); }
export function buildPermissionSet(rows, profile){
  const set = new Set();
  for(const row of rows || []){
    const code = row?.permisos?.codigo || row?.codigo;
    if(code) set.add(String(code));
  }
  if(isAdministrator(profile)) set.add('*');
  return set;
}
export function hasPermission(permissions, requirement){
  if(!requirement) return true;
  if(permissions?.has('*')) return true;
  if(Array.isArray(requirement)) return requirement.some(item => hasPermission(permissions, item));
  return Boolean(permissions?.has(requirement));
}
const ADMIN_ONLY = new Set(['operations.create','operations.assign','operations.reassign','operations.close','operations.closeWhatsapp']);
export function can(action, state){
  if(ADMIN_ONLY.has(action) && !isAdministrator(state?.profile)) return false;
  return hasPermission(state?.permissions, ACTION_PERMISSION[action]);
}
export function permissionFor(action){ return ACTION_PERMISSION[action] || null; }

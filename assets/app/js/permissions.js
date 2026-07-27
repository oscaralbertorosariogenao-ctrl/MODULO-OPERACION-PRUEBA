import { PERMISSIONS, ROUTES } from './config.js';

const ACTION_PERMISSION = Object.freeze({
  'home.view':PERMISSIONS.home,
  'operations.view':PERMISSIONS.operations,
  'operations.create':PERMISSIONS.operations,
  'operations.assign':PERMISSIONS.operations,
  'operations.reassign':PERMISSIONS.operations,
  'operations.start':PERMISSIONS.operations,
  'operations.comment':PERMISSIONS.operations,
  'operations.diagnose':PERMISSIONS.operations,
  'operations.evidence':PERMISSIONS.operations,
  'operations.finish':PERMISSIONS.operations,
  'operations.close':PERMISSIONS.operations,
  'operations.closeWhatsapp':PERMISSIONS.operations,
  'agencies.view':PERMISSIONS.agencies,
  'agencies.detail':PERMISSIONS.agencies,
  'agencies.map':PERMISSIONS.agencies,
  'equipment.view':PERMISSIONS.equipment,
  'scanner.lookup':PERMISSIONS.equipment,
  'scanner.entry':PERMISSIONS.inventoryManage,
  'scanner.batchEntry':PERMISSIONS.inventoryManage,
  'scanner.transfer':PERMISSIONS.inventoryMove,
  'scanner.receive':PERMISSIONS.inventoryManage,
  'scanner.incident':PERMISSIONS.inventoryManage,
  'technicians.view':PERMISSIONS.operations,
  'notifications.view':PERMISSIONS.operations,
  'profile.view':null
});

const ROUTE_ACTION = Object.freeze({
  [ROUTES.home]:'home.view',
  [ROUTES.operations]:'operations.view',
  [ROUTES.operation]:'operations.view',
  [ROUTES.createOperation]:'operations.create',
  [ROUTES.agencies]:'agencies.view',
  [ROUTES.agency]:'agencies.detail',
  [ROUTES.map]:'agencies.map',
  [ROUTES.scanner]:'scanner.lookup',
  [ROUTES.technicians]:'technicians.view',
  [ROUTES.notifications]:'notifications.view',
  [ROUTES.profile]:'profile.view'
});

const ROUTE_PRIORITY = Object.freeze([
  ROUTES.home,
  ROUTES.operations,
  ROUTES.scanner,
  ROUTES.agencies,
  ROUTES.profile
]);

const ADMIN_ONLY = new Set([
  'operations.create',
  'operations.assign',
  'operations.reassign',
  'operations.close',
  'operations.closeWhatsapp'
]);

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

export function can(action, state){
  if(!action) return true;
  if(!Object.hasOwn(ACTION_PERMISSION,action)) return false;
  if(isAdministrator(state?.profile)) return true;
  if(ADMIN_ONLY.has(action)) return false;
  return hasPermission(state?.permissions, ACTION_PERMISSION[action]);
}

export function permissionFor(action){ return ACTION_PERMISSION[action] || null; }
export function actionForRoute(path){ return ROUTE_ACTION[path] || null; }
export function canAccessRoute(route, state){ return can(actionForRoute(route?.path), state); }
export function firstAllowedRoute(state){ return ROUTE_PRIORITY.find(path => canAccessRoute({path},state)) || ROUTES.profile; }

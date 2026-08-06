import { PERMISSIONS, ROUTES } from './config.js';

const ACTION_PERMISSION = Object.freeze({
  'home.view':PERMISSIONS.home,
  'operations.view':PERMISSIONS.operations,
  'operations.report':[PERMISSIONS.operationReport,PERMISSIONS.operationCreate],
  'operations.create':[PERMISSIONS.operationReport,PERMISSIONS.operationCreate],
  'operations.assign':PERMISSIONS.operationAssign,
  'operations.reassign':PERMISSIONS.operationAssign,
  'operations.start':PERMISSIONS.operationStart,
  'operations.comment':PERMISSIONS.operationComment,
  'operations.diagnose':PERMISSIONS.operationComment,
  'operations.evidence':PERMISSIONS.operationEvidence,
  'operations.finish':PERMISSIONS.operationFinish,
  'operations.close':PERMISSIONS.operationFinish,
  'operations.closeWhatsapp':PERMISSIONS.operationCloseWhatsapp,
  'agencies.view':PERMISSIONS.agencies,
  'agencies.detail':PERMISSIONS.agencies,
  'agencies.map':PERMISSIONS.agencies,
  'equipment.view':PERMISSIONS.equipment,
  'groupInventory.view':PERMISSIONS.groupInventory,
  'scanner.lookup':PERMISSIONS.equipment,
  'scanner.entry':PERMISSIONS.inventoryManage,
  'scanner.batchEntry':PERMISSIONS.inventoryManage,
  'scanner.transfer':PERMISSIONS.inventoryMove,
  'scanner.receive':PERMISSIONS.inventoryManage,
  'scanner.incident':PERMISSIONS.inventoryManage,
  'technicians.view':PERMISSIONS.operations,
  'notifications.view':PERMISSIONS.notifications,
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
  [ROUTES.groupInventory]:'groupInventory.view',
  [ROUTES.scanner]:'scanner.lookup',
  [ROUTES.technicians]:'technicians.view',
  [ROUTES.notifications]:'notifications.view',
  [ROUTES.profile]:'profile.view'
});

const ROUTE_PRIORITY = Object.freeze([
  ROUTES.home,
  ROUTES.operations,
  ROUTES.groupInventory,
  ROUTES.scanner,
  ROUTES.agencies,
  ROUTES.profile
]);

const GROUP_MANAGER_DENIED = new Set([
  'technicians.view'
]);

function normalizedAccessText(profile){
  return [
    profile?.roles?.nombre,
    profile?.puestos?.nombre,
    profile?.rol,
    profile?.role,
    profile?.puesto,
    profile?.cargo
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

export function normalizeRole(profile){ return String(profile?.roles?.nombre || profile?.rol || profile?.role || '').trim(); }
export function isAdministrator(profile){ return /administrador|admin/i.test(normalizeRole(profile)); }
export function isGroupManager(profile){ return /encargado\s+de\s+grupo/.test(normalizedAccessText(profile)); }

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
  if(isGroupManager(state?.profile) && GROUP_MANAGER_DENIED.has(action)) return false;
  return hasPermission(state?.permissions, ACTION_PERMISSION[action]);
}

export function permissionFor(action){ return ACTION_PERMISSION[action] || null; }
export function actionForRoute(path){ return ROUTE_ACTION[path] || null; }
export function canAccessRoute(route, state){ return can(actionForRoute(route?.path), state); }
export function firstAllowedRoute(state){ return ROUTE_PRIORITY.find(path => canAccessRoute({path},state)) || ROUTES.profile; }

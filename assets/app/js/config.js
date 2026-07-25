export const APP_BUILD = '2026-07-25-v805.1-pwa-scanner';
export const APP_VERSION = 'V805.1';
export const SUPABASE_URL = 'https://tnymrjxdhzdmpcbilftj.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueW1yanhkaHpkbXBjYmlsZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.YXG9juChbJUUdsdy01Qkoh9X0-MijewD5aQbKnG9Itk';
export const R2_UPLOAD_ENDPOINT = '/api/r2-upload';
export const SEND_PUSH_ENDPOINT = '/api/send-push';
export const PAGE_SIZE = 20;
export const TABLES = Object.freeze({
  operations: 'reportes_operaciones',
  profiles: 'perfiles',
  rolesPermissions: 'roles_permisos',
  agencies: 'agencias',
  groups: 'grupos',
  notifications: 'notificaciones',
  serials: 'equipos_seriales',
  products: 'productos',
  dispatches: 'despachos',
  dispatchItems: 'despacho_items'
});
export const OPERATION_STATUSES = Object.freeze(['Pendiente', 'Asignada', 'En proceso', 'Completado']);
export const OPERATION_TYPES = Object.freeze(['Avería', 'Trabajo']);
export const PRIORITIES = Object.freeze(['Baja', 'Media', 'Alta', 'Urgente']);
export const ROUTES = Object.freeze({
  login: '/login', home: '/home', operations: '/operations', operation: '/operation', createOperation: '/operations/new',
  agencies: '/agencies', agency: '/agency', scanner: '/scanner', technicians: '/technicians', notifications: '/notifications', profile: '/profile', map: '/map'
});
export const PERMISSIONS = Object.freeze({
  home: 'ver_home', operations: 'ver_operaciones', agencies: 'ver_agencias', equipment: 'ver_inventario', reports: 'ver_reportes'
});
export const REALTIME_TABLES = Object.freeze([TABLES.operations, TABLES.notifications]);
export const INITIAL_SYNC_TABLES = Object.freeze([TABLES.operations, TABLES.agencies, TABLES.notifications]);

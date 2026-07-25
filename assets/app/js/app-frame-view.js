const initialState = Object.freeze({
  booting: true, session: null, user: null, profile: null, permissions: new Set(), permissionsLoaded: false,
  route: { path: '/login', params: {}, query: new URLSearchParams() },
  connectivity: { online: navigator.onLine, status: navigator.onLine ? 'online' : 'offline', lastSync: null },
  ui: { loading: false, loadingMessage: '', drawerOpen: false, installPrompt: null },
  operations: { items: [], total: 0, page: 0, hasMore: true, loading: false, filters: {}, selected: null, stats: null },
  agencies: { items: [], total: 0, page: 0, hasMore: true, loading: false, filters: {}, selected: null },
  technicians: { items: [], loading: false }, notifications: { items: [], loading: false, real: true },
  scanner: { active: false, result: null, error: '' }, evidence: { files: [], progress: 0 }, errors: []
});
let state = cloneState(initialState);
const listeners = new Set();
function cloneState(source){
  return {
    ...source,
    permissions: new Set(source.permissions || []),
    route: { ...source.route, query: new URLSearchParams(source.route?.query || '') },
    connectivity: { ...source.connectivity }, ui: { ...source.ui },
    operations: { ...source.operations, items: [...(source.operations?.items || [])], filters: { ...(source.operations?.filters || {}) } },
    agencies: { ...source.agencies, items: [...(source.agencies?.items || [])], filters: { ...(source.agencies?.filters || {}) } },
    technicians: { ...source.technicians, items: [...(source.technicians?.items || [])] },
    notifications: { ...source.notifications, items: [...(source.notifications?.items || [])] },
    scanner: { ...source.scanner }, evidence: { ...source.evidence, files: [...(source.evidence?.files || [])] }, errors: [...(source.errors || [])]
  };
}
export function getState(){ return state; }
export function setState(patch, meta = ''){
  const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
  state = next;
  listeners.forEach(listener => { try{ listener(state, meta); }catch(error){ console.error('[Grupo Ortiz] Store listener error', error); } });
  return state;
}
export function updateSlice(key, patch, meta = ''){
  return setState(current => ({ ...current, [key]: { ...current[key], ...(typeof patch === 'function' ? patch(current[key], current) : patch) } }), meta);
}
export function subscribe(listener){ listeners.add(listener); return () => listeners.delete(listener); }
export function resetStore(){ state = cloneState(initialState); listeners.forEach(listener => listener(state, 'reset')); }

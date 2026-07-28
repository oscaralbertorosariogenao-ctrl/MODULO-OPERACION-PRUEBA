const initialState = Object.freeze({
  booting: true, session: null, user: null, profile: null, permissions: new Set(), permissionsLoaded: false,
  route: { path: '/login', params: {}, query: new URLSearchParams() },
  connectivity: { online: navigator.onLine, status: navigator.onLine ? 'online' : 'offline', lastSync: null },
  ui: { loading: false, loadingMessage: '', drawerOpen: false, installPrompt: null, pwaSupported: false, pwaStandalone: false, pwaIos: false, pwaInstalled: false, pwaUpdateAvailable: false },
  operations: { items: [], total: 0, page: 0, hasMore: true, loading: false, filters: {}, selected: null, stats: null },
  agencies: { items: [], total: 0, page: 0, hasMore: true, loading: false, filters: {}, selected: null },
  technicians: { items: [], loading: false }, notifications: { items: [], loading: false, real: true },
  operationCatalog: { items: [], loading: false, loadedAt: 0 },
  groupInventory: { data:{groups:[],agencies:[],groupItems:[],agencyItems:[],transits:[],movements:[],summary:{}}, loading:false, loadedAt:0, fromCache:false, filters:{groupId:'',scope:'group',search:''} },
  scanner: { status:'idle', mode:'lookup', rawValue:'', normalizedValue:'', result:null, recentScans:[], batch:null, cameraActive:false, active:false, torchEnabled:false, torchSupported:false, cameraCount:0, processing:false, error:'', engine:'', cameraLabel:'', catalogs:{products:[],warehouses:[],agencies:[],loadedAt:0} }, evidence: { files: [], progress: 0 }, errors: []
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
    operationCatalog: { ...source.operationCatalog, items: [...(source.operationCatalog?.items || [])] },
    groupInventory: { ...source.groupInventory, data:{...(source.groupInventory?.data || {}),groups:[...(source.groupInventory?.data?.groups || [])],agencies:[...(source.groupInventory?.data?.agencies || [])],groupItems:[...(source.groupInventory?.data?.groupItems || [])],agencyItems:[...(source.groupInventory?.data?.agencyItems || [])],transits:[...(source.groupInventory?.data?.transits || [])],movements:[...(source.groupInventory?.data?.movements || [])],summary:{...(source.groupInventory?.data?.summary || {})}},filters:{...(source.groupInventory?.filters || {})} },
    scanner: { ...source.scanner, recentScans:[...(source.scanner?.recentScans || [])], batch:source.scanner?.batch ? {...source.scanner.batch, serials:[...(source.scanner.batch.serials || [])], invalid:[...(source.scanner.batch.invalid || [])]} : null, catalogs:{...(source.scanner?.catalogs || {}), products:[...(source.scanner?.catalogs?.products || [])], warehouses:[...(source.scanner?.catalogs?.warehouses || [])], agencies:[...(source.scanner?.catalogs?.agencies || [])]} }, evidence: { ...source.evidence, files: [...(source.evidence?.files || [])] }, errors: [...(source.errors || [])]
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

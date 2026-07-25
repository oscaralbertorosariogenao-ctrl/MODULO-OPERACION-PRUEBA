import { APP_BUILD, ROUTES, TABLES } from './config.js';
import { getState, setState, updateSlice, resetStore } from './store.js';
import { restoreSession, onAuthChange } from './auth.js';
import { startRouter, navigate } from './router.js';
import { startConnectivity } from './connectivity.js';
import { subscribeTable, clearRealtime } from './realtime.js';
import { setupPwa } from './services/pwa-service.js';
import { loadHomeData, loadOperationsPage, loadOperationDetail, loadAgenciesPage, ensureAgencyReferenceData, loadAgencyDetail, loadTechniciansData, loadNotificationsData, loadMapData } from './services/data-service.js';
import { getDraft } from './services/draft-service.js';
import { renderAgencyMap, destroyMap } from './services/location-service.js';
import { stopScanner } from './services/scanner-service.js';
import { can } from './permissions.js';
import { classifyError, ERROR_TYPES, logError } from './errors.js';
import { showToast } from './components/toast.js';
import { loginView } from './views/login-view.js';
import { homeView } from './views/home-view.js';
import { operationsView } from './views/operations-view.js';
import { operationDetailView } from './views/operation-detail-view.js';
import { operationFormView } from './views/operation-form-view.js';
import { agenciesView } from './views/agencies-view.js';
import { agencyDetailView } from './views/agency-detail-view.js';
import { scannerView } from './views/scanner-view.js';
import { techniciansView } from './views/technicians-view.js';
import { notificationsView } from './views/notifications-view.js';
import { profileView } from './views/profile-view.js';
import { mapView } from './views/map-view.js';
import { appFrameView } from './views/app-frame-view.js';
import { attachEventController } from './event-controller.js';
export class AppController{
  constructor(root){ this.root = root; this.loginState = { error:'', loading:false }; this.operationDraft = {}; this.routeRun = 0; this.cleanup = []; this.realtimeTimers = new Map(); }
  async init(){
    console.info('[Grupo Ortiz] Build 2026-07-25-v805.1-pwa-scanner');
    this.cleanup.push(startConnectivity(),attachEventController(this));
    const pwaCleanup = await setupPwa({
      onChange:() => { const state=getState(); if(!(state.route.path === ROUTES.scanner && state.scanner.active)) this.render(); },
      onUpdateAvailable:() => showToast('Nueva versión disponible','Ve a Perfil y pulsa “Actualizar aplicación”.','info')
    });
    this.cleanup.push(pwaCleanup);
    try{
      const restored = await restoreSession();
      if(restored) this.applyAuth(restored);
    }catch(error){ this.handleError('Restaurar sesión',error,{silent:true}); }
    this.cleanup.push(await onAuthChange((event,session) => this.handleAuthEvent(event,session)));
    this.cleanup.push(startRouter(route => this.handleRoute(route)));
  }
  applyAuth(auth){ setState(current => ({...current,session:auth.session,user:auth.user,profile:auth.profile,permissions:auth.permissions,permissionsLoaded:true,booting:false}),'auth'); this.setupRealtime(); }
  async handleAuthEvent(event,session){
    if(event === 'SIGNED_OUT'){ await this.clearSession(); return; }
    if(event === 'TOKEN_REFRESHED' && session) setState(current => ({...current,session,user:session.user || current.user}),'token-refreshed');
  }
  async clearSession(){
    await clearRealtime(); resetStore(); this.loginState = {error:'',loading:false}; this.operationDraft = {}; navigate(ROUTES.login,{},null,{replace:true}); this.render();
  }
  async handleRoute(route, force = false){
    const run = ++this.routeRun; const state = getState();
    if(state.route.path === ROUTES.scanner && (route.path !== ROUTES.scanner || force)){
      await stopScanner();
      updateSlice('scanner',{active:false,engine:'',cameraLabel:''},'scanner-route-exit');
    }
    if(!state.session && route.path !== ROUTES.login){ navigate(ROUTES.login,{},null,{replace:true}); return; }
    if(state.session && route.path === ROUTES.login){ navigate(ROUTES.home,{},null,{replace:true}); return; }
    destroyMap(); setState(current => ({...current,route}),`route:${route.path}`); this.render();
    if(!state.session) return;
    try{
      await this.loadRouteData(route,force);
      if(run !== this.routeRun) return;
      this.render(); await this.afterRender(route);
    }catch(error){ if(run !== this.routeRun) return; this.handleError(`Cargar ${route.path}`,error); this.render(); }
  }
  async loadRouteData(route,force){
    switch(route.path){
      case ROUTES.home: await loadHomeData(); break;
      case ROUTES.operations: await loadOperationsPage({reset:true}); break;
      case ROUTES.operation: await loadOperationDetail(route.params.id); break;
      case ROUTES.createOperation:
        await Promise.all([ensureAgencyReferenceData(),loadTechniciansData()]);
        this.operationDraft = await getDraft('create-operation').catch(() => ({})) || {};
        if(route.query.get('agency')) this.operationDraft.agency = route.query.get('agency');
        break;
      case ROUTES.agencies: await ensureAgencyReferenceData(); await loadAgenciesPage({reset:true}); break;
      case ROUTES.agency: await loadAgencyDetail(route.params.id); break;
      case ROUTES.technicians: await loadTechniciansData(); break;
      case ROUTES.notifications: await loadNotificationsData(); break;
      case ROUTES.map: await loadMapData(route.query.get('group') || ''); break;
      case ROUTES.scanner: case ROUTES.profile: default: if(force) this.render();
    }
  }
  async afterRender(route){
    document.getElementById('app-view')?.focus({preventScroll:true});
    if(route.path === ROUTES.map){
      const container = document.getElementById('agency-map');
      if(container){ await renderAgencyMap(container,getState().agencies.mapItems || [],agency => navigate(ROUTES.agency,{id:agency.id || agency.numero})); }
    }
  }
  render(){
    const state = getState();
    if(!state.session){ this.root.replaceChildren(loginView(this.loginState)); return; }
    this.root.replaceChildren(appFrameView(state,this.routeView(state)));
  }
  routeView(state){
    const permission = action => can(action,state);
    switch(state.route.path){
      case ROUTES.home:return homeView(state);
      case ROUTES.operations:return operationsView(state);
      case ROUTES.operation:return operationDetailView(state,permission);
      case ROUTES.createOperation:return operationFormView(state,this.operationDraft);
      case ROUTES.agencies:return agenciesView(state);
      case ROUTES.agency:return agencyDetailView(state);
      case ROUTES.scanner:return scannerView(state);
      case ROUTES.technicians:return techniciansView(state);
      case ROUTES.notifications:return notificationsView(state);
      case ROUTES.profile:return profileView(state);
      case ROUTES.map:return mapView(state);
      default:return homeView(state);
    }
  }
  setLoginState(patch){ this.loginState = {...this.loginState,...patch}; this.render(); }
  setOperationDraft(value){ this.operationDraft = {...value}; }
  can(action){ return can(action,getState()); }
  async refresh(){ return this.handleRoute(getState().route,true); }
  async reloadSelectedOperation(){ const ref=getState().route.params.id; if(ref){ await loadOperationDetail(ref); this.render(); } }
  async setupRealtime(){
    await clearRealtime();
    await subscribeTable(TABLES.operations,payload => this.scheduleRealtime(TABLES.operations,payload));
    await subscribeTable(TABLES.notifications,payload => this.scheduleRealtime(TABLES.notifications,payload));
  }
  scheduleRealtime(table,payload){
    clearTimeout(this.realtimeTimers.get(table));
    this.realtimeTimers.set(table,setTimeout(async () => {
      const route=getState().route;
      try{
        if(table === TABLES.operations){
          if(route.path === ROUTES.home) await loadHomeData();
          else if(route.path === ROUTES.operations) await loadOperationsPage({reset:true});
          else if(route.path === ROUTES.operation){ const changed=payload?.new?.id || payload?.old?.id || payload?.new?.codigo; if(!changed || String(changed) === String(route.params.id) || String(payload?.new?.codigo) === String(route.params.id)) await loadOperationDetail(route.params.id); }
          else return;
        }else if([ROUTES.home,ROUTES.notifications].includes(route.path)) await loadNotificationsData(); else return;
        this.render();
      }catch(error){ console.warn('[Grupo Ortiz] Realtime no pudo refrescar la vista afectada.',error); }
    },350));
  }
  handleError(context,error,{silent=false}={}){
    const classified=classifyError(error); logError(context,error);
    if(classified.type === ERROR_TYPES.sessionExpired || classified.type === ERROR_TYPES.sessionInvalid){ this.clearSession(); if(!silent) showToast('Sesión finalizada',classified.message,'warning'); return classified; }
    if(!silent) showToast('No se pudo completar',classified.message,classified.type === ERROR_TYPES.permission ? 'warning' : 'danger'); return classified;
  }
  destroy(){ this.cleanup.forEach(fn => { try{ fn?.(); }catch{} }); stopScanner(); clearRealtime(); destroyMap(); }
}

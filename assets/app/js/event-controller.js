import { ROUTES } from './config.js';
import { firstAllowedRoute } from './permissions.js';
import { getState, updateSlice, setState } from './store.js';
import { navigate } from './router.js';
import { signIn, signOut } from './auth.js';
import { loadOperationsPage, loadAgenciesPage, ensureAgencyReferenceData, loadTechniciansData, loadNotificationsData, loadMapData } from './services/data-service.js';
import { createOperation, assignOperation, reassignOperation, startOperation, addComment, addDiagnosis, addEvidence, finishOperation, closeByWhatsApp, normalizeOperation } from './services/operations-service.js';
import { safeUpdateOperation } from './api/operations-api.js';
import { lookupScannerCode, listActiveProducts, listActiveWarehouses, listActiveAgencies, registerInventoryEntry, transferInventorySerial, receivePendingSerial, reportReceiptIncident, findSerial } from './api/equipment-api.js';
import { markNotificationRead, markAllNotificationsRead, createOperationalNotification } from './api/notifications-api.js';
import { uploadEvidenceBatch, prepareFiles, revokePreviews } from './services/evidence-service.js';
import { startScanner, stopScanner, switchScannerCamera, toggleScannerTorch } from './services/scanner-service.js';
import { validateScannerValue, addRecentScan, createBatchState, addBatchValue, removeBatchValue, signalScannerFeedback } from './services/scanner-inventory-service.js';
import { openScannerResultSheet, openScannerEntryDialog, openScannerTransferDialog, openScannerReceiveDialog, openScannerIncidentDialog, openScannerHistoryDialog } from './components/scanner-inventory-dialogs.js';
import { whatsappUrl, getCurrentPosition, centerMap } from './services/location-service.js';
import { installPwa, activatePwaUpdate } from './services/pwa-service.js';
import { saveDraft, removeDraft } from './services/draft-service.js';
import { assignmentDialog, commentDialog, diagnosisDialog, evidenceDialog, finishDialog, whatsappActionsDialog, whatsappCloseDialog, agencyFiltersDialog } from './components/action-dialogs.js';
import { openOperationFilters } from './components/filter-sheet.js';
import { confirmDialog } from './components/confirm-dialog.js';
import { closeModal, hasOpenModal, trapModalFocus } from './components/modal.js';
import { showToast, dismissToast } from './components/toast.js';
import { showLoader, hideLoader } from './components/loader.js';
import { classifyError, ERROR_TYPES } from './errors.js';
const debounceTimers = new Map();
export function attachEventController(controller){
  const onClick = event => handleClick(event,controller);
  const onSubmit = event => handleSubmit(event,controller);
  const onInput = event => handleInput(event,controller);
  const onChange = event => handleChange(event,controller);
  const onKeydown = event => handleKeydown(event,controller);
  document.addEventListener('click',onClick); document.addEventListener('submit',onSubmit); document.addEventListener('input',onInput); document.addEventListener('change',onChange); document.addEventListener('keydown',onKeydown);
  return () => { document.removeEventListener('click',onClick); document.removeEventListener('submit',onSubmit); document.removeEventListener('input',onInput); document.removeEventListener('change',onChange); document.removeEventListener('keydown',onKeydown); };
}
async function handleClick(event,controller){
  const target = event.target.closest('[data-action]'); if(!target) return;
  const action = target.dataset.action;
  if(action === 'close-drawer' && event.target.closest('[data-drawer-panel]')) return;
  if(action === 'close-modal' && event.target.closest('[data-modal-panel]') && event.target === event.currentTarget) return;
  try{
    switch(action){
      case 'go-home':requireAction(controller,'home.view',() => go(ROUTES.home));break; case 'go-operations':requireAction(controller,'operations.view',() => go(ROUTES.operations));break; case 'go-scanner':requireAction(controller,'scanner.lookup',() => go(ROUTES.scanner));break;
      case 'go-agencies':requireAction(controller,'agencies.view',() => go(ROUTES.agencies));break; case 'go-profile':go(ROUTES.profile);break; case 'go-notifications':requireAction(controller,'notifications.view',() => go(ROUTES.notifications));break;
      case 'go-create-operation':requireAction(controller,'operations.create',() => go(ROUTES.createOperation));break;
      case 'go-map':requireAction(controller,'agencies.map',() => go(ROUTES.map));break; case 'go-technicians':requireAction(controller,'technicians.view',() => go(ROUTES.technicians));break;
      case 'go-back':history.length > 1 ? history.back() : go(ROUTES.home);break;
      case 'go-operations-search':requireAction(controller,'operations.view',() => go(ROUTES.operations));setTimeout(() => document.querySelector('[data-input-action="operations-search"]')?.focus(),450);break;
      case 'go-agencies-search':requireAction(controller,'agencies.view',() => go(ROUTES.agencies));setTimeout(() => document.querySelector('[data-input-action="agencies-search"]')?.focus(),450);break;
      case 'go-unassigned-operations':requireAction(controller,'operations.assign');updateSlice('operations',{filters:{status:'Pendiente'}},'unassigned-filter');go(ROUTES.operations);break;
      case 'toggle-drawer':updateSlice('ui',{drawerOpen:!getState().ui.drawerOpen},'drawer');controller.render();break;
      case 'close-drawer':updateSlice('ui',{drawerOpen:false},'drawer');controller.render();break;
      case 'refresh-view':await withLoader('Actualizando datos…',() => controller.refresh());break;
      case 'close-modal':closeModal();break;
      case 'dismiss-toast':dismissToast(target.dataset.toastId);break;
      case 'toggle-password':togglePassword(target);break;
      case 'login-help':showToast('Ayuda de acceso','Usa tu correo autorizado. Si tu usuario no se resuelve, contacta al administrador para confirmar el perfil.','info');break;
      case 'open-operation':requireAction(controller,'operations.view',() => go(ROUTES.operation,{id:target.dataset.operationId}));break;
      case 'open-agency':requireAction(controller,'agencies.detail',() => go(ROUTES.agency,{id:target.dataset.agencyId}));break;
      case 'open-operation-filters':await ensureAgencyReferenceData();if(!getState().technicians.items.length) await loadTechniciansData();openOperationFilters(getState().operations.filters,getState().technicians.items,getState().agencies.groups || []);break;
      case 'filter-operation-status':updateSlice('operations',current => ({filters:{...current.filters,status:target.dataset.status}}),'operation-status-filter');await loadOperationsPage({reset:true});controller.render();break;
      case 'clear-operation-filters':closeModal();updateSlice('operations',{filters:{status:'Todos'}},'operation-filters-clear');await loadOperationsPage({reset:true});controller.render();break;
      case 'load-more-operations':await loadOperationsPage({reset:false});controller.render();break;
      case 'open-agency-filters':await ensureAgencyReferenceData();agencyFiltersDialog(getState().agencies.groups || [],getState().agencies.filters);break;
      case 'clear-agency-filters':updateSlice('agencies',{filters:{}},'agency-filters-clear');await loadAgenciesPage({reset:true});controller.render();break;
      case 'load-more-agencies':await loadAgenciesPage({reset:false});controller.render();break;
      case 'open-assignment':await openAssignment(controller,false);break;
      case 'open-reassignment':await openAssignment(controller,true);break;
      case 'start-operation':requireAction(controller,'operations.start');await mutateSelected(controller,'Iniciando operación…',op => startOperation(op.id || op.code,getState().profile),'Operación iniciada');break;
      case 'open-comment':requireAction(controller,'operations.comment',() => commentDialog(selectedOperation()));break;
      case 'open-diagnosis':requireAction(controller,'operations.diagnose',() => diagnosisDialog(selectedOperation()));break;
      case 'open-evidence':requireAction(controller,'operations.evidence');clearEvidenceFiles();evidenceDialog(selectedOperation(),[]);break;
      case 'finish-operation':requireAction(controller,'operations.finish',() => finishDialog(selectedOperation()));break;
      case 'open-whatsapp-actions':whatsappActionsDialog(selectedOperation());break;
      case 'open-whatsapp-close':requireAction(controller,'operations.closeWhatsapp',() => whatsappCloseDialog(selectedOperation()));break;
      case 'open-operation-agency':openOperationAgency();break;
      case 'send-whatsapp-template':openWhatsAppTemplate(target);break;
      case 'start-scanner':await startCameraScanner(controller);break;
      case 'stop-scanner':await stopCameraScanner(controller);break;
      case 'scanner-toggle-torch':await toggleCameraTorch(controller);break;
      case 'scanner-switch-camera':await switchCamera(controller);break;
      case 'scanner-open-result':openCurrentScannerResult(controller);break;
      case 'scanner-scan-again':await scanAgain(controller);break;
      case 'scanner-open-entry':await openScannerEntryFlow(controller,false);break;
      case 'scanner-open-batch-entry':await openScannerEntryFlow(controller,true);break;
      case 'scanner-open-history':openCurrentScannerHistory();break;
      case 'scanner-open-transfer':await openScannerTransferFlow(controller);break;
      case 'scanner-open-receive':openScannerReceiveFlow(controller);break;
      case 'scanner-open-receipt-incident':openScannerIncidentFlow(controller);break;
      case 'scanner-pause-batch':await pauseScannerBatch(controller);break;
      case 'scanner-resume-batch':await resumeScannerBatch(controller);break;
      case 'scanner-cancel-batch':await cancelScannerBatch(controller);break;
      case 'scanner-remove-batch-serial':removeScannerBatchSerial(target.dataset.serial,controller);break;
      case 'scanner-confirm-batch':await confirmScannerBatch(controller);break;
      case 'scanner-repeat-recent':await processScannerValue(target.dataset.value,controller,{source:'recent'});break;
      case 'remove-evidence-file':removeEvidenceFile(target.dataset.fileId,target.dataset.prefix,controller);break;
      case 'open-notification':await openNotification(target.dataset.notificationId);controller.render();break;
      case 'mark-all-notifications-read':await withLoader('Actualizando alertas…',async () => { await markAllNotificationsRead(); await loadNotificationsData(); controller.render(); });break;
      case 'open-alert':openAlert(target.dataset.alertId);break;
      case 'install-pwa':{
        const result=await installPwa();
        if(result.outcome === 'accepted') showToast('Aplicación instalada','La instalación fue aceptada.','success');
        else if(result.outcome === 'installed') showToast('Aplicación instalada','Ya estás usando la versión instalada.','info');
        else if(result.outcome === 'ios-help') showToast('Instalar en iPhone','Pulsa Compartir en Safari y selecciona “Agregar a pantalla de inicio”.','info');
        else showToast('Instalación no disponible','Abre la app en Chrome o Safari y vuelve a intentarlo.','info');
        controller.render();break;
      }
      case 'activate-pwa-update':{
        const activated=await activatePwaUpdate();
        showToast('Actualización',activated?'Aplicando la versión nueva…':'No hay una actualización pendiente.',activated?'success':'info');
        break;
      }
      case 'request-logout':confirmDialog({title:'Cerrar sesión',message:'¿Deseas salir de la aplicación de Operaciones?',confirmLabel:'Cerrar sesión',confirmAction:'confirm-logout',tone:'danger'});break;
      case 'confirm-logout':await withLoader('Cerrando sesión…',async () => { closeModal(); await signOut(); });break;
      case 'create-operation-from-agency':requireAction(controller,'operations.create',() => go(ROUTES.createOperation,{}, {agency:target.dataset.agencyId}));break;
      case 'open-scanned-agency':requireAction(controller,'agencies.detail',() => go(ROUTES.agency,{id:target.dataset.agencyId}));break;
      case 'open-scanned-operation':requireAction(controller,'operations.view',() => go(ROUTES.operation,{id:target.dataset.operationId}));break;
      case 'contact-technician':{const url=whatsappUrl(target.dataset.phone,`Hola ${target.dataset.name || ''}, contacto desde Operaciones Grupo Ortiz.`);if(url) globalThis.open(url,'_blank','noopener');break;}
      case 'center-user-location':await centerUser();break;
      case 'save-operation-draft':await saveCurrentOperationDraft(controller);break;
      default:break;
    }
  }catch(error){ controller.handleError(`Acción ${action}`,error); }
}
async function handleSubmit(event,controller){
  const form = event.target.closest('[data-form]'); if(!form) return; event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries()); const name = form.dataset.form;
  try{
    switch(name){
      case 'login':await submitLogin(data,controller);break;
      case 'create-operation':await submitCreateOperation(data,controller);break;
      case 'serial-search':await processScannerValue(data.serial,controller,{source:'manual'});break;
      case 'scanner-entry':await submitScannerEntry(data,controller);break;
      case 'scanner-batch-setup':await submitScannerBatchSetup(data,controller);break;
      case 'scanner-transfer':await submitScannerTransfer(data,controller);break;
      case 'scanner-receive':await submitScannerReceive(data,controller);break;
      case 'scanner-receipt-incident':await submitScannerReceiptIncident(data,controller);break;
      case 'assign-operation':await submitAssignment(data,controller,false);break;
      case 'reassign-operation':await submitAssignment(data,controller,true);break;
      case 'add-comment':await submitComment(data,controller);break;
      case 'add-diagnosis':await submitDiagnosis(data,controller);break;
      case 'add-evidence':await submitEvidence(data,controller);break;
      case 'finish-operation':await submitFinish(data,controller);break;
      case 'close-whatsapp':await submitWhatsAppClose(data,controller);break;
      case 'operation-filters':await applyOperationFilters(data,controller);break;
      case 'agency-filters':await applyAgencyFilters(data,controller);break;
      default:break;
    }
  }catch(error){ controller.handleError(`Formulario ${name}`,error); }
}
function handleInput(event,controller){
  const action = event.target.dataset.inputAction; if(!action) return;
  clearTimeout(debounceTimers.get(action));
  debounceTimers.set(action,setTimeout(async () => {
    try{
      if(action === 'operations-search'){ updateSlice('operations',current => ({filters:{...current.filters,search:event.target.value.trim()}}),'operations-search');await loadOperationsPage({reset:true});controller.render(); }
      if(action === 'agencies-search'){ updateSlice('agencies',current => ({filters:{...current.filters,search:event.target.value.trim()}}),'agencies-search');await loadAgenciesPage({reset:true});controller.render(); }
      if(action === 'technicians-search'){ updateSlice('technicians',{search:event.target.value.trim()},'technicians-search');controller.render(); }
      if(action === 'scanner-product-filter') filterScannerProducts(event.target);
    }catch(error){ controller.handleError(`Búsqueda ${action}`,error); }
  },420));
}
async function handleChange(event,controller){
  if(event.target.matches('[data-file-input]')){ addEvidenceFiles(event.target.files,controller,event.target.dataset.fileInput?.startsWith('detail')?'detail':'create'); event.target.value=''; return; }
  if(event.target.dataset.changeAction === 'map-group-filter'){
    const group=event.target.value; const query=new URLSearchParams(); if(group) query.set('group',group); navigate(ROUTES.map,{},query,{replace:true});
  }
  if(event.target.matches('[data-scanner-destination-type]')) populateScannerDestinations(event.target);
}
function handleKeydown(event,controller){
  trapModalFocus(event);
  if(event.key === 'Escape'){
    if(hasOpenModal()){ closeModal(); return; }
    if(getState().ui.drawerOpen){ updateSlice('ui',{drawerOpen:false},'drawer');controller.render(); }
  }
  if((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"][data-action]')){ event.preventDefault(); event.target.click(); }
}
async function submitLogin(data,controller){
  controller.setLoginState({loading:true,error:''});
  try{ const auth=await signIn(data.identity,data.password);controller.applyAuth(auth);navigate(firstAllowedRoute(getState()),{},null,{replace:true});showToast('Bienvenido',`Sesión iniciada como ${auth.profile.nombre_completo || auth.user.email}.`,'success'); }
  catch(error){ const classified=classifyError(error);controller.setLoginState({loading:false,error:classified.message});return; }
  controller.setLoginState({loading:false,error:''});
}
async function submitCreateOperation(data,controller){
  requireOnline(); requireAction(controller,'operations.create');
  const agency=findAgency(data.agency); if(!agency) throw new Error('Selecciona una agencia real del sistema.');
  if(!String(data.title || '').trim() || !String(data.description || '').trim()) throw new Error('Completa el título y la descripción.');
  await withLoader('Creando operación…',async () => {
    const state=getState(); const created=await createOperation({...data,agency},{profile:state.profile,user:state.user});
    const files=state.evidence.files.map(item => item.file);
    if(files.length){
      try{
        const urls=await uploadEvidenceBatch(files,created.codigo || created.code,data.description,progress => updateProgress(progress));
        const op=normalizeOperation(created); const history=[...op.history,{fecha:new Date().toISOString(),accion:'Evidencia inicial cargada',usuario:state.profile.usuario_login || state.user.email,nombre:state.profile.nombre_completo || state.user.email,detalle:`${urls.length} archivo(s)`,tipo:'evidencia_inicial',urls}];
        await safeUpdateOperation(created.id || created.codigo,{fotos_reportadas:urls,foto_url:urls[0] || '',evidencia_estado:'confirmada',evidencia_archivos_seleccionados:urls.length,historial:history,actualizado_en:new Date().toISOString()});
      }catch(error){ showToast('Operación creada','La operación se guardó, pero la evidencia inicial no pudo confirmarse. Puedes reintentar desde el detalle.','warning',8000); }
    }
    revokePreviews(state.evidence.files); updateSlice('evidence',{files:[],progress:0},'evidence-clear'); await removeDraft('create-operation').catch(() => null);controller.setOperationDraft({});
    await notifyBestEffort({type:'OPERACION_CREADA',title:'Nueva operación creada',message:`${created.codigo || created.code} fue registrada desde la app móvil.`,importance:'normal',operation:created});
    showToast('Operación creada',`${created.codigo || created.code} fue registrada correctamente.`,'success');navigate(ROUTES.operation,{id:created.id || created.codigo});
  });
}
async function submitAssignment(data,controller,reassign){
  requireOnline(); requireAction(controller,reassign?'operations.reassign':'operations.assign');
  if(!data.technician) throw new Error('Selecciona un técnico.');
  await withLoader(reassign?'Reasignando…':'Asignando…',async () => { const updated=await (reassign?reassignOperation:assignOperation)(data.reference,data.technician,data.comment,getState().profile);await notifyBestEffort({type:reassign?'OPERACION_REASIGNADA':'OPERACION_ASIGNADA',title:reassign?'Operación reasignada':'Operación asignada',message:`${normalizeOperation(updated).code || data.reference} · ${data.technician}`,importance:'normal',operation:updated});closeModal();showToast(reassign?'Operación reasignada':'Operación asignada',`Técnico: ${data.technician}`,'success');await controller.reloadSelectedOperation(); });
}
async function submitComment(data,controller){
  requireOnline(); requireAction(controller,'operations.comment'); if(!String(data.comment || '').trim()) throw new Error('Escribe un comentario.');
  await withLoader('Guardando comentario…',async () => {await addComment(data.reference,data.comment,getState().profile);closeModal();showToast('Comentario guardado','','success');await controller.reloadSelectedOperation();});
}
async function submitDiagnosis(data,controller){
  requireOnline(); requireAction(controller,'operations.diagnose'); if(!String(data.diagnosis || '').trim()) throw new Error('Escribe el diagnóstico.');
  await withLoader('Guardando diagnóstico…',async () => {await addDiagnosis(data.reference,data.diagnosis,getState().profile);closeModal();showToast('Diagnóstico guardado','','success');await controller.reloadSelectedOperation();});
}
async function submitEvidence(data,controller){
  requireOnline(); requireAction(controller,'operations.evidence'); const state=getState(); const files=state.evidence.files.map(item => item.file); if(!files.length) throw new Error('Selecciona al menos un archivo.');
  const op=selectedOperation();
  await withLoader('Subiendo evidencia protegida…',async () => {const urls=await uploadEvidenceBatch(files,op.code,data.description,progress => updateProgress(progress));await addEvidence(data.reference,urls,data.description,state.profile);revokePreviews(state.evidence.files);updateSlice('evidence',{files:[],progress:0},'evidence-clear');closeModal();showToast('Evidencia guardada',`${urls.length} archivo(s) confirmado(s).`,'success');await controller.reloadSelectedOperation();});
}
async function submitFinish(data,controller){
  requireOnline(); requireAction(controller,'operations.finish'); if(!String(data.comment || '').trim()) throw new Error('Escribe el comentario final.');
  await withLoader('Finalizando operación…',async () => {const updated=await finishOperation(data.reference,data.comment,getState().profile);await notifyBestEffort({type:'OPERACION_COMPLETADA',title:'Operación completada',message:`${normalizeOperation(updated).code || data.reference} fue finalizada.`,importance:'normal',operation:updated});closeModal();showToast('Operación finalizada','El cierre quedó registrado en el historial.','success');await controller.reloadSelectedOperation();});
}
async function submitWhatsAppClose(data,controller){
  requireOnline(); requireAction(controller,'operations.closeWhatsapp'); if(!data.reason || !String(data.comment || '').trim() || !data.manager || !data.phone) throw new Error('Completa motivo, encargado, teléfono y comentario.');
  await withLoader('Registrando cierre por WhatsApp…',async () => {const updated=await closeByWhatsApp(data.reference,data,getState().profile);await notifyBestEffort({type:'OPERACION_CERRADA_WHATSAPP',title:'Cierre por WhatsApp',message:`${normalizeOperation(updated).code || data.reference} fue cerrada mediante soporte remoto.`,importance:'normal',operation:updated});closeModal();showToast('Operación cerrada','Cierre por soporte WhatsApp registrado.','success');await controller.reloadSelectedOperation();});
}
async function applyOperationFilters(data,controller){
  closeModal(); updateSlice('operations',{filters:{...getState().operations.filters,...data}},'operation-filters');await loadOperationsPage({reset:true});controller.render();
}
async function applyAgencyFilters(data,controller){
  closeModal(); updateSlice('agencies',{filters:{...getState().agencies.filters,...data}},'agency-filters');await loadAgenciesPage({reset:true});controller.render();
}
async function processScannerValue(value,controller,{source='manual'} = {}){
  requireAction(controller,getState().scanner.batch?.active?'scanner.batchEntry':'scanner.lookup');
  const validation=validateScannerValue(value);
  if(!validation.valid) throw Object.assign(new Error(validation.message),{code:'VALIDATION'});
  const scanner=getState().scanner;
  if(scanner.batch?.active){
    if(scanner.batch.paused) throw new Error('El lote está pausado. Pulsa Reanudar para continuar.');
    updateSlice('scanner',{processing:true,status:'processing',error:''},'scanner-batch-processing');updateScannerStatusDom('Validando serial para el lote…');
    try{
      const online=navigator.onLine;
      const existing=online ? await findSerial(validation.normalizedValue) : null;
      const outcome=addBatchValue(getState().scanner.batch,validation.normalizedValue,Boolean(existing));
      const nextBatch=outcome.added && !online ? {...outcome.batch,unverified:[...new Set([...(outcome.batch.unverified || []),validation.normalizedValue])]} : outcome.batch;
      updateSlice('scanner',{batch:nextBatch,processing:false,status:'batch-entry',rawValue:validation.rawValue,normalizedValue:validation.normalizedValue,recentScans:addRecentScan(getState().scanner.recentScans,{kind:existing?'equipment':'unknown',rawValue:validation.rawValue,normalizedValue:validation.normalizedValue,equipment:existing})},'scanner-batch-value');
      signalScannerFeedback(outcome.added?'success':'warning');
      if(!outcome.added) showToast(existing ? 'Serial ya registrado' : 'Serial repetido',outcome.message,'warning');
      updateScannerBatchDom(nextBatch);updateScannerStatusDom(outcome.added?`${validation.normalizedValue} agregado al lote${online?'':' · pendiente de validar'}.`:outcome.message);saveDraft('scanner-batch-entry',nextBatch).catch(() => null);
      return;
    }catch(error){updateSlice('scanner',{processing:false,status:'batch-entry',error:classifyError(error).message},'scanner-batch-error');updateScannerStatusDom(classifyError(error).message);throw error;}
  }

  if(scanner.active && source !== 'camera') await stopCameraScanner(controller,{render:false});
  updateSlice('scanner',{processing:true,status:'processing',error:'',rawValue:validation.rawValue,normalizedValue:validation.normalizedValue},'scanner-lookup-start');controller.render();
  try{
    const result=await lookupScannerCode(validation.normalizedValue);
    updateSlice('scanner',{result,processing:false,status:'result',mode:'lookup',active:false,cameraActive:false,engine:'',cameraLabel:'',torchEnabled:false,torchSupported:false,recentScans:addRecentScan(getState().scanner.recentScans,result)},'scanner-lookup-result');
    signalScannerFeedback(result.kind === 'invalid' ? 'warning' : result.kind === 'unknown' ? 'warning' : 'success');
    controller.render();
    openScannerResultSheet(result,{permissions:scannerActionPermissions(controller)});
  }catch(error){
    const classified=classifyError(error);
    updateSlice('scanner',{processing:false,status:'error',active:false,cameraActive:false,error:classified.message},'scanner-lookup-error');
    signalScannerFeedback('warning');controller.render();throw error;
  }
}

async function loadScannerCatalogs(){
  const cached=getState().scanner.catalogs || {};
  if(cached.loadedAt && Date.now() - Number(cached.loadedAt) < 60000 && cached.products?.length && cached.warehouses?.length) return cached;
  requireOnline();
  const [products,warehouses,agencies]=await Promise.all([listActiveProducts(),listActiveWarehouses(),listActiveAgencies()]);
  const catalogs={products,warehouses,agencies,loadedAt:Date.now()};
  updateSlice('scanner',{catalogs},'scanner-catalogs');
  return catalogs;
}

function openCurrentScannerResult(controller){
  const result=getState().scanner.result;
  if(!result) throw new Error('Primero escanea o escribe un código.');
  openScannerResultSheet(result,{permissions:scannerActionPermissions(controller)});
}

async function scanAgain(controller){
  closeModal();
  updateSlice('scanner',{result:null,error:'',status:'idle',rawValue:'',normalizedValue:''},'scanner-scan-again');
  controller.render();
  await startCameraScanner(controller);
}

async function openScannerEntryFlow(controller,batch){
  requireAction(controller,batch?'scanner.batchEntry':'scanner.entry');
  const result=getState().scanner.result || {kind:'unknown',normalizedValue:''};
  if(!batch && result.kind === 'equipment') throw new Error('El serial ya existe; no puede registrarse como entrada nueva.');
  const catalogs=await withLoader('Cargando inventario…',loadScannerCatalogs);
  updateSlice('scanner',{mode:batch?'batch-entry':'single-entry'},'scanner-entry-open');
  openScannerEntryDialog({result,products:catalogs.products,warehouses:catalogs.warehouses,batch});
}

async function submitScannerEntry(data,controller){
  requireOnline();requireAction(controller,'scanner.entry');
  if(getState().scanner.processing) return;
  const validation=validateScannerValue(data.serial);
  if(!validation.valid) throw Object.assign(new Error(validation.message),{code:'VALIDATION'});
  updateSlice('scanner',{processing:true},'scanner-entry-submit');
  try{
    await withLoader('Registrando entrada…',() => registerInventoryEntry({...data,serials:[validation.normalizedValue]}));
    closeModal();showToast('Entrada registrada',`${validation.normalizedValue} fue recibido correctamente en inventario.`,'success',7000);
    await processScannerValue(validation.normalizedValue,controller,{source:'entry'});
  }finally{updateSlice('scanner',{processing:false},'scanner-entry-finish');}
}

async function submitScannerBatchSetup(data,controller){
  requireAction(controller,'scanner.batchEntry');
  const catalogs=getState().scanner.catalogs || {};
  const product=(catalogs.products || []).find(row => String(row.id) === String(data.productId));
  const warehouse=(catalogs.warehouses || []).find(row => String(row.id) === String(data.warehouseId));
  if(!product || product.activo === false) throw new Error('Selecciona un producto activo.');
  if(!warehouse || warehouse.activo === false) throw new Error('Selecciona un almacén activo.');
  const batch=createBatchState({...data,product,warehouse,active:true,paused:false});
  closeModal();updateSlice('scanner',{mode:'batch-entry',status:'batch-entry',batch,result:null,error:''},'scanner-batch-start');await saveDraft('scanner-batch-entry',batch).catch(() => null);controller.render();
  try{await startCameraScanner(controller);}catch(error){showToast('Cámara no disponible','El lote quedó preparado. Puedes agregar los seriales manualmente.','warning',7000);}
}

async function confirmScannerBatch(controller){
  requireOnline();requireAction(controller,'scanner.batchEntry');
  const batch=getState().scanner.batch;
  if(!batch?.active || !batch.serials?.length) throw new Error('Agrega por lo menos un serial al lote.');
  if(batch.invalid?.length) throw new Error('Elimina los seriales rechazados antes de confirmar.');
  const duplicates=[];for(const serial of batch.serials){if(await findSerial(serial)) duplicates.push(serial);}
  if(duplicates.length){const invalid=[...(batch.invalid || []),...duplicates.map(serial=>({serial,reason:'Ya existe en inventario'}))];const revised={...batch,invalid,unverified:[]};updateSlice('scanner',{batch:revised},'scanner-batch-revalidate');updateScannerBatchDom(revised);await saveDraft('scanner-batch-entry',revised).catch(()=>null);throw new Error(`No se puede confirmar: ${duplicates.join(', ')} ya existe en inventario.`);}
  if(getState().scanner.active) await stopCameraScanner(controller,{render:false});
  updateSlice('scanner',{processing:true},'scanner-batch-submit');
  try{
    await withLoader(`Registrando ${batch.serials.length} seriales…`,() => registerInventoryEntry({
      warehouseId:batch.warehouseId,productId:batch.productId,supplier:batch.supplier,date:batch.date,reference:batch.reference,physicalCondition:batch.physicalCondition,motive:batch.motive,observations:batch.observations,serials:batch.serials
    }));
    const first=batch.serials[0];
    updateSlice('scanner',{batch:null,mode:'lookup',status:'idle',processing:false},'scanner-batch-success');await removeDraft('scanner-batch-entry').catch(() => null);
    showToast('Lote registrado',`${batch.serials.length} seriales fueron creados en una sola transacción.`,'success',8000);
    await processScannerValue(first,controller,{source:'batch'});
  }finally{updateSlice('scanner',{processing:false},'scanner-batch-finish');}
}

function removeScannerBatchSerial(serial,controller){
  const batch=getState().scanner.batch;if(!batch) return;
  const next=removeBatchValue(batch,serial);updateSlice('scanner',{batch:next},'scanner-batch-remove');updateScannerBatchDom(next);saveDraft('scanner-batch-entry',next).catch(() => null);
}

async function pauseScannerBatch(controller){
  const batch=getState().scanner.batch;if(!batch?.active) return;
  await stopCameraScanner(controller,{render:false});
  updateSlice('scanner',{batch:{...batch,paused:true},active:false,cameraActive:false,status:'batch-entry'},'scanner-batch-pause');controller.render();
}

async function resumeScannerBatch(controller){
  const batch=getState().scanner.batch;if(!batch?.active) return;
  updateSlice('scanner',{batch:{...batch,paused:false},error:''},'scanner-batch-resume');controller.render();try{await startCameraScanner(controller);}catch(error){showToast('Cámara no disponible','Continúa agregando seriales manualmente.','warning');}
}

async function cancelScannerBatch(controller){
  if(getState().scanner.active) await stopCameraScanner(controller,{render:false});
  updateSlice('scanner',{batch:null,mode:'lookup',status:'idle',result:null,error:'',active:false,cameraActive:false},'scanner-batch-cancel');await removeDraft('scanner-batch-entry').catch(() => null);controller.render();
}

function openCurrentScannerHistory(){
  const equipment=getState().scanner.result?.equipment;
  if(!equipment) throw new Error('No hay un serial encontrado para consultar.');
  openScannerHistoryDialog(equipment);
}

async function openScannerTransferFlow(controller){
  requireAction(controller,'scanner.transfer');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment?.inventoryContext?.canTransfer) throw new Error(equipment?.inventoryContext?.blockedReasons?.[0] || 'Este equipo no puede transferirse ahora.');
  const catalogs=await withLoader('Cargando destinos…',loadScannerCatalogs);
  updateSlice('scanner',{mode:'send'},'scanner-transfer-open');
  openScannerTransferDialog({equipment,warehouses:catalogs.warehouses,agencies:catalogs.agencies});
}

async function submitScannerTransfer(data,controller){
  requireOnline();requireAction(controller,'scanner.transfer');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment) throw new Error('Vuelve a consultar el serial.');
  await withLoader('Registrando transferencia…',() => transferInventorySerial({equipment,...data}));
  closeModal();showToast('Transferencia registrada',`${equipment.serial} fue enviado al destino seleccionado.`,'success',7000);
  await processScannerValue(equipment.serial,controller,{source:'transfer'});
}

function openScannerReceiveFlow(controller){
  requireAction(controller,'scanner.receive');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment?.inventoryContext?.canReceive) throw new Error('Este serial no tiene una recepción pendiente.');
  updateSlice('scanner',{mode:'receive'},'scanner-receive-open');
  openScannerReceiveDialog(equipment);
}

async function submitScannerReceive(data,controller){
  requireOnline();requireAction(controller,'scanner.receive');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment) throw new Error('Vuelve a consultar el serial.');
  await withLoader('Confirmando recepción…',() => receivePendingSerial({equipment,observations:data.observations}));
  closeModal();showToast('Recepción confirmada',`${equipment.serial} fue recibido correctamente.`,'success',7000);
  await processScannerValue(equipment.serial,controller,{source:'receive'});
}

function openScannerIncidentFlow(controller){
  requireAction(controller,'scanner.incident');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment?.pendingReceipt) throw new Error('Este serial no tiene una recepción pendiente.');
  updateSlice('scanner',{mode:'receive'},'scanner-incident-open');
  closeModal();openScannerIncidentDialog(equipment);
}

async function submitScannerReceiptIncident(data,controller){
  requireOnline();requireAction(controller,'scanner.incident');
  const equipment=getState().scanner.result?.equipment;
  if(!equipment) throw new Error('Vuelve a consultar el serial.');
  await withLoader('Registrando incidencia…',() => reportReceiptIncident({equipment,...data}));
  closeModal();showToast('Incidencia registrada','La ubicación no fue cambiada y el movimiento quedó pendiente de revisión.','warning',8000);
  await processScannerValue(equipment.serial,controller,{source:'incident'});
}

function filterScannerProducts(input){
  const form=input.closest('form');const select=form?.querySelector('[data-scanner-product-select]');if(!select) return;
  const term=String(input.value || '').trim().toLowerCase();
  for(const row of [...select.options]){if(!row.value) continue;row.hidden=Boolean(term) && !String(row.textContent || '').toLowerCase().includes(term);}
}

function populateScannerDestinations(typeSelect){
  const form=typeSelect.closest('form');const select=form?.querySelector('[data-scanner-destination-select]');if(!select) return;
  const type=String(typeSelect.value || '').toUpperCase();
  const selector=type === 'ALMACEN' ? '[data-scanner-warehouses]' : type === 'AGENCIA' ? '[data-scanner-agencies]' : '';
  let rows=[];
  if(selector){try{rows=JSON.parse(form.querySelector(selector)?.textContent || '[]');}catch{rows=[];}}
  select.replaceChildren();
  const initial=document.createElement('option');initial.value='';initial.textContent=rows.length?'Selecciona un destino':'Sin destinos disponibles';initial.selected=true;select.append(initial);
  for(const row of rows){const option=document.createElement('option');option.value=row.id;option.textContent=row.label;select.append(option);}
}

async function startCameraScanner(controller){
  requireAction(controller,getState().scanner.batch?.active?'scanner.batchEntry':'scanner.lookup');
  const batch=getState().scanner.batch;
  updateSlice('scanner',{active:true,cameraActive:true,error:'',result:batch?.active?getState().scanner.result:null,engine:'',cameraLabel:'',processing:false,status:batch?.active?'batch-entry':'scanning'},'scanner-start');
  controller.render();
  const video=document.getElementById('scanner-video');
  try{
    const result=await startScanner(
      video,
      code => processScannerValue(code,controller,{source:'camera'}),
      error => console.warn('[Grupo Ortiz] Detector de código',error),
      {continuous:Boolean(batch?.active),duplicateWindow:1800}
    );
    const message=result.detector?'':'La cámara está activa, pero el detector no pudo cargarse. Puedes escribir el serial manualmente.';
    updateSlice('scanner',{active:true,cameraActive:true,error:message,engine:result.engine,cameraLabel:result.label || result.cameraLabel || '',torchSupported:Boolean(result.torchSupported),torchEnabled:false,cameraCount:Number(result.cameraCount || 1),status:batch?.active?'batch-entry':'scanning'},'scanner-ready');
    const status=document.getElementById('scanner-status');
    if(status) status.textContent=message || `Cámara activa · ${result.label || result.cameraLabel || 'Cámara'}. Detector listo.`;
  }catch(error){
    updateSlice('scanner',{active:false,cameraActive:false,error:classifyError(error).message,engine:'',cameraLabel:'',torchEnabled:false,torchSupported:false,status:'error'},'scanner-error');
    controller.render();throw error;
  }
}

async function stopCameraScanner(controller,{render=true} = {}){
  await stopScanner();
  updateSlice('scanner',{active:false,cameraActive:false,engine:'',cameraLabel:'',torchEnabled:false,torchSupported:false,status:getState().scanner.batch?.active?'batch-entry':'idle'},'scanner-stop');
  if(render) controller.render();
}

async function toggleCameraTorch(controller){
  const enabled=await toggleScannerTorch();
  updateSlice('scanner',{torchEnabled:enabled},'scanner-torch');updateScannerCameraControlsDom();
}

async function switchCamera(controller){
  const video=document.getElementById('scanner-video');if(!video) throw new Error('Abre la cámara antes de cambiarla.');
  const result=await switchScannerCamera(video);
  updateSlice('scanner',{active:true,cameraActive:true,engine:result.engine,cameraLabel:result.label || result.cameraLabel || '',torchSupported:Boolean(result.torchSupported),torchEnabled:false,cameraCount:Number(result.cameraCount || getState().scanner.cameraCount || 1)},'scanner-camera-switch');
  updateScannerCameraControlsDom();updateScannerStatusDom(`Cámara activa · ${result.label || result.cameraLabel || 'Cámara'}. Detector listo.`);
}

function updateScannerBatchDom(batch){
  const count=document.querySelector('[data-scanner-batch-count]');if(count) count.textContent=String(batch?.serials?.length || 0);
  const list=document.querySelector('[data-scanner-batch-list]');
  if(list){
    list.replaceChildren();
    if(batch?.serials?.length){
      for(const serial of batch.serials){
        const row=document.createElement('div');row.className='scanner-batch-item';
        const code=document.createElement('code');code.textContent=serial;
        const button=document.createElement('button');button.className='icon-btn';button.type='button';button.dataset.action='scanner-remove-batch-serial';button.dataset.serial=serial;button.setAttribute('aria-label',`Quitar ${serial}`);button.textContent='×';
        row.append(code,button);list.append(row);
      }
    }else{
      const empty=document.createElement('p');empty.className='muted text-center';empty.textContent=batch?.paused?'El escaneo está pausado.':'Escanea el primer serial del lote.';list.append(empty);
    }
  }
  const invalid=document.querySelector('[data-scanner-batch-invalid]');
  if(invalid){invalid.replaceChildren();for(const item of batch?.invalid || []){const row=document.createElement('p');row.textContent=`${item.serial}: ${item.reason}`;invalid.append(row);}invalid.classList.toggle('hidden',!(batch?.invalid?.length));}
  const unverified=document.querySelector('[data-scanner-batch-unverified]');if(unverified){const count=batch?.unverified?.length || 0;unverified.textContent=`${count} serial(es) pendientes de validar al recuperar conexión.`;unverified.classList.toggle('hidden',!count);}
  const confirm=document.querySelector('[data-scanner-batch-confirm]');
  if(confirm){const online=navigator.onLine;confirm.disabled=!online || !(batch?.serials?.length);confirm.textContent=online?`Confirmar ${batch?.serials?.length || 0} serial(es)`:'Requiere conexión para confirmar';}
}

function updateScannerCameraControlsDom(){
  const scanner=getState().scanner;
  const torch=document.querySelector('[data-action="scanner-toggle-torch"]');
  if(torch){torch.disabled=!scanner.active || !scanner.torchSupported;torch.textContent=scanner.torchEnabled?'Apagar linterna':'Linterna';torch.classList.toggle('is-active',Boolean(scanner.torchEnabled));torch.setAttribute('aria-pressed',scanner.torchEnabled?'true':'false');}
  const switchButton=document.querySelector('[data-action="scanner-switch-camera"]');if(switchButton) switchButton.disabled=!scanner.active || Number(scanner.cameraCount || 0)<2;
}

function updateScannerStatusDom(message){const status=document.getElementById('scanner-status');if(status) status.textContent=String(message || '');}

async function openAssignment(controller,reassign){
  requireAction(controller,reassign?'operations.reassign':'operations.assign'); if(!getState().technicians.items.length) await loadTechniciansData();assignmentDialog(selectedOperation(),getState().technicians.items,{reassign});
}
async function mutateSelected(controller,message,mutation,success){
  requireOnline();const op=selectedOperation();await withLoader(message,async () => {await mutation(op);showToast(success,'','success');await controller.reloadSelectedOperation();});
}
function addEvidenceFiles(fileList,controller,prefix){
  const current=getState().evidence.files; const incoming=prepareFiles(fileList); const map=new Map([...current,...incoming].map(item => [item.id,item]));updateSlice('evidence',{files:[...map.values()]},'evidence-files');
  if(prefix === 'detail') evidenceDialog(selectedOperation(),getState().evidence.files); else controller.render();
}
function removeEvidenceFile(id,prefix,controller){
  const current=getState().evidence.files; const removed=current.find(item => item.id === id);if(removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);updateSlice('evidence',{files:current.filter(item => item.id !== id)},'evidence-remove');if(prefix === 'detail') evidenceDialog(selectedOperation(),getState().evidence.files);else controller.render();
}
function clearEvidenceFiles(){const files=getState().evidence.files;revokePreviews(files);updateSlice('evidence',{files:[],progress:0},'evidence-clear');}
async function openNotification(id){
  const item=getState().notifications.items.find(entry => String(entry.id) === String(id));if(!item) return;
  if(!String(id).startsWith('derived-')) await markNotificationRead(id).catch(() => null);
  const ref=item.referencia_codigo || item?.detalle?.codigo || item.referencia_id;
  if(ref) go(ROUTES.operation,{id:ref}); else if(item.route) go(item.route);
}
function openAlert(id){const item=getState().notifications.items.find(entry => String(entry.id) === String(id));if(!item) return;if(item.filter) updateSlice('operations',{filters:{status:item.filter}},'alert-filter');go(item.route || ROUTES.notifications);}
function openOperationAgency(){const op=selectedOperation();if(op.agencyNumber) go(ROUTES.agency,{id:op.agencyNumber});}
function openWhatsAppTemplate(target){
  const op=normalizeOperation(getState().operations.selected || {});const type=target.dataset.template;const messages={consulta:`Hola ${op.manager || ''}, estamos revisando la operación ${op.code} de ${op.agencyLabel || `Agencia ${op.agencyNumber}`}. ¿La avería continúa?`,evidencia:`Hola ${op.manager || ''}, favor envíanos una foto y un video corto de la operación ${op.code}: ${op.title}.`,pasos:`Hola ${op.manager || ''}. Para la operación ${op.code}, verifica energía y conexiones, reinicia el equipo y confirma si el problema continúa.`};const url=whatsappUrl(target.dataset.phone,messages[type] || messages.consulta);if(!url) throw new Error('No hay teléfono WhatsApp válido.');globalThis.open(url,'_blank','noopener');
}
async function centerUser(){const position=await getCurrentPosition();centerMap(position.coords.latitude,position.coords.longitude,16);showToast('Ubicación encontrada','El mapa se centró en tu posición.','success');}
async function saveCurrentOperationDraft(controller){
  const form=document.querySelector('[data-form="create-operation"]');if(!form) return;const values=Object.fromEntries(new FormData(form).entries());await saveDraft('create-operation',values);controller.setOperationDraft(values);showToast('Borrador guardado','Se guardó únicamente texto y selecciones, no fotografías.','success');
}

async function notifyBestEffort({type,title,message,importance='normal',operation}){
  const state=getState(); const op=normalizeOperation(operation || {});
  const payload={
    modulo:'OPERACIONES',tipo:type,titulo:title,mensaje:message,importancia:importance,
    referencia_tipo:'OPERACION',referencia_id:isUuid(operation?.id) ? operation.id : null,
    referencia_codigo:op.code || null,usuario_id:isUuid(state.user?.id) ? state.user.id : null,
    usuario_nombre:state.profile?.nombre_completo || state.profile?.nombre || state.user?.email || 'Sistema',
    leida:false,visto_en_panel:false,creado_en:new Date().toISOString()
  };
  try{ await createOperationalNotification(payload); }catch(error){ console.warn('[Grupo Ortiz] La operación se guardó, pero no se pudo crear la notificación.',error?.message || error); }
}
function isUuid(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }
function findAgency(value){const raw=String(value || '').trim().toLowerCase();return (getState().agencies.items || []).find(item => [item.id,item.numero,item.nombre,`${item.numero} · ${item.nombre}`].some(candidate => String(candidate || '').trim().toLowerCase() === raw));}
function scannerActionPermissions(controller){return {entry:controller.can('scanner.entry'),batchEntry:controller.can('scanner.batchEntry'),transfer:controller.can('scanner.transfer'),receive:controller.can('scanner.receive'),incident:controller.can('scanner.incident'),agencies:controller.can('agencies.detail'),operations:controller.can('operations.view')};}
function selectedOperation(){return normalizeOperation(getState().operations.selected || {});}
function requireAction(controller,action,callback){if(!controller.can(action)) throw Object.assign(new Error('No tienes permiso para esta acción.'),{code:'42501'});return callback?.();}
function requireOnline(){if(!navigator.onLine) throw Object.assign(new Error('Esta acción requiere conexión a internet.'),{code:'NETWORK'});}
function go(path,params={},query=null){updateSlice('ui',{drawerOpen:false},'drawer-close-nav');navigate(path,params,query);}
function togglePassword(button){const field=document.querySelector('[data-password-field]');if(!field) return;field.type=field.type === 'password' ? 'text' : 'password';button.setAttribute('aria-label',field.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');button.textContent=field.type === 'password' ? '◉' : '⊘';field.focus();}
async function withLoader(message,callback){showLoader(message);try{return await callback();}finally{hideLoader();}}
function updateProgress(value){updateSlice('evidence',{progress:value},'evidence-progress');const bar=document.querySelector('[data-evidence-progress]');if(bar){bar.classList.remove('hidden');bar.firstElementChild.style.width=`${Math.max(0,Math.min(100,value))}%`;}}

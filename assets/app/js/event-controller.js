import { ROUTES } from './config.js';
import { getState, updateSlice, setState } from './store.js';
import { navigate } from './router.js';
import { signIn, signOut } from './auth.js';
import { loadOperationsPage, loadAgenciesPage, ensureAgencyReferenceData, loadTechniciansData, loadNotificationsData, loadMapData } from './services/data-service.js';
import { createOperation, assignOperation, reassignOperation, startOperation, addComment, addDiagnosis, addEvidence, finishOperation, closeByWhatsApp, normalizeOperation } from './services/operations-service.js';
import { safeUpdateOperation } from './api/operations-api.js';
import { findSerial } from './api/equipment-api.js';
import { markNotificationRead, markAllNotificationsRead, createOperationalNotification } from './api/notifications-api.js';
import { uploadEvidenceBatch, prepareFiles, revokePreviews } from './services/evidence-service.js';
import { startScanner, stopScanner, barcodeSupported } from './services/scanner-service.js';
import { whatsappUrl, getCurrentPosition, centerMap } from './services/location-service.js';
import { installPwa } from './services/pwa-service.js';
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
      case 'go-home':go(ROUTES.home);break; case 'go-operations':go(ROUTES.operations);break; case 'go-scanner':go(ROUTES.scanner);break;
      case 'go-agencies':go(ROUTES.agencies);break; case 'go-profile':go(ROUTES.profile);break; case 'go-notifications':go(ROUTES.notifications);break;
      case 'go-create-operation':requireAction(controller,'operations.create',() => go(ROUTES.createOperation));break;
      case 'go-map':go(ROUTES.map);break; case 'go-technicians':go(ROUTES.technicians);break;
      case 'go-back':history.length > 1 ? history.back() : go(ROUTES.home);break;
      case 'go-operations-search':go(ROUTES.operations);setTimeout(() => document.querySelector('[data-input-action="operations-search"]')?.focus(),450);break;
      case 'go-agencies-search':go(ROUTES.agencies);setTimeout(() => document.querySelector('[data-input-action="agencies-search"]')?.focus(),450);break;
      case 'go-unassigned-operations':updateSlice('operations',{filters:{status:'Pendiente'}},'unassigned-filter');go(ROUTES.operations);break;
      case 'toggle-drawer':updateSlice('ui',{drawerOpen:!getState().ui.drawerOpen},'drawer');controller.render();break;
      case 'close-drawer':updateSlice('ui',{drawerOpen:false},'drawer');controller.render();break;
      case 'refresh-view':await withLoader('Actualizando datos…',() => controller.refresh());break;
      case 'close-modal':closeModal();break;
      case 'dismiss-toast':dismissToast(target.dataset.toastId);break;
      case 'toggle-password':togglePassword(target);break;
      case 'login-help':showToast('Ayuda de acceso','Usa tu correo autorizado. Si tu usuario no se resuelve, contacta al administrador para confirmar el perfil.','info');break;
      case 'open-operation':go(ROUTES.operation,{id:target.dataset.operationId});break;
      case 'open-agency':go(ROUTES.agency,{id:target.dataset.agencyId});break;
      case 'open-operation-filters':await ensureAgencyReferenceData();if(!getState().technicians.items.length) await loadTechniciansData();openOperationFilters(getState().operations.filters,getState().technicians.items,getState().agencies.groups || []);break;
      case 'filter-operation-status':updateSlice('operations',current => ({filters:{...current.filters,status:target.dataset.status}}),'operation-status-filter');await loadOperationsPage({reset:true});controller.render();break;
      case 'clear-operation-filters':closeModal();updateSlice('operations',{filters:{status:'Todos'}},'operation-filters-clear');await loadOperationsPage({reset:true});controller.render();break;
      case 'load-more-operations':await loadOperationsPage({reset:false});controller.render();break;
      case 'open-agency-filters':await ensureAgencyReferenceData();agencyFiltersDialog(getState().agencies.groups || [],getState().agencies.filters);break;
      case 'clear-agency-filters':updateSlice('agencies',{filters:{}},'agency-filters-clear');await loadAgenciesPage({reset:true});controller.render();break;
      case 'load-more-agencies':await loadAgenciesPage({reset:false});controller.render();break;
      case 'open-assignment':await openAssignment(controller,false);break;
      case 'open-reassignment':await openAssignment(controller,true);break;
      case 'start-operation':await mutateSelected(controller,'Iniciando operación…',op => startOperation(op.id || op.code,getState().profile),'Operación iniciada');break;
      case 'open-comment':commentDialog(selectedOperation());break;
      case 'open-diagnosis':diagnosisDialog(selectedOperation());break;
      case 'open-evidence':clearEvidenceFiles();evidenceDialog(selectedOperation(),[]);break;
      case 'finish-operation':finishDialog(selectedOperation());break;
      case 'open-whatsapp-actions':whatsappActionsDialog(selectedOperation());break;
      case 'open-whatsapp-close':requireAction(controller,'operations.closeWhatsapp',() => whatsappCloseDialog(selectedOperation()));break;
      case 'open-operation-agency':openOperationAgency();break;
      case 'send-whatsapp-template':openWhatsAppTemplate(target);break;
      case 'start-scanner':await startCameraScanner(controller);break;
      case 'stop-scanner':await stopCameraScanner(controller);break;
      case 'remove-evidence-file':removeEvidenceFile(target.dataset.fileId,target.dataset.prefix,controller);break;
      case 'open-notification':await openNotification(target.dataset.notificationId);controller.render();break;
      case 'mark-all-notifications-read':await withLoader('Actualizando alertas…',async () => { await markAllNotificationsRead(); await loadNotificationsData(); controller.render(); });break;
      case 'open-alert':openAlert(target.dataset.alertId);break;
      case 'install-pwa':{const outcome=await installPwa();showToast('Instalación',outcome==='accepted'?'La instalación fue aceptada.':'La instalación no se completó.',outcome==='accepted'?'success':'info');break;}
      case 'request-logout':confirmDialog({title:'Cerrar sesión',message:'¿Deseas salir de la aplicación de Operaciones?',confirmLabel:'Cerrar sesión',confirmAction:'confirm-logout',tone:'danger'});break;
      case 'confirm-logout':await withLoader('Cerrando sesión…',async () => { closeModal(); await signOut(); });break;
      case 'create-operation-from-agency':go(ROUTES.createOperation,{}, {agency:target.dataset.agencyId});break;
      case 'open-scanned-agency':go(ROUTES.agency,{id:target.dataset.agencyId});break;
      case 'open-scanned-operation':go(ROUTES.operation,{id:target.dataset.operationId});break;
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
      case 'serial-search':await searchSerial(data.serial,controller);break;
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
    }catch(error){ controller.handleError(`Búsqueda ${action}`,error); }
  },420));
}
async function handleChange(event,controller){
  if(event.target.matches('[data-file-input]')){ addEvidenceFiles(event.target.files,controller,event.target.dataset.fileInput?.startsWith('detail')?'detail':'create'); event.target.value=''; return; }
  if(event.target.dataset.changeAction === 'map-group-filter'){
    const group=event.target.value; const query=new URLSearchParams(); if(group) query.set('group',group); navigate(ROUTES.map,{},query,{replace:true});
  }
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
  try{ const auth=await signIn(data.identity,data.password);controller.applyAuth(auth);navigate(ROUTES.home,{},null,{replace:true});showToast('Bienvenido',`Sesión iniciada como ${auth.profile.nombre_completo || auth.user.email}.`,'success'); }
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
  requireOnline(); if(!String(data.comment || '').trim()) throw new Error('Escribe un comentario.');
  await withLoader('Guardando comentario…',async () => {await addComment(data.reference,data.comment,getState().profile);closeModal();showToast('Comentario guardado','','success');await controller.reloadSelectedOperation();});
}
async function submitDiagnosis(data,controller){
  requireOnline(); if(!String(data.diagnosis || '').trim()) throw new Error('Escribe el diagnóstico.');
  await withLoader('Guardando diagnóstico…',async () => {await addDiagnosis(data.reference,data.diagnosis,getState().profile);closeModal();showToast('Diagnóstico guardado','','success');await controller.reloadSelectedOperation();});
}
async function submitEvidence(data,controller){
  requireOnline(); const state=getState(); const files=state.evidence.files.map(item => item.file); if(!files.length) throw new Error('Selecciona al menos un archivo.');
  const op=selectedOperation();
  await withLoader('Subiendo evidencia protegida…',async () => {const urls=await uploadEvidenceBatch(files,op.code,data.description,progress => updateProgress(progress));await addEvidence(data.reference,urls,data.description,state.profile);revokePreviews(state.evidence.files);updateSlice('evidence',{files:[],progress:0},'evidence-clear');closeModal();showToast('Evidencia guardada',`${urls.length} archivo(s) confirmado(s).`,'success');await controller.reloadSelectedOperation();});
}
async function submitFinish(data,controller){
  requireOnline(); if(!String(data.comment || '').trim()) throw new Error('Escribe el comentario final.');
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
async function searchSerial(serial,controller){
  const value=String(serial || '').trim();if(!value) throw new Error('Escribe un serial.');
  await withLoader('Consultando serial…',async () => {const result=await findSerial(value);updateSlice('scanner',{result,error:result?'':'No encontramos ese serial.'},'serial-result');controller.render();if(!result) showToast('Serial no encontrado','Verifica el valor e inténtalo otra vez.','warning');});
}
async function openAssignment(controller,reassign){
  requireAction(controller,reassign?'operations.reassign':'operations.assign'); if(!getState().technicians.items.length) await loadTechniciansData();assignmentDialog(selectedOperation(),getState().technicians.items,{reassign});
}
async function mutateSelected(controller,message,mutation,success){
  requireOnline();const op=selectedOperation();await withLoader(message,async () => {await mutation(op);showToast(success,'','success');await controller.reloadSelectedOperation();});
}
async function startCameraScanner(controller){
  updateSlice('scanner',{active:true,error:'',result:null},'scanner-start');controller.render();
  const video=document.getElementById('scanner-video');
  try{const result=await startScanner(video,code => searchSerial(code,controller),error => console.warn('[Grupo Ortiz] Detector de código',error));if(!result.detector) updateSlice('scanner',{error:'La cámara está abierta, pero este navegador no incluye detector de códigos. Usa la entrada manual.'},'scanner-no-detector');controller.render();}
  catch(error){updateSlice('scanner',{active:false,error:classifyError(error).message},'scanner-error');controller.render();throw error;}
}
async function stopCameraScanner(controller){await stopScanner();updateSlice('scanner',{active:false},'scanner-stop');controller.render();}
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
function selectedOperation(){return normalizeOperation(getState().operations.selected || {});}
function requireAction(controller,action,callback){if(!controller.can(action)) throw Object.assign(new Error('No tienes permiso para esta acción.'),{code:'42501'});return callback?.();}
function requireOnline(){if(!navigator.onLine) throw Object.assign(new Error('Esta acción requiere conexión a internet.'),{code:'NETWORK'});}
function go(path,params={},query=null){updateSlice('ui',{drawerOpen:false},'drawer-close-nav');navigate(path,params,query);}
function togglePassword(button){const field=document.querySelector('[data-password-field]');if(!field) return;field.type=field.type === 'password' ? 'text' : 'password';button.setAttribute('aria-label',field.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');button.textContent=field.type === 'password' ? '◉' : '⊘';field.focus();}
async function withLoader(message,callback){showLoader(message);try{return await callback();}finally{hideLoader();}}
function updateProgress(value){updateSlice('evidence',{progress:value},'evidence-progress');const bar=document.querySelector('[data-evidence-progress]');if(bar){bar.classList.remove('hidden');bar.firstElementChild.style.width=`${Math.max(0,Math.min(100,value))}%`;}}

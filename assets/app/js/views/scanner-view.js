import { el } from '../components/dom.js';
export function scannerView(state){
  const result = state.scanner.result;
  const status = state.scanner.error || (state.scanner.active ? scannerStatus(state.scanner.engine,state.scanner.cameraLabel) : 'Apunta la cámara al código de barras o escribe el serial.');
  return el('div',{class:'page scanner-page'},
    el('div',{class:'page-header'},el('div',{},el('h1',{class:'page-title',text:'Escáner universal'}),el('p',{class:'page-subtitle',text:'Consulta seriales sin realizar movimientos administrativos.'}))),
    el('section',{class:'card scanner-hero'},
      el('div',{class:`scanner-frame ${state.scanner.active ? 'is-active' : ''}`},
        el('video',{id:'scanner-video',autoplay:'',muted:'',playsinline:'','webkit-playsinline':'','aria-label':'Vista de cámara para escanear'}),
        state.scanner.active ? el('div',{class:'scanner-line','aria-hidden':'true'}) : null,
        !state.scanner.active ? el('div',{class:'scanner-placeholder',text:'Cámara detenida'}) : null
      ),
      el('p',{id:'scanner-status',class:'muted scanner-status',role:'status',text:status}),
      el('button',{class:`btn ${state.scanner.active ? 'btn-danger' : 'btn-primary'}`,type:'button','data-action':state.scanner.active ? 'stop-scanner' : 'start-scanner'},state.scanner.active ? 'Detener cámara' : 'Abrir cámara')
    ),
    el('form',{class:'card stack','data-form':'serial-search'},el('label',{class:'field'},el('span',{text:'Serial manual'}),el('div',{class:'input-row'},el('input',{class:'input',name:'serial',type:'text',autocomplete:'off',autocapitalize:'characters',placeholder:'Escribe o pega el serial',required:''}),el('button',{class:'btn btn-primary',type:'submit'},'Buscar')))),
    result ? serialResult(result) : el('div',{class:'card'},el('p',{class:'muted text-center',text:'El resultado mostrará producto, estado, ubicación, agencia y relaciones disponibles.'}))
  );
}
function scannerStatus(engine,label){
  const camera = label ? ` · ${label}` : '';
  if(engine === 'native') return `Cámara activa${camera}. Detector nativo listo.`;
  if(engine === 'zxing') return `Cámara activa${camera}. Lector compatible con iPhone listo.`;
  return `Cámara activa${camera}. Buscando códigos…`;
}
function serialResult(item){
  const product = item.productos?.nombre || item.producto_nombre || 'Producto no identificado'; const agency = item.agencias ? `${item.agencias.numero || ''} · ${item.agencias.nombre || ''}` : 'No asignada';
  return el('section',{class:'card scanner-result'},el('span',{class:'badge badge-complete',text:'Serial encontrado'}),el('h2',{text:product}),el('p',{class:'serial-code',text:item.serial}),el('dl',{class:'info-list'},info('Estado',item.estado || 'No registrado'),info('Condición',item.condicion || 'No registrada'),info('Ubicación',item.ubicacion_tipo || 'No registrada'),info('Agencia',agency),info('Grupo',item.grupos?.nombre || item.grupo_id || 'No asignado'),info('Despacho',item.despachos?.codigo || item.despacho_actual_id || 'No relacionado')),el('div',{class:'grid grid-2'},item.agencia_id ? el('button',{class:'btn btn-outline',type:'button','data-action':'open-scanned-agency','data-agency-id':item.agencia_id},'Abrir agencia') : null,item.operacion_id ? el('button',{class:'btn btn-outline',type:'button','data-action':'open-scanned-operation','data-operation-id':item.operacion_id},'Abrir operación') : null));
}
function info(label,value){ return el('div',{class:'info-row'},el('dt',{text:label}),el('dd',{text:String(value)})); }

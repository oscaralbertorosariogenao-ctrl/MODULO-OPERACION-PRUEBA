import { el } from '../components/dom.js';
import { groupLabel, productLabel, warehouseLabel } from '../services/scanner-inventory-service.js';
import { can } from '../permissions.js';

export function scannerView(state){
  const scanner = state.scanner || {};
  const result = scanner.result;
  const access = {
    entry:can('scanner.entry',state),
    batchEntry:can('scanner.batchEntry',state),
    transfer:can('scanner.transfer',state),
    receive:can('scanner.receive',state)
  };
  const status = scanner.error || scannerStatus(scanner);
  return el('div',{class:'page scanner-page'},
    el('div',{class:'page-header scanner-page-header'},
      el('div',{},
        el('span',{class:'scanner-eyebrow',text:'Inventario móvil'}),
        el('h1',{class:'page-title',text:'Centro inteligente de escáner'}),
        el('p',{class:'page-subtitle',text:'Escanea, identifica, consulta y ejecuta únicamente las acciones permitidas.'})
      ),
      el('span',{class:`scanner-connectivity ${state.connectivity?.online ? 'online' : 'offline'}`,text:state.connectivity?.online ? 'En línea' : 'Sin conexión'})
    ),
    !state.connectivity?.online ? el('div',{class:'scanner-offline-note',role:'status'},el('strong',{text:'Modo sin conexión'}),el('span',{text:'Puedes usar la cámara y preparar seriales, pero no confirmar entradas, transferencias ni recepciones.'})) : null,
    scanner.batch?.active && access.batchEntry ? batchPanel(scanner.batch,state.connectivity?.online) : null,
    el('section',{class:'card scanner-hero'},
      el('div',{class:`scanner-frame ${scanner.active ? 'is-active' : ''} ${scanner.processing ? 'is-processing' : ''}`},
        el('video',{id:'scanner-video',autoplay:'',muted:'',playsinline:'','webkit-playsinline':'','aria-label':'Vista de cámara para escanear'}),
        scanner.active ? el('div',{class:'scanner-line','aria-hidden':'true'}) : null,
        scanner.active ? el('div',{class:'scanner-corners','aria-hidden':'true'}) : null,
        !scanner.active ? el('div',{class:'scanner-placeholder'},el('span',{class:'scanner-placeholder-icon','aria-hidden':'true',text:'⌁'}),el('strong',{text:'Cámara detenida'}),el('small',{text:'Abre la cámara o escribe el código manualmente'})) : null,
        scanner.processing ? el('div',{class:'scanner-processing',role:'status'},el('span',{class:'mini-spinner','aria-hidden':'true'}),el('strong',{text:'Procesando código…'})) : null
      ),
      el('p',{id:'scanner-status',class:'muted scanner-status',role:'status',text:status}),
      el('div',{class:'scanner-camera-actions'},
        el('button',{class:`btn ${scanner.active ? 'btn-danger' : 'btn-primary'}`,type:'button','data-action':scanner.active ? 'stop-scanner' : 'start-scanner'},scanner.active ? 'Detener' : 'Abrir cámara'),
        el('button',{class:`btn btn-outline ${scanner.torchEnabled ? 'is-active' : ''}`,type:'button','data-action':'scanner-toggle-torch',disabled:!scanner.active || !scanner.torchSupported,'aria-pressed':scanner.torchEnabled ? 'true':'false'},scanner.torchEnabled ? 'Apagar linterna' : 'Linterna'),
        el('button',{class:'btn btn-outline',type:'button','data-action':'scanner-switch-camera',disabled:!scanner.active || Number(scanner.cameraCount || 0) < 2},'Cambiar cámara')
      )
    ),
    el('form',{class:'card stack scanner-manual-card','data-form':'serial-search'},
      el('div',{class:'scanner-section-heading'},el('div',{},el('h2',{text:'Escribir manualmente'}),el('p',{text:'Conservamos guiones, ceros iniciales y caracteres válidos.'})),scanner.mode !== 'lookup' ? el('span',{class:'badge badge-warning',text:modeLabel(scanner.mode)}) : null),
      el('label',{class:'field'},
        el('span',{text:scanner.batch?.active ? 'Agregar serial al lote' : 'Serial, QR o código de producto'}),
        el('div',{class:'input-row'},
          el('input',{class:'input',name:'serial',type:'text',autocomplete:'off',autocapitalize:'characters',placeholder:scanner.batch?.active ? 'Escribe el siguiente serial' : 'Ej. BAT-001',required:'',maxlength:'120'}),
          el('button',{class:'btn btn-primary',type:'submit',disabled:scanner.processing},scanner.batch?.active ? 'Agregar' : 'Buscar')
        )
      ),
      !scanner.batch?.active && access.batchEntry ? el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'scanner-open-batch-entry'},'Configurar entrada por lote') : null
    ),
    result ? resultCard(result,access) : emptyResultCard(),
    recentScans(scanner.recentScans || [])
  );
}

function scannerStatus(scanner){
  if(scanner.processing) return 'Analizando el código y consultando inventario…';
  if(scanner.active){
    const camera = scanner.cameraLabel ? ` · ${scanner.cameraLabel}` : '';
    if(scanner.engine === 'native') return `Cámara activa${camera}. Detector nativo listo.`;
    if(scanner.engine === 'zxing') return `Cámara activa${camera}. Lector compatible con iPhone listo.`;
    return `Cámara activa${camera}. Apunta al código dentro del marco.`;
  }
  return 'Apunta la cámara al código o utiliza la entrada manual.';
}

function resultCard(result,access){
  if(result.kind === 'equipment'){
    const item = result.equipment || {};
    return el('section',{class:'card scanner-result scanner-result-found'},
      el('div',{class:'scanner-result-head'},el('span',{class:'scanner-result-kicker success',text:'EQUIPO ENCONTRADO'}),el('button',{class:'btn btn-ghost btn-small',type:'button','data-action':'scanner-open-result'},'Abrir detalle')),
      el('div',{class:'scanner-result-serial',text:item.serial || result.normalizedValue}),
      el('h2',{text:item.product?.nombre || 'Producto no identificado'}),
      el('div',{class:'scanner-result-quick'},quickInfo('Estado',item.estado || '-'),quickInfo('Ubicación',locationLabel(item)),quickInfo('Último movimiento',item.latestMovement?.tipo_movimiento || item.latestMovement?.referencia || 'Sin registro')),
      access.receive && item.pendingReceipt ? el('button',{class:'btn btn-success btn-block',type:'button','data-action':'scanner-open-receive'},'Recibir equipo') : null,
      access.transfer && item.inventoryContext?.canTransfer ? el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'scanner-open-transfer'},'Enviar o transferir') : null
    );
  }
  if(result.kind === 'product'){
    return el('section',{class:'card scanner-result scanner-result-product'},
      el('span',{class:'scanner-result-kicker info',text:'PRODUCTO IDENTIFICADO'}),
      el('div',{class:'scanner-result-serial',text:result.normalizedValue}),
      el('h2',{text:result.product?.nombre || 'Producto'}),
      el('p',{class:'muted',text:productLabel(result.product)}),
      (access.entry || access.batchEntry) && result.product?.requiere_serial !== false ? el('div',{class:'grid grid-2'},
        access.entry ? el('button',{class:'btn btn-primary',type:'button','data-action':'scanner-open-entry'},'Registrar serial') : null,
        access.batchEntry ? el('button',{class:'btn btn-outline',type:'button','data-action':'scanner-open-batch-entry'},'Entrada por lote') : null
      ) : null
    );
  }
  return el('section',{class:'card scanner-result scanner-result-unknown'},
    el('span',{class:'scanner-result-kicker warning',text:result.kind === 'unknown' ? 'SERIAL NO REGISTRADO' : 'CÓDIGO NO RECONOCIDO'}),
    el('div',{class:'scanner-result-serial',text:result.normalizedValue || result.rawValue || '-'}),
    el('p',{text:result.message || 'No se encontró información relacionada.'}),
    access.entry && result.kind === 'unknown' ? el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'scanner-open-entry'},'Registrar entrada') : null,
    !access.entry ? el('p',{class:'draft-note',text:'Tu perfil puede consultar, pero no tiene habilitada la acción de registro de inventario.'}) : null
  );
}

function emptyResultCard(){
  return el('section',{class:'card scanner-empty-result'},
    el('div',{class:'scanner-empty-icon','aria-hidden':'true',text:'◎'}),
    el('h2',{text:'Listo para identificar'}),
    el('p',{class:'muted',text:'El resultado mostrará producto, estado, ubicación, reserva, despacho, último movimiento y acciones contextuales.'})
  );
}

function batchPanel(batch,online){
  return el('section',{class:'card scanner-batch-panel','data-scanner-batch-panel':'true'},
    el('div',{class:'scanner-section-heading'},
      el('div',{},el('span',{class:'scanner-result-kicker info',text:'ENTRADA POR LOTE'}),el('h2',{text:batch.product ? productLabel(batch.product) : 'Producto'}),el('p',{text:batch.entryMode === 'group' ? (batch.group ? `${groupLabel(batch.group)} · Mi inventario` : 'Mi almacén de grupo') : (batch.warehouse ? warehouseLabel(batch.warehouse) : 'Almacén pendiente')})),
      el('span',{class:'scanner-batch-count','data-scanner-batch-count':'true',text:String((batch.serials || []).length)})
    ),
    el('div',{class:'scanner-batch-controls'},
      el('button',{class:'btn btn-outline',type:'button','data-action':batch.paused ? 'scanner-resume-batch' : 'scanner-pause-batch'},batch.paused ? 'Reanudar' : 'Pausar'),
      el('button',{class:'btn btn-ghost',type:'button','data-action':'scanner-cancel-batch'},'Cancelar lote')
    ),
    el('div',{class:'scanner-batch-list','data-scanner-batch-list':'true'},batch.serials?.length ? batch.serials.map(serial => el('div',{class:'scanner-batch-item'},el('code',{text:serial}),el('button',{class:'icon-btn',type:'button','data-action':'scanner-remove-batch-serial','data-serial':serial,'aria-label':`Quitar ${serial}`},'×'))) : el('p',{class:'muted text-center',text:batch.paused ? 'El escaneo está pausado.' : 'Escanea el primer serial del lote.'})),
    el('div',{class:`scanner-warning-list ${batch.invalid?.length ? '' : 'hidden'}`,'data-scanner-batch-invalid':'true'},(batch.invalid || []).map(item => el('p',{text:`${item.serial}: ${item.reason}`}))),
    el('p',{class:`draft-note ${(batch.unverified || []).length ? '' : 'hidden'}`,'data-scanner-batch-unverified':'true',text:`${(batch.unverified || []).length} serial(es) pendientes de validar al recuperar conexión.`}),
    el('button',{class:'btn btn-success btn-block',type:'button','data-action':'scanner-confirm-batch','data-scanner-batch-confirm':'true',disabled:!online || !batch.serials?.length},online ? `Confirmar ${batch.serials?.length || 0} serial(es)` : 'Requiere conexión para confirmar')
  );
}

function recentScans(items){
  return el('section',{class:'card scanner-recent'},
    el('div',{class:'scanner-section-heading'},el('div',{},el('h2',{text:'Escaneos recientes'}),el('p',{text:'Historial corto de esta sesión.'}))),
    items.length ? el('div',{class:'scanner-recent-list'},items.map(item => el('button',{class:'scanner-recent-item',type:'button','data-action':'scanner-repeat-recent','data-value':item.value},
      el('span',{class:`scanner-recent-kind kind-${item.kind}`,text:kindLabel(item.kind)}),
      el('span',{class:'scanner-recent-copy'},el('strong',{text:item.value}),el('small',{text:item.label})),
      el('time',{text:formatTime(item.scannedAt)})
    ))) : el('p',{class:'muted text-center',text:'Todavía no hay lecturas en esta sesión.'})
  );
}

function quickInfo(label,value){ return el('div',{},el('span',{text:label}),el('strong',{text:String(value)})); }
function modeLabel(mode){ return ({'single-entry':'Entrada','batch-entry':'Lote','send':'Transferencia','receive':'Recepción'})[mode] || 'Consulta'; }
function kindLabel(kind){ return ({equipment:'Equipo',product:'Producto',unknown:'Nuevo',invalid:'Inválido'})[kind] || 'Código'; }
function locationLabel(item){
  const type=String(item?.ubicacion_tipo || '').toUpperCase();
  if(type==='ALMACEN') return item.warehouse ? warehouseLabel(item.warehouse) : 'Almacén';
  if(type==='AGENCIA') return item.agency ? `${item.agency.numero || ''} · ${item.agency.nombre || ''}` : 'Agencia';
  if(type==='GRUPO') return item.group?.nombre || 'Grupo';
  return item?.ubicacion_tipo || 'No registrada';
}
function formatTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit'}).format(date);}

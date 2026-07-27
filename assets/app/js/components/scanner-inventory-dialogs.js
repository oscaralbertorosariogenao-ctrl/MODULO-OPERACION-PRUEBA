import { el, option } from './dom.js';
import { openBottomSheet } from './bottom-sheet.js';
import { openModal } from './modal.js';
import { agencyLabel, localDateTimeValue, productLabel, scannerResultTitle, warehouseLabel } from '../services/scanner-inventory-service.js';

export function openScannerResultSheet(result,{canMutate=false} = {}){
  const body = el('div',{class:'scanner-sheet stack'},resultSummary(result),resultActions(result,canMutate));
  return openBottomSheet({id:'scanner-result-sheet',title:scannerResultTitle(result),body});
}

export function openScannerEntryDialog({result,products,warehouses,batch=false}){
  const proposedSerial = result?.kind === 'equipment' ? result.equipment?.serial : result?.normalizedValue || '';
  const preselectedProduct = result?.kind === 'product' ? result.product?.id : result?.product?.id || '';
  const formName = batch ? 'scanner-batch-setup' : 'scanner-entry';
  const form = el('form',{class:'stack scanner-inventory-form','data-form':formName},
    batch ? el('div',{class:'scanner-form-banner'},el('strong',{text:'Entrada por lote'}),el('span',{text:'Configura el producto y almacén. Después podrás escanear varios seriales de forma continua.'})) : null,
    !batch ? field('Serial escaneado',el('input',{class:'input',name:'serial',value:proposedSerial,required:'',maxlength:'120',autocomplete:'off',autocapitalize:'characters'})) : null,
    field('Buscar producto',el('input',{class:'input',type:'search',placeholder:'Nombre, código, categoría o tipo','data-input-action':'scanner-product-filter',autocomplete:'off'})),
    field('Producto',el('select',{class:'select',name:'productId',required:'','data-scanner-product-select':'true'},
      option('','Selecciona un producto activo',!preselectedProduct),
      products.map(product => option(product.id,productLabel(product),String(product.id) === String(preselectedProduct)))
    )),
    field('Almacén receptor',el('select',{class:'select',name:'warehouseId',required:''},
      option('','Selecciona un almacén activo',true),
      warehouses.map(warehouse => option(warehouse.id,warehouseLabel(warehouse)))
    )),
    field('Suplidor',el('input',{class:'input',name:'supplier',value:'Suplidor General',maxlength:'160',autocomplete:'organization'})),
    field('Fecha de entrada',el('input',{class:'input',name:'date',type:'datetime-local',value:localDateTimeValue(),required:''})),
    field('Documento de referencia',el('input',{class:'input',name:'reference',value:`EN-MOV-${Date.now()}`,maxlength:'120'})),
    field('Estado físico inicial',el('select',{class:'select',name:'physicalCondition'},
      option('','No especificado',true),option('Nuevo','Nuevo'),option('Bueno','Bueno'),option('Usado','Usado'),option('Reparado','Reparado'),option('Por revisar','Por revisar')
    )),
    field('Motivo de entrada',el('input',{class:'input',name:'motive',placeholder:'Compra, reposición, retorno u otro',maxlength:'160'})),
    field('Observaciones',el('textarea',{class:'textarea',name:'observations',maxlength:'1500',placeholder:'Documento, condición, detalles de recepción…'})),
    el('p',{class:'draft-note',text:'La confirmación requiere internet y se ejecutará mediante una única RPC transaccional.'}),
    el('button',{class:'btn btn-primary btn-block',type:'submit'},batch ? 'Comenzar entrada por lote' : 'Confirmar entrada')
  );
  return openModal({id:batch?'scanner-batch-setup-dialog':'scanner-entry-dialog',title:batch?'Configurar lote de entrada':'Registrar entrada de serial',body:form,size:'bottom-sheet'});
}

export function openScannerTransferDialog({equipment,warehouses,agencies}){
  const originType = String(equipment?.ubicacion_tipo || '').toUpperCase();
  const form = el('form',{class:'stack scanner-inventory-form','data-form':'scanner-transfer'},
    el('input',{type:'hidden',name:'serial',value:equipment?.serial || ''}),
    el('div',{class:'scanner-form-banner'},el('strong',{text:equipment?.serial || 'Serial'}),el('span',{text:`Origen actual: ${currentLocationLabel(equipment)}`})),
    field('Tipo de destino',el('select',{class:'select',name:'destinationType',required:'','data-scanner-destination-type':'true'},
      option('','Selecciona destino',true),
      option('ALMACEN','Almacén'),
      originType === 'ALMACEN' ? option('AGENCIA','Agencia') : null
    )),
    field('Destino',el('select',{class:'select',name:'destinationId',required:'','data-scanner-destination-select':'true'},option('','Selecciona primero el tipo',true))),
    el('script',{type:'application/json','data-scanner-warehouses':'true',text:JSON.stringify(warehouses.map(row=>({id:row.id,label:warehouseLabel(row)})))}),
    el('script',{type:'application/json','data-scanner-agencies':'true',text:JSON.stringify(agencies.map(row=>({id:row.id,label:agencyLabel(row)})))}),
    field('Fecha',el('input',{class:'input',name:'date',type:'datetime-local',value:localDateTimeValue(),required:''})),
    field('Referencia',el('input',{class:'input',name:'reference',value:`TR-MOV-${Date.now()}`,maxlength:'120'})),
    field('Observaciones',el('textarea',{class:'textarea',name:'observations',maxlength:'1200',placeholder:'Motivo y detalles del movimiento',required:''})),
    el('p',{class:'draft-note',text:'No se permitirá mover un equipo reservado, en Taller, inactivo o con recepción pendiente.'}),
    el('button',{class:'btn btn-primary btn-block',type:'submit'},'Confirmar transferencia')
  );
  return openModal({id:'scanner-transfer-dialog',title:'Enviar o transferir equipo',body:form,size:'bottom-sheet'});
}

export function openScannerReceiveDialog(equipment){
  const pending = equipment?.pendingReceipt;
  const dispatch = pending?.dispatch || {};
  const form = el('form',{class:'stack scanner-inventory-form','data-form':'scanner-receive'},
    el('input',{type:'hidden',name:'serial',value:equipment?.serial || ''}),
    el('div',{class:'scanner-form-banner success'},el('strong',{text:'Recepción pendiente detectada'}),el('span',{text:`${dispatch.codigo || dispatch.id || 'Despacho'} · ${equipment?.serial || ''}`})),
    infoGrid([
      ['Producto',equipment?.product?.nombre || equipment?.producto_id || '-'],
      ['Origen',pendingOriginLabel(equipment)],
      ['Destino',pendingDestinationLabel(dispatch)],
      ['Enviado por',dispatch.confirmado_por_nombre || dispatch.preparado_por_nombre || '-'],
      ['Fecha de envío',formatDate(dispatch.fecha_confirmacion || pending?.serialRow?.creado_en)],
      ['Documento',dispatch.documento_referencia || '-']
    ]),
    field('Observación de recepción',el('textarea',{class:'textarea',name:'observations',maxlength:'1200',placeholder:'Estado recibido y comentario opcional'})),
    el('button',{class:'btn btn-success btn-block',type:'submit'},'Confirmar recepción'),
    el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'scanner-open-receipt-incident'},'Reportar incidencia')
  );
  return openModal({id:'scanner-receive-dialog',title:'Recibir equipo',body:form,size:'bottom-sheet'});
}

export function openScannerIncidentDialog(equipment){
  const form = el('form',{class:'stack scanner-inventory-form','data-form':'scanner-receipt-incident'},
    el('input',{type:'hidden',name:'serial',value:equipment?.serial || ''}),
    field('Tipo de incidencia',el('select',{class:'select',name:'type',required:''},
      option('SERIAL_INCORRECTO','Serial incorrecto'),option('DAÑADO','Equipo dañado'),option('FALTANTE','Equipo no recibido'),option('INCOMPLETO','Equipo incompleto'),option('DESTINO_INCORRECTO','Destino incorrecto'),option('OTRO','Otro')
    )),
    field('Descripción',el('textarea',{class:'textarea',name:'description',required:'',maxlength:'1600',placeholder:'Describe claramente lo ocurrido'})),
    field('Observación general',el('textarea',{class:'textarea',name:'observations',maxlength:'1000',placeholder:'Información adicional opcional'})),
    el('p',{class:'draft-note',text:'La ubicación del serial no cambiará al registrar una incidencia sin confirmar la recepción.'}),
    el('button',{class:'btn btn-danger btn-block',type:'submit'},'Registrar incidencia')
  );
  return openModal({id:'scanner-incident-dialog',title:'Incidencia de recepción',body:form,size:'bottom-sheet'});
}

export function openScannerHistoryDialog(equipment){
  const history = equipment?.history || [];
  const body = el('div',{class:'scanner-history stack'},
    el('div',{class:'scanner-form-banner'},el('strong',{text:equipment?.serial || 'Serial'}),el('span',{text:equipment?.product?.nombre || 'Historial del equipo'})),
    history.length ? el('div',{class:'scanner-timeline'},history.map(movement => historyRow(movement))) : el('div',{class:'empty-state'},el('strong',{text:'Sin movimientos disponibles'}),el('p',{text:'No se encontraron movimientos visibles para este serial o la política actual no permite consultarlos.'}))
  );
  return openModal({id:'scanner-history-dialog',title:'Historial del serial',body,size:'bottom-sheet'});
}

function resultSummary(result){
  if(result?.kind === 'equipment'){
    const item = result.equipment;
    return el('div',{class:'scanner-result-detail'},
      el('span',{class:'scanner-result-kicker success',text:'EQUIPO ENCONTRADO'}),
      el('div',{class:'scanner-result-serial',text:item.serial || result.normalizedValue}),
      el('h3',{text:item.product?.nombre || 'Producto no identificado'}),
      infoGrid([
        ['Estado',item.estado || '-'],
        ['Condición',item.condicion || '-'],
        ['Ubicación',currentLocationLabel(item)],
        ['Almacén',item.warehouse ? warehouseLabel(item.warehouse) : '-'],
        ['Agencia',item.agency ? agencyLabel(item.agency) : '-'],
        ['Grupo',item.group?.nombre || item.group?.codigo || '-'],
        ['Custodio',item.responsable || '-'],
        ['Despacho',item.dispatch?.codigo || item.despacho_actual_id || '-'],
        ['Último movimiento',movementLabel(item.latestMovement)],
        ['Fecha',formatDate(item.latestMovement?.creado_en || item.actualizado_en)]
      ]),
      item.inventoryContext?.blockedReasons?.length ? el('div',{class:'scanner-warning-list'},item.inventoryContext.blockedReasons.map(text => el('p',{text}))) : null
    );
  }
  if(result?.kind === 'product'){
    return el('div',{class:'scanner-result-detail'},
      el('span',{class:'scanner-result-kicker info',text:'PRODUCTO IDENTIFICADO'}),
      el('div',{class:'scanner-result-serial',text:result.normalizedValue}),
      el('h3',{text:result.product?.nombre || 'Producto'}),
      infoGrid([
        ['Código',result.product?.codigo || '-'],['Categoría',result.product?.categoria || '-'],['Tipo',result.product?.tipo_producto || '-'],['Usa serial',result.product?.requiere_serial === false ? 'No' : 'Sí']
      ]),
      el('p',{class:'muted',text:'Selecciona el producto y confirma los seriales antes de crear cualquier entrada.'})
    );
  }
  return el('div',{class:'scanner-result-detail'},
    el('span',{class:'scanner-result-kicker warning',text:result?.kind === 'unknown' ? 'SERIAL NO REGISTRADO' : 'CÓDIGO NO RECONOCIDO'}),
    el('div',{class:'scanner-result-serial',text:result?.normalizedValue || result?.rawValue || '-'}),
    el('p',{text:result?.message || 'No se pudo identificar el código.'})
  );
}

function resultActions(result,canMutate){
  const actions = [];
  if(result?.kind === 'equipment'){
    const item = result.equipment;
    actions.push(el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'scanner-open-history'},'Ver historial'));
    if(item.agencia_id) actions.push(el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'open-scanned-agency','data-agency-id':item.agencia_id},'Abrir agencia'));
    if(item.operacion_id) actions.push(el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'open-scanned-operation','data-operation-id':item.operacion_id},'Abrir operación'));
    if(canMutate && item.inventoryContext?.canTransfer) actions.push(el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'scanner-open-transfer'},'Enviar o transferir'));
    if(canMutate && item.inventoryContext?.canReceive) actions.push(el('button',{class:'btn btn-success btn-block',type:'button','data-action':'scanner-open-receive'},'Recibir equipo'));
  }else if(canMutate && result?.kind === 'product' && result.product?.requiere_serial !== false){
    actions.push(el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'scanner-open-entry'},'Registrar un serial'));
    actions.push(el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'scanner-open-batch-entry'},'Entrada por lote'));
  }else if(canMutate && result?.kind === 'unknown'){
    actions.push(el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'scanner-open-entry'},'Registrar entrada'));
  }
  actions.push(el('button',{class:'btn btn-ghost btn-block',type:'button','data-action':'scanner-scan-again'},'Escanear nuevamente'));
  actions.push(el('button',{class:'btn btn-ghost btn-block',type:'button','data-action':'close-modal'},'Cancelar'));
  return el('div',{class:'stack'},actions);
}

function historyRow(movement){
  return el('article',{class:'scanner-timeline-item'},
    el('span',{class:'scanner-timeline-dot','aria-hidden':'true'}),
    el('div',{},
      el('strong',{text:movement.tipo_movimiento || movement.tipo || 'Movimiento'}),
      el('p',{text:[movement.origen_nombre || movement.origen_tipo,movement.destino_nombre || movement.destino_tipo].filter(Boolean).join(' → ') || 'Ubicación no detallada'}),
      el('small',{text:[formatDate(movement.creado_en),movement.usuario_nombre,movement.referencia || movement.documento_referencia].filter(Boolean).join(' · ')})
    )
  );
}

function currentLocationLabel(item){
  const type = String(item?.ubicacion_tipo || '').toUpperCase();
  if(type === 'ALMACEN') return item.warehouse ? warehouseLabel(item.warehouse) : 'Almacén';
  if(type === 'AGENCIA') return item.agency ? agencyLabel(item.agency) : 'Agencia';
  if(type === 'GRUPO') return item.group?.nombre || item.group?.codigo || 'Grupo';
  return item?.ubicacion_tipo || 'No registrada';
}

function pendingOriginLabel(item){
  return item?.pendingReceipt?.dispatch?.almacen_origen_id || item?.latestMovement?.origen_nombre || 'Origen registrado';
}

function pendingDestinationLabel(dispatch){
  if(dispatch?.tipo_destino === 'AGENCIA') return dispatch.agencia_destino_id || 'Agencia destino';
  if(dispatch?.tipo_destino === 'GRUPO') return dispatch.grupo_destino_id || 'Grupo destino';
  return dispatch?.responsable_destino_nombre || dispatch?.tipo_destino || 'Destino registrado';
}

function movementLabel(movement){
  if(!movement) return 'Sin movimientos visibles';
  return [movement.referencia,movement.tipo_movimiento,movement.destino_nombre].filter(Boolean).join(' · ');
}

function infoGrid(rows){
  return el('dl',{class:'scanner-info-grid'},rows.map(([label,value]) => el('div',{class:'scanner-info-cell'},el('dt',{text:label}),el('dd',{text:String(value || '-')}))));
}

function field(label,control){ return el('label',{class:'field'},el('span',{text:label}),control); }

function formatDate(value){
  if(!value) return '-';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short'}).format(date);
}


(function(){
  'use strict';
  if(window.__lotekaDespachosRpcV410) return;
  window.__lotekaDespachosRpcV410 = true;

  const VERSION = 'v803-despachos-multiples-integracion-real';
  const BUILD = String(document.querySelector('meta[name="grupo-ortiz-build"]')?.content || '').trim();
  window.__GRUPO_ORTIZ_BUILD__ = BUILD;
  document.documentElement.dataset.grupoOrtizBuild = BUILD;
  console.info('[Grupo Ortiz] Build ' + BUILD);
  const TABLE_LIMITS = {
    despachos: 1000,
    despacho_items: 4000,
    despacho_seriales: 8000,
    despacho_eventos: 7000,
    despacho_incidencias: 4000,
    movimientos_inventario: 7000,
    equipos_seriales: 12000,
    despacho_lotes: 1000
  };

  const state = {
    client: null,
    allowed: false,
    loading: false,
    bound: false,
    activeTab: 'resumen',
    channel: null,
    realtimeTimer: null,
    draft: null,
    creationMode: 'individual',
    batchDraft: null,
    lastBatchResult: null,
    modal: null,
    modalBusy: false,
    stock: { serials:new Map(), nonSerial:new Map(), prepared:new Map() },
    data: {
      despachos: [],
      items: [],
      serialRows: [],
      eventos: [],
      incidencias: [],
      movimientos: [],
      equipos: [],
      almacenes: [],
      productos: [],
      agencias: [],
      grupos: [],
      perfiles: [],
      lotes: []
    },
    maps: {}
  };

  const $ = (id) => document.getElementById(id);
  const arr = (v) => Array.isArray(v) ? v : [];
  const txt = (v) => String(v == null ? '' : v).trim();
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const esc = (v) => txt(v).replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const norm = (v) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const slug = (v) => norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const uuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(txt(v));
  const nowKey = () => 'ROW-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function client(){
    return window.lotekaSupabase || null;
  }

  function fmtDate(value){
    if(!value) return '-';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return txt(value) || '-';
    return d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function first(obj, keys, fallback=''){
    for(const key of keys){
      const value = obj && obj[key];
      if(value !== undefined && value !== null && txt(value) !== '') return value;
    }
    return fallback;
  }

  function toast(title, message, type='info'){
    try{
      if(typeof window.lotekaToast === 'function'){
        window.lotekaToast(title, message, type, 4800);
        return;
      }
    }catch(_e){}
    try{
      if(typeof window.toast === 'function'){
        window.toast(message || title, type);
        return;
      }
    }catch(_e){}
    if(type === 'error') alert((title ? title + '\n' : '') + (message || ''));
  }

  function errorText(error, step){
    const code = txt(error && error.code);
    const message = txt(error && error.message) || 'No se pudo completar la operación.';
    const friendly = {
      P0001: message,
      '23514': 'La operación no cumple una regla de integridad del inventario.',
      '23505': 'Ya existe un registro igual o el serial está reservado en otro despacho.',
      '42501': 'No tienes permiso para ejecutar esta acción.',
      '42702': 'El backend encontró una referencia ambigua. Revisa la función RPC.',
      PGRST116: 'No se encontró un único registro para completar la consulta.'
    };
    return (step ? step + ': ' : '') + (friendly[code] || message) + (code ? ' [' + code + ']' : '');
  }

  function showAlert(message, type='info'){
    const box = $('dspxAlert');
    if(!box) return;
    if(!message){ box.innerHTML=''; return; }
    const icon = type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
    box.innerHTML = '<div class="dspx-banner ' + esc(type) + '"><i class="fas ' + icon + '"></i><div>' + esc(message) + '</div></div>';
  }

  function setBusy(button, busy, label){
    if(!button) return;
    const inModal = Boolean(button.closest && button.closest('#dspxModal'));
    if(inModal && state.modal) state.modal.busy = Boolean(busy);
    state.modalBusy = inModal ? Boolean(busy) : state.modalBusy;
    if(busy){
      if(!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + esc(label || 'Procesando');
    }else{
      button.disabled = false;
      if(button.dataset.originalHtml){ button.innerHTML = button.dataset.originalHtml; delete button.dataset.originalHtml; }
      if(inModal) state.modalBusy = false;
    }
  }

  async function withBusy(button, label, task){
    setBusy(button, true, label);
    try{ return await task(); }
    finally{ setBusy(button, false); }
  }

  function normalizePermission(data){
    if(typeof data === 'boolean') return data;
    if(Array.isArray(data)){
      if(!data.length) return false;
      if(typeof data[0] === 'boolean') return data[0];
      const obj = data[0] || {};
      return Boolean(first(obj,['usuario_puede_ver_inventario','allowed','permitido','resultado'],false));
    }
    if(data && typeof data === 'object') return Boolean(first(data,['usuario_puede_ver_inventario','allowed','permitido','resultado'],false));
    return Boolean(data);
  }

  async function callRpc(name, args, step){
    const c = client();
    if(!c) throw {code:'CLIENT',message:'El cliente autenticado window.lotekaSupabase no está disponible.'};
    const response = await c.rpc(name, args || {});
    if(response.error){
      const err = Object.assign({step:step || name}, response.error);
      throw err;
    }
    return response.data;
  }

  async function fetchTable(table, configure, required=true){
    let query = state.client.from(table).select('*');
    if(typeof configure === 'function') query = configure(query);
    const response = await query;
    if(response.error){
      if(required) throw Object.assign({step:'CARGAR_' + table.toUpperCase()}, response.error);
      console.warn('[LOTEKA Despachos ' + VERSION + '] Tabla opcional no cargada:', table, response.error);
      return [];
    }
    return arr(response.data);
  }

  async function fetchRowsByIds(table, ids){
    const unique = Array.from(new Set(arr(ids).map(txt).filter(uuid)));
    if(!unique.length) return [];
    const out = [];
    for(let i=0;i<unique.length;i+=180){
      const chunk = unique.slice(i,i+180);
      const response = await state.client.from(table).select('*').in('id', chunk);
      if(response.error){
        console.warn('[LOTEKA Despachos ' + VERSION + '] No se pudieron cargar referencias de ' + table + ':', response.error);
        continue;
      }
      out.push(...arr(response.data));
    }
    return out;
  }

  function makeMap(list){
    const map = new Map();
    arr(list).forEach((row) => { if(row && row.id != null) map.set(txt(row.id), row); });
    return map;
  }

  function indexBy(list, key){
    const map = new Map();
    arr(list).forEach((row) => {
      const value = txt(row && row[key]);
      if(!value) return;
      if(!map.has(value)) map.set(value, []);
      map.get(value).push(row);
    });
    return map;
  }

  function rebuildMaps(){
    state.maps = {
      despachos: makeMap(state.data.despachos),
      items: makeMap(state.data.items),
      serialRows: makeMap(state.data.serialRows),
      equipos: makeMap(state.data.equipos),
      almacenes: makeMap(state.data.almacenes),
      productos: makeMap(state.data.productos),
      agencias: makeMap(state.data.agencias),
      grupos: makeMap(state.data.grupos),
      perfiles: makeMap(state.data.perfiles),
      lotes: makeMap(state.data.lotes),
      dispatchesByLot: indexBy(state.data.despachos,'lote_id'),
      itemsByDispatch: indexBy(state.data.items,'despacho_id'),
      serialsByItem: indexBy(state.data.serialRows,'despacho_item_id'),
      eventosByDispatch: indexBy(state.data.eventos,'despacho_id'),
      incidenciasByDispatch: indexBy(state.data.incidencias,'despacho_id'),
      movimientosByDispatch: indexBy(state.data.movimientos,'despacho_id')
    };
  }

  function warehouseLabel(id){
    const row = state.maps.almacenes.get(txt(id));
    if(!row) return txt(id) || 'Sin almacén';
    return [first(row,['codigo']), first(row,['nombre','name'])].map(txt).filter(Boolean).join(' · ') || txt(id);
  }

  function productLabel(id){
    const row = state.maps.productos.get(txt(id));
    if(!row) return txt(id) || 'Producto';
    const code = txt(first(row,['codigo']));
    const name = txt(first(row,['nombre','name','descripcion'],'Producto'));
    const brand = txt(first(row,['marca']));
    const model = txt(first(row,['modelo']));
    return [code,name,brand,model].filter(Boolean).join(' · ');
  }

  function agencyLabel(id){
    const row = state.maps.agencias.get(txt(id));
    if(!row) return txt(id) || 'Agencia';
    const number = txt(first(row,['numero','codigo']));
    const name = txt(first(row,['nombre']));
    return ['Agencia ' + (number || '-'), name && norm(name) !== norm('Agencia ' + number) ? name : ''].filter(Boolean).join(' · ');
  }

  function groupLabel(id){
    const row = state.maps.grupos.get(txt(id));
    if(!row) return txt(id) || 'Grupo';
    return [first(row,['codigo']), first(row,['nombre'])].map(txt).filter(Boolean).join(' · ') || txt(id);
  }

  function profileLabel(id){
    const row = state.maps.perfiles.get(txt(id));
    if(!row) return txt(id) || 'Sin encargado formal';
    return txt(first(row,['nombre_completo','nombre','display_name','usuario_login','correo','email'],row.id));
  }

  function serialLabel(serialRow){
    const equipment = state.maps.equipos.get(txt(serialRow && serialRow.serial_id));
    return txt(first(equipment,['serial','codigo'],serialRow && serialRow.serial_id)) || 'Serial sin código';
  }

  function destinationLabel(dispatch){
    const type = txt(dispatch && dispatch.tipo_destino).toUpperCase();
    if(type === 'AGENCIA') return agencyLabel(dispatch.agencia_destino_id);
    if(type === 'GRUPO') return groupLabel(dispatch.grupo_destino_id);
    if(type === 'ENCARGADO'){
      const responsible = txt(dispatch.responsable_destino_nombre) || profileLabel(dispatch.responsable_destino_id);
      const group = dispatch.grupo_destino_id ? groupLabel(dispatch.grupo_destino_id) : '';
      return responsible + (group ? ' · ' + group : '');
    }
    return 'Destino no definido';
  }

  function statusBadge(status){
    const value = txt(status) || 'SIN_ESTADO';
    const display = value.toUpperCase() === 'RECIBIDO' ? 'FINALIZADO' : value.replace(/_/g,' ');
    return '<span class="dspx-status dspx-status-' + esc(slug(value)) + '">' + esc(display) + '</span>';
  }

  function itemProgress(item){
    const requested = num(item.cantidad_solicitada);
    const prepared = num(item.cantidad_preparada);
    const received = num(item.cantidad_recibida);
    return {requested,prepared,received,remainingPrep:Math.max(0,requested-prepared),remainingReceive:Math.max(0,prepared-received)};
  }

  function dispatchProgress(dispatch){
    const items = state.maps.itemsByDispatch.get(txt(dispatch.id)) || [];
    return items.reduce((acc,item) => {
      const p = itemProgress(item);
      acc.requested += p.requested;
      acc.prepared += p.prepared;
      acc.received += p.received;
      return acc;
    },{requested:0,prepared:0,received:0});
  }

  function activeDispatches(){
    return state.data.despachos.filter((row) => !['RECIBIDO','CANCELADO'].includes(txt(row.estado).toUpperCase()));
  }

  function openIncidentCount(dispatchId){
    return arr(state.maps.incidenciasByDispatch.get(txt(dispatchId))).filter((row) => ['ABIERTA','EN_REVISION'].includes(txt(row.estado).toUpperCase())).length;
  }

  function updateKpis(){
    const rows = state.data.despachos;
    const count = (states) => rows.filter((r) => states.includes(txt(r.estado).toUpperCase())).length;
    const values = {
      dspxHeroTotal: rows.length,
      dspxHeroActive: activeDispatches().length,
      dspxKpiPending: count(['PENDIENTE_PREPARACION']),
      dspxKpiPreparing: count(['EN_PREPARACION']),
      dspxKpiReady: count(['PREPARADO']),
      dspxKpiTransit: count(['DESPACHADO']),
      dspxKpiReceived: count(['RECIBIDO']),
      dspxKpiIncidents: rows.filter((r) => openIncidentCount(r.id) > 0 || ['CON_INCIDENCIA','RECIBIDO_PARCIAL'].includes(txt(r.estado).toUpperCase())).length
    };
    Object.entries(values).forEach(([id,value]) => { const node=$(id); if(node) node.textContent=String(value); });
  }

  function ensureDraft(){
    if(state.draft) return state.draft;
    state.draft = {
      warehouseId: '',
      type: 'AGENCIA',
      agencyId: '',
      groupId: '',
      reason: '',
      documentReference: '',
      observations: '',
      items: [{key:nowKey(),productId:'',quantity:1,observations:'',serialMode:'preparacion',serials:[]}]
    };
    return state.draft;
  }

  function resetDraft(){
    state.draft = null;
    ensureDraft();
  }


  function newBatchItem(){
    return {key:nowKey(),productId:'',quantity:1,observations:''};
  }

  function ensureBatchDraft(){
    if(state.batchDraft) return state.batchDraft;
    state.batchDraft = {
      warehouseId:'',
      distribution:'IGUAL',
      reason:'',
      documentReference:'',
      observations:'',
      description:'',
      agencySearch:'',
      selectedAgencyIds:[],
      sharedItems:[newBatchItem()],
      agencyItems:{}
    };
    return state.batchDraft;
  }

  function resetBatchDraft(){
    state.batchDraft = null;
    ensureBatchDraft();
  }

  function ensureBatchAgencyItems(agencyId){
    const draft = ensureBatchDraft();
    const id = txt(agencyId);
    if(!Array.isArray(draft.agencyItems[id]) || !draft.agencyItems[id].length){
      draft.agencyItems[id] = [newBatchItem()];
    }
    return draft.agencyItems[id];
  }

  function batchAgencyGroupLabel(agency){
    if(!agency) return 'Sin grupo';
    const groupId = txt(first(agency,['grupo_id','grupo_uuid']));
    if(groupId && state.maps.grupos.has(groupId)) return groupLabel(groupId);
    return txt(first(agency,['grupo','grupo_numero','grupo_nombre'],'Sin grupo')) || 'Sin grupo';
  }

  function lotCode(loteId){
    const lot = state.maps.lotes && state.maps.lotes.get(txt(loteId));
    return lot ? txt(lot.codigo) : '';
  }

  function lotStatus(rows){
    const dispatches = arr(rows);
    if(!dispatches.length) return 'SIN DESPACHOS';
    const states = dispatches.map((row)=>txt(row.estado).toUpperCase());
    if(states.some((value)=>['CON_INCIDENCIA','RECIBIDO_PARCIAL'].includes(value))) return 'CON INCIDENCIA';
    if(states.every((value)=>value==='RECIBIDO')) return 'FINALIZADO';
    if(states.every((value)=>value==='PENDIENTE_PREPARACION')) return 'PENDIENTE';
    if(states.some((value)=>value==='RECIBIDO')) return 'PARCIAL';
    return 'EN PROCESO';
  }

  function batchScopeItems(scope){
    const draft = ensureBatchDraft();
    return scope === 'shared' ? draft.sharedItems : ensureBatchAgencyItems(scope);
  }

  function cleanBatchItems(items){
    return arr(items).map((row)=>({
      producto_id:txt(row.productId),
      cantidad:Math.max(0,Math.floor(num(row.quantity))),
      observaciones:txt(row.observations)||null
    }));
  }

  function buildBatchDestinations(draft){
    const shared = cleanBatchItems(draft.sharedItems);
    return draft.selectedAgencyIds.map((agencyId)=>({
      agencia_id:txt(agencyId),
      items:draft.distribution==='IGUAL' ? shared.map((row)=>Object.assign({},row)) : cleanBatchItems(ensureBatchAgencyItems(agencyId))
    }));
  }

  function batchTotals(draft){
    const totals = new Map();
    buildBatchDestinations(draft).forEach((destination)=>{
      destination.items.forEach((item)=>{
        if(!item.producto_id || item.cantidad<=0) return;
        totals.set(item.producto_id,(totals.get(item.producto_id)||0)+item.cantidad);
      });
    });
    return totals;
  }

  function filteredBatchAgencies(){
    const draft = ensureBatchDraft();
    const search = norm(draft.agencySearch);
    if(!search) return [];
    const selected = new Set(draft.selectedAgencyIds.map(txt));
    return state.data.agencias.filter((agency)=>{
      if(selected.has(txt(agency.id))) return false;
      const haystack = norm([
        first(agency,['numero','codigo']),
        first(agency,['nombre']),
        batchAgencyGroupLabel(agency)
      ].filter(Boolean).join(' '));
      return haystack.includes(search);
    }).slice(0,8);
  }

  function batchAgencyResultsHtml(){
    const draft = ensureBatchDraft();
    if(!txt(draft.agencySearch)) return '<div class="dspx-batch-search-empty"><i class="fas fa-magnifying-glass"></i> Escribe el número o nombre de una agencia.</div>';
    const rows = filteredBatchAgencies();
    if(!rows.length) return '<div class="dspx-batch-search-empty"><i class="fas fa-circle-info"></i> No hay agencias disponibles con esa búsqueda.</div>';
    return rows.map((agency)=>'<button class="dspx-batch-agency-result" data-action="batch-add-agency" data-agency-id="'+esc(agency.id)+'" type="button"><span><b>'+esc(agencyLabel(agency.id))+'</b><small>'+esc(batchAgencyGroupLabel(agency))+'</small></span><i class="fas fa-plus"></i></button>').join('');
  }

  function renderBatchAgencyResults(){
    const box = document.querySelector('#dspxModal [data-role="batch-agency-results"]');
    if(box) box.innerHTML = batchAgencyResultsHtml();
  }

  function validateBatchDraft(draft){
    if(!draft.warehouseId) throw {message:'Selecciona el almacén de origen.'};
    if(!['IGUAL','PERSONALIZADA'].includes(txt(draft.distribution).toUpperCase())) throw {message:'Selecciona un tipo de distribución válido.'};
    if(draft.selectedAgencyIds.length < 2) throw {message:'Agrega al menos dos agencias al lote.'};
    if(new Set(draft.selectedAgencyIds.map(txt)).size !== draft.selectedAgencyIds.length) throw {message:'Una agencia está repetida dentro del lote.'};
    if(!txt(draft.reason)) throw {message:'Escribe el motivo del lote.'};

    const destinations = buildBatchDestinations(draft);
    destinations.forEach((destination)=>{
      const agency = state.maps.agencias.get(txt(destination.agencia_id));
      if(!agency) throw {message:'Una de las agencias seleccionadas ya no está disponible.'};
      if(!destination.items.length) throw {message:agencyLabel(destination.agencia_id)+' debe tener al menos un producto.'};
      if(destination.items.some((item)=>!uuid(item.producto_id) || item.cantidad<=0 || !Number.isInteger(item.cantidad))){
        throw {message:'Completa todos los productos de '+agencyLabel(destination.agencia_id)+' con cantidades enteras mayores que cero.'};
      }
      const unique = new Set(destination.items.map((item)=>item.producto_id));
      if(unique.size !== destination.items.length) throw {message:'No repitas productos dentro del despacho de '+agencyLabel(destination.agencia_id)+'.'};
    });

    const totals = batchTotals(draft);
    totals.forEach((requested,productId)=>{
      const product = state.maps.productos.get(txt(productId));
      const stock = availableStock(draft.warehouseId,productId);
      if(!product || stock<=0) throw {message:'El producto '+productLabel(productId)+' ya no tiene existencia disponible.'};
      if(requested>stock) throw {message:'Stock insuficiente para '+productLabel(productId)+'. Disponible: '+stock+'. Total solicitado en el lote: '+requested+'.'};
    });
    return destinations;
  }

  function batchDraftIsDirty(){
    const draft = ensureBatchDraft();
    return Boolean(
      draft.warehouseId || draft.selectedAgencyIds.length || txt(draft.reason) || txt(draft.documentReference) ||
      txt(draft.observations) || txt(draft.description) || txt(draft.agencySearch) ||
      draft.sharedItems.some((row)=>row.productId || txt(row.observations) || num(row.quantity)!==1) ||
      Object.values(draft.agencyItems).some((items)=>arr(items).some((row)=>row.productId || txt(row.observations) || num(row.quantity)!==1))
    );
  }

  function option(value,label,selected,disabled){
    return '<option value="' + esc(value) + '"' + (txt(value)===txt(selected)?' selected':'') + (disabled?' disabled':'') + '>' + esc(label) + '</option>';
  }

  function warehouseOptions(selected){
    return '<option value="">Selecciona almacén</option>' + state.data.almacenes.map((row) => option(row.id,warehouseLabel(row.id),selected)).join('');
  }

  function productRequiresSerial(product){
    if(!product) return false;
    if(typeof product.requiere_serial === 'boolean') return product.requiere_serial;
    const raw = norm([product.tipo_producto,product.categoria,product.nombre,product.codigo].filter(Boolean).join(' '));
    if(raw.includes('no serial')) return false;
    return raw.includes('serial');
  }

  function stockKey(warehouseId,productId){ return txt(warehouseId)+'|'+txt(productId); }

  function equipmentBlocked(row){
    const value = norm(row && row.estado);
    if(!value) return false;
    return ['reservado','despachado','transito','tránsito','recibido','incidencia','baja','no reparable'].some((token)=>value.includes(token));
  }

  function equipmentAvailable(row,warehouseId,productId){
    if(!row || row.activo === false) return false;
    if(txt(row.ubicacion_tipo).toUpperCase() !== 'ALMACEN') return false;
    if(txt(row.almacen_id) !== txt(warehouseId) || txt(row.producto_id) !== txt(productId)) return false;
    if(txt(row.despacho_actual_id) || txt(row.reservado_en) || txt(row.reservado_por)) return false;
    return !equipmentBlocked(row);
  }

  function rebuildStockMaps(){
    const serials = new Map();
    const nonSerial = new Map();
    const prepared = new Map();

    state.data.equipos.forEach((row)=>{
      if(!row || row.activo === false || txt(row.ubicacion_tipo).toUpperCase() !== 'ALMACEN' || !row.almacen_id || !row.producto_id) return;
      const key = stockKey(row.almacen_id,row.producto_id);
      if(!serials.has(key)) serials.set(key,[]);
      if(equipmentAvailable(row,row.almacen_id,row.producto_id)) serials.get(key).push(row);
    });

    state.data.movimientos.forEach((movement)=>{
      if(!movement || movement.serial_id || !movement.producto_id) return;
      const qty = num(movement.cantidad);
      if(qty <= 0) return;
      if(txt(movement.destino_tipo).toUpperCase()==='ALMACEN' && movement.destino_id){
        const key = stockKey(movement.destino_id,movement.producto_id);
        nonSerial.set(key,(nonSerial.get(key)||0)+qty);
      }
      if(txt(movement.origen_tipo).toUpperCase()==='ALMACEN' && movement.origen_id){
        const key = stockKey(movement.origen_id,movement.producto_id);
        nonSerial.set(key,(nonSerial.get(key)||0)-qty);
      }
    });

    state.data.items.forEach((item)=>{
      if(item.requiere_serial === true) return;
      const dispatch = state.maps.despachos ? state.maps.despachos.get(txt(item.despacho_id)) : null;
      if(!dispatch || !['EN_PREPARACION','PREPARADO'].includes(txt(dispatch.estado).toUpperCase())) return;
      const key = stockKey(dispatch.almacen_origen_id,item.producto_id);
      prepared.set(key,(prepared.get(key)||0)+num(item.cantidad_preparada));
    });

    state.stock = {serials,nonSerial,prepared};
  }

  function availableSerialRows(warehouseId,productId){
    return arr(state.stock.serials.get(stockKey(warehouseId,productId))).slice().sort((a,b)=>txt(a.serial).localeCompare(txt(b.serial),'es'));
  }

  function physicalSerialRows(warehouseId,productId){
    return state.data.equipos.filter((row)=>row && row.activo!==false && txt(row.ubicacion_tipo).toUpperCase()==='ALMACEN' && txt(row.almacen_id)===txt(warehouseId) && txt(row.producto_id)===txt(productId));
  }

  function availableStock(warehouseId,productId){
    const product = state.maps.productos.get(txt(productId));
    if(!warehouseId || !product) return 0;
    if(productRequiresSerial(product)) return availableSerialRows(warehouseId,productId).length;
    const key = stockKey(warehouseId,productId);
    return Math.max(0,num(state.stock.nonSerial.get(key))-num(state.stock.prepared.get(key)));
  }

  function physicalStock(warehouseId,productId){
    const product = state.maps.productos.get(txt(productId));
    if(!warehouseId || !product) return 0;
    if(productRequiresSerial(product)) return physicalSerialRows(warehouseId,productId).length;
    return Math.max(0,num(state.stock.nonSerial.get(stockKey(warehouseId,productId))));
  }

  function warehouseCatalog(warehouseId){
    if(!warehouseId) return [];
    return state.data.productos.map((product)=>({product,stock:availableStock(warehouseId,product.id)})).filter((entry)=>entry.stock>0);
  }

  function productOptions(selected,warehouseId){
    if(!warehouseId) return '<option value="">Selecciona primero el almacén de origen</option>';
    const rows = warehouseCatalog(warehouseId);
    if(!rows.length) return '<option value="">No hay productos con existencia disponible</option>';
    return '<option value="">Selecciona producto existente</option>' + rows.map(({product,stock}) => {
      const serial = productRequiresSerial(product) ? 'Serializado' : 'No serializado';
      return option(product.id,productLabel(product.id)+' · '+serial+' · Disponible: '+stock,selected);
    }).join('');
  }

  function movementTime(row){
    const value = first(row,['creado_en','fecha','fechaHora','fecha_vista'],'');
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function movementMatchesWarehouse(row,warehouseId){
    const id = txt(warehouseId);
    return Boolean(id && (txt(row.origen_id)===id || txt(row.destino_id)===id || txt(row.almacen_id)===id));
  }

  function warehouseInventory(warehouseId){
    return state.data.productos.map((product)=>{
      const qty = physicalStock(warehouseId,product.id);
      if(qty<=0) return null;
      const serialRows = productRequiresSerial(product) ? physicalSerialRows(warehouseId,product.id) : [];
      return {
        productoId:product.id,
        producto:txt(first(product,['nombre','descripcion'],product.codigo||'Producto')),
        codigo:txt(product.codigo),
        marca:txt(product.marca),
        modelo:txt(product.modelo),
        categoria:txt(product.categoria||product.tipo_producto||'Inventario'),
        tipo:productRequiresSerial(product)?'Serializado':'No serializado',
        serializado:productRequiresSerial(product)?'si':'no',
        cantidad:qty,
        seriales:serialRows.map((row)=>txt(row.serial)).filter(Boolean)
      };
    }).filter(Boolean);
  }

  function normalizedWarehouses(){
    return state.data.almacenes.filter((row)=>row && row.activo!==false).map((row)=>{
      const movements = state.data.movimientos.filter((m)=>movementMatchesWarehouse(m,row.id)).sort((a,b)=>movementTime(b)-movementTime(a));
      const inventory = warehouseInventory(row.id);
      const total = inventory.reduce((sum,item)=>sum+num(item.cantidad),0);
      const last = movements[0] || null;
      return {
        id:row.id,
        supabaseId:row.id,
        codigo:txt(row.codigo),
        nombre:txt(row.nombre||row.codigo||'Almacén'),
        tipo:txt(row.tipo||'Físico'),
        ubicacion:txt(first(row,['ubicacion','direccion','localidad'],'')),
        descripcion:txt(row.descripcion),
        activo:row.activo!==false,
        inventario:inventory,
        movimientos:movements,
        stats:{productos:inventory.length,unidades:total,ultimo:last?fmtDate(last.creado_en):'Sin movimientos'}
      };
    });
  }

  function publishWarehouseState(){
    const list = normalizedWarehouses();
    window.almacenes = list;
    try{ almacenes = list; }catch(_e){}
    window.lotekaEquiposSerialesSupabase = state.data.equipos.slice();
    window.lotekaMovimientosInventarioSupabase = state.data.movimientos.slice();
    return list;
  }

  function lastMovementHtml(warehouse){
    const movement = arr(warehouse.movimientos)[0];
    if(!movement) return '<div class="go-alm-last"><span class="go-alm-last-icon sin"><i class="fas fa-clock"></i></span><div class="go-alm-last-info"><span class="go-alm-chip sin"><i class="fas fa-minus-circle"></i> Sin movimientos</span><b>Sin movimientos registrados</b><small>Este almacén todavía no tiene entrada, salida o transferencia registrada.</small></div></div>';
    const type = txt(movement.tipo_movimiento||'Movimiento');
    const detail = txt(movement.motivo||movement.observaciones||movement.destino_nombre||movement.origen_nombre||'Movimiento registrado');
    return '<div class="go-alm-last"><span class="go-alm-last-icon transferencia"><i class="fas fa-right-left"></i></span><div class="go-alm-last-info"><span class="go-alm-chip transferencia"><i class="fas fa-right-left"></i> '+esc(type)+'</span><b>'+esc(fmtDate(movement.creado_en))+'</b><small>'+esc(detail)+'</small></div></div>';
  }

  function renderWarehouseScreen(){
    const body = $('tabla-almacenes');
    if(!body) return;
    const list = publishWarehouseState();
    body.innerHTML = list.map((warehouse,index)=>{
      const total = warehouse.inventario.reduce((sum,item)=>sum+num(item.cantidad),0);
      const icon = norm(warehouse.tipo).includes('taller') ? 'fa-screwdriver-wrench' : 'fa-warehouse';
      return '<tr><td><div class="go-alm-namebox"><span class="go-alm-avatar"><i class="fas '+icon+'"></i></span><div><b>'+esc((warehouse.codigo?warehouse.codigo+' · ':'')+warehouse.nombre)+'</b><small>'+esc(warehouse.ubicacion||'Ubicación no definida')+'</small></div></div></td><td><span class="go-alm-type"><i class="fas '+icon+'"></i> '+esc(warehouse.tipo||'Físico')+'</span></td><td><span class="go-alm-count">'+esc(warehouse.inventario.length)+'</span></td><td><span class="go-alm-count">'+esc(total)+'</span></td><td>'+lastMovementHtml(warehouse)+'</td><td class="actions"><i class="fas fa-eye" title="Ver almacén" onclick="verDetalleAlmacen('+index+')"></i><span class="go-alm-readonly"><i class="fas fa-database"></i> Supabase</span></td></tr>';
    }).join('') || '<tr><td colspan="6" class="entry-empty">No hay almacenes activos visibles en Supabase.</td></tr>';

    const today = new Date();
    const movementsToday = new Set(state.data.movimientos.filter((movement)=>{
      const d = new Date(movement.creado_en);
      return !Number.isNaN(d.getTime()) && d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth() && d.getDate()===today.getDate() && (txt(movement.origen_tipo).toUpperCase()==='ALMACEN' || txt(movement.destino_tipo).toUpperCase()==='ALMACEN');
    }).map((movement)=>txt(movement.id)||[movement.creado_en,movement.producto_id,movement.origen_id,movement.destino_id].join('|'))).size;
    const totalUnits = list.reduce((sum,warehouse)=>sum+warehouse.inventario.reduce((sub,item)=>sub+num(item.cantidad),0),0);
    if($('dashTotalAlmacenes')) $('dashTotalAlmacenes').textContent=String(list.length);
    if($('dashProductosAlmacenes')) $('dashProductosAlmacenes').textContent=String(totalUnits);
    if($('dashMovimientosHoy')) $('dashMovimientosHoy').textContent=String(movementsToday);
  }

  function agencyOptions(selected){
    return '<option value="">Selecciona agencia</option>' + state.data.agencias.map((row) => option(row.id,agencyLabel(row.id),selected)).join('');
  }

  function groupOptions(selected){
    return '<option value="">Selecciona grupo</option>' + state.data.grupos.map((row) => option(row.id,groupLabel(row.id),selected)).join('');
  }

  function profileOptions(selected){
    return '<option value="">Selecciona perfil</option>' + state.data.perfiles.map((row) => option(row.id,profileLabel(row.id),selected)).join('');
  }

  function renderSummary(){
    const rows = state.data.despachos.slice(0,12);
    const body = rows.map((dispatch) => {
      const progress = dispatchProgress(dispatch);
      const units = progress.requested;
      return '<tr>'+
        '<td><span class="dspx-code">'+esc(dispatch.codigo || dispatch.id)+'</span><span class="dspx-sub">'+esc(fmtDate(dispatch.creado_en || dispatch.fecha_solicitud))+'</span></td>'+
        '<td>'+esc(dispatch.tipo_destino || '-')+'</td>'+
        '<td>'+esc(destinationLabel(dispatch))+'</td>'+
        '<td>'+statusBadge(dispatch.estado)+'</td>'+
        '<td>'+esc(units)+'</td>'+
        '<td>'+esc(first(dispatch,['solicitado_por_nombre','preparado_por_nombre','confirmado_por_nombre','recibido_por_nombre'],'-'))+'</td>'+
        '<td><div class="dspx-inline"><button class="dspx-btn secondary" data-action="view-history" data-id="'+esc(dispatch.id)+'" type="button"><i class="fas fa-eye"></i> Ver</button>'+renderStateAction(dispatch,true)+'</div></td>'+
      '</tr>';
    }).join('');

    return '<section class="dispatch-panel">'+
      '<div class="dispatch-panel-head"><div><h3>Resumen general</h3><p>Últimos despachos y acceso rápido al siguiente paso disponible.</p></div><button class="dspx-btn primary" data-dspx-tab="nuevo" type="button"><i class="fas fa-plus"></i> Nuevo despacho</button></div>'+
      '<div class="dispatch-panel-body">'+
        (state.data.despachos.length ? '<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Código</th><th>Tipo</th><th>Destino</th><th>Estado</th><th>Unidades</th><th>Responsable</th><th>Acciones</th></tr></thead><tbody>'+body+'</tbody></table></div>' : emptyHtml('No hay despachos registrados todavía.'))+
      '</div></section>';
  }

  function dispatchModeSwitcherHtml(){
    const mode = txt(state.creationMode).toLowerCase();
    return '<div class="dspx-mode-switch" id="dspxDispatchCreationMode" role="tablist" aria-label="Modalidad del despacho">'+
      '<button class="dspx-mode-option '+(mode==='individual'?'active':'')+'" data-action="set-dispatch-creation-mode" data-mode="individual" type="button" role="tab" aria-selected="'+(mode==='individual'?'true':'false')+'"><i class="fas fa-box"></i> Despacho individual</button>'+
      '<button class="dspx-mode-option '+(mode==='multiple'?'active':'')+'" data-action="set-dispatch-creation-mode" data-mode="multiple" type="button" role="tab" aria-selected="'+(mode==='multiple'?'true':'false')+'"><i class="fas fa-layer-group"></i> Múltiple a agencias</button>'+
    '</div>';
  }

  function ensureDispatchCreationModeMounted(){
    const body = $('dspxModalBody');
    if(!body || body.querySelector('#dspxDispatchCreationMode')) return;
    body.insertAdjacentHTML('afterbegin',dispatchModeSwitcherHtml());
  }

  function individualDispatchFormHtml(){
    const draft = ensureDraft();
    const type = txt(draft.type).toUpperCase();
    const group = state.maps.grupos.get(txt(draft.groupId));
    const formalId = group ? txt(group.encargado_id) : '';
    const formalName = formalId ? profileLabel(formalId) : txt(group && group.encargado);
    const destinationFields = type === 'AGENCIA'
      ? '<div class="dspx-field"><label>Agencia destino</label><select data-draft-field="agencyId" required>'+agencyOptions(draft.agencyId)+'</select></div>'
      : '<div class="dspx-field"><label>Grupo destino</label><select data-draft-field="groupId" required>'+groupOptions(draft.groupId)+'</select></div>' +
        (type === 'ENCARGADO' ? '<div class="dspx-field"><label>Encargado formal</label><input value="'+esc(formalName || 'Sin encargado formal')+'" readonly></div>' : '');

    const formalBox = type === 'ENCARGADO' && draft.groupId && !formalId
      ? '<div class="dspx-banner error" style="margin-top:12px"><i class="fas fa-user-shield"></i><div><b>Este grupo no tiene encargado formal vinculado.</b><br>Debes vincular un perfil antes de crear un despacho de tipo ENCARGADO.<div style="margin-top:10px"><button class="dspx-btn warning" data-action="open-formal-assignment" data-group-id="'+esc(draft.groupId)+'" type="button"><i class="fas fa-link"></i> Vincular encargado formal</button></div></div></div>'
      : type === 'ENCARGADO' && formalId
        ? '<div class="dspx-banner success" style="margin-top:12px"><i class="fas fa-user-check"></i><div>El despacho quedará registrado a nombre de <b>'+esc(formalName)+'</b>. La entrega quedará finalizada al confirmar la salida.</div></div>'
        : '';

    const hasWarehouse = Boolean(draft.warehouseId);
    const catalog = warehouseCatalog(draft.warehouseId);
    const itemRows = draft.items.map((item,index) => {
      const product = state.maps.productos.get(txt(item.productId));
      const serialized = productRequiresSerial(product);
      const stock = item.productId ? availableStock(draft.warehouseId,item.productId) : 0;
      const qty = Math.max(1,Math.floor(num(item.quantity)||1));
      const stockNote = !hasWarehouse
        ? '<div class="dspx-stock-note empty"><i class="fas fa-circle-info"></i> Selecciona primero el almacén.</div>'
        : item.productId
          ? '<div class="dspx-stock-note '+(stock>0?'ok':'empty')+'"><i class="fas '+(stock>0?'fa-circle-check':'fa-triangle-exclamation')+'"></i> Disponible en '+esc(warehouseLabel(draft.warehouseId))+': '+esc(stock)+'</div>'
          : '<div class="dspx-stock-note"><i class="fas fa-boxes-stacked"></i> '+esc(catalog.length)+' producto(s) con existencia.</div>';
      const serialPolicy = serialized
        ? '<div class="dspx-serial-policy"><b>Seriales:</b> el encargado de almacén los escaneará durante Preparación usando <code>rpc_agregar_serial_despacho</code>.</div>'
        : '';
      return '<div class="dspx-item-row" data-draft-item="'+esc(item.key)+'">'+
        '<div class="dspx-field"><label>Producto '+(index+1)+'</label><select data-draft-item-field="productId" '+(!hasWarehouse?'disabled':'')+' required>'+productOptions(item.productId,draft.warehouseId)+'</select>'+stockNote+serialPolicy+'</div>'+
        '<div class="dspx-field"><label>Cantidad</label><input data-draft-item-field="quantity" type="number" min="1" '+(stock>0?'max="'+esc(stock)+'"':'')+' step="1" value="'+esc(qty)+'" '+(!item.productId?'disabled':'')+' required></div>'+
        '<div class="dspx-field dspx-item-observation"><label>Observación</label><input data-draft-item-field="observations" value="'+esc(item.observations)+'" placeholder="Opcional"></div>'+
        '<button class="dspx-btn danger icon" data-action="remove-draft-item" data-key="'+esc(item.key)+'" type="button" title="Quitar producto"><i class="fas fa-trash"></i></button>'+
      '</div>';
    }).join('');

    return '<div class="dspx-warehouse-source"><i class="fas fa-database"></i> Almacenes, productos y existencias se consultan desde Supabase.</div><form id="dspxNewDispatchForm">'+
      '<div class="dspx-form-grid">'+
        '<div class="dspx-field"><label>Almacén de origen</label><select data-draft-field="warehouseId" required>'+warehouseOptions(draft.warehouseId)+'</select></div>'+
        '<div class="dspx-field"><label>Tipo de destino</label><select data-draft-field="type"><option value="AGENCIA"'+(type==='AGENCIA'?' selected':'')+'>Agencia</option><option value="GRUPO"'+(type==='GRUPO'?' selected':'')+'>Grupo</option><option value="ENCARGADO"'+(type==='ENCARGADO'?' selected':'')+'>Encargado</option></select></div>'+
        destinationFields+
        '<div class="dspx-field span-2"><label>Motivo</label><input data-draft-field="reason" value="'+esc(draft.reason)+'" placeholder="Motivo del despacho" required></div>'+
        '<div class="dspx-field"><label>Documento de referencia</label><input data-draft-field="documentReference" value="'+esc(draft.documentReference)+'" placeholder="Factura, solicitud o referencia"></div>'+
        '<div class="dspx-field full"><label>Observaciones</label><textarea data-draft-field="observations" placeholder="Información adicional">'+esc(draft.observations)+'</textarea></div>'+
      '</div>'+formalBox+
      '<div class="dspx-card" style="margin-top:16px"><div class="dspx-card-head"><div><h4>Productos solicitados</h4><p>Solo aparecen productos con existencia disponible en el almacén seleccionado.</p></div><button class="dspx-btn secondary" data-action="add-draft-item" type="button" '+(!hasWarehouse?'disabled':'')+'><i class="fas fa-plus"></i> Agregar producto</button></div><div class="dspx-items">'+itemRows+'</div></div>'+
      '<div class="dspx-actions"><button class="dspx-btn secondary" data-action="reset-draft" type="button"><i class="fas fa-rotate-left"></i> Limpiar</button><button class="dspx-btn primary" type="submit"><i class="fas fa-paper-plane"></i> Crear despacho</button></div>'+
    '</form>';
  }

  function batchItemRowsHtml(items,scope){
    const draft = ensureBatchDraft();
    const hasWarehouse = Boolean(draft.warehouseId);
    return arr(items).map((item,index)=>{
      const stock = item.productId ? availableStock(draft.warehouseId,item.productId) : 0;
      const qty = Math.max(1,Math.floor(num(item.quantity)||1));
      const required = item.productId ? (draft.distribution==='IGUAL' && scope==='shared' ? qty*draft.selectedAgencyIds.length : batchTotals(draft).get(txt(item.productId))||qty) : 0;
      const note = !hasWarehouse
        ? '<div class="dspx-stock-note empty"><i class="fas fa-circle-info"></i> Selecciona primero el almacén.</div>'
        : item.productId
          ? '<div class="dspx-stock-note '+(required<=stock?'ok':'empty')+'"><i class="fas '+(required<=stock?'fa-circle-check':'fa-triangle-exclamation')+'"></i> Disponible: '+esc(stock)+' · Total lote: '+esc(required)+'</div>'
          : '<div class="dspx-stock-note"><i class="fas fa-boxes-stacked"></i> Selecciona un producto con existencia.</div>';
      return '<div class="dspx-batch-product-row" data-batch-item-row="'+esc(item.key)+'" data-scope="'+esc(scope)+'">'+
        '<div class="dspx-field"><label>Producto '+(index+1)+'</label><select data-batch-item-field="productId" data-scope="'+esc(scope)+'" data-key="'+esc(item.key)+'" '+(!hasWarehouse?'disabled':'')+' required>'+productOptions(item.productId,draft.warehouseId)+'</select>'+note+'</div>'+
        '<div class="dspx-field"><label>Cantidad</label><input data-batch-item-field="quantity" data-scope="'+esc(scope)+'" data-key="'+esc(item.key)+'" type="number" min="1" step="1" value="'+esc(qty)+'" '+(!item.productId?'disabled':'')+' required></div>'+
        '<div class="dspx-field dspx-batch-observation"><label>Observación</label><input data-batch-item-field="observations" data-scope="'+esc(scope)+'" data-key="'+esc(item.key)+'" value="'+esc(item.observations)+'" placeholder="Opcional"></div>'+
        '<button class="dspx-btn danger icon" data-action="batch-remove-item" data-scope="'+esc(scope)+'" data-key="'+esc(item.key)+'" type="button" title="Quitar producto"><i class="fas fa-trash"></i></button>'+
      '</div>';
    }).join('');
  }

  function batchStockSummaryHtml(){
    const draft = ensureBatchDraft();
    const totals = batchTotals(draft);
    if(!draft.warehouseId || !totals.size) return '<div class="dspx-batch-search-empty"><i class="fas fa-boxes-stacked"></i> El resumen aparecerá cuando selecciones almacén, agencias y productos.</div>';
    return '<div class="dspx-batch-stock">'+Array.from(totals.entries()).map(([productId,requested])=>{
      const available = availableStock(draft.warehouseId,productId);
      const ok = requested<=available;
      return '<div class="dspx-batch-stock-row '+(ok?'ok':'error')+'"><b>'+esc(productLabel(productId))+'</b><span>Disponible: '+esc(available)+'</span><span>Solicitado: '+esc(requested)+'</span><i class="fas '+(ok?'fa-circle-check':'fa-circle-exclamation')+'"></i></div>';
    }).join('')+'</div>';
  }

  function multipleDispatchFormHtml(){
    const draft = ensureBatchDraft();
    const selectedHtml = draft.selectedAgencyIds.length ? draft.selectedAgencyIds.map((agencyId)=>{
      const agency = state.maps.agencias.get(txt(agencyId));
      return '<div class="dspx-batch-agency-chip"><span><b>'+esc(agencyLabel(agencyId))+'</b><small>'+esc(batchAgencyGroupLabel(agency))+'</small></span><button class="dspx-btn danger icon" data-action="batch-remove-agency" data-agency-id="'+esc(agencyId)+'" type="button" title="Quitar agencia"><i class="fas fa-xmark"></i></button></div>';
    }).join('') : '<div class="dspx-batch-search-empty"><i class="fas fa-building-circle-xmark"></i> Todavía no has agregado agencias.</div>';

    const distributionHtml = draft.distribution==='IGUAL'
      ? '<div class="dspx-batch-section"><div class="dspx-batch-section-head"><div><h4>Productos para todas las agencias</h4><p>Esta misma distribución se copiará en cada despacho individual.</p></div><button class="dspx-btn secondary" data-action="batch-add-item" data-scope="shared" type="button" '+(!draft.warehouseId?'disabled':'')+'><i class="fas fa-plus"></i> Agregar producto</button></div><div class="dspx-batch-products">'+batchItemRowsHtml(draft.sharedItems,'shared')+'</div></div>'
      : '<div class="dspx-batch-section"><div class="dspx-batch-section-head"><div><h4>Distribución personalizada por agencia</h4><p>Cada agencia tendrá su propia lista de productos y cantidades.</p></div></div>'+(
          draft.selectedAgencyIds.length ? draft.selectedAgencyIds.map((agencyId)=>'<details class="dspx-batch-agency-card" open><summary><span>'+esc(agencyLabel(agencyId))+'</span><span>'+esc(ensureBatchAgencyItems(agencyId).length)+' producto(s)</span></summary><div class="dspx-batch-agency-card-body"><div class="dspx-batch-products">'+batchItemRowsHtml(ensureBatchAgencyItems(agencyId),agencyId)+'</div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="batch-add-item" data-scope="'+esc(agencyId)+'" type="button" '+(!draft.warehouseId?'disabled':'')+'><i class="fas fa-plus"></i> Agregar producto</button></div></div></details>').join('') : '<div class="dspx-batch-search-empty"><i class="fas fa-building"></i> Agrega las agencias para configurar sus productos.</div>'
        )+'</div>';

    return '<div class="dspx-banner"><i class="fas fa-layer-group"></i><div><b>Una operación, varios despachos independientes.</b><br>Cada agencia recibirá su propio código DSP y continuará por Preparación, Salida y Finalización de forma individual.</div></div>'+
      '<form id="dspxBatchDispatchForm" style="margin-top:14px">'+
        '<div class="dspx-form-grid">'+
          '<div class="dspx-field"><label>Almacén de origen</label><select data-batch-field="warehouseId" required>'+warehouseOptions(draft.warehouseId)+'</select></div>'+
          '<div class="dspx-field"><label>Tipo de distribución</label><select data-batch-field="distribution"><option value="IGUAL"'+(draft.distribution==='IGUAL'?' selected':'')+'>Misma para todas</option><option value="PERSONALIZADA"'+(draft.distribution==='PERSONALIZADA'?' selected':'')+'>Personalizada por agencia</option></select></div>'+
          '<div class="dspx-field"><label>Descripción del lote</label><input data-batch-field="description" value="'+esc(draft.description)+'" placeholder="Ej.: Distribución de routers"></div>'+
          '<div class="dspx-field span-2"><label>Motivo</label><input data-batch-field="reason" value="'+esc(draft.reason)+'" placeholder="Motivo general del lote" required></div>'+
          '<div class="dspx-field"><label>Documento de referencia</label><input data-batch-field="documentReference" value="'+esc(draft.documentReference)+'" placeholder="Factura, solicitud o referencia"></div>'+
          '<div class="dspx-field full"><label>Observaciones generales</label><textarea data-batch-field="observations" placeholder="Información que se aplicará a todos los despachos">'+esc(draft.observations)+'</textarea></div>'+
        '</div>'+
        '<section class="dspx-batch-section"><div class="dspx-batch-section-head"><div><h4>Agencias destino</h4><p>Busca por número, nombre o grupo y agrégalas una por una.</p></div><span class="dspx-batch-count"><i class="fas fa-building"></i> '+esc(draft.selectedAgencyIds.length)+' seleccionada(s)</span></div><div class="dspx-batch-agency-search"><div class="dspx-field"><label>Buscar agencia</label><input data-batch-field="agencySearch" value="'+esc(draft.agencySearch)+'" autocomplete="off" placeholder="Ej.: 0003, Los Mina o Grupo 03"></div><div class="dspx-batch-agency-results" data-role="batch-agency-results">'+batchAgencyResultsHtml()+'</div></div><div class="dspx-batch-selected">'+selectedHtml+'</div></section>'+
        distributionHtml+
        '<section class="dspx-batch-section"><div class="dspx-batch-section-head"><div><h4>Validación global del lote</h4><p>Compara la suma de todos los despachos contra la existencia disponible.</p></div></div>'+batchStockSummaryHtml()+'</section>'+
        '<div class="dspx-actions"><button class="dspx-btn secondary" data-action="reset-batch" type="button"><i class="fas fa-rotate-left"></i> Limpiar lote</button><button class="dspx-btn primary" type="submit"><i class="fas fa-layer-group"></i> Crear lote de despachos</button></div>'+
      '</form>';
  }

  function newDispatchFormHtml(){
    return dispatchModeSwitcherHtml() + (txt(state.creationMode).toLowerCase()==='multiple' ? multipleDispatchFormHtml() : individualDispatchFormHtml());
  }

  function openNewDispatchModal(){
    ensureBatchDraft();
    if(!['individual','multiple'].includes(txt(state.creationMode).toLowerCase())) state.creationMode='individual';
    const subtitle = txt(state.creationMode).toLowerCase()==='multiple' ? 'Creación transaccional de un lote con varios despachos a agencias.' : 'Solicitud formal conectada a rpc_crear_despacho.';
    openModal('Nuevo despacho',subtitle,newDispatchFormHtml(),{type:'new-dispatch',id:null,busy:false});
    ensureDispatchCreationModeMounted();
    setTimeout(()=>{
      ensureDispatchCreationModeMounted();
      const firstField = $('dspxModalBody') && $('dspxModalBody').querySelector('select,input,textarea');
      if(firstField) firstField.focus();
    },30);
  }

  function refreshNewDispatchModal(){
    if(!state.modal || state.modal.type!=='new-dispatch') return;
    const body = $('dspxModalBody');
    if(body) body.innerHTML = newDispatchFormHtml();
    ensureDispatchCreationModeMounted();
    const subtitle = $('dspxModalSubtitle');
    if(subtitle) subtitle.textContent = txt(state.creationMode).toLowerCase()==='multiple' ? 'Creación transaccional de un lote con varios despachos a agencias.' : 'Solicitud formal conectada a rpc_crear_despacho.';
  }

  function renderStateAction(dispatch, compact){
    const stateName = txt(dispatch.estado).toUpperCase();
    const id = esc(dispatch.id);
    const cls = compact ? 'dspx-btn secondary' : 'dspx-btn primary';
    if(stateName === 'PENDIENTE_PREPARACION') return '<button class="'+cls+'" data-action="start-preparation" data-id="'+id+'" type="button"><i class="fas fa-play"></i> Iniciar</button>';
    if(stateName === 'EN_PREPARACION') return '<button class="'+cls+'" data-action="open-preparation" data-id="'+id+'" type="button"><i class="fas fa-box-open"></i> Preparar</button>';
    if(stateName === 'PREPARADO') return '<button class="'+cls+'" data-action="confirm-exit" data-id="'+id+'" type="button"><i class="fas fa-truck-fast"></i> Confirmar salida</button>';
    if(['DESPACHADO','RECIBIDO_PARCIAL','CON_INCIDENCIA'].includes(stateName)) return '';
    return '';
  }

  function dispatchCard(dispatch, mode){
    const progress = dispatchProgress(dispatch);
    const prepPct = progress.requested ? clamp(Math.round(progress.prepared/progress.requested*100),0,100) : 0;
    const recvPct = progress.prepared ? clamp(Math.round(progress.received/progress.prepared*100),0,100) : 0;
    const pct = mode === 'recepcion' ? recvPct : prepPct;
    const items = state.maps.itemsByDispatch.get(txt(dispatch.id)) || [];
    const itemSummary = items.slice(0,3).map((item) => esc(productLabel(item.producto_id)) + ' × ' + esc(item.cantidad_solicitada)).join('<br>') + (items.length>3?'<span class="dspx-sub">+'+(items.length-3)+' producto(s)</span>':'');
    return '<article class="dspx-card">'+
      '<div class="dspx-card-head"><div><h4>'+esc(dispatch.codigo || dispatch.id)+'</h4><p>'+esc(destinationLabel(dispatch))+'</p></div>'+statusBadge(dispatch.estado)+'</div>'+
      '<div class="dspx-meta-grid">'+
        '<div class="dspx-meta"><span>Origen</span><b>'+esc(warehouseLabel(dispatch.almacen_origen_id))+'</b></div>'+
        '<div class="dspx-meta"><span>Tipo</span><b>'+esc(dispatch.tipo_destino || '-')+'</b></div>'+
        '<div class="dspx-meta"><span>Progreso</span><b>'+esc(mode==='recepcion' ? progress.received+' / '+progress.prepared : progress.prepared+' / '+progress.requested)+'</b></div>'+
        '<div class="dspx-meta"><span>Fecha</span><b>'+esc(fmtDate(dispatch.creado_en || dispatch.fecha_solicitud))+'</b></div>'+
      '</div><div class="dspx-progress"><span style="width:'+pct+'%"></span></div>'+
      '<div class="dspx-banner" style="margin-top:12px"><i class="fas fa-boxes-stacked"></i><div>'+itemSummary+'</div></div>'+
      '<div class="dspx-actions"><button class="dspx-btn secondary" data-action="view-history" data-id="'+esc(dispatch.id)+'" type="button"><i class="fas fa-eye"></i> Detalle</button>'+renderStateAction(dispatch,false)+
      '</div></article>';
  }

  function renderPreparation(){
    const rows = state.data.despachos.filter((r) => ['PENDIENTE_PREPARACION','EN_PREPARACION'].includes(txt(r.estado).toUpperCase()));
    return tabPanel('Preparación de almacén','Inicia la preparación, escanea seriales o registra cantidades y cierra cuando esté completa.', rows.length ? '<div class="dspx-grid">'+rows.map((r)=>dispatchCard(r,'preparacion')).join('')+'</div>' : emptyHtml('No hay despachos pendientes de preparación.'));
  }

  function renderExit(){
    const rows = state.data.despachos.filter((r) => txt(r.estado).toUpperCase()==='PREPARADO');
    return tabPanel('Confirmación de salida','Revisa los productos preparados y confirma la salida con entrega inmediata al destino final.', rows.length ? '<div class="dspx-grid">'+rows.map((r)=>dispatchCard(r,'salida')).join('')+'</div>' : emptyHtml('No hay despachos preparados para salir.'));
  }

  function renderReception(){
    const rows = state.data.despachos.filter((r) => ['DESPACHADO','RECIBIDO_PARCIAL','CON_INCIDENCIA'].includes(txt(r.estado).toUpperCase()));
    return tabPanel('Recepción administrativa','La recepción la registra un usuario autorizado. El encargado figura como destinatario, pero no acepta ni rechaza.', rows.length ? '<div class="dspx-grid">'+rows.map((r)=>dispatchCard(r,'recepcion')).join('')+'</div>' : emptyHtml('No hay despachos pendientes de recepción.'));
  }

  function incidentProductLabel(incident){
    const item = state.maps.items.get(txt(incident.despacho_item_id));
    return item ? productLabel(item.producto_id) : '-';
  }

  function incidentSerialLabel(incident){
    if(!incident.serial_id) return '-';
    const equipment = state.maps.equipos.get(txt(incident.serial_id));
    return txt(first(equipment,['serial','codigo'],incident.serial_id));
  }

  function renderIncidents(){
    const rows = state.data.incidencias.slice().sort((a,b)=>String(b.creado_en||'').localeCompare(String(a.creado_en||'')));
    const body = rows.map((incident) => {
      const dispatch = state.maps.despachos.get(txt(incident.despacho_id));
      const stateName = txt(incident.estado).toUpperCase();
      let actions = '<button class="dspx-btn secondary" data-action="view-history" data-id="'+esc(incident.despacho_id)+'" type="button"><i class="fas fa-eye"></i> Despacho</button>';
      if(stateName === 'ABIERTA') actions += '<button class="dspx-btn warning" data-action="incident-review" data-id="'+esc(incident.id)+'" type="button"><i class="fas fa-magnifying-glass"></i> En revisión</button>';
      if(stateName === 'EN_REVISION') actions += '<button class="dspx-btn success" data-action="incident-resolve" data-id="'+esc(incident.id)+'" type="button"><i class="fas fa-check"></i> Resolver</button>';
      return '<tr><td><span class="dspx-code">'+esc(dispatch ? dispatch.codigo : incident.despacho_id)+'</span><span class="dspx-sub">'+esc(fmtDate(incident.creado_en))+'</span></td><td>'+esc(incident.tipo || '-')+'</td><td>'+esc(incidentProductLabel(incident))+'<span class="dspx-sub">'+esc(incidentSerialLabel(incident))+'</span></td><td>'+esc(incident.descripcion || '-')+'</td><td>'+statusBadge(incident.estado)+'</td><td>'+esc(first(incident,['resolucion'],'-'))+'</td><td><div class="dspx-inline">'+actions+'</div></td></tr>';
    }).join('');
    return tabPanel('Incidencias','Seguimiento de faltantes, daños, seriales o cantidades incorrectas.', rows.length ? '<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Despacho</th><th>Tipo</th><th>Producto / serial</th><th>Descripción</th><th>Estado</th><th>Resolución</th><th>Acciones</th></tr></thead><tbody>'+body+'</tbody></table></div>' : emptyHtml('No hay incidencias registradas.'));
  }

  function renderHistory(){
    const body = state.data.despachos.map((dispatch) => {
      const progress = dispatchProgress(dispatch);
      return '<tr><td class="dspx-history-code-cell"><span class="dspx-code">'+esc(dispatch.codigo || dispatch.id)+'</span><span class="dspx-sub">'+esc(fmtDate(dispatch.creado_en || dispatch.fecha_solicitud))+'</span>'+(dispatch.lote_id?'<button class="dspx-lot-ref" data-action="view-batch" data-id="'+esc(dispatch.lote_id)+'" type="button"><i class="fas fa-layer-group"></i> '+esc(lotCode(dispatch.lote_id)||'Ver lote')+'</button>':'')+'</td><td class="dspx-history-type-cell">'+esc(dispatch.tipo_destino || '-')+'</td><td class="dspx-history-destination-cell">'+esc(destinationLabel(dispatch))+'</td><td class="dspx-history-status-cell">'+statusBadge(dispatch.estado)+'</td><td class="dspx-number-cell"><span class="dspx-count">'+esc(progress.requested)+'</span></td><td class="dspx-number-cell"><span class="dspx-count">'+esc(progress.prepared)+'</span></td><td class="dspx-number-cell"><span class="dspx-count dspx-count-success">'+esc(progress.received)+'</span></td><td class="dspx-history-action-cell"><button class="dspx-btn secondary dspx-open-file-btn" data-action="view-history" data-id="'+esc(dispatch.id)+'" type="button"><i class="fas fa-eye"></i><span>Abrir expediente</span></button></td></tr>';
    }).join('');
    return tabPanel('Historial de despachos','Expedientes con artículos, seriales, eventos, movimientos e incidencias.', state.data.despachos.length ? '<div class="dspx-table-wrap dspx-history-wrap"><table class="dspx-table dspx-history-table"><thead><tr><th>Código</th><th>Tipo</th><th>Destino</th><th>Estado</th><th class="dspx-number-heading">Solicitado</th><th class="dspx-number-heading">Preparado</th><th class="dspx-number-heading">Finalizado</th><th class="dspx-action-heading">Acción</th></tr></thead><tbody>'+body+'</tbody></table></div>' : emptyHtml('Todavía no existe historial de despachos.'));
  }

  function tabPanel(title,subtitle,content){
    return '<section class="dispatch-panel"><div class="dispatch-panel-head"><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div></div><div class="dispatch-panel-body">'+content+'</div></section>';
  }

  function emptyHtml(message){
    return '<div class="dspx-empty"><i class="fas fa-box-open"></i>'+esc(message)+'</div>';
  }

  function renderActiveTab(){
    const content = $('dspxContent');
    if(!content) return;
    if(!state.allowed){
      content.innerHTML = '<div class="dspx-restricted"><i class="fas fa-lock"></i><h3>Acceso restringido</h3><p>Tu perfil no tiene permisos para consultar Control de Despachos.</p></div>';
      return;
    }
    const renderers = {
      resumen: renderSummary,
      preparacion: renderPreparation,
      salida: renderExit,
      incidencias: renderIncidents,
      historial: renderHistory
    };
    content.innerHTML = (renderers[state.activeTab] || renderSummary)();
    document.querySelectorAll('#dspxModule [data-dspx-tab]').forEach((button) => button.classList.toggle('active', button.dataset.dspxTab === state.activeTab));
  }

  function renderAll(){
    updateKpis();
    renderActiveTab();
  }

  async function loadAll(options){
    options = options || {};
    if(state.loading) return false;
    const content = $('dspxContent');
    state.loading = true;
    state.client = client();
    if(!state.client){
      state.loading = false;
      state.allowed = false;
      if(content) content.innerHTML = '<div class="dspx-restricted"><i class="fas fa-plug-circle-xmark"></i><h3>Supabase no está disponible</h3><p>Inicia sesión nuevamente para cargar Control de Despachos.</p></div>';
      return false;
    }
    if(!options.silent && content) content.innerHTML = '<div class="dspx-loading"><i class="fas fa-spinner fa-spin"></i>Cargando Control de Despachos...</div>';
    showAlert('');
    try{
      const permissionResult = await callRpc('usuario_puede_ver_inventario',{},'VALIDAR_PERMISO');
      state.allowed = normalizePermission(permissionResult);
      if(!state.allowed){ renderAll(); return false; }

      const results = await Promise.all([
        fetchTable('despachos',(q)=>q.order('creado_en',{ascending:false}).limit(TABLE_LIMITS.despachos),true),
        fetchTable('despacho_items',(q)=>q.order('creado_en',{ascending:true}).limit(TABLE_LIMITS.despacho_items),true),
        fetchTable('despacho_seriales',(q)=>q.order('creado_en',{ascending:true}).limit(TABLE_LIMITS.despacho_seriales),true),
        fetchTable('despacho_eventos',(q)=>q.order('creado_en',{ascending:false}).limit(TABLE_LIMITS.despacho_eventos),true),
        fetchTable('despacho_incidencias',(q)=>q.order('creado_en',{ascending:false}).limit(TABLE_LIMITS.despacho_incidencias),true),
        fetchTable('movimientos_inventario',(q)=>q.order('creado_en',{ascending:false}).limit(TABLE_LIMITS.movimientos_inventario),true),
        fetchTable('equipos_seriales',(q)=>q.eq('activo',true).order('creado_en',{ascending:false}).limit(TABLE_LIMITS.equipos_seriales),true),
        fetchTable('almacenes',(q)=>q.eq('activo',true).order('nombre',{ascending:true}).limit(2000),true),
        fetchTable('productos',(q)=>q.eq('activo',true).order('nombre',{ascending:true}).limit(5000),true),
        fetchTable('agencias',(q)=>q.eq('activo',true).order('numero',{ascending:true}).limit(3000),true),
        fetchTable('grupos',(q)=>q.eq('activo',true).order('nombre',{ascending:true}).limit(1000),true),
        fetchTable('perfiles',(q)=>q.eq('activo',true).limit(2500),false),
        fetchTable('despacho_lotes',(q)=>q.order('creado_en',{ascending:false}).limit(TABLE_LIMITS.despacho_lotes),false)
      ]);

      state.data.despachos = results[0];
      state.data.items = results[1];
      state.data.serialRows = results[2];
      state.data.eventos = results[3];
      state.data.incidencias = results[4];
      state.data.movimientos = results[5];
      state.data.equipos = results[6];
      state.data.almacenes = results[7];
      state.data.productos = results[8];
      state.data.agencias = results[9];
      state.data.grupos = results[10];
      state.data.perfiles = results[11];
      state.data.lotes = results[12];

      rebuildMaps();
      rebuildStockMaps();
      ensureDraft();
      ensureBatchDraft();
      publishWarehouseState();
      renderWarehouseScreen();
      renderAll();
      setupRealtime();
      if(!options.silent) showAlert('Datos actualizados correctamente.','success');
      setTimeout(()=>showAlert(''),2600);
      return true;
    }catch(error){
      state.allowed = false;
      const message = errorText(error,error.step || 'CARGA');
      console.error('[LOTEKA Despachos ' + VERSION + '] Error:',error);
      if(content) content.innerHTML = '<div class="dspx-restricted"><i class="fas fa-circle-exclamation"></i><h3>No se pudo cargar Control de Despachos</h3><p>'+esc(message)+'</p><button class="dspx-btn primary" data-action="reload" type="button" style="margin-top:14px"><i class="fas fa-rotate"></i> Reintentar</button></div>';
      showAlert(message,'error');
      return false;
    }finally{
      state.loading = false;
    }
  }

  function setupRealtime(){
    if(state.channel || !state.client || typeof state.client.channel !== 'function') return;
    try{
      state.channel = state.client.channel('loteka-control-despachos-rpc-v400')
        .on('postgres_changes',{event:'*',schema:'public',table:'despachos'},scheduleRealtimeReload)
        .on('postgres_changes',{event:'*',schema:'public',table:'despacho_eventos'},scheduleRealtimeReload)
        .on('postgres_changes',{event:'*',schema:'public',table:'despacho_incidencias'},scheduleRealtimeReload)
        .on('postgres_changes',{event:'*',schema:'public',table:'despacho_lotes'},scheduleRealtimeReload)
        .subscribe((status)=>console.info('[LOTEKA Despachos ' + VERSION + '] Realtime:',status));
    }catch(error){
      console.warn('[LOTEKA Despachos ' + VERSION + '] Realtime no disponible:',error);
    }
  }

  function scheduleRealtimeReload(){
    clearTimeout(state.realtimeTimer);
    state.realtimeTimer = setTimeout(() => {
      const view = $('vista-control-despachos');
      if(view && !view.classList.contains('hidden')) loadAll({silent:true});
    },900);
  }

  function openTab(tab){
    if(tab === 'nuevo'){
      openNewDispatchModal();
      return;
    }
    if(tab === 'recepcion') tab='historial';
    if(!['resumen','preparacion','salida','incidencias','historial'].includes(tab)) tab='resumen';
    state.activeTab = tab;
    renderAll();
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(_e){}
  }

  function openModal(title, subtitle, html, descriptor){
    const modal = $('dspxModal');
    if(!modal) return;
    $('dspxModalTitle').textContent = title || 'Control de Despachos';
    $('dspxModalSubtitle').textContent = subtitle || '';
    $('dspxModalBody').innerHTML = html || '';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('dspx-modal-open');
    state.modal = Object.assign({busy:false},descriptor||{});
  }

  function draftIsDirty(){
    if(txt(state.creationMode).toLowerCase()==='multiple') return batchDraftIsDirty();
    const draft = ensureDraft();
    return Boolean(draft.warehouseId || draft.agencyId || draft.groupId || txt(draft.reason) || txt(draft.documentReference) || txt(draft.observations) || draft.items.some((row)=>row.productId || txt(row.observations) || num(row.quantity)!==1));
  }

  function closeModal(force){
    if(!force && state.modal && state.modal.busy) return false;
    const modal = $('dspxModal');
    if(modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
    const body = $('dspxModalBody');
    if(body) body.innerHTML='';
    document.body.classList.remove('dspx-modal-open');
    state.modal = null;
    return true;
  }

  function requestCloseModal(){
    if(state.modal && state.modal.busy) return;
    if(state.modal && state.modal.type==='new-dispatch' && draftIsDirty()){
      if(!confirm('Hay información escrita en el nuevo despacho. ¿Cerrar el cuadro y conservar el borrador para después?')) return;
    }
    closeModal(true);
  }

  function renderPreparationModal(dispatchId){
    const dispatch = state.maps.despachos.get(txt(dispatchId));
    if(!dispatch) return;
    const items = state.maps.itemsByDispatch.get(txt(dispatchId)) || [];
    const sections = items.map((item) => {
      const progress = itemProgress(item);
      const serialRows = state.maps.serialsByItem.get(txt(item.id)) || [];
      const serialized = item.requiere_serial === true;
      const serialList = serialRows.length ? '<div class="dspx-serial-list">'+serialRows.map((row) => '<div class="dspx-serial"><div><b>'+esc(serialLabel(row))+'</b><small>'+esc(row.estado || '-')+'</small></div>'+((txt(row.estado).toUpperCase()==='RESERVADO')?'<button class="dspx-btn danger" data-action="remove-serial" data-id="'+esc(row.id)+'" data-dispatch-id="'+esc(dispatchId)+'" type="button"><i class="fas fa-xmark"></i> Retirar</button>':'')+'</div>').join('')+'</div>' : '<div class="dspx-empty" style="padding:18px">Sin seriales preparados.</div>';
      const actionArea = serialized
        ? '<div class="dspx-inline" style="margin-top:12px"><input id="dspxSerialInput_'+esc(item.id)+'" data-role="serial-input" data-item-id="'+esc(item.id)+'" placeholder="Escanea o escribe el serial"><button class="dspx-btn primary" data-action="add-serial" data-item-id="'+esc(item.id)+'" data-dispatch-id="'+esc(dispatchId)+'" type="button"><i class="fas fa-barcode"></i> Agregar serial</button></div>'+serialList
        : '<div class="dspx-inline" style="margin-top:12px"><input id="dspxQtyInput_'+esc(item.id)+'" type="number" min="0.01" step="0.01" value="'+esc(progress.remainingPrep || progress.requested)+'" placeholder="Cantidad a preparar"><button class="dspx-btn primary" data-action="prepare-quantity" data-item-id="'+esc(item.id)+'" data-dispatch-id="'+esc(dispatchId)+'" type="button"><i class="fas fa-box"></i> Registrar cantidad</button></div>';
      return '<section class="dspx-modal-section"><div class="dspx-modal-section-head"><div><h4>'+esc(productLabel(item.producto_id))+'</h4><span class="dspx-sub">'+(serialized?'Producto serializado':'Producto no serializado')+'</span></div><div>'+esc(progress.prepared)+' / '+esc(progress.requested)+'</div></div><div class="dspx-modal-section-body">'+actionArea+'</div></section>';
    }).join('');

    const html = '<div class="dspx-meta-grid" style="margin-bottom:14px"><div class="dspx-meta"><span>Código</span><b>'+esc(dispatch.codigo)+'</b></div><div class="dspx-meta"><span>Destino</span><b>'+esc(destinationLabel(dispatch))+'</b></div><div class="dspx-meta"><span>Estado</span><b>'+esc(dispatch.estado)+'</b></div><div class="dspx-meta"><span>Origen</span><b>'+esc(warehouseLabel(dispatch.almacen_origen_id))+'</b></div></div>'+sections+
      '<div class="dspx-field full"><label>Observación al cerrar preparación</label><textarea id="dspxClosePreparationObs" placeholder="Opcional"></textarea></div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="close-modal" type="button">Cerrar</button><button class="dspx-btn success" data-action="close-preparation" data-id="'+esc(dispatchId)+'" type="button"><i class="fas fa-check"></i> Cerrar preparación</button></div>';
    openModal('Preparación · '+txt(dispatch.codigo),destinationLabel(dispatch),html,{type:'preparation',id:dispatchId});
  }

  function renderPartialModal(dispatchId){
    const dispatch = state.maps.despachos.get(txt(dispatchId));
    if(!dispatch) return;
    const items = state.maps.itemsByDispatch.get(txt(dispatchId)) || [];
    const sections = items.filter((item)=>itemProgress(item).remainingReceive>0).map((item) => {
      const progress = itemProgress(item);
      const serialRows = (state.maps.serialsByItem.get(txt(item.id)) || []).filter((row)=>!row.recibido && ['DESPACHADO','INCIDENCIA'].includes(txt(row.estado).toUpperCase()));
      const checks = item.requiere_serial === true
        ? '<div class="dspx-check-list">'+serialRows.map((row)=>'<label class="dspx-check"><input type="checkbox" data-partial-serial="'+esc(item.id)+'" value="'+esc(serialLabel(row))+'"><span><b>'+esc(serialLabel(row))+'</b><small class="dspx-sub">'+esc(row.estado)+'</small></span></label>').join('')+'</div>'
        : '';
      return '<section class="dspx-modal-section" data-partial-item="'+esc(item.id)+'"><div class="dspx-modal-section-head"><div><h4>'+esc(productLabel(item.producto_id))+'</h4><span class="dspx-sub">Pendiente de recibir: '+esc(progress.remainingReceive)+'</span></div></div><div class="dspx-modal-section-body"><div class="dspx-form-grid"><div class="dspx-field"><label>Cantidad recibida ahora</label><input data-partial-field="quantity" type="number" min="0" max="'+esc(progress.remainingReceive)+'" step="1" value="0"></div><div class="dspx-field"><label>Tipo de incidencia</label><select data-partial-field="incidentType"><option value="FALTANTE">Faltante</option><option value="DAÑADO">Dañado</option><option value="SERIAL_INCORRECTO">Serial incorrecto</option><option value="CANTIDAD_INCORRECTA">Cantidad incorrecta</option><option value="PRODUCTO_INCORRECTO">Producto incorrecto</option><option value="OTRO">Otro</option></select></div><div class="dspx-field full"><label>Descripción de incidencia</label><textarea data-partial-field="incidentDescription" placeholder="Requerida cuando no se recibe la cantidad completa"></textarea></div></div>'+checks+'</div></section>';
    }).join('');
    if(!sections){
      toast('Recepción','Este despacho no tiene cantidades pendientes de recepción.','warning');
      return;
    }
    const html = '<div class="dspx-banner"><i class="fas fa-circle-info"></i><div>Registra lo que realmente llegó. Cuando una cantidad queda pendiente, el sistema creará la incidencia correspondiente.</div></div><form id="dspxPartialReceptionForm" data-dispatch-id="'+esc(dispatchId)+'" style="margin-top:14px">'+sections+'<div class="dspx-field full"><label>Observación general de recepción</label><textarea id="dspxPartialGeneralObs" placeholder="Opcional"></textarea></div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="close-modal" type="button">Cancelar</button><button class="dspx-btn primary" type="submit"><i class="fas fa-clipboard-check"></i> Registrar recepción parcial</button></div></form>';
    openModal('Recepción parcial · '+txt(dispatch.codigo),destinationLabel(dispatch),html,{type:'partial',id:dispatchId});
  }

  function renderFormalAssignmentModal(groupId){
    const group = state.maps.grupos.get(txt(groupId));
    if(!group) return;
    const html = '<div class="dspx-banner"><i class="fas fa-user-shield"></i><div>Esta acción solo vincula formalmente un perfil al grupo. El encargado no confirma la recepción.</div></div><form id="dspxFormalAssignmentForm" data-group-id="'+esc(groupId)+'" style="margin-top:14px"><div class="dspx-form-grid"><div class="dspx-field span-2"><label>Perfil del encargado</label><select id="dspxFormalProfile" required>'+profileOptions(group.encargado_id)+'</select></div><div class="dspx-field full"><label>Motivo</label><textarea id="dspxFormalReason" required>Vinculación formal para el flujo de despachos.</textarea></div></div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="close-modal" type="button">Cancelar</button><button class="dspx-btn primary" type="submit"><i class="fas fa-link"></i> Vincular perfil</button></div></form>';
    openModal('Encargado formal · '+groupLabel(groupId),'Vinculación administrativa del grupo',html,{type:'formal',id:groupId});
  }

  function renderIncidentActionModal(incidentId,newState){
    const incident = state.data.incidencias.find((row)=>txt(row.id)===txt(incidentId));
    if(!incident) return;
    const dispatch = state.maps.despachos.get(txt(incident.despacho_id));
    const title = newState === 'RESUELTA' ? 'Resolver incidencia' : 'Pasar incidencia a revisión';
    const html = '<div class="dspx-banner"><i class="fas fa-triangle-exclamation"></i><div><b>'+esc(incident.tipo)+'</b><br>'+esc(incident.descripcion)+'</div></div><form id="dspxIncidentActionForm" data-incident-id="'+esc(incidentId)+'" data-new-state="'+esc(newState)+'" style="margin-top:14px"><div class="dspx-field full"><label>'+(newState==='RESUELTA'?'Resolución final':'Comentario de revisión')+'</label><textarea id="dspxIncidentResolution" required placeholder="Describe la gestión realizada"></textarea></div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="close-modal" type="button">Cancelar</button><button class="dspx-btn '+(newState==='RESUELTA'?'success':'warning')+'" type="submit"><i class="fas '+(newState==='RESUELTA'?'fa-check':'fa-magnifying-glass')+'"></i> Confirmar</button></div></form>';
    openModal(title,dispatch ? txt(dispatch.codigo) : txt(incident.despacho_id),html,{type:'incident',id:incidentId});
  }

  function renderBatchResultModal(rows){
    const results = arr(rows);
    if(!results.length) return;
    state.lastBatchResult = results;
    const firstResult = results[0];
    const list = results.map((row)=>'<div class="dspx-batch-result-item"><span><b>'+esc(row.despacho_codigo||row.despacho_id)+'</b><small class="dspx-sub">'+esc(agencyLabel(row.agencia_id))+'</small></span>'+statusBadge(row.estado)+'</div>').join('');
    const html = '<div class="dspx-batch-result-hero"><i class="fas fa-circle-check"></i><h3>'+esc(firstResult.lote_codigo||'Lote creado')+'</h3><p>'+esc(results.length)+' despachos independientes creados correctamente</p></div><div class="dspx-batch-result-list">'+list+'</div><div class="dspx-actions"><button class="dspx-btn secondary" data-action="view-batch" data-id="'+esc(firstResult.lote_id)+'" type="button"><i class="fas fa-layer-group"></i> Ver lote</button><button class="dspx-btn primary" data-action="batch-go-preparation" type="button"><i class="fas fa-box-open"></i> Ir a Preparación</button><button class="dspx-btn secondary" data-action="close-modal" type="button">Cerrar</button></div>';
    openModal('Lote creado correctamente','Todos los despachos quedaron pendientes de preparación.',html,{type:'batch-result',id:firstResult.lote_id,busy:false});
  }

  function renderBatchLotModal(loteId){
    const lot = state.maps.lotes && state.maps.lotes.get(txt(loteId));
    const children = (state.maps.dispatchesByLot && state.maps.dispatchesByLot.get(txt(loteId)) || []).slice().sort((a,b)=>txt(a.codigo).localeCompare(txt(b.codigo)));
    if(!lot && !children.length){ toast('Lote no disponible','No se encontró información del lote seleccionado.','warning'); return; }
    const code = txt(lot && lot.codigo) || lotCode(loteId) || 'Lote de despachos';
    const totalUnits = children.reduce((sum,row)=>sum+dispatchProgress(row).requested,0);
    const rows = children.map((dispatch)=>'<tr><td><span class="dspx-code">'+esc(dispatch.codigo||dispatch.id)+'</span><span class="dspx-sub">'+esc(fmtDate(dispatch.creado_en||dispatch.fecha_solicitud))+'</span></td><td>'+esc(destinationLabel(dispatch))+'</td><td>'+statusBadge(dispatch.estado)+'</td><td class="dspx-number-cell"><span class="dspx-count">'+esc(dispatchProgress(dispatch).requested)+'</span></td><td><button class="dspx-btn secondary" data-action="view-history" data-id="'+esc(dispatch.id)+'" type="button"><i class="fas fa-eye"></i> Expediente</button></td></tr>').join('');
    const html = '<div class="dspx-meta-grid"><div class="dspx-meta"><span>Código</span><b>'+esc(code)+'</b></div><div class="dspx-meta"><span>Estado general</span><b>'+esc(lotStatus(children))+'</b></div><div class="dspx-meta"><span>Agencias</span><b>'+esc(children.length || first(lot,['cantidad_destinos'],0))+'</b></div><div class="dspx-meta"><span>Unidades solicitadas</span><b>'+esc(totalUnits)+'</b></div><div class="dspx-meta"><span>Almacén</span><b>'+esc(warehouseLabel(first(lot,['almacen_origen_id'],children[0]&&children[0].almacen_origen_id)))+'</b></div><div class="dspx-meta"><span>Distribución</span><b>'+esc(first(lot,['tipo_distribucion'],'-'))+'</b></div><div class="dspx-meta"><span>Creado por</span><b>'+esc(first(lot,['creado_por_nombre'],'-'))+'</b></div><div class="dspx-meta"><span>Fecha</span><b>'+esc(fmtDate(first(lot,['creado_en'])))+'</b></div></div><section class="dspx-modal-section" style="margin-top:14px"><div class="dspx-modal-section-head"><div><h4>Despachos del lote</h4><span class="dspx-sub">Cada agencia avanza de manera independiente.</span></div></div><div class="dspx-modal-section-body">'+(children.length?'<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Despacho</th><th>Agencia</th><th>Estado</th><th>Unidades</th><th>Acción</th></tr></thead><tbody>'+rows+'</tbody></table></div>':emptyHtml('Este lote todavía no tiene despachos visibles.'))+'</div></section><div class="dspx-actions"><button class="dspx-btn primary" data-action="batch-go-preparation" type="button"><i class="fas fa-box-open"></i> Ir a Preparación</button><button class="dspx-btn secondary" data-action="close-modal" type="button">Cerrar</button></div>';
    openModal('Lote · '+code,txt(first(lot,['descripcion','motivo'],'Seguimiento de despachos múltiples')),html,{type:'batch',id:loteId,busy:false});
  }

  function renderHistoryModal(dispatchId){
    const dispatch = state.maps.despachos.get(txt(dispatchId));
    if(!dispatch) return;
    const items = state.maps.itemsByDispatch.get(txt(dispatchId)) || [];
    const serialRows = items.flatMap((item)=>state.maps.serialsByItem.get(txt(item.id)) || []);
    const events = (state.maps.eventosByDispatch.get(txt(dispatchId)) || []).slice().sort((a,b)=>String(a.creado_en||'').localeCompare(String(b.creado_en||'')));
    const movements = (state.maps.movimientosByDispatch.get(txt(dispatchId)) || []).slice().sort((a,b)=>String(a.creado_en||'').localeCompare(String(b.creado_en||'')));
    const incidents = (state.maps.incidenciasByDispatch.get(txt(dispatchId)) || []).slice().sort((a,b)=>String(a.creado_en||'').localeCompare(String(b.creado_en||'')));

    const itemRows = items.map((item)=>'<tr><td>'+esc(productLabel(item.producto_id))+'</td><td>'+esc(item.cantidad_solicitada)+'</td><td>'+esc(item.cantidad_preparada)+'</td><td>'+esc(item.cantidad_recibida)+'</td><td>'+(item.requiere_serial?'Sí':'No')+'</td><td>'+esc(item.observaciones||'-')+'</td></tr>').join('');
    const serialBody = serialRows.map((row)=>'<tr><td>'+esc(serialLabel(row))+'</td><td>'+esc(row.estado||'-')+'</td><td>'+esc(row.preparado_por_nombre||'-')+'</td><td>'+esc(row.recibido_por_nombre||'-')+'</td><td>'+esc(fmtDate(row.fecha_reserva))+'</td><td>'+esc(fmtDate(row.fecha_recepcion))+'</td></tr>').join('');
    const eventHtml = events.length ? '<div class="dspx-timeline">'+events.map((event)=>'<div class="dspx-event"><div class="dspx-event-icon"><i class="fas fa-clock-rotate-left"></i></div><div class="dspx-event-body"><b>'+esc(event.tipo_evento||'EVENTO')+'</b><p>'+esc(event.descripcion||'-')+'</p><small>'+esc(event.usuario_nombre||'Sistema')+' · '+esc(fmtDate(event.creado_en))+(event.estado_anterior||event.estado_nuevo?' · '+esc(event.estado_anterior||'-')+' → '+esc(event.estado_nuevo||'-'):'')+'</small></div></div>').join('')+'</div>' : emptyHtml('Sin eventos registrados.');
    const movementRows = movements.map((movement)=>'<tr><td>'+esc(movement.tipo_movimiento||movement.tipo||'-')+'</td><td>'+esc(productLabel(movement.producto_id))+'</td><td>'+esc(movement.serial_id ? first(state.maps.equipos.get(txt(movement.serial_id)),['serial','codigo'],movement.serial_id) : '-')+'</td><td>'+esc(first(movement,['origen_nombre','origen_tipo'],'-'))+'</td><td>'+esc(first(movement,['destino_nombre','destino_tipo'],'-'))+'</td><td>'+esc(movement.estado_anterior||'-')+' → '+esc(movement.estado_nuevo||'-')+'</td><td>'+esc(movement.usuario_nombre||movement.creado_por_nombre||'-')+'</td><td>'+esc(fmtDate(movement.creado_en))+'</td></tr>').join('');
    const incidentRows = incidents.map((incident)=>'<tr><td>'+esc(incident.tipo||'-')+'</td><td>'+esc(incident.descripcion||'-')+'</td><td>'+statusBadge(incident.estado)+'</td><td>'+esc(incident.reportado_por_nombre||'-')+'</td><td>'+esc(first(incident,['resolucion'],'-'))+'</td><td>'+esc(incident.resuelto_por_nombre||'-')+'</td></tr>').join('');

    const lotReference = dispatch.lote_id ? '<div class="dspx-banner" style="margin-bottom:14px"><i class="fas fa-layer-group"></i><div>Este despacho pertenece al lote <button class="dspx-lot-ref" data-action="view-batch" data-id="'+esc(dispatch.lote_id)+'" type="button">'+esc(lotCode(dispatch.lote_id)||'Ver lote')+'</button>.</div></div>' : '';
    const html = lotReference + '<div class="dspx-meta-grid"><div class="dspx-meta"><span>Estado</span><b>'+esc(dispatch.estado)+'</b></div><div class="dspx-meta"><span>Origen</span><b>'+esc(warehouseLabel(dispatch.almacen_origen_id))+'</b></div><div class="dspx-meta"><span>Destino</span><b>'+esc(destinationLabel(dispatch))+'</b></div><div class="dspx-meta"><span>Documento</span><b>'+esc(dispatch.documento_referencia||'-')+'</b></div><div class="dspx-meta"><span>Solicitado por</span><b>'+esc(dispatch.solicitado_por_nombre||'-')+'</b></div><div class="dspx-meta"><span>Preparado por</span><b>'+esc(dispatch.preparado_por_nombre||'-')+'</b></div><div class="dspx-meta"><span>Confirmado por</span><b>'+esc(dispatch.confirmado_por_nombre||'-')+'</b></div><div class="dspx-meta"><span>Recibido por</span><b>'+esc(dispatch.recibido_por_nombre||'-')+'</b></div></div>'+
      '<section class="dspx-modal-section" style="margin-top:14px"><div class="dspx-modal-section-head"><h4>Artículos</h4></div><div class="dspx-modal-section-body"><div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Producto</th><th>Solicitado</th><th>Preparado</th><th>Entregado</th><th>Serial</th><th>Observación</th></tr></thead><tbody>'+itemRows+'</tbody></table></div></div></section>'+
      '<section class="dspx-modal-section"><div class="dspx-modal-section-head"><h4>Seriales</h4></div><div class="dspx-modal-section-body">'+(serialRows.length?'<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Serial</th><th>Estado</th><th>Preparado por</th><th>Recibido por</th><th>Reserva</th><th>Recepción</th></tr></thead><tbody>'+serialBody+'</tbody></table></div>':emptyHtml('Este despacho no tiene seriales asociados.'))+'</div></section>'+
      '<section class="dspx-modal-section"><div class="dspx-modal-section-head"><h4>Eventos</h4></div><div class="dspx-modal-section-body">'+eventHtml+'</div></section>'+
      '<section class="dspx-modal-section"><div class="dspx-modal-section-head"><h4>Movimientos de inventario</h4></div><div class="dspx-modal-section-body">'+(movements.length?'<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Tipo</th><th>Producto</th><th>Serial</th><th>Origen</th><th>Destino</th><th>Estado</th><th>Usuario</th><th>Fecha</th></tr></thead><tbody>'+movementRows+'</tbody></table></div>':emptyHtml('Sin movimientos asociados.'))+'</div></section>'+
      '<section class="dspx-modal-section"><div class="dspx-modal-section-head"><h4>Incidencias</h4></div><div class="dspx-modal-section-body">'+(incidents.length?'<div class="dspx-table-wrap"><table class="dspx-table"><thead><tr><th>Tipo</th><th>Descripción</th><th>Estado</th><th>Reportado por</th><th>Resolución</th><th>Resuelto por</th></tr></thead><tbody>'+incidentRows+'</tbody></table></div>':emptyHtml('Sin incidencias asociadas.'))+'</div></section>';
    openModal('Expediente · '+txt(dispatch.codigo),destinationLabel(dispatch),html,{type:'history',id:dispatchId});
  }

  async function reloadAndRestoreModal(descriptor){
    await loadAll({silent:true});
    if(!descriptor) return;
    if(descriptor.type === 'preparation') renderPreparationModal(descriptor.id);
    if(descriptor.type === 'partial') renderPartialModal(descriptor.id);
    if(descriptor.type === 'history') renderHistoryModal(descriptor.id);
  }

  async function handleAction(button, action){
    const id = txt(button.dataset.id);
    try{
      if(action === 'reload'){
        await withBusy(button,'Actualizando',()=>loadAll({silent:false}));
        return;
      }
      if(action === 'set-dispatch-creation-mode'){
        const mode = txt(button.dataset.mode).toLowerCase();
        if(!['individual','multiple'].includes(mode)) return;
        state.creationMode = mode;
        refreshNewDispatchModal();
        return;
      }
      if(action === 'batch-add-agency'){
        const draft = ensureBatchDraft();
        const agencyId = txt(button.dataset.agencyId);
        if(!uuid(agencyId) || !state.maps.agencias.has(agencyId)){ toast('Agencia inválida','La agencia ya no está disponible.','warning'); return; }
        if(draft.selectedAgencyIds.includes(agencyId)){ toast('Agencia repetida','Esa agencia ya está dentro del lote.','warning'); return; }
        draft.selectedAgencyIds.push(agencyId);
        ensureBatchAgencyItems(agencyId);
        draft.agencySearch='';
        refreshNewDispatchModal();
        return;
      }
      if(action === 'batch-remove-agency'){
        const draft = ensureBatchDraft();
        const agencyId = txt(button.dataset.agencyId);
        draft.selectedAgencyIds = draft.selectedAgencyIds.filter((id)=>txt(id)!==agencyId);
        delete draft.agencyItems[agencyId];
        refreshNewDispatchModal();
        return;
      }
      if(action === 'batch-add-item'){
        const scope = txt(button.dataset.scope) || 'shared';
        batchScopeItems(scope).push(newBatchItem());
        refreshNewDispatchModal();
        return;
      }
      if(action === 'batch-remove-item'){
        const scope = txt(button.dataset.scope) || 'shared';
        const items = batchScopeItems(scope);
        if(items.length<=1){ toast('Productos','Cada despacho debe conservar al menos un producto.','warning'); return; }
        const next = items.filter((row)=>row.key!==txt(button.dataset.key));
        const draft = ensureBatchDraft();
        if(scope==='shared') draft.sharedItems=next; else draft.agencyItems[scope]=next;
        refreshNewDispatchModal();
        return;
      }
      if(action === 'reset-batch'){
        if(confirm('¿Limpiar por completo el lote de despachos?')){ resetBatchDraft(); refreshNewDispatchModal(); }
        return;
      }
      if(action === 'view-batch'){
        renderBatchLotModal(id);
        return;
      }
      if(action === 'batch-go-preparation'){
        closeModal(true);
        state.activeTab='preparacion';
        renderAll();
        return;
      }
      if(action === 'add-draft-item'){
        ensureDraft().items.push({key:nowKey(),productId:'',quantity:1,observations:'',serialMode:'preparacion',serials:[]});
        refreshNewDispatchModal(); return;
      }
      if(action === 'remove-draft-item'){
        const draft=ensureDraft();
        if(draft.items.length<=1){ toast('Productos','El despacho debe conservar al menos un producto.','warning'); return; }
        draft.items=draft.items.filter((row)=>row.key!==button.dataset.key); refreshNewDispatchModal(); return;
      }
      if(action === 'reset-draft'){
        if(confirm('¿Limpiar el formulario del nuevo despacho?')){ resetDraft(); refreshNewDispatchModal(); }
        return;
      }
      if(action === 'close-modal'){ requestCloseModal(); return; }
      if(action === 'view-history'){ renderHistoryModal(id); return; }
      if(action === 'open-preparation'){ renderPreparationModal(id); return; }
      if(action === 'open-partial'){ toast('Recepción histórica','La recepción manual está deshabilitada para el flujo nuevo.','info'); return; }
      if(action === 'open-formal-assignment'){ renderFormalAssignmentModal(button.dataset.groupId); return; }
      if(action === 'incident-review'){ renderIncidentActionModal(id,'EN_REVISION'); return; }
      if(action === 'incident-resolve'){ renderIncidentActionModal(id,'RESUELTA'); return; }

      if(action === 'start-preparation'){
        await withBusy(button,'Iniciando',async()=>{
          await callRpc('rpc_iniciar_preparacion_despacho',{p_despacho_id:id},'INICIAR_PREPARACION');
          toast('Preparación iniciada','El despacho pasó a EN_PREPARACION.','success');
          await loadAll({silent:true});
          renderPreparationModal(id);
        });
        return;
      }

      if(action === 'add-serial'){
        const itemId = txt(button.dataset.itemId);
        const input = $('dspxSerialInput_'+itemId);
        const serial = txt(input && input.value).toUpperCase();
        if(!serial){ toast('Serial requerido','Escanea o escribe el serial.','warning'); return; }
        await withBusy(button,'Agregando',async()=>{
          await callRpc('rpc_agregar_serial_despacho',{p_despacho_item_id:itemId,p_serial:serial,p_observaciones:'Serial agregado desde Control de Despachos web.'},'AGREGAR_SERIAL');
          toast('Serial agregado',serial+' quedó reservado para el despacho.','success');
          await reloadAndRestoreModal({type:'preparation',id:button.dataset.dispatchId});
        });
        return;
      }

      if(action === 'remove-serial'){
        const reason = prompt('Motivo para retirar el serial de la preparación:','Retirado durante preparación.');
        if(reason === null) return;
        await withBusy(button,'Retirando',async()=>{
          await callRpc('rpc_retirar_serial_despacho',{p_despacho_serial_id:id,p_motivo:txt(reason)||'Retirado durante preparación.'},'RETIRAR_SERIAL');
          toast('Serial retirado','El serial fue liberado correctamente.','success');
          await reloadAndRestoreModal({type:'preparation',id:button.dataset.dispatchId});
        });
        return;
      }

      if(action === 'prepare-quantity'){
        const itemId = txt(button.dataset.itemId);
        const input = $('dspxQtyInput_'+itemId);
        const quantity = num(input && input.value);
        if(quantity<=0){ toast('Cantidad inválida','Escribe una cantidad mayor que cero.','warning'); return; }
        await withBusy(button,'Registrando',async()=>{
          await callRpc('rpc_preparar_cantidad_despacho',{p_despacho_item_id:itemId,p_cantidad:quantity},'PREPARAR_CANTIDAD');
          toast('Cantidad registrada','La preparación fue actualizada.','success');
          await reloadAndRestoreModal({type:'preparation',id:button.dataset.dispatchId});
        });
        return;
      }

      if(action === 'close-preparation'){
        const observation = txt($('dspxClosePreparationObs') && $('dspxClosePreparationObs').value);
        await withBusy(button,'Cerrando',async()=>{
          await callRpc('rpc_cerrar_preparacion_despacho',{p_despacho_id:id,p_observaciones:observation||null},'CERRAR_PREPARACION');
          closeModal();
          toast('Preparación cerrada','El despacho está PREPARADO para confirmar su salida.','success');
          state.activeTab='salida';
          await loadAll({silent:true});
        });
        return;
      }

      if(action === 'confirm-exit'){
        if(typeof window.lotekaOpenDirectExitV603 === 'function'){
          window.lotekaOpenDirectExitV603(id);
        }else{
          toast('Entrega directa','Actualiza el sistema e instala la migración V603.','warning');
        }
        return;
      }

      if(action === 'receive-complete'){
        toast('Recepción histórica','La recepción manual está deshabilitada. Los despachos nuevos finalizan al confirmar la salida.','info');
        return;
      }
    }catch(error){
      console.error('[LOTEKA Despachos '+VERSION+'] Acción fallida:',action,error);
      const message = errorText(error,error.step || action.toUpperCase());
      showAlert(message,'error');
      toast('No se pudo completar',message,'error');
    }
  }

  async function submitNewDispatch(form, submitButton){
    const draft = ensureDraft();
    const type = txt(draft.type).toUpperCase();
    const items = draft.items.map((row)=>({producto_id:txt(row.productId),cantidad:num(row.quantity),observaciones:txt(row.observations)||null}));
    if(!draft.warehouseId) throw {message:'Selecciona el almacén de origen.'};
    if(!['AGENCIA','GRUPO','ENCARGADO'].includes(type)) throw {message:'Selecciona un tipo de destino válido.'};
    if(type==='AGENCIA' && !draft.agencyId) throw {message:'Selecciona la agencia destino.'};
    if(['GRUPO','ENCARGADO'].includes(type) && !draft.groupId) throw {message:'Selecciona el grupo destino.'};
    if(!txt(draft.reason)) throw {message:'Escribe el motivo del despacho.'};
    if(!items.length || items.some((row)=>!row.producto_id || row.cantidad<=0 || !Number.isInteger(row.cantidad))) throw {message:'Completa todos los productos con cantidades enteras mayores que cero.'};
    const unique = new Set(items.map((row)=>row.producto_id));
    if(unique.size !== items.length) throw {message:'No repitas el mismo producto en un despacho. Ajusta la cantidad en una sola fila.'};
    for(const row of items){
      const product = state.maps.productos.get(txt(row.producto_id));
      const stock = availableStock(draft.warehouseId,row.producto_id);
      if(!product || stock<=0) throw {message:'El producto '+productLabel(row.producto_id)+' ya no tiene existencia disponible en el almacén seleccionado.'};
      if(row.cantidad>stock) throw {message:'La cantidad de '+productLabel(row.producto_id)+' supera la existencia disponible ('+stock+').'};
    }

    let responsibleId = null;
    if(type==='ENCARGADO'){
      const group = state.maps.grupos.get(txt(draft.groupId));
      responsibleId = txt(group && group.encargado_id);
      if(!uuid(responsibleId)) throw {message:'El grupo seleccionado no tiene un encargado formal vinculado.'};
    }

    await withBusy(submitButton,'Creando',async()=>{
      const data = await callRpc('rpc_crear_despacho',{
        p_tipo_destino:type,
        p_almacen_origen_id:draft.warehouseId,
        p_agencia_destino_id:type==='AGENCIA'?draft.agencyId:null,
        p_grupo_destino_id:['GRUPO','ENCARGADO'].includes(type)?draft.groupId:null,
        p_responsable_destino_id:type==='ENCARGADO'?responsibleId:null,
        p_motivo:txt(draft.reason),
        p_observaciones:txt(draft.observations)||null,
        p_documento_referencia:txt(draft.documentReference)||null,
        p_items:items
      },'CREAR_DESPACHO');
      const result = Array.isArray(data) ? data[0] : data;
      toast('Despacho creado',(result && result.codigo ? result.codigo : 'El despacho')+' quedó pendiente de preparación.','success');
      closeModal(true);
      resetDraft();
      state.activeTab='preparacion';
      await loadAll({silent:true});
    });
  }

  async function submitBatchDispatch(form, submitButton){
    const draft = ensureBatchDraft();
    const destinations = validateBatchDraft(draft);
    await withBusy(submitButton,'Creando lote',async()=>{
      const data = await callRpc('rpc_crear_lote_despachos_agencias',{
        p_almacen_origen_id:draft.warehouseId,
        p_tipo_distribucion:txt(draft.distribution).toUpperCase(),
        p_motivo:txt(draft.reason),
        p_observaciones:txt(draft.observations)||null,
        p_documento_referencia:txt(draft.documentReference)||null,
        p_descripcion:txt(draft.description)||null,
        p_destinos:destinations
      },'CREAR_LOTE_DESPACHOS');
      const rows = arr(data);
      if(!rows.length) throw {message:'La RPC no devolvió los despachos creados.'};
      closeModal(true);
      resetBatchDraft();
      await loadAll({silent:true});
      renderBatchResultModal(rows);
      toast('Lote creado',(rows[0].lote_codigo||'El lote')+' creó '+rows.length+' despachos independientes.','success');
    });
  }

  async function submitPartialReception(form, submitButton){
    const dispatchId = txt(form.dataset.dispatchId);
    const dispatch = state.maps.despachos.get(dispatchId);
    if(!dispatch) throw {message:'No se encontró el despacho.'};
    const payloadItems = [];
    const sections = Array.from(form.querySelectorAll('[data-partial-item]'));
    for(const section of sections){
      const itemId = txt(section.dataset.partialItem);
      const item = state.maps.items.get(itemId);
      if(!item) continue;
      const progress = itemProgress(item);
      const quantity = num(section.querySelector('[data-partial-field="quantity"]')?.value);
      const type = txt(section.querySelector('[data-partial-field="incidentType"]')?.value) || 'FALTANTE';
      const description = txt(section.querySelector('[data-partial-field="incidentDescription"]')?.value);
      const serials = Array.from(section.querySelectorAll('[data-partial-serial]:checked')).map((input)=>txt(input.value)).filter(Boolean);
      if(quantity < 0 || quantity > progress.remainingReceive) throw {message:'La cantidad recibida de '+productLabel(item.producto_id)+' no es válida.'};
      if(item.requiere_serial === true && serials.length !== quantity) throw {message:'En '+productLabel(item.producto_id)+' la cantidad recibida debe coincidir con los seriales seleccionados.'};
      if(quantity < progress.remainingReceive && !description) throw {message:'Describe la incidencia de '+productLabel(item.producto_id)+'.'};
      payloadItems.push({
        despacho_item_id:itemId,
        cantidad_recibida:quantity,
        seriales:serials,
        tipo_incidencia:quantity < progress.remainingReceive ? type : null,
        descripcion_incidencia:quantity < progress.remainingReceive ? description : null
      });
    }
    if(!payloadItems.length || !payloadItems.some((row)=>row.cantidad_recibida>0 || txt(row.descripcion_incidencia))) throw {message:'Registra al menos una cantidad recibida o una incidencia documentada.'};
    const observation = txt($('dspxPartialGeneralObs') && $('dspxPartialGeneralObs').value);
    await withBusy(submitButton,'Registrando',async()=>{
      await callRpc('rpc_recibir_despacho_parcial',{p_despacho_id:dispatchId,p_items:payloadItems,p_observaciones:observation||null},'RECIBIR_PARCIAL');
      closeModal();
      toast('Recepción registrada','El despacho y sus incidencias fueron actualizados.','success');
      state.activeTab='incidencias';
      await loadAll({silent:true});
    });
  }

  async function submitFormalAssignment(form, submitButton){
    const groupId = txt(form.dataset.groupId);
    const profileId = txt($('dspxFormalProfile') && $('dspxFormalProfile').value);
    const reason = txt($('dspxFormalReason') && $('dspxFormalReason').value);
    if(!uuid(groupId) || !uuid(profileId)) throw {message:'Selecciona un grupo y un perfil válidos.'};
    if(!reason) throw {message:'Escribe el motivo de la vinculación.'};
    await withBusy(submitButton,'Vinculando',async()=>{
      await callRpc('rpc_asignar_encargado_grupo',{p_grupo_id:groupId,p_encargado_id:profileId,p_motivo:reason},'ASIGNAR_ENCARGADO');
      closeModal();
      toast('Encargado vinculado',profileLabel(profileId)+' quedó asignado formalmente al grupo.','success');
      await loadAll({silent:true});
      state.activeTab='nuevo';
      renderAll();
    });
  }

  async function submitIncidentAction(form, submitButton){
    const incidentId = txt(form.dataset.incidentId);
    const newState = txt(form.dataset.newState).toUpperCase();
    const resolution = txt($('dspxIncidentResolution') && $('dspxIncidentResolution').value);
    if(!resolution) throw {message:'Escribe el comentario o la resolución.'};
    await withBusy(submitButton,'Actualizando',async()=>{
      await callRpc('rpc_cambiar_estado_incidencia_despacho',{p_incidencia_id:incidentId,p_nuevo_estado:newState,p_resolucion:resolution},'CAMBIAR_INCIDENCIA');
      closeModal();
      toast('Incidencia actualizada','Nuevo estado: '+newState+'.','success');
      await loadAll({silent:true});
    });
  }

  function updateBatchDraftFromElement(element){
    const draft = ensureBatchDraft();
    const field = element.dataset.batchField;
    if(field){
      const previous = draft[field];
      draft[field] = element.value;
      if(field==='agencySearch'){
        renderBatchAgencyResults();
        return;
      }
      if(field==='warehouseId' && txt(previous)!==txt(draft.warehouseId)){
        const hadProducts = draft.sharedItems.some((item)=>item.productId) || Object.values(draft.agencyItems).some((items)=>arr(items).some((item)=>item.productId));
        draft.sharedItems=[newBatchItem()];
        Object.keys(draft.agencyItems).forEach((agencyId)=>{ draft.agencyItems[agencyId]=[newBatchItem()]; });
        if(hadProducts) toast('Almacén actualizado','Se limpiaron los productos del lote para evitar inconsistencias.','warning');
        refreshNewDispatchModal();
        return;
      }
      if(field==='distribution'){
        draft.distribution=txt(element.value).toUpperCase();
        refreshNewDispatchModal();
      }
      return;
    }
    const itemField = element.dataset.batchItemField;
    if(itemField){
      const scope = txt(element.dataset.scope)||'shared';
      const key = txt(element.dataset.key);
      const item = batchScopeItems(scope).find((row)=>row.key===key);
      if(!item) return;
      if(itemField==='quantity') item.quantity=Math.max(1,Math.floor(num(element.value)||1));
      else item[itemField]=element.value;
      if(itemField==='productId'){
        item.quantity=1;
        refreshNewDispatchModal();
      }
    }
  }

  function updateDraftFromElement(element){
    const draft = ensureDraft();
    const field = element.dataset.draftField;
    if(field){
      const previous = draft[field];
      draft[field] = element.value;
      if(field === 'warehouseId' && txt(previous)!==txt(draft.warehouseId)){
        const hadProducts = draft.items.some((item)=>item.productId);
        draft.items = [{key:nowKey(),productId:'',quantity:1,observations:'',serialMode:'preparacion',serials:[]}];
        if(hadProducts) toast('Almacén actualizado','Se limpiaron los productos del almacén anterior para evitar inconsistencias.','warning');
      }
      if(field === 'type'){
        draft.agencyId='';
        draft.groupId='';
      }
      refreshNewDispatchModal();
      return;
    }
    const itemField = element.dataset.draftItemField;
    if(itemField){
      const row = element.closest('[data-draft-item]');
      const item = draft.items.find((entry)=>entry.key===row?.dataset.draftItem);
      if(!item) return;
      if(itemField==='quantity'){
        item.quantity = Math.max(1,Math.floor(num(element.value)||1));
      }else{
        item[itemField] = element.value;
      }
      if(itemField==='productId'){
        item.quantity=1;
        item.serialMode='preparacion';
        item.serials=[];
        refreshNewDispatchModal();
      }
    }
  }

  async function handleSubmit(event){
    const form = event.target;
    if(!form || !form.id) return;
    if(!['dspxNewDispatchForm','dspxBatchDispatchForm','dspxPartialReceptionForm','dspxFormalAssignmentForm','dspxIncidentActionForm'].includes(form.id)) return;
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    try{
      if(form.id==='dspxNewDispatchForm') await submitNewDispatch(form,submitButton);
      if(form.id==='dspxBatchDispatchForm') await submitBatchDispatch(form,submitButton);
      if(form.id==='dspxPartialReceptionForm') await submitPartialReception(form,submitButton);
      if(form.id==='dspxFormalAssignmentForm') await submitFormalAssignment(form,submitButton);
      if(form.id==='dspxIncidentActionForm') await submitIncidentAction(form,submitButton);
    }catch(error){
      console.error('[LOTEKA Despachos '+VERSION+'] Formulario falló:',error);
      const message = errorText(error,error.step || 'FORMULARIO');
      showAlert(message,'error');
      toast('No se pudo completar',message,'error');
    }
  }

  function bind(){
    if(state.bound) return;
    const root = $('dspxModule');
    if(!root) return;
    state.bound = true;
    root.addEventListener('click',(event)=>{
      const tabButton = event.target.closest('[data-dspx-tab]');
      if(tabButton){ event.preventDefault(); openTab(tabButton.dataset.dspxTab); return; }
      const button = event.target.closest('[data-action]');
      if(button){ event.preventDefault(); handleAction(button,button.dataset.action); }
    });
    root.addEventListener('input',(event)=>{
      const element = event.target;
      if(element.matches('[data-batch-field],[data-batch-item-field]')) updateBatchDraftFromElement(element);
      else if(element.matches('[data-draft-field],[data-draft-item-field]')) updateDraftFromElement(element);
    });
    root.addEventListener('change',(event)=>{
      const element = event.target;
      if(element.matches('[data-batch-field],[data-batch-item-field]')) updateBatchDraftFromElement(element);
      else if(element.matches('[data-draft-field],[data-draft-item-field]')) updateDraftFromElement(element);
    });
    root.addEventListener('submit',handleSubmit);
    root.addEventListener('keydown',(event)=>{
      const agencySearch = event.target.closest('[data-batch-field="agencySearch"]');
      if(agencySearch && event.key === 'Enter'){
        event.preventDefault();
        const firstResult = root.querySelector('[data-action="batch-add-agency"]');
        if(firstResult) firstResult.click();
        return;
      }
      const input = event.target.closest('[data-role="serial-input"]');
      if(input && event.key === 'Enter'){
        event.preventDefault();
        const button = root.querySelector('[data-action="add-serial"][data-item-id="'+CSS.escape(input.dataset.itemId)+'"]');
        if(button) button.click();
      }
      if(event.key === 'Escape' && $('dspxModal')?.classList.contains('show')) requestCloseModal();
    });
    const modal = $('dspxModal');
    if(modal){ modal.addEventListener('click',(event)=>{ if(event.target===modal) requestCloseModal(); }); }
    document.addEventListener('keydown',(event)=>{
      if(event.key==='Escape' && $('dspxModal')?.classList.contains('show')){
        event.preventDefault();
        requestCloseModal();
      }
    },true);
  }

  function boot(){
    bind();
    window.renderAlmacenes = renderWarehouseScreen;
    window.actualizarDashboardAlmacenes = renderWarehouseScreen;
    try{ renderAlmacenes = renderWarehouseScreen; actualizarDashboardAlmacenes = renderWarehouseScreen; }catch(_e){}
    const disabledWarehouseMutation = function(){ toast('Gestión de almacenes','La creación y edición local fueron desactivadas para evitar almacenes fantasma. Hace falta una RPC administrativa segura para modificar la tabla almacenes.','warning'); };
    window.abrirAlmacen = disabledWarehouseMutation;
    window.editarAlmacen = disabledWarehouseMutation;
    window.guardarAlmacen = disabledWarehouseMutation;
    try{ abrirAlmacen=disabledWarehouseMutation; editarAlmacen=disabledWarehouseMutation; guardarAlmacen=disabledWarehouseMutation; }catch(_e){}
    try{
      const keys=['loteka_despachos_asignaciones_v4','loteka_despachos_asignaciones_v1','loteka_asignaciones_notificadas_v20','loteka_asignaciones_movimientos_v20','loteka_v23_despachos_movimientos_registrados'];
      keys.forEach((key)=>{ try{ localStorage.removeItem(key); }catch(_e){} });
      ['loteka_current_ops_route_v246','loteka_current_ops_route_v236','loteka_current_ops_route_v234','loteka_active_view_v234'].forEach((key)=>{
        try{ const value=localStorage.getItem(key); if(['dispatches','assignments'].includes(txt(value))) localStorage.removeItem(key); }catch(_e){}
      });
    }catch(_e){}
    const view = $('vista-control-despachos');
    if(view && !view.classList.contains('hidden')) setTimeout(()=>loadAll({silent:true}),250);
  }

  if(typeof window.cambiarVista === 'function' && !window.cambiarVista.__dspxWarehouseV410){
    const previousCambiarVista = window.cambiarVista;
    const wrappedCambiarVista = function(vista,el){
      const result = previousCambiarVista.apply(this,arguments);
      if(txt(vista)==='almacenes') setTimeout(()=>window.lotekaDespachosSyncAlmacenes(),80);
      return result;
    };
    wrappedCambiarVista.__dspxWarehouseV410 = true;
    window.cambiarVista = wrappedCambiarVista;
    try{ cambiarVista = wrappedCambiarVista; }catch(_e){}
  }

  window.lotekaRenderControlDespachos = function(){
    bind();
    return loadAll({silent:true});
  };
  window.lotekaDespachosSyncAlmacenes = async function(){
    const ok = await loadAll({silent:true});
    renderWarehouseScreen();
    if(ok) toast('Almacenes actualizados','La pantalla usa la misma fuente Supabase que Control de Despachos.','success');
    return ok;
  };
  window.renderAlmacenes = renderWarehouseScreen;
  try{ renderAlmacenes = renderWarehouseScreen; }catch(_e){}
  window.lotekaDespachosOpenTab = openTab;
  window.lotekaDespachosReload = function(){ return loadAll({silent:false}); };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();

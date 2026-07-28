import { getSupabase } from '../supabase-client.js';

const INVENTORY_TABLES = Object.freeze({
  serials: 'equipos_seriales',
  products: 'productos',
  warehouses: 'almacenes',
  agencies: 'agencias',
  groups: 'grupos',
  movements: 'movimientos_inventario',
  dispatches: 'despachos',
  dispatchItems: 'despacho_items',
  dispatchSerials: 'despacho_seriales',
  dispatchIncidents: 'despacho_incidencias',
  agencyInventory: 'inventario_agencia',
  groupInventory: 'inventario_grupo',
  operations: 'reportes_operaciones'
});

const PENDING_RECEIPT_STATES = new Set(['DESPACHADO', 'INCIDENCIA', 'EN_TRANSITO', 'EN TRÁNSITO', 'TRANSITO', 'TRÁNSITO']);
const BLOCKED_EQUIPMENT_STATES = ['BAJA', 'INACTIVO', 'NO REPARABLE'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeSerial(value){
  const rawValue = String(value ?? '').trim();
  return { rawValue, normalizedValue: rawValue.toUpperCase() };
}

export async function findSerial(serial){
  const { normalizedValue } = normalizeSerial(serial);
  if(!normalizedValue) return null;
  return findEquipmentRow(normalizedValue);
}

export async function lookupScannerCode(value){
  const identity = normalizeSerial(value);
  if(!identity.normalizedValue){
    return { kind:'invalid', ...identity, message:'El código está vacío.' };
  }

  const equipment = await findEquipmentRow(identity.normalizedValue);
  if(equipment){
    const hydrated = await hydrateEquipment(equipment);
    return { kind:'equipment', ...identity, equipment:hydrated, message:'Equipo encontrado' };
  }

  const product = await findProductByCode(identity.normalizedValue);
  if(product){
    return {
      kind:'product',
      ...identity,
      product,
      message:'El código identifica un producto, no un serial específico.'
    };
  }

  return {
    kind:'unknown',
    ...identity,
    message:'El código no está registrado como serial ni como producto.'
  };
}

export async function hydrateEquipment(equipment){
  const productId = equipment?.producto_id;
  const warehouseId = equipment?.almacen_id;
  const agencyId = equipment?.agencia_id;
  const groupId = equipment?.grupo_id;
  const dispatchId = equipment?.despacho_actual_id;
  const operationId = equipment?.operacion_id;

  const [product, warehouse, agency, group, dispatch, latestMovement, history, pendingReceipt, operation] = await Promise.all([
    productId ? fetchOne(INVENTORY_TABLES.products, productId) : null,
    warehouseId ? fetchOne(INVENTORY_TABLES.warehouses, warehouseId) : null,
    agencyId ? fetchOne(INVENTORY_TABLES.agencies, agencyId) : null,
    groupId ? fetchOne(INVENTORY_TABLES.groups, groupId) : null,
    dispatchId ? fetchOne(INVENTORY_TABLES.dispatches, dispatchId) : null,
    equipment?.id ? fetchLatestMovement(equipment.id) : null,
    equipment?.id ? getSerialHistory(equipment.id, 60) : [],
    equipment?.id ? findPendingReceipt(equipment.id) : null,
    operationId ? fetchOne(INVENTORY_TABLES.operations, operationId) : null
  ]);

  const state = normalizeToken(equipment?.estado);
  const locationType = normalizeToken(equipment?.ubicacion_tipo);
  const workshop = locationType === 'TALLER' || normalizeToken(warehouse?.codigo) === 'ALM-TALLER' || /TALLER/.test(normalizeToken(warehouse?.nombre));
  const reserved = Boolean(equipment?.despacho_actual_id || equipment?.reservado_en);
  const inactive = equipment?.activo === false || BLOCKED_EQUIPMENT_STATES.some(token => state.includes(token));
  const sourceSupported = ['ALMACEN','AGENCIA'].includes(locationType);

  const blockedReasons = [];
  if(inactive) blockedReasons.push('El equipo está inactivo, dado de baja o no reparable.');
  if(workshop) blockedReasons.push('El equipo se encuentra en Taller.');
  if(reserved && !pendingReceipt) blockedReasons.push('El equipo está reservado en un despacho.');
  if(pendingReceipt) blockedReasons.push('El equipo tiene una recepción pendiente.');
  if(!sourceSupported) blockedReasons.push('La ubicación actual no admite transferencia móvil en esta fase.');

  return {
    ...equipment,
    product,
    warehouse,
    agency,
    group,
    dispatch,
    operation,
    latestMovement,
    history,
    pendingReceipt,
    inventoryContext:{
      active:!inactive,
      reserved,
      workshop,
      sourceSupported,
      canTransfer:!inactive && !workshop && !reserved && !pendingReceipt && sourceSupported && Boolean(productId),
      canReceive:Boolean(pendingReceipt),
      blockedReasons
    }
  };
}

export async function listActiveProducts(search = '', limit = 1000){
  const sb = await getSupabase();
  let query = sb.from(INVENTORY_TABLES.products).select('*').eq('activo', true).order('nombre', {ascending:true}).limit(limit);
  const response = await query;
  if(response.error) throw response.error;
  const term = normalizeToken(search);
  const rows = response.data || [];
  if(!term) return rows;
  return rows.filter(row => normalizeToken([row.codigo,row.nombre,row.categoria,row.tipo_producto].filter(Boolean).join(' ')).includes(term));
}

export async function listActiveWarehouses(limit = 1000){
  const sb = await getSupabase();
  const response = await sb.from(INVENTORY_TABLES.warehouses).select('*').eq('activo', true).order('nombre', {ascending:true}).limit(limit);
  if(response.error) throw response.error;
  return response.data || [];
}

export async function listActiveAgencies(limit = 4000){
  const sb = await getSupabase();
  const response = await sb.from(INVENTORY_TABLES.agencies).select('*').eq('activo', true).order('numero', {ascending:true}).limit(limit);
  if(response.error) throw response.error;
  return response.data || [];
}

export async function getInventoryPermission(){
  const sb = await getSupabase();
  const response = await sb.rpc('usuario_puede_ver_inventario', {});
  if(response.error){
    if(isMissingRpc(response.error)) return null;
    throw response.error;
  }
  return normalizePermission(response.data);
}

export async function getGroupManagerEntryContext(){
  const data = await callRpc('rpc_contexto_entrada_encargado_grupo', {});
  const value = Array.isArray(data) && data.length === 1 ? data[0] : data;
  const safe = value && typeof value === 'object' ? value : {};
  return {
    isGroupManager:Boolean(safe.es_encargado_grupo ?? safe.is_group_manager ?? true),
    groups:Array.isArray(safe.grupos) ? safe.grupos : Array.isArray(safe.groups) ? safe.groups : [],
    defaultGroupId:String(safe.grupo_predeterminado_id || safe.default_group_id || ''),
    requiresSelection:Boolean(safe.requiere_seleccion ?? safe.requires_selection),
    message:String(safe.mensaje || safe.message || '')
  };
}

export async function registerGroupManagerInventoryEntry({groupId, productId, serials, physicalCondition}){
  assertUuid(productId, 'Selecciona un producto válido.');
  if(groupId) assertUuid(groupId, 'Selecciona uno de tus grupos.');
  const cleanSerials = uniqueSerials(serials);
  if(!cleanSerials.length) throw validationError('Agrega por lo menos un serial.');
  await ensureSerialsDoNotExist(cleanSerials);

  return callRpc('rpc_encargado_grupo_registrar_entrada', {
    p_grupo_id:groupId || null,
    p_producto_id:productId,
    p_seriales:cleanSerials,
    p_condicion:String(physicalCondition || 'USADO_FUNCIONAL').trim().toUpperCase()
  });
}

export async function registerInventoryEntry({warehouseId, supplier, date, reference, observations, physicalCondition, motive, productId, serials}){
  assertUuid(warehouseId, 'Selecciona un almacén válido.');
  assertUuid(productId, 'Selecciona un producto válido.');
  const cleanSerials = uniqueSerials(serials);
  if(!cleanSerials.length) throw validationError('Agrega por lo menos un serial.');

  await assertInventoryPermission();
  await validateEntryCatalog(warehouseId, productId);
  await ensureSerialsDoNotExist(cleanSerials);

  const detail = [
    observations,
    physicalCondition ? `Estado físico inicial: ${physicalCondition}` : '',
    motive ? `Motivo de entrada: ${motive}` : '',
    'Origen móvil: Centro inteligente de escáner'
  ].map(value => String(value || '').trim()).filter(Boolean).join(' · ');

  return callRpc('rpc_inventario_registrar_entrada', {
    p_almacen_id:warehouseId,
    p_suplidor:String(supplier || '').trim() || 'Suplidor General',
    p_observaciones:detail || null,
    p_referencia:String(reference || '').trim() || `EN-MOV-${Date.now()}`,
    p_fecha:toIso(date),
    p_items:[{ producto_id:productId, cantidad:cleanSerials.length, seriales:cleanSerials }]
  });
}

export async function transferInventorySerial({equipment, destinationType, destinationId, reference, observations, date}){
  if(!equipment?.id || !equipment?.producto_id) throw validationError('No se pudo identificar el equipo y su producto.');
  const originType = normalizeToken(equipment.ubicacion_tipo);
  const originId = originType === 'ALMACEN' ? equipment.almacen_id : originType === 'AGENCIA' ? equipment.agencia_id : null;
  if(!['ALMACEN','AGENCIA'].includes(originType) || !originId) throw validationError('La ubicación actual no admite transferencia móvil.');
  const targetType = normalizeToken(destinationType);
  if(!['ALMACEN','AGENCIA'].includes(targetType)) throw validationError('Selecciona un destino compatible.');
  assertUuid(destinationId, 'Selecciona un destino válido.');
  if(originType === targetType && String(originId) === String(destinationId)) throw validationError('El destino debe ser diferente del origen.');

  await assertInventoryPermission();
  const current = await hydrateEquipment(await findEquipmentRow(normalizeSerial(equipment.serial).normalizedValue));
  if(!current?.inventoryContext?.canTransfer){
    throw validationError(current?.inventoryContext?.blockedReasons?.[0] || 'El equipo ya no está disponible para transferir.');
  }

  return callRpc('rpc_inventario_transferir', {
    p_origen_tipo:originType,
    p_origen_id:originId,
    p_destino_tipo:targetType,
    p_destino_id:destinationId,
    p_referencia:String(reference || '').trim() || `TR-MOV-${Date.now()}`,
    p_observaciones:String(observations || '').trim() || 'Transferencia registrada desde el escáner móvil.',
    p_fecha:toIso(date),
    p_items:[{ producto_id:equipment.producto_id, cantidad:1, seriales:[normalizeSerial(equipment.serial).normalizedValue] }]
  });
}

export async function receivePendingSerial({equipment, observations}){
  const pending = equipment?.pendingReceipt;
  if(!pending?.dispatch?.id || !pending?.item?.id) throw validationError('El serial no tiene una recepción pendiente válida.');
  await assertInventoryPermission();
  return callRpc('rpc_recibir_despacho_parcial', {
    p_despacho_id:pending.dispatch.id,
    p_items:[{
      despacho_item_id:pending.item.id,
      cantidad_recibida:1,
      seriales:[normalizeSerial(equipment.serial).normalizedValue],
      tipo_incidencia:null,
      descripcion_incidencia:null
    }],
    p_observaciones:String(observations || '').trim() || 'Recepción confirmada mediante escaneo móvil.'
  });
}

export async function reportReceiptIncident({equipment, type, description, observations}){
  const pending = equipment?.pendingReceipt;
  if(!pending?.dispatch?.id || !pending?.item?.id) throw validationError('El serial no tiene una recepción pendiente válida.');
  if(!String(description || '').trim()) throw validationError('Describe la incidencia.');
  await assertInventoryPermission();
  return callRpc('rpc_recibir_despacho_parcial', {
    p_despacho_id:pending.dispatch.id,
    p_items:[{
      despacho_item_id:pending.item.id,
      cantidad_recibida:0,
      seriales:[],
      tipo_incidencia:String(type || 'OTRO').trim().toUpperCase(),
      descripcion_incidencia:String(description).trim()
    }],
    p_observaciones:String(observations || '').trim() || null
  });
}

export async function getSerialHistory(serialId, limit = 100){
  if(!serialId) return [];
  const sb = await getSupabase();
  const response = await sb.from(INVENTORY_TABLES.movements).select('*').eq('serial_id', serialId).order('creado_en', {ascending:false}).limit(limit);
  if(response.error){
    if(isMissingTable(response.error) || isDenied(response.error)) return [];
    throw response.error;
  }
  return response.data || [];
}

export async function listAgencyEquipment(agencyId, limit = 100){
  const sb = await getSupabase();
  let response = await sb.from(INVENTORY_TABLES.serials).select('*,productos(id,codigo,nombre,categoria,tipo_producto)').eq('agencia_id', agencyId).limit(limit);
  if(response.error) response = await sb.from(INVENTORY_TABLES.serials).select('*').eq('agencia_id', agencyId).limit(limit);
  if(response.error) throw response.error;
  return response.data || [];
}

async function findEquipmentRow(normalizedSerial){
  const sb = await getSupabase();
  let response = await sb.from(INVENTORY_TABLES.serials).select('*').eq('serial', normalizedSerial).limit(1).maybeSingle();
  if(response.error || !response.data){
    response = await sb.from(INVENTORY_TABLES.serials).select('*').ilike('serial', normalizedSerial).limit(1).maybeSingle();
  }
  if(response.error) throw response.error;
  return response.data || null;
}

async function findProductByCode(normalizedCode){
  const sb = await getSupabase();
  const response = await sb.from(INVENTORY_TABLES.products).select('*').eq('activo', true).ilike('codigo', normalizedCode).limit(1).maybeSingle();
  if(response.error) throw response.error;
  return response.data || null;
}

async function fetchOne(table, id){
  if(!id) return null;
  const sb = await getSupabase();
  const response = await sb.from(table).select('*').eq('id', id).limit(1).maybeSingle();
  if(response.error){
    if(isMissingTable(response.error) || isDenied(response.error)) return null;
    throw response.error;
  }
  return response.data || null;
}

async function fetchLatestMovement(serialId){
  const rows = await getSerialHistory(serialId, 1);
  return rows[0] || null;
}

async function findPendingReceipt(serialId){
  const sb = await getSupabase();
  const serialRowsResponse = await sb.from(INVENTORY_TABLES.dispatchSerials).select('*').eq('serial_id', serialId).order('creado_en', {ascending:false}).limit(20);
  if(serialRowsResponse.error){
    if(isMissingTable(serialRowsResponse.error) || isDenied(serialRowsResponse.error)) return null;
    throw serialRowsResponse.error;
  }
  const serialRow = (serialRowsResponse.data || []).find(row => row?.recibido !== true && PENDING_RECEIPT_STATES.has(normalizeToken(row?.estado)));
  if(!serialRow?.despacho_item_id) return null;
  const item = await fetchOne(INVENTORY_TABLES.dispatchItems, serialRow.despacho_item_id);
  if(!item?.despacho_id) return null;
  const dispatch = await fetchOne(INVENTORY_TABLES.dispatches, item.despacho_id);
  if(!dispatch) return null;
  return { serialRow, item, dispatch };
}

async function validateEntryCatalog(warehouseId, productId){
  const [warehouse, product] = await Promise.all([
    fetchOne(INVENTORY_TABLES.warehouses, warehouseId),
    fetchOne(INVENTORY_TABLES.products, productId)
  ]);
  if(!warehouse || warehouse.activo === false) throw validationError('El almacén no existe o está inactivo.');
  if(!product || product.activo === false) throw validationError('El producto no existe o está inactivo.');
  if(product.requiere_serial === false) throw validationError('El producto seleccionado no utiliza seriales. Regístralo desde el inventario administrativo.');
}

async function ensureSerialsDoNotExist(serials){
  for(const serial of serials){
    const existing = await findEquipmentRow(serial);
    if(existing) throw Object.assign(validationError(`El serial ${serial} ya está registrado.`), {code:'23505'});
  }
}

async function assertInventoryPermission(){
  const permission = await getInventoryPermission();
  if(permission !== true) throw Object.assign(new Error('No se pudo confirmar tu permiso para modificar inventario. Contacta al administrador.'), {code:'42501'});
}

async function callRpc(name, args){
  const sb = await getSupabase();
  const response = await sb.rpc(name, args || {});
  if(response.error) throw response.error;
  return response.data;
}

function normalizePermission(data){
  if(typeof data === 'boolean') return data;
  if(Array.isArray(data)) return normalizePermission(data[0]);
  if(data && typeof data === 'object'){
    for(const key of ['usuario_puede_ver_inventario','allowed','permitido','resultado']){
      if(typeof data[key] === 'boolean') return data[key];
    }
  }
  return Boolean(data);
}

function uniqueSerials(values){
  const seen = new Set();
  const rows = [];
  for(const value of Array.isArray(values) ? values : [values]){
    const serial = normalizeSerial(value).normalizedValue;
    if(!serial || seen.has(serial)) continue;
    seen.add(serial);
    rows.push(serial);
  }
  return rows;
}

function normalizeToken(value){
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}

function toIso(value){
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function assertUuid(value, message){
  if(!UUID_RE.test(String(value || ''))) throw validationError(message);
}

function validationError(message){
  return Object.assign(new Error(message), {code:'VALIDATION'});
}

function isMissingRpc(error){
  return String(error?.code || '') === 'PGRST202' || /Could not find the function|schema cache/i.test(String(error?.message || ''));
}

function isMissingTable(error){
  return ['42P01','PGRST205'].includes(String(error?.code || '')) || /does not exist|Could not find the table/i.test(String(error?.message || ''));
}

function isDenied(error){
  return String(error?.code || '') === '42501' || /permission denied/i.test(String(error?.message || ''));
}

import { normalizeSerial } from '../api/equipment-api.js';

const MAX_RECENT_SCANS = 8;

export function validateScannerValue(value){
  const identity = normalizeSerial(value);
  if(!identity.rawValue) return {valid:false,...identity,message:'Escribe o escanea un código.'};
  if(identity.rawValue.length > 120) return {valid:false,...identity,message:'El código es demasiado largo.'};
  if(/[\u0000-\u001f\u007f]/.test(identity.rawValue)) return {valid:false,...identity,message:'El código contiene caracteres no permitidos.'};
  return {valid:true,...identity,message:''};
}

export function addRecentScan(recentScans, result){
  const value = result?.normalizedValue || result?.rawValue;
  if(!value) return Array.isArray(recentScans) ? recentScans : [];
  const row = {
    id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,
    value,
    kind:result.kind || 'unknown',
    label:resultLabel(result),
    scannedAt:new Date().toISOString()
  };
  const filtered = (Array.isArray(recentScans) ? recentScans : []).filter(item => item.value !== value);
  return [row,...filtered].slice(0,MAX_RECENT_SCANS);
}

export function createBatchState(config = {}){
  return {
    active:true,
    paused:false,
    product:config.product || null,
    warehouse:config.warehouse || null,
    productId:config.productId || config.product?.id || '',
    warehouseId:config.warehouseId || config.warehouse?.id || '',
    supplier:String(config.supplier || '').trim(),
    reference:String(config.reference || '').trim(),
    observations:String(config.observations || '').trim(),
    physicalCondition:String(config.physicalCondition || '').trim(),
    motive:String(config.motive || '').trim(),
    date:config.date || new Date().toISOString(),
    serials:[],
    invalid:[],
    unverified:[],
    createdAt:new Date().toISOString()
  };
}

export function addBatchValue(batch, value, existing = false){
  if(!batch?.active) return {batch,added:false,message:'Configura primero la entrada por lote.'};
  const validation = validateScannerValue(value);
  if(!validation.valid) return {batch,added:false,message:validation.message};
  const serial = validation.normalizedValue;
  if(batch.serials.includes(serial)) return {batch,added:false,message:`${serial} ya está dentro del lote.`};
  if(existing) return {batch:{...batch,invalid:[...(batch.invalid || []).filter(item => item.serial !== serial),{serial,reason:'Ya existe en inventario'}],unverified:(batch.unverified || []).filter(value => value !== serial)},added:false,message:`${serial} ya está registrado.`};
  return {batch:{...batch,serials:[...(batch.serials || []),serial],invalid:(batch.invalid || []).filter(item => item.serial !== serial)},added:true,message:`${serial} agregado.`};
}

export function removeBatchValue(batch, serial){
  if(!batch) return batch;
  return {...batch,serials:(batch.serials || []).filter(value => value !== serial),invalid:(batch.invalid || []).filter(item => item.serial !== serial),unverified:(batch.unverified || []).filter(value => value !== serial)};
}

export function productLabel(product){
  return [product?.codigo,product?.nombre,product?.categoria,product?.tipo_producto].map(value => String(value || '').trim()).filter(Boolean).join(' · ') || 'Producto';
}

export function warehouseLabel(warehouse){
  return [warehouse?.codigo,warehouse?.nombre].map(value => String(value || '').trim()).filter(Boolean).join(' · ') || 'Almacén';
}

export function agencyLabel(agency){
  const number = String(agency?.numero || '').trim();
  const name = String(agency?.nombre || '').trim();
  return [number ? `Agencia ${number}` : '',name].filter(Boolean).join(' · ') || 'Agencia';
}

export function entityLabel(type, row){
  const token = String(type || '').toUpperCase();
  if(token === 'ALMACEN') return warehouseLabel(row);
  if(token === 'AGENCIA') return agencyLabel(row);
  return String(row?.nombre || row?.codigo || row?.id || 'Destino');
}

export function localDateTimeValue(value = new Date()){
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = number => String(number).padStart(2,'0');
  return `${safe.getFullYear()}-${pad(safe.getMonth()+1)}-${pad(safe.getDate())}T${pad(safe.getHours())}:${pad(safe.getMinutes())}`;
}

export function scannerResultTitle(result){
  if(result?.kind === 'equipment') return 'Equipo encontrado';
  if(result?.kind === 'product') return 'Producto identificado';
  if(result?.kind === 'unknown') return 'Serial no registrado';
  return 'Código no reconocido';
}

export function signalScannerFeedback(type = 'success'){
  const pattern = type === 'success' ? [35] : type === 'warning' ? [70,45,70] : [110,55,110];
  try{ navigator.vibrate?.(pattern); }catch{}
  try{
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if(!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = type === 'success' ? 920 : type === 'warning' ? 520 : 260;
    gain.gain.setValueAtTime(0.0001,context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08,context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime + 0.12);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.13);
    oscillator.addEventListener('ended',() => context.close().catch(() => null),{once:true});
  }catch{}
}

export function resultLabel(result){
  if(result?.kind === 'equipment') return `${result.equipment?.serial || result.normalizedValue} · ${result.equipment?.product?.nombre || 'Equipo'}`;
  if(result?.kind === 'product') return `${result.product?.codigo || result.normalizedValue} · ${result.product?.nombre || 'Producto'}`;
  return result?.normalizedValue || result?.rawValue || 'Código';
}

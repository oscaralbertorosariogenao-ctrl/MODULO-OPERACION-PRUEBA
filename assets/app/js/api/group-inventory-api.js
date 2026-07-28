import { getSupabase } from '../supabase-client.js';

const CACHE_PREFIX = 'go_group_inventory_v1';

export async function getMyGroupInventory({ groupId = null, movementLimit = 120 } = {}){
  const sb = await getSupabase();
  const response = await sb.rpc('rpc_mi_inventario_grupo', {
    p_grupo_id:groupId || null,
    p_limite_movimientos:Math.max(20,Math.min(Number(movementLimit) || 120,300))
  });
  if(response.error) throw response.error;
  return normalizePayload(response.data);
}

export function normalizeGroupInventoryPayload(raw){ return normalizePayload(raw); }

export function saveGroupInventoryCache(userId,payload){
  try{ localStorage.setItem(cacheKey(userId),JSON.stringify({savedAt:Date.now(),payload})); }catch{}
}

export function loadGroupInventoryCache(userId){
  try{
    const parsed=JSON.parse(localStorage.getItem(cacheKey(userId)) || 'null');
    if(!parsed?.payload) return null;
    return {savedAt:Number(parsed.savedAt || 0),payload:normalizePayload(parsed.payload)};
  }catch{return null;}
}

function normalizePayload(raw){
  let value=raw;
  if(Array.isArray(value) && value.length===1) value=value[0];
  if(typeof value==='string'){
    try{ value=JSON.parse(value); }catch{ value={}; }
  }
  value=value && typeof value==='object' ? value : {};
  return {
    generatedAt:value.generated_at || value.generatedAt || new Date().toISOString(),
    groups:array(value.grupos || value.groups),
    agencies:array(value.agencias || value.agencies),
    groupItems:array(value.en_grupo || value.group_items || value.groupItems),
    agencyItems:array(value.en_agencias || value.agency_items || value.agencyItems),
    transits:array(value.en_transito || value.transits),
    movements:array(value.movimientos || value.movements),
    summary:value.resumen || value.summary || {}
  };
}
function cacheKey(userId){ return `${CACHE_PREFIX}:${String(userId || 'anonymous')}`; }
function array(value){ return Array.isArray(value) ? value : []; }

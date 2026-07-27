import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';

function errorText(error){ return [error?.message,error?.details,error?.hint].filter(Boolean).join(' '); }
function missingColumn(error){
  const match = errorText(error).match(/(?:column|find the) ["']?([a-zA-Z0-9_]+)["']?/i);
  return match?.[1] || '';
}

export async function listNotifications(limit = 80){
  const sb = await getSupabase();
  for(const column of ['creado_en','created_at','fecha','id',null]){
    let query = sb.from(TABLES.notifications).select('*').limit(limit);
    if(column) query = query.order(column,{ascending:false});
    const response = await query;
    if(!response.error) return response.data || [];
    if(!missingColumn(response.error) && !/does not exist|schema cache|Could not find/i.test(errorText(response.error))) throw response.error;
  }
  return [];
}

async function safeNotificationUpdate(filterColumn,filterValue,patch){
  const sb = await getSupabase();
  let current = {...patch};
  for(let attempt = 0; attempt < 8; attempt += 1){
    const response = await sb.from(TABLES.notifications).update(current).eq(filterColumn,filterValue);
    if(!response.error) return;
    const missing = missingColumn(response.error);
    if(missing && Object.hasOwn(current,missing)){ delete current[missing]; continue; }
    throw response.error;
  }
}

export function markNotificationRead(id){ return safeNotificationUpdate('id',id,{leida:true,visto_en_panel:true}); }
export function markAllNotificationsRead(){ return safeNotificationUpdate('leida',false,{leida:true,visto_en_panel:true}); }

export async function createOperationalNotification(payload){
  const sb = await getSupabase();
  let current = {...payload};
  for(let attempt = 0; attempt < 20; attempt += 1){
    const { data, error } = await sb.from(TABLES.notifications).insert(current).select('*').maybeSingle();
    if(!error) return data || current;
    const missing = missingColumn(error);
    if(missing && Object.hasOwn(current,missing)){ delete current[missing]; continue; }
    throw error;
  }
  return null;
}

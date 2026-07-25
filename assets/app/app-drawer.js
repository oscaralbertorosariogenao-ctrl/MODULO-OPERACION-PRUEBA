import { TABLES } from '../config.js';
import { getSupabase } from '../supabase-client.js';
export async function listNotifications(limit = 80){
  const sb = await getSupabase();
  const { data, error } = await sb.from(TABLES.notifications).select('*').order('creado_en',{ascending:false}).limit(limit);
  if(error) throw error; return data || [];
}
export async function markNotificationRead(id){
  const sb = await getSupabase(); const { error } = await sb.from(TABLES.notifications).update({ leida:true, visto_en_panel:true }).eq('id', id);
  if(error) throw error;
}
export async function markAllNotificationsRead(){
  const sb = await getSupabase(); const { error } = await sb.from(TABLES.notifications).update({ leida:true, visto_en_panel:true }).eq('leida', false);
  if(error) throw error;
}
export async function createOperationalNotification(payload){
  const sb = await getSupabase(); const { data, error } = await sb.from(TABLES.notifications).insert(payload).select('*').maybeSingle();
  if(error) throw error; return data;
}

import { getSupabase } from './supabase-client.js';
const channels = new Map();
export async function subscribeTable(table, callback){
  if(channels.has(table)) return channels.get(table);
  const sb = await getSupabase();
  const channel = sb.channel(`go-v805-${table}`).on('postgres_changes', { event:'*', schema:'public', table }, payload => callback(payload)).subscribe();
  channels.set(table, channel);
  return channel;
}
export async function unsubscribeTable(table){
  const channel = channels.get(table); if(!channel) return;
  const sb = await getSupabase(); await sb.removeChannel(channel); channels.delete(table);
}
export async function clearRealtime(){
  const sb = await getSupabase();
  await Promise.all([...channels.values()].map(channel => sb.removeChannel(channel).catch(() => null)));
  channels.clear();
}
export function realtimeCount(){ return channels.size; }

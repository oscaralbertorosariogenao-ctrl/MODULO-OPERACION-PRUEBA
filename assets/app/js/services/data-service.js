import { listOperations, getOperation, getRecentOperations, getOperationsForStats } from '../api/operations-api.js';
import { listAgencies, getAgency, listGroups, listAgencyCoordinates } from '../api/agencies-api.js';
import { listTechnicians } from '../api/profiles-api.js';
import { listAgencyEquipment } from '../api/equipment-api.js';
import { listNotifications } from '../api/notifications-api.js';
import { computeStats, normalizeOperation } from './operations-service.js';
import { deriveOperationalAlerts } from './notification-service.js';
import { getState, updateSlice } from '../store.js';
import { markSync } from '../connectivity.js';

export async function loadOperationsPage({ reset = true } = {}){
  const state = getState(); const page = reset ? 0 : state.operations.page + 1;
  updateSlice('operations',{loading:true},'operations-loading');
  const result = await listOperations({page,filters:state.operations.filters});
  updateSlice('operations',current => ({loading:false,page,total:result.count,hasMore:result.hasMore,items:reset ? result.data : [...current.items,...result.data]}),'operations-loaded');
  markSync(); return result;
}

export async function loadHomeData(){
  const [statsResult,recentResult,notificationsResult,techniciansResult] = await Promise.allSettled([
    getOperationsForStats(),getRecentOperations(8),listNotifications(40),listTechnicians()
  ]);
  const statsRows = statsResult.status === 'fulfilled' ? statsResult.value : [];
  const recent = recentResult.status === 'fulfilled' ? recentResult.value : [];
  const realNotifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : [];
  const technicians = techniciansResult.status === 'fulfilled' ? techniciansResult.value : [];
  if(statsResult.status === 'rejected' && recentResult.status === 'rejected') throw statsResult.reason;

  const derived = deriveOperationalAlerts(statsRows);
  const technicianMap = new Map();
  for(const technician of technicians){
    const name = technician.nombre_completo || technician.nombre || technician.usuario_login;
    technicianMap.set(name,{...technician,activeOperations:0,lastActivity:null});
  }
  for(const row of statsRows.map(normalizeOperation)){
    if(!['Asignada','En proceso'].includes(row.status)) continue;
    const item = technicianMap.get(row.technician);
    if(item){
      item.activeOperations += 1;
      if(!item.lastActivity || new Date(row.createdAt) > new Date(item.lastActivity)) item.lastActivity = row.createdAt;
    }
  }
  updateSlice('operations',{items:recent,total:recent.length,stats:computeStats(statsRows),loading:false},'home-operations');
  updateSlice('technicians',{items:[...technicianMap.values()],loading:false},'home-technicians');
  updateSlice('notifications',{items:[...derived,...realNotifications],loading:false,real:notificationsResult.status === 'fulfilled'},'home-notifications');
  markSync(); return {statsRows,recent};
}

export async function loadOperationDetail(reference){
  updateSlice('operations',{loading:true},'operation-detail-loading');
  const row = await getOperation(reference);
  updateSlice('operations',{selected:row,loading:false},'operation-detail-loaded'); markSync(); return row;
}

export async function loadAgenciesPage({ reset = true, pageSize } = {}){
  const state = getState(); const page = reset ? 0 : state.agencies.page + 1;
  updateSlice('agencies',{loading:true},'agencies-loading');
  const result = await listAgencies({page,pageSize,filters:state.agencies.filters});
  updateSlice('agencies',current => ({loading:false,page,total:result.count,hasMore:result.hasMore,items:reset ? result.data : [...current.items,...result.data]}),'agencies-loaded');
  markSync(); return result;
}

export async function ensureAgencyReferenceData(){
  const state = getState(); const needsAgencies = !state.agencies.items.length; const needsGroups = !state.agencies.groups?.length;
  const [agencyResult,groups] = await Promise.all([needsAgencies ? listAgencies({page:0,pageSize:120,filters:{}}) : null,needsGroups ? listGroups() : null]);
  if(agencyResult) updateSlice('agencies',{items:agencyResult.data,total:agencyResult.count,page:0,hasMore:agencyResult.hasMore},'agency-reference');
  if(groups) updateSlice('agencies',{groups},'group-reference');
}

export async function loadAgencyDetail(reference){
  updateSlice('agencies',{loading:true},'agency-detail-loading');
  const agency = await getAgency(reference);
  const agencyKey = String(agency?.numero || '');
  const [ops,equipment] = await Promise.all([
    listOperations({page:0,pageSize:60,filters:{search:agencyKey}}).then(result => result.data.map(normalizeOperation).filter(op => op.agencyNumber.replace(/^0+/,'') === agencyKey.replace(/^0+/,'') && op.status !== 'Completado')).catch(() => []),
    agency?.id ? listAgencyEquipment(agency.id).catch(() => []) : []
  ]);
  const selected = {...agency,relatedOperations:ops,equipment}; updateSlice('agencies',{selected,loading:false},'agency-detail-loaded'); markSync(); return selected;
}

export async function loadTechniciansData(){
  updateSlice('technicians',{loading:true},'technicians-loading');
  const [techniciansResult,rowsResult] = await Promise.allSettled([listTechnicians(),getOperationsForStats()]);
  if(techniciansResult.status === 'rejected') throw techniciansResult.reason;
  const technicians = techniciansResult.value;
  const rows = rowsResult.status === 'fulfilled' ? rowsResult.value : [];
  const normalized = rows.map(normalizeOperation);
  const items = technicians.map(tech => {
    const name = tech.nombre_completo || tech.nombre || tech.usuario_login;
    const active = normalized.filter(op => ['Asignada','En proceso'].includes(op.status) && op.technician === name);
    return {...tech,activeOperations:active.length,lastActivity:active[0]?.createdAt || null};
  });
  updateSlice('technicians',{items,loading:false},'technicians-loaded'); markSync(); return items;
}

export async function loadNotificationsData(){
  updateSlice('notifications',{loading:true},'notifications-loading');
  const [rowsResult,realResult] = await Promise.allSettled([getOperationsForStats(),listNotifications(80)]);
  if(rowsResult.status === 'rejected' && realResult.status === 'rejected') throw rowsResult.reason;
  const rows = rowsResult.status === 'fulfilled' ? rowsResult.value : [];
  const real = realResult.status === 'fulfilled' ? realResult.value : [];
  updateSlice('notifications',{items:[...deriveOperationalAlerts(rows),...real],loading:false,real:realResult.status === 'fulfilled'},'notifications-loaded'); markSync();
}

export async function loadMapData(groupId = ''){
  const [groups,items] = await Promise.all([listGroups(),listAgencyCoordinates({groupId,limit:1500})]);
  updateSlice('agencies',{groups,mapItems:items,mapGroupId:groupId},'map-loaded'); markSync(); return items;
}

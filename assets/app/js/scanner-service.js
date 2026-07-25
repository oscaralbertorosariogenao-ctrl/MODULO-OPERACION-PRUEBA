import { AppError, ERROR_TYPES } from '../errors.js';
let assetsPromise = null; let activeMap = null; let markerLayer = null;
function loadStyle(href){
  if(document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link);
}
function loadScript(src){
  return new Promise((resolve, reject) => { const existing = document.querySelector(`script[src="${src}"]`); if(existing){ if(globalThis.L) resolve(); else existing.addEventListener('load', resolve, { once:true }); return; }
    const script = document.createElement('script'); script.src = src; script.async = true; script.addEventListener('load', resolve, { once:true }); script.addEventListener('error', reject, { once:true }); document.head.append(script); });
}
export async function loadMapAssets(){
  if(globalThis.L?.map) return globalThis.L;
  if(!assetsPromise){
    assetsPromise = (async () => {
      loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      loadStyle('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
      loadStyle('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');
      await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
      await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
      return globalThis.L;
    })();
  }
  try{ return await assetsPromise; }catch(error){ assetsPromise = null; throw new AppError('No se pudo cargar el mapa. Puedes abrir la navegación externa.', { type:ERROR_TYPES.network, cause:error }); }
}
export function validCoordinates(agency){ const lat = Number(agency?.latitud); const lng = Number(agency?.longitud); return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180; }
export function externalMapUrl(agency){ return validCoordinates(agency) ? `https://www.google.com/maps?q=${encodeURIComponent(`${agency.latitud},${agency.longitud}`)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([agency?.numero,agency?.nombre,agency?.direccion].filter(Boolean).join(' '))}`; }
export function whatsappUrl(phone, message = ''){ const digits = String(phone || '').replace(/\D/g,''); const normalized = digits.length === 10 ? `1${digits}` : digits; return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : ''; }
export function phoneUrl(phone){ const digits = String(phone || '').replace(/[^\d+]/g,''); return digits ? `tel:${digits}` : ''; }
export function getCurrentPosition(){
  return new Promise((resolve, reject) => { if(!navigator.geolocation) return reject(new AppError('GPS no disponible.', { type:ERROR_TYPES.gps }));
    navigator.geolocation.getCurrentPosition(resolve, error => reject(new AppError('No se pudo obtener tu ubicación. La app continuará sin GPS.', { type:ERROR_TYPES.gps, cause:error })), { enableHighAccuracy:true, timeout:9000, maximumAge:60000 }); });
}
export async function renderAgencyMap(container, agencies, onOpen){
  const L = await loadMapAssets(); destroyMap();
  activeMap = L.map(container, { zoomControl:true, preferCanvas:true }).setView([18.4861,-69.9312], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(activeMap);
  markerLayer = L.markerClusterGroup ? L.markerClusterGroup({ chunkedLoading:true, chunkInterval:60, maxClusterRadius:55 }) : L.layerGroup();
  const bounds = [];
  for(const agency of agencies || []){
    if(!validCoordinates(agency)) continue;
    const lat = Number(agency.latitud); const lng = Number(agency.longitud); bounds.push([lat,lng]);
    const marker = L.marker([lat,lng], { title:`Agencia ${agency.numero || ''}` });
    marker.bindTooltip(`Ag. ${agency.numero || ''} · ${agency.nombre || 'Sin nombre'}`);
    marker.on('click', () => onOpen?.(agency)); markerLayer.addLayer(marker);
  }
  markerLayer.addTo(activeMap); if(bounds.length) activeMap.fitBounds(bounds, { padding:[28,28], maxZoom:15 });
  return activeMap;
}
export function destroyMap(){ if(activeMap){ activeMap.remove(); activeMap = null; markerLayer = null; } }
export function centerMap(latitude, longitude, zoom = 16){ if(activeMap) activeMap.setView([Number(latitude),Number(longitude)], zoom); }

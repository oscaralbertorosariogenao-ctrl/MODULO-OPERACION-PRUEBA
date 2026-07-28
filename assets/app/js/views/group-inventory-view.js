import { el } from '../components/dom.js';
import { emptyState } from '../components/empty-state.js';

export function groupInventoryView(state){
  const inventory=state.groupInventory || {};
  const data=inventory.data || emptyData();
  const filters=inventory.filters || {};
  const groups=data.groups || [];
  const selectedGroupId=filters.groupId || groups[0]?.id || '';
  const selectedGroup=groups.find(group => String(group.id)===String(selectedGroupId)) || groups[0] || null;
  const scope=filters.scope || 'group';
  const search=normalize(filters.search);
  const source=scope==='agency' ? data.agencyItems : scope==='transit' ? data.transits : scope==='history' ? data.movements : data.groupItems;
  const filtered=(source || []).filter(item => matches(item,search,selectedGroupId));
  const totals=calculateTotals(data,selectedGroupId);

  return el('div',{class:'page group-inventory-page'},
    header(inventory,selectedGroup,groups,filters),
    el('section',{class:'group-inventory-metrics','aria-label':'Resumen de mi inventario'},
      metric(totals.agencies,'Agencias','⌂'),
      metric(totals.groupUnits,'En mi grupo','▣'),
      metric(totals.agencyUnits,'En agencias','⌖'),
      metric(totals.transits,'En tránsito','⇢')
    ),
    el('section',{class:'group-inventory-tools card'},
      el('div',{class:'search-box'},el('input',{class:'input',type:'search',value:filters.search || '',placeholder:'Buscar producto, serial, agencia o despacho','data-input-action':'group-inventory-search','aria-label':'Buscar en mi inventario'})),
      el('button',{class:'btn btn-primary group-inventory-scan',type:'button','data-action':'go-scanner'},el('span',{'aria-hidden':'true',text:'⌗'}),el('span',{text:'Escanear producto'}))
    ),
    scopeTabs(scope,totals),
    inventory.loading ? loadingCards() : contentForScope(scope,filtered,selectedGroup),
    inventory.fromCache ? el('p',{class:'group-inventory-cache-note',text:'Mostrando la última copia disponible. Conéctate y pulsa Actualizar para sincronizar.'}) : null
  );
}

function header(inventory,group,groups,filters){
  return el('section',{class:'group-inventory-hero'},
    el('div',{class:'group-inventory-hero-copy'},
      el('span',{class:'group-inventory-kicker',text:'MI INVENTARIO'}),
      el('h1',{text:group ? groupLabel(group) : 'Inventario de grupo'}),
      el('p',{text:group ? `${group.agencias_count || 0} agencias asignadas · Consulta operativa en tiempo real` : 'No tienes grupos asignados para consultar.'})
    ),
    groups.length>1 ? el('label',{class:'group-inventory-group-select'},
      el('span',{text:'Grupo'}),
      el('select',{class:'select','data-change-action':'group-inventory-group',value:filters.groupId || group?.id || ''},groups.map(row => el('option',{value:row.id,selected:String(row.id)===String(filters.groupId || group?.id || ''),text:groupLabel(row)})))
    ) : group ? el('span',{class:'group-inventory-group-chip',text:group.codigo ? `G-${digits(group.codigo)}` : groupLabel(group)}) : null,
    el('div',{class:'group-inventory-sync'},
      el('span',{'aria-hidden':'true',text:inventory.fromCache ? '○' : '●'}),
      el('span',{text:inventory.fromCache ? 'Copia local' : formatSync(inventory.loadedAt)})
    )
  );
}

function scopeTabs(active,totals){
  const tabs=[
    ['group','En mi grupo',totals.groupUnits],
    ['agency','En agencias',totals.agencyUnits],
    ['transit','En tránsito',totals.transits],
    ['history','Historial',totals.movements]
  ];
  return el('nav',{class:'group-inventory-tabs','aria-label':'Secciones de inventario'},tabs.map(([scope,label,count]) => el('button',{class:`group-inventory-tab${active===scope?' is-active':''}`,type:'button','data-action':'group-inventory-scope','data-scope':scope,'aria-current':active===scope?'page':null},el('span',{text:label}),el('b',{text:String(count || 0)}))));
}

function contentForScope(scope,items,group){
  if(!group) return emptyState({icon:'▣',title:'Sin grupo asignado',message:'Solicita al administrador que asigne uno o más grupos a tu perfil.'});
  if(!items.length){
    const copy={
      group:['Sin productos en el grupo','Los equipos recibidos o bajo custodia aparecerán aquí.'],
      agency:['Sin productos en agencias','Los equipos instalados en tus agencias aparecerán aquí.'],
      transit:['Sin movimientos pendientes','No hay despachos o transferencias en tránsito hacia tus grupos.'],
      history:['Sin historial disponible','Los movimientos recientes de tus productos aparecerán aquí.']
    }[scope];
    return emptyState({icon:scope==='transit'?'⇢':scope==='history'?'↻':'▣',title:copy[0],message:copy[1]});
  }
  if(scope==='history') return el('section',{class:'group-inventory-timeline'},items.map(movementCard));
  if(scope==='transit') return el('section',{class:'group-inventory-list'},items.map(transitCard));
  return el('section',{class:'group-inventory-list'},items.map(item => productCard(item,scope)));
}

function productCard(item,scope){
  const serial=item.serial || '';
  const quantity=Math.max(1,Number(item.cantidad || item.quantity || 1));
  const agency=scope==='agency' ? `${padAgency(item.agencia_numero)}${item.agencia_nombre ? ` · ${item.agencia_nombre}` : ''}` : '';
  const location=agency || item.ubicacion || item.location || 'Almacén del grupo';
  return el('article',{class:'group-inventory-item card'},
    el('div',{class:'group-inventory-item-icon','aria-hidden':'true',text:productIcon(item)}),
    el('div',{class:'group-inventory-item-main'},
      el('div',{class:'group-inventory-item-head'},
        el('div',{},el('h2',{text:item.producto_nombre || item.product_name || item.producto_codigo || 'Producto'}),el('p',{text:item.categoria || item.category || 'Inventario operativo'})),
        stateBadge(item.estado || item.state)
      ),
      el('div',{class:'group-inventory-serial'},serial ? el('code',{text:serial}) : el('strong',{text:`Cantidad: ${quantity}`})),
      el('div',{class:'group-inventory-meta'},meta('Ubicación',location),meta('Custodio',item.custodio || item.custodian || 'Inventario del grupo'),meta('Actualizado',formatDate(item.fecha || item.updated_at || item.creado_en)))
    ),
    serial ? el('button',{class:'btn btn-outline btn-sm group-inventory-item-action',type:'button','data-action':'group-inventory-scan-serial','data-serial':serial},'Consultar serial') : null
  );
}

function transitCard(item){
  const requested=Number(item.cantidad_solicitada || item.requested || 0);
  const prepared=Number(item.cantidad_preparada || item.prepared || 0);
  const received=Number(item.cantidad_recibida || item.received || 0);
  const progress=requested>0 ? Math.min(100,Math.round((Math.max(prepared,received)/requested)*100)) : 0;
  return el('article',{class:'group-inventory-transit card'},
    el('div',{class:'group-inventory-transit-head'},
      el('div',{},el('span',{class:'group-inventory-kicker',text:'DESPACHO / TRANSFERENCIA'}),el('h2',{text:item.codigo || item.code || 'Movimiento en tránsito'})),
      stateBadge(item.estado || item.state)
    ),
    el('p',{class:'group-inventory-transit-destination',text:item.destino || item.destination || 'Destino de grupo'}),
    el('p',{class:'muted',text:item.productos_resumen || item.items_summary || 'Productos pendientes de recepción'}),
    el('div',{class:'progress group-inventory-progress'},el('span',{style:`width:${progress}%`})),
    el('div',{class:'group-inventory-transit-counts'},meta('Solicitado',requested),meta('Preparado',prepared),meta('Recibido',received)),
    received<requested ? el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'go-scanner'},'Recibir con escáner') : null
  );
}

function movementCard(item){
  return el('article',{class:'group-inventory-movement'},
    el('div',{class:'group-inventory-movement-dot','aria-hidden':'true'}),
    el('div',{class:'group-inventory-movement-card card'},
      el('div',{class:'group-inventory-movement-head'},el('h2',{text:item.tipo || item.tipo_movimiento || 'Movimiento'}),el('time',{text:formatDate(item.fecha || item.creado_en)})),
      el('p',{class:'group-inventory-movement-product',text:[item.producto_nombre,item.serial].filter(Boolean).join(' · ') || 'Producto de inventario'}),
      el('p',{class:'muted',text:`${item.origen || item.origen_nombre || 'Origen'} → ${item.destino || item.destino_nombre || 'Destino'}`}),
      item.usuario_nombre ? el('small',{text:`Registrado por ${item.usuario_nombre}`}) : null
    )
  );
}

function metric(value,label,icon){ return el('article',{class:'group-inventory-metric'},el('span',{'aria-hidden':'true',text:icon}),el('strong',{text:String(value || 0)}),el('small',{text:label})); }
function meta(label,value){ return el('span',{},el('small',{text:label}),el('b',{text:String(value ?? '-')})); }
function stateBadge(value){ const text=String(value || 'ACTIVO');const token=normalize(text);const tone=/INCID|DAÑ|BAJA|ERROR/.test(token)?'danger':/TRANS|PEND|DESPACH/.test(token)?'pending':/ACTIV|INSTAL|RECIB/.test(token)?'complete':'neutral';return el('span',{class:`badge badge-${tone}`,text}); }
function productIcon(item){ const text=normalize([item.producto_nombre,item.categoria].filter(Boolean).join(' '));if(/ROUTER|RED|WIFI/.test(text))return '⌁';if(/BATER|UPS|ELECT/.test(text))return '⚡';if(/CAMARA/.test(text))return '◉';if(/IMPRES/.test(text))return '▤';return '▣'; }
function calculateTotals(data,groupId){
  const inGroup=(data.groupItems || []).filter(item => sameGroup(item,groupId));
  const inAgencies=(data.agencyItems || []).filter(item => sameGroup(item,groupId));
  const transits=(data.transits || []).filter(item => sameGroup(item,groupId));
  const movements=(data.movements || []).filter(item => sameGroup(item,groupId));
  const agencies=(data.agencies || []).filter(item => !groupId || String(item.grupo_id)===String(groupId)).length;
  return {agencies,groupUnits:sumUnits(inGroup),agencyUnits:sumUnits(inAgencies),transits:transits.length,movements:movements.length};
}
function sumUnits(items){ return items.reduce((sum,item)=>sum+Math.max(1,Number(item.cantidad || item.quantity || 1)),0); }
function matches(item,search,groupId){ if(!sameGroup(item,groupId)) return false;if(!search)return true;return normalize(Object.values(item || {}).filter(value => ['string','number'].includes(typeof value)).join(' ')).includes(search); }
function sameGroup(item,groupId){ return !groupId || String(item.grupo_id || item.group_id || '')===String(groupId); }
function normalize(value){ return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(); }
function groupLabel(group){ const code=digits(group.codigo);return group.nombre || (code ? `Grupo ${code.padStart(2,'0')}` : 'Grupo'); }
function digits(value){ return String(value || '').replace(/\D/g,''); }
function padAgency(value){ const digitsOnly=digits(value);return digitsOnly ? `Agencia ${digitsOnly.padStart(4,'0')}` : 'Agencia'; }
function formatDate(value){ if(!value)return 'Sin fecha';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short'}).format(date); }
function formatSync(value){ if(!value)return 'Sincronizando';const date=new Date(value);return Number.isNaN(date.getTime())?'Actualizado':`Actualizado ${new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit'}).format(date)}`; }
function loadingCards(){ return el('section',{class:'group-inventory-list'},[0,1,2].map(()=>el('div',{class:'card skeleton group-inventory-skeleton'}))); }
function emptyData(){ return {groups:[],agencies:[],groupItems:[],agencyItems:[],transits:[],movements:[]}; }

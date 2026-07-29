
function setSidebarSectionOpen(sectionName, forceOpen){
  const groups = document.querySelectorAll('.sidebar-group');
  groups.forEach(group => {
    const isTarget = group.dataset.section === sectionName;
    if (forceOpen && !isTarget) group.classList.remove('is-open');
    if (isTarget) group.classList.add('is-open');
  });
}

function toggleSidebarSection(sectionName){
  const target = document.querySelector(`.sidebar-group[data-section="${sectionName}"]`);
  if(!target) return;
  const willOpen = !target.classList.contains('is-open');
  document.querySelectorAll('.sidebar-group').forEach(group => group.classList.remove('is-open'));
  if(willOpen) target.classList.add('is-open');
}

function sidebarSectionForView(vista){
  if(vista === 'home') return '';
  if(['productos','almacenes','entrada','transferencia'].includes(vista)) return 'inventario';
  if(['agencias','grupos'].includes(vista)) return 'consultas';
  if(['dashboard-rrhh','operadoras','solicitudes','historial-rrhh'].includes(vista)) return 'rrhh';
  if(['anuncios'].includes(vista)) return 'comunicacion';
  if(['ops-dashboard','ops-operaciones','ops-levantamientos','ops-historial','ops-rendimiento'].includes(vista)) return 'operaciones';
  if(['ops-reportes','ops-reportes-agencia','ops-reportes-responsable','ops-reportes-tipos','ops-levantamiento-grupos-pdf'].includes(vista)) return 'reportes';
  if(['ops-usuarios','ops-suplidores','ops-trabajos','ops-averias'].includes(vista)) return 'catalogos';
  return 'inventario';
}

function activateSidebarLink(el, vista){
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
  if(el && el.classList) el.classList.add('active');
  const section = sidebarSectionForView(vista);
  if(section) setSidebarSectionOpen(section, true);
}

function initSidebarNavigation(){
  const firstActive = document.querySelector('.sidebar-link.active');
  if(firstActive){
    const parent = firstActive.closest('.sidebar-group')?.dataset.section;
    if(parent) setSidebarSectionOpen(parent, true);
  } else {
    const home=document.getElementById('navHome'); if(home) home.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', initSidebarNavigation);

function cambiarVista(vista, el){
  const ids = [
    'vista-home','vista-productos','vista-almacenes','vista-entrada','vista-transferencia','vista-control-despachos','vista-agencias','vista-grupos',
    'vista-dashboard-rrhh','vista-operadoras','vista-solicitudes','vista-historial-rrhh','vista-anuncios','vista-taller-v2',
    'vista-ops-dashboard','vista-ops-operaciones','vista-ops-levantamientos','vista-ops-historial','vista-ops-rendimiento','vista-ops-reportes','vista-ops-reportes-agencia','vista-ops-reportes-responsable','vista-ops-reportes-tipos','vista-ops-usuarios','vista-ops-suplidores','vista-ops-trabajos','vista-ops-averias'
  ];
  ids.forEach(id => {
    const node = document.getElementById(id);
    if(node) node.classList.add('hidden');
  });
  const target = document.getElementById('vista-' + vista);
  if(target) target.classList.remove('hidden');

  activateSidebarLink(el, vista);
  if(vista==='home'){
    setTimeout(() => {
      try{
        if(typeof agencyMapRefresh === 'function') agencyMapRefresh(agencias);
        if(window.agencyMap && typeof window.agencyMap.invalidateSize === 'function') window.agencyMap.invalidateSize(true);
        if(typeof agencyMapFitAll === 'function') agencyMapFitAll();
      }catch(e){ console.warn('No se pudo refrescar el mapa HOME:', e); }
    }, 180);
  }

  if(vista==='agencias' && typeof renderAgencias === 'function') renderAgencias();
  if(vista==='grupos' && typeof renderGrupos === 'function') renderGrupos();
  if(vista==='control-despachos' && typeof lotekaRenderControlDespachos === 'function') lotekaRenderControlDespachos();  if(vista==='home' && typeof agencyMapRefresh === 'function') setTimeout(() => agencyMapRefresh(agencias), 120);
  if(vista==='dashboard-rrhh' && typeof rrhdRender === 'function') rrhdRender();
  if(vista==='solicitudes' && typeof hrxSyncSolicitudesFromBackendCero === 'function') hrxSyncSolicitudesFromBackendCero(false); else if(vista==='solicitudes' && typeof hrxApplyFilters === 'function') hrxApplyFilters();
  if(vista==='operadoras' && typeof opxApplyFilters === 'function') opxApplyFilters();
  if(vista==='historial-rrhh' && typeof hrhApplyFilters === 'function') hrhApplyFilters();
}


const OPX_STORAGE_KEY = 'loteka_operadoras_module_v1';
let opxOperadoras = [];
let opxFiltered = [];
let opxCurrentId = null;
let opxTab = 'general';

function opxSafeAgencias(){
  try { return Array.isArray(agencias) ? agencias : []; } catch(e){ return []; }
}
function opxSafeGrupos(){
  try { return Array.isArray(grupos) ? grupos : []; } catch(e){ return []; }
}
function opxTodayISO(){ return new Date().toISOString().slice(0,10); }
function opxParseDate(v){ return v ? new Date(v+'T00:00:00') : null; }
function opxAge(birth){
  const b=opxParseDate(birth); if(!b || Number.isNaN(b.getTime())) return 0;
  const t=new Date(); let age=t.getFullYear()-b.getFullYear();
  const m=t.getMonth()-b.getMonth();
  if(m<0 || (m===0 && t.getDate()<b.getDate())) age--;
  return Math.max(age,0);
}
function opxMonthsSince(dateStr){
  const d=opxParseDate(dateStr); if(!d || Number.isNaN(d.getTime())) return 0;
  const t=new Date(); let months=(t.getFullYear()-d.getFullYear())*12 + (t.getMonth()-d.getMonth());
  if(t.getDate()<d.getDate()) months--;
  return Math.max(months,0);
}
function opxHumanMonths(m){
  const years=Math.floor(m/12), months=m%12;
  if(years && months) return `${years} año${years>1?'s':''}, ${months} mes${months>1?'es':''}`;
  if(years) return `${years} año${years>1?'s':''}`;
  return `${months} mes${months!==1?'es':''}`;
}
function opxEstadoBadgeClass(v){
  const s=(v||'').toLowerCase();
  if(s.includes('act')) return 'green';
  if(s.includes('vac')) return 'blue';
  if(s.includes('lic')) return 'gold';
  if(s.includes('cancel') || s.includes('aband') || s.includes('renun')) return 'red';
  return 'gray';
}
function opxLoad(){
  try {
    const raw=localStorage.getItem(OPX_STORAGE_KEY);
    opxOperadoras = raw ? JSON.parse(raw) : [];
  } catch(e){ opxOperadoras=[]; }
  if(!Array.isArray(opxOperadoras) || !opxOperadoras.length) opxOperadoras = opxDefaultData();
  opxNormalize();
  opxSave();
}
function opxSave(){ localStorage.setItem(OPX_STORAGE_KEY, JSON.stringify(opxOperadoras)); }
function opxNormalize(){
  opxOperadoras = opxOperadoras.map((item,idx)=>({
    id: item.id || `opx-${Date.now()}-${idx}`,
    nombre: item.nombre || '', apellido: item.apellido || '',
    cedula: item.cedula || '', grupo: item.grupo || '', agencia: String(item.agencia || ''),
    tipo: item.tipo || 'Normal', turno: item.turno || 'Matutino',
    fechaEntrada: item.fechaEntrada || opxTodayISO(), fechaNacimiento: item.fechaNacimiento || '2000-01-01',
    salario: item.salario || '', celular: item.celular || '', observacionGeneral: item.observacionGeneral || '',
    estadoLaboral: item.estadoLaboral || 'Activa',
    salud: item.salud || 'No', saludDescripcion: item.saludDescripcion || '',
    foto: item.foto || '', cv: item.cv || '', documentoCedula: item.documentoCedula || '',
    certificaciones: Array.isArray(item.certificaciones)?item.certificaciones:[],
    vacaciones: Array.isArray(item.vacaciones)?item.vacaciones:[],
    incentivos: Array.isArray(item.incentivos)?item.incentivos:[],
    faltantes: Array.isArray(item.faltantes)?item.faltantes:[],
    observaciones: Array.isArray(item.observaciones)?item.observaciones:[],
    visitas: Array.isArray(item.visitas)?item.visitas:[]
  }));
}
function opxDefaultData(){
  return [
    {id:'opx-1',nombre:'Maria Laura',apellido:'De Jesus',cedula:'001-6548518-5',grupo:'06',agencia:'676',tipo:'Premium',turno:'Matutino',fechaEntrada:'2023-03-20',fechaNacimiento:'2000-04-05',salario:'20000',celular:'809-567-5424',estadoLaboral:'Activa',salud:'Sí',saludDescripcion:'Hernia discal lumbar',observacionGeneral:'Operadora premium con buen desempeño y seguimiento mensual.',certificaciones:[{tipo:'Médica',fechaInicio:'2024-04-24',fechaFin:'2024-04-30',emitidoPor:'Instituto medicalnat',motivo:'Dengue',comentario:'Reposo médico aprobado',documento:'PDF',usuario:'etperez@grupoortiz.com.do'}],vacaciones:[{anio:'2026',fechaEnvio:'2026-02-24',tipo:'Mixta',diasLibres:'4',diasPagados:'4',desde:'2026-04-21',hasta:'2026-04-25',archivo:'PDF',comentario:'Vacaciones aprobadas',usuario:'etperez@grupoortiz.com.do'}],incentivos:[{pago:'Nómina',monto:'1000',fecha:'2024-03-10',estatus:'Pagado',comentario:'Bono por cumplimiento',archivo:'PDF',usuario:'peramos@grupoortiz.com.do'}],faltantes:[{fecha:'2026-03-02',detalle:'Faltante en caja detectado al cierre',monto:'350',estatus:'En proceso',usuario:'supervision@grupoortiz.com.do'}],observaciones:[{fecha:'2026-02-18',detalle:'Buen trato al cliente y excelente puntualidad.',usuario:'rrhh@grupoortiz.com.do'}],visitas:[{fecha:'2026-03-12',tipo:'Supervisión',comentario:'Agencia en orden y operación correcta.',usuario:'supervision@grupoortiz.com.do'}]},
    {id:'opx-2',nombre:'Carmen',apellido:'Santos',cedula:'001-5899758-5',grupo:'08',agencia:'705',tipo:'Normal',turno:'Vespertino',fechaEntrada:'2018-11-20',fechaNacimiento:'1994-09-12',salario:'18000',celular:'809-444-7721',estadoLaboral:'Vacaciones',salud:'No',saludDescripcion:'',observacionGeneral:'Operadora con alta experiencia.',certificaciones:[{tipo:'Familiar',fechaInicio:'2025-06-10',fechaFin:'2025-06-12',emitidoPor:'Instituto La Niñez',motivo:'Gestión familiar',comentario:'Documento cargado',documento:'PDF',usuario:'peramos@grupoortiz.com.do'}],vacaciones:[],incentivos:[{pago:'Efectivo',monto:'350',fecha:'2023-09-06',estatus:'En proceso',comentario:'Apoyo operativo',archivo:'PDF',usuario:'peramos@grupoortiz.com.do'}],faltantes:[],observaciones:[{fecha:'2026-01-05',detalle:'Necesita seguimiento en cuadre de cierre.',usuario:'rrhh@grupoortiz.com.do'}],visitas:[]},
    {id:'opx-3',nombre:'Ana',apellido:'Rosario',cedula:'402-5897458-4',grupo:'06',agencia:'676',tipo:'Premium',turno:'Matutino',fechaEntrada:'2022-03-09',fechaNacimiento:'1998-07-28',salario:'22000',celular:'809-321-4456',estadoLaboral:'Activa',salud:'No',saludDescripcion:'',observacionGeneral:'Alto rendimiento en ventas.',certificaciones:[],vacaciones:[],incentivos:[],faltantes:[],observaciones:[],visitas:[]}
  ];
}
function opxGroupOptions(){
  const fromSystem = opxSafeGrupos().map(g=>String(g.numero||g.nombre||'').replace('Grupo ','').trim()).filter(Boolean);
  const fromData = opxOperadoras.map(o=>String(o.grupo||'').trim()).filter(Boolean);
  return ['', ...Array.from(new Set([...fromSystem, ...fromData])).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))];
}
function opxAgencyOptions(){
  const fromSystem = opxSafeAgencias().map(a=>String(a.numero||a.agencia||'')).filter(Boolean);
  const fromData = opxOperadoras.map(o=>String(o.agencia||'')).filter(Boolean);
  return ['', ...Array.from(new Set([...fromSystem, ...fromData])).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))];
}
function opxPopulateFilters(){
  const grupoSel=document.getElementById('opxFilterGrupo');
  const agenciaSel=document.getElementById('opxFilterAgencia');
  const estadoSel=document.getElementById('opxFilterEstadoLaboral');
  if(!grupoSel || !agenciaSel) return;
  const currentGrupo=grupoSel.value, currentAgencia=agenciaSel.value, currentEstado=estadoSel?.value || '';
  grupoSel.innerHTML = opxGroupOptions().map(v=>`<option value="${v}">${v?`Grupo ${v}`:'Todos'}</option>`).join('');
  agenciaSel.innerHTML = opxAgencyOptions().map(v=>`<option value="${v}">${v||'Todas'}</option>`).join('');
  if(estadoSel) estadoSel.innerHTML = `<option value="">Todos</option>${['Activa','Vacaciones','Licencia','Cancelada/o','Abandono','Renuncia'].map(v=>`<option value="${v}">${v}</option>`).join('')}`;
  grupoSel.value=currentGrupo; agenciaSel.value=currentAgencia; if(estadoSel) estadoSel.value=currentEstado;
}
function opxApplyFilters(){
  const quick=(document.getElementById('opxFilterQuick')?.value||'').trim().toLowerCase();
  const nombre=(document.getElementById('opxFilterNombre')?.value||'').trim().toLowerCase();
  const cedula=(document.getElementById('opxFilterCedula')?.value||'').trim().toLowerCase();
  const grupo=document.getElementById('opxFilterGrupo')?.value||'';
  const agencia=document.getElementById('opxFilterAgencia')?.value||'';
  const tipo=document.getElementById('opxFilterTipo')?.value||'';
  const turno=document.getElementById('opxFilterTurno')?.value||'';
  const estado=document.getElementById('opxFilterEstadoLaboral')?.value||'';
  const tiempo=document.getElementById('opxFilterTiempo')?.value||'';
  const edad=document.getElementById('opxFilterEdad')?.value||'';
  opxFiltered = opxOperadoras.filter(o=>{
    const full = `${o.nombre} ${o.apellido}`.toLowerCase();
    const searchable = `${o.nombre} ${o.apellido} ${o.cedula||''} ${o.grupo||''} grupo ${o.grupo||''} ${o.agencia||''} agencia ${o.agencia||''} ${o.turno||''} ${o.estadoLaboral||''}`.toLowerCase();
    const months = opxMonthsSince(o.fechaEntrada); const yearsAge = opxAge(o.fechaNacimiento);
    if(quick && !searchable.includes(quick)) return false;
    if(nombre && !full.includes(nombre)) return false;
    if(cedula && !String(o.cedula).toLowerCase().includes(cedula)) return false;
    if(grupo && String(o.grupo)!==grupo) return false;
    if(agencia && String(o.agencia)!==agencia) return false;
    if(tipo && o.tipo!==tipo) return false;
    if(turno && o.turno!==turno) return false;
    if(estado && o.estadoLaboral!==estado) return false;
    if(tiempo){ const [a,b]=tiempo.split('-').map(Number); if(months<a || months>b) return false; }
    if(edad){ const [a,b]=edad.split('-').map(Number); if(yearsAge<a || yearsAge>b) return false; }
    return true;
  });
  opxRender();
}
function opxResetFilters(){
  ['opxFilterQuick','opxFilterNombre','opxFilterCedula'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['opxFilterGrupo','opxFilterAgencia','opxFilterTipo','opxFilterTurno','opxFilterTiempo','opxFilterEdad','opxFilterEstadoLaboral'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  opxApplyFilters();
}
function opxSetEstadoFilter(estado){
  const el=document.getElementById('opxFilterEstadoLaboral');
  if(el) el.value=estado||'';
  opxApplyFilters();
}
function opxRender(){
  const data = Array.isArray(opxFiltered) ? opxFiltered : opxOperadoras;
  const countEl=document.getElementById('opxTableCount');
  if(countEl) countEl.textContent = `${data.length} resultado${data.length!==1?'s':''}`;
  const body=document.getElementById('opxTableBody');
  if(!body) return;
  if(!data.length){ body.innerHTML=`<tr><td colspan="9"><div class="opx-empty">No hay empleados/as que coincidan con la consulta.</div></td></tr>`; }
  else {
    body.innerHTML = data.map((o,i)=>{
      const meses=opxMonthsSince(o.fechaEntrada), full=`${o.nombre} ${o.apellido}`.trim();
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${full}</strong></td>
        <td>${o.cedula||'-'}</td>
        <td>${o.grupo?`Grupo ${o.grupo}`:'-'}</td>
        <td>${o.agencia||'-'}</td>
        <td>${o.turno||'-'}</td>
        <td>${opxHumanMonths(meses)}</td>
        <td><span class="opx-badge ${opxEstadoBadgeClass(o.estadoLaboral)}">${o.estadoLaboral}</span></td>
        <td><div class="opx-mini-actions">
          <button class="opx-icon-btn" title="Ver expediente" onclick="opxOpenDetail('${o.id}')"><i class="fas fa-eye"></i></button>
          <button class="opx-icon-btn" title="Editar" onclick="opxOpenEdit('${o.id}')"><i class="fas fa-pen"></i></button>
          <button class="opx-icon-btn" title="Eliminar" onclick="opxDeleteOperadora('${o.id}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }
  opxRenderDashboard();
}
function opxRenderDashboard(){
  const total=opxOperadoras.length;
  const activas=opxOperadoras.filter(o=>String(o.estadoLaboral||'').toLowerCase().includes('activa')).length;
  const vacaciones=opxOperadoras.filter(o=>String(o.estadoLaboral||'').toLowerCase().includes('vac')).length;
  const premium=opxOperadoras.filter(o=>o.tipo==='Premium').length;
  const mat=opxOperadoras.filter(o=>o.turno==='Matutino').length;
  const agenciasCount = new Set(opxOperadoras.map(o=>String(o.agencia||'').trim()).filter(Boolean)).size;
  const gruposCount = new Set(opxOperadoras.map(o=>String(o.grupo||'').trim()).filter(Boolean)).size;
  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('opxHeroTotal',total); set('opxHeroActivas',activas); set('opxHeroGrupos',gruposCount); set('opxHeroAgencias',agenciasCount);
  set('opxHeroPremium',premium); set('opxHeroMatutino',mat);
  set('opxKpiTotal',total); set('opxKpiActivas',activas); set('opxKpiVacaciones',vacaciones); set('opxKpiAgencias',agenciasCount);
  set('opxKpiPremium',premium);
  const groups={}; opxOperadoras.forEach(o=>{ const k=String(o.grupo||'Sin grupo').trim()||'Sin grupo'; groups[k]=(groups[k]||0)+1; });
  const max=Math.max(1,...Object.values(groups));
  const bars=document.getElementById('opxGroupBars');
  if(bars) bars.innerHTML = Object.keys(groups).sort((a,b)=>groups[b]-groups[a]).map(k=>`<div class="opx-bar-row"><div class="opx-bar-label">${k==='Sin grupo'?k:`Grupo ${k}`}</div><div class="opx-bar-track"><div class="opx-bar-fill" style="width:${(groups[k]/max)*100}%"></div></div><div class="opx-bar-value">${groups[k]} empleada${groups[k]!==1?'s':''}</div></div>`).join('') || `<div class="opx-empty">Sin datos por grupo.</div>`;
}
function opxGetById(id){ return opxOperadoras.find(o=>o.id===id); }
function opxDeleteOperadora(id){
  if(!confirm('¿Eliminar esta operadora?')) return;
  opxOperadoras = opxOperadoras.filter(o=>o.id!==id); opxSave(); opxApplyFilters();
}
function opxOpenDetail(id){
  opxCurrentId=id; opxTab='general';
  const o=opxGetById(id); if(!o) return;
  const full=`${o.nombre} ${o.apellido}`.trim();
  const edad=opxAge(o.fechaNacimiento), meses=opxMonthsSince(o.fechaEntrada);
  let modal=document.getElementById('opxDetailModal');
  if(!modal){
    document.body.insertAdjacentHTML('beforeend', `<div class="opx-modal" id="opxDetailModal"><div class="opx-dialog"><div class="opx-modal-head"><div><h3 id="opxDetailTitle"></h3><p id="opxDetailSubtitle"></p></div><button class="opx-close" onclick="opxCloseDetail()"><i class="fas fa-xmark"></i></button></div><div class="opx-modal-body" id="opxDetailBody"></div><div class="opx-modal-actions"><div class="opx-muted">Expediente interno de RRHH</div><div class="opx-actions"><button class="opx-btn light" onclick="opxCloseDetail()">Cerrar</button><button class="opx-btn primary" onclick="opxOpenEdit(opxCurrentId)">Editar operadora</button></div></div></div></div>`);
    modal=document.getElementById('opxDetailModal');
  }
  document.getElementById('opxDetailTitle').textContent=full;
  document.getElementById('opxDetailSubtitle').textContent=`Grupo ${o.grupo||'-'} · Agencia ${o.agencia||'-'} · ${o.tipo||'-'} · ${o.turno||'-'}`;
  document.getElementById('opxDetailBody').innerHTML = `
    <div class="opx-profile">
      <div class="opx-photo-card">
        <div class="opx-photo-box">${o.foto?`<img src="${o.foto}" alt="${full}">`:'Foto personal'}</div>
        <div class="opx-photo-actions"><button class="opx-btn primary" type="button" onclick="opxOpenEdit('${o.id}')"><i class="fas fa-camera"></i> Cambiar foto</button></div>
        <div class="opx-inline-info" style="margin-top:12px"><span class="opx-info-chip"><i class="fas fa-id-card"></i> ${o.cedula||'Sin cédula'}</span><span class="opx-info-chip"><i class="fas fa-phone"></i> ${o.celular||'Sin celular'}</span></div>
      </div>
      <div class="opx-section">
        <div class="opx-detail-grid">
          <div class="opx-detail-item"><span class="k">Nombre completo</span><span class="v">${full}</span></div>
          <div class="opx-detail-item"><span class="k">Fecha de entrada</span><span class="v">${o.fechaEntrada||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Tiempo laborando</span><span class="v">${opxHumanMonths(meses)}</span></div>
          <div class="opx-detail-item"><span class="k">Fecha de nacimiento</span><span class="v">${o.fechaNacimiento||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Edad</span><span class="v">${edad?edad+' años':'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Estado laboral</span><span class="v">${o.estadoLaboral||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Tipo</span><span class="v">${o.tipo||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Turno</span><span class="v">${o.turno||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Salario</span><span class="v">${o.salario?`$${Number(o.salario).toLocaleString('en-US')}`:'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Grupo</span><span class="v">${o.grupo?`Grupo ${o.grupo}`:'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Agencia</span><span class="v">${o.agencia||'-'}</span></div>
          <div class="opx-detail-item"><span class="k">Condición de salud</span><span class="v">${o.salud||'No'}${o.saludDescripcion?` · ${o.saludDescripcion}`:''}</span></div>
          <div class="opx-detail-item" style="grid-column:1/-1"><span class="k">Observación general</span><span class="v">${o.observacionGeneral||'Sin observaciones generales.'}</span></div>
        </div>
      </div>
    </div>
    <div class="opx-section">
      <div class="opx-tabs">
        ${[['general','General'],['certificaciones','Certificaciones'],['vacaciones','Vacaciones'],['incentivo','Incentivo'],['faltantes','Faltantes'],['observacion','Observación'],['visita','Visita']].map(([k,l])=>`<button class="opx-tab ${k==='general'?'active':''}" data-tab="${k}" onclick="opxSwitchTab('${k}',this)">${l}</button>`).join('')}
      </div>
      <div id="opxTabGeneral" class="opx-tabpane active" style="margin-top:16px"><div class="opx-empty">Usa las demás pestañas para ver y agregar registros del expediente.</div></div>
      <div id="opxTabCertificaciones" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.certificaciones,['Tipo','Inicio','Fin','Emitido por','Documento','Usuario'],r=>[r.tipo,r.fechaInicio,r.fechaFin,r.emitidoPor,r.documento||'-',r.usuario||'-'])}${opxRenderSimpleForm('certificaciones')}</div>
      <div id="opxTabVacaciones" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.vacaciones,['Año','Fecha envío','Vacaciones','Días libres','Días pagados','Usuario'],r=>[r.anio,r.fechaEnvio,r.tipo,r.diasLibres,r.diasPagados,r.usuario||'-'])}${opxRenderSimpleForm('vacaciones')}</div>
      <div id="opxTabIncentivo" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.incentivos,['Pago','Monto','Fecha','Estatus','Usuario'],r=>[r.pago,r.monto?`$${r.monto}`:'-',r.fecha,r.estatus,r.usuario||'-'])}${opxRenderSimpleForm('incentivo')}</div>
      <div id="opxTabFaltantes" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.faltantes,['Fecha','Detalle','Monto','Estatus','Usuario'],r=>[r.fecha,r.detalle,r.monto?`$${r.monto}`:'-',r.estatus||'-',r.usuario||'-'])}${opxRenderSimpleForm('faltantes')}</div>
      <div id="opxTabObservacion" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.observaciones,['Fecha','Detalle','Usuario'],r=>[r.fecha,r.detalle,r.usuario||'-'])}${opxRenderSimpleForm('observacion')}</div>
      <div id="opxTabVisita" class="opx-tabpane" style="margin-top:16px">${opxRenderTabTable(o.visitas,['Fecha','Tipo','Comentario','Usuario'],r=>[r.fecha,r.tipo,r.comentario,r.usuario||'-'])}${opxRenderSimpleForm('visita')}</div>
    </div>`;
  modal.classList.add('open');
}
function opxRenderTabTable(items, headers, mapper){
  if(!items || !items.length) return `<div class="opx-empty">No hay registros todavía en esta pestaña.</div>`;
  return `<div class="opx-section"><div class="opx-table-wrap"><table class="opx-subtable"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr>${mapper(row).map(v=>`<td>${v||'-'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function opxRenderSimpleForm(type){
  const map={
    certificaciones:`<div class="opx-two-col"><div class="opx-section"><div class="opx-field"><label>Tipo de certificación</label><input id="opxFormCertTipo"></div><div class="opx-field"><label>Fecha de inicio</label><input type="date" id="opxFormCertInicio"></div><div class="opx-field"><label>Fecha de finalización</label><input type="date" id="opxFormCertFin"></div></div><div class="opx-section"><div class="opx-field"><label>Emitido por</label><input id="opxFormCertEmitido"></div><div class="opx-field"><label>Motivo / comentario</label><textarea id="opxFormCertComentario"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('certificaciones')">Crear certificación</button></div></div>`,
    vacaciones:`<div class="opx-two-col"><div class="opx-section"><div class="opx-field"><label>Año</label><input id="opxFormVacAnio"></div><div class="opx-field"><label>Fecha de envío</label><input type="date" id="opxFormVacEnvio"></div><div class="opx-field"><label>Tipo de vacaciones</label><input id="opxFormVacTipo"></div></div><div class="opx-section"><div class="opx-field"><label>Días libres</label><input id="opxFormVacLibres"></div><div class="opx-field"><label>Días pagados</label><input id="opxFormVacPagados"></div><div class="opx-field"><label>Comentario</label><textarea id="opxFormVacComentario"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('vacaciones')">Crear vacaciones</button></div></div>`,
    incentivo:`<div class="opx-two-col"><div class="opx-section"><div class="opx-field"><label>Pago</label><input id="opxFormIncPago"></div><div class="opx-field"><label>Monto</label><input id="opxFormIncMonto"></div></div><div class="opx-section"><div class="opx-field"><label>Fecha</label><input type="date" id="opxFormIncFecha"></div><div class="opx-field"><label>Estatus</label><input id="opxFormIncEstatus"></div><div class="opx-field"><label>Comentario</label><textarea id="opxFormIncComentario"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('incentivos')">Crear incentivo</button></div></div>`,
    faltantes:`<div class="opx-two-col"><div class="opx-section"><div class="opx-field"><label>Fecha</label><input type="date" id="opxFormFalFecha"></div><div class="opx-field"><label>Monto</label><input id="opxFormFalMonto"></div></div><div class="opx-section"><div class="opx-field"><label>Estatus</label><input id="opxFormFalEstatus"></div><div class="opx-field"><label>Detalle</label><textarea id="opxFormFalDetalle"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('faltantes')">Crear faltante</button></div></div>`,
    observacion:`<div class="opx-section"><div class="opx-field"><label>Observación</label><textarea id="opxFormObsDetalle"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('observaciones')">Agregar observación</button></div>`,
    visita:`<div class="opx-two-col"><div class="opx-section"><div class="opx-field"><label>Fecha</label><input type="date" id="opxFormVisFecha"></div><div class="opx-field"><label>Tipo</label><input id="opxFormVisTipo"></div></div><div class="opx-section"><div class="opx-field"><label>Comentario</label><textarea id="opxFormVisComentario"></textarea></div><button class="opx-btn primary" onclick="opxAddRecord('visitas')">Agregar visita</button></div></div>`
  };
  return map[type] || '';
}
function opxSwitchTab(tab,el){
  document.querySelectorAll('#opxDetailBody .opx-tab').forEach(btn=>btn.classList.remove('active'));
  if(el) el.classList.add('active');
  document.querySelectorAll('#opxDetailBody .opx-tabpane').forEach(p=>p.classList.remove('active'));
  const id='opxTab'+tab.charAt(0).toUpperCase()+tab.slice(1);
  const pane=document.getElementById(id); if(pane) pane.classList.add('active');
}
function opxCloseDetail(){ document.getElementById('opxDetailModal')?.classList.remove('open'); }

function opxSetEditPhotoPreview(src=''){
  const box=document.getElementById('opxEditPhotoPreview');
  if(!box) return;
  box.innerHTML = src ? `<img src="${src}" alt="Foto operadora">` : 'Foto personal';
}
function opxBindEditPhotoInput(){
  const input=document.getElementById('opxEditFotoFile');
  if(!input || input.dataset.bound==='1') return;
  input.dataset.bound='1';
  input.addEventListener('change', (ev)=>{
    const file=ev.target.files && ev.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const modal=document.getElementById('opxEditModal');
      if(modal) modal.dataset.photo = e.target?.result || '';
      opxSetEditPhotoPreview(modal?.dataset.photo || '');
    };
    reader.readAsDataURL(file);
  });
}
function opxRemoveEditPhoto(){
  const modal=document.getElementById('opxEditModal');
  if(modal) modal.dataset.photo='';
  const input=document.getElementById('opxEditFotoFile');
  if(input) input.value='';
  opxSetEditPhotoPreview('');
}
function opxOpenEdit(id=''){
  const o=id?opxGetById(id):null;
  let modal=document.getElementById('opxEditModal');
  if(!modal){
    document.body.insertAdjacentHTML('beforeend', `<div class="opx-modal" id="opxEditModal"><div class="opx-dialog"><div class="opx-modal-head"><div><h3 id="opxEditTitle">Nueva operadora</h3><p>Completa el expediente base de RRHH.</p></div><button class="opx-close" onclick="opxCloseEdit()"><i class="fas fa-xmark"></i></button></div><div class="opx-modal-body"><div class="opx-profile"><div class="opx-photo-preview-card"><div class="opx-photo-preview-box" id="opxEditPhotoPreview">Foto personal</div><input type="file" id="opxEditFotoFile" class="opx-hidden-file" accept="image/*"><div class="opx-photo-actions"><button class="opx-btn primary" type="button" onclick="document.getElementById('opxEditFotoFile').click()"><i class="fas fa-upload"></i> Subir / cambiar foto</button><button class="opx-btn light" type="button" onclick="opxRemoveEditPhoto()"><i class="fas fa-trash"></i> Quitar foto</button></div><div class="opx-muted">Puedes actualizar la imagen directamente desde Gestión de Operadoras.</div></div><div class="opx-section"><div class="opx-detail-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="opx-field"><label>Nombre</label><input id="opxEditNombre"></div>
      <div class="opx-field"><label>Apellido</label><input id="opxEditApellido"></div>
      <div class="opx-field"><label>Cédula</label><input id="opxEditCedula"></div>
      <div class="opx-field"><label>Grupo</label><input id="opxEditGrupo"></div>
      <div class="opx-field"><label>Agencia</label><input id="opxEditAgencia"></div>
      <div class="opx-field"><label>Tipo</label><select id="opxEditTipo"><option>Normal</option><option>Premium</option></select></div>
      <div class="opx-field"><label>Turno</label><select id="opxEditTurno"><option>Matutino</option><option>Vespertino</option><option>Nocturno</option></select></div>
      <div class="opx-field"><label>Estado laboral</label><select id="opxEditEstado"><option>Activa</option><option>Vacaciones</option><option>Licencia</option><option>Cancelada/o</option><option>Abandono</option><option>Renuncia</option></select></div>
      <div class="opx-field"><label>Fecha de entrada</label><input type="date" id="opxEditEntrada"></div>
      <div class="opx-field"><label>Fecha de nacimiento</label><input type="date" id="opxEditNacimiento"></div>
      <div class="opx-field"><label>Salario</label><input id="opxEditSalario"></div>
      <div class="opx-field"><label>Celular</label><input id="opxEditCelular"></div>
      <div class="opx-field"><label>Condición de salud</label><select id="opxEditSalud"><option>No</option><option>Sí</option></select></div>
      <div class="opx-field"><label>Descripción de salud</label><input id="opxEditSaludDesc"></div>
      <div class="opx-field" style="grid-column:1/-1"><label>Observación general</label><textarea id="opxEditObservacion"></textarea></div>
    </div></div></div></div><div class="opx-modal-actions"><div class="opx-muted">Se guarda local para pruebas</div><div class="opx-actions"><button class="opx-btn light" onclick="opxCloseEdit()">Cancelar</button><button class="opx-btn primary" onclick="opxSaveEdit()">Guardar</button></div></div></div></div>`);
    modal=document.getElementById('opxEditModal');
  }
  modal.dataset.id=id||'';
  document.getElementById('opxEditTitle').textContent=id?'Editar operadora':'Nueva operadora';
  const fill=(id,v)=>document.getElementById(id).value=v||'';
  fill('opxEditNombre',o?.nombre); fill('opxEditApellido',o?.apellido); fill('opxEditCedula',o?.cedula); fill('opxEditGrupo',o?.grupo); fill('opxEditAgencia',o?.agencia);
  fill('opxEditTipo',o?.tipo||'Normal'); fill('opxEditTurno',o?.turno||'Matutino'); fill('opxEditEstado',o?.estadoLaboral||'Activa'); fill('opxEditEntrada',o?.fechaEntrada||opxTodayISO()); fill('opxEditNacimiento',o?.fechaNacimiento||'2000-01-01'); fill('opxEditSalario',o?.salario); fill('opxEditCelular',o?.celular); fill('opxEditSalud',o?.salud||'No'); fill('opxEditSaludDesc',o?.saludDescripcion); fill('opxEditObservacion',o?.observacionGeneral);
  modal.dataset.photo=o?.foto||'';
  opxBindEditPhotoInput();
  const photoInput=document.getElementById('opxEditFotoFile'); if(photoInput) photoInput.value='';
  opxSetEditPhotoPreview(modal.dataset.photo||'');
  modal.classList.add('open');
}
function opxCloseEdit(){ document.getElementById('opxEditModal')?.classList.remove('open'); }
function opxSaveEdit(){
  const modal=document.getElementById('opxEditModal'); const id=modal?.dataset.id||'';
  const obj=id?opxGetById(id):{id:`opx-${Date.now()}`,certificaciones:[],vacaciones:[],incentivos:[],faltantes:[],observaciones:[],visitas:[],foto:'',cv:'',documentoCedula:''};
  obj.nombre=document.getElementById('opxEditNombre').value.trim();
  obj.apellido=document.getElementById('opxEditApellido').value.trim();
  obj.cedula=document.getElementById('opxEditCedula').value.trim();
  obj.grupo=document.getElementById('opxEditGrupo').value.trim();
  obj.agencia=document.getElementById('opxEditAgencia').value.trim();
  obj.tipo=document.getElementById('opxEditTipo').value;
  obj.turno=document.getElementById('opxEditTurno').value;
  obj.estadoLaboral=document.getElementById('opxEditEstado').value;
  obj.fechaEntrada=document.getElementById('opxEditEntrada').value;
  obj.fechaNacimiento=document.getElementById('opxEditNacimiento').value;
  obj.salario=document.getElementById('opxEditSalario').value.trim();
  obj.celular=document.getElementById('opxEditCelular').value.trim();
  obj.salud=document.getElementById('opxEditSalud').value;
  obj.saludDescripcion=document.getElementById('opxEditSaludDesc').value.trim();
  obj.observacionGeneral=document.getElementById('opxEditObservacion').value.trim();
  obj.foto=modal?.dataset.photo || obj.foto || '';
  if(!obj.nombre || !obj.apellido){ alert('Completa nombre y apellido.'); return; }
  if(id){ opxOperadoras = opxOperadoras.map(o=>o.id===id?obj:o); }
  else { opxOperadoras.unshift(obj); }
  opxSave(); opxPopulateFilters(); opxApplyFilters(); opxCloseEdit();
}
function opxAddRecord(type){
  const o=opxGetById(opxCurrentId); if(!o) return;
  const user='rrhh@grupoortiz.com.do';
  if(type==='certificaciones') o.certificaciones.unshift({tipo:document.getElementById('opxFormCertTipo').value,fechaInicio:document.getElementById('opxFormCertInicio').value,fechaFin:document.getElementById('opxFormCertFin').value,emitidoPor:document.getElementById('opxFormCertEmitido').value,motivo:'',comentario:document.getElementById('opxFormCertComentario').value,documento:'PDF',usuario:user});
  if(type==='vacaciones') o.vacaciones.unshift({anio:document.getElementById('opxFormVacAnio').value,fechaEnvio:document.getElementById('opxFormVacEnvio').value,tipo:document.getElementById('opxFormVacTipo').value,diasLibres:document.getElementById('opxFormVacLibres').value,diasPagados:document.getElementById('opxFormVacPagados').value,comentario:document.getElementById('opxFormVacComentario').value,usuario:user});
  if(type==='incentivos') o.incentivos.unshift({pago:document.getElementById('opxFormIncPago').value,monto:document.getElementById('opxFormIncMonto').value,fecha:document.getElementById('opxFormIncFecha').value,estatus:document.getElementById('opxFormIncEstatus').value,comentario:document.getElementById('opxFormIncComentario').value,usuario:user});
  if(type==='faltantes') o.faltantes.unshift({fecha:document.getElementById('opxFormFalFecha').value,monto:document.getElementById('opxFormFalMonto').value,estatus:document.getElementById('opxFormFalEstatus').value,detalle:document.getElementById('opxFormFalDetalle').value,usuario:user});
  if(type==='observaciones') o.observaciones.unshift({fecha:opxTodayISO(),detalle:document.getElementById('opxFormObsDetalle').value,usuario:user});
  if(type==='visitas') o.visitas.unshift({fecha:document.getElementById('opxFormVisFecha').value,tipo:document.getElementById('opxFormVisTipo').value,comentario:document.getElementById('opxFormVisComentario').value,usuario:user});
  opxSave(); opxApplyFilters(); opxOpenDetail(opxCurrentId);
}
function opxSeedIfEmpty(){ if(opxOperadoras.length) { opxApplyFilters(); return; } opxOperadoras = opxDefaultData(); opxSave(); opxPopulateFilters(); opxApplyFilters(); }
function opxExportCSV(){
  const rows=(opxFiltered?.length?opxFiltered:opxOperadoras).map((o,i)=>({No:i+1,Nombre:`${o.nombre} ${o.apellido}`.trim(),Cedula:o.cedula,Grupo:o.grupo,Agencia:o.agencia,Tipo:o.tipo,Turno:o.turno,Edad:opxAge(o.fechaNacimiento),Tiempo_laborando:opxHumanMonths(opxMonthsSince(o.fechaEntrada)),Estado:o.estadoLaboral,Salario:o.salario,Celular:o.celular}));
  if(!rows.length){ alert('No hay datos para exportar.'); return; }
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(','), ...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='operadoras.csv'; a.click(); URL.revokeObjectURL(url);
}
function opxInit(){
  opxLoad(); opxPopulateFilters(); opxFiltered=[...opxOperadoras]; opxRender();
}
window.addEventListener('DOMContentLoaded', opxInit);


const LEV_STORAGE_KEY = 'loteka_operaciones_levantamientos_v2';
const LEV_CATEGORIES = ['Arqueo de agencia','Chequeo operativo','Reparación y estética de cables','Levantamiento técnico','Levantamiento comercial','Otro'];
const LEV_STATE_OPTIONS = ['Buen Estado','Aceptable','Regular','Mal Estado','Crítico'];
const LEV_DIAG_OPTIONS = ['Excelente','Bueno','Aceptable','Regular','Crítico'];
const LEV_EQUIPMENT_STATE_OPTIONS = ['Buen Estado','Aceptable','Regular','Mal Estado','Crítico','No tiene'];
const LEV_AVAILABILITY_OPTIONS = ['Sí tiene','No tiene','No aplica'];
const LEV_STRUCTURE_FIELDS = ['Toldo','Pecho','Publicidades','Pintura / Filtraciones','Piso','Hierros / Cristales','Puerta enrollable / Eléctrica','Caja registradora / Gaveta','Abanico','Taburete'];
const LEV_ELECTRICAL_FIELDS = ['Cables de la calle','Estructura eléctrica','Conectores','Fuentes y cables de equipos','Luces'];
const LEV_EQUIPMENT_FIELDS = [
  {name:'Inversor', photoLabel:'Foto de inversor'},
  {name:'Baterías', photoLabel:'Foto de baterías'},
  {name:'Máquina de venta', photoLabel:''},
  {name:'Printer', photoLabel:''},
  {name:'Scanner', photoLabel:''},
  {name:'2da Pantalla', photoLabel:''},
  {name:'Pantalla ATM', photoLabel:''}
];
const LEV_GALLERY_FIELDS = ['Exterior de la agencia','Zona de cliente','Zona de empleada','Equipo: Inversor','Equipo: Baterías'];
let levRecords = [];
let levFiltered = [];
let levEditingId = null;

function levNow(){ return new Date().toISOString(); }
function levToday(){ return new Date().toISOString().slice(0,10); }
function levSafe(v){ return String(v ?? '').trim(); }
function levSlug(v){ return levSafe(v).toLowerCase(); }
function levFmtDate(v){ if(!v) return '-'; const d = new Date(v.length===10 ? `${v}T00:00:00` : v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function levFmtDateTime(v){ if(!v) return '-'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function levCode(index){ return `LEV-${new Date().getFullYear()}-${String(index).padStart(4,'0')}`; }
function levBadgeClass(value){ const s = levSlug(value); if(s.includes('complet')) return 'green'; if(s.includes('proceso')) return 'blue'; if(s.includes('aprob')) return 'gold'; if(s.includes('revis')) return 'blue'; if(s.includes('pend')) return 'gray'; return 'gray'; }
function levPriorityClass(value){ const s = levSlug(value); if(s.includes('urg')) return 'red'; if(s.includes('alta')) return 'gold'; if(s.includes('media')) return 'blue'; return 'gray'; }
function levStateClass(value){ const s = levSlug(value); if(s.includes('buen')) return 'good'; if(s.includes('acept')) return 'ok'; if(s.includes('reg')) return 'warn'; if(s.includes('critic') || s.includes('malo') || s.includes('dañ')) return 'bad'; return 'ok'; }
function levStateOptions(options, selected=''){ return options.map(option => `<option value="${option}" ${String(selected||'')===option ? 'selected' : ''}>${option}</option>`).join(''); }
function levSelect(id, options){ const select = document.getElementById(id); if(select) select.innerHTML = levStateOptions(options, select.value || select.dataset.default || ''); }
function levKey(v){ return levSlug(v).replace(/[^a-z0-9]+/g,'_'); }
function levGetRow(rows, key, field='item'){ return Array.isArray(rows) ? rows.find(row => row && row[field] === key) : null; }
function levEstimateOverall(structure, electrical, equipment){
  const values = [];
  [...(structure||[]), ...(electrical||[]), ...(equipment||[])].forEach(row => {
    const value = row?.state || row?.available || '';
    if(value && !String(value).toLowerCase().includes('sí tiene')) values.push(String(value));
  });
  if(values.some(v => /cr[ií]tic|mal estado/i.test(v))) return 'Requiere atención correctiva';
  if(values.some(v => /regular/i.test(v))) return 'Regular con seguimiento';
  if(values.some(v => /aceptable/i.test(v))) return 'Bueno con observaciones menores';
  return 'Bueno';
}
function levEstimateFindings(structure, electrical, equipment){
  let total = 0;
  [...(structure||[]), ...(electrical||[]), ...(equipment||[])].forEach(row => {
    const value = String(row?.state || row?.available || '');
    if(/aceptable|regular|mal estado|cr[ií]tico/i.test(value)) total += 1;
  });
  return total;
}
function levBuildStructureFromForm(){
  return LEV_STRUCTURE_FIELDS.map(label => ({ item: label, state: document.getElementById(`levStructureState_${levKey(label)}`)?.value || 'Buen Estado' }));
}
function levBuildElectricalFromForm(){
  return LEV_ELECTRICAL_FIELDS.map(label => ({ item: label, state: document.getElementById(`levElectricalState_${levKey(label)}`)?.value || 'Buen Estado' }));
}
function levBuildEquipmentFromForm(){
  return LEV_EQUIPMENT_FIELDS.map(field => ({ name: field.name, available: document.getElementById(`levEquipmentAvail_${levKey(field.name)}`)?.value || 'Sí tiene', description: document.getElementById(`levEquipmentDesc_${levKey(field.name)}`)?.value || '', state: document.getElementById(`levEquipmentState_${levKey(field.name)}`)?.value || 'Buen Estado', photoLabel: document.getElementById(`levEquipmentPhoto_${levKey(field.name)}`)?.value || field.photoLabel || '', photoUrl: '' }));
}
function levBuildGalleryFromForm(){
  return LEV_GALLERY_FIELDS.map(label => ({ label, url: document.getElementById(`levGallery_${levKey(label)}`)?.value || '' })).filter(item => item.url || item.label);
}
function levSetSelectValue(id, value, fallback=''){ const el = document.getElementById(id); if(el) el.value = value || fallback || el.value || ''; }
function levSetValue(id, value=''){ const el = document.getElementById(id); if(el) el.value = value || ''; }
function levResetImageField(key){ const hidden = document.getElementById(`levGallery_${key}`); const file = document.getElementById(`levGalleryFile_${key}`); const img = document.getElementById(`levGalleryPreview_${key}`); const empty = document.getElementById(`levGalleryEmpty_${key}`); if(hidden) hidden.value=''; if(file) file.value=''; if(img){ img.src=''; img.style.display='none'; } if(empty) empty.style.display='block'; }
function levApplyImagePreview(key, url=''){ const img = document.getElementById(`levGalleryPreview_${key}`); const empty = document.getElementById(`levGalleryEmpty_${key}`); const hidden = document.getElementById(`levGallery_${key}`); if(hidden) hidden.value = url || ''; if(img){ img.src = url || ''; img.style.display = url ? 'block' : 'none'; } if(empty) empty.style.display = url ? 'none' : 'block'; }
function levHandleImageUpload(input, previewId, hiddenId){ const file = input?.files?.[0]; if(!file) return; const reader = new FileReader(); reader.onload = e => { const url = e.target?.result || ''; const hidden = document.getElementById(hiddenId); const img = document.getElementById(previewId); const empty = document.getElementById(previewId.replace('Preview','Empty')); if(hidden) hidden.value = url; if(img){ img.src = url; img.style.display = url ? 'block' : 'none'; } if(empty) empty.style.display = url ? 'none' : 'block'; }; reader.readAsDataURL(file); }
function levGetAgencias(){ try { return Array.isArray(agencias) ? agencias.map(a => a.codigo || a.nombre || a.agencia).filter(Boolean) : []; } catch(e){ return []; } }
function levGetGrupos(){ try { return Array.isArray(grupos) ? grupos.map(g => g.codigo || g.nombre || g.grupo).filter(Boolean) : []; } catch(e){ return []; } }
function levDemoPhoto(label, url=''){ return { label, url }; }
function levDefaultRecords(){
  const now = levNow();
  return [
    {
      id:'lev-demo-1019', code:'LEV-2026-0001', category:'Arqueo de agencia', type:'Chequeo técnico integral', agency:'1019', group:'42', technician:'Luis Regalado', responsible:'Luis Regalado', visitDate:'2026-04-20', submittedAt:'2026-04-20T15:38:00',
      workflowStatus:'Revisado', overallStatus:'Bueno con observaciones menores', priority:'Media', findingsCount:2, evidenceCount:5,
      executiveSummary:'La agencia 1019 fue inspeccionada satisfactoriamente. La estructura general, el sistema eléctrico y los equipos principales presentan condiciones funcionales. Se identifican puntos aceptables que conviene programar para seguimiento preventivo, sin criticidad inmediata.',
      findings:'Se detectan observaciones menores en puerta enrollable/elétrica, luces y taburete. El resto de los componentes evaluados se mantiene en buen estado.',
      recommendations:'Mantener seguimiento preventivo, reforzar revisión visual de iluminación y confirmar futura intervención estética menor si la agencia presenta desgaste adicional.',
      nextAction:'Registrar seguimiento preventivo en ruta y validar nuevamente en próxima visita de campo.',
      structure:[
        {item:'Toldo', state:'Buen Estado', observation:'Sin novedad visible.'},
        {item:'Pecho', state:'Buen Estado', observation:'Correctamente presentado.'},
        {item:'Publicidades', state:'Buen Estado', observation:'Rotulación estable.'},
        {item:'Pintura / Filtraciones', state:'Buen Estado', observation:'Sin hallazgos relevantes.'},
        {item:'Piso', state:'Buen Estado', observation:'Condición operativa adecuada.'},
        {item:'Hierros / Cristales', state:'Buen Estado', observation:'Sin novedad.'},
        {item:'Puerta enrollable / Eléctrica', state:'Aceptable', observation:'Requiere monitoreo preventivo.'},
        {item:'Caja registradora / Gaveta', state:'Buen Estado', observation:'Funcional y ordenada.'},
        {item:'Abanico', state:'Buen Estado', observation:'Operativo.'},
        {item:'Taburete', state:'Aceptable', observation:'Se sugiere seguimiento por desgaste.'}
      ],
      electrical:[
        {item:'Cables de la calle', state:'Buen Estado', observation:'Sin exposición crítica.'},
        {item:'Estructura eléctrica', state:'Buen Estado', observation:'Estable.'},
        {item:'Conectores', state:'Buen Estado', observation:'Sin daño visible.'},
        {item:'Fuentes y cables de equipos', state:'Buen Estado', observation:'Organización adecuada.'},
        {item:'Luces', state:'Aceptable', observation:'Conviene revisar preventivamente.'}
      ],
      equipment:[
        {name:'Inversor', available:'Sí tiene', description:'Inversor criollo', state:'Buen Estado', photoLabel:'Foto de inversor'},
        {name:'Baterías', available:'Sí tiene', description:'2 baterías Trojan', state:'Buen Estado', photoLabel:'Foto de baterías'},
        {name:'Máquina de venta', available:'Sí tiene', description:'Loteka 4 GEN. (Cuello Ancho)', state:'Buen Estado', photoLabel:''},
        {name:'Printer', available:'Sí tiene', description:'Seewo', state:'Buen Estado', photoLabel:''},
        {name:'Scanner', available:'Sí tiene', description:'Witek', state:'Buen Estado', photoLabel:''},
        {name:'2da Pantalla', available:'Sí tiene', description:'Loteka 32"', state:'Buen Estado', photoLabel:''},
        {name:'Pantalla ATM', available:'No tiene', description:'No aplica en esta agencia', state:'No tiene', photoLabel:''}
      ],
      gallery:[
        levDemoPhoto('Exterior de la agencia',''),
        levDemoPhoto('Zona de cliente',''),
        levDemoPhoto('Zona de empleada',''),
        levDemoPhoto('Equipo: Inversor',''),
        levDemoPhoto('Equipo: Baterías','')
      ],
      agencyObservation:'Agencia en condición operativa general estable. Solo se recomienda seguimiento preventivo en elementos menores reportados.',
      diagnostics:{
        structure:'Bueno', electrical:'Bueno', equipment:'Bueno', incidents:'2 observaciones menores', recommendation:'Seguimiento preventivo'
      },
      actions:[
        {title:'Convertir en trabajo preventivo', description:'Si la supervisión lo considera, crear trabajo para mejorar estética menor y validar iluminación.'},
        {title:'Mantener en seguimiento', description:'Programar nueva revisión en la próxima ruta operativa del grupo 42.'},
        {title:'Cerrar como informativo', description:'Conservar el expediente como evidencia de chequeo satisfactorio.'}
      ],
      createdAt:now, updatedAt:now
    },
    {
      id:'lev-demo-1268', code:'LEV-2026-0002', category:'Reparación y estética de cables', type:'Inspección de cableado y presentación técnica', agency:'1268', group:'44', technician:'Técnico 1', responsible:'Técnico 1', visitDate:levToday(), submittedAt:now,
      workflowStatus:'Aprobado para acción', overallStatus:'Regular con intervención requerida', priority:'Alta', findingsCount:4, evidenceCount:4,
      executiveSummary:'La visita detectó exposición visual de cables en counter y zona de energía. No se observa riesgo crítico inmediato, pero sí una presentación técnica deficiente que debe corregirse para mejorar seguridad visual y orden operativo.',
      findings:'Cableado visible, canaletas incompletas, fuentes con mala presentación y necesidad de organizar rutas.',
      recommendations:'Ejecutar corrección estética completa, ordenar trayectorias, asegurar canaletas y documentar evidencia final.',
      nextAction:'Convertir en trabajo correctivo con evidencia de antes y después.',
      structure:[
        {item:'Área técnica visible', state:'Aceptable', observation:'Se percibe desorden por cableado expuesto.'},
        {item:'Presentación del punto', state:'Aceptable', observation:'Requiere mejoría estética.'}
      ],
      electrical:[
        {item:'Rutas de cables', state:'Regular', observation:'Expuestos parcialmente.'},
        {item:'Canaletas', state:'Regular', observation:'Incompletas.'},
        {item:'Fuentes y adaptadores', state:'Aceptable', observation:'Necesitan mejor organización.'},
        {item:'Conectores', state:'Buen Estado', observation:'Sin daño crítico.'}
      ],
      equipment:[
        {name:'Printer', available:'Sí tiene', description:'Equipo operativo', state:'Buen Estado', photoLabel:''},
        {name:'Scanner', available:'Sí tiene', description:'Operativo', state:'Buen Estado', photoLabel:''}
      ],
      gallery:[levDemoPhoto('Exterior de la agencia',''), levDemoPhoto('Zona de cliente',''), levDemoPhoto('Zona de empleada',''), levDemoPhoto('Equipo: Inversor',''), levDemoPhoto('Equipo: Baterías','')],
      agencyObservation:'Se requiere corrección visual del cableado y ordenamiento técnico para mejorar la presentación general de la agencia.',
      diagnostics:{structure:'Aceptable', electrical:'Regular', equipment:'Bueno', incidents:'4 hallazgos de presentación', recommendation:'Acción correctiva recomendada'},
      actions:[
        {title:'Convertir en trabajo', description:'Crear trabajo de reparación y estética de cables dentro de OPERACIONES.'},
        {title:'Asignar técnico', description:'Dejar responsable con evidencia obligatoria de cierre.'},
        {title:'Validación final', description:'Revisar resultado estético final antes de cerrar expediente.'}
      ],
      createdAt:now, updatedAt:now
    }
  ];
}
function levNormalizeItem(item, index){
  const fallback = levDefaultRecords()[0];
  return {
    id: item.id || `lev-${Date.now()}-${index}`,
    code: item.code || levCode(index + 1),
    category: item.category || 'Otro',
    type: item.type || item.category || 'Levantamiento',
    agency: levSafe(item.agency),
    group: levSafe(item.group),
    technician: levSafe(item.technician || item.responsible),
    responsible: levSafe(item.responsible || item.technician),
    visitDate: item.visitDate || levToday(),
    submittedAt: item.submittedAt || item.createdAt || levNow(),
    workflowStatus: item.workflowStatus || item.status || 'Pendiente de revisión',
    overallStatus: item.overallStatus || 'Sin evaluación',
    priority: item.priority || 'Media',
    findingsCount: Number(item.findingsCount ?? 0) || 0,
    evidenceCount: Number(item.evidenceCount ?? 0) || 0,
    executiveSummary: item.executiveSummary || item.findings || 'Sin resumen ejecutivo registrado.',
    agencyObservation: item.agencyObservation || '',
    findings: item.findings || '',
    recommendations: item.recommendations || '',
    nextAction: item.nextAction || '',
    structure: Array.isArray(item.structure) ? item.structure : [],
    electrical: Array.isArray(item.electrical) ? item.electrical : [],
    equipment: Array.isArray(item.equipment) ? item.equipment : [],
    gallery: Array.isArray(item.gallery) ? item.gallery : [],
    diagnostics: item.diagnostics || {structure:'-', electrical:'-', equipment:'-', incidents:'-', recommendation:'-'},
    actions: Array.isArray(item.actions) ? item.actions : [],
    createdAt: item.createdAt || levNow(),
    updatedAt: item.updatedAt || levNow()
  };
}
function levLoad(){
  try {
    const saved = JSON.parse(localStorage.getItem(LEV_STORAGE_KEY) || 'null');
    levRecords = Array.isArray(saved) && saved.length ? saved.map(levNormalizeItem) : levDefaultRecords().map(levNormalizeItem);
  } catch(e){
    levRecords = levDefaultRecords().map(levNormalizeItem);
  }
}
function levSave(){ localStorage.setItem(LEV_STORAGE_KEY, JSON.stringify(levRecords)); }
function levPopulateCategoryFilter(){
  const select = document.getElementById('levFilterCategory');
  const formSelect = document.getElementById('levCategory');
  if(select) select.innerHTML = '<option value="">Todos</option>' + LEV_CATEGORIES.map(item => `<option value="${item}">${item}</option>`).join('');
  if(formSelect) formSelect.innerHTML = LEV_CATEGORIES.map(item => `<option value="${item}">${item}</option>`).join('');
}
function levPopulateGroupFilter(){
  const select = document.getElementById('levFilterGroup');
  if(!select) return;
  const current = select.value || '';
  const values = [...new Set([...levGetGrupos(), ...levRecords.map(item => item.group).filter(Boolean)].map(v => String(v).trim()).filter(Boolean))]
    .sort((a,b)=> String(a).localeCompare(String(b), 'es', {numeric:true, sensitivity:'base'}));
  select.innerHTML = '<option value="">Todos</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
  if(values.includes(current)) select.value = current;
}
function levFillDatalists(){
  const agencyList = document.getElementById('levAgencyList');
  const groupList = document.getElementById('levGroupList');
  if(agencyList) agencyList.innerHTML = [...new Set([...levGetAgencias(), ...levRecords.map(item => item.agency).filter(Boolean)])].map(v => `<option value="${v}"></option>`).join('');
  if(groupList) groupList.innerHTML = [...new Set([...levGetGrupos(), ...levRecords.map(item => item.group).filter(Boolean)])].map(v => `<option value="${v}"></option>`).join('');
}
function levTopBy(key){
  const counts = {};
  levRecords.forEach(item => { const value = levSafe(item[key]) || '-'; counts[value] = (counts[value] || 0) + 1; });
  const first = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  return { key: first ? first[0] : '-', total: first ? first[1] : 0 };
}
function levGetHighestOpenPriority(){
  const order = { 'Urgente':4, 'Alta':3, 'Media':2, 'Baja':1 };
  const open = levRecords.filter(item => !levSlug(item.workflowStatus).includes('complet') && !levSlug(item.workflowStatus).includes('archiv'));
  if(!open.length) return '-';
  return open.sort((a,b) => (order[b.priority]||0) - (order[a.priority]||0))[0].priority;
}
function levApplyFilters(){
  const search = levSlug(document.getElementById('levFilterSearch')?.value || '');
  const category = levSafe(document.getElementById('levFilterCategory')?.value || '');
  const status = levSafe(document.getElementById('levFilterStatus')?.value || '');
  const priority = levSafe(document.getElementById('levFilterPriority')?.value || '');
  const group = levSafe(document.getElementById('levFilterGroup')?.value || '');
  const agency = levSlug(document.getElementById('levFilterAgency')?.value || '');
  const tech = levSlug(document.getElementById('levFilterOwner')?.value || '');
  levFiltered = levRecords.filter(item => {
    const blob = [item.code,item.type,item.category,item.agency,item.group,item.technician,item.executiveSummary,item.findings].join(' ').toLowerCase();
    if(search && !blob.includes(search)) return false;
    if(category && item.category !== category) return false;
    if(status && item.workflowStatus !== status) return false;
    if(priority && item.priority !== priority) return false;
    if(group && String(item.group || '') !== group) return false;
    if(agency && !`${item.agency} ${item.group}`.toLowerCase().includes(agency)) return false;
    if(tech && !`${item.technician} ${item.responsible}`.toLowerCase().includes(tech)) return false;
    return true;
  });
}
function levRenderStats(){
  const total = levRecords.length;
  const pending = levRecords.filter(item => levSlug(item.workflowStatus).includes('pend')).length;
  const action = levRecords.filter(item => levSlug(item.workflowStatus).includes('aprob') || levSlug(item.workflowStatus).includes('proceso')).length;
  const latestTech = levRecords.slice().sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  const closedLast = levRecords.filter(item => levSlug(item.workflowStatus).includes('complet')).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  };
  setText('levStatTotal', total);
  setText('levStatPending', pending);
  setText('levStatAction', action);
  setText('levHeroTech', latestTech ? latestTech.technician || '-' : '-');
  setText('levHeroAgency', levTopBy('agency').key);
  setText('levHeroGroup', levTopBy('group').key);
  setText('levHeroPriority', levGetHighestOpenPriority());
  setText('levHeroClosed', closedLast ? closedLast.code : '-');
}
function levRenderCategoryBars(){
  const holder = document.getElementById('levCategoryBars');
  if(!holder) return;
  const total = levRecords.length || 1;
  const rows = LEV_CATEGORIES.map(cat => ({ cat, total: levRecords.filter(item => item.category === cat).length })).filter(item => item.total > 0).sort((a,b)=> b.total - a.total);
  holder.innerHTML = rows.length ? rows.map(item => `
    <div class="lev-progress-item">
      <div class="lev-progress-top"><span>${item.cat}</span><span>${item.total}</span></div>
      <div class="lev-progress-bar"><span style="width:${Math.max(8, (item.total/total)*100)}%"></span></div>
    </div>`).join('') : '<div class="lev-empty">Sin datos para mostrar.</div>';
}
function levRenderAlerts(){
  const alertList = document.getElementById('levAlertList');
  const agendaList = document.getElementById('levAgendaList');
  if(alertList){
    const alerts = levRecords.filter(item => item.priority === 'Urgente' || item.priority === 'Alta').slice(0,4);
    alertList.innerHTML = alerts.length ? alerts.map(item => `<div class="lev-mini-item"><div><strong>${item.code} · Agencia ${item.agency || '-'}</strong><span>${item.executiveSummary}</span></div><b>${item.priority}</b></div>`).join('') : '<div class="lev-empty">No hay alertas prioritarias activas.</div>';
  }
  if(agendaList){
    const agenda = levRecords.filter(item => !levSlug(item.workflowStatus).includes('complet') && !levSlug(item.workflowStatus).includes('archiv')).sort((a,b)=> new Date(a.visitDate) - new Date(b.visitDate)).slice(0,4);
    agendaList.innerHTML = agenda.length ? agenda.map(item => `<div class="lev-mini-item"><div><strong>${item.code}</strong><span>${item.nextAction || 'Sin acción definida.'}</span></div><b>${levFmtDate(item.visitDate)}</b></div>`).join('') : '<div class="lev-empty">No hay agenda pendiente.</div>';
  }
}
function levRenderExecutivePreview(){
  const item = levFiltered[0] || levRecords[0];
  document.getElementById('levExecutiveTitle').textContent = item ? `${item.type} · Agencia ${item.agency}` : 'Sin expediente seleccionado';
  document.getElementById('levExecutiveText').textContent = item ? item.executiveSummary : 'Selecciona un levantamiento para visualizar su ficha empresarial completa.';
  document.getElementById('levExecutiveCode').textContent = item ? item.code : '-';
}
function levRenderTable(){
  const tbody = document.getElementById('levTableBody');
  if(!tbody) return;
  if(!levFiltered.length){ tbody.innerHTML = `<tr><td colspan="8"><div class="lev-empty">No hay levantamientos que coincidan con los filtros actuales.</div></td></tr>`; return; }
  tbody.innerHTML = levFiltered.map(item => `
    <tr>
      <td><strong>${item.code}</strong><br><span class="lev-muted">${levFmtDate(item.submittedAt)}</span></td>
      <td class="lev-title-cell"><strong>${item.type}</strong><span>${item.executiveSummary}</span></td>
      <td><strong>${item.agency || '-'}</strong><br><span class="lev-muted">Grupo ${item.group || '-'}</span></td>
      <td>${item.technician || '-'}</td>
      <td><span class="lev-chip ${levBadgeClass(item.workflowStatus)}">${item.workflowStatus}</span><br><span class="lev-muted">${item.overallStatus}</span></td>
      <td><span class="lev-chip ${levPriorityClass(item.priority)}">${item.priority}</span></td>
      <td><strong>${item.findingsCount}</strong><br><span class="lev-muted">${item.evidenceCount} evidencias</span></td>
      <td>
        <div class="lev-actions" style="justify-content:flex-start;">
          <button type="button" class="lev-btn secondary" onclick="levOpenDetail('${item.id}')"><i class="fas fa-eye"></i> Ver</button>
          <button type="button" class="lev-btn ghost" onclick="levEdit('${item.id}')"><i class="fas fa-pen"></i></button>
          <button type="button" class="lev-btn ghost" onclick="levRemove('${item.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}
function levRender(){ levApplyFilters(); levRenderStats(); levRenderExecutivePreview(); levRenderTable(); levRenderCategoryBars(); levRenderAlerts(); }
function levResetForm(){
  levEditingId = null;
  document.getElementById('levFormTitle').textContent = 'Nuevo registro rápido';
  levSetValue('levId');
  levSetValue('levVisitDate', levToday());
  levSetValue('levAgency');
  levSetValue('levGroup');
  levSetSelectValue('levCategory', 'Arqueo de agencia');
  levSetValue('levTitle');
  levSetValue('levResponsible');
  levSetSelectValue('levPriority', 'Media');
  levSetSelectValue('levStatus', 'Pendiente de revisión');
  levSetValue('levOverallStatus', 'Bueno');
  levSetValue('levFindings');
  levSetValue('levRecommendations');
  levSetValue('levNextAction');
  levSetSelectValue('levDiagStructure', 'Bueno');
  levSetSelectValue('levDiagElectrical', 'Bueno');
  levSetSelectValue('levDiagEquipment', 'Bueno');
  levSetValue('levDiagIncidents');
  levSetValue('levDiagRecommendation', 'Seguimiento preventivo');
  LEV_STRUCTURE_FIELDS.forEach(label => { const key = levKey(label); levSetSelectValue(`levStructureState_${key}`, 'Buen Estado'); });
  LEV_ELECTRICAL_FIELDS.forEach(label => { const key = levKey(label); levSetSelectValue(`levElectricalState_${key}`, 'Buen Estado'); });
  LEV_EQUIPMENT_FIELDS.forEach(field => { const key = levKey(field.name); levSetSelectValue(`levEquipmentAvail_${key}`, field.name === 'Pantalla ATM' ? 'No tiene' : 'Sí tiene'); levSetSelectValue(`levEquipmentState_${key}`, field.name === 'Pantalla ATM' ? 'No tiene' : 'Buen Estado'); levSetValue(`levEquipmentDesc_${key}`); levSetValue(`levEquipmentPhoto_${key}`, field.photoLabel || ''); });
  LEV_GALLERY_FIELDS.forEach(label => { levResetImageField(levKey(label)); });
  levSetValue('levAgencyObservation');
  levToggleEditLayout(false);
  levSetValue('levEditTitle');
  levSetValue('levEditOverallStatus', 'Bueno');
  levSetValue('levEditSummary');
}
function levOpenModal(){ document.getElementById('levModal').classList.add('open'); }
function levCloseModal(){ document.getElementById('levModal').classList.remove('open'); }
function levToggleEditLayout(isEdit){
  const createBlock = document.getElementById('levCreateBaseFields');
  const editBlock = document.getElementById('levEditAlignedShell');
  if(createBlock) createBlock.style.display = isEdit ? 'none' : '';
  if(editBlock) editBlock.style.display = isEdit ? '' : 'none';
}
function levSyncEditSummaryFromBase(){
  const agency = document.getElementById('levAgency')?.value || '-';
  const group = document.getElementById('levGroup')?.value || '-';
  const responsible = document.getElementById('levResponsible')?.value || '-';
  const visitDate = document.getElementById('levVisitDate')?.value || '';
  const dateLabel = visitDate ? formatDate(visitDate) : '-';
  const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
  setText('levEditChipAgency', `Agencia ${agency}`);
  setText('levEditChipGroup', `Grupo ${group}`);
  setText('levEditChipResponsible', responsible);
  setText('levEditChipVisitDate', dateLabel);
  levSetValue('levEditTitle', document.getElementById('levTitle')?.value || '');
  levSetSelectValue('levEditCategory', document.getElementById('levCategory')?.value || 'Arqueo de agencia');
  levSetSelectValue('levEditStatus', document.getElementById('levStatus')?.value || 'Pendiente de revisión');
  levSetValue('levEditOverallStatus', document.getElementById('levOverallStatus')?.value || '');
  levSetSelectValue('levEditPriority', document.getElementById('levPriority')?.value || 'Media');
  levSetValue('levEditSummary', document.getElementById('levFindings')?.value || '');
}
function levSyncBaseFromEditSummary(){
  if(!levEditingId) return;
  levSetValue('levTitle', document.getElementById('levEditTitle')?.value || '');
  levSetSelectValue('levCategory', document.getElementById('levEditCategory')?.value || 'Arqueo de agencia');
  levSetSelectValue('levStatus', document.getElementById('levEditStatus')?.value || 'Pendiente de revisión');
  levSetValue('levOverallStatus', document.getElementById('levEditOverallStatus')?.value || '');
  levSetSelectValue('levPriority', document.getElementById('levEditPriority')?.value || 'Media');
  levSetValue('levFindings', document.getElementById('levEditSummary')?.value || '');
}
function levOpenCreate(){ levResetForm(); levToggleEditLayout(false); levOpenModal(); }
function levEdit(id){
  const item = levRecords.find(row => row.id === id); if(!item) return;
  levEditingId = id;
  document.getElementById('levFormTitle').textContent = `Editar ${item.code}`;
  levSetValue('levId', item.id);
  levSetValue('levVisitDate', item.visitDate || levToday());
  levSetValue('levAgency', item.agency || '');
  levSetValue('levGroup', item.group || '');
  levSetSelectValue('levCategory', item.category || 'Otro');
  levSetValue('levTitle', item.type || '');
  levSetValue('levResponsible', item.technician || item.responsible || '');
  levSetSelectValue('levPriority', item.priority || 'Media');
  levSetSelectValue('levStatus', item.workflowStatus || 'Pendiente de revisión');
  levSetValue('levOverallStatus', item.overallStatus || '');
  levSetValue('levFindings', item.executiveSummary || '');
  levSetValue('levRecommendations', item.recommendations || '');
  levSetValue('levNextAction', item.nextAction || '');
  levSetSelectValue('levDiagStructure', item.diagnostics?.structure || 'Bueno');
  levSetSelectValue('levDiagElectrical', item.diagnostics?.electrical || 'Bueno');
  levSetSelectValue('levDiagEquipment', item.diagnostics?.equipment || 'Bueno');
  levSetValue('levDiagIncidents', item.diagnostics?.incidents || '');
  levSetValue('levDiagRecommendation', item.diagnostics?.recommendation || '');
  LEV_STRUCTURE_FIELDS.forEach(label => { const key = levKey(label); const row = levGetRow(item.structure, label, 'item') || {}; levSetSelectValue(`levStructureState_${key}`, row.state || 'Buen Estado'); });
  LEV_ELECTRICAL_FIELDS.forEach(label => { const key = levKey(label); const row = levGetRow(item.electrical, label, 'item') || {}; levSetSelectValue(`levElectricalState_${key}`, row.state || 'Buen Estado'); });
  LEV_EQUIPMENT_FIELDS.forEach(field => { const key = levKey(field.name); const row = levGetRow(item.equipment, field.name, 'name') || {}; levSetSelectValue(`levEquipmentAvail_${key}`, row.available || (field.name === 'Pantalla ATM' ? 'No tiene' : 'Sí tiene')); levSetSelectValue(`levEquipmentState_${key}`, row.state || (field.name === 'Pantalla ATM' ? 'No tiene' : 'Buen Estado')); levSetValue(`levEquipmentDesc_${key}`, row.description || ''); levSetValue(`levEquipmentPhoto_${key}`, row.photoLabel || field.photoLabel || ''); });
  LEV_GALLERY_FIELDS.forEach(label => { const row = levGetRow(item.gallery, label, 'label') || {}; levApplyImagePreview(levKey(label), row.url || ''); });
  levSetValue('levAgencyObservation', item.agencyObservation || '');
  levToggleEditLayout(true);
  levSyncEditSummaryFromBase();
  levOpenModal();
}
function levSaveForm(ev){
  ev.preventDefault();
  levSyncBaseFromEditSummary();
  const id = document.getElementById('levId').value || `lev-${Date.now()}`;
  const existing = levRecords.find(item => item.id === id);
  const base = existing || {};
  const structure = levBuildStructureFromForm();
  const electrical = levBuildElectricalFromForm();
  const equipment = levBuildEquipmentFromForm();
  const gallery = levBuildGalleryFromForm();
  const autoFindings = levEstimateFindings(structure, electrical, equipment);
  const record = levNormalizeItem({
    ...base,
    id,
    code: existing?.code || levCode(levRecords.length + 1),
    category: document.getElementById('levCategory').value,
    type: document.getElementById('levTitle').value || document.getElementById('levCategory').value,
    agency: document.getElementById('levAgency').value,
    group: document.getElementById('levGroup').value,
    technician: document.getElementById('levResponsible').value,
    responsible: document.getElementById('levResponsible').value,
    visitDate: document.getElementById('levVisitDate').value,
    submittedAt: base.submittedAt || levNow(),
    workflowStatus: document.getElementById('levStatus').value,
    overallStatus: document.getElementById('levOverallStatus').value || levEstimateOverall(structure, electrical, equipment),
    priority: document.getElementById('levPriority').value,
    findingsCount: autoFindings,
    evidenceCount: gallery.filter(item => item.url).length,
    executiveSummary: document.getElementById('levFindings').value,
    findings: document.getElementById('levFindings').value,
    recommendations: document.getElementById('levRecommendations').value,
    nextAction: document.getElementById('levNextAction').value,
    updatedAt: levNow(),
    diagnostics: {
      structure: document.getElementById('levDiagStructure').value,
      electrical: document.getElementById('levDiagElectrical').value,
      equipment: document.getElementById('levDiagEquipment').value,
      incidents: document.getElementById('levDiagIncidents').value || `${autoFindings} hallazgos`,
      recommendation: document.getElementById('levDiagRecommendation').value || 'Seguimiento preventivo'
    },
    actions: base.actions || [],
    agencyObservation: document.getElementById('levAgencyObservation')?.value || '',
    structure, electrical, equipment, gallery
  });
  if(existing) levRecords = levRecords.map(item => item.id === id ? record : item); else levRecords.unshift(record);
  levSave(); levPopulateGroupFilter(); levFillDatalists(); levCloseModal(); levRender();
}
function levOpenDetail(id){
  const item = levRecords.find(row => row.id === id); if(!item) return;
  document.getElementById('levDetailTitle').textContent = `${item.code} · ${item.type}`;
  const renderRows = (rows, cols='2') => rows.length ? rows.map(row => `<tr><td><strong>${row.item || row.name || '-'}</strong></td><td><span class="lev-state-pill ${levStateClass(row.state || row.available)}">${row.state || row.available || '-'}</span></td></tr>`).join('') : `<tr><td colspan="${cols}"><div class="lev-empty">Sin información registrada.</div></td></tr>`;
  const gallery = item.gallery?.length ? item.gallery.map(photo => `
    <div class="lev-gallery-card">
      <div class="lev-gallery-thumb">${photo.url ? `<img src="${photo.url}" alt="${photo.label}" style="width:100%;height:100%;object-fit:cover;">` : `<div><i class="fas fa-camera"></i><br>${photo.label}</div>`}</div>
      <div class="meta"><strong>${photo.label}</strong><span>${photo.url ? 'Foto cargada en el expediente.' : 'Sin fotografía cargada.'}</span></div>
    </div>`).join('') : '<div class="lev-empty" style="padding:18px;">Sin fotografías vinculadas.</div>';
  const equipment = item.equipment?.length ? item.equipment.map(eq => `
    <div class="lev-equip-card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <h5>${eq.name}</h5>
        <span class="lev-state-pill ${levStateClass(eq.state || eq.available)}">${eq.state || eq.available || '-'}</span>
      </div>
      <div class="lev-equip-meta">
        <div><strong>Disponibilidad:</strong> ${eq.available || '-'}</div>
        <div><strong>Descripción / modelo:</strong> ${eq.description || '-'}</div>
      </div>
      ${eq.photoUrl ? `<div class="lev-equip-photo"><img src="${eq.photoUrl}" alt="${eq.name}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"></div>` : (eq.photoLabel ? `<div class="lev-equip-photo"><div><i class="fas fa-image"></i><br>${eq.photoLabel}</div></div>` : '')}
    </div>`).join('') : '<div class="lev-empty" style="padding:18px;">Sin equipos registrados.</div>';
  const actions = item.actions?.length ? item.actions.map(action => `<div class="lev-action-item"><div><strong>${action.title}</strong><span>${action.description}</span></div><span class="lev-state-pill ok">Acción</span></div>`).join('') : '<div class="lev-empty" style="padding:18px;">Sin acciones definidas.</div>';
  document.getElementById('levDetailBody').innerHTML = `
    <div class="lev-detail-shell">
      <div class="lev-detail-header">
        <div class="lev-detail-title-block">
          <h2>${item.code}</h2>
          <p>${item.executiveSummary}</p>
        </div>
        <div class="lev-detail-badges">
          <span class="lev-badge-soft"><i class="fas fa-building"></i> Agencia ${item.agency || '-'}</span>
          <span class="lev-badge-soft"><i class="fas fa-people-group"></i> Grupo ${item.group || '-'}</span>
          <span class="lev-badge-soft"><i class="fas fa-user-helmet-safety"></i> ${item.technician || '-'}</span>
          <span class="lev-badge-soft"><i class="fas fa-calendar-day"></i> ${levFmtDate(item.visitDate)}</span>
        </div>
      </div>

      <div class="lev-detail-grid">
        <div class="lev-card"><div class="label">Tipo de levantamiento</div><div class="value" style="font-size:20px;">${item.type}</div><div class="sub">Categoría: ${item.category}</div></div>
        <div class="lev-card"><div class="label">Estado de flujo</div><div class="value" style="font-size:20px;">${item.workflowStatus}</div><div class="sub">Lectura operacional del expediente</div></div>
        <div class="lev-card"><div class="label">Estado general</div><div class="value" style="font-size:20px;">${item.overallStatus}</div><div class="sub">Resultado empresarial del formulario</div></div>
        <div class="lev-card"><div class="label">Prioridad sugerida</div><div class="value" style="font-size:20px;">${item.priority}</div><div class="sub">${item.findingsCount} hallazgos · ${item.evidenceCount} evidencias</div></div>
      </div>

      <div class="lev-exec-box">
        <h4>Resumen ejecutivo</h4>
        <p>${item.executiveSummary}</p>
      </div>

      <div class="lev-section">
        <div class="lev-section-head"><div><h4>Estado general de la agencia</h4><p>Lectura estructural y de mobiliario visible para entender la condición global del punto.</p></div></div>
        <table class="lev-table-clean">
          <thead><tr><th>Elemento</th><th>Estado</th></tr></thead>
          <tbody>${renderRows(item.structure)}</tbody>
        </table>
      </div>

      <div class="lev-section">
        <div class="lev-section-head"><div><h4>Instalación eléctrica y cableado</h4><p>Resumen ordenado de energía, conectores, luces y presentación del cableado.</p></div></div>
        <table class="lev-table-clean">
          <thead><tr><th>Componente</th><th>Estado</th></tr></thead>
          <tbody>${renderRows(item.electrical)}</tbody>
        </table>
      </div>

      <div class="lev-section">
        <div class="lev-section-head"><div><h4>Equipos detectados en agencia</h4><p>Equipos principales reportados por el formulario, organizados para lectura rápida y empresarial.</p></div></div>
        <div class="lev-equip-grid">${equipment}</div>
      </div>

      <div class="lev-section">
        <div class="lev-section-head"><div><h4>Galería fotográfica</h4><p>Evidencias separadas por zonas y equipos para que el caso sea fácil de entender.</p></div></div>
        <div class="lev-gallery-grid">${gallery}</div>
      </div>

      <div class="lev-section">
        <div class="lev-section-head"><div><h4>Diagnóstico automático</h4><p>Lectura resumida lista para supervisión, seguimiento y toma de decisiones.</p></div></div>
        <div class="lev-diagnostics">
          <div class="lev-diag-card"><span>Estado estructural</span><strong>${item.diagnostics?.structure || '-'}</strong><p>Condición visual general del local y elementos físicos evaluados.</p></div>
          <div class="lev-diag-card"><span>Estado eléctrico</span><strong>${item.diagnostics?.electrical || '-'}</strong><p>Interpretación general del componente eléctrico y cableado.</p></div>
          <div class="lev-diag-card"><span>Equipos y mobiliario</span><strong>${item.diagnostics?.equipment || '-'}</strong><p>Situación consolidada de equipos registrados por el formulario.</p></div>
          <div class="lev-diag-card"><span>Acción recomendada</span><strong>${item.diagnostics?.recommendation || '-'}</strong><p>Incidencias: ${item.diagnostics?.incidents || '-'}</p></div>
        </div>
      </div>

      <div class="lev-exec-box">
        <h4>Observación de la agencia</h4>
        <p>${item.agencyObservation || 'Sin observación global registrada.'}</p>
      </div>

    </div>`;
  document.getElementById('levDetailModal').classList.add('open');
}
function levCloseDetail(){ document.getElementById('levDetailModal').classList.remove('open'); }
function levRemove(id){ if(!confirm('¿Deseas eliminar este levantamiento?')) return; levRecords = levRecords.filter(item => item.id !== id); levSave(); levRender(); }
function levGetExportBase(){
  return (levFiltered.length ? levFiltered : levRecords);
}
function levStructureValue(item, label){
  return item.structure?.find(row => row.item === label)?.state || '';
}
function levEquipmentState(item, label){
  const eq = item.equipment?.find(row => row.name === label);
  return eq ? (eq.state || eq.available || '') : '';
}
function levExcelRows(){
  return levGetExportBase().map(item => ({
    'Técnico': item.technician || '',
    'Agencia': item.agency || '',
    'Grupo': item.group || '',
    'Fecha': levFmtDate(item.visitDate),
    'Toldo': levStructureValue(item, 'Toldo'),
    'Pecho': levStructureValue(item, 'Pecho'),
    'Publicidades': levStructureValue(item, 'Publicidades'),
    'Pintura / Filtraciones': levStructureValue(item, 'Pintura / Filtraciones'),
    'Piso': levStructureValue(item, 'Piso'),
    'Puerta enrollable / Eléctrica': levStructureValue(item, 'Puerta enrollable / Eléctrica'),
    'Estado (Máquina de Venta)': levEquipmentState(item, 'Máquina de venta'),
    'Comentario u observación': item.findings || item.recommendations || item.executiveSummary || ''
  }));
}
function levExportCSV(){
  const rows = levExcelRows();
  if(!rows.length){ alert('No hay datos para exportar.'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
  const group = levSafe(document.getElementById('levFilterGroup')?.value || '');
  const fileName = group ? `levantamientos_grupo_${group}.csv` : 'levantamientos_operaciones.csv';
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
function levExportExcel(){
  const rows = levExcelRows();
  if(!rows.length){ alert('No hay datos para exportar.'); return; }
  const headers = Object.keys(rows[0]);
  const group = levSafe(document.getElementById('levFilterGroup')?.value || '');
  const title = group ? `Levantamientos Grupo ${group}` : 'Levantamientos de Operaciones';
  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tableRows = rows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('');
  const htmlDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}th,td{border:1px solid #b7c3d0;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#cfeccc;font-weight:700}.title{font-size:16px;font-weight:700;margin-bottom:10px}
  

/* MAPA · FLUIDEZ + PANTALLA COMPLETA + ICONOS PRO */
.agency-map-card:fullscreen{width:100vw!important;height:100vh!important;margin:0!important;border-radius:0!important;border:0!important;box-shadow:none!important;background:#061e38!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;}
.agency-map-card:fullscreen .agency-map-head{flex:0 0 auto!important;}
.agency-map-card:fullscreen #agenciasMap{height:calc(100vh - 116px)!important;min-height:calc(100vh - 116px)!important;flex:1 1 auto!important;}
.agency-map-card:fullscreen .agency-map-empty{flex:0 0 auto!important;}
.agency-map-card:fullscreen .map-filter-panel{top:18px!important;bottom:18px!important;max-height:none!important;}
#agenciasMap{will-change:transform;contain:layout paint size;}
#agenciasMap .leaflet-tile{filter:saturate(1.03) contrast(1.1) brightness(.96)!important;image-rendering:auto!important;}
#agenciasMap .leaflet-marker-icon{will-change:transform;}
.loteka-map-pin span{transform:translateZ(0);backface-visibility:hidden;}
.loteka-map-pin span b{position:relative;z-index:3;display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;line-height:1!important;text-align:center!important;padding-top:1px!important;}
.loteka-map-pin.pin-shape-triangle span{clip-path:polygon(50% 0%,96% 88%,50% 100%,4% 88%)!important;border-radius:14px!important;}
.loteka-map-pin.pin-shape-triangle span::after{display:none!important;}
.map-filter-row{user-select:none;}


/* MAPA · ICONO UNIFICADO PROFESIONAL + MEJOR FLUIDEZ */
#agenciasMap{background:#dce8ef!important;transform:translateZ(0);}
#agenciasMap .leaflet-tile{filter:none!important;image-rendering:auto!important;backface-visibility:hidden;will-change:opacity;}
#agenciasMap:after{display:none!important;}
#agenciasMap .leaflet-marker-pane{will-change:transform;}
.loteka-map-pin{background:transparent!important;border:0!important;}
.loteka-map-pin span{
  position:relative!important;
  width:34px!important;
  height:34px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:var(--pin-bg)!important;
  border:3px solid #ffffff!important;
  border-radius:50%!important;
  box-shadow:0 6px 14px rgba(4,28,55,.26),0 0 0 2px rgba(255,255,255,.85)!important;
  transform:none!important;
  clip-path:none!important;
  backface-visibility:hidden!important;
  will-change:transform!important;
}
.loteka-map-pin span::before{
  content:""!important;
  position:absolute!important;
  left:50%!important;
  bottom:-8px!important;
  width:15px!important;
  height:15px!important;
  background:var(--pin-bg)!important;
  border-right:3px solid #fff!important;
  border-bottom:3px solid #fff!important;
  transform:translateX(-50%) rotate(45deg)!important;
  border-radius:3px!important;
  animation:none!important;
  opacity:1!important;
  z-index:-1!important;
  box-shadow:5px 5px 10px rgba(4,28,55,.18)!important;
}
.loteka-map-pin span::after{
  content:""!important;
  position:absolute!important;
  inset:4px!important;
  border-radius:50%!important;
  border:1px solid rgba(255,255,255,.38)!important;
  background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,0) 48%)!important;
  width:auto!important;height:auto!important;
  left:4px!important;top:4px!important;transform:none!important;
  opacity:1!important;
  display:block!important;
}
.loteka-map-pin span b{
  position:relative!important;
  z-index:4!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:100%!important;
  height:100%!important;
  padding:0!important;
  color:#fff!important;
  font-weight:950!important;
  font-family:Inter,system-ui,Arial,sans-serif!important;
  letter-spacing:-.45px!important;
  line-height:1!important;
  text-shadow:0 1px 2px rgba(0,0,0,.35)!important;
  transform:none!important;
}
.loteka-map-pin:hover span{transform:translateY(-2px) scale(1.04)!important;box-shadow:0 10px 20px rgba(4,28,55,.32),0 0 0 3px rgba(255,255,255,.9)!important;}
@media(max-width:900px){.loteka-map-pin span{width:31px!important;height:31px!important}.loteka-map-pin span::before{bottom:-7px;width:13px!important;height:13px!important}}



/* ===== Paginación profesional estilo LOTEKA ===== */
.ltk-pagination{
  width:min(760px, calc(100% - 28px)) !important;
  margin:18px auto 28px auto !important;
  padding:14px 18px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:14px !important;
  flex-wrap:wrap !important;
  background:linear-gradient(135deg, rgba(255,255,255,.96), rgba(236,248,253,.96)) !important;
  border:1px solid rgba(14,165,198,.22) !important;
  border-radius:22px !important;
  box-shadow:0 14px 34px rgba(12,74,110,.10) !important;
  text-align:center !important;
}
.ltk-pagination-info{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  min-height:36px !important;
  padding:0 14px !important;
  border-radius:999px !important;
  background:#ffffff !important;
  border:1px solid rgba(125,166,190,.25) !important;
  color:#31536b !important;
  font-size:12px !important;
  font-weight:800 !important;
  letter-spacing:.02em !important;
  box-shadow:0 8px 18px rgba(15,75,110,.06) !important;
}
.ltk-pagination-controls{
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:7px !important;
  flex-wrap:wrap !important;
}
.ltk-page-btn{
  min-width:38px !important;
  height:38px !important;
  padding:0 12px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  border-radius:13px !important;
  border:1px solid rgba(14,165,198,.22) !important;
  background:#ffffff !important;
  color:#27506a !important;
  font-size:13px !important;
  font-weight:900 !important;
  line-height:1 !important;
  cursor:pointer !important;
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease !important;
  box-shadow:0 8px 18px rgba(15,75,110,.07) !important;
}
.ltk-page-btn:hover:not(:disabled){
  transform:translateY(-1px) !important;
  background:#e8f8fd !important;
  color:#0a86aa !important;
  box-shadow:0 12px 24px rgba(14,165,198,.16) !important;
}
.ltk-page-btn.active{
  border-color:transparent !important;
  background:linear-gradient(135deg, #0ea5c6, #087da4) !important;
  color:#ffffff !important;
  box-shadow:0 12px 26px rgba(14,165,198,.28) !important;
}
.ltk-page-btn:disabled{
  opacity:.38 !important;
  cursor:not-allowed !important;
  box-shadow:none !important;
  transform:none !important;
}
.ltk-page-size-wrap{
  display:inline-flex !important;
  align-items:center !important;
  gap:8px !important;
  min-height:38px !important;
  padding:0 10px 0 12px !important;
  border-radius:14px !important;
  background:#ffffff !important;
  border:1px solid rgba(125,166,190,.25) !important;
  color:#557189 !important;
  font-size:12px !important;
  font-weight:800 !important;
  box-shadow:0 8px 18px rgba(15,75,110,.06) !important;
}
.ltk-page-size{
  height:30px !important;
  min-width:68px !important;
  border:0 !important;
  outline:none !important;
  background:#f2f9fc !important;
  color:#174766 !important;
  border-radius:10px !important;
  padding:0 8px !important;
  font-weight:900 !important;
  cursor:pointer !important;
}
@media (max-width: 680px){
  .ltk-pagination{width:calc(100% - 16px) !important; padding:12px 10px !important; gap:10px !important;}
  .ltk-pagination-info{width:100% !important;}
  .ltk-page-btn{min-width:34px !important; height:34px !important; border-radius:11px !important;}
}
</style>
<style id="loteka-agencia-inventario-css-v38">
  .agency-inv-sync-note{display:flex;align-items:center;gap:10px;margin:12px 0 16px;padding:13px 16px;border:1px solid #bfe8f5;border-radius:18px;background:linear-gradient(135deg,#f5fcff,#e9f8fd);color:#0b4e75;font-weight:800;box-shadow:0 12px 28px rgba(14,165,198,.08)}
  .agency-inv-sync-note i{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:#daf5fb;color:#0796c4}
  .agency-inv-sub{display:block;color:#688197;font-size:12px;font-weight:700;margin-top:2px;line-height:1.35}
  .agency-inv-product{display:flex;align-items:center;gap:11px;min-width:230px}
  .agency-inv-product img{width:54px;height:54px;object-fit:contain;border:1px solid #cfe5f0;border-radius:14px;background:#fff;box-shadow:0 8px 18px rgba(0,61,104,.08);padding:6px}
  .agency-inv-product b{display:block;color:#003b66;font-size:14px;line-height:1.2}
  .agency-inv-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#eaf8fc;border:1px solid #bfe8f5;color:#007fa8;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap}
  .agency-inv-chip.ok{background:#eafff2;border-color:#b8efcf;color:#097a3e}.agency-inv-chip.warn{background:#fff7df;border-color:#f9d778;color:#916000}.agency-inv-chip.gray{background:#f2f6f9;border-color:#dbe8ef;color:#617486}
  .agency-inv-serial{font-weight:900;color:#003b66}.agency-inv-muted{color:#678198;font-size:12px;font-weight:750;line-height:1.35;margin-top:4px}
  .agency-inv-actions{display:flex;align-items:center;gap:8px;justify-content:center}.agency-inv-action{width:38px;height:38px;border-radius:14px;border:1px solid #c6e9f3;background:#f5fcff;color:#0786b1;display:grid;place-items:center;cursor:pointer;transition:.18s ease;box-shadow:0 8px 18px rgba(14,165,198,.08)}
  .agency-inv-action:hover{transform:translateY(-2px);background:#0ea5c6;color:#fff;box-shadow:0 14px 26px rgba(14,165,198,.2)}
  .agency-inv-action.transfer{background:#eef7ff;color:#5f7f98;border-color:#cbe2f2}.agency-inv-action.transfer:hover{background:#5f7f98;color:#fff}
  .loteka-trace-modal{position:fixed;inset:0;background:rgba(4,30,48,.58);backdrop-filter:blur(6px);z-index:999999;display:none;align-items:center;justify-content:center;padding:24px}.loteka-trace-modal.show{display:flex}
  .loteka-trace-box{width:min(1120px,96vw);max-height:92vh;overflow:auto;background:#f5fbff;border:1px solid #bce7f2;border-radius:28px;box-shadow:0 34px 90px rgba(1,38,65,.34)}
  .loteka-trace-head{display:flex;align-items:center;justify-content:space-between;gap:18px;background:linear-gradient(135deg,#07547d,#12a8ca);color:#fff;padding:24px 28px;border-radius:27px 27px 0 0}.loteka-trace-head h3{margin:0;font-size:25px}.loteka-trace-head p{margin:6px 0 0;opacity:.94;font-weight:650}.loteka-trace-close{width:48px;height:48px;border-radius:18px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.13);color:#fff;font-size:20px;cursor:pointer}
  .loteka-trace-body{padding:22px}.loteka-trace-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.loteka-trace-card{background:#fff;border:1px solid #d2eaf4;border-radius:18px;padding:15px 16px;box-shadow:0 12px 28px rgba(4,56,89,.06)}.loteka-trace-card span{display:block;color:#6a8296;font-size:12px;font-weight:900;text-transform:uppercase}.loteka-trace-card b{display:block;color:#003b66;font-size:16px;margin-top:6px}
  .loteka-timeline{background:#fff;border:1px solid #d2eaf4;border-radius:20px;padding:8px 0;overflow:hidden}.loteka-timeline-row{display:grid;grid-template-columns:170px 190px 1fr;gap:14px;padding:14px 18px;border-bottom:1px solid #edf5f9;align-items:start}.loteka-timeline-row:last-child{border-bottom:0}.loteka-timeline-row .date{color:#5e778c;font-weight:800}.loteka-timeline-row .type{font-weight:950;color:#007fa8}.loteka-timeline-row .desc{color:#123b5c;font-weight:700;line-height:1.45}
  @media(max-width:900px){.loteka-trace-grid{grid-template-columns:1fr 1fr}.loteka-timeline-row{grid-template-columns:1fr}.agency-inv-product{min-width:unset}}
</style>



<style id="rrhh-dashboard-final-fix">
/* v66 RRHH: arreglo real sin tocar sidebar ni layout global */
#vista-dashboard-rrhh{position:relative!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:26px!important;background:linear-gradient(180deg,#f7fbff 0%,#eef7fc 100%)!important;border:1px solid #d8e8f2!important;border-radius:30px!important;overflow:hidden!important;}
#vista-dashboard-rrhh::before{display:none!important;}
#vista-dashboard-rrhh *,#vista-dashboard-rrhh *::before,#vista-dashboard-rrhh *::after{box-sizing:border-box;}
.rrhh-dashboard-final{display:grid;gap:18px;width:100%;max-width:100%;min-width:0;}
.rrhh-final-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:18px;align-items:stretch;min-width:0;}
.rrhh-final-copy{min-width:0;min-height:315px;padding:42px 44px;border-radius:32px;background:linear-gradient(135deg,#0a4774 0%,#087fb7 58%,#16b9dd 100%);color:#fff;box-shadow:0 22px 48px rgba(5,83,128,.18);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;}
.rrhh-final-copy::after{content:"";position:absolute;right:-70px;top:-80px;width:230px;height:230px;border-radius:999px;background:rgba(255,255,255,.14);}
.rrhh-final-tag{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);font-size:12px;font-weight:1000;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.rrhh-final-copy h2{font-size:clamp(38px,4.2vw,60px);line-height:.96;margin:0 0 12px;font-weight:1000;letter-spacing:-.04em;color:#fff;white-space:normal;}
.rrhh-final-copy p{max-width:720px;margin:0;color:rgba(255,255,255,.92);font-size:17px;line-height:1.55;font-weight:700;}
.rrhh-final-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px;}
.rrhh-final-actions button,.rrhh-final-card button{border:0;border-radius:14px;background:#11a8d2;color:#fff;font-weight:1000;padding:12px 16px;cursor:pointer;box-shadow:0 12px 24px rgba(4,101,145,.18);}
.rrhh-final-actions button{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.24);}
.rrhh-final-actions button:hover,.rrhh-final-card button:hover{transform:translateY(-2px);}
.rrhh-final-logo-card{min-width:0;min-height:315px;border-radius:32px;background:linear-gradient(180deg,#fff 0%,#f7fcff 100%);border:1px solid #d8e9f2;box-shadow:0 18px 46px rgba(9,70,111,.10);display:grid;place-items:center;padding:24px;overflow:hidden;}
.rrhh-final-logo-card img{width:min(100%,330px);height:auto;max-height:260px;object-fit:contain;filter:drop-shadow(0 16px 26px rgba(7,65,105,.11));}
.rrhh-final-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;min-width:0;}
.rrhh-final-kpis button{min-width:0;text-align:left;border:1px solid #d8e8f2;border-radius:24px;background:#fff;padding:22px;min-height:132px;cursor:pointer;box-shadow:0 14px 34px rgba(18,77,114,.07);transition:.18s ease;}
.rrhh-final-kpis button:hover,.rrhh-final-card:hover{transform:translateY(-3px);box-shadow:0 20px 42px rgba(17,94,145,.12);border-color:#bfe3f2;}
.rrhh-final-kpis span,.rrhh-card-head span,.rrhh-panel-title span{display:block;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.06em;color:#6f879d;}
.rrhh-final-kpis strong{display:block;font-size:42px;line-height:1;margin:12px 0 8px;color:#0f4f7e;font-weight:1000;}
.rrhh-final-kpis em{font-style:normal;color:#5b748a;font-weight:900;font-size:13px;}
.rrhh-final-consults{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:16px;min-width:0;}
.rrhh-final-card{min-width:0;border:1px solid #d8e8f2;border-radius:28px;background:#fff;padding:24px;box-shadow:0 14px 34px rgba(18,77,114,.07);cursor:pointer;transition:.18s ease;}
.rrhh-final-card.primary{background:linear-gradient(180deg,#fff 0%,#f7fcff 100%);}
.rrhh-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px;}
.rrhh-card-head h3{margin:5px 0 0;color:#144c73;font-size:25px;line-height:1.05;font-weight:1000;}
.rrhh-card-head i{width:48px;height:48px;border-radius:18px;display:grid;place-items:center;background:#e7f8fd;color:#0a9fd0;font-size:20px;flex:0 0 auto;}
.rrhh-mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px;}
.rrhh-mini-grid.compact{grid-template-columns:repeat(2,minmax(0,1fr));}
.rrhh-mini-grid div{min-width:0;border:1px solid #e1edf5;border-radius:18px;background:#f8fbfe;padding:14px;}
.rrhh-mini-grid span{display:block;color:#6f879d;font-size:11px;text-transform:uppercase;font-weight:1000;margin-bottom:8px;}
.rrhh-mini-grid strong{display:block;color:#0f4f7e;font-size:28px;font-weight:1000;line-height:1;}
.rrhh-final-bottom{display:grid;grid-template-columns:1fr 1fr;gap:16px;min-width:0;}
.rrhh-final-panel{min-width:0;background:#fff;border:1px solid #d8e8f2;border-radius:28px;padding:22px;box-shadow:0 14px 34px rgba(18,77,114,.07);}
.rrhh-panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.rrhh-panel-title h3{margin:0;color:#144c73;font-size:21px;font-weight:1000;}
.rrhh-hidden-filters{display:none!important;}
#vista-dashboard-rrhh .rrhd-bars,#vista-dashboard-rrhh .rrhd-feed-list{max-height:290px;overflow:auto;}
@media (max-width:1280px){.rrhh-final-hero{grid-template-columns:1fr}.rrhh-final-logo-card{display:none}.rrhh-final-consults{grid-template-columns:1fr}.rrhh-final-bottom{grid-template-columns:1fr}.rrhh-final-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.rrhh-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:720px){#vista-dashboard-rrhh{padding:18px!important;border-radius:24px!important}.rrhh-final-copy{padding:30px 24px;min-height:260px;border-radius:24px}.rrhh-final-copy h2{font-size:38px}.rrhh-final-kpis{grid-template-columns:1fr}.rrhh-final-actions button{width:100%;}.rrhh-mini-grid,.rrhh-mini-grid.compact{grid-template-columns:1fr}}
</style>



<style id="loteka-v78-topbar-modal-safe-css">
/* Ajuste v78: los cuadros/modales se abren debajo de la barra superior para que no queden tapados. */
:root{--loteka-topbar-h:62px;}.modal,.lev-modal,.opx-modal,.hrx-modal,.empconsulta-modal{
  top:var(--loteka-topbar-h)!important;
  inset:var(--loteka-topbar-h) 0 0 0!important;
  height:calc(100vh - var(--loteka-topbar-h))!important;
  max-height:calc(100vh - var(--loteka-topbar-h))!important;
  align-items:flex-start!important;
  padding-top:18px!important;
  overflow:auto!important;
}.modal-content,.ops-modal,.lev-modal-dialog,.opx-modal-card,.hrx-modal-card,.empconsulta-dialog{
  max-height:calc(100vh - var(--loteka-topbar-h) - 36px)!important;
}
.modal-content.large,
.modal-content.xl{
  margin-top:0!important;
}
.ops-modal-backdrop{
  top:var(--loteka-topbar-h)!important;
  inset:var(--loteka-topbar-h) 0 0 0!important;
  height:calc(100vh - var(--loteka-topbar-h))!important;
  align-items:flex-start!important;
  padding-top:18px!important;
  overflow:auto!important;
}
@media(max-width:900px){
  :root{--loteka-topbar-h:58px;}.modal,.lev-modal,.opx-modal,.hrx-modal,.empconsulta-modal,.ops-modal-backdrop{
    padding-top:12px!important;
  }.modal-content,.ops-modal,.lev-modal-dialog,.opx-modal-card,.hrx-modal-card,.empconsulta-dialog{
    max-height:calc(100vh - var(--loteka-topbar-h) - 24px)!important;
  }
}</style>


<style id="loteka-v81-agency-consulta-edicion-css">
/* v81 - Mejora visual de consulta y edición de agencias: solo presentación, sin alterar lógica ni flujo. */
#modalDetalleAgencia{
  background:rgba(7,22,36,.54)!important;
  backdrop-filter:blur(5px);
}
#modalDetalleAgencia .modal-content.large{
  width:min(1280px,calc(100vw - 72px))!important;
  max-width:1280px!important;
  max-height:calc(100vh - var(--topbar-height,72px) - 38px)!important;
  padding:0!important;
  border-radius:30px!important;
  overflow:auto!important;
  border:1px solid rgba(179,216,235,.95)!important;
  background:linear-gradient(180deg,#ffffff 0%,#f8fcff 100%)!important;
  box-shadow:0 34px 90px rgba(5,31,52,.32)!important;
}
#modalDetalleAgencia .agency-record-shell{
  gap:0!important;
  min-height:100%;
}
#modalDetalleAgencia .agency-record-header{
  position:sticky;
  top:0;
  z-index:8;
  display:grid!important;
  grid-template-columns:minmax(420px,1fr) auto!important;
  align-items:center!important;
  gap:18px!important;
  padding:20px 24px 18px!important;
  border-bottom:1px solid rgba(185,219,236,.95)!important;
  background:
    radial-gradient(circle at 92% 5%,rgba(39,190,225,.26),transparent 28%),
    linear-gradient(135deg,#ffffff 0%,#f7fcff 46%,#eef9fe 100%)!important;
}
#modalDetalleAgencia .agency-record-title{
  display:grid!important;
  gap:10px!important;
  min-width:0!important;
}
#modalDetalleAgencia .agency-record-title h3{
  margin:0!important;
  color:#073b63!important;
  font-size:24px!important;
  letter-spacing:-.02em!important;
  font-weight:1000!important;
}
#modalDetalleAgencia .agency-record-title p{
  margin:0!important;
  color:#5f7891!important;
  font-size:14px!important;
  font-weight:800!important;
  line-height:1.45!important;
}
#modalDetalleAgencia .agency-hero-code{
  display:flex!important;
  flex-wrap:wrap!important;
  gap:8px!important;
}
#modalDetalleAgencia .agency-hero-code > div{
  min-width:86px!important;
  border:1px solid #d9edf7!important;
  border-radius:16px!important;
  background:rgba(255,255,255,.82)!important;
  padding:9px 12px!important;
  box-shadow:0 10px 24px rgba(8,72,120,.06)!important;
}
#modalDetalleAgencia .agency-hero-code span{
  display:block!important;
  color:#6b8399!important;
  text-transform:uppercase!important;
  letter-spacing:.55px!important;
  font-size:10px!important;
  font-weight:1000!important;
  margin-bottom:2px!important;
}
#modalDetalleAgencia .agency-hero-code strong{
  display:block!important;
  color:#073b63!important;
  font-size:14px!important;
  font-weight:1000!important;
}
#modalDetalleAgencia .agency-record-switcher{
  display:flex!important;
  justify-content:flex-end!important;
  align-items:center!important;
  gap:10px!important;
  flex-wrap:wrap!important;
  max-width:690px!important;
}
#modalDetalleAgencia .agency-record-chip,
#modalDetalleAgencia .agency-record-switcher .btn,
#modalDetalleAgencia .agency-record-switcher .btn-secondary{
  min-height:42px!important;
  border-radius:16px!important;
  padding:10px 14px!important;
  font-size:13px!important;
  font-weight:1000!important;
  border:1px solid #d3e8f3!important;
  box-shadow:0 12px 24px rgba(8,72,120,.10)!important;
  white-space:nowrap!important;
}
#modalDetalleAgencia .agency-record-chip{
  background:#fff!important;
  color:#123f63!important;
}
#modalDetalleAgencia .agency-record-chip i{color:#0aa3d5!important}
#modalDetalleAgencia .agency-record-switcher .btn{
  background:linear-gradient(135deg,#0b9fd0,#12b8df)!important;
  color:#fff!important;
  border-color:rgba(255,255,255,.22)!important;
}
#modalDetalleAgencia .agency-record-switcher .btn-secondary{
  background:#edf6fb!important;
  color:#245471!important;
}
#modalDetalleAgencia .agency-master-tabs{
  position:sticky;
  top:124px;
  z-index:7;
  display:flex!important;
  gap:8px!important;
  flex-wrap:nowrap!important;
  overflow-x:auto!important;
  padding:13px 24px!important;
  border-bottom:1px solid #dcecf5!important;
  background:rgba(255,255,255,.96)!important;
  backdrop-filter:blur(8px);
}
#modalDetalleAgencia .agency-master-tab{
  flex:0 0 auto!important;
  border:1px solid transparent!important;
  background:#f4faff!important;
  color:#2f6688!important;
  padding:10px 13px!important;
  border-radius:15px!important;
  font-size:13px!important;
  font-weight:1000!important;
  transition:.18s ease!important;
}
#modalDetalleAgencia .agency-master-tab:hover{
  transform:translateY(-1px);
  border-color:#c8e5f3!important;
  color:#073b63!important;
}
#modalDetalleAgencia .agency-master-tab.active{
  background:linear-gradient(135deg,#078fd0,#11b9df)!important;
  color:#fff!important;
  border-color:rgba(255,255,255,.25)!important;
  box-shadow:0 14px 26px rgba(11,159,208,.22)!important;
}
#modalDetalleAgencia .agency-section{
  padding:24px!important;
  background:linear-gradient(180deg,#f8fcff 0%,#ffffff 100%)!important;
}
#modalDetalleAgencia .agency-form-card{
  border:1px solid #d9edf7!important;
  border-radius:24px!important;
  background:#fff!important;
  overflow:hidden!important;
  box-shadow:0 18px 42px rgba(10,60,95,.08)!important;
}
#modalDetalleAgencia .agency-form-card-head{
  padding:18px 20px!important;
  border-bottom:1px solid #e3f0f7!important;
  background:linear-gradient(180deg,#ffffff 0%,#f8fcff 100%)!important;
}
#modalDetalleAgencia .agency-form-card-head h4{
  margin:0!important;
  color:#073b63!important;
  font-size:18px!important;
  font-weight:1000!important;
}
#modalDetalleAgencia .agency-form-card-head p{
  margin:6px 0 0!important;
  color:#6e879d!important;
  font-size:13px!important;
  font-weight:750!important;
}
#modalDetalleAgencia .agency-form-card-body{
  padding:20px!important;
}
#modalDetalleAgencia .agency-form-grid.four{
  grid-template-columns:repeat(5,minmax(145px,1fr))!important;
  gap:12px!important;
}
#modalDetalleAgencia .agency-mini-stat{
  position:relative!important;
  min-height:84px!important;
  border:1px solid #d8edf7!important;
  border-radius:19px!important;
  padding:14px 16px!important;
  background:linear-gradient(180deg,#ffffff 0%,#f4fbff 100%)!important;
  box-shadow:0 12px 26px rgba(8,72,120,.06)!important;
  overflow:hidden!important;
}
#modalDetalleAgencia .agency-mini-stat:after{
  content:"";
  position:absolute;
  right:-28px;
  top:-34px;
  width:76px;
  height:76px;
  border-radius:50%;
  background:rgba(12,169,215,.10);
}
#modalDetalleAgencia .agency-mini-stat .label{
  color:#6b8297!important;
  font-size:12px!important;
  text-transform:uppercase!important;
  letter-spacing:.35px!important;
  font-weight:1000!important;
}
#modalDetalleAgencia .agency-mini-stat .value{
  color:#073b63!important;
  font-size:26px!important;
  font-weight:1000!important;
  line-height:1!important;
  margin-top:9px!important;
}
#modalDetalleAgencia .agency-form-grid.two{
  grid-template-columns:1fr 1fr!important;
  gap:14px!important;
}
#modalDetalleAgencia .agency-form-field label{
  color:#557187!important;
  font-size:11px!important;
  letter-spacing:.42px!important;
  text-transform:uppercase!important;
  font-weight:1000!important;
}
#modalDetalleAgencia .agency-form-field input,
#modalDetalleAgencia .agency-form-field select,
#modalDetalleAgencia .agency-form-field textarea{
  border:1px solid #d5e8f2!important;
  border-radius:16px!important;
  background:#fbfdff!important;
  min-height:46px!important;
  color:#153c5c!important;
  font-weight:850!important;
  box-shadow:none!important;
}
#modalDetalleAgencia .agency-form-field input:focus,
#modalDetalleAgencia .agency-form-field select:focus,
#modalDetalleAgencia .agency-form-field textarea:focus{
  border-color:#0aa3d5!important;
  box-shadow:0 0 0 4px rgba(10,163,213,.12)!important;
  outline:none!important;
  background:#fff!important;
}
#modalDetalleAgencia .detail-table{
  border-collapse:separate!important;
  border-spacing:0 9px!important;
}
#modalDetalleAgencia .detail-table th{
  color:#60778d!important;
  font-size:11px!important;
  letter-spacing:.35px!important;
  text-transform:uppercase!important;
  background:transparent!important;
}
#modalDetalleAgencia .detail-table td{
  background:#fff!important;
  border-top:1px solid #e0eef6!important;
  border-bottom:1px solid #e0eef6!important;
  color:#36566e!important;
  font-weight:850!important;
}
#modalDetalleAgencia .detail-table td:first-child{border-left:1px solid #e0eef6!important;border-radius:15px 0 0 15px!important}
#modalDetalleAgencia .detail-table td:last-child{border-right:1px solid #e0eef6!important;border-radius:0 15px 15px 0!important}
#modalDetalleAgencia .lev-empty{
  min-height:94px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  border-radius:18px!important;
  background:#f8fcff!important;
  border:1px dashed #cde7f4!important;
  color:#71899d!important;
  font-weight:900!important;
}
#modalAgencia{
  background:rgba(7,22,36,.48)!important;
  backdrop-filter:blur(4px);
}
#modalAgencia .modal-content{
  width:min(840px,calc(100vw - 64px))!important;
  padding:0!important;
  border-radius:28px!important;
  border:1px solid #d9edf7!important;
  background:#fff!important;
  box-shadow:0 30px 80px rgba(5,31,52,.28)!important;
  overflow:hidden!important;
}
#modalAgencia .modal-content > div:first-child{
  margin:0!important;
  padding:20px 22px!important;
  background:linear-gradient(135deg,#073b63,#0d9ecf)!important;
  color:#fff!important;
}
#modalAgencia #tituloModalAgencia{
  margin:0!important;
  color:#fff!important;
  font-size:22px!important;
  font-weight:1000!important;
}
#modalAgencia .close{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:40px!important;
  height:40px!important;
  border-radius:14px!important;
  background:rgba(255,255,255,.14)!important;
  border:1px solid rgba(255,255,255,.24)!important;
  color:#fff!important;
  font-size:24px!important;
}
#modalAgencia .entry-form-grid{
  padding:20px 22px!important;
  gap:14px!important;
}
#modalAgencia .form-group label{
  color:#557187!important;
  font-size:11px!important;
  letter-spacing:.42px!important;
  text-transform:uppercase!important;
  font-weight:1000!important;
}
#modalAgencia .form-group input,
#modalAgencia .form-group select{
  border:1px solid #d5e8f2!important;
  border-radius:16px!important;
  min-height:48px!important;
  background:#fbfdff!important;
  color:#153c5c!important;
  font-weight:850!important;
}
#modalAgencia .modal-content > div:last-child{
  margin:0!important;
  padding:16px 22px 20px!important;
  border-top:1px solid #e3f0f7!important;
  background:#f8fcff!important;
}
@media(max-width:1100px){
  #modalDetalleAgencia .agency-record-header{grid-template-columns:1fr!important}
  #modalDetalleAgencia .agency-record-switcher{justify-content:flex-start!important;max-width:none!important}
  #modalDetalleAgencia .agency-master-tabs{top:190px}
  #modalDetalleAgencia .agency-form-grid.four{grid-template-columns:repeat(2,minmax(145px,1fr))!important}
  #modalDetalleAgencia .agency-form-grid.two{grid-template-columns:1fr!important}
}
@media(max-width:720px){
  #modalDetalleAgencia .modal-content.large,
  #modalAgencia .modal-content{width:calc(100vw - 22px)!important}
  #modalDetalleAgencia .agency-section{padding:14px!important}
  #modalDetalleAgencia .agency-record-header{padding:16px!important}
  #modalDetalleAgencia .agency-master-tabs{top:0;position:relative;padding:10px 14px!important}
  #modalDetalleAgencia .agency-form-grid.four{grid-template-columns:1fr!important}
}
</style>


<style id="loteka-v135-transferencias-recepcion-css">
.loteka-transfer-row-v135 td{vertical-align:middle!important}
.loteka-transfer-sub-v135{display:block;color:#7890a3;font-size:11px;font-weight:800;margin-top:3px}
.loteka-transfer-kind-v135{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;background:#eaf8fc;color:#087da8;border:1px solid #cdeef7;font-size:11px;font-weight:1000}
@media(max-width:1100px){}
@media(max-width:650px){}</style>



<style id="loteka-v6-dispatch-modal-compact-safe">
/* v6 Despachos: modal más compacto y protegido debajo de la barra superior */
:root{--go-topbar-safe-h:70px;}
.dispatch-modal{
  inset:var(--go-topbar-safe-h) 0 0 0!important;
  height:calc(100vh - var(--go-topbar-safe-h))!important;
  max-height:calc(100vh - var(--go-topbar-safe-h))!important;
  align-items:flex-start!important;
  justify-content:center!important;
  padding:12px 18px 18px!important;
  overflow:auto!important;
}
.dispatch-modal.show{display:flex!important;}
.dispatch-modal-card{
  width:min(980px, calc(100vw - 64px))!important;
  max-height:calc(100vh - var(--go-topbar-safe-h) - 24px)!important;
  border-radius:24px!important;
  overflow:auto!important;
  margin:0 auto!important;
}
.dispatch-modal-head{
  padding:14px 20px!important;
  min-height:58px!important;
}
.dispatch-modal-head h3{font-size:18px!important;line-height:1.15!important;}
.dispatch-modal-head h3:before{width:30px!important;height:30px!important;border-radius:11px!important;font-size:13px!important;}
.dispatch-close{width:38px!important;height:38px!important;border-radius:13px!important;}
.dispatch-modal-body{padding:16px 18px!important;}
.dispatch-form-hero{grid-template-columns:minmax(0,1.25fr) minmax(210px,.55fr)!important;gap:12px!important;margin-bottom:14px!important;}
.dispatch-form-banner{border-radius:20px!important;padding:15px 17px!important;}
.dispatch-form-banner h4{font-size:18px!important;}
.dispatch-form-banner small{font-size:12px!important;line-height:1.35!important;}
.dispatch-form-side{gap:9px!important;}
.dispatch-form-chip{border-radius:16px!important;padding:11px 12px!important;}
.dispatch-form-chip b{font-size:16px!important;}
.dispatch-inventory-note{padding:11px 13px!important;margin-bottom:13px!important;border-radius:16px!important;}
.dispatch-form-grid{gap:12px!important;}
.dispatch-field label{font-size:10.5px!important;margin-bottom:6px!important;}
.dispatch-field input,.dispatch-field select,.dispatch-field textarea{border-radius:14px!important;padding:11px 12px!important;}
.dispatch-field textarea{min-height:70px!important;}
.dispatch-product-box{margin-top:13px!important;border-radius:20px!important;}
.dispatch-product-head{padding:12px 14px!important;}
.dispatch-product-row{grid-template-columns:minmax(220px,1.35fr) 82px minmax(180px,.95fr) minmax(170px,.82fr) 104px 40px!important;gap:8px!important;margin:8px 10px!important;padding:10px!important;border-radius:16px!important;}
.dispatch-product-row select,.dispatch-product-row input,.dispatch-stock-badge{height:40px!important;border-radius:12px!important;font-size:13px!important;}
.dispatch-actions{margin-top:12px!important;}
.dispatch-btn{border-radius:14px!important;padding:11px 14px!important;}
.dispatch-ship-table{min-width:900px!important;border-spacing:0 8px!important;}
.dispatch-ship-table td{padding:8px 8px!important;}
.dispatch-ship-table select,.dispatch-ship-table input{height:39px!important;border-radius:12px!important;}
@media(max-width:980px){
  :root{--go-topbar-safe-h:66px;}
  .dispatch-modal{padding:10px 12px 16px!important;}
  .dispatch-modal-card{width:calc(100vw - 24px)!important;max-height:calc(100vh - var(--go-topbar-safe-h) - 18px)!important;}
  .dispatch-form-hero{grid-template-columns:1fr!important;}
}
@media(max-width:640px){
  :root{--go-topbar-safe-h:62px;}
  .dispatch-modal-card{width:calc(100vw - 18px)!important;border-radius:20px!important;}
  .dispatch-modal-body{padding:14px!important;}
  .dispatch-modal-head{padding:13px 14px!important;}
}
</style>


<style id="dispatch-v13-serial-popup-css">
  #dispatchModal.dispatch-screenshot-compact .dispatch-shot-card{max-width:760px;margin:0 auto;}
  #dispatchModal.dispatch-screenshot-compact .dispatch-modal-panel{max-width:820px;}
  .dispatch-shot-line-wrap{grid-template-columns:minmax(0,1fr) auto!important;}
  .dispatch-shot-actions .dispatch-btn{white-space:nowrap;}
  .dispatch-serial-mini-backdrop{position:absolute;inset:0;background:rgba(6,22,36,.32);display:none;align-items:center;justify-content:center;padding:18px;z-index:7;border-radius:inherit;}
  .dispatch-serial-mini-backdrop.show{display:flex;}
  .dispatch-serial-mini-card{width:min(520px,94vw);max-height:72vh;overflow:auto;background:linear-gradient(180deg,#fff,#f8fcff);border:1px solid #cfe9f7;border-radius:22px;box-shadow:0 24px 70px rgba(2,38,65,.28);}
  .dispatch-serial-mini-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #d9edf8;background:#f4fbff;}
  .dispatch-serial-mini-head h4{margin:0;color:#073b63;font-size:17px;font-weight:1000;line-height:1.15;}
  .dispatch-serial-mini-head small{display:block;margin-top:4px;color:#66839a;font-weight:850;}
  .dispatch-serial-mini-close{border:0;width:38px;height:38px;border-radius:14px;background:#e8f7fd;color:#04628f;font-weight:1000;cursor:pointer;display:grid;place-items:center;}
  .dispatch-serial-mini-body{padding:14px 16px;display:grid;gap:10px;}
  .dispatch-serial-mini-product{display:grid;grid-template-columns:46px 1fr;gap:10px;align-items:start;border:1px solid #dbeef8;background:#fff;border-radius:16px;padding:10px;}
  .dispatch-serial-mini-thumb{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#e7f7ff,#f7fcff);border:1px solid #d5edf8;display:grid;place-items:center;color:#0b75a5;overflow:hidden;}
  .dispatch-serial-mini-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
  .dispatch-serial-mini-info b{display:block;color:#173b59;font-size:13px;font-weight:1000;margin-bottom:6px;}
  .dispatch-serial-chip-wrap{display:flex;flex-wrap:wrap;gap:6px;}
  .dispatch-serial-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:#eef8fd;border:1px solid #cfe9f7;color:#073b63;font-size:12px;font-weight:1000;}
  .dispatch-serial-none{display:inline-flex;padding:6px 8px;border-radius:999px;background:#f1f5f9;color:#627589;font-size:12px;font-weight:900;}
  body.go-dark-mode .dispatch-serial-mini-card{background:#0b1d2c!important;border-color:rgba(125,211,252,.22)!important;}
  body.go-dark-mode .dispatch-serial-mini-head{background:#10283a!important;border-color:rgba(125,211,252,.18)!important;}
  body.go-dark-mode .dispatch-serial-mini-head h4,body.go-dark-mode .dispatch-serial-mini-info b{color:#eaf8ff!important;}
  body.go-dark-mode .dispatch-serial-mini-product{background:#0f2638!important;border-color:rgba(125,211,252,.16)!important;}
  @media(max-width:760px){#dispatchModal.dispatch-screenshot-compact .dispatch-modal-panel{max-width:96vw}.dispatch-shot-line-wrap{grid-template-columns:1fr!important}.dispatch-shot-actions{justify-content:flex-start;margin-left:26px}.dispatch-serial-mini-card{width:96vw;}}
</style>

</head><body><div class="title">${esc(title)}</div><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
<div id="ltkAutoSyncOverlay" class="ltk-auto-overlay" aria-hidden="true">
  <div class="ltk-auto-card">
    <div class="ltk-auto-ring"></div>
    <div class="ltk-auto-logo">GRUPOORTIZ</div>
    <div id="ltkAutoSyncLabel" class="ltk-auto-text">Cargando</div>
    <div class="ltk-auto-dots"><span></span><span></span><span></span></div>
  </div>
</div>
<\/body><\/html>`;
  const blob = new Blob([htmlDoc], {type:'application/vnd.ms-excel;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = group ? `levantamientos_grupo_${group}.xls` : 'levantamientos_operaciones.xls';
  a.click();
  URL.revokeObjectURL(url);
}
function levInitFormControls(){
  LEV_STRUCTURE_FIELDS.forEach(label => levSelect(`levStructureState_${levKey(label)}`, LEV_STATE_OPTIONS));
  LEV_ELECTRICAL_FIELDS.forEach(label => levSelect(`levElectricalState_${levKey(label)}`, LEV_STATE_OPTIONS));
  LEV_EQUIPMENT_FIELDS.forEach(field => { levSelect(`levEquipmentAvail_${levKey(field.name)}`, LEV_AVAILABILITY_OPTIONS); levSelect(`levEquipmentState_${levKey(field.name)}`, LEV_EQUIPMENT_STATE_OPTIONS); });
  levSelect('levEditCategory', LEV_CATEGORIES);
  levSelect('levDiagStructure', LEV_DIAG_OPTIONS);
  levSelect('levDiagElectrical', LEV_DIAG_OPTIONS);
  levSelect('levDiagEquipment', LEV_DIAG_OPTIONS);
}
function levInit(){
  levLoad(); levPopulateCategoryFilter(); levPopulateGroupFilter(); levFillDatalists(); levInitFormControls();
  ['levFilterSearch','levFilterCategory','levFilterStatus','levFilterPriority','levFilterGroup','levFilterAgency','levFilterOwner'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', levRender);
    document.getElementById(id)?.addEventListener('change', levRender);
  });
  document.getElementById('levOpenCreateBtn')?.addEventListener('click', levOpenCreate);
  document.getElementById('levExportBtn')?.addEventListener('click', levExportCSV);
  document.getElementById('levExportExcelBtn')?.addEventListener('click', levExportExcel);
  document.getElementById('levResetBtn')?.addEventListener('click', () => { localStorage.removeItem(LEV_STORAGE_KEY); levLoad(); levPopulateCategoryFilter(); levPopulateGroupFilter(); levFillDatalists(); levRender(); });
  document.getElementById('levForm')?.addEventListener('submit', levSaveForm);
  const statusSelect = document.getElementById('levStatus');
  if(statusSelect && !statusSelect.dataset.upgraded){
    statusSelect.innerHTML = '<option>Pendiente de revisión</option><option>Revisado</option><option>Aprobado para acción</option><option>En proceso</option><option>Completado</option><option>Archivado</option>';
    statusSelect.dataset.upgraded = '1';
  }
  const note = document.getElementById('levQuickNote');
  if(note) note.textContent = 'Este formulario rápido sirve para carga manual temporal. Luego podrá sustituirse por el formulario real conectado automáticamente.';
  levRender();
}
window.addEventListener('DOMContentLoaded', levInit);


function abrirVistaOperaciones(nombreVista, vistaWrapper, el){
cambiarVista(vistaWrapper, el);
  activateSidebarLink(el, vistaWrapper);
  if(typeof showView === 'function') showView(nombreVista);
}

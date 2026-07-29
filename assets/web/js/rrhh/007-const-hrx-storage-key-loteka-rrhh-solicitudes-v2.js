
const HRX_STORAGE_KEY = 'loteka_rrhh_solicitudes_v2';
const HRH_STORAGE_KEY = 'loteka_rrhh_historial_v2';
let hrxSolicitudes = [];
let hrxFiltered = [];
let hrxCurrentId = null;
let hrhHistorial = [];
let hrhFiltered = [];
let hrxDetailTab = 'resumen';

function hrxTodayISO(){ return new Date().toISOString().slice(0,10); }
function hrxNowIso(){ return new Date().toISOString(); }
function hrxParseDate(v){
  if(!v) return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+'T00:00:00');
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function hrxFmtDate(v){ const d=hrxParseDate(v); return d ? d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'}) : (v || '-'); }
function hrxFmtDateTime(v){ const d=hrxParseDate(v); return d ? d.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : (v || '-'); }
function hrxAge(date){ const d=hrxParseDate(date); if(!d) return 0; const t=new Date(); let age=t.getFullYear()-d.getFullYear(); const m=t.getMonth()-d.getMonth(); if(m<0 || (m===0 && t.getDate()<d.getDate())) age--; return Math.max(age,0); }
function hrxDaysSince(date){ const d=hrxParseDate(date); if(!d) return 0; return Math.max(0, Math.floor((Date.now()-d.getTime())/86400000)); }
function hrxSafe(v){ return String(v ?? '').trim(); }
function hrxEstadoBadgeClass(v){ const s=(v||'').toLowerCase(); if(s.includes('evalu')) return 'gold'; if(s.includes('aprob')) return 'blue'; if(s.includes('contrat')) return 'green'; if(s.includes('rechaz')) return 'red'; if(s.includes('solic')) return 'gray'; return 'gray'; }
function hrxSafeAgencias(){ try { return Array.isArray(agencias) ? agencias : []; } catch(e){ return []; } }
function hrxSafeGrupos(){ try { return Array.isArray(grupos) ? grupos : []; } catch(e){ return []; } }
function hrxPuestos(){ return ['Representante de Ventas','Operadora','Cajera','Servicio al cliente']; }
function hrxTurnos(){ return ['Matutino','Vespertino']; }
function hrxTiposOperadora(){ return ['Normal','Premium']; }
function hrxEstadosQueue(){ return ['Solicitud','En evaluación','Aprobada / Asignada','Contratada','Rechazada']; }
function hrxEdadRanges(){ return [{v:'18-24',t:'18 a 24 años'},{v:'25-34',t:'25 a 34 años'},{v:'35-44',t:'35 a 44 años'},{v:'45-60',t:'45 a 60 años'}]; }
function hrxActiveQueueStates(){ return ['Solicitud','En evaluación']; }
function hrxEmploymentStates(){ return ['Activa','Vacaciones','Licencia','Cancelada/o','Abandono','Renuncia']; }
function hrxAssetPlaceholder(label){ return `<div style="display:grid;place-items:center;height:100%;text-align:center;padding:18px;color:#55758f;font-weight:800">${label}</div>`; }
function hrxImageOrPlaceholder(src, label){
  const safeSrc = hrxSafe(src);
  return safeSrc
    ? `<img src="${safeSrc}" alt="${label}" style="cursor:zoom-in" onclick="window.open('${safeSrc}','_blank')" onerror="this.parentElement.innerHTML=hrxAssetPlaceholder('${label}')">`
    : hrxAssetPlaceholder(label);
}
function hrxFileToDataUrl(file, cb){ const reader=new FileReader(); reader.onload=e=>cb(e.target?.result || ''); reader.readAsDataURL(file); }

function hrxEmptyRecord(){
  return {
    id:`sol-${Date.now()}`,
    nombre:'', apellido:'', apodos:'', fechaNacimiento:'', lugarNacimiento:'', nacionalidad:'Dominicana', sexo:'Femenino', estadoCivil:'Soltera',
    cedula:'', telefono:'', correo:'', correoConfirmacion:'', provincia:'', sector:'', direccion:'',
    contactoEmergenciaNombre:'', contactoEmergenciaRelacion:'', contactoEmergenciaTelefono:'',
    foto:'', cedulaFrontal:'', cedulaTrasera:'',
    fechaSolicitud:hrxTodayISO(), puesto:'Representante de Ventas', turnoDeseado:'Matutino', agenciaInteres:'', grupoInteres:'',
    estado:'Solicitud', tipoOperadora:'Normal', fechaEntrada:'', estadoLaboral:'Activa', salario:'', salud:'No',
    comentarioEvaluacion:'', comentarioRechazo:'', observaciones:'', experiencia:'', responsable:'RRHH'
  };
}
function hrxNormalize(item){
  const base = hrxEmptyRecord();
  return {
    ...base,
    ...item,
    id:item.id || base.id,
    nombre:hrxSafe(item.nombre), apellido:hrxSafe(item.apellido), apodos:hrxSafe(item.apodos), fechaNacimiento:item.fechaNacimiento || '',
    lugarNacimiento:hrxSafe(item.lugarNacimiento), nacionalidad:hrxSafe(item.nacionalidad || 'Dominicana'), sexo:hrxSafe(item.sexo || 'Femenino'), estadoCivil:hrxSafe(item.estadoCivil || 'Soltera'),
    cedula:hrxSafe(item.cedula), telefono:hrxSafe(item.telefono), correo:hrxSafe(item.correo), correoConfirmacion:hrxSafe(item.correoConfirmacion || item.correo),
    provincia:hrxSafe(item.provincia), sector:hrxSafe(item.sector), direccion:hrxSafe(item.direccion),
    contactoEmergenciaNombre:hrxSafe(item.contactoEmergenciaNombre), contactoEmergenciaRelacion:hrxSafe(item.contactoEmergenciaRelacion), contactoEmergenciaTelefono:hrxSafe(item.contactoEmergenciaTelefono),
    foto:item.foto || '', cedulaFrontal:item.cedulaFrontal || '', cedulaTrasera:item.cedulaTrasera || '',
    fechaSolicitud:item.fechaSolicitud || hrxTodayISO(), puesto:hrxSafe(item.puesto || 'Representante de Ventas'), turnoDeseado:hrxSafe(item.turnoDeseado || 'Matutino'),
    agenciaInteres:hrxSafe(item.agenciaInteres || item.asignadaAgencia), grupoInteres:hrxSafe(item.grupoInteres || item.asignadaGrupo),
    estado:hrxSafe(item.estado || 'Solicitud'), tipoOperadora:hrxSafe(item.tipoOperadora || 'Normal'), fechaEntrada:item.fechaEntrada || '', estadoLaboral:hrxSafe(item.estadoLaboral || 'Activa'),
    salario:hrxSafe(item.salario), salud:hrxSafe(item.salud || 'No'), comentarioEvaluacion:hrxSafe(item.comentarioEvaluacion), comentarioRechazo:hrxSafe(item.comentarioRechazo), observaciones:hrxSafe(item.observaciones), experiencia:hrxSafe(item.experiencia), responsable:hrxSafe(item.responsable || 'RRHH')
  };
}
function hrxDefaultSolicitudes(){
  return [
    hrxNormalize({
      id:'sol-yessica', nombre:'Yessica', apellido:'Martínez', apodos:'Yesi', fechaNacimiento:'2000-04-05', lugarNacimiento:'Santo Domingo', nacionalidad:'Dominicana', sexo:'Femenino', estadoCivil:'Soltera',
      cedula:'001-1234567-8', telefono:'809-555-1200', correo:'yessica.martinez@email.com', correoConfirmacion:'yessica.martinez@email.com', provincia:'Santo Domingo', sector:'Santo Domingo', direccion:'Los Mina, Santo Domingo Este, Calle Principal #14',
      contactoEmergenciaNombre:'Rosa Martínez', contactoEmergenciaRelacion:'Madre', contactoEmergenciaTelefono:'809-333-8899',
      puesto:'Representante de Ventas', turnoDeseado:'Matutino', estado:'Solicitud', tipoOperadora:'Normal', salud:'No',
      agenciaInteres:'0141', grupoInteres:'08', observaciones:'Formulario externo recibido y pendiente de evaluación inicial.', experiencia:'Experiencia básica en caja y servicio al cliente.'
    }),
    hrxNormalize({
      id:'sol-mariela', nombre:'Mariela', apellido:'Reyes', apodos:'Mely', fechaNacimiento:'1998-04-14', lugarNacimiento:'San Cristóbal', nacionalidad:'Dominicana', sexo:'Femenino', estadoCivil:'Unión libre',
      cedula:'402-1234567-1', telefono:'809-555-1441', correo:'mariela.reyes@email.com', correoConfirmacion:'mariela.reyes@email.com', provincia:'Santo Domingo', sector:'Herrera', direccion:'Santo Domingo Oeste',
      contactoEmergenciaNombre:'Juan Reyes', contactoEmergenciaRelacion:'Padre', contactoEmergenciaTelefono:'829-551-1002',
      fechaSolicitud:'2026-04-18', puesto:'Operadora', turnoDeseado:'Matutino', agenciaInteres:'0141', grupoInteres:'08', estado:'En evaluación', tipoOperadora:'Normal', comentarioEvaluacion:'Buen perfil. Pendiente validación final de referencias.', experiencia:'2 años en atención al cliente y cuadre de caja.', observaciones:'Disponibilidad inmediata.'
    })
  ];
}
function hrxLoad(){
  try{ const raw=localStorage.getItem(HRX_STORAGE_KEY); hrxSolicitudes = raw ? JSON.parse(raw) : []; } catch(e){ hrxSolicitudes=[]; }
  if(!Array.isArray(hrxSolicitudes) || !hrxSolicitudes.length) hrxSolicitudes = hrxDefaultSolicitudes();
  hrxSolicitudes = hrxSolicitudes.map(hrxNormalize).filter(r=>hrxActiveQueueStates().includes(r.estado));
  hrxSave();
}

/* ===== Conexión RRHH Solicitudes + BackendCero ===== */
const HRX_BACKEND_CERO_TABLE = 'solicitudes_rrhh';
let hrxBackendCeroRealtimeChannel = null;

function hrxFormatJsonList(value){
  if(!value) return '';
  try{
    const arr = Array.isArray(value) ? value : JSON.parse(value);
    if(!Array.isArray(arr)) return '';
    return arr.map((item, idx)=>{
      if(!item || typeof item !== 'object') return String(item || '');
      const parts = Object.entries(item)
        .filter(([k,v])=>v!==null && v!==undefined && String(v).trim()!=='')
        .map(([k,v])=>`${k}: ${v}`);
      return parts.length ? `${idx+1}. ${parts.join(' · ')}` : '';
    }).filter(Boolean).join('\n');
  }catch(e){ return String(value || ''); }
}

function hrxMapBackendCeroSolicitud(row){
  const fullName = hrxSafe(row.nombre_completo || row.nombre || '');
  const refs = hrxFormatJsonList(row.referencias_laborales);
  const hijos = hrxFormatJsonList(row.hijos);
  const observaciones = [
    row.comentario ? `Comentario: ${row.comentario}` : '',
    row.poblacion_deseada || row.zona_deseada ? `Población/Zona deseada: ${hrxSafe(row.poblacion_deseada)} / ${hrxSafe(row.zona_deseada)}` : '',
    row.dependientes !== null && row.dependientes !== undefined ? `Dependientes: ${row.dependientes}` : '',
    row.cuidador_dependientes ? `Cuidador dependientes: ${row.cuidador_dependientes}` : '',
    hijos ? `Hijos:\n${hijos}` : '',
    refs ? `Referencias laborales:\n${refs}` : ''
  ].filter(Boolean).join('\n\n');

  const experiencia = [
    row.trabajo_loteka ? `Ha trabajado en Agencia Loteka: ${row.trabajo_loteka}` : '',
    row.trabajo_banca ? `Ha laborado en banca de lotería: ${row.trabajo_banca}` : '',
    row.nivel_educacion ? `Nivel de educación: ${row.nivel_educacion}` : '',
    row.estudia_actualmente ? `Estudia actualmente: ${row.estudia_actualmente}` : '',
    row.nivel_tecnologico ? `Manejo tecnológico: ${row.nivel_tecnologico}` : '',
    row.solicito_antes ? `Solicitó antes: ${row.solicito_antes}` : '',
    row.familiares_empresa ? `Familiares en empresa: ${row.familiares_empresa}` : ''
  ].filter(Boolean).join('\n');

  return hrxNormalize({
    id: `sb-${row.id}`,
    backendCeroId: row.id,
    nombre: fullName,
    apellido: '',
    apodos: row.apodo || '',
    fechaNacimiento: row.fecha_nacimiento || '',
    lugarNacimiento: row.lugar_nacimiento || '',
    nacionalidad: row.nacionalidad || 'Dominicano(a)',
    sexo: row.sexo || 'Femenino',
    estadoCivil: row.estado_civil || '',
    cedula: row.cedula || '',
    telefono: row.celular || row.telefono || '',
    correo: row.correo || '',
    correoConfirmacion: row.correo || '',
    provincia: row.provincia || '',
    sector: row.zona_deseada || '',
    direccion: row.direccion || '',
    contactoEmergenciaNombre: row.contacto_emergencia || row.contactoEmergenciaNombre || '',
    contactoEmergenciaRelacion: row.relacion_emergencia || row.contactoEmergenciaRelacion || '',
    contactoEmergenciaTelefono: row.telefono_emergencia || row.contactoEmergenciaTelefono || '',
    foto: row.foto_biografia_url || row.foto || '',
    cedulaFrontal: row.foto_cedula_frontal_url || row.cedulaFrontal || '',
    cedulaTrasera: row.foto_cedula_trasera_url || row.cedulaTrasera || '',
    puesto: 'Representante de Ventas',
    turnoDeseado: row.turno || row.turno_deseado || '',
    estado: row.estado || 'Solicitud',
    agenciaInteres: row.agencia || '',
    grupoInteres: row.grupo || '',
    fechaSolicitud: row.created_at ? String(row.created_at).slice(0,10) : hrxTodayISO(),
    experiencia,
    observaciones,
    comentarioEvaluacion: '',
    comentarioRechazo: '',
    responsable: 'Formulario web',
    tipoOperadora: 'Normal',
    estadoLaboral: 'Activa',
    salud: 'No'
  });
}

async function hrxSyncSolicitudesFromBackendCero(showLog=false){
  return false;
  try{
    if(typeof backendCeroClient === 'undefined' || !backendCeroClient?.from) return;
    const { data, error } = await backendCeroClient
      .from(HRX_BACKEND_CERO_TABLE)
      .select('*')
      .order('created_at', { ascending:false });

    if(error){
      console.error('Error sincronizando solicitudes RRHH desde BackendCero:', error);
      return;
    }

    const remote = (data || [])
      .map(hrxMapBackendCeroSolicitud)
      .filter(r=>hrxActiveQueueStates().includes(r.estado));

    const localOnly = hrxSolicitudes.filter(s=>!s.backendCeroId);
    hrxSolicitudes = [...remote, ...localOnly].map(hrxNormalize).filter(r=>hrxActiveQueueStates().includes(r.estado));
    hrxSave();

    hrxFiltered = [...hrxSolicitudes];
    if(typeof hrxPopulateFilters === 'function') hrxPopulateFilters();
    if(typeof hrxApplyFilters === 'function') hrxApplyFilters();
    if(typeof rrhdRender === 'function') rrhdRender();

    if(showLog) console.log(`Solicitudes RRHH sincronizadas: ${remote.length}`);
  }catch(err){
    console.error('Fallo inesperado sincronizando RRHH:', err);
  }
}

function hrxStartBackendCeroRealtime(){
  try{
    if(typeof backendCeroClient === 'undefined' || !backendCeroClient?.channel || hrxBackendCeroRealtimeChannel) return;
    hrxBackendCeroRealtimeChannel = backendCeroClient
      .channel('rrhh-solicitudes-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:HRX_BACKEND_CERO_TABLE }, () => {
        hrxSyncSolicitudesFromBackendCero(false);
      })
      .subscribe();
  }catch(err){
    console.warn('Realtime RRHH no iniciado:', err);
  }
}
function hrxSave(){ localStorage.setItem(HRX_STORAGE_KEY, JSON.stringify(hrxSolicitudes)); }
function hrhDefault(){ return [{fecha:'2026-04-16T11:45:00', tipo:'Rechazo', nombre:'Luz Maria Feliz', cedula:'402-5551147-2', estado:'Rechazada', agencia:'0105', grupo:'06', origen:'Solicitudes', comentario:'No completó documentación requerida.'},{fecha:'2026-04-19T15:10:00', tipo:'Cambio laboral', nombre:'Rosa De La Cruz', cedula:'001-2345678-9', estado:'Vacaciones', agencia:'0141', grupo:'08', origen:'Operadoras', comentario:'Vacaciones registradas en RRHH.'}]; }
function hrhLoad(){ try{ const raw=localStorage.getItem(HRH_STORAGE_KEY); hrhHistorial = raw ? JSON.parse(raw) : []; } catch(e){ hrhHistorial=[]; } if(!Array.isArray(hrhHistorial) || !hrhHistorial.length) hrhHistorial = hrhDefault(); hrhSave(); }
function hrhSave(){ localStorage.setItem(HRH_STORAGE_KEY, JSON.stringify(hrhHistorial)); }
function hrhAdd(entry){ hrhHistorial.unshift(entry); hrhSave(); hrhApplyFilters(); }
function hrxRegisterHistory(tipo, solicitud, extra={}){ hrhAdd({ fecha: extra.fecha || hrxNowIso(), tipo, nombre: `${solicitud.nombre||''} ${solicitud.apellido||''}`.trim(), cedula: solicitud.cedula || '', estado: extra.estado || solicitud.estado || '', agencia: hrxSafe(extra.agencia ?? solicitud.agenciaInteres), grupo: hrxSafe(extra.grupo ?? solicitud.grupoInteres), origen: extra.origen || 'Solicitudes', comentario: extra.comentario || solicitud.comentarioEvaluacion || solicitud.comentarioRechazo || solicitud.observaciones || '' }); }
function hrxGetById(id){ return hrxSolicitudes.find(s=>s.id===id); }
function hrxRemoveById(id){ hrxSolicitudes = hrxSolicitudes.filter(s=>s.id!==id); hrxSave(); }
function hrxPopulateFilters(){
  // Solicitudes usa un solo buscador: nombre, cédula o sector.
}
function hrxApplyFilters(){
  const q=(document.getElementById('hrxFilterSearch')?.value||'').trim().toLowerCase();
  hrxFiltered = hrxSolicitudes.filter(s=>{
    if(!q) return true;
    const searchable = `${s.nombre||''} ${s.apellido||''} ${s.apodos||''} ${s.cedula||''} ${s.sector||''}`.toLowerCase();
    return searchable.includes(q);
  });
  hrxRender();
}
function hrxResetFilters(){ const el=document.getElementById('hrxFilterSearch'); if(el) el.value=''; hrxApplyFilters(); }
function hrxQuickStatus(estado){
  hrxResetFilters();
  hrxFiltered = hrxSolicitudes.filter(s=>s.estado===estado);
  hrxRender();
}
function hrxSaveRecord(data){ const normalized = hrxNormalize(data); const idx = hrxSolicitudes.findIndex(s=>s.id===normalized.id); if(idx>=0) hrxSolicitudes[idx]=normalized; else hrxSolicitudes.unshift(normalized); hrxSave(); hrxApplyFilters(); return normalized; }
function hrxRender(){
  const data=Array.isArray(hrxFiltered)?hrxFiltered:hrxSolicitudes; const active = hrxSolicitudes; const body=document.getElementById('hrxTableBody'); const total=active.length; const evaluacion=active.filter(s=>s.estado==='En evaluación').length; const pendientes=active.filter(s=>s.estado==='Solicitud').length; const tiempo= total ? Math.round(active.reduce((acc,s)=>acc+hrxDaysSince(s.fechaSolicitud),0)/total) : 0; const aprobadas=hrhHistorial.filter(h=>h.tipo==='Aprobación').length; const contratadas=hrhHistorial.filter(h=>h.tipo==='Contratación').length; const rechazadas=hrhHistorial.filter(h=>h.tipo==='Rechazo').length; const stateCounts={ Solicitud:pendientes, 'En evaluación':evaluacion }; const tableCount=document.getElementById('hrxTableCount'); if(tableCount) tableCount.textContent=`${data.length} resultado${data.length!==1?'s':''}`;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=String(v); }; set('hrxHeroTotal', total); set('hrxHeroEvaluacion', evaluacion); set('hrxHeroAprobadas', aprobadas); set('hrxHeroContratadas', contratadas); set('hrxKpiPendiente', pendientes); set('hrxKpiEvaluacion', evaluacion); set('hrxKpiRechazadas', rechazadas); set('hrxKpiTiempo', tiempo);
  if(!body) return; if(!data.length){ body.innerHTML=`<tr><td colspan="9"><div class="hrx-empty">No hay solicitudes activas que coincidan con la búsqueda.</div></td></tr>`; return; }
  body.innerHTML = data.map((s,i)=>`<tr><td>${i+1}</td><td><strong>${s.nombre} ${s.apellido}</strong><div class="hrx-muted">${s.apodos || 'Sin apodo'} · ${hrxAge(s.fechaNacimiento)} años</div></td><td>${s.cedula || '-'}</td><td>${s.sector || '-'}</td><td>${s.puesto || '-'}</td><td>${s.turnoDeseado || '-'}</td><td>${hrxFmtDate(s.fechaSolicitud)}</td><td><span class="hrx-badge ${hrxEstadoBadgeClass(s.estado)}">${s.estado}</span></td><td><div class="hrx-mini-actions"><button class="hrx-icon-btn" title="Ver" onclick="hrxOpenDetail('${s.id}')"><i class="fas fa-eye"></i></button><button class="hrx-icon-btn" title="Evaluar" onclick="hrxOpenForm('${s.id}')"><i class="fas fa-pen"></i></button><button class="hrx-icon-btn" title="Eliminar" onclick="hrxDelete('${s.id}')"><i class="fas fa-trash"></i></button></div></td></tr>`).join('');
}
function hrxDelete(id){ const rec=hrxGetById(id); if(!rec) return; if(!confirm('¿Eliminar esta solicitud activa?')) return; hrxRemoveById(id); hrxApplyFilters(); hrxRegisterHistory('Eliminación', rec, {comentario:'Solicitud eliminada manualmente de la bandeja.'}); }
function hrxBindAssetInputs(){ [['hrxFotoFile','photo'],['hrxCedulaFrontFile','front'],['hrxCedulaBackFile','back']].forEach(([id,key])=>{ const input=document.getElementById(id); if(!input || input.dataset.bound==='1') return; input.dataset.bound='1'; input.addEventListener('change', ev=>{ const file=ev.target.files && ev.target.files[0]; if(!file) return; hrxFileToDataUrl(file, data=>{ const modal=document.getElementById('hrxFormModal'); if(!modal) return; modal.dataset[key]=data; hrxRefreshFormAssetPreview(); }); }); }); }
function hrxRefreshFormAssetPreview(){ const modal=document.getElementById('hrxFormModal'); if(!modal) return; const set=(id,html)=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; }; set('hrxPhotoPreview', hrxImageOrPlaceholder(modal.dataset.photo || '', 'Foto personal')); set('hrxFrontPreview', hrxImageOrPlaceholder(modal.dataset.front || '', 'Cédula frontal')); set('hrxBackPreview', hrxImageOrPlaceholder(modal.dataset.back || '', 'Cédula trasera')); }
function hrxOpenForm(id=''){
  hrxCurrentId=id||null; const rec=id ? hrxGetById(id) : hrxEmptyRecord(); let modal=document.getElementById('hrxFormModal');
  if(!modal){
    document.body.insertAdjacentHTML('beforeend', `<div class="hrx-modal" id="hrxFormModal"><div class="hrx-dialog"><div class="hrx-modal-head"><div><h3 id="hrxFormTitle">Nueva solicitud</h3><p>Expediente empresarial para datos del formulario externo + evaluación interna de RRHH.</p></div><button class="hrx-close" onclick="hrxCloseModal('hrxFormModal')"><i class="fas fa-xmark"></i></button></div><div class="hrx-modal-body"><div class="hrx-section"><h4 style="margin:0 0 14px;color:#214c6a">Documentos e identidad visual</h4><div class="hrx-detail-grid"><div class="hrx-photo-card"><div class="hrx-photo-box" id="hrxPhotoPreview"></div><input type="file" id="hrxFotoFile" class="opx-hidden-file" accept="image/*"><div class="hrx-actions" style="margin-top:12px"><button class="hrx-btn primary" type="button" onclick="document.getElementById('hrxFotoFile').click()">Subir foto</button></div></div><div class="hrx-photo-card"><div class="hrx-photo-box" id="hrxFrontPreview"></div><input type="file" id="hrxCedulaFrontFile" class="opx-hidden-file" accept="image/*"><div class="hrx-actions" style="margin-top:12px"><button class="hrx-btn light" type="button" onclick="document.getElementById('hrxCedulaFrontFile').click()">Cédula frontal</button></div></div><div class="hrx-photo-card"><div class="hrx-photo-box" id="hrxBackPreview"></div><input type="file" id="hrxCedulaBackFile" class="opx-hidden-file" accept="image/*"><div class="hrx-actions" style="margin-top:12px"><button class="hrx-btn light" type="button" onclick="document.getElementById('hrxCedulaBackFile').click()">Cédula trasera</button></div></div></div></div><div class="hrx-section"><h4 style="margin:0 0 14px;color:#214c6a">Datos personales del formulario</h4><div class="hrx-detail-grid"><div class="hrx-field"><label>Nombre completo</label><input id="hrxNombre"></div><div class="hrx-field"><label>Apellido</label><input id="hrxApellido"></div><div class="hrx-field"><label>Apodos</label><input id="hrxApodos"></div><div class="hrx-field"><label>Fecha de nacimiento</label><input id="hrxFechaNacimiento" type="date"></div><div class="hrx-field"><label>Lugar de nacimiento</label><input id="hrxLugarNacimiento"></div><div class="hrx-field"><label>Nacionalidad</label><input id="hrxNacionalidad"></div><div class="hrx-field"><label>Sexo</label><select id="hrxSexo"><option>Femenino</option><option>Masculino</option></select></div><div class="hrx-field"><label>Estado civil</label><input id="hrxEstadoCivil"></div><div class="hrx-field"><label>Número de cédula</label><input id="hrxCedula"></div><div class="hrx-field"><label>Número de celular</label><input id="hrxTelefono"></div><div class="hrx-field"><label>Correo electrónico</label><input id="hrxCorreo"></div><div class="hrx-field"><label>Reescriba su correo</label><input id="hrxCorreoConfirmacion"></div><div class="hrx-field"><label>Provincia</label><input id="hrxProvincia"></div><div class="hrx-field"><label>Sector</label><input id="hrxSector"></div><div class="hrx-field" style="grid-column:1/-1"><label>Dirección de residencia</label><textarea id="hrxDireccion"></textarea></div></div></div><div class="hrx-section"><h4 style="margin:0 0 14px;color:#214c6a">Contacto de emergencia</h4><div class="hrx-detail-grid"><div class="hrx-field"><label>Nombre</label><input id="hrxEmerNombre"></div><div class="hrx-field"><label>Relación</label><input id="hrxEmerRelacion"></div><div class="hrx-field"><label>Teléfono</label><input id="hrxEmerTelefono"></div></div></div><div class="hrx-section"><h4 style="margin:0 0 14px;color:#214c6a">Evaluación interna de RRHH</h4><div class="hrx-detail-grid"><div class="hrx-field"><label>Puesto solicitado</label><select id="hrxPuesto"></select></div><div class="hrx-field"><label>Estado actual</label><select id="hrxEstado"></select></div><div class="hrx-field"><label>Agencia asignada</label><select id="hrxAgencia"></select></div><div class="hrx-field"><label>Grupo asignado</label><select id="hrxGrupo"></select></div><div class="hrx-field"><label>Turno</label><select id="hrxTurno"></select></div><div class="hrx-field"><label>Tipo de operadora</label><select id="hrxTipoOperadora"></select></div><div class="hrx-field"><label>Fecha de solicitud</label><input id="hrxFechaSolicitud" type="date"></div><div class="hrx-field"><label>Fecha de entrada</label><input id="hrxFechaEntrada" type="date"></div><div class="hrx-field"><label>Estado laboral al ingresar</label><select id="hrxEstadoLaboral"></select></div><div class="hrx-field"><label>Salario</label><input id="hrxSalario" type="number" min="0" step="0.01"></div><div class="hrx-field"><label>Alguna condición de salud</label><select id="hrxSalud"><option>No</option><option>Sí</option></select></div><div class="hrx-field"><label>Responsable</label><input id="hrxResponsable"></div><div class="hrx-field" style="grid-column:1/-1"><label>Experiencia / perfil</label><textarea id="hrxExperiencia"></textarea></div><div class="hrx-field" style="grid-column:1/-1"><label>Comentario de evaluación</label><textarea id="hrxComentarioEvaluacion"></textarea></div><div class="hrx-field" style="grid-column:1/-1"><label>Comentario de rechazo</label><textarea id="hrxComentarioRechazo"></textarea></div><div class="hrx-field" style="grid-column:1/-1"><label>Observaciones internas</label><textarea id="hrxObservaciones"></textarea></div></div></div></div><div class="hrx-modal-actions"><div class="hrx-muted">Lógica empresarial: solicitud y evaluación se quedan en bandeja; aprobada o contratada pasan a Gestión de empleados; rechazada va directo al Historial.</div><div class="hrx-actions"><button class="hrx-btn light" type="button" onclick="hrxCloseModal('hrxFormModal')">Cancelar</button><button class="hrx-btn primary" type="button" onclick="hrxSubmitForm()">Guardar movimiento</button></div></div></div></div>`);
    modal=document.getElementById('hrxFormModal');
  }
  document.getElementById('hrxFormTitle').textContent = id ? 'Evaluar solicitud / RRHH' : 'Nueva solicitud';
  document.getElementById('hrxPuesto').innerHTML = hrxPuestos().map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('hrxTurno').innerHTML = hrxTurnos().map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('hrxEstado').innerHTML = hrxEstadosQueue().map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('hrxTipoOperadora').innerHTML = hrxTiposOperadora().map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('hrxEstadoLaboral').innerHTML = hrxEmploymentStates().map(v=>`<option value="${v}">${v}</option>`).join('');
  document.getElementById('hrxAgencia').innerHTML = `<option value="">Seleccionar agencia</option>${hrxSafeAgencias().map(a=>{ const val=a.codigo || a.numero || a.id || a.nombre || ''; return `<option value="${val}">${val}</option>`; }).join('')}`; document.getElementById('hrxGrupo').innerHTML = `<option value="">Seleccionar grupo</option>${hrxSafeGrupos().map(g=>{ const val=g.codigo || g.nombre || g.id || ''; return `<option value="${val}">${val}</option>`; }).join('')}`;
  const map={ Nombre:'nombre',Apellido:'apellido',Apodos:'apodos',FechaNacimiento:'fechaNacimiento',LugarNacimiento:'lugarNacimiento',Nacionalidad:'nacionalidad',Sexo:'sexo',EstadoCivil:'estadoCivil',Cedula:'cedula',Telefono:'telefono',Correo:'correo',CorreoConfirmacion:'correoConfirmacion',Provincia:'provincia',Sector:'sector',Direccion:'direccion',EmerNombre:'contactoEmergenciaNombre',EmerRelacion:'contactoEmergenciaRelacion',EmerTelefono:'contactoEmergenciaTelefono',Puesto:'puesto',Estado:'estado',Agencia:'agenciaInteres',Grupo:'grupoInteres',Turno:'turnoDeseado',TipoOperadora:'tipoOperadora',FechaSolicitud:'fechaSolicitud',FechaEntrada:'fechaEntrada',EstadoLaboral:'estadoLaboral',Salario:'salario',Salud:'salud',Responsable:'responsable',Experiencia:'experiencia',ComentarioEvaluacion:'comentarioEvaluacion',ComentarioRechazo:'comentarioRechazo',Observaciones:'observaciones' };
  Object.entries(map).forEach(([idField,key])=>{ const el=document.getElementById(`hrx${idField}`); if(el) el.value = rec?.[key] ?? ''; }); if(!document.getElementById('hrxFechaSolicitud').value) document.getElementById('hrxFechaSolicitud').value = hrxTodayISO();
  modal.dataset.photo = rec?.foto || ''; modal.dataset.front = rec?.cedulaFrontal || ''; modal.dataset.back = rec?.cedulaTrasera || ''; ['hrxFotoFile','hrxCedulaFrontFile','hrxCedulaBackFile'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); hrxBindAssetInputs(); hrxRefreshFormAssetPreview(); modal.classList.add('open');
}
function hrxCollectFormData(){ const modal=document.getElementById('hrxFormModal'); return hrxNormalize({ id: hrxCurrentId || `sol-${Date.now()}`, nombre: document.getElementById('hrxNombre').value.trim(), apellido: document.getElementById('hrxApellido').value.trim(), apodos: document.getElementById('hrxApodos').value.trim(), fechaNacimiento: document.getElementById('hrxFechaNacimiento').value, lugarNacimiento: document.getElementById('hrxLugarNacimiento').value.trim(), nacionalidad: document.getElementById('hrxNacionalidad').value.trim(), sexo: document.getElementById('hrxSexo').value, estadoCivil: document.getElementById('hrxEstadoCivil').value.trim(), cedula: document.getElementById('hrxCedula').value.trim(), telefono: document.getElementById('hrxTelefono').value.trim(), correo: document.getElementById('hrxCorreo').value.trim(), correoConfirmacion: document.getElementById('hrxCorreoConfirmacion').value.trim(), provincia: document.getElementById('hrxProvincia').value.trim(), sector: document.getElementById('hrxSector').value.trim(), direccion: document.getElementById('hrxDireccion').value.trim(), contactoEmergenciaNombre: document.getElementById('hrxEmerNombre').value.trim(), contactoEmergenciaRelacion: document.getElementById('hrxEmerRelacion').value.trim(), contactoEmergenciaTelefono: document.getElementById('hrxEmerTelefono').value.trim(), puesto: document.getElementById('hrxPuesto').value, estado: document.getElementById('hrxEstado').value, agenciaInteres: document.getElementById('hrxAgencia').value, grupoInteres: document.getElementById('hrxGrupo').value, turnoDeseado: document.getElementById('hrxTurno').value, tipoOperadora: document.getElementById('hrxTipoOperadora').value, fechaSolicitud: document.getElementById('hrxFechaSolicitud').value || hrxTodayISO(), fechaEntrada: document.getElementById('hrxFechaEntrada').value, estadoLaboral: document.getElementById('hrxEstadoLaboral').value, salario: document.getElementById('hrxSalario').value.trim(), salud: document.getElementById('hrxSalud').value, responsable: document.getElementById('hrxResponsable').value.trim() || 'RRHH', experiencia: document.getElementById('hrxExperiencia').value.trim(), comentarioEvaluacion: document.getElementById('hrxComentarioEvaluacion').value.trim(), comentarioRechazo: document.getElementById('hrxComentarioRechazo').value.trim(), observaciones: document.getElementById('hrxObservaciones').value.trim(), foto: modal?.dataset.photo || '', cedulaFrontal: modal?.dataset.front || '', cedulaTrasera: modal?.dataset.back || '' }); }
function hrxValidateRecord(data){ if(!data.nombre || !data.apellido || !data.cedula){ alert('Completa nombre, apellido y cédula.'); return false; } if(data.correo && data.correoConfirmacion && data.correo !== data.correoConfirmacion){ alert('Los correos no coinciden.'); return false; } if(data.estado==='Rechazada' && !data.comentarioRechazo){ alert('Para rechazar debes escribir el comentario obligatorio.'); return false; } if((data.estado==='Aprobada / Asignada' || data.estado==='Contratada') && !data.agenciaInteres && !data.grupoInteres){ alert('Para aprobar o contratar debes asignar una agencia o un grupo.'); return false; } return true; }
function hrxSyncToOperadoras(data, contracted=false){ if(typeof opxOperadoras==='undefined') return; const existing=(opxOperadoras||[]).find(o=>String(o.cedula||'')===String(data.cedula||'')); const operadora={ id: existing?.id || `opx-${Date.now()}`, nombre:data.nombre, apellido:data.apellido, cedula:data.cedula, grupo:hrxSafe(data.grupoInteres), agencia:hrxSafe(data.agenciaInteres), tipo:data.tipoOperadora || existing?.tipo || 'Normal', turno:data.turnoDeseado || existing?.turno || 'Matutino', fechaEntrada:data.fechaEntrada || existing?.fechaEntrada || hrxTodayISO(), fechaNacimiento:data.fechaNacimiento || existing?.fechaNacimiento || '2000-01-01', salario:data.salario || existing?.salario || '', celular:data.telefono || existing?.celular || '', estadoLaboral: contracted ? (data.estadoLaboral || 'Activa') : (existing?.estadoLaboral || 'Activa'), salud:data.salud || existing?.salud || 'No', saludDescripcion: existing?.saludDescripcion || '', foto: data.foto || existing?.foto || '', observacionGeneral:data.observaciones || existing?.observacionGeneral || '', certificaciones: existing?.certificaciones || [], vacaciones: existing?.vacaciones || [], incentivos: existing?.incentivos || [], faltantes: existing?.faltantes || [], observaciones: existing?.observaciones || [], visitas: existing?.visitas || [] }; if(existing){ const idx=opxOperadoras.findIndex(o=>o.id===existing.id); opxOperadoras[idx]={...existing,...operadora}; } else opxOperadoras.unshift(operadora); if(typeof opxSave==='function') opxSave(); if(typeof opxPopulateFilters==='function') opxPopulateFilters(); if(typeof opxApplyFilters==='function') opxApplyFilters(); }
function hrxProcessDecision(data){ const prev = hrxCurrentId ? hrxGetById(hrxCurrentId) : null; if(data.estado==='Rechazada'){ hrxRegisterHistory('Rechazo', data, {estado:'Rechazada', comentario:data.comentarioRechazo, agencia:data.agenciaInteres, grupo:data.grupoInteres}); if(prev) hrxRemoveById(prev.id); hrxApplyFilters(); hrxCloseModal('hrxFormModal'); return; } if(data.estado==='Aprobada / Asignada'){ hrxSyncToOperadoras(data, false); hrxRegisterHistory('Aprobación', data, {estado:'Aprobada / Asignada', comentario:data.comentarioEvaluacion || 'Candidata aprobada y enviada a Gestión de empleados.', agencia:data.agenciaInteres, grupo:data.grupoInteres}); if(prev) hrxRemoveById(prev.id); hrxApplyFilters(); hrxCloseModal('hrxFormModal'); return; } if(data.estado==='Contratada'){ hrxSyncToOperadoras(data, true); hrxRegisterHistory('Contratación', data, {estado:'Contratada', comentario:data.comentarioEvaluacion || 'Candidata contratada y movida a Gestión de empleados.', agencia:data.agenciaInteres, grupo:data.grupoInteres}); if(prev) hrxRemoveById(prev.id); hrxApplyFilters(); hrxCloseModal('hrxFormModal'); return; } const saved=hrxSaveRecord(data); hrxRegisterHistory(prev ? 'Cambio de estado' : 'Nueva solicitud', saved, {estado:saved.estado, comentario:saved.comentarioEvaluacion || saved.observaciones || (prev ? 'Solicitud actualizada por RRHH.' : 'Solicitud registrada en bandeja.')}); hrxCloseModal('hrxFormModal'); }
function hrxSubmitForm(){ const data = hrxCollectFormData(); if(!hrxValidateRecord(data)) return; hrxProcessDecision(data); }
function hrxOpenDetail(id){ hrxCurrentId=id; const s=hrxGetById(id); if(!s) return; let modal=document.getElementById('hrxDetailModal'); if(!modal){ document.body.insertAdjacentHTML('beforeend', `<div class="hrx-modal" id="hrxDetailModal"><div class="hrx-dialog"><div class="hrx-modal-head"><div><h3 id="hrxDetailTitle"></h3><p id="hrxDetailSubtitle"></p></div><button class="hrx-close" onclick="hrxCloseModal('hrxDetailModal')"><i class="fas fa-xmark"></i></button></div><div class="hrx-modal-body" id="hrxDetailBody"></div><div class="hrx-modal-actions"><div class="hrx-muted">Vista limpia para consulta rápida del expediente recibido desde el formulario.</div><div class="hrx-actions"><button class="hrx-btn light" type="button" onclick="hrxCloseModal('hrxDetailModal')">Cerrar</button><button class="hrx-btn dark" type="button" onclick="hrxOpenForm(hrxCurrentId)">Evaluar</button></div></div></div></div>`); modal=document.getElementById('hrxDetailModal'); } document.getElementById('hrxDetailTitle').textContent = `${s.nombre} ${s.apellido}`.trim(); document.getElementById('hrxDetailSubtitle').textContent = `${s.puesto || '-'} · ${s.turnoDeseado || '-'} · ${s.estado || '-'}`; document.getElementById('hrxDetailBody').innerHTML = `<div class="hrx-profile"><div class="hrx-photo-card"><div class="hrx-photo-box">${hrxImageOrPlaceholder(s.foto, 'Foto personal')}</div><div class="hrx-inline-info" style="margin-top:12px"><span class="hrx-info-chip"><i class="fas fa-id-card"></i> ${s.cedula||'Sin cédula'}</span><span class="hrx-info-chip"><i class="fas fa-phone"></i> ${s.telefono||'Sin teléfono'}</span><span class="hrx-info-chip"><i class="fas fa-envelope"></i> ${s.correo||'Sin correo'}</span></div></div><div class="hrx-section"><div class="hrx-tabs"><button type="button" class="hrx-tab active" onclick="hrxSetDetailTab('resumen', this)">Resumen</button><button type="button" class="hrx-tab" onclick="hrxSetDetailTab('contacto', this)">Contacto</button><button type="button" class="hrx-tab" onclick="hrxSetDetailTab('documentos', this)">Documentos</button></div><div class="hrx-tabpane active" id="hrxPane-resumen"><div class="hrx-detail-grid"><div class="hrx-detail-item"><span class="k">Nombre completo</span><span class="v">${s.nombre} ${s.apellido}</span></div><div class="hrx-detail-item"><span class="k">Apodos</span><span class="v">${s.apodos || '-'}</span></div><div class="hrx-detail-item"><span class="k">Edad</span><span class="v">${hrxAge(s.fechaNacimiento)} años</span></div><div class="hrx-detail-item"><span class="k">Fecha de nacimiento</span><span class="v">${hrxFmtDate(s.fechaNacimiento)}</span></div><div class="hrx-detail-item"><span class="k">Lugar de nacimiento</span><span class="v">${s.lugarNacimiento || '-'}</span></div><div class="hrx-detail-item"><span class="k">Nacionalidad</span><span class="v">${s.nacionalidad || '-'}</span></div><div class="hrx-detail-item"><span class="k">Sexo</span><span class="v">${s.sexo || '-'}</span></div><div class="hrx-detail-item"><span class="k">Estado civil</span><span class="v">${s.estadoCivil || '-'}</span></div><div class="hrx-detail-item"><span class="k">Puesto solicitado</span><span class="v">${s.puesto || '-'}</span></div><div class="hrx-detail-item"><span class="k">Turno deseado</span><span class="v">${s.turnoDeseado || '-'}</span></div><div class="hrx-detail-item"><span class="k">Fecha de solicitud</span><span class="v">${hrxFmtDate(s.fechaSolicitud)}</span></div><div class="hrx-detail-item"><span class="k">Estado actual</span><span class="v">${s.estado || '-'}</span></div></div></div><div class="hrx-tabpane" id="hrxPane-contacto"><div class="hrx-detail-grid"><div class="hrx-detail-item"><span class="k">Provincia</span><span class="v">${s.provincia || '-'}</span></div><div class="hrx-detail-item"><span class="k">Sector</span><span class="v">${s.sector || '-'}</span></div><div class="hrx-detail-item"><span class="k">Dirección</span><span class="v">${s.direccion || '-'}</span></div><div class="hrx-detail-item"><span class="k">Contacto de emergencia</span><span class="v">${s.contactoEmergenciaNombre || '-'}</span></div><div class="hrx-detail-item"><span class="k">Relación</span><span class="v">${s.contactoEmergenciaRelacion || '-'}</span></div><div class="hrx-detail-item"><span class="k">Teléfono emergencia</span><span class="v">${s.contactoEmergenciaTelefono || '-'}</span></div></div></div><div class="hrx-tabpane" id="hrxPane-documentos"><div class="hrx-two-col"><div class="hrx-photo-card"><h4 style="margin:0 0 10px;color:#214c6a">Cédula frontal</h4><div class="hrx-photo-box">${hrxImageOrPlaceholder(s.cedulaFrontal, 'Cédula frontal')}</div></div><div class="hrx-photo-card"><h4 style="margin:0 0 10px;color:#214c6a">Cédula trasera</h4><div class="hrx-photo-box">${hrxImageOrPlaceholder(s.cedulaTrasera, 'Cédula trasera')}</div></div></div><div class="hrx-section"><h4 style="margin:0 0 10px;color:#214c6a">Resumen RRHH</h4><div class="hrx-detail-grid"><div class="hrx-detail-item"><span class="k">Agencia / interés</span><span class="v">${s.agenciaInteres || '-'}</span></div><div class="hrx-detail-item"><span class="k">Grupo / interés</span><span class="v">${s.grupoInteres || '-'}</span></div><div class="hrx-detail-item"><span class="k">Comentario relevante</span><span class="v">${s.comentarioEvaluacion || s.observaciones || '-'}</span></div></div></div></div></div></div>`; modal.classList.add('open'); }
function hrxSetDetailTab(tab, btn){ document.querySelectorAll('#hrxDetailBody .hrx-tab').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active'); document.querySelectorAll('#hrxDetailBody .hrx-tabpane').forEach(p=>p.classList.remove('active')); document.getElementById(`hrxPane-${tab}`)?.classList.add('active'); }
function hrxOpenStatusModal(id){ hrxOpenForm(id); }
function hrxSubmitStatus(){ hrxSubmitForm(); }
function hrxOpenRejectModal(id){ hrxOpenForm(id); setTimeout(()=>{ const el=document.getElementById('hrxEstado'); if(el) el.value='Rechazada'; },50); }
function hrxHire(id, silent=false){ const s=hrxGetById(id); if(!s) return; const data={...s, estado:'Contratada'}; if(!hrxValidateRecord(data)) return; hrxSyncToOperadoras(data, true); hrxRegisterHistory('Contratación', data, {estado:'Contratada', comentario:data.comentarioEvaluacion || 'Candidata contratada y movida a Gestión de empleados.', agencia:data.agenciaInteres, grupo:data.grupoInteres}); hrxRemoveById(id); hrxApplyFilters(); if(!silent) hrxCloseModal('hrxDetailModal'); }
function hrxCloseModal(id){ const el=document.getElementById(id); if(el) el.classList.remove('open'); }
function hrxExportCSV(){ const rows=(hrxFiltered?.length?hrxFiltered:hrxSolicitudes).map((s,i)=>({No:i+1,Nombre:`${s.nombre} ${s.apellido}`.trim(),Cedula:s.cedula,Puesto:s.puesto,Turno:s.turnoDeseado,Agencia:s.agenciaInteres,Grupo:s.grupoInteres,Fecha_solicitud:s.fechaSolicitud,Estado:s.estado,Edad:hrxAge(s.fechaNacimiento)})); if(!rows.length){ alert('No hay datos para exportar.'); return; } const headers=Object.keys(rows[0]); const csv=[headers.join(','), ...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='rrhh_solicitudes_activas.csv'; a.click(); URL.revokeObjectURL(url); }
function hrhPopulateFilters(){ const tipoSel=document.getElementById('hrhFilterTipo'), estadoSel=document.getElementById('hrhFilterEstado'), grupoSel=document.getElementById('hrhFilterGrupo'), agenciaSel=document.getElementById('hrhFilterAgencia'), origenSel=document.getElementById('hrhFilterOrigen'); if(!tipoSel) return; const tipos=[...new Set(hrhHistorial.map(h=>h.tipo))]; const estados=[...new Set(hrhHistorial.map(h=>h.estado))]; const grupos=[...new Set(hrhHistorial.map(h=>String(h.grupo||'')).filter(Boolean))]; const agencias=[...new Set(hrhHistorial.map(h=>String(h.agencia||'')).filter(Boolean))]; const origenes=[...new Set(hrhHistorial.map(h=>h.origen))]; tipoSel.innerHTML = `<option value="">Todos</option>${tipos.map(v=>`<option value="${v}">${v}</option>`).join('')}`; estadoSel.innerHTML = `<option value="">Todos</option>${estados.map(v=>`<option value="${v}">${v}</option>`).join('')}`; grupoSel.innerHTML = `<option value="">Todos</option>${grupos.map(v=>`<option value="${v}">${v}</option>`).join('')}`; agenciaSel.innerHTML = `<option value="">Todas</option>${agencias.map(v=>`<option value="${v}">${v}</option>`).join('')}`; origenSel.innerHTML = `<option value="">Todos</option>${origenes.map(v=>`<option value="${v}">${v}</option>`).join('')}`; }
function hrhApplyFilters(){ const nombre=(document.getElementById('hrhFilterNombre')?.value||'').trim().toLowerCase(); const cedula=(document.getElementById('hrhFilterCedula')?.value||'').trim().toLowerCase(); const tipo=document.getElementById('hrhFilterTipo')?.value||''; const estado=document.getElementById('hrhFilterEstado')?.value||''; const grupo=document.getElementById('hrhFilterGrupo')?.value||''; const agencia=document.getElementById('hrhFilterAgencia')?.value||''; const origen=document.getElementById('hrhFilterOrigen')?.value||''; hrhFiltered = hrhHistorial.filter(h=>{ if(nombre && !String(h.nombre||'').toLowerCase().includes(nombre)) return false; if(cedula && !String(h.cedula||'').toLowerCase().includes(cedula)) return false; if(tipo && h.tipo!==tipo) return false; if(estado && h.estado!==estado) return false; if(grupo && String(h.grupo||'')!==grupo) return false; if(agencia && String(h.agencia||'')!==agencia) return false; if(origen && h.origen!==origen) return false; return true; }); hrhRender(); }
function hrhResetFilters(){ ['hrhFilterNombre','hrhFilterCedula'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); ['hrhFilterTipo','hrhFilterEstado','hrhFilterGrupo','hrhFilterAgencia','hrhFilterOrigen'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); hrhApplyFilters(); }
function hrhRender(){ const data=Array.isArray(hrhFiltered)?hrhFiltered:hrhHistorial; const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=String(v); }; set('hrhTableCount', `${data.length} resultado${data.length!==1?'s':''}`); set('hrhHeroTotal', hrhHistorial.length); set('hrhHeroContratadas', hrhHistorial.filter(h=>h.tipo==='Contratación').length); set('hrhHeroRechazos', hrhHistorial.filter(h=>h.tipo==='Rechazo').length); set('hrhHeroCambios', hrhHistorial.filter(h=>h.tipo==='Cambio de estado' || h.tipo==='Cambio laboral' || h.tipo==='Aprobación').length); const body=document.getElementById('hrhTableBody'); if(!body) return; if(!data.length){ body.innerHTML=`<tr><td colspan="9"><div class="hrx-empty">No hay movimientos que coincidan con los filtros.</div></td></tr>`; } else { body.innerHTML = data.map(h=>`<tr><td>${hrxFmtDateTime(h.fecha)}</td><td><span class="hrx-badge ${h.tipo==='Contratación'?'green':h.tipo==='Rechazo'?'red':'blue'}">${h.tipo}</span></td><td><strong>${h.nombre||'-'}</strong></td><td>${h.cedula||'-'}</td><td>${h.estado||'-'}</td><td>${h.agencia||'-'}</td><td>${h.grupo||'-'}</td><td>${h.origen||'-'}</td><td>${h.comentario||'-'}</td></tr>`).join(''); } const counts={}; hrhHistorial.forEach(h=>{ counts[h.tipo]=(counts[h.tipo]||0)+1; }); const rank=document.getElementById('hrhTypeRank'); if(rank) rank.innerHTML = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v],idx)=>`<div class="hrx-rank-item"><div><strong>${k}</strong><span>${v} movimiento${v!==1?'s':''}</span></div><em>#${idx+1}</em></div>`).join('') || `<div class="hrx-empty">Sin historial todavía.</div>`; }
function hrhExportCSV(){ const rows=(hrhFiltered?.length?hrhFiltered:hrhHistorial).map(h=>({Fecha:h.fecha,Movimiento:h.tipo,Nombre:h.nombre,Cedula:h.cedula,Estado:h.estado,Agencia:h.agencia,Grupo:h.grupo,Origen:h.origen,Comentario:h.comentario})); if(!rows.length){ alert('No hay datos para exportar.'); return; } const headers=Object.keys(rows[0]); const csv=[headers.join(','), ...rows.map(r=>headers.map(h=>`"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))].join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='rrhh_historial.csv'; a.click(); URL.revokeObjectURL(url); }
function hrxBindFilterEvents(){ document.getElementById('hrxFilterSearch')?.addEventListener('input', hrxApplyFilters); ['hrhFilterNombre','hrhFilterCedula'].forEach(id=>document.getElementById(id)?.addEventListener('input', hrhApplyFilters)); ['hrhFilterTipo','hrhFilterEstado','hrhFilterGrupo','hrhFilterAgencia','hrhFilterOrigen'].forEach(id=>document.getElementById(id)?.addEventListener('change', hrhApplyFilters)); }
const hrxOriginalOpxSaveEdit = typeof opxSaveEdit === 'function' ? opxSaveEdit : null; if(hrxOriginalOpxSaveEdit){ opxSaveEdit = function(){ const modal=document.getElementById('opxEditModal'); const id=modal?.dataset.id||''; const prev=id?JSON.parse(JSON.stringify(opxGetById(id)||{})):null; hrxOriginalOpxSaveEdit(); if(!id) return; const next=opxGetById(id); if(!next) return; const estadoSalida = ['Cancelada/o','Abandono','Renuncia']; if(prev && prev.estadoLaboral !== next.estadoLaboral){ const cambioComentario = `Estado laboral cambiado de ${prev.estadoLaboral || 'Sin definir'} a ${next.estadoLaboral || 'Sin definir'}.`; if(estadoSalida.includes(next.estadoLaboral)){ hrhAdd({ fecha: hrxNowIso(), tipo:'Salida de personal', nombre:`${next.nombre||''} ${next.apellido||''}`.trim(), cedula: next.cedula || '', estado: next.estadoLaboral || '', agencia: next.agencia || '', grupo: next.grupo || '', origen:'Operadoras', comentario:cambioComentario + ' Sale automáticamente de Gestión de empleados y pasa al Historial.' }); opxOperadoras = opxOperadoras.filter(o=>o.id!==id); if(typeof opxSave==='function') opxSave(); if(typeof opxPopulateFilters==='function') opxPopulateFilters(); if(typeof opxApplyFilters==='function') opxApplyFilters(); if(typeof opxCloseEdit==='function') opxCloseEdit(); if(typeof opxCurrentId!=='undefined' && opxCurrentId===id) opxCurrentId=''; return; } hrhAdd({ fecha: hrxNowIso(), tipo:'Cambio laboral', nombre:`${next.nombre||''} ${next.apellido||''}`.trim(), cedula: next.cedula || '', estado: next.estadoLaboral || '', agencia: next.agencia || '', grupo: next.grupo || '', origen:'Operadoras', comentario:cambioComentario }); } } }


function rrhhEmpEsc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function rrhhEmpNorm(v){ return String(v || '').trim(); }
function rrhhEmpAgencyByNumber(num){
  const n=rrhhEmpNorm(num);
  try { return (Array.isArray(agencias)?agencias:[]).find(a=>rrhhEmpNorm(a.numero || a.agencia)===n) || null; } catch(e){ return null; }
}
function rrhhEmpGroupByNumber(num){
  const n=rrhhEmpNorm(num).replace(/^Grupo\s+/i,'');
  try { return (Array.isArray(grupos)?grupos:[]).find(g=>rrhhEmpNorm(g.numero || g.nombre).replace(/^Grupo\s+/i,'')===n) || null; } catch(e){ return null; }
}
function rrhhConsultaRows(){
  if((!Array.isArray(opxOperadoras) || !opxOperadoras.length) && typeof opxLoad==='function') opxLoad();
  const map={};
  (opxOperadoras||[]).forEach(o=>{
    const ag=rrhhEmpNorm(o.agencia) || 'Sin agencia';
    if(!map[ag]) map[ag]={agencia:ag, grupo:rrhhEmpNorm(o.grupo), empleadas:[]};
    if(!map[ag].grupo && o.grupo) map[ag].grupo=rrhhEmpNorm(o.grupo);
    map[ag].empleadas.push(o);
  });
  return Object.values(map).map(row=>{
    const agency=rrhhEmpAgencyByNumber(row.agencia);
    const grupo=row.grupo || rrhhEmpNorm(agency?.grupo || agency?.grupoNumero || agency?.grupo_numero || '');
    const group=rrhhEmpGroupByNumber(grupo);
    return {...row, grupo, agency, encargado: rrhhEmpNorm(agency?.encargado || agency?.nombre_encargado || group?.encargado || group?.nombre_encargado || '-')};
  }).sort((a,b)=>String(a.grupo||'').localeCompare(String(b.grupo||''),undefined,{numeric:true}) || String(a.agencia).localeCompare(String(b.agencia),undefined,{numeric:true}));
}
function rrhhConsultaEmpleadasRender(){
  const q=(document.getElementById('empConSearch')?.value||'').trim().toLowerCase();
  const rows=rrhhConsultaRows();
  const filtered=rows.filter(row=>{
    if(!q) return true;
    const people=row.empleadas.map(o=>`${o.nombre} ${o.apellido} ${o.cedula}`).join(' ');
    const hay=`${row.agencia} agencia ${row.agencia} ${row.grupo} grupo ${row.grupo} ${row.encargado} ${people}`.toLowerCase();
    return hay.includes(q);
  });
  const totalEmps=(opxOperadoras||[]).length;
  const active=(opxOperadoras||[]).filter(o=>String(o.estadoLaboral||'').toLowerCase().includes('activa')).length;
  const grupos=new Set((opxOperadoras||[]).map(o=>rrhhEmpNorm(o.grupo)).filter(Boolean)).size;
  const agenciasSet=new Set((opxOperadoras||[]).map(o=>rrhhEmpNorm(o.agencia)).filter(Boolean)).size;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=String(v); };
  set('empConTotal', totalEmps); set('empConGrupos', grupos); set('empConAgencias', agenciasSet); set('empConActivas', active); set('empConCount', `${filtered.length} resultado${filtered.length!==1?'s':''}`);
  const tbody=document.getElementById('empConTable'); if(!tbody) return;
  if(!filtered.length){ tbody.innerHTML='<tr><td colspan="7"><div class="empconsulta-empty">No hay empleadas asignadas que coincidan con la consulta.</div></td></tr>'; return; }
  tbody.innerHTML=filtered.map(row=>{
    const activas=row.empleadas.filter(o=>String(o.estadoLaboral||'').toLowerCase().includes('activa')).length;
    const turnos=Array.from(new Set(row.empleadas.map(o=>rrhhEmpNorm(o.turno)).filter(Boolean)));
    const encoded=encodeURIComponent(row.agencia);
    const agenciaSolo = typeof lotekaCleanAgencyText === 'function' ? lotekaCleanAgencyText(row.agencia) : String(row.agencia || '');
    return `<tr><td><span class="empconsulta-code">${rrhhEmpEsc(agenciaSolo)}</span><span class="empconsulta-muted">${rrhhEmpEsc(row.agency?.estado || row.agency?.tipo || 'Ficha RRHH')}</span></td><td>${row.grupo?`Grupo ${rrhhEmpEsc(row.grupo)}`:'-'}</td><td>${rrhhEmpEsc(row.encargado||'-')}</td><td><span class="empconsulta-chip"><i class="fas fa-users"></i>${row.empleadas.length}</span></td><td><span class="empconsulta-chip"><i class="fas fa-circle-check"></i>${activas}</span></td><td>${turnos.length?turnos.map(t=>`<span class="empconsulta-chip">${rrhhEmpEsc(t)}</span>`).join(''):'-'}</td><td><button class="empconsulta-action" type="button" onclick="rrhhOpenEmpleadasAgencia('${encoded}')"><i class="fas fa-eye"></i> Ver ficha</button></td></tr>`;
  }).join('');
}
function rrhhConsultaEmpleadasReset(){ const el=document.getElementById('empConSearch'); if(el) el.value=''; rrhhConsultaEmpleadasRender(); }
function rrhhConsultaFocus(kind){ const el=document.getElementById('empConSearch'); if(el){ el.focus(); el.placeholder = kind==='grupo' ? 'Escribe el número del grupo' : 'Escribe el número de agencia'; } }
function rrhhConsultaEmpleadasSetActivas(){ const el=document.getElementById('empConSearch'); if(el) el.value='Activa'; rrhhConsultaEmpleadasRender(); }
function rrhhCloseEmpConsultaModal(){ document.getElementById('empConsultaModal')?.classList.remove('open'); }
function rrhhOpenEmpleadasAgencia(encoded){
  const agencia=decodeURIComponent(encoded||'');
  const row=rrhhConsultaRows().find(r=>String(r.agencia)===String(agencia)); if(!row) return;
  let modal=document.getElementById('empConsultaModal');
  if(!modal){ document.body.insertAdjacentHTML('beforeend', `<div class="empconsulta-modal" id="empConsultaModal"><div class="empconsulta-dialog"><div class="empconsulta-modal-head"><div><h3 id="empConsultaTitle"></h3><p id="empConsultaSub"></p></div><button class="empconsulta-close" onclick="rrhhCloseEmpConsultaModal()"><i class="fas fa-xmark"></i></button></div><div class="empconsulta-modal-body" id="empConsultaBody"></div></div></div>`); modal=document.getElementById('empConsultaModal'); }
  const activas=row.empleadas.filter(o=>String(o.estadoLaboral||'').toLowerCase().includes('activa')).length;
  document.getElementById('empConsultaTitle').textContent=`Agencia ${typeof lotekaCleanAgencyText === 'function' ? lotekaCleanAgencyText(row.agencia) : row.agencia}`;
  document.getElementById('empConsultaSub').textContent=`${row.grupo?`Grupo ${row.grupo}`:'Sin grupo'} · ${row.encargado||'Sin encargado'}`;
  document.getElementById('empConsultaBody').innerHTML=`<div class="empconsulta-info-grid"><div class="empconsulta-info"><span>Grupo</span><b>${row.grupo?`Grupo ${rrhhEmpEsc(row.grupo)}`:'-'}</b></div><div class="empconsulta-info"><span>Encargado</span><b>${rrhhEmpEsc(row.encargado||'-')}</b></div><div class="empconsulta-info"><span>Total</span><b>${row.empleadas.length}</b></div><div class="empconsulta-info"><span>Activas</span><b>${activas}</b></div></div><div class="empconsulta-person-list">${row.empleadas.map(o=>`<div class="empconsulta-person"><div><strong>${rrhhEmpEsc(`${o.nombre||''} ${o.apellido||''}`.trim()||'Sin nombre')}</strong><small>Cédula: ${rrhhEmpEsc(o.cedula||'-')} · Turno: ${rrhhEmpEsc(o.turno||'-')} · Estado: ${rrhhEmpEsc(o.estadoLaboral||'-')}</small></div><button class="empconsulta-action" type="button" onclick="opxOpenDetail('${rrhhEmpEsc(o.id)}')"><i class="fas fa-id-card"></i> Expediente</button></div>`).join('')}</div>`;
  modal.classList.add('open');
}

function agencyEmpNormalizeNumberV71(value){
  const raw=String(value ?? '').trim();
  if(!raw) return '';
  const digits=raw.replace(/[^0-9]/g,'');
  if(!digits) return raw.toLowerCase();
  return String(Number(digits));
}
function agencyCurrentRecordV71(){
  try{
    if(typeof agenciaDetalleActualIndex !== 'undefined' && agenciaDetalleActualIndex !== null && Array.isArray(agencias)){
      return agencias[agenciaDetalleActualIndex] || null;
    }
  }catch(e){}
  return null;
}
function agencyEmpleadasForCurrentV71(){
  if((!Array.isArray(opxOperadoras) || !opxOperadoras.length) && typeof opxLoad==='function') opxLoad();
  const ag=agencyCurrentRecordV71();
  if(!ag) return [];
  const target=agencyEmpNormalizeNumberV71(ag.numero || ag.agencia || ag.nombre);
  return (opxOperadoras || []).filter(emp => agencyEmpNormalizeNumberV71(emp.agencia || emp.agenciaAsignada || emp.agenciaInteres) === target);
}
function agencyRenderEmpleadasTab(){
  const ag=agencyCurrentRecordV71();
  const list=document.getElementById('agencyEmpleadasList');
  const empty=document.getElementById('agencyEmpleadasEmpty');
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=String(v); };
  if(!ag){ if(list) list.innerHTML=''; if(empty) empty.style.display='block'; return; }
  const emps=agencyEmpleadasForCurrentV71();
  const activas=emps.filter(e=>String(e.estadoLaboral || e.estado || '').toLowerCase().includes('activa')).length;
  const turnos=Array.from(new Set(emps.map(e=>rrhhEmpNorm(e.turno)).filter(Boolean)));
  set('agencyEmpTotal', emps.length);
  set('agencyEmpActivas', activas);
  set('agencyEmpTurnos', turnos.length);
  set('agencyEmpGrupo', rrhhEmpNorm(ag.grupo || ag.grupoNumero || getAgencyRealGroup?.(ag) || '-') || '-');
  set('detalleAgenciaEmpleadas', emps.length);
  if(!list) return;
  if(!emps.length){ list.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  list.innerHTML=emps.map(emp=>{
    const nombre=rrhhEmpEsc(`${emp.nombre || ''} ${emp.apellido || ''}`.trim() || 'Sin nombre');
    const cedula=rrhhEmpEsc(emp.cedula || '-');
    const turno=rrhhEmpEsc(emp.turno || '-');
    const estado=rrhhEmpEsc(emp.estadoLaboral || emp.estado || '-');
    const tipo=rrhhEmpEsc(emp.tipoOperadora || emp.tipo || '-');
    const fecha=rrhhEmpEsc(emp.fechaEntrada || emp.fechaContratacion || emp.fecha || '-');
    const id=rrhhEmpEsc(emp.id || '');
    return `<div class="agency-empleada-card-v71">
      <div class="agency-empleada-top-v71"><div><div class="agency-empleada-name-v71">${nombre}</div><div class="agency-empleada-sub-v71">Cédula: ${cedula}</div></div><span class="agency-empleada-status-v71">${estado}</span></div>
      <div class="agency-empleada-meta-v71"><div><span>Turno</span><b>${turno}</b></div><div><span>Tipo</span><b>${tipo}</b></div><div><span>Entrada</span><b>${fecha}</b></div><div><span>Agencia</span><b>${rrhhEmpEsc(ag.numero || '-')}</b></div></div>
      <div class="agency-empleada-actions-v71"><button class="empconsulta-action" type="button" onclick="opxOpenDetail('${id}')"><i class="fas fa-id-card"></i> Expediente</button></div>
    </div>`;
  }).join('');
}

function rrhdAgencyOptions(){ return ['', ...Array.from(new Set([...(typeof opxAgencyOptions==='function'?opxAgencyOptions().filter(Boolean):[]), ...hrxSolicitudes.map(s=>String(s.agenciaInteres||'')).filter(Boolean), ...hrhHistorial.map(h=>String(h.agencia||'')).filter(Boolean)])).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))]; }
function rrhdGroupOptions(){ return ['', ...Array.from(new Set([...(typeof opxGroupOptions==='function'?opxGroupOptions().filter(Boolean):[]), ...hrxSolicitudes.map(s=>String(s.grupoInteres||'')).filter(Boolean), ...hrhHistorial.map(h=>String(h.grupo||'')).filter(Boolean)])).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))]; }
function rrhdEstadoOptions(){ return ['', 'Solicitud','En evaluación','Activa','Vacaciones','Licencia','Contratada','Rechazada','Renuncia','Abandono','Cancelada/o']; }
function rrhdPopulateFilters(){
  const agencia=document.getElementById('rrhdFilterAgencia'), grupo=document.getElementById('rrhdFilterGrupo'), estado=document.getElementById('rrhdFilterEstado'), turno=document.getElementById('rrhdFilterTurno');
  if(!agencia) return;
  const current = {agencia:agencia.value, grupo:grupo.value, estado:estado.value, turno:turno.value};
  agencia.innerHTML = rrhdAgencyOptions().map(v=>`<option value="${v}">${v||'Todas'}</option>`).join('');
  grupo.innerHTML = rrhdGroupOptions().map(v=>`<option value="${v}">${v?v.startsWith('Grupo')?v:`Grupo ${v}`:'Todos'}</option>`).join('');
  estado.innerHTML = rrhdEstadoOptions().map(v=>`<option value="${v}">${v||'Todos'}</option>`).join('');
  turno.innerHTML = `<option value="">Todos</option>${hrxTurnos().map(v=>`<option value="${v}">${v}</option>`).join('')}`;
  agencia.value=current.agencia; grupo.value=current.grupo; estado.value=current.estado; turno.value=current.turno;
}
function rrhdGetFilterState(){ return { agencia: document.getElementById('rrhdFilterAgencia')?.value || '', grupo: document.getElementById('rrhdFilterGrupo')?.value || '', estado: document.getElementById('rrhdFilterEstado')?.value || '', turno: document.getElementById('rrhdFilterTurno')?.value || ''}; }
function rrhdFilterSolicitudes(extra={}){
  const f = {...rrhdGetFilterState(), ...extra};
  return hrxSolicitudes.filter(s=>{
    if(f.agencia && String(s.agenciaInteres||'')!==f.agencia) return false;
    if(f.grupo && String(s.grupoInteres||'')!==f.grupo) return false;
    if(f.turno && String(s.turnoDeseado||'')!==f.turno) return false;
    if(f.estado && String(s.estado||'')!==f.estado) return false;
    return true;
  });
}
function rrhdFilterOperadoras(extra={}){
  const f = {...rrhdGetFilterState(), ...extra};
  return opxOperadoras.filter(o=>{
    if(f.agencia && String(o.agencia||'')!==f.agencia) return false;
    if(f.grupo && String(o.grupo||'')!==f.grupo) return false;
    if(f.turno && String(o.turno||'')!==f.turno) return false;
    if(f.estado && String(o.estadoLaboral||'')!==f.estado) return false;
    return true;
  });
}
function rrhdFilterHistorial(extra={}){
  const f = {...rrhdGetFilterState(), ...extra};
  return hrhHistorial.filter(h=>{
    if(f.agencia && String(h.agencia||'')!==f.agencia) return false;
    if(f.grupo && String(h.grupo||'')!==f.grupo) return false;
    if(f.estado && String(h.estado||'')!==f.estado && String(h.tipo||'')!==f.estado) return false;
    return true;
  });
}
function rrhdSet(id,v){ const el=document.getElementById(id); if(el) el.textContent=String(v); }
function rrhdRenderBars(solicitudes, operadoras, historial){
  const rows = [
    {label:'Solicitud', value: solicitudes.filter(s=>s.estado==='Solicitud').length},
    {label:'En evaluación', value: solicitudes.filter(s=>s.estado==='En evaluación').length},
    {label:'Activas', value: operadoras.filter(o=>o.estadoLaboral==='Activa').length},
    {label:'Vacaciones', value: operadoras.filter(o=>o.estadoLaboral==='Vacaciones').length},
    {label:'Licencias', value: operadoras.filter(o=>o.estadoLaboral==='Licencia').length},
    {label:'Salidas', value: historial.filter(h=>String(h.tipo||'')==='Salida de personal').length}
  ];
  const max = Math.max(1, ...rows.map(r=>r.value));
  const wrap=document.getElementById('rrhdBars');
  if(!wrap) return;
  wrap.innerHTML = rows.map(r=>`<div class="rrhd-bar-row"><div class="rrhd-bar-label">${r.label}</div><div class="rrhd-bar-track"><div class="rrhd-bar-fill" style="width:${Math.max(8,(r.value/max)*100)}%"></div></div><div class="rrhd-bar-value">${r.value}</div></div>`).join('');
}
function rrhdRenderFeed(historial){
  const wrap=document.getElementById('rrhdFeed');
  if(!wrap) return;
  if(!historial.length){ wrap.innerHTML = `<div class="rrhd-empty">No hay movimientos recientes para mostrar con los filtros actuales.</div>`; return; }
  wrap.innerHTML = historial.slice().sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0)).slice(0,6).map(h=>{
    const tipo=String(h.tipo||'');
    const cls = tipo==='Contratación' ? 'green' : tipo==='Rechazo' || tipo==='Salida de personal' ? 'red' : tipo==='Aprobación' ? 'blue' : 'gold';
    return `<div class="rrhd-feed-item"><div><span class="rrhd-pill ${cls}">${tipo || 'Movimiento'}</span><strong>${h.nombre || 'Sin nombre'}</strong><span>${h.comentario || 'Sin comentario'} · ${h.agencia || '-'} · ${h.grupo || '-'}</span></div><div class="rrhd-feed-time">${hrxFmtDateTime(h.fecha)}</div></div>`;
  }).join('');
}
function rrhdRender(){
  rrhdPopulateFilters();
  const solicitudes = rrhdFilterSolicitudes();
  const operadoras = rrhdFilterOperadoras();
  const historial = rrhdFilterHistorial();
  const now = new Date();
  const sameMonth = (value)=>{ const d=hrxParseDate(value); return d && d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth(); };
  const solicitudesActivas = solicitudes.length;
  const solicitudesPendientes = solicitudes.filter(s=>s.estado==='Solicitud').length;
  const solicitudesEvaluacion = solicitudes.filter(s=>s.estado==='En evaluación').length;
  const tiempoProm = solicitudesActivas ? Math.round(solicitudes.reduce((acc,s)=>acc+hrxDaysSince(s.fechaSolicitud),0)/solicitudesActivas) : 0;
  const activas = operadoras.filter(o=>o.estadoLaboral==='Activa').length;
  const premium = operadoras.filter(o=>o.tipo==='Premium').length;
  const vacaciones = operadoras.filter(o=>o.estadoLaboral==='Vacaciones').length;
  const licencias = operadoras.filter(o=>o.estadoLaboral==='Licencia').length;
  const ausencias = vacaciones + licencias;
  const salidas = historial.filter(h=>String(h.tipo||'')==='Salida de personal').length;
  const contrataciones = historial.filter(h=>String(h.tipo||'')==='Contratación').length;
  const rechazos = historial.filter(h=>String(h.tipo||'')==='Rechazo').length;
  const contratacionesMes = historial.filter(h=>String(h.tipo||'')==='Contratación' && sameMonth(h.fecha)).length;
  const salidasMes = historial.filter(h=>String(h.tipo||'')==='Salida de personal' && sameMonth(h.fecha)).length;
  rrhdSet('rrhdHeroContratacionesMes', contratacionesMes);
  rrhdSet('rrhdHeroSalidasMes', salidasMes);
  rrhdSet('rrhdHeroSolicitudesActivas', solicitudesActivas);
  rrhdSet('rrhdKpiSolicitudes', solicitudesActivas);
  rrhdSet('rrhdKpiActivas', activas);
  rrhdSet('rrhdKpiAusencias', ausencias);
  rrhdSet('rrhdKpiSalidas', salidas);
  rrhdSet('rrhdSolicitudesActivas', solicitudesActivas);
  rrhdSet('rrhdSolicitudesEvaluacion', solicitudesEvaluacion);
  rrhdSet('rrhdSolicitudesPendientes', solicitudesPendientes);
  rrhdSet('rrhdSolicitudesTiempo', tiempoProm);
  rrhdSet('rrhdOperadorasActivas', activas);
  rrhdSet('rrhdOperadorasPremium', premium);
  rrhdSet('rrhdOperadorasVacaciones', vacaciones);
  rrhdSet('rrhdOperadorasLicencias', licencias);
  rrhdSet('rrhdHistorialContrataciones', contrataciones);
  rrhdSet('rrhdHistorialRechazos', rechazos);
  rrhdSet('rrhdHistorialSalidas', salidas);
  rrhdSet('rrhdHistorialMovimientos', historial.length);
  rrhdRenderBars(solicitudes, operadoras, historial);
  rrhdRenderFeed(historial);
}
function rrhdResetFilters(){ ['rrhdFilterAgencia','rrhdFilterGrupo','rrhdFilterEstado','rrhdFilterTurno'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); rrhdRender(); }
function rrhdGoToModule(module, extra={}){
  const navMap = {'solicitudes':'navSolicitudes','operadoras':'navOperadoras','historial-rrhh':'navHistorialRrhh','dashboard-rrhh':'navDashboardRrhh'};
  if(module==='solicitudes'){
    cambiarVista('solicitudes', document.getElementById(navMap[module]));
    const f = {...rrhdGetFilterState(), ...extra};
    const setValue=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val||''; };
    setValue('hrxFilterAgencia', f.agencia);
    setValue('hrxFilterGrupo', f.grupo);
    setValue('hrxFilterEstado', f.estado);
    setValue('hrxFilterTurno', f.turno);
    if(typeof hrxApplyFilters==='function') hrxApplyFilters();
    return;
  }
  if(module==='operadoras'){
    cambiarVista('operadoras', document.getElementById(navMap[module]));
    const f = {...rrhdGetFilterState(), ...extra};
    const setValue=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val||''; };
    setValue('opxFilterAgencia', f.agencia);
    setValue('opxFilterGrupo', f.grupo);
    setValue('opxFilterTurno', f.turno);
    if(document.getElementById('opxFilterEstadoLaboral')) setValue('opxFilterEstadoLaboral', f.estado);
    if(typeof opxApplyFilters==='function') opxApplyFilters();
    return;
  }
  if(module==='historial-rrhh'){
    cambiarVista('historial-rrhh', document.getElementById(navMap[module]));
    const f = {...rrhdGetFilterState(), ...extra};
    const setValue=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=val||''; };
    setValue('hrhFilterAgencia', f.agencia);
    setValue('hrhFilterGrupo', f.grupo);
    setValue('hrhFilterEstado', f.estado);
    if(extra.tipo) setValue('hrhFilterTipo', extra.tipo);
    if(typeof hrhApplyFilters==='function') hrhApplyFilters();
    return;
  }
  cambiarVista('dashboard-rrhh', document.getElementById(navMap[module] || 'navDashboardRrhh'));
}

function hrxInit(){
  hrxLoad();
  hrhLoad();
  hrxPopulateFilters();
  hrhPopulateFilters();
  rrhdPopulateFilters();
  hrxFiltered=[...hrxSolicitudes];
  hrhFiltered=[...hrhHistorial];
  hrxRender();
  hrhRender();
  rrhdRender();
  hrxBindFilterEvents();
  ['rrhdFilterAgencia','rrhdFilterGrupo','rrhdFilterEstado','rrhdFilterTurno'].forEach(id=>document.getElementById(id)?.addEventListener('change', rrhdRender));
  hrxSyncSolicitudesFromBackendCero(false);
  hrxStartBackendCeroRealtime();
}
window.addEventListener('DOMContentLoaded', hrxInit);


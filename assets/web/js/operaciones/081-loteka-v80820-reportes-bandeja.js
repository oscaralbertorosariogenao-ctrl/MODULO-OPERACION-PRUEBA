(function(global){
  'use strict';
  const VERSION='v808.25';
  const STATES=['Reportado','Asignado','En proceso','En incidencia','Completado','Resuelto por soporte remoto'];
  let busy=false;
  let techCache=null;

  function sb(){ return global.lotekaSupabase || global.supabaseClient || global.__supabaseClient || null; }
  function txt(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function has(code){ try{return typeof global.lotekaHasPermission==='function' && global.lotekaHasPermission(code);}catch(_e){return false;} }
  function toast(title,message,tone='info'){
    try{ if(typeof global.showToastNotification==='function') return global.showToastNotification(title,message,tone); }catch(_e){}
    console[tone==='warning'?'warn':'log'](`[${title}] ${message}`);
  }
  function canonicalStatus(value){
    const shared=global.GOApp?.operations?.status?.normalizeOperationStatus;
    if(typeof shared==='function') return shared(value);
    const v=txt(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(v.includes('soporte') || v.includes('remot')) return 'Resuelto por soporte remoto';
    if(v.includes('incid')) return 'En incidencia';
    if(v.includes('complet') || v.includes('cerrad') || v.includes('finaliz')) return 'Completado';
    if(v.includes('proceso') || v.includes('inici')) return 'En proceso';
    if(v.includes('asign')) return 'Asignado';
    return 'Reportado';
  }
  function operations(){ try{return typeof global.loadOperations==='function' ? global.loadOperations() : (global.operations || []);}catch(_e){return global.operations || [];} }
  function formatDate(value){ if(!value)return 'Sin fecha'; const d=new Date(value); return Number.isNaN(d.getTime())?'Sin fecha':new Intl.DateTimeFormat('es-DO',{dateStyle:'short',timeStyle:'short'}).format(d); }
  function elapsed(value,end=null){ const a=new Date(value||0).getTime(),b=end?new Date(end).getTime():Date.now(); if(!a||Number.isNaN(a))return '—'; let m=Math.max(0,Math.floor((b-a)/60000)); if(m<60)return `${m} min`; const h=Math.floor(m/60); if(h<24)return `${h} h ${m%60} min`; return `${Math.floor(h/24)} d ${h%24} h`; }
  function statusClass(status){ const s=canonicalStatus(status); if(s==='Completado'||s==='Resuelto por soporte remoto')return 'success'; if(s==='En incidencia')return 'danger'; if(s==='En proceso')return 'progress'; if(s==='Asignado')return 'assigned'; return 'reported'; }
  function findOperation(id){ return operations().find(op=>txt(op.id)===txt(id)||txt(op.code)===txt(id)||txt(op.codigo)===txt(id)); }
  function operationReference(op){ return txt(op?.id || op?.code || op?.codigo); }
  function operationCode(op){ return txt(op?.code || op?.codigo || op?.id); }
  function filterValues(){ return {
    type:document.getElementById('filterType')?.value || '', status:document.getElementById('filterStatus')?.value || '',
    agency:txt(document.getElementById('filterAgency')?.value).toLowerCase(),tech:txt(document.getElementById('filterTech')?.value).toLowerCase(),
    from:document.getElementById('filterDateFrom')?.value || '',to:document.getElementById('filterDateTo')?.value || ''
  };}
  function filtered(){ const f=filterValues(); return operations().filter(op=>{
    const status=canonicalStatus(op.status||op.estado); const date=new Date(op.reportadoAt||op.createdAt||op.fecha_creacion||0);
    return (!f.type||op.type===f.type) && (!f.status||status===f.status)
      && (!f.agency||`${op.agency||''} ${op.agency_number||''} ${op.agency_label||''}`.toLowerCase().includes(f.agency))
      && (!f.tech||txt(op.technician||op.tecnico).toLowerCase().includes(f.tech))
      && (!f.from||date>=new Date(`${f.from}T00:00:00`)) && (!f.to||date<=new Date(`${f.to}T23:59:59`));
  });}
  function actionButtons(op){
    const id=esc(operationReference(op)),state=canonicalStatus(op.status||op.estado); const values=[];
    values.push(`<button class="btn btn-secondary btn-sm" type="button" data-v808-action="view" data-op="${id}"><i class="fas fa-eye"></i> Ver</button>`);
    if(has('asignar_operacion') && ['Reportado','Asignado'].includes(state)) values.push(`<button class="btn btn-primary btn-sm" type="button" data-v808-action="assign" data-op="${id}"><i class="fas fa-user-gear"></i> ${state==='Asignado'?'Reasignar':'Asignar'}</button>`);
    if(has('resolver_soporte_remoto') && ['Reportado','Asignado'].includes(state)) values.push(`<button class="btn btn-secondary btn-sm" type="button" data-v808-action="remote" data-op="${id}"><i class="fas fa-phone"></i> Soporte remoto</button>`);
    return values.join('');
  }
  function render(){
    const tbody=document.getElementById('operationsTableBody'); if(!tbody)return;
    const rows=filtered().sort((a,b)=>new Date(b.reportadoAt||b.createdAt||0)-new Date(a.reportadoAt||a.createdAt||0));
    tbody.innerHTML=rows.length?rows.map(op=>{
      const state=canonicalStatus(op.status||op.estado),reportedAt=op.reportadoAt||op.createdAt||op.fecha_creacion;
      const timer=state==='Reportado'?`Sin asignar: ${elapsed(reportedAt)}`:state==='Asignado'?`Asignado: ${elapsed(op.assignedAt||op.asignado_at)}`:state==='En proceso'?`En proceso: ${elapsed(op.startedAt||op.iniciado_at)}`:state==='En incidencia'?`En incidencia`:'';
      return `<tr class="ops-exec-row v808-row">
        <td><div class="ops-code-block"><span class="ops-code-main">${esc(operationCode(op))}</span><span class="ops-code-sub">${esc(formatDate(reportedAt))}</span></div></td>
        <td><span class="chip ${op.type==='Avería'?'averia':'trabajo'}">${esc(op.type||'Avería')}</span></td>
        <td><div class="ops-title-block"><strong>${esc(op.title||op.titulo||'Reporte')}</strong><p>${esc(op.description||op.descripcion||'Sin descripción')}</p>${op.operationOriginId||op.operacion_origen_id?`<small class="v808-related">Relacionado con ${esc(op.operationOriginId||op.operacion_origen_id)}</small>`:''}</div></td>
        <td><strong>${esc(op.agency||op.agency_label||op.agencia||'Sin agencia')}</strong><div class="muted">${esc(op.grupo||'Sin grupo')}</div></td>
        <td><strong>${esc(op.technician||op.tecnico||'Sin asignar')}</strong></td>
        <td><span class="v808-status ${statusClass(state)}">${esc(state)}</span>${timer?`<small class="v808-timer">${esc(timer)}</small>`:''}</td>
        <td><strong>${esc(formatDate(reportedAt))}</strong></td>
        <td><div class="actions ops-row-actions">${actionButtons(op)}</div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="8" style="text-align:center;padding:28px">No hay reportes que coincidan con los filtros.</td></tr>';
    updateStats();
  }
  function updateStats(){
    const all=operations().map(op=>canonicalStatus(op.status||op.estado));
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=String(val);};
    set('statTotal',all.length);set('statPendiente',all.filter(s=>s==='Reportado').length);set('statAsignada',all.filter(s=>s==='Asignado').length);set('statProceso',all.filter(s=>s==='En proceso').length);set('statCompletado',all.filter(s=>s==='Completado'||s==='Resuelto por soporte remoto').length);
  }
  function setupDom(){
    const title=document.querySelector('#operationsView .page-title, #operationsView h2'); if(title && /operaciones/i.test(title.textContent)) title.textContent='Reportes y operaciones';
    const open=document.getElementById('openCreateModalBtn'); if(open) open.innerHTML='<i class="fas fa-plus"></i> Reportar problema';
    const modalTitle=document.querySelector('#createModalBackdrop .modal-header h3'); if(modalTitle)modalTitle.textContent='Reportar problema';
    const save=document.getElementById('saveOperationBtn'); if(save)save.textContent='Enviar reporte';
    ['operationStatus','operationTechnician'].forEach(id=>{const el=document.getElementById(id); const field=el?.closest('.field,.form-group'); if(field)field.style.display='none';});
    const state=document.getElementById('operationStatus'); if(state){state.innerHTML='<option value="Reportado">Reportado</option>';state.value='Reportado';}
    const filter=document.getElementById('filterStatus'); if(filter){const current=filter.value;filter.innerHTML='<option value="">Todos los estados</option>'+STATES.map(s=>`<option value="${s}">${s}</option>`).join('');if(STATES.includes(current))filter.value=current;}
    const table=document.querySelector('#operationsTableBody')?.closest('table'); const header=table?.querySelector('thead tr');
    if(header)header.innerHTML='<th>Código</th><th>Tipo</th><th>Problema</th><th>Agencia</th><th>Asignado</th><th>Estado / tiempo</th><th>Reportado</th><th>Acciones</th>';
    ['filterType','filterStatus','filterAgency','filterTech','filterDateFrom','filterDateTo'].forEach(id=>document.getElementById(id)?.addEventListener('input',render));
  }
  async function resolveAgency(raw){
    const digits=txt(raw).replace(/\D/g,'').replace(/^0+/,'') || txt(raw);
    const local=(global.agencias||[]).find(a=>{const n=txt(a.numero||a.codigo||a.agencia).replace(/\D/g,'').replace(/^0+/,'');return n===digits;});
    if(local){ const g=local.grupos?.nombre||local.grupo?.nombre||local.grupo||local.grupo_nombre||local.grupo_codigo; return {number:txt(local.numero||digits),label:txt(local.nombre||local.agencia||raw),group:txt(g)}; }
    const client=sb(); if(!client)throw new Error('Supabase no está disponible.');
    for(const value of [digits,txt(raw)]){
      let q=client.from('agencias').select('id,numero,nombre,grupo_id,grupos(id,nombre,codigo)').limit(1);
      q=/^\d+$/.test(value)?q.eq('numero',value):q.ilike('nombre',`%${value}%`);
      let response=await q.maybeSingle();
      if(response.error && /grupo_id|grupos|schema cache|column/i.test(response.error.message || '')){
        let fallback=client.from('agencias').select('id,numero,nombre,grupo').limit(1);
        fallback=/^\d+$/.test(value)?fallback.eq('numero',value):fallback.ilike('nombre',`%${value}%`);
        response=await fallback.maybeSingle();
      }
      const data=response.data;
      if(!response.error&&data){const relation=Array.isArray(data.grupos)?data.grupos[0]:data.grupos;return {number:txt(data.numero),label:txt(data.nombre||raw),group:txt(relation?.nombre||data.grupo||relation?.codigo)};}
    }
    throw new Error('No se pudo identificar la agencia ni su grupo oficial.');
  }
  function selectedProblems(){ return [...document.querySelectorAll('#operationTypeOptionsMenu input[type="checkbox"]:checked')].map(el=>txt(el.value)).filter(Boolean); }
  async function uploadFiles(files,reference,stage,description){
    const results=[];
    for(const file of files){const form=new FormData();form.append('file',file,file.name);form.append('operacion_id',reference);form.append('codigo',reference);form.append('etapa',stage);form.append('origen','web-v808.20');if(description)form.append('descripcion',description);
      const headers=typeof global.lotekaGetApiAuthHeaders==='function'?await global.lotekaGetApiAuthHeaders():{};
      const response=await fetch('/api/r2-upload',{method:'POST',headers,body:form,credentials:'same-origin',cache:'no-store'});const json=await response.json().catch(()=>({}));if(!response.ok||!json.ok)throw new Error(json.message||json.error||'R2 rechazó la evidencia.');if(!json.evidencia)throw new Error('La evidencia llegó a R2, pero Supabase no confirmó operacion_evidencias.');results.push(json);}
    return results;
  }
  async function createReport(event){
    if(busy)return; event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(!has('reportar_operacion')&&!has('crear_operacion'))return toast('Acceso restringido','Tu perfil no puede reportar problemas.','warning');
    const type=document.getElementById('operationType')?.value==='Trabajo'?'Trabajo':'Avería'; const problems=selectedProblems();
    const title=txt(document.getElementById('operationTitle')?.value)||problems[0]||`Reporte de ${type}`; const rawAgency=txt(document.getElementById('operationAgency')?.value); const extra=txt(document.getElementById('operationDescription')?.value); const description=extra||problems.join(', ');
    const errorBox=document.getElementById('createError');
    if(!rawAgency||!description){if(errorBox){errorBox.textContent='Selecciona una agencia y describe o clasifica el problema.';errorBox.classList.remove('hidden');}return;}
    busy=true; const button=document.getElementById('saveOperationBtn');if(button)button.disabled=true;
    let reference='';
    try{const agency=await resolveAgency(rawAgency);if(!agency.group)throw new Error('La agencia no tiene un grupo oficial identificado.');const client=sb();const {data,error}=await client.rpc('rpc_operacion_reportar_v3',{p_agencia:agency.number,p_grupo:agency.group,p_descripcion:description,p_tipo:type,p_titulo:title,p_agencia_label:agency.label,p_categoria:null,p_problema:problems.join(' | ')||title,p_trabajo_a_realizar:type==='Trabajo'?(problems.join(' | ')||title):null,p_origen_reporte:'WEB_OPERACIONES',p_operacion_origen:null});if(error)throw error;
      reference=data?.codigo||data?.operacion_id;const files=[...(document.getElementById('operationImage')?.files||[])];let uploaded=0;let evidenceError=null;
      if(files.length){try{uploaded=(await uploadFiles(files,reference,'REPORTE',description)).length;}catch(error){evidenceError=error;}}
      global.closeCreateModal?.();toast(evidenceError?'Reporte creado; evidencia pendiente':'Reporte registrado',evidenceError?`${reference} se registró, pero la evidencia no pudo guardarse en R2: ${evidenceError.message||evidenceError}`:`${reference} quedó en estado Reportado${uploaded?` con ${uploaded} evidencia(s) en R2`:''}.`,evidenceError?'warning':'success');await global.syncOperationsFromBackendCero?.({silent:true,skipSuccessToast:true});render();
    }catch(error){if(errorBox){errorBox.textContent=error.message||String(error);errorBox.classList.remove('hidden');}toast('No se pudo reportar',error.message||String(error),'warning');}
    finally{busy=false;if(button)button.disabled=false;}
  }
  async function loadTechnicians(){
    if(techCache)return techCache;
    const client=sb();if(!client)throw new Error('Supabase no disponible.');
    const profilesResult=await client.from('perfiles')
      .select('id,nombre_completo,nombre,usuario_login,activo,rol_id,puesto_id,departamento')
      .eq('activo',true)
      .order('nombre_completo');
    if(profilesResult.error)throw profilesResult.error;
    const profiles=profilesResult.data||[];
    const roleIds=[...new Set(profiles.map(p=>p.rol_id).filter(Boolean))];
    const positionIds=[...new Set(profiles.map(p=>p.puesto_id).filter(Boolean))];
    const [rolesResult,positionsResult,permissionsResult]=await Promise.all([
      roleIds.length?client.from('roles').select('id,nombre').in('id',roleIds):Promise.resolve({data:[],error:null}),
      positionIds.length?client.from('puestos').select('id,nombre').in('id',positionIds):Promise.resolve({data:[],error:null}),
      roleIds.length?client.from('roles_permisos').select('rol_id,permisos(codigo)').in('rol_id',roleIds):Promise.resolve({data:[],error:null})
    ]);
    const roleMap=new Map((rolesResult.error?[]:(rolesResult.data||[])).map(row=>[txt(row.id),txt(row.nombre)]));
    const positionMap=new Map((positionsResult.error?[]:(positionsResult.data||[])).map(row=>[txt(row.id),txt(row.nombre)]));
    const executionRoles=new Set();
    if(!permissionsResult.error){
      (permissionsResult.data||[]).forEach(row=>{const code=txt(row?.permisos?.codigo);if(['iniciar_operacion','subir_evidencia_operacion','cerrar_operacion'].includes(code))executionRoles.add(txt(row.rol_id));});
    }
    const technicalText=p=>`${roleMap.get(txt(p.rol_id))||''} ${positionMap.get(txt(p.puesto_id))||''} ${txt(p.departamento)}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    let assignable=executionRoles.size?profiles.filter(p=>executionRoles.has(txt(p.rol_id))):[];
    if(!assignable.length)assignable=profiles.filter(p=>/tecnic|soporte|mantenimiento|instalador|auxiliar.*operaci/.test(technicalText(p)));
    techCache=assignable.map(p=>({id:p.id,name:p.nombre_completo||p.nombre||p.usuario_login||'Responsable'}));
    return techCache;
  }
  function modal({title,body,onSubmit}){let back=document.getElementById('v808Modal');if(back)back.remove();back=document.createElement('div');back.id='v808Modal';back.className='v808-backdrop';back.innerHTML=`<div class="v808-modal"><div class="v808-head"><h3>${esc(title)}</h3><button type="button" data-v808-close>×</button></div><form class="v808-body">${body}<div class="v808-actions"><button type="button" class="btn btn-secondary" data-v808-close>Cancelar</button><button type="submit" class="btn btn-primary">Confirmar</button></div></form></div>`;document.body.appendChild(back);back.querySelectorAll('[data-v808-close]').forEach(b=>b.addEventListener('click',()=>back.remove()));back.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const submit=e.submitter;submit.disabled=true;try{await onSubmit(new FormData(e.currentTarget));back.remove();}catch(error){toast('No se pudo completar',error.message||String(error),'warning');submit.disabled=false;}});}
  async function openAssign(op){const techs=await loadTechnicians();if(!techs.length)throw new Error('No hay perfiles técnicos activos.');modal({title:`Asignar ${operationCode(op)}`,body:`<label class="field"><span>Técnico o responsable</span><select class="select" name="technician" required><option value="">Selecciona</option>${techs.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><label class="field"><span>Comentario (opcional)</span><textarea class="textarea" name="comment" maxlength="1000"></textarea></label>`,onSubmit:async fd=>{const {error}=await sb().rpc('rpc_operacion_asignar_v2',{p_operacion:operationReference(op),p_tecnico_id:fd.get('technician'),p_comentario:txt(fd.get('comment'))||null});if(error)throw error;toast('Operación asignada',`${operationCode(op)} fue asignada correctamente.`,'success');await global.syncOperationsFromBackendCero?.({silent:true,skipSuccessToast:true});render();}});}
  function openRemote(op){modal({title:`Resolver ${operationCode(op)} por soporte remoto`,body:`<label class="field"><span>Canal</span><select class="select" name="channel"><option>Teléfono</option><option>WhatsApp</option><option>Videollamada</option><option>Asistencia remota</option><option>Otro</option></select></label><label class="field"><span>Comentario (opcional)</span><textarea class="textarea" name="comment" maxlength="2000"></textarea></label><label class="field"><span>Evidencias (opcionales, almacenadas en R2)</span><input class="input" type="file" name="files" multiple accept="image/*,video/*"></label>`,onSubmit:async fd=>{const files=[...(document.querySelector('#v808Modal input[name="files"]')?.files||[])];const comment=txt(fd.get('comment'));if(files.length)await uploadFiles(files,operationCode(op),'SOPORTE_REMOTO',comment);const {error}=await sb().rpc('rpc_operacion_resolver_soporte_remoto_v2',{p_operacion:operationReference(op),p_canal:txt(fd.get('channel'))||'Teléfono',p_comentario:comment||null});if(error)throw error;toast('Reporte resuelto',`${operationCode(op)} fue resuelto por soporte remoto.`,'success');await global.syncOperationsFromBackendCero?.({silent:true,skipSuccessToast:true});render();}});}
  function installStyles(){if(document.getElementById('v808Styles'))return;const st=document.createElement('style');st.id='v808Styles';st.textContent=`.v808-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-weight:700;font-size:.78rem}.v808-status.reported{background:#fff3cd;color:#664d03}.v808-status.assigned{background:#cff4fc;color:#055160}.v808-status.progress{background:#cfe2ff;color:#084298}.v808-status.danger{background:#f8d7da;color:#842029}.v808-status.success{background:#d1e7dd;color:#0f5132}.v808-timer,.v808-related{display:block;margin-top:5px;color:#64748b}.v808-backdrop{position:fixed;inset:var(--go-fixed-header-offset,62px) 0 0;background:rgba(15,23,42,.6);z-index:1000025;display:grid;place-items:start center;padding:18px;overflow:auto}.v808-modal{width:min(560px,100%);max-height:calc(100dvh - var(--go-fixed-header-offset,62px) - 36px);background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:auto;margin:0 auto}@media(max-width:700px){.v808-backdrop{inset:var(--go-fixed-header-offset,58px) 0 0;padding:10px}.v808-modal{max-height:calc(100dvh - var(--go-fixed-header-offset,58px) - 20px)}}.v808-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #e5e7eb}.v808-head h3{margin:0}.v808-head button{border:0;background:transparent;font-size:28px;cursor:pointer}.v808-body{padding:20px;display:grid;gap:16px}.v808-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}`;document.head.appendChild(st);}
  function enhanceDetail(op){setTimeout(()=>{const detail=document.getElementById('detailContent');if(!detail||detail.querySelector('[data-v808-detail]'))return;const state=canonicalStatus(op.status||op.estado);const div=document.createElement('div');div.dataset.v808Detail='';div.className='ops-detail-section';div.innerHTML=`<h4>Flujo profesional</h4><div class="ops-detail-summary"><div class="ops-detail-card"><span>Estado actual</span><strong>${esc(state)}</strong></div><div class="ops-detail-card"><span>Tiempo en etapa</span><strong>${esc(state==='Reportado'?elapsed(op.reportadoAt||op.createdAt):state==='Asignado'?elapsed(op.assignedAt):state==='En proceso'?elapsed(op.startedAt):'Consultar historial')}</strong></div>${op.operationOriginId?`<div class="ops-detail-card"><span>Operación de origen</span><strong>${esc(op.operationOriginId)}</strong></div>`:''}</div>`;detail.appendChild(div);},0);}
  function clickHandler(e){const save=e.target.closest('#saveOperationBtn');if(save){createReport(e);return;}const action=e.target.closest('[data-v808-action]');if(!action)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const op=findOperation(action.dataset.op);if(!op)return;if(action.dataset.v808Action==='view'){Promise.resolve(global.showDetail?.(operationReference(op))).finally(()=>enhanceDetail(op));}if(action.dataset.v808Action==='assign')openAssign(op).catch(err=>toast('No se pudo asignar',err.message||String(err),'warning'));if(action.dataset.v808Action==='remote')openRemote(op);}
  function boot(){installStyles();setupDom();global.renderOperations=render;document.addEventListener('click',clickHandler,true);setTimeout(render,800);setTimeout(render,1800);console.info(`[Grupo Ortiz] Reportes y bandeja ${VERSION} activos.`);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);

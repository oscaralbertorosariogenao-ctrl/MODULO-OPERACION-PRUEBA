(function(global){
  'use strict';

  if(global.GOOperationalRoutes && global.GOOperationalRoutes.version === '805.31.0') return;

  var VERSION = '805.31.0';
  var ALL_GROUPS = '__ALL__';
  var state = {
    comparison: null,
    routeOrder: [],
    routes: [],
    profiles: [],
    initialized: false,
    loadingRoutes: false,
    map: null,
    pickerOrder: [],
    pickerSearch: '',
    pickerGroup: ALL_GROUPS,
    exportContext: null,
    mapEditor: null,
    mapMarkers: [],
    roadRoute: null,
    roadRouteAbort: null
  };

  function qs(selector,root){ return (root||document).querySelector(selector); }
  function qsa(selector,root){ return Array.prototype.slice.call((root||document).querySelectorAll(selector)); }
  function esc(value){ return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function text(value){ return String(value==null?'':value).trim(); }
  function uuid(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)); }
  function padAgency(value){ var d=text(value).replace(/\D/g,''); return d ? (d.length<4?d.padStart(4,'0'):d) : ''; }
  function agencyKey(value){ var d=text(value).replace(/\D/g,''); return d ? String(Number(d)) : ''; }
  function nowISO(){ return new Date().toISOString().slice(0,10); }
  function formatDate(value){
    if(!value) return '-';
    try{ var d=String(value).length<=10?new Date(value+'T00:00:00'):new Date(value); return new Intl.DateTimeFormat('es-DO',{day:'2-digit',month:'short',year:'numeric'}).format(d); }
    catch(_e){ return text(value); }
  }
  function runtime(){ return global.GOApp && global.GOApp.__phase2aRuntime ? global.GOApp : null; }
  function client(){
    var rt=runtime();
    if(rt){ try{ var c=rt.supabase.getClient(); if(c&&typeof c.rpc==='function') return c; }catch(_e){} }
    var list=[global.lotekaSupabase,global.supabaseClient,global.__supabaseClient];
    for(var i=0;i<list.length;i++) if(list[i]&&typeof list[i].rpc==='function') return list[i];
    return null;
  }
  function permissions(){ var rt=runtime(); var list=rt?rt.state.get('permissions'):[]; return new Set(Array.isArray(list)?list.map(String):[]); }
  function profileText(){ var rt=runtime(); var p=rt?(rt.state.get('perfil')||{}):{}; return [p.rol_nombre,p.rol,p.puesto_nombre,p.puesto,p.nombre_completo,p.correo].join(' ').toLowerCase(); }
  function canView(){ var p=permissions(),label=profileText(); return p.has('ver_rutas_operativas')||p.has('gestionar_rutas_operativas')||/administrador|auxiliar de operaciones|gerente de operaciones/.test(label); }
  function canManage(){ var p=permissions(),label=profileText(); return p.has('gestionar_rutas_operativas')||/administrador|auxiliar de operaciones|gerente de operaciones/.test(label); }
  function notify(message,type){
    try{ if(typeof global.showToast==='function'){ global.showToast(message,type||'info'); return; } if(typeof global.lotekaToast==='function'){ global.lotekaToast(message,type||'info'); return; } }catch(_e){}
    if(type==='error') console.error('[Rutas]',message); else console.log('[Rutas]',message);
  }
  function friendlyError(error){ var rt=runtime(); return rt?rt.errors.friendly(error):text(error&&error.message?error.message:error||'No se pudo completar la acción.'); }
  function handleError(error,action){ var rt=runtime(); if(rt) rt.errors.capture(error,{module:'rutas-operativas',action:action||'acción'}); notify(friendlyError(error),'error'); }

  function groups(){
    var list=Array.isArray(global.grupos)?global.grupos:[];
    return list.filter(function(g){ return groupId(g)&&!/desactivadas|cerradas/i.test(groupLabel(g)); });
  }
  function agencies(){ return Array.isArray(global.agencias)?global.agencias:[]; }
  function groupLabel(group){ return text(group&&(group.nombre||group.codigo||group.numero))||'Grupo'; }
  function groupCode(group){ var raw=text(group&&(group.codigo||group.numero||group.nombre)); var d=raw.replace(/\D/g,''); return d?'G-'+d.padStart(2,'0'):raw; }
  function groupId(group){ var c=group?[group.supabaseId,group.id_supabase,group.grupo_id,group.id]:[]; for(var i=0;i<c.length;i++) if(uuid(c[i])) return text(c[i]); return null; }
  function agencyId(agency){ var c=agency?[agency.supabaseId,agency.id_supabase,agency.agencia_id,agency.id]:[]; for(var i=0;i<c.length;i++) if(uuid(c[i])) return text(c[i]); return null; }
  function agencyGroupId(agency){ return text(agency&&(agency.grupoId||agency.grupo_id||agency.group_id)); }
  function agencyGroupName(agency){ return text(agency&&(agency.grupo||agency.grupo_nombre||agency.group_name)); }
  function agencyName(agency){ return text(agency&&(agency.nombre||agency.descripcion||agency.nombre_agencia))||('Agencia '+padAgency(agency&&(agency.numero||agency.codigo))); }
  function agencyNumber(agency){ return padAgency(agency&&(agency.numero||agency.codigo||agency.agencia)); }
  function agencyAddress(agency){ return text(agency&&(agency.direccion||agency.domicilio||agency.ubicacion||agency.sector||agency.municipio)); }
  function groupById(id){ return groups().find(function(g){ return groupId(g)===text(id); })||null; }
  function agencyGroup(agency){ return groupById(agencyGroupId(agency)); }
  function agencyGroupCode(agency){ var g=agencyGroup(agency); return g?groupCode(g):(agencyGroupName(agency)||''); }
  function agencyBelongsToGroup(agency,group){
    var gid=groupId(group),agid=agencyGroupId(agency);
    if(gid&&agid) return gid===agid;
    return agencyGroupName(agency).toLowerCase()===groupLabel(group).toLowerCase();
  }
  function sortAgencies(list){ return list.slice().sort(function(a,b){ return Number(agencyKey(a.numero||a.codigo))-Number(agencyKey(b.numero||b.codigo)); }); }
  function agenciesForGroup(group){ return group?sortAgencies(agencies().filter(function(a){ return agencyBelongsToGroup(a,group); })):[]; }
  function agencyMap(){ var m=new Map(); agencies().forEach(function(a){ var k=agencyKey(a.numero||a.codigo||a.agencia); if(k&&!m.has(k)) m.set(k,a); }); return m; }
  function agencyCoords(agency){
    var lat=Number(agency&&(agency.latitud??agency.lat??agency.latitude));
    var lng=Number(agency&&(agency.longitud??agency.lng??agency.lon??agency.longitude));
    return Number.isFinite(lat)&&Number.isFinite(lng)?{lat:lat,lng:lng}:null;
  }
  function agencyMapUrl(agency){
    var coords=agencyCoords(agency);
    if(coords) return 'https://www.google.com/maps/search/?api=1&query='+coords.lat+','+coords.lng;
    var query=['AG '+agencyNumber(agency),agencyName(agency),agencyAddress(agency),'República Dominicana'].filter(Boolean).join(' ');
    return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
  }

  function selectedScope(){
    var value=text(qs('#gorGroupSelect')?.value);
    if(value===ALL_GROUPS) return {mode:'ALL',group:null};
    var group=groups().find(function(g){ return groupId(g)===value; })||null;
    return {mode:'GROUP',group:group};
  }
  function scopeLabel(scope){ return scope&&scope.mode==='ALL'?'Todos los grupos':(scope&&scope.group?groupCode(scope.group)+' · '+groupLabel(scope.group):'Sin seleccionar'); }
  function scopeAgencies(scope){ return scope&&scope.mode==='ALL'?sortAgencies(agencies()):agenciesForGroup(scope&&scope.group); }

  function injectStyles(){
    if(document.getElementById('go-routes-style')) return;
    var style=document.createElement('style'); style.id='go-routes-style';
    style.textContent=`
      #vista-ops-rutas{padding:0 0 28px}.gor-shell{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0b2e4f}
      .gor-hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:28px;border:1px solid #d7e6f2;border-radius:22px;background:linear-gradient(135deg,#f9fdff 0%,#eef8ff 55%,#f7fbff 100%);box-shadow:0 18px 45px rgba(11,46,79,.08);margin-bottom:18px}.gor-eyebrow{font-size:11px;font-weight:1000;letter-spacing:.14em;text-transform:uppercase;color:#0499ca;margin-bottom:7px}.gor-hero h2{margin:0;font-size:28px;line-height:1.1;color:#092d4c}.gor-hero p{margin:9px 0 0;color:#607990;max-width:760px;font-size:14px;line-height:1.55}.gor-hero-actions,.gor-helper-row,.gor-route-actions{display:flex;gap:8px;flex-wrap:wrap}.gor-hero-actions{justify-content:flex-end}
      .gor-btn{border:1px solid #c9dcea;background:#fff;color:#07588f;border-radius:12px;padding:10px 14px;font-weight:900;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.18s ease;text-decoration:none}.gor-btn:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(11,86,139,.12)}.gor-btn.primary{background:linear-gradient(135deg,#0879bd,#05a7d6);color:#fff;border-color:transparent}.gor-btn.success{background:linear-gradient(135deg,#087c4d,#16a66b);color:#fff;border-color:transparent}.gor-btn.danger{color:#b42318;border-color:#f0c6c3;background:#fff8f7}.gor-btn.small{padding:7px 10px;border-radius:10px;font-size:12px}.gor-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
      .gor-tabs{display:flex;gap:8px;padding:5px;background:#edf5fa;border:1px solid #d7e6f2;border-radius:14px;width:max-content;max-width:100%;margin-bottom:16px}.gor-tab{border:0;background:transparent;border-radius:10px;padding:9px 14px;font-weight:900;color:#577289;cursor:pointer}.gor-tab.active{background:#fff;color:#075d94;box-shadow:0 5px 16px rgba(10,74,118,.1)}.gor-panel{display:none}.gor-panel.active{display:block}
      .gor-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:16px;align-items:start}.gor-card{background:#fff;border:1px solid #d7e6f2;border-radius:18px;padding:18px;box-shadow:0 12px 28px rgba(16,67,104,.055)}.gor-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}.gor-card h3{margin:0;color:#0b3659;font-size:17px}.gor-card p.hint{margin:5px 0 0;color:#7890a4;font-size:12px;line-height:1.45}
      .gor-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gor-field{display:flex;flex-direction:column;gap:6px}.gor-field.full{grid-column:1/-1}.gor-field label{font-size:12px;font-weight:900;color:#34556f}.gor-input,.gor-select,.gor-textarea{width:100%;box-sizing:border-box;border:1px solid #c8dceb;border-radius:12px;background:#fbfdff;color:#153a57;padding:11px 12px;font:inherit;outline:none}.gor-input:focus,.gor-select:focus,.gor-textarea:focus{border-color:#12a6d2;box-shadow:0 0 0 3px rgba(18,166,210,.12);background:#fff}.gor-textarea{min-height:230px;resize:vertical;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
      .gor-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:14px}.gor-kpi{border:1px solid #dae7f0;background:#f9fcfe;border-radius:14px;padding:12px;min-height:76px}.gor-kpi strong{display:block;font-size:24px;color:#0b5c91;line-height:1}.gor-kpi span{display:block;color:#70889b;font-size:11px;font-weight:800;margin-top:6px}.gor-kpi.ok{background:#f0fbf6;border-color:#bfe9d2}.gor-kpi.ok strong{color:#087b47}.gor-kpi.warn{background:#fffaf0;border-color:#f5dfad}.gor-kpi.warn strong{color:#9a6100}.gor-kpi.bad{background:#fff5f4;border-color:#f3cfca}.gor-kpi.bad strong{color:#b42318}
      .gor-result-sections{display:grid;gap:10px}.gor-result{border:1px solid #dce8f0;border-radius:14px;overflow:hidden;background:#fff}.gor-result summary{list-style:none;cursor:pointer;padding:12px 14px;font-weight:950;color:#244d6b;display:flex;justify-content:space-between;gap:12px;background:#f8fbfd}.gor-result summary::-webkit-details-marker{display:none}.gor-result .body{padding:12px 14px;border-top:1px solid #e6eef4}.gor-chips{display:flex;gap:7px;flex-wrap:wrap;max-height:190px;overflow:auto}.gor-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #d5e4ee;border-radius:999px;padding:6px 9px;background:#f8fbfd;font-size:12px;font-weight:900;color:#244e6d}.gor-chip.ok{border-color:#bde4cf;background:#effaf4;color:#087847}.gor-chip.warn{border-color:#f1d79c;background:#fff8e8;color:#8b5900}.gor-chip.bad{border-color:#edc6c2;background:#fff4f3;color:#a82a21}.gor-empty{padding:24px;text-align:center;color:#8398a9;border:1px dashed #c9dbe7;border-radius:14px;background:#fbfdff}
      .gor-save-box{margin-top:16px;border-top:1px solid #e0ebf2;padding-top:16px}.gor-route-order{margin-top:14px;border:1px solid #dce8f0;border-radius:15px;overflow:hidden}.gor-route-order-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 13px;background:#f4f9fc;border-bottom:1px solid #e2ecf2}.gor-route-order-list{max-height:320px;overflow:auto}.gor-order-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid #edf2f6}.gor-order-row:first-child{border-top:0}.gor-order-number{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e7f5fb;color:#0879ad;font-weight:1000}.gor-order-main strong{display:block;color:#173f5d}.gor-order-main small{color:#72899b}.gor-order-controls{display:flex;gap:5px}.gor-icon-btn{width:31px;height:31px;border:1px solid #d3e2eb;border-radius:9px;background:#fff;color:#17648f;cursor:pointer}.gor-icon-btn.danger{color:#b42318}
      .gor-route-list{display:grid;gap:12px}.gor-route-card{border:1px solid #d8e6ef;background:#fff;border-radius:17px;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;box-shadow:0 9px 22px rgba(10,65,101,.05)}.gor-route-code{font-size:11px;font-weight:1000;color:#0697c7;letter-spacing:.08em;text-transform:uppercase}.gor-route-card h4{margin:4px 0 7px;font-size:16px;color:#113b5a}.gor-route-meta{display:flex;gap:7px;flex-wrap:wrap;color:#6d8497;font-size:12px}.gor-route-meta span{background:#f2f7fa;border-radius:999px;padding:5px 8px}.gor-route-actions{align-items:center;justify-content:flex-end}.gor-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:1000;letter-spacing:.05em;background:#e9f5fb;color:#0875a8}.gor-badge.completada{background:#e9f8ef;color:#087847}.gor-badge.cancelada,.gor-badge.archivada{background:#f1f3f5;color:#667684}.gor-badge.en_proceso{background:#fff4dc;color:#8d5c00}
      .gor-table-wrap{overflow:auto;border:1px solid #dce8f0;border-radius:14px}.gor-table{width:100%;border-collapse:collapse;min-width:650px}.gor-table th{background:#f2f8fb;color:#34566f;font-size:11px;text-align:left;padding:10px}.gor-table td{border-top:1px solid #e5edf3;padding:10px;font-size:12px;color:#34546c}.gor-table tr:hover td{background:#fbfdff}
      .gor-modal{position:fixed;inset:0;z-index:100090;background:rgba(5,24,42,.67);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}.gor-modal.open{display:flex}.gor-modal-card{width:min(1050px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 28px 80px rgba(0,0,0,.3)}.gor-modal-card.medium{width:min(760px,96vw)}.gor-modal-head{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid #e0eaf1;padding:16px 18px;display:flex;justify-content:space-between;align-items:center}.gor-modal-body{padding:18px}.gor-modal-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #e1ebf1;padding:13px 18px;display:flex;justify-content:space-between;gap:10px;align-items:center}.gor-modal-close{width:38px;height:38px;border:1px solid #d6e4ed;border-radius:50%;background:#f8fbfd;color:#315873;font-size:18px;cursor:pointer}.gor-map{height:480px;border-radius:15px;border:1px solid #d5e4ee;overflow:hidden;background:#edf4f8}.gor-map-editor{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;align-items:stretch}.gor-map-side{border:1px solid #d7e5ee;border-radius:15px;background:#f8fbfd;display:flex;flex-direction:column;min-height:480px;overflow:hidden}.gor-map-side-head{padding:13px;border-bottom:1px solid #dce8ef;background:#fff}.gor-map-side-head strong{display:block;color:#123f5e}.gor-map-side-head small{display:block;color:#71889a;margin-top:3px;line-height:1.35}.gor-map-order-list{overflow:auto;flex:1;padding:8px}.gor-map-order-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;background:#fff;border:1px solid #dce7ee;border-radius:12px;padding:8px;margin-bottom:7px;cursor:grab;user-select:none}.gor-map-order-row.dragging{opacity:.45}.gor-map-order-row.selected{border-color:#079bd0;box-shadow:0 0 0 2px rgba(7,155,208,.12)}.gor-map-order-row .num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#087fba;color:#fff;font-weight:1000}.gor-map-order-row strong{display:block;font-size:12px;color:#173f5d}.gor-map-order-row small{display:block;font-size:10px;color:#748a9a;margin-top:2px}.gor-map-row-actions{display:flex;gap:3px}.gor-map-row-actions button{width:27px;height:27px;border:1px solid #d7e3ea;border-radius:8px;background:#fff;color:#17648f;cursor:pointer}.gor-map-footer{padding:10px;border-top:1px solid #dce8ef;background:#fff;display:flex;gap:7px;flex-wrap:wrap}.gor-map-marker{width:34px;height:34px;border-radius:50%;background:#0689c4;color:white;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:1000;cursor:pointer;transition:.15s}.gor-map-marker:hover,.gor-map-marker.selected{transform:scale(1.16);background:#ef7b16}.gor-position-input{width:62px;padding:7px;border:1px solid #cfdfe9;border-radius:9px;text-align:center;font-weight:900}
      .gor-picker-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:10px;margin-bottom:12px}.gor-picker-list{display:grid;gap:8px;max-height:58vh;overflow:auto;padding-right:3px}.gor-picker-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;border:1px solid #dbe7ef;border-radius:13px;padding:10px 12px;background:#fff;cursor:pointer}.gor-picker-row:hover{border-color:#9fd5e8;background:#f8fdff}.gor-picker-row.selected{border-color:#16a5d1;background:#edfaff}.gor-picker-code{font-weight:1000;color:#086f9f}.gor-picker-main strong{display:block;color:#173f5d}.gor-picker-main small{display:block;color:#73899a;margin-top:2px}.gor-check{width:25px;height:25px;border:2px solid #b9cfdd;border-radius:8px;display:grid;place-items:center;color:#fff}.gor-picker-row.selected .gor-check{background:#0999c9;border-color:#0999c9}.gor-export-preview{width:100%;min-height:380px;box-sizing:border-box;border:1px solid #c8dceb;border-radius:13px;padding:13px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.55;resize:vertical;background:#fbfdff}.gor-loading{opacity:.62;pointer-events:none}.gor-spin{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:gorSpin .7s linear infinite}@keyframes gorSpin{to{transform:rotate(360deg)}}
      @media(max-width:980px){.gor-grid{grid-template-columns:1fr}.gor-hero{flex-direction:column}.gor-hero-actions{justify-content:flex-start}.gor-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:900px){.gor-map-editor{grid-template-columns:1fr}.gor-map-side{min-height:300px;max-height:420px}}
      .gor-road-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid #dce8f0;border-radius:13px;background:#f7fbfd}.gor-road-summary{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:#5f778a}.gor-road-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:#fff;border:1px solid #d8e5ed;font-weight:800;color:#174866}.gor-road-note{font-size:11px;color:#71889a}.gor-btn.loading{opacity:.75;pointer-events:none}.gor-map-marker.start{background:#0f9d58}.gor-map-marker.end{background:#d93025}
      @media(max-width:620px){.gor-hero{padding:20px}.gor-hero h2{font-size:23px}.gor-form-grid,.gor-picker-toolbar{grid-template-columns:1fr}.gor-field.full{grid-column:auto}.gor-kpis{grid-template-columns:1fr 1fr}.gor-route-card{grid-template-columns:1fr}.gor-route-actions{justify-content:flex-start}.gor-tabs{width:100%}.gor-tab{flex:1;padding:9px 7px}.gor-card{padding:14px}.gor-map{height:380px}.gor-order-row{grid-template-columns:36px minmax(0,1fr)}.gor-order-controls{grid-column:2}.gor-modal{padding:8px}}
    `;
    document.head.appendChild(style);
  }

  function buildView(){
    if(document.getElementById('vista-ops-rutas')) return;
    var anchor=document.getElementById('vista-ops-historial')||document.getElementById('vista-ops-operaciones');
    if(!anchor||!anchor.parentNode) return;
    var view=document.createElement('div'); view.id='vista-ops-rutas'; view.className='hidden';
    view.innerHTML=`
      <div class="ops-scope gor-shell">
        <div class="gor-hero"><div><div class="gor-eyebrow">Operaciones · Control territorial</div><h2>Rutas y cobertura</h2><p>Crea rutas de un solo grupo o combina agencias de varios grupos. Pega una lista, selecciónalas visualmente, ordénalas y genera un formato listo para WhatsApp con el enlace individual de Google Maps de cada agencia.</p></div><div class="gor-hero-actions"><button class="gor-btn" id="gorRefreshDataBtn" type="button"><i class="fas fa-rotate"></i> Actualizar datos</button><button class="gor-btn primary" id="gorNewComparisonBtn" type="button"><i class="fas fa-plus"></i> Nueva ruta</button></div></div>
        <div class="gor-tabs" role="tablist"><button class="gor-tab active" data-gor-tab="compare" type="button"><i class="fas fa-route"></i> Crear ruta</button><button class="gor-tab" data-gor-tab="saved" type="button"><i class="fas fa-folder-open"></i> Rutas guardadas</button></div>
        <section class="gor-panel active" data-gor-panel="compare"><div class="gor-grid">
          <div class="gor-card"><div class="gor-card-head"><div><h3>Agencias de la ruta</h3><p class="hint">Selecciona un grupo específico o “Todos los grupos” para combinar agencias libremente.</p></div></div>
            <div class="gor-form-grid">
              <div class="gor-field"><label for="gorGroupSelect">Ámbito de la ruta</label><select class="gor-select" id="gorGroupSelect"><option value="">Selecciona un ámbito</option></select></div>
              <div class="gor-field"><label for="gorRouteDate">Fecha de la ruta</label><input class="gor-input" id="gorRouteDate" type="date"></div>
              <div class="gor-field full"><label for="gorSourceText">Pega una lista o usa el selector</label><textarea class="gor-textarea" id="gorSourceText" placeholder="Ejemplo:\nAG 0435\nAG 1000\nAG 1078\n\nTambién puedes pulsar “Elegir agencias”."></textarea></div>
            </div>
            <div class="gor-helper-row"><button class="gor-btn primary" id="gorCompareBtn" type="button"><i class="fas fa-wand-magic-sparkles"></i> Preparar ruta</button><button class="gor-btn success" id="gorChooseAgenciesBtn" type="button"><i class="fas fa-list-check"></i> Elegir agencias</button><button class="gor-btn" id="gorOfficialListBtn" type="button"><i class="fas fa-building-circle-check"></i> Cargar lista oficial</button><button class="gor-btn" id="gorClearBtn" type="button"><i class="fas fa-eraser"></i> Limpiar</button></div>
            <div class="gor-save-box" id="gorSaveBox" hidden><div class="gor-card-head"><div><h3>Guardar y compartir</h3><p class="hint">El orden mostrado abajo será el mismo al guardar, copiar o exportar.</p></div></div>
              <div class="gor-form-grid"><div class="gor-field"><label for="gorRouteName">Nombre de la ruta</label><input class="gor-input" id="gorRouteName" placeholder="RUTA DE MANTENIMIENTO"></div><div class="gor-field"><label for="gorAssigneeSelect">Asignar a</label><select class="gor-select" id="gorAssigneeSelect"><option value="">Sin asignar</option></select></div><div class="gor-field full"><label for="gorRouteNotes">Notas internas</label><input class="gor-input" id="gorRouteNotes" placeholder="Objetivo, prioridad o instrucciones..."></div></div>
              <div class="gor-helper-row"><button class="gor-btn primary" id="gorSaveRouteBtn" type="button"><i class="fas fa-floppy-disk"></i> Guardar ruta</button><button class="gor-btn success" id="gorCopyRouteBtn" type="button"><i class="fab fa-whatsapp"></i> Copiar ruta</button><button class="gor-btn" id="gorExportRouteBtn" type="button"><i class="fas fa-file-export"></i> Exportar ruta</button><button class="gor-btn" id="gorExportComparisonBtn" type="button"><i class="fas fa-file-csv"></i> Exportar revisión</button><button class="gor-btn" id="gorMapCurrentBtn" type="button"><i class="fas fa-map-location-dot"></i> Ver mapa</button></div>
            </div>
          </div>
          <div class="gor-card"><div class="gor-card-head"><div><h3>Revisión y orden</h3><p class="hint" id="gorResultHint">Selecciona un ámbito y agrega agencias.</p></div></div><div id="gorComparisonOutput"><div class="gor-empty"><i class="fas fa-route" style="font-size:26px;margin-bottom:9px"></i><br>La ruta aparecerá aquí.</div></div></div>
        </div></section>
        <section class="gor-panel" data-gor-panel="saved"><div class="gor-card"><div class="gor-card-head"><div><h3>Rutas guardadas</h3><p class="hint">Consulta, copia, exporta o reutiliza rutas anteriores.</p></div><button class="gor-btn small" id="gorReloadRoutesBtn" type="button"><i class="fas fa-rotate"></i> Recargar</button></div><div class="gor-route-list" id="gorRouteList"><div class="gor-empty">Abre esta pestaña para consultar rutas.</div></div></div></section>
      </div>
      <div class="gor-modal" id="gorAgencyPickerModal" aria-hidden="true"><div class="gor-modal-card"><div class="gor-modal-head"><strong>Elegir agencias para la ruta</strong><button class="gor-modal-close" data-gor-close="gorAgencyPickerModal" type="button">×</button></div><div class="gor-modal-body"><div class="gor-picker-toolbar"><input class="gor-input" id="gorAgencySearch" placeholder="Buscar por número, nombre, sector o grupo"><select class="gor-select" id="gorAgencyGroupFilter"><option value="${ALL_GROUPS}">Todos los grupos</option></select></div><div class="gor-picker-list" id="gorAgencyPickerList"></div></div><div class="gor-modal-footer"><strong id="gorPickerCount">0 seleccionadas</strong><div class="gor-helper-row"><button class="gor-btn" id="gorPickerClearBtn" type="button">Limpiar selección</button><button class="gor-btn primary" id="gorPickerApplyBtn" type="button"><i class="fas fa-check"></i> Usar seleccionadas</button></div></div></div></div>
      <div class="gor-modal" id="gorExportModal" aria-hidden="true"><div class="gor-modal-card medium"><div class="gor-modal-head"><strong>Copiar o exportar ruta</strong><button class="gor-modal-close" data-gor-close="gorExportModal" type="button">×</button></div><div class="gor-modal-body"><textarea class="gor-export-preview" id="gorExportPreview" readonly></textarea></div><div class="gor-modal-footer"><span style="font-size:12px;color:#71889a">Formato listo para WhatsApp.</span><div class="gor-helper-row"><button class="gor-btn success" id="gorExportCopyBtn" type="button"><i class="fas fa-copy"></i> Copiar</button><button class="gor-btn" id="gorExportTxtBtn" type="button"><i class="fas fa-file-lines"></i> Descargar TXT</button><button class="gor-btn" id="gorExportCsvBtn" type="button"><i class="fas fa-file-csv"></i> Descargar CSV</button></div></div></div></div>
      <div class="gor-modal" id="gorDetailModal" aria-hidden="true"><div class="gor-modal-card"><div class="gor-modal-head"><strong id="gorDetailTitle">Detalle de ruta</strong><button class="gor-modal-close" data-gor-close="gorDetailModal" type="button">×</button></div><div class="gor-modal-body" id="gorDetailBody"></div></div></div>
      <div class="gor-modal" id="gorMapModal" aria-hidden="true"><div class="gor-modal-card"><div class="gor-modal-head"><div><strong id="gorMapTitle">Mapa de ruta</strong><div style="font-size:11px;color:#71889a;margin-top:3px">Edita el orden directamente desde el mapa o arrastrando la lista.</div></div><button class="gor-modal-close" data-gor-close="gorMapModal" type="button">×</button></div><div class="gor-modal-body"><div class="gor-map-editor"><div><div class="gor-map" id="gorMapCanvas"></div><div class="gor-road-toolbar"><button class="gor-btn primary" id="gorCalculateRoadRouteBtn" type="button"><i class="fas fa-road"></i> Calcular ruta real</button><button class="gor-btn" id="gorClearRoadRouteBtn" type="button" style="display:none"><i class="fas fa-xmark"></i> Quitar recorrido</button><div class="gor-road-summary" id="gorRoadRouteSummary"><span class="gor-road-note">Ordena las agencias y pulsa “Calcular ruta real”. No se guarda en Supabase.</span></div></div><div id="gorMapFallback" style="margin-top:12px"></div></div><aside class="gor-map-side"><div class="gor-map-side-head"><strong>Orden visual de la ruta</strong><small>Toca un marcador para seleccionarlo. Arrastra las filas o usa las flechas para decidir cuál será 1, 2, 3...</small></div><div class="gor-map-order-list" id="gorMapOrderList"></div><div class="gor-map-footer"><button class="gor-btn small" id="gorMapResetOrderBtn" type="button"><i class="fas fa-rotate-left"></i> Restaurar</button><button class="gor-btn small success" id="gorMapApplyOrderBtn" type="button"><i class="fas fa-check"></i> Aplicar orden</button></div></aside></div></div></div></div>
    `;
    anchor.parentNode.insertBefore(view,anchor.nextSibling);
  }

  function buildNav(){
    if(document.getElementById('navRoutesCoverage')) return;
    var menu=document.querySelector('.sidebar-group[data-section="operaciones"] .sidebar-group-menu'); if(!menu) return;
    var ref=document.getElementById('navHistory'),link=document.createElement('a');
    link.className='sidebar-link ops-subitem'; link.id='navRoutesCoverage'; link.href='javascript:void(0)'; link.innerHTML='<i class="fas fa-route"></i><span>Rutas y cobertura</span>';
    link.addEventListener('click',function(ev){ ev.preventDefault(); global.GOOperationalRoutes.open(link); });
    if(ref&&ref.parentNode===menu) menu.insertBefore(link,ref); else menu.appendChild(link);
    refreshPermissionVisibility();
  }
  function refreshPermissionVisibility(){ var nav=document.getElementById('navRoutesCoverage'); if(nav) nav.style.display=canView()?'':'none'; }
  function wrapNavigation(){
    if(global.__gorNavigationWrapped) return; global.__gorNavigationWrapped=true;
    var original=global.cambiarVista;
    if(typeof original==='function'){
      global.cambiarVista=function(vista,el){ if(vista!=='ops-rutas') document.getElementById('vista-ops-rutas')?.classList.add('hidden'); return original.apply(this,arguments); };
      try{ cambiarVista=global.cambiarVista; }catch(_e){}
    }
  }

  function bindEvents(){
    if(state.initialized) return; state.initialized=true;
    qsa('[data-gor-tab]').forEach(function(btn){ btn.addEventListener('click',function(){ switchTab(btn.dataset.gorTab); }); });
    qs('#gorCompareBtn')?.addEventListener('click',compareFromForm);
    qs('#gorChooseAgenciesBtn')?.addEventListener('click',openAgencyPicker);
    qs('#gorOfficialListBtn')?.addEventListener('click',fillOfficialList);
    qs('#gorClearBtn')?.addEventListener('click',resetComparison);
    qs('#gorNewComparisonBtn')?.addEventListener('click',function(){ switchTab('compare'); resetComparison(); });
    qs('#gorRefreshDataBtn')?.addEventListener('click',refreshAllData);
    qs('#gorSaveRouteBtn')?.addEventListener('click',saveRoute);
    qs('#gorCopyRouteBtn')?.addEventListener('click',function(){ openExportForCurrent(true); });
    qs('#gorExportRouteBtn')?.addEventListener('click',function(){ openExportForCurrent(false); });
    qs('#gorExportComparisonBtn')?.addEventListener('click',exportComparisonCSV);
    qs('#gorMapCurrentBtn')?.addEventListener('click',function(){ if(state.comparison) openMap(orderedAgencies(),'Vista previa de la ruta',{editable:true,applyToCurrent:true}); });
    qs('#gorReloadRoutesBtn')?.addEventListener('click',function(){ loadRoutes(true); });
    qs('#gorGroupSelect')?.addEventListener('change',function(){ suggestRouteName(true); updatePickerScope(); });
    qs('#gorAgencySearch')?.addEventListener('input',function(){ state.pickerSearch=this.value||''; renderAgencyPicker(); });
    qs('#gorAgencyGroupFilter')?.addEventListener('change',function(){ state.pickerGroup=this.value||ALL_GROUPS; renderAgencyPicker(); });
    qs('#gorPickerApplyBtn')?.addEventListener('click',applyAgencyPicker);
    qs('#gorPickerClearBtn')?.addEventListener('click',function(){ state.pickerOrder=[]; renderAgencyPicker(); });
    qs('#gorExportCopyBtn')?.addEventListener('click',function(){ copyText(qs('#gorExportPreview')?.value||'', 'Ruta copiada para WhatsApp.'); });
    qs('#gorExportTxtBtn')?.addEventListener('click',downloadRouteTXT);
    qs('#gorExportCsvBtn')?.addEventListener('click',downloadRouteCSV);
    qsa('[data-gor-close]').forEach(function(btn){ btn.addEventListener('click',function(){ closeModal(btn.dataset.gorClose); }); });
    qsa('.gor-modal').forEach(function(modal){ modal.addEventListener('click',function(ev){ if(ev.target===modal) closeModal(modal.id); }); });
  }

  function populateGroups(){
    var select=qs('#gorGroupSelect'); if(!select) return;
    var current=select.value||ALL_GROUPS;
    var list=groups().sort(function(a,b){ return groupLabel(a).localeCompare(groupLabel(b),'es',{numeric:true}); });
    select.innerHTML='<option value="">Selecciona un ámbito</option><option value="'+ALL_GROUPS+'">TODOS LOS GRUPOS · Ruta combinada</option>'+list.map(function(g){ return '<option value="'+esc(groupId(g))+'">'+esc(groupCode(g)+' · '+groupLabel(g))+' ('+agenciesForGroup(g).length+' agencias)</option>'; }).join('');
    if(current===ALL_GROUPS||list.some(function(g){ return groupId(g)===current; })) select.value=current; else select.value=ALL_GROUPS;
    updatePickerScope();
  }
  function updatePickerScope(){
    var filter=qs('#gorAgencyGroupFilter'); if(!filter) return;
    var scope=selectedScope(),list=groups().sort(function(a,b){ return groupLabel(a).localeCompare(groupLabel(b),'es',{numeric:true}); });
    filter.innerHTML='<option value="'+ALL_GROUPS+'">Todos los grupos</option>'+list.map(function(g){ return '<option value="'+esc(groupId(g))+'">'+esc(groupCode(g)+' · '+groupLabel(g))+'</option>'; }).join('');
    if(scope.mode==='GROUP'){ filter.value=groupId(scope.group); filter.disabled=true; state.pickerGroup=groupId(scope.group); }
    else{ filter.disabled=false; if(!list.some(function(g){return groupId(g)===state.pickerGroup;})) state.pickerGroup=ALL_GROUPS; filter.value=state.pickerGroup; }
  }
  async function populateProfiles(force){
    var select=qs('#gorAssigneeSelect'); if(!select) return;
    try{
      var c=client(); if(!c) throw new Error('Supabase no está disponible.');
      var loader=async function(){
        var res=await c.from('perfiles').select('id,nombre_completo,correo,activo,roles(nombre),puestos(nombre)').eq('activo',true).order('nombre_completo',{ascending:true}).limit(1000);
        if(res.error) res=await c.from('perfiles').select('id,nombre_completo,correo,activo').eq('activo',true).order('nombre_completo',{ascending:true}).limit(1000);
        if(res.error) throw res.error; return res.data||[];
      };
      var rt=runtime(); state.profiles=rt?await rt.data.fetch('rutas:perfiles',loader,{ttl:60000,force:!!force}):await loader();
      select.innerHTML='<option value="">Sin asignar</option>'+state.profiles.map(function(p){ var secondary=[p.roles?.nombre,p.puestos?.nombre].filter(Boolean).join(' · '); return '<option value="'+esc(p.id)+'">'+esc(p.nombre_completo||p.correo||p.id)+(secondary?' — '+esc(secondary):'')+'</option>'; }).join('');
    }catch(error){ console.warn('[Rutas] No se pudo cargar responsables:',error); select.innerHTML='<option value="">Sin asignar</option>'; }
  }

  function parseAgencyTokens(source){
    var input=text(source); if(!input) return [];
    var tokens=[];
    input.split(/\r?\n/).forEach(function(rawLine,lineIndex){
      var line=text(rawLine); if(!line) return;
      var clean=line.replace(/\bG\s*[-:]?\s*\d{1,4}\b/ig,' '),matches=[],m,re=/\bAG(?:ENCIA)?\s*[:#-]?\s*(\d{1,6})\b/ig;
      while((m=re.exec(clean))) matches.push(m[1]);
      if(!matches.length) matches=clean.match(/\b\d{1,6}\b/g)||[];
      matches.forEach(function(raw){ var key=agencyKey(raw); if(key) tokens.push({raw:raw,key:key,display:padAgency(raw),line:lineIndex+1,sourceLine:line}); });
    });
    return tokens;
  }

  function makeComparison(scope,source){
    var tokens=parseAgencyTokens(source),allMap=agencyMap(),official=scopeAgencies(scope),officialKeys=new Set(official.map(function(a){return agencyKey(a.numero||a.codigo);})),seen=new Map(),items=[],correct=[],duplicates=[],otherGroup=[],notFound=[],correctKeys=new Set(),groupKeys=new Set();
    tokens.forEach(function(token,index){
      var count=(seen.get(token.key)||0)+1; seen.set(token.key,count);
      var agency=allMap.get(token.key)||null,classification;
      if(count>1){ classification='DUPLICADA'; duplicates.push(token); }
      else if(!agency){ classification='NO_EXISTE'; notFound.push(token); }
      else if(scope.mode==='GROUP'&&!officialKeys.has(token.key)){ classification='OTRO_GRUPO'; otherGroup.push({token:token,agency:agency}); }
      else{ classification='COINCIDE'; correct.push(agency); correctKeys.add(token.key); if(agencyGroupId(agency)) groupKeys.add(agencyGroupId(agency)); }
      items.push({numero_agencia:token.display,orden:index+1,clasificacion:classification,agencia_id:agencyId(agency),grupo_detectado_id:agency?agencyGroupId(agency)||null:null,metadata:{linea:token.line,texto_original:token.sourceLine,grupo_detectado:agency?agencyGroupName(agency):'',grupo_codigo:agency?agencyGroupCode(agency):''}});
    });
    var missing=scope.mode==='GROUP'?official.filter(function(a){return !correctKeys.has(agencyKey(a.numero||a.codigo));}):[];
    state.routeOrder=correct.map(function(a){return agencyKey(a.numero||a.codigo);});
    return {scope:scope,source:source,tokens:tokens,items:items,correctAgencies:correct,duplicates:duplicates,otherGroup:otherGroup,notFound:notFound,missing:missing,official:official,counts:{pasted:tokens.length,unique:seen.size,correct:correct.length,missing:missing.length,otherGroup:otherGroup.length,notFound:notFound.length,duplicates:duplicates.length,official:official.length,groups:groupKeys.size}};
  }

  function compareFromForm(){
    var scope=selectedScope(),source=qs('#gorSourceText')?.value||'';
    if(scope.mode==='GROUP'&&!scope.group){ notify('Selecciona un grupo o la opción Todos los grupos.','error'); qs('#gorGroupSelect')?.focus(); return; }
    var tokens=parseAgencyTokens(source); if(!tokens.length){ notify('Agrega al menos una agencia a la ruta.','error'); return; }
    state.comparison=makeComparison(scope,source); renderComparison(); suggestRouteName(false); qs('#gorSaveBox').hidden=false;
  }
  function orderedAgencies(){
    if(!state.comparison) return [];
    var map=new Map(state.comparison.correctAgencies.map(function(a){return [agencyKey(a.numero||a.codigo),a];}));
    return state.routeOrder.map(function(k){return map.get(k);}).filter(Boolean);
  }
  function syncItemOrder(){
    if(!state.comparison) return;
    var order=new Map(state.routeOrder.map(function(k,i){return [k,i+1];}));
    state.comparison.correctAgencies=orderedAgencies();
    state.comparison.items.forEach(function(i){ if(i.clasificacion==='COINCIDE'&&order.has(agencyKey(i.numero_agencia))) i.orden=order.get(agencyKey(i.numero_agencia)); });
  }
  function moveAgency(key,delta){ var i=state.routeOrder.indexOf(key),j=i+delta; if(i<0||j<0||j>=state.routeOrder.length)return; var t=state.routeOrder[i];state.routeOrder[i]=state.routeOrder[j];state.routeOrder[j]=t;syncItemOrder();renderComparison(); }
  function removeAgency(key){
    if(!state.comparison) return;
    state.routeOrder=state.routeOrder.filter(function(k){return k!==key;});
    state.comparison.correctAgencies=state.comparison.correctAgencies.filter(function(a){return agencyKey(a.numero||a.codigo)!==key;});
    state.comparison.items=state.comparison.items.filter(function(i){return !(i.clasificacion==='COINCIDE'&&agencyKey(i.numero_agencia)===key);});
    state.comparison.counts.correct=state.comparison.correctAgencies.length;
    renderComparison();
  }

  function resultDetails(title,items,kind,open){
    var content=items.length?items.map(function(item){ var n=item&&item.token?item.token.display:padAgency(item&&(item.numero||item.codigo||item.display||item)); var extra=item&&item.agency?' · '+agencyGroupCode(item.agency):''; return '<span class="gor-chip '+kind+'">AG '+esc(n)+esc(extra)+'</span>'; }).join(''):'<span style="color:#8094a4;font-size:12px">Sin registros.</span>';
    return '<details class="gor-result" '+(open?'open':'')+'><summary><span>'+esc(title)+'</span><strong>'+items.length+'</strong></summary><div class="body"><div class="gor-chips">'+content+'</div></div></details>';
  }
  function renderRouteOrder(){
    var list=orderedAgencies(); if(!list.length) return '';
    return '<div class="gor-route-order"><div class="gor-route-order-head"><div><strong>Orden de la ruta</strong><div style="font-size:11px;color:#74899a;margin-top:2px">Usa las flechas para organizar el recorrido.</div></div><span class="gor-badge">'+list.length+' agencias</span></div><div class="gor-route-order-list">'+list.map(function(a,index){var key=agencyKey(a.numero||a.codigo);return '<div class="gor-order-row"><div class="gor-order-number">'+(index+1)+'</div><div class="gor-order-main"><strong>AG '+esc(agencyNumber(a))+' · '+esc(agencyName(a))+'</strong><small>'+esc(agencyGroupCode(a))+(agencyAddress(a)?' · '+esc(agencyAddress(a)):'')+'</small></div><div class="gor-order-controls"><button class="gor-icon-btn" data-gor-up="'+esc(key)+'" title="Subir">↑</button><button class="gor-icon-btn" data-gor-down="'+esc(key)+'" title="Bajar">↓</button><button class="gor-icon-btn danger" data-gor-remove="'+esc(key)+'" title="Quitar">×</button></div></div>';}).join('')+'</div></div>';
  }
  function renderComparison(){
    var c=state.comparison,out=qs('#gorComparisonOutput'); if(!out||!c) return;
    qs('#gorResultHint').textContent=scopeLabel(c.scope)+' · '+c.counts.correct+' agencias válidas'+(c.scope.mode==='ALL'?' · '+c.counts.groups+' grupos':'');
    var groupKpi=c.scope.mode==='ALL'?'<div class="gor-kpi"><strong>'+c.counts.groups+'</strong><span>Grupos incluidos</span></div>':'<div class="gor-kpi warn"><strong>'+c.counts.missing+'</strong><span>Faltan en tu lista</span></div>';
    out.innerHTML='<div class="gor-kpis"><div class="gor-kpi"><strong>'+c.counts.pasted+'</strong><span>Registros agregados</span></div><div class="gor-kpi ok"><strong>'+c.counts.correct+'</strong><span>Agencias válidas</span></div>'+groupKpi+'<div class="gor-kpi bad"><strong>'+c.counts.notFound+'</strong><span>No existen</span></div><div class="gor-kpi warn"><strong>'+c.counts.duplicates+'</strong><span>Duplicadas</span></div><div class="gor-kpi bad"><strong>'+c.counts.otherGroup+'</strong><span>Fuera del grupo</span></div></div><div class="gor-result-sections">'+resultDetails(c.scope.mode==='ALL'?'Agencias incluidas':'Correctas del grupo',orderedAgencies(),'ok',true)+(c.scope.mode==='GROUP'?resultDetails('Faltantes en la lista',c.missing,'warn',c.missing.length>0)+resultDetails('Pertenecen a otro grupo',c.otherGroup,'bad',c.otherGroup.length>0):'')+resultDetails('Códigos no encontrados',c.notFound,'bad',c.notFound.length>0)+resultDetails('Entradas duplicadas',c.duplicates,'warn',c.duplicates.length>0)+'</div>'+renderRouteOrder();
    qsa('[data-gor-up]',out).forEach(function(b){b.addEventListener('click',function(){moveAgency(b.dataset.gorUp,-1);});});
    qsa('[data-gor-down]',out).forEach(function(b){b.addEventListener('click',function(){moveAgency(b.dataset.gorDown,1);});});
    qsa('[data-gor-remove]',out).forEach(function(b){b.addEventListener('click',function(){removeAgency(b.dataset.gorRemove);});});
  }

  function fillOfficialList(){
    var scope=selectedScope();
    if(scope.mode==='ALL'){
      if(!global.confirm||global.confirm('Esto cargará todas las agencias disponibles en el sistema. ¿Continuar?')){ qs('#gorSourceText').value=sortAgencies(agencies()).map(function(a){return agencyNumber(a);}).join('\n'); compareFromForm(); }
      return;
    }
    if(!scope.group){ notify('Selecciona un grupo.','error'); return; }
    qs('#gorSourceText').value=agenciesForGroup(scope.group).map(function(a){return agencyNumber(a);}).join('\n'); compareFromForm();
  }
  function resetComparison(){
    state.comparison=null; state.routeOrder=[]; state.pickerOrder=[];
    ['gorSourceText','gorRouteName','gorRouteNotes'].forEach(function(id){var el=qs('#'+id);if(el)el.value='';});
    var out=qs('#gorComparisonOutput');if(out)out.innerHTML='<div class="gor-empty"><i class="fas fa-route" style="font-size:26px;margin-bottom:9px"></i><br>La ruta aparecerá aquí.</div>';
    var hint=qs('#gorResultHint');if(hint)hint.textContent='Selecciona un ámbito y agrega agencias.';
    var save=qs('#gorSaveBox');if(save)save.hidden=true;
  }
  function suggestRouteName(force){
    var input=qs('#gorRouteName'); if(!input||(!force&&text(input.value))) return;
    var scope=selectedScope(),date=qs('#gorRouteDate')?.value||nowISO();
    input.value=scope.mode==='ALL'?'RUTA OPERATIVA · '+formatDate(date):('RUTA '+(scope.group?groupCode(scope.group):'')+' · '+formatDate(date));
  }
  function switchTab(name){ qsa('[data-gor-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.gorTab===name);});qsa('[data-gor-panel]').forEach(function(p){p.classList.toggle('active',p.dataset.gorPanel===name);});if(name==='saved')loadRoutes(false); }

  function openAgencyPicker(){
    var scope=selectedScope(); if(scope.mode==='GROUP'&&!scope.group){notify('Selecciona primero un grupo o Todos los grupos.','error');return;}
    var existing=state.comparison?orderedAgencies():parseAgencyTokens(qs('#gorSourceText')?.value||'').map(function(t){return agencyMap().get(t.key);}).filter(Boolean);
    state.pickerOrder=existing.map(function(a){return agencyKey(a.numero||a.codigo);}); state.pickerSearch=''; qs('#gorAgencySearch').value=''; updatePickerScope(); renderAgencyPicker(); openModal('gorAgencyPickerModal');
  }
  function renderAgencyPicker(){
    var listEl=qs('#gorAgencyPickerList'); if(!listEl) return;
    var scope=selectedScope(),search=text(state.pickerSearch).toLowerCase(),groupFilter=state.pickerGroup;
    var list=sortAgencies(agencies()).filter(function(a){
      if(scope.mode==='GROUP'&&!agencyBelongsToGroup(a,scope.group)) return false;
      if(scope.mode==='ALL'&&groupFilter!==ALL_GROUPS&&agencyGroupId(a)!==groupFilter) return false;
      if(!search) return true;
      var hay=[agencyNumber(a),agencyName(a),agencyAddress(a),agencyGroupName(a),agencyGroupCode(a)].join(' ').toLowerCase(); return hay.includes(search);
    });
    var limited=list.slice(0,400);
    listEl.innerHTML=limited.length?limited.map(function(a){ var key=agencyKey(a.numero||a.codigo),sel=state.pickerOrder.includes(key); return '<div class="gor-picker-row '+(sel?'selected':'')+'" data-gor-picker="'+esc(key)+'"><div class="gor-check">'+(sel?'✓':'')+'</div><div class="gor-picker-main"><strong>AG '+esc(agencyNumber(a))+' · '+esc(agencyName(a))+'</strong><small>'+esc(agencyGroupCode(a))+(agencyAddress(a)?' · '+esc(agencyAddress(a)):'')+'</small></div><div class="gor-picker-code">'+(sel?'AGREGADA':'AGREGAR')+'</div></div>'; }).join(''):'<div class="gor-empty">No se encontraron agencias.</div>';
    if(list.length>400) listEl.insertAdjacentHTML('beforeend','<div class="gor-empty">Mostrando 400 resultados. Usa el buscador para reducir la lista.</div>');
    qsa('[data-gor-picker]',listEl).forEach(function(row){ row.addEventListener('click',function(){ var k=row.dataset.gorPicker,i=state.pickerOrder.indexOf(k); if(i>=0)state.pickerOrder.splice(i,1);else state.pickerOrder.push(k);renderAgencyPicker(); }); });
    qs('#gorPickerCount').textContent=state.pickerOrder.length+' seleccionadas';
  }
  function applyAgencyPicker(){
    var map=agencyMap(),selected=state.pickerOrder.map(function(k){return map.get(k);}).filter(Boolean);
    if(!selected.length){notify('Selecciona al menos una agencia.','error');return;}
    qs('#gorSourceText').value=selected.map(function(a){return agencyNumber(a);}).join('\n'); closeModal('gorAgencyPickerModal'); compareFromForm();
  }

  function copyText(value,success){
    var v=text(value); if(!v)return;
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function(){notify(success||'Contenido copiado.','success');}).catch(function(){fallbackCopy(v,success);}); else fallbackCopy(v,success);
  }
  function fallbackCopy(value,success){var ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();notify(success||'Contenido copiado.','success');}
  function routeTitle(name){ return (text(name)||'RUTA OPERATIVA').toUpperCase(); }
  function buildRouteText(name,list){
    var lines=[routeTitle(name),''];
    list.forEach(function(a,index){ lines.push((index+1)+'. AG '+agencyNumber(a)+(agencyGroupCode(a)?' · '+agencyGroupCode(a):'')); lines.push(agencyMapUrl(a)); if(index<list.length-1)lines.push(''); });
    return lines.join('\n');
  }
  function routeRows(list){ return list.map(function(a,index){return {orden:index+1,numero:agencyNumber(a),nombre:agencyName(a),grupo:agencyGroupCode(a),url:agencyMapUrl(a)};}); }
  function openExport(name,list,copyImmediately){
    if(!list||!list.length){notify('La ruta no tiene agencias válidas.','error');return;}
    state.exportContext={name:name,list:list,rows:routeRows(list)}; var content=buildRouteText(name,list); qs('#gorExportPreview').value=content;
    if(copyImmediately){copyText(content,'Ruta copiada para WhatsApp.');return;} openModal('gorExportModal');
  }
  function openExportForCurrent(copyImmediately){ if(!state.comparison){notify('Primero prepara una ruta.','error');return;} openExport(qs('#gorRouteName')?.value,orderedAgencies(),copyImmediately); }
  function downloadBlob(content,type,name){ var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url); }
  function safeFileName(value){ return (text(value)||'ruta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase(); }
  function downloadRouteTXT(){ var c=state.exportContext;if(!c)return;downloadBlob('\uFEFF'+buildRouteText(c.name,c.list),'text/plain;charset=utf-8',safeFileName(c.name)+'.txt'); }
  function downloadRouteCSV(){ var c=state.exportContext;if(!c)return;var rows=[['Orden','Agencia','Nombre','Grupo','Google Maps']].concat(c.rows.map(function(r){return[r.orden,r.numero,r.nombre,r.grupo,r.url];}));var csv='\uFEFF'+rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');downloadBlob(csv,'text/csv;charset=utf-8',safeFileName(c.name)+'.csv'); }

  function comparisonSummary(c){
    return {scope:c.scope.mode,counts:c.counts,grupos:Array.from(new Set(orderedAgencies().map(function(a){return agencyGroupId(a);}).filter(Boolean))),correctas:orderedAgencies().map(function(a){return agencyNumber(a);}),faltantes:c.missing.map(function(a){return agencyNumber(a);}),otro_grupo:c.otherGroup.map(function(x){return{numero:x.token.display,grupo:agencyGroupName(x.agency)};}),no_existen:c.notFound.map(function(x){return x.display;}),duplicadas:c.duplicates.map(function(x){return x.display;})};
  }
  function itemsForSave(){
    var c=state.comparison,validOrder=new Map(state.routeOrder.map(function(k,i){return[k,i+1];}));
    return c.items.filter(function(i){return i.clasificacion!=='COINCIDE'||validOrder.has(agencyKey(i.numero_agencia));}).map(function(i){var copy=Object.assign({},i);if(copy.clasificacion==='COINCIDE')copy.orden=validOrder.get(agencyKey(copy.numero_agencia));return copy;}).sort(function(a,b){return Number(a.orden||0)-Number(b.orden||0);});
  }
  async function saveRoute(){
    if(!canManage()){notify('Tu perfil puede consultar rutas, pero no guardarlas.','error');return;}
    var c=state.comparison,list=orderedAgencies(); if(!c){notify('Primero prepara una ruta.','error');return;} if(!list.length){notify('No hay agencias válidas para guardar.','error');return;}
    var name=text(qs('#gorRouteName')?.value);if(!name){notify('Escribe un nombre para la ruta.','error');return;}
    var sb=client();if(!sb){notify('Supabase no está disponible.','error');return;}var btn=qs('#gorSaveRouteBtn');setButtonLoading(btn,true,'Guardando...');
    try{
      var response=await sb.rpc('rpc_rutas_operativas_guardar',{p_nombre:name,p_grupo_id:c.scope.mode==='ALL'?null:groupId(c.scope.group),p_fecha:qs('#gorRouteDate')?.value||nowISO(),p_asignado_a:text(qs('#gorAssigneeSelect')?.value)||null,p_notas:text(qs('#gorRouteNotes')?.value)||null,p_fuente:c.source,p_resumen:comparisonSummary(c),p_items:itemsForSave()});
      if(response.error)throw response.error;var rt=runtime();if(rt)rt.data.invalidate('rutas:');notify('Ruta guardada correctamente.','success');await loadRoutes(true);switchTab('saved');
    }catch(error){handleError(error,'guardar ruta');}finally{setButtonLoading(btn,false);}
  }

  async function loadRoutes(force){
    if(state.loadingRoutes)return;var list=qs('#gorRouteList');if(!list)return;state.loadingRoutes=true;list.innerHTML='<div class="gor-empty"><span class="gor-spin" style="display:inline-block"></span><br>Cargando rutas...</div>';
    try{var sb=client();if(!sb)throw new Error('Supabase no está disponible.');var loader=async function(){var res=await sb.rpc('rpc_rutas_operativas_listar',{p_limite:200});if(res.error)throw res.error;return Array.isArray(res.data)?res.data:[];};var rt=runtime();state.routes=rt?await rt.data.fetch('rutas:listado',loader,{ttl:30000,force:!!force}):await loader();renderRoutes();}
    catch(error){list.innerHTML='<div class="gor-empty"><strong>No se pudieron cargar las rutas.</strong><br><span style="font-size:12px">'+esc(friendlyError(error))+'</span></div>';console.warn('[Rutas]',error);}finally{state.loadingRoutes=false;}
  }
  function renderRoutes(){
    var list=qs('#gorRouteList');if(!list)return;if(!state.routes.length){list.innerHTML='<div class="gor-empty">Todavía no hay rutas guardadas.</div>';return;}
    list.innerHTML=state.routes.map(function(r){var status=text(r.estado||'PENDIENTE').toLowerCase(),counts=r.resumen?.counts||{},scope=r.alcance==='MULTIGRUPO'?'Todos los grupos':(r.grupo_nombre||r.grupo_codigo||'-');return '<article class="gor-route-card"><div><div class="gor-route-code">'+esc(r.codigo||'RUTA')+'</div><h4>'+esc(r.nombre||'Ruta operativa')+'</h4><div class="gor-route-meta"><span><i class="fas fa-layer-group"></i> '+esc(scope)+'</span><span><i class="fas fa-calendar"></i> '+esc(formatDate(r.fecha))+'</span><span><i class="fas fa-location-dot"></i> '+Number(counts.correct||r.total_agencias||0)+' agencias</span><span><i class="fas fa-user"></i> '+esc(r.asignado_nombre||'Sin asignar')+'</span></div></div><div class="gor-route-actions"><span class="gor-badge '+esc(status)+'">'+esc(text(r.estado||'PENDIENTE').replace(/_/g,' '))+'</span><button class="gor-btn small" data-gor-detail="'+esc(r.id)+'"><i class="fas fa-eye"></i> Ver</button><button class="gor-btn small" data-gor-copy-saved="'+esc(r.id)+'"><i class="fas fa-copy"></i> Copiar</button><button class="gor-btn small" data-gor-reuse="'+esc(r.id)+'"><i class="fas fa-rotate-left"></i> Reutilizar</button></div></article>';}).join('');
    qsa('[data-gor-detail]',list).forEach(function(b){b.addEventListener('click',function(){openRouteDetail(b.dataset.gorDetail);});});qsa('[data-gor-reuse]',list).forEach(function(b){b.addEventListener('click',function(){reuseRoute(b.dataset.gorReuse);});});qsa('[data-gor-copy-saved]',list).forEach(function(b){b.addEventListener('click',function(){copySavedRoute(b.dataset.gorCopySaved);});});
  }
  async function routeDetail(id){var sb=client();if(!sb)throw new Error('Supabase no está disponible.');var loader=async function(){var res=await sb.rpc('rpc_rutas_operativas_detalle',{p_ruta_id:id});if(res.error)throw res.error;return res.data||{};};var rt=runtime();return rt?rt.data.fetch('rutas:detalle:'+id,loader,{ttl:30000}):loader();}
  function itemToAgency(i){return{id:i.agencia_id,agencia_id:i.agencia_id,numero:i.numero_agencia,codigo:i.numero_agencia,nombre:i.agencia_nombre||('Agencia '+padAgency(i.numero_agencia)),grupo_id:i.grupo_detectado_id,grupo_nombre:i.grupo_nombre,grupo:i.grupo_nombre,latitud:i.latitud,longitud:i.longitud,direccion:i.agencia_direccion};}
  async function copySavedRoute(id){try{var data=await routeDetail(id),r=data.ruta||{},items=(data.items||[]).filter(function(i){return i.clasificacion==='COINCIDE';}).sort(function(a,b){return Number(a.orden)-Number(b.orden);});openExport(r.nombre,items.map(itemToAgency),true);}catch(error){handleError(error,'copiar ruta');}}
  async function openRouteDetail(id){
    openModal('gorDetailModal');qs('#gorDetailTitle').textContent='Detalle de ruta';qs('#gorDetailBody').innerHTML='<div class="gor-empty"><span class="gor-spin" style="display:inline-block"></span><br>Cargando detalle...</div>';
    try{
      var data=await routeDetail(id),r=data.ruta||{},items=Array.isArray(data.items)?data.items:[],valid=items.filter(function(i){return i.clasificacion==='COINCIDE';}).sort(function(a,b){return Number(a.orden)-Number(b.orden);}),ags=valid.map(itemToAgency);
      qs('#gorDetailTitle').textContent=(r.codigo||'Ruta')+' · '+(r.nombre||'');
      qs('#gorDetailBody').innerHTML='<div class="gor-kpis"><div class="gor-kpi ok"><strong>'+valid.length+'</strong><span>Agencias de la ruta</span></div><div class="gor-kpi"><strong>'+Number(r.resumen?.counts?.groups||r.total_grupos||0)+'</strong><span>Grupos incluidos</span></div><div class="gor-kpi"><strong>'+esc(r.alcance==='MULTIGRUPO'?'Multigrupo':'Un grupo')+'</strong><span>Tipo de ruta</span></div></div><div class="gor-helper-row" style="margin-bottom:14px"><button class="gor-btn primary" id="gorDetailMapBtn"><i class="fas fa-map-location-dot"></i> Ver mapa</button><button class="gor-btn success" id="gorDetailCopyBtn"><i class="fas fa-copy"></i> Copiar ruta</button><button class="gor-btn" id="gorDetailExportBtn"><i class="fas fa-file-export"></i> Exportar</button><button class="gor-btn" id="gorDetailReuseBtn"><i class="fas fa-rotate-left"></i> Cargar en editor</button></div><div class="gor-table-wrap"><table class="gor-table"><thead><tr><th>#</th><th>Agencia</th><th>Grupo</th><th>Google Maps</th></tr></thead><tbody>'+valid.map(function(i){var a=itemToAgency(i);return '<tr><td>'+Number(i.orden||0)+'</td><td><strong>AG '+esc(padAgency(i.numero_agencia))+'</strong><br><span style="font-size:11px;color:#71889a">'+esc(i.agencia_nombre||'')+'</span></td><td>'+esc(i.grupo_codigo||i.grupo_nombre||'-')+'</td><td><a href="'+esc(agencyMapUrl(a))+'" target="_blank" rel="noopener">Abrir mapa</a></td></tr>';}).join('')+'</tbody></table></div>';
      qs('#gorDetailReuseBtn')?.addEventListener('click',function(){closeModal('gorDetailModal');applyRouteToComparator(data);});qs('#gorDetailMapBtn')?.addEventListener('click',function(){openMap(ags,(r.codigo||'Ruta')+' · '+(r.nombre||''),{editable:true,applyToCurrent:false,onApply:function(order){closeModal('gorMapModal');closeModal('gorDetailModal');applyAgenciesToEditor(order,r.nombre||r.codigo||'RUTA');}});});qs('#gorDetailCopyBtn')?.addEventListener('click',function(){openExport(r.nombre,ags,true);});qs('#gorDetailExportBtn')?.addEventListener('click',function(){openExport(r.nombre,ags,false);});
    }catch(error){qs('#gorDetailBody').innerHTML='<div class="gor-empty">'+esc(friendlyError(error))+'</div>';}
  }
  async function reuseRoute(id){try{var data=await routeDetail(id);applyRouteToComparator(data);}catch(error){handleError(error,'reutilizar ruta');}}
  function applyRouteToComparator(data){
    var r=data.ruta||{},items=Array.isArray(data.items)?data.items:[],valid=items.filter(function(i){return i.clasificacion==='COINCIDE';}).sort(function(a,b){return Number(a.orden)-Number(b.orden);});switchTab('compare');var select=qs('#gorGroupSelect');if(select)select.value=r.alcance==='MULTIGRUPO'?ALL_GROUPS:(r.grupo_id||ALL_GROUPS);qs('#gorSourceText').value=valid.map(function(i){return padAgency(i.numero_agencia);}).join('\n');qs('#gorRouteDate').value=nowISO();qs('#gorRouteName').value='COPIA DE '+text(r.nombre||r.codigo||'RUTA');compareFromForm();window.scrollTo({top:document.getElementById('vista-ops-rutas').offsetTop||0,behavior:'smooth'});
  }

  function exportComparisonCSV(){var c=state.comparison;if(!c){notify('Primero prepara una ruta.','error');return;}var rows=[['Numero','Clasificacion','Grupo detectado','Linea original']];c.items.forEach(function(i){rows.push([i.numero_agencia,i.clasificacion,i.metadata?.grupo_detectado||'',i.metadata?.texto_original||'']);});c.missing.forEach(function(a){rows.push([agencyNumber(a),'FALTA_EN_LISTA',scopeLabel(c.scope),'']);});var csv='\uFEFF'+rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');downloadBlob(csv,'text/csv;charset=utf-8','revision-ruta-'+nowISO()+'.csv');}
  function setButtonLoading(btn,on,label){if(!btn)return;if(on){btn.dataset.originalHtml=btn.innerHTML;btn.innerHTML='<span class="gor-spin"></span> '+esc(label||'Procesando...');btn.disabled=true;}else{btn.innerHTML=btn.dataset.originalHtml||btn.innerHTML;btn.disabled=false;}}
  function openModal(id){var m=document.getElementById(id);if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');}}
  function closeModal(id){var m=document.getElementById(id);if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}if(id==='gorMapModal'){if(state.map){try{state.map.remove();}catch(_e){}state.map=null;}state.mapEditor=null;state.mapMarkers=[];}}
  function applyAgenciesToEditor(list,name){
    var valid=(list||[]).filter(Boolean),scope=selectedScope();
    if(!valid.length){notify('La ruta no tiene agencias para aplicar.','error');return;}
    if(valid.some(function(a){return agencyGroupId(a)!==agencyGroupId(valid[0]);})){var sel=qs('#gorGroupSelect');if(sel)sel.value=ALL_GROUPS;scope=selectedScope();}
    state.routeOrder=valid.map(function(a){return agencyKey(a.numero||a.codigo);});
    var tokens=valid.map(function(a,index){return{key:agencyKey(a.numero||a.codigo),display:agencyNumber(a),raw:agencyNumber(a),line:index+1};});
    state.comparison=makeComparison(scope,tokens);
    state.routeOrder=valid.map(function(a){return agencyKey(a.numero||a.codigo);});
    syncItemOrder();
    qs('#gorSourceText').value=valid.map(agencyNumber).join('\n');
    if(name)qs('#gorRouteName').value=text(name);
    qs('#gorSaveBox').hidden=false;renderComparison();switchTab('compare');
  }
  function mapEditorMove(from,to){
    var ed=state.mapEditor;if(!ed||from<0||to<0||from>=ed.order.length||to>=ed.order.length||from===to)return;
    var item=ed.order.splice(from,1)[0];ed.order.splice(to,0,item);invalidateRoadRoute();renderMapEditor();
  }
  function renderMapEditor(){
    var ed=state.mapEditor,listEl=qs('#gorMapOrderList');if(!ed||!listEl)return;
    listEl.innerHTML=ed.order.map(function(a,index){var key=agencyKey(a.numero||a.codigo);return '<div class="gor-map-order-row'+(ed.selectedKey===key?' selected':'')+'" draggable="true" data-map-key="'+esc(key)+'"><div class="num">'+(index+1)+'</div><div><strong>AG '+esc(agencyNumber(a))+' · '+esc(agencyName(a))+'</strong><small>'+esc(agencyGroupCode(a))+(agencyAddress(a)?' · '+esc(agencyAddress(a)):'')+'</small></div><div class="gor-map-row-actions"><button data-map-up="'+esc(key)+'" title="Subir">↑</button><button data-map-down="'+esc(key)+'" title="Bajar">↓</button><button data-map-position="'+esc(key)+'" title="Mover a posición">#</button></div></div>';}).join('');
    qsa('[data-map-up]',listEl).forEach(function(b){b.addEventListener('click',function(ev){ev.stopPropagation();var i=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===b.dataset.mapUp;});mapEditorMove(i,i-1);});});
    qsa('[data-map-down]',listEl).forEach(function(b){b.addEventListener('click',function(ev){ev.stopPropagation();var i=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===b.dataset.mapDown;});mapEditorMove(i,i+1);});});
    qsa('[data-map-position]',listEl).forEach(function(b){b.addEventListener('click',function(ev){ev.stopPropagation();var i=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===b.dataset.mapPosition;}),raw=global.prompt?global.prompt('Mover AG '+agencyNumber(ed.order[i])+' a la posición (1-'+ed.order.length+'): ',String(i+1)):null,n=Number(raw);if(Number.isInteger(n)&&n>=1&&n<=ed.order.length)mapEditorMove(i,n-1);});});
    qsa('[data-map-key]',listEl).forEach(function(row){
      row.addEventListener('click',function(){selectMapAgency(row.dataset.mapKey,true);});
      row.addEventListener('dragstart',function(ev){ed.dragKey=row.dataset.mapKey;row.classList.add('dragging');if(ev.dataTransfer)ev.dataTransfer.effectAllowed='move';});
      row.addEventListener('dragend',function(){row.classList.remove('dragging');ed.dragKey=null;});
      row.addEventListener('dragover',function(ev){ev.preventDefault();});
      row.addEventListener('drop',function(ev){ev.preventDefault();var from=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===ed.dragKey;}),to=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===row.dataset.mapKey;});mapEditorMove(from,to);});
    });
    state.mapMarkers.forEach(function(m){var idx=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===m.key;});m.el.textContent=String(idx+1);m.el.classList.toggle('selected',ed.selectedKey===m.key);});
    drawMapRouteLine();
  }
  function selectMapAgency(key,openPopup){
    var ed=state.mapEditor;if(!ed)return;ed.selectedKey=key;renderMapEditor();var marker=state.mapMarkers.find(function(m){return m.key===key;});if(marker&&openPopup){try{marker.marker.togglePopup();state.map.easeTo({center:marker.marker.getLngLat(),zoom:Math.max(state.map.getZoom(),14)});}catch(_e){}}
  }
  function routeFeature(coordinates){return{type:'Feature',geometry:{type:'LineString',coordinates:coordinates||[]},properties:{}};}
  function formatKm(meters){var km=Number(meters||0)/1000;return km<10?km.toFixed(1)+' km':Math.round(km)+' km';}
  function formatDuration(seconds){var mins=Math.round(Number(seconds||0)/60);if(mins<60)return mins+' min';var h=Math.floor(mins/60),m=mins%60;return h+' h'+(m?' '+m+' min':'');}
  function setRoadSummary(html){var el=qs('#gorRoadRouteSummary');if(el)el.innerHTML=html;}
  function invalidateRoadRoute(){
    state.roadRoute=null;
    if(state.roadRouteAbort){try{state.roadRouteAbort.abort();}catch(_e){}state.roadRouteAbort=null;}
    var clear=qs('#gorClearRoadRouteBtn');if(clear)clear.style.display='none';
    setRoadSummary('<span class="gor-road-note">Orden modificado. Pulsa “Calcular ruta real” para actualizar el recorrido.</span>');
    drawMapRouteLine();
  }
  function setRouteSource(data){
    if(!state.map||!state.map.isStyleLoaded())return;
    try{
      var source=state.map.getSource('gor-route-line');
      if(source)source.setData(data);else state.map.addSource('gor-route-line',{type:'geojson',data:data});
      if(!state.map.getLayer('gor-route-line-outline'))state.map.addLayer({id:'gor-route-line-outline',type:'line',source:'gor-route-line',paint:{'line-color':'#ffffff','line-width':8,'line-opacity':.92,'line-blur':1}});
      if(!state.map.getLayer('gor-route-line-layer'))state.map.addLayer({id:'gor-route-line-layer',type:'line',source:'gor-route-line',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#087fba','line-width':5,'line-opacity':.95}});
    }catch(_e){}
  }
  function drawMapRouteLine(){
    if(!state.map||!state.mapEditor||!state.map.isStyleLoaded())return;
    var straight=state.mapEditor.order.map(agencyCoords).filter(Boolean).map(function(c){return[c.lng,c.lat];});
    var coordinates=state.roadRoute&&state.roadRoute.coordinates&&state.roadRoute.coordinates.length?state.roadRoute.coordinates:straight;
    setRouteSource(routeFeature(coordinates));
    try{
      if(state.map.getLayer('gor-route-line-layer'))state.map.setPaintProperty('gor-route-line-layer','line-dasharray',state.roadRoute?[1,0]:[1.5,1.5]);
      if(state.map.getLayer('gor-route-line-layer'))state.map.setPaintProperty('gor-route-line-layer','line-opacity',state.roadRoute?.9:.55);
    }catch(_e){}
  }
  async function fetchRoadChunk(points,signal){
    var coords=points.map(function(c){return c.lng+','+c.lat;}).join(';');
    var url='https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=full&geometries=geojson&steps=false&alternatives=false';
    var response=await fetch(url,{method:'GET',signal:signal,headers:{'Accept':'application/json'}});
    if(!response.ok)throw new Error('El servicio de rutas respondió '+response.status+'.');
    var json=await response.json();
    if(json.code!=='Ok'||!json.routes||!json.routes[0])throw new Error(json.message||'No se pudo calcular el recorrido por calles.');
    return json.routes[0];
  }
  async function calculateRoadRoute(){
    var ed=state.mapEditor,btn=qs('#gorCalculateRoadRouteBtn');if(!ed)return;
    var points=ed.order.map(function(a){var c=agencyCoords(a);return c?{a:a,lng:c.lng,lat:c.lat}:null;}).filter(Boolean);
    if(points.length<2){notify('Necesitas al menos dos agencias con coordenadas.','error');return;}
    if(state.roadRouteAbort){try{state.roadRouteAbort.abort();}catch(_e){}}
    var controller=global.AbortController?new AbortController():null;state.roadRouteAbort=controller;
    setButtonLoading(btn,true,'Calculando calles...');setRoadSummary('<span class="gor-spin" style="display:inline-block"></span><span>Calculando recorrido real por las calles...</span>');
    try{
      var all=[],distance=0,duration=0,max=25;
      for(var i=0;i<points.length-1;i+=max-1){
        var chunk=points.slice(i,Math.min(i+max,points.length));if(chunk.length<2)break;
        var route=await fetchRoadChunk(chunk,controller?controller.signal:undefined),segment=route.geometry&&route.geometry.coordinates||[];
        if(all.length&&segment.length)segment=segment.slice(1);all=all.concat(segment);distance+=Number(route.distance||0);duration+=Number(route.duration||0);
      }
      if(!all.length)throw new Error('El servicio no devolvió un trazado válido.');
      state.roadRoute={coordinates:all,distance:distance,duration:duration,calculatedAt:new Date().toISOString(),provider:'OSRM'};
      drawMapRouteLine();
      var clear=qs('#gorClearRoadRouteBtn');if(clear)clear.style.display='';
      setRoadSummary('<span class="gor-road-pill"><i class="fas fa-road"></i> '+formatKm(distance)+'</span><span class="gor-road-pill"><i class="fas fa-clock"></i> '+formatDuration(duration)+'</span><span class="gor-road-pill"><i class="fas fa-location-dot"></i> '+points.length+' paradas</span><span class="gor-road-note">Recorrido temporal; no guardado en Supabase.</span>');
      try{var b=new global.maplibregl.LngLatBounds();all.forEach(function(c){b.extend(c);});state.map.fitBounds(b,{padding:55,maxZoom:15});}catch(_e){}
    }catch(error){
      if(error&&error.name==='AbortError')return;
      state.roadRoute=null;drawMapRouteLine();setRoadSummary('<span class="gor-road-note">No se pudo calcular la ruta real. Se mantiene la línea de referencia.</span>');handleError(error,'calcular ruta real');
    }finally{state.roadRouteAbort=null;setButtonLoading(btn,false);}
  }
  function clearRoadRoute(){state.roadRoute=null;var clear=qs('#gorClearRoadRouteBtn');if(clear)clear.style.display='none';setRoadSummary('<span class="gor-road-note">Recorrido eliminado. Pulsa “Calcular ruta real” cuando quieras generarlo otra vez.</span>');drawMapRouteLine();}
  function applyMapOrder(){
    var ed=state.mapEditor;if(!ed)return;
    if(ed.applyToCurrent){state.routeOrder=ed.order.map(function(a){return agencyKey(a.numero||a.codigo);});syncItemOrder();renderComparison();notify('Orden del mapa aplicado a la ruta.','success');closeModal('gorMapModal');}
    else if(typeof ed.onApply==='function')ed.onApply(ed.order.slice());
    else closeModal('gorMapModal');
  }
  function openMap(routeAgencies,title,options){
    var list=(routeAgencies||[]).filter(Boolean),opts=options||{};openModal('gorMapModal');qs('#gorMapTitle').textContent=title||'Mapa de ruta';var fallback=qs('#gorMapFallback');fallback.innerHTML='';qs('#gorMapCanvas').innerHTML='';state.mapEditor={order:list.slice(),original:list.slice(),selectedKey:null,dragKey:null,applyToCurrent:!!opts.applyToCurrent,onApply:opts.onApply||null};state.roadRoute=null;
    qs('#gorMapApplyOrderBtn').style.display=opts.editable===false?'none':'';qs('#gorMapResetOrderBtn').style.display=opts.editable===false?'none':'';
    qs('#gorMapApplyOrderBtn').onclick=applyMapOrder;qs('#gorMapResetOrderBtn').onclick=function(){state.mapEditor.order=state.mapEditor.original.slice();invalidateRoadRoute();renderMapEditor();};var calcBtn=qs('#gorCalculateRoadRouteBtn'),clearBtn=qs('#gorClearRoadRouteBtn');if(calcBtn)calcBtn.onclick=calculateRoadRoute;if(clearBtn){clearBtn.onclick=clearRoadRoute;clearBtn.style.display='none';}setRoadSummary('<span class="gor-road-note">Ordena las agencias y pulsa “Calcular ruta real”. No se guarda en Supabase.</span>');renderMapEditor();
    var coords=list.map(function(a){var c=agencyCoords(a);return c?{a:a,lat:c.lat,lng:c.lng}:null;}).filter(Boolean);
    if(!global.maplibregl||!coords.length){qs('#gorMapCanvas').innerHTML='<div class="gor-empty" style="margin:20px">No hay coordenadas suficientes para dibujar el mapa. Todavía puedes organizar la ruta desde la lista lateral.</div>';fallback.innerHTML='<div class="gor-chips">'+list.map(function(a){return '<a class="gor-chip" href="'+esc(agencyMapUrl(a))+'" target="_blank">AG '+esc(agencyNumber(a))+'</a>';}).join('')+'</div>';return;}
    try{
      if(state.map)state.map.remove();state.map=new global.maplibregl.Map({container:'gorMapCanvas',style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap'}},layers:[{id:'osm',type:'raster',source:'osm'}]},center:[coords[0].lng,coords[0].lat],zoom:11});state.map.addControl(new global.maplibregl.NavigationControl(),'top-right');var bounds=new global.maplibregl.LngLatBounds();state.mapMarkers=[];
      coords.forEach(function(x,index){var key=agencyKey(x.a.numero||x.a.codigo),el=document.createElement('div');el.className='gor-map-marker';el.textContent=String(index+1);el.addEventListener('click',function(){selectMapAgency(key,false);});var popup=new global.maplibregl.Popup({offset:20}).setHTML('<strong>AG '+esc(agencyNumber(x.a))+'</strong><br>'+esc(agencyName(x.a))+'<br>'+esc(agencyGroupCode(x.a))+'<br><button type="button" onclick="window.GOOperationalRoutes.moveMapAgencyToPosition(\''+esc(key)+'\')" style="margin-top:7px;padding:6px 8px;border-radius:8px;border:1px solid #bcd3e0;background:#fff;color:#075d94;font-weight:800;cursor:pointer">Cambiar posición</button><br><a href="'+esc(agencyMapUrl(x.a))+'" target="_blank">Abrir Google Maps</a>');var marker=new global.maplibregl.Marker({element:el}).setLngLat([x.lng,x.lat]).setPopup(popup).addTo(state.map);state.mapMarkers.push({key:key,el:el,marker:marker});bounds.extend([x.lng,x.lat]);});
      state.map.on('load',function(){state.map.resize();if(coords.length>1)state.map.fitBounds(bounds,{padding:55,maxZoom:15});renderMapEditor();});fallback.innerHTML='<div style="color:#6e8495;font-size:12px;margin-top:8px">'+coords.length+' de '+list.length+' agencias tienen coordenadas disponibles. El orden oficial se define con los números del mapa.</div>';
    }catch(error){fallback.innerHTML='<div class="gor-empty">No se pudo abrir el mapa: '+esc(friendlyError(error))+'</div>';}
  }


  async function refreshAllData(){var btn=qs('#gorRefreshDataBtn');setButtonLoading(btn,true,'Actualizando...');try{if(typeof global.lotekaReloadAgenciasGruposSupabase==='function')await global.lotekaReloadAgenciasGruposSupabase();populateGroups();await populateProfiles(true);var rt=runtime();if(rt)rt.data.invalidate('rutas:');await loadRoutes(true);notify('Datos actualizados.','success');}catch(error){handleError(error,'actualizar datos');}finally{setButtonLoading(btn,false);}}
  async function open(nav){if(!canView()){notify('No tienes permiso para consultar Rutas y cobertura.','error');return;}if(typeof global.cambiarVista==='function')global.cambiarVista('ops-rutas',nav||document.getElementById('navRoutesCoverage'));else{qsa('[id^="vista-"]').forEach(function(v){v.classList.add('hidden');});document.getElementById('vista-ops-rutas')?.classList.remove('hidden');}try{if(typeof global.setSidebarSectionOpen==='function')global.setSidebarSectionOpen('operaciones',true);}catch(_e){}populateGroups();populateProfiles(false);if(!qs('#gorRouteDate').value)qs('#gorRouteDate').value=nowISO();if(!qs('#gorGroupSelect').value)qs('#gorGroupSelect').value=ALL_GROUPS;}
  function init(){injectStyles();buildView();buildNav();wrapNavigation();bindEvents();populateGroups();if(qs('#gorRouteDate'))qs('#gorRouteDate').value=nowISO();if(qs('#gorGroupSelect'))qs('#gorGroupSelect').value=ALL_GROUPS;refreshPermissionVisibility();var rt=runtime();if(rt){rt.modules.register('operaciones-rutas',{version:VERSION,refresh:refreshAllData,open:open});rt.events.on('auth:ready',function(){refreshPermissionVisibility();populateGroups();});rt.events.on('state:permissions',refreshPermissionVisibility);}}

  global.GOOperationalRoutes={version:VERSION,init:init,open:open,compare:compareFromForm,refresh:refreshAllData,parseList:parseAgencyTokens,compareData:makeComparison,copyCurrent:function(){openExportForCurrent(true);},moveMapAgencyToPosition:function(key){var ed=state.mapEditor;if(!ed)return;var i=ed.order.findIndex(function(a){return agencyKey(a.numero||a.codigo)===String(key);});var raw=global.prompt?global.prompt('Mover AG '+agencyNumber(ed.order[i])+' a la posición (1-'+ed.order.length+'): ',String(i+1)):null,n=Number(raw);if(Number.isInteger(n)&&n>=1&&n<=ed.order.length)mapEditorMove(i,n-1);},diagnostics:function(){return{version:VERSION,comparison:state.comparison?state.comparison.counts:null,routes:state.routes.length,profiles:state.profiles.length,canView:canView(),canManage:canManage(),routeOrder:state.routeOrder.slice(),roadRoute:state.roadRoute?{distance:state.roadRoute.distance,duration:state.roadRoute.duration,points:state.roadRoute.coordinates.length}:null};}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

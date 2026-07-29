
    const REPORTES_TABLE = 'reportes_operaciones';

    // BACKEND_CERO · NUEVO MOTOR PRINCIPAL DE OPERACIONES LOTEKA
    const BACKEND_CERO_ENDPOINT = '';
    const BACKEND_CERO_PROJECT_ID = '';
    const BACKEND_CERO_DATABASE_ID = '';
    const BACKEND_CERO_OPERACIONES_COLLECTION_ID = 'operaciones';
    const BACKEND_CERO_AGENCIAS_COLLECTION_ID = 'agencias';

    const backendCeroClient = new BackendCero.Client()
      .setEndpoint(BACKEND_CERO_ENDPOINT)
      .setProject(BACKEND_CERO_PROJECT_ID);

    const backendCeroDatabases = new BackendCero.Databases(backendCeroClient);
    const backendCeroQuery = BackendCero.Query;

    // MAPA DE AGENCIAS + BACKEND_CERO · MAPLIBRE GL JS / WEBGL
    let agenciasMapInstance = null;
    let agenciasMapLoaded = false;
    let agenciasMapLastSource = [];
    let agenciasMapSelectedGroups = new Set();
    let agenciasMapGroupsInitialized = false;
    let agenciasMapSearchText = '';
    let agenciasMapPendingFit = true;
    let agenciasMapResizeObserver = null;
    let agenciasMapSelectedTypes = new Set();
    let agenciasMapSelectedStates = new Set();
    let agenciasMapTypeFiltersInitialized = false;
    let agenciasMapStateFiltersInitialized = false;
    let agenciasMapGroupsExplicitNone = false;
    let agenciasMapTypesExplicitNone = false;
    let agenciasMapStatesExplicitNone = false;
    let agenciasMapRenderTimer = null;
    let agenciasMapLastRenderKey = '';
    let agenciasMapLastDebugAt = 0;
    let agenciasMapSyncInFlight = false;
    let agenciasMapSyncPending = false;
    let agenciasMapRealtimeStarted = false;
    let agenciasMapRealtimeUnsubscribe = null;
    let agenciasMapBootStarted = false;
    const AGENCIAS_MAP_DEBUG = false;

    function agencyMapDebug(){
      if(!AGENCIAS_MAP_DEBUG) return;
      const now = Date.now();
      if(now - agenciasMapLastDebugAt < 1500) return;
      agenciasMapLastDebugAt = now;
      try{ console.debug.apply(console, arguments); }catch(_e){}
    }

    function agencyMapActiveSource(){
      return agenciasMapLastSource.length ? agenciasMapLastSource : (typeof agencias !== 'undefined' ? agencias : []);
    }

    function agencyMapScheduleRefresh(options = {}){
      clearTimeout(agenciasMapRenderTimer);
      agenciasMapRenderTimer = setTimeout(() => {
        agenciasMapRenderTimer = null;
        agencyMapRefresh(agencyMapActiveSource(), options);
      }, Number(options.delay ?? 80));
    }

    const AGENCIAS_MAP_TYPE_OPTIONS = [
      ['agencia_normal', 'Agencia normal'],
      ['punto_pago', 'Punto de pago'],
      ['centro_pago', 'Centro de pago'],
      ['supermercado', 'Supermercado'],
      ['pasante', 'Pasante'],
      ['socio', 'Socio']
    ];

    const AGENCIAS_MAP_STATE_OPTIONS = [
      ['activa', 'Activa'],
      ['en_proceso', 'En proceso'],
      ['remodelacion', 'Remodelación'],
      ['desactivada', 'Desactivada'],
      ['cerrada', 'Cerrada']
    ];

    const AGENCIAS_EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };
    const AGENCIAS_LAYER_IDS = ['clusters', 'cluster-count', 'agencias-iconos-premium', 'agencias-labels'];

    function mapEscapeHtml(value){
      return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }

    function agencyToFloat(value){
      if(value === null || value === undefined || value === '') return null;
      const parsed = Number(String(value).replace(',', '.').trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    function extraerCoordenadasAgencia(a){
      let lat = agencyToFloat(a?.lat ?? a?.latitude ?? a?.latitud);
      let lng = agencyToFloat(a?.lng ?? a?.lon ?? a?.longitude ?? a?.longitud);

      if((!Number.isFinite(lat) || !Number.isFinite(lng)) && a?.geolocalizacion){
        const partes = String(a.geolocalizacion).split(',').map(x => Number(String(x).trim()));
        if(partes.length >= 2){
          lat = partes[0];
          lng = partes[1];
        }
      }

      if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if(lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng };
    }

    function agencyHasCoords(agencia){
      return extraerCoordenadasAgencia(agencia);
    }

    function agenciaMapNumero(agencia){
      return String(agencia?.numero ?? agencia?.codigo ?? agencia?.agencia ?? agencia?.numero_agencia ?? agencia?.num_agencia ?? '').trim();
    }

    function normalizarTipoAgencia(tipo){
      const t = String(tipo || '').trim().toLowerCase();
      if(!t || t === 'regular' || t === 'normal' || t === 'agencia normal') return 'Agencia';
      if(t.includes('pasante')) return 'Agencia de Pasante';
      if(t.includes('aprezio') || t.includes('aprecio')) return 'Aprezio';
      if(t.includes('centro')) return 'Centro De Pago';
      if(t.includes('punto')) return 'Punto de Pago';
      if(t.includes('supermercado') || t.includes('super')) return 'Agencia en Supermercado';
      return tipo || 'Agencia';
    }

    function normalizarTipoAgenciaMapa(tipo){
      const t = String(tipo || '').toLowerCase().trim();
      if(t.includes('pasante')) return 'pasante';
      if(t.includes('socio')) return 'socio';
      if(t.includes('punto')) return 'punto_pago';
      if(t.includes('centro')) return 'centro_pago';
      if(t.includes('super') || t.includes('mercado')) return 'supermercado';
      return 'agencia_normal';
    }

    function normalizarEstadoAgencia(estado){
      const e = String(estado || '').toLowerCase().trim();
      if(e.includes('proceso')) return 'en_proceso';
      if(e.includes('remodel')) return 'remodelacion';
      if(e.includes('desactiv') || e.includes('inact')) return 'desactivada';
      if(e.includes('cerr')) return 'cerrada';
      if(e.includes('activa') || e.includes('activo') || e.includes('abierta') || e.includes('servicio') || e === '') return 'activa';
      return 'activa';
    }

    function getAgencyTipoAgencia(agencia){
      const numero = agencia?.numero || agencia?.codigo || agencia?.agencia || agencia?.numero_agencia;
      const fijo = typeof getFixedAgencyType === 'function' ? getFixedAgencyType(numero) : null;
      return normalizarTipoAgencia(fijo || agencia?.detalle?.tipoAgencia || agencia?.tipoAgencia || agencia?.tipo_agencia || agencia?.tipo || agencia?.categoria || 'Agencia');
    }

    function agenciaMapGroupValue(agencia){
      if(typeof getAgencyEstadoOperativo === 'function' && getAgencyEstadoOperativo(agencia) === 'DESACTIVADA/CERRADA') return AGENCY_SPECIAL_CLOSED_GROUP;
      const raw = String(agencia?.grupo || agencia?.grupo_nombre || agencia?.grupoId || agencia?.grupo_id || 'Sin grupo').trim();
      return raw || 'Sin grupo';
    }

    function agenciaMapGroupNumber(group){
      if(String(group || '').trim() === AGENCY_SPECIAL_CLOSED_GROUP) return 'CERRADAS';
      const match = String(group || '').match(/\d+/);
      return match ? match[0].padStart(2, '0') : String(group || 'SG');
    }

    function agenciaMapGroupStyle(group, index){
      const groupNum = agenciaMapGroupNumber(group);
      const special = {
        'CERRADAS': { color:'#65717f', color2:'#252f3a', glow:'rgba(76,86,99,.24)', dot:'#ffffff', shape:'circle' },
        '44': { color:'#0b77ba', color2:'#073f74', glow:'rgba(11,119,186,.18)', dot:'#ffc247', shape:'drop' },
        '45': { color:'#ff7a18', color2:'#b83b00', glow:'rgba(255,122,24,.22)', dot:'#062743', shape:'diamond' },
        '42': { color:'#d43ad7', color2:'#7e1481', glow:'rgba(212,58,215,.22)', dot:'#ffffff', shape:'hex' },
        '08': { color:'#00d4ff', color2:'#005f99', glow:'rgba(0,212,255,.22)', dot:'#ffffff', shape:'shield' },
        '06': { color:'#19d27d', color2:'#057245', glow:'rgba(25,210,125,.24)', dot:'#ffffff', shape:'triangle' }
      };
      if(special[groupNum]) return special[groupNum];
      const palette = [
        {color:'#9aa8b6',color2:'#54606d',glow:'rgba(154,168,182,.20)',dot:'#ffffff',shape:'circle'},
        {color:'#ff2d37',color2:'#9b1119',glow:'rgba(255,45,55,.20)',dot:'#ffffff',shape:'square'},
        {color:'#2bb7de',color2:'#057fa0',glow:'rgba(43,183,222,.20)',dot:'#ffffff',shape:'hex'},
        {color:'#8ada34',color2:'#3c8d12',glow:'rgba(138,218,52,.20)',dot:'#062743',shape:'drop'},
        {color:'#ffd33d',color2:'#d09200',glow:'rgba(255,211,61,.22)',dot:'#062743',shape:'diamond'},
        {color:'#d43ad7',color2:'#7e1481',glow:'rgba(212,58,215,.20)',dot:'#ffffff',shape:'circle'},
        {color:'#9a4dff',color2:'#4f16b6',glow:'rgba(154,77,255,.20)',dot:'#ffffff',shape:'square'},
        {color:'#25b8db',color2:'#086f88',glow:'rgba(37,184,219,.20)',dot:'#ffffff',shape:'hex'}
      ];
      const n = parseInt(groupNum, 10);
      return palette[Number.isFinite(n) ? n % palette.length : index % palette.length];
    }

    function agenciaMapGroupColor(group, index){
      return agenciaMapGroupStyle(group, index).color;
    }


    function colorEstadoMapa(estado){
      const e = normalizarEstadoAgencia(estado);
      if(e === 'en_proceso') return '#f59e0b';
      if(e === 'remodelacion') return '#a855f7';
      if(e === 'desactivada') return '#64748b';
      if(e === 'cerrada') return '#ef4444';
      return '#ffffff';
    }

    function iconPathPorTipo(tipo){
      switch(String(tipo || '').trim()){
        case 'punto_pago':
          return 'money';
        case 'centro_pago':
          return 'bank';
        case 'supermercado':
          return 'cart';
        case 'pasante':
          return 'swap';
        case 'socio':
          return 'star';
        case 'agencia_normal':
        default:
          return 'store';
      }
    }

    function agenciaMapIconId({ tipo, grupo, estado }){
      const clean = value => String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'none';
      return `agency-${clean(tipo)}-${clean(grupo)}-${clean(normalizarEstadoAgencia(estado))}`;
    }

    function drawAgencyIconGlyph(ctx, tipo, cx, cy){
      const kind = iconPathPorTipo(tipo);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2.45;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if(kind === 'money'){
        ctx.beginPath();
        roundRectPath(ctx, cx - 9, cy - 7, 18, 14, 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy - 4); ctx.lineTo(cx - 7, cy - 4);
        ctx.moveTo(cx + 7, cy + 4); ctx.lineTo(cx + 11, cy + 4);
        ctx.stroke();
      }else if(kind === 'bank'){
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 5); ctx.lineTo(cx, cy - 12); ctx.lineTo(cx + 10, cy - 5); ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx - 9, cy + 7, 18, 3);
        ctx.fillRect(cx - 7, cy - 4, 3, 10);
        ctx.fillRect(cx - 1.5, cy - 4, 3, 10);
        ctx.fillRect(cx + 4, cy - 4, 3, 10);
      }else if(kind === 'cart'){
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy - 8); ctx.lineTo(cx - 8, cy - 8); ctx.lineTo(cx - 5, cy + 4); ctx.lineTo(cx + 8, cy + 4); ctx.lineTo(cx + 11, cy - 4); ctx.lineTo(cx - 6, cy - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 4, cy + 9, 1.8, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy + 9, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }else if(kind === 'swap'){
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 5); ctx.lineTo(cx + 8, cy - 5); ctx.lineTo(cx + 4, cy - 9);
        ctx.moveTo(cx + 8, cy - 5); ctx.lineTo(cx + 4, cy - 1);
        ctx.moveTo(cx + 10, cy + 5); ctx.lineTo(cx - 8, cy + 5); ctx.lineTo(cx - 4, cy + 9);
        ctx.moveTo(cx - 8, cy + 5); ctx.lineTo(cx - 4, cy + 1);
        ctx.stroke();
      }else if(kind === 'star'){
        ctx.beginPath();
        for(let i=0;i<10;i++){
          const a = -Math.PI/2 + i * Math.PI/5;
          const r = i % 2 === 0 ? 10 : 4.5;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if(i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath();
        ctx.fill();
      }else{
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy - 3); ctx.lineTo(cx - 8, cy - 11); ctx.lineTo(cx + 8, cy - 11); ctx.lineTo(cx + 11, cy - 3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        roundRectPath(ctx, cx - 9, cy - 3, 18, 14, 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy + 11); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx + 3, cy + 3); ctx.lineTo(cx + 3, cy + 11);
        ctx.stroke();
      }
      ctx.restore();
    }

    function roundRectPath(ctx, x, y, w, h, r){
      const rr = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
    }

    function crearIconoAgenciaPremium({ tipo, colorGrupo, estado }){
      // Pin premium escalado: 52x62 CSS px usando pixelRatio 2 para nitidez.
      // Regla visual: tipo = icono interno, grupo = color del pin, estado = borde.
      const canvas = document.createElement('canvas');
      canvas.width = 104;
      canvas.height = 124;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 104, 124);
      const strokeEstado = colorEstadoMapa(estado);
      const fill = colorGrupo || '#2563eb';

      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, .24)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.moveTo(52, 120);
      ctx.bezierCurveTo(52, 120, 94, 79, 94, 45);
      ctx.bezierCurveTo(94, 21, 75.2, 4, 52, 4);
      ctx.bezierCurveTo(28.8, 4, 10, 21, 10, 45);
      ctx.bezierCurveTo(10, 79, 52, 120, 52, 120);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 6.8;
      ctx.strokeStyle = strokeEstado;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,.92)';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = .18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(52, 45, 33, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(52, 45);
      ctx.scale(1.35, 1.35);
      ctx.translate(-52, -45);
      drawAgencyIconGlyph(ctx, tipo, 52, 45);
      ctx.restore();

      return ctx.getImageData(0, 0, 104, 124);
    }

    function asegurarIconosAgencias(map, agenciasGeoJSON){
      let cantidadIconosGenerados = 0;
      if(!map || !agenciasGeoJSON || !Array.isArray(agenciasGeoJSON.features)) return 0;
      agenciasGeoJSON.features.forEach(feature => {
        const p = feature.properties || {};
        const iconId = agenciaMapIconId({ tipo:p.tipo, grupo:p.grupo, estado:p.estado });
        feature.properties.icon_id = iconId;
        if(!map.hasImage(iconId)){
          map.addImage(iconId, crearIconoAgenciaPremium({ tipo:p.tipo, colorGrupo:p.color_grupo, estado:p.estado }), { pixelRatio: 2 });
          cantidadIconosGenerados++;
        }
      });
      console.log('Iconos premium generados:', cantidadIconosGenerados);
      return cantidadIconosGenerados;
    }

    function agenciaMapCurrentGroups(source){
      const counts = new Map();
      (Array.isArray(source) ? source : []).filter(agencyHasCoords).forEach(a => {
        const g = agenciaMapGroupValue(a);
        counts.set(g, (counts.get(g) || 0) + 1);
      });
      return Array.from(counts.entries()).sort((a,b) => agenciaMapGroupNumber(a[0]).localeCompare(agenciaMapGroupNumber(b[0]), undefined, {numeric:true}));
    }

    function convertirAgenciasAGeoJSON(agenciasLista){
      const features = [];
      const gruposOrdenados = agenciaMapCurrentGroups(Array.isArray(agenciasMapLastSource) && agenciasMapLastSource.length ? agenciasMapLastSource : agenciasLista).map(([g]) => g);
      const indiceGrupo = new Map(gruposOrdenados.map((g, index) => [String(g), index]));
      (Array.isArray(agenciasLista) ? agenciasLista : []).forEach(a => {
        const coords = extraerCoordenadasAgencia(a);
        if(!coords) return;

        const numero = agenciaMapNumero(a);
        const tipoRaw = a?.tipo || a?.tipo_agencia || a?.categoria || a?.detalle?.tipoAgencia || a?.tipoAgencia || '';
        const estadoRaw = a?.detalle?.estadoOperativo || a?.estadoOperativo || a?.estado || a?.status || a?.estado_agencia || (typeof getAgencyEstadoOperativo === 'function' ? getAgencyEstadoOperativo(a) : 'Activa');
        const grupo = agenciaMapGroupValue(a);
        const groupIndex = indiceGrupo.has(String(grupo)) ? indiceGrupo.get(String(grupo)) : features.length;
        const colorGrupo = agenciaMapGroupColor(grupo, groupIndex);
        const tipoNormalizado = normalizarTipoAgenciaMapa(tipoRaw || getAgencyTipoAgencia(a));
        const estadoNormalizado = normalizarEstadoAgencia(estadoRaw);
        const iconId = agenciaMapIconId({ tipo: tipoNormalizado, grupo, estado: estadoNormalizado });
        const indexReal = (typeof agencias !== 'undefined' && Array.isArray(agencias))
          ? agencias.findIndex(item => String(agenciaMapNumero(item)).padStart(4,'0') === String(numero).padStart(4,'0'))
          : -1;

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
          properties: {
            id: a?.id || a?.backendCeroId || numero,
            index: indexReal,
            numero: String(numero),
            nombre: a?.nombre || '',
            direccion: a?.direccion || '',
            grupo: String(grupo || ''),
            encargado: a?.encargado || a?.responsable || '',
            tipo_original: String(tipoRaw || getAgencyTipoAgencia(a)),
            tipo: tipoNormalizado,
            tipo_label: getAgencyTipoAgencia(a),
            estado_original: String(estadoRaw || 'Activa'),
            estado: estadoNormalizado,
            color_grupo: colorGrupo,
            icon_id: iconId,
            lat: coords.lat,
            lng: coords.lng
          }
        });
      });
      return { type: 'FeatureCollection', features };
    }

    function ensureAgencyMapDashboard(el){
      if(!el || document.getElementById('lotekaMapDashboard')) return;
      const dash = document.createElement('div');
      dash.id = 'lotekaMapDashboard';
      dash.className = 'loteka-map-dashboard';
      dash.innerHTML = `
        <aside class="map-filter-panel">
          <div class="map-filter-head">
            <h3>Panel de filtros</h3>
            <span id="mapFilterCount">0 agencias visibles</span>
          </div>
          <div class="map-filter-search">
            <i class="fas fa-search"></i>
            <input id="agencyMapSearchInput" type="text" placeholder="Buscar agencia, grupo, tipo, estado o encargado">
          </div>
          <div class="map-filter-scroll">
            <div class="map-filter-section-title map-filter-section-groups"><span>Grupos visibles</span><small>Activa o desactiva zonas del mapa</small></div>
            <div id="agencyGroupFilterList" class="map-filter-list map-filter-list-groups"></div>
            <div class="map-filter-actions map-filter-actions-groups">
              <button type="button" onclick="agencyMapSelectAllGroups()">Todos</button>
              <button type="button" onclick="agencyMapSelectNoGroups()">Ninguno</button>
            </div>

            <div class="map-filter-section-title map-filter-section-compact"><span>Tipos de agencias</span><small>Combina uno o varios tipos</small></div>
            <div id="agencyTypeFilterList" class="map-filter-chip-list"></div>
            <div class="map-filter-mini-actions">
              <button type="button" onclick="agencyMapSelectAllTypes()">Todos</button>
              <button type="button" onclick="agencyMapSelectNoTypes()">Ninguno</button>
            </div>

            <div class="map-filter-section-title map-filter-section-compact"><span>Estados</span><small>Filtra por estado operativo</small></div>
            <div id="agencyStateFilterList" class="map-filter-chip-list"></div>
            <div class="map-filter-mini-actions">
              <button type="button" onclick="agencyMapSelectAllStates()">Todos</button>
              <button type="button" onclick="agencyMapSelectNoStates()">Ninguno</button>
            </div>
          </div>
        </aside>`;
      el.appendChild(dash);
      const input = document.getElementById('agencyMapSearchInput');
      if(input){
        input.addEventListener('input', () => {
          agenciasMapSearchText = input.value || '';
          agencyMapScheduleRefresh({ fit:false });
        });
      }
    }

    function agencyMapTipoRaw(agencia){
      return agencia?.tipo || agencia?.tipo_agencia || agencia?.categoria || agencia?.detalle?.tipoAgencia || agencia?.tipoAgencia || getAgencyTipoAgencia(agencia) || 'Agencia';
    }

    function agencyMapEstadoRaw(agencia){
      return agencia?.detalle?.estadoOperativo || agencia?.estadoOperativo || agencia?.estado || agencia?.status || agencia?.estado_agencia || (typeof getAgencyEstadoOperativo === 'function' ? getAgencyEstadoOperativo(agencia) : 'Activa');
    }

    function renderAgencyStatusFilters(){
      renderAgencyTypeFilters(agenciasMapLastSource.length ? agenciasMapLastSource : (typeof agencias !== 'undefined' ? agencias : []));
      renderAgencyStateFilters(agenciasMapLastSource.length ? agenciasMapLastSource : (typeof agencias !== 'undefined' ? agencias : []));
    }

    function agencyMapMatchesFilter(agencia){
      const group = agenciaMapGroupValue(agencia);
      if(agenciasMapGroupsInitialized && agenciasMapSelectedGroups.size === 0 && agenciasMapGroupsExplicitNone) return false;
      if(agenciasMapSelectedGroups.size && !agenciasMapSelectedGroups.has(group)) return false;

      const tipoNormalizado = normalizarTipoAgenciaMapa(agencyMapTipoRaw(agencia));
      const estadoNormalizado = normalizarEstadoAgencia(agencyMapEstadoRaw(agencia));
      if(agenciasMapTypeFiltersInitialized && agenciasMapSelectedTypes.size === 0 && agenciasMapTypesExplicitNone) return false;
      if(agenciasMapSelectedTypes.size && !agenciasMapSelectedTypes.has(tipoNormalizado)) return false;
      if(agenciasMapStateFiltersInitialized && agenciasMapSelectedStates.size === 0 && agenciasMapStatesExplicitNone) return false;
      if(agenciasMapSelectedStates.size && !agenciasMapSelectedStates.has(estadoNormalizado)) return false;

      const q = String(agenciasMapSearchText || '').trim().toLowerCase();
      if(!q) return true;
      const label = typeof formatAgencyOptionLabel === 'function' ? formatAgencyOptionLabel(agencia) : (agencia.nombre || `Agencia ${agenciaMapNumero(agencia)}`);
      const haystack = [
        label,
        agenciaMapNumero(agencia),
        agencia?.nombre,
        group,
        agencia?.encargado,
        agencia?.responsable,
        agencia?.direccion,
        getAgencyTipoAgencia(agencia),
        agencyMapTipoRaw(agencia),
        tipoNormalizado,
        agencyMapEstadoRaw(agencia),
        estadoNormalizado
      ].filter(v => v !== undefined && v !== null).join(' ').toLowerCase();
      return haystack.includes(q);
    }

    function agencyMapCountBy(source, normalizer){
      const counts = new Map();
      (Array.isArray(source) ? source : []).filter(agencyHasCoords).forEach(a => {
        const key = normalizer(a);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      return counts;
    }

    function renderAgencyTypeFilters(source){
      const list = document.getElementById('agencyTypeFilterList');
      if(!list) return;
      const allTypes = AGENCIAS_MAP_TYPE_OPTIONS.map(([value]) => value);
      if(!agenciasMapTypeFiltersInitialized || (!agenciasMapTypesExplicitNone && agenciasMapSelectedTypes.size === 0)){
        agenciasMapSelectedTypes = new Set(allTypes);
        agenciasMapTypeFiltersInitialized = true;
        agenciasMapTypesExplicitNone = false;
      }
      const valid = new Set(allTypes);
      agenciasMapSelectedTypes = new Set(Array.from(agenciasMapSelectedTypes).filter(value => valid.has(value)));
      if(!agenciasMapTypesExplicitNone && agenciasMapSelectedTypes.size === 0){
        agenciasMapSelectedTypes = new Set(allTypes);
      }
      const counts = agencyMapCountBy(source, a => normalizarTipoAgenciaMapa(agencyMapTipoRaw(a)));
      list.innerHTML = AGENCIAS_MAP_TYPE_OPTIONS.map(([value, label]) => {
        const checked = agenciasMapSelectedTypes.has(value) ? 'checked' : '';
        const count = counts.get(value) || 0;
        return `<label class="map-filter-chip ${checked ? '' : 'is-off'}" data-type="${mapEscapeHtml(value)}">
          <input type="checkbox" ${checked} data-map-type="${mapEscapeHtml(value)}">
          <span>${mapEscapeHtml(label)}</span>
          <b>${count}</b>
        </label>`;
      }).join('');
      list.querySelectorAll('input[data-map-type]').forEach(input => {
        input.addEventListener('change', () => {
          const value = input.getAttribute('data-map-type');
          if(input.checked) agenciasMapSelectedTypes.add(value);
          else agenciasMapSelectedTypes.delete(value);
          agenciasMapTypesExplicitNone = agenciasMapSelectedTypes.size === 0;
          const row = input.closest('.map-filter-chip');
          if(row) row.classList.toggle('is-off', !input.checked);
          agencyMapScheduleRefresh({ fit:false });
        });
      });
    }

    function renderAgencyStateFilters(source){
      const list = document.getElementById('agencyStateFilterList');
      if(!list) return;
      const allStates = AGENCIAS_MAP_STATE_OPTIONS.map(([value]) => value);
      if(!agenciasMapStateFiltersInitialized || (!agenciasMapStatesExplicitNone && agenciasMapSelectedStates.size === 0)){
        agenciasMapSelectedStates = new Set(allStates);
        agenciasMapStateFiltersInitialized = true;
        agenciasMapStatesExplicitNone = false;
      }
      const valid = new Set(allStates);
      agenciasMapSelectedStates = new Set(Array.from(agenciasMapSelectedStates).filter(value => valid.has(value)));
      if(!agenciasMapStatesExplicitNone && agenciasMapSelectedStates.size === 0){
        agenciasMapSelectedStates = new Set(allStates);
      }
      const counts = agencyMapCountBy(source, a => normalizarEstadoAgencia(agencyMapEstadoRaw(a)));
      list.innerHTML = AGENCIAS_MAP_STATE_OPTIONS.map(([value, label]) => {
        const checked = agenciasMapSelectedStates.has(value) ? 'checked' : '';
        const count = counts.get(value) || 0;
        return `<label class="map-filter-chip ${checked ? '' : 'is-off'}" data-state="${mapEscapeHtml(value)}">
          <input type="checkbox" ${checked} data-map-state="${mapEscapeHtml(value)}">
          <span>${mapEscapeHtml(label)}</span>
          <b>${count}</b>
        </label>`;
      }).join('');
      list.querySelectorAll('input[data-map-state]').forEach(input => {
        input.addEventListener('change', () => {
          const value = input.getAttribute('data-map-state');
          if(input.checked) agenciasMapSelectedStates.add(value);
          else agenciasMapSelectedStates.delete(value);
          agenciasMapStatesExplicitNone = agenciasMapSelectedStates.size === 0;
          const row = input.closest('.map-filter-chip');
          if(row) row.classList.toggle('is-off', !input.checked);
          agencyMapScheduleRefresh({ fit:false });
        });
      });
    }

    function renderAgencyGroupFilters(source){
      const list = document.getElementById('agencyGroupFilterList');
      if(!list) return;
      const groups = agenciaMapCurrentGroups(source);
      const allGroups = groups.map(([g]) => g);
      if(!agenciasMapGroupsInitialized || (!agenciasMapGroupsExplicitNone && agenciasMapSelectedGroups.size === 0)){
        agenciasMapSelectedGroups = new Set(allGroups);
        agenciasMapGroupsInitialized = true;
        agenciasMapGroupsExplicitNone = false;
      } else {
        const existing = new Set(allGroups);
        agenciasMapSelectedGroups = new Set(Array.from(agenciasMapSelectedGroups).filter(g => existing.has(g)));
        if(!agenciasMapGroupsExplicitNone && agenciasMapSelectedGroups.size === 0){
          agenciasMapSelectedGroups = new Set(allGroups);
        }
      }
      list.innerHTML = groups.map(([group, count], index) => {
        const checked = agenciasMapSelectedGroups.has(group) ? 'checked' : '';
        const color = agenciaMapGroupColor(group, index);
        const safeGroup = mapEscapeHtml(group);
        const safeNum = mapEscapeHtml(agenciaMapGroupNumber(group));
        return `<label class="map-filter-row ${checked ? '' : 'is-off'}" data-group="${safeGroup}">
          <span class="filter-chevron"><i class="fas fa-chevron-right"></i></span>
          <input type="checkbox" ${checked} data-map-group="${safeGroup}">
          <span class="filter-color" style="background:${color}"></span>
          <span class="filter-name">${safeNum}</span>
          <b>${count}</b>
        </label>`;
      }).join('') || '<div class="map-filter-empty">No hay agencias con coordenadas.</div>';
      list.querySelectorAll('input[data-map-group]').forEach(input => {
        input.addEventListener('change', () => {
          const group = input.getAttribute('data-map-group');
          if(input.checked) agenciasMapSelectedGroups.add(group);
          else agenciasMapSelectedGroups.delete(group);
          agenciasMapGroupsExplicitNone = agenciasMapSelectedGroups.size === 0;
          const row = input.closest('.map-filter-row');
          if(row) row.classList.toggle('is-off', !input.checked);
          agencyMapScheduleRefresh({ fit:false });
        });
      });
    }

    function updateAgencyMapDashboard(source, visibleCount){
      renderAgencyTypeFilters(source);
      renderAgencyStateFilters(source);
      renderAgencyGroupFilters(source);
      const count = document.getElementById('mapFilterCount');
      const totalConCoords = (Array.isArray(source) ? source : []).filter(agencyHasCoords).length;
      if(count) count.textContent = `Mostrando ${visibleCount || 0} de ${totalConCoords} agencias`;
    }

    function agencyMapSelectAllTypes(){
      agenciasMapSelectedTypes = new Set(AGENCIAS_MAP_TYPE_OPTIONS.map(([value]) => value));
      agenciasMapTypeFiltersInitialized = true;
      agenciasMapTypesExplicitNone = false;
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapSelectNoTypes(){
      agenciasMapSelectedTypes.clear();
      agenciasMapTypeFiltersInitialized = true;
      agenciasMapTypesExplicitNone = true;
      const list = document.getElementById('agencyTypeFilterList');
      if(list) list.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapSelectAllStates(){
      agenciasMapSelectedStates = new Set(AGENCIAS_MAP_STATE_OPTIONS.map(([value]) => value));
      agenciasMapStateFiltersInitialized = true;
      agenciasMapStatesExplicitNone = false;
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapSelectNoStates(){
      agenciasMapSelectedStates.clear();
      agenciasMapStateFiltersInitialized = true;
      agenciasMapStatesExplicitNone = true;
      const list = document.getElementById('agencyStateFilterList');
      if(list) list.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapToggleGroup(group, checked){
      const clean = String(group || '').trim();
      if(!clean) return;
      if(checked) agenciasMapSelectedGroups.add(clean);
      else agenciasMapSelectedGroups.delete(clean);
      agenciasMapGroupsExplicitNone = agenciasMapSelectedGroups.size === 0;
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapSelectAllGroups(){
      agenciasMapGroupsExplicitNone = false;
      agenciaMapCurrentGroups(agenciasMapLastSource.length ? agenciasMapLastSource : agencias).forEach(([g]) => agenciasMapSelectedGroups.add(g));
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapSelectNoGroups(){
      agenciasMapSelectedGroups.clear();
      agenciasMapGroupsInitialized = true;
      agenciasMapGroupsExplicitNone = true;
      const list = document.getElementById('agencyGroupFilterList');
      if(list) list.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
      agencyMapScheduleRefresh({ fit:false });
    }

    function agencyMapStyle(){
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png','https://b.tile.openstreetmap.org/{z}/{x}/{y}.png','https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [
          { id: 'osm-bg', type: 'background', paint: { 'background-color': '#07111f' } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.94, 'raster-saturation': -0.12, 'raster-contrast': 0.08 } }
        ]
      };
    }

    function agregarCapasAgencias(){
      const map = agenciasMapInstance;
      if(!map || map.getSource('agencias')) return;

      map.addSource('agencias', {
        type: 'geojson',
        data: AGENCIAS_EMPTY_GEOJSON,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 18
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'agencias',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#0f766e', 10, '#2563eb', 40, '#7c3aed', 100, '#dc2626'],
          'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 40, 26, 100, 32],
          'circle-opacity': 0.90,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'agencias',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['to-string', ['get', 'point_count_abbreviated']],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['step', ['get', 'point_count'], 12, 40, 13, 100, 14],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#020617',
          'text-halo-width': 1.2
        }
      });

      map.addLayer({
        id: 'agencias-iconos-premium',
        type: 'symbol',
        source: 'agencias',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'icon_id'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.68, 10, 0.78, 12, 0.9, 14, 1.02, 16, 1.14, 18, 1.24],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });

      map.addLayer({
        id: 'agencias-labels',
        type: 'symbol',
        source: 'agencias',
        minzoom: 16,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['to-string', ['get', 'numero']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 17, 11, 18, 12],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.35],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

      map.on('click', 'clusters', async (e) => {
        const feature = e.features && e.features[0];
        if(!feature) return;
        const clusterId = feature.properties.cluster_id;
        const source = map.getSource('agencias');
        try{
          const result = source.getClusterExpansionZoom(clusterId);
          const zoom = typeof result?.then === 'function' ? await result : result;
          map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(zoom + 0.25, 18), duration: 550 });
        }catch(err){
          map.easeTo({ center: feature.geometry.coordinates, zoom: map.getZoom() + 2, duration: 450 });
        }
      });

      map.on('click', 'agencias-iconos-premium', (e) => abrirPopupAgencia(e));
      ['clusters','agencias-iconos-premium'].forEach(layerId => {
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      });
    }

    function agencyMapApplyLayerFilters(){
      const map = agenciasMapInstance;
      if(!map || !agenciasMapLoaded) return;
      const clusterFilter = ['has', 'point_count'];
      const pointFilter = ['!', ['has', 'point_count']];
      if(map.getLayer('clusters')) map.setFilter('clusters', clusterFilter);
      if(map.getLayer('cluster-count')) map.setFilter('cluster-count', clusterFilter);
      if(map.getLayer('agencias-iconos-premium')) map.setFilter('agencias-iconos-premium', pointFilter);
      if(map.getLayer('agencias-labels')) map.setFilter('agencias-labels', pointFilter);
    }

    function abrirPopupAgencia(e){
      const feature = e.features && e.features[0];
      if(!feature) return;
      const p = feature.properties || {};
      const coords = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates.slice() : [p.lng, p.lat];
      const lng = Number(p.lng || coords[0]);
      const lat = Number(p.lat || coords[1]);
      const numero = String(p.numero || '');
      const title = p.nombre ? `${p.numero} · ${p.nombre}` : `Agencia ${p.numero || ''}`;
      const html = `
        <div class="agency-popup agency-popup-maplibre">
          <strong>${mapEscapeHtml(title)}</strong>
          <span><b>Grupo:</b> ${mapEscapeHtml(p.grupo || 'Sin grupo')}</span>
          <span><b>Encargado:</b> ${mapEscapeHtml(p.encargado || 'Sin encargado')}</span>
          <span class="agency-status-line"><strong>Estado:</strong> <em>${mapEscapeHtml(p.estado_original || p.estado || 'Activa')}</em></span>
          <span><strong>Tipo:</strong> ${mapEscapeHtml(p.tipo_label || p.tipo_original || 'Agencia')}</span>
          ${p.direccion ? `<span>${mapEscapeHtml(p.direccion)}</span>` : ''}
          <div class="agency-popup-actions">
            <button type="button" class="agency-popup-btn" onclick="window.consultarAgenciaDesdeMapa ? window.consultarAgenciaDesdeMapa('${mapEscapeHtml(numero)}') : (window.verDetalleAgencia && window.verDetalleAgencia(${Number(p.index || -1)}))"><i class="fas fa-eye"></i> Consultar agencia</button>
            <button type="button" class="agency-popup-btn secondary" onclick="abrirUbicacionGoogleMaps(${lat}, ${lng})"><i class="fas fa-map-marker-alt"></i> Ver ubicación</button>
            <button type="button" class="agency-popup-btn secondary" onclick="abrirComoLlegarGoogleMaps(${lat}, ${lng})"><i class="fas fa-route"></i> Cómo llegar</button>
          </div>
        </div>`;

      new maplibregl.Popup({ closeButton:true, closeOnClick:true, maxWidth:'330px' })
        .setLngLat([lng, lat])
        .setHTML(html)
        .addTo(agenciasMapInstance);
    }

    function abrirUbicacionGoogleMaps(lat, lng){
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    function abrirComoLlegarGoogleMaps(lat, lng){
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    function agencyMapBoundsFromGeoJSON(geojson){
      const coords = (geojson?.features || []).map(f => f.geometry.coordinates).filter(Boolean);
      if(!coords.length) return null;
      let west = coords[0][0], east = coords[0][0], south = coords[0][1], north = coords[0][1];
      coords.forEach(([lng, lat]) => {
        west = Math.min(west, lng); east = Math.max(east, lng);
        south = Math.min(south, lat); north = Math.max(north, lat);
      });
      return [[west, south], [east, north]];
    }

    function agencyMapFocus(lat, lng){
      const map = ensureAgencyMap();
      if(map && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) map.easeTo({ center:[Number(lng), Number(lat)], zoom:17, duration:650 });
    }

    function ensureAgencyMap(){
      const el = document.getElementById('agenciasMap');
      if(!el || !window.maplibregl) return null;
      ensureAgencyMapDashboard(el);
      if(agenciasMapInstance){
        setTimeout(() => agenciasMapInstance.resize(), 80);
        return agenciasMapInstance;
      }

      agenciasMapInstance = new maplibregl.Map({
        container: 'agenciasMap',
        style: agencyMapStyle(),
        center: [-69.9312, 18.4861],
        zoom: 11.5,
        minZoom: 7,
        maxZoom: 19,
        attributionControl: false,
        fadeDuration: 0,
        renderWorldCopies: false,
        cooperativeGestures: false
      });
      window.agenciasMapInstance = agenciasMapInstance;
      window.agencyMap = agenciasMapInstance;

      agenciasMapInstance.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');
      agenciasMapInstance.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right');

      if(!document.getElementById('agenciasMapQuickPanel')){
        const quickPanel = document.createElement('div');
        quickPanel.id = 'agenciasMapQuickPanel';
        quickPanel.className = 'map-quick-panel';
        quickPanel.innerHTML = '<b>0</b><span>agencias visibles</span>';
        el.appendChild(quickPanel);
      }

      if('ResizeObserver' in window && !agenciasMapResizeObserver){
        agenciasMapResizeObserver = new ResizeObserver(() => {
          if(agenciasMapInstance) agenciasMapInstance.resize();
        });
        agenciasMapResizeObserver.observe(el);
      }

      agenciasMapInstance.on('load', () => {
        agenciasMapLoaded = true;
        agregarCapasAgencias();
        agencyMapRefresh(agenciasMapLastSource.length ? agenciasMapLastSource : (typeof agencias !== 'undefined' ? agencias : []), { fit:agenciasMapPendingFit });
        setTimeout(() => agenciasMapInstance.resize(), 100);
        setTimeout(() => agenciasMapInstance.resize(), 450);
      });

      requestAnimationFrame(() => {
        agenciasMapInstance.resize();
        setTimeout(() => agenciasMapInstance.resize(), 250);
        setTimeout(() => agenciasMapInstance.resize(), 900);
      });
      return agenciasMapInstance;
    }

    function agencyMapClear(){
      const map = agenciasMapInstance;
      if(map && map.getSource('agencias')) map.getSource('agencias').setData(AGENCIAS_EMPTY_GEOJSON);
    }

    function agencyMapRefresh(list, options = {}){
      const map = ensureAgencyMap();
      const source = Array.isArray(list) ? list : (typeof agencias !== 'undefined' ? agencias : []);
      agenciasMapLastSource = source;
      const fit = options.fit !== false;
      agenciasMapPendingFit = fit;

      const filteredSource = source.filter(a => agencyHasCoords(a) && agencyMapMatchesFilter(a));
      const geojson = convertirAgenciasAGeoJSON(filteredSource);
      agencyMapDebug('Mapa agencias', { total: source.length, visibles: geojson.features.length });
      updateAgencyMapDashboard(source, geojson.features.length);

      const status = document.getElementById('agenciasMapStatus');
      if(status) status.textContent = geojson.features.length ? `${geojson.features.length} agencia(s) visibles con los filtros actuales.` : 'No hay agencias visibles con los filtros actuales.';
      const quickPanel = document.getElementById('agenciasMapQuickPanel');
      if(quickPanel) quickPanel.innerHTML = `<b>${geojson.features.length}</b><span>agencias visibles</span>`;

      if(!map || !agenciasMapLoaded || !map.getSource('agencias')) return;
      const renderKey = JSON.stringify({
        fit,
        search: agenciasMapSearchText,
        grupos: [...agenciasMapSelectedGroups].sort(),
        tipos: [...agenciasMapSelectedTypes].sort(),
        estados: [...agenciasMapSelectedStates].sort(),
        features: geojson.features.map(f => [f.properties.numero, f.properties.grupo, f.properties.tipo, f.properties.estado, f.geometry.coordinates[0], f.geometry.coordinates[1]])
      });
      if(renderKey === agenciasMapLastRenderKey && !fit){
        return;
      }
      agenciasMapLastRenderKey = renderKey;
      asegurarIconosAgencias(map, geojson);
      map.getSource('agencias').setData(geojson);
      agencyMapApplyLayerFilters();
      requestAnimationFrame(() => map.resize());

      if(fit){
        const bounds = agencyMapBoundsFromGeoJSON(geojson);
        if(bounds){
          if(geojson.features.length === 1) map.easeTo({ center: geojson.features[0].geometry.coordinates, zoom: 16, duration: 500 });
          else map.fitBounds(bounds, { padding: 72, maxZoom: 16, duration: 600 });
        }
      }
    }

    function toggleAgencyMapFullscreen(){
      const mapEl = document.getElementById('agenciasMap');
      const card = mapEl ? mapEl.closest('.agency-map-card') : null;
      if(!card) return;
      if(!document.fullscreenElement){
        const req = card.requestFullscreen || card.webkitRequestFullscreen || card.msRequestFullscreen;
        if(req) req.call(card);
      }else{
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if(exit) exit.call(document);
      }
      setTimeout(() => { if(agenciasMapInstance) agenciasMapInstance.resize(); }, 180);
      setTimeout(() => { if(agenciasMapInstance) agencyMapFitAll(); }, 420);
    }
    if(!window.__lotekaAgencyFullscreenListener){
      window.__lotekaAgencyFullscreenListener = true;
      document.addEventListener('fullscreenchange', () => {
        setTimeout(() => { if(agenciasMapInstance) agenciasMapInstance.resize(); }, 120);
        setTimeout(() => { if(agenciasMapInstance) agencyMapFitAll(); }, 300);
      });
    }

    function agencyMapFitAll(){ agencyMapRefresh(agencyMapActiveSource(), { fit:true }); }

    function normalizeBackendCeroAgencyDoc(doc){
      if(!doc) return null;
      return {
        backendCeroId: doc.$id || doc.backendCeroId || '',
        numero: Number(doc.numero || doc.codigo || doc.agencia || 0),
        nombre: doc.nombre || (doc.numero ? `Agencia ${String(doc.numero).padStart(4,'0')}` : 'Agencia'),
        grupo: doc.grupo || 'Grupo 00',
        encargado: doc.encargado || doc.responsable || 'Sin encargado',
        direccion: doc.direccion || doc.ubicacion || doc.nombre || '',
        latitud: agencyToFloat(doc.latitud ?? doc.lat ?? doc.latitude),
        longitud: agencyToFloat(doc.longitud ?? doc.lng ?? doc.lon ?? doc.longitude),
        equipos: Array.isArray(doc.equipos) ? doc.equipos : []
      };
    }

    function buildBackendCeroAgencyPayload(agencia){
      return {
        numero: String(agencia.numero || '').trim(),
        nombre: agencia.nombre || `Agencia ${String(agencia.numero || '').padStart(4,'0')}`,
        grupo: agencia.grupo || 'Grupo 00',
        encargado: agencia.encargado || 'Sin encargado',
        direccion: agencia.direccion || agencia.nombre || '',
        latitud: agencyToFloat(agencia.latitud),
        longitud: agencyToFloat(agencia.longitud)
      };
    }

    async function syncAgenciesFromBackendCero(){
      if(agenciasMapSyncInFlight){
        agenciasMapSyncPending = true;
        return;
      }
      agenciasMapSyncInFlight = true;
      try{
        const data = await backendCeroDatabases.listDocuments(
          BACKEND_CERO_DATABASE_ID,
          BACKEND_CERO_AGENCIAS_COLLECTION_ID,
          [backendCeroQuery.limit(500)]
        );
        const docs = (data.documents || []).map(normalizeBackendCeroAgencyDoc).filter(Boolean).filter(a => a.numero);
        let changed = false;
        docs.forEach(remote => {
          const idx = agencias.findIndex(a => String(Number(a.numero)) === String(Number(remote.numero)));
          if(idx >= 0){
            const merged = {...agencias[idx], ...remote, equipos: agencias[idx].equipos || remote.equipos || []};
            const before = JSON.stringify({n:agencias[idx].numero,g:agencias[idx].grupo,e:agencias[idx].encargado,lat:agencias[idx].latitud,lng:agencias[idx].longitud,estado:agencias[idx].estado,tipo:agencias[idx].tipoAgencia || agencias[idx].tipo});
            const after = JSON.stringify({n:merged.numero,g:merged.grupo,e:merged.encargado,lat:merged.latitud,lng:merged.longitud,estado:merged.estado,tipo:merged.tipoAgencia || merged.tipo});
            agencias[idx] = merged;
            if(before !== after) changed = true;
          }else{
            agencias.push(remote);
            changed = true;
          }
        });
        if(changed){
          agencias.sort((a,b) => Number(a.numero) - Number(b.numero));
          renderAgencias();
        }else{
          agencyMapScheduleRefresh({ fit:false });
        }
      }catch(error){
        console.warn('Agencias BackendCero no sincronizadas:', error);
        agencyMapScheduleRefresh({ fit:false });
      }finally{
        agenciasMapSyncInFlight = false;
        if(agenciasMapSyncPending){
          agenciasMapSyncPending = false;
          setTimeout(syncAgenciesFromBackendCero, 350);
        }
      }
    }

    async function syncAgencyToBackendCero(agencia){
      try{
        if(!agencia) return;
        const payload = buildBackendCeroAgencyPayload(agencia);
        const existing = await backendCeroDatabases.listDocuments(
          BACKEND_CERO_DATABASE_ID,
          BACKEND_CERO_AGENCIAS_COLLECTION_ID,
          [backendCeroQuery.equal('numero', payload.numero), backendCeroQuery.limit(1)]
        );
        let saved;
        if(existing.documents && existing.documents.length){
          saved = await backendCeroDatabases.updateDocument(BACKEND_CERO_DATABASE_ID, BACKEND_CERO_AGENCIAS_COLLECTION_ID, existing.documents[0].$id, payload);
        }else{
          saved = await backendCeroDatabases.createDocument(BACKEND_CERO_DATABASE_ID, BACKEND_CERO_AGENCIAS_COLLECTION_ID, BackendCero.ID.unique(), payload);
        }
        agencia.backendCeroId = saved.$id;
        console.info('Agencia sincronizada con BackendCero:', payload.numero);
      }catch(error){
        console.warn('No se pudo sincronizar agencia con BackendCero:', error);
      }
    }

    function initAgenciesRealtime(){
      try{
        if(agenciasMapRealtimeStarted) return;
        agenciasMapRealtimeStarted = true;
        const channel = `databases.${BACKEND_CERO_DATABASE_ID}.collections.${BACKEND_CERO_AGENCIAS_COLLECTION_ID}.documents`;
        agenciasMapRealtimeUnsubscribe = backendCeroClient.subscribe(channel, () => {
          clearTimeout(window.__lotekaAgencyRealtimeTimer);
          window.__lotekaAgencyRealtimeTimer = setTimeout(syncAgenciesFromBackendCero, 450);
        });
        agencyMapDebug('Realtime BackendCero activo para agencias');
      }catch(error){
        agenciasMapRealtimeStarted = false;
        console.warn('No se pudo activar realtime de agencias:', error);
      }
    }

    window.addEventListener('DOMContentLoaded', () => {
      if(agenciasMapBootStarted) return;
      agenciasMapBootStarted = true;
      setTimeout(() => { agencyMapRefresh(); syncAgenciesFromBackendCero(); initAgenciesRealtime(); }, 500);
    });

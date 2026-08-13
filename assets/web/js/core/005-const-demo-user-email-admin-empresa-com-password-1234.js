
    // Compatibilidad legacy: la identidad real proviene exclusivamente de Supabase Auth.
    const DEFAULT_USERS = [];
    const LEGACY_DEMO_USERNAMES = new Set(['tecnico1', 'tecnico2', 'encargado1']);

    const DEFAULT_SUPPLIERS = [
      { name: 'E-Gret Servicios', service: 'Publicidad', phone: '' },
      { name: 'Toldos RD', service: 'Toldos', phone: '' },
      { name: 'AC Solutions', service: 'Aire acondicionado', phone: '' }
    ];

    const DEFAULT_WORK_TYPES = [
      { name: 'Trabajo a agencia nueva', description: 'Activa estado operativo: En construcción' },
      { name: 'Remodelación a agencia', description: 'Activa estado operativo: Remodelación' },
      { name: 'Pintura', description: 'Realización de pintura en las agencias' },
      { name: 'Mantenimiento de Aire Acondicionado', description: 'Limpieza preventiva y reparación de avería' },
      { name: 'Instalación de Aire Acondicionado', description: 'Instalación de consola y compresor' },
      { name: 'Reparación de Filtraciones y Renovación', description: 'Solución de filtraciones y renovación general' },
      { name: 'Renovación de Pintura y Corrección de Piso y Mocheta', description: 'Remodelación' },
      { name: 'Renovación y Pintura', description: 'En agencia' },
      { name: 'Fabricación de Letrero (ACM)', description: 'Toldo nuevo en ACM' },
      { name: 'Instalación de publicidad en pecho (ACM)', description: 'Publicidad en mostrador' },
      { name: 'Fabricación de toldo', description: 'Fabricación de toldo desde 0' },
      { name: 'Reparación de toldo', description: 'Reparación de toldo' }
    ];

    const DEFAULT_ISSUE_TYPES = [
      { name: 'Falla de internet', description: 'Interrupción o lentitud en la conectividad' },
      { name: 'Printer dañado', description: 'Impresora con falla o sin imprimir' },
      { name: 'Escáner dañado', description: 'Escáner sin funcionamiento correcto' },
      { name: 'TV dañada', description: 'Pantalla o televisor con avería' },
      { name: 'POS con falla', description: 'Terminal POS con errores o inoperante' },
      { name: 'Cable de red dañado', description: 'Cableado de red defectuoso' },
      { name: 'Cámara averiada', description: 'Sistema de cámara con falla' },
      { name: 'Teléfono averiado', description: 'Teléfono interno con fallo' },
      { name: 'Punto eléctrico con falla', description: 'Problema eléctrico en punto de conexión' },
      { name: 'Aire acondicionado averiado', description: 'Unidad de aire con falla' }
    ];

    function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

    function normalizeNamedCatalog(arr, fallback, descriptionKey = 'description') {
      if (!Array.isArray(arr)) return deepClone(fallback);
      const normalized = arr.map(item => {
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name, [descriptionKey]: '' } : null;
        }
        if (item && typeof item === 'object') {
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          const extra = typeof item[descriptionKey] === 'string' ? item[descriptionKey].trim() : '';
          const phone = typeof item.phone === 'string' ? item.phone.trim() : '';
          const id = typeof item.id === 'string' ? item.id : '';
          const category = typeof item.category === 'string' ? item.category.trim() : '';
          const requiresEvidence = Boolean(item.requiresEvidence);
          const order = Number.isFinite(Number(item.order)) ? Number(item.order) : 0;
          const active = item.active !== false;
          return name ? { id, name, [descriptionKey]: extra, phone, category, requiresEvidence, order, active } : null;
        }
        return null;
      }).filter(Boolean);
      const deduped = [];
      const seen = new Set();
      for (const item of normalized) {
        const key = item.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }
      return deduped.length ? deduped : deepClone(fallback);
    }

    function slugifyUsername(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
    }

    function normalizeUsersCatalog(arr, fallback) {
      const source = Array.isArray(arr) ? arr : deepClone(fallback);
      const normalized = source.map(item => {
        if (!item || typeof item !== 'object') return null;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) return null;
        const username = slugifyUsername(item.username || item.user || name);
        const area = typeof item.area === 'string' ? item.area.trim() : '';
        const phone = typeof item.phone === 'string' ? item.phone.trim() : '';
        return { name, username, area, phone };
      }).filter(Boolean);

      const required = deepClone(fallback).map(item => ({
        name: item.name,
        username: slugifyUsername(item.username || item.name),
        area: item.area || '',
        phone: item.phone || ''
      }));

      const merged = [...normalized];
      const seen = new Set(merged.map(item => item.username));
      required.forEach(item => {
        if (!seen.has(item.username)) {
          merged.push(item);
          seen.add(item.username);
        }
      });
      return merged.length ? merged : required;
    }

    function loadCatalogs() {
      const users = normalizeUsersCatalog(JSON.parse(localStorage.getItem('operations_catalog_users') || 'null'), DEFAULT_USERS)
        .filter(item => !LEGACY_DEMO_USERNAMES.has(slugifyUsername(item?.username || item?.name)));
      const suppliers = normalizeNamedCatalog(JSON.parse(localStorage.getItem('operations_catalog_suppliers') || 'null'), DEFAULT_SUPPLIERS, 'service');
      const works = normalizeNamedCatalog(JSON.parse(localStorage.getItem('operations_catalog_work_types') || 'null'), DEFAULT_WORK_TYPES, 'description');
      const issues = normalizeNamedCatalog(JSON.parse(localStorage.getItem('operations_catalog_issue_types') || 'null'), DEFAULT_ISSUE_TYPES, 'description');
      localStorage.setItem('operations_catalog_users', JSON.stringify(users));
      localStorage.setItem('operations_catalog_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('operations_catalog_work_types', JSON.stringify(works));
      localStorage.setItem('operations_catalog_issue_types', JSON.stringify(issues));
      return { users, suppliers, works, issues };
    }

    let { users: USERS, suppliers: SUPPLIERS, works: WORK_TYPES, issues: ISSUE_TYPES } = loadCatalogs();

    function saveCatalogs() {
      localStorage.setItem('operations_catalog_users', JSON.stringify(USERS));
      localStorage.setItem('operations_catalog_suppliers', JSON.stringify(SUPPLIERS));
      localStorage.setItem('operations_catalog_work_types', JSON.stringify(WORK_TYPES));
      localStorage.setItem('operations_catalog_issue_types', JSON.stringify(ISSUE_TYPES));
      try { populateAdvancedReportDropdowns(); } catch (_error) {}
    }


    const OPERATION_CATALOG_TABLE = 'catalogo_tipos_operacion';
    const OPERATION_CATALOG_MIGRATION_KEY = 'operations_catalog_cloud_migrated_v1';
    let operationCatalogSyncPromise = null;

    function operationCatalogClient() {
      return window.lotekaSupabase || window.supabaseClient || null;
    }

    function mapCloudCatalogRow(row) {
      return {
        id: String(row?.id || ''),
        name: String(row?.nombre || '').trim(),
        description: String(row?.descripcion || '').trim(),
        category: String(row?.categoria || 'General').trim(),
        requiresEvidence: Boolean(row?.requiere_evidencia),
        order: Number.isFinite(Number(row?.orden)) ? Number(row.orden) : 0,
        active: row?.activo !== false
      };
    }

    async function migrateLocalOperationCatalogs(client) {
      if (localStorage.getItem(OPERATION_CATALOG_MIGRATION_KEY) === '1') return true;
      const items = [
        ...(Array.isArray(ISSUE_TYPES) ? ISSUE_TYPES.map(item => ({...item, type:'Avería'})) : []),
        ...(Array.isArray(WORK_TYPES) ? WORK_TYPES.map(item => ({...item, type:'Trabajo'})) : [])
      ].filter(item => item.name);
      try {
        const current = await client.from(OPERATION_CATALOG_TABLE).select('tipo,nombre');
        if (current.error) throw current.error;
        const existing = new Set((current.data || []).map(row => `${row.tipo}::${String(row.nombre || '').trim().toLowerCase()}`));
        const missingItems = items.filter(item => !existing.has(`${item.type}::${String(item.name || '').trim().toLowerCase()}`));
        for (let index = 0; index < missingItems.length; index += 1) {
          const item = missingItems[index];
          const response = await client.rpc('rpc_admin_guardar_tipo_operacion', {
            p_id: null,
            p_tipo: item.type,
            p_nombre: item.name,
            p_descripcion: item.description || '',
            p_categoria: item.category || 'General',
            p_prioridad_sugerida: null,
            p_requiere_evidencia: Boolean(item.requiresEvidence),
            p_orden: Number(item.order || existing.size + index + 1),
            p_activo: item.active !== false
          });
          if (response.error) throw response.error;
        }
        localStorage.setItem(OPERATION_CATALOG_MIGRATION_KEY, '1');
        return true;
      } catch (error) {
        console.warn('[Catálogo operaciones] No se migró el catálogo local. Se conservará como respaldo.', error);
        return false;
      }
    }

    async function syncOperationCatalogsFromSupabase(options = {}) {
      if (operationCatalogSyncPromise && !options.force) return operationCatalogSyncPromise;
      operationCatalogSyncPromise = (async () => {
        const client = operationCatalogClient();
        if (!client) return false;
        if (options.migrate !== false) await migrateLocalOperationCatalogs(client);
        const response = await client
          .from(OPERATION_CATALOG_TABLE)
.select('id,tipo,nombre,descripcion,categoria,requiere_evidencia,orden,activo')
          .eq('activo', true)
          .order('tipo', {ascending:true})
          .order('orden', {ascending:true})
          .order('nombre', {ascending:true});
        if (response.error) throw response.error;
        const rows = response.data || [];
        const works = rows.filter(row => row.tipo === 'Trabajo').map(mapCloudCatalogRow).filter(item => item.name);
        const issues = rows.filter(row => row.tipo === 'Avería').map(mapCloudCatalogRow).filter(item => item.name);
        if (works.length) WORK_TYPES = works;
        if (issues.length) ISSUE_TYPES = issues;
        saveCatalogs();
        refreshOpenTypeSelectors();
        populateReportSpecificTypeOptions();
        renderCurrentCatalogView();
        return true;
      })().catch(error => {
        console.warn('[Catálogo operaciones] No se pudo sincronizar con Supabase. Se usará el respaldo local.', error);
        return false;
      }).finally(() => { operationCatalogSyncPromise = null; });
      return operationCatalogSyncPromise;
    }

    async function saveCloudOperationCatalogItem(type, item) {
      const client = operationCatalogClient();
      if (!client) throw new Error('Supabase todavía no está disponible. Intenta nuevamente en unos segundos.');
      const response = await client.rpc('rpc_admin_guardar_tipo_operacion', {
        p_id: item.id || null,
        p_tipo: type === 'work' ? 'Trabajo' : 'Avería',
        p_nombre: item.name,
        p_descripcion: item.description || '',
        p_categoria: item.category || 'General',
        p_prioridad_sugerida: null,
        p_requiere_evidencia: Boolean(item.requiresEvidence),
        p_orden: Number(item.order || 0),
        p_activo: true
      });
      if (response.error) throw response.error;
      localStorage.setItem(OPERATION_CATALOG_MIGRATION_KEY, '1');
      await syncOperationCatalogsFromSupabase({force:true,migrate:false});
      return response.data;
    }

    async function deactivateCloudOperationCatalogItem(item) {
      if (!item?.id) throw new Error('El elemento todavía no está sincronizado con Supabase. Actualiza los datos y vuelve a intentar.');
      const client = operationCatalogClient();
      if (!client) throw new Error('Supabase todavía no está disponible.');
      const response = await client.rpc('rpc_admin_desactivar_tipo_operacion', {p_id:item.id});
      if (response.error) throw response.error;
      await syncOperationCatalogsFromSupabase({force:true,migrate:false});
    }

    window.syncOperationCatalogsFromSupabase = syncOperationCatalogsFromSupabase;

    function ensureOperationalWorkTypes() {
      const required = [
        { name: 'Trabajo a agencia nueva', description: 'Activa estado operativo: En construcción' },
        { name: 'Remodelación a agencia', description: 'Activa estado operativo: Remodelación' }
      ];
      let changed = false;
      if (!Array.isArray(WORK_TYPES)) WORK_TYPES = [];

      WORK_TYPES = WORK_TYPES.map(item => {
        if (typeof item === 'string') return { name: item.trim(), description: '' };
        if (!item || typeof item !== 'object') return null;
        return {
          name: String(item.name || '').trim(),
          description: String(item.description || '').trim()
        };
      }).filter(item => item && item.name);

      required.slice().reverse().forEach(item => {
        const index = WORK_TYPES.findIndex(w => String(w && w.name || '').trim().toLowerCase() === item.name.toLowerCase());
        if (index === -1) {
          WORK_TYPES.unshift(item);
          changed = true;
        } else {
          WORK_TYPES[index] = { ...WORK_TYPES[index], description: item.description };
          if (index > 0) {
            const current = WORK_TYPES.splice(index, 1)[0];
            WORK_TYPES.unshift(current);
            changed = true;
          }
        }
      });

      const seen = new Set();
      WORK_TYPES = WORK_TYPES.filter(item => {
        const key = String(item.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) {
          changed = true;
          return false;
        }
        seen.add(key);
        return true;
      });

      if (changed) saveCatalogs();
    }
    ensureOperationalWorkTypes();

    const ASSIGNEE_DISPLAY_BY_USERNAME = Object.freeze({});

    function findUserByUsername(username) {
      const normalized = slugifyUsername(username);
      return USERS.find(item => slugifyUsername(item.username) === normalized) || null;
    }

    function normalizeStoredAssignee(value, type = 'Avería') {
      const raw = String(value || '').trim();
      if (!raw || raw.toLowerCase() === 'sin asignar') return 'Sin asignar';
      if (type === 'Trabajo') return raw;
      const normalized = slugifyUsername(raw);
      const user = findUserByUsername(normalized) || USERS.find(item => slugifyUsername(item.name) === normalized);
      if (user) return user.username;
      if (ASSIGNEE_DISPLAY_BY_USERNAME[normalized]) return normalized;
      return raw;
    }

    function getAssigneeDisplayName(value, type = 'Avería') {
      const raw = String(value || '').trim();
      if (!raw || raw.toLowerCase() === 'sin asignar') return 'Sin asignar';
      if (type === 'Trabajo') return raw;
      const normalized = normalizeStoredAssignee(raw, type);
      const user = findUserByUsername(normalized);
      if (user?.name) return user.name;
      return ASSIGNEE_DISPLAY_BY_USERNAME[slugifyUsername(normalized)] || raw;
    }

    function getPushUsername(value) {
      const raw = String(value || '').trim();
      if (!raw || raw.toLowerCase() === 'sin asignar') return '';
      return slugifyUsername(raw);
    }

    async function sendPushToUsername(username, title, body, url = '/app.html') {
      const cleanUsername = getPushUsername(username);
      if (!cleanUsername) return null;
      // La entrega Web Push queda cerrada hasta que el backend disponga de un
      // resolver verificado username -> PushSubscription. Las notificaciones
      // internas y Realtime continúan siendo la vía activa del sistema.
      return {
        ok: false,
        skipped: true,
        code: 'PUSH_SUBSCRIPTION_RESOLVER_NOT_CONFIGURED',
        username: cleanUsername,
        title: String(title || ''),
        body: String(body || ''),
        url: String(url || '/app.html')
      };
    }

    function triggerOperationPushNotifications(previousOp, nextOp) {
      try {
        const previousStatus = canonicalOperationStatus(previousOp?.status);
        const nextStatus = canonicalOperationStatus(nextOp?.status);
        const previousTechnician = getPushUsername(previousOp?.technician || '');
        const nextTechnician = getPushUsername(nextOp?.technician || '');
        const encargado = getPushUsername(nextOp?.nombre_encargado || nextOp?.created_by || '');
        const operationCode = nextOp?.code || 'Operación';
        const operationPlace = String(nextOp?.agency || nextOp?.grupo || 'tu zona').trim();
        const assigneeLabel = getAssigneeDisplayName(nextOp?.technician || '', nextOp?.type || 'Avería');

        const statusChanged = previousStatus !== nextStatus;
        const technicianChanged = previousTechnician !== nextTechnician;
        const hasTechnician = !!nextTechnician;

        if (hasTechnician && technicianChanged) {
          void sendPushToUsername(
            nextTechnician,
            'Nueva asignación',
            `${operationCode} te fue asignada para ${operationPlace}.`
          );
        }

        if (encargado && hasTechnician && technicianChanged) {
          void sendPushToUsername(
            encargado,
            'Operación asignada',
            `${operationCode} fue asignada a ${assigneeLabel}.`
          );
        }

        if (encargado && statusChanged && ['Asignado', 'En proceso', 'Completado', 'Resuelto por soporte remoto'].includes(nextStatus)) {
          let message = `${operationCode} cambió a estado ${nextStatus}.`;

          if (nextStatus === 'Asignado') {
            message = `${operationCode} quedó asignada a ${assigneeLabel}.`;
          } else if (nextStatus === 'En proceso') {
            message = `${operationCode} ya está en proceso en ${operationPlace}.`;
          } else if (nextStatus === 'Completado' || nextStatus === 'Resuelto por soporte remoto') {
            message = `${operationCode} fue cerrada en ${operationPlace} (${nextStatus}).`;
          }

          void sendPushToUsername(
            encargado,
            'Cambio de estado',
            message
          );
        }
      } catch (error) {
        console.error('[PUSH_TRIGGER_ERROR]', error);
      }
    }

    function nowIso() { return new Date().toISOString(); }

    function getCurrentUserEmail() {
      const session = getSession();
      return session?.email || 'Sistema web';
    }

    function createHistoryEntry(actionOrConfig, detail = '', user = 'Sistema web') {
      const config = typeof actionOrConfig === 'object' && actionOrConfig !== null
        ? actionOrConfig
        : { action: actionOrConfig, detail, user };
      return {
        id: crypto.randomUUID(),
        action: config.action || '',
        detail: config.detail || '',
        user: config.user || 'Sistema web',
        prevStatus: config.prevStatus ?? null,
        newStatus: config.newStatus ?? null,
        timestamp: config.timestamp || nowIso()
      };
    }

    /*
      OPERACIONES / CAPA A3:
      No existe fallback de operaciones demo en producción. La fuente real es Supabase.
    */
    const demoOperations = [];


    const loginView = document.getElementById('loginView') || { classList: { add(){}, remove(){} } };
    const appView = document.getElementById('appView') || { classList: { add(){}, remove(){} } };
    const loginBtn = document.getElementById('loginBtn') || { addEventListener(){} };
    const loginError = document.getElementById('loginError') || { classList: { add(){}, remove(){} }, textContent: '' };
    const logoutBtn = document.getElementById('logoutBtn') || { addEventListener(){} };
    const userEmailLabel = document.getElementById('userEmailLabel') || { textContent: '' };
    const operationsTableBody = document.getElementById('operationsTableBody');
    const createModalBackdrop = document.getElementById('createModalBackdrop');
    const detailModalBackdrop = document.getElementById('detailModalBackdrop');
    const editModalBackdrop = document.getElementById('editModalBackdrop');
    const detailContent = document.getElementById('detailContent');
    const detailPrintBtn = document.getElementById('detailPrintBtn');
    let currentDetailOperationId = null;
    const createError = document.getElementById('createError');
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    const filterAgency = document.getElementById('filterAgency');
    const filterTech = document.getElementById('filterTech');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const reportFilterType = document.getElementById('reportFilterType');
    const reportFilterStatus = document.getElementById('reportFilterStatus');
    const reportFilterSpecificType = document.getElementById('reportFilterSpecificType');
    const reportFilterAgency = document.getElementById('reportFilterAgency');
    const reportFilterOwner = document.getElementById('reportFilterOwner');
    const reportFilterGroup = document.getElementById('reportFilterGroup');
    const reportFilterReporter = document.getElementById('reportFilterReporter');
        const reportFilterFrom = document.getElementById('reportFilterFrom');
    const reportFilterTo = document.getElementById('reportFilterTo');
    const reportFilterSummary = document.getElementById('reportFilterSummary');
    function isEncargadoUser(user) {
      const area = String(user?.area || '').toLowerCase();
      const username = slugifyUsername(user?.username || '');
      const name = String(user?.name || '').toLowerCase();
      return area.includes('encargado') || username.includes('encargado') || name.includes('encargado');
    }

    function isTechnicianUser(user) {
      const area = String(user?.area || '').toLowerCase();
      const username = slugifyUsername(user?.username || '');
      const name = String(user?.name || '').toLowerCase();
      return area.includes('tecnico') || area.includes('técnico') || area.includes('soporte') || area.includes('taller') || username.includes('tecnico') || name.includes('tecnico') || name.includes('técnico');
    }

    function getEncargadoUsers() {
      return (USERS || []).filter(isEncargadoUser);
    }

    function getTechnicalUsers() {
      const candidates = (USERS || []).filter(user => isTechnicianUser(user) && !isEncargadoUser(user));
      const seen = new Set();
      return candidates.filter(user => {
        const key = slugifyUsername(user?.username || user?.name || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getAssignableOwnerOptions() {
      return getTechnicalUsers().map(user => ({ value: user.username, label: user.name }));
    }

    function populateAdvancedReportDropdowns() {
      if (reportFilterOwner) {
        const current = reportFilterOwner.value;
        const options = getAssignableOwnerOptions();
        reportFilterOwner.innerHTML = '<option value="">Todos los técnicos</option>' + options.map(item => `\n<option value="${item.value}">${item.label}</option>`).join('');
        reportFilterOwner.value = options.some(item => item.value === current) ? current : '';
      }
      if (reportFilterReporter) {
        const current = reportFilterReporter.value;
        const options = getEncargadoUsers();
        reportFilterReporter.innerHTML = '<option value="">Todos los encargados</option>' + options.map(item => `\n<option value="${item.username}">${item.name}</option>`).join('');
        reportFilterReporter.value = options.some(item => item.username === current) ? current : '';
      }
    }
    const agencyReportFilterType = document.getElementById('agencyReportFilterType');
    const agencyReportFilterStatus = document.getElementById('agencyReportFilterStatus');
    const agencyReportFilterAgency = document.getElementById('agencyReportFilterAgency');
    const agencyReportFilterFrom = document.getElementById('agencyReportFilterFrom');
    const agencyReportFilterTo = document.getElementById('agencyReportFilterTo');
    const ownerReportFilterType = document.getElementById('ownerReportFilterType');
    const ownerReportFilterStatus = document.getElementById('ownerReportFilterStatus');
    const ownerReportFilterOwner = document.getElementById('ownerReportFilterOwner');
    const ownerReportFilterFrom = document.getElementById('ownerReportFilterFrom');
    const ownerReportFilterTo = document.getElementById('ownerReportFilterTo');
    const specificReportFilterType = document.getElementById('specificReportFilterType');
    const specificReportFilterSpecificType = document.getElementById('specificReportFilterSpecificType');
    const specificReportFilterStatus = document.getElementById('specificReportFilterStatus');
    const specificReportFilterFrom = document.getElementById('specificReportFilterFrom');
    const specificReportFilterTo = document.getElementById('specificReportFilterTo');
    const historyFilterSearch = document.getElementById('historyFilterSearch');
    const historyFilterAction = document.getElementById('historyFilterAction');
    const historyFilterUser = document.getElementById('historyFilterUser');
    const historyFilterFrom = document.getElementById('historyFilterFrom');
    const historyFilterTo = document.getElementById('historyFilterTo');
    const userSearch = document.getElementById('userSearch');
    const supplierSearch = document.getElementById('supplierSearch');
    const workSearch = document.getElementById('workSearch');
    const issueSearch = document.getElementById('issueSearch');

 function loadOperations() {
  /*
    OPERACIONES / CAPA A2 - Paso 1:
    Operaciones ya no cargan desde localStorage ni demoOperations.
    La fuente real debe ser Supabase; esta función queda como memoria segura
    para compatibilidad con renderOperations(), reportes y Realtime.
  */
  try {
    if (Array.isArray(window.operations)) {
      return window.operations.map(item => enrichOperationWithAgencyContext(item));
    }
  } catch (_error) {}

  try {
    if (typeof operations !== 'undefined' && Array.isArray(operations)) {
      return operations.map(item => enrichOperationWithAgencyContext(item));
    }
  } catch (_error) {}

  return [];
}

function saveOperations(operations) {
  /*
    OPERACIONES / CAPA A2 - Paso 1:
    No guardar operaciones reales ni demo en localStorage.
    Se conserva como wrapper en memoria porque Realtime/Supabase aún lo usa
    para refrescar UI, reportes y dashboards.
  */
  const normalized = Array.isArray(operations)
    ? operations.map(item => enrichOperationWithAgencyContext(item))
    : [];

  try { window.operations = normalized; } catch (_error) {}

  try {
    if (typeof window !== 'undefined') {
      window.__lotekaOperationsMemory = normalized;
    }
  } catch (_error) {}

  return normalized;
}

    function getSession() {
      const authState = window.lotekaAuthState || {};
      const user = authState.user || authState.session?.user || null;
      if (!user) return null;
      const email = String(user.email || authState.perfil?.correo || authState.profile?.correo || '').trim();
      return { email: email || 'Usuario autenticado', userId: user.id || '' };
    }
    function setSession() {
      // Eliminado: production no mantiene una segunda sesión local paralela a Supabase Auth.
      return getSession();
    }
    function clearSession() {
      // Limpia únicamente cualquier residuo histórico; Supabase Auth sigue siendo la autoridad.
      try { localStorage.removeItem('operations_session'); } catch (_error) {}
      return null;
    }
    clearSession();

    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function canonicalOperationStatus(status) {
      try {
        const shared = window.GOApp?.operations?.status?.normalizeOperationStatus;
        if (typeof shared === 'function') return shared(status);
      } catch (_error) {}
      const value = String(status || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (value.includes('soporte') || value.includes('remot')) return 'Resuelto por soporte remoto';
      if (value.includes('incid')) return 'En incidencia';
      if (value.includes('complet') || value.includes('cerrad') || value.includes('finaliz') || value === 'resuelto' || value === 'resuelta') return 'Completado';
      if (value.includes('proceso') || value.includes('inici') || value === 'en ruta') return 'En proceso';
      if (value.includes('asign')) return 'Asignado';
      return 'Reportado';
    }

    function isOperationTerminalStatus(status) {
      try {
        const shared = window.GOApp?.operations?.status?.isTerminalOperationStatus;
        if (typeof shared === 'function') return shared(status);
      } catch (_error) {}
      return ['Completado', 'Resuelto por soporte remoto'].includes(canonicalOperationStatus(status));
    }

    function normalizeRemoteStatus(status) {
      return canonicalOperationStatus(status);
    }

    function getOperationLocation(op = {}) {
      const normalized = enrichOperationWithAgencyContext(op);
      const agency = String(normalized.agency || '').trim();
      const grupo = String(normalized.grupo || '').trim();
      if (agency && grupo) return `${agency} · ${grupo}`;
      return agency || grupo || 'No registrado';
    }

    function getCurrentOperationUserDisplayName(){
      try{
        const st = window.lotekaAuthState || {};
        const perfil = st.perfil || {};
        const user = st.user || {};
        return String(
          perfil.nombre_completo ||
          perfil.nombre ||
          perfil.name ||
          perfil.display_name ||
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email ||
          getCurrentUserEmail?.() ||
          'Sistema web'
        ).trim();
      }catch(_e){
        try{ return String(getCurrentUserEmail?.() || 'Sistema web').trim(); }catch(__e){ return 'Sistema web'; }
      }
    }

    function getOperationReporter(op = {}) {
      return String(
        op.reportado_por_nombre ||
        op.reportado_por ||
        op.created_by_name ||
        op.created_by ||
        op.creado_por ||
        op.usuario_creador ||
        op.encargado ||
        op.nombre_encargado ||
        ''
      ).trim() || 'No registrado';
    }

    function getOperationSourceLabel(op = {}) {
      const source = String(op.source || '').trim().toLowerCase();
      if (source === 'app_movil') return 'App móvil';
      if (source === 'web_operacional') return 'Web operacional';
      if (source === 'backendCero') return 'Modo local';
      return source ? source : 'No registrado';
    }

    function operationHasAnyEvidence(op = {}) {
      const initial = Array.isArray(op.images) ? op.images.filter(Boolean).length : 0;
      const result = Array.isArray(op.resultImages) ? op.resultImages.filter(Boolean).length : 0;
      return initial + result > 0;
    }

    function operationMatchesEvidenceFilter(op = {}, evidenceValue = '') {
      const initial = Array.isArray(op.images) ? op.images.filter(Boolean).length : 0;
      const result = Array.isArray(op.resultImages) ? op.resultImages.filter(Boolean).length : 0;
      if (!evidenceValue) return true;
      if (evidenceValue === 'con_inicial') return initial > 0;
      if (evidenceValue === 'con_resultado') return result > 0;
      if (evidenceValue === 'sin_evidencia') return initial === 0 && result === 0;
      return true;
    }

    function renderReportFilterSummary(activeFilters = []) {
      if (!reportFilterSummary) return;
      if (!activeFilters.length) {
        reportFilterSummary.classList.add('empty');
        reportFilterSummary.innerHTML = 'Sin filtros avanzados activos.';
        return;
      }
      reportFilterSummary.classList.remove('empty');
      reportFilterSummary.innerHTML = activeFilters.map(item => `
        <span class="ops-report-filter-chip"><strong>${item.label}:</strong> ${item.value}</span>
      `).join('');
    }

    function getOperationSpecificTypes(op = {}) {
      if (Array.isArray(op.selectedTypes) && op.selectedTypes.length) return op.selectedTypes;
      return op.title ? [op.title] : [];
    }

    function getCatalogItems(type) {
      const source = type === 'Trabajo' ? WORK_TYPES : ISSUE_TYPES;
      let items = Array.isArray(source) ? source.map(item => {
        if (typeof item === 'string') return { name: item.trim(), description: '' };
        if (!item || typeof item !== 'object') return null;
        return {
          name: String(item.name || '').trim(),
          description: String(item.description || '').trim()
        };
      }).filter(item => item && item.name) : [];

      if (type === 'Trabajo') {
        const required = [
          { name: 'Trabajo a agencia nueva', description: 'Cuando la operación no está completada, la agencia pasa a En construcción.' },
          { name: 'Remodelación a agencia', description: 'Cuando la operación no está completada, la agencia pasa a Remodelación.' }
        ];
        required.slice().reverse().forEach(item => {
          const index = items.findIndex(entry => entry.name.toLowerCase() === item.name.toLowerCase());
          if (index === -1) items.unshift(item);
          else {
            const merged = { ...items[index], description: item.description || items[index].description || '' };
            items.splice(index, 1);
            items.unshift(merged);
          }
        });
      }

      const seen = new Set();
      return items.filter(item => {
        const key = item.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getCatalogNames(type) {
      return getCatalogItems(type).map(item => item.name).filter(Boolean);
    }

    function getSelectedValues(selectId) {
      const menu = document.getElementById(selectId + 'Menu');
      if (!menu) return [];
      return Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
    }

    function renderTypeOptions(selectId, operationType, selectedValues = []) {
      const menu = document.getElementById(selectId + 'Menu');
      const valueLabel = document.getElementById(selectId + 'Value');
      const options = getCatalogItems(operationType);
      if (!menu || !valueLabel) return;

      menu.innerHTML = `
        <div class="multi-select-menu-head">
          <div>
            <div class="multi-select-menu-title">${operationType === 'Trabajo' ? 'Selecciona los trabajos' : 'Selecciona las averías'}</div>
            <div class="multi-select-menu-sub">Puedes marcar varias opciones a la vez.</div>
          </div>
          <div class="multi-select-count" id="${selectId}Count">0 seleccionadas</div>
        </div>
      ` + options.map((item, index) => {
        const affectsState = operationType === 'Trabajo' && ['trabajo a agencia nueva','remodelación a agencia','remodelacion a agencia'].includes(item.name.toLowerCase());
        return `
          <label class="multi-option ${selectedValues.includes(item.name) ? 'checked' : ''}" for="${selectId}_${index}">
            <input type="checkbox" id="${selectId}_${index}" value="${item.name}" ${selectedValues.includes(item.name) ? 'checked' : ''} />
            <div class="multi-option-main">
              <div class="multi-option-title">
                <span>${item.name}</span>
                <span class="multi-option-badge badge-clasif">${operationType}</span>
                ${affectsState ? '<span class="multi-option-badge badge-estado">Cambia estado operativo</span>' : ''}
              </div>
              <div class="multi-option-desc">${item.description || (operationType === 'Trabajo' ? 'Trabajo operativo sin descripción adicional.' : 'Avería operativa sin descripción adicional.')}</div>
            </div>
          </label>
        `;
      }).join('');

            let searchWrap = menu.querySelector('.multi-select-search-wrap');
      if(!searchWrap){
        searchWrap = document.createElement('div');
        searchWrap.className = 'multi-select-search-wrap';
        searchWrap.innerHTML = `
          <i class="fas fa-search"></i>
          <input type="search" class="multi-select-search-input" placeholder="Buscar ${operationType === 'Trabajo' ? 'trabajo' : 'avería'}..." autocomplete="off">
        `;

        const head = menu.querySelector('.multi-select-menu-head');
        if(head && head.nextSibling){
          menu.insertBefore(searchWrap, head.nextSibling);
        }else{
          menu.insertBefore(searchWrap, menu.firstChild);
        }
      }

      const searchInput = searchWrap.querySelector('.multi-select-search-input');
      if(searchInput){
        searchInput.value = '';
        searchInput.placeholder = `Buscar ${operationType === 'Trabajo' ? 'trabajo' : 'avería'}...`;

        searchInput.oninput = function(){
          const term = String(this.value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .toLowerCase()
            .trim();

          const options = Array.from(menu.querySelectorAll('.multi-option'));
          let visibleCount = 0;

          options.forEach(function(option){
            const text = String(option.textContent || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g,'')
              .toLowerCase()
              .trim();

            const visible = !term || text.includes(term);
            option.style.display = visible ? '' : 'none';
            if(visible) visibleCount += 1;
          });

          let empty = menu.querySelector('.multi-select-search-empty');
          if(!empty){
            empty = document.createElement('div');
            empty.className = 'multi-select-search-empty';
            empty.textContent = 'No hay resultados para esa búsqueda.';
            menu.appendChild(empty);
          }

          empty.style.display = visibleCount ? 'none' : 'block';
        };
      }

      const countLabel = document.getElementById(selectId + 'Count');
      const refreshValue = () => {
        const inputs = Array.from(menu.querySelectorAll('input[type="checkbox"]'));
        const selected = inputs.filter(input => input.checked).map(input => input.value);
        inputs.forEach(input => input.closest('.multi-option')?.classList.toggle('checked', input.checked));
        if (countLabel) countLabel.textContent = `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}`;

        if (selected.length) {
          const visible = selected.slice(0, 2).map(item => `<span class="multi-pill"><span>${item}</span></span>`).join('');
          const extra = selected.length > 2 ? `<span class="multi-pill">+${selected.length - 2} más</span>` : '';
          valueLabel.classList.remove('is-placeholder');
          valueLabel.innerHTML = visible + extra;
        } else {
          valueLabel.classList.add('is-placeholder');
          valueLabel.textContent = operationType === 'Trabajo' ? 'Selecciona uno o varios trabajos' : 'Selecciona una o varias averías';
        }
      };

      menu.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', refreshValue));
      refreshValue();
    }

    function renderSelectedTypeChips(selectedTypes = []) {
      if (!selectedTypes || !selectedTypes.length) return '<span style="color: var(--muted);">Sin tipo específico</span>';
      return selectedTypes.map(type => `<span class="chip">${type}</span>`).join('');
    }

    function isVideoMedia(src = '') {
      const value = String(src || '').toLowerCase();
      return value.startsWith('data:video/') || value.includes('video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(value);
    }

    function renderMediaPreview(src, alt = 'Archivo', className = '') {
      if (isVideoMedia(src)) {
        return `<video ${className ? `class="${className}"` : ''} controls preload="metadata"><source src="${src}"></video>`;
      }
      return `<img src="${src}" alt="${alt}" ${className ? `class="${className}"` : ''} />`;
    }

    function renderMediaGrid(items = [], options = {}) {
      const list = getSafeMediaList(items);
      if (!list.length) return '';
      const title = options.title === undefined ? 'Archivos' : options.title;
      const minWidth = options.minWidth || 240;
      const height = options.height || 210;
      const sectionTitle = title
        ? `<label style="display:block; margin-bottom:10px; font-size:14px; font-weight:700; color: var(--text);">${title}</label>`
        : '';
      return `
        <div class="ops-media-gallery-wrap">
          ${sectionTitle}
          <div class="ops-media-gallery" style="grid-template-columns:repeat(auto-fit,minmax(${minWidth}px,1fr));">
            ${list.map((src, index) => `
              <button type="button" class="ops-media-card" onclick="openMediaLightbox('${escapeHtml(src)}', ${isVideoMedia(src) ? 'true' : 'false'}, 'Archivo ${index + 1}')">
                <div class="ops-media-stage" style="min-height:${height}px;">
                  ${isVideoMedia(src)
                    ? `<video controls preload="metadata" playsinline><source src="${src}"></video>`
                    : `<img src="${src}" alt="Archivo ${index + 1}" loading="lazy" onerror="this.closest('.ops-media-stage').innerHTML='<div style=&quot;padding:16px;text-align:center;&quot;><a href=&quot;${src}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot; style=&quot;color:#0ea5c6;font-weight:700;&quot;>Abrir archivo</a></div>';" />`}
                </div>
                <div class="ops-media-caption">
                  <span>${isVideoMedia(src) ? 'Video' : 'Imagen'}</span>
                  <strong>Abrir archivo</strong>
                </div>
              </button>
            `).join('')}
          </div>
        </div>`;
    }

    function renderEditableImageGrid(containerId, images = [], onRemoveName, id) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const safeImages = getSafeMediaList(images);
      if (!safeImages.length) { container.innerHTML = ''; return; }
      container.innerHTML = safeImages.map((img, index) => `
        <div class="image-card">
          ${renderMediaPreview(img, 'Archivo')}
          <button type="button" class="image-remove" onclick="${onRemoveName}('${id}', ${index})">✕</button>
        </div>
      `).join('');
    }

    function statusBadge(status) {
      const canonical = canonicalOperationStatus(status);
      if (canonical === 'Resuelto por soporte remoto') return '<span class="badge badge-completado go-status-chip go-status-completado"><i class="fas fa-headset"></i>Resuelto por soporte remoto</span>';
      if (canonical === 'Completado') return '<span class="badge badge-completado go-status-chip go-status-completado"><i class="fas fa-circle-check"></i>Completado</span>';
      if (canonical === 'En incidencia') return '<span class="badge badge-pendiente go-status-chip go-status-incidencia"><i class="fas fa-triangle-exclamation"></i>En incidencia</span>';
      if (canonical === 'En proceso') return '<span class="badge badge-proceso go-status-chip go-status-proceso"><i class="fas fa-gears"></i>En proceso</span>';
      if (canonical === 'Asignado') return '<span class="badge badge-proceso go-status-chip go-status-asignada"><i class="fas fa-user-check"></i>Asignado</span>';
      return '<span class="badge badge-pendiente go-status-chip go-status-pendiente"><i class="fas fa-clock"></i>Reportado</span>';
    }

    function renderStats(operations) {
      const statuses = operations.map(op => canonicalOperationStatus(op.status));
      document.getElementById('statTotal').textContent = operations.length;
      document.getElementById('statProceso').textContent = statuses.filter(status => status === 'En proceso').length;
      document.getElementById('statCompletado').textContent = statuses.filter(status => ['Completado', 'Resuelto por soporte remoto'].includes(status)).length;
      document.getElementById('statPendiente').textContent = statuses.filter(status => status === 'Reportado').length;
      const assignedNode = document.getElementById('statAsignada');
      if (assignedNode) assignedNode.textContent = statuses.filter(status => status === 'Asignado').length;
    }

    function resolutionMinutesFromText(text) {
      if (!text || typeof text !== 'string') return null;
      const dayMatch = text.match(/(\d+)\s*día/);
      const hourMatch = text.match(/(\d+)\s*hora/);
      const minuteMatch = text.match(/(\d+)\s*minuto/);
      let total = 0;
      if (dayMatch) total += Number(dayMatch[1]) * 1440;
      if (hourMatch) total += Number(hourMatch[1]) * 60;
      if (minuteMatch) total += Number(minuteMatch[1]);
      return total || null;
    }

    function formatMinutesHuman(minutes) {
      if (minutes === null || minutes === undefined || minutes < 1) return '0 min';

      const totalMinutes = Math.floor(minutes);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const mins = totalMinutes % 60;

      if (days > 0) {
        if (hours > 0 && mins > 0) return `${days} d ${hours} h ${mins} min`;
        if (hours > 0) return `${days} d ${hours} h`;
        return mins > 0 ? `${days} d ${mins} min` : `${days} d`;
      }

      if (hours > 0) {
        return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
      }

      return `${mins} min`;
    }

    function minutesBetween(startValue, endValue) {
      if (!startValue || !endValue) return null;
      const start = new Date(startValue).getTime();
      const end = new Date(endValue).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
      return (end - start) / 60000;
    }

    function getHistoryTimestamp(historyItem) {
      if (!historyItem) return null;
      const raw = historyItem.timestamp || historyItem.date || historyItem.fecha || historyItem.created_at || null;
      if (!raw) return null;
      const timestamp = new Date(raw).getTime();
      return Number.isFinite(timestamp) ? raw : null;
    }

    function inferAssignedAtFromHistory(op) {
      const history = Array.isArray(op.history) ? op.history : [];
      const assignmentEntry = history
        .filter(item => item && (
          item.action === 'Asignación' ||
          (item.action === 'Estado' && canonicalOperationStatus(item.newStatus) === 'Asignado')
        ))
        .sort((a, b) => new Date(getHistoryTimestamp(a) || 0) - new Date(getHistoryTimestamp(b) || 0))[0];

      return getHistoryTimestamp(assignmentEntry);
    }

    function inferStartedAtFromHistory(op) {
      const history = Array.isArray(op.history) ? op.history : [];
      const startEntry = history
        .filter(item => item && (
          item.action === 'Inicio' ||
          (item.action === 'Estado' && item.newStatus === 'En proceso')
        ))
        .sort((a, b) => new Date(getHistoryTimestamp(a) || 0) - new Date(getHistoryTimestamp(b) || 0))[0];

      return getHistoryTimestamp(startEntry);
    }

    function inferCompletedAtFromHistory(op) {
      const history = Array.isArray(op.history) ? op.history : [];
      const completionEntry = history
        .filter(item => item && (
          item.action === 'Finalización' ||
          (item.action === 'Estado' && isOperationTerminalStatus(item.newStatus))
        ))
        .sort((a, b) => new Date(getHistoryTimestamp(a) || 0) - new Date(getHistoryTimestamp(b) || 0))[0];

      return getHistoryTimestamp(completionEntry);
    }

    function getAssignmentTimestamp(op) {
      return op.assignedAt || inferAssignedAtFromHistory(op) || null;
    }

    function getStartTimestamp(op) {
      return op.startedAt || inferStartedAtFromHistory(op) || null;
    }

    function getCompletionTimestamp(op) {
      return op.completedAt || op.closedAt || inferCompletedAtFromHistory(op) || null;
    }

    function isAssignedStatus(status) {
      return ['Asignada', 'En proceso', 'Completado'].includes(status);
    }

    function isValidOperationTransition(fromStatus, toStatus) {
      if (fromStatus === toStatus) return true;
      const allowedTransitions = {
        'Pendiente': ['Asignada'],
        'Asignada': ['En proceso'],
        'En proceso': ['Completado'],
        'Completado': []
      };
      return (allowedTransitions[fromStatus] || []).includes(toStatus);
    }

    function getTransitionErrorMessage(fromStatus, toStatus) {
      if (fromStatus === 'Pendiente' && toStatus === 'En proceso') {
        return 'No puedes pasar una operación de Pendiente a En proceso sin asignarla primero.';
      }
      if (fromStatus === 'Pendiente' && toStatus === 'Completado') {
        return 'No puedes completar una operación desde Pendiente. Primero debes asignarla.';
      }
      if (fromStatus === 'Asignada' && toStatus === 'Pendiente') {
        return 'Una operación asignada no puede volver a Pendiente.';
      }
      if (fromStatus === 'Asignada' && toStatus === 'Completado') {
        return 'No puedes completar una operación desde Asignada. Primero debe pasar a En proceso para registrar fecha de inicio.';
      }
      if (fromStatus === 'En proceso' && ['Pendiente', 'Asignada'].includes(toStatus)) {
        return 'Una operación en proceso no puede retroceder de estado.';
      }
      if (fromStatus === 'Completado') {
        return 'Una operación completada ya no se puede modificar.';
      }
      return `No se permite cambiar una operación de ${fromStatus} a ${toStatus}.`;
    }

    function getAssignmentMinutes(op) {
      return minutesBetween(op.createdAt, getAssignmentTimestamp(op));
    }

    function getResolutionMinutes(op) {
      return minutesBetween(getStartTimestamp(op), getCompletionTimestamp(op));
    }

    function getResponseMinutes(op) {
      return minutesBetween(getAssignmentTimestamp(op), getStartTimestamp(op));
    }

    function getAssignmentTimeLabel(op) {
      const minutes = getAssignmentMinutes(op);
      if (minutes === null || minutes === undefined) return 'Sin asignación registrada';
      return formatMinutesHuman(minutes);
    }

    function getResponseTimeLabel(op) {
      if (!getAssignmentTimestamp(op)) return 'Sin asignación registrada';
      if (!getStartTimestamp(op)) return 'Sin inicio registrado';
      const minutes = getResponseMinutes(op);
      if (minutes === null || minutes === undefined) return 'Sin cálculo disponible';
      return formatMinutesHuman(minutes);
    }

    function getResolutionTimeLabel(op) {
      if (!getStartTimestamp(op)) return 'Sin inicio registrado';
      if (!getCompletionTimestamp(op)) return 'Sin cierre registrado';
      const minutes = getResolutionMinutes(op);
      if (minutes === null || minutes === undefined) return 'Sin cálculo disponible';
      return formatMinutesHuman(minutes);
    }

    function averageFromOperations(operations, keyGetter) {
      const map = new Map();
      operations.forEach(op => {
        const key = keyGetter(op);
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(op);
      });
      return map;
    }

    function getSpecificTypeOptionsForReports(baseType = '') {
      if (baseType === 'Trabajo') return WORK_TYPES.map(item => item.name).filter(Boolean);
      if (baseType === 'Avería') return ISSUE_TYPES.map(item => item.name).filter(Boolean);
      return [...WORK_TYPES.map(item => item.name), ...ISSUE_TYPES.map(item => item.name)]
        .filter(Boolean)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a.localeCompare(b));
    }

    function populateSpecificTypeSelect(selectEl, baseType = '', previousValue = '') {
      if (!selectEl) return;
      const options = getSpecificTypeOptionsForReports(baseType);
      selectEl.innerHTML = '<option value="">Todos los tipos específicos</option>' +
        options.map(name => `<option value="${name}">${name}</option>`).join('');
      selectEl.value = options.includes(previousValue) ? previousValue : '';
    }

    function populateReportSpecificTypeOptions() {
      if (!reportFilterSpecificType) return;
      populateSpecificTypeSelect(reportFilterSpecificType, reportFilterType.value, reportFilterSpecificType.value);
    }

    function populateDedicatedSpecificTypeOptions() {
      if (specificReportFilterSpecificType) {
        populateSpecificTypeSelect(specificReportFilterSpecificType, specificReportFilterType.value, specificReportFilterSpecificType.value);
      }
    }

    function getOperationsByFilters({ typeValue = '', statusValue = '', specificTypeValue = '', agencyValue = '', ownerValue = '', groupValue = '', reporterValue = '', evidenceValue = '', sourceValue = '', fromValue = '', toValue = '' } = {}) {
      const operations = loadOperations();
      return operations.filter(op => {
        const locationText = getOperationLocation(op).toLowerCase();
        const agencyText = String(op.agency || '').toLowerCase();
        const groupText = String(op.grupo || '').toLowerCase();
        const ownerKeywords = [
          String(op.technician || ''),
          getAssigneeDisplayName(op.technician, op.type),
          slugifyUsername(op.technician || ''),
          slugifyUsername(getAssigneeDisplayName(op.technician, op.type))
        ].map(item => String(item || '').toLowerCase().trim()).filter(Boolean);
        const reporterKeywords = [
          String(op.nombre_encargado || ''),
          String(op.created_by || ''),
          getOperationReporter(op),
          slugifyUsername(op.nombre_encargado || ''),
          slugifyUsername(op.created_by || ''),
          slugifyUsername(getOperationReporter(op))
        ].map(item => String(item || '').toLowerCase().trim()).filter(Boolean);
        const ownerNeedle = String(ownerValue || '').toLowerCase().trim();
        const reporterNeedle = String(reporterValue || '').toLowerCase().trim();
        const ownerNeedleSlug = slugifyUsername(ownerValue || '');
        const reporterNeedleSlug = slugifyUsername(reporterValue || '');
        const matchType = !typeValue || op.type === typeValue;
        const matchStatus = !statusValue || canonicalOperationStatus(op.status) === canonicalOperationStatus(statusValue);
        const matchSpecificType = !specificTypeValue || ((Array.isArray(op.selectedTypes) ? op.selectedTypes : []).includes(specificTypeValue));
        const matchAgency = !agencyValue || locationText.includes(agencyValue.toLowerCase()) || agencyText.includes(agencyValue.toLowerCase());
        const matchOwner = !ownerNeedle || ownerKeywords.some(value => value.includes(ownerNeedle) || slugifyUsername(value) === ownerNeedleSlug);
        const matchGroup = !groupValue || groupText.includes(groupValue.toLowerCase()) || locationText.includes(groupValue.toLowerCase());
        const matchReporter = !reporterNeedle || reporterKeywords.some(value => value.includes(reporterNeedle) || slugifyUsername(value) === reporterNeedleSlug);
        const createdDate = new Date(op.createdAt);
        const fromOk = !fromValue || createdDate >= new Date(fromValue + 'T00:00:00');
        const toOk = !toValue || createdDate <= new Date(toValue + 'T23:59:59');
        return matchType && matchStatus && matchSpecificType && matchAgency && matchOwner && matchGroup && matchReporter && fromOk && toOk;
      });
    }

    function getReportFilteredOperations() {
      return getOperationsByFilters({
        typeValue: reportFilterType.value,
        statusValue: reportFilterStatus.value,
        specificTypeValue: reportFilterSpecificType.value,
        agencyValue: reportFilterAgency.value,
        ownerValue: reportFilterOwner.value,
        groupValue: reportFilterGroup.value,
        reporterValue: reportFilterReporter.value,
        fromValue: reportFilterFrom.value,
        toValue: reportFilterTo.value
      });
    }

    function buildAgencyGroups(operations) {
      return Array.from(averageFromOperations(operations, op => op.agency).entries()).map(([agency, items]) => {
        const completed = items.filter(op => isOperationTerminalStatus(op.status)).length;
        const stillOpen = items.length - completed;
        const assignValues = items.map(getAssignmentMinutes).filter(value => value !== null);
        const responseValues = items.map(getResponseMinutes).filter(value => value !== null);
        const resolutionValues = items.map(getResolutionMinutes).filter(value => value !== null);
        const avgAssign = assignValues.length ? assignValues.reduce((a,b)=>a+b,0)/assignValues.length : 0;
        const avgResponse = responseValues.length ? responseValues.reduce((a,b)=>a+b,0)/responseValues.length : 0;
        const avgResolution = resolutionValues.length ? resolutionValues.reduce((a,b)=>a+b,0)/resolutionValues.length : 0;
        return { agency, total: items.length, completed, stillOpen, avgAssign, avgResponse, avgResolution };
      }).sort((a,b) => b.total - a.total || a.agency.localeCompare(b.agency));
    }

    function buildOwnerGroups(operations) {
      return Array.from(averageFromOperations(operations, op => op.technician || 'Sin asignar').entries()).map(([owner, items]) => {
        const completed = items.filter(op => isOperationTerminalStatus(op.status)).length;
        const inProgress = items.filter(op => !isOperationTerminalStatus(op.status)).length;
        const assignValues = items.map(getAssignmentMinutes).filter(value => value !== null);
        const responseValues = items.map(getResponseMinutes).filter(value => value !== null);
        const resolutionValues = items.map(getResolutionMinutes).filter(value => value !== null);
        const avgAssign = assignValues.length ? assignValues.reduce((a,b)=>a+b,0)/assignValues.length : 0;
        const avgResponse = responseValues.length ? responseValues.reduce((a,b)=>a+b,0)/responseValues.length : 0;
        const avgResolution = resolutionValues.length ? resolutionValues.reduce((a,b)=>a+b,0)/resolutionValues.length : 0;
        return { owner, total: items.length, completed, inProgress, avgAssign, avgResponse, avgResolution };
      }).sort((a,b) => b.total - a.total || a.owner.localeCompare(b.owner));
    }

    function buildCategoryGroups(operations) {
      const categoryMap = new Map();
      operations.forEach(op => {
        const cats = Array.isArray(op.selectedTypes) && op.selectedTypes.length ? op.selectedTypes : ['Sin tipo específico'];
        cats.forEach(cat => {
          if (!categoryMap.has(cat)) categoryMap.set(cat, []);
          categoryMap.get(cat).push(op);
        });
      });
      return Array.from(categoryMap.entries()).map(([category, items]) => {
        const completed = items.filter(op => isOperationTerminalStatus(op.status)).length;
        const stillOpen = items.length - completed;
        const assignValues = items.map(getAssignmentMinutes).filter(value => value !== null);
        const responseValues = items.map(getResponseMinutes).filter(value => value !== null);
        const resolutionValues = items.map(getResolutionMinutes).filter(value => value !== null);
        const avgAssign = assignValues.length ? assignValues.reduce((a,b)=>a+b,0)/assignValues.length : 0;
        const avgResponse = responseValues.length ? responseValues.reduce((a,b)=>a+b,0)/responseValues.length : 0;
        const avgResolution = resolutionValues.length ? resolutionValues.reduce((a,b)=>a+b,0)/resolutionValues.length : 0;
        return { category, total: items.length, completed, stillOpen, avgAssign, avgResponse, avgResolution };
      }).sort((a,b) => b.total - a.total || a.category.localeCompare(b.category));
    }

    function lotekaHistoryCode(op) {
      return String(op?.code || op?.codigo || op?.id || 'SIN-CODIGO');
    }

    function lotekaHistoryTitle(op) {
      return String(op?.title || op?.titulo || op?.description || op?.descripcion || 'Operación sin título');
    }

    function lotekaHistoryAgency(op) {
      return String(getOperationLocation(op) || op?.agency || op?.agencia || '-');
    }

    function lotekaHistoryFinalNote(op) {
      return String(op?.finalComment || op?.finalObservation || op?.resolutionNote || op?.closeComment || op?.closingNote || op?.resultado || op?.comentarioFinal || op?.observacionFinal || op?.description || 'Sin observación final registrada.');
    }

    function lotekaBuildHistoryEntry(op, data) {
      const normalizedOp = enrichOperationWithAgencyContext(op || {});
      return {
        operationId: normalizedOp.id,
        code: lotekaHistoryCode(normalizedOp),
        title: lotekaHistoryTitle(normalizedOp),
        agency: lotekaHistoryAgency(normalizedOp),
        type: normalizedOp.type || 'Operación',
        technician: normalizedOp.technician || normalizedOp.owner || '',
        action: data.action || 'Actividad',
        detail: data.detail || 'Movimiento registrado en la operación.',
        user: data.user || normalizedOp.updatedBy || normalizedOp.createdBy || 'Sistema LOTEKA',
        prevStatus: data.prevStatus ?? null,
        newStatus: data.newStatus ?? null,
        timestamp: data.timestamp || normalizedOp.updatedAt || normalizedOp.createdAt || new Date().toISOString(),
        tipo: data.tipo || data.type || null,
        canal: data.canal || data.channel || null,
        motivo: data.motivo || data.reason || null,
        comentario: data.comentario || data.comment || null,
        encargado_nombre: data.encargado_nombre || data.encargadoNombre || null,
        encargado_telefono: data.encargado_telefono || data.encargadoTelefono || null,
        evidencia_requerida: data.evidencia_requerida ?? data.evidenciaRequerida ?? null
      };
    }

    function lotekaBuildFallbackHistory(op) {
      const normalizedOp = enrichOperationWithAgencyContext(op || {});
      const entries = [];
      entries.push(lotekaBuildHistoryEntry(normalizedOp, {
        action: 'Creación',
        detail: `Operación creada: ${lotekaHistoryTitle(normalizedOp)}`,
        user: normalizedOp.createdBy || 'Sistema LOTEKA',
        newStatus: normalizedOp.status || 'Pendiente',
        timestamp: normalizedOp.createdAt || new Date().toISOString()
      }));
      if (normalizedOp.assignedAt || normalizedOp.technician) {
        entries.push(lotekaBuildHistoryEntry(normalizedOp, {
          action: 'Asignación',
          detail: `Asignada a ${getAssigneeDisplayName(normalizedOp.technician, normalizedOp.type) || 'responsable no especificado'}`,
          user: normalizedOp.assignedBy || 'Sistema LOTEKA',
          prevStatus: 'Pendiente',
          newStatus: normalizedOp.startedAt ? 'En proceso' : (normalizedOp.status || 'Asignada'),
          timestamp: normalizedOp.assignedAt || normalizedOp.createdAt || new Date().toISOString()
        }));
      }
      if (normalizedOp.startedAt) {
        entries.push(lotekaBuildHistoryEntry(normalizedOp, {
          action: 'Estado',
          detail: 'Trabajo iniciado por el responsable asignado.',
          user: normalizedOp.startedBy || normalizedOp.technician || 'Sistema LOTEKA',
          prevStatus: 'Asignada',
          newStatus: 'En proceso',
          timestamp: normalizedOp.startedAt
        }));
      }
      const evidenceCount = (Array.isArray(normalizedOp.resultImages) ? normalizedOp.resultImages.length : 0) + (Array.isArray(normalizedOp.images) ? normalizedOp.images.length : 0);
      if (evidenceCount) {
        entries.push(lotekaBuildHistoryEntry(normalizedOp, {
          action: 'Evidencia',
          detail: `${evidenceCount} evidencia(s) asociada(s) a la operación.`,
          user: normalizedOp.technician || 'Sistema LOTEKA',
          timestamp: normalizedOp.completedAt || normalizedOp.updatedAt || normalizedOp.createdAt || new Date().toISOString()
        }));
      }
      if (String(normalizedOp.status || '').toLowerCase().includes('complet') || normalizedOp.completedAt) {
        entries.push(lotekaBuildHistoryEntry(normalizedOp, {
          action: 'Finalización',
          detail: lotekaHistoryFinalNote(normalizedOp),
          user: normalizedOp.completedBy || normalizedOp.technician || 'Sistema LOTEKA',
          prevStatus: normalizedOp.startedAt ? 'En proceso' : 'Asignada',
          newStatus: 'Completado',
          timestamp: normalizedOp.completedAt || normalizedOp.updatedAt || normalizedOp.createdAt || new Date().toISOString()
        }));
      }
      return entries;
    }

    function getAllHistoryEntries() {
      const operations = loadOperations();
      return operations.flatMap(op => {
        const normalizedOp = enrichOperationWithAgencyContext(op || {});
        const history = Array.isArray(normalizedOp.history) ? normalizedOp.history.filter(Boolean) : [];
        if (!history.length) return lotekaBuildFallbackHistory(normalizedOp);
        return history.map(item => lotekaBuildHistoryEntry(normalizedOp, {
          action: item.action || item.tipo || 'Actividad',
          detail: item.detail || item.detalle || item.comment || item.comentario || 'Movimiento registrado en la operación.',
          user: item.user || item.usuario || item.createdBy || normalizedOp.updatedBy || 'Sistema LOTEKA',
          prevStatus: item.prevStatus ?? item.estadoAnterior ?? null,
          newStatus: item.newStatus ?? item.estadoNuevo ?? null,
          timestamp: getHistoryTimestamp(item) || item.createdAt || item.fecha || normalizedOp.createdAt || new Date().toISOString(),
          tipo: item.tipo || item.type || null,
          canal: item.canal || item.channel || null,
          motivo: item.motivo || item.reason || null,
          comentario: item.comentario || item.comment || item.comentario_cierre_whatsapp || null,
          encargado_nombre: item.encargado_nombre || item.encargadoNombre || null,
          encargado_telefono: item.encargado_telefono || item.encargadoTelefono || null,
          evidencia_requerida: item.evidencia_requerida ?? item.evidenciaRequerida ?? null
        }));
      }).filter(item => item.operationId).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    }

    function getFilteredHistoryEntries() {
      return getAllHistoryEntries().filter(item => {
        const searchValue = String(historyFilterSearch?.value || '').toLowerCase().trim();
        const userValue = String(historyFilterUser?.value || '').toLowerCase().trim();
        const actionValue = String(historyFilterAction?.value || '');
        const searchText = `${item.code} ${item.title} ${item.agency} ${item.detail} ${item.type}`.toLowerCase();
        const matchSearch = !searchValue || searchText.includes(searchValue);
        const matchAction = !actionValue || item.action === actionValue;
        const matchUser = !userValue || String(item.user || '').toLowerCase().includes(userValue);
        const itemDate = new Date(item.timestamp || 0);
        const fromOk = !historyFilterFrom?.value || itemDate >= new Date(historyFilterFrom.value + 'T00:00:00');
        const toOk = !historyFilterTo?.value || itemDate <= new Date(historyFilterTo.value + 'T23:59:59');
        return matchSearch && matchAction && matchUser && fromOk && toOk;
      });
    }

    function renderSimpleSummaryRows(targetId, rows, emptyMessage = 'Sin datos disponibles.') {
      const tbody = document.getElementById(targetId);
      if (!tbody) return;
      const colspan = tbody.parentElement.querySelectorAll('thead th').length || 5;
      lotekaRenderPaginatedRows(targetId, rows, {colspan, emptyMessage, defaultPageSize:10});
    }

    function renderOperationDetailRows(targetBodyId, operations, emptyMessage = 'No hay operaciones para este reporte.') {
      renderSimpleSummaryRows(targetBodyId, operations.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(op => `
        <tr>
          <td><strong>${op.code}</strong><div style="margin-top:6px;font-size:12px;color:var(--muted);">${getOperationSourceLabel(op)}</div></td>
          <td>${op.type}</td>
          <td>
            <strong>${op.title}</strong>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">
              ${operationHasAnyEvidence(op) ? '<span class="chip">Con evidencia</span>' : '<span class="chip">Sin evidencia</span>'}
            </div>
          </td>
          <td>${getOperationLocation(op)}</td>
          <td>${getOperationReporter(op)}</td>
          <td>${getAssigneeDisplayName(op.technician, op.type)}</td>
          <td>${statusBadge(op.status)}</td>
          <td>${escapeHtml(getAssignmentTimeLabel(op))}</td>
          <td>${escapeHtml(getResponseTimeLabel(op))}</td>
          <td>${escapeHtml(getResolutionTimeLabel(op))}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="showDetail('${op.id}')">Ver</button></td>
        </tr>
      `), emptyMessage);
    }

    function renderReports() {
      populateReportSpecificTypeOptions();
      populateAdvancedReportDropdowns();
      const operations = getReportFilteredOperations();
      renderReportFilterSummary([
        reportFilterType.value ? { label: 'Tipo', value: reportFilterType.value } : null,
        reportFilterStatus.value ? { label: 'Estado', value: reportFilterStatus.value } : null,
        reportFilterSpecificType.value ? { label: 'Tipo específico', value: reportFilterSpecificType.value } : null,
        reportFilterAgency.value ? { label: 'Agencia', value: reportFilterAgency.value } : null,
        reportFilterOwner.value ? { label: 'Técnico', value: reportFilterOwner.options[reportFilterOwner.selectedIndex]?.text || reportFilterOwner.value } : null,
        reportFilterGroup.value ? { label: 'Grupo', value: reportFilterGroup.value } : null,
        reportFilterReporter.value ? { label: 'Encargado', value: reportFilterReporter.options[reportFilterReporter.selectedIndex]?.text || reportFilterReporter.value } : null,
        reportFilterFrom.value ? { label: 'Desde', value: reportFilterFrom.value } : null,
        reportFilterTo.value ? { label: 'Hasta', value: reportFilterTo.value } : null
      ].filter(Boolean));
      const done = operations.filter(op => isOperationTerminalStatus(op.status));
      const pending = operations.filter(op => !isOperationTerminalStatus(op.status));
      const resolutionValues = done.map(getResolutionMinutes).filter(value => value !== null);
      const avgResolution = resolutionValues.length ? resolutionValues.reduce((a,b) => a+b, 0) / resolutionValues.length : 0;
      const assignedValues = operations.map(getAssignmentMinutes).filter(value => value !== null);
      const avgAssigned = assignedValues.length ? assignedValues.reduce((a,b) => a+b, 0) / assignedValues.length : 0;
      const compliance = operations.length ? (done.length / operations.length) * 100 : 0;

      document.getElementById('reportStatTotal').textContent = operations.length;
      document.getElementById('reportStatDone').textContent = done.length;
      document.getElementById('reportStatPending').textContent = pending.length;
      document.getElementById('reportStatAvgResolution').textContent = formatMinutesHuman(avgResolution);
      document.getElementById('reportCompliance').textContent = `${Math.round(compliance)}%`;
      document.getElementById('reportAssignAvg').textContent = formatMinutesHuman(avgAssigned);

      const agencyGroups = buildAgencyGroups(operations);
      const ownerGroups = buildOwnerGroups(operations);
      document.getElementById('reportTopAgency').textContent = agencyGroups[0] ? agencyGroups[0].agency : '-';
      document.getElementById('reportTopOwner').textContent = ownerGroups[0] ? getAssigneeDisplayName(ownerGroups[0].owner, 'Avería') : '-';

      renderOperationDetailRows('reportDetailBody', operations);
    }

    function renderAgencyReports() {
      const operations = getOperationsByFilters({
        typeValue: agencyReportFilterType.value,
        statusValue: agencyReportFilterStatus.value,
        agencyValue: agencyReportFilterAgency.value,
        fromValue: agencyReportFilterFrom.value,
        toValue: agencyReportFilterTo.value
      });
      const agencyGroups = buildAgencyGroups(operations);
      renderSimpleSummaryRows('reportAgencyBody', agencyGroups.map(row => `
        <tr>
          <td>${row.agency}</td>
          <td>${row.total}</td>
          <td>${row.completed}</td>
          <td>${row.stillOpen}</td>
          <td>${formatMinutesHuman(row.avgAssign)}</td>
          <td>${formatMinutesHuman(row.avgResponse || 0)}</td>
          <td>${formatMinutesHuman(row.avgResolution)}</td>
        </tr>
      `), 'No hay agencias para este reporte.');
    }

    function renderOwnerReports() {
      const operations = getOperationsByFilters({
        typeValue: ownerReportFilterType.value,
        statusValue: ownerReportFilterStatus.value,
        ownerValue: ownerReportFilterOwner.value,
        fromValue: ownerReportFilterFrom.value,
        toValue: ownerReportFilterTo.value
      });
      const ownerGroups = buildOwnerGroups(operations);
      renderSimpleSummaryRows('reportOwnerBody', ownerGroups.map(row => `
        <tr>
          <td>${getAssigneeDisplayName(row.owner, 'Avería')}</td>
          <td>${row.total}</td>
          <td>${row.completed}</td>
          <td>${row.inProgress}</td>
          <td>${formatMinutesHuman(row.avgAssign)}</td>
          <td>${formatMinutesHuman(row.avgResponse || 0)}</td>
          <td>${formatMinutesHuman(row.avgResolution)}</td>
        </tr>
      `), 'No hay responsables para este reporte.');
    }

    function renderSpecificReports() {
      populateDedicatedSpecificTypeOptions();
      const operations = getOperationsByFilters({
        typeValue: specificReportFilterType.value,
        statusValue: specificReportFilterStatus.value,
        specificTypeValue: specificReportFilterSpecificType.value,
        fromValue: specificReportFilterFrom.value,
        toValue: specificReportFilterTo.value
      });
      const categoryGroups = buildCategoryGroups(operations);
      renderSimpleSummaryRows('reportCategoryBody', categoryGroups.map(row => `
        <tr>
          <td>${row.category}</td>
          <td>${row.total}</td>
          <td>${row.completed}</td>
          <td>${row.stillOpen}</td>
          <td>${formatMinutesHuman(row.avgAssign)}</td>
          <td>${formatMinutesHuman(row.avgResponse || 0)}</td>
          <td>${formatMinutesHuman(row.avgResolution)}</td>
        </tr>
      `), 'No hay tipos específicos para este reporte.');
    }

    function renderHistory() {
      const entries = getFilteredHistoryEntries();
      const totalEl = document.getElementById('historyStatTotal');
      const assignEl = document.getElementById('historyStatAssignments');
      const closeEl = document.getElementById('historyStatClosures');
      if (totalEl) totalEl.textContent = entries.length;
      if (assignEl) assignEl.textContent = entries.filter(item => item.action === 'Asignación').length;
      if (closeEl) closeEl.textContent = entries.filter(item => ['Finalización', 'Cierre', 'Cierre por WhatsApp'].includes(item.action) || item.tipo === 'cierre_whatsapp').length;
      const rows = entries.map(item => {
        const actionSlug = String(item.action || '').toLowerCase().replace(/[^a-záéíóúñ0-9]+/g, '-');
        const isWaClose = item.tipo === 'cierre_whatsapp' || String(item.action || '').toLowerCase().includes('whatsapp');
        const detailHtml = isWaClose ? `
          <div class="go-history-wa-card">
            <div class="go-history-wa-title"><i class="fab fa-whatsapp"></i><strong>Cierre por soporte WhatsApp</strong></div>
            <div class="go-history-wa-grid">
              <div><span>Motivo</span><b>${escapeHtml(item.motivo || 'No especificado')}</b></div>
              <div><span>Encargado</span><b>${escapeHtml(item.encargado_nombre || '-')}</b></div>
              <div><span>Teléfono</span><b>${escapeHtml(item.encargado_telefono || '-')}</b></div>
              <div><span>Evidencia</span><b>No aplica</b></div>
            </div>
            <div class="go-history-wa-comment"><span>Comentario</span><p>${escapeHtml(item.comentario || item.detail || 'Sin comentario registrado.')}</p></div>
            ${(item.prevStatus || item.newStatus) ? `<div class="go-history-wa-state"><strong>${escapeHtml(item.prevStatus || '-')}</strong> → <strong>${escapeHtml(item.newStatus || '-')}</strong></div>` : ''}
          </div>` : `
            <div>${escapeHtml(item.detail)}</div>
            ${(item.prevStatus || item.newStatus) ? `<div style="margin-top:6px; color: var(--muted); font-size:12px;"><strong>${escapeHtml(item.prevStatus || '-')}</strong> → <strong>${escapeHtml(item.newStatus || '-')}</strong></div>` : ''}
          `;
        return `
        <tr>
          <td><strong>${formatDate(item.timestamp)}</strong></td>
          <td><strong>${escapeHtml(item.code)}</strong><div style="margin-top:5px;font-size:12px;color:var(--muted);">${escapeHtml(item.type)}</div></td>
          <td><span class="chip ${actionSlug}">${escapeHtml(item.action)}</span></td>
          <td><strong>${escapeHtml(item.title)}</strong></td>
          <td>${escapeHtml(item.agency || '-')}</td>
          <td>${escapeHtml(item.user || 'Sistema LOTEKA')}</td>
          <td>${detailHtml}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="showDetail('${escapeHtml(String(item.operationId))}')"><i class="fas fa-eye"></i> Consultar</button></td>
        </tr>`;
      });
      lotekaRenderPaginatedRows('historyTableBody', rows, {colspan:8, emptyMessage:'No hay movimientos registrados para esos filtros.', defaultPageSize:10});
    }

    function exportRowsToCsv(filename, headers, rows) {
      const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const content = [headers.map(escapeCell).join(','), ...rows.map(row => row.map(escapeCell).join(','))].join('\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    }

    function getFilteredOperations() {
      const operations = loadOperations();
      return operations.filter(op => {
        const matchType = !filterType.value || op.type === filterType.value;
        const matchStatus = !filterStatus.value || canonicalOperationStatus(op.status) === canonicalOperationStatus(filterStatus.value);
        const locationText = getOperationLocation(op).toLowerCase();
        const matchAgency = !filterAgency.value || locationText.includes(filterAgency.value.toLowerCase());
        const matchTech = !filterTech.value || `${String(op.technician || '').toLowerCase()} ${getAssigneeDisplayName(op.technician, op.type).toLowerCase()}`.includes(filterTech.value.toLowerCase());
        const createdDate = new Date(op.createdAt);
        const fromOk = !filterDateFrom.value || createdDate >= new Date(filterDateFrom.value + 'T00:00:00');
        const toOk = !filterDateTo.value || createdDate <= new Date(filterDateTo.value + 'T23:59:59');
        return matchType && matchStatus && matchAgency && matchTech && fromOk && toOk;
      });
    }

    function renderOperations() {
      const operations = getFilteredOperations();
      renderStats(loadOperations());
      renderDashboard();
      const rows = operations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(op => {
  const assignedLabel = op.type === 'Trabajo' ? 'Suplidor' : 'Técnico';
  const location = getOperationLocation(op);
  const assignee = getAssigneeDisplayName(op.technician, op.type);
  const desc = String(op.description || '');
  const shortDesc = desc.length > 78 ? desc.slice(0, 78) + '...' : desc;
  const selectedChips = renderSelectedTypeChips(op.selectedTypes);
  const canEdit = op.status !== 'Completado';

  return `
    <tr class="ops-exec-row">
      <td>
        <div class="ops-code-block">
          <span class="ops-code-main">${op.code}</span>
          <span class="ops-code-sub">${formatDate(op.createdAt)}</span>
        </div>
      </td>

      <td>
        <span class="chip ${op.type === 'Avería' ? 'averia' : 'trabajo'}">${op.type}</span>
      </td>

      <td>
        <div class="ops-title-block">
          <strong>${op.title}</strong>
          <p>${shortDesc || 'Sin descripción registrada'}</p>
          <div class="ops-inline-chips">${selectedChips}</div>
        </div>
      </td>

      <td>
        <div class="ops-location-block">
          <strong>${location}</strong>
          <span>Ubicación operativa</span>
        </div>
      </td>

      <td>
        <div class="ops-assigned-block">
          <span>${assignedLabel}</span>
          <strong>${assignee || 'Sin asignar'}</strong>
        </div>
      </td>

      <td>
        ${statusBadge(op.status)}
      </td>

      <td>
        <div class="ops-date-block">
          <strong>${formatDate(op.createdAt)}</strong>
        </div>
      </td>

      <td>
        <div class="actions ops-row-actions">
          <button class="btn btn-secondary btn-sm" onclick="showDetail('${op.id}')">
            <i class="fas fa-eye"></i> Ver
          </button>
          ${canEdit ? `
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${op.id}')">
              <i class="fas fa-pen"></i> Editar
            </button>
            <button class="btn btn-secondary btn-sm" onclick="deleteOperation('${op.id}')">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
});
      lotekaRenderPaginatedRows('operationsTableBody', rows, {colspan:9, emptyMessage:'No hay operaciones que coincidan con los filtros.', defaultPageSize:10});
    }

    function renderGenericTable(type, search = '') {
      if (type === 'work' && !(WORK_TYPES || []).some(item => item && item.id)) syncOperationCatalogsFromSupabase().catch(() => false);
      if (type === 'issue' && !(ISSUE_TYPES || []).some(item => item && item.id)) syncOperationCatalogsFromSupabase().catch(() => false);
      let items = [];
      let tbody = null;
      let columns = [];
      if (type === 'users') {
        items = USERS;
        tbody = document.getElementById('usersCatalogTableBody');
        columns = ['name', 'area', 'phone'];
      } else if (type === 'suppliers') {
        items = SUPPLIERS;
        tbody = document.getElementById('suppliersCatalogTableBody');
        columns = ['name', 'service', 'phone'];
      } else if (type === 'work') {
        items = WORK_TYPES;
        tbody = document.getElementById('worksCatalogTableBody');
        columns = ['name', 'description'];
      } else {
        items = ISSUE_TYPES;
        tbody = document.getElementById('issuesCatalogTableBody');
        columns = ['name', 'description'];
      }

      const text = (search || '').toLowerCase().trim();
      const filtered = items.filter(item => columns.some(col => (item[col] || '').toLowerCase().includes(text)));
      const colspan = type === 'users' || type === 'suppliers' ? 5 : 4;
      const rows = filtered.map(item => {
        const realIndex = items.findIndex(x => JSON.stringify(x) === JSON.stringify(item));
        if (type === 'users') {
          return `<tr><td>${realIndex + 1}</td><td>${item.name}<div style="margin-top:4px;font-size:12px;color:var(--text-soft);">@${item.username || ''}</div></td><td>${item.area || ''}</td><td>${item.phone || ''}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="viewCatalogItem('users', ${realIndex})">Ver</button><button class="btn btn-secondary btn-sm" onclick="editCatalogItem('users', ${realIndex})">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteCatalogItem('users', ${realIndex})">Eliminar</button></div></td></tr>`;
        } else if (type === 'suppliers') {
          return `<tr><td>${realIndex + 1}</td><td>${item.name}</td><td>${item.service || ''}</td><td>${item.phone || ''}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="viewCatalogItem('suppliers', ${realIndex})">Ver</button><button class="btn btn-secondary btn-sm" onclick="editCatalogItem('suppliers', ${realIndex})">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteCatalogItem('suppliers', ${realIndex})">Eliminar</button></div></td></tr>`;
        }
        return `<tr><td>${realIndex + 1}</td><td>${item.name}</td><td>${item.description || ''}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" onclick="viewCatalogItem('${type}', ${realIndex})">Ver</button><button class="btn btn-secondary btn-sm" onclick="editCatalogItem('${type}', ${realIndex})">Editar</button><button class="btn btn-danger btn-sm" onclick="deleteCatalogItem('${type}', ${realIndex})">Eliminar</button></div></td></tr>`;
      });
      lotekaRenderPaginatedRows(tbody.id, rows, {colspan, emptyMessage:'No hay registros.', defaultPageSize:10});
    }

    function renderAssigneeOptions(selectId, type, selected = '') {
      const select = document.getElementById(selectId);
      if (!select) return;
      if (type === 'Trabajo') {
        select.innerHTML = '<option value="">Sin asignar</option>' + SUPPLIERS.map(item => `<option value="${item.name}" ${selected === item.name ? 'selected' : ''}>${item.name}</option>`).join('');
        return;
      }
      const normalizedSelected = normalizeStoredAssignee(selected, type);
      select.innerHTML = '<option value="">Sin asignar</option>' + USERS.map(item => {
        const value = item.username || slugifyUsername(item.name);
        const isSelected = normalizedSelected === value;
        return `<option value="${value}" ${isSelected ? 'selected' : ''}>${item.name}</option>`;
      }).join('');
    }


    function renderDashboard() {
      const operations = loadOperations().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const total = operations.length;
      const statuses = operations.map(op => canonicalOperationStatus(op.status));
      const pending = statuses.filter(status => ['Reportado', 'Asignado'].includes(status)).length;
      const inProcess = statuses.filter(status => ['En proceso', 'En incidencia'].includes(status)).length;
      const completed = statuses.filter(status => ['Completado', 'Resuelto por soporte remoto'].includes(status)).length;
      const reportedOpen = statuses.filter(status => status === 'Reportado').length;

      const avgAssignValues = operations.map(getAssignmentMinutes).filter(v => Number.isFinite(v) && v >= 0);
      const avgResolutionValues = operations.map(getResolutionMinutes).filter(v => Number.isFinite(v) && v >= 0);
      const avgAssign = avgAssignValues.length ? Math.round(avgAssignValues.reduce((a,b)=>a+b,0) / avgAssignValues.length) : 0;
      const avgResolution = avgResolutionValues.length ? Math.round(avgResolutionValues.reduce((a,b)=>a+b,0) / avgResolutionValues.length) : 0;

      const agencyGroups = buildAgencyGroups(operations).sort((a,b)=>b.total-a.total).slice(0,5);
      const techGroups = buildOwnerGroups(operations.filter(op => op.type !== 'Trabajo')).filter(item => item.owner && item.owner !== 'Sin asignar').sort((a,b)=>b.total-a.total).slice(0,6);
      const supplierGroups = buildOwnerGroups(operations.filter(op => op.type === 'Trabajo')).filter(item => item.owner && item.owner !== 'Sin asignar').sort((a,b)=>b.total-a.total).slice(0,6);

      const typeCounts = ['Avería','Trabajo'].map(type => ({ label:type, value: operations.filter(op => op.type === type).length }));
      const statusCounts = [
        { label:'Reportadas', value: statuses.filter(status => status === 'Reportado').length, cls:'danger' },
        { label:'Asignadas', value: statuses.filter(status => status === 'Asignado').length, cls:'' },
        { label:'En proceso', value: statuses.filter(status => status === 'En proceso').length, cls:'warning' },
        { label:'En incidencia', value: statuses.filter(status => status === 'En incidencia').length, cls:'warning' },
        { label:'Cerradas', value: statuses.filter(status => ['Completado', 'Resuelto por soporte remoto'].includes(status)).length, cls:'success' }
      ];

      const topTech = techGroups[0];
      const topSupplier = supplierGroups[0];
      const topAgency = agencyGroups[0];

      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText('dashOpsTotal', total);
      setText('dashOpsPending', pending);
      setText('dashOpsInProcess', inProcess);
      setText('dashOpsCompleted', completed);
      setText('dashAvgResolution', formatMinutesHuman(avgResolution));
      setText('dashTopTech', topTech ? getAssigneeDisplayName(topTech.owner, 'Avería') : '-');
      setText('dashTopSupplier', topSupplier ? getAssigneeDisplayName(topSupplier.owner, 'Trabajo') : '-');
      setText('dashTopTechHero', topTech ? getAssigneeDisplayName(topTech.owner, 'Avería') : '-');
      setText('dashTopSupplierHero', topSupplier ? getAssigneeDisplayName(topSupplier.owner, 'Trabajo') : '-');
      setText('dashTopAgencyHero', topAgency ? topAgency.agency : '-');
      setText('dashUrgentOpen', reportedOpen);

      const renderBars = (containerId, rows) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!rows.length || rows.every(item => !item.value)) {
          container.innerHTML = '<div class="dashboard-empty">Sin datos suficientes para mostrar este bloque.</div>';
          return;
        }
        const max = Math.max(...rows.map(item => item.value), 1);
        container.innerHTML = rows.map(item => `
          <div class="dashboard-bar-row">
            <div class="dashboard-bar-label">${item.label}</div>
            <div class="dashboard-bar-track"><div class="dashboard-bar-fill ${item.cls || ''}" style="width:${Math.max((item.value/max)*100, item.value ? 8 : 0)}%"></div></div>
            <div class="dashboard-bar-value">${item.value}</div>
          </div>
        `).join('');
      };
      renderBars('dashboardStatusBars', statusCounts);
      renderBars('dashboardTypeBars', typeCounts.map(item => ({...item, cls:item.label === 'Trabajo' ? 'warning' : '' })));

      const renderMiniList = (containerId, rows, typeLabel) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = rows.length ? rows.map((item, index) => `
          <div class="dashboard-mini-item">
            <div><strong>${getAssigneeDisplayName(item.owner, typeLabel)}</strong><span>${item.completed} completadas · ${item.inProgress} activas</span></div>
            <div class="dashboard-rank">#${index + 1}</div>
          </div>`).join('') : '<div class="dashboard-empty">Sin actividad suficiente para mostrar ranking.</div>';
      };

      const topAgencyEl = document.getElementById('dashboardTopAgencies');
      if (topAgencyEl) {
        topAgencyEl.innerHTML = agencyGroups.length ? agencyGroups.map((item, index) => `
          <div class="dashboard-mini-item">
            <div><strong>${item.agency}</strong><span>${item.completed} completadas · ${item.stillOpen} activas</span></div>
            <div class="dashboard-rank">#${index + 1}</div>
          </div>`).join('') : '<div class="dashboard-empty">Aún no hay agencias con actividad suficiente.</div>';
      }

      renderMiniList('dashboardTopTechs', techGroups, 'Avería');
      renderMiniList('dashboardTopSuppliers', supplierGroups, 'Trabajo');

      const alerts = [];
      if (reportedOpen) alerts.push({title:'Reportes sin asignar', text:`${reportedOpen} reportes siguen pendientes de asignación.`});
      if (topAgency) alerts.push({title:'Agencias con más incidencias reportadas', text:`${topAgency.agency} lidera con ${topAgency.total} reportes.`});
      if (topTech) alerts.push({title:'Técnico con más carga', text:`${getAssigneeDisplayName(topTech.owner, 'Avería')} lleva ${topTech.total} averías asignadas.`});
      if (topSupplier) alerts.push({title:'Suplidor con más carga', text:`${getAssigneeDisplayName(topSupplier.owner, 'Trabajo')} lleva ${topSupplier.total} trabajos activos o completados.`});
      const oldPending = operations.filter(op => !isOperationTerminalStatus(op.status) && ((Date.now() - new Date(op.createdAt).getTime()) / 3600000) >= 24);
      if (oldPending.length) alerts.push({title:'Pendientes envejecidas', text:`${oldPending.length} operaciones llevan más de 24 horas abiertas.`});
      const alertsEl = document.getElementById('dashboardAlerts');
      if (alertsEl) {
        alertsEl.innerHTML = alerts.length ? alerts.map(item => `<div class="dashboard-mini-item"><div><strong>${item.title}</strong><span>${item.text}</span></div><i class="fas fa-bell" style="color:#2b7fc3"></i></div>`).join('') : '<div class="dashboard-empty">Sin alertas operativas por el momento.</div>';
      }

      const renderOwnerTable = (containerId, rows, typeLabel, emptyText, colName) => {
        const table = document.getElementById(containerId);
        if (!table) return;
        table.innerHTML = rows.length ? rows.map(item => `
          <tr>
            <td><strong>${getAssigneeDisplayName(item.owner, typeLabel)}</strong></td>
            <td>${item.total}</td>
            <td>${item.inProgress}</td>
            <td>${item.completed}</td>
            <td>${formatMinutesHuman(item.avgResolution)}</td>
          </tr>`).join('') : `<tr><td colspan="5"><div class="dashboard-empty">${emptyText}</div></td></tr>`;
      };

      renderOwnerTable('dashboardTechTable', techGroups, 'Avería', 'No hay técnicos con actividad aún.');
      renderOwnerTable('dashboardSupplierTable', supplierGroups, 'Trabajo', 'No hay suplidores con actividad aún.');

      const criticalOps = operations.filter(op => canonicalOperationStatus(op.status) === 'Reportado').slice(0,6);
      const criticalTable = document.getElementById('dashboardCriticalTable');
      if (criticalTable) {
        criticalTable.innerHTML = criticalOps.length ? criticalOps.map(op => `
          <tr>
            <td><strong>${op.code}</strong></td>
            <td>${op.title}</td>
            <td>${getOperationLocation(op)}</td>
            <td>${statusBadge(op.status)}</td>
            <td>${getAssigneeDisplayName(op.technician, op.type)}</td>
          </tr>`).join('') : '<tr><td colspan="5"><div class="dashboard-empty">No hay reportes pendientes de asignación.</div></td></tr>';
      }

      const activityEl = document.getElementById('dashboardActivityTimeline');
      if (activityEl) {
        let entries = [];
        try {
          entries = (typeof getAllHistoryEntries === 'function' ? getAllHistoryEntries() : [])
            .filter(item => item && item.operationId)
            .slice(0, 8);
        } catch(e) { entries = []; }
        if (!entries.length) {
          const recentOps = operations.slice(0, 8);
          entries = recentOps.map(op => ({
            operationId: op.id,
            code: op.code,
            title: op.title,
            agency: getOperationLocation(op),
            action: op.status || 'Actividad',
            detail: op.description || 'Movimiento registrado en operaciones.',
            user: op.updatedBy || op.createdBy || getAssigneeDisplayName(op.technician, op.type) || 'Sistema LOTEKA',
            timestamp: op.updatedAt || op.createdAt || new Date().toISOString()
          }));
        }
        activityEl.innerHTML = entries.length ? entries.map(item => {
          const actionText = String(item.action || 'Actividad');
          const actionSlug = actionText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
          const dateText = item.timestamp ? formatDate(item.timestamp) : '-';
          return `<button type="button" class="opdash-activity-item-v210" onclick="showDetail('${String(item.operationId).replace(/'/g, '\&#39;')}')">
            <span class="opdash-activity-icon-v210 ${actionSlug}"><i class="fas fa-clock-rotate-left"></i></span>
            <span class="opdash-activity-main-v210">
              <strong>${escapeHtml(item.code || 'Operación')} · ${escapeHtml(actionText)}</strong>
              <small>${escapeHtml(item.title || item.detail || 'Movimiento registrado.')}</small>
              <em>${escapeHtml(item.agency || '-')} · ${escapeHtml(item.user || 'Sistema LOTEKA')}</em>
            </span>
            <span class="opdash-activity-time-v210">${escapeHtml(dateText)}</span>
          </button>`;
        }).join('') : '<div class="dashboard-empty">Aún no hay movimientos recientes para mostrar.</div>';
      }
    }

    function showView(viewName) {
        if(String(viewName||'').toLowerCase().includes('workshop')) return;
['dashboardView','operationsView','levantamientosView','historyView','reportsView','reportsAgencyView','reportsOwnerView','reportsSpecificView','usersView','suppliersView','worksView','issuesView'].forEach(id => { const node = document.getElementById(id); if(node) node.classList.add('hidden'); });
      ['navDashboard','navOperations','navLevantamientos','navHistory','navReports','navReportsAgency','navReportsOwner','navReportsSpecific','navUsers','navSuppliers','navWorks','navIssues'].forEach(id => { const node = document.getElementById(id); if(node) node.classList.remove('active'); });
      if (viewName === 'dashboard') {
        document.getElementById('dashboardView').classList.remove('hidden');
        document.getElementById('navDashboard').classList.add('active');
        renderDashboard();
      } else if (viewName === 'operations') {
        document.getElementById('operationsView').classList.remove('hidden');
        document.getElementById('navOperations').classList.add('active');
      } else if (viewName === 'levantamientos') {
        document.getElementById('levantamientosView').classList.remove('hidden');
        document.getElementById('navLevantamientos').classList.add('active');
        if (typeof levRender === 'function') levRender();
      } else if (viewName === 'history') {
        document.getElementById('historyView').classList.remove('hidden');
        document.getElementById('navHistory').classList.add('active');
        renderHistory();
      } else if (viewName === 'reports') {
        document.getElementById('reportsView').classList.remove('hidden');
        document.getElementById('navReports').classList.add('active');
        renderReports();
      } else if (viewName === 'reportsAgency') {
        document.getElementById('reportsAgencyView').classList.remove('hidden');
        document.getElementById('navReportsAgency').classList.add('active');
        renderAgencyReports();
      } else if (viewName === 'reportsOwner') {
        document.getElementById('reportsOwnerView').classList.remove('hidden');
        document.getElementById('navReportsOwner').classList.add('active');
        renderOwnerReports();
      } else if (viewName === 'reportsSpecific') {
        document.getElementById('reportsSpecificView').classList.remove('hidden');
        document.getElementById('navReportsSpecific').classList.add('active');
        renderSpecificReports();
      } else if (viewName === 'users') {
        document.getElementById('usersView').classList.remove('hidden');
        document.getElementById('navUsers').classList.add('active');
        renderGenericTable('users', userSearch.value || '');
      } else if (viewName === 'suppliers') {
        document.getElementById('suppliersView').classList.remove('hidden');
        document.getElementById('navSuppliers').classList.add('active');
        renderGenericTable('suppliers', supplierSearch.value || '');
      } else if (viewName === 'works') {
        document.getElementById('worksView').classList.remove('hidden');
        document.getElementById('navWorks').classList.add('active');
        renderGenericTable('work', workSearch.value || '');
      } else if (viewName === 'issues') {
        document.getElementById('issuesView').classList.remove('hidden');
        document.getElementById('navIssues').classList.add('active');
        renderGenericTable('issue', issueSearch.value || '');
      }
    }

    function refreshOpenTypeSelectors() {
      renderTypeOptions('operationTypeOptions', document.getElementById('operationType')?.value || 'Avería', getSelectedValues('operationTypeOptions'));
      renderTypeOptions('editOperationTypeOptions', document.getElementById('editOperationType')?.value || 'Avería', getSelectedValues('editOperationTypeOptions'));
      renderAssigneeOptions('operationTechnician', document.getElementById('operationType')?.value || 'Avería', document.getElementById('operationTechnician')?.value || '');
      renderAssigneeOptions('editOperationTechnician', document.getElementById('editOperationType')?.value || 'Avería', document.getElementById('editOperationTechnician')?.value || '');
    }

    async function createCatalogItem(type) {
      if (type === 'users') {
        const name = prompt('Nombre visible del usuario:', 'Técnico');
        if (!name || !name.trim()) return;
        const username = slugifyUsername(prompt('Username de acceso:', slugifyUsername(name)) || slugifyUsername(name));
        if (!username) return;
        const area = prompt('Área o especialidad:', '') || '';
        const phone = prompt('Teléfono:', '') || '';
        if (USERS.some(x => slugifyUsername(x.username) === username)) { alert('Ya existe un usuario con ese username.'); return; }
        USERS.push({ name: name.trim(), username, area: area.trim(), phone: phone.trim() });
        saveCatalogs(); renderCurrentCatalogView(); return;
      }
      if (type === 'suppliers') {
        const name = prompt('Nombre del suplidor:');
        if (!name || !name.trim()) return;
        const service = prompt('Servicio que ofrece:') || '';
        const phone = prompt('Teléfono:') || '';
        if (SUPPLIERS.some(x => x.name.toLowerCase() === name.trim().toLowerCase())) return;
        SUPPLIERS.push({ name: name.trim(), service: service.trim(), phone: phone.trim() });
        saveCatalogs(); renderCurrentCatalogView(); return;
      }
      const label = type === 'work' ? 'trabajo' : 'avería';
      const name = prompt(`Nombre del ${label}:`);
      if (!name || !name.trim()) return;
      const description = prompt('Descripción:') || '';
      const list = type === 'work' ? WORK_TYPES : ISSUE_TYPES;
      if (list.some(x => x.name.toLowerCase() === name.trim().toLowerCase())) { alert(`Ya existe ${label === 'avería' ? 'una' : 'un'} ${label} con ese nombre.`); return; }
      try {
        await saveCloudOperationCatalogItem(type,{name:name.trim(),description:description.trim(),order:list.length + 1});
      } catch (error) {
        alert(`No se pudo guardar en Supabase: ${error?.message || error}`);
      }
    }

    async function editCatalogItem(type, index) {
      let list = [];
      if (type === 'users') list = USERS;
      else if (type === 'suppliers') list = SUPPLIERS;
      else if (type === 'work') list = WORK_TYPES;
      else list = ISSUE_TYPES;
      const item = list[index];
      if (!item) return;

      if (type === 'users') {
        const name = prompt('Editar nombre visible:', item.name);
        if (!name || !name.trim()) return;
        const username = slugifyUsername(prompt('Editar username:', item.username || slugifyUsername(item.name)) || item.username || slugifyUsername(item.name));
        if (!username) return;
        if (USERS.some((x, idx) => idx !== index && slugifyUsername(x.username) === username)) { alert('Ya existe otro usuario con ese username.'); return; }
        const area = prompt('Editar área:', item.area || '') || '';
        const phone = prompt('Editar teléfono:', item.phone || '') || '';
        list[index] = { name: name.trim(), username, area: area.trim(), phone: phone.trim() };
        saveCatalogs(); renderCurrentCatalogView(); return;
      }
      if (type === 'suppliers') {
        const name = prompt('Editar nombre:', item.name);
        if (!name || !name.trim()) return;
        const service = prompt('Editar servicio:', item.service || '') || '';
        const phone = prompt('Editar teléfono:', item.phone || '') || '';
        list[index] = { name: name.trim(), service: service.trim(), phone: phone.trim() };
        saveCatalogs(); renderCurrentCatalogView(); return;
      }
      const name = prompt('Editar nombre:', item.name);
      if (!name || !name.trim()) return;
      const description = prompt('Editar descripción:', item.description || '') || '';
      try {
        await saveCloudOperationCatalogItem(type,{...item,name:name.trim(),description:description.trim()});
      } catch (error) {
        alert(`No se pudo actualizar en Supabase: ${error?.message || error}`);
      }
    }

    async function deleteCatalogItem(type, index) {
      if (type === 'users') { USERS.splice(index, 1); saveCatalogs(); renderCurrentCatalogView(); return; }
      if (type === 'suppliers') { SUPPLIERS.splice(index, 1); saveCatalogs(); renderCurrentCatalogView(); return; }
      const list = type === 'work' ? WORK_TYPES : ISSUE_TYPES;
      const item = list[index];
      if (!item) return;
      if (!confirm(`¿Desactivar “${item.name}”? Dejará de aparecer al crear operaciones, pero las operaciones anteriores conservarán el dato.`)) return;
      try {
        await deactivateCloudOperationCatalogItem(item);
      } catch (error) {
        alert(`No se pudo desactivar en Supabase: ${error?.message || error}`);
      }
    }

    function viewCatalogItem(type, index) {
      let item = null;
      if (type === 'users') item = USERS[index];
      else if (type === 'suppliers') item = SUPPLIERS[index];
      else if (type === 'work') item = WORK_TYPES[index];
      else item = ISSUE_TYPES[index];
      if (!item) return;
      const lines = Object.entries(item).map(([key, value]) => `${key}: ${value || ''}`);
      alert(lines.join('\n'));
    }

    function renderCurrentCatalogView() {
      if (!document.getElementById('usersView').classList.contains('hidden')) renderGenericTable('users', userSearch.value || '');
      if (!document.getElementById('suppliersView').classList.contains('hidden')) renderGenericTable('suppliers', supplierSearch.value || '');
      if (!document.getElementById('worksView').classList.contains('hidden')) renderGenericTable('work', workSearch.value || '');
      if (!document.getElementById('issuesView').classList.contains('hidden')) renderGenericTable('issue', issueSearch.value || '');
    }

    function buildLegacyBackendCeroPayloadFromOperation(op) {
      const normalized = enrichOperationWithAgencyContext(op);
      const locationAgencyNumber = normalizeAgencyNumber(normalized.agency_number || normalized.agency || normalized.agencia || '');
      const locationAgencyDisplay = String(normalized.agency_label || normalized.agency || normalized.agencia || '').trim();
      return {
        id: normalized.id,
        code: normalized.code,
        tipo_reporte: normalized.type,
        categoria: normalized.title,
        descripcion: normalized.description,
        agencia: locationAgencyNumber,
        agencia_display: locationAgencyDisplay,
        grupo: normalized.grupo || '',
        nombre_encargado: normalized.nombre_encargado || normalized.created_by || 'Sistema web',
        creado_por: normalized.created_by || normalized.nombre_encargado || getCurrentUserEmail(),
        fecha_reporte: normalized.createdAt || nowIso(),
        estado: normalizeRemoteStatus(normalized.status),
        asignado_a: normalized.type === 'Trabajo' ? (normalized.technician || 'Sin asignar') : normalizeStoredAssignee(normalized.technician, normalized.type),
        selected_types: Array.isArray(normalized.selectedTypes) ? normalized.selectedTypes : getOperationSpecificTypes(normalized),
        images: getSafeMediaList(normalized.images),
        result_images: getSafeMediaList(normalized.resultImages),
        assigned_at: normalized.assignedAt || null,
        started_at: normalized.startedAt || null,
        completed_at: normalized.completedAt || null,
        resolution_time: normalized.resolutionTime || '',
        closed_at: normalized.closedAt || null,
        source: normalized.source || 'web_operacional',
        history: Array.isArray(normalized.history) ? normalized.history : []
      };
    }

    function buildBackendCeroPayloadFromOperation(op = {}) {
      const normalized = enrichOperationWithAgencyContext(op);
      const imageList = getSafeMediaList(normalized.resultImages).length
        ? getSafeMediaList(normalized.resultImages)
        : getSafeMediaList(normalized.images);
      return {
        titulo: String(normalized.title || normalized.categoria || 'Reporte').slice(0, 500),
        descripcion: String(normalized.description || normalized.descripcion || '').slice(0, 5000),
        estado: normalizeRemoteStatus(normalized.status || normalized.estado || 'Pendiente'),
        agencia: String(normalized.agency_number || normalized.agencia || normalizeAgencyNumber(normalized.agency || '') || normalized.agency || '').slice(0, 255),
        grupo: String(normalized.grupo || '').slice(0, 255),
        tecnico: String(normalized.technician || normalized.asignado_a || 'Sin asignar').slice(0, 255),
        encargado: String(normalized.nombre_encargado || normalized.created_by || normalized.encargado || getCurrentUserEmail() || 'Sistema web').slice(0, 255),
        foto_url: String(imageList[0] || normalized.foto_url || '').slice(0, 2000),
        fecha_creacion: normalized.createdAt || normalized.fecha_creacion || normalized.fecha_reporte || nowIso()
      };
    }

    function mapBackendCeroDocumentToOperation(item, fallbackIndex = 0, existing = null) {
      const title = item.titulo || existing?.title || 'Reporte';
      const agencyNumber = normalizeAgencyNumber(item.agencia || existing?.agency_number || existing?.agency || '');
      const createdAt = item.fecha_creacion || item.$createdAt || existing?.createdAt || nowIso();
      const status = normalizeRemoteStatus(item.estado || existing?.status || 'Pendiente');
      const technician = normalizeStoredAssignee(item.tecnico || existing?.technician || 'Sin asignar', existing?.type || 'Avería');
      const baseImages = getSafeMediaList(existing?.images);
      const backendCeroImage = String(item.foto_url || '').trim();
      const images = baseImages.length ? baseImages : (backendCeroImage ? [backendCeroImage] : []);

      return enrichOperationWithAgencyContext({
        id: item.$id || existing?.id || crypto.randomUUID(),
        code: existing?.code || `OP-${String(fallbackIndex + 1).padStart(4, '0')}`,
        type: existing?.type || 'Avería',
        title,
        agency: existing?.agency_label || existing?.agency || (agencyNumber ? normalizeAgencyLabel(agencyNumber) : (item.agencia || '')),
        agency_number: agencyNumber,
        agency_label: existing?.agency_label || (agencyNumber ? normalizeAgencyLabel(agencyNumber) : (item.agencia || '')),
        technician,
        status,
        description: item.descripcion || existing?.description || '',
        selectedTypes: Array.isArray(existing?.selectedTypes) && existing.selectedTypes.length ? existing.selectedTypes : (title ? [title] : []),
        createdAt,
        images,
        resultImages: getSafeMediaList(existing?.resultImages),
        assignedAt: existing?.assignedAt || null,
        startedAt: existing?.startedAt || null,
        completedAt: existing?.completedAt || null,
        resolutionTime: existing?.resolutionTime || '',
        closedAt: existing?.closedAt || null,
        history: Array.isArray(existing?.history) && existing.history.length
          ? existing.history
          : [createHistoryEntry({ action: 'Creación', detail: 'Operación creada en BackendCero', user: item.encargado || 'Sistema web', newStatus: status })],
        source: 'web_operacional',
        grupo: item.grupo || existing?.grupo || '',
        nombre_encargado: item.encargado || existing?.nombre_encargado || '',
        created_by: item.encargado || existing?.created_by || ''
      });
    }

    // Compatibilidad interna: cualquier parte vieja que llame el nombre anterior queda redirigida.
    function mapBackendCeroReportToOperation(item, fallbackIndex = 0, existing = null) {
      return mapBackendCeroDocumentToOperation(item, fallbackIndex, existing);
    }

    async function syncOperationToBackendCero(op) {
      // MOTOR BACKEND_CERO: crea o actualiza SIEMPRE la operación en la colección operaciones.
      try {
        if (!op || !op.id) return null;
        const documentId = String(op.$id || op.backendCero_id || op.id).trim();
        const payload = buildBackendCeroPayloadFromOperation(op);
        let savedDoc = null;

        try {
          savedDoc = await backendCeroDatabases.updateDocument(
            BACKEND_CERO_DATABASE_ID,
            BACKEND_CERO_OPERACIONES_COLLECTION_ID,
            documentId,
            payload
          );
          console.info('✅ BackendCero actualizado:', savedDoc.$id, payload);
        } catch (updateError) {
          const code = updateError?.code || updateError?.response?.code;
          const msg = String(updateError?.message || '').toLowerCase();
          if (code === 404 || msg.includes('not found') || msg.includes('document with the requested id could not be found')) {
            savedDoc = await backendCeroDatabases.createDocument(
              BACKEND_CERO_DATABASE_ID,
              BACKEND_CERO_OPERACIONES_COLLECTION_ID,
              documentId,
              payload
            );
            console.info('✅ BackendCero creado:', savedDoc.$id, payload);
          } else {
            throw updateError;
          }
        }

        op.id = savedDoc.$id;
        op.backendCero_id = savedDoc.$id;
        op.$id = savedDoc.$id;
        return savedDoc;
      } catch (error) {
        console.error('❌ Error sincronizando operación con BackendCero:', error);
        if (typeof showToastNotification === 'function') {
          showToastNotification('BackendCero no sincronizó', (error && error.message) ? error.message : 'La operación quedó local, pero no pudo guardarse en BackendCero.', 'warning');
        }
        return null;
      }
    }

    async function deleteOperationFromBackendCero(id) {
      // Ahora elimina en BackendCero. Se mantiene el nombre para no romper llamadas internas del HTML.
      try {
        if (!id) return;
        await backendCeroDatabases.deleteDocument(
          BACKEND_CERO_DATABASE_ID,
          BACKEND_CERO_OPERACIONES_COLLECTION_ID,
          id
        );
      } catch (error) {
        const code = error?.code || error?.response?.code;
        if (code !== 404) console.error('Error eliminando operación en BackendCero:', error);
      }
    }

    const NOTIFY_STORAGE_KEY = 'loteka_ops_notifications_enabled';
    let notificationsEnabled = localStorage.getItem(NOTIFY_STORAGE_KEY) === 'true';
    let syncInitialized = false;
    let previousNotificationSnapshot = new Map();
    let syncInFlight = false;
    let realtimeChannel = null;
    let realtimeReconnectTimer = null;
    let realtimeConnected = false;

    function updateNotificationButtonState() {
      const btn = document.getElementById('dashboardNotifyBtn');
      if (!btn) return;
      btn.classList.toggle('active', notificationsEnabled);
      btn.innerHTML = notificationsEnabled
        ? '<i class="fas fa-bell"></i> Notificaciones activas'
        : '<span class="dot"></span> Activar notificaciones';
    }

    async function requestNotificationPermissionIfNeeded() {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('No se pudo solicitar permiso de notificaciones:', error);
        return false;
      }
    }

    function playNotificationSound() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.linearRampToValueAtTime(700, now + 0.18);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.11, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.56);
      } catch (error) {
        console.error('No se pudo reproducir el sonido de notificación:', error);
      }
    }

    function showToastNotification(title, text, tone = 'info') {
      const wrap = document.getElementById('opsToastWrap');
      if (!wrap) return;
      const iconMap = { info: 'fa-bell', success: 'fa-circle-check', warning: 'fa-triangle-exclamation' };
      const toast = document.createElement('div');
      toast.className = `ops-toast ${tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : ''}`.trim();
      toast.innerHTML = `
        <div class="ops-toast-icon"><i class="fas ${iconMap[tone] || iconMap.info}"></i></div>
        <div><div class="ops-toast-title">${escapeHtml(title)}</div><div class="ops-toast-text">${escapeHtml(text)}</div></div>
        <button type="button" class="ops-toast-close" aria-label="Cerrar notificación"><i class="fas fa-xmark"></i></button>
      `;
      const closeBtn = toast.querySelector('.ops-toast-close');
      closeBtn?.addEventListener('click', () => toast.remove());
      wrap.prepend(toast);
      window.setTimeout(() => toast.remove(), 8200);
    }

    function dispatchBrowserNotification(title, body, tone = 'info') {
      if (!notificationsEnabled) return;
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
        try {
          new Notification(title, { body, icon: '' });
        } catch (error) {
          console.error('No se pudo mostrar la notificación del navegador:', error);
        }
      }
      playNotificationSound();
      showToastNotification(title, body, tone);
    }

    function buildNotificationSnapshot(operations) {
      return new Map((operations || []).map(op => {
        const history = Array.isArray(op.history) ? op.history : [];
        const lastHistory = history.length ? history[history.length - 1] : null;
        return [op.id, {
          status: op.status || 'Pendiente',
          assigned: op.technician || 'Sin asignar',
          updated: op.completedAt || op.startedAt || op.assignedAt || op.createdAt || '',
          historyKey: lastHistory ? `${lastHistory.action || ''}|${lastHistory.newStatus || ''}|${lastHistory.timestamp || lastHistory.date || ''}` : '',
          code: op.code || '',
          agency: op.agency || '',
          title: op.title || ''
        }];
      }));
    }

    function evaluateOperationNotifications(operations) {
      const nextSnapshot = buildNotificationSnapshot(operations);
      if (!syncInitialized) {
        previousNotificationSnapshot = nextSnapshot;
        syncInitialized = true;
        return;
      }
      const notices = [];
      nextSnapshot.forEach((current, id) => {
        const previous = previousNotificationSnapshot.get(id);
        if (!previous) {
          notices.push({
            title: 'Nueva operación recibida',
            text: `${current.code || 'Sin código'} · ${current.agency || 'Sin agencia'} · ${current.title || 'Sin categoría'}`,
            tone: 'success'
          });
          return;
        }
        if (previous.status !== current.status) {
          notices.push({
            title: 'Cambio de estado',
            text: `${current.code || 'Operación'} cambió de ${previous.status} a ${current.status}.`,
            tone: current.status === 'Completado' ? 'success' : 'info'
          });
          return;
        }
        if (previous.assigned !== current.assigned && current.assigned && current.assigned !== 'Sin asignar') {
          notices.push({
            title: 'Operación asignada',
            text: `${current.code || 'Operación'} fue asignada a ${getAssigneeDisplayName(current.assigned, 'Avería')}.`,
            tone: 'info'
          });
          return;
        }
        if (previous.historyKey !== current.historyKey && current.historyKey) {
          notices.push({
            title: 'Actualización de seguimiento',
            text: `${current.code || 'Operación'} registró un nuevo movimiento en seguimiento.`,
            tone: 'info'
          });
        }
      });
      previousNotificationSnapshot = nextSnapshot;
      notices.slice(0, 4).forEach(item => dispatchBrowserNotification(item.title, item.text, item.tone || 'info'));
    }

    async function runOperationalRefresh({ silent = false, skipSuccessToast = false } = {}) {
      if (syncInFlight) return;
      syncInFlight = true;
      try {
        await syncOperationsFromBackendCero({ silent, skipSuccessToast });
      } finally {
        syncInFlight = false;
      }
    }

    async function syncOperationsFromBackendCero({ silent = false, skipSuccessToast = false } = {}) {
      return false;
      try {
        const response = await backendCeroDatabases.listDocuments(
          BACKEND_CERO_DATABASE_ID,
          BACKEND_CERO_OPERACIONES_COLLECTION_ID,
          [backendCeroQuery.orderAsc('fecha_creacion'), backendCeroQuery.limit(500)]
        );
        const data = response?.documents || [];
        const allLocalOps = loadOperations();
        const existingById = new Map(allLocalOps.map(op => [op.id, op]));
        const localOnly = allLocalOps.filter(op => op.source !== 'web_operacional');
        const mergedRemote = data.map((item, index) => mapBackendCeroDocumentToOperation(item, index, existingById.get(item.$id)));
        const map = new Map();
        [...localOnly, ...mergedRemote].forEach(op => map.set(op.id, op));
        const next = Array.from(map.values()).map(op => enrichOperationWithAgencyContext(op));
        saveOperations(next);
        renderOperations();
        renderHistory();
        renderReports();
        renderAgencyReports();
        renderOwnerReports();
        renderSpecificReports();
        evaluateOperationNotifications(next);
        if (!silent && !skipSuccessToast) showToastNotification('Sistema actualizado', 'Operaciones sincronizadas correctamente desde BackendCero.', 'success');
      } catch (error) {
        console.error('Error cargando operaciones desde BackendCero:', error);
        if (!silent) showToastNotification('No se pudo actualizar', 'Hubo un problema sincronizando con BackendCero. Revisa permisos de la colección.', 'warning');
      }
    }


    function handleRealtimeOperationEvent(payload) {
      const events = Array.isArray(payload?.events) ? payload.events : [];
      const record = payload?.payload || {};
      const isCreate = events.some(event => event.includes('.create'));
      const isUpdate = events.some(event => event.includes('.update'));
      const isDelete = events.some(event => event.includes('.delete'));
      const code = record?.$id || 'Operación';
      const agency = record?.agencia || record?.grupo || 'Sin ubicación';
      const category = record?.titulo || 'Sin categoría';
      const state = record?.estado || '';

      if (isCreate) {
        dispatchBrowserNotification('Nueva operación recibida', `${code} · ${agency} · ${category}`, 'success');
      } else if (isUpdate) {
        dispatchBrowserNotification('Operación actualizada', `${code}${state ? ` · ${state}` : ''}`, state === 'Completado' ? 'success' : 'info');
      } else if (isDelete) {
        dispatchBrowserNotification('Operación eliminada', `${code} fue removida del tablero.`, 'warning');
      }
      runOperationalRefresh({ silent: true, skipSuccessToast: true });
    }

    function initializeRealtimeSync() {
      if (!backendCeroClient || realtimeChannel) return;
      try {
        const channel = `databases.${BACKEND_CERO_DATABASE_ID}.collections.${BACKEND_CERO_OPERACIONES_COLLECTION_ID}.documents`;
        realtimeChannel = backendCeroClient.subscribe(channel, (payload) => {
          realtimeConnected = true;
          handleRealtimeOperationEvent(payload);
        });
        realtimeConnected = true;
        console.info('Realtime BackendCero activo para operaciones');
      } catch (error) {
        realtimeConnected = false;
        console.error('No se pudo activar Realtime BackendCero:', error);
        if (!realtimeReconnectTimer) {
          realtimeReconnectTimer = window.setTimeout(() => {
            realtimeReconnectTimer = null;
            realtimeChannel = null;
            initializeRealtimeSync();
          }, 3000);
        }
      }
    }

    function openCreateModal() {
      syncOperationCatalogsFromSupabase().catch(() => false);
      createModalBackdrop.classList.remove('hidden');
      createError.classList.add('hidden');
      createError.textContent = '';
      renderTypeOptions('operationTypeOptions', document.getElementById('operationType').value, []);
      updateTechnicianLabel('operationType', 'labelTechnician', 'operationTechnician');
      renderAssigneeOptions('operationTechnician', document.getElementById('operationType').value, '');
      populateOperationAgencyOptions('');
    }

    function closeCreateModal() {
      createModalBackdrop.classList.add('hidden');
      document.getElementById('operationType').value = 'Avería';
      document.getElementById('operationStatus').value = 'Reportado';
      document.getElementById('operationTitle').value = '';
      populateOperationAgencyOptions('');
      document.getElementById('operationDescription').value = '';
      document.getElementById('operationImage').value = '';
      renderTypeOptions('operationTypeOptions', 'Avería', []);
      updateTechnicianLabel('operationType', 'labelTechnician', 'operationTechnician');
      renderAssigneeOptions('operationTechnician', 'Avería', '');
    }

    function closeDetailModal() {
      detailModalBackdrop.classList.add('hidden');
      detailContent.innerHTML = '';
    }

    function closeEditModal() {
      editModalBackdrop.classList.add('hidden');
    }

    function nextCode(operations) {
      return `OP-${String(operations.length + 1).padStart(4, '0')}`;
    }

    document.getElementById('saveOperationBtn').addEventListener('click', async () => {
      const type = document.getElementById('operationType').value;
      const status = document.getElementById('operationStatus').value;
      const title = document.getElementById('operationTitle').value.trim();
      const agencyInput = String(document.getElementById('operationAgency').value || '').trim();
      const agencyNumber = normalizeAgencyNumber(agencyInput);
      const agency = agencyNumber ? normalizeAgencyLabel(agencyNumber) : agencyInput;
      const technician = (type === 'Trabajo' ? document.getElementById('operationTechnician').value.trim() : normalizeStoredAssignee(document.getElementById('operationTechnician').value.trim(), type)) || 'Sin asignar';
      const description = document.getElementById('operationDescription').value.trim();
      const imageFiles = Array.from(document.getElementById('operationImage').files || []);
      const selectedTypes = getSelectedValues('operationTypeOptions');

      if (!title || !agencyNumber || !description) {
        createError.textContent = 'Completa título, agencia válida y descripción.';
        createError.classList.remove('hidden');
        return;
      }

      if (!selectedTypes.length) {
        createError.textContent = 'Debes seleccionar al menos un tipo específico.';
        createError.classList.remove('hidden');
        return;
      }

      if (status === 'Pendiente' && technician !== 'Sin asignar') {
        createError.textContent = 'Una operación pendiente no puede tener técnico o suplidor asignado.';
        createError.classList.remove('hidden');
        return;
      }

      if (isAssignedStatus(status) && technician === 'Sin asignar') {
        createError.textContent = 'Debes asignar un técnico o suplidor antes de pasar la operación a ese estado.';
        createError.classList.remove('hidden');
        return;
      }

      if (status === 'En proceso' || status === 'Completado') {
        createError.textContent = 'Solo puedes crear operaciones en Pendiente o Asignada.';
        createError.classList.remove('hidden');
        return;
      }

      const operations = loadOperations();
      let newOperation = {
        id: crypto.randomUUID(),
        code: nextCode(operations),
        type,
        title,
        agency,
        agency_number: agencyNumber,
        agency_label: agency,
        technician,
        status,
        description,
        selectedTypes,
        created_by: getCurrentOperationUserDisplayName(),
        nombre_encargado: getCurrentOperationUserDisplayName(),
        reportado_por_nombre: getCurrentOperationUserDisplayName(),
        createdAt: nowIso(),
        images: [],
        resultImages: [],
        assignedAt: technician && technician !== 'Sin asignar' ? nowIso() : null,
        startedAt: null,
        completedAt: null,
        resolutionTime: '',
        closedAt: null,
        history: [
          createHistoryEntry({ action: 'Creación', detail: 'Operación creada', user: getCurrentUserEmail(), newStatus: 'Pendiente' }),
          ...(technician && technician !== 'Sin asignar' ? [createHistoryEntry({ action: 'Asignación', detail: `Asignada a ${getAssigneeDisplayName(technician, type)}`, user: getCurrentUserEmail() })] : []),
          ...(status === 'Asignada' ? [createHistoryEntry({ action: 'Estado', detail: 'Estado inicial establecido en Asignada', user: getCurrentUserEmail(), prevStatus: 'Pendiente', newStatus: 'Asignada' })] : []),
          ...(status === 'En proceso' ? [createHistoryEntry({ action: 'Inicio', detail: 'Operación iniciada', user: getCurrentUserEmail(), prevStatus: technician && technician !== 'Sin asignar' ? 'Asignada' : 'Pendiente', newStatus: 'En proceso' })] : []),
          ...(status === 'Completado' ? [createHistoryEntry({ action: 'Finalización', detail: 'Operación completada', user: getCurrentUserEmail(), prevStatus: technician && technician !== 'Sin asignar' ? 'Asignada' : 'Pendiente', newStatus: 'Completado' })] : [])
        ]
      };

      newOperation = enrichOperationWithAgencyContext(newOperation);

      if (imageFiles.length) {
        let loaded = 0;
        const results = [];
        imageFiles.forEach((file, idx) => {
          const reader = new FileReader();
          reader.onload = async function(e) {
            results[idx] = e.target.result;
            loaded++;
            if (loaded === imageFiles.length) {
              newOperation.images = results.filter(Boolean);
              operations.push(newOperation);
              saveOperations(operations);
              await syncOperationToBackendCero(newOperation);
              saveOperations(operations);
              renderOperations();
              renderHistory();
              renderReports();
              closeCreateModal();
            }
          };
          reader.readAsDataURL(file);
        });
      } else {
        operations.push(newOperation);
        saveOperations(operations);
        await syncOperationToBackendCero(newOperation);
        saveOperations(operations);
        renderOperations();
        renderHistory();
        renderReports();
        closeCreateModal();
      }
    });

    function getOperationHeadline(op = {}) {
      const code = String(op.code || '').trim() || 'Sin código';
      const category = String(op.title || '').trim() || 'Sin categoría';
      const location = getOperationLocation(op);
      return { code, category, location };
    }

    function getCompactHistoryEntry(op, actionName) {
      const history = Array.isArray(op.history) ? op.history : [];
      return history.find(item => String(item.action || '').trim() === actionName) || null;
    }

    function buildDetailTimeline(op) {
      const assignedLabel = op.type === 'Trabajo' ? 'Suplidor' : 'Técnico';
      const assignedDisplay = getAssigneeDisplayName(op.technician, op.type);
      const creationEntry = getCompactHistoryEntry(op, 'Creación');
      const assignmentEntry = getCompactHistoryEntry(op, 'Asignación') || getCompactHistoryEntry(op, 'Estado');
      const startEntry = getCompactHistoryEntry(op, 'Inicio') || (op.status === 'En proceso' ? getCompactHistoryEntry(op, 'Estado') : null);
      const completionEntry = getCompactHistoryEntry(op, 'Finalización') || (op.status === 'Completado' ? getCompactHistoryEntry(op, 'Estado') : null);
      const resolutionMinutes = getResolutionMinutes(op);
      const resolutionLabel = resolutionMinutes !== null ? formatMinutesHuman(resolutionMinutes) : '';

      const steps = [
        {
          label: 'Reporte recibido',
          icon: '<i class="fa-solid fa-file-circle-plus"></i>',
          state: 'done',
          detail: (creationEntry && creationEntry.detail) || `Se registró ${op.type === 'Trabajo' ? 'el trabajo' : 'la avería'} en el sistema.`,
          date: formatDate((creationEntry && getHistoryTimestamp(creationEntry)) || op.createdAt)
        },
        {
          label: op.type === 'Trabajo' ? 'Suplidor asignado' : 'Técnico asignado',
          icon: '<i class="fa-solid fa-user-gear"></i>',
          state: assignedDisplay !== 'Sin asignar' ? (op.status === 'Pendiente' ? 'active' : 'done') : 'pending',
          detail: assignedDisplay !== 'Sin asignar' ? `${assignedLabel} asignado: ${assignedDisplay}` : `${assignedLabel} pendiente por asignar.`,
          date: assignedDisplay !== 'Sin asignar' ? formatDate((assignmentEntry && getHistoryTimestamp(assignmentEntry)) || op.assignedAt || op.createdAt) : ''
        },
        {
          label: 'En proceso',
          icon: '<i class="fa-solid fa-truck-fast"></i>',
          state: op.status === 'En proceso' ? 'active' : (op.status === 'Completado' ? 'done' : 'pending'),
          detail: op.status === 'En proceso' || op.status === 'Completado' ? ((startEntry && startEntry.detail) || 'La operación ya está en gestión.') : 'Aún no ha iniciado la gestión.',
          date: (op.status === 'En proceso' || op.status === 'Completado') ? formatDate((startEntry && getHistoryTimestamp(startEntry)) || op.startedAt || op.assignedAt || op.createdAt) : ''
        },
        {
          label: 'Completado',
          icon: '<i class="fa-solid fa-circle-check"></i>',
          state: op.status === 'Completado' ? 'done' : 'pending',
          detail: op.status === 'Completado'
            ? `${((completionEntry && completionEntry.detail) || 'La operación fue completada correctamente.')}${resolutionLabel ? ` · Tiempo de resolución de la avería: ${resolutionLabel}` : ''}`
            : 'Todavía no ha sido completado.',
          date: op.status === 'Completado' ? formatDate((completionEntry && getHistoryTimestamp(completionEntry)) || op.completedAt || op.closedAt || op.createdAt) : ''
        }
      ];

      return `<div class="ops-detail-timeline">${steps.map(step => `
        <div class="ops-detail-step ${step.state}">
          <div class="ops-detail-step-icon">${step.icon}</div>
          <div class="ops-detail-step-body">
            <strong>${step.label}</strong>
            <p>${step.detail}</p>
            ${step.date ? `<small>${step.date}</small>` : ''}
          </div>
        </div>
      `).join('')}</div>`;
    }

    function showDetail(id) {
      currentDetailOperationId = id;
      if (detailPrintBtn) detailPrintBtn.onclick = () => printOperation(id);
      const loadedOperation = loadOperations().find(item => item.id === id);
      if (!loadedOperation) return;
      const op = enrichOperationWithAgencyContext(loadedOperation);
      const assignedLabel = op.type === 'Trabajo' ? 'Suplidor asignado' : 'Técnico asignado';
      const assignedDisplay = getAssigneeDisplayName(op.technician, op.type);
      const headline = getOperationHeadline(op);
      const selectedTypes = getOperationSpecificTypes(op);
      const lastUpdate = op.status === 'Completado'
        ? (op.completedAt || op.closedAt || op.createdAt)
        : (op.startedAt || op.assignedAt || op.createdAt);
      const agencyRecord = findAgencyRecord(op.agency);
      const summaryCards = [
        { label: 'Tipo', value: op.type || 'No registrado' },
        { label: 'Agencia', value: op.agency || 'No registrada' },
        { label: 'Grupo', value: op.grupo || (agencyRecord?.grupo || 'No registrado') },
        { label: 'Reportado por', value: getOperationReporter(op) },
        { label: assignedLabel, value: assignedDisplay },
        { label: 'Fecha de reporte', value: formatDate(op.createdAt) },
        { label: 'Última actualización', value: formatDate(lastUpdate) }
      ];
      const mapsUrl = agencyRecord ? buildAgencyMapsSearchUrl(agencyRecord) : '#';
      const directionsUrl = agencyRecord ? buildAgencyMapsDirectionsUrl(agencyRecord) : '#';
      const geoText = agencyRecord ? formatAgencyGeoText(agencyRecord) : 'Sin coordenadas registradas';

      detailContent.innerHTML = `
        <div class="ops-detail-shell">
          <div class="ops-detail-hero">
            <div class="ops-detail-title">
              <h3>${headline.code}</h3>
              <p>${headline.category}</p>
              <div class="ops-detail-meta-inline">
                <span class="ops-detail-pill">${op.type || 'Operación'}</span>
                <span class="ops-detail-pill">${headline.location}</span>
              </div>
            </div>
            <div>${statusBadge(op.status)}</div>
          </div>

          <div class="ops-detail-summary">
            ${summaryCards.map(card => `
              <div class="ops-detail-card">
                <span>${card.label}</span>
                <strong>${card.value}</strong>
              </div>
            `).join('')}
          </div>

          ${agencyRecord ? `
            <div class="ops-detail-section">
              <h4>Ubicación de la agencia</h4>
              <div class="ops-detail-summary" style="margin-bottom:12px;">
                <div class="ops-detail-card">
                  <span>Dirección / referencia</span>
                  <strong>${agencyRecord.direccion || agencyRecord.nombre || op.agency}</strong>
                </div>
                <div class="ops-detail-card">
                  <span>Coordenadas</span>
                  <strong>${geoText}</strong>
                </div>
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;"><i class="fas fa-location-dot"></i> Ver ubicación</a>
                <a href="${directionsUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;"><i class="fas fa-route"></i> Cómo llegar</a>
              </div>
            </div>
          ` : ''}

          ${selectedTypes.length ? `
            <div class="ops-detail-section">
              <h4>${op.type === 'Trabajo' ? 'Trabajos seleccionados' : 'Tipos seleccionados'}</h4>
              <div style="margin-top:8px;">${renderSelectedTypeChips(selectedTypes)}</div>
            </div>
          ` : ''}

          <div class="ops-detail-section">
            <h4>Seguimiento</h4>
            ${buildDetailTimeline(op)}
          </div>

          ${op.description ? `
            <div class="ops-detail-section">
              <h4>Observación</h4>
              <p style="margin:0; color:var(--text); line-height:1.55;">${op.description}</p>
            </div>
          ` : ''}

          ${op.images && op.images.length ? `
            <div class="ops-detail-section">
              <h4>Evidencia inicial</h4>
              ${renderMediaGrid(op.images, { title: '', minWidth: 180, height: 160 })}
            </div>
          ` : ''}

          ${op.resultImages && op.resultImages.length ? `
            <div class="ops-detail-section">
              <h4>Evidencia de resultado</h4>
              ${renderMediaGrid(op.resultImages, { title: '', minWidth: 180, height: 160 })}
            </div>
          ` : ''}
        </div>
      `;
      detailModalBackdrop.classList.remove('hidden');
    }

    function openMediaLightbox(src, isVideo = false, label = 'Archivo') {
      const lightbox = document.getElementById('opsMediaLightbox');
      const stage = document.getElementById('opsMediaLightboxStage');
      const caption = document.getElementById('opsMediaLightboxCaption');
      if (!lightbox || !stage || !caption) return;
      caption.textContent = label || 'Archivo';
      stage.innerHTML = isVideo
        ? `<video controls autoplay playsinline preload="metadata"><source src="${src}"></video>`
        : `<img src="${src}" alt="${label || 'Archivo'}" />`;
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeMediaLightbox() {
      const lightbox = document.getElementById('opsMediaLightbox');
      const stage = document.getElementById('opsMediaLightboxStage');
      if (lightbox) lightbox.classList.add('hidden');
      if (stage) stage.innerHTML = '';
      document.body.style.overflow = '';
    }

    document.addEventListener('click', function(event) {
      const lightbox = document.getElementById('opsMediaLightbox');
      if (lightbox && event.target === lightbox) {
        closeMediaLightbox();
      }
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') closeMediaLightbox();
    });

    
    function escapeHtml(value) {
      return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderPrintImages(images, title) {
      if (!Array.isArray(images) || !images.length) return '';
      return `
        <div class="print-section">
          <h3>${escapeHtml(title)}</h3>
          <div class="print-image-grid">
            ${images.map(img => `<div class="print-image-card">${isVideoMedia(img)
              ? `<video controls preload="metadata" style="max-width:100%;max-height:260px;width:auto;height:auto;display:block;background:#000;border-radius:8px;"><source src="${img}"></video>`
              : `<img src="${img}" alt="${escapeHtml(title)}" />`}</div>`).join('')}
          </div>
        </div>
      `;
    }


    function formatFilterLabel(label, value) {
      const safeValue = value && String(value).trim() ? String(value).trim() : 'Todos';
      return `<div class="print-filter-chip"><span>${escapeHtml(label)}</span><strong>${escapeHtml(safeValue)}</strong></div>`;
    }

    function openPrintWindow(title, subtitle, filtersHtml, summaryHtml, tableHeaders, tableRows, emptyMessage = 'Sin datos para imprimir.') {
      const rowsHtml = Array.isArray(tableRows) && tableRows.length
        ? tableRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${tableHeaders.length}" class="empty-cell">${escapeHtml(emptyMessage)}</td></tr>`;
      const printWindow = window.open('', '_blank', 'width=1280,height=900');
      if (!printWindow) return;
      printWindow.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  @page{size:A4 landscape;margin:12mm}
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#0f172a;margin:0;background:#fff;font-size:12px}
  .sheet{width:100%;max-width:100%;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:2px solid #cbd5e1;padding-bottom:12px;margin-bottom:14px}
  .brand h1{margin:0;font-size:24px;line-height:1.1}.brand p{margin:5px 0 0;color:#475467;font-size:13px}
  .meta{text-align:right}.meta span{display:block;font-size:11px;color:#667085;text-transform:uppercase;font-weight:700;letter-spacing:.04em}.meta strong{display:block;font-size:18px;margin-top:4px}
  .filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
  .print-filter-chip{border:1px solid #d8e4f0;border-radius:999px;padding:7px 10px;background:#f8fbff;display:inline-flex;align-items:center;gap:8px}
  .print-filter-chip span{font-size:10px;text-transform:uppercase;font-weight:700;color:#64748b;letter-spacing:.04em}
  .print-filter-chip strong{font-size:12px;color:#0f172a;font-weight:700}
  .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
  .summary-card{border:1px solid #dbe7f3;border-radius:12px;padding:10px 12px;background:#fff}
  .summary-card span{display:block;font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:.04em;margin-bottom:6px}
  .summary-card strong{font-size:18px;line-height:1.1}
  .table-card{border:1px solid #dbe7f3;border-radius:14px;overflow:hidden}
  .table-title{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #dbe7f3;background:#f8fbff}
  .table-title h3{margin:0;font-size:15px}.table-title p{margin:0;color:#64748b;font-size:12px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th,td{border-bottom:1px solid #e5e7eb;padding:9px 10px;text-align:left;vertical-align:top;word-wrap:break-word}
  th{background:#fcfdff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  td{font-size:12px}
  tbody tr:nth-child(even){background:#fbfdff}
  .empty-cell{text-align:center;color:#64748b;padding:22px}
  .footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;color:#64748b;font-size:11px}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet{padding:0}}


/* ===== Detalle de operación ligero ===== */
.ops-detail-shell{display:grid;gap:14px}
.ops-detail-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;padding:18px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,#fbfdff 0%,#f5fbff 100%)}
.ops-detail-title h3{margin:0 0 6px;font-size:24px;color:var(--title-dark)}
.ops-detail-title p{margin:0;color:var(--text-soft);font-size:14px;line-height:1.45}
.ops-detail-meta-inline{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ops-detail-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:#eef5fb;color:#3b678e;font-size:12px;font-weight:800}
.ops-detail-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ops-detail-card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:15px 16px}
.ops-detail-card span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);font-weight:800;margin-bottom:6px}
.ops-detail-card strong,.ops-detail-card p{margin:0;font-size:15px;color:var(--text);line-height:1.5}
.ops-detail-section{border:1px solid var(--line);border-radius:20px;background:#fff;padding:16px}
.ops-detail-section h4{margin:0 0 10px;font-size:16px;color:var(--title-dark)}
.ops-detail-timeline{display:grid;gap:12px}
.ops-detail-step{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:flex-start}
.ops-detail-step-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#edf3f8;color:#6c8499;font-weight:900;border:2px solid #dbe6ef}
.ops-detail-step.done .ops-detail-step-icon{background:#e8f6ef;color:#2f7d57;border-color:#bfe5cf}
.ops-detail-step.active .ops-detail-step-icon{background:#fff2d8;color:#9a6b12;border-color:#f4d48a}
.ops-detail-step-body{border:1px solid var(--line);border-radius:16px;padding:12px 14px;background:#fbfdff}
.ops-detail-step-body strong{display:block;font-size:14px;color:var(--text);margin-bottom:4px}
.ops-detail-step-body p{margin:0;color:var(--text-soft);font-size:13px;line-height:1.45}
.ops-detail-step-body small{display:block;margin-top:5px;color:#8295a7;font-size:12px;font-weight:700}
.ops-detail-empty{padding:18px;border:1px dashed var(--line);border-radius:16px;background:#fbfdff;color:#8092a3;text-align:center;font-weight:700}
@media (max-width:780px){.ops-detail-summary{grid-template-columns:1fr}.ops-detail-hero{padding:16px}.ops-detail-title h3{font-size:21px}}


/* ===== RRHH premium refresh ===== */
#vista-operadoras,#vista-solicitudes,#vista-historial-rrhh{
  position:relative;
}
#vista-operadoras::before,#vista-solicitudes::before,#vista-historial-rrhh::before{
  content:"";
  position:absolute;
  inset:0 0 auto 0;
  height:420px;
  background:
    radial-gradient(circle at top right, rgba(17,158,207,.18), transparent 34%),
    radial-gradient(circle at top left, rgba(43,127,195,.14), transparent 28%);
  pointer-events:none;
}
#vista-operadoras .opx-shell,#vista-solicitudes .hrx-shell,#vista-historial-rrhh .hrx-shell{
  position:relative;
  z-index:1;
  gap:22px;
}
#vista-operadoras .opx-hero,
#vista-solicitudes .opx-hero,
#vista-historial-rrhh .opx-hero{
  position:relative;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.18);
  border-radius:30px;
  padding:28px 30px;
  background:
    radial-gradient(circle at 84% 18%, rgba(255,255,255,.24), transparent 18%),
    radial-gradient(circle at 10% 8%, rgba(255,255,255,.16), transparent 20%),
    linear-gradient(135deg,#184e7f 0%,#1f76b5 35%,#14a7d6 72%,#81d0ef 100%);
  box-shadow:0 30px 60px rgba(19,86,132,.22);
}
#vista-operadoras .opx-hero::after,
#vista-solicitudes .opx-hero::after,
#vista-historial-rrhh .opx-hero::after{
  content:"";
  position:absolute;
  right:-70px;
  bottom:-95px;
  width:260px;
  height:260px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,.22) 0%, rgba(255,255,255,.06) 40%, transparent 68%);
  pointer-events:none;
}
#vista-operadoras .opx-hero h2,
#vista-solicitudes .opx-hero h2,
#vista-historial-rrhh .opx-hero h2{
  font-size:36px;
  line-height:1.05;
  letter-spacing:-.03em;
  margin-bottom:10px;
  text-shadow:0 8px 24px rgba(12,38,58,.18);
}
#vista-operadoras .opx-hero p,
#vista-solicitudes .opx-hero p,
#vista-historial-rrhh .opx-hero p{
  max-width:820px;
  font-size:15px;
  line-height:1.7;
}
#vista-operadoras .opx-hero-tags,
#vista-solicitudes .opx-hero-tags,
#vista-historial-rrhh .opx-hero-tags{
  gap:12px;
  margin-top:18px;
}
#vista-operadoras .opx-hero-tag,
#vista-solicitudes .opx-hero-tag,
#vista-historial-rrhh .opx-hero-tag{
  padding:11px 15px;
  background:rgba(255,255,255,.13);
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 10px 22px rgba(12,38,58,.08);
  backdrop-filter:blur(6px);
}
#vista-operadoras .opx-hero-side,
#vista-solicitudes .opx-hero-side,
#vista-historial-rrhh .opx-hero-side{
  gap:14px;
}
#vista-operadoras .opx-hero-stat,
#vista-solicitudes .opx-hero-stat,
#vista-historial-rrhh .opx-hero-stat{
  min-height:112px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  border-radius:22px;
  background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.10));
  backdrop-filter:blur(8px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 16px 26px rgba(12,38,58,.10);
}
#vista-operadoras .opx-hero-stat strong,
#vista-solicitudes .opx-hero-stat strong,
#vista-historial-rrhh .opx-hero-stat strong{
  font-size:34px;
  letter-spacing:-.03em;
}
#vista-solicitudes .hrx-subnav{
  margin-top:18px;
  gap:12px;
}
#vista-solicitudes .hrx-subnav-btn{
  padding:12px 16px;
  border-radius:14px;
  background:rgba(255,255,255,.13);
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 10px 22px rgba(12,38,58,.08);
  backdrop-filter:blur(6px);
}
#vista-solicitudes .hrx-subnav-btn:hover{
  background:rgba(255,255,255,.24);
}
#vista-operadoras .opx-grid-4,
#vista-solicitudes .hrx-grid-4{
  gap:18px;
}
#vista-operadoras .opx-card,
#vista-solicitudes .hrx-card{
  border-radius:24px;
  padding:22px 22px 20px;
  border:1px solid #dce9f3;
  background:
    linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
  box-shadow:0 18px 34px rgba(17,55,84,.08);
}
#vista-operadoras .opx-card::before,
#vista-solicitudes .hrx-card::before{
  content:"";
  position:absolute;
  left:0;
  top:0;
  width:100%;
  height:5px;
  background:linear-gradient(90deg,#14a7d6 0%,#7dcff0 100%);
}
#vista-operadoras .opx-card .label,
#vista-solicitudes .hrx-card .label{
  font-size:11px;
  color:#7d92a7;
  margin-bottom:14px;
}
#vista-operadoras .opx-card .value,
#vista-solicitudes .hrx-card .value{
  font-size:40px;
  margin-bottom:10px;
  letter-spacing:-.04em;
}
#vista-operadoras .opx-card .sub,
#vista-solicitudes .hrx-card .sub{
  font-size:13px;
  color:#7a8e9f;
}
#vista-operadoras .opx-panel,
#vista-solicitudes .hrx-panel,
#vista-historial-rrhh .hrx-panel{
  overflow:hidden;
  border-radius:26px;
  border:1px solid #dce9f3;
  box-shadow:0 18px 34px rgba(17,55,84,.07);
  background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
}
#vista-operadoras .opx-panel-head,
#vista-solicitudes .hrx-panel-head,
#vista-historial-rrhh .hrx-panel-head{
  padding:22px 24px 18px;
  background:linear-gradient(180deg,rgba(244,250,255,.95),rgba(255,255,255,.92));
  border-bottom:1px solid #e5eff7;
}
#vista-operadoras .opx-panel-head h3,
#vista-solicitudes .hrx-panel-head h3,
#vista-historial-rrhh .hrx-panel-head h3{
  font-size:23px;
  letter-spacing:-.03em;
  color:#163d59;
}
#vista-operadoras .opx-panel-head p,
#vista-solicitudes .hrx-panel-head p,
#vista-historial-rrhh .hrx-panel-head p{
  font-size:13px;
  color:#7890a2;
  margin-top:4px;
}
#vista-operadoras .opx-panel-body,
#vista-solicitudes .hrx-panel-body,
#vista-historial-rrhh .hrx-panel-body{
  padding:22px 24px 24px;
}
#vista-operadoras .opx-btn,
#vista-solicitudes .hrx-btn,
#vista-historial-rrhh .hrx-btn{
  border-radius:15px;
  min-height:44px;
  padding:11px 16px;
  box-shadow:none;
}
#vista-operadoras .opx-btn.primary,
#vista-solicitudes .hrx-btn.primary,
#vista-historial-rrhh .hrx-btn.primary{
  background:linear-gradient(135deg,#159fd0 0%,#1ab4e3 100%);
  box-shadow:0 14px 24px rgba(21,159,208,.20);
}
#vista-operadoras .opx-btn.dark,
#vista-solicitudes .hrx-btn.dark,
#vista-historial-rrhh .hrx-btn.dark{
  background:linear-gradient(135deg,#294f6d 0%,#355f80 100%);
}
#vista-operadoras .opx-btn.light,
#vista-solicitudes .hrx-btn.light,
#vista-historial-rrhh .hrx-btn.light{
  background:#eef6fb;
  color:#2e5d7d;
}
#vista-operadoras .opx-field label,
#vista-solicitudes .hrx-field label,
#vista-historial-rrhh .hrx-field label{
  font-size:11px;
  color:#6f889b;
  margin-bottom:7px;
}
#vista-operadoras .opx-field input,
#vista-operadoras .opx-field select,
#vista-operadoras .opx-field textarea,
#vista-solicitudes .hrx-field input,
#vista-solicitudes .hrx-field select,
#vista-solicitudes .hrx-field textarea,
#vista-historial-rrhh .hrx-field input,
#vista-historial-rrhh .hrx-field select,
#vista-historial-rrhh .hrx-field textarea{
  min-height:48px;
  border-radius:16px;
  border:1px solid #d5e3ee;
  background:#fdfefe;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
}
#vista-operadoras .opx-field textarea,
#vista-solicitudes .hrx-field textarea,
#vista-historial-rrhh .hrx-field textarea{
  min-height:110px;
}
#vista-operadoras .opx-field input:focus,
#vista-operadoras .opx-field select:focus,
#vista-operadoras .opx-field textarea:focus,
#vista-solicitudes .hrx-field input:focus,
#vista-solicitudes .hrx-field select:focus,
#vista-solicitudes .hrx-field textarea:focus,
#vista-historial-rrhh .hrx-field input:focus,
#vista-historial-rrhh .hrx-field select:focus,
#vista-historial-rrhh .hrx-field textarea:focus{
  border-color:#17a4d4;
  box-shadow:0 0 0 4px rgba(23,164,212,.12);
}
#vista-operadoras .opx-table,
#vista-solicitudes .hrx-table,
#vista-historial-rrhh .hrx-table{
  min-width:100%;
}
#vista-operadoras .opx-table th,
#vista-solicitudes .hrx-table th,
#vista-historial-rrhh .hrx-table th{
  position:sticky;
  top:0;
  z-index:1;
  font-size:11px;
  letter-spacing:.08em;
  color:#6f869a;
  background:#f5fbff;
  border-bottom:1px solid #e1edf5;
}
#vista-operadoras .opx-table td,
#vista-solicitudes .hrx-table td,
#vista-historial-rrhh .hrx-table td{
  padding-top:16px;
  padding-bottom:16px;
  border-bottom:1px solid #edf4f9;
}
#vista-operadoras .opx-table tbody tr,
#vista-solicitudes .hrx-table tbody tr,
#vista-historial-rrhh .hrx-table tbody tr{
  transition:transform .14s ease, box-shadow .14s ease, background-color .14s ease;
}
#vista-operadoras .opx-table tbody tr:hover,
#vista-solicitudes .hrx-table tbody tr:hover,
#vista-historial-rrhh .hrx-table tbody tr:hover{
  transform:translateY(-1px);
}
#vista-operadoras .opx-table tbody tr:hover td,
#vista-solicitudes .hrx-table tbody tr:hover td,
#vista-historial-rrhh .hrx-table tbody tr:hover td{
  background:#f9fdff;
}
#vista-operadoras .opx-badge,
#vista-solicitudes .hrx-badge,
#vista-historial-rrhh .hrx-badge{
  padding:8px 12px;
  font-size:10px;
  letter-spacing:.08em;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);
}
#vista-operadoras .opx-icon-btn,
#vista-solicitudes .hrx-icon-btn,
#vista-historial-rrhh .hrx-icon-btn{
  width:38px;
  height:38px;
  border-radius:13px;
  background:#f2f8fc;
  border:1px solid #dceaf3;
}
#vista-operadoras .opx-icon-btn:hover,
#vista-solicitudes .hrx-icon-btn:hover,
#vista-historial-rrhh .hrx-icon-btn:hover{
  background:#e5f4fb;
  transform:translateY(-1px);
}
#vista-operadoras .opx-rank-item,
#vista-solicitudes .hrx-rank-item{
  border-radius:20px;
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
  border:1px solid #e4eef6;
}
#vista-operadoras .opx-bar-track,
#vista-solicitudes .hrx-bar-track{
  height:14px;
  background:#edf5fb;
}
#vista-operadoras .opx-bar-fill,
#vista-solicitudes .hrx-bar-fill{
  box-shadow:0 8px 16px rgba(43,127,195,.18);
}
#vista-operadoras .opx-photo-card,
#vista-operadoras .opx-section,
#vista-operadoras .opx-photo-preview-card{
  border-radius:24px;
  border:1px solid #deebf4;
  box-shadow:0 14px 28px rgba(17,55,84,.07);
}
#vista-operadoras .opx-detail-item{
  border-radius:18px;
  background:linear-gradient(180deg,#fbfdff,#f6fbfe);
}
#vista-operadoras .opx-modal-head,
#vista-solicitudes .hrx-modal-head,
#vista-historial-rrhh .hrx-modal-head{
  background:linear-gradient(180deg,#ffffff,#f7fbff);
}
#vista-operadoras .opx-modal-body,
#vista-solicitudes .hrx-modal-body,
#vista-historial-rrhh .hrx-modal-body{
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
}
#vista-operadoras .opx-modal-actions,
#vista-solicitudes .hrx-modal-actions,
#vista-historial-rrhh .hrx-modal-actions{
  background:linear-gradient(180deg,#ffffff,#f8fbfe);
}
#vista-historial-rrhh .hrx-panel:first-of-type{
  margin-top:2px;
}
#vista-operadoras .opx-empty,
#vista-solicitudes .hrx-empty,
#vista-historial-rrhh .hrx-empty{
  border-radius:20px;
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
}
@media (max-width:1180px){
  #vista-operadoras .opx-hero h2,
  #vista-solicitudes .opx-hero h2,
  #vista-historial-rrhh .opx-hero h2{
    font-size:30px;
  }
}
@media (max-width:760px){
  #vista-operadoras .opx-hero,
  #vista-solicitudes .opx-hero,
  #vista-historial-rrhh .opx-hero{
    padding:22px 18px;
    border-radius:24px;
  }
  #vista-operadoras .opx-panel-head,
  #vista-solicitudes .hrx-panel-head,
  #vista-historial-rrhh .hrx-panel-head,
  #vista-operadoras .opx-panel-body,
  #vista-solicitudes .hrx-panel-body,
  #vista-historial-rrhh .hrx-panel-body{
    padding-left:18px;
    padding-right:18px;
  }
}



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


.taller-v2-action-modal .taller-v2-modal-head h3 i{margin-right:8px;color:#0ea5c6}.taller-v2-action-modal .taller-v2-exp-note{border-left:4px solid #0ea5c6;background:#f8fcff}.taller-v2-btn[disabled]{opacity:.45;cursor:not-allowed;filter:grayscale(1)}
</style>
<style id="loteka-enterprise-pagination-css">
/* ===== Paginación Enterprise LOTEKA - centrada y profesional ===== */
.ltk-pagination{
  width:100% !important;
  margin:22px 0 34px 0 !important;
  padding:0 !important;
  display:flex !important;
  justify-content:center !important;
  align-items:center !important;
  clear:both !important;
  text-align:center !important;
  position:relative !important;
  z-index:2 !important;
  box-sizing:border-box !important;
}
.ltk-pagination-shell{
  width:min(900px, calc(100% - 32px)) !important;
  margin:0 auto !important;
  padding:16px 18px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:14px !important;
  flex-wrap:wrap !important;
  border-radius:26px !important;
  background:linear-gradient(135deg, rgba(255,255,255,.98), rgba(232,248,253,.98)) !important;
  border:1px solid rgba(14,165,198,.24) !important;
  box-shadow:0 18px 42px rgba(8,74,108,.12), inset 0 1px 0 rgba(255,255,255,.92) !important;
  font-family:Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
}
.ltk-pagination-info{
  min-height:42px !important;
  padding:0 16px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:9px !important;
  border-radius:999px !important;
  background:#ffffff !important;
  border:1px solid rgba(113,161,188,.24) !important;
  color:#496982 !important;
  font-size:13px !important;
  font-weight:800 !important;
  box-shadow:0 10px 22px rgba(11,72,105,.07) !important;
  white-space:nowrap !important;
}
.ltk-pagination-info strong{color:#073b61 !important; font-weight:950 !important;}
.ltk-info-dot{
  width:9px !important;
  height:9px !important;
  border-radius:999px !important;
  background:linear-gradient(135deg,#19b7d6,#087da4) !important;
  box-shadow:0 0 0 5px rgba(14,165,198,.12) !important;
  flex:0 0 auto !important;
}
.ltk-pagination-main{
  min-height:48px !important;
  padding:5px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:8px !important;
  flex-wrap:wrap !important;
  border-radius:20px !important;
  background:rgba(255,255,255,.70) !important;
  border:1px solid rgba(14,165,198,.12) !important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.95) !important;
}
.ltk-page-numbers{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:8px !important;
  flex-wrap:wrap !important;
}
.ltk-page-btn{
  min-width:44px !important;
  height:44px !important;
  padding:0 14px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  border-radius:16px !important;
  border:1px solid rgba(14,165,198,.24) !important;
  background:linear-gradient(180deg,#ffffff,#f1f9fc) !important;
  color:#174d6d !important;
  font-size:14px !important;
  font-weight:950 !important;
  line-height:1 !important;
  cursor:pointer !important;
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease, border-color .16s ease !important;
  box-shadow:0 10px 22px rgba(15,75,110,.08) !important;
  appearance:none !important;
  -webkit-appearance:none !important;
}
.ltk-prev-next{min-width:104px !important; letter-spacing:.01em !important;}
.ltk-nav-btn{font-size:15px !important;}
.ltk-page-btn:hover:not(:disabled){
  transform:translateY(-2px) !important;
  color:#0782a8 !important;
  border-color:rgba(14,165,198,.42) !important;
  background:linear-gradient(180deg,#ffffff,#e7f8fd) !important;
  box-shadow:0 15px 30px rgba(14,165,198,.20) !important;
}
.ltk-page-btn.active{
  border-color:transparent !important;
  background:linear-gradient(135deg,#10afd1,#087da4) !important;
  color:#ffffff !important;
  box-shadow:0 16px 34px rgba(14,165,198,.34), inset 0 1px 0 rgba(255,255,255,.25) !important;
  transform:translateY(-1px) !important;
}
.ltk-page-btn:disabled{
  opacity:.38 !important;
  cursor:not-allowed !important;
  filter:grayscale(.25) !important;
  box-shadow:none !important;
  transform:none !important;
}
.ltk-page-size-group{
  min-height:44px !important;
  padding:5px 6px 5px 12px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:7px !important;
  border-radius:18px !important;
  background:#ffffff !important;
  border:1px solid rgba(113,161,188,.24) !important;
  box-shadow:0 10px 22px rgba(11,72,105,.07) !important;
  color:#59748a !important;
  font-size:12px !important;
  font-weight:900 !important;
  white-space:nowrap !important;
}
.ltk-size-btn{
  min-width:38px !important;
  height:34px !important;
  padding:0 10px !important;
  border-radius:12px !important;
  border:1px solid rgba(14,165,198,.16) !important;
  background:#f2f9fc !important;
  color:#24546f !important;
  font-size:12px !important;
  font-weight:950 !important;
  cursor:pointer !important;
  transition:all .16s ease !important;
  appearance:none !important;
  -webkit-appearance:none !important;
}
.ltk-size-btn:hover{background:#e6f8fd !important; color:#0782a8 !important; transform:translateY(-1px) !important;}
.ltk-size-btn.active{
  background:linear-gradient(135deg,#10afd1,#087da4) !important;
  color:#fff !important;
  border-color:transparent !important;
  box-shadow:0 9px 18px rgba(14,165,198,.24) !important;
}
@media (max-width: 900px){
  .ltk-pagination-shell{width:calc(100% - 18px) !important; padding:14px 10px !important; gap:10px !important; border-radius:22px !important;}
  .ltk-pagination-info{width:100% !important; white-space:normal !important;}
  .ltk-pagination-main{width:100% !important; gap:6px !important;}
  .ltk-prev-next{min-width:92px !important;}
  .ltk-page-btn{min-width:40px !important; height:40px !important; border-radius:14px !important;}
  .ltk-page-size-group{width:100% !important; flex-wrap:wrap !important;}
}
@media (max-width: 520px){
  .ltk-prev-next{display:none !important;}
  .ltk-pagination-main{padding:4px !important;}
  .ltk-page-btn{min-width:38px !important; height:38px !important; padding:0 10px !important;}
}
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

</head><body>
<div class="sheet">
  <div class="header">
    <div class="brand"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
    <div class="meta"><span>Fecha de impresión</span><strong>${escapeHtml(formatDate(new Date().toISOString()))}</strong></div>
  </div>
  ${filtersHtml ? `<div class="filters">${filtersHtml}</div>` : ''}
  ${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ''}
  <div class="table-card">
    <div class="table-title"><h3>Resumen del reporte</h3><p>Documento generado desde el sistema de Operaciones.</p></div>
    <table>
      <thead><tr>${tableHeaders.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div class="footer"><div>Sistema de Operaciones</div><div>Impresión optimizada para hoja A4 horizontal</div></div>
</div>
${'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},220);};<\/scr'+'ipt>'}



<\/body><\/html>`);
      printWindow.document.close();
    }

    function printGeneralReport() {
      const operations = getReportFilteredOperations();
      const done = operations.filter(op => isOperationTerminalStatus(op.status));
      const pending = operations.filter(op => !isOperationTerminalStatus(op.status));
      const resolutionValues = done.map(getResolutionMinutes).filter(value => value !== null);
      const avgResolution = resolutionValues.length ? resolutionValues.reduce((a,b) => a+b, 0) / resolutionValues.length : 0;
      const assignedValues = operations.map(getAssignmentMinutes).filter(value => value !== null);
      const avgAssigned = assignedValues.length ? assignedValues.reduce((a,b) => a+b, 0) / assignedValues.length : 0;
      const compliance = operations.length ? Math.round((done.length / operations.length) * 100) : 0;
      const agencyGroups = buildAgencyGroups(operations);
      const ownerGroups = buildOwnerGroups(operations);
      const filtersHtml = [
        formatFilterLabel('Tipo', reportFilterType.value),
        formatFilterLabel('Estado', reportFilterStatus.value),
        formatFilterLabel('Tipo específico', reportFilterSpecificType.value),
        formatFilterLabel('Agencia', reportFilterAgency.value),
        formatFilterLabel('Técnico', reportFilterOwner.options[reportFilterOwner.selectedIndex]?.text || reportFilterOwner.value),
        formatFilterLabel('Desde', reportFilterFrom.value),
        formatFilterLabel('Hasta', reportFilterTo.value)
      ].join('');
      const summaryHtml = [
        ['Total filtrado', operations.length],
        ['Cerradas', done.length],
        ['Activas', pending.length],
        ['Tiempo promedio', formatMinutesHuman(avgResolution)],
        ['% Cumplimiento', `${compliance}%`],
        ['Promedio asignación', formatMinutesHuman(avgAssigned)],
        ['Agencia más cargada', agencyGroups[0] ? agencyGroups[0].agency : '-'],
        ['Responsable más cargado', ownerGroups[0] ? getAssigneeDisplayName(ownerGroups[0].owner, 'Avería') : '-']
      ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
      const rows = operations.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(op => [
        escapeHtml(op.code),
        escapeHtml(op.type),
        escapeHtml(op.title),
        escapeHtml(op.agency),
        escapeHtml(op.technician),
        escapeHtml(op.status),
        escapeHtml((op.selectedTypes || []).join(', ') || 'Sin tipo específico'),
        escapeHtml(getAssignmentTimeLabel(op)),
        escapeHtml(getResponseTimeLabel(op)),
        escapeHtml(getResolutionTimeLabel(op))
      ]);
      openPrintWindow(
        'Reporte de Operaciones',
        'Consulta general de operaciones con filtros operativos y métricas principales.',
        filtersHtml,
        summaryHtml,
        ['Código', 'Tipo', 'Título', 'Agencia', 'Responsable', 'Estado', 'Tipo específico', 'Asignación', 'Respuesta', 'Resolución'],
        rows,
        'No hay operaciones disponibles para imprimir en este reporte.'
      );
    }

    function printAgencyReport() {
      const operations = getOperationsByFilters({
        typeValue: agencyReportFilterType.value,
        statusValue: agencyReportFilterStatus.value,
        agencyValue: agencyReportFilterAgency.value,
        fromValue: agencyReportFilterFrom.value,
        toValue: agencyReportFilterTo.value
      });
      const rowsData = buildAgencyGroups(operations);
      const filtersHtml = [
        formatFilterLabel('Tipo', agencyReportFilterType.value),
        formatFilterLabel('Estado', agencyReportFilterStatus.value),
        formatFilterLabel('Agencia', agencyReportFilterAgency.value),
        formatFilterLabel('Desde', agencyReportFilterFrom.value),
        formatFilterLabel('Hasta', agencyReportFilterTo.value)
      ].join('');
      const summaryHtml = [
        ['Agencias en reporte', rowsData.length],
        ['Total de operaciones', operations.length],
        ['Cerradas', operations.filter(op => isOperationTerminalStatus(op.status)).length],
        ['Activas', operations.filter(op => !isOperationTerminalStatus(op.status)).length]
      ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
      const rows = rowsData.map(row => [
        escapeHtml(row.agency),
        escapeHtml(String(row.total)),
        escapeHtml(String(row.completed)),
        escapeHtml(String(row.stillOpen)),
        escapeHtml(formatMinutesHuman(row.avgAssign)),
        escapeHtml(formatMinutesHuman(row.avgResolution))
      ]);
      openPrintWindow(
        'Reporte por Agencia',
        'Consulta dedicada para revisar carga, cumplimiento y tiempos por agencia.',
        filtersHtml,
        summaryHtml,
        ['Agencia', 'Total', 'Cerradas', 'Activas', 'Asignación prom.', 'Resolución prom.'],
        rows,
        'No hay datos de agencias para imprimir.'
      );
    }

    function printOwnerReport() {
      const operations = getOperationsByFilters({
        typeValue: ownerReportFilterType.value,
        statusValue: ownerReportFilterStatus.value,
        ownerValue: ownerReportFilterOwner.value,
        fromValue: ownerReportFilterFrom.value,
        toValue: ownerReportFilterTo.value
      });
      const rowsData = buildOwnerGroups(operations);
      const filtersHtml = [
        formatFilterLabel('Tipo', ownerReportFilterType.value),
        formatFilterLabel('Estado', ownerReportFilterStatus.value),
        formatFilterLabel('Responsable', ownerReportFilterOwner.value),
        formatFilterLabel('Desde', ownerReportFilterFrom.value),
        formatFilterLabel('Hasta', ownerReportFilterTo.value)
      ].join('');
      const summaryHtml = [
        ['Responsables en reporte', rowsData.length],
        ['Total asignado', operations.length],
        ['Cerradas', operations.filter(op => isOperationTerminalStatus(op.status)).length],
        ['Activas', operations.filter(op => !isOperationTerminalStatus(op.status)).length]
      ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
      const rows = rowsData.map(row => [
        escapeHtml(getAssigneeDisplayName(row.owner, 'Avería')),
        escapeHtml(String(row.total)),
        escapeHtml(String(row.completed)),
        escapeHtml(String(row.inProgress)),
        escapeHtml(formatMinutesHuman(row.avgAssign)),
        escapeHtml(formatMinutesHuman(row.avgResolution))
      ]);
      openPrintWindow(
        'Reporte por Responsable',
        'Consulta dedicada para técnicos y suplidores con su carga y desempeño.',
        filtersHtml,
        summaryHtml,
        ['Responsable', 'Total', 'Cerradas', 'Activas', 'Asignación prom.', 'Resolución prom.'],
        rows,
        'No hay datos de responsables para imprimir.'
      );
    }

    function printSpecificTypeReport() {
      const operations = getOperationsByFilters({
        typeValue: specificReportFilterType.value,
        statusValue: specificReportFilterStatus.value,
        specificTypeValue: specificReportFilterSpecificType.value,
        fromValue: specificReportFilterFrom.value,
        toValue: specificReportFilterTo.value
      });
      const rowsData = buildCategoryGroups(operations);
      const filtersHtml = [
        formatFilterLabel('Tipo', specificReportFilterType.value),
        formatFilterLabel('Tipo específico', specificReportFilterSpecificType.value),
        formatFilterLabel('Estado', specificReportFilterStatus.value),
        formatFilterLabel('Desde', specificReportFilterFrom.value),
        formatFilterLabel('Hasta', specificReportFilterTo.value)
      ].join('');
      const summaryHtml = [
        ['Tipos en reporte', rowsData.length],
        ['Total de operaciones', operations.length],
        ['Cerradas', operations.filter(op => isOperationTerminalStatus(op.status)).length],
        ['Activas', operations.filter(op => !isOperationTerminalStatus(op.status)).length]
      ].map(([label, value]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
      const rows = rowsData.map(row => [
        escapeHtml(row.category),
        escapeHtml(String(row.total)),
        escapeHtml(String(row.completed)),
        escapeHtml(String(row.stillOpen)),
        escapeHtml(formatMinutesHuman(row.avgAssign)),
        escapeHtml(formatMinutesHuman(row.avgResolution))
      ]);
      openPrintWindow(
        'Reporte por Tipos Específicos',
        'Consulta dedicada para los tipos específicos de averías y trabajos.',
        filtersHtml,
        summaryHtml,
        ['Tipo específico', 'Total', 'Cerradas', 'Activas', 'Asignación prom.', 'Resolución prom.'],
        rows,
        'No hay datos de tipos específicos para imprimir.'
      );
    }

    function printOperation(id) {
      const op = loadOperations().find(item => item.id === id);
      if (!op) return;
      const assignedLabel = op.type === 'Trabajo' ? 'Suplidor' : 'Técnico asignado';
      const assignedDisplay = getAssigneeDisplayName(op.technician, op.type);
      const historyItems = Array.isArray(op.history) ? op.history : [];
      const historyHtml = historyItems
        .filter(item => ['Creación','Asignación','Inicio','Estado','Finalización','Evidencia'].includes(item.action))
        .sort((a,b) => new Date(getHistoryTimestamp(a) || 0) - new Date(getHistoryTimestamp(b) || 0))
        .map(item => `
          <tr>
            <td>${escapeHtml(formatDate(getHistoryTimestamp(item) || op.createdAt))}</td>
            <td>${escapeHtml(item.action || '')}</td>
            <td>${escapeHtml(item.detail || '')}${(item.prevStatus || item.newStatus) ? `<div style="margin-top:4px; color:#667085; font-size:11px;"><strong>${escapeHtml(item.prevStatus || '-')}</strong> → <strong>${escapeHtml(item.newStatus || '-')}</strong></div>` : ''}</td>
            <td>${escapeHtml(item.user || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="4">Sin historial disponible.</td></tr>';
      const reportedPhotos = renderPrintImages(op.images, 'Fotos reportadas');
      const evidencePhotos = renderPrintImages(op.resultImages, 'Fotos de evidencia');
      const mediaSections = reportedPhotos || evidencePhotos
        ? `<div class="media-row">${reportedPhotos}${evidencePhotos}</div>`
        : '';
      const printWindow = window.open('', '_blank', 'width=960,height=900');
      if (!printWindow) return;
      printWindow.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Operación ${escapeHtml(op.code)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#111827;margin:0;background:#fff;font-size:12px}
  .sheet{max-width:900px;margin:0 auto;padding:24px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #cbd5e1;padding-bottom:12px;margin-bottom:18px}
  .header h1{margin:0;font-size:22px}.header p{margin:4px 0 0;color:#475467}
  .code-box{text-align:right;white-space:nowrap}.code-box span{display:block;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:.04em}.code-box strong{display:block;font-size:18px;margin-top:4px}
  .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin-bottom:18px}
  .meta-item{border:1px solid #e5e7eb;border-radius:10px;padding:10px}
  .meta-item span{display:block;font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700;margin-bottom:4px;letter-spacing:.04em}
  .meta-item strong,.meta-item div{font-size:12px;line-height:1.45}
  .print-section{margin-top:18px}
  .print-section h3{font-size:14px;margin:0 0 10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
  .description{border:1px solid #e5e7eb;border-radius:10px;padding:12px;line-height:1.6;white-space:pre-wrap}
  .types{display:flex;flex-wrap:wrap;gap:6px}.type-chip{border:1px solid #cbd5e1;border-radius:999px;padding:5px 9px;font-size:11px;background:#f8fafc}
  .media-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
  .print-image-grid{display:grid;grid-template-columns:1fr;gap:12px}
  .print-image-card{border:1px solid #dbe2ea;border-radius:10px;padding:8px;display:flex;align-items:center;justify-content:center;min-height:200px;overflow:hidden;background:#fff}
  .print-image-card img{max-width:100%;max-height:260px;width:auto;height:auto;object-fit:contain;display:block}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top} th{background:#f8fafc;font-size:11px}
  @media print { body{print-color-adjust:exact;-webkit-print-color-adjust:exact} .sheet{padding:0 10px} }


/* ===== Detalle de operación ligero ===== */
.ops-detail-shell{display:grid;gap:14px}
.ops-detail-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;padding:18px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,#fbfdff 0%,#f5fbff 100%)}
.ops-detail-title h3{margin:0 0 6px;font-size:24px;color:var(--title-dark)}
.ops-detail-title p{margin:0;color:var(--text-soft);font-size:14px;line-height:1.45}
.ops-detail-meta-inline{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ops-detail-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:#eef5fb;color:#3b678e;font-size:12px;font-weight:800}
.ops-detail-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ops-detail-card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:15px 16px}
.ops-detail-card span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);font-weight:800;margin-bottom:6px}
.ops-detail-card strong,.ops-detail-card p{margin:0;font-size:15px;color:var(--text);line-height:1.5}
.ops-detail-section{border:1px solid var(--line);border-radius:20px;background:#fff;padding:16px}
.ops-detail-section h4{margin:0 0 10px;font-size:16px;color:var(--title-dark)}
.ops-detail-timeline{display:grid;gap:12px}
.ops-detail-step{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:flex-start}
.ops-detail-step-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#edf3f8;color:#6c8499;font-weight:900;border:2px solid #dbe6ef}
.ops-detail-step.done .ops-detail-step-icon{background:#e8f6ef;color:#2f7d57;border-color:#bfe5cf}
.ops-detail-step.active .ops-detail-step-icon{background:#fff2d8;color:#9a6b12;border-color:#f4d48a}
.ops-detail-step-body{border:1px solid var(--line);border-radius:16px;padding:12px 14px;background:#fbfdff}
.ops-detail-step-body strong{display:block;font-size:14px;color:var(--text);margin-bottom:4px}
.ops-detail-step-body p{margin:0;color:var(--text-soft);font-size:13px;line-height:1.45}
.ops-detail-step-body small{display:block;margin-top:5px;color:#8295a7;font-size:12px;font-weight:700}
.ops-detail-empty{padding:18px;border:1px dashed var(--line);border-radius:16px;background:#fbfdff;color:#8092a3;text-align:center;font-weight:700}
@media (max-width:780px){.ops-detail-summary{grid-template-columns:1fr}.ops-detail-hero{padding:16px}.ops-detail-title h3{font-size:21px}}


/* ===== RRHH premium refresh ===== */
#vista-operadoras,#vista-solicitudes,#vista-historial-rrhh{
  position:relative;
}
#vista-operadoras::before,#vista-solicitudes::before,#vista-historial-rrhh::before{
  content:"";
  position:absolute;
  inset:0 0 auto 0;
  height:420px;
  background:
    radial-gradient(circle at top right, rgba(17,158,207,.18), transparent 34%),
    radial-gradient(circle at top left, rgba(43,127,195,.14), transparent 28%);
  pointer-events:none;
}
#vista-operadoras .opx-shell,#vista-solicitudes .hrx-shell,#vista-historial-rrhh .hrx-shell{
  position:relative;
  z-index:1;
  gap:22px;
}
#vista-operadoras .opx-hero,
#vista-solicitudes .opx-hero,
#vista-historial-rrhh .opx-hero{
  position:relative;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.18);
  border-radius:30px;
  padding:28px 30px;
  background:
    radial-gradient(circle at 84% 18%, rgba(255,255,255,.24), transparent 18%),
    radial-gradient(circle at 10% 8%, rgba(255,255,255,.16), transparent 20%),
    linear-gradient(135deg,#184e7f 0%,#1f76b5 35%,#14a7d6 72%,#81d0ef 100%);
  box-shadow:0 30px 60px rgba(19,86,132,.22);
}
#vista-operadoras .opx-hero::after,
#vista-solicitudes .opx-hero::after,
#vista-historial-rrhh .opx-hero::after{
  content:"";
  position:absolute;
  right:-70px;
  bottom:-95px;
  width:260px;
  height:260px;
  border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,.22) 0%, rgba(255,255,255,.06) 40%, transparent 68%);
  pointer-events:none;
}
#vista-operadoras .opx-hero h2,
#vista-solicitudes .opx-hero h2,
#vista-historial-rrhh .opx-hero h2{
  font-size:36px;
  line-height:1.05;
  letter-spacing:-.03em;
  margin-bottom:10px;
  text-shadow:0 8px 24px rgba(12,38,58,.18);
}
#vista-operadoras .opx-hero p,
#vista-solicitudes .opx-hero p,
#vista-historial-rrhh .opx-hero p{
  max-width:820px;
  font-size:15px;
  line-height:1.7;
}
#vista-operadoras .opx-hero-tags,
#vista-solicitudes .opx-hero-tags,
#vista-historial-rrhh .opx-hero-tags{
  gap:12px;
  margin-top:18px;
}
#vista-operadoras .opx-hero-tag,
#vista-solicitudes .opx-hero-tag,
#vista-historial-rrhh .opx-hero-tag{
  padding:11px 15px;
  background:rgba(255,255,255,.13);
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 10px 22px rgba(12,38,58,.08);
  backdrop-filter:blur(6px);
}
#vista-operadoras .opx-hero-side,
#vista-solicitudes .opx-hero-side,
#vista-historial-rrhh .opx-hero-side{
  gap:14px;
}
#vista-operadoras .opx-hero-stat,
#vista-solicitudes .opx-hero-stat,
#vista-historial-rrhh .opx-hero-stat{
  min-height:112px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  border-radius:22px;
  background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.10));
  backdrop-filter:blur(8px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 16px 26px rgba(12,38,58,.10);
}
#vista-operadoras .opx-hero-stat strong,
#vista-solicitudes .opx-hero-stat strong,
#vista-historial-rrhh .opx-hero-stat strong{
  font-size:34px;
  letter-spacing:-.03em;
}
#vista-solicitudes .hrx-subnav{
  margin-top:18px;
  gap:12px;
}
#vista-solicitudes .hrx-subnav-btn{
  padding:12px 16px;
  border-radius:14px;
  background:rgba(255,255,255,.13);
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 10px 22px rgba(12,38,58,.08);
  backdrop-filter:blur(6px);
}
#vista-solicitudes .hrx-subnav-btn:hover{
  background:rgba(255,255,255,.24);
}
#vista-operadoras .opx-grid-4,
#vista-solicitudes .hrx-grid-4{
  gap:18px;
}
#vista-operadoras .opx-card,
#vista-solicitudes .hrx-card{
  border-radius:24px;
  padding:22px 22px 20px;
  border:1px solid #dce9f3;
  background:
    linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
  box-shadow:0 18px 34px rgba(17,55,84,.08);
}
#vista-operadoras .opx-card::before,
#vista-solicitudes .hrx-card::before{
  content:"";
  position:absolute;
  left:0;
  top:0;
  width:100%;
  height:5px;
  background:linear-gradient(90deg,#14a7d6 0%,#7dcff0 100%);
}
#vista-operadoras .opx-card .label,
#vista-solicitudes .hrx-card .label{
  font-size:11px;
  color:#7d92a7;
  margin-bottom:14px;
}
#vista-operadoras .opx-card .value,
#vista-solicitudes .hrx-card .value{
  font-size:40px;
  margin-bottom:10px;
  letter-spacing:-.04em;
}
#vista-operadoras .opx-card .sub,
#vista-solicitudes .hrx-card .sub{
  font-size:13px;
  color:#7a8e9f;
}
#vista-operadoras .opx-panel,
#vista-solicitudes .hrx-panel,
#vista-historial-rrhh .hrx-panel{
  overflow:hidden;
  border-radius:26px;
  border:1px solid #dce9f3;
  box-shadow:0 18px 34px rgba(17,55,84,.07);
  background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
}
#vista-operadoras .opx-panel-head,
#vista-solicitudes .hrx-panel-head,
#vista-historial-rrhh .hrx-panel-head{
  padding:22px 24px 18px;
  background:linear-gradient(180deg,rgba(244,250,255,.95),rgba(255,255,255,.92));
  border-bottom:1px solid #e5eff7;
}
#vista-operadoras .opx-panel-head h3,
#vista-solicitudes .hrx-panel-head h3,
#vista-historial-rrhh .hrx-panel-head h3{
  font-size:23px;
  letter-spacing:-.03em;
  color:#163d59;
}
#vista-operadoras .opx-panel-head p,
#vista-solicitudes .hrx-panel-head p,
#vista-historial-rrhh .hrx-panel-head p{
  font-size:13px;
  color:#7890a2;
  margin-top:4px;
}
#vista-operadoras .opx-panel-body,
#vista-solicitudes .hrx-panel-body,
#vista-historial-rrhh .hrx-panel-body{
  padding:22px 24px 24px;
}
#vista-operadoras .opx-btn,
#vista-solicitudes .hrx-btn,
#vista-historial-rrhh .hrx-btn{
  border-radius:15px;
  min-height:44px;
  padding:11px 16px;
  box-shadow:none;
}
#vista-operadoras .opx-btn.primary,
#vista-solicitudes .hrx-btn.primary,
#vista-historial-rrhh .hrx-btn.primary{
  background:linear-gradient(135deg,#159fd0 0%,#1ab4e3 100%);
  box-shadow:0 14px 24px rgba(21,159,208,.20);
}
#vista-operadoras .opx-btn.dark,
#vista-solicitudes .hrx-btn.dark,
#vista-historial-rrhh .hrx-btn.dark{
  background:linear-gradient(135deg,#294f6d 0%,#355f80 100%);
}
#vista-operadoras .opx-btn.light,
#vista-solicitudes .hrx-btn.light,
#vista-historial-rrhh .hrx-btn.light{
  background:#eef6fb;
  color:#2e5d7d;
}
#vista-operadoras .opx-field label,
#vista-solicitudes .hrx-field label,
#vista-historial-rrhh .hrx-field label{
  font-size:11px;
  color:#6f889b;
  margin-bottom:7px;
}
#vista-operadoras .opx-field input,
#vista-operadoras .opx-field select,
#vista-operadoras .opx-field textarea,
#vista-solicitudes .hrx-field input,
#vista-solicitudes .hrx-field select,
#vista-solicitudes .hrx-field textarea,
#vista-historial-rrhh .hrx-field input,
#vista-historial-rrhh .hrx-field select,
#vista-historial-rrhh .hrx-field textarea{
  min-height:48px;
  border-radius:16px;
  border:1px solid #d5e3ee;
  background:#fdfefe;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
}
#vista-operadoras .opx-field textarea,
#vista-solicitudes .hrx-field textarea,
#vista-historial-rrhh .hrx-field textarea{
  min-height:110px;
}
#vista-operadoras .opx-field input:focus,
#vista-operadoras .opx-field select:focus,
#vista-operadoras .opx-field textarea:focus,
#vista-solicitudes .hrx-field input:focus,
#vista-solicitudes .hrx-field select:focus,
#vista-solicitudes .hrx-field textarea:focus,
#vista-historial-rrhh .hrx-field input:focus,
#vista-historial-rrhh .hrx-field select:focus,
#vista-historial-rrhh .hrx-field textarea:focus{
  border-color:#17a4d4;
  box-shadow:0 0 0 4px rgba(23,164,212,.12);
}
#vista-operadoras .opx-table,
#vista-solicitudes .hrx-table,
#vista-historial-rrhh .hrx-table{
  min-width:100%;
}
#vista-operadoras .opx-table th,
#vista-solicitudes .hrx-table th,
#vista-historial-rrhh .hrx-table th{
  position:sticky;
  top:0;
  z-index:1;
  font-size:11px;
  letter-spacing:.08em;
  color:#6f869a;
  background:#f5fbff;
  border-bottom:1px solid #e1edf5;
}
#vista-operadoras .opx-table td,
#vista-solicitudes .hrx-table td,
#vista-historial-rrhh .hrx-table td{
  padding-top:16px;
  padding-bottom:16px;
  border-bottom:1px solid #edf4f9;
}
#vista-operadoras .opx-table tbody tr,
#vista-solicitudes .hrx-table tbody tr,
#vista-historial-rrhh .hrx-table tbody tr{
  transition:transform .14s ease, box-shadow .14s ease, background-color .14s ease;
}
#vista-operadoras .opx-table tbody tr:hover,
#vista-solicitudes .hrx-table tbody tr:hover,
#vista-historial-rrhh .hrx-table tbody tr:hover{
  transform:translateY(-1px);
}
#vista-operadoras .opx-table tbody tr:hover td,
#vista-solicitudes .hrx-table tbody tr:hover td,
#vista-historial-rrhh .hrx-table tbody tr:hover td{
  background:#f9fdff;
}
#vista-operadoras .opx-badge,
#vista-solicitudes .hrx-badge,
#vista-historial-rrhh .hrx-badge{
  padding:8px 12px;
  font-size:10px;
  letter-spacing:.08em;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);
}
#vista-operadoras .opx-icon-btn,
#vista-solicitudes .hrx-icon-btn,
#vista-historial-rrhh .hrx-icon-btn{
  width:38px;
  height:38px;
  border-radius:13px;
  background:#f2f8fc;
  border:1px solid #dceaf3;
}
#vista-operadoras .opx-icon-btn:hover,
#vista-solicitudes .hrx-icon-btn:hover,
#vista-historial-rrhh .hrx-icon-btn:hover{
  background:#e5f4fb;
  transform:translateY(-1px);
}
#vista-operadoras .opx-rank-item,
#vista-solicitudes .hrx-rank-item{
  border-radius:20px;
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
  border:1px solid #e4eef6;
}
#vista-operadoras .opx-bar-track,
#vista-solicitudes .hrx-bar-track{
  height:14px;
  background:#edf5fb;
}
#vista-operadoras .opx-bar-fill,
#vista-solicitudes .hrx-bar-fill{
  box-shadow:0 8px 16px rgba(43,127,195,.18);
}
#vista-operadoras .opx-photo-card,
#vista-operadoras .opx-section,
#vista-operadoras .opx-photo-preview-card{
  border-radius:24px;
  border:1px solid #deebf4;
  box-shadow:0 14px 28px rgba(17,55,84,.07);
}
#vista-operadoras .opx-detail-item{
  border-radius:18px;
  background:linear-gradient(180deg,#fbfdff,#f6fbfe);
}
#vista-operadoras .opx-modal-head,
#vista-solicitudes .hrx-modal-head,
#vista-historial-rrhh .hrx-modal-head{
  background:linear-gradient(180deg,#ffffff,#f7fbff);
}
#vista-operadoras .opx-modal-body,
#vista-solicitudes .hrx-modal-body,
#vista-historial-rrhh .hrx-modal-body{
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
}
#vista-operadoras .opx-modal-actions,
#vista-solicitudes .hrx-modal-actions,
#vista-historial-rrhh .hrx-modal-actions{
  background:linear-gradient(180deg,#ffffff,#f8fbfe);
}
#vista-historial-rrhh .hrx-panel:first-of-type{
  margin-top:2px;
}
#vista-operadoras .opx-empty,
#vista-solicitudes .hrx-empty,
#vista-historial-rrhh .hrx-empty{
  border-radius:20px;
  background:linear-gradient(180deg,#fbfdff,#f7fbfe);
}
@media (max-width:1180px){
  #vista-operadoras .opx-hero h2,
  #vista-solicitudes .opx-hero h2,
  #vista-historial-rrhh .opx-hero h2{
    font-size:30px;
  }
}
@media (max-width:760px){
  #vista-operadoras .opx-hero,
  #vista-solicitudes .opx-hero,
  #vista-historial-rrhh .opx-hero{
    padding:22px 18px;
    border-radius:24px;
  }
  #vista-operadoras .opx-panel-head,
  #vista-solicitudes .hrx-panel-head,
  #vista-historial-rrhh .hrx-panel-head,
  #vista-operadoras .opx-panel-body,
  #vista-solicitudes .hrx-panel-body,
  #vista-historial-rrhh .hrx-panel-body{
    padding-left:18px;
    padding-right:18px;
  }
}



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

</head><body>
<div class="sheet">
  <div class="header"><div><h1>Reporte de Operación</h1><p>Sistema de Operaciones</p></div><div class="code-box"><span>Código</span><strong>${escapeHtml(op.code)}</strong></div></div>
  <div class="meta">
    <div class="meta-item"><span>Estado</span><div>${escapeHtml(op.status)}</div></div>
    <div class="meta-item"><span>Fecha</span><div>${escapeHtml(formatDate(op.createdAt))}</div></div>
    <div class="meta-item"><span>Título</span><div>${escapeHtml(op.title)}</div></div>
    <div class="meta-item"><span>Agencia / Grupo</span><div>${escapeHtml(getOperationLocation(op))}</div></div>
    <div class="meta-item"><span>${escapeHtml(assignedLabel)}</span><div>${escapeHtml(op.technician)}</div></div>
    <div class="meta-item"><span>Tiempo de asignación</span><div>${escapeHtml(getAssignmentTimeLabel(op))}</div></div>
    <div class="meta-item"><span>Tiempo de respuesta</span><div>${escapeHtml(getResponseTimeLabel(op))}</div></div>
    <div class="meta-item"><span>Tiempo de resolución</span><div>${escapeHtml(getResolutionTimeLabel(op))}</div></div>
    <div class="meta-item"><span>Tipos específicos</span><div class="types">${(getOperationSpecificTypes(op).length ? getOperationSpecificTypes(op) : ['Sin tipo específico']).map(t=>`<span class="type-chip">${escapeHtml(t)}</span>`).join('')}</div></div><div class="meta-item"><span>Reportado por</span><div>${escapeHtml(getOperationReporter(op))}</div></div>
  </div>
  <div class="print-section"><h3>Descripción</h3><div class="description">${escapeHtml(op.description || '')}</div></div>
  ${mediaSections}
  <div class="print-section"><h3>Historial principal</h3><table><thead><tr><th>Fecha</th><th>Acción</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${historyHtml}</tbody></table></div>
</div>
${'<scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},200);};<\/scr'+'ipt>'}



<\/body><\/html>`);
      printWindow.document.close();
    }

function openEditModal(id) {
      const op = loadOperations().find(item => item.id === id);
      if (!op) return;
      if (op.status === 'Completado') {
        alert('Esta operación ya está completada y no se puede editar.');
        return;
      }
      document.getElementById('editOperationId').value = op.id;
      document.getElementById('editOperationType').value = op.type;
      document.getElementById('editOperationStatus').value = op.status;
      document.getElementById('editOperationTitle').value = op.title;
      populateEditOperationAgencyOptions(op.agency_label || op.agency || op.agencia || '');
      document.getElementById('editOperationDescription').value = op.description;
      document.getElementById('editResultImage').value = '';
      renderTypeOptions('editOperationTypeOptions', op.type, op.selectedTypes || []);
      updateTechnicianLabel('editOperationType', 'editLabelTechnician', 'editOperationTechnician');
      renderAssigneeOptions('editOperationTechnician', op.type, op.technician || '');
      op.images = getSafeMediaList(op.images);
      op.resultImages = getSafeMediaList(op.resultImages);
      if (op.images && op.images.length) {
        renderEditableImageGrid('editImagesPreviewGrid', op.images, 'removeReportedImage', op.id);
        document.getElementById('editImagesPreview').classList.remove('hidden');
      } else {
        document.getElementById('editImagesPreviewGrid').innerHTML = '';
        document.getElementById('editImagesPreview').classList.add('hidden');
      }
      if (op.resultImages && op.resultImages.length) {
        renderEditableImageGrid('editResultPreviewGrid', op.resultImages, 'removeEvidenceImage', op.id);
        document.getElementById('editResultPreview').classList.remove('hidden');
      } else {
        document.getElementById('editResultPreviewGrid').innerHTML = '';
        document.getElementById('editResultPreview').classList.add('hidden');
      }
      editModalBackdrop.classList.remove('hidden');
    }

    async function saveEditedOperation() {
      const id = document.getElementById('editOperationId').value;
      const operations = loadOperations();
      const index = operations.findIndex(item => item.id === id);
      if (index === -1) return;
      if (operations[index].status === 'Completado') {
        alert('Esta operación ya está completada y no se puede editar.');
        closeEditModal();
        return;
      }

      const actor = getCurrentUserEmail();
      const previousOperationSnapshot = JSON.parse(JSON.stringify(operations[index]));
      const previousStatus = operations[index].status;
      const previousAssignee = operations[index].technician || 'Sin asignar';
      const newType = document.getElementById('editOperationType').value;
      const newStatus = document.getElementById('editOperationStatus').value;
      const newTitle = document.getElementById('editOperationTitle').value.trim();
      const newAgencyInput = document.getElementById('editOperationAgency').value.trim();
      const newAgencyNumber = normalizeAgencyNumber(newAgencyInput);
      const newAgency = newAgencyNumber ? normalizeAgencyLabel(newAgencyNumber) : newAgencyInput;
      const newTechnician = (newType === 'Trabajo' ? document.getElementById('editOperationTechnician').value.trim() : normalizeStoredAssignee(document.getElementById('editOperationTechnician').value.trim(), newType)) || 'Sin asignar';
      const newDescription = document.getElementById('editOperationDescription').value.trim();
      const newSelectedTypes = getSelectedValues('editOperationTypeOptions');
      const resultImageFiles = Array.from(document.getElementById('editResultImage').files || []);
      const currentEvidence = getSafeMediaList(operations[index].resultImages);

      if (!newTitle || !newAgencyNumber || !newDescription) {
        alert('Completa título, agencia válida y descripción antes de guardar.');
        return;
      }

      if (!newSelectedTypes.length) {
        alert('Debes seleccionar al menos un tipo específico.');
        return;
      }

      if (newStatus === 'Pendiente' && newTechnician !== 'Sin asignar') {
        alert('Una operación pendiente no puede tener técnico o suplidor asignado.');
        return;
      }

      if (isAssignedStatus(newStatus) && newTechnician === 'Sin asignar') {
        alert('Debes asignar un técnico o suplidor antes de pasar la operación a ese estado.');
        return;
      }

      if (!isValidOperationTransition(previousStatus, newStatus)) {
        alert(getTransitionErrorMessage(previousStatus, newStatus));
        return;
      }

      if (newStatus === 'Completado' && !currentEvidence.length && !resultImageFiles.length) {
        alert('Debes subir al menos una evidencia (imagen o video) para completar la operación.');
        return;
      }

      if (newStatus === 'Completado' && !getStartTimestamp(operations[index])) {
        alert('No puedes completar la operación sin fecha de inicio. Primero debe estar en proceso.');
        return;
      }

      if (previousStatus !== 'Completado' && newStatus === 'Completado') {
        const confirmed = window.confirm('Esta operación pasará a Completado y luego no se podrá editar más. ¿Deseas continuar?');
        if (!confirmed) return;
      }

      operations[index].type = newType;
      operations[index].status = newStatus;
      operations[index].title = newTitle;
      operations[index].agency = newAgency;
      operations[index].agency_number = newAgencyNumber;
      operations[index].agency_label = newAgency;
      operations[index].technician = newTechnician;
      operations[index].description = newDescription;
      operations[index].selectedTypes = newSelectedTypes;
      operations[index].created_by = operations[index].created_by || operations[index].reportado_por_nombre || getCurrentOperationUserDisplayName();
      operations[index].nombre_encargado = operations[index].nombre_encargado || operations[index].created_by;
      operations[index].reportado_por_nombre = operations[index].reportado_por_nombre || operations[index].created_by;
      operations[index].grupo = operations[index].grupo || '';
      operations[index].nombre_encargado = operations[index].nombre_encargado || operations[index].created_by || '';
      operations[index].created_by = operations[index].created_by || operations[index].nombre_encargado || getCurrentUserEmail();
      operations[index] = enrichOperationWithAgencyContext(operations[index]);

      if (!Array.isArray(operations[index].history)) operations[index].history = [];

      const assignedNow = previousAssignee === 'Sin asignar' && newTechnician !== 'Sin asignar';
      const statusMovedToAssigned = previousStatus !== 'Asignada' && newStatus === 'Asignada';

      if ((assignedNow || statusMovedToAssigned) && !operations[index].assignedAt) {
        operations[index].assignedAt = nowIso();
      }

      if (assignedNow) {
        operations[index].history.push(createHistoryEntry({
          action: 'Asignación',
          detail: `Asignada a ${getAssigneeDisplayName(newTechnician, newType)}`,
          user: actor,
          prevStatus: previousStatus,
          newStatus: newStatus
        }));
      } else if (previousAssignee !== newTechnician && newTechnician !== 'Sin asignar') {
        operations[index].history.push(createHistoryEntry({
          action: 'Asignación',
          detail: `Responsable cambiado a ${getAssigneeDisplayName(newTechnician, newType)}`,
          user: actor,
          prevStatus: previousStatus,
          newStatus: newStatus
        }));
      }

      if (previousStatus !== newStatus) {
        if (newStatus === 'Asignada' && !operations[index].assignedAt) {
          operations[index].assignedAt = nowIso();
        }

        if (newStatus === 'En proceso') {
          if (!operations[index].assignedAt) {
            operations[index].assignedAt = nowIso();
          }
          if (!operations[index].startedAt) {
            operations[index].startedAt = nowIso();
          }
          operations[index].history.push(createHistoryEntry({
            action: 'Inicio',
            detail: 'Operación iniciada',
            user: actor,
            prevStatus: previousStatus,
            newStatus: newStatus
          }));
        } else if (newStatus === 'Completado') {
          if (!operations[index].assignedAt) {
            operations[index].assignedAt = nowIso();
          }
          operations[index].completedAt = nowIso();
          operations[index].closedAt = operations[index].completedAt;
          const resolutionMinutes = getResolutionMinutes(operations[index]);
          operations[index].resolutionTime = resolutionMinutes === null || resolutionMinutes === undefined ? '' : formatMinutesHuman(resolutionMinutes);
          const detail = operations[index].resolutionTime
            ? `Operación completada en ${operations[index].resolutionTime}`
            : 'Operación completada. Sin inicio registrado para calcular tiempo de resolución.';
          operations[index].history.push(createHistoryEntry({
            action: 'Finalización',
            detail,
            user: actor,
            prevStatus: previousStatus,
            newStatus: newStatus
          }));
        } else {
          operations[index].history.push(createHistoryEntry({
            action: 'Estado',
            detail: `Estado cambiado de ${previousStatus} a ${newStatus}`,
            user: actor,
            prevStatus: previousStatus,
            newStatus: newStatus
          }));
        }
      }

      if (resultImageFiles.length) {
        let loaded = 0;
        const results = [];
        resultImageFiles.forEach((file, idx) => {
          const reader = new FileReader();
          reader.onload = async function(e) {
            results[idx] = e.target.result;
            loaded++;
            if (loaded === resultImageFiles.length) {
              const current = getSafeMediaList(operations[index].resultImages);
              const validResults = results.filter(Boolean);
              operations[index].resultImages = current.concat(validResults);
              operations[index].history.push(createHistoryEntry({
                action: 'Evidencia',
                detail: `${validResults.length} evidencia(s) agregada(s)`,
                user: actor,
                prevStatus: operations[index].status,
                newStatus: operations[index].status
              }));
              saveOperations(operations);
              await syncOperationToBackendCero(operations[index]);
              saveOperations(operations);
              triggerOperationPushNotifications(previousOperationSnapshot, operations[index]);
              closeEditModal();
              renderOperations();
              renderHistory();
              renderReports();
              renderAgencyReports();
              renderOwnerReports();
              renderSpecificReports();
            }
          };
          reader.readAsDataURL(file);
        });
      } else {
        saveOperations(operations);
        await syncOperationToBackendCero(operations[index]);
        saveOperations(operations);
        closeEditModal();
        renderOperations();
        renderHistory();
        renderReports();
        renderAgencyReports();
        renderOwnerReports();
        renderSpecificReports();
      }
    }

    function deleteOperation(id) {
      const operations = loadOperations().filter(item => item.id !== id);
      saveOperations(operations);
      deleteOperationFromBackendCero(id);
      renderOperations();
      renderDashboard();
      renderHistory();
      populateAdvancedReportDropdowns();
      renderReports();
      renderAgencyReports();
      renderOwnerReports();
      renderSpecificReports();
    }

    function removeReportedImage(id, imageIndex) {
      const operations = loadOperations();
      const index = operations.findIndex(item => item.id === id);
      if (index === -1) return;
      operations[index].images = Array.isArray(operations[index].images) ? operations[index].images.filter((_, i) => i !== imageIndex) : [];
      saveOperations(operations);
      syncOperationToBackendCero(operations[index]);
      openEditModal(id);
      renderOperations();
      renderHistory();
      populateAdvancedReportDropdowns();
      renderReports();
      renderAgencyReports();
      renderOwnerReports();
      renderSpecificReports();
    }

    function removeEvidenceImage(id, imageIndex) {
      const operations = loadOperations();
      const index = operations.findIndex(item => item.id === id);
      if (index === -1) return;
      operations[index].resultImages = Array.isArray(operations[index].resultImages) ? operations[index].resultImages.filter((_, i) => i !== imageIndex) : [];
      saveOperations(operations);
      syncOperationToBackendCero(operations[index]);
      openEditModal(id);
      renderOperations();
      renderHistory();
      populateAdvancedReportDropdowns();
      renderReports();
      renderAgencyReports();
      renderOwnerReports();
      renderSpecificReports();
    }

    function showApp(session) {
      userEmailLabel.textContent = session.email;
      loginView.classList.add('hidden');
      appView.classList.remove('hidden');
      refreshOpenTypeSelectors();
      syncOperationCatalogsFromSupabase().catch(() => false);
      populateReportSpecificTypeOptions();
      populateAdvancedReportDropdowns();
      renderOperations();
      renderGenericTable('users', userSearch.value || '');
      renderGenericTable('suppliers', supplierSearch.value || '');
      renderGenericTable('work', workSearch.value || '');
      renderGenericTable('issue', issueSearch.value || '');
      renderHistory();
      renderReports();
      showView('operations');
    }

    function showLogin() {
      appView.classList.add('hidden');
      loginView.classList.add('hidden');
      // El formulario real de acceso lo gestiona la capa Supabase Auth (020-*).
    }

    function showAppForAuthenticatedUser(payload = {}) {
      const authState = window.lotekaAuthState || {};
      const user = payload.user || authState.user || authState.session?.user || null;
      if (!user) return false;
      const email = String(user.email || payload.perfil?.correo || authState.perfil?.correo || authState.profile?.correo || '').trim();
      if (document.readyState === 'complete') return bootLegacyRuntimeForAuthenticatedUser();
      showApp({ email: email || 'Usuario autenticado' });
      return true;
    }

    if (window.GOApp?.events?.on) {
      window.GOApp.events.on('auth:ready', showAppForAuthenticatedUser);
      window.GOApp.events.on('auth:signed-out', showLogin);
    }

    function updateTechnicianLabel(selectId, labelId, inputId) {
      const type = document.getElementById(selectId).value;
      const label = document.getElementById(labelId);
      if (type === 'Trabajo') {
        label.textContent = 'Suplidor';
      } else {
        label.textContent = 'Técnico asignado';
      }
      renderAssigneeOptions(inputId, type, document.getElementById(inputId).value || '');
    }

    loginBtn.addEventListener('click', () => {
      loginError.textContent = 'Utiliza el acceso seguro de Supabase.';
      loginError.classList.remove('hidden');
    });

    logoutBtn.addEventListener('click', async () => {
      try { await window.lotekaSupabase?.auth?.signOut(); } catch (_error) {}
      clearSession();
      showLogin();
    });

    document.getElementById('navDashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('navOperations').addEventListener('click', () => showView('operations'));
    document.getElementById('navLevantamientos').addEventListener('click', () => showView('levantamientos'));
    document.getElementById('navHistory').addEventListener('click', () => showView('history'));
    document.getElementById('navReports').addEventListener('click', () => showView('reports'));
    document.getElementById('navReportsAgency').addEventListener('click', () => showView('reportsAgency'));
    document.getElementById('navReportsOwner').addEventListener('click', () => showView('reportsOwner'));
    document.getElementById('navReportsSpecific').addEventListener('click', () => showView('reportsSpecific'));
    document.getElementById('navUsers').addEventListener('click', () => showView('users'));
    document.getElementById('navSuppliers').addEventListener('click', () => showView('suppliers'));
    document.getElementById('navWorks').addEventListener('click', () => showView('works'));
    document.getElementById('navIssues').addEventListener('click', () => showView('issues'));
    populateOperationAgencyOptions('');
    document.getElementById('openCreateModalBtn').addEventListener('click', openCreateModal);
    document.getElementById('addUserBtn').addEventListener('click', () => createCatalogItem('users'));
    document.getElementById('addSupplierBtn').addEventListener('click', () => createCatalogItem('suppliers'));
    document.getElementById('addWorkTypeBtn').addEventListener('click', () => createCatalogItem('work'));
    document.getElementById('addIssueTypeBtn').addEventListener('click', () => createCatalogItem('issue'));
    userSearch.addEventListener('input', () => renderGenericTable('users', userSearch.value));
    supplierSearch.addEventListener('input', () => renderGenericTable('suppliers', supplierSearch.value));
    workSearch.addEventListener('input', () => renderGenericTable('work', workSearch.value));
    issueSearch.addEventListener('input', () => renderGenericTable('issue', issueSearch.value));

    document.getElementById('operationType').addEventListener('change', (e) => {
      renderTypeOptions('operationTypeOptions', e.target.value, []);
      updateTechnicianLabel('operationType', 'labelTechnician', 'operationTechnician');
    });

    document.getElementById('editOperationType').addEventListener('change', (e) => {
      renderTypeOptions('editOperationTypeOptions', e.target.value, []);
      updateTechnicianLabel('editOperationType', 'editLabelTechnician', 'editOperationTechnician');
    });

    document.getElementById('operationTypeOptionsBtn').addEventListener('click', () => {
      document.getElementById('operationTypeOptionsMenu').classList.toggle('open');
      document.getElementById('operationTypeOptionsBtn').classList.toggle('open');
    });

    document.getElementById('editOperationTypeOptionsBtn').addEventListener('click', () => {
      document.getElementById('editOperationTypeOptionsMenu').classList.toggle('open');
      document.getElementById('editOperationTypeOptionsBtn').classList.toggle('open');
    });

    // Fase 4: el antiguo botón "Restablecer datos" fue retirado del listado.
    // Refresh y limpieza de filtros quedan bajo GOApp.operations.domain y nunca borran datos.

    function requestActiveOperationsRender(immediate = false) {
      try {
        const domain = window.GOApp?.operations?.domain;
        if (domain && typeof domain.scheduleRender === 'function') return domain.scheduleRender({ immediate });
        if (typeof window.renderOperations === 'function' && window.renderOperations !== renderOperations) return window.renderOperations();
      } catch (_error) {}
      return renderOperations();
    }


    [filterAgency, filterTech].forEach(el => {
      el.addEventListener('input', () => requestActiveOperationsRender(false));
    });
    [filterType, filterStatus, filterDateFrom, filterDateTo].forEach(el => {
      el.addEventListener('change', () => requestActiveOperationsRender(true));
    });

    [reportFilterType, reportFilterStatus, reportFilterSpecificType, reportFilterAgency, reportFilterOwner, reportFilterGroup, reportFilterReporter, reportFilterFrom, reportFilterTo].forEach(el => {
      el.addEventListener('input', renderReports);
      el.addEventListener('change', renderReports);
    });

    [agencyReportFilterType, agencyReportFilterStatus, agencyReportFilterAgency, agencyReportFilterFrom, agencyReportFilterTo].forEach(el => {
      el.addEventListener('input', renderAgencyReports);
      el.addEventListener('change', renderAgencyReports);
    });

    [ownerReportFilterType, ownerReportFilterStatus, ownerReportFilterOwner, ownerReportFilterFrom, ownerReportFilterTo].forEach(el => {
      el.addEventListener('input', renderOwnerReports);
      el.addEventListener('change', renderOwnerReports);
    });

    [specificReportFilterType, specificReportFilterSpecificType, specificReportFilterStatus, specificReportFilterFrom, specificReportFilterTo].forEach(el => {
      el.addEventListener('input', renderSpecificReports);
      el.addEventListener('change', renderSpecificReports);
    });

    [historyFilterSearch, historyFilterAction, historyFilterUser, historyFilterFrom, historyFilterTo].forEach(el => {
      el.addEventListener('input', renderHistory);
      el.addEventListener('change', renderHistory);
    });

    document.getElementById('reportClearBtn').addEventListener('click', () => {
      reportFilterType.value = '';
      reportFilterStatus.value = '';
      reportFilterSpecificType.value = '';
      reportFilterAgency.value = '';
      reportFilterOwner.value = '';
      reportFilterGroup.value = '';
      reportFilterReporter.value = '';
      reportFilterFrom.value = '';
      reportFilterTo.value = '';
      populateReportSpecificTypeOptions();
      renderReports();
    });

    document.getElementById('agencyReportClearBtn').addEventListener('click', () => {
      agencyReportFilterType.value = '';
      agencyReportFilterStatus.value = '';
      agencyReportFilterAgency.value = '';
      agencyReportFilterFrom.value = '';
      agencyReportFilterTo.value = '';
      renderAgencyReports();
    });

    document.getElementById('ownerReportClearBtn').addEventListener('click', () => {
      ownerReportFilterType.value = '';
      ownerReportFilterStatus.value = '';
      ownerReportFilterOwner.value = '';
      ownerReportFilterFrom.value = '';
      ownerReportFilterTo.value = '';
      renderOwnerReports();
    });

    document.getElementById('specificReportClearBtn').addEventListener('click', () => {
      specificReportFilterType.value = '';
      specificReportFilterSpecificType.value = '';
      specificReportFilterStatus.value = '';
      specificReportFilterFrom.value = '';
      specificReportFilterTo.value = '';
      populateDedicatedSpecificTypeOptions();
      renderSpecificReports();
    });

    document.getElementById('historyClearBtn').addEventListener('click', () => {
      historyFilterSearch.value = '';
      historyFilterAction.value = '';
      historyFilterUser.value = '';
      historyFilterFrom.value = '';
      historyFilterTo.value = '';
      renderHistory();
    });

    document.getElementById('reportExportBtn').addEventListener('click', () => {
      const operations = getReportFilteredOperations();
      exportRowsToCsv(
        'reportes_operaciones.csv',
        ['Código', 'Tipo', 'Título', 'Agencia', 'Responsable', 'Estado', 'Fecha', 'Tipos específicos', 'Tiempo de resolución'],
        operations.map(op => [
          op.code,
          op.type,
          op.title,
          op.agency,
          op.technician,
          op.status,
          formatDate(op.createdAt),
          (op.selectedTypes || []).join(' | '),
          getResolutionTimeLabel(op)
        ])
      );
    });

    document.getElementById('agencyReportExportBtn').addEventListener('click', () => {
      const operations = getOperationsByFilters({
        typeValue: agencyReportFilterType.value,
        statusValue: agencyReportFilterStatus.value,
        agencyValue: agencyReportFilterAgency.value,
        fromValue: agencyReportFilterFrom.value,
        toValue: agencyReportFilterTo.value
      });
      const rows = buildAgencyGroups(operations);
      exportRowsToCsv(
        'reportes_por_agencia.csv',
        ['Agencia', 'Total', 'Cerradas', 'Activas', 'Asignación promedio', 'Respuesta promedio', 'Resolución promedio'],
        rows.map(row => [row.agency, row.total, row.completed, row.stillOpen, formatMinutesHuman(row.avgAssign), formatMinutesHuman(row.avgResponse || 0), formatMinutesHuman(row.avgResolution)])
      );
    });

    document.getElementById('ownerReportExportBtn').addEventListener('click', () => {
      const operations = getOperationsByFilters({
        typeValue: ownerReportFilterType.value,
        statusValue: ownerReportFilterStatus.value,
        ownerValue: ownerReportFilterOwner.value,
        fromValue: ownerReportFilterFrom.value,
        toValue: ownerReportFilterTo.value
      });
      const rows = buildOwnerGroups(operations);
      exportRowsToCsv(
        'reportes_por_responsable.csv',
        ['Responsable', 'Total', 'Cerradas', 'Activas', 'Asignación promedio', 'Respuesta promedio', 'Resolución promedio'],
        rows.map(row => [getAssigneeDisplayName(row.owner, 'Avería'), row.total, row.completed, row.inProgress, formatMinutesHuman(row.avgAssign), formatMinutesHuman(row.avgResponse || 0), formatMinutesHuman(row.avgResolution)])
      );
    });

    document.getElementById('specificReportExportBtn').addEventListener('click', () => {
      const operations = getOperationsByFilters({
        typeValue: specificReportFilterType.value,
        statusValue: specificReportFilterStatus.value,
        specificTypeValue: specificReportFilterSpecificType.value,
        fromValue: specificReportFilterFrom.value,
        toValue: specificReportFilterTo.value
      });
      const rows = buildCategoryGroups(operations);
      exportRowsToCsv(
        'reportes_por_tipos_especificos.csv',
        ['Tipo específico', 'Total', 'Cerradas', 'Activas', 'Asignación promedio', 'Respuesta promedio', 'Resolución promedio'],
        rows.map(row => [row.category, row.total, row.completed, row.stillOpen, formatMinutesHuman(row.avgAssign), formatMinutesHuman(row.avgResponse || 0), formatMinutesHuman(row.avgResolution)])
      );
    });

    document.getElementById('reportPrintBtn').addEventListener('click', printGeneralReport);
    document.getElementById('agencyReportPrintBtn').addEventListener('click', printAgencyReport);
    document.getElementById('ownerReportPrintBtn').addEventListener('click', printOwnerReport);
    document.getElementById('specificReportPrintBtn').addEventListener('click', printSpecificTypeReport);

    document.getElementById('historyExportBtn').addEventListener('click', () => {
      const entries = getFilteredHistoryEntries();
      exportRowsToCsv(
        'historial_operaciones.csv',
        ['Fecha y hora', 'Código', 'Acción', 'Título', 'Tipo', 'Agencia', 'Usuario', 'Estado anterior', 'Estado nuevo', 'Detalle'],
        entries.map(item => [
          formatDate(item.timestamp),
          item.code,
          item.action,
          item.title,
          item.type,
          item.agency,
          item.user,
          item.prevStatus || '',
          item.newStatus || '',
          item.detail
        ])
      );
    });

    document.addEventListener('click', (e) => {
      const createWrap = document.getElementById('operationTypeOptionsBtn')?.closest('.multi-select');
      const editWrap = document.getElementById('editOperationTypeOptionsBtn')?.closest('.multi-select');
      if (createWrap && !createWrap.contains(e.target)) {
        document.getElementById('operationTypeOptionsMenu')?.classList.remove('open');
        document.getElementById('operationTypeOptionsBtn')?.classList.remove('open');
      }
      if (editWrap && !editWrap.contains(e.target)) {
        document.getElementById('editOperationTypeOptionsMenu')?.classList.remove('open');
        document.getElementById('editOperationTypeOptionsBtn')?.classList.remove('open');
      }
    });

    window.closeCreateModal = closeCreateModal;
    window.closeDetailModal = closeDetailModal;
    window.closeEditModal = closeEditModal;
    window.showDetail = showDetail;
    window.openEditModal = openEditModal;
    window.saveEditedOperation = saveEditedOperation;
    window.deleteOperation = deleteOperation;
    window.removeReportedImage = removeReportedImage;
    window.removeEvidenceImage = removeEvidenceImage;
    window.viewCatalogItem = viewCatalogItem;
    window.editCatalogItem = editCatalogItem;
    window.deleteCatalogItem = deleteCatalogItem;


    document.getElementById('dashboardRefreshBtn')?.addEventListener('click', () => runOperationalRefresh());
    document.getElementById('dashboardNotifyBtn')?.addEventListener('click', async () => {
      initializeRealtimeSync();
      const granted = await requestNotificationPermissionIfNeeded();
      notificationsEnabled = granted || !('Notification' in window);
      localStorage.setItem(NOTIFY_STORAGE_KEY, notificationsEnabled ? 'true' : 'false');
      updateNotificationButtonState();
      showToastNotification(
        notificationsEnabled ? 'Notificaciones activadas' : 'Recibirás avisos internos en tiempo real',
        notificationsEnabled ? 'Recibirás avisos con sonido cuando entren operaciones o cambien de estado.' : 'El canal en vivo quedó activo. Si el navegador no permite alertas del sistema, seguirás viendo avisos dentro del panel.',
        notificationsEnabled ? 'success' : 'info'
      );
    });

    // CAPA 1 rendimiento: no refrescar operaciones completas al volver a la pestaña.
    // Realtime/Supabase ya sincroniza eventos reales. Aquí solo se asegura la conexión.
    window.addEventListener('focus', () => {
      if (!realtimeConnected) initializeRealtimeSync();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !realtimeConnected) initializeRealtimeSync();
    });

    function startLiveSyncWatchdog() {
      if (window.__lotekaLiveSyncWatchdogStarted) return;
      window.__lotekaLiveSyncWatchdogStarted = true;
      window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (!realtimeConnected) initializeRealtimeSync();
      }, 60000);
    }

    let legacyAuthenticatedBooted = false;
    function bootLegacyRuntimeForAuthenticatedUser() {
      const session = getSession();
      if (!session) {
        showLogin();
        return false;
      }
      if (legacyAuthenticatedBooted) {
        showApp(session);
        return true;
      }
      legacyAuthenticatedBooted = true;
      updateNotificationButtonState();
      initializeRealtimeSync();
      startLiveSyncWatchdog();
      runOperationalRefresh({ silent: true });
      const operations = loadOperations();
      let changed = false;
      operations.forEach(op => {
        if (op.status === 'Cerrado') {
          op.status = 'Completado';
          changed = true;
        }
        if (!Array.isArray(op.history)) {
          op.history = [createHistoryEntry({ action: 'Creación', detail: 'Operación creada', user: 'Sistema web', newStatus: 'Pendiente' })];
          if (op.technician && op.technician !== 'Sin asignar') op.history.push(createHistoryEntry({ action: 'Asignación', detail: `Asignada a ${getAssigneeDisplayName(op.technician, op.type)}`, user: 'Sistema web' }));
          if (op.status === 'En proceso') op.history.push(createHistoryEntry({ action: 'Inicio', detail: 'Operación iniciada', user: 'Sistema web', prevStatus: 'Asignada', newStatus: 'En proceso' }));
          if (op.status === 'Completado') op.history.push(createHistoryEntry({ action: 'Finalización', detail: op.resolutionTime ? `Operación completada en ${op.resolutionTime}` : 'Operación completada', user: 'Sistema web', prevStatus: op.assignedAt ? 'Asignada' : 'Pendiente', newStatus: 'Completado' }));
          changed = true;
        }
        if (Array.isArray(op.history) && op.history.some(item => item && typeof item === 'object' && (!Object.prototype.hasOwnProperty.call(item, 'prevStatus') || !Object.prototype.hasOwnProperty.call(item, 'newStatus')))) {
          op.history = op.history.map(item => ({
            id: item.id || crypto.randomUUID(),
            action: item.action || '',
            detail: item.detail || '',
            user: item.user || 'Sistema web',
            prevStatus: Object.prototype.hasOwnProperty.call(item, 'prevStatus') ? item.prevStatus : null,
            newStatus: Object.prototype.hasOwnProperty.call(item, 'newStatus') ? item.newStatus : null,
            timestamp: getHistoryTimestamp(item) || op.createdAt
          }));
          changed = true;
        }
        if (typeof op.closedAt === 'undefined') {
          op.closedAt = null;
          changed = true;
        }
        const inferredAssignedAt = inferAssignedAtFromHistory(op);
        const inferredStartedAt = inferStartedAtFromHistory(op);
        const inferredCompletedAt = inferCompletedAtFromHistory(op);

        if (!op.assignedAt && inferredAssignedAt) {
          op.assignedAt = inferredAssignedAt;
          changed = true;
        } else if (typeof op.assignedAt === 'undefined') {
          op.assignedAt = null;
          changed = true;
        }

        if (!op.startedAt && inferredStartedAt) {
          op.startedAt = inferredStartedAt;
          changed = true;
        } else if (typeof op.startedAt === 'undefined') {
          op.startedAt = null;
          changed = true;
        }

        if ((!op.completedAt && inferredCompletedAt) || (op.status === 'Completado' && inferredCompletedAt && op.completedAt !== inferredCompletedAt)) {
          op.completedAt = inferredCompletedAt;
          changed = true;
        } else if (typeof op.completedAt === 'undefined') {
          op.completedAt = op.status === 'Completado' ? (inferredCompletedAt || null) : null;
          changed = true;
        }

        const recalculatedMinutes = op.status === 'Completado' ? getResolutionMinutes(op) : null;
        const recalculatedResolutionTime = recalculatedMinutes === null || recalculatedMinutes === undefined ? '' : formatMinutesHuman(recalculatedMinutes);
        if (op.resolutionTime !== recalculatedResolutionTime) {
          op.resolutionTime = recalculatedResolutionTime;
          changed = true;
        }
      });
      if (changed) saveOperations(operations);
      renderDashboard();
      populateReportSpecificTypeOptions();
      showApp(session);
      return true;
    }

    window.addEventListener('load', bootLegacyRuntimeForAuthenticatedUser);
  

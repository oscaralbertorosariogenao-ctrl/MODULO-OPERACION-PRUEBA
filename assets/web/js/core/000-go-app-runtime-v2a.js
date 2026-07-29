(function(global){
  'use strict';

  if(global.GOApp && global.GOApp.__phase2aRuntime){ return; }

  var VERSION = '2A.1';
  var cacheStore = new Map();
  var inflight = new Map();
  var eventListeners = new Map();
  var stateListeners = new Set();
  var moduleStore = new Map();
  var supabaseClient = null;
  var stateData = {
    session: null,
    user: null,
    perfil: null,
    permissions: [],
    activeView: null,
    bootedAt: Date.now()
  };
  var metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    deduplicatedRequests: 0,
    completedLoads: 0,
    failedLoads: 0,
    invalidations: 0
  };

  function now(){ return Date.now(); }
  function safeCall(fn, args){
    try{ return fn.apply(null, args || []); }
    catch(error){ console.error('[GOApp] Error en listener:', error); }
  }
  function normalizeKey(key){ return String(key == null ? '' : key).trim(); }
  function cloneState(){
    return {
      session: stateData.session,
      user: stateData.user,
      perfil: stateData.perfil,
      permissions: Array.isArray(stateData.permissions) ? stateData.permissions.slice() : [],
      activeView: stateData.activeView,
      bootedAt: stateData.bootedAt
    };
  }

  var events = {
    on: function(name, handler){
      name = normalizeKey(name);
      if(!name || typeof handler !== 'function') return function(){};
      if(!eventListeners.has(name)) eventListeners.set(name, new Set());
      eventListeners.get(name).add(handler);
      return function(){ events.off(name, handler); };
    },
    once: function(name, handler){
      var off = events.on(name, function(payload){ off(); handler(payload); });
      return off;
    },
    off: function(name, handler){
      var set = eventListeners.get(normalizeKey(name));
      if(set) set.delete(handler);
    },
    emit: function(name, payload){
      var set = eventListeners.get(normalizeKey(name));
      if(!set) return;
      Array.from(set).forEach(function(handler){ safeCall(handler, [payload]); });
    }
  };

  var state = {
    get: function(key){ return key ? stateData[key] : cloneState(); },
    set: function(key, value){
      var previous = stateData[key];
      stateData[key] = value;
      var change = { key:key, value:value, previous:previous, state:cloneState() };
      stateListeners.forEach(function(listener){ safeCall(listener, [change]); });
      events.emit('state:change', change);
      events.emit('state:' + key, change);
      return value;
    },
    patch: function(values){
      values = values || {};
      Object.keys(values).forEach(function(key){ state.set(key, values[key]); });
      return cloneState();
    },
    subscribe: function(listener){
      if(typeof listener !== 'function') return function(){};
      stateListeners.add(listener);
      return function(){ stateListeners.delete(listener); };
    },
    resetSession: function(){
      state.patch({ session:null, user:null, perfil:null, permissions:[], activeView:null });
    },
    snapshot: cloneState
  };

  var cache = {
    get: function(key){
      key = normalizeKey(key);
      var item = cacheStore.get(key);
      if(!item) return undefined;
      if(item.expiresAt && item.expiresAt <= now()){
        cacheStore.delete(key);
        return undefined;
      }
      return item.value;
    },
    has: function(key){ return cache.get(key) !== undefined; },
    set: function(key, value, ttl){
      key = normalizeKey(key);
      if(!key) return value;
      var lifetime = Number(ttl || 0);
      cacheStore.set(key, {
        value:value,
        createdAt:now(),
        expiresAt:lifetime > 0 ? now() + lifetime : 0
      });
      return value;
    },
    remove: function(key){ return cacheStore.delete(normalizeKey(key)); },
    invalidate: function(prefix){
      prefix = normalizeKey(prefix);
      var removed = 0;
      Array.from(cacheStore.keys()).forEach(function(key){
        if(!prefix || key.indexOf(prefix) === 0){ cacheStore.delete(key); removed += 1; }
      });
      Array.from(inflight.keys()).forEach(function(key){
        if(!prefix || key.indexOf(prefix) === 0){ inflight.delete(key); }
      });
      metrics.invalidations += removed;
      events.emit('cache:invalidated', { prefix:prefix, removed:removed });
      return removed;
    },
    clear: function(){ return cache.invalidate(''); },
    stats: function(){
      return { entries:cacheStore.size, inflight:inflight.size, metrics:Object.assign({}, metrics) };
    }
  };

  var data = {
    fetch: function(key, loader, options){
      key = normalizeKey(key);
      options = options || {};
      if(!key) return Promise.reject(new Error('GOApp.data.fetch requiere una clave.'));
      if(typeof loader !== 'function') return Promise.reject(new Error('GOApp.data.fetch requiere un loader.'));

      if(!options.force){
        var cached = cache.get(key);
        if(cached !== undefined){
          metrics.cacheHits += 1;
          events.emit('data:cache-hit', { key:key });
          return Promise.resolve(cached);
        }
        if(inflight.has(key)){
          metrics.deduplicatedRequests += 1;
          events.emit('data:deduplicated', { key:key });
          return inflight.get(key);
        }
      }

      metrics.cacheMisses += 1;
      events.emit('data:loading', { key:key, forced:!!options.force });
      var started = now();
      var promise = Promise.resolve()
        .then(loader)
        .then(function(value){
          cache.set(key, value, options.ttl || 0);
          metrics.completedLoads += 1;
          events.emit('data:loaded', { key:key, duration:now()-started });
          return value;
        })
        .catch(function(error){
          metrics.failedLoads += 1;
          events.emit('data:error', { key:key, error:error, duration:now()-started });
          throw error;
        })
        .finally(function(){ inflight.delete(key); });
      inflight.set(key, promise);
      return promise;
    },
    invalidate: cache.invalidate,
    clear: cache.clear
  };

  var errors = {
    friendly: function(error){
      var message = String(error && error.message ? error.message : error || 'Error desconocido');
      if(/Failed to fetch|NetworkError|Load failed|fetch/i.test(message)) return 'No se pudo conectar. Revisa internet e intenta nuevamente.';
      if(/42501|permission|row-level|policy|permiso/i.test(message)) return 'Tu usuario no tiene autorización para completar esta acción.';
      if(/JWT|session|auth|token/i.test(message)) return 'La sesión venció. Inicia sesión nuevamente.';
      return message;
    },
    capture: function(error, context){
      context = context || {};
      var entry = {
        error:error,
        message:errors.friendly(error),
        context:context,
        timestamp:new Date().toISOString()
      };
      console.error('[GOApp]', context.module || 'Sistema', context.action || 'acción', error);
      events.emit('error', entry);
      return entry;
    }
  };

  var modules = {
    register: function(name, definition){
      name = normalizeKey(name);
      if(!name) throw new Error('Nombre de módulo requerido.');
      var current = moduleStore.get(name) || {};
      moduleStore.set(name, Object.assign({}, current, definition || {}, {
        name:name,
        registeredAt:current.registeredAt || now()
      }));
      events.emit('module:registered', { name:name, module:moduleStore.get(name) });
      return moduleStore.get(name);
    },
    get: function(name){ return moduleStore.get(normalizeKey(name)) || null; },
    list: function(){ return Array.from(moduleStore.values()); },
    refresh: function(name){
      var item = modules.get(name);
      if(item && typeof item.refresh === 'function') return item.refresh();
      return null;
    }
  };

  var supabase = {
    setClient: function(client){ supabaseClient = client || null; events.emit('supabase:client', { client:supabaseClient }); return supabaseClient; },
    getClient: function(){ return supabaseClient || global.lotekaSupabase || global.supabaseClient || null; },
    requireClient: function(){
      var client = supabase.getClient();
      if(!client) throw new Error('Supabase no está disponible.');
      return client;
    }
  };

  var GOApp = {
    __phase2aRuntime:true,
    version:VERSION,
    events:events,
    state:state,
    cache:cache,
    data:data,
    errors:errors,
    modules:modules,
    supabase:supabase,
    metrics:metrics,
    diagnostics:function(){
      return {
        version:VERSION,
        state:state.snapshot(),
        cache:cache.stats(),
        modules:modules.list().map(function(item){ return { name:item.name, version:item.version || null, registeredAt:item.registeredAt }; })
      };
    }
  };

  global.GOApp = GOApp;
  global.addEventListener('beforeunload', function(){ events.emit('app:beforeunload', GOApp.diagnostics()); });
  console.info('[GOApp] Núcleo compartido Fase 2A cargado · v' + VERSION);
})(window);

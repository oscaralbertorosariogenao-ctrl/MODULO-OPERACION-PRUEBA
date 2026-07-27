/* Grupo Ortiz · carga controlada de Supabase para la PWA móvil. */
(() => {
  const urls = Object.freeze([
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js'
  ]);
  const timeoutMs = 7000;

  function available() {
    return Boolean(globalThis.supabase?.createClient);
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        cleanup();
        script.remove();
        reject(new Error(`Tiempo agotado al cargar ${url}`));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      };
      const onLoad = () => {
        cleanup();
        available() ? resolve(globalThis.supabase) : reject(new Error('Supabase no quedó disponible.'));
      };
      const onError = () => {
        cleanup();
        script.remove();
        reject(new Error(`No se pudo cargar ${url}`));
      };
      script.src = url;
      script.async = false;
      script.crossOrigin = 'anonymous';
      script.dataset.supabaseClient = 'true';
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.append(script);
    });
  }

  const loaderPromise = (async () => {
    if (available()) return globalThis.supabase;
    let lastError = null;
    for (const url of urls) {
      try {
        return await loadScript(url);
      } catch (error) {
        lastError = error;
        console.warn('[Grupo Ortiz] Fuente de Supabase no disponible.', url);
      }
    }
    throw lastError || new Error('No se pudo cargar Supabase.');
  })();
  globalThis.__goSupabaseLibraryReady = loaderPromise;
  loaderPromise.catch(() => null);
})();

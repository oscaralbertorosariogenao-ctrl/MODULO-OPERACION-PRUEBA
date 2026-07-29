
(function(){
  'use strict';
  window.lotekaGetApiAuthHeaders = async function(baseHeaders){
    var client = window.lotekaSupabase || window.supabaseClient || null;
    if(!client || !client.auth || typeof client.auth.getSession !== 'function'){
      throw new Error('No hay una sesión autenticada disponible.');
    }
    var result = await client.auth.getSession();
    var token = result && result.data && result.data.session ? result.data.session.access_token : '';
    if(!token) throw new Error('Tu sesión venció. Inicia sesión nuevamente.');
    return Object.assign({}, baseHeaders || {}, { Authorization:'Bearer '+token });
  };
})();


(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function closeMenu(){
    var menu = $('ltkAccountMenu');
    var btn = $('ltkTopbarAccountBtn');
    if(menu){ menu.classList.remove('is-open'); menu.setAttribute('aria-hidden','true'); }
    if(btn){ btn.setAttribute('aria-expanded','false'); }
  }
  function toggleMenu(ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); }
    var menu = $('ltkAccountMenu');
    var btn = $('ltkTopbarAccountBtn');
    if(!menu) return;
    var open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function buildPasswordModal(){
    if($('ltkChangePasswordModal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'ltkChangePasswordModal';
    wrap.className = 'ltk-pass-overlay';
    wrap.innerHTML = ''+
      '<section class="ltk-pass-modal" role="dialog" aria-modal="true" aria-label="Cambiar contraseña">'+
        '<div class="ltk-pass-head"><div><h3><i class="fas fa-key"></i> Cambiar contraseña</h3><p>Actualiza tu acceso de forma segura.</p></div><button type="button" class="ltk-pass-close" id="ltkPassClose"><i class="fas fa-xmark"></i></button></div>'+ 
        '<form id="ltkChangePasswordForm">'+
          '<div class="ltk-pass-body">'+
            '<div class="ltk-pass-field"><label>Contraseña actual</label><input id="ltkPassCurrent" type="password" autocomplete="current-password" placeholder="Contraseña actual" required></div>'+ 
            '<div class="ltk-pass-field"><label>Nueva contraseña</label><input id="ltkPassNew" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" minlength="8" required></div>'+ 
            '<div class="ltk-pass-field"><label>Confirmar nueva contraseña</label><input id="ltkPassConfirm" type="password" autocomplete="new-password" placeholder="Repite la nueva contraseña" minlength="8" required></div>'+ 
            '<div id="ltkPassMsg" class="ltk-pass-msg"></div>'+ 
          '</div>'+ 
          '<div class="ltk-pass-actions"><button type="button" class="ltk-pass-cancel" id="ltkPassCancel">Cancelar</button><button type="submit" class="ltk-pass-save" id="ltkPassSave">Guardar contraseña</button></div>'+ 
        '</form>'+ 
      '</section>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function(e){ if(e.target === wrap) closePasswordModal(); });
    $('ltkPassClose').addEventListener('click', closePasswordModal);
    $('ltkPassCancel').addEventListener('click', closePasswordModal);
    $('ltkChangePasswordForm').addEventListener('submit', submitPasswordChange);
  }
  function setMsg(text, type){
    var msg = $('ltkPassMsg');
    if(!msg) return;
    msg.textContent = text || '';
    msg.className = 'ltk-pass-msg' + (type ? ' is-' + type : '');
  }
  function openPasswordModal(){
    closeMenu();
    buildPasswordModal();
    var form = $('ltkChangePasswordForm');
    if(form) form.reset();
    setMsg('', '');
    var modal = $('ltkChangePasswordModal');
    if(modal) modal.classList.add('is-open');
    setTimeout(function(){ try{ $('ltkPassCurrent').focus(); }catch(e){} }, 80);
  }
  function closePasswordModal(){
    var modal = $('ltkChangePasswordModal');
    if(modal) modal.classList.remove('is-open');
  }
  async function submitPasswordChange(e){
    e.preventDefault();
    setMsg('', '');
    var current = ($('ltkPassCurrent') && $('ltkPassCurrent').value || '').trim();
    var next = ($('ltkPassNew') && $('ltkPassNew').value || '').trim();
    var confirm = ($('ltkPassConfirm') && $('ltkPassConfirm').value || '').trim();
    var save = $('ltkPassSave');
    if(!current){ setMsg('Escribe tu contraseña actual.', 'error'); return; }
    if(next.length < 8){ setMsg('La nueva contraseña debe tener mínimo 8 caracteres.', 'error'); return; }
    if(next !== confirm){ setMsg('La confirmación no coincide con la nueva contraseña.', 'error'); return; }
    var client = window.lotekaSupabase;
    if(!client || !client.auth){ setMsg('No se encontró la conexión de Supabase Auth.', 'error'); return; }
    if(save){ save.disabled = true; save.textContent = 'Guardando...'; }
    try{
      var sessionRes = await client.auth.getSession();
      var session = sessionRes && sessionRes.data && sessionRes.data.session;
      var email = session && session.user && session.user.email;
      if(!email) throw new Error('No se pudo validar el usuario actual.');
      var verify = await client.auth.signInWithPassword({ email: email, password: current });
      if(verify.error) throw new Error('La contraseña actual no es correcta.');
      var upd = await client.auth.updateUser({ password: next });
      if(upd.error) throw upd.error;
      try{ if(typeof window.lotekaAudit === 'function') await window.lotekaAudit('Sistema','CAMBIO_PASSWORD','perfiles', session.user.id, 'Cambio de contraseña realizado', null, { correo: email }); }catch(auditErr){}
      setMsg('Contraseña actualizada correctamente.', 'success');
      setTimeout(closePasswordModal, 1200);
    }catch(err){
      setMsg((err && err.message) ? err.message : 'No se pudo cambiar la contraseña.', 'error');
    }finally{
      if(save){ save.disabled = false; save.textContent = 'Guardar contraseña'; }
    }
  }
  function install(){
    buildPasswordModal();
    var btn = $('ltkTopbarAccountBtn');
    var change = $('ltkOpenChangePassword');
    var logout = $('ltkAccountLogout');
    if(btn && !btn.dataset.ltkAccountReady){ btn.dataset.ltkAccountReady='1'; btn.addEventListener('click', toggleMenu); }
    if(change && !change.dataset.ltkAccountReady){ change.dataset.ltkAccountReady='1'; change.addEventListener('click', openPasswordModal); }
    if(logout && !logout.dataset.ltkAccountReady){
      logout.dataset.ltkAccountReady='1';
      logout.addEventListener('click', function(){ closeMenu(); var old = $('ltkTopbarLogout'); if(old) old.click(); else if(window.lotekaSupabase && window.lotekaSupabase.auth) window.lotekaSupabase.auth.signOut(); });
    }
    document.addEventListener('click', function(e){
      var menu = $('ltkAccountMenu'); var btn = $('ltkTopbarAccountBtn');
      if(menu && menu.classList.contains('is-open') && !menu.contains(e.target) && e.target !== btn && !(btn && btn.contains(e.target))) closeMenu();
    });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeMenu(); closePasswordModal(); } });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();

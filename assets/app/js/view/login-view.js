import { el } from '../components/dom.js';
export function loginView({ error = '', loading = false } = {}){
  return el('main',{class:'login-page'},el('section',{class:'login-shell','aria-labelledby':'login-title'},
    el('div',{class:'login-brand'},el('img',{src:'./assets/app/img/grupo-ortiz-logo-clean.png',alt:'Grupo Ortiz'}),el('p',{text:'Aplicación móvil segura de Operaciones'})),
    el('form',{class:'login-card','data-form':'login',novalidate:''},
      el('div',{},el('h1',{id:'login-title',text:'Iniciar sesión'}),el('p',{class:'muted',text:'Accede con tu correo o usuario autorizado.'})),
      field('Correo o usuario',el('input',{class:'input',name:'identity',type:'text',autocomplete:'username',inputmode:'email',required:'',placeholder:'usuario o correo@grupoortiz.com.do','aria-describedby':error ? 'login-error' : null})),
      field('Contraseña',el('div',{class:'password-wrap'},el('input',{class:'input',name:'password',type:'password',autocomplete:'current-password',required:'',placeholder:'Escribe tu contraseña','data-password-field':'true'}),el('button',{class:'password-toggle',type:'button','data-action':'toggle-password','aria-label':'Mostrar contraseña'},'◉'))),
      error ? el('div',{class:'login-error',id:'login-error',role:'alert',text:error}) : null,
      el('button',{class:'btn btn-primary btn-block',type:'submit',disabled:loading ? '' : null},loading ? 'Verificando…' : 'Entrar a Operaciones'),
      el('button',{class:'btn btn-ghost btn-block',type:'button','data-action':'login-help'},'¿Problemas para acceder?'),
      el('div',{class:'login-security'},el('span',{'aria-hidden':'true',text:'🔒'}),el('span',{text:'Supabase Auth · Sesión protegida'}))
    )
  ));
}
function field(label,control){ return el('label',{class:'field'},el('span',{text:label}),control); }

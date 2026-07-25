import { AppController } from './app-controller.js';
const root = document.getElementById('app');
if(!root) throw new Error('No se encontró el contenedor principal de la app.');
if(!document.documentElement.dataset.goV805Bootstrapped){
  document.documentElement.dataset.goV805Bootstrapped = 'true';
  const controller = new AppController(root);
  controller.init().catch(error => { console.error('[Grupo Ortiz] Bootstrap falló',error); root.textContent = 'No se pudo iniciar la aplicación. Revisa la conexión e inténtalo otra vez.'; });
}

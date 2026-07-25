import { el } from '../components/dom.js';
import { appHeader } from '../components/app-header.js';
import { bottomNavigation } from '../components/bottom-navigation.js';
import { appDrawer } from '../components/app-drawer.js';
import { offlineBanner } from '../components/offline-banner.js';
export function appFrameView(state, content){
  return el('div',{class:'app-frame'},appHeader(state),offlineBanner(state.connectivity),el('main',{class:'app-main',id:'app-view',tabindex:'-1'},el('div',{class:'app-view'},content)),bottomNavigation(state.route.path),appDrawer(state));
}

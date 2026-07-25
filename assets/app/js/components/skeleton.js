import { el } from './dom.js';
export function skeletonCards(count = 4){ return el('div',{class:'list'},Array.from({length:count},() => el('div',{class:'card skeleton skeleton-card','aria-hidden':'true'}))); }

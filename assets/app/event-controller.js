import { el } from './dom.js';
export function searchInput({ value = '', placeholder = 'Buscar…', action = 'search-input', label = 'Buscar' } = {}){
  return el('label',{class:'search-box'},el('span',{class:'sr-only',text:label}),el('input',{class:'input',type:'search',value,placeholder,autocomplete:'off','data-input-action':action,'aria-label':label}));
}

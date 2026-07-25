export function el(tag, attributes = {}, ...children){
  const node = document.createElement(tag);
  for(const [key, value] of Object.entries(attributes || {})){
    if(value === null || value === undefined || value === false) continue;
    if(key === 'class') node.className = String(value);
    else if(key === 'dataset') Object.entries(value).forEach(([dataKey, dataValue]) => { node.dataset[dataKey] = String(dataValue); });
    else if(key === 'text') node.textContent = String(value);
    else if(key === 'htmlFor') node.htmlFor = String(value);
    else if(key === 'checked') node.checked = Boolean(value);
    else if(key === 'selected') node.selected = Boolean(value);
    else if(key === 'value') node.value = String(value);
    else node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
}
export function append(parent, children){
  for(const child of children.flat(Infinity)){
    if(child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}
export function clear(node){ node.replaceChildren(); return node; }
export function fragment(...children){ return append(document.createDocumentFragment(), children); }
export function qs(selector, root = document){ return root.querySelector(selector); }
export function qsa(selector, root = document){ return [...root.querySelectorAll(selector)]; }
export function initials(name){ return String(name || 'GO').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
export function setText(node, value){ if(node) node.textContent = String(value ?? ''); }
export function option(value, label, selected = false){ return el('option', { value, selected, text:label }); }

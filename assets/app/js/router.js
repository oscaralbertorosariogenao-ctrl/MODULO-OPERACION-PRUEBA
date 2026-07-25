import { ROUTES } from './config.js';
const validRoots = new Set(Object.values(ROUTES));
export function parseHash(hash = location.hash){
  const raw = String(hash || '#/home').replace(/^#/, '') || '/home';
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  let path = `/${segments[0] || 'home'}`;
  const params = {};
  if(path === ROUTES.operation && segments[1]) params.id = decodeURIComponent(segments.slice(1).join('/'));
  if(path === ROUTES.agency && segments[1]) params.id = decodeURIComponent(segments.slice(1).join('/'));
  if(path === '/operations' && segments[1] === 'new') path = ROUTES.createOperation;
  if(!validRoots.has(path)) path = ROUTES.home;
  return { path, params, query:new URLSearchParams(queryPart) };
}
export function navigate(path, params = {}, query = null, { replace = false } = {}){
  let target = path;
  if(path === ROUTES.operation && params.id) target += `/${encodeURIComponent(params.id)}`;
  if(path === ROUTES.agency && params.id) target += `/${encodeURIComponent(params.id)}`;
  const qs = query instanceof URLSearchParams ? query.toString() : new URLSearchParams(query || {}).toString();
  const hash = `#${target}${qs ? `?${qs}` : ''}`;
  if(replace) location.replace(hash); else location.hash = hash;
}
export function startRouter(callback){
  const onChange = () => callback(parseHash());
  globalThis.addEventListener('hashchange', onChange);
  onChange();
  return () => globalThis.removeEventListener('hashchange', onChange);
}

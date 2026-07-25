const DB_NAME = 'go-v805-drafts'; const STORE_NAME = 'drafts';
function openDb(){
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if(!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function transact(mode, operation){
  const db = await openDb();
  try{ return await new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, mode); const store = tx.objectStore(STORE_NAME); const req = operation(store); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
  finally{ db.close(); }
}
export function saveDraft(key, value){ return transact('readwrite', store => store.put({ ...value, savedAt:new Date().toISOString() }, key)); }
export function getDraft(key){ return transact('readonly', store => store.get(key)); }
export function removeDraft(key){ return transact('readwrite', store => store.delete(key)); }

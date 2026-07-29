
/* Motor local temporal: mantiene el flujo del sistema mientras se conecta el backend definitivo. */
window.BackendCero = window.BackendCero || {
  Client: class {
    setEndpoint(){ return this; }
    setProject(){ return this; }
    subscribe(){ return { unsubscribe(){ } }; }
  },
  Databases: class {
    async listDocuments(){ return { documents: [] }; }
    async createDocument(_db, _col, id, payload){ return { ...(payload || {}), $id: id || String(Date.now()) }; }
    async updateDocument(_db, _col, id, payload){ return { ...(payload || {}), $id: id || String(Date.now()) }; }
    async deleteDocument(){ return true; }
  },
  Query: {
    orderAsc(field){ return { type: 'orderAsc', field }; },
    limit(value){ return { type: 'limit', value }; }
  },
  ID: { unique(){ return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2); } }
};


(function(){
  'use strict';
  const YEAR = new Date().getFullYear();
  function pad(n){ return String(n).padStart(2,'0'); }
  function randomDateThisYear(seed){
    const base = Math.abs(Array.from(String(seed||'0')).reduce((a,c)=>a+c.charCodeAt(0),0));
    const today = new Date();
    const start = new Date(YEAR,0,1);
    const maxDays = Math.max(1, Math.floor((today.getTime()-start.getTime())/86400000));
    const d = new Date(start.getTime() + (base % maxDays)*86400000);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function toInputDate(value){
    if(!value) return '';
    const raw = String(value).trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10);
    const dmY = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if(dmY) return `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
    const d = new Date(raw);
    if(Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function getAgencias(){ try{ if(Array.isArray(agencias)) return agencias; }catch(e){} return Array.isArray(window.agencias)?window.agencias:[]; }
  function normalizeAgencyDate(agencia){
    if(!agencia) return '';
    const current = toInputDate(agencia.fechaCreacion || agencia.fecha_creacion || agencia.createdAt || agencia.created_at || agencia.fecha);
    const value = current || randomDateThisYear(agencia.numero || agencia.nombre || Math.random());
    agencia.fechaCreacion = value;
    agencia.fecha_creacion = value;
    agencia.createdAt = agencia.createdAt || value;
    agencia.detalle = agencia.detalle || {};
    agencia.detalle.fechaCreacion = value;
    return value;
  }
  window.lotekaEnsureAgencyCreationDates = function(){ getAgencias().forEach(normalizeAgencyDate); };
  function fillAgencyDateField(agencia){
    const input = document.getElementById('agencyFieldFechaCreacion');
    if(input) input.value = normalizeAgencyDate(agencia);
  }
  function saveAgencyDateField(agencia){
    if(!agencia) return;
    const input = document.getElementById('agencyFieldFechaCreacion');
    const value = toInputDate(input && input.value) || normalizeAgencyDate(agencia);
    agencia.fechaCreacion = value;
    agencia.fecha_creacion = value;
    agencia.createdAt = agencia.createdAt || value;
    agencia.detalle = agencia.detalle || {};
    agencia.detalle.fechaCreacion = value;
  }
  function patchExistingFunctions(){
    if(typeof cargarFormularioDetalleAgencia === 'function' && !cargarFormularioDetalleAgencia.__v55DatePatched){
      const old = cargarFormularioDetalleAgencia;
      cargarFormularioDetalleAgencia = function(agencia){
        normalizeAgencyDate(agencia);
        const res = old.apply(this, arguments);
        fillAgencyDateField(agencia);
        return res;
      };
      cargarFormularioDetalleAgencia.__v55DatePatched = true;
    }
    if(typeof guardarDetalleAgenciaCompleta === 'function' && !guardarDetalleAgenciaCompleta.__v55DatePatched){
      const oldSave = guardarDetalleAgenciaCompleta;
      guardarDetalleAgenciaCompleta = function(){
        try{
          if(typeof agenciaDetalleActualIndex !== 'undefined' && agenciaDetalleActualIndex !== null){
            saveAgencyDateField(getAgencias()[agenciaDetalleActualIndex]);
          }
        }catch(e){}
        const res = oldSave.apply(this, arguments);
        try{ window.lotekaEnsureAgencyCreationDates(); if(typeof homeRenderDashboard === 'function') homeRenderDashboard(); }catch(e){}
        return res;
      };
      guardarDetalleAgenciaCompleta.__v55DatePatched = true;
    }
    if(typeof renderAgencias === 'function' && !renderAgencias.__v55DatePatched){
      const oldRender = renderAgencias;
      renderAgencias = function(){ try{ window.lotekaEnsureAgencyCreationDates(); }catch(e){} return oldRender.apply(this, arguments); };
      renderAgencias.__v55DatePatched = true;
    }
  }
  function boot(){
    try{ window.lotekaEnsureAgencyCreationDates(); }catch(e){}
    patchExistingFunctions();
    try{ if(typeof renderAgencias === 'function') renderAgencias(); }catch(e){}
    try{ if(typeof homeRenderDashboard === 'function') homeRenderDashboard(); }catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function(){ setTimeout(boot, 300); setTimeout(boot, 1200); });
})();

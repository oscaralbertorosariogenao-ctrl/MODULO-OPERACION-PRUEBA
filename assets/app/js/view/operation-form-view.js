import { el, option } from '../components/dom.js';
import { evidenceUploader } from '../components/evidence-uploader.js';
import { OPERATION_TYPES, PRIORITIES } from '../config.js';

export function operationFormView(state, draft = {}) {
  const agencies = state.agencies.items || [];
  const technicians = state.technicians.items || [];
  const selectedTechnician = draft.technician || '';

  const agencyOptions = agencies.map((agency) => option(
    agency.id || agency.numero,
    `${agency.numero || ''} · ${agency.nombre || 'Sin nombre'}`,
  ));

  const technicianOptions = [
    option('', 'Sin asignar', !selectedTechnician),
    ...technicians.map((tech) => {
      const name = tech.nombre_completo || tech.nombre || tech.usuario_login || 'Técnico';
      return option(name, name, selectedTechnician === name);
    }),
  ];

  const mainInfo = [
    el('h2', { class: 'form-section-title', text: 'Información principal' }),
    field('Tipo', el('select', { class: 'select', name: 'type', required: '' },
      OPERATION_TYPES.map((value) => option(value, value, draft.type === value)))),
    field('Agencia',
      el('input', {
        class: 'input', name: 'agency', list: 'operation-agencies', value: draft.agency || '',
        placeholder: 'Número o nombre', required: '', autocomplete: 'off',
      }),
      el('datalist', { id: 'operation-agencies' }, agencyOptions)),
    field('Categoría o título', el('input', {
      class: 'input', name: 'title', value: draft.title || '',
      placeholder: 'Ej.: Avería de inversor', required: '', maxlength: '500',
    })),
    field('Descripción', el('textarea', {
      class: 'textarea', name: 'description', placeholder: 'Describe claramente qué ocurre y dónde.',
      required: '', maxlength: '5000',
    }, draft.description || '')),
    el('div', { class: 'grid grid-2' },
      field('Prioridad', el('select', { class: 'select', name: 'priority' },
        PRIORITIES.map((value) => option(value, value, (draft.priority || 'Media') === value)))),
      field('Técnico (opcional)', el('select', { class: 'select', name: 'technician' }, technicianOptions))),
    field('Trabajo a realizar (opcional)', el('input', {
      class: 'input', name: 'work', value: draft.work || '', placeholder: 'Solo cuando ya esté definido',
    })),
  ];

  return el('div', { class: 'page operation-form-page' },
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-action': 'go-back' }, '← Volver'),
    el('div', { class: 'page-header' },
      el('div', {},
        el('h1', { class: 'page-title', text: 'Crear operación' }),
        el('p', { class: 'page-subtitle', text: 'Registra una avería o trabajo con datos reales del sistema.' }))),
    el('form', { class: 'card form-card', 'data-form': 'create-operation', novalidate: '' },
      mainInfo,
      el('h2', { class: 'form-section-title', text: 'Evidencia inicial' }),
      evidenceUploader(state.evidence.files, { prefix: 'create' }),
      el('p', { class: 'draft-note', text: 'El texto del formulario puede guardarse como borrador local. Las fotos no se guardan en localStorage.' }),
      el('div', { class: 'form-actions' },
        el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Guardar operación'),
        el('button', { class: 'btn btn-secondary btn-block', type: 'button', 'data-action': 'save-operation-draft' }, 'Guardar borrador'))));
}

function field(label, control, extra = null) {
  return el('label', { class: 'field' }, el('span', { text: label }), control, extra);
}

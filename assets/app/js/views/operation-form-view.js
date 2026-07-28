import { el, option } from '../components/dom.js';
import { evidenceUploader } from '../components/evidence-uploader.js';
import { OPERATION_TYPES, PRIORITIES } from '../config.js';
import { can } from '../permissions.js';

function normalizeSelected(value){
  if(Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if(typeof value === 'string'){
    try{
      const parsed = JSON.parse(value);
      if(Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
    }catch{}
    return value.split('|').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

export function operationFormView(state, draft = {}) {
  const agencies = state.agencies.items || [];
  const technicians = state.technicians.items || [];
  const canAssign = can('operations.assign',state);
  const operationType = OPERATION_TYPES.includes(draft.type) ? draft.type : 'Avería';
  const selectedNames = new Set(normalizeSelected(draft.selectedTypes));
  const catalog = (state.operationCatalog.items || [])
    .filter(item => item.active !== false && item.type === operationType)
    .sort((a,b) => Number(a.order || 0) - Number(b.order || 0) || a.name.localeCompare(b.name,'es'));
  const selectedTechnician = canAssign ? (draft.technician || '') : '';

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

  const catalogCards = catalog.length
    ? catalog.map(item => el('label', {
      class:`operation-catalog-card${selectedNames.has(item.name) ? ' is-selected' : ''}`,
      dataset:{catalogCard:'',catalogSearch:`${item.name} ${item.description || ''} ${item.category || ''}`.toLowerCase()}
    },
      el('input',{
        type:'checkbox',name:'selectedTypes',value:item.name,
        checked:selectedNames.has(item.name),
        'data-change-action':'operation-catalog-selection'
      }),
      el('span',{class:'operation-catalog-dot','aria-hidden':'true'}),
      el('span',{class:'operation-catalog-copy'},
        el('span',{class:'operation-catalog-heading'},
          el('strong',{text:item.name}),
          el('span',{class:'operation-catalog-badge',text:operationType.toUpperCase()})),
        el('span',{class:'operation-catalog-description',text:item.description || 'Sin descripción adicional.'}),
        item.category && item.category !== 'General' ? el('small',{class:'operation-catalog-category',text:item.category}) : null
      )
    ))
    : [el('div',{class:'empty-inline',text:'No hay opciones activas en el catálogo. Un administrador debe agregarlas desde el index principal.'})];

  const mainInfo = [
    el('h2', { class: 'form-section-title', text: 'Reportar operación' }),
    field('Tipo de reporte', el('select', {
      class: 'select', name: 'type', required: '', 'data-change-action':'operation-type'
    }, OPERATION_TYPES.map((value) => option(value, value, operationType === value)))),
    field('Agencia',
      el('input', {
        class: 'input', name: 'agency', list: 'operation-agencies', value: draft.agency || '',
        placeholder: 'Número o nombre', required: '', autocomplete: 'off',
      }),
      el('datalist', { id: 'operation-agencies' }, agencyOptions)),
    el('div',{class:'operation-catalog-section'},
      el('div',{class:'operation-catalog-title-row'},
        el('div',{},
          el('h3',{text:operationType === 'Trabajo' ? 'Selecciona uno o varios trabajos' : 'Selecciona una o varias averías'}),
          el('p',{text:'El catálogo es el mismo que se administra desde el index principal.'})),
        el('span',{class:'operation-catalog-selected-count',dataset:{catalogCount:''},text:`${selectedNames.size} seleccionada${selectedNames.size === 1 ? '' : 's'}`})),
      el('input',{
        class:'input operation-catalog-search',type:'search',placeholder:`Buscar ${operationType === 'Trabajo' ? 'trabajo' : 'avería'}…`,
        'data-input-action':'operation-catalog-search',autocomplete:'off'
      }),
      el('div',{class:'operation-catalog-grid'},catalogCards)
    ),
    field('Descripción adicional (opcional)', el('textarea', {
      class: 'textarea', name: 'description', placeholder: 'Agrega detalles, ubicación exacta, síntomas o información útil.',
      maxlength: '5000',
    }, draft.description || '')),
    el('div', { class: 'grid grid-2' },
      field('Prioridad', el('select', { class: 'select', name: 'priority' },
        PRIORITIES.map((value) => option(value, value, (draft.priority || 'Media') === value)))),
      canAssign ? field('Técnico o responsable (opcional)', el('select', { class: 'select', name: 'technician' }, technicianOptions)) : null),
    canAssign ? field('Trabajo a realizar (opcional)', el('input', {
      class: 'input', name: 'work', value: draft.work || '', placeholder: 'Solo cuando ya esté definido',
    })) : null,
  ];

  return el('div', { class: 'page operation-form-page' },
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-action': 'go-back' }, '← Volver'),
    el('div', { class: 'page-header' },
      el('div', {},
        el('h1', { class: 'page-title', text: operationType === 'Trabajo' ? 'Solicitar trabajo' : 'Reportar avería' }),
        el('p', { class: 'page-subtitle', text: canAssign ? 'Registra la operación con el catálogo oficial y, si corresponde, asígnala.' : 'Selecciona la agencia y el problema. La operación quedará pendiente y sin asignar.' }))),
    el('form', { class: 'card form-card', 'data-form': 'create-operation', novalidate: '' },
      mainInfo,
      el('h2', { class: 'form-section-title', text: 'Evidencia inicial' }),
      evidenceUploader(state.evidence.files, { prefix: 'create' }),
      el('p', { class: 'draft-note', text: 'Puedes guardar el texto y las selecciones como borrador. Las fotos no se guardan en el borrador local.' }),
      el('div', { class: 'form-actions' },
        el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, operationType === 'Trabajo' ? 'Enviar solicitud' : 'Enviar reporte'),
        el('button', { class: 'btn btn-secondary btn-block', type: 'button', 'data-action': 'save-operation-draft' }, 'Guardar borrador'))));
}

function field(label, control, extra = null) {
  return el('label', { class: 'field' }, el('span', { text: label }), control, extra);
}

import { el, option } from '../components/dom.js';
import { evidenceUploader } from '../components/evidence-uploader.js';
import { agencyPicker } from '../components/agency-picker.js';
import { OPERATION_TYPES } from '../config.js';

function normalizeSelected(value){
  if(Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if(typeof value === 'string'){
    try{ const parsed = JSON.parse(value); if(Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean); }catch{}
    return value.split('|').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

export function operationFormView(state, draft = {}) {
  const agencies = state.agencies.items || [];
  const operationType = OPERATION_TYPES.includes(draft.type) ? draft.type : 'Avería';
  const selectedNames = new Set(normalizeSelected(draft.selectedTypes));
  const catalog = (state.operationCatalog.items || [])
    .filter(item => item.active !== false && item.type === operationType)
    .sort((a,b) => Number(a.order || 0) - Number(b.order || 0) || a.name.localeCompare(b.name,'es'));
  const originReference = String(draft.originOperationId || '').trim();
  const originCode = String(draft.originOperationCode || originReference).trim();

  const catalogCards = catalog.length
    ? catalog.map(item => el('label', {
      class:`operation-catalog-card${selectedNames.has(item.name) ? ' is-selected' : ''}`,
      dataset:{catalogCard:'',catalogSearch:`${item.name} ${item.description || ''} ${item.category || ''}`.toLowerCase()}
    },
      el('input',{type:'checkbox',name:'selectedTypes',value:item.name,checked:selectedNames.has(item.name),'data-change-action':'operation-catalog-selection'}),
      el('span',{class:'operation-catalog-dot','aria-hidden':'true'}),
      el('span',{class:'operation-catalog-copy'},
        el('span',{class:'operation-catalog-heading'},el('strong',{text:item.name}),el('span',{class:'operation-catalog-badge',text:operationType.toUpperCase()})),
        el('span',{class:'operation-catalog-description',text:item.description || 'Sin descripción adicional.'}),
        item.category && item.category !== 'General' ? el('small',{class:'operation-catalog-category',text:item.category}) : null
      )
    ))
    : [el('div',{class:'empty-inline',text:'No hay opciones activas en el catálogo. Un administrador debe agregarlas desde el sistema principal.'})];

  return el('div', { class: 'page operation-form-page' },
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-action': 'go-back' }, '← Volver'),
    el('div', { class: 'page-header' },
      el('div', {},
        el('h1', { class: 'page-title', text: 'Reportar problema' }),
        el('p', { class: 'page-subtitle', text: originReference ? `Hallazgo detectado mientras se atendía ${originCode}.` : 'Registra la avería o el trabajo. El reporte quedará listo para revisión y asignación.' }))),
    el('form', { class: 'card form-card', 'data-form': 'create-operation', novalidate: '' },
      originReference ? el('section',{class:'card section'},
        el('strong',{text:'Reporte relacionado'}),
        el('p',{class:'muted',text:`Este problema quedará vinculado a ${originCode}, sin modificar ni cerrar la operación original.`}),
        el('input',{type:'hidden',name:'originOperationId',value:originReference}),
        el('input',{type:'hidden',name:'originOperationCode',value:originCode})
      ) : null,
      el('h2', { class: 'form-section-title', text: 'Información del reporte' }),
      field('Tipo de reporte', el('select', {class:'select',name:'type',required:'','data-change-action':'operation-type'}, OPERATION_TYPES.map(value => option(value,value,operationType === value)))),
      fieldBlock('Agencia',agencyPicker({agencies,name:'agency',selectedValue:draft.agency || '',placeholder:'Selecciona una agencia',searchPlaceholder:'Buscar por número o nombre…',emptyText:'No tienes agencias disponibles para reportar.',contextLabel:'Agencias disponibles'})),
      el('div',{class:'operation-catalog-section'},
        el('div',{class:'operation-catalog-title-row'},
          el('div',{},el('h3',{text:operationType === 'Trabajo' ? 'Selecciona uno o varios trabajos' : 'Selecciona una o varias averías'}),el('p',{text:'Usa el catálogo oficial para que el problema pueda analizarse y detectar recurrencias correctamente.'})),
          el('span',{class:'operation-catalog-selected-count',dataset:{catalogCount:''},text:`${selectedNames.size} seleccionada${selectedNames.size === 1 ? '' : 's'}`})),
        el('input',{class:'input operation-catalog-search',type:'search',placeholder:`Buscar ${operationType === 'Trabajo' ? 'trabajo' : 'avería'}…`,'data-input-action':'operation-catalog-search',autocomplete:'off'}),
        el('div',{class:'operation-catalog-grid'},catalogCards)
      ),
      field('Descripción adicional (opcional)', el('textarea',{class:'textarea',name:'description',placeholder:'Agrega ubicación exacta, síntomas o información útil.',maxlength:'5000'},draft.description || '')),
      el('h2', { class: 'form-section-title', text: 'Evidencia inicial (opcional)' }),
      evidenceUploader(state.evidence.files, { prefix: 'create' }),
      el('p', { class: 'draft-note', text: 'Las fotografías y videos se guardan físicamente en Cloudflare R2. Supabase conserva únicamente la relación con este reporte.' }),
      el('div', { class: 'form-actions' },
        el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Enviar reporte'),
        el('button', { class: 'btn btn-secondary btn-block', type: 'button', 'data-action': 'save-operation-draft' }, 'Guardar borrador'))));
}
function field(label, control, extra = null){ return el('label',{class:'field'},el('span',{text:label}),control,extra); }
function fieldBlock(label, control, extra = null){ return el('div',{class:'field'},el('span',{text:label}),control,extra); }

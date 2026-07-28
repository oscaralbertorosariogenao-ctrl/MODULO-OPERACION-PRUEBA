import { el } from './dom.js';

let pickerSequence = 0;

export function agencyPicker({
  agencies = [],
  name = 'agencyId',
  selectedValue = '',
  placeholder = 'Selecciona una agencia',
  searchPlaceholder = 'Buscar por número o nombre…',
  emptyText = 'No hay agencias disponibles.',
  required = true,
  contextLabel = 'Agencias disponibles'
} = {}){
  const rows = normalizeAgencies(agencies);
  const selected = findSelectedAgency(rows,selectedValue);
  const pickerId = `agency-picker-${++pickerSequence}`;

  return el('div',{
    class:`agency-picker${selected ? ' has-value' : ''}`,
    dataset:{agencyPicker:'',agencyPickerName:name}
  },
    el('input',{
      type:'hidden',
      name,
      value:selected?.id || '',
      'data-agency-picker-value':'true',
      ...(required ? {'data-agency-picker-required':'true'} : {})
    }),
    el('button',{
      class:'agency-picker-trigger',
      type:'button',
      'data-action':'agency-picker-toggle',
      'aria-expanded':'false',
      'aria-controls':`${pickerId}-panel`
    },
      el('span',{class:'agency-picker-trigger-icon','aria-hidden':'true'},'⌂'),
      el('span',{class:'agency-picker-trigger-copy'},
        el('strong',{'data-agency-picker-primary':'true',text:selected ? selected.codeLabel : placeholder}),
        el('span',{'data-agency-picker-secondary':'true',text:selected ? selected.name : 'Toca para buscar y seleccionar'})),
      el('span',{class:'agency-picker-trigger-chevron','aria-hidden':'true'},'⌄')
    ),
    el('div',{
      class:'agency-picker-panel',
      id:`${pickerId}-panel`,
      hidden:'',
      'data-agency-picker-panel':'true'
    },
      el('div',{class:'agency-picker-panel-head'},
        el('div',{},
          el('strong',{text:contextLabel}),
          el('small',{'data-agency-picker-count':'true',text:countLabel(rows.length)})),
        el('button',{class:'agency-picker-panel-close',type:'button','data-action':'agency-picker-toggle','aria-label':'Cerrar selector'},'×')
      ),
      el('label',{class:'agency-picker-search'},
        el('span',{'aria-hidden':'true'},'⌕'),
        el('input',{
          type:'search',
          placeholder:searchPlaceholder,
          autocomplete:'off',
          inputmode:'search',
          'data-input-action':'agency-picker-search',
          'data-agency-picker-search':'true'
        })
      ),
      el('div',{class:'agency-picker-list','data-agency-picker-list':'true',role:'listbox'},
        rows.map(row => agencyOption(row,selected?.id === row.id)),
        el('div',{
          class:'agency-picker-empty',
          hidden:rows.length ? 'true' : null,
          'data-agency-picker-empty':'true',
          text:emptyText
        })
      )
    )
  );
}

function agencyOption(row,selected){
  return el('button',{
    class:`agency-picker-option${selected ? ' is-selected' : ''}`,
    type:'button',
    role:'option',
    'aria-selected':selected ? 'true' : 'false',
    'data-action':'agency-picker-select',
    'data-agency-id':row.id,
    'data-agency-code':row.codeLabel,
    'data-agency-name':row.name,
    'data-agency-meta':row.meta,
    'data-agency-search':row.searchText
  },
    el('span',{class:'agency-picker-option-code',text:row.codeLabel}),
    el('span',{class:'agency-picker-option-copy'},
      el('strong',{text:row.name}),
      row.meta ? el('small',{text:row.meta}) : null),
    el('span',{class:'agency-picker-option-check','aria-hidden':'true'},selected ? '✓' : '›')
  );
}

function normalizeAgencies(agencies){
  return (Array.isArray(agencies) ? agencies : [])
    .map(agency => {
      const id = String(agency?.id || '').trim();
      const rawNumber = String(agency?.numero ?? agency?.codigo ?? agency?.numero_agencia ?? '').trim();
      const number = rawNumber.replace(/^AG(?:ENCIA)?[\s-]*/i,'').trim();
      const codeLabel = number ? `AG ${number}` : 'AGENCIA';
      const name = String(agency?.nombre || (number ? `Agencia ${number}` : 'Agencia sin nombre')).trim();
      const groupCode = String(agency?.grupo_codigo || agency?.group_code || agency?.grupo?.codigo || '').trim();
      const groupName = String(agency?.grupo_nombre || agency?.group_name || agency?.grupo?.nombre || '').trim();
      const city = String(agency?.municipio || agency?.ciudad || agency?.sector || '').trim();
      const groupLabel = groupCode ? `Grupo ${groupCode.replace(/^G[-\s]*/i,'')}` : groupName;
      const meta = [groupLabel,city].filter(Boolean).join(' · ');
      const searchText = normalizeSearch([number,rawNumber,codeLabel,name,groupCode,groupName,city].join(' '));
      return {id,number,codeLabel,name,meta,searchText,source:agency};
    })
    .filter(row => row.id)
    .sort(compareAgencies);
}

function compareAgencies(a,b){
  const aNumber = parseInt(String(a.number).replace(/\D/g,''),10);
  const bNumber = parseInt(String(b.number).replace(/\D/g,''),10);
  if(Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) return aNumber - bNumber;
  if(Number.isFinite(aNumber) !== Number.isFinite(bNumber)) return Number.isFinite(aNumber) ? -1 : 1;
  return a.name.localeCompare(b.name,'es',{numeric:true,sensitivity:'base'});
}

function findSelectedAgency(rows,value){
  const token = normalizeSearch(value);
  if(!token) return null;
  return rows.find(row => [row.id,row.number,row.codeLabel,row.name,`${row.number} ${row.name}`]
    .some(candidate => normalizeSearch(candidate) === token)) || null;
}

function normalizeSearch(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

function countLabel(count){
  return `${count} agencia${count === 1 ? '' : 's'}`;
}

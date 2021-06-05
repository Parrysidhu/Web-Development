import './style.css';

import $ from 'jquery';        //make jquery() available as $
import Meta from './meta.js';  //bundle the input to this program

//default values
const DEFAULT_REF = '_';       //use this if no ref query param
const N_UNI_SELECT = 4;        //switching threshold between radio & select
const N_MULTI_SELECT = 4;      //switching threshold between checkbox & select

/*************************** Utility Routines **************************/

/** Return `ref` query parameter from window.location */
function getRef() {
  const url = new URL(window.location);
  const params = url.searchParams;
  return params && params.get('ref');
}

/** Return window.location url with `ref` query parameter set to `ref` */
function makeRefUrl(ref) {
  const url = new URL(window.location);
  url.searchParams.set('ref', ref);
  return url.toString();
}

/** Return a jquery-wrapped element for tag and attr */
function makeElement(tag, attr={}) {
  const $e = $(`<${tag}/>`);
  Object.entries(attr).forEach(([k, v]) => $e.attr(k, v));
  return $e;
}

/** Given a list path of accessors, return Meta[path].  Handle
 *  occurrences of '.' and '..' within path.
 */
function access(path) {
  const normalized = path.reduce((acc, p) => {
    if (p === '.') {
      return acc;
    }
    else if (p === '..') {
      return acc.length === 0 ? acc : acc.slice(0, -1)
    }
    else {
      return acc.concat(p);
    }
  }, []);
  return normalized.reduce((m, p) => m[p], Meta);
}

/** Return an id constructed from list path */
function makeId(path) { return ('/' + path.join('/')); }

function getType(meta) {
  return meta.type || 'block';
}

/** Return a jquery-wrapped element <tag meta.attr>items</tag>
 *  where items are the recursive rendering of meta.items.
 *  The returned element is also appended to $element.
 */
function items(tag, meta, path, $element) {
  const $e = makeElement(tag, meta.attr);
  //console.log(meta.items);
  (meta.items || []).
    forEach((item, i) => render(path.concat('items', i), $e));
  $element.append($e);
  return $e;
}

/************************** Event Handlers *****************************/

//@TODO
function handler(meta, event) {
	const $target = $(event.target);
	let val = '';
	let errorDiv = '';
	let values = [];

	if( meta.type === 'input' ) {
		val = $target.val().trim();
		errorDiv = 'input[name='+meta.attr.name+'] + .error';
	} else if( meta.type === 'uniSelect' ) {
		val = $target.val();
		errorDiv = 'select[name='+meta.attr.name+'] + .error';
	} else if( meta.type === 'multiSelect' ) {
		if(meta.items.length > (Meta._options.N_MULTI_SELECT || 4)){
			val = $target.val();
			errorDiv = 'select[name='+meta.attr.name+'] + .error';
		} else {
			const checkboxes = $('input[name='+meta.attr.name+']:checked');
		 	$.each($('input[name='+meta.attr.name+']:checked'), function(){ 
		 		values.push($(this).val()); 
		 	});
		 	
		 	if(values.length === 0) {
		 		$('input[name='+meta.attr.name+']').parent().next().text(`The field ${meta.text} must be specified.`);
		 	} else {
		 		$('input[name='+meta.attr.name+']').parent().next().text('');
		 	}
		}
		
	}

	if(val === '' ) {
		//console.log('yes');
		if(meta['required']) {
			$(errorDiv).text(`The field ${meta.text} must be specified.`);
		}
	} else if(typeof meta['chkFn'] === 'function') {
		if(null === meta.chkFn(val, meta, Meta)) {
			if(typeof meta['errMsgFn'] === 'function') {
				$(errorDiv).text(meta.errMsgFn(val, meta, Meta));
			} else {
				$(errorDiv).text(`invalid value ${val}`);
			}
		} else {
			$(errorDiv).text('');	
		}
	} else {
		$(errorDiv).text('');
	}
}

/********************** Type Routine Common Handling *******************/

//@TODO


/***************************** Type Routines ***************************/

//A type handling function has the signature (meta, path, $element) =>
//void.  It will append the HTML corresponding to meta (which is
//Meta[path]) to $element.

function block(meta, path, $element) { items('div', meta, path, $element); }

function form(meta, path, $element) {
  //@TODO_done
  
  const $form = items('form', meta, path, $element);
  $form.submit(function(event) {
    event.preventDefault();
    const $form = $(this);
    const arrFields = $form.serializeArray();
    const results = {};
    for(const field of arrFields) {
    	const formField = $(`[name="${field.name}"]`, $form);
    	const fieldName = formField.attr('name');
    	let checked = [];
    	if('checkbox' === formField.attr('type')) {
    		$(`[name="${field.name}"]:checked`, $form).each(function() {
    			checked.push($(this).val());
    		});
    		results[fieldName] = checked;
    	} else if('radio' == formField.attr('type')) {
			results[fieldName] = $(`[name="${field.name}"]:checked`, $form).val();
		}else {
    		results[fieldName] = formField.val();
    	}
    }
    
    $('input,select,textarea', $form).trigger('blur');
    $('input,select', $form).trigger('change');
    
    let submit = false;
	$.each($('.error', $form), function() {
 		if($(this).text().length > 0) {
 			submit = true;
 		}
 	});

	if(!submit)
		console.log(JSON.stringify(results, null, 2));
  });
}

function header(meta, path, $element) {
	const $e = makeElement(`h${meta.level || 1}`, meta.attr);
	$e.text(meta.text || '');
	$element.append($e);
}

function input(meta, path, $element) {
	//@TODO_done
	let Id = "";
	if(meta.attr.Id == undefined) {
		Id = makeId(path);
	}
	
	const attr1 = Object.assign({}, {for: Id});
	const attr2 = Object.assign({}, {class: 'error', id: Id+'-err'});

	if(meta.text !== undefined && meta.required == true) {
		$element.append(makeElement('label', attr1).text(meta.text+"*"));
	} else if(meta.text !== undefined) {
		$element.append(makeElement('label', attr1).text(meta.text));
	} else {
		$element.append(makeElement('label', attr1));
	}

	let attr = "";
	if(meta.subType === 'textarea') {
		attr = Object.assign({}, meta.attr||{}, {id: Id});
		$element.append(makeElement('div', {}).append(makeElement('textarea', attr)).on('blur', function(event) { handler(meta, event);}).append(makeElement('div', attr2)));
	} else {
		if(meta.subType !== undefined) {
			attr = Object.assign({}, meta.attr||{}, {type: meta.subType, id: Id});
		} else {
			attr = Object.assign({}, meta.attr||{}, {type: 'text', id: Id});
		}
		$element.append(makeElement('div', {}).append(makeElement('input', attr).on('blur', function(event) { handler(meta, event);})).append(makeElement('div', attr2)));
	}
}

function link(meta, path, $element) {
	const parentType = getType(access(path.concat('..')));
	const { text='', ref=DEFAULT_REF } = meta;
	const attr = Object.assign({}, meta.attr||{}, { href: makeRefUrl(ref) });
	$element.append(makeElement('a', attr).text(text));
}

function multiSelect(meta, path, $element) {
  	//@TODO_done
  	const attr_select = Object.assign({}, meta.attr||{}, { multiple: 'true' });
	if(meta.items.length > (Meta._options.N_MULTI_SELECT || 4)) {
		createSelect(meta, path, $element, attr_select);
	} else {
		createRadioOrCheckbox(meta, path, $element, 'checkbox');
	}
}

function para(meta, path, $element) { items('p', meta, path, $element); }

function segment(meta, path, $element) {
	if (meta.text !== undefined) {
		$element.append(makeElement('span', meta.attr).text(meta.text));
	} else {
		items('span', meta, path, $element);
	}
}

function submit(meta, path, $element) {
  //@TODO_done
  $element.append(makeElement('div', {}));
  const attr = Object.assign({}, meta.attr||{}, {type: 'submit'});
  if(meta.text!==undefined){
  	$element.append(makeElement('button', attr).text(meta.text));
  } else {
  	$element.append(makeElement('button', attr).text('Submit'));
  }

  $()
}

function uniSelect(meta, path, $element) {
  //@TODO_done
  	const attr_select = Object.assign({}, meta.attr||{});
	if(meta.items.length > (Meta._options.N_UNI_SELECT || 4)) {
		createSelect(meta, path, $element, attr_select);
	} else {
		createRadioOrCheckbox(meta, path, $element, 'radio');
	}
}

function createSelect(meta, path, $element, attr_select) {
	let Id = "";
	if(meta.attr.Id == undefined) {
		Id = makeId(path);
	}

	attr_select['id'] = Id;
	const attr_label = Object.assign({}, {for: Id});
	const attr_error = Object.assign({}, {class: 'error', id: Id+'-err'});
	if(meta.required == true) {
		$element.append(makeElement('label', attr_label).text(meta.text + "*"));
		$element.append((makeElement('div', {})).append(makeElement('select', attr_select).on('change', function(event) { handler(meta, event);}).append(OptionItems(meta.items))).append((makeElement('div', attr_error))));
	} else {
		$element.append(makeElement('label', attr_label).text(meta.text));
		$element.append((makeElement('div', {})).append(makeElement('select', attr_select).on('change', function(event) { handler(meta, event);}).append(OptionItems(meta.items))).append((makeElement('div', attr_error))));
	}
}

function createRadioOrCheckbox(meta, path, $element, inputType) {
	let Id = "";
	if(meta.attr.Id == undefined) {
		Id = makeId(path);
	}
	const attr_fieldset = Object.assign({}, {class: 'fieldset'});
	const attr_label = Object.assign({}, {for: Id});
	const attr_error = Object.assign({}, {class: 'error', id: Id+'-err'});
	if(meta.required == true) {
		$element.append(makeElement('label', attr_label).text(meta.text+"*"));
		$element.append((makeElement('div', {})).append(makeElement('div', attr_fieldset).append(InputItems(meta.items, inputType, meta.attr)).on('change', function(event) { handler(meta, event);})).append((makeElement('div', attr_error))));
	} else {
		$element.append(makeElement('label', attr_label).text(meta.text));
		$element.append((makeElement('div', {})).append(makeElement('div', attr_fieldset).append(InputItems(meta.items, inputType, meta.attr)).on('change', function(event) { handler(meta, event);})).append((makeElement('div', attr_error))));
	}

	function InputItems(items, inputType, attr) {
		let Id = "";
		if(attr.Id == undefined) {
			Id = makeId(path);
		}
		const e=[];
		//const f =[];
		let index = 0;
		for(const item of items ){
			const attr_label = Object.assign({}, {for: Id});
			const attr_input = Object.assign({}, attr||{}, {value: item.key, type : inputType, id: Id + '-' + index});
			//console.log(item);
			e.push(makeElement('label', attr_label).text(item.key)); 
			e.push(makeElement('input', attr_input));
			index++;
		}
		return e ;
	}
}

function OptionItems(items) {
	const e=[];
	for( const item of items ) {
		const attr_option = Object.assign({}, {value: item.key});
		e.push(makeElement('option', attr_option).text(item.text));
	}
	return e;
}

//map from type to type handling function.  
const FNS = {
  block,
  form,
  header,
  input,
  link,
  multiSelect,
  para,
  segment,
  submit,
  uniSelect,
};

/*************************** Top-Level Code ****************************/

function render(path, $element=$('body')) {
  const meta = access(path);
  if (!meta) {
    $element.append(`<p>Path ${makeId(path)} not found</p>`);
  }
  else {
    const type = getType(meta);
    const fn = FNS[type];
    if (fn) {
    //	console.log($element);
    	    //	console.log(meta);
    	    //	    	console.log(path);
      fn(meta, path, $element);
    }
    else {
      $element.append(`<p>type ${type} not supported</p>`);
    }
  }
}

function go() {
  const ref = getRef() || DEFAULT_REF;
  render([ ref ]);
}

go();

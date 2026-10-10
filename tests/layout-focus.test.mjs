// Execute real app renderers/handlers with a small DOM seam; native geometry is a separate gate.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=fs.readFileSync(process.env.MONTAGE_HTML||new URL('../src/index.template.html',import.meta.url),'utf8');
function extract(name){const start=source.search(new RegExp('^      (?:async )?function '+name+'\\(','m'));assert(start>=0,name);const end=source.indexOf('\n',start);return source.slice(start,source.slice(start,end).trimEnd().endsWith('}')?end:source.indexOf('\n      }',start)+8);}
function harness(){
  let document,undo;const all=[],timers=[];let n=0;
  class Element{
    constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.dataset={};this.attrs={};this.children=[];this.listeners={};this.disabled=false;this.hidden=false;this.className='';this.open=false;all.push(this);}
    get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
    getClientRects(){return this.isConnected&&!this.hidden&&(!this.parentElement||this.parentElement.getClientRects().length)?[{}]:[];}
    focus(options){if(this.getClientRects().length&&!this.disabled){document.activeElement=this;this.focusOptions=options;}}
    append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
    set textContent(v){for(const c of this.children){if(c.contains(document.activeElement))document.activeElement=document.body;c.parentElement=null;}this.children=[];this.text=v;}
    get textContent(){return this.text;}
    contains(el){return el===this||this.children.some(c=>c.contains(el));}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
    dispatch(type='click',props={}){const e={target:this,clientX:0,clientY:0,preventDefault(){},stopPropagation(){this.stopped=true;},...props};const path=[];for(let node=this;node;node=node.parentElement)path.push(node);for(const node of path){for(const fn of node.listeners[type]||[])fn(e);if(e.stopped)break;}}
    click(){if(!this.disabled)this.dispatch();}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatch('close');}
    getBoundingClientRect(){return {left:20,right:300,top:20,bottom:230};}
    querySelectorAll(selector){return query(selector,this);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  }
  function match(el,s){if(s==='dialog:modal')return el.tagName==='dialog'&&el.open;if(s.startsWith('#'))return el.id===s.slice(1);const cls=s.match(/^\.([\w-]+)/);if(cls&&!el.className.split(' ').includes(cls[1]))return false;const attr=s.match(/\[data-([\w-]+)="([^"]+)"\]/);if(attr&&el.dataset[attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]!==attr[2])return false;return !!(cls||attr);}
  function query(selector,root=document.body){const parts=selector.trim().split(/\s+/);let roots=[root];for(const part of parts){const next=[];for(const r of roots)for(const el of all)if(el!==r&&r.contains(el)&&match(el,part))next.push(el);roots=next;}return roots;}
  document={body:null,activeElement:null,createElement:tag=>new Element(tag),querySelectorAll:selector=>query(selector),querySelector:selector=>query(selector)[0]||null};document.body=new Element('body','body');document.activeElement=document.body;
  function add(id,parent=document.body,tag='button'){const e=new Element(tag,id);parent.append(e);return e;}
  const reorder=add('reorderDialog',document.body,'dialog');for(const id of ['reorderList','reverseOrderButton','closeReorderButton','doneReorderButton'])add(id,reorder);
  for(const id of ['thumbGrid','filterEmpty','reorderButton','addButton','mobileAddButton','chooseButton','sortSelect','helpButton'])add(id);add('helpDialog',document.body,'dialog');
  const $=s=>document.querySelector(s);
  const state={items:[0,1,2].map(sequence=>({sequence,kind:sequence===1?'video':'image',file:{name:'long-'+sequence,size:1},duration:8,clipStart:0,adjusted:false})),videosOnly:false,processing:false,importing:false,clipEditor:null};
  const ctx=vm.createContext({document,state,$,requestAnimationFrame:fn=>fn(),setTimeout:fn=>{timers.push(fn);return ++n;},clearTimeout(){},t:k=>k,formatMediaDuration:String,formatBytes:String,formatClipStart:String,renderSortControl(){},renderSummary(){},renderVideoFilter(){},markOutputChanged(){},announce(){},releaseItem(){},showToast(message,options={}){if(options.onAction)undo=options.onAction;}});
  const names=['counts','isBusy','renderReorderList','renderThumbs','setManualOrder','moveItem','reverseItems','renderAfterItemChange','removeItem'];
  for(const name of ['focusRenderedControl','restoreReorderFocus','restoreRemovalFocus'])if(source.includes('function '+name+'('))names.push(name);
  vm.runInContext(names.map(extract).join('\n'),ctx);vm.runInContext(source.split('\n').find(l=>l.includes("const reorderDialog=$('#reorderDialog')")),ctx);vm.runInContext(source.split('\n').find(l=>l.includes("$('#reverseOrderButton').addEventListener")),ctx);
  const run=s=>vm.runInContext(s,ctx);run('renderThumbs();renderReorderList()');
  const card=seq=>$('#thumbGrid').children.find(c=>c.dataset.sequence===String(seq)||state.items[+c.dataset.index]?.sequence===seq);
  const remove=seq=>card(seq)?.querySelector('.thumb-delete');
  const row=seq=>$('#reorderList').children.find((r,i)=>r.dataset.sequence===String(seq)||state.items[i]?.sequence===seq);
  const move=(seq,direction)=>row(seq)?.querySelectorAll('.reorder-control')[direction==='up'?0:1];
  return{state,document,$,run,remove,move,reorder,undo:()=>undo?.(),add};
}

test('all modal dialogs lock the page, while ordinary closed dialogs do not',()=>assert.match(source,/html:has\(dialog:modal\),\s*body:has\(dialog:modal\)\s*\{\s*overflow:hidden\s*\}/));
test('Recreate allocates only its body to scroll and keeps its header/footer fixed',()=>{assert.match(source,/#replaceDialog\[open\]\{display:flex;flex-direction:column\}/);assert.match(source,/#replaceDialog\s*>\s*\.dialog-header,\s*#replaceDialog\s*>\s*\.dialog-footer\{flex:0 0 auto\}/);assert.match(source,/\.dialog-body\{flex:1 1 auto;min-height:0;[^}]*overflow:auto/);});
test('narrow title and version wrap without shrinking header actions',()=>{assert.match(source,/@media\(max-width:420px\)\{[^\n]*\.brand-name\{[^}]*flex-wrap:wrap[^}]*white-space:normal[^}]*overflow:visible/);assert.match(source,/\.version-badge\{flex:0 0 auto;margin-left:0;white-space:nowrap\}/);assert.match(source,/\.header-actions\{flex-shrink:0\}/);});
test('local processing badge remains a decorative shield',()=>assert.match(source,/<div class="local-badge">\s*<svg[^>]*aria-hidden="true"[\s\S]*?M12 3/));
for(const direction of ['up','down'])test(`Reorder ${direction} preserves dialog and logical moved-row focus`,()=>{const h=harness();h.reorder.showModal();const button=h.move(1,direction);button.focus();button.click();assert.equal(h.reorder.open,true);assert.equal(h.document.activeElement,h.move(1,direction==='up'?'down':'up'));assert.deepEqual(h.state.items.map(i=>i.sequence),direction==='up'?[1,0,2]:[0,2,1]);});
test('Reorder retains same enabled direction away from boundaries',()=>{const h=harness();h.state.items.push({...h.state.items[2],sequence:3});h.run('renderReorderList()');h.reorder.showModal();h.move(1,'down').click();assert.equal(h.document.activeElement,h.move(1,'down'));});
test('Reverse keyboard activation stays open and keeps its persistent control',()=>{const h=harness();h.reorder.showModal();h.$('#reverseOrderButton').focus();h.$('#reverseOrderButton').click();assert.equal(h.reorder.open,true);assert.equal(h.document.activeElement,h.$('#reverseOrderButton'));});
test('actual Reorder backdrop closes, inside dialog click does not',()=>{const h=harness();h.reorder.showModal();h.reorder.dispatch('click',{clientX:50,clientY:50});assert.equal(h.reorder.open,true);h.reorder.dispatch('click',{clientX:5,clientY:50});assert.equal(h.reorder.open,false);assert.equal(h.document.activeElement,h.$('#reorderButton'));});
for(const [index,neighbor]of [[0,1],[1,2],[2,1]])test(`Remove ${index} focuses surviving logical control and Undo restores its original control`,()=>{const h=harness(),item=h.state.items[index];h.remove(item.sequence).focus();h.remove(item.sequence).click();assert.equal(h.document.activeElement,h.remove(neighbor));h.undo();assert.equal(h.document.activeElement,h.remove(item.sequence));assert.equal(h.state.items[index],item);assert.equal(h.state.items.length,3);});
test('only remaining removal falls back to a visible existing Add control',()=>{const h=harness();h.state.items=[h.state.items[0]];h.run('renderThumbs()');h.$('#addButton').hidden=true;h.$('#mobileAddButton').hidden=true;h.remove(0).click();assert.equal(h.document.activeElement,h.$('#chooseButton'));assert.equal(h.state.items.length,0);});
test('Undo under videos-only filter does not reveal an image or change the filter',()=>{const h=harness();h.remove(0).click();h.state.videosOnly=true;h.run('renderThumbs()');h.undo();assert.equal(h.state.videosOnly,true);assert.equal(h.document.activeElement,h.remove(1));assert.equal(h.state.items[0].sequence,0);});
for(const ownership of ['modal','editor','busy'])test(`restoration does not steal newer ${ownership} focus`,()=>{const h=harness();h.remove(0).click();const owner=h.$('#helpButton');owner.focus();if(ownership==='modal')h.$('#helpDialog').showModal();if(ownership==='editor')h.state.clipEditor={};if(ownership==='busy')h.state.processing=true;h.undo();assert.equal(h.document.activeElement,owner);});
test('invalid removal and repeated Undo are no-ops for data and focus',()=>{const h=harness();h.$('#helpButton').focus();h.run('removeItem(-1)');assert.equal(h.document.activeElement,h.$('#helpButton'));h.remove(0).click();h.undo();h.$('#helpButton').focus();h.undo();assert.equal(h.state.items.length,3);assert.equal(h.document.activeElement,h.$('#helpButton'));});
test('focus helper skips disconnected, hidden, disabled, and unsuccessful candidates',()=>{const h=harness(),gone=h.document.createElement('button'),hidden=h.add('hidden'),disabled=h.add('disabled'),refusing=h.add('refusing');hidden.hidden=true;disabled.disabled=true;refusing.focus=()=>{};h.state.candidates=[gone,hidden,disabled,refusing,h.$('#chooseButton')];h.run('focusRenderedControl(state.candidates)');assert.equal(h.document.activeElement,h.$('#chooseButton'));assert.equal(h.document.activeElement.focusOptions.preventScroll,true);});
test('Reorder restoration respects a newer modal or editor owner',()=>{const h=harness();h.$('#helpDialog').showModal();h.$('#helpButton').focus();h.run("restoreReorderFocus(1,'down')");assert.equal(h.document.activeElement,h.$('#helpButton'));h.$('#helpDialog').close();h.reorder.showModal();h.state.clipEditor={};h.run("restoreReorderFocus(1,'down')");assert.equal(h.document.activeElement,h.$('#helpButton'));});

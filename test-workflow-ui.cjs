const {parseHTML}=require('linkedom'),fs=require('fs'),vm=require('vm'),assert=require('assert');
function environment(html,search=''){
 const {document,Event}=parseHTML(html),memory=new Map(),listeners={};
 const ctx={console,Date,Math,JSON,URL,URLSearchParams,Event,document,innerHeight:1080,location:{search,hostname:'example.test',origin:'https://example.test'},setInterval(){},setTimeout(fn){fn();},scrollTo(){},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}};
 ctx.window=ctx;ctx.addEventListener=(type,fn)=>(listeners[type]||=[]).push(fn);ctx.dispatchEvent=e=>(listeners[e.type]||[]).forEach(fn=>fn(e));vm.createContext(ctx);
 const load=file=>vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
 for(const file of ['assets/data.js','assets/workflow-store.js','assets/store.js','assets/workflow-ui.js'])load(file);
 return {ctx,document,load};
}
let e=environment('<html><body><div id="app"></div></body></html>');e.load('assets/bench.js');e.ctx.Store.signIn('3218');
assert.ok(e.document.querySelector('[data-action="mine"]'));e.document.querySelector('tr[data-open="PNL-611"]').click();
assert.ok(e.document.querySelector('[data-workflow-close]'));assert.ok(e.document.body.textContent.includes('SHORT 2'));
e.document.querySelector('[data-action="queue"]').click();e.ctx.Store.signIn('3218');const p=e.ctx.Store.createWorkOrder({project:'UI test',jobNumber:'UI-1',dueDate:'2027-01-01',panels:[{rack:'A1',panelType:'Telecom Panel'}]})[0];
e.document.querySelector(`tr[data-open="${p.id}"]`).click();e.document.querySelector('[data-action="edit-checklist"]').click();
assert.equal(e.document.querySelectorAll('[data-edit-step]').length,18);e.document.querySelector('[data-step-add="stage-1"]').click();assert.equal(e.document.querySelectorAll('[data-edit-step]').length,19);e.document.querySelector('[data-material-add]').click();assert.equal(e.document.querySelectorAll('[data-edit-material]').length,1);
e=environment('<html><body><main id="priority"></main></body></html>');e.ctx.Store.signIn('3218');e.load('assets/priority.js');assert.ok(e.document.querySelector('[data-workflow="assign"]'));
e=environment('<html><body><div id="clock"></div><main id="board"></main><div id="board-status"></div></body></html>');e.load('assets/board.js');assert.ok(e.document.querySelector('.tv-table'));
e=environment('<html><body><main id="report"></main><button id="print"></button></body></html>','?panel=PNL-611');e.load('assets/report.js');assert.ok(e.document.querySelector('#report').textContent.includes('Production workflow record'));
console.log('Bench, draft step/material editor, assignments dashboard, TV list and report rendering passed.');

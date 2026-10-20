const fs=require('fs'),vm=require('vm'),assert=require('assert'),{parseHTML}=require('linkedom');
let snapshot={revision:0,state:null};
function device(badge){
 const {document,Event}=parseHTML('<html><body></body></html>'),memory=new Map(),listeners={};
 const ctx={console,Date,Math,JSON,URL,Event,AbortSignal,document,location:{hostname:'demo.test',origin:'https://demo.test'},setInterval(){},setTimeout(){},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},fetch:async(url,options)=>{
  if(options.method==='POST'){const body=JSON.parse(options.body);if(body.revision!==snapshot.revision)return new Response('{}',{status:409});snapshot={revision:snapshot.revision+1,state:body.state};return new Response(JSON.stringify({revision:snapshot.revision}));}
  return new Response(JSON.stringify(snapshot));
 }};
 ctx.window=ctx;ctx.addEventListener=(type,fn)=>(listeners[type]||=[]).push(fn);ctx.dispatchEvent=e=>(listeners[e.type]||[]).forEach(fn=>fn(e));vm.createContext(ctx);
 for(const file of ['assets/data.js','assets/workflow-store.js','assets/store.js','assets/shared.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 ctx.Store.signIn(badge);return ctx;
}
(async()=>{
 const a=device('3218'),b=device('4471');await a.SharedDemo.connect('https://shared.test');await b.SharedDemo.connect('https://shared.test');
 assert.equal(snapshot.revision,1);assert.equal(b.Store.state.currentUserId,'kovach');
 a.Store.assign('PNL-602','kovach');await a.SharedDemo.sync();await b.SharedDemo.sync();assert.equal(b.Store.panel('PNL-602').assigneeId,'kovach');assert.equal(b.Store.state.currentUserId,'kovach');
 a.Store.hold('PNL-602',{reason:'Missing wire',quantity:2});b.Store.bookLabor('PNL-602',{minutes:10,note:'Before remote hold arrived'});await a.SharedDemo.sync();await b.SharedDemo.sync();
 assert.ok(b.document.getElementById('shared-status').textContent.includes('Conflict'));assert.equal(b.Store.hours('PNL-602'),1/6,'Pending local changes survive conflict');assert.equal(snapshot.state.labor.length,0,'Stale client cannot overwrite server');
 await b.SharedDemo.connect('https://shared.test');assert.equal(b.Store.hours('PNL-602'),0);assert.equal(b.Store.activeHolds('PNL-602').length,1);assert.equal(b.Store.state.currentUserId,'kovach');
 console.log('Two-device synchronization, badge isolation, conflict preservation and explicit reload passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

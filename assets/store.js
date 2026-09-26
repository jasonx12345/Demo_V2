(function () {
  const key='panel-shop-demo-v1';
  const clone=()=>JSON.parse(JSON.stringify(SEED.state));
  const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const stamp=()=>new Date().toISOString();
  let storageAvailable=true;
  function read(){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch(error){storageAvailable=false;return null;}}
  let loaded=read(),migrated=loaded?.version===2||loaded?.version===3;
  if(loaded?.version===2){loaded.panels.forEach(p=>{if(!p.workStatus)p.workStatus=/^PNL-\d{6}$/.test(p.id)&&!loaded.completions.some(c=>c.panelId===p.id)?'draft':'in-progress';});loaded.version=3;}
  if(loaded?.version===3){loaded.panels.forEach(p=>{p.stepOverrides=p.stepOverrides||[];p.lastAccessedAt=p.lastAccessedAt||null;});loaded.version=4;}
  let state=loaded?.version===4?loaded:clone();
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(error){storageAvailable=false;}window.dispatchEvent(new Event('shopchange'));}
  function refresh(){const next=read();if(next?.version===4)state=next;else if(storageAvailable)state=clone();}
  const user=id=>SEED.users.find(u=>u.id===id);
  const panel=id=>state.panels.find(p=>p.id===id);
  const stepsFor=panelId=>{const p=panel(panelId),overrides=p?.stepOverrides||[];return SEED.steps.map(s=>({...s,...(overrides.find(o=>o.id===s.id)||{})}));};
  const step=(id,panelId)=>stepsFor(panelId).find(s=>s.id===id);
  const completion=(panelId,stepId)=>state.completions.find(c=>c.panelId===panelId&&c.stepId===stepId);
  const signoff=id=>state.signoffs.find(s=>s.completionId===id);
  const done=(panelId,s)=>{const c=completion(panelId,s.id);return !!c&&(!s.requiresLeadSignoff||!!signoff(c.id));};
  const currentStage=panelId=>SEED.stages.find(s=>SEED.steps.some(st=>st.stageId===s.id&&!done(panelId,st)))||null;
  const inOrder=(panelId,s)=>!SEED.steps.some(previous=>previous.seq<s.seq&&!done(panelId,previous));
  const findings=panelId=>state.findings.filter(f=>f.panelId===panelId);
  const openFindingCount=panelId=>findings(panelId).filter(f=>f.status==='open').length;
  const pendingNotes=panelId=>state.notes.filter(n=>n.panelId===panelId&&!n.removedAt&&!n.acknowledgement&&(n.by!==state.currentUserId||n.notifyAuthor));
  function actor(){const u=user(state.currentUserId);if(!u)throw Error('Sign in first.');return u;}
  function worker(panelId){const u=actor(),p=panel(panelId);if(!p)throw Error('Panel not found.');if(p.workStatus!=='in-progress')throw Error(p.workStatus==='draft'?'A lead must release this draft before work can begin.':'Select Begin work before recording checklist activity.');if(pendingNotes(panelId).length)throw Error('Acknowledge the panel note before working.');return u;}
  function lead(){const u=actor();if(u.role!=='lead')throw Error('A lead is required for this action.');return u;}
  function event(panelId,action,detail,by=state.currentUserId){state.history.push({id:uid(),panelId,by,at:stamp(),action,detail});}
  function transition(panelId,before){const after=currentStage(panelId);if(after?.id!==before?.id){if(after)state.stageEntries.push({id:uid(),panelId,stageId:after.id,at:stamp()});event(panelId,after?'Entered '+after.name:'Build record completed',before?'Previous stage: '+before.name+'.':'Build reopened.');}}
  function checkQA(panelId,s){
    if(s.seq>=17&&openFindingCount(panelId))throw Error('Disposition every open finding before completing the Final QA review or release.');
    if(s.seq===18&&!done(panelId,step('step-17')))throw Error('Complete Review open findings before Final QA release. Leads cannot bypass this review.');
  }
  function checkValue(s,value){if(!s.capture)return {value:null,result:'pass'};if(value==null||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('Enter a numeric reading.');const n=Number(value);return {value:n,result:n>=s.capture.min&&(s.capture.max==null||n<=s.capture.max)?'pass':'fail'};}
  function clearFrom(panelId,seq,include=true){
    const removed=state.completions.filter(c=>c.panelId===panelId&&(include?step(c.stepId).seq>=seq:step(c.stepId).seq>seq));
    const ids=new Set(removed.map(c=>c.id));
    state.completions=state.completions.filter(c=>!ids.has(c.id));state.signoffs=state.signoffs.filter(s=>!ids.has(s.completionId));
    return removed.map(c=>step(c.stepId).seq).sort((a,b)=>a-b);
  }
  function invalidateReview(panelId,reason){if(completion(panelId,'step-17')||completion(panelId,'step-18')){clearFrom(panelId,17);event(panelId,'Reopened Final QA review',reason+' Review and release records were reset.');}}
  function complete(panelId,stepId,value){
    refresh();const u=worker(panelId),s=step(stepId,panelId);if(!s||completion(panelId,stepId))throw Error('This step is already completed or unavailable.');
    const ordered=inOrder(panelId,s);if(!ordered&&u.role!=='lead')throw Error('Complete preceding steps and lead signoffs first.');checkQA(panelId,s);
    const before=currentStage(panelId),reading=checkValue(s,value),at=stamp();
    const c={id:uid(),panelId,stepId,by:u.id,at,...reading,readings:s.capture?[{...reading,by:u.id,at}]:[],failedAtCompletion:reading.result==='fail',outOfSequence:ordered?null:{by:u.id,at}};
    state.completions.push(c);
    event(panelId,'Completed step '+s.seq+' — '+s.title,s.capture?reading.value+' '+s.capture.unit+' · '+(reading.result==='fail'?'FAILED':'PASS'):'Check recorded.');
    if(!ordered)event(panelId,'Authorized OUT OF SEQUENCE completion','Step '+s.seq+' — '+s.title,u.id);
    if(s.seq<17&&reading.result==='fail')invalidateReview(panelId,'A failed reading requires review.');
    transition(panelId,before);save();
  }
  function approve(id){
    refresh();const c=state.completions.find(c=>c.id===id);if(!c)throw Error('Completion not found.');const u=worker(c.panelId),s=step(c.stepId,c.panelId);
    if(u.role!=='lead')throw Error('Rule: signoff requires a lead who is different from the completer.');
    if(c.by===u.id)throw Error('Rule: a lead cannot sign off their own work. A different lead is required.');if(!s.requiresLeadSignoff)throw Error('This step does not require signoff.');if(signoff(id))return;checkQA(c.panelId,s);
    const before=currentStage(c.panelId),ordered=inOrder(c.panelId,s),at=stamp();
    state.signoffs.push({id:uid(),completionId:id,by:u.id,at,outOfSequence:ordered?null:{by:u.id,at}});
    event(c.panelId,'Signed off step '+s.seq+' — '+s.title,'Independent lead signoff.');if(!ordered)event(c.panelId,'Authorized OUT OF SEQUENCE signoff','Step '+s.seq+' — '+s.title);
    transition(c.panelId,before);save();
  }
  window.Store={key,get state(){return state;},get panels(){return state.panels;},get storageAvailable(){return storageAvailable;},user,panel,step,stepsFor,completion,signoff,done,currentStage,inOrder,findings,openFindingCount,pendingNotes,complete,approve,refresh,
    signIn(badge){refresh();const u=SEED.users.find(u=>u.badge===badge);if(!u)throw Error('Badge not found. Use a demo badge below.');state.currentUserId=u.id;save();},
    signOut(){refresh();state.currentUserId=null;save();},
    reset(){refresh();const nextSerial=state.nextSerial,nextWO=state.nextWO,nextFinding=state.nextFinding;try{localStorage.removeItem(key);}catch(error){}state=clone();state.nextSerial=Math.max(state.nextSerial,nextSerial);state.nextWO=Math.max(state.nextWO,nextWO);state.nextFinding=Math.max(state.nextFinding,nextFinding);save();},
    undo(panelId,stepId){refresh();worker(panelId);const s=step(stepId,panelId),before=currentStage(panelId);if(!completion(panelId,stepId))throw Error('Step is not completed.');const removed=clearFrom(panelId,s.seq);event(panelId,'Undid step '+s.seq+' — '+s.title,'Cleared completions, readings and signoffs for steps '+removed.join(', ')+'. Downstream work must be recorded again.');transition(panelId,before);save();},
    removeSignoff(id){refresh();lead();const c=state.completions.find(c=>c.id===id);if(!c||!signoff(id))throw Error('Signoff not found.');worker(c.panelId);const s=step(c.stepId,c.panelId),before=currentStage(c.panelId);state.signoffs=state.signoffs.filter(x=>x.completionId!==id);const removed=clearFrom(c.panelId,s.seq,false);event(c.panelId,'Removed signoff from step '+s.seq+' — '+s.title,'Lead signoff required again.'+(removed.length?' Reset downstream steps '+removed.join(', ')+'.':''));transition(c.panelId,before);save();},
    correct(panelId,stepId,value){refresh();const u=worker(panelId),c=completion(panelId,stepId),s=step(stepId,panelId);if(!c||!s.capture)throw Error('No captured reading to correct.');const before=currentStage(panelId),reading=checkValue(s,value),at=stamp();c.readings.push({...reading,by:u.id,at});Object.assign(c,reading);if(reading.result==='fail')c.failedAtCompletion=true;state.signoffs=state.signoffs.filter(x=>x.completionId!==c.id);clearFrom(panelId,s.seq,false);event(panelId,'Corrected reading on step '+s.seq+' — '+s.title,reading.value+' '+s.capture.unit+' · '+(reading.result==='fail'?'FAILED':'PASS')+'. Previous readings remain visible; downstream records reset.');transition(panelId,before);save();},
    addFinding(panelId,stepId,data){refresh();const u=worker(panelId);if(!step(stepId,panelId))throw Error('Step not found.');if(!data.description.trim()||!data.action.trim())throw Error('Describe what was found and what was done.');if(!['awareness','needs evaluation'].includes(data.severity)||!['now','stage-2','stage-3','stage-4'].includes(data.deferredTo))throw Error('Choose severity and review stage.');const before=currentStage(panelId),at=stamp(),id='F-'+String(state.nextFinding++).padStart(6,'0');state.findings.push({id,panelId,stepId,by:u.id,at,description:data.description.trim(),action:data.action.trim(),severity:data.severity,deferredTo:data.deferredTo,status:'open',entries:[{by:u.id,at,text:data.action.trim()}],disposition:null});event(panelId,'Created finding '+id,data.description.trim()+' · '+data.severity+' · '+(data.deferredTo==='now'?'Address now':'Review at '+SEED.stages.find(s=>s.id===data.deferredTo).name));invalidateReview(panelId,'A new finding needs disposition.');transition(panelId,before);save();return id;},
    addFindingNote(id,text){refresh();const f=state.findings.find(f=>f.id===id);if(!f)throw Error('Finding not found.');const u=worker(f.panelId);if(!text.trim())throw Error('Enter a note.');f.entries.push({by:u.id,at:stamp(),text:text.trim()});event(f.panelId,'Added note to finding '+id,text.trim());save();},
    disposition(id,outcome,note){refresh();const f=state.findings.find(f=>f.id===id);if(!f)throw Error('Finding not found.');worker(f.panelId);const u=lead();if(f.status!=='open')throw Error('This finding is already dispositioned.');if(!['accepted as-is','corrected','deferred to site'].includes(outcome)||!note.trim())throw Error('Choose a disposition and add a short note.');f.status='dispositioned';f.disposition={outcome,note:note.trim(),by:u.id,at:stamp()};event(f.panelId,'Dispositioned finding '+id,outcome+' — '+note.trim());save();},
    addNote(panelId,text){refresh();const u=worker(panelId);if(!text.trim())throw Error('Enter a panel note.');const n={id:uid(),panelId,by:u.id,at:stamp(),text:text.trim(),acknowledgement:null,removedBy:null,removedAt:null,notifyAuthor:false};state.notes.push(n);event(panelId,'Added panel note',n.text);save();},
    acknowledge(id){refresh();const u=actor(),n=state.notes.find(n=>n.id===id);if(!n||n.removedAt||n.acknowledgement)throw Error('Note is no longer pending.');n.acknowledgement={by:u.id,at:stamp()};event(n.panelId,'Acknowledged panel note',n.text);save();},
    removeNote(id){refresh();const u=lead(),n=state.notes.find(n=>n.id===id);if(!n||n.removedAt)throw Error('Note not found.');n.removedBy=u.id;n.removedAt=stamp();event(n.panelId,'Removed panel note',n.text);save();},
    createWorkOrder(data){refresh();const u=actor(),entries=Array.isArray(data.panels)?data.panels:[];if(!data.project.trim()||!data.jobNumber.trim())throw Error('Project and office job number are required.');if(!entries.length||entries.length>50)throw Error('Add between 1 and 50 panels.');if(entries.some(x=>!String(x.rack).trim()||!String(x.panelType).trim()))throw Error('Every panel needs a rack and panel type.');if(new Set(entries.map(x=>String(x.rack).trim().toLowerCase())).size!==entries.length)throw Error('Rack identifiers must be unique within this work order.');if(!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)||!Number.isFinite(Date.parse(data.dueDate+'T12:00:00')))throw Error('Choose a due date.');const made=[];entries.forEach(entry=>{const serial='PNL-'+state.nextSerial++,wo='WO-'+String(state.nextWO++).padStart(6,'0');const p={id:serial,serial,wo,jobNumber:data.jobNumber.trim(),project:data.project.trim(),rack:String(entry.rack).trim(),panelType:String(entry.panelType).trim(),dueDate:data.dueDate,workStatus:'draft',stepOverrides:[],lastAccessedAt:null};state.panels.push(p);made.push(p);event(p.id,'Created draft work order '+wo,'Parent '+p.jobNumber+' · '+serial+' · rack '+p.rack+'. Standard checklist attached with zero completed steps.',u.id);});save();return made;},
    updateDraftChecklist(panelId,updates){refresh();const u=actor(),p=panel(panelId);if(!p||p.workStatus!=='draft')throw Error('Only draft checklists can be edited.');const next=SEED.steps.map(s=>{const value=updates[s.id]||{};const title=String(value.title||'').trim(),instruction=String(value.instruction||'').trim();if(!title||!instruction)throw Error('Every checklist step needs a title and instruction.');return {id:s.id,title,instruction};});p.stepOverrides=next;event(panelId,'Updated draft checklist','Edited '+next.length+' checklist step titles/instructions before release.',u.id);save();},
    touchPanel(panelId){refresh();const p=panel(panelId);if(!p)return;p.lastAccessedAt=stamp();save();},
    releaseWorkOrder(panelId){refresh();const u=lead(),p=panel(panelId);if(!p)throw Error('Panel not found.');if(p.workStatus!=='draft')throw Error('Only draft work orders can be released.');p.workStatus='released';event(panelId,'Released work order to shop','Standard checklist released with zero completed steps.',u.id);save();},
    beginWork(panelId){refresh();const u=actor(),p=panel(panelId);if(!p)throw Error('Panel not found.');if(p.workStatus!=='released')throw Error('The work order must be released before work begins.');p.workStatus='in-progress';const at=stamp();state.stageEntries.push({id:uid(),panelId,stageId:'stage-0',at});event(panelId,'Began work','Entered Receiving with zero completed steps.',u.id);save();},
    timeInStage(panelId){const p=panel(panelId),stage=currentStage(panelId);if(!stage||p?.workStatus!=='in-progress')return 0;const latest=state.stageEntries.filter(e=>e.panelId===panelId&&e.stageId===stage.id).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];return latest?Math.max(0,Date.now()-Date.parse(latest.at)):0;},
    isLate(panelId){const p=panel(panelId);return p?.workStatus==='in-progress'&&!!currentStage(panelId)&&Date.now()>new Date(p.dueDate+'T23:59:59').getTime();},
    stageCounts(){return Object.fromEntries(SEED.stages.map(s=>[s.id,state.panels.filter(p=>p.workStatus!=='draft'&&currentStage(p.id)?.id===s.id).length]));},
    hours(panelId,stageId){const times=state.completions.filter(c=>c.panelId===panelId&&(!stageId||step(c.stepId).stageId===stageId)).map(c=>Date.parse(c.at));return times.length>1?(Math.max(...times)-Math.min(...times))/3600000:0;}
  };
  window.ShopUI={escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date:at=>new Date(at).toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}),duration:ms=>ms<3600000?Math.floor(ms/60000)+'m':ms<86400000?Math.floor(ms/3600000)+'h':Math.floor(ms/86400000)+'d '+Math.floor(ms%86400000/3600000)+'h'};
  if(migrated||loaded?.version!==4)save();
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){refresh();window.dispatchEvent(new Event('shopchange'));}});
})();

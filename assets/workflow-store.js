(function () {
  const copy=value=>JSON.parse(JSON.stringify(value));
  const norm=value=>String(value||'').trim().toUpperCase();
  window.normalizeShopWorkflow=function(state){
    if(state.workflowVersion===1)return state;
    state.holds=[];state.stageClosures=[];state.reworks=[];state.labor=[];
    state.panels.forEach(p=>{
      p.checklistVersion=1;p.assigneeId='';p.requiredMaterials=[];
      const steps=SEED.steps.map(s=>({...s,...(p.stepOverrides||[]).find(o=>o.id===s.id)}));
      p.checklist=steps;
      // Existing completed stages are preserved explicitly during migration.
      for(const stage of SEED.stages){
        const records=steps.filter(s=>s.stageId===stage.id).map(s=>state.completions.find(c=>c.panelId===p.id&&c.stepId===s.id));
        if(records.some(c=>!c)||steps.filter(s=>s.stageId===stage.id).some(s=>s.requiresLeadSignoff&&!state.signoffs.some(a=>a.completionId===records.find(c=>c.stepId===s.id)?.id)))break;
        const at=records.map(c=>c.at).sort().at(-1);
        state.stageClosures.push({id:'migrated-'+p.id+'-'+stage.id,panelId:p.id,stageId:stage.id,by:null,at,version:1,migrated:true});
      }
    });
    // Fabricated receiving pilot: other legacy panels have no invented material receipts.
    const pilot=state.panels.find(p=>p.id==='PNL-611');
    if(pilot){pilot.requiredMaterials=[{partNumber:'AB-1756-24V',description:'24 VDC power supply',quantity:2},{partNumber:'TB-6',description:'Terminal block',quantity:6}];if(!state.stageClosures.some(c=>c.panelId===pilot.id&&c.stageId==='stage-0'))for(const line of pilot.requiredMaterials){const received=state.receivedMaterials.filter(r=>r.panelId===pilot.id&&norm(r.partNumber)===norm(line.partNumber)).reduce((n,r)=>n+r.quantity,0);if(received<line.quantity)state.holds.push({id:'pilot-hold-'+line.partNumber,panelId:pilot.id,stageId:'stage-0',reason:'Material shortage: '+line.description,partNumber:line.partNumber,quantity:line.quantity-received,expectedDate:'',by:null,at:new Date().toISOString(),automatic:true,clearedAt:null});}}
    state.workflowVersion=1;return state;
  };
  window.installShopWorkflow=function(api){
    const {Store,save,refresh,actor,worker,lead,event,uid,stamp,clearFrom,transition}=api,S=api.state;
    const activeHold=id=>S().holds.filter(h=>h.panelId===id&&!h.clearedAt);
    const closed=(id,stageId)=>S().stageClosures.some(c=>c.panelId===id&&c.stageId===stageId);
    const materialRows=id=>(Store.panel(id)?.requiredMaterials||[]).map(line=>{const received=S().receivedMaterials.filter(r=>r.panelId===id&&norm(r.partNumber)===norm(line.partNumber)).reduce((n,r)=>n+r.quantity,0);return {...line,received,short:Math.max(0,line.quantity-received)};});
    const ready=id=>materialRows(id).every(r=>!r.short);
    function putHold(id,data){
      const p=Store.panel(id);if(!p||!Store.currentStage(id)||p.workStatus==='draft')throw Error('Holds apply to released active panels.');
      if(!String(data.reason||'').trim())throw Error('Enter a hold reason.');
      const quantity=Number(data.quantity||0);if(!Number.isFinite(quantity)||quantity<0)throw Error('Missing quantity must be zero or greater.');
      if(data.expectedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(data.expectedDate))throw Error('Choose an expected arrival date.');
      const h={id:uid(),panelId:id,stageId:Store.currentStage(id).id,reason:data.reason.trim(),partNumber:String(data.partNumber||'').trim(),quantity,expectedDate:data.expectedDate||'',by:actor().id,at:stamp(),automatic:!!data.automatic,clearedAt:null};
      S().holds.push(h);event(id,'Placed HOLD',h.reason+(h.partNumber?' · '+h.partNumber+' · missing '+quantity:''));return h;
    }
    function clearHold(h,note){h.clearedAt=stamp();h.clearedBy=actor().id;h.clearNote=note;event(h.panelId,'Cleared HOLD',note);}
    function reconcile(id){
      const p=Store.panel(id);if(!p||p.workStatus==='draft'||!Store.currentStage(id))return;
      const shortages=materialRows(id).filter(r=>r.short);
      for(const h of activeHold(id).filter(h=>h.automatic))if(!shortages.some(r=>norm(r.partNumber)===norm(h.partNumber)))clearHold(h,'Required material received.');
      for(const r of shortages)if(!activeHold(id).some(h=>h.automatic&&norm(h.partNumber)===norm(r.partNumber)))putHold(id,{reason:'Material shortage: '+r.description,partNumber:r.partNumber,quantity:r.short,automatic:true});
      for(const h of activeHold(id).filter(h=>h.automatic)){const row=shortages.find(r=>norm(r.partNumber)===norm(h.partNumber));if(row)h.quantity=row.short;}
    }
    function invalidateClosures(id,stageId){const index=SEED.stages.findIndex(s=>s.id===stageId);S().stageClosures=S().stageClosures.filter(c=>c.panelId!==id||SEED.stages.findIndex(s=>s.id===c.stageId)<index);}
    Object.assign(Store,{activeHolds:activeHold,stageClosed:closed,materials:materialRows,materialsReady:ready,
      batchRacks(start,count){const rack=String(start||'').trim(),n=Number(count);if(!rack||!Number.isInteger(n)||n<1||n>50)throw Error('Enter a starting rack and 1–50 panels.');const match=rack.match(/^(.*?)(\d+)([^\d]*)$/);return Array.from({length:n},(_,i)=>i===0?rack:match?match[1]+(Number(match[2])+i)+match[3]:rack+'-'+(i+1));},
      status(id){const p=Store.panel(id);return p.workStatus==='draft'?'DRAFT':!Store.currentStage(id)?'COMPLETE':activeHold(id).length?'HOLD':S().completions.some(c=>c.panelId===id&&Store.step(c.stepId,id)?.stageId===Store.currentStage(id).id)?'IN PROGRESS':'NEW';},
      hold(id,data){refresh();actor();putHold(id,data);save();},
      clearHold(holdId,note){refresh();lead();const h=S().holds.find(h=>h.id===holdId);if(!h||h.clearedAt)throw Error('Hold is no longer active.');if(!String(note||'').trim())throw Error('Record why the hold can be cleared.');clearHold(h,note.trim());save();},
      assign(id,userId){refresh();lead();const p=Store.panel(id);if(userId&&!Store.user(userId))throw Error('Unknown technician.');p.assigneeId=userId;event(id,'Assigned panel',userId?Store.user(userId).name:'Unassigned');save();},
      setDraft(id,data,checklist,materials){
        refresh();lead();const p=Store.panel(id);if(p?.workStatus!=='draft')throw Error('Only draft panels can be edited.');
        if(!String(data.rack||'').trim()||!String(data.panelType||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)||!Number.isFinite(Date.parse(data.dueDate+'T12:00:00')))throw Error('Rack, panel type and a valid due date are required.');
        if(S().panels.some(other=>other.id!==id&&other.jobNumber===p.jobNumber&&norm(other.rack)===norm(data.rack)))throw Error('This rack already exists in the parent job.');
        if(!Array.isArray(checklist)||checklist.length>150||new Set(checklist.map(s=>s.id)).size!==checklist.length)throw Error('Checklist step IDs must be unique (maximum 150).');
        if(SEED.stages.some(stage=>!checklist.some(s=>s.stageId===stage.id)))throw Error('Keep at least one step per stage.');
        // Preserve the independent approval and QA gates while allowing other steps to change.
        for(const id of ['step-7','step-11','step-17','step-18'])if(!checklist.some(s=>s.id===id))throw Error('Keep controlled signoff / QA steps.');
        const next=checklist.map(s=>{const base=Store.stepsFor(id).find(x=>x.id===s.id)||SEED.steps.find(x=>x.id===s.id);if(!SEED.stages.some(st=>st.id===s.stageId)||!s.title?.trim()||!s.instruction?.trim())throw Error('Each step needs a stage, title and instruction.');if(base&&s.stageId!==base.stageId)throw Error('Reorder steps within their original stage.');return {...base,...s,requiresLeadSignoff:base?.requiresLeadSignoff||false,capture:base?.capture};}).sort((a,b)=>SEED.stages.findIndex(s=>s.id===a.stageId)-SEED.stages.findIndex(s=>s.id===b.stageId)).map((s,i)=>({...s,seq:i+1,title:s.title.trim(),instruction:s.instruction.trim()}));
        const qa=next.filter(s=>s.stageId==='stage-4');if(qa.findIndex(s=>s.id==='step-17')>qa.findIndex(s=>s.id==='step-18')||qa.at(-1).id!=='step-18')throw Error('Findings review precedes Final QA release; release must be last.');
        const bom=materials.map(r=>({partNumber:String(r.partNumber||'').trim(),description:String(r.description||'').trim(),quantity:Number(r.quantity)}));
        if(bom.some(r=>!r.partNumber||!r.description||!Number.isFinite(r.quantity)||r.quantity<=0)||new Set(bom.map(r=>norm(r.partNumber))).size!==bom.length)throw Error('Material lines need unique part numbers, descriptions and positive quantities.');
        Object.assign(p,{rack:data.rack.trim(),panelType:data.panelType.trim(),dueDate:data.dueDate,checklist:next,requiredMaterials:bom,checklistVersion:(p.checklistVersion||1)+1});event(id,'Saved draft revision','Checklist version '+p.checklistVersion+' · '+next.length+' steps · '+bom.length+' material lines.');save();
      },
      closeStage(id){refresh();worker(id);const stage=Store.currentStage(id);if(!stage)throw Error('Panel is already complete.');const steps=Store.stepsFor(id).filter(s=>s.stageId===stage.id);if(!steps.every(s=>Store.done(id,s)))throw Error('Complete all steps and required independent signoffs first.');if(steps.some(s=>Store.completion(id,s.id)?.result==='fail'))throw Error('Failed readings must be corrected or sent for rework before stage signoff.');if(stage.id==='stage-0'&&!ready(id)){reconcile(id);save();throw Error('Receiving cannot close while required material is short.');}if(stage.id==='stage-4'){lead();if(Store.openFindingCount(id))throw Error('Disposition every finding before Final QA signoff.');}
        S().stageClosures.push({id:uid(),panelId:id,stageId:stage.id,at:stamp(),by:actor().id,version:Store.panel(id).checklistVersion});event(id,'Signed off stage '+stage.name,'Checklist version '+Store.panel(id).checklistVersion);transition(id,stage);save();
      },
      failTest(id,reason,stepId){refresh();worker(id);if(Store.currentStage(id)?.id!=='stage-3')throw Error('Test rework can be raised only in Testing.');if(!String(reason||'').trim())throw Error('Describe the failed test.');const records=S().completions.filter(c=>c.panelId===id&&['stage-2','stage-3','stage-4'].includes(Store.step(c.stepId,id)?.stageId));const ids=new Set(records.map(c=>c.id));const cycle={id:uid(),panelId:id,reason:reason.trim(),at:stamp(),by:actor().id,records:copy(records),signoffs:copy(S().signoffs.filter(a=>ids.has(a.completionId))),closures:copy(S().stageClosures.filter(c=>c.panelId===id&&['stage-2','stage-3','stage-4'].includes(c.stageId)))};S().reworks.push(cycle);
        const f={id:'F-'+String(S().nextFinding++).padStart(6,'0'),panelId:id,stepId:stepId||Store.stepsFor(id).find(s=>s.stageId==='stage-3').id,by:actor().id,at:stamp(),description:reason.trim(),action:'Returned to Wiring; repeat wiring checks and all tests.',severity:'needs evaluation',deferredTo:'stage-3',status:'open',entries:[],disposition:null};S().findings.push(f);cycle.findingId=f.id;
        S().completions=S().completions.filter(c=>!ids.has(c.id));S().signoffs=S().signoffs.filter(a=>!ids.has(a.completionId));invalidateClosures(id,'stage-2');S().stageEntries.push({id:uid(),panelId:id,stageId:'stage-2',at:stamp()});event(id,'Test failed — returned to Wiring',reason.trim()+' · '+f.id+' · previous readings archived in rework cycle.');save();
      },
      bookLabor(id,data){refresh();worker(id);const minutes=Number(data.minutes);if(!Number.isFinite(minutes)||minutes<=0||minutes>1440||!String(data.note||'').trim())throw Error('Enter 1–1440 minutes and a work description.');const stage=Store.currentStage(id);if(!stage)throw Error('Panel is complete.');S().labor.push({id:uid(),panelId:id,stageId:stage.id,minutes,note:data.note.trim(),by:actor().id,at:stamp()});event(id,'Booked labour',minutes+' minutes · '+data.note.trim());save();},
      hours(id,stageId){return S().labor.filter(r=>r.panelId===id&&(!stageId||r.stageId===stageId)).reduce((n,r)=>n+r.minutes,0)/60;},
      heldMs(id,stageId,start=0,end=Date.now()){const spans=S().holds.filter(h=>h.panelId===id&&(!stageId||h.stageId===stageId)).map(h=>[Math.max(start,Date.parse(h.at)),Math.min(end,Date.parse(h.clearedAt||new Date().toISOString()))]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let total=0,last=0;for(const [a,b]of spans){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}return total;},
      timeInStage(id){const p=Store.panel(id),stage=Store.currentStage(id);if(!stage||p.workStatus!=='in-progress')return 0;const entry=S().stageEntries.filter(e=>e.panelId===id&&e.stageId===stage.id).at(-1);const start=entry?Date.parse(entry.at):Date.now();return Math.max(0,Date.now()-start-Store.heldMs(id,stage.id,start));},
      stageElapsed(id,stageId){let total=0;for(const entry of S().stageEntries.filter(e=>e.panelId===id&&e.stageId===stageId)){const start=Date.parse(entry.at),closure=S().stageClosures.concat(...S().reworks.filter(r=>r.panelId===id).map(r=>r.closures)).filter(c=>c.panelId===id&&c.stageId===stageId&&Date.parse(c.at)>=start).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];const next=S().stageEntries.filter(e=>e.panelId===id&&Date.parse(e.at)>start).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];const end=Math.min(closure?Date.parse(closure.at):Date.now(),next?Date.parse(next.at):Date.now());total+=Math.max(0,end-start-Store.heldMs(id,stageId,start,end));}return total;}
    });
    const originalCreate=Store.createWorkOrder;Store.createWorkOrder=data=>{lead();const result=originalCreate(data);result.forEach(p=>{p.checklist=copy(SEED.steps);p.checklistVersion=1;p.requiredMaterials=[];p.assigneeId='';});save();return result;};
    const originalRelease=Store.releaseWorkOrder;Store.releaseWorkOrder=id=>{originalRelease(id);const p=Store.panel(id);p.approvedChecklist=copy(Store.stepsFor(id));p.approvedVersion=p.checklistVersion;reconcile(id);save();};
    const originalBegin=Store.beginWork;Store.beginWork=id=>{originalBegin(id);reconcile(id);save();};
    const originalReceipt=Store.addReceivedMaterial;Store.addReceivedMaterial=data=>{const item=originalReceipt(data);item.match=(Store.panel(data.panelId).requiredMaterials||[]).some(r=>norm(r.partNumber)===norm(item.partNumber))?'matched':'unlisted / wrong part';reconcile(data.panelId);save();return item;};
    for(const method of ['undo','removeSignoff','correct']){const original=Store[method];Store[method]=(...args)=>{const id=method==='removeSignoff'?S().completions.find(c=>c.id===args[0])?.panelId:args[0];original(...args);const first=Store.stepsFor(id).find(s=>!Store.done(id,s));if(first)invalidateClosures(id,first.stageId);save();if(method==='correct'&&Store.step(args[1],id)?.stageId==='stage-3'&&Store.completion(id,args[1])?.result==='fail')Store.failTest(id,'Corrected test reading failed: '+Store.step(args[1],id).title,args[1]);};}
    api.reconcile=reconcile;
  };
})();

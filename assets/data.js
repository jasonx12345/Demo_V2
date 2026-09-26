(function () {
  const now = Date.now(), hour = 3600000;
  const stages = ['Receiving','Assembly','Wiring','Testing','Final QA'].map((name,i) => ({id:'stage-'+i,seq:i+1,name}));
  const titles = ['Verify shipment against packing list','Enclosure damage inspection','Mount chassis to frame rails','Torque chassis fasteners','Install breaker mounting plate','Populate DIN rail components','Torque busbar connections','Run control wiring','Print and apply wire markers','Terminate terminal blocks TB1–TB6','Wire count verification','Continuity / point-to-point test','Insulation resistance at 1000 VDC','Relay configuration per specified protection scheme','Energization record','Visual inspection and labelling','Review open findings','Final QA release'];
  const instructions = ['Compare received items with the packing list.','Inspect enclosure surfaces, doors and mounting points. Record damage as a finding.','Fit the chassis per drawing 602-A-01.','Record the measured chassis fastener torque.','Fit the mounting plate per drawing 602-A-02.','Install components in the indicated positions.','Record busbar torque. A different lead must review this record.','Run control wiring per schematic 602-E-04.','Check markers against the schematic and apply them at both ends.','Complete terminations per terminal schedule 602-E-05.','Record the wire count. A different lead must review this record.','Record completion of the continuity and point-to-point check.','Record measured insulation resistance.','Record that configuration was checked against the specified protection scheme.','Record that the energization check was done. This record does not authorize energization or any physical action.','Check the finished assembly, identification and labels.','Review every finding and every completed failed reading below. Each finding needs a disposition before this review can be completed.','Record the final QA check. A different lead must sign off. The findings review must be complete.'];
  const captures = {4:{label:'Chassis torque',unit:'N·m',nominal:22,min:20,max:24},7:{label:'Busbar torque',unit:'N·m',nominal:35,min:33,max:37},11:{label:'Wire count',unit:'wires',nominal:148,min:148,max:148},13:{label:'Insulation resistance',unit:'MΩ',nominal:100,min:100,max:null}};
  const steps = titles.map((title,i)=>({id:'step-'+(i+1),seq:i+1,stageId:stages[i<2?0:i<7?1:i<11?2:i<15?3:4].id,title,instruction:instructions[i],requiresLeadSignoff:[7,11,18].includes(i+1),capture:captures[i+1]}));
  const users = [{id:'kovach',name:'A. Kovach',badge:'4471',role:'technician'},{id:'bissonnette',name:'R. Bissonnette',badge:'5104',role:'technician'},{id:'okafor',name:'J. Okafor',badge:'3218',role:'lead'},{id:'cardoso',name:'M. Cardoso',badge:'2907',role:'lead'}];
  const specs = [['601','Merivale PCT Building',2,15,1],['602','Merivale PCT Building',5,9,20],['588','Riverside Substation',-1,8,72],['589','Riverside Substation',1,8,40],['590','Riverside Substation',3,8,9],['611','Merivale PCT Building',12,0,1/3],['594','Nepean Feeder Upgrade',8,12,5]];
  const state = {version:4,currentUserId:null,panels:[],completions:[],signoffs:[],findings:[],notes:[],history:[],stageEntries:[],nextSerial:612,nextWO:25912,nextFinding:3};
  specs.forEach(([rack,project,days,count,age],pi)=>{
    const date=new Date(now); date.setDate(date.getDate()+days);
    const dueDate=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    const panel={id:'PNL-'+rack,serial:'PNL-'+rack,wo:'WO-'+String(25300+Number(rack)).padStart(6,'0'),jobNumber:project.startsWith('Merivale')?'JOB-602':project.startsWith('Riverside')?'JOB-588':'JOB-594',project,rack,panelType:'Feeder Protection Panel',dueDate,workStatus:'in-progress',stepOverrides:[],lastAccessedAt:new Date(now-(pi+1)*hour).toISOString()};
    state.panels.push(panel);
    const currentIndex=count<2?0:count<7?1:count<11?2:count<15?3:4;
    for(let si=0;si<=currentIndex;si++){
      const at=new Date(now-age*hour-(currentIndex-si)*12*hour).toISOString();
      state.stageEntries.push({id:panel.id+'-entry-'+si,panelId:panel.id,stageId:stages[si].id,at});
      state.history.push({id:panel.id+'-entry-event-'+si,panelId:panel.id,by:null,at,action:'Entered '+stages[si].name,detail:'Seeded stage entry.'});
    }
    steps.slice(0,count).forEach(step=>{
      const si=stages.findIndex(s=>s.id===step.stageId),offset=steps.filter(s=>s.stageId===step.stageId).indexOf(step)+1;
      const at=new Date(now-age*hour-(currentIndex-si)*12*hour+offset*60000).toISOString(),by=pi%2?'bissonnette':'kovach';
      const c={id:panel.id+'-'+step.id,panelId:panel.id,stepId:step.id,by,at,value:step.capture?step.capture.nominal:null,result:'pass',readings:step.capture?[{value:step.capture.nominal,result:'pass',by,at}]:[],failedAtCompletion:false,outOfSequence:null};
      state.completions.push(c);
      state.history.push({id:c.id+'-event',panelId:panel.id,by,at,action:'Completed step '+step.seq+' — '+step.title,detail:step.capture?c.value+' '+step.capture.unit+' · PASS':'Check recorded.'});
      if(step.requiresLeadSignoff){
        const sign={id:c.id+'-sign',completionId:c.id,by:'okafor',at:new Date(Date.parse(at)+30000).toISOString(),outOfSequence:null};
        state.signoffs.push(sign);
        state.history.push({id:sign.id+'-event',panelId:panel.id,by:sign.by,at:sign.at,action:'Signed off step '+step.seq+' — '+step.title,detail:'Independent lead signoff.'});
      }
    });
  });
  [['F-000001','PNL-588','step-2','bissonnette',108,'Terminal block found cracked on arrival.','Replaced from stores.','needs evaluation','stage-3'],['F-000002','PNL-601','step-15','kovach',2,'Minor label alignment noticed during final checks.','Recorded for Final QA review.','awareness','stage-4']].forEach(([id,panelId,stepId,by,age,description,action,severity,deferredTo])=>{
    const at=new Date(now-age*hour).toISOString();
    state.findings.push({id,panelId,stepId,by,at,description,action,severity,deferredTo,status:'open',entries:[{by,at,text:action}],disposition:null});
    state.history.push({id:id+'-event',panelId,by,at,action:'Created finding '+id,detail:description+' Severity: '+severity+'.'});
  });
  const note={id:'handoff-589',panelId:'PNL-589',by:'bissonnette',at:new Date(now-2*hour).toISOString(),text:'Shift handoff: blue 14 AWG is running low. Check remaining stock before the next wiring run.',acknowledgement:null,removedBy:null,removedAt:null,notifyAuthor:true};
  state.notes.push(note);
  state.history.push({id:'handoff-event',panelId:note.panelId,by:note.by,at:note.at,action:'Added panel note',detail:note.text});
  window.SEED={users,stages,steps,state};
})();

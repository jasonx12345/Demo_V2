(function(){
  const E=ShopUI.escape,thresholds=[3,3,3,3,2];
  function render(){
    Store.refresh();const now=new Date(),counts=Store.stageCounts();
    document.getElementById('clock').innerHTML=now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'<span>'+now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</span>';
    const available=window.innerHeight-174-24-82;
    document.getElementById('board').innerHTML=SEED.stages.map((stage,index)=>{
      const panels=Store.panels.filter(p=>p.workStatus!=='draft'&&Store.currentStage(p.id)?.id===stage.id).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),allFit=panels.length*182<=available,capacity=Math.max(0,Math.floor((available-(allFit?0:44))/182)),visible=panels.slice(0,capacity),extra=panels.length-visible.length;
      return `<section class="column"><div class="column-heading ${counts[stage.id]>thresholds[index]+2?'red':counts[stage.id]>thresholds[index]?'amber':counts[stage.id]?'active':''}"><span>${stage.name}</span><span class="column-count">${counts[stage.id]}</span></div>${visible.map(p=>{
        const late=Store.isLate(p.id),elapsed=Store.timeInStage(p.id),records=Store.state.completions.filter(c=>c.panelId===p.id),events=[...records,...Store.state.signoffs.filter(s=>records.some(c=>c.id===s.completionId))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),last=events[0]&&Store.user(events[0].by),initials=last?last.name.split(/[ .]+/).filter(Boolean).map(w=>w[0]).join(''):'—',due=new Date(p.dueDate+'T00:00:00'),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),days=Math.round((due-today)/86400000),findingCount=Store.openFindingCount(p.id);
        return `<article class="board-card ${late?'late':findingCount||elapsed>36*3600000?'attention':records.length?'active':''}"><div class="card-title">${E(p.serial)}${findingCount?'<span class="finding-dot" aria-label="Open finding"></span>':''}</div><div class="card-project">${E(p.project)}</div><div class="card-due ${late?'late-text':''}">Due ${due.toLocaleDateString([],{month:'short',day:'numeric'})} · ${days<0?Math.abs(days)+'d overdue':days===0?'today':days+'d left'}</div><div class="card-meta"><span>${p.workStatus==='released'?'Released · ready':'In stage <span class="mono">'+ShopUI.duration(elapsed)+'</span>'}</span><span class="mono">${initials}</span></div></article>`;
      }).join('')}${extra?`<div class="overflow">+${extra} MORE</div>`:!panels.length?'<div class="empty">No panels in this stage</div>':''}</section>`;
    }).join('');
    document.getElementById('board-status').textContent=Store.storageAvailable?'AUTO REFRESH · 5 SEC / '+Store.panels.filter(p=>!Store.currentStage(p.id)).length+' COMPLETED':'STORAGE UNAVAILABLE · THIS WINDOW ONLY';
  }
  window.addEventListener('shopchange',render);window.addEventListener('resize',render);setInterval(render,5000);render();
})();

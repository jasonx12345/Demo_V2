(function () {
  const aliases = {
    partNumber: ['part number', 'part no', 'part num', 'pn', 'p n', 'catalog number', 'catalog no', 'model number'],
    description: ['description', 'desc', 'item description'],
    quantity: ['quantity received', 'qty received', 'quantity', 'qty'],
    barcode: ['barcode value', 'barcode'],
    panel: ['panel work order', 'work order', 'panel', 'wo'],
    ignore: ['raw ocr text', 'capture source', 'serial number', 'tag id']
  };
  const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  function distance(a, b) {
    let row = Array.from({length:b.length + 1}, (_, i) => i);
    for (let i=1;i<=a.length;i++) { const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1)); row=next; }
    return row[b.length];
  }
  function label(value) {
    const key=normalize(value); let best=null;
    for(const [field,names] of Object.entries(aliases)) for(const name of names) {
      const target=normalize(name), score=key===target?1:1-distance(key,target)/Math.max(key.length,target.length);
      if(score >= (target.length<5?1:.8) && (!best || score>best.score)) best={field,score};
    }
    return best;
  }
  function parse(text, barcode, panels) {
    const rawText=String(text||''), lines=rawText.split(/\r?\n/).map(s=>s.replace(/^[\s|~`"“”]+/g,'').trim()).filter(Boolean);
    const values={}, evidence={}, warnings=[],conflicts=new Set();
    for(let i=0;i<lines.length;i++) {
      let match=lines[i].match(/^([^:]{1,40}):\s*(.*)$/), found=label(match?match[1]:lines[i]);
      if(!found && !match){const words=lines[i].split(/\s+/);for(let n=Math.min(3,words.length-1);n>0;n--){const candidate=label(words.slice(0,n).join(' '));if(candidate){found=candidate;match=[lines[i],words.slice(0,n).join(' '),words.slice(n).join(' ')];break;}}}
      if(!found) continue;
      let value=match?match[2].trim():'';
      if(!value && lines[i+1] && !label(lines[i+1].split(':')[0])) value=lines[++i];
      if(!value || found.field==='ignore' || conflicts.has(found.field)) continue;
      value=value.replace(/\s+[=|~]+\s*$/g,'').trim();
      if(found.field==='quantity') { const n=value.match(/^\d+(?:\.\d+)?(?:\s*(?:pcs|pieces|ea|units))?\s*$/i); if(!n) continue; value=String(Number.parseFloat(value)); }
      if(found.field==='partNumber' && !/^[a-z0-9][a-z0-9._/ -]*$/i.test(value)) continue;
      if(values[found.field] && values[found.field]!==value) { warnings.push('Conflicting '+found.field+' values: choose the correct value from the label.'); values[found.field]=''; conflicts.add(found.field); continue; }
      values[found.field]=value; evidence[found.field]=found.score===1?'Matched label':'Similar label — verify';
    }
    const search=(values.panel||rawText).toUpperCase(), matches=panels.filter(p=>[p.serial,p.wo].some(v=>new RegExp('(^|[^A-Z0-9])'+String(v).replace(/[-\s]/g,'[-\\s]*')+'($|[^A-Z0-9])').test(search)));
    if(matches.length>1) warnings.push('Multiple panels match the image. Select the correct work order.');
    return {panelId:matches.length===1?matches[0].id:'',partNumber:values.partNumber||'',description:values.description||'',quantity:values.quantity||'',barcode:barcode||values.barcode||'',rawText,source:'PaddleOCR · local browser',evidence,warnings};
  }
  window.ScanMatcher={parse};
})();

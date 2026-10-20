(function(){
  let endpoint='',revision=0,baseline='',applying=false,busy=false,paused=false,connected=false;
  const key=Store.key;
  function serialized(){return JSON.stringify({...Store.state,currentUserId:null});}
  function status(text){const el=document.getElementById('shared-status');if(el)el.textContent=text;}
  function apply(state){const currentUserId=Store.state.currentUserId;applying=true;localStorage.setItem(key,JSON.stringify({...state,currentUserId}));Store.refresh();window.dispatchEvent(new Event('shopchange'));applying=false;baseline=serialized();}
  async function request(method,body){const r=await fetch(endpoint+'/api/state',{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.status===409){paused=true;throw Error('Conflict: another device saved first. Your local changes are preserved. Use “Reload shared records” before continuing.');}if(!r.ok)throw Error('Shared server unavailable. Local changes are preserved.');return r.json();}
  async function sync(){if(!connected||busy||paused)return;busy=true;try{
    const local=serialized();if(local!==baseline){const result=await request('POST',{revision,state:JSON.parse(local)});revision=result.revision;baseline=local;status('Shared · saved revision '+revision);}
    else {const result=await request('GET');if(result.state&&result.revision!==revision){if(serialized()!==baseline)return;apply(result.state);revision=result.revision;}status('Shared · connected · revision '+revision);}
  }catch(error){status(error.message);}finally{busy=false;}}
  async function connect(url){if(busy)return;try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Enter an HTTP(S) server address.');endpoint=parsed.origin;busy=true;const before=serialized();const result=await request('GET');if(serialized()!==before)throw Error('Local records changed while connecting. Try connecting again.');revision=result.revision;if(result.state)apply(result.state);else baseline='';connected=true;paused=false;localStorage.setItem('panel-demo-shared-url',endpoint);status('Shared server connected.');}catch(error){status(error.message);}finally{busy=false;}await sync();}
  window.SharedDemo={connect,sync};
  const section=document.createElement('section');section.className='shared-settings';section.innerHTML='<details><summary>Shared demo connection</summary><p>Standalone mode stores records in this browser. Connect every device to the same demo server for shared records. Connecting loads that server’s records; your demo badge stays local. This demo server has no production authentication.</p><form id="shared-connect"><label>Shared server URL<input name="endpoint" type="url" placeholder="http://192.168.1.20:8766" required></label><button>Connect and load shared records</button></form><button type="button" id="shared-reload">Reload shared records</button><button type="button" id="shared-disconnect">Disconnect</button></details><p id="shared-status" role="status">Standalone · this browser only</p>';
  document.body.append(section);
  section.querySelector('form').addEventListener('submit',e=>{e.preventDefault();connect(new FormData(e.target).get('endpoint'));});
  section.querySelector('#shared-reload').addEventListener('click',()=>{if(endpoint)connect(endpoint);});
  section.querySelector('#shared-disconnect').addEventListener('click',()=>{connected=false;paused=false;localStorage.removeItem('panel-demo-shared-url');status('Standalone · this browser only');});
  window.addEventListener('shopchange',()=>{if(!applying&&connected&&!paused)setTimeout(sync,0);});setInterval(sync,3000);
  const previous=localStorage.getItem('panel-demo-shared-url');if(previous){section.querySelector('input').value=previous;connect(previous);}else if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){section.querySelector('input').value=location.origin;}
})();

// Shared, fabricated demo data only. Run behind an authenticated HTTPS service for public use.
const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,file=process.env.DEMO_STATE_FILE||path.join(root,'.demo-shared-state.json'),port=Number(process.env.PORT||8766),host=process.env.HOST||'127.0.0.1';
let saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{revision:0,state:null};
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin,allowed=['https://jasonx12345.github.io',...(process.env.DEMO_ALLOWED_ORIGINS||'').split(',').filter(Boolean)];
  if(origin&&origin!==`http://${req.headers.host}`){if(!allowed.includes(origin)){res.writeHead(403);return res.end('Origin not allowed');}res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);return res.end();}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/state'){
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    if(req.method==='GET')return res.end(JSON.stringify(saved));
    if(req.method!=='POST'){res.writeHead(405);return res.end('{}');}
    try{let text='';for await(const chunk of req){text+=chunk;if(text.length>5*1024*1024){res.writeHead(413);return res.end('{}');}}
      const body=JSON.parse(text);if(body.revision!==saved.revision){res.writeHead(409);return res.end(JSON.stringify({error:'Another device saved first. Reload shared records before editing again.'}));}
      if(body.state?.version!==5||body.state?.workflowVersion!==1||!Array.isArray(body.state.panels)||!Array.isArray(body.state.history)){res.writeHead(400);return res.end(JSON.stringify({error:'Invalid demo state'}));}
      const state={...body.state,currentUserId:null};const next={revision:saved.revision+1,state};fs.writeFileSync(file+'.tmp',JSON.stringify(next));fs.renameSync(file+'.tmp',file);saved=next;return res.end(JSON.stringify({revision:saved.revision}));
    }catch(error){res.writeHead(400);return res.end(JSON.stringify({error:'Could not save demo state'}));}
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let relative;try{relative=decodeURIComponent(url.pathname);}catch{res.writeHead(400);return res.end();}
  if(relative==='/' )relative='/index.html';
  if(relative.split('/').some(part=>part.startsWith('.'))||relative.includes('node_modules')||relative.endsWith('.cjs')){res.writeHead(403);return res.end();}
  const target=path.resolve(root,'.'+relative);if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.tar':'application/octet-stream','.json':'application/json','.txt':'text/plain'};
  fs.stat(target,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control',path.extname(target)==='.tar'?'public, max-age=86400':'no-cache');res.setHeader('Content-Length',stat.size);res.writeHead(200);if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);});
});
if(require.main===module)server.listen(port,host,()=>console.log(`Shared demo: http://${host}:${port} — fabricated demo records; no production authentication.`));
module.exports=server;

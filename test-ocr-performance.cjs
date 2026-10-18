const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('assets/ocr-entry.js','utf8').replace("import { PaddleOCR } from '@paddleocr/paddleocr-js';",'').replaceAll('import.meta.url',"'https://example.test/Demo_V2/assets/ocr-bundle.js'");
const entries=new Map();let downloads=0,creates=0,prepared;
function session(blockCache=false){
  const ctx={URL,Event,performance,console,window:{dispatchEvent(){}},caches:{async open(){if(blockCache)throw Error('Storage unavailable');return {async match(url){return entries.get(url)?.clone();},async put(url,response){entries.set(url,response);}};}},fetch:async()=>{downloads++;return new Response(new Blob(['model']));},createImageBitmap:async file=>({width:file.width,height:file.height,close(){}}),document:{createElement(){const canvas={getContext(){return {drawImage(){},imageSmoothingEnabled:true};}};return canvas;}},PaddleOCR:{async create(options){creates++;return {async predict(image){prepared=image;return [{items:[]}];}};}}};
  vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.window.LabelOCR;
}
(async()=>{
  let ocr=session();await Promise.all([ocr.preload(),ocr.preload()]);assert.equal(creates,1);assert.equal(downloads,2);
  await ocr.recognize({width:4800,height:3200});assert.equal(prepared.width,2400);assert.equal(prepared.height,1600);
  const small={width:800,height:600};await ocr.recognize(small);assert.strictEqual(prepared,small);
  ocr=session();await ocr.preload();assert.equal(downloads,2,'Repeat visit must use model cache');
  ocr=session(true);await ocr.preload();assert.equal(creates,3,'Unavailable cache must allow engine initialization');
  console.log('Preload deduplication, persistent cache, resizing, small-image preservation and storage fallback passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

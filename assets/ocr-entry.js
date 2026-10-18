import { PaddleOCR } from '@paddleocr/paddleocr-js';
let engine;
const modelURLs=[];
async function cachedModel(name) {
  const url=new URL('models/'+name,import.meta.url).href;
  // Cache only versioned recognition assets; user photos never enter this cache.
  try {
    const cache=await caches.open('panel-ocr-models-v1');
    let response=await cache.match(url);
    if(!response){response=await fetch(url);if(!response.ok)throw Error('Model download failed');await cache.put(url,response.clone());}
    const blobURL=URL.createObjectURL(await response.blob());modelURLs.push(blobURL);return blobURL;
  } catch(error) {return url;} // Private browsing/storage limits must not prevent scanning.
}
function preload() {
  if(!engine) engine=(async()=>{
    const [detection,recognition]=await Promise.all([cachedModel('detection.tar'),cachedModel('recognition.tar')]);
    return PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textDetectionModelAsset:{url:detection},textRecognitionModelName:'PP-OCRv5_mobile_rec',textRecognitionModelAsset:{url:recognition},ortOptions:{backend:'wasm',numThreads:1,wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'}});
  })().catch(error=>{engine=null;modelURLs.splice(0).forEach(url=>URL.revokeObjectURL(url));throw error;});
  return engine;
}
async function prepareImage(file) {
  const bitmap=await createImageBitmap(file);
  // Preserve small labels; cap only oversized camera images to avoid needless work.
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
  if(scale===1){bitmap.close();return file;}
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas;
}
window.LabelOCR = {
  preload,
  async recognize(file) {
    const started=performance.now();
    const [ocr,image]=await Promise.all([preload(),prepareImage(file)]);
    const [result]=await ocr.predict(image);
    this.lastDurationMs=performance.now()-started;
    // Group boxes into horizontal rows so a label and its value stay together.
    const boxes=result.items.map(item=>{const xs=item.poly.map(p=>p[0]),ys=item.poly.map(p=>p[1]);return {...item,x:Math.min(...xs),y:(Math.min(...ys)+Math.max(...ys))/2,h:Math.max(...ys)-Math.min(...ys)};}).sort((a,b)=>a.y-b.y);
    const rows=[];
    for(const box of boxes){let row=rows.find(r=>Math.abs(r.y-box.y)<Math.max(r.h,box.h)*.45);if(!row){row={y:box.y,h:box.h,items:[]};rows.push(row);}row.items.push(box);}
    return rows.map(row=>row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join('\n');
  }
};
window.dispatchEvent(new Event('labelocrready'));

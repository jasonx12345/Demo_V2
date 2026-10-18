import { PaddleOCR } from '@paddleocr/paddleocr-js';
let engine;
window.LabelOCR = {
  async recognize(file) {
    if(!engine) engine=PaddleOCR.create({textDetectionModelName:'PP-OCRv5_mobile_det',textDetectionModelAsset:{url:new URL('models/detection.tar',import.meta.url).href},textRecognitionModelName:'PP-OCRv5_mobile_rec',textRecognitionModelAsset:{url:new URL('models/recognition.tar',import.meta.url).href},ortOptions:{backend:'wasm',numThreads:1,wasmPaths:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'}}).catch(error=>{engine=null;throw error;});
    const [result]=await (await engine).predict(file);
    // Group boxes into horizontal rows so a label and its value stay together.
    const boxes=result.items.map(item=>{const xs=item.poly.map(p=>p[0]),ys=item.poly.map(p=>p[1]);return {...item,x:Math.min(...xs),y:(Math.min(...ys)+Math.max(...ys))/2,h:Math.max(...ys)-Math.min(...ys)};}).sort((a,b)=>a.y-b.y);
    const rows=[];
    for(const box of boxes){let row=rows.find(r=>Math.abs(r.y-box.y)<Math.max(r.h,box.h)*.45);if(!row){row={y:box.y,h:box.h,items:[]};rows.push(row);}row.items.push(box);}
    return rows.map(row=>row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join('\n');
  }
};

var b=Object.defineProperty;var o=(t,n)=>b(t,"name",{value:n,configurable:!0});import{SHEET as c}from"./draftingStandard.js?rwv=20260930-load-units-1";import{renderSvg as p}from"./svgRenderer.js?rwv=20261003-cad-contour-1";const i=o(t=>"p"+String(t).toLowerCase().replace(/[^a-z0-9]/g,""),"pageName"),m=o(t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),"esc");export function printableDocument(t,n={}){if(!Array.isArray(t)||!t.length)throw new TypeError("printableDocument: ต้องมีหน้าอย่างน้อยหนึ่งหน้า");const s=new Map,l=t.map((e,r)=>{const a=c[e.size];if(!a)throw new RangeError('printableDocument: ไม่รู้จักขนาดกระดาษ "'+e.size+'"');if(!e.html&&(!e.drawing||!Array.isArray(e.drawing.entities)))throw new TypeError("printableDocument: หน้าที่ "+(r+1)+" ไม่มีรูป");if(s.set(e.size,a),e.html)return e.html;const g=p(e.drawing,{scale:1,padPaper:0,page:{w:a.w,h:a.h}});return'<section class="sheet '+i(e.size)+'">'+g+"</section>"}).join(`
`),d=[...s.entries()].map(([e,r])=>"@page "+i(e)+" { size: "+r.w+"mm "+r.h+`mm; margin: 0; }
.`+i(e)+" { page: "+i(e)+"; width: "+r.w+"mm; height: "+r.h+"mm; }").join(`
`),h=n.fontHref?'<link rel="stylesheet" href="'+m(n.fontHref)+'">':"";return`<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>${m(n.title||"เอกสารกำแพงกันดิน")}</title>
${h}
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#e8edf3}
  body{font-family:Sarabun,system-ui,sans-serif;color:#000}
  ${d}
  .sheet{background:#fff;overflow:hidden;break-after:page;margin:0 auto 10mm;
         box-shadow:0 6px 24px rgb(15 44 78/.18)}
  .sheet:last-child{break-after:auto;margin-bottom:0}
  .sheet svg{display:block;width:100%;height:100%}
  .hint{max-width:180mm;margin:8mm auto;padding:6mm 8mm;background:#fff;border:1px solid #cbd5e1;
        font-size:11px;line-height:1.7}
  .hint b{display:block;margin-bottom:3px}
  @media print{ html,body{background:#fff} .sheet{box-shadow:none;margin:0} .hint{display:none} }
</style>${n.additionalCss?"<style>"+n.additionalCss+"</style>":""}</head><body>
<div class="hint"><b>ก่อนสั่งพิมพ์</b>
เลือกขนาดกระดาษให้ตรงกับแต่ละแผ่น · ตั้งมาตราส่วนการพิมพ์เป็น <b>ขนาดจริง 100%</b>
และปิด “ปรับให้พอดีหน้ากระดาษ” มิฉะนั้นมาตราส่วนบนแบบจะไม่ตรงเมื่อวัดด้วยไม้บรรทัด ·
ขอบกระดาษตั้งเป็น 0 เพราะกรอบแบบวาดมาในรูปแล้ว</div>
${l}
</body></html>`}o(printableDocument,"printableDocument");

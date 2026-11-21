import{installRwPrintHost as n}from"./printTransport.mjs";n(window,{onError(t){const o=document.querySelector("[data-print-status]");o?o.textContent=t:document.body&&(document.body.textContent=t)}});

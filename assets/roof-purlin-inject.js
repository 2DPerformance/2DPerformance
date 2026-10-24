(()=>{const u="./roof-purlin-calculator.html?embed=1",o="data-roof-purlin-calculator",l="roof-purlin-calculator-style";function s(e){return String(e||"").replace(/\s+/g," ").trim()}function m(){if(document.getElementById(l))return;const e=document.createElement("style");e.id=l,e.textContent=`
      [${o}] {
        margin-top: 22px;
        border: 1px solid #dbe4ee;
        border-radius: 14px;
        background: #f8fafc;
        overflow: hidden;
      }
      [${o}] iframe {
        display: block;
        width: 100%;
        min-height: 1120px;
        border: 0;
        background: transparent;
      }
      @media (max-width: 768px) {
        [${o}] {
          margin-top: 14px;
          border-radius: 10px;
        }
        [${o}] iframe {
          min-height: 1900px;
        }
      }
    `,document.head.appendChild(e)}function f(){return Array.from(document.querySelectorAll("h1")).find(e=>s(e.textContent)==="คำนวณโครงสร้างหลังคา")}function c(e){try{const t=e.contentDocument;if(!t)return;const a=Math.max(900,t.documentElement.scrollHeight,t.body?t.body.scrollHeight:0);e.style.height=`${a+8}px`}catch{}}function h(){const e=f();if(!e)return;const t=e.closest("header")||e.parentElement,a=t&&t.parentElement;if(!a)return;m();let r=a.querySelector(`[${o}]`);if(!r){r=document.createElement("section"),r.setAttribute(o,"true"),r.innerHTML=`<iframe title="Purlin and rafter calculator" src="${u}" loading="eager"></iframe>`,t.insertAdjacentElement("afterend",r);const n=r.querySelector("iframe");n.addEventListener("load",()=>{c(n),setInterval(()=>c(n),800)})}Array.from(a.children).forEach(n=>{n===t||n===r||(n.style.display="none",n.setAttribute("data-roof-purlin-hidden-original","true"))})}let i=!1;function d(){i||(i=!0,window.requestAnimationFrame(()=>{i=!1,h()}))}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",d):d(),new MutationObserver(d).observe(document.documentElement,{childList:!0,subtree:!0})})();

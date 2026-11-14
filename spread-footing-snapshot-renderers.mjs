var Oa=Object.defineProperty;var c=(t,a)=>Oa(t,"name",{value:a,configurable:!0});import{selectSpreadFooting3DData as We,selectSpreadFootingCalculationBookData as Xe,selectSpreadFootingChecksData as Ye,selectSpreadFootingDiagramData as Qe,selectSpreadFootingDrawingData as Ge,selectSpreadFootingReportData as Ze,selectSpreadFootingSectionData as Je,selectSpreadFootingSummaryData as ke,selectSpreadFootingTakeoffData as ta}from"./spread-footing-engine.mjs";const n="ไม่ระบุ",ea="ENGINEERING REVIEW REQUIRED",G="NOT EVALUATED · นอกขอบเขต",ne="NOT FOR CONSTRUCTION",Ft="NOT RELEASED BBS",Ha=.00980665,aa=Object.freeze(["summary","dc","analysis","section","three","report","calc","drawing"]),tt=c(t=>String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),"escapeHtml"),$=tt,we=c((t,a=new WeakSet)=>{if(!t||typeof t!="object"||a.has(t))return t;a.add(t);for(const s of Object.values(t))we(s,a);return Object.freeze(t)},"deepFreeze"),yt=c(t=>String(t).replaceAll("ไม่มีเส้นผลจาก Snapshot","ไม่มีเส้นผลคำนวณ").replaceAll(" (Snapshot)","").replaceAll("(Snapshot)","").replaceAll("NO CURRENT SNAPSHOT","ยังไม่มีผลคำนวณปัจจุบัน").replaceAll("NO SNAPSHOT","ยังไม่มีผลคำนวณ").replaceAll("SNAPSHOT CURRENT","ผลคำนวณปัจจุบัน").replaceAll("SNAPSHOT READY","ผลคำนวณพร้อม").replaceAll("CALCULATION SNAPSHOT","ชุดผลคำนวณ").replaceAll("Calculation Snapshot","ชุดผลคำนวณ").replaceAll("Snapshot ID","รหัสผลคำนวณ").replaceAll("Snapshot","ผลคำนวณ").replaceAll("SNAPSHOT","ผลคำนวณ").replaceAll("จาก ชุดผลคำนวณ","จากชุดผลคำนวณ").replaceAll("จาก ผลคำนวณ","จากผลคำนวณ").replaceAll("ผลทุกแท็บอ่านจากชุดผลคำนวณ ชุดเดียว","ผลทุกแท็บใช้ชุดผลคำนวณเดียวกัน").replaceAll("A4 ชุดแบบ และ Bar Cut อ่านข้อมูลจากผลคำนวณ เดียวกัน","A4 ชุดแบบ และ Bar Cut ใช้ผลคำนวณชุดเดียวกัน"),"publicResultCopy"),ge=c(t=>typeof t=="string"?yt(t):Array.isArray(t)?t.map(ge):!t||typeof t!="object"||Object.getPrototypeOf(t)!==Object.prototype?t:Object.fromEntries(Object.entries(t).map(([a,s])=>[a,ge(s)])),"publicResultCopyDeep"),ja=c((t,a)=>{if(!(!t||typeof t!="object"))return String(a).split(".").reduce((s,o)=>s?.[o],t)},"getPath"),e=c((t,a,s=void 0)=>{for(const o of a){const r=typeof o=="function"?o(t):ja(t,o);if(r!=null&&r!=="")return r}return s},"firstValue"),$t=c(t=>Array.isArray(t)?t:!t||typeof t!="object"?t==null?[]:[t]:Object.values(t),"toList"),k=c((t,a=n)=>{if(t==null||t==="")return a;if(typeof t=="string"||typeof t=="number"||typeof t=="bigint")return String(t);if(typeof t=="boolean")return t?"ใช่":"ไม่";if(Array.isArray(t))return t.map(i=>k(i,a)).join(", ");if(typeof t!="object")return String(t);const s=e(t,["display","formatted","displayValue","text"]);if(s!==void 0)return String(s);const o=e(t,["value","amount","result","label","name"]);if(o===void 0)return a;const r=e(t,["unit","canonicalUnit","units"],"");return r?`${k(o,a)} ${k(r,"")}`:k(o,a)},"rawMetricText"),d=c((t,a=n)=>tt(k(t,a)),"metricText"),Ka=c((t,a,s=n)=>{const o=k(t,s);return o===s||!a||t&&typeof t=="object"?o:`${o} ${a}`},"rawValueWithUnit"),xs=c((t,a,s=n)=>tt(Ka(t,a,s)),"valueWithUnit"),p=c(t=>{const a=t&&typeof t=="object"?e(t,["value","amount","result"]):t;if(a==null||a==="")return null;const s=Number(a);return Number.isFinite(s)?s:null},"numericValue"),Ce=new Map,O=c((t,a=1,s=n)=>{const o=p(t);if(o===null)return k(t,s);const r=Math.max(0,Math.min(6,Math.trunc(a)));return Ce.has(r)||Ce.set(r,new Intl.NumberFormat("en-US",{maximumFractionDigits:r,minimumFractionDigits:0,useGrouping:!0})),Ce.get(r).format(o)},"formattedNumber"),Be=c((t,a=1,s=n)=>{const o=p(t);if(o===null)return k(t,s);const r=t&&typeof t=="object"?e(t,["unit","canonicalUnit","units"],""):"";return`${O(o,a,s)}${r?` ${k(r,"")}`:""}`},"rawFormattedMetric"),ut=c((t,a=1,s=n)=>tt(Be(t,a,s)),"formattedMetric"),Y=c((t,a,s=1,o=n)=>{const r=Be(t,s,o);return r===o||!a||t&&typeof t=="object"?r:`${r} ${a}`},"rawFormattedValueWithUnit"),l=c((t,a,s=1,o=n)=>tt(Y(t,a,s,o)),"formattedValueWithUnit"),sa=c(t=>t==="kg"?"kg":"kN","normalizeForceDisplayUnit"),za=c((t,a="kN",s=n)=>{const o=p(t);if(o===null)return tt(k(t,s));const r=sa(a),i=r==="kg"?o/Ha:o;return l(i,r,r==="kg"?0:2,s)},"formattedForceFromKn"),z=c((t,a="data-exact-value")=>{const s=p(t);return s===null?"":` ${a}="${$(String(s))}"`},"exactValueAttribute"),Zt=c((t={})=>Object.entries(t).map(([a,s])=>{const o=String(a).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");return o?z(s,`data-exact-${o}`):""}).join(""),"exactNamedAttributes"),na=c((t,a="")=>{const s=k(t&&typeof t=="object"?e(t,["unit","canonicalUnit","units"],a):a,"").toLowerCase();return s.includes("ratio")||s.includes("strain")||s.includes("dimensionless")?3:s.includes("mm2")||s.includes("mm²")||/(^|[^a-z])mm([^a-z]|$)/.test(s)?1:s.includes("kpa")||s.includes("kn")||s.includes("kg")||s.includes("mpa")||s==="m"||s.includes("m2")||s.includes("m3")?2:3},"engineeringMetricDigits"),It=c((t,a="",s=n)=>l(t,a,na(t,a),s),"formattedEngineeringMetric"),vs=c((t,a="",s=n)=>Y(t,a,na(t,a),s),"rawFormattedEngineeringMetric"),m=c((t,a="0")=>{const s=p(t);return s===null?a:String(Number(s.toFixed(3)))},"safeNumber"),Ss=c((t,a)=>{const s=String(t??"");return/^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/.test(s)?s:a},"safeSvgPath"),oe=c(t=>{const a=Array.isArray(t)?t.map(s=>Array.isArray(s)?`${m(s[0])},${m(s[1])}`:`${m(s?.x)},${m(s?.y)}`).join(" "):String(t??"");return/^[0-9+\-.,\s]+$/.test(a)?a:""},"safeSvgPoints"),oa=c(t=>{try{const a=new URL(String(t??""));return a.protocol==="https:"||a.protocol==="http:"?a.href:""}catch{return""}},"safeOfficialUrl"),Pt=c(t=>k(t,G).trim().toUpperCase().replaceAll("_"," ").replace(/\s+/g," "),"normalizedStatus"),Ua=c(t=>{const a=Pt(t);return a==="OWNER AUTHORIZED SPEC PENDING INDEPENDENT REVIEW"?"ข้อกำหนด Owner · รอตรวจทานอิสระ":a==="INDEPENDENTLY REVIEWED"?"ตรวจทานอิสระแล้ว":a==="VERIFIED"?"ตรวจสอบหลักฐานแล้ว":a==="PENDING REVIEW"?"รอตรวจทาน":k(t,G)},"verificationStatusLabel"),lt=c(t=>{if(!t||typeof t!="object")return!1;if(t.evaluated===!0||t.isEvaluated===!0)return!0;const a=Pt(e(t,["applicability","evaluation","evaluationStatus","evidence.evaluationStatus"],""));return a==="EVALUATED"||a==="APPLICABLE AND EVALUATED"},"isExplicitlyEvaluated"),nt=c((t,a=G)=>{const s=Pt(e(t,["status","verdict","resultStatus"],a));return(s==="PASS"||s==="FAIL")&&!lt(t)?G:s||a},"displayStatus"),Ms=c((t,a)=>{const s=Pt(e(a,["overall.status","overall.verdict"],t.overallStatus||ea));return s==="PASS"||s==="FAIL"||!s?ea:s},"overallStatus"),Nt=c(t=>{const a=Pt(t);return a==="PASS"?"is-pass":a==="FAIL"?"is-fail":a.includes("HOLD")||a.includes("NOT EVALUATED")||a.includes("REVIEW")?"is-review":"is-neutral"},"statusClass"),re=c(t=>{const a=nt(t);return a==="PASS"?"ผ่าน · OK":a==="FAIL"?"ไม่ผ่าน · FAIL":a.includes("HOLD")||a.includes("NOT EVALUATED")||a.includes("REVIEW")?"รอตรวจ · HOLD":a},"professionalResultLabel"),jt=c(t=>$t(e(t,["checks","results.checks"],[])).filter(a=>a&&typeof a=="object"),"normalizeChecks"),Ne=c(t=>{const a=jt(t).filter(lt);return a.some(s=>nt(s)==="FAIL")?{status:"FAIL",label:"ผลที่ประเมิน · FAIL"}:a.length>0&&a.every(s=>nt(s)==="PASS")?{status:"PASS",label:"ผลที่ประเมิน · OK"}:{status:G,label:"ยังไม่มีผลที่ประเมิน"}},"evaluatedSurfaceVerdict"),ra=c(t=>$t(e(t,["equations","results.equations"],[])).filter(a=>a&&typeof a=="object"),"normalizeEquations"),ia=c(t=>{if(!t||typeof t!="object")return!1;const a=Pt(e(t,["verificationStatus","evidence.verificationStatus","source.verificationStatus"],""));return!a.includes("NOT EVALUATED")&&!a.includes("HOLD")},"isPresentableEquation"),Wt=c(t=>{const a=e(t,["evidence","source","reference"],{}),s=a&&typeof a=="object"?a:{};return{sourceId:e(t,["sourceId","equationId"],e(s,["sourceId","id","equationId"],"SOURCE")),standard:e(t,["standard"],e(s,["standard","code"],n)),edition:e(t,["edition"],e(s,["edition"],n)),clause:e(t,["clause"],e(s,["clause","article","section"],n)),equation:e(t,["equationId"],e(s,["equationId"],n)),formula:e(t,["formula"],e(s,["formula"],n)),substitution:e(t,["substitution"],e(s,["substitution"],n)),canonicalUnits:e(t,["canonicalUnits","units"],e(s,["canonicalUnits","units"],n)),assumptions:e(t,["assumptions"],e(s,["assumptions"],[])),title:e(t,["sourceTitle"],e(s,["sourceTitle","title"],n)),url:e(t,["sourceUrl"],e(s,["sourceUrl","url"],"")),verificationStatus:e(t,["verificationStatus"],e(s,["verificationStatus","status"],n))}},"sourceRecord"),_a=c(t=>{const a=Wt(t);return`<span class="sf-source-inline">
    <b>${d(a.sourceId)}</b>
    <span>หลักฐานเต็มอยู่ใน Flow 07</span>
  </span>`},"renderSourceInline"),As=c((...t)=>{const a=[];for(const o of t){if(!o||typeof o!="object")continue;const r=e(o,["evidence","source","reference"],null);r&&typeof r=="object"&&a.push(r),(o.sourceUrl||o.url)&&a.push(o);const i=[e(o,["sources"],[]),e(o,["references"],[]),e(o,["sourceRegister"],[]),e(o,["standards"],[])];for(const u of i)for(const h of $t(u))h&&typeof h=="object"&&a.push(h)}const s=new Set;return a.filter(o=>{const r=Wt(o),i=`${k(r.sourceId,"")}|${k(r.url,"")}|${k(r.title,"")}`;return s.has(i)?!1:(s.add(i),!0)})},"referencesFrom"),gt=c((t,a)=>{if(!t||t.ok!==!0||typeof t.data!="object")throw new TypeError(`${a} did not return a valid Spread Footing result projection`);for(const s of["snapshotId","payloadHash","fingerprint"])if(t[s]===void 0||t[s]===null||t[s]==="")throw new TypeError(`${a} projection is missing ${s}`);return t},"requireEnvelope"),Jt=c((t,a)=>a==="calculationFingerprint"?t.calculationFingerprint??t.fingerprint:t[a],"traceValue"),Ee=c((t,a,s)=>{for(const o of["snapshotId","payloadHash","fingerprint","calculationFingerprint"])if(String(Jt(t,o))!==String(Jt(a,o)))throw new TypeError(`Spread Footing ${s} projection does not match the immutable result ${o}`)},"assertProjectionParity"),Xt=c((t,a)=>{const s=Jt(t,"calculationFingerprint");return[`data-snapshot-surface="${$(a)}"`,`data-snapshot-id="${$(t.snapshotId)}"`,`data-payload-hash="${$(t.payloadHash)}"`,`data-calculation-fingerprint="${$(s)}"`,`data-fingerprint="${$(t.fingerprint)}"`,`data-profile-id="${$(t.profileId||n)}"`].join(" ")},"surfaceAttributes"),Wa=c(t=>`<details class="sf-snapshot-trace-details">
  <summary>สายตรวจสอบ Calculation Snapshot · ${d(t.snapshotId)}</summary>
  <dl class="sf-snapshot-trace" aria-label="สายตรวจสอบชุดผลคำนวณฉบับเต็ม">
    <div><dt>ชุดผลคำนวณ (Snapshot)</dt><dd>${d(t.snapshotId)}</dd></div>
    <div><dt>แฮชข้อมูล (Payload hash)</dt><dd>${d(t.payloadHash)}</dd></div>
    <div><dt>ลายนิ้วมือข้อมูลนำเข้า</dt><dd>${d(t.fingerprint)}</dd></div>
    <div><dt>ลายนิ้วมือการคำนวณ</dt><dd>${d(Jt(t,"calculationFingerprint"))}</dd></div>
  </dl>
</details>`,"snapshotTrace"),et=c(t=>k(e(t,["id","checkId","equationId","key"],"CHECK")),"checkId"),Xa=Object.freeze({"bearing-capacity":"แรงดันดินใช้งานสูงสุดเทียบ SBC","full-contact-qmin":"การสัมผัสดินเต็มพื้นที่ โดย qmin ≥ 0","combined-kern":"เงื่อนไขแกนกลางหนึ่งในสามแบบสองทิศ","strength-applicability":"ขอบเขตใช้การตรวจกำลัง R1 สำหรับแรงกดตรงศูนย์","provided-steel-a":"เหล็กเสริมที่จัดให้ ทิศ A","tension-controlled-a":"เกณฑ์หน้าตัดควบคุมด้วยแรงดึง ทิศ A","flexure-capacity-a":"กำลังดัด ทิศ A","one-way-shear-a":"กำลังเฉือนทางเดียว ทิศ A","provided-steel-b":"เหล็กเสริมที่จัดให้ ทิศ B","tension-controlled-b":"เกณฑ์หน้าตัดควบคุมด้วยแรงดึง ทิศ B","flexure-capacity-b":"กำลังดัด ทิศ B","one-way-shear-b":"กำลังเฉือนทางเดียว ทิศ B","short-direction-band-distribution":"การกระจายเหล็กทิศสั้นในแถบกลาง","punching-shear":"กำลังเฉือนทะลุภายใน","punching-minimum-steel-a":"เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ A","punching-minimum-steel-b":"เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ B",settlement:"การทรุดตัว","sliding-overturning":"การเลื่อนและการพลิกคว่ำ","partial-contact-redistribution":"การกระจายแรงเมื่อสัมผัสดินไม่เต็มพื้นที่หรือเกิดแรงยก","durability-cover":"สภาพแวดล้อมและระยะหุ้มขั้นต่ำตามมาตรฐาน","minimum-clear-spacing":"ระยะห่างใสขั้นต่ำพร้อมหลักฐานขนาดมวลรวม","development-anchorage":"ระยะพัฒนา การยึดเหนี่ยว และขอมาตรฐาน","column-footing-transfer":"แรงกดและการถ่ายแรงระหว่างเสากับฐานราก",dowels:"เหล็กเดือย ชั้นคุณภาพ ระยะฝัง ระยะทาบ และเหล็กปลอก","construction-tolerances":"ค่าคลาดเคลื่อนงานก่อสร้าง","released-bbs":"บัญชีตัดดัดเหล็กที่อนุมัติผลิต (BBS)"}),Yt=c(t=>Xa[et(t)]??e(t,["label","title","name","topic","description"],et(t)),"checkLabel"),ie=Object.freeze(["bearing-capacity","flexure-capacity-a","flexure-capacity-b","one-way-shear-a","one-way-shear-b","punching-shear"]),Pe=Object.freeze({"strength-applicability":"DC-03","bearing-capacity":"DC-04","full-contact-qmin":"DC-04A","combined-kern":"DC-04B","partial-contact-redistribution":"DC-04C","flexure-capacity-a":"DC-05A","provided-steel-a":"DC-05A-S","tension-controlled-a":"DC-05A-T","flexure-capacity-b":"DC-05B","provided-steel-b":"DC-05B-S","tension-controlled-b":"DC-05B-T","short-direction-band-distribution":"DC-05C","one-way-shear-a":"DC-06A","one-way-shear-b":"DC-06B","punching-shear":"DC-07","punching-minimum-steel-a":"DC-07A-S","punching-minimum-steel-b":"DC-07B-S","durability-cover":"DC-08A","minimum-clear-spacing":"DC-08B","development-anchorage":"DC-08C","column-footing-transfer":"DC-09"}),Ya=Object.freeze({"strength-applicability":"ขอบเขตตรวจกำลัง R1","full-contact-qmin":"สัมผัสดินเต็มพื้นที่ qmin ≥ 0","combined-kern":"แกนกลางหนึ่งในสามแบบสองทิศ","provided-steel-a":"พื้นที่เหล็กที่จัดให้ ทิศ A","provided-steel-b":"พื้นที่เหล็กที่จัดให้ ทิศ B","tension-controlled-a":"หน้าตัดควบคุมแรงดึง ทิศ A","tension-controlled-b":"หน้าตัดควบคุมแรงดึง ทิศ B","short-direction-band-distribution":"กระจายเหล็กทิศสั้นในแถบกลาง","punching-minimum-steel-a":"เหล็กขั้นต่ำจากเฉือนทะลุ ทิศ A","punching-minimum-steel-b":"เหล็กขั้นต่ำจากเฉือนทะลุ ทิศ B"}),ca=new Set(["strength-applicability","provided-steel-a","provided-steel-b","short-direction-band-distribution","punching-minimum-steel-a","punching-minimum-steel-b","durability-cover","minimum-clear-spacing","development-anchorage","column-footing-transfer"]),Qa=new Set([...ca,"settlement","sliding-overturning","partial-contact-redistribution","dowels","construction-tolerances","released-bbs"]),la=c((t,{includeReviewRegister:a=!1}={})=>{const s=jt(t);if(!s.some(h=>ie.includes(et(h))))return s;const o=k(e(t,["overall.governingCheckId","summary.overall.governingCheckId","governingCheck.id"],""),""),r=new Set(ie);o&&r.add(o);for(const h of s){const g=et(h),x=Pt(e(h,["status"],""));lt(h)&&x==="FAIL"&&r.add(g),x==="HOLD"&&(ca.has(g)||a&&Qa.has(g))&&r.add(g)}const i=new Map(s.map(h=>[et(h),h])),u=[];for(const h of ie)i.has(h)&&u.push(i.get(h));for(const h of s){const g=et(h);r.has(g)&&!u.includes(h)&&u.push(h)}return u.length?u:s},"selectDecisionChecks"),ce=c(t=>e(t,["demandDisplay","demand","demandValue","operands.demand"],n),"checkDemand"),le=c(t=>e(t,["capacityDisplay","capacity","allowable","limit","operands.capacity"],n),"checkCapacity"),Tt=c(t=>e(t,["utilizationDisplay","utilization","dcRatio","ratio","demandCapacityRatio"],n),"checkRatio"),Ga=c(t=>e(t,["capacitySource","sbcSource","allowableSource"],null),"checkCapacitySource"),Za=c(t=>{const a=nt(t),s=lt(t),o=Pt(e(t,["status"],"")),r=!s&&o==="HOLD"?"รอตรวจ · HOLD":a,i=s?"evaluated":"not-evaluated",u=ce(t),h=le(t),g=Tt(t),x=Ga(t),b=k(u),S=k(h),f=k(g);return`<tr class="${Nt(a)}" data-check-id="${$(et(t))}" data-evaluation="${i}">
    <th scope="row"><span class="check-id">${d(et(t))}</span>${d(Yt(t))}${x?`<small class="sf-check-capacity-source">ที่มา SBC: ${d(x)}</small>`:""}</th>
    <td${s?z(u):""}>${s?b===n?"ไม่ใช้ค่าความต้องการเชิงตัวเลข":It(u):G}</td>
    <td${s?z(h):""}>${s?S===n?"ไม่ใช้ค่าความสามารถเชิงตัวเลข":It(h):G}</td>
    <td${s?z(g):""}>${s?f===n?"ไม่ใช้ค่า D/C เชิงตัวเลข":ut(g,3):G}</td>
    <td>${_a(t)}</td>
    <td><strong class="sf-status-token ${Nt(a)}">${d(r)}</strong></td>
  </tr>`},"renderCheckRow"),da=c((t,a)=>`<div class="dc-table-wrap" tabindex="0" role="region"
  aria-label="${$(a)}">
  <table class="dc-table sf-snapshot-checks">
    <caption class="sr-only">${tt(a)}</caption>
    <thead><tr>
      <th scope="col">รายการตรวจสอบ</th>
      <th scope="col">ค่าความต้องการ</th>
      <th scope="col">ค่าความสามารถ / เกณฑ์</th>
      <th scope="col">D/C</th>
      <th scope="col">รหัสหลักฐาน</th>
      <th scope="col">สถานะ</th>
    </tr></thead>
    <tbody>${t.length?t.map(Za).join(""):`<tr class="is-review">
      <td colspan="6"><strong>${G}</strong> ไม่มีรายการตรวจจากชุดผลคำนวณ</td>
    </tr>`}</tbody>
  </table>
</div>`,"renderChecksTable"),de=c(t=>e(t,["footing","foundation"],t||{}),"footingGeometry"),Ja=c(t=>e(t,["column","support"],{}),"columnGeometry"),L=c((t,a,s)=>{const o=a==="footing"?de(t):Ja(t);return e(o,{width:["width","B","b","widthM","xM","x"],length:["length","L","l","lengthM","yM","y"],thickness:["thickness","depth","h","height","thicknessM"]}[s]||[s],n)},"geometryDimension"),ot=c((t,a)=>e(t,[a,a.toLowerCase(),`direction${a}`],{}),"reinforcementDirection"),it=c((t,a)=>e(t,["mark","barMark","id"],a),"reinforcementMark"),St=c(t=>{const a=e(t,["diameterMm"],null);return k(e(t,["designation","barSize","size","diameterDisplay"],a==null?n:`DB${k(a)}`))},"reinforcementDesignation"),Kt=c((t,a=16)=>{const s=p(e(t,["diameterMm"],null));if(s!==null&&s>0)return s;const o=St(t).match(/^DB\s*(\d+(?:\.\d+)?)$/i),r=p(o?.[1]);return r!==null&&r>0?r:a},"reinforcementDiameterMm"),Le=c(t=>{const a=k(e(t,["layer","layerLabel"],""));return{LOWEST:"ชั้นล่างสุด",ABOVE_A:"ชั้นเหนือเหล็กทิศ A",BOTTOM:"ชั้นล่าง",TOP:"ชั้นบน"}[a.toUpperCase()]||a},"reinforcementLayerLabel"),Et=c((t,a)=>{const s=k(it(t,a)),o=k(e(t,["count","barCount","quantity"],n)),r=St(t),i=k(e(t,["direction","axis","orientation"],"")),u=Le(t);return[s,o!==n||r!==n?`${o}-${r}`:"",i,u].filter(Boolean).join(" · ")},"reinforcementSummary"),$e=c(({label:t,value:a,detail:s,status:o="",exact:r={}})=>`<article class="sf-metric-card ${o?Nt(o):""}"${Zt(r)}>
  <span>${tt(t)}</span>
  <strong>${d(a)}</strong>
  <p>${d(s)}</p>
</article>`,"metricCard"),De=c(t=>{const a=e(t,["corners","cornerPressures","pressureCorners"],null);if(Array.isArray(a))return a.slice(0,4).map(r=>r&&typeof r=="object"?e(r,["pressureKPa","pressure","value"],n):r);if(a&&typeof a=="object")return["q1","q2","q3","q4"].map(r=>e(a,[r,r.toUpperCase()],n));const s=e(t,["qMaxKPa","qMax","qmax","service.qMax"],n),o=e(t,["qMinKPa","qMin","qmin","service.qMin"],s);return[s,s,o,o]},"bearingCorners"),ua=c((t,a,s="summary",o={},r={})=>{const i=De(t),u=e(t,["qMaxKPa","qMax","qmax","service.qMax"],n),h=e(t,["qMinKPa","qMin","qmin","service.qMin"],n),g=L(a,"footing","width"),x=L(a,"footing","length"),b=L(a,"footing","thickness"),S=p(g)??1.5,f=p(x)??1.5,A=p(b)??.3,B=L(a,"column","width"),y=L(a,"column","length"),C=p(B)??.25,w=p(y)??.25,T=Math.max(S,f,.1),I=242/T,q=c(({x:X=0,y:bt=0,z:Q=0})=>({x:350+(X-bt)*I*.78,y:154+(X+bt)*I*.34-Q*I}),"project"),M=c(X=>X.map(bt=>{const Q=q(bt);return`${m(Q.x)},${m(Q.y)}`}).join(" "),"polygon"),v=S/2,N=f/2,D=[{x:-v,y:-N,z:A},{x:v,y:-N,z:A},{x:v,y:N,z:A},{x:-v,y:N,z:A}],at=[D[3],D[2],{x:v,y:N,z:0},{x:-v,y:N,z:0}],st=[D[1],D[2],{x:v,y:N,z:0},{x:v,y:-N,z:0}],H=-T*.11,V=[{x:-v,y:-N,z:H},{x:v,y:-N,z:H},{x:v,y:N,z:H},{x:-v,y:N,z:H}],U=C/2,j=w/2,F=A+T*.28,W=q({x:0,y:0,z:F}),Z=[{x:-U,y:-j,z:A},{x:U,y:-j,z:A},{x:U,y:j,z:A},{x:-U,y:j,z:A}],mt=Z.map(X=>({...X,z:F})),pt=$t(e(t,["pressureSamples"],[])).filter(X=>p(X?.xM)!==null&&p(X?.yM)!==null).map(X=>{const bt=q({x:p(X.xM),y:p(X.yM),z:H});return`<path d="M${m(bt.x)} ${m(bt.y)}V${m(bt.y-30)}" data-pressure-kpa="${$(X.pressureKPa)}"/>`}).join(""),At=c((X,bt,Q)=>$t(X).map(ft=>{const _t=q({x:p(ft?.start?.xM)??0,y:p(ft?.start?.yM)??0,z:p(ft?.start?.zM)??0}),P=q({x:p(ft?.end?.xM)??0,y:p(ft?.end?.yM)??0,z:p(ft?.end?.zM)??0});return`<line x1="${m(_t.x)}" y1="${m(_t.y)}"
          x2="${m(P.x)}" y2="${m(P.y)}" stroke="${Q}"
          stroke-width="2.4" data-select-mark="${$(ft?.mark||bt)}"/>`}).join(""),"renderBarLines"),Bt=e(a,["renderModel"],{}),Dt=e(Bt,["barsA"],e(o,["A.planCenterlines"],[])),ht=e(Bt,["barsB"],e(o,["B.planCenterlines"],[])),K=e(Bt,["punchingRect"],null),dt=K?M([{x:K.x,y:K.y,z:A+.005},{x:K.x+K.width,y:K.y,z:A+.005},{x:K.x+K.width,y:K.y+K.height,z:A+.005},{x:K.x,y:K.y+K.height,z:A+.005}]):"";return`<svg class="sf-bearing-isometric ${s}-bearing-isometric" viewBox="0 0 720 380"
    role="img" aria-label="ภาพไอโซเมตริกฐานรากและสนามแรงดันดินจากชุดผลคำนวณ"
    data-diagram-model="bearing-pressure">
    <defs>
      <marker id="${s}-sf-pressure-arrow" viewBox="0 0 10 10" refX="5" refY="3"
        markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 10 5 0 10 10Z" fill="#2563eb"/>
      </marker>
    </defs>
    <rect width="720" height="380" fill="#f7fafc"/>
    <g data-model-layer="bearing">
      <polygon points="${M(V)}" fill="#f59e0b" fill-opacity=".18"
        stroke="#c2410c" stroke-width="2"/>
      <g stroke="#2563eb" stroke-width="2.4" marker-end="url(#${s}-sf-pressure-arrow)">
        ${pt}
      </g>
      <g class="sf-pressure-corner-labels">
        <text x="32" y="285"${z(i[0])}>q1 ${l(i[0],"kPa",2)}</text>
        <text x="32" y="307"${z(i[1])}>q2 ${l(i[1],"kPa",2)}</text>
        <text x="32" y="329"${z(i[2])}>q3 ${l(i[2],"kPa",2)}</text>
        <text x="32" y="351"${z(i[3])}>q4 ${l(i[3],"kPa",2)}</text>
      </g>
    </g>
    <g data-model-layer="concrete" stroke="#344b5e" stroke-width="2" stroke-linejoin="round">
      <polygon points="${M(D)}" fill="#e8eef4"/>
      <polygon points="${M(at)}" fill="#9cadba"/>
      <polygon points="${M(st)}" fill="#7e93a5"/>
      <polygon points="${M(mt)}" fill="#f7fafc" data-visual-symbolic-column="true"/>
      <polygon points="${M([Z[3],Z[2],mt[2],mt[3]])}" fill="#b7c5d0"/>
      <polygon points="${M([Z[1],Z[2],mt[2],mt[1]])}" fill="#879baa"/>
    </g>
    <g data-model-layer="barA">${At(Dt,it(ot(o,"A"),"BAR-A"),"#c2410c")}</g>
    <g data-model-layer="barB">${At(ht,it(ot(o,"B"),"BAR-B"),"#0f766e")}</g>
    ${dt?`<polygon points="${dt}" fill="none" stroke="#7c3aed" stroke-width="2"
          stroke-dasharray="7 5" data-model-layer="critical"
          data-punching-perimeter="${$(e(r,["perimeterM","criticalPerimeter","bo"],e(a,["criticalSections.punching.perimeterM"],"not-provided-on-surface")))}"/>`:""}
    <g class="sf-svg-dimension-guides" aria-hidden="true">
      <path d="M161 252V264M539 252V264M161 258H539"/>
      <path d="M145 106H157M145 236H157M151 106V236"/>
      <path d="M545 188H557M545 236H557M551 188V236"/>
    </g>
    <g class="sf-svg-dimension-labels"${Zt({"footing-a-m":g,"footing-b-m":x,"footing-t-m":b,"column-a-m":B,"column-b-m":y})}>
      <g data-dimension="footing-a">
        <rect x="286" y="247" width="128" height="23" rx="4"/>
        <text x="350" y="263" text-anchor="middle">A / X = ${l(g,"m",2)}</text>
      </g>
      <g data-dimension="footing-b">
        <rect x="22" y="158" width="112" height="23" rx="4"/>
        <text x="78" y="174" text-anchor="middle">B / Y = ${l(x,"m",2)}</text>
      </g>
      <g data-dimension="footing-t">
        <rect x="560" y="199" width="100" height="23" rx="4"/>
        <text x="610" y="215" text-anchor="middle">t = ${l(b,"m",2)}</text>
      </g>
      <g data-dimension="column-a-b">
        <path d="M${m(W.x)} ${m(W.y)}L432 53"/>
        <rect x="432" y="40" width="258" height="25" rx="4"/>
        <text x="561" y="57" text-anchor="middle">เสา a × b = ${l(B,"m",2)} × ${l(y,"m",2)}</text>
      </g>
    </g>
    <g class="sf-svg-callout"${Zt({"footing-b-m":g,"footing-l-m":x,"footing-h-m":b,"column-a-m":B,"column-b-m":y,"qmax-kpa":u,"qmin-kpa":h})}>
      <rect x="421" y="314" width="273" height="48" rx="5" fill="#fff" stroke="#cbd5df"/>
      <text x="434" y="333">qmax ${l(u,"kPa",2)}</text>
      <text x="434" y="352">qmin ${l(h,"kPa",2)}</text>
    </g>
  </svg>`},"renderBearingIsometric"),Vt=c(t=>{const a=p(e(t,["count","barCount","quantity"],0));return a===null?0:Math.max(0,Math.min(40,Math.trunc(a)))},"barCount"),fe=c((t,a,s,o=[],r=null)=>{const i=Vt(t);if(!i)return"";const{x:u,y:h,width:g,height:x}=s,b=it(t,a==="horizontal"?"A":"B"),S=r&&Array.isArray(o)&&o.length?o.map(A=>{const B=r(A?.start?.xM,A?.start?.yM),y=r(A?.end?.xM,A?.end?.yM);return!B||!y?"":`<line x1="${m(B.x)}" y1="${m(B.y)}"
              x2="${m(y.x)}" y2="${m(y.y)}"
              data-bar-id="${$(A?.id||"")}"/>`}).join(""):"",f=Array.from({length:i},(A,B)=>{const y=(B+1)/(i+1);if(a==="horizontal"){const w=h+x*y;return`<line x1="${m(u)}" y1="${m(w)}" x2="${m(u+g)}" y2="${m(w)}"/>`}const C=u+g*y;return`<line x1="${m(C)}" y1="${m(h)}" x2="${m(C)}" y2="${m(h+x)}"/>`}).join("");return`<g data-select-mark="${$(b)}" data-bar-count="${i}"
    data-model-layer="${a==="horizontal"?"barA":"barB"}">${S||f}</g>`},"renderPlanBars"),ts=c(t=>{const a=p(L(t,"footing","width")),s=p(L(t,"footing","length")),o=p(L(t,"column","width")),r=p(L(t,"column","length")),i=300,u=a&&s?Math.max(a,s):null,h=u?a/u*i:i,g=u?s/u*i:i,x=u?i/u:null,b=x&&o?Math.max(18,o*x):48,S=x&&r?Math.max(18,r*x):48;return{footing:{x:260-h/2,y:180-g/2,width:h,height:g},support:{x:260-b/2,y:180-S/2,width:b,height:S}}},"planViewLayout"),Lt=c((t,a=["spacingMm","spacing","spacingDisplay"])=>{const s=e(t,["nominalSpacingMm"],n);return p(s)===null?e(t,a,n):s},"printedSpacingValue"),Qt=c((t,a,s=22)=>String(t).length>s?` textLength="${$(a)}" lengthAdjust="spacingAndGlyphs"`:"","fittedSvgTextLength"),ue=c(t=>{const a=String(t).toUpperCase()==="B"?"B":"A";return Object.freeze(a==="A"?{direction:"A",axis:"X",axisSymbol:"↔",orientation:"แนวนอน",layer:"ชั้นล่างสุด",color:"#c2410c"}:{direction:"B",axis:"Y",axisSymbol:"↕",orientation:"แนวตั้ง",layer:"ชั้นเหนือ A",color:"#0f766e"})},"directionPresentation"),ma=c((t,a,s)=>{const o=ue(a),r=k(it(t,`BAR-${a}`)),i=k(e(t,["count","barCount","quantity"],n)),u=St(t),h=e(t,["spacingMm","spacing","spacingDisplay"],n),g=Lt(t),x=`${r} · ${o.direction}/${o.axis} ${o.axisSymbol}`,b=`${o.layer} · ${i}-${u} @ ${Y(g,"mm",1)}`;return`<g class="sf-plan-rebar-callout" data-plan-callout="${$(a)}"
    data-axis="${o.axis}" data-layer-order="${o.direction==="A"?"lowest":"above-a"}"
    data-mark="${$(r)}" data-count="${$(i)}"
    data-size="${$(u)}"${z(h,"data-spacing-mm")}
    data-callout-x="438" data-callout-y="${$(s)}"
    data-callout-width="168" data-callout-height="58">
    <title>${tt(`${x} · ${b}`)}</title>
    <rect x="438" y="${m(s)}" width="168" height="58" rx="5"
      fill="#fff" stroke="${a==="A"?"#e7a17f":"#86c8c0"}"/>
    <text x="448" y="${m(s+21)}"${Qt(x,148)}>
      ${tt(x)}</text>
    <text x="448" y="${m(s+43)}"${Qt(b,148,20)}>
      ${tt(b)}</text>
  </g>`},"renderPlanRebarCallout"),pa=c((t,a,s="แปลนฐานราก")=>{const o=ts(t);let r=o.footing,i=o.support;const u=ot(a,"A"),h=ot(a,"B"),g=e(t,["renderModel"],{}),x=e(g,["planBounds"],null),b=x&&Number.isFinite(Number(x.minX))&&Number.isFinite(Number(x.maxX))&&Number.isFinite(Number(x.minY))&&Number.isFinite(Number(x.maxY))&&Number(x.maxX)>Number(x.minX)&&Number(x.maxY)>Number(x.minY)?(B,y)=>!Number.isFinite(Number(B))||!Number.isFinite(Number(y))?null:{x:o.footing.x+(Number(B)-Number(x.minX))/(Number(x.maxX)-Number(x.minX))*o.footing.width,y:o.footing.y+(Number(x.maxY)-Number(y))/(Number(x.maxY)-Number(x.minY))*o.footing.height}:null,S=c((B,y)=>{if(!b||!B)return y;const C=b(B.x,Number(B.y)+Number(B.height)),w=b(Number(B.x)+Number(B.width),B.y);return!C||!w?y:{x:C.x,y:C.y,width:w.x-C.x,height:w.y-C.y}},"transformRect");r=S(e(g,["footingRect"],null),r),i=S(e(g,["columnRect"],null),i);const f=S(e(g,["punchingRect"],null),null),A=c((B,y)=>b?$t(B).map(C=>{const w=b(C?.x1,C?.y1),T=b(C?.x2,C?.y2);return!w||!T?"":`<line x1="${m(w.x)}" y1="${m(w.y)}"
              x2="${m(T.x)}" y2="${m(T.y)}"
              data-critical-direction="${$(y)}"/>`}).join(""):"","renderCriticalLines");return`<svg class="sf-plan-svg" viewBox="0 0 620 390" role="img"
    aria-label="${$(s)}" data-drawing-role="plan" data-scale="NTS"
    data-responsive-svg="viewbox">
    <rect width="620" height="390" fill="#fbfcfd"/>
    <rect x="${m(r.x)}" y="${m(r.y)}"
      width="${m(r.width)}" height="${m(r.height)}"
      fill="#f7fafc" stroke="#27384d" stroke-width="2.4"/>
    <g stroke="#c2410c" stroke-width="1.8">
      ${fe(u,"horizontal",r,e(g,["barsA"],e(u,["planCenterlines"],[])),b)}
    </g>
    <g stroke="#0f766e" stroke-width="1.8">
      ${fe(h,"vertical",r,e(g,["barsB"],e(h,["planCenterlines"],[])),b)}
    </g>
    ${f?`<rect x="${m(f.x)}" y="${m(f.y)}"
          width="${m(f.width)}" height="${m(f.height)}"
          fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="7 5"
          data-model-layer="critical"/>`:""}
    <g stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4" data-critical-sections="one-way">
      ${A(e(g,["oneWayLines.A"],[]),"A")}
      ${A(e(g,["oneWayLines.B"],[]),"B")}
    </g>
    <rect x="${m(i.x)}" y="${m(i.y)}"
      width="${m(i.width)}" height="${m(i.height)}"
      fill="#e7edf3" stroke="#27384d" stroke-width="2"/>
    <path d="M260 12V348M72 180H448" stroke="#8796a6" stroke-dasharray="7 4 2 4"/>
    <g class="sf-section-cut-line" data-section-cut="X-X" data-section-direction="A">
      <path d="M72 194H448" fill="none" stroke="#243b5a" stroke-width="2"
        stroke-dasharray="10 4"/>
      <path d="M72 194L88 186V202ZM448 194L432 186V202Z" fill="#243b5a"/>
      <text x="56" y="200" text-anchor="middle" fill="#243b5a" font-weight="700">X</text>
      <text x="464" y="200" text-anchor="middle" fill="#243b5a" font-weight="700">X</text>
      <text x="260" y="214" text-anchor="middle" fill="#243b5a" font-weight="700">
        รูปตัด X-X · ทิศ A</text>
    </g>
    <text x="606" y="20" text-anchor="end" class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</text>
    ${ma(u,"A",42)}
    ${ma(h,"B",108)}
    <g class="sf-plan-labels">
      <text x="84" y="372"${Zt({"footing-b-m":L(t,"footing","width"),"footing-l-m":L(t,"footing","length")})}>ฐาน ${l(L(t,"footing","width"),"m",2)} × ${l(L(t,"footing","length"),"m",2)}</text>
      <text x="350" y="372"${Zt({"column-b-m":L(t,"column","width"),"column-l-m":L(t,"column","length")})}>เสา ${l(L(t,"column","width"),"m",2)} × ${l(L(t,"column","length"),"m",2)}</text>
    </g>
  </svg>`},"renderPlanSvg"),Re=c((t,a,s="รูปตัดฐานราก",o={})=>{const r=o.includeBarCutReference!==!1,i=ot(a,"A"),u=ot(a,"B"),h=Vt(u),g=e(t,["renderModel"],{}),x=e(g,["sectionBoundsMm"],{}),b=p(e(x,["widthX"],null))??(p(L(t,"footing","width"))??1)*1e3,S=p(e(x,["height"],null))??(p(L(t,"footing","thickness"))??.3)*1e3,f=c(ht=>82+(p(ht)??0)/b*376,"sectionX"),A=c(ht=>258-(p(ht)??0)/S*126,"sectionY"),B=376/b,y=Kt(i)*B,C=Kt(u)*B/2,w=A(S),T=oe($t(e(g,["barCutA"],[])).map(ht=>[f(ht?.xMm),A(ht?.zMm)])),I=e(i,["effectiveDepthMm","effectiveDepth","d","depth"],n),q=e(u,["effectiveDepthMm","effectiveDepth","d","depth"],n),M=p(e(i,["centerElevationMm"],null))??(p(I)===null?null:S-p(I)),v=p(e(u,["centerElevationMm"],null))??(p(q)===null?null:S-p(q)),N=M===null?237:A(M),D=v===null?233:A(v),at=e(g,["planBounds"],{}),st=p(e(at,["minX"],null)),H=p(e(at,["maxX"],null)),V=st!==null&&H!==null&&H>st?ht=>{const K=p(ht);return K===null?null:82+(K-st)/(H-st)*376}:null,U=$t(e(g,["barsB"],e(u,["planCenterlines"],[]))),j=V?U.map((ht,K)=>{const dt=e(ht,["start.xM","end.xM"],null),X=e(ht,["start.zM","end.zM"],null),bt=V(dt),Q=p(X)===null?v:p(X)*1e3;return bt===null||Q===null?"":`<circle cx="${m(bt)}" cy="${m(A(Q))}"
            r="${m(C)}"
            data-bar-id="${$(e(ht,["id"],`${it(u,"BAR-B")}-${K+1}`))}" data-center-x-m="${$(dt)}"
            data-center-z-mm="${$(Q)}"
            data-bar-diameter-mm="${m(Kt(u))}"
            data-svg-radius="${m(C)}"/>`}).join(""):"",F=Array.from({length:h},(ht,K)=>{const dt=h>1?111+318*K/(h-1):270;return`<circle cx="${m(dt)}" cy="${m(D)}"
      r="${m(C)}" data-bar-diameter-mm="${m(Kt(u))}" data-svg-radius="${m(C)}"/>`}).join(""),W=j||F,Z=e(i,["spacingMm","spacing","spacingDisplay"],n),mt=e(u,["spacingMm","spacing","spacingDisplay"],n),Ct=Lt(i),pt=Lt(u),At=e(t,["footing.coverM","cover","clearCover","reinforcementCover"],n),Bt=p(At),Dt=Bt===null?n:Bt<=2?Bt*1e3:Bt;return`<svg class="sf-section-svg" viewBox="0 0 620 360" role="img"
    aria-label="${$(s)}" data-drawing-role="section" data-scale="NTS"
    data-responsive-svg="viewbox">
    <rect width="620" height="360" fill="#fbfcfd"/>
    <text x="590" y="20" text-anchor="end" class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</text>
    <path d="M30 98H235M305 98H590" stroke="#8495a7" stroke-width="1.5"/>
    <rect x="235" y="20" width="70" height="112" fill="#eef3f7" stroke="#334155" stroke-width="2.2"/>
    <rect x="82" y="132" width="376" height="126" fill="#f8fafc" stroke="#334155" stroke-width="2.4"
      data-model-layer="concrete"/>
    ${T?`<polyline points="${$(T)}" fill="none" stroke="#c2410c"
          stroke-width="${m(y)}" stroke-linecap="butt"
          stroke-linejoin="round" data-cut-end="butt"
          data-bar-diameter-mm="${m(Kt(i))}"
          data-svg-stroke-width="${m(y)}"
          data-select-mark="${$(it(i,"BAR-A"))}" data-model-layer="barA"${z(M,"data-center-z-mm")}/>`:`<path d="M102 155V${m(N-23)}Q102 ${m(N)} 122 ${m(N)}H418Q438 ${m(N)} 438 ${m(N-23)}V155"
          fill="none" stroke="#c2410c" stroke-width="${m(y)}" stroke-linecap="butt" stroke-linejoin="round" data-cut-end="butt"
          data-bar-diameter-mm="${m(Kt(i))}"
          data-svg-stroke-width="${m(y)}"
          data-select-mark="${$(it(i,"BAR-A"))}" data-model-layer="barA"${z(M,"data-center-z-mm")}/>`}
    <g fill="#0f766e" stroke="#f8fafc" stroke-width="1"
      data-select-mark="${$(it(u,"BAR-B"))}"
      data-model-layer="barB" data-bar-count="${h}"
      ${z(mt,"data-spacing-mm").trim()}>${W}</g>
    <g class="sf-section-dimensions">
      <path d="M482 ${m(w)}V${m(N)}
        M475 ${m(w)}H489M475 ${m(N)}H489"
        stroke="#c2410c" data-dimension="dA"${z(S,"data-from-z-mm")}${z(M,"data-to-z-mm")}
        data-svg-y1="${m(w)}" data-svg-y2="${m(N)}"/>
      <text x="500" y="${m((w+N)/2)}"
        transform="rotate(-90 500 ${m((w+N)/2)})"
        text-anchor="middle">dA ${l(I,"mm",1)}</text>
      <path d="M532 ${m(w)}V${m(D)}
        M525 ${m(w)}H539M525 ${m(D)}H539"
        stroke="#0f766e" data-dimension="dB"${z(S,"data-from-z-mm")}${z(v,"data-to-z-mm")}
        data-svg-y1="${m(w)}" data-svg-y2="${m(D)}"/>
      <text x="550" y="${m((w+D)/2)}"
        transform="rotate(-90 550 ${m((w+D)/2)})"
        text-anchor="middle">dB ${l(q,"mm",1)}</text>
    </g>
    <g class="sf-section-labels">
      <text x="88" y="286" fill="#c2410c" data-section-direction="A" data-axis="X"
        ${Qt(`${k(it(i,"BAR-A"))} · A/X ↔ · ชั้นล่างสุด · ${k(e(i,["count","barCount"],n))}-${St(i)} @ ${Y(Ct,"mm",1)}`,360,44)}>
        ${d(it(i,"BAR-A"))} · A/X ↔ · ชั้นล่างสุด ·
        ${d(e(i,["count","barCount"],n))}-${d(St(i))}
        @ ${l(Ct,"mm",1)}</text>
      <text x="88" y="318" fill="#0f766e" data-section-direction="B" data-axis="Y"
        ${Qt(`${k(it(u,"BAR-B"))} · B/Y ↕ · ชั้นเหนือ A · ${k(e(u,["count","barCount"],n))}-${St(u)} @ ${Y(pt,"mm",1)}`,360,44)}>
        ${d(it(u,"BAR-B"))} · B/Y ↕ · ชั้นเหนือ A ·
        ${d(e(u,["count","barCount"],n))}-${d(St(u))}
        @ ${l(pt,"mm",1)}</text>
      <text x="88" y="344"${z(At,"data-exact-cover")}${Dt===n?"":z(Dt,"data-cover-mm")}>ระยะหุ้ม ${l(Dt,"mm",0)}${r?" · รูปดัดต้องตรวจจากชุดข้อมูล Bar Cut":""}</text>
    </g>
  </svg>`},"renderSectionSvg"),es=c((t,a,s="แปลนฐานรากในรายงาน A4")=>{const o=ot(a,"A"),r=ot(a,"B"),i=e(t,["renderModel"],{}),u=e(i,["planBounds"],null),h=p(L(t,"footing","width"))??1,g=p(L(t,"footing","length"))??1,x=Math.max(h,g,.001),b={width:h/x*172,height:g/x*172};b.x=16+(172-b.width)/2,b.y=10+(172-b.height)/2;const S=u&&Number.isFinite(Number(u.minX))&&Number.isFinite(Number(u.maxX))&&Number.isFinite(Number(u.minY))&&Number.isFinite(Number(u.maxY))&&Number(u.maxX)>Number(u.minX)&&Number(u.maxY)>Number(u.minY)?(M,v)=>!Number.isFinite(Number(M))||!Number.isFinite(Number(v))?null:{x:b.x+(Number(M)-Number(u.minX))/(Number(u.maxX)-Number(u.minX))*b.width,y:b.y+(Number(u.maxY)-Number(v))/(Number(u.maxY)-Number(u.minY))*b.height}:null,f=c((M,v)=>{if(!S||!M)return v;const N=S(M.x,Number(M.y)+Number(M.height)),D=S(Number(M.x)+Number(M.width),M.y);return!N||!D?v:{x:N.x,y:N.y,width:D.x-N.x,height:D.y-N.y}},"transformRect"),A=p(L(t,"column","width"))??.25,B=p(L(t,"column","length"))??.25,y={width:A/h*b.width,height:B/g*b.height};y.x=b.x+(b.width-y.width)/2,y.y=b.y+(b.height-y.height)/2;const C=f(e(i,["columnRect"],null),y),w=f(e(i,["punchingRect"],null),null),T=c((M,v)=>$t(e(i,[v==="A"?"barsA":"barsB"],e(M,["planCenterlines"],[]))),"barCenterlines"),I=c((M,v)=>{const N=T(M,v).map(H=>{if(!S)return null;const V=S(H?.start?.xM,H?.start?.yM),U=S(H?.end?.xM,H?.end?.yM);return V&&U?{start:V,end:U}:null}).filter(Boolean);if(N.length){const H=v==="A"?b.y+b.height*.22:b.x+b.width*.82,V=[...N].sort((U,j)=>{const F=v==="A"?(U.start.y+U.end.y)/2:(U.start.x+U.end.x)/2,W=v==="A"?(j.start.y+j.end.y)/2:(j.start.x+j.end.x)/2;return Math.abs(F-H)-Math.abs(W-H)})[0];return v==="A"?{x:V.start.x+(V.end.x-V.start.x)*.88,y:(V.start.y+V.end.y)/2}:{x:(V.start.x+V.end.x)/2,y:V.start.y+(V.end.y-V.start.y)*.72}}const D=Math.max(1,Vt(M)),st=((v==="A"?Math.min(1,D-1):Math.max(0,D-2))+1)/(D+1);return v==="A"?{x:b.x+b.width*.88,y:b.y+b.height*st}:{x:b.x+b.width*st,y:b.y+b.height*.72}},"barTarget"),q=c((M,v,N,D)=>{const at=v==="A"?"X":"Y",st=v==="A"?"↔":"↕",H=v==="A"?"ชั้นล่างสุด":"ชั้นเหนือ A",V=`${k(it(M,`BAR-${v}`))} · ${v}/${at} ${st} · ${H}`,U=`${Vt(M)}-${St(M)} @ ${Y(Lt(M),"mm",1)}`,j=I(M,v);return`<g class="a4-compact-callout a4-compact-callout--leader"
      data-plan-callout="${v}" data-axis="${at}"
      data-layer-order="${v==="A"?"lowest":"above-a"}">
      <path d="M216 ${m(N+18)}H202L${m(j.x)} ${m(j.y)}" fill="none" stroke="${D}" stroke-width="2"
        marker-end="url(#a4-plan-bar-arrow-${v.toLowerCase()})"
        data-callout-leader="${v}" data-leader-target="bar${v}"
        data-target-x="${m(j.x)}" data-target-y="${m(j.y)}"/>
      <circle cx="216" cy="${m(N+18)}" r="2.8" fill="${D}"/>
      <text x="224" y="${m(N+12)}" fill="${D}"${Qt(V,180,20)}>${tt(V)}</text>
      <text x="224" y="${m(N+42)}"${Qt(U,180,13)}>${tt(U)}</text>
    </g>`},"callout");return`<svg class="sf-plan-svg a4-compact-diagram" viewBox="0 0 420 220"
    role="img" aria-label="${$(s)}" data-drawing-role="plan"
    data-scale="NTS" data-responsive-svg="viewbox" data-a4-compact-drawing="plan">
    <rect width="420" height="220" fill="#fbfcfd"/>
    <defs>
      <marker id="a4-plan-bar-arrow-a" viewBox="0 0 8 8" refX="7" refY="4"
        markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="#c2410c"/>
      </marker>
      <marker id="a4-plan-bar-arrow-b" viewBox="0 0 8 8" refX="7" refY="4"
        markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="#0f766e"/>
      </marker>
    </defs>
    <rect x="${m(b.x)}" y="${m(b.y)}"
      width="${m(b.width)}" height="${m(b.height)}"
      fill="#f7fafc" stroke="#27384d" stroke-width="2.4" data-model-layer="concrete"/>
    <g stroke="#c2410c" stroke-width="1.8" data-model-layer="barA">
      ${fe(o,"horizontal",b,e(i,["barsA"],e(o,["planCenterlines"],[])),S)}
    </g>
    <g stroke="#0f766e" stroke-width="1.8" data-model-layer="barB">
      ${fe(r,"vertical",b,e(i,["barsB"],e(r,["planCenterlines"],[])),S)}
    </g>
    ${w?`<rect x="${m(w.x)}" y="${m(w.y)}"
          width="${m(w.width)}" height="${m(w.height)}"
          fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="6 4"
          data-model-layer="critical"/>`:""}
    <rect x="${m(C.x)}" y="${m(C.y)}"
      width="${m(C.width)}" height="${m(C.height)}"
      fill="#e7edf3" stroke="#27384d" stroke-width="2.2"/>
    <path d="M${m(b.x-5)} ${m(b.y+b.height/2)}
      H${m(b.x+b.width+5)}" fill="none" stroke="#243b5a"
      stroke-width="1.8" stroke-dasharray="8 4" data-section-cut="X-X"/>
    <text x="${m(b.x-9)}" y="${m(b.y+b.height/2+7)}" text-anchor="end" data-section-tag="X-left">X</text>
    <text x="${m(b.x+b.width+9)}" y="${m(b.y+b.height/2+7)}" data-section-tag="X-right">X</text>
    <text x="${m(b.x+b.width/2)}" y="207" text-anchor="middle"
      ${Zt({"footing-b-m":h,"footing-l-m":g})}>ฐาน ${O(h,2)} × ${O(g,2)} m</text>
    ${q(o,"A",28,"#c2410c")}
    ${q(r,"B",122,"#0f766e")}
    <text x="404" y="207" text-anchor="end">NTS</text>
  </svg>`},"renderA4PlanSvg"),as=c((t,a,s="รูปตัดฐานรากในรายงาน A4")=>{const o=ot(a,"A"),r=ot(a,"B"),i=e(t,["renderModel"],{}),u=p(e(i,["sectionBoundsMm.widthX"],null))??(p(L(t,"footing","width"))??1)*1e3,h=p(e(i,["sectionBoundsMm.height"],null))??(p(L(t,"footing","thickness"))??.3)*1e3,g=(p(L(t,"column","width"))??.25)*1e3,x=e(t,["footing.coverM","cover","clearCover","reinforcementCover"],n),b=p(x),S=b===null?n:b<=2?b*1e3:b,f={x:18,y:58,width:262,height:92},A=c(F=>f.x+(p(F)??0)/u*f.width,"sectionX"),B=c(F=>f.y+f.height-(p(F)??0)/h*f.height,"sectionY"),y=e(o,["effectiveDepthMm","effectiveDepth","d","depth"],n),C=e(r,["effectiveDepthMm","effectiveDepth","d","depth"],n),w=p(e(o,["centerElevationMm"],null))??(p(y)===null?50:h-p(y)),T=p(e(r,["centerElevationMm"],null))??(p(C)===null?70:h-p(C)),I=oe($t(e(i,["barCutA"],[])).map(F=>[A(F?.xMm),B(F?.zMm)])),q=Math.max(2.5,Kt(o)*(f.width/u)),M=Math.max(2.1,Kt(r)*(f.width/u)/2),v=e(i,["planBounds"],{}),N=p(e(v,["minX"],null)),D=p(e(v,["maxX"],null)),at=N!==null&&D!==null&&D>N?F=>{const W=p(F);return W===null?null:f.x+(W-N)/(D-N)*f.width}:null,st=$t(e(i,["barsB"],e(r,["planCenterlines"],[]))),H=at?st.map((F,W)=>{const Z=e(F,["start.xM","end.xM"],null),mt=e(F,["start.zM","end.zM"],null),Ct=at(Z),pt=p(mt)===null?T:p(mt)*1e3;return Ct===null?"":`<circle cx="${m(Ct)}" cy="${m(B(pt))}"
              r="${m(M)}" data-bar-id="${$(e(F,["id"],`${it(r,"BAR-B")}-${W+1}`))}"/>`}).join(""):Array.from({length:Vt(r)},(F,W)=>{const Z=Vt(r)>1?f.x+18+(f.width-36)*W/(Vt(r)-1):f.x+f.width/2;return`<circle cx="${m(Z)}" cy="${m(B(T))}"
          r="${m(M)}"/>`}).join(""),V=g/u*f.width,U=f.x+(f.width-V)/2,j=c((F,W,Z,mt,Ct)=>{const pt=ue(W),At=`${k(it(F,`BAR-${W}`))} · ${pt.direction}/${pt.axis} ${pt.axisSymbol} · ${pt.layer} ·
      ${Vt(F)}-${St(F)} @ ${Y(Lt(F),"mm",1)}`;return`<text x="${m(Z)}" y="${m(mt)}" fill="${Ct}"
      data-section-callout="${W}" data-axis="${pt.axis}"
      data-layer-order="${pt.direction==="A"?"lowest":"above-a"}"
      ${Qt(At,187,28)}>${tt(At)}</text>`},"rebarCallout");return`<svg class="sf-section-svg a4-compact-diagram" viewBox="0 0 420 220"
    role="img" aria-label="${$(s)}" data-drawing-role="section"
    data-scale="NTS" data-responsive-svg="viewbox" data-a4-compact-drawing="section">
    <rect width="420" height="220" fill="#fbfcfd"/>
    <path d="M8 58H${m(U)}M${m(U+V)} 58H410" stroke="#8495a7" stroke-width="1.5"/>
    <rect x="${m(U)}" y="8" width="${m(V)}" height="50"
      fill="#eef3f7" stroke="#334155" stroke-width="2.2"/>
    <rect x="${f.x}" y="${f.y}" width="${f.width}"
      height="${f.height}" fill="#f8fafc" stroke="#334155" stroke-width="2.4"
      data-model-layer="concrete"/>
    ${I?`<polyline points="${$(I)}" fill="none" stroke="#c2410c"
          stroke-width="${m(q)}" stroke-linecap="butt"
          stroke-linejoin="round" data-model-layer="barA" data-cut-end="butt"/>`:`<path d="M${m(A(S))} ${m(B(h-S))}V${m(B(w))}H${m(A(u-S))}V${m(B(h-S))}"
          fill="none" stroke="#c2410c" stroke-width="${m(q)}"
          stroke-linecap="butt" stroke-linejoin="round" data-model-layer="barA"
          data-cut-end="butt"/>`}
    <g fill="#0f766e" stroke="#f8fafc" stroke-width="0.8" data-model-layer="barB"
      data-bar-count="${Vt(r)}">${H}</g>
    <g class="a4-compact-dimensions"
      aria-label="t ${O(h,0)} mm; dA ${O(y,0)} mm; dB ${O(C,0)} mm; ระยะหุ้ม ${O(S,0)} mm">
      <path d="M292 58V150M286 58H298M286 150H298" stroke="#334155"/>
      <rect x="296" y="46" width="118" height="132" rx="4"
        fill="#fbfcfd" stroke="#d8e0e8" data-dimension-rail="section"/>
      <path d="M345 50V174" stroke="#d8e0e8"/>
      <text x="302" y="68" data-section-dimension="thickness">t =</text>
      <text x="408" y="68" text-anchor="end" data-section-dimension-value="thickness"
        ${z(h,"data-thickness-mm")}>${O(h,0)} mm</text>
      <text x="302" y="100" fill="#c2410c" data-section-dimension="dA">dA =</text>
      <text x="408" y="100" text-anchor="end" fill="#c2410c"
        data-section-dimension-value="dA"${z(y,"data-depth-mm")}>
        ${O(y,0)} mm</text>
      <text x="302" y="132" fill="#0f766e" data-section-dimension="dB">dB =</text>
      <text x="408" y="132" text-anchor="end" fill="#0f766e"
        data-section-dimension-value="dB"${z(C,"data-depth-mm")}>
        ${O(C,0)} mm</text>
      <text x="302" y="164" data-section-dimension="cover"
        ${Qt("ระยะหุ้ม",36,0)}>ระยะหุ้ม</text>
      <text x="408" y="164" text-anchor="end" data-section-dimension-value="cover"
        ${z(S,"data-cover-mm")}>${O(S,0)} mm</text>
    </g>
    ${j(o,"A",18,210,"#c2410c")}
    ${j(r,"B",215,210,"#0f766e")}
    <text x="404" y="32" text-anchor="end">NTS</text>
  </svg>`},"renderA4SectionSvg"),ha=c(t=>{if(Array.isArray(t))return t.map((o,r)=>({direction:e(o,["direction","axis","label"],`ทิศ ${r+1}`),model:o}));if(!t||typeof t!="object")return[];const a=e(t,["directions","models","strips"],null);if(a)return ha(a);const s=[];for(const o of["A","B"]){const r=e(t,[o,o.toLowerCase()],null);r&&s.push({direction:o,model:r})}return s.length?s:[{direction:e(t,["direction","axis"],"A / B"),model:t}]},"diagramDirections"),ba=c((t,a,s={})=>{const r=e(t.model,[a,`${a}Diagram`,`${a}Model`],null)||t.model||{},i=$t(e(t.model,["stations"],e(r,["stations"],[]))),u=a==="moment"?"momentKNmPerM":"shearKNPerM",h=i.map(F=>p(e(F,[u],null))).filter(F=>F!==null),g=h.length?h.reduce((F,W)=>Math.max(F,Math.abs(W)),0):null,x=i.length&&g!==null?i.map((F,W)=>{const Z=p(e(F,["ratio"],null))??(i.length>1?W/(i.length-1):0),mt=p(e(F,[u],0))??0;return{x:62+406*(1-Math.max(0,Math.min(1,Z))),y:g>0?112-Math.abs(mt)/g*78:112}}).sort((F,W)=>F.x-W.x):[],b=oe(x),S=b||oe(e(r,["svgPoints","points","renderPoints"],"")),f=e(r,["maximum","max","peak","demand","value","governingValue"],g??n),A=e(r,["unit","canonicalUnits"],e(t.model,[`units.${a}`],a==="moment"?"kN.m/m":"kN/m")),y=Pt(e(t.model,["status"],b?"EVALUATED":"HOLD"))==="EVALUATED"&&!!b,C=a==="moment"?"ขนาดโมเมนต์ดัด":"แรงเฉือนทางเดียว",w=e(t.model,["cantileverM","cantilever","projectionM"],n),T=e(t.model,["criticalDistanceFromColumnFaceM","criticalDistanceM","effectiveDepthM"],n),I=p(w),q=p(T),M=I!==null&&I>0&&q!==null?Math.max(0,Math.min(1,q/I)):null,v=a==="moment"?62:M===null?265:62+406*M,N=a==="moment"?f:e(s,["criticalValue","designValue"],n),D=p(N),at=g!==null&&g>0&&D!==null?112-Math.max(0,Math.min(1,Math.abs(D)/g))*78:a==="moment"?34:73,st=a==="moment"?"chart-result--moment":"chart-result--shear",H=a==="moment"?"#c2410c":"#0f766e",V=a==="shear"&&D!==null?N:f,U=a==="moment"?`|Mu| @ x=0 = ${y?Y(V,A,3):G}`:`Vu @ x=d = ${y?Y(V,A,3):G} · Vmax @ x=0 = ${y?Y(f,A,3):G}`,j=a==="moment"?`|M(x)| [${k(A)}]`:`V(x) [${k(A)}]`;return`<figure class="sf-analysis-diagram evidence-panel chart-panel" data-diagram="${a}"
    data-direction="${$(t.direction)}"
    ${a==="moment"?'data-moment-sign="magnitude-only"':""}
    data-evaluation="${y?"evaluated":"not-evaluated"}"${y?z(f):""}>
    <figcaption class="chart-heading"><span>${a==="moment"?"BMD · |M(x)|":"SFD · V(x)"} ทิศ ${d(t.direction)}</span><b>${d(U)}</b></figcaption>
    <svg class="engineering-chart" viewBox="0 0 520 138" role="img"
      data-axis-x="distance-from-column-face" data-axis-y="${$(a)}"
      data-critical-station="${a==="moment"?"column-face":"effective-depth"}"
      aria-label="${$(`${C} ทิศ ${k(t.direction)} กราฟแสดงเฉพาะขนาดสัมบูรณ์ แกนระยะ x จากหน้าเสาถึงขอบฐาน ${a==="moment"?"โมเมนต์วิกฤตที่หน้าเสา x เท่ากับศูนย์":"แรงเฉือนออกแบบที่หน้าตัดวิกฤต x เท่ากับ d"} และค่าลดเป็นศูนย์ที่ขอบฐาน`)}">
      <rect x="62" y="22" width="406" height="90" rx="2" class="chart-plot"/>
      <path d="M62 52H468M62 82H468M164 22V112M265 22V112M367 22V112"
        class="chart-gridline"/>
      ${y&&S?`<polyline points="${$(S)}" fill="none"
              stroke="${H}" stroke-width="3.5" class="chart-result ${st}"/>`:""}
      <path d="M62 116V18M57 27L62 18L67 27M58 112H478M469 107L478 112L469 117"
        class="chart-axis"/>
      ${y&&a==="shear"?`<path d="M${m(v)} 22V116" class="chart-critical"/>
            <circle cx="${m(v)}" cy="${m(at)}" r="4.5"
              class="chart-critical-point chart-critical-point--shear"/>
            <text x="${m(v)}" y="130" text-anchor="middle"
              class="chart-tick-label">d=${l(T,"m",3)}</text>`:y?`<circle cx="62" cy="${m(at)}" r="4.5"
              class="chart-critical-point chart-critical-point--moment"/>`:""}
      ${y?"":`<text x="265" y="72" text-anchor="middle"
              class="chart-empty-label">${G} · ไม่มีเส้นผลจาก Snapshot</text>`}
      <text transform="translate(17 68) rotate(-90)" text-anchor="middle"
        class="chart-axis-title">${d(j)}</text>
      <text x="486" y="104" class="chart-axis-title">x [m]</text>
      <text x="62" y="130" text-anchor="start" class="chart-tick-label">0 · หน้าเสา</text>
      <text x="468" y="130" text-anchor="end" class="chart-tick-label">L=${l(w,"m",3)} · ขอบฐาน</text>
    </svg>
  </figure>`},"renderSingleDiagram"),ss=c((t,a={})=>{const s=e(t,["loads"],{}),o=e(s,["factored.columnReactionKN","factoredColumn","puColumn","PuColumn"],n),r=e(s,["factored.netPressureKPa","quNet","netFactoredPressure"],n),i=sa(a.forceUnit),u=za(o,i),h=l(r,"kPa",2);return`<article class="evidence-panel deflection-panel sf-symbolic-settlement sf-symbolic-behavior is-review"
    data-check-topic="settlement" data-evaluation="not-evaluated"
    data-visualization-scope="symbolic-only">
    <div class="panel-title deflection-panel-title"><div>
      <span>CONCEPTUAL LOAD PATH · ภาพอธิบายพฤติกรรม</span>
      <h3>แรงกดจากเสา → ฐานราก → แรงปฏิกิริยาดิน</h3></div>
      <span class="reference-badge">${G} · ไม่ใช่ผลทรุดตัว</span></div>
    <div class="deflection-scope-note" id="sfSymbolicScopeNote" role="note"
      data-visualization-scope="symbolic-only">
      <span class="deflection-scope-mark" aria-hidden="true">NTS</span>
      <div><strong>ภาพนี้ใช้สื่อเส้นทางแรงเท่านั้น</strong>
        <span>รูปทรงถูกขยายเพื่อให้อ่านง่าย ไม่มีค่าการกระจัด ไม่มีแบบจำลองดิน และไม่ใช่ FEA contour</span></div>
    </div>
    <div class="deflection-fact-strip" aria-label="ค่าจากชุดผลคำนวณและขอบเขตการประเมิน">
      <div class="deflection-fact deflection-fact--load">
        <span>แรงกดออกแบบจากเสา</span>
        <strong>P<sub>u</sub> <b data-symbolic-pu-value
          data-force-kn="${$(String(p(o)??""))}"
          data-force-display-unit="${i}">${u}</b></strong>
        <small>ค่าจริงจากชุดผลคำนวณ</small>
      </div>
      <div class="deflection-fact deflection-fact--reaction">
        <span>แรงดันดินสุทธิออกแบบ</span>
        <strong>q<sub>net</sub> <b>${h}</b></strong>
        <small>ใช้เป็นป้ายกำกับ ไม่กำหนดรูปทรงในภาพ</small>
      </div>
      <div class="deflection-fact deflection-fact--scope">
        <span>ขอบเขตการประเมิน</span>
        <strong>${G}</strong>
        <small>Settlement / displacement / soil stiffness</small>
      </div>
    </div>
    <div class="symbolic-response-shell" data-visualization-scope="symbolic-only">
      <div class="symbolic-response-toolbar">
        <div>
          <span>3D SYMBOLIC RESPONSE · NTS</span>
          <strong>หมุนดูเส้นทางแรง · สีระหว่างเล่นเป็นจุดเน้นเชิงภาพ ไม่ใช่ผลวิกฤต</strong>
        </div>
        <button class="symbolic-response-replay" type="button"
          data-symbolic-3d-replay disabled aria-describedby="sfSymbolic3dStatus">
          <span aria-hidden="true">↻</span> เล่นภาพตอบสนองอีกครั้ง
        </button>
      </div>
      <div class="symbolic-response-stage" data-symbolic-3d-stage
        data-visualization-scope="symbolic-only" data-response-kind="conceptual-load-path"
        aria-busy="false">
        <div class="symbolic-response-badges" aria-hidden="true">
          <span>NTS</span><span>NO Δ RESULT</span><span>VISUAL COLOR ≠ CRITICAL</span>
        </div>
        <div class="symbolic-response-fallback" data-snapshot-3d-fallback>
          <p class="diagram-scroll-hint">ภาพสำรอง 2D · เลื่อนดูได้ · ไม่มีสเกลการกระจัด</p>
          <div class="deflection-diagram-scroll" tabindex="0" role="region"
            aria-label="ภาพอธิบายเส้นทางแรงของฐานรากเชิงสัญลักษณ์ เลื่อนแนวนอนได้">
      <svg class="deflection-diagram" data-engineering-evidence="symbolic-deflection"
        viewBox="0 0 920 430" role="img" data-force-display-unit="${i}"
        aria-labelledby="sfSymbolicDiagramTitle sfSymbolicDiagramDesc"
        aria-describedby="sfSymbolicScopeNote">
        <title id="sfSymbolicDiagramTitle">เส้นทางแรงของฐานรากแผ่เชิงสัญลักษณ์</title>
        <desc id="sfSymbolicDiagramDesc">แรงกดจากเสาถ่ายผ่านฐานรากไปยังแรงปฏิกิริยาดิน รูปทรงไม่ใช่ผลวิเคราะห์การทรุดตัวหรือค่าการกระจัด</desc>
        <defs>
          <marker id="sfSymbolicArrowDown" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10Z" fill="#c92a2a"/>
          </marker>
          <marker id="sfSymbolicArrowUp" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10Z" fill="#2563a8"/>
          </marker>
          <pattern id="sfSymbolicGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" class="deflection-grid-line"/>
          </pattern>
        </defs>
        <rect x="1" y="1" width="918" height="428" rx="8" class="deflection-canvas"/>
        <rect x="18" y="18" width="884" height="394" rx="6" fill="url(#sfSymbolicGrid)"/>
        <g class="deflection-kicker" transform="translate(34 30)">
          <rect width="162" height="28" rx="3"/>
          <text x="12" y="19">SYMBOLIC RESPONSE · NTS</text>
        </g>
        <text x="886" y="49" text-anchor="end" class="deflection-note">ไม่ใช่ displacement contour</text>
        <path class="deflection-reference" d="M170 154H750V246H170Z"/>
        <text x="48" y="145" class="deflection-reference-label">แนวอ้างอิงก่อนรับแรง</text>
        <path d="M48 154H160" class="deflection-reference-leader"/>
        <path class="deflection-column" d="M410 76H510V226H410Z"/>
        <path class="deflection-column-cap" d="M398 226H522V244H398Z"/>
        <path class="deflection-shape-fill"
          d="M170 154C282 194 360 221 460 226C560 221 638 194 750 154L750 246C638 292 560 326 460 331C360 326 282 292 170 246Z"/>
        <g class="deflection-ordinates">
          <path d="M170 154V246" class="deflection-band"/>
          <path d="M206 167V262" class="deflection-band"/>
          <path d="M242 180V278" class="deflection-band"/>
          <path d="M278 192V292" class="deflection-band"/>
          <path d="M314 204V305" class="deflection-band"/>
          <path d="M350 214V315" class="deflection-band"/>
          <path d="M386 221V323" class="deflection-band"/>
          <path d="M422 225V329" class="deflection-band"/>
          <path d="M460 226V331" class="deflection-band deflection-band--center"/>
          <path d="M498 225V329" class="deflection-band"/>
          <path d="M534 221V323" class="deflection-band"/>
          <path d="M570 214V315" class="deflection-band"/>
          <path d="M606 204V305" class="deflection-band"/>
          <path d="M642 192V292" class="deflection-band"/>
          <path d="M678 180V278" class="deflection-band"/>
          <path d="M714 167V262" class="deflection-band"/>
          <path d="M750 154V246" class="deflection-band"/>
        </g>
        <path class="deflection-envelope"
          d="M170 154C282 194 360 221 460 226C560 221 638 194 750 154"/>
        <path class="deflection-envelope"
          d="M170 246C282 292 360 326 460 331C560 326 638 292 750 246"/>
        <path class="deflection-envelope" d="M170 154V246M750 154V246"/>
        <path d="M460 18V68" class="deflection-load" marker-end="url(#sfSymbolicArrowDown)"/>
        <text x="484" y="48" class="deflection-load-label">แรงกด P<tspan baseline-shift="sub"
          font-size="10">u</tspan></text>
        <g class="deflection-flow-label deflection-flow-label--load" transform="translate(532 86)">
          <rect width="170" height="45" rx="4"/>
          <text x="12" y="18">INPUT LOAD</text>
          <text x="12" y="35">ถ่ายแรงผ่านหน้าเสา</text>
        </g>
        <g class="deflection-reactions" marker-end="url(#sfSymbolicArrowUp)">
          <path d="M240 402V342"/><path d="M328 402V342"/><path d="M416 402V342"/>
          <path d="M504 402V342"/><path d="M592 402V342"/><path d="M680 402V342"/>
        </g>
        <text x="460" y="419" text-anchor="middle" class="deflection-soil-label">แรงปฏิกิริยาดิน · กระจายขึ้นสู่ฐานราก</text>
        <g class="deflection-flow-label deflection-flow-label--footing" transform="translate(700 286)">
          <rect width="184" height="51" rx="4"/>
          <text x="12" y="19">SYMBOLIC SHAPE</text>
          <text x="12" y="37">ไม่แสดง Δ หรือ settlement</text>
        </g>
      </svg>
          </div>
        </div>
        <div class="symbolic-response-help" aria-hidden="true">
          ลากเพื่อหมุน · ล้อเมาส์เพื่อซูม · ปุ่มลูกศร · 0 จัดภาพ
        </div>
      </div>
      <p class="symbolic-response-status" id="sfSymbolic3dStatus"
        data-symbolic-3d-status role="status" aria-live="polite">
        สี Blue → Cyan → Amber → Red ใช้เน้นการถ่ายแรงระหว่างเล่นเท่านั้น · ไม่ใช่ผล critical, deformation หรือ settlement
      </p>
    </div>
    <div class="deflection-boundary">
      <b>ขอบเขตผล: ${G}</b>
      <span>ภาพนี้ไม่สร้างค่าการกระจัด ไม่ประเมินการทรุด และไม่ใช้ตัดสิน PASS/FAIL หรือออกแบบงานก่อสร้าง</span>
    </div>
  </article>`},"renderSettlementHold"),zt=c((t,a)=>e(t,[a,a.toLowerCase(),`direction${a}`],{}),"barCutDirection"),ga=c(t=>{const a=$t(e(t,["polylineMm"],[])),s=a.map(g=>p(g?.xMm)).filter(g=>g!==null),o=a.map(g=>p(g?.zMm)).filter(g=>g!==null);if(s.length<2||o.length<2)return null;const r=Math.min(...s),i=Math.max(...s),u=Math.min(...o),h=Math.max(...o);return!(i>r)||!(h>u)?null:{polyline:a,minX:r,maxX:i,minZ:u,maxZ:h,width:i-r,height:h-u}},"barCutPolylineBounds"),ns=c(t=>{const a=["A","B"].map(s=>ga(zt(t,s))).filter(Boolean);return{width:Math.max(1,...a.map(s=>s.width)),height:Math.max(1,...a.map(s=>s.height))}},"sharedBarCutFrame"),ye=c((t,a,s,o,r=null)=>{const i=zt(t,s),u=ot(a,s),h=e(i,["mark","barMark"],it(u,`BAR-${s}`)),g=e(i,["count"],e(u,["count","barCount","quantity"],n)),x=e(i,["diameterMm"],null)==null?St(u):`DB${k(e(i,["diameterMm"]))}`,b=e(i,["centerlineLengthMm","cutLength","centerlineLength","length","Lcl"],n),S=e(i,["horizontalTangentMm","width","outToOutWidth","W"],n),f=e(i,["verticalTangentMm","verticalTail","tail","Bcl"],n),A=e(i,["centerlineRadiusMm","centerlineRadius","bendRadius","Rcl"],n),B=Kt(u,p(e(i,["diameterMm"],16))??16),y=e(i,["innerRadiusMm","innerRadius","Ri"],Math.max(0,(p(A)??0)-B/2)),C=p(S)!==null&&p(A)!==null?p(S)+2*p(A)+B:n,w=p(f)!==null&&p(A)!==null?p(f)+p(A)+B/2:n,T=e(i,["totalCenterlineLengthM","totalLengthM"],p(b)!==null&&p(g)!==null?p(b)*p(g)/1e3:n),I=ga(i),q=r?.width||I?.width||1,M=r?.height||I?.height||1,v=274/q,N=152/M,at=215-(I?I.width*v:274)/2,st=I?oe(I.polyline.map(j=>[at+(p(j?.xMm)-I.minX)*v,230-(p(j?.zMm)-I.minZ)*N])):"",H=s==="A"?"#c2410c":"#0f766e",V=Le(u)||(s==="A"?"ชั้นล่าง":"ชั้นบน"),U=k(e(u,["direction","axis","orientation"],s));return`<figure class="sf-barcut-form" data-barcut-detail="${$(o)}"
    data-select-mark="${$(h)}" data-scale="NTS"
    data-bar-count="${$(g)}" data-bar-size="${$(x)}">
    <figcaption><b>${d(h)} · ${d(o)}</b>
      <span>NTS · ${Ft}</span></figcaption>
    <svg viewBox="0 0 430 340" role="img" data-scale="NTS"
      data-responsive-svg="viewbox"
      aria-label="แบบตัดเหล็ก ${$(h)} จาก Calculation Snapshot">
      <rect x="8" y="8" width="414" height="324" rx="5" fill="#f8fafc" stroke="#94a3b8"/>
      <text x="18" y="24" fill="${H}" font-weight="700" data-annotation-zone="bar-spec">${d(h)} · ${d(g)}-${d(x)} · ${d(U)} ${d(V)}</text>
      <text x="18" y="48" data-annotation-zone="vertical-tangent"${z(f)}>ขาตรง Bcl = ${l(f,"mm",1)} C/L</text>
      <text x="412" y="48" text-anchor="end" data-annotation-zone="radius"${z(A)}>รัศมี Rc = ${l(A,"mm",1)} C/L</text>
      ${st?`<polyline points="${$(st)}" fill="none"
            stroke="${H}" stroke-width="10"
            stroke-linecap="butt" stroke-linejoin="round" data-cut-end="butt"
            data-geometry-source="barCut.polylineMm"/>`:`<path d="M78 72V206Q78 232 104 232H326Q352 232 352 206V72"
            fill="none" stroke="${H}"
            stroke-width="10" stroke-linecap="butt" stroke-linejoin="round"
            data-cut-end="butt"/>`}
      <path d="M62 248H368M62 240V256M368 240V256" stroke="#334155"/>
      <text x="215" y="266" text-anchor="middle"${z(C)}>W = ${l(C,"mm",1)} O/O</text>
      <path d="M50 78V230M42 78H58M42 230H58" stroke="#334155"/>
      <text x="34" y="204" transform="rotate(-90 34 204)"${z(w)}>H = ${l(w,"mm",1)} O/O</text>
      <path d="M116 178 154 157" stroke="#334155"/>
      <text x="158" y="154">Ri ${l(y,"mm",1)} ·
        Di ${l((p(y)??0)*2,"mm",1)} ·
        Rc ${l(A,"mm",1)}</text>
      <text x="215" y="283" text-anchor="middle" data-annotation-zone="horizontal-tangent"${z(S)}>ช่วงตรง Scl = ${l(S,"mm",1)} C/L</text>
      <text x="215" y="309" text-anchor="middle" data-annotation-zone="centerline-length"${z(b)}>Lcl = ${l(b,"mm",1)} / เส้น · รวม
        ${l(T,"m",3)}</text>
      <text x="215" y="332" text-anchor="middle" data-annotation-zone="scale">
        NTS · มิติตาม Snapshot · ไม่ใช่รหัสรูปดัดสำหรับผลิต</text>
    </svg>
    <p><strong>${Ft}</strong> ความยาวตามแนวแกนเชิงทฤษฎี · ยังไม่รับรอง ldh,
      การสลับเหล็กที่มุม หรือรหัสผลิต</p>
  </figure>`},"renderBarCutSvg"),ks=c((t,a="บัญชีแหล่งอ้างอิง")=>`<section class="sf-source-ledger"
  aria-label="${$(a)}">
  <h4>${tt(a)}</h4>
  ${t.length?`<ol>${t.map(s=>{const o=Wt(s),r=oa(o.url);return`<li data-source-id="${$(o.sourceId)}">
              <b>${d(o.standard)} · ${d(o.edition)}</b>
              <span>${d(o.clause)} · ${d(o.equation)}</span>
              <span>Units: ${d(o.canonicalUnits)}</span>
              <span>Assumptions: ${$t(o.assumptions).map(i=>d(i)).join(" · ")}</span>
              <span>${d(o.title)} · ${d(o.verificationStatus)}</span>
              ${r?`<a href="${$(r)}" rel="noreferrer noopener">แหล่งอ้างอิงทางการ</a>`:"<em>ไม่มี URL ทางการที่ใช้ได้</em>"}
            </li>`}).join("")}</ol>`:`<p class="is-review"><strong>${G}</strong> ไม่มีบัญชีแหล่งอ้างอิงใน Snapshot</p>`}
</section>`,"renderReferenceLedger"),ws=c(t=>{const a=t.length,s=t.slice(0,4);return`<section class="a4-reference-summary" data-reference-count="${a}"
    data-visible-reference-count="${s.length}"
    data-reference-presentation="source-id-only"
    aria-label="สรุปเอกสารอ้างอิงสำคัญในรายงาน A4">
    <ol>${s.map((o,r)=>{const i=Wt(o);return`<li data-source-id="${$(i.sourceId)}"
          data-standard="${$(i.standard)}"
          data-edition="${$(i.edition)}"
          data-verification-status="${$(i.verificationStatus)}">
          <b><span aria-hidden="true">${String(r+1).padStart(2,"0")}</span>
            ${d(i.sourceId)}</b>
          <span>ดูรายละเอียดเอกสารใน Flow 07</span>
        </li>`}).join("")}</ol>
    ${a>s.length?`<p>เอกสารอ้างอิงอีก ${a-s.length} รายการอยู่ใน Calculation Book</p>`:"<p>สมการ หน่วย สมมติฐาน และ URL ทางการฉบับเต็มอยู่ใน Calculation Book</p>"}
  </section>`},"renderReportReferenceSummary"),os=c(t=>{const a=$t(t);return`<ul class="sf-limitations">${a.length?a.map(s=>{const o=s&&typeof s=="object"?Yt(s):s,r=s&&typeof s=="object"?nt(s):G;return`<li class="${Nt(r)}"><span>${d(o)}</span><strong>${d(r)}</strong></li>`}).join(""):`<li class="is-review"><span>รายการที่อยู่นอกขอบเขต R1</span><strong>${G}</strong></li>`}</ul>`},"renderLimitations"),$a=c(t=>{const a=t.data,s=e(a,["geometry"],{}),o=e(a,["reinforcement"],{}),r=e(a,["bearing"],{}),i=e(a,["loads"],{}),u=e(a,["governingCheck"],{}),h=nt(u),g=h==="FAIL"?{status:"FAIL",label:"ผลที่ประเมิน · FAIL"}:h==="PASS"?{status:"PASS",label:"ผลที่ประเมิน · OK"}:Ne(a),x=ot(o,"A"),b=ot(o,"B"),S=L(s,"footing","width"),f=L(s,"footing","length"),A=L(s,"footing","thickness"),B=L(s,"column","width"),y=L(s,"column","length"),C=e(r,["qMaxKPa","qMax","qmax","service.qMax"],n),w=e(r,["qMinKPa","qMin","qmin","service.qMin"],n),T=e(r,["sbcGrossKPa","sbc","allowable","allowableBearing"],n),I=e(r,["sbcSource","capacitySource"],n),q=e(i,["factored.columnReactionKN","factoredColumn","puColumn","PuColumn","strength.column"],n),M=e(i,["factored.netPressureKPa","quNet","netFactoredPressure","strength.quNet"],n),v=Tt(u);return`<section class="sf-snapshot-surface sf-snapshot-surface--summary" lang="th"
    ${Xt(t,"summary")} aria-label="สรุปผลฐานรากแผ่จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>ชุดผลคำนวณ · ฐานรากแผ่ (Snapshot)</span><h3>สรุปผลและหลักฐานควบคุม</h3></div>
      <strong class="sf-status-token ${Nt(g.status)}">${d(g.label)}</strong>
    </header>
    <div class="metric-strip sf-metric-strip">
      ${$e({label:"รูปทรงฐานราก · B × L × h",value:`${Y(S,"m",2)} × ${Y(f,"m",2)} × ${Y(A,"m",2)}`,detail:`เสา ${Y(B,"m",2)} × ${Y(y,"m",2)}`,exact:{"footing-b-m":S,"footing-l-m":f,"footing-h-m":A,"column-b-m":B,"column-l-m":y}})}
      ${$e({label:"แรงดันดินใช้งาน · qmax / SBC",value:`${Y(C,"kPa",2)} / ${Y(T,"kPa",2)}`,detail:`qmin ${Y(w,"kPa",2)} · ที่มา SBC: ${k(I)}`,status:nt(e(r,["check","bearingCheck"],r)),exact:{"qmax-kpa":C,"qmin-kpa":w,"sbc-kpa":T}})}
      ${$e({label:"แรงประลัยและแรงดันสุทธิ",value:Y(q,"kN",2),detail:`qu,net ${Y(M,"kPa",2)}`,exact:{"pu-kn":q,"qu-net-kpa":M}})}
      ${$e({label:"รายการควบคุม",value:u&&typeof u=="object"&&Object.keys(u).length?Yt(u):"รอรายการควบคุม",detail:`${k(v)===n?"ไม่มี D/C เชิงตัวเลข":Be(v,3)} · ${nt(u)}`,status:nt(u),exact:{"governing-dc":v}})}
    </div>
    <div class="summary-grid sf-summary-grid">
      <article class="evidence-panel evidence-panel--wide">
        <div class="panel-title"><div><span>สนามแรงดันดิน</span>
          <h3>แรงดันดินแบบไอโซเมตริก (Bearing pressure)</h3></div>
          <span class="reference-badge">อ่านค่าจากชุดผลคำนวณเท่านั้น</span></div>
        ${ua(r,s,"summary",o)}
      </article>
      <article class="evidence-panel">
        <div class="panel-title"><div><span>รูปตัดย่อ</span><h3>เหล็กเสริมที่ตรวจจริง</h3></div></div>
        ${Re(s,o,"รูปตัดย่อพร้อมเหล็กเสริมจาก Snapshot")}
        <dl class="sf-compact-inspector">
          <div><dt>ทิศ A</dt><dd>${d(Et(x,"BAR-A"))}</dd></div>
          <div><dt>ทิศ B</dt><dd>${d(Et(b,"BAR-B"))}</dd></div>
        </dl>
      </article>
    </div>
  </section>`},"renderSummaryFromEnvelope"),fa=c((t,a=null)=>{const s=la(t.data).filter(lt),o=Ne(t.data),r=e(a?.data,["bearing.sbcSource","bearing.capacitySource"],n);return`<section class="sf-snapshot-surface sf-snapshot-surface--dc" lang="th"
    ${Xt(t,"dc")} aria-label="ตาราง D/C จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>ค่าความต้องการ / ความสามารถ (D/C)</span>
        <h3>รายการตรวจที่เครื่องคำนวณประเมินแล้ว</h3></div>
      <strong class="sf-status-token ${Nt(o.status)}">${d(o.label)}</strong>
    </header>
    <p class="sf-dc-source"><b>ที่มา SBC</b><span>${d(r)}</span></p>
    ${da(s,"รายการตรวจฐานรากแผ่ ค่าความต้องการต่อความสามารถ")}
  </section>`},"renderChecksFromEnvelope"),ya=c((t,a={})=>{const s=t.data,o=e(s,["diagrams"],{}),r=e(s,["oneWayShear"],{}),i=ha(o);return`<section class="sf-snapshot-surface sf-snapshot-surface--analysis" lang="th"
    ${Xt(t,"analysis")} aria-label="แผนภาพโมเมนต์และแรงเฉือนจากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>หลักฐานการวิเคราะห์</span><h3>โมเมนต์ดัดและแรงเฉือนทางเดียว</h3></div>
      <span class="reference-badge">เส้นและค่าสูงสุดจากชุดข้อมูลแผนภาพ (Diagram selector)</span>
    </header>
    <div class="sf-analysis-grid">
      ${i.length?i.flatMap(u=>{const h=e(r,[u.direction,String(u.direction).toLowerCase()],{});return[ba(u,"moment"),ba(u,"shear",{criticalValue:e(h,["vuKNPerM","demand","criticalValue"],n)})]}).join(""):`<p class="is-review"><strong>${G}</strong> ไม่มีแบบจำลองแผนภาพในชุดผลคำนวณ</p>`}
    </div>
    ${ss(s,a)}
  </section>`},"renderAnalysisFromEnvelope"),xa=c(t=>{const a=t.data,s=e(a,["geometry"],{}),o=e(a,["reinforcement"],{}),r=e(a,["barCut"],{}),i=ns(r),u=de(s),h=e(u,["coverM","cover"],e(s,["coverMm","cover"],n)),g=p(h)!==null?p(h)<=2?p(h)*1e3:p(h):n;return`<section class="sf-snapshot-surface sf-snapshot-surface--section" lang="th"
    ${Xt(t,"section")} aria-label="แปลน รูปตัด และแบบตัดเหล็กจากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>แปลน / รูปตัด / แบบตัดเหล็ก (Bar Cut)</span>
        <h3>รูปทรงและเหล็กเสริมจากชุดผลคำนวณเดียวกัน</h3></div>
      <strong class="sf-status-token">SNAPSHOT CURRENT</strong>
    </header>
    <div class="section-diagrams sf-section-diagrams">
      <figure class="section-diagram"><figcaption>แปลนฐานรากและแนวเหล็ก</figcaption>
        ${pa(s,o)}</figure>
      <figure class="section-diagram"><figcaption>รูปตัด X-X · ทิศ A และชั้นเหล็ก A / B</figcaption>
        ${Re(s,o)}</figure>
    </div>
    <article class="section-diagram hook-detail-card barcut-detail-card">
      <header><span>รายละเอียด H-01 / H-02 · แบบตัดเหล็ก</span>
        <b>W,H = O/O · Scl,Bcl,Ri,Di,Rc,Lcl = C/L · มิติ mm · NTS</b></header>
      <h4>รูปทรงเหล็กจาก Calculation Snapshot เดียวกับรูปตัด 3D และชุดแบบ</h4>
      <div class="barcut-forms sf-barcut-forms">
        ${ye(r,o,"A","H-01",i)}
        ${ye(r,o,"B","H-02",i)}
      </div>
      <p class="barcut-cover-note">ระยะหุ้มที่ใช้สร้างรูปทรง =
        ${l(g,"mm",0)} ถึงผิวเหล็ก ·
        มิติและความยาวทั้งหมดอ่านจาก Calculation Snapshot ปัจจุบัน</p>
      <p class="barcut-warning">${Ft} · รูปทรงและความยาวตามแนวแกนเชิงทฤษฎีเท่านั้น ·
        ldh, รหัสรูปดัด, แกนดัด, springback, tolerance และการสลับเหล็กที่มุม
        ไม่รวมในผลคำนวณรุ่นนี้</p>
    </article>
  </section>`},"renderSectionFromEnvelope"),me=c(({layer:t,title:a,value:s,trace:o,mark:r="",exact:i={}})=>`<li
  data-model-layer="${$(t)}" ${r?`data-select-mark="${$(r)}"`:""}${Zt(i)}>
  <b>${tt(a)}</b><span>${d(s)}</span><em>${d(o)}</em>
</li>`,"inspectorRow"),va=c(t=>{const a=t.data,s=e(a,["geometry"],{}),o=e(a,["bearing"],{}),r=e(a,["reinforcement"],{}),i=e(a,["punching"],{}),u=e(a,["barCut"],{}),h=ot(r,"A"),g=ot(r,"B"),x=zt(u,"A"),b=zt(u,"B"),S=L(s,"footing","width"),f=L(s,"footing","length"),A=L(s,"footing","thickness"),B=e(o,["qMaxKPa","qMax","qmax","service.qMax"],n),y=e(o,["qMinKPa","qMin","qmin","service.qMin"],n),C=e(x,["centerlineLengthMm","cutLength","centerlineLength","Lcl"],n),w=e(b,["centerlineLengthMm","cutLength","centerlineLength","Lcl"],n),T=e(i,["perimeterM","criticalPerimeter","bo","perimeter"],n),I=ue("A"),q=ue("B");return`<section class="sf-snapshot-surface sf-snapshot-surface--three" lang="th"
    ${Xt(t,"three")} aria-label="แบบจำลองสามมิติฐานรากแผ่จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>มุมมองวิศวกรรมแบบโต้ตอบ</span>
        <h3>แบบจำลอง 3D และรายการหลักฐาน</h3></div>
      <strong class="sf-status-token">SNAPSHOT MODEL</strong>
    </header>
    <div class="three-layout sf-three-layout">
      <div class="model-stage sf-model-stage" data-model-scene>
        <canvas data-snapshot-3d data-snapshot-id="${$(t.snapshotId)}"
          data-payload-hash="${$(t.payloadHash)}" tabindex="0" role="region"
          aria-label="พื้นที่สามมิติฐานราก เหล็กเสริม และสนามแรงดันดินจากชุดผลคำนวณ"></canvas>
        <div class="sf-model-fallback" data-snapshot-3d-fallback>
          ${ua(o,s,"three",r,i)}
          <p>ภาพ SVG สำรองใช้ค่ารูปทรงและแรงดันจากชุดข้อมูล 3D</p>
        </div>
      </div>
      <aside class="model-inspector sf-model-inspector" aria-label="รายการหลักฐานสามมิติ">
        <h4>รายการหลักฐานแบบจำลอง</h4>
        <ol>
          ${me({layer:"concrete",title:"ฐานรากและเสา",value:`${Y(S,"m",2)} × ${Y(f,"m",2)} × ${Y(A,"m",2)}`,trace:"ชุดข้อมูล 3D · รูปทรง",exact:{"footing-b-m":S,"footing-l-m":f,"footing-h-m":A}})}
          ${me({layer:"bearing",title:"สนามแรงดันดิน",value:`qmax ${Y(B,"kPa",2)} · qmin ${Y(y,"kPa",2)}`,trace:"ชุดข้อมูล 3D · แรงดันดิน",exact:{"qmax-kpa":B,"qmin-kpa":y}})}
          ${me({layer:"barA",title:`เหล็ก ${I.direction}/${I.axis} ${I.axisSymbol} · ${I.layer}`,value:Et(h,"BAR-A"),trace:`Lcl ${Y(C,"mm",1)}`,mark:it(h,"BAR-A"),exact:{"lcl-mm":C}})}
          ${me({layer:"barB",title:`เหล็ก ${q.direction}/${q.axis} ${q.axisSymbol} · ${q.layer}`,value:Et(g,"BAR-B"),trace:`Lcl ${Y(w,"mm",1)}`,mark:it(g,"BAR-B"),exact:{"lcl-mm":w}})}
          ${me({layer:"critical",title:"แนววิกฤตเฉือนทะลุ",value:Y(T,"m",3),trace:"แนวตรวจรอบเสากลางจาก Snapshot",exact:{"perimeter-m":T}})}
        </ol>
      </aside>
    </div>
  </section>`},"renderThreeFromEnvelope"),ct=c((t,...a)=>e(t,a,n),"projectField"),rs=c(t=>t.map(a=>{const s=nt(a),o=lt(a),r=ce(a),i=le(a),u=Tt(a),h=k(r),g=k(i),x=k(u),b=et(a),S=`<span aria-hidden="true">—</span><span class="sr-only">${G}</span>`;return`<tr class="${Nt(s)}" data-check-id="${$(b)}" data-evaluation="${o?"evaluated":"not-evaluated"}">
        <td><span title="${$(b)}">${d(Pe[b]||b)}</span></td><td>${d(Yt(a))}</td>
        <td${o?z(r):""}>${o?h===n?"ไม่ใช้ค่าความต้องการเชิงตัวเลข":It(r):S}</td>
        <td${o?z(i):""}>${o?g===n?"ไม่ใช้ค่าความสามารถเชิงตัวเลข":It(i):S}</td>
        <td${o?z(u):""}>${o?x===n?"ไม่ใช้ D/C เชิงตัวเลข":ut(u,3):S}</td>
        <td><strong>${d(re(a))}</strong></td>
      </tr>`}).join(""),"renderReportCheckRows"),Sa=c(t=>k(t).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(),"engineeringMathPlainText"),kt=c((t,a)=>`<span class="a4-fraction" aria-label="${$(`${Sa(t)} หารด้วย ${Sa(a)}`)}">
    <span class="a4-fraction__numerator">${t}</span>
    <span class="a4-fraction__denominator">${a}</span>
  </span>`,"engineeringFraction"),rt=c((t,a="")=>`<span class="a4-equation-line${a?` ${a}`:""}">${t}</span>`,"engineeringEquationLine"),te=c((...t)=>`<span class="a4-equation-system">${t.filter(Boolean).join("")}</span>`,"engineeringEquationSystem"),qe=c((t,a=n)=>d(t,a).replace(/\bLr\b/g,"L<sub>r</sub>"),"engineeringEquationText"),Fe=c(t=>`<span class="a4-square-root"><span aria-hidden="true">√</span><span>${t}</span></span>`,"engineeringSquareRoot"),is=c((t,a,s={},o={})=>{if(t==="SF-EQ-SERVICE-GROSS-WEIGHTS")return te(rt("W<sub>f</sub> = γ<sub>c</sub>(B · L · h)"),rt("W<sub>s</sub> = γ<sub>s</sub>[(B · L − b<sub>c</sub> · l<sub>c</sub>) · z]"),rt("P<sub>service,gross</sub> = P<sub>D</sub> + P<sub>L</sub> + W<sub>f</sub> + W<sub>s</sub>","a4-equation-line--result"));if(t==="SF-EQ-SERVICE-BIAXIAL-PRESSURE")return te(rt(`q(x,y) = ${kt("P","A")} +
          ${kt("M<sub>x</sub> · y","I<sub>x</sub>")} +
          ${kt("M<sub>y</sub> · x","I<sub>y</sub>")}`),rt(`S<sub>x</sub> = ${kt("B · L<sup>2</sup>","6")}
          <span class="a4-equation-separator">;</span>
          S<sub>y</sub> = ${kt("L · B<sup>2</sup>","6")}`,"a4-equation-line--secondary"));if(t==="SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM")return te(rt(`q<sub>u,gross</sub> =
          ${kt("P<sub>u,column</sub> + γ<sub>D</sub>(W<sub>f</sub> + W<sub>s</sub>)","B · L")}`),rt(`q<sub>u,net</sub> = q<sub>u,gross</sub> −
          ${kt("γ<sub>D</sub>(W<sub>f</sub> + W<sub>s</sub>)","B · L")}`,"a4-equation-line--secondary"),rt(`q<sub>u,net</sub> = ${kt("P<sub>u,column</sub>","B · L")}`,"a4-equation-line--result"));if(t==="SF-EQ-FLEXURE-A"||t==="SF-EQ-FLEXURE-B")return te(rt(`M<sub>u</sub> = ${kt("q<sub>u,net</sub> · l<sup>2</sup>","2")}`),rt(`a = ${kt("A<sub>s</sub> · f<sub>y</sub>","0.85 · f′<sub>c</sub> · b")}`,"a4-equation-line--secondary"),rt(`φM<sub>n</sub> = φ · A<sub>s</sub> · f<sub>y</sub>
          (d − ${kt("a","2")})`,"a4-equation-line--result"));if(t==="SF-EQ-ONE-WAY-SHEAR-A"||t==="SF-EQ-ONE-WAY-SHEAR-B")return te(rt(`V<sub>u</sub> = q<sub>u,net</sub> · max(l − d, 0)
          <span class="a4-equation-separator">;</span>
          ρ<sub>w</sub> = ${kt("A<sub>s</sub>","b · d")}`),rt(`V<sub>c</sub> = min [
          0.66 · λ<sub>s</sub> · λ · ρ<sub>w</sub><sup>1/3</sup> ·
          ${Fe("f′<sub>c</sub>")} · b · d`,"a4-equation-line--secondary"),rt(`0.42 · λ · ${Fe("f′<sub>c</sub>")} · b · d ]
          <span class="a4-equation-separator">;</span>
          φV<sub>c</sub> = 0.75 · V<sub>c</sub>`,"a4-equation-line--secondary"));if(t==="SF-EQ-INTERIOR-PUNCHING-SHEAR")return te(rt("b<sub>o</sub> = 2[(c<sub>x</sub> + d) + (c<sub>y</sub> + d)]"),rt("V<sub>u</sub> = P<sub>u,column</sub> − q<sub>u,net</sub>(c<sub>x</sub> + d)(c<sub>y</sub> + d)","a4-equation-line--secondary"),rt(`v<sub>c</sub> = min [
          0.33,
          0.17(1 + ${kt("2","β")}),
          0.083(2 + ${kt("α<sub>s</sub> · d","b<sub>o</sub>")})
          ] · λ<sub>s</sub> · λ · ${Fe("f′<sub>c</sub>")}`,"a4-equation-line--secondary"),rt("φV<sub>c</sub> = 0.75 · v<sub>c</sub> · b<sub>o</sub> · d","a4-equation-line--result"));if(t.startsWith("SF-EQ-")&&(t.includes("1_4D_1_7L")||t.includes("1_2D_1_6L"))){const r=e(s,["combination.normativeEquation"],a),i=e(s,["combination.equation"],a),u=e(s,["combination.clause"],"ข้อกำหนดชุดน้ำหนัก"),h=e(s,["combination.applicability"],"ใช้ตามขอบเขตข้อมูลของ Calculation Snapshot"),g=e(o,["required"],!1)===!0,x=e(o,["confirmed"],!1)===!0;return te(rt(`${d(u)}: ${qe(r)}`),rt(`สมการที่ Engine ใช้: ${qe(i)}`,"a4-equation-line--secondary"),rt(`ขอบเขต: ${qe(h)}`,"a4-equation-line--secondary"),g?rt(`การยืนยันขอบเขต: ${x?"ยืนยันแล้วว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้":"ยังไม่ยืนยัน · ไม่สร้างผลคำนวณ"}`,x?"a4-equation-line--result":"a4-equation-line--secondary"):"",rt(`P<sub>u,column</sub> =
          ${ut(e(s,["combination.gammaD"],n),2)}
          P<sub>D</sub> +
          ${ut(e(s,["combination.gammaL"],n),2)}
          P<sub>L</sub>`,"a4-equation-line--result"))}return rt(`<span class="a4-equation-fallback">${d(a)}</span>`)},"renderPrincipalEquationDisplay"),Ma=c(({id:t,formula:a,loads:s,applicabilityConfirmation:o,surface:r="a4"})=>`<div class="a4-worked-formula a4-math-row${r==="flow07"?" calc-story-equation__formula":""}"
    ${r==="flow07"?"data-flow07-equation-id":"data-a4-equation-id"}="${$(t)}"
    data-math-layout="stacked"
    data-formula-source="${$(a)}">
    <span class="a4-math-row__label">สมการ</span>
    <span class="a4-equation-stack" role="math" aria-label="${$(a)}">
      ${is(t,a,s,o)}
    </span>
  </div>`,"renderPrincipalEquationLine"),Aa=c(t=>{const a=t.data,s=e(a,["project"],{}),o=e(a,["inputs"],{}),r=e(o,["materials"],{}),i=e(o,["loads"],{}),u=e(o,["soil"],{}),h=e(a,["designBasis"],{}),g=e(a,["summary"],{}),x=e(g,["loads"],{}),b=e(x,["service"],{}),S=e(x,["factored"],{}),f=e(g,["bearing"],{}),A=e(a,["flexure"],{}),B=e(a,["oneWayShear"],{}),y=e(a,["punching"],{}),C=e(f,["sbcSource","capacitySource"],n),w=la(a).filter(lt),T=jt(a),I=ra(a),q=e(a,["section"],{}),M=e(q,["geometry"],e(g,["geometry"],{})),v=e(q,["reinforcement"],e(g,["reinforcement"],{})),N=ct(s,"memberMark","mark","memberId"),D=L(M,"footing","width"),at=L(M,"footing","length"),st=L(M,"footing","thickness"),H=L(M,"column","width"),V=L(M,"column","length"),U=de(M),j=e(U,["coverM","cover"],e(M,["coverMm","cover"],n)),F=p(j)!==null?p(j)<=2?p(j)*1e3:p(j):n,W=ot(v,"A"),Z=ot(v,"B"),mt=e(A,["A"],{}),Ct=e(A,["B"],{}),pt=e(B,["A"],{}),At=e(B,["B"],{}),Bt=e(M,["criticalSections.punching"],{}),Dt=e(Bt,["perimeterM","criticalPerimeter","bo"],n),ht=e(M,["effectiveDepthMm.punching","effectiveDepth.punching"],n),K=e(M,["cantileversM.A","cantilevers.A"],n),dt=e(M,["cantileversM.B","cantilevers.B"],n),X=e(M,["effectiveDepthMm.A","effectiveDepth.A"],n),bt=e(M,["effectiveDepthMm.B","effectiveDepth.B"],n),Q=c(E=>T.find(R=>et(R)===E)||{},"reportCheck"),ft=ie.map(E=>Q(E)).filter(lt),_t=T.filter(E=>lt(E)&&nt(E)==="FAIL"&&!ie.includes(et(E))),P=c(E=>I.find(R=>ee(R)===E)||null,"reportEquation"),_=c(E=>{const R=P(E);if(!ia(R))return n;const xt=Wt(R);return k(xt.formula)},"reportFormula"),J=Q("bearing-capacity"),Rt=Q("short-direction-band-distribution"),Te=k(e(v,["distribution.shortDirection"],""),"").toUpperCase(),Na=k(Wt(Rt).substitution,"").match(/short-direction\s*=\s*([AB])/i)?.[1]?.toUpperCase(),Ve=["A","B"].includes(Te)?Te:Na,Ea=c(E=>{const R=String(E).toUpperCase(),xt=[`provided-steel-${R.toLowerCase()}`,`tension-controlled-${R.toLowerCase()}`,`flexure-capacity-${R.toLowerCase()}`,`punching-minimum-steel-${R.toLowerCase()}`];return lt(Rt)&&(!Ve||Ve===R)&&xt.push("short-direction-band-distribution"),xt.map(qt=>Q(qt)).filter(lt)},"directionalRebarChecks"),xe=c((E,R)=>{const xt=Q(`provided-steel-${String(E).toLowerCase()}`);if(!lt(xt))return"";const qt=Ea(E),Ue=qt.some(Ae=>nt(Ae)==="FAIL"),be=Ue||!qt.length||!qt.every(Ae=>nt(Ae)==="PASS")?Ue?"FAIL":G:"PASS",Me=e(R,["spacingMm","spacing"],n),se=Lt(R,["spacingMm","spacing"]),_e=p(se)===null?n:p(se)/10,Va=p(se)!==null&&p(Me)!==null&&Math.abs(p(se)-p(Me))>.05?` · ระยะเฉลี่ยจริง ${l(Me,"mm",1)}`:"";return`<p class="${Nt(be)}"
      data-rebar-check="${$(et(xt))}"
      data-rebar-result="${$(be)}"
      data-related-checks="${$(qt.map(et).join(" "))}"
      data-check-id="${$(et(xt))}">
      <span>เลือกใช้เหล็ก · ทิศ ${tt(E)}</span>
      <b>${Vt(R)}-${d(St(R))}
        @ ${l(se,"mm",1)}
        ${_e===n?"":`(≈ ${l(_e,"cm",1)}${Va})`}</b>
      <em>As,req = ${It(ce(xt))} ·
        As,prov = ${It(le(xt))} ·
        ผลรวมทิศ ${tt(E)} · ${be==="PASS"?"ผ่าน · O.K.":be==="FAIL"?"ไม่ผ่าน · FAIL":"รอตรวจ · REVIEW"}</em>
    </p>`},"selectedRebarInline"),Gt=c(E=>Ma({id:E,formula:_(E),loads:x,applicabilityConfirmation:e(h,["loadApplicabilityConfirmation"],{}),surface:"a4"}),"reportEquationLine"),Ht=c(E=>{const R=Q(E);return lt(R)?d(re(R)):d(G)},"reportResultStatus"),ve=c((E,R)=>lt(Q(E))?"":`<p class="a4-not-evaluated-block" data-a4-not-evaluated="${$(E)}" data-a4-equation-id="${$(R)}">
          <strong>NOT EVALUATED · นอกขอบเขตการคำนวณรุ่นนี้</strong>
          <span>ไม่แสดงค่าความต้องการ กำลัง หรือ D/C · ดูหลักฐานและเหตุผลใน Flow 07</span>
        </p>`,"reportStrengthUnavailable"),Pa=c(()=>_t.length?`<div class="a4-supplemental-failures"
      data-a4-supplemental-failures="${_t.length}"
      aria-label="รายการที่ประเมินแล้วและไม่ผ่านเพิ่มเติม">
      <b>ผลไม่ผ่านเพิ่มเติมจากตารางหลัก</b>
      <div>${_t.map(E=>{const R=p(Tt(E));return`<span data-check-id="${$(et(E))}">
            <strong>${d(Pe[et(E)]||et(E))}</strong>
            ${d(Ya[et(E)]||Yt(E))}
            ${R===null?"":` · D/C ${ut(R,3)}`}
            · ไม่ผ่าน · FAIL
          </span>`}).join("")}</div>
    </div>`:"","supplementalFailureStrip"),La=De(f),pe=e(g,["overall"],{}),Se=k(e(pe,["governingCheckId"],n)),Oe=Q(Se),Da=w.some(E=>nt(E)==="FAIL"),Ra=k(e(pe,["bearingStatus"],n))==="PASS"&&k(e(pe,["strengthStatus"],n))==="PASS"&&k(e(pe,["evaluatedEquationStatus"],n))==="PASS",he=Da?"FAIL":Ra?"PASS":"REVIEW",He=w.filter(E=>nt(E)==="PASS").length,qa=w.filter(E=>nt(E)==="FAIL").length,Fa="REVIEW",ae=k(e(h,["profileId","resolvedProfile.profileId"],t.profileId||n)),Ia=k(e(h,["displayLabel","profileLabel","label","resolvedProfile.displayLabel"],ae)),Ta=Jt(t,"calculationFingerprint"),je=ct(s,"revision","rev"),Ke=c(E=>[`data-report-page="${E}"`,'data-document-class="CALCULATION_REVIEW"',`data-snapshot-id="${$(t.snapshotId)}"`,`data-payload-hash="${$(t.payloadHash)}"`,`data-calculation-fingerprint="${$(Ta)}"`,`data-profile-id="${$(ae)}"`,`data-member-mark="${$(N)}"`,`data-revision="${$(je)}"`].join(" "),"reportPageAttributes"),ze=c(()=>`<dl class="a4-header-context" aria-label="ข้อมูลประกอบหัวรายงาน">
      <div><dt>โครงการ</dt><dd>${d(ct(s,"projectName","name"))}</dd></div>
      <div><dt>ชิ้นส่วน</dt><dd>${d(N)}</dd></div>
      <div><dt>เลขที่คำนวณ</dt><dd>${d(ct(s,"calculationNumber","calculationNo"))}</dd></div>
      <div><dt>Revision</dt><dd>${d(je)}</dd></div>
      <div><dt>จัดทำโดย</dt><dd>${d(ct(s,"preparedBy"))}</dd></div>
      <div><dt>ตรวจสอบโดย</dt><dd>${d(ct(s,"checkedBy"))}</dd></div>
    </dl>`,"reportHeaderProjectLine");return`<section class="sf-snapshot-surface sf-snapshot-surface--report report-document"
    lang="th" ${Xt(t,"report")} data-sbc-source="${$(C)}" aria-label="รายงาน A4 ฐานรากแผ่สองหน้า">
    <article class="report-sheet report-product report-bw" ${Ke(1)}
      aria-label="รายงานฐานรากแผ่ หน้า 1 จาก 2">
    <header class="report-sheet__header">
      <div class="a4-header-title"><span>นายช่างใหญ่ Civil Apps · เครื่องมือฐานรากแผ่</span>
        <h3>รายการคำนวณฐานรากแผ่ · หน้า 1 / 2</h3>
        ${ze()}
      </div>
      <dl>
        <dt>เลขที่แบบ</dt><dd>${d(ct(s,"drawingNumber","drawingNo"))}</dd>
        <dt>โพรไฟล์</dt><dd>${d(ae)}</dd>
        <dt>รุ่นเครื่องคำนวณ</dt><dd>${d(e(h,["engineVersion"],t.engineVersion||n))}</dd>
        <dt>ชุดผลคำนวณ</dt><dd>${d(t.snapshotId)}</dd>
      </dl>
      <div class="a4-header-signoff" aria-label="ช่องลงนาม">
        <div><span>จัดทำโดย</span><i></i><b>${d(ct(s,"preparedBy"))}</b></div>
        <div><span>ตรวจสอบโดย</span><i></i><b>${d(ct(s,"checkedBy"))}</b></div>
        <div><span>อนุมัติโดย</span><i></i><b>${d(ct(s,"approvedBy"))}</b></div>
      </div>
    </header>
    <section class="a4-basis" aria-label="ข้อมูลโครงการและฐานการออกแบบ">
      <h4>01 · ข้อมูลโครงการ / ฐานการออกแบบ</h4>
      <table><tbody>
        <tr><th scope="row">เจ้าของ / สถานที่</th><td>${d(ct(s,"projectOwner","owner"))} · ${d(ct(s,"projectLocation","location"))}</td>
          <th scope="row">โพรไฟล์ / รุ่นเครื่องคำนวณ</th><td>${d(e(h,["profileId","profile"],n))} · ${d(e(h,["engineVersion"],t.engineVersion||n))}</td></tr>
        <tr><th scope="row">ฐานราก / เสา</th><td>${l(D,"m",2)} × ${l(at,"m",2)} × ${l(st,"m",2)} · เสา ${l(H,"m",2)} × ${l(V,"m",2)}</td>
          <th scope="row">ดิน / ระยะหุ้ม</th><td>SBC<sub>gross</sub> ${l(e(f,["sbcGrossKPa","sbc"],n),"kPa",2)} · ระยะหุ้ม ${l(F,"mm",0)}
            <small class="a4-sbc-source" title="${$(C)}">ที่มา SBC<sub>gross</sub>:
              ${d(C)}</small></td></tr>
        <tr><th scope="row">Pservice,gross / Pu,column</th><td>${l(e(b,["grossReactionKN","columnReactionKN"],n),"kN",2)} / ${l(e(S,["columnReactionKN","column"],n),"kN",2)}</td>
          <th scope="row">เหล็กเสริมที่เลือก</th><td>${d(Et(W,"BAR-A"))}<br>${d(Et(Z,"BAR-B"))}</td></tr>
        <tr><th scope="row">กำลังชิ้นส่วน</th><td>${d(e(h,["memberStrengthStandard","standard","governingStandard"],n))}</td>
          <th scope="row">มาตรฐานชุดน้ำหนัก</th><td><strong>${d(e(h,["loadStandard.displayLabel","resolvedProfile.loadStandard.displayLabel","loadCombination.standard"],n))}</strong><br><small>${d(e(h,["loadCombination.clause"],n))} · ${d(e(h,["loadCombination.equation","loadCombination.label"],n))}</small></td></tr>
        <tr><th scope="row">คอนกรีต / เหล็ก</th><td>f′c ${l(e(r,["fcMPa"],n),"MPa",2)} · fy ${l(e(r,["fyMPa"],n),"MPa",2)}</td>
          <th scope="row">น้ำหนัก D / L</th><td>${l(e(i,["deadKN"],n),"kN",2)} / ${l(e(i,["liveKN"],n),"kN",2)}</td></tr>
        <tr><th scope="row">หน่วยน้ำหนักคอนกรีต / ดิน</th><td>${l(e(r,["concreteUnitWeightKNPerM3"],n),"kN/m³",2)} / ${l(e(r,["soilUnitWeightKNPerM3"],n),"kN/m³",2)}</td>
          <th scope="row">SBC<sub>gross</sub> ที่กรอก</th><td>${l(e(u,["sbcGrossKPa"],n),"kPa",2)}</td></tr>
        <tr><th scope="row">ระยะยื่น A / B</th><td>${l(K,"m",3)} / ${l(dt,"m",3)}</td>
          <th scope="row">โพรไฟล์ที่ใช้คำนวณ</th><td>${d(Ia)}<br><small>${d(ae)}</small></td></tr>
      </tbody></table>
    </section>
    <section class="a4-worked-calculations" aria-label="สมการ การแทนค่า และผลคำนวณฐานราก">
      <div class="a4-section-title"><b>02 · น้ำหนัก แรงดันดิน และสมดุลแรง</b>
        <span>ข้อมูล → สมการ → แทนค่า → ผลจาก Snapshot</span></div>
      <div class="a4-worked-grid">
        <article class="a4-worked-card a4-calculation-band" data-calculation-step="self-weights">
          <header><b>02.1 · น้ำหนักฐานและดินเหนือฐาน</b>
            <em>${Ht("bearing-capacity")}</em></header>
          ${Gt("SF-EQ-SERVICE-GROSS-WEIGHTS")}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
            P<sub>service,gross</sub> =
            ${l(e(i,["deadKN"],n),"kN",2)}
            + ${l(e(i,["liveKN"],n),"kN",2)}
            + ${l(e(b,["footingWeightKN"],n),"kN",2)}
            + ${l(e(b,["soilOverburdenWeightKN"],n),"kN",2)}
            = ${l(e(b,["grossReactionKN"],n),"kN",2)}</strong></p>
        </article>
        <article class="a4-worked-card a4-calculation-band" data-calculation-step="service-bearing">
          <header><b>02.2 · แรงดันดินใช้งานและการสัมผัส</b>
            <em>${Ht("bearing-capacity")}</em></header>
          ${Gt("SF-EQ-SERVICE-BIAXIAL-PRESSURE")}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่าแรงดัน</span><strong>
            P / A = ${l(e(b,["grossReactionKN"],n),"kN",2)} / ${l(e(f,["areaM2"],n),"m²",3)}
            = ${l(e(f,["q0KPa"],n),"kPa",2)} ·
            M<sub>x</sub> = ${l(e(i,["serviceMxKNm"],n),"kN·m",2)} · M<sub>y</sub> = ${l(e(i,["serviceMyKNm"],n),"kN·m",2)}</strong></p>
          <p class="a4-worked-substitution a4-math-row"><span>แรงดันมุม</span><strong>
            ${La.map((E,R)=>`q${R+1}${["(−X,−Y)","(+X,−Y)","(+X,+Y)","(−X,+Y)"][R]} =
                    ${l(E,"kPa",2)}`).join(" / ")}</strong></p>
          <p class="a4-worked-result"><span>ผล</span><strong>
            q<sub>min</sub> / q<sub>max</sub> / SBC<sub>gross</sub> =
            ${l(e(f,["qMinKPa"],n),"kPa",2)} /
            ${l(e(f,["qMaxKPa"],n),"kPa",2)} /
            ${l(e(f,["sbcGrossKPa"],n),"kPa",2)}
          </strong><em>D/C ${ut(Tt(J),3)} · ${Ht("bearing-capacity")}</em></p>
          <p class="a4-worked-result"><span>การสัมผัสดิน</span><strong>
            ${d(e(f,["fullContact"],!1)?"สัมผัสเต็มพื้นที่":"แรงดึงเกิดขึ้นใต้ฐาน")}</strong><em>kern ${ut(e(f,["combinedKernRatio"],n),3)}</em></p>
        </article>

        <article class="a4-worked-card a4-calculation-band" data-calculation-step="factored-pressure">
          <header><b>02.3 · แรงประลัยและแรงดันสุทธิ</b>
            <em>${d(e(h,["loadCombination.equation"],n))}</em></header>
          ${Gt(e(x,["combination.id"],n)==="TH_MR_2566_C7_1_4D_1_7L"?"SF-EQ-TH_MR_2566_C7_1_4D_1_7L":`SF-EQ-${k(e(x,["combination.id"],n))}`)}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
            P<sub>u,column</sub> =
            ${ut(e(x,["combination.gammaD"],n),2)}
            (${l(e(i,["deadKN"],n),"kN",2)})
            + ${ut(e(x,["combination.gammaL"],n),2)}
            (${l(e(i,["liveKN"],n),"kN",2)})
            = ${l(e(S,["columnReactionKN"],n),"kN",2)}</strong></p>
          ${Gt("SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM")}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่าแรงดัน</span><strong>
            ${l(e(S,["grossPressureKPa"],n),"kPa",2)} − ${l(e(S,["distributedDeadPressureKPa"],n),"kPa",2)} = ${l(e(S,["netPressureKPa"],n),"kPa",2)}</strong></p>
          <p class="a4-worked-result"><span>ผล</span><strong>
            P<sub>u,gross</sub> =
            ${l(e(S,["grossReactionKN"],n),"kN",2)} ·
            q<sub>u,gross</sub> / q<sub>u,net</sub> =
            ${l(e(S,["grossPressureKPa"],n),"kPa",2)} / ${l(e(S,["netPressureKPa"],n),"kPa",2)}</strong><em>สมดุลแรงขึ้น–ลง</em></p>
          </article>
      </div>
    </section>
    <section class="report-evidence">
      <div class="report-diagram"><h4>03 · แปลนฐานราก / เหล็กเสริม</h4>
        ${es(M,v,"แปลนฐานรากในรายงาน A4")}</div>
      <div class="report-diagram"><h4>04 · รูปตัด X-X · แนว A/X / เหล็กเสริม</h4>
        ${as(M,v,"รูปตัดฐานรากในรายงาน A4")}</div>
    </section>
    </article>

    <article class="report-sheet report-product report-bw" ${Ke(2)}
      aria-label="รายงานฐานรากแผ่ หน้า 2 จาก 2">
      <header class="report-sheet__header report-sheet__header--continuation">
        <div class="a4-header-title"><span>นายช่างใหญ่ Civil Apps · เครื่องมือฐานรากแผ่</span>
          <h3>รายการคำนวณฐานรากแผ่ · หน้า 2 / 2</h3>
          ${ze()}
        </div>
        <dl>
          <dt>เลขที่แบบ</dt><dd>${d(ct(s,"drawingNumber","drawingNo"))}</dd>
          <dt>โพรไฟล์</dt><dd>${d(ae)}</dd>
          <dt>ชุดผลคำนวณ</dt><dd>${d(t.snapshotId)}</dd>
          <dt>แผ่น</dt><dd>02 / 02</dd>
        </dl>
      </header>
      <section class="a4-effective-depths a4-calculation-band" aria-label="ระยะยื่นและความลึกประสิทธิผล">
        <div class="a4-section-title"><b>01 · ระยะยื่นและความลึกประสิทธิผล</b>
          <span>ค่าจากเรขาคณิต Snapshot เดียวกัน</span></div>
        <dl class="calc-story-values">
          <div><dt>ระยะยื่น A / B</dt><dd>${l(K,"m",3)} / ${l(dt,"m",3)}</dd></div>
          <div><dt>dA / dB / d punching</dt><dd>${l(X,"mm",0)} / ${l(bt,"mm",0)} /
            ${l(ht,"mm",0)}</dd></div>
        </dl>
      </section>
      <section class="a4-worked-calculations" aria-label="กำลังและเหล็กเสริม">
        <div class="a4-section-title"><b>02 · กำลังและเหล็กเสริม</b>
          <span>ดัด → เฉือนทางเดียว → เฉือนทะลุ</span></div>
        <div class="a4-worked-grid">

        ${[["A",mt,W,"flexure-capacity-a"],["B",Ct,Z,"flexure-capacity-b"]].map(([E,R,xt,qt])=>`
          <article class="a4-worked-card a4-calculation-band" data-calculation-step="flexure-${String(E).toLowerCase()}">
            <header><b>02.${E==="A"?"1":"2"} · ดัดและเหล็กเสริม ทิศ ${E}</b>
              <em>${Ht(qt)}</em></header>
            ${ve(qt,`SF-EQ-FLEXURE-${E}`)||`${Gt(`SF-EQ-FLEXURE-${E}`)}
            <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
              q<sub>u,net</sub> = ${l(e(S,["netPressureKPa"],n),"kPa",2)} ·
              l = ${l(e(R,["cantileverM"],n),"m",3)} ·
              d = ${l(e(R,["depthMm"],n),"mm",0)} ·
              M<sub>u</sub> = ${l(e(R,["muKNmPerM"],n),"kN·m/m",3)}</strong></p>
            <p class="a4-worked-result"><span>เหล็กที่ต้องการ</span><strong>
              A<sub>s,strength</sub> = ${l(e(R,["asStrengthMm2PerM"],n),"mm²/m",1)} · A<sub>s,min</sub> = ${l(e(R,["asMinimumMm2PerM"],n),"mm²/m",1)} · A<sub>s,req</sub> = ${l(e(R,["asRequiredMm2PerM"],n),"mm²/m",1)}</strong></p>
            ${xe(E,xt)}
            <p class="a4-worked-result"><span>กำลังดัด</span><strong>
              φM<sub>n</sub> = ${l(e(R,["phiMnKNmPerM"],n),"kN·m/m",2)}</strong><em>D/C ${ut(e(R,["utilization"],n),3)} · ${Ht(qt)}</em></p>
            `}
          </article>`).join("")}

        ${[["A",pt,"one-way-shear-a"],["B",At,"one-way-shear-b"]].map(([E,R,xt])=>`
          <article class="a4-worked-card a4-worked-card--compact a4-calculation-band"
            data-calculation-step="one-way-shear-${String(E).toLowerCase()}">
            <header><b>02.${E==="A"?"3":"4"} · แรงเฉือนทางเดียว ทิศ ${E}</b>
              <em>${Ht(xt)}</em></header>
            ${ve(xt,`SF-EQ-ONE-WAY-SHEAR-${E}`)||`${Gt(`SF-EQ-ONE-WAY-SHEAR-${E}`)}
            <p class="a4-worked-substitution a4-math-row"><span>แนววิกฤต</span><strong>
              x = d = ${l(e(R,["criticalDistanceFromColumnFaceM"],n),"m",3)} · d = ${l(e(R,["depthMm"],n),"mm",0)}</strong></p>
            <p class="a4-worked-substitution a4-math-row"><span>แทนค่ากำลัง</span><strong>
              ρ<sub>w</sub> = ${ut(e(R,["rhoW"],n),5)} ·
              V<sub>c,ρ</sub> / V<sub>c,cap</sub> =
              ${l(e(R,["vcRhoKNPerM"],n),"kN/m",2)} / ${l(e(R,["vcCapKNPerM"],n),"kN/m",2)} · V<sub>c,governing</sub> =
              ${l(e(R,["governingVcKNPerM"],n),"kN/m",2)}</strong></p>
            <p class="a4-worked-result"><span>ผล</span><strong>
              V<sub>u</sub> / φV<sub>c</sub> =
              ${l(e(R,["vuKNPerM"],n),"kN/m",2)} /
              ${l(e(R,["phiVcKNPerM"],n),"kN/m",2)}</strong><em>D/C ${ut(e(R,["utilization"],n),3)} · ${Ht(xt)}</em></p>
            `}
          </article>`).join("")}

        <article class="a4-worked-card a4-worked-card--wide a4-calculation-band"
          data-calculation-step="interior-punching">
          <header><b>02.5 · แรงเฉือนทะลุรอบเสากลาง</b>
            <em>${Ht("punching-shear")}</em></header>
          ${ve("punching-shear","SF-EQ-INTERIOR-PUNCHING-SHEAR")||`${Gt("SF-EQ-INTERIOR-PUNCHING-SHEAR")}
          <div class="a4-punching-values">
            <p class="a4-worked-substitution a4-math-row"><span>แนววิกฤต</span><strong>
              d = ${l(e(y,["depthMm"],n),"mm",0)} ·
              b<sub>o</sub> = ${l(e(y,["perimeterMm"],Dt),p(e(y,["perimeterMm"],n))===null?"m":"mm",p(e(y,["perimeterMm"],n))===null?3:0)} · A<sub>in</sub> = ${l(e(y,["insideAreaM2"],n),"m²",4)}</strong></p>
            <p class="a4-worked-substitution a4-math-row"><span>กำลังเฉือนคอนกรีต</span><strong>
              v<sub>c1</sub> / v<sub>c2</sub> / v<sub>c3</sub> =
              ${l(e(y,["vcCandidatesMPa.vc1"],n),"MPa",3)} / ${l(e(y,["vcCandidatesMPa.vc2"],n),"MPa",3)} / ${l(e(y,["vcCandidatesMPa.vc3"],n),"MPa",3)} · v<sub>c,governing</sub> =
              ${l(e(y,["governingVcStressMPa"],n),"MPa",3)}</strong></p>
            <p class="a4-worked-result"><span>ผล</span><strong>
              V<sub>u</sub> / φV<sub>c</sub> =
              ${l(e(y,["vuKN"],n),"kN",2)} /
              ${l(e(y,["phiVcKN"],n),"kN",2)}
            </strong><em>D/C ${ut(e(y,["utilization"],n),3)} · ${Ht("punching-shear")}</em></p>
          </div>
          `}
        </article>
      </div>
    </section>
    <section class="a4-checks" aria-label="รายการตรวจสำคัญ">
      <div class="a4-section-title"><b>03 · ผลตรวจที่คำนวณได้</b>
        <span class="a4-report-verdicts" data-document-status="${$(Fa)}">
          <strong class="a4-calculated-verdict is-${he.toLowerCase()}"
            data-calculation-result="${he}">
            ${he==="FAIL"?`${He}/${w.length} รายการผ่าน · ${qa} รายการไม่ผ่าน · FAIL`:he==="PASS"?`${He}/${w.length} รายการที่คำนวณ · ผ่าน · O.K.`:"ผลรายการที่คำนวณ · ต้องตรวจเพิ่มเติม"}${lt(Oe)?` · ควบคุม ${d(Pe[Se]||Se)}
                  D/C ${ut(Tt(Oe),3)}`:""}</strong>
          <em class="a4-document-verdict" data-a4-scope-state="NOT_EVALUATED">
            สถานะรวม · REVIEW · ขอบเขตนอก R1 ยังไม่ประเมิน
          </em>
        </span></div>
      <table><colgroup><col class="a4-check-code"><col class="a4-check-label">
        <col class="a4-check-demand"><col class="a4-check-capacity">
        <col class="a4-check-ratio"><col class="a4-check-status"></colgroup>
        <thead><tr><th>รหัส</th><th>รายการ</th><th>ค่าความต้องการ</th>
        <th>ค่าความสามารถ</th><th>D/C</th><th>สถานะ</th></tr></thead>
        <tbody>${rs(ft)||`<tr><td colspan="6">${G}</td></tr>`}</tbody></table>
      ${Pa()}
    </section>
    <section class="a4-selected-rebar" aria-label="เหล็กเสริมล่างที่เลือก">
      <div class="a4-section-title"><b>04 · เหล็กเสริมล่างที่เลือก</b>
        <span>อ่านค่าจากผลที่ประเมินแล้ว</span></div>
      ${xe("A",W)}
      ${xe("B",Z)}
    </section>
    <div class="a4-header-signoff a4-header-signoff--continuation" aria-label="ช่องลงนามต่อเนื่อง">
      <div><span>จัดทำโดย</span><i></i><b>${d(ct(s,"preparedBy"))}</b></div>
      <div><span>ตรวจสอบโดย</span><i></i><b>${d(ct(s,"checkedBy"))}</b></div>
      <div><span>อนุมัติโดย</span><i></i><b>${d(ct(s,"approvedBy"))}</b></div>
    </div>
    </article>
  </section>`},"renderReportFromEnvelope"),ee=c(t=>e(t,["equationId","id","key"],"EQ"),"equationId"),cs=c(t=>{const a=Wt(t),s=oa(a.url),o=$t(e(t,["assumptions"],[])),r=e(t,["verificationStatus","status"],a.verificationStatus);return`<article class="sf-equation-record" data-equation-id="${$(ee(t))}" data-verification-status="${$(r)}">
    <header><span>${d(ee(t))}</span>
      <h4>${d(e(t,["title","label","name"],ee(t)))}</h4>
      <strong title="${$(r)}">${d(Ua(r))}</strong></header>
    <dl class="sf-equation-ledger">
      <div><dt>สมการ (Formula)</dt><dd><code>${d(e(t,["formula","expression"],n))}</code></dd></div>
      <div><dt>การแทนค่า (Substitution)</dt><dd><code>${d(e(t,["substitution","operandsText"],n))}</code></dd></div>
      <div><dt>หน่วยมาตรฐาน (Canonical units)</dt><dd>${d(e(t,["canonicalUnits","units","unit"],n))}</dd></div>
      <div><dt>มาตรฐาน / ฉบับ (Edition)</dt><dd>${d(a.standard)} · ${d(a.edition)}</dd></div>
      <div><dt>ข้อกำหนด / รหัสสมการ</dt><dd>${d(a.clause)} · ${d(a.equation)}</dd></div>
      <div><dt>สมมติฐาน (Assumptions)</dt><dd>${o.length?o.map(i=>`<span>${d(i)}</span>`).join(""):n}</dd></div>
      <div><dt>แหล่งอ้างอิงทางการ</dt><dd>${d(a.title)}
        ${s?`<a href="${$(s)}" rel="noreferrer noopener">เปิดเอกสารทางการ</a>`:"<em>ไม่มี URL ทางการที่ใช้ได้</em>"}</dd></div>
    </dl>
  </article>`},"renderEquation"),ls=c(t=>{const a=ee(t).toUpperCase();return/SF-HOLD-/.test(a)?"holds":/SERVICE-(?:GROSS|BIAXIAL|COMBINED)|KERN/.test(a)?"bearing":/FACTORED|EFFECTIVE-DEPTH|BETA1|MATERIAL|STRENGTH-APPLICABILITY|LOAD|TH_MR|ACI_318/.test(a)?"strength":/FLEXURE-A|MINIMUM-STEEL-A|PROVIDED-REBAR-A|TENSION-CONTROL-A/.test(a)?"flexure-a":/FLEXURE-B|MINIMUM-STEEL-B|PROVIDED-REBAR-B|TENSION-CONTROL-B|BAND-DISTRIBUTION/.test(a)?"flexure-b":/ONE-WAY-SHEAR|PUNCHING/.test(a)?"shear":/BAR-CUT|TAKEOFF/.test(a)?"detailing":"strength"},"calculationChapterKey"),Ot=c(({number:t,id:a,eyebrow:s,title:o,status:r="",body:i})=>`<section
  class="calc-chapter" id="${$(a)}">
  <b aria-hidden="true">${tt(t)}</b>
  <div>
    <header><div><span>${tt(s)}</span><h4>${tt(o)}</h4></div>
      ${r?`<em>${d(r)}</em>`:""}</header>
    ${i}
  </div>
</section>`,"renderCalculationChapter"),ka=c(t=>{const a=t.data,s=e(a,["project"],{}),o=e(a,["designBasis"],{}),r=ra(a),i=jt(a),u=e(a,["limitations"],[]),h=Ne(a),g=e(a,["loads"],{}),x=e(g,["service"],{}),b=e(g,["factored"],{}),S=e(a,["bearing"],{}),f=e(a,["geometry"],{}),A=e(a,["reinforcement"],{}),B=e(a,["flexure"],{}),y=e(B,["A","a"],{}),C=e(B,["B","b"],{}),w=e(a,["oneWayShear"],{}),T=e(w,["A","a"],{}),I=e(w,["B","b"],{}),q=e(a,["punching"],{}),M=ot(A,"A"),v=ot(A,"B"),N=L(f,"footing","width"),D=L(f,"footing","length"),at=L(f,"footing","thickness"),st=L(f,"column","width"),H=L(f,"column","length"),V=k(e(o,["profileId","resolvedProfile.profileId"],t.profileId||n)),U=k(e(o,["displayLabel","profileLabel","label","resolvedProfile.displayLabel"],V)),j=c(P=>i.find(_=>et(_)===P)||{},"calcCheck"),W=["bearing-capacity","full-contact-qmin","flexure-capacity-a","provided-steel-a","flexure-capacity-b","provided-steel-b","one-way-shear-a","one-way-shear-b","punching-shear"].map(j).filter(P=>et(P)!=="CHECK"&&lt(P)),Z=i.filter(lt),mt=Z.filter(P=>nt(P)==="FAIL"),Ct=[...W,...mt].filter((P,_,J)=>J.findIndex(Rt=>et(Rt)===et(P))===_),pt=Z.filter(P=>nt(P)==="PASS").length,At=mt.length,Bt=At>0?"พบรายการไม่ผ่าน · FAIL":Z.length>0&&pt===Z.length?"รายการที่ประเมินแล้วผ่าน · OK":"ยังไม่มีรายการที่ประเมินครบ",Dt=At>0?{className:"is-fail",label:"FAIL"}:Z.length>0&&pt===Z.length?{className:"is-pass",label:"OK"}:{className:"is-neutral",label:"—"},ht=c(P=>{const _=lt(P),J=nt(P);return`<tr class="${Nt(J)}" data-summary-check="${$(et(P))}">
      <th scope="row">${d(Yt(P))}</th>
      <td data-label="ค่าความต้องการ">${_?It(ce(P)):"—"}</td>
      <td data-label="ค่าความสามารถ">${_?It(le(P)):"—"}</td>
      <td data-label="D/C">${_?ut(Tt(P),3):"—"}</td>
      <td data-label="ผลตรวจ"><strong>${d(re(P))}</strong></td>
    </tr>`},"summaryCheckRow"),K=c((P,_)=>{const J=j(P),Rt=lt(J);return Rt?`<p class="calc-story-check ${Nt(nt(J))}">
      <span>${tt(_)}</span>
      <b>${Rt?`${It(ce(J))} / ${It(le(J))}`:G}</b>
      <em>${Rt&&k(Tt(J))!==n?`D/C ${ut(Tt(J),3)} · ${d(re(J))}`:d(re(J))}</em>
    </p>`:`<p class="calc-story-scope">
        <span>${tt(_)}</span>
        <em>ไม่รวมในขอบเขตการคำนวณรุ่นนี้</em>
      </p>`},"conciseCheck"),dt=c(P=>{if(!ia(P))return"";const _=Wt(P),J=ee(P);return`<div class="calc-story-equation calc-story-equation--worked">
      <span>หลักฐานสมการ · ${d(_.sourceId)} · ${d(_.clause)}</span>
      ${Ma({id:J,formula:k(_.formula),loads:g,applicabilityConfirmation:e(o,["loadApplicabilityConfirmation"],{}),surface:"flow07"})}
      <p class="calc-story-equation__substitution">
        <span>แทนค่า</span><strong>${d(_.substitution)}</strong>
      </p>
    </div>`},"conciseEquation"),X=c(P=>`<dl class="calc-story-values">${P.map(([_,J])=>`<div><dt>${_}</dt><dd>${J}</dd></div>`).join("")}</dl>`,"factList"),bt=r.reduce((P,_)=>{const J=ls(_);return P[J]||(P[J]=[]),P[J].push(_),P},{}),Q=c((P,_="")=>{const J=bt[P]||[];return _&&J.find(Rt=>ee(Rt)===_)||J[0]},"chapterEquation"),ft=c(P=>bt[P]?.length?`<div class="sf-equations">${bt[P].map(cs).join("")}</div>`:`<p class="is-review"><strong>${G}</strong> ไม่มีสมการในบทนี้</p>`,"equationBody"),_t=[{number:"01",id:"sf-calc-design-basis",label:"ฐานออกแบบ",title:"ข้อมูลโครงการและฐานการออกแบบ"},{number:"02",id:"sf-calc-bearing",label:"แรงดันดิน",title:"น้ำหนักใช้งาน แรงดันดิน และเงื่อนไขสัมผัส"},{number:"03",id:"sf-calc-strength-load",label:"แรงประลัย",title:"ชุดรวมน้ำหนัก แรงดันสุทธิ และเรขาคณิตกำลัง"},{number:"04",id:"sf-calc-flexure-a",label:"ดัด A",title:"กำลังดัดและเหล็กเสริมทิศ A"},{number:"05",id:"sf-calc-flexure-b",label:"ดัด B",title:"กำลังดัดและเหล็กเสริมทิศ B"},{number:"06",id:"sf-calc-shear",label:"แรงเฉือน",title:"เฉือนทางเดียวและเฉือนทะลุ"},{number:"07",id:"sf-calc-detailing",label:"เหล็ก/Bar Cut",title:"รูปทรงเหล็ก ความยาวตัด และปริมาณ"},{number:"08",id:"sf-calc-checks",label:"ทะเบียนตรวจ",title:"ค่าความต้องการ ความสามารถ D/C และสถานะ"},{number:"09",id:"sf-calc-holds",label:"HOLD",title:"ข้อจำกัดและรายการที่ยังไม่ประเมิน"},{number:"10",id:"sf-calc-trace",label:"Trace",title:"แหล่งอ้างอิงและลายนิ้วมือ Snapshot"}];return`<section class="sf-snapshot-surface sf-snapshot-surface--calc calculation-book" lang="th"
    ${Xt(t,"calc")} aria-label="รายการคำนวณฐานรากแผ่">
    <header class="sf-surface-heading">
      <div><span>รายการคำนวณฐานรากแผ่ · CALCULATION BOOK</span>
        <h3>วิธีคำนวณเต็มรูปแบบทีละขั้นตอน</h3>
        <p>${d(ct(s,"projectName","name"))} · ${d(ct(s,"memberMark","mark"))} · ${d(U)} · Snapshot ${d(t.snapshotId)}</p></div>
      <strong class="sf-status-token ${Nt(h.status)}">${d(h.label)}</strong>
    </header>
    <section class="calc-narrative" aria-label="วิธีคำนวณเต็มรูปแบบทีละขั้นตอน">
      <header class="calc-narrative__header"><span>WORKED CALCULATION</span>
        <h4>ข้อมูลตั้งต้น → แรงดันดิน → กำลัง → ผลตรวจและ Trace</h4>
        <p>ตัวเลขทุกค่าดึงจาก Calculation Snapshot เดียวกับหน้าสรุป 3D แบบ และรายงาน A4</p></header>
      <div class="calc-story-list">
        <article class="calc-story-card" id="sf-story-input" data-calculation-step="1">
          <b class="calc-story-number">01</b><div>
            <header><span>ข้อมูลออกแบบและโพรไฟล์ที่ระบบจับคู่แล้ว</span>
              <h5>Design data · Resolved Design Standard profile</h5></header>
            ${X([["ฐานราก B × L × t",`${l(N,"m",2)} × ${l(D,"m",2)} × ${l(at,"m",2)}`],["เสา b × l",`${l(st,"m",2)} × ${l(H,"m",2)}`],["โพรไฟล์ที่ระบบเลือกใช้",`${d(U)}<br><small>${d(V)}</small>`],["มาตรฐานกำลังชิ้นส่วน",d(e(o,["memberStrengthStandard","resolvedProfile.memberStandard"],n))],["มาตรฐานชุดน้ำหนัก",`${d(e(o,["loadStandard.displayLabel","resolvedProfile.loadStandard.displayLabel","loadCombination.standard"],n))}<br><small>${d(e(o,["loadCombination.clause"],n))} · ${d(e(o,["loadCombination.equation","loadCombination.label"],n))}</small>`],["ชุดรวมน้ำหนัก",d(e(o,["loadCombination.label","loadCombination.equation","loadCombination"],n))],["ระยะยื่น A / B",`${l(e(f,["cantileversM.A","cantilevers.A"],n),"m",3)} / ${l(e(f,["cantileversM.B","cantilevers.B"],n),"m",3)}`],["เหล็กที่เลือก",`${d(Et(M,"BAR-A"))}<br>${d(Et(v,"BAR-B"))}`]])}
            ${K("strength-applicability","ขอบเขตใช้การตรวจกำลัง R1")}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-self-weights" data-calculation-step="2">
          <b class="calc-story-number">02</b><div>
            <header><span>น้ำหนักฐานและดินเหนือฐาน</span>
              <h5>Footing self-weight · soil-overburden self-weight · Pservice,gross</h5></header>
            ${X([["Pservice,gross",l(e(x,["grossReactionKN","gross"],n),"kN",2)],["น้ำหนักฐาน / ดินถม",`${l(e(x,["footingWeightKN"],n),"kN",2)} / ${l(e(x,["soilOverburdenWeightKN"],n),"kN",2)}`]])}
            ${dt(Q("bearing","SF-EQ-SERVICE-GROSS-WEIGHTS"))}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-bearing" data-calculation-step="3">
          <b class="calc-story-number">03</b><div>
            <header><span>แรงดันดินใช้งานและการสัมผัส</span>
              <h5>q1–q4 → qmin / qmax → SBC → kern / full contact</h5></header>
            ${X([["แรงดันมุม q1 / q2 / q3 / q4",De(S).map(P=>l(P,"kPa",2)).join(" / ")],["qmin / qmax",`${l(e(S,["qMinKPa","qMin"],n),"kPa",2)} / ${l(e(S,["qMaxKPa","qMax"],n),"kPa",2)}`],["SBC ที่ยอมให้",l(e(S,["sbcGrossKPa","sbc"],n),"kPa",2)],["การสัมผัสดิน / Kern",`${e(S,["fullContact"],!1)?"เต็มพื้นที่":"ต้องทบทวน"} · ${ut(e(S,["combinedKernRatio"],n),3)}`]])}
            <div class="calc-story-checks">
              ${K("bearing-capacity","qmax / SBC")}
              ${K("full-contact-qmin","qmin ≥ 0 · สัมผัสดินเต็มพื้นที่")}
              ${K("combined-kern","แกนกลางหนึ่งในสามแบบสองทิศ")}
            </div>
            ${dt(Q("bearing","SF-EQ-SERVICE-BIAXIAL-PRESSURE"))}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-strength" data-calculation-step="4">
          <b class="calc-story-number">04</b><div>
            <header><span>แรงประลัยและสมดุลแรงดัน</span>
              <h5>Factored column load · gross/net equilibrium</h5></header>
            ${X([["Pu,column",l(e(b,["columnReactionKN","column"],n),"kN",2)],["qu,gross / qu,net",`${l(e(b,["grossPressureKPa","grossPressure"],n),"kPa",2)} / ${l(e(b,["netPressureKPa","netPressure"],n),"kPa",2)}`]])}
            ${dt(Q("strength",e(g,["combination.id"],n)==="TH_MR_2566_C7_1_4D_1_7L"?"SF-EQ-TH_MR_2566_C7_1_4D_1_7L":`SF-EQ-${k(e(g,["combination.id"],n))}`))}
            ${dt(Q("strength","SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM"))}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-depths" data-calculation-step="5">
          <b class="calc-story-number">05</b><div>
            <header><span>ระยะยื่นและความลึกประสิทธิผล</span>
              <h5>Cantilevers · dA · dB · punching depth</h5></header>
            ${X([["ระยะยื่น A / B",`${l(e(f,["cantileversM.A","cantilevers.A"],n),"m",3)} / ${l(e(f,["cantileversM.B","cantilevers.B"],n),"m",3)}`],["dA / dB / d(punch)",`${l(e(f,["effectiveDepthMm.A","effectiveDepth.A"],n),"mm",0)} / ${l(e(f,["effectiveDepthMm.B","effectiveDepth.B"],n),"mm",0)} / ${l(e(f,["effectiveDepthMm.punching","effectiveDepth.punching"],n),"mm",0)}`]])}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-flexure" data-calculation-step="6">
          <b class="calc-story-number">06</b><div>
            <header><span>กำลังดัดและเหล็กเสริม</span>
              <h5>Mu / φMn และ As,required / As,provided แยกทิศ A–B</h5></header>
            <div class="calc-story-direction-grid">
              <section><h6>ทิศ A</h6>${X([["Mu / φMn",`${l(e(y,["muKNmPerM"],n),"kN·m/m",2)} / ${l(e(y,["phiMnKNmPerM"],n),"kN·m/m",2)}`],["As,strength / As,min",`${l(e(y,["asStrengthMm2PerM"],n),"mm²/m",1)} / ${l(e(y,["asMinimumMm2PerM"],n),"mm²/m",1)}`],["As,required / As,provided",`${l(e(y,["asRequiredMm2PerM"],n),"mm²/m",1)} / ${l(e(y,["asProvidedMm2PerM"],n),"mm²/m",1)}`],["เหล็กที่เลือก / ระยะเรียง",`${d(Et(M,"BAR-A"))} @ ${l(Lt(M,["spacingMm","spacing"]),"mm",1)}`]])}
                ${K("flexure-capacity-a","Mu / φMn · ทิศ A")}
                ${K("provided-steel-a","As,req / As,prov · ทิศ A")}</section>
              <section><h6>ทิศ B</h6>${X([["Mu / φMn",`${l(e(C,["muKNmPerM"],n),"kN·m/m",2)} / ${l(e(C,["phiMnKNmPerM"],n),"kN·m/m",2)}`],["As,strength / As,min",`${l(e(C,["asStrengthMm2PerM"],n),"mm²/m",1)} / ${l(e(C,["asMinimumMm2PerM"],n),"mm²/m",1)}`],["As,required / As,provided",`${l(e(C,["asRequiredMm2PerM"],n),"mm²/m",1)} / ${l(e(C,["asProvidedMm2PerM"],n),"mm²/m",1)}`],["เหล็กที่เลือก / ระยะเรียง",`${d(Et(v,"BAR-B"))} @ ${l(Lt(v,["spacingMm","spacing"]),"mm",1)}`]])}
                ${K("flexure-capacity-b","Mu / φMn · ทิศ B")}
                ${K("provided-steel-b","As,req / As,prov · ทิศ B")}</section>
            </div>
            <div class="calc-story-equation-grid">
              ${dt(Q("flexure-a","SF-EQ-FLEXURE-A"))}
              ${dt(Q("flexure-b","SF-EQ-FLEXURE-B"))}
            </div>
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-one-way-shear"
          data-calculation-step="7">
          <b class="calc-story-number">07</b><div>
            <header><span>แรงเฉือนทางเดียว ทิศ A และ B</span>
              <h5>Critical section · Vu · governing Vc · φVc · D/C</h5></header>
            <div class="calc-story-direction-grid">
              ${[["A",T,"one-way-shear-a"],["B",I,"one-way-shear-b"]].map(([P,_,J])=>`<section><h6>ทิศ ${P}</h6>${X([["dcrit / Vu",`${l(e(_,["criticalDistanceFromColumnFaceM"],n),"m",3)} / ${l(e(_,["vuKNPerM"],n),"kN/m",2)}`],["Vc,ρ / Vc,cap / Vc,governing",`${l(e(_,["vcRhoKNPerM"],n),"kN/m",2)} / ${l(e(_,["vcCapKNPerM"],n),"kN/m",2)} / ${l(e(_,["governingVcKNPerM"],n),"kN/m",2)}`],["φVc / D/C",`${l(e(_,["phiVcKNPerM"],n),"kN/m",2)} / ${ut(e(_,["utilization"],n),3)}`]])}${K(J,`Vu / φVc · ทางเดียว ${P}`)}</section>`).join("")}
            </div>
            ${dt(Q("shear","SF-EQ-ONE-WAY-SHEAR-A"))}
            ${dt(Q("shear","SF-EQ-ONE-WAY-SHEAR-B"))}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-punching" data-calculation-step="8">
          <b class="calc-story-number">08</b><div>
            <header><span>แรงเฉือนทะลุภายในรอบเสากลาง</span>
              <h5>bo · area inside perimeter · vc candidates · Vu / φVc · D/C</h5></header>
            ${X([["bo / พื้นที่ภายในแนววิกฤต",`${l(e(q,["perimeterM","criticalPerimeter"],n),"m",3)} / ${l(e(q,["insideAreaM2"],n),"m²",4)}`],["vc1 / vc2 / vc3 / vc,governing",`${l(e(q,["vcCandidatesMPa.vc1"],n),"MPa",3)} / ${l(e(q,["vcCandidatesMPa.vc2"],n),"MPa",3)} / ${l(e(q,["vcCandidatesMPa.vc3"],n),"MPa",3)} / ${l(e(q,["governingVcStressMPa"],n),"MPa",3)}`],["Vu / φVc / D/C",`${l(e(q,["vuKN"],n),"kN",2)} / ${l(e(q,["phiVcKN"],n),"kN",2)} / ${ut(e(q,["utilization"],n),3)}`]])}
            ${K("punching-shear","Vu / φVc · เฉือนทะลุ")}
            ${dt(Q("shear","SF-EQ-INTERIOR-PUNCHING-SHEAR"))}
          </div>
        </article>
        <article class="calc-story-card calc-story-card--trace" id="sf-story-trace"
          data-calculation-step="9">
          <b class="calc-story-number">09</b><div>
            <header><span>สรุปผล เหล็กที่เลือก และสายตรวจสอบ</span>
              <h5>Evaluated results · selected reinforcement · profile/source trace</h5></header>
            <section class="calc-result-summary" aria-label="สรุปผลตรวจฐานรากแผ่">
              <header>
                <div><span>สรุปผลตรวจฐานรากแผ่</span><h4>${tt(Bt)}</h4>
                  <p>ประเมินแล้ว ${Z.length} · ผ่าน ${pt} · ไม่ผ่าน ${At}</p></div>
                <strong class="${Dt.className}">${Dt.label}</strong>
              </header>
              <div class="calc-result-table-wrap">
                <table class="calc-result-table">
                  <thead><tr><th>รายการสำคัญ</th><th>ค่าความต้องการ</th>
                    <th>ค่าความสามารถ</th><th>D/C</th><th>ผลตรวจ</th></tr></thead>
                  <tbody>${Ct.map(ht).join("")}</tbody>
                </table>
              </div>
            </section>
            ${X([["เหล็กเสริมล่าง ทิศ A",`${d(Et(M,"BAR-A"))} @ ${l(Lt(M,["spacingMm","spacing"]),"mm",1)}`],["เหล็กเสริมล่าง ทิศ B",`${d(Et(v,"BAR-B"))} @ ${l(Lt(v,["spacingMm","spacing"]),"mm",1)}`],["โพรไฟล์ / แหล่งมาตรฐาน",`${d(U)} · ${d(V)}`]])}
            <ul class="calc-scope-list">
              <li>ผลรุ่นนี้ครอบคลุม bearing, flexure, one-way shear และ punching
                สำหรับฐานรากแผ่เสากลางตามโปรไฟล์ที่เลือก</li>
              <li>ข้อมูลปฐพีกลศาสตร์และเสถียรภาพของโครงการเป็นหลักฐานแยกจากผลที่ประเมินนี้</li>
              <li>สถานะเอกสารยังเป็น REVIEW จนกว่าการอนุมัติโครงการจะครบถ้วน</li>
            </ul>
            <p class="calc-story-trace-line">Calculation Snapshot ·
              <strong>${d(t.snapshotId)}</strong> · Profile
              <strong>${d(V)}</strong> · Calculation fingerprint
              <strong>${d(Jt(t,"calculationFingerprint"))}</strong></p>
          </div>
        </article>
      </div>
    </section>
    <details class="calc-evidence-vault">
      <summary><div><span>หลักฐานการคำนวณฉบับเต็ม</span>
        <b>เปิดทะเบียนสมการ แหล่งอ้างอิง และ Trace</b>
        <small>${r.length} สมการ · ${i.length} รายการตรวจ · 10 บท</small></div>
        <strong aria-hidden="true">เปิดดู</strong></summary>
      <div class="calc-evidence-vault__body">
        <nav class="calc-index" aria-label="สารบัญรายการคำนวณ">
          ${_t.map(P=>`<a href="#${$(P.id)}"><b>${P.number}</b>
                <span>${tt(P.label)}</span></a>`).join("")}
        </nav>
        <div class="report-steps calc-chapters">
          ${Ot({number:"01",id:"sf-calc-design-basis",eyebrow:"Design basis",title:"ข้อมูลโครงการและฐานการออกแบบ",status:"CALCULATION PROFILE",body:`<div class="sf-calc-basis"><dl>
              <div><dt>โครงการ / ชิ้นส่วน</dt><dd>${d(ct(s,"projectName","name"))} · ${d(ct(s,"memberMark","mark"))}</dd></div>
              <div><dt>โพรไฟล์</dt><dd>${d(e(o,["profileId","profile"],n))}</dd></div>
              <div><dt>มาตรฐานกำลังชิ้นส่วน / ฉบับ</dt><dd>${d(e(o,["memberStandard.displayLabel","resolvedProfile.memberStandard.displayLabel","memberStrengthStandard","standard","governingStandard"],n))} · ${d(e(o,["memberStandard.edition","resolvedProfile.memberStandard.edition"],n))}</dd></div>
              <div><dt>มาตรฐานชุดน้ำหนัก / ฉบับ</dt><dd>${d(e(o,["loadStandard.displayLabel","resolvedProfile.loadStandard.displayLabel","loadCombination.standard"],n))} · ${d(e(o,["loadStandard.edition","resolvedProfile.loadStandard.edition","loadCombination.edition"],n))}</dd></div>
              <div><dt>ข้อกำหนด / สมการชุดน้ำหนัก</dt><dd>${d(e(o,["loadCombination.clause"],n))} · ${d(e(o,["loadCombination.equation","loadCombination.label"],n))}</dd></div>
              <div><dt>สมการมาตรฐานต้นฉบับ</dt><dd>${d(e(o,["loadCombination.normativeEquation"],n))}</dd></div>
              <div><dt>ขอบเขตสมการที่ใช้</dt><dd>${d(e(o,["loadCombination.applicability"],n))}</dd></div>
            </dl></div>`})}
          ${Ot({number:"02",id:"sf-calc-bearing",eyebrow:"Service bearing",title:"น้ำหนักใช้งาน แรงดันดิน และเงื่อนไขสัมผัส",body:ft("bearing")})}
          ${Ot({number:"03",id:"sf-calc-strength-load",eyebrow:"Strength load",title:"ชุดรวมน้ำหนัก แรงดันสุทธิ และเรขาคณิตกำลัง",body:ft("strength")})}
          ${Ot({number:"04",id:"sf-calc-flexure-a",eyebrow:"Flexure A",title:"กำลังดัดและเหล็กเสริมทิศ A",body:ft("flexure-a")})}
          ${Ot({number:"05",id:"sf-calc-flexure-b",eyebrow:"Flexure B",title:"กำลังดัดและเหล็กเสริมทิศ B",body:ft("flexure-b")})}
          ${Ot({number:"06",id:"sf-calc-shear",eyebrow:"Shear",title:"เฉือนทางเดียวและเฉือนทะลุ",body:ft("shear")})}
          ${Ot({number:"07",id:"sf-calc-detailing",eyebrow:"Rebar / Bar Cut",title:"รูปทรงเหล็ก ความยาวตัด และปริมาณ",status:Ft,body:ft("detailing")})}
          ${Ot({number:"08",id:"sf-calc-checks",eyebrow:"Check register",title:"ค่าความต้องการ ความสามารถ D/C และสถานะ",body:`<div class="sf-calc-checks">${da(i,"รายการตรวจในรายการคำนวณ")}</div>`})}
          ${Ot({number:"09",id:"sf-calc-holds",eyebrow:"Limitations / HOLD",title:"ข้อจำกัดและรายการที่ยังไม่ประเมิน",status:G,body:`<div class="sf-calc-limitations">${ft("holds")}
              ${os(u)}</div>`})}
          ${Ot({number:"10",id:"sf-calc-trace",eyebrow:"Immutable trace",title:"แหล่งอ้างอิงและลายนิ้วมือ Snapshot",body:Wa(t)})}
        </div>
      </div>
    </details>
  </section>`},"renderCalculationBookFromEnvelope"),ds=c(t=>{const a=e(t,["items","lines","rows"],null);return a?$t(a):$t(t).filter(s=>s&&typeof s=="object")},"takeoffItems"),us=c((t,a,s)=>{const o=["A","B"].map(r=>{const i=ot(t,r),u=zt(a,r),h=it(i,`BAR-${r}`);return`<tr data-select-mark="${$(h)}">
      <th scope="row">${d(h)}</th>
      <td>${d(e(i,["direction","axis"],r))}</td>
      <td>${d(Le(i)||n)}</td>
      <td>${d(e(i,["count","barCount","quantity"],n))}</td>
      <td>${d(St(i))}</td>
      <td${z(e(i,["spacingMm","spacing","spacingDisplay"],n))}>${l(Lt(i),"mm",1)}</td>
      <td${z(e(u,["centerlineLengthMm","cutLength","centerlineLength","Lcl"],n))}>${l(e(u,["centerlineLengthMm","cutLength","centerlineLength","Lcl"],n),"mm",1)}</td>
      <td>${Ft}</td>
    </tr>`});return`<table class="sf-rebar-schedule">
    <caption>ตารางเหล็กเสริม (Rebar schedule) · ${Ft}</caption>
    <thead><tr><th>รหัสเหล็ก</th><th>ทิศ</th><th>ชั้น</th><th>จำนวน</th><th>ขนาด</th>
      <th>ระยะ</th><th>Lcl</th><th>สถานะ</th></tr></thead>
    <tbody>${o.join("")}</tbody>
  </table>
  <dl class="sf-takeoff-list">${ds(s).map(r=>{const u=e(r,["display","value","quantity","total"],null)??`${k(e(r,["count"],n))} เส้น · DB${k(e(r,["diameterMm"],n))} · Lcl ${Y(e(r,["eachCenterlineLengthM"],n),"m",3)} · รวม ${Y(e(r,["totalCenterlineLengthM"],n),"m",3)}`;return`<div><dt>${d(e(r,["label","name","mark","id"],n))}</dt>
      <dd>${d(u)}</dd></div>`}).join("")}</dl>`},"renderRebarSchedule"),Ie=c((t,a,s,o)=>`<footer class="sf-drawing-titleblock">
  <div><b>นายช่างใหญ่ Civil Apps</b><span>${tt(o)}</span></div>
  <dl>
    <dt>โครงการ</dt><dd>${d(ct(a,"projectName","name"))}</dd>
    <dt>ชิ้นส่วน</dt><dd>${d(ct(a,"memberMark","mark"))}</dd>
    <dt>ชุดผลคำนวณ</dt><dd>${d(t.snapshotId)}</dd>
    <dt>แผ่น</dt><dd>${tt(s)}</dd>
    <dt>มาตราส่วน</dt><dd>NTS · ไม่กำหนดมาตราส่วน</dd>
  </dl>
  <strong>${ne}</strong>
</footer>`,"renderDrawingTitleBlock"),wa=c((t,a)=>{const s=t.data,o=a.data,r=e(s,["project"],e(o,["project"],{})),i=e(s,["geometry"],{}),u=e(s,["reinforcement"],{}),h=e(s,["barCut"],{}),g=e(s,["takeoff"],e(o,["takeoff"],{}));return`<section class="sf-snapshot-surface sf-snapshot-surface--drawing drawing-pack" lang="th"
    ${Xt(t,"drawing")} data-authorization="not-for-construction"
    data-bbs-status="not-released" aria-label="ชุดแบบฐานรากแผ่ SF-01 ถึง SF-03">
    <header class="sf-surface-heading">
      <div><span>ชุดแบบ (Drawing Pack)</span><h3>SF-01 / SF-02 / SF-03</h3>
        <p>ทุกแผ่นอ่านรูปทรง เหล็กเสริม แบบตัดเหล็ก และรายการปริมาณจากชุดผลคำนวณเดียวกัน</p></div>
      <div><strong class="sf-status-token is-review">${ne}</strong>
        <strong class="sf-status-token is-review">${Ft}</strong></div>
    </header>
    <div class="drawing-grid sf-drawing-grid">
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-01"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-01</span><h4>แปลนฐานราก / เหล็กเสริม</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${ne}</strong></header>
        ${pa(i,u,"SF-01 แปลนฐานรากและเหล็กเสริม")}
        ${Ie(t,r,"SF-01","แปลนฐานรากและเหล็กเสริม")}
      </article>
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-02"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-02</span><h4>รูปตัด X-X · ทิศ A / ตารางเหล็กเสริม</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${ne}</strong></header>
        ${Re(i,u,"SF-02 รูปตัดฐานรากและชั้นเหล็ก")}
        ${us(u,h,g)}
        ${Ie(t,r,"SF-02","รูปตัดและตารางเหล็ก")}
      </article>
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-03"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-03</span><h4>แบบตัดเหล็กอ้างอิง / รายการปริมาณ</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${Ft}</strong></header>
        <div class="barcut-forms sf-barcut-forms">
          ${ye(h,u,"A","H-01")}
          ${ye(h,u,"B","H-02")}
        </div>
        ${Ie(t,r,"SF-03","แบบตัดเหล็กอ้างอิงและ Take-off")}
      </article>
    </div>
    <p class="sf-construction-warning"><strong>ห้ามใช้เพื่อการก่อสร้าง · ${ne}</strong>
      <span>${Ft} · ระยะพัฒนา การยึดเหนี่ยว เหล็กเดือย ค่าคลาดเคลื่อน
        และการอนุมัติผลิตไม่รวมในผลคำนวณรุ่นนี้</span>
    </p>
  </section>`},"renderDrawingFromEnvelope"),Ca=c(t=>{const a={summary:gt(ke(t),"selectSpreadFootingSummaryData"),dc:gt(Ye(t),"selectSpreadFootingChecksData"),analysis:gt(Qe(t),"selectSpreadFootingDiagramData"),section:gt(Je(t),"selectSpreadFootingSectionData"),three:gt(We(t),"selectSpreadFooting3DData"),report:gt(Ze(t),"selectSpreadFootingReportData"),calc:gt(Xe(t),"selectSpreadFootingCalculationBookData"),drawing:gt(Ge(t),"selectSpreadFootingDrawingData"),takeoff:gt(ta(t),"selectSpreadFootingTakeoffData")},s=a.summary;for(const[o,r]of Object.entries(a))Ee(s,r,o);return a},"selectSurfaceEnvelopes"),Ba=c((t,a={})=>({summary:yt($a(t.summary)),dc:yt(fa(t.dc,t.summary)),analysis:yt(ya(t.analysis,a)),section:yt(xa(t.section)),three:yt(va(t.three)),report:yt(Aa(t.report)),calc:yt(ka(t.calc)),drawing:yt(wa(t.drawing,t.takeoff))}),"renderSurfaceMarkupFromSelected"),wt=c((t,a)=>t.find(s=>et(s)===a)||null,"findCheck"),vt=c((t,a="—")=>{const s=p(Tt(t));return s===null?a:ut(s,3)},"conciseRatio"),Ut=c(t=>{const a=p(t);return a===null?null:a/9.80665},"pressureTonnesPerSquareMeter"),ms=c(t=>{const a=t.summary.data,s=jt(t.dc.data),o=e(a,["geometry"],{}),r=e(a,["bearing"],{}),i=L(o,"footing","width"),u=L(o,"footing","length"),h=L(o,"footing","thickness"),g=p(i)!==null&&p(u)!==null?p(i)*p(u):null,x=e(r,["qMaxKPa","qMax","qmax"],n),b=e(r,["sbcGrossKPa","sbc","allowable"],n),S=e(r,["sbcSource","capacitySource"],n),f=wt(s,"bearing-capacity"),A=wt(s,"flexure-capacity-a"),B=wt(s,"flexure-capacity-b"),y=wt(s,"one-way-shear-a"),C=wt(s,"one-way-shear-b"),w=e(a,["governingCheck"],f||{});return`<article class="sf-metric-card">
      <span>รูปทรง · A × B × t</span>
      <strong>${O(i,2)} × ${O(u,2)} <small>m</small></strong>
      <p>พื้นที่ ${O(g,2)} m² · หนา ${O(h,2)} m</p>
    </article>
    <article class="sf-metric-card">
      <span>แรงดันดิน · q<sub>service,max</sub> / SBC</span>
      <strong>${O(Ut(x),2)} / ${O(Ut(b),2)}</strong>
      <p>D/C ${vt(f)} · ${nt(f)}<small class="sf-bearing-source">ที่มา SBC: ${d(S)}</small></p>
    </article>
    <article class="sf-metric-card">
      <span>หลักฐานด้านกำลัง · D/C</span>
      <strong>ดัด ${vt(A)} / ${vt(B)}</strong>
      <p>เฉือนทางเดียว ${vt(y)} / ${vt(C)} · ดูรายละเอียดในแท็บตรวจ D/C</p>
    </article>
    <article class="sf-metric-card metric-strip__review">
      <span>รายการควบคุม</span>
      <strong>${d(Yt(w))}</strong>
      <p>D/C ${vt(w,"ไม่ใช้ค่าเชิงตัวเลข")} · ${nt(w)}
        · อ่านจาก Calculation Snapshot</p>
    </article>`},"renderParityMetricStrip"),ps=c(t=>{const a=jt(t.dc.data);return[["bearing-capacity","แรงดันดินใช้งาน"],["full-contact-qmin","สัมผัสดินเต็มพื้นที่"],["flexure-capacity-a","ดัดทิศ A"],["flexure-capacity-b","ดัดทิศ B"],["one-way-shear-a","เฉือนทางเดียวทิศ A"],["one-way-shear-b","เฉือนทางเดียวทิศ B"],["punching-shear","เฉือนทะลุ · เสากลาง"]].map(([o,r])=>{const i=wt(a,o);if(!lt(i))return null;const u=nt(i);return{id:o,label:r,value:vt(i,"—"),status:u,className:Nt(u)}}).filter(Boolean).map(o=>`<li class="${$(o.className)}" data-check-id="${$(o.id)}">
        <b>${d(o.value)}</b><span>${tt(o.label)}</span><em>${d(o.status)}</em>
      </li>`).join("")},"renderParityGoverningList"),hs=c(t=>{const s=jt(t.dc.data).filter(lt),o=s.filter(i=>Pt(e(i,["status"],""))==="PASS"),r=s.filter(i=>Pt(e(i,["status"],""))==="FAIL");return`<div class="panel-title">
      <div><span>ขอบเขตชุดผลคำนวณ</span>
        <h3>ผลทุกแท็บอ่านจาก Calculation Snapshot ชุดเดียว</h3></div>
      <span class="reference-badge reference-badge--ready">SNAPSHOT READY</span>
    </div>
    <div class="coverage-grid" data-snapshot-id="${$(t.summary.snapshotId)}">
      <div><b>01</b><span>ประเมินแล้ว ${s.length} รายการ · PASS ${o.length} · FAIL ${r.length}</span></div>
      <div><b>02</b><span>ผลหลักแสดงเฉพาะรายการที่คำนวณได้เป็น OK หรือ FAIL</span></div>
      <div><b>03</b><span>หน้าจอหลักแสดงอัตราส่วนแบบย่อ รายการสมการฉบับเต็มอยู่ในรายการคำนวณ</span></div>
      <div><b>04</b><span>A4 ชุดแบบ และ Bar Cut อ่านข้อมูลจาก Snapshot เดียวกัน</span></div>
    </div>`},"renderParityCoverage"),bs=c(t=>{const a=t.section.data,s=t.summary.data,o=jt(t.dc.data),r=e(a,["geometry"],{}),i=e(a,["reinforcement"],{}),u=e(a,["barCut"],{}),h=e(s,["bearing"],{}),g=ot(i,"A"),x=ot(i,"B"),b=zt(u,"A"),S=zt(u,"B"),f=L(r,"footing","width"),A=L(r,"footing","length"),B=L(r,"footing","thickness"),y=e(de(r),["coverM","cover"],n),C=e(g,["effectiveDepthMm"],e(r,["effectiveDepthMm.A"],n)),w=e(x,["effectiveDepthMm"],e(r,["effectiveDepthMm.B"],n)),T=Ut(e(h,["qMinKPa","qMin"],n)),I=Ut(e(h,["qMaxKPa","qMax"],n)),q=wt(o,"flexure-capacity-a"),M=wt(o,"flexure-capacity-b"),v=wt(o,"one-way-shear-a"),N=wt(o,"one-way-shear-b"),D=e(b,["centerlineLengthMm","cutLength","Lcl"],n),at=e(S,["centerlineLengthMm","cutLength","Lcl"],n);return`<div class="panel-title">
      <div><span>การเชื่อมโยงรูปตัด</span><h3>ความสัมพันธ์รูปตัดกับ D/C, 3D และแบบ</h3></div>
      <span class="reference-badge">Calculation Snapshot เดียว</span>
    </div>
    <div class="section-meta">
      <div class="section-meta-card"><span>A, B, t</span><strong>${O(f,2)} × ${O(A,2)} × ${O(B,2)} m</strong>
        <small>รูปทรงเดียวกับแปลน 3D A4 และชุดแบบ</small></div>
      <div class="section-meta-card"><span>ระยะหุ้ม / ขนาดเหล็ก</span><strong>${O(p(y)===null?null:p(y)*1e3,0)} mm / ${St(g)} + ${St(x)}</strong>
        <small>การรับรองความทนทานตามโครงการไม่รวมในผลคำนวณรุ่นนี้</small></div>
      <div class="section-meta-card"><span>dA / dB</span><strong>${O(C,0)} / ${O(w,0)} mm</strong><small>อ่านจากเรขาคณิตชั้นเหล็กใน Snapshot</small></div>
      <div class="section-meta-card"><span>D/C สรุปหลัก</span><strong>ดัด ${vt(q)}/${vt(M)} · เฉือน ${vt(v)}/${vt(N)}</strong><small>สมการและการแทนค่าอยู่ในรายการคำนวณเท่านั้น</small></div>
      <div class="section-meta-card"><span>แรงดันใช้งาน</span><strong>qmin ${O(T,2)} · qmax ${O(I,2)} t/m²</strong><small>เชื่อมโยงถึงสนามแรงดันใน 3D</small></div>
      <div class="section-meta-card"><span>แบบตัดเหล็กตามแนวแกน</span><strong>${d(it(g,"BAR-A"))} ${O(D,0)} · ${d(it(x,"BAR-B"))} ${O(at,0)} mm/เส้น</strong><small>${Ft} · ldh และการผลิตไม่รวมในรุ่นนี้</small></div>
    </div>`},"renderSectionMeta"),gs=c(t=>{const a=t.section.data,s=t.summary.data,o=e(s,["project"],{}),i=`${k(ct(o,"memberMark","mark","memberId"),"F")}-D`,u=jt(t.dc.data),h=e(a,["geometry"],{}),g=e(a,["reinforcement"],{}),x=e(a,["barCut"],{}),b=e(s,["bearing"],{}),S=e(b,["sbcSource","capacitySource"],n),f=ot(g,"A"),A=ot(g,"B"),B=zt(x,"A"),y=zt(x,"B"),C=c((M,v,N)=>{const D=ue(M),at=k(it(v,`BAR-${M}`)),st=wt(u,`flexure-capacity-${M.toLowerCase()}`),H=wt(u,`one-way-shear-${M.toLowerCase()}`),V=e(v,["count","barCount"],n),U=e(v,["spacingMm"],n),j=e(v,["effectiveDepthMm"],n),F=e(de(h),["coverM","cover"],n),W=e(N,["verticalTangentMm","verticalTail","tail","Bcl"],n),Z=e(N,["centerlineLengthMm","cutLength","Lcl"],n);return{mark:at,controlLabel:`${at} · ${D.direction}/${D.axis}`,title:`${at} · ${D.direction}/${D.axis} ${D.axisSymbol} · ${D.layer}`,layer:`${D.orientation}ตามแกน ${D.axis} · ${D.layer}`,detail:`${k(V)}-${St(v)} · ระยะ ${O(U,1)} mm · ขาตรง ${O(W,0)} mm · Lcl ${O(Z,0)} mm`,depth:`ระยะหุ้ม ${O(p(F)===null?null:p(F)*1e3,0)} mm · d${M} ${O(j,0)} mm`,check:`ดัด D/C ${vt(st)} · เฉือน D/C ${vt(H)}`,trace:`${t.summary.snapshotId} · ${et(st)} · ${et(H)}`,auth:"SNAPSHOT CURRENT · รูปทรงเชิงทฤษฎี"}},"evidenceForBar"),w=wt(u,"bearing-capacity"),T=wt(u,"punching-shear"),I=Ut(e(b,["qMinKPa","qMin"],n)),q=Ut(e(b,["qMaxKPa","qMax"],n));return{barA:C("A",f,B),barB:C("B",A,y),dowel:{mark:i,title:`${i} · ขอบเขตรอยต่อเสากับฐานราก`,layer:"รอยต่อเสากับฐานรากเท่านั้น",detail:"ขนาด จำนวน เหล็กปลอก ระยะฝัง และระยะทาบยังไม่ประเมิน",depth:"การถ่ายแรงและระยะยึดเหนี่ยวไม่รวมในผลคำนวณรุ่นนี้",check:G,trace:`${t.summary.snapshotId} · dowels · column-footing-transfer`,auth:`${G} · รายละเอียดรอยต่อไม่รวมในรุ่นนี้`},critical:{mark:"PUNCH",title:"PUNCH · แนววิกฤตเฉือนทะลุ",layer:"แนวรอบวิกฤตจากเรขาคณิต Snapshot",detail:`D/C ${vt(T)} · ${nt(T)}`,depth:"ใช้ d สำหรับเฉือนทะลุจาก Snapshot",check:`${Yt(T)} · D/C ${vt(T)}`,trace:`${t.summary.snapshotId} · ${et(T)}`,auth:"SNAPSHOT CURRENT · ผลตรวจเฉือนทะลุ"},pressure:{mark:"SOIL",title:"ดิน · สนามแรงดันดินจาก Calculation Snapshot",layer:"แรงดันใช้งานที่สี่มุม",detail:`qmin ${O(I,2)} · qmax ${O(q,2)} t/m²`,depth:"สนามแรงดันอ่านจากชุดข้อมูล 3D เดียวกับ Summary",check:`D/C ${vt(w)} · ${nt(w)} · ที่มา SBC: ${k(S)}`,trace:`${t.summary.snapshotId} · ${et(w)}`,auth:"SNAPSHOT CURRENT · ผลตรวจแรงดันดิน"}}},"buildModelEvidence"),Mt=c((t,a,s="outer")=>({surface:t,selector:a,take:s}),"hydrationFragment"),$s=c(t=>ge({summary:{regions:[{slot:"summary-metrics",html:ms(t)},{slot:"summary-bearing-fallback",mode:"replace",fragments:[Mt("summary",".summary-bearing-isometric")]},{slot:"summary-governing",html:ps(t)},{slot:"summary-section",mode:"replace",fragments:[Mt("summary",".sf-section-svg")]},{slot:"summary-coverage",html:hs(t)},{slot:"summary-badge",mode:"text",text:`Calculation Snapshot · ${t.summary.snapshotId}`},{slot:"summary-bearing-badge",mode:"text",text:"3D แบบโต้ตอบ · อ่านรูปทรงและแรงดันจาก Snapshot"},{slot:"summary-bearing-readout",html:`<b>qmin / qmax / SBC</b><span>${O(Ut(e(t.summary.data.bearing,["qMinKPa","qMin"],n)),2)} / ${O(Ut(e(t.summary.data.bearing,["qMaxKPa","qMax"],n)),2)} / ${O(Ut(e(t.summary.data.bearing,["sbcGrossKPa","sbc"],n)),2)} t/m²</span>`}]},dc:{regions:[{slot:"dc-title",mode:"text",text:"รายการตรวจสอบจาก Calculation Snapshot"},{slot:"dc-badge",mode:"text",text:"แสดง D/C และสถานะรายข้อ"},{slot:"dc-content",mode:"replace",fragments:[Mt("dc",".sf-dc-source"),Mt("dc",".dc-table-wrap")]}]},analysis:{regions:[{slot:"analysis-moment-a",fragments:[Mt("analysis",'.sf-analysis-diagram[data-direction="A"][data-diagram="moment"]',"inner")]},{slot:"analysis-shear-a",fragments:[Mt("analysis",'.sf-analysis-diagram[data-direction="A"][data-diagram="shear"]',"inner")]},{slot:"analysis-moment-b",fragments:[Mt("analysis",'.sf-analysis-diagram[data-direction="B"][data-diagram="moment"]',"inner")]},{slot:"analysis-shear-b",fragments:[Mt("analysis",'.sf-analysis-diagram[data-direction="B"][data-diagram="shear"]',"inner")]},{slot:"analysis-deflection",fragments:[Mt("analysis",".sf-symbolic-settlement","inner")]}]},section:{regions:[{slot:"section-geometry",html:`<div class="panel-title"><div><span>แปลน รูปตัด และแบบตัดเหล็ก</span>
          <h3>รูปทรงและเหล็กเสริมจาก Calculation Snapshot</h3></div>
          <span class="reference-badge reference-badge--ready">SNAPSHOT CURRENT</span></div>`,fragments:[Mt("section",".sf-section-diagrams"),Mt("section",".barcut-detail-card")]},{slot:"section-meta",html:bs(t)}]},three:{regions:[{slot:"three-fallback",mode:"replace",fragments:[Mt("three",".three-bearing-isometric")]},{slot:"three-badge",mode:"text",text:`Calculation Snapshot · ${t.three.snapshotId}`},{slot:"three-model-badge",mode:"text",text:`CALCULATION SNAPSHOT · ${t.three.snapshotId} · ตำแหน่งจริง · NTS`}]},report:{regions:[{slot:"report-content",fragments:[Mt("report",".sf-snapshot-surface--report")]}]},calc:{regions:[{slot:"calc-content",fragments:[Mt("calc",".sf-snapshot-surface--calc","inner")]}]},drawing:{regions:[{slot:"drawing-content",fragments:[Mt("drawing",".sf-drawing-grid","inner")]}]}}),"buildHydrationPanels");export const renderSpreadFootingSnapshotHydrationPlan=c((t,a={})=>{const s=Ca(t),o=Ba(s,a);if(Object.keys(o).join("|")!==aa.join("|"))throw new TypeError("Spread Footing renderer surface order is invalid");const r=s.summary;return we({snapshotId:r.snapshotId,payloadHash:r.payloadHash,fingerprint:r.fingerprint,calculationFingerprint:Jt(r,"calculationFingerprint"),markup:o,panels:$s(s),modelEvidence:ge(gs(s))})},"renderSpreadFootingSnapshotHydrationPlan"),renderSpreadFootingSummarySurface=c(t=>yt($a(gt(ke(t),"selectSpreadFootingSummaryData"))),"renderSpreadFootingSummarySurface"),renderSpreadFootingChecksSurface=c(t=>{const a=gt(Ye(t),"selectSpreadFootingChecksData"),s=gt(ke(t),"selectSpreadFootingSummaryData");return Ee(a,s,"summary for D/C"),yt(fa(a,s))},"renderSpreadFootingChecksSurface"),renderSpreadFootingAnalysisSurface=c((t,a={})=>yt(ya(gt(Qe(t),"selectSpreadFootingDiagramData"),a)),"renderSpreadFootingAnalysisSurface"),renderSpreadFootingSectionSurface=c(t=>yt(xa(gt(Je(t),"selectSpreadFootingSectionData"))),"renderSpreadFootingSectionSurface"),renderSpreadFootingThreeSurface=c(t=>yt(va(gt(We(t),"selectSpreadFooting3DData"))),"renderSpreadFootingThreeSurface"),renderSpreadFootingReportSurface=c(t=>yt(Aa(gt(Ze(t),"selectSpreadFootingReportData"))),"renderSpreadFootingReportSurface"),renderSpreadFootingCalculationBookSurface=c(t=>yt(ka(gt(Xe(t),"selectSpreadFootingCalculationBookData"))),"renderSpreadFootingCalculationBookSurface"),renderSpreadFootingDrawingSurface=c(t=>{const a=gt(Ge(t),"selectSpreadFootingDrawingData"),s=gt(ta(t),"selectSpreadFootingTakeoffData");return Ee(a,s,"takeoff"),yt(wa(a,s))},"renderSpreadFootingDrawingSurface"),renderSpreadFootingSnapshotSurfaces=c((t,a={})=>{const s=Ca(t),o=Ba(s,a);if(Object.keys(o).join("|")!==aa.join("|"))throw new TypeError("Spread Footing renderer surface order is invalid");return we(o)},"renderSpreadFootingSnapshotSurfaces");

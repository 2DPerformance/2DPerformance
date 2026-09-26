/**
 * เครื่องยนต์ออกแบบกำแพงกันดิน — สมการล้วน ไม่แตะ DOM
 *
 * ที่มา: พอร์ตจาก changkid-engapp.com/retaining-wall ซึ่งเจ้าของระบบเป็นเจ้าของงาน
 * ดูสายหลักฐานเต็มและ SHA-256 ที่ public/retaining-wall/SOURCE-MANIFEST.json
 *
 * สมการหลักและแหล่งอ้างอิง
 *   Rankine  K_a = tan²(45° − φ′/2) · หลังลาด β ใช้รูปเต็ม
 *   Coulomb  FHWA NHI-01-094 Eq.6-2 · USACE EM 1110-2-2502 §3-5   (δ ความฝืดผนัง, θ ผนังเอียง)
 *   M-O      K_ae · θ = arctan[k_h/(1−k_v)] · ใช้ได้เมื่อ φ ≥ θ + β เท่านั้น
 *            [Okabe 1926 · Mononobe–Matsuo 1929] — นอกโดเมนต้อง fail closed ห้ามแทนค่า
 *   แรงเฉือน φV_c = φ_v·0.17·√f′c·b_w·d                    [ACI 318-14 Eq.22.5.5.1]
 *            รับแรงอัดแกน  ×(1 + N_u/(14·A_g))              [ACI 318-14 Eq.22.5.6.1]
 *   แบกทาน   Meyerhof/Vesic + ความกว้างประสิทธิผล B′ = B − 2e
 *   เสาเข็ม  Winkler beam-on-elastic-foundation (k_s = 67·S_u/B ตาม Davisson)
 *
 * ขอบเขตของหน่วย: ภายใน engine เป็น SI ทั้งหมด (kN, m, MPa, kN/m³)
 * การแปลงหน่วยไทย (ksc/ตัน) เป็นหน้าที่ของชั้น UI ก่อนเรียก
 *
 * ⚠️ ห้ามแก้สูตร ตัวคูณ φ หรือเกณฑ์ผ่าน/ไม่ผ่านในไฟล์นี้โดยไม่มี Owner/PE อนุมัติ
 *    และต้องรัน retainingWallEngine.test.mjs ให้ผ่านครบทุกข้อ
 */

/* eslint-disable no-unused-vars */
const fmt=(v,d=2)=>isFinite(v)?Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const D2R=Math.PI/180, GW=9.81;
/* FS ที่ใหญ่ผิดปกติ = แรงขับ ≈ 0 (เช่น c สูงจน Ka·σv ≤ 2c√Ka ตลอดความลึก → แรงดัน active เป็นศูนย์)
   ห้ามพิมพ์ตัวเลขมหาศาล (เคยได้ "FS = 108,363,482,500") ลงรายงานวิศวกรรม — แสดง "> 99.9" แทน */
const FS_CAP=99.9;
const fsFmt=v=>(!isFinite(v)||v>FS_CAP)?('> '+FS_CAP.toFixed(1)):fmt(v,2);
/* ★ เกณฑ์ FS ชุดเดียวของทั้งแอป — กฎกระทรวงกำหนดฐานรากฯ พ.ศ.2566 (ข้อ 31) · แผ่นดินไหว 1.5/1.1
   เดิมเขียนเลข 2.0/1.5 ซ้ำทั้งในตารางเสถียรภาพและในรูป FAILURE MODES คนละที่ → เสี่ยงแก้ที่เดียวแล้วขัดกัน */
const FSREQ={ot:2.0, sl:1.5, bear:3.0, glob:1.5, otE:1.5, slE:1.1, globE:1.1};
/* ============================================================
   PHASE M0-M8/P1-P8 · RW DRAWING MIGRATION RUNTIME (WEB ONLY)
   ค่าเริ่มต้นปิดเสมอ · shadow ใช้ตรวจเทียบ · cutover ใช้เฉพาะ cohort ที่ Portal อนุญาต
   P8 ใช้ cache/off-DOM/Web Worker และ 3D→2D parity พร้อม Legacy rollback
   ============================================================ */
 const RW_DRAWING_MODEL_FEATURE179=(()=>{let requested='';try{requested=new URLSearchParams(location.search).get('rwDrawingModel')||'';}catch(e){}const shadow=requested==='shadow',cutover=requested==='cutover',enabled=shadow||cutover;return Object.freeze({query:'rwDrawingModel',requested,mode:cutover?'cutover':(shadow?'shadow':'off'),enabled,rendererEnabled:cutover,defaultEnabled:false,cohort:cutover?'admin-authorized-preview':''});})();
 let RW_REBAR_PLACEMENT_PROMISE179=null,RW_DRAWING_MODEL_PROMISE179=null,RW_DRAWING_STYLE_PROMISE179=null,RW_VECTOR_SCHEMA_PROMISE179=null,RW_VIEW_GENERATOR_PROMISE179=null,RW_PAPER_COMPOSER_PROMISE179=null,RW_SHEET_ENGINE_PROMISE179=null,RW_DRAWING_DOCUMENT_PROMISE179=null,RW_VISUAL_QA_PROMISE179=null,RW_QA_PIPELINE_PROMISE179=null,RW_PDF_FONT_PROMISE179=null,RW_VECTOR_RENDERERS_PROMISE179=null,RW_MODEL_PARITY_PROMISE179=null,RW_DRAWING_RUNTIME_PROMISE179=null,RW_ENGINEERING_RELEASE_PROMISE179=null,RW_CONTROLLED_CUTOVER_PROMISE179=null,RW_DRAWING_RUNTIME179=null,RW_DRAWING_MODEL_SHADOW179=null;
 let RW_DRAWING_RUN_TIMER179=null,RW_DRAWING_RUN_ACTIVE179=false,RW_DRAWING_PENDING_SOURCE179=null,RW_DRAWING_ACTIVE_SOURCE179=null;
 const RW_ESSENTIAL_CHECKS_BY_SOURCE179=new WeakMap();
/* ★ globE = เกณฑ์วงสไลด์ในสภาวะแผ่นดินไหว
   ความซื่อสัตย์: **กฎกระทรวง 2566 ข้อ 31 ไม่ได้ระบุตัวเลขสำหรับ "เสถียรภาพรวม" โดยตรง**
   (ระบุ พลิกคว่ำ 2.0 · เลื่อนไถล 1.5 · แบกทาน 3.0 · แผ่นดินไหว 1.5/1.1)
   → ใช้ 1.1 ตามระดับแผ่นดินไหวของข้อ 31 + แนวปฏิบัติสากล pseudo-static slope stability (1.1–1.2)
   → ต้องระบุที่มาบนหน้าจอ/รายงาน ห้ามอ้างว่า "ตามข้อ 31" ลอย ๆ (บทเรียน false-citation จาก build 148) */
/* ===== เสถียรภาพรวมวงสไลด์ลึก · Bishop's Simplified Method of Slices (2 ชั้นดิน) =====
   พิกัด: x จากปลายเท้า(toe)→หลัง(heel) · y ขึ้นจากใต้ฐาน(y=0)
   ค้นหาวงวิกฤต (grid: ศูนย์กลาง × แนวสัมผัสลึกใต้ฐาน) → FS ต่ำสุด
   2 ชั้น: ใต้ฐาน/หน้ากำแพง = ดินฐาน(cF,φF,γF) · หลังกำแพง = ดินถม(c,φ,γ) · กำแพง = คอนกรีต γc
   ตรวจสอบ(self-test): φ=0 → วิธี slice ≡ วิธีโมเมนต์ (เอกลักษณ์) · Bishop ≥ Fellenius(OMS) เสมอ */
function globalSlip(P){
  const DR=Math.PI/180;
  const {H,B,toe,t,hz,hp,Df,beta,q, gs,gsat,phi,cc, gsF,phiF,cF, gc, zw,gw=9.81, nSlice=26, pileToe=0, kh=0, kv=0}=P;
  const _seis=(kh>0||kv>0);   // แผ่นดินไหว (pseudo-static)
  /* pileToe = ความลึกปลายเข็มใต้ใต้ฐาน (ม.) · >0 = กำแพงบนเสาเข็ม → บังคับให้วงต้องลอด "ใต้ปลายเข็ม" เท่านั้น */
  const tanBeta=Math.tan((beta||0)*DR), Htot=H, backX=toe+t;
  /* ★ zw = 0 คือ "ระดับน้ำอยู่ที่ผิวดิน" = กรณีเลวร้ายที่สุด ไม่ใช่ "ไม่มีน้ำ"
     บั๊กเดิม (falsy-zero ตัวที่ 4 · แก้ 2569-07): `zw>0` ทำให้ zw=0 หล่นไป -1e9 = ไม่มีน้ำเลย
     → FS(zw=0.01)=0.288 กระโดดเป็น FS(zw=0)=1.040 (+261%) เพราะน้ำลดลง 1 ซม. = เป็นไปไม่ได้ทางฟิสิกส์
     → และขัดกับ engine หลักที่ `hwb=Math.max(0,H-Math.max(zw,0))` ตีความ zw=0 ว่า "น้ำเต็ม H"
       (ตารางเสถียรภาพบอก "มีแรงยก U" แต่วงสไลด์บอก "ไม่มีน้ำ" ในการคำนวณเดียวกัน)
     zw ≥ H หรือ NaN → ไม่มีน้ำ (คงเดิม) · zw ติดลบ → หนีบเป็น 0 (น้ำที่ผิวดิน) */
  const yWT=(isFinite(zw)&&zw<Htot)?(Htot-Math.max(zw,0)):-1e9;   // ระดับน้ำวัดจากใต้ฐาน (zw = ความลึกจากยอด)
  const ys=x=>{ if(x<=toe)return Df; if(x<=backX)return Htot; return Htot+Math.max(x-B,0)*tanBeta; };  // ผิวดิน: หน้า=Df · เหนือ stem/heel=ยอด · หลัง=ลาด β
  /* ★★ ขอบโดเมน — ต้องผูกกับ Htot ล้วน ๆ ห้ามมีค่าคงที่สัมบูรณ์
     บั๊กเดิม (พบ+วัด 2569-07 build 155): `xMin = -max(Df,0.5)-0.5` = -1.5 ม. คงที่
     → วงวิกฤต (xc=-2.81, R=5.09) ทอดไปถึง x=-7.9 แต่ถูก **ตัดทิ้งที่ -1.5**
     → "ตีนต้านทาน" หน้ากำแพงหายไป เหลือแต่ส่วนขับ (ทุก slice sinA>0 = ดันทางเดียว ไม่ใช่วงสไลด์จริง)
     → FS ต่ำเกินจริง + เป็นตัวทำให้เอกลักษณ์เชิงมาตราส่วนพัง (ดิน c=0 ขยาย×2 → FS เปลี่ยน -11.5%)
     ค่าคงที่ 0.3 (ความกว้างวงต่ำสุด) และ 0.05 (ความลึกต่ำสุดใต้ฐาน) ก็ไม่สเกล → ผูกกับ Htot เช่นกัน */
  /* ★ โดเมนต้องโตตาม "ความลึกที่บังคับ" ด้วย — วงที่ต้องลอดใต้ปลายเข็มลึก ๆ จะกว้างมาก
     ถ้าโดเมนแคบ วงจะถูกกฎ "ปฏิเสธวงที่ถูกตัด" เขี่ยทิ้งหมด → globalSlip คืน null → **ไม่มีเกณฑ์เลย เงียบสนิท**
     (ผมสร้างบั๊กนี้เองตอนใส่ pileToe: เข็ม ≥8 ม. → FS=null ทุกเคส · จับได้เพราะไล่ทดสอบเข็มหลายความยาว) */
  const _deepNeed=Math.max(0.03*H, pileToe);
  const xMin=-(2.6*Htot+Df+2.4*_deepNeed), xMax=B+3.0*Htot+2.4*_deepNeed;
  const wMin=0.10*Htot, dMin=0.02*Htot;   // ความกว้างวงต่ำสุด · ความลึกใต้ฐานต่ำสุด (สัดส่วน ไม่ใช่เมตรคงที่)
  const inWall=(x,y)=>(y>=0&&y<=hz&&x>=0&&x<=B)||(y>hz&&y<=Htot&&x>=toe&&x<=toe+t);   // ฐาน + stem
  const gamAt=(x,y)=>{ if(inWall(x,y))return gc; if(y<0)return gsF;                    // ใต้ฐาน=ดินฐาน
    if(x<backX)return (y<=Df?gsF:0);                                                   // หน้า/เหนือเท้า=ดินฐาน ถึง Df
    return (y<=ys(x))?(y<yWT?gsat:gs):0; };                                            // หลัง=ดินถม (ใต้น้ำ→γsat)
  const strAt=(x,y)=>(y<0||x<backX)?{c:cF,ph:phiF}:{c:cc,ph:phi};                      // ความแข็งแรงฐาน slice
  function evalCircle(xc,yc,R){
    const arc=x=>{const dx=x-xc,d=R*R-dx*dx;return d>0?yc-Math.sqrt(d):NaN;};          // อาร์กล่าง = ผิวเลื่อน
    const xa=Math.max(xMin,xc-R), xb=Math.min(xMax,xc+R); let lo=NaN,hi=NaN; const NS=160;
    for(let k=0;k<=NS;k++){const x=xa+(xb-xa)*k/NS,ya=arc(x); if(isNaN(ya))continue; if(ys(x)-ya>1e-4){if(isNaN(lo))lo=x;hi=x;}}
    if(isNaN(lo)||hi-lo<wMin)return null;
    /* ★★ วงต้อง "โผล่พ้นผิวดินครบทั้งสองปลายภายในโดเมน" — ถ้ายังจมดินอยู่ที่ขอบโดเมน = วงถูกตัด = กลไกไม่สมบูรณ์
       บั๊กที่เกิดตอนผมขยายขอบ (build 155 · จับได้ด้วย monotonicity): วงถูกตัดที่ xMin → "ตีนต้าน" หายไป
       เหลือแต่ส่วนขับ → sumDrv ปลอม → FS=0.159 ที่ xc=-19 (วงบาง ๆ ริมโดเมน · ตีนต้าน 0/26 · q ไม่มีผลเลย)
       การขยายกล่องค้นหาแก้ไม่ได้ ต้อง "ปฏิเสธวงที่ถูกตัด" ตรง ๆ */
    const dLo=ys(lo)-arc(lo), dHi=ys(hi)-arc(hi);
    if(lo<=xa+1e-9&&dLo>1e-3)return null;      // ยังจมดินที่ขอบซ้าย → ถูกตัด
    if(hi>=xb-1e-9&&dHi>1e-3)return null;      // ยังจมดินที่ขอบขวา → ถูกตัด
    const b=(hi-lo)/nSlice; let sumDrv=0,sumWx=0,sumResOMS=0,sumCdl=0,deep=0; const sl=[];
    for(let s=0;s<nSlice;s++){
      const xm=lo+b*(s+0.5), yb=arc(xm), yt=ys(xm); if(isNaN(yb)||yt<=yb)return null;
      /* ★ ผิวเลื่อนห้ามผ่า "เนื้อคอนกรีต" — กำแพงเป็นวัตถุแข็ง วงต้องอ้อม/ลอดใต้ฐาน (แนวปฏิบัติมาตรฐานของโปรแกรม slope stability)
         บั๊กเดิม (พบ+วัด 2569-07 build 155): `strAt()` ให้กำลังตาม "ตำแหน่ง" ไม่ใช่ "วัสดุ" → slice ที่ฐานอยู่กลางฐานคอนกรีต
         ได้กำลังเป็นดินทราย c=0 φ=30 → วงวิกฤตเฉือนผ่าฐาน คสล. ได้ฟรี ๆ วัดจริง: 6/26 slice ผ่าเนื้อคอนกรีต */
      if(inWall(xm,yb))return null;
      const dx=xm-xc, cosA=(yc-yb)/R, sinA=dx/R; if(cosA<0.15)return null;              // α>~80° → วงไม่สมจริง
      let W=0; const ndy=18, dyc=(yt-yb)/ndy; for(let m=0;m<ndy;m++)W+=gamAt(xm,yb+dyc*(m+0.5))*dyc; W*=b;
      /* ★ น้ำหนักบรรทุกจร/surcharge บนผิวดินถมหลังกำแพง — เดิม destructure `q` มาแต่ "ไม่เคยใช้เลย"
         → FS(q=20) = FS(q=0) เป๊ะทุกหลัก = ทิ้งพจน์แรงขับทิ้งไป → FS วงสไลด์สูงเกินจริงเมื่อมี surcharge
         (พบ 2569-07 ระหว่างทำ mutation test ของ V2) · q เป็น kN/m² × b (m) → kN/ม.ยาว เท่ากับหน่วยของ W */
      if(xm>=backX&&q>0)W+=q*b;
      const u=(yWT>yb)?gw*(yWT-yb):0, st=strAt(xm,yb), tanP=Math.tan(st.ph*DR), cP=st.c, dl=b/cosA;
      sl.push({W,u,c:cP,tanP,b,dl,sinA,cosA,xm,yb,ycg:(yb+yt)/2}); sumDrv+=W*sinA; sumWx+=W*dx; sumCdl+=cP*dl;   // ycg = จุดศูนย์ถ่วง slice → จุดกระทำแรงเฉื่อย kh·W
      sumResOMS+=cP*dl+Math.max(W*cosA-u*dl,0)*tanP; deep=Math.min(deep,yb);
    }
    /* ★★ กำแพงบนเสาเข็ม: กลไกที่เสาเข็ม "หยุดไม่ได้" คือวงลึกที่ลอดใต้ปลายเข็ม (deep-seated failure below pile toe)
       วงที่ตื้นกว่านั้นถูกเสาเข็มยึดไว้ → ถ้านับวงตื้นด้วยจะได้ FS ต่ำปลอมทุกเคส = เตือนหมาป่า (alarm fatigue) และผิดหลักวิศวกรรม
       เกณฑ์นี้จะ "ผ่านสบาย" บนทราย และ "กัด" บนดินเหนียวอ่อน — ซึ่งถูกต้อง เพราะ deep-seated เป็นกลไกจริงของดินอ่อน (เคส กทม./ริมคลอง) */
    const needDeep=Math.max(dMin, pileToe);
    if(deep>-needDeep)return null;                      // ต้องผ่านดินฐาน (และลอดใต้ปลายเข็ม ถ้ามีเข็ม)
    if(sumDrv<=1e-6)return null;                        // ไม่มีแรงขับสุทธิ → ข้าม
    /* ★★ Bishop แบบง่าย + pseudo-static (แผ่นดินไหว) — build 158
       FS = Σ[(c·b + (W·fw − u·b)·tanφ)/m_α] / [Σ W·fw·sinα + Σ kh·W·(yc − y_cg)/R]
       · fw = ตัวคูณน้ำหนักจากความเร่งแนวดิ่ง · kh·W = แรงเฉื่อยแนวราบกระทำที่จุดศูนย์ถ่วง slice
       · โมเมนต์ของแรงเฉื่อยรอบจุดศูนย์กลาง = kh·W·(yc − y_cg) → หารด้วย R ให้อยู่รูปเดียวกับ Σ W sinα
       ★ ทำไมต้องคิด kv ทั้ง 2 ทิศแล้วเอาต่ำสุด: `(1−kv)` ลดทั้งแรงขับและแรงต้าน
         → ดินทราย c=0 หักล้างกันหมด (kv ไม่มีผล) · ดินเหนียว c>0 กลับทำให้ FS **สูงขึ้น = ไม่อนุรักษ์นิยม**
         ทิศวิกฤตจึงขึ้นกับดิน → คิดทั้งคู่ เอาค่าที่แย่กว่า (slice ชุดเดียวกัน = แทบไม่มีต้นทุน)
       ★ kh=0 && kv=0 → เดินเส้นทางเดิมเป๊ะ (fw=1, ไม่มีพจน์เฉื่อย) → เอกลักษณ์ "ต่อเนื่องที่ kh=0" เป็นจริงโดยโครงสร้าง */
    const solveFS=fw=>{
      let drv=0; for(const s of sl){ drv+=s.W*fw*s.sinA; if(kh>0)drv+=kh*s.W*(yc-s.ycg)/R; }
      if(drv<=1e-6)return null;
      let F=1.3;
      for(let it=0;it<60;it++){ let num=0;
        for(const s of sl){const mA=s.cosA+s.sinA*s.tanP/F; num+=(s.c*s.b+Math.max(s.W*fw-s.u*s.b,0)*s.tanP)/Math.max(mA,0.2);}
        const Fn=num/drv; if(!isFinite(Fn)||Fn<=0)return null; if(Math.abs(Fn-F)<1e-4){F=Fn;break;} F=Fn; }
      return F;
    };
    let FS, kvGov=0;
    if(!_seis){ FS=solveFS(1); }
    else{ const up=solveFS(1-kv), dn=(kv>0)?solveFS(1+kv):null;
          const cand=[[up,+1],[dn,-1]].filter(x=>x[0]!=null&&isFinite(x[0]));
          if(!cand.length)return null;
          cand.sort((a,b)=>a[0]-b[0]); FS=cand[0][0]; kvGov=cand[0][1]; }
    if(FS==null||!isFinite(FS)||FS<=0)return null;
    return {FS,FSoms:sumResOMS/sumDrv,xc,yc,R,lo,hi,deep,slices:sl,sumDrv,sumWx,sumCdl,seis:_seis,kvGov};
  }
  /* ★★ ค้นหาวงวิกฤต — หยาบทั่วบริเวณ แล้วละเอียดรอบตัวที่ดีที่สุด (coarse → refine)
     บั๊กเดิม (พบ+วัด 2569-07 build 155): กริดเดิม xc∈[-0.3H, B+1.3H] · yc∈[1.05H, 2.60H] · R-yc∈[0.05H, 1.10H]
     **ค่าต่ำสุดไปตกที่มุมกริดพอดีทั้ง 3 แกน (ช่อง 0/9 · 0/6 · 0/5)** = ค่าต่ำสุดจริงอยู่ "นอกกล่องค้นหา"
     อาการที่มองข้ามได้ง่ายแต่ฟ้องชัด: (1) B 1.5→3.5 ม. FS ไม่ขยับเลยสักหลัก (1.2552 เป๊ะ) เพราะ xc ที่ช่อง 0
     = -0.3·H ซึ่งไม่ขึ้นกับ B  (2) ดิน c=0 ขยายขนาด ×2 แล้ว FS เปลี่ยน -8.8% ทั้งที่ FS ต้องคงที่ (เอกลักษณ์)
     เสถียรภาพรวมต้องการ "ค่าต่ำสุด" → รายงานค่าที่ขอบ = อาจสูงเกินจริง = ผิดข้างไม่ปลอดภัย */
  let nTried=0;
  const scan=(xa,xb2,ya,yb2,ra,rb,nx,ny,nr)=>{
    let bst=null;
    for(let a=0;a<nx;a++){const xc=xa+(xb2-xa)*(nx>1?a/(nx-1):0.5);
      for(let c=0;c<ny;c++){const yc=ya+(yb2-ya)*(ny>1?c/(ny-1):0.5);
        for(let d=0;d<nr;d++){const dR=ra+(rb-ra)*(nr>1?d/(nr-1):0.5); nTried++;
          try{const res=evalCircle(xc,yc,yc+dR);
            if(res&&(!bst||res.FS<bst.FS)){res._i=[a,c,d];res._dR=dR;bst=res;}}catch(e){}
        }}}
    return bst;
  };
  /* รอบหยาบ — ขอบเขตผูกกับ Htot/B ล้วน ๆ (ไม่มีค่าคงที่สัมบูรณ์ → รักษาเอกลักษณ์เชิงมาตราส่วน)
     ★ ถ้าค่าต่ำสุด "ไปนอนที่ขอบ" = ค่าต่ำสุดจริงอยู่นอกกล่อง → ขยายกล่องด้านนั้นแล้วค้นใหม่ (สูงสุด 3 รอบ)
       ไม่ใช่แค่ติดธงเตือน — เพราะเสถียรภาพรวมต้องการค่าต่ำสุดจริง ไม่ใช่ค่าที่บังเอิญอยู่ริมกริด */
  const NX=12, NY=8, NR=7;
  /* ★ ช่วง R ต้อง "เอื้อมถึง" ความลึกที่ต้องการ — ไม่งั้นค้นเท่าไรก็ไม่มีวงที่ผ่านเกณฑ์
     (เดิม R1=1.6·H=4.6 ม. แต่ปลายเข็มอยู่ลึก 6 ม. → หาไม่เจอเลยแม้แต่วงเดียว) */
  const dNeed=Math.max(0.03*Htot, pileToe);
  let X0=-0.8*Htot-0.6*pileToe, X1=B+1.6*Htot+0.6*pileToe, Y0=0.60*Htot, Y1=2.90*Htot+0.5*pileToe,
      R0=dNeed, R1=Math.max(1.60*Htot, 1.45*dNeed+0.5*Htot);
  let best=scan(X0,X1,Y0,Y1,R0,R1,NX,NY,NR);
  if(!best)return null;
  const onEdge=b=>(b._i[0]===0||b._i[0]===NX-1||b._i[1]===0||b._i[1]===NY-1||b._i[2]===0||b._i[2]===NR-1);
  for(let ex=0; ex<3 && onEdge(best); ex++){
    const [ia,ic,id]=best._i, wX=(X1-X0), wY=(Y1-Y0), wR=(R1-R0);
    if(ia===0)X0-=0.6*wX; else if(ia===NX-1)X1+=0.6*wX;
    if(ic===0)Y0=Math.max(Y0-0.6*wY, 0.15*Htot); else if(ic===NY-1)Y1+=0.6*wY;
    if(id===0)R0=Math.max(R0-0.6*wR, 0.01*Htot); else if(id===NR-1)R1+=0.6*wR;
    const b2=scan(X0,X1,Y0,Y1,R0,R1,NX,NY,NR);
    if(!b2)break;
    if(b2.FS<best.FS||onEdge(best))best=b2;
  }
  best.edge=onEdge(best);   // ★ ยังชนขอบหลังขยาย 3 รอบ → บอกตรง ๆ ห้ามเงียบ
  // รอบละเอียด — ซูมเข้ารอบตัวที่ดีที่สุด ±1 ช่อง สองรอบ
  let hx=(X1-X0)/(NX-1), hy=(Y1-Y0)/(NY-1), hr=(R1-R0)/(NR-1);
  for(let pass=0; pass<2; pass++){
    const cx=best.xc, cy=best.yc, cr=best._dR;
    const r2=scan(cx-hx,cx+hx, Math.max(cy-hy,0.2*Htot), cy+hy, Math.max(cr-hr,0.01*Htot), cr+hr, 5,5,5);
    if(r2&&r2.FS<best.FS){const e=best.edge; best=r2; best.edge=e;}
    hx/=2.5; hy/=2.5; hr/=2.5;
  }
  best.nTried=nTried;
  return best;
}
/* ★ memo ของ globalSlip — ตัวค้นหาวงวิกฤตหนัก (37–120 ms) และ calc() ถูกเรียกทุกครั้งที่พิมพ์
   ผู้ใช้แก้ช่องที่ไม่เกี่ยวกับดิน/เรขาคณิต (ขนาดเหล็ก · f′c · ระยะเรียง ฯลฯ) → พารามิเตอร์วงสไลด์ "เหมือนเดิมเป๊ะ"
   → cache ตามลายเซ็นพารามิเตอร์ · ไม่เปลี่ยนผลลัพธ์เลย เปลี่ยนแค่ความเร็ว (วัดผลก่อน/หลังใน CHANGELOG 157)
   หมายเหตุ: ผู้เรียกเติม .req/.ok/.pileToe ทับ object เดิม — ค่าเท่าเดิมเสมอเมื่อคีย์เดียวกัน จึง idempotent */
let _GSK=null,_GSV=null;
function globalSlipMemo(P){
  let k; try{k=JSON.stringify(P);}catch(e){return globalSlip(P);}
  if(k===_GSK)return _GSV;
  _GSV=globalSlip(P); _GSK=k; return _GSV;
}
const BARS={6:28.3,9:63.6,10:78.5,12:113.1,16:201.1,20:314.2,25:490.9,28:615.8,32:804.2};
const KGM ={6:0.222,9:0.499,10:0.617,12:0.888,16:1.578,20:2.466,25:3.853,28:4.834,32:6.313};
/* เกรดเหล็ก: SR24 (RB กลมผิวเรียบ fy=235) · SD30/40/50 (DB ข้ออ้อย) — pre = คำนำหน้าขนาด */
const GRADES={235:{l:'SR24',pre:'RB'},295:{l:'SD30',pre:'DB'},390:{l:'SD40',pre:'DB'},490:{l:'SD50',pre:'DB'}};
const barPre=g=>(GRADES[g]||GRADES[390]).pre;
/* กำหนดเหล็กเสริมเอง (override) — คีย์ต่อรายการ: {g:เกรด, d:ขนาด(มม.), s:ระยะ(มม.)} · ว่าง=อัตโนมัติ */
let REBAROV={};   // เหล็กที่ผู้ใช้กำหนดเอง — ฉีดเข้ามาทาง input.rebarOverride (เดิมอ่านจาก localStorage ของหน้าเว็บ)
/* คืนเหล็กที่ผู้ใช้กำหนด (ถ้ามี) แทนค่าที่ออกแบบอัตโนมัติ — ตรวจกำลัง (พื้นที่×fy) พอหรือไม่ */
function ovBar(key,autoBar,AsReq,dfy,maxS){
  const o=REBAROV[key]; if(!o||!o.d)return autoBar;                         // ไม่กำหนด → ใช้ auto
  const d=+o.d, g=+o.g||dfy||390, pre=barPre(g), Ab=BARS[d]||BARS[12];
  let s=o.s?+o.s:pickBar(AsReq||1,d,maxS||300).s;                            // ระยะ: กำหนดเอง หรือ auto ให้พอ
  s=Math.max(Math.min(s,600),50);
  const prov=1000*Ab/s, ok=(prov*g)>=(AsReq||0)*(dfy||390)*0.999;           // กำลังต่อเมตร ≥ ที่ต้องการ
  return {db:d,s,prov,grade:g,pre,ok,man:true,txt:pre+d+'@'+s+(ok?'':' ⚠')};
}
/* เหล็กเดือยหัวเสาเข็ม (dowel) — จำนวน+ขนาด/ต้น กำหนดเองได้ (REBAROV.pileDowel {n,d,g}) · default 4-DB12 */
function dowelSpec(i){const o=REBAROV.pileDowel||{};
  const db=Math.max(10,Math.min(32,+o.d||12)), n=Math.max(2,Math.min(16,Math.round(+o.n||4))), g=+o.g||(i&&i.fy)||390;
  return {n,db,grade:g,pre:barPre(g),As:n*(BARS[db]||BARS[12]),txt:n+'-'+barPre(g)+db,man:!!(o.n||o.d||o.g)};}
/* รายการเหล็กที่กำหนดเองได้ (label ไทย · ใช้กับกำแพงชนิดใด) */
/* ============================================================
   DESIGN CODE — มาตรฐานออกแบบ (เลือกได้): กฎกระทรวง พ.ศ.2566 (ค่าเริ่มต้น) / ACI 318-14 / WSD
   รวมศูนย์ตัวคูณน้ำหนักบรรทุก (load factor) และตัวคูณลดกำลัง (φ) ไว้ที่เดียว
   เพื่อให้ทุกการคำนวณสอดคล้องกับมาตรฐานที่เลือกโดยอัตโนมัติ
   ============================================================ */
/* ★ ทุกโปรไฟล์ต้องเก็บสายหลักฐานครบ: มาตรฐานต้นทาง · ข้อ · และสมการที่ engine รันจริง
   ห้ามมีโปรไฟล์ที่เปลี่ยนเพียงป้ายชื่อแต่ยังคำนวณด้วยค่าคงที่ชุดเดิม — เปลี่ยนโปรไฟล์ต้องเปลี่ยนผลจริง
   ข้ออ้างอิงฝั่งไทย (มยผ. / กฎกระทรวง) ยกมาจากการใช้งานเดิมของเจ้าของระบบใน Concrete-design
   ⚠️ ยังต้องให้ Owner/PE ทานกับตัวเล่มมาตรฐานก่อนใช้ออกแบบเพื่อก่อสร้าง */
const EQ_FLEX='φM_n = φ_b·A_s·f_y·(d − a/2) · a = A_s·f_y/(0.85·f′c·b)   [Whitney stress block]';
const EQ_SHEAR='φV_c = φ_v·0.17·√f′c·b_w·d   (SI: N, mm, MPa)   [ACI 318-14 Eq.22.5.5.1]';
const EQ_SHEAR_N='φV_c = φ_v·0.17·(1 + N_u/(14·A_g))·√f′c·b_w·d   (องค์อาคารรับแรงอัดแกน)   [ACI 318-14 Eq.22.5.6.1]';
const EQ_EARTH='K_a Rankine = tan²(45° − φ′/2) · หลังลาด β ใช้รูปเต็ม · Gravity ใช้ Coulomb (δ, θ)   [FHWA NHI-01-094 Eq.6-2 · USACE EM 1110-2-2502 §3-5]';
const EQ_MO='K_ae Mononobe–Okabe · θ = arctan[k_h/(1−k_v)] · ใช้ได้เมื่อ φ ≥ θ + β เท่านั้น   [Okabe 1926 · Mononobe–Matsuo 1929]';
const CODES={
  thai2566:{name:'SDM — กฎกระทรวง พ.ศ.2566 + มยผ. 1101-64', short:'กฎกระทรวง 2566 + มยผ. 1101-64 (SDM)', method:'strength',
    gD:1.4, gL:1.7, gH:1.7, gB:1.7, gDr:0.9, phib:0.90, phiv:0.85,
    combo:'1.4D + 1.7L + 1.7H', comboR:'0.9D + 1.7H',
    ref:'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคารฯ พ.ศ.2566 (ข้อ 7–8) · มยผ. 1101-64',
    ev:{loadSrc:'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคารและลักษณะและคุณสมบัติของวัสดุที่ใช้ในงานโครงสร้างอาคาร พ.ศ.2566',
        loadClause:'ข้อ 7–8 — ตัวคูณน้ำหนักบรรทุก (วิธีกำลัง)',
        phiClause:'กฎกระทรวง พ.ศ.2566 หน้า ๙ — φ ดัด 0.90 · φ เฉือน 0.85',
        memberSrc:'มยผ. 1101-64 มาตรฐานงานคอนกรีตเสริมเหล็ก (บทบัญญัติอ้างอิง ACI 318)',
        memberClause:'ข้อ 10.2 Whitney stress block · ข้อ 10.3 ρ_b/ρ_max/ρ_min · ข้อ 11 แรงเฉือนวิธีกำลัง · ข้อ 13 ระยะยึด/ต่อทาบ',
        stabClause:'กฎกระทรวงกำหนดฐานรากฯ พ.ศ.2566 ข้อ 31 (FS พลิกคว่ำ/เลื่อนไถล) · ข้อ 16 (q_a เกิน 200 kPa ต้องมีผลทดสอบแผ่นเหล็ก)',
        eq:[EQ_FLEX,EQ_SHEAR,EQ_SHEAR_N,EQ_EARTH,EQ_MO]}},
  aci318:{name:'SDM — ACI 318-14', short:'ACI 318-14 (SDM)', method:'strength',
    gD:1.2, gL:1.6, gH:1.6, gB:1.6, gDr:0.9, phib:0.90, phiv:0.75,
    combo:'1.2D + 1.6L + 1.6H', comboR:'0.9D + 1.6H',
    ref:'ACI 318-14 Building Code Requirements for Structural Concrete / วสท.',
    ev:{loadSrc:'ACI 318-14 Building Code Requirements for Structural Concrete',
        loadClause:'§5.3.1 — U = 1.2D + 1.6L (+1.6H สำหรับแรงดันดิน) · ชุดยกตัว 0.9D + 1.6H',
        phiClause:'§21.2.1 — φ เฉือน 0.75 · §21.2.2 — φ ดัด 0.90 เมื่อหน้าตัดเป็น tension-controlled (ε_t ≥ 0.005)',
        memberSrc:'ACI 318-14',
        memberClause:'§22.2 Whitney stress block · §22.5 แรงเฉือน · §25.4 ระยะยึด',
        stabClause:'เสถียรภาพภายนอก (พลิกคว่ำ/เลื่อน/แบกทาน) ไม่ได้อยู่ใน ACI 318 — แอปใช้เกณฑ์ FS ตาม Das / USACE ตามที่แสดงในหน้าผล',
        eq:[EQ_FLEX,EQ_SHEAR,EQ_SHEAR_N,EQ_EARTH,EQ_MO]}},
  wsd:{name:'WSD — หน่วยแรงใช้งาน (กฎกระทรวง พ.ศ.2566)', short:'WSD — กฎกระทรวง 2566', method:'wsd',
    gD:1.0, gL:1.0, gH:1.0, gB:1.0, gDr:1.0, phib:1.0, phiv:1.0,
    combo:'D + L + H (น้ำหนักใช้งาน)', comboR:'D + H',
    ref:'วิธีหน่วยแรงที่ยอมให้ — กฎกระทรวง พ.ศ.2566 (ข้อ 5–6)',
    ev:{loadSrc:'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคารฯ พ.ศ.2566',
        loadClause:'ข้อ 5–6 — วิธีหน่วยแรงที่ยอมให้ (ไม่คูณตัวคูณน้ำหนักบรรทุก)',
        phiClause:'ไม่ใช้ φ — ควบคุมด้วยหน่วยแรงที่ยอมให้แทน',
        memberSrc:'มยผ. 1101-64 / วสท. — วิธีหน่วยแรงใช้งาน',
        memberClause:'หน่วยแรงดึงเหล็กยอมให้ตามชั้นเหล็ก (ฉ.6 ข้อ 6)',
        stabClause:'กฎกระทรวงกำหนดฐานรากฯ พ.ศ.2566 ข้อ 31 · ข้อ 16',
        eq:['M ยอมให้ = A_s·f_s·(d − a/2) — วิธีหน่วยแรงใช้งาน',
            'v_c ยอมให้ = 0.09·√f′c (MPa) ≈ 0.29·√f′c เมื่อ f′c เป็น ksc',
            'เสาเข็ม: ใช้หน่วยแรงเฉือนยอมให้ล้วน ไม่คูณพจน์แรงอัดแกน (อนุรักษ์ — บิลด์นี้ยังไม่มีสัมประสิทธิ์ WSD ที่ทวนสอบแล้ว)',
            EQ_EARTH,EQ_MO]}}
};
let DCODE='thai2566';
let QASRC='input';   // แหล่งกำลังแบกทาน: 'input' (กรอก qa) | 'soil' (คำนวณจากดิน Meyerhof)
const CD=()=>CODES[DCODE]||CODES.thai2566;
const fsAllowWSD=fy=>fy>=400?170:(fy>=350?160:(fy>=240?150:120)); // หน่วยแรงดึงเหล็กยอมให้ MPa (กฎ ฉ.6 ข้อ 6 / เหล็กข้ออ้อย)

/* ============================================================
   ข้อมูลผู้ออกแบบ (แสดงในรายการคำนวณ + ตราประทับแบบ) — แก้ได้/บันทึกในเครื่อง
   ค่าเริ่มต้น = ข้อมูลผู้พัฒนา (ผู้ซื้อแต่ละรายแก้เป็นของตนเองได้)
   ============================================================ */
/* Build 163 · Construction Spec SSOT — ค่าตั้งแนว/ระดับ/รอยต่อ/ระบายน้ำ/หัวเข็มชุดเดียวสำหรับจอ แบบ รายงาน BOQ และ DXF */
function constructionSpec(r){const i=(r&&r.i)||{},v=(k,d)=>{if(Object.prototype.hasOwnProperty.call(i,k)&&Number.isFinite(+i[k]))return+i[k];return d;};   // ★ เดิมมี fallback อ่าน DOM — engine ต้องรับค่าจาก input เท่านั้น
  return{datum:v('cDatum',0),joint:v('cJoint',10),weep:v('cWeep',2),drainDen:v('cDrainDen',200),lean:v('cLean',.05),filter:v('cFilter',.30),fillLift:v('cFillLift',.30),compact:v('cCompact',95),pileCut:v('cPileCut',.05),work:v('cWork',.50),
    tolPlan:v('cTolPlan',20),tolLevel:v('cTolLevel',10),tolPlumb:v('cTolPlumb',10),tolThk:v('cTolThk',10),tolPile:v('cTolPile',50),
    agg:v('cAgg',20),wallLift:v('cWallLift',1.50),massTrigger:v('cMassTrigger',1.00),datumOK:!!i.cDatumOK,drainOK:!!i.cDrainOK,
    thermalOK:!!i.cThermalOK,placeOK:!!i.cPlaceOK,jointOK:!!i.cJointOK};}
/* Build 169 · Gravity Constructability Redline — screening + coordination gate
   ACI 318-19 §26.4.2.1(a)(5): nominal max aggregate ≤ 3/4 clear bar spacing,
   ≤ 1/5 narrow form dimension, ≤ 1/3 slab depth. Mass-concrete trigger is project screening only;
   ACI 207 definition also depends on mixture, restraint, boundary and ambient conditions. */
function constructability169(r,cs,bbs){
  r=r||{};const i=r.i||{};cs=cs||constructionSpec(r);bbs=bbs||((r.qty&&r.qty.bbs)||[]);
  const f=(x,d=1)=>Number.isFinite(+x)?(+x).toFixed(d):'—', hp=Math.max(+i.hp||0,0),hz=Math.max(+i.hz||0,0),
    tBase=Math.max(+i.t||0,0),tTop=Math.max(+r.tTop||+i.ttop||tBase,0),Lw=Math.max(+i.Lw||0,0);
  const spaced=(bbs||[]).map(b=>{const m=String(b.detail||'').match(/@(\d+(?:\.\d+)?)/);if(!m||!(+b.size>0))return null;
    const spacing=+m[1],clear=spacing-(+b.size||0);return{mk:b.mk||'—',spacing,db:+b.size,clear};}).filter(Boolean);
  const gov=spaced.length?spaced.reduce((a,b)=>b.clear<a.clear?b:a):null,minClear=gov?gov.clear:Infinity;
  const formAllow=tTop>0?tTop*1000/5:Infinity, slabAllow=hz>0?hz*1000/3:Infinity, barAllow=Number.isFinite(minClear)?0.75*minClear:Infinity;
  const aggAllow=Math.min(formAllow,slabAllow,barAllow),agg=+cs.agg||0,aggOK=agg>=10&&agg<=aggAllow+1e-9;
  const wallLift=+cs.wallLift||0,liftOK=wallLift>=.30&&wallLift<=3.00&&hp>0,
    nLifts=liftOK?Math.max(1,Math.ceil(hp/wallLift-1e-9)):0,actualLift=nLifts?hp/nLifts:0;
  const maxSection=Math.max(tBase,hz),massTrigger=+cs.massTrigger||0,thermalRequired=!!r.gravity&&massTrigger>=.50&&maxSection>=massTrigger-1e-9;
  const thermalState=cs.thermalOK?true:(thermalRequired?false:null),thermalSeverity=cs.thermalOK?'info':(thermalRequired?'block':'warning');
  const checks=[
    {code:'AGGREGATE PASSAGE',label:'มวลรวมหยาบผ่านแบบหล่อและช่องว่างเหล็ก',ok:aggOK,severity:aggOK?'info':'block',fields:['cAgg'],
      detail:'d_agg '+f(agg,0)+' ≤ '+f(aggAllow,0)+' มม. · คุมโดย '+(aggAllow===barAllow&&gov?('BAR '+gov.mk+' clear '+f(minClear,0)+' มม.'):(aggAllow===formAllow?'1/5 ความหนาผนังยอด':'1/3 ความหนาฐาน'))+' · ACI 318 §26.4.2.1'},
    {code:'POUR LIFT',label:'แบ่ง lift เทพนังเป็นช่วงที่ระบุได้จริง',ok:liftOK,severity:liftOK?'info':'block',fields:['cWallLift'],
      detail:(liftOK?(nLifts+' lift × ประมาณ '+f(actualLift,2)+' ม. ≤ ค่ากำหนด '+f(wallLift,2)+' ม.'):'ค่าความสูง lift ต้องอยู่ในช่วงโครงการ 0.30–3.00 ม.')},
    {code:'THERMAL CONTROL',label:'ทบทวนความร้อนและแผนควบคุมอุณหภูมิ',ok:thermalState,severity:thermalSeverity,fields:['cMassTrigger','cThermalOK'],
      detail:'หน้าตัดหนาสุด '+f(maxSection,2)+' ม. · project trigger '+f(massTrigger,2)+' ม. · '+(thermalRequired?'ต้องมี Thermal assessment/control plan ก่อน release':'ยังไม่ชน trigger แต่ฐานยึดรั้งอาจแตกร้าวได้—ต้องให้ผู้รับผิดชอบทบทวน')},
    {code:'PLACEMENT ACCESS',label:'ประสานทางปั๊ม–เท–จี้ผ่าน cage',ok:cs.placeOK?true:null,severity:cs.placeOK?'info':'warning',fields:['cPlaceOK'],
      detail:cs.placeOK?'ผู้รับผิดชอบยืนยันเส้นทางเทและ consolidation แล้ว':'ต้องตรวจตำแหน่งช่องเท หัวจี้ coupler/splice และเหล็กซ้อนก่อนอนุมัติแบบ'},
    {code:'EMBEDDED ITEMS',label:'ประสานรอยต่อ–waterstop–weep/drain sleeve',ok:cs.jointOK?true:null,severity:cs.jointOK?'info':'warning',fields:['cJointOK'],
      detail:cs.jointOK?'ยืนยันตำแหน่ง embedded items ไม่ชน BAR MARK แล้ว':'ต้องทำ composite redline ที่รอยต่อฐาน–พนังและแนวท่อก่อนเท'}
  ];
  return{agg,aggAllow,minClear,governingBar:gov,wallLift,nLifts,actualLift,maxSection,massTrigger,thermalRequired,longitudinalJoints:cs.joint>0?Math.max(0,Math.floor((Lw-1e-6)/cs.joint)):0,checks};
}

/* ============================================================
   UNIT SYSTEM — MKS ไทย (ksc·ตัน·ม.) [default] ↔ SI (kN·MPa)
   ภายในคำนวณเป็น SI เสมอ — แปลงเฉพาะรับเข้า/แสดงผล
   ============================================================ */
const G=9.80665;
let UMODE='mks';                       // 'mks' | 'si'
const CONVIN={gs:G,gsat:G,gc:G,q:G,qa:G,c:G,ks:G,gaBondStress:G,fc:0.0980665}; // ฟิลด์ที่กรอกเป็นหน่วยไทย → คูณเป็น SI (ks: t/m³→kN/m³)
const UL=()=>UMODE==='mks'
 ?{F:'ตัน',M:'ตัน·ม.',P:'ตัน/ม²',S:'ksc',UW:'ตัน/ม³'}
 :{F:'kN',M:'kN·m',P:'kN/m²',S:'MPa',UW:'kN/m³'};
const cF=v=>UMODE==='mks'?v/G:v, cS=v=>UMODE==='mks'?v*10.19716:v;
const fF=(v,d=2)=>fmt(cF(v),d), fP=fF, fM=fF, fUW=fF;
/* ---------- RC helpers (USD) ---------- */
function asReq(Mu,b,d,fc,fy){ // Mu kN·m, b,d m → As mm² (NaN = section too small)
  if(Mu<=0)return 0;
  const C=CD();
  if(C.method==='wsd')return asReqWSD(Mu,b,d,fc,fy);
  const Rn=Mu*1e6/(C.phib*b*1000*Math.pow(d*1000,2));
  const k=1-2*Rn/(0.85*fc);
  if(k<0)return NaN;
  return 0.85*fc/fy*(1-Math.sqrt(k))*b*1000*d*1000;
}
function asReqWSD(Mu,b,d,fc,fy){ // วิธีหน่วยแรงใช้งาน — Mu (น้ำหนักใช้งาน) kN·m, b,d m, fc MPa → As mm²
  if(Mu<=0)return 0;
  const fcA=0.45*fc;                              // หน่วยแรงอัดคอนกรีตยอมให้ (MPa)
  const Ec=4700*Math.sqrt(fc), n=Math.max(200000/Ec,6); // n = Es/Ec (Es=200 GPa)
  const fs=fsAllowWSD(fy);                          // หน่วยแรงดึงเหล็กยอมให้ (MPa)
  const kk=1/(1+fs/(n*fcA)), j=1-kk/3;
  const Mr=0.5*fcA*kk*j*(b*1000)*Math.pow(d*1000,2)/1e6; // โมเมนต์ที่หน้าตัดรับได้ที่ fcA (kN·m)
  if(Mu>Mr*1.0001)return NaN;                       // คอนกรีตรับแรงอัดเกิน → หน้าตัดเล็กไป
  return Mu*1e6/(fs*j*(d*1000));                     // As (mm²)
}
function pickBar(As,db,maxS=300){
  const Ab=BARS[db], mx=Math.max(maxS,75);   // กัน maxS<75 (เช่น 3·t·1000 ตอน t เล็ก) → s=0 → infinite loop ใน stepCap
  let s=Math.floor(1000*Ab/Math.max(As,1)/25)*25;
  s=Math.min(Math.max(s,75),mx);
  const prov=1000*Ab/s;
  return {s,prov,db,txt:`DB${db}@${s}`+(prov<As?' ⚠':'')};
}
/* pickFit — เลือกเหล็กดัด: ถ้า @75 ของขนาดที่เลือกยังไม่พอ ขยับขนาดขึ้น 16→20→25 (อย่างที่วิศวกรทำ) */
function pickFit(As,prefDb,maxS=300){
  const sizes=[12,16,20,25];
  let st=sizes.indexOf(prefDb); if(st<0)st=1;
  for(let k=st;k<sizes.length;k++){const r=pickBar(As,sizes[k],maxS);if(r.prov>=As)return r;}
  return pickBar(As,25,maxS); // ใหญ่สุดแล้วยังไม่พอ → คง ⚠ ไว้เตือน
}
const phiVc=(b,d,fc)=>{const C=CD();   // กำลังเฉือนคอนกรีต (kN, b,d เป็น ม.)
  return C.method==='wsd'
    ? 0.09*Math.sqrt(fc)*(b*1000)*(d*1000)/1000          // WSD: หน่วยแรงเฉือนยอมให้ ≈0.29√f′c[ksc]=0.09√f′c[MPa] (น้ำหนักใช้งาน)
    : C.phiv*0.17*Math.sqrt(fc)*(b*1000)*(d*1000)/1000;};// SDM: φVc = φ·0.17√f′c·b·d
/* กำลังเฉือนสูงสุดที่หน้าตัดรับได้เมื่อเสริมเหล็กปลอก (kN) — Vmax = φ(Vc+Vs,max), Vs,max=0.66√f′c·b·d */
const phiVmax=(b,d,fc)=>{const C=CD();
  if(C.method==='wsd')return 0.33*Math.sqrt(fc)*(b*1000)*(d*1000)/1000;   // WSD max รวมเหล็กปลอก (≈vc+vs ยอมให้)
  return C.phiv*(0.17+0.66)*Math.sqrt(fc)*(b*1000)*(d*1000)/1000;};
/* ออกแบบเหล็กปลอกรับแรงเฉือน — คืน {need, ok, AvS(mm²/m รวมสองขา), stirrup, smax(mm)} */
/* ★ คืน phiVn = "กำลังของหน้าตัดที่ออกแบบให้จริง" ด้วย — เพื่อให้ D/C ของเกณฑ์เฉือน
   มีความหมายเดียวกับเกณฑ์อื่นทุกตัว (demand / allowable) และ "ต่อเนื่อง" เมื่อ Vu ข้าม φVc
   บั๊กเดิม (แก้ 2569-07): เกณฑ์ใช้ u = Vu/pVmax เมื่อต้องใส่ปลอก โดย pVmax = เพดานสูงสุด
   ถ้าใส่ปลอกเต็มพิกัด (ไม่ใช่ปลอกที่ออกแบบให้) → วัดจริง: heel 1.20→1.25 ม. (ขยับ 5 ซม.)
   แรง 147.6→155.1 kN (เพิ่มขึ้น) แต่ D/C 0.97 → 0.209 (ตกฮวบ 78%) = ไม่ต่อเนื่อง
   → แถบ util กระโดดจากแดง 97% เป็นเขียว 21% · advisor/governing เรียงด้วย u ก็เพี้ยนตาม */
function shearDesign(Vu,b,d,fc,fy){
  const C=CD(), pVc=phiVc(b,d,fc), pVmax=phiVmax(b,d,fc);
  if(Vu<=pVc)return {need:false, ok:true, pVc, pVmax, phiVn:pVc, AvS:0, stirrup:'ไม่ต้องเสริม (Vu ≤ φVc)', smax:0, sProv:0};
  if(Vu>pVmax)return {need:true, ok:false, pVc, pVmax, phiVn:pVmax, AvS:0, stirrup:'หน้าตัดเล็กไป — เพิ่มความหนา', smax:0, sProv:0};
  const phiv=C.method==='wsd'?1.0:C.phiv;
  const Vc=pVc/phiv;                                  // กำลังเฉือนคอนกรีต (ก่อน φ)
  const VsReq=Vu/phiv-Vc;                             // เหล็กปลอกต้องรับ (kN)
  const AvS=VsReq*1000/(fy*(d*1000))*1000;            // mm²/m (Av/s = Vs/(fy·d))
  const hiV=VsReq>0.33*Math.sqrt(fc)*(b*1000)*(d*1000)/1000;   // Vs สูง → ลดระยะเรียงครึ่งหนึ่ง (ACI/วสท.)
  const smax=Math.min(d*1000/(hiV?4:2),300);          // ระยะเรียงสูงสุด d/2 (หรือ d/4 เมื่อ Vs สูง) ≤ 300 มม.
  const Ast=2*78.5;                                   // เหล็กปลอก RB10 สองขา (mm²)
  let s=Math.min(Ast/AvS*1000,smax); s=Math.floor(s/25)*25; s=Math.max(s,75);
  /* กำลังที่ "จัดให้จริง" ตามระยะเรียง s ที่เลือก (ปัดลง → Av/s จัดให้ ≥ ต้องการ → φVn ≥ Vu) */
  const AvProv=Ast/s*1000;                            // mm²/m
  const VsProv=AvProv*fy*(d*1000)/1000/1000;          // kN
  const phiVn=Math.min(phiv*(Vc+VsProv), pVmax);      // ไม่เกินเพดานหน้าตัด
  return {need:true, ok:true, pVc, pVmax, phiVn, AvS, AvProv, smax, sProv:s, stirrup:`RB10@${s} (เหล็กปลอก)`};
}
/* กำลังแบกทานประลัยของดิน (Terzaghi/Meyerhof–Vesic) — c,γ เป็น kN, φ องศา, Df,Bp เมตร → qult (kN/m²)
   ฐานรากกำแพงเป็นฐานแถบยาว (L≫B) → shape factor = 1 · ใช้ depth factor (Meyerhof) */
function bearingCap(c,phi,gamma,Df,Bp,Hload,Vload,dasDF){
  const p=phi*D2R, tp=Math.tan(p);
  const Nq=Math.exp(Math.PI*tp)*Math.pow(Math.tan((45+phi/2)*D2R),2);
  const Nc=phi>0.1?(Nq-1)/tp:5.14;
  const Ng=2*(Nq+1)*tp;                                   // Vesic
  const Kp=Math.pow(Math.tan((45+phi/2)*D2R),2), Bpe=Math.max(Bp,0.3);
  let dc,dq,dg;
  if(dasDF){const s2=Math.sin(p);                         // depth factors แบบ Das/Hansen (โหมดดินฐานแยก — ตรงตำรา Das Ex.13.1)
    dc=1+0.4*Df/Bpe; dq=phi>=10?1+2*tp*Math.pow(1-s2,2)*Df/Bpe:1; dg=1;}
  else{dc=1+0.2*Math.sqrt(Kp)*Df/Bpe;                     // depth factors (Meyerhof √Kp — โหมดเดิม)
    dq=phi>=10?1+0.1*Math.sqrt(Kp)*Df/Bpe:1; dg=dq;}
  /* load-inclination factors (Meyerhof) — กำแพงกันดินมีแรงผลักด้านข้าง → ลด q_ult · α = มุมเอียงแรงลัพธ์จากแนวดิ่ง */
  const alpha=(Hload>0&&Vload>0)?Math.atan(Hload/Vload)/D2R:0;
  const ic=Math.pow(1-alpha/90,2), iq=ic, ig=phi>0.1?Math.pow(Math.max(1-alpha/phi,0),2):0;
  const qsur=gamma*Df;
  const qult=c*Nc*dc*ic + qsur*Nq*dq*iq + 0.5*gamma*Bp*Ng*dg*ig;
  /* ★ q_a = 33% ของกำลังแบกทาน — กฎกระทรวงกำหนดฐานรากฯ พ.ศ.2566 ข้อ 15 เขียนว่า "ไม่เกินร้อยละ ๓๓"
     (เดิมใช้ qult/3 = 33.3% ซึ่ง "เกิน" ร้อยละ 33 อยู่ 1% → ไม่ผ่านตัวบทตามตัวอักษร) */
  return {Nc,Nq,Ng,dc,dq,dg,ic,iq,ig,alpha,qsur,qult,qall:qult*0.33};
}
function kaRankine(phi,beta){
  const cb=Math.cos(beta*D2R),cp=Math.cos(phi*D2R);
  if(beta<=0)return Math.pow(Math.tan((45-phi/2)*D2R),2);
  const rt=Math.sqrt(Math.max(cb*cb-cp*cp,0));
  return cb*(cb-rt)/(cb+rt);
}
/* Coulomb active coefficient — theta เป็นมุม signed จากแนวดิ่ง: บวกเมื่อยอดผิวหลังเอียงเข้าหาดิน, ลบเมื่อฐานบานเข้าหาดิน (0 = หลังดิ่ง)
   FHWA NHI-01-094 Eq.6-2 / USACE EM 1110-2-2502 §3-5.
   ใช้ใน production สำหรับ Gravity / Semi-gravity RC; ระบบอื่นคง Rankine เพื่อไม่เปลี่ยนผลเดิม */
function kaCoulomb(phi,beta,delta,theta){
  const f=phi*D2R,b=beta*D2R,d=(delta||0)*D2R,t=(theta||0)*D2R;
  const cdt=Math.cos(d+t),cbt=Math.cos(b-t),ct=Math.cos(t);
  const radDen=cdt*cbt,radNum=Math.sin(f+d)*Math.sin(f-b);
  if(phi<=0||beta>=phi||radDen<=0||radNum<0||Math.abs(ct)<1e-9)return NaN;
  return Math.pow(Math.cos(f-t),2)/(Math.pow(ct,2)*cdt*Math.pow(1+Math.sqrt(radNum/radDen),2));
}
/* กำแพงถ่วง trapezoid อ้างอิงต่อความยาว 1 ม. — oracle อิสระของ production gravity
   แยกองค์ประกอบแรง Coulomb ที่ทำมุม delta จาก normal แล้วปิดสมดุล OT/SL/bearing ด้วยสมการมือ */
function gravityCoulombRef(P){
  const H=+P.H,B=+P.B,top=+P.top,gamma=+P.gamma,gc=+P.gc,q=Math.max(+P.q||0,0),
    phi=+P.phi,beta=+P.beta||0,delta=+P.delta||0,theta=+P.theta||0,mu=+P.mu||0;
  const Ka=kaCoulomb(phi,beta,delta,theta);
  if(!isFinite(Ka)||H<=0||B<=0||top<=0||top>B)return null;
  const Ar=top*H,At=0.5*(B-top)*H,A=Ar+At;
  const xr=B-top/2,xt=2*(B-top)/3,xW=(Ar*xr+At*xt)/A,W=A*gc;
  const Ps=0.5*Ka*gamma*H*H,Pq=Ka*q*H,fa=(delta-theta)*D2R,cd=Math.cos(fa),sd=Math.sin(fa);
  const Phs=Ps*cd,Phq=Pq*cd,Ph=Phs+Phq,Pv=(Ps+Pq)*sd;
  const Mo=Phs*H/3+Phq*H/2,V=W+Pv,Mr=W*xW+Pv*B;
  const xbar=(Mr-Mo)/Math.max(V,1e-12),e=B/2-xbar;
  const qToe=V/B*(1+6*e/B),qHeel=V/B*(1-6*e/B);
  return {Ka,A,W,xW,Ps,Pq,Ph,Pv,Mo,V,Mr,xbar,e,qToe,qHeel,
    FSot:Mr/Math.max(Mo,1e-12),FSsl:mu*V/Math.max(Ph,1e-12)};
}
function kaeMO(phi,beta,kh,kv){ // Mononobe–Okabe, δ=0, ω=0 · รองรับ kv (แนวดิ่ง)
  const th=Math.atan(kh/(1-(kv||0))), p=phi*D2R, b=beta*D2R;
  if(p-th-b<=0)return NaN; // unstable combination
  const num=Math.pow(Math.cos(p-th),2);
  const den=Math.pow(Math.cos(th),2)*Math.pow(1+Math.sqrt(Math.sin(p)*Math.sin(p-th-b)/(Math.cos(th)*Math.cos(b))),2);
  return num/den;
}

/* ============================================================
   PILE-SPRING (Winkler beam-on-elastic-foundation, FE) + DISPLACEMENT
   จำลองเสาเข็มเป็นคานบนฐานยืดหยุ่น (สปริงดิน K=ks·B·ΔL ตาม Davisson ks=67·Su/B)
   แล้วหาการเคลื่อนตัวด้านข้าง δ — เทียบเกณฑ์ δ ≤ L/300
   ============================================================ */
function gaussSolve(A,b){const n=b.length,M=A.map((r,i)=>Float64Array.from([...r,b[i]]));
  for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
    [M[c],M[p]]=[M[p],M[c]];const d=M[c][c]||1e-12;
    for(let r=0;r<n;r++){if(r===c)continue;const f=M[r][c]/d;if(f)for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k];}}
  const x=new Float64Array(n);for(let i=0;i<n;i++)x[i]=M[i][n]/(M[i][i]||1e-12);return x;}
function pileSpring({EI,Lt,embedTop,ksLine,load,headLoad=0,headFix=0,braceLevel=null,braceK=0,n=40}){
  const h=Lt/n, nd=n+1, ND=2*nd;
  const K=Array.from({length:ND},()=>new Float64Array(ND)), F=new Float64Array(ND), beamEls=[];
  const kb=EI/(h*h*h);
  const Eb=[[12,6*h,-12,6*h],[6*h,4*h*h,-6*h,2*h*h],[-12,-6*h,12,-6*h],[6*h,2*h*h,-6*h,4*h*h]];
  for(let e=0;e<n;e++){const z0=e*h, zc=z0+h/2, m=[2*e,2*e+1,2*e+2,2*e+3];
    for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[m[a]][m[b]]+=kb*Eb[a][b];
    const ks=ksLine(zc);
    if(ks>0){const c=ks*h/420,Ef=[[156,22*h,54,-13*h],[22*h,4*h*h,13*h,-3*h*h],[54,13*h,156,-22*h],[-13*h,-3*h*h,-22*h,4*h*h]];
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[m[a]][m[b]]+=c*Ef[a][b];}
    const w=load(zc);
    F[m[0]]+=w*h/2;F[m[1]]+=w*h*h/12;F[m[2]]+=w*h/2;F[m[3]]+=-w*h*h/12;beamEls.push({m,w});}
  F[0]+=headLoad;
  if(headFix>0)K[1][1]+=headFix;
  if(braceK>0&&braceLevel!=null){const j=Math.round(braceLevel/h);if(j>=0&&j<nd)K[2*j][2*j]+=braceK;}
  const y=gaussSolve(K,F);
  const defl=[];for(let i=0;i<nd;i++)defl.push({z:i*h,y:y[2*i]*1000}); // mm
  let dMax=0,zMax=0;defl.forEach(p=>{if(Math.abs(p.y)>Math.abs(dMax)){dMax=p.y;zMax=p.z;}});
  /* แรงภายในจาก beam-element end forces โดยตรง: q_e = K_beam·u_e − f_equiv
     เดิมใช้ finite difference ของ M แล้วดิฟฯซ้ำหา V ทำให้ปลายถูกบังคับ M/V=0 และขยาย numerical noise เป็นยอด SFD เทียม */
  const Mprof=new Array(nd).fill(0),Vprof=new Array(nd).fill(0),mc=new Array(nd).fill(0),vc=new Array(nd).fill(0);
  beamEls.forEach((el,e)=>{const ue=el.m.map(j=>y[j]),fe=[el.w*h/2,el.w*h*h/12,el.w*h/2,-el.w*h*h/12],q=[0,0,0,0];
    for(let a=0;a<4;a++){for(let b=0;b<4;b++)q[a]+=kb*Eb[a][b]*ue[b];q[a]-=fe[a];}
    Mprof[e]+=q[1];mc[e]++;Mprof[e+1]+=-q[3];mc[e+1]++;       // โมเมนต์หน้าตัด: ซ้าย qM1 · ขวา −qM2
    Vprof[e]+=q[0];vc[e]++;Vprof[e+1]+=-q[2];vc[e+1]++;});    // แรงเฉือนหน้าตัด: ซ้าย qV1 · ขวา −qV2
  for(let i=0;i<nd;i++){Mprof[i]/=Math.max(mc[i],1);Vprof[i]/=Math.max(vc[i],1);}
  let mMax=0,vMax=0;Mprof.forEach(m=>{if(Math.abs(m)>mMax)mMax=Math.abs(m);});Vprof.forEach(v=>{if(Math.abs(v)>vMax)vMax=Math.abs(v);});
  return {defl,dTop:defl[0].y,dMax,zMax,h,Mprof,Vprof,mMax,vMax,nd};
}
/* คำนวณ EI เสาเข็ม (kN·m²) + δ — ใช้ทั้ง soldier และ pile-supported */
function pileDisp(i,{B,Lt,embedTop,headLoad,distLoad,tie,braceLevel,Ishape,prof,IgSec,AgSec}){
  const su=Math.max(i.su,0.2);
  const fcMPa=Math.max(i.fc,10);                       // i.fc เป็น MPa (ภายใน)
  const Ec=4700*Math.sqrt(fcMPa);                      // MPa (ACI)
  const Ig=Number.isFinite(+IgSec)&&+IgSec>0?+IgSec:Math.pow(B,4)/12*(Ishape?0.6:1.0); // m⁴ · Build172 รับ I จริงตามหน้าตัด/แกน เมื่อส่งมา
  const EI=Ec*1000*Ig;                                 // kN·m²
  /* ==== POINT SPRING SUPPORT (Winkler / beam-on-elastic-foundation) ====
     สปริงดินด้านข้างต่อความลึก: ks_line(z) = k_h(z)·B  [kN/m²]  (รวมกับ ΔL ในตัวแก้ FE = K_i = k_h·B·ΔL ต่อโนด)
     k_h จากโปรไฟล์ชั้นดินจริง — ทราย: k_h=n_h·z/B (โตตามลึก) · เหนียว: k_h=67·Su/B (Davisson, คงที่) */
  const P=prof||soilProfile(i);
  const ksLineFn=z=>(z>embedTop+1e-6)?Math.max(khAt(P,z,B)*B,1):0;   // kN/m² (=k_h·B)
  const r=pileSpring({EI,Lt,embedTop,
    ksLine:ksLineFn,
    load:distLoad||(()=>0), headLoad:headLoad||0,
    headFix:tie?0:(headLoad?5*EI/Lt:0),               // pile-supported (จุดบน=หัวเสาเข็มในแคป) → ยึดหมุน
    braceLevel:tie?braceLevel:null, braceK:tie?5e5:0});
  const allow=Lt/300*1000;                             // mm (L/300)
  const allow1=Lt*10;                                  // mm (1% ของความยาว — เกณฑ์ทางเลือก)
  const dMax=Math.abs(r.dMax);
  const khTop=khAt(P,embedTop+1e-3,B), khBot=khAt(P,Lt-1e-3,B);       // k_h ที่หัว/ปลายช่วงฝัง (kN/m³)
  const layered=(P.length>1)||P[0].type==='sand';                    // ทราย=โตตามลึก · หลายชั้น = แปรตามชั้น
  return {kh:khBot/G, ks:khBot*B/G, khTop, khBot, layered, ksType:P[Math.min(P.length-1,0)].type,
    EI, Lt, su, dMax, dTop:Math.abs(r.dTop), zMax:r.zMax,
    allow, allow1, ok:dMax<=allow, ratio:dMax/allow, defl:r.defl, B, Ishape:!!Ishape,
    mMax:r.mMax, vMax:r.vMax, Mprof:r.Mprof, Vprof:r.Vprof, h:r.h, nd:r.nd};
}

/* ============================================================
   LAYERED SOIL + 2D FRAME-ON-SPRINGS (Direct Stiffness) ENGINE
   ใช้กับกำแพงเสาเข็มไอ (anchored bulkhead) — วิเคราะห์ทั้งระบบเชื่อมโยงกัน
   ============================================================ */
let SOILLAYERS=null;   // [{h,type:'sand'|'clay',gamma,phi,su}] (จากผู้ใช้) · null = ดินชั้นเดียวจากอินพุต
const nhFromPhi=phi=>phi>=36?16000:(phi>=31?9000:(phi>=26?5000:2500));   // n_h ทราย (kN/m³, Terzaghi โดยประมาณ)
/* ===== เสาเข็ม คสล.อัดแรง รูปตัวไอ — สเปคมาตรฐาน มอก.396-2549 (f′c≥400 ksc · ลวดอัดแรง) =====
   key=ด้านหน้าตัด(ซม.) · w=น้ำหนัก(กก./ม.) · perim=เส้นรอบรูป(ซม.) · area=พื้นที่หน้าตัด(ซม.²)
   Psafe=ช่วงรับแรงแกนปลอดภัย(ตัน, ขึ้นกับดิน/ความยาวตอก) · Mcr=โมเมนต์แตกร้าวประมาณจากหน้าตัด(ต·ม)
   ข้อมูลหน้าตัด/น้ำหนัก/พื้นที่/รับแกน = แคตตาล็อกผู้ผลิตตาม มอก.396-2549 · Mcr ประมาณ → ยืนยันกับผู้ผลิต */
const IPILE={   /* มอก.396-2549 ตารางที่ 3 — มิติจริงภาคตัดขวางตัวไอ (มม.): B กว้าง=ลึก · K สูงปลายปีก · N สูงโคนปีก
     · O ช่วงเอวตรงกลาง (=B−2N) · U หนาเอว · V=(B−U)/2 (ระยะลาดปีก) · area=Ac ตามตาราง (ซม.²) · I-45 w/Psafe/Mcr ประมาณ—ยืนยันผู้ผลิต */
  18:{b:18,w:66, perim:89, area:275, Psafe:[6,15],  Mcr:0.55,K:60, N:75, O:30, U:70, V:55},
  22:{b:22,w:93, perim:109,area:386, Psafe:[15,25], Mcr:1.0, K:65, N:85, O:50, U:80, V:70},
  26:{b:26,w:117,perim:131,area:489, Psafe:[18,35], Mcr:1.6, K:65, N:85, O:90, U:90, V:85},
  30:{b:30,w:158,perim:150,area:660, Psafe:[30,45], Mcr:2.5, K:75, N:105,O:90, U:100,V:100},
  35:{b:35,w:211,perim:176,area:880, Psafe:[35,60], Mcr:4.0, K:85, N:115,O:120,U:120,V:115},
  40:{b:40,w:298,perim:197,area:1240,Psafe:[45,80], Mcr:5.9, K:110,N:140,O:120,U:160,V:120},
  45:{b:45,w:380,perim:221,area:1549,Psafe:[55,100],Mcr:8.4, K:120,N:160,O:130,U:170,V:140}
};
const ipileSpec=sz=>IPILE[Math.round(sz)]||IPILE[35];
/* Build 172 · ทะเบียนหน้าตัดเข็มฐาน — รูปทรง/แกนดัด/พื้นที่/I/S ใช้ชุดเดียวใน engine, แบบ, BOQ และ JSON
   I-pile polygon ใช้มิติ B·K·N·U ในตารางข้างบน; shoelace ให้พื้นที่ตรง Ac ภายในค่าปัดเศษตาราง (มากสุด 0.5 ซม² ที่ I-18) */
function iPileGeom172(s){s=s||IPILE[35];const B=(s.b||35)/100,h=B/2,K=(s.K||85)/1000,N=(s.N||115)/1000,U=(s.U||120)/1000,
  p=[[-h,-h],[-h,h],[-(h-K),h],[-(h-N),U/2],[(h-N),U/2],[(h-K),h],[h,h],[h,-h],[(h-K),-h],[(h-N),-U/2],[-(h-N),-U/2],[-(h-K),-h]];
  let A=0,Ix=0,Iy=0;for(let n=0;n<p.length;n++){const a=p[n],b=p[(n+1)%p.length],c=a[0]*b[1]-b[0]*a[1];A+=c;Ix+=(a[1]*a[1]+a[1]*b[1]+b[1]*b[1])*c;Iy+=(a[0]*a[0]+a[0]*b[0]+b[0]*b[0])*c;}
  A=Math.abs(A)/2;Ix=Math.abs(Ix)/12;Iy=Math.abs(Iy)/12;const Istrong=Math.max(Ix,Iy),Iweak=Math.min(Ix,Iy);
  return{B,A,Ix,Iy,Istrong,Iweak,Sstrong:Istrong/h,Sweak:Iweak/h,points:p,web:U};}
function pileSection172(i){i=i||{};const shape=i.pileShape==='bored'?'bored':(i.pileShape==='i'?'i':'sq');
  if(shape==='i'){const spec=ipileSpec(i.ipile||Math.round((i.pileB||.35)*100)),g=iPileGeom172(spec),axis=i.pileIAxis==='weak'?'weak':'strong',I=axis==='weak'?g.Iweak:g.Istrong,S=axis==='weak'?g.Sweak:g.Sstrong;
    return{shape,name:'I-'+spec.b,B:g.B,Ag:(spec.area||g.A*1e4)/1e4,I,S,bw:g.web,perimeter:(spec.perim||0)/100,weight:spec.w||0,axis,axisLabel:axis==='weak'?'แกนอ่อน (หมุน 90°)':'แกนแข็ง',spec,points:g.points,catalogMcr_tm:spec.Mcr||0};}
  const B=Math.max(+i.pileB||.35,.15);if(shape==='bored')return{shape,name:'BORED Ø'+Math.round(B*100),B,Ag:Math.PI*B*B/4,I:Math.PI*Math.pow(B,4)/64,S:Math.PI*Math.pow(B,3)/32,bw:B,perimeter:Math.PI*B,weight:0,axis:'round',axisLabel:'รอบแกน'};
  return{shape,name:'SQ '+Math.round(B*100)+'×'+Math.round(B*100),B,Ag:B*B,I:Math.pow(B,4)/12,S:Math.pow(B,3)/6,bw:B,perimeter:4*B,weight:B*B*2400,axis:'square',axisLabel:'สมมาตร'};}
/* โปรไฟล์ดิน (เติม top/bot สะสมจากผิวดิน) — fallback ดินชั้นเดียวจากอินพุต i */
function soilProfile(i){
  // หน่วยภายใน SI: gamma kN/m³, su kN/m² (kPa) · i.gs เป็น SI แล้ว · i.su เป็น t/m² → ×G · i.c เป็น SI แล้ว
  let L=(SOILLAYERS&&SOILLAYERS.length)?SOILLAYERS.map(x=>({...x})):
    [{h:999,type:(i.phi<5||i.c>0)?'clay':'sand',gamma:i.gs,phi:i.phi,su:Math.max((i.su||0)*G,i.c||0,0.1)}];
  let z=0; L.forEach(l=>{l.top=z; z+=Math.max(l.h,0.1); l.bot=z;}); return L;
}
/* อ่านตารางชั้นดินจากกล่องข้อความ → SOILLAYERS (γ ต/ม³→kN · Su ต/ม²→kPa) · ว่าง = null (ดินชั้นเดียว) */
const layerAt=(prof,z)=>prof.find(l=>z>=l.top&&z<l.bot)||prof[prof.length-1];
/* k_h ที่ความลึก z (จากผิวดิน) — ทราย n_h·z/B · เหนียว 67·Su/B (kN/m³) */
function khAt(prof,z,B){const l=layerAt(prof,Math.max(z,0));
  return l.type==='clay'?67*Math.max(l.su,0.1)/B:nhFromPhi(l.phi)*Math.max(z,0.1)/B;}
/* หน่วยแรงดิ่งประสิทธิผล + แรงดัน active ที่ความลึก z (kN/m², หลายชั้น + น้ำ) */
function sigA(prof,z,zw,q){let sv=0,pz=0;const dz=0.1;
  for(let zz=dz/2;zz<z;zz+=dz){const l=layerAt(prof,zz);const g=(zz>zw)?Math.max(l.gamma-GW,4):l.gamma;sv+=g*dz;pz=zz;}
  const l=layerAt(prof,z),ph=l.phi*D2R,Ka=l.type==='clay'?1:Math.pow(Math.tan((45-l.phi/2)*D2R),2),c=l.type==='clay'?Math.max(l.su,0):0;
  return Math.max(Ka*(sv+q)-2*c*Math.sqrt(Ka),0);}
/* ---- generic 2D frame (3 DOF/node) : nodes{x,y} · beams{a,b,EA,EI} · trusses{a,b,EA} · springs{n,kx,ky} · loads{n,fx,fy,m} · fixed[dof] ---- */
function frameSolve({nodes,beams=[],trusses=[],springs=[],loads=[],fixed=[]}){
  const N=nodes.length, ND=3*N;
  const K=Array.from({length:ND},()=>new Float64Array(ND)), F=new Float64Array(ND);
  const beam=(a,b,EA,EI)=>{const dx=nodes[b].x-nodes[a].x,dy=nodes[b].y-nodes[a].y,L=Math.hypot(dx,dy)||1e-6,c=dx/L,s=dy/L;
    const E1=EA/L,e12=12*EI/(L**3),e6=6*EI/(L*L),e4=4*EI/L,e2=2*EI/L;
    const kl=[[E1,0,0,-E1,0,0],[0,e12,e6,0,-e12,e6],[0,e6,e4,0,-e6,e2],[-E1,0,0,E1,0,0],[0,-e12,-e6,0,e12,-e6],[0,e6,e2,0,-e6,e4]];
    const T=[[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];
    const kt=Array.from({length:6},()=>new Float64Array(6));
    for(let p=0;p<6;p++)for(let j=0;j<6;j++){let v=0;for(let m=0;m<6;m++)v+=kl[p][m]*T[m][j];kt[p][j]=v;}
    const kg=Array.from({length:6},()=>new Float64Array(6));
    for(let p=0;p<6;p++)for(let j=0;j<6;j++){let v=0;for(let m=0;m<6;m++)v+=T[m][p]*kt[m][j];kg[p][j]=v;}
    const map=[3*a,3*a+1,3*a+2,3*b,3*b+1,3*b+2];
    for(let p=0;p<6;p++)for(let j=0;j<6;j++)K[map[p]][map[j]]+=kg[p][j];};
  beams.forEach(e=>beam(e.a,e.b,e.EA,e.EI));
  trusses.forEach(({a,b,EA})=>{const dx=nodes[b].x-nodes[a].x,dy=nodes[b].y-nodes[a].y,L=Math.hypot(dx,dy)||1e-6,c=dx/L,s=dy/L,k=EA/L;
    const m=[3*a,3*a+1,3*b,3*b+1],cc=c*c,ss=s*s,cs=c*s,kt=[[cc,cs,-cc,-cs],[cs,ss,-cs,-ss],[-cc,-cs,cc,cs],[-cs,-ss,cs,ss]];
    for(let p=0;p<4;p++)for(let j=0;j<4;j++)K[m[p]][m[j]]+=k*kt[p][j];});
  springs.forEach(({n,kx=0,ky=0})=>{K[3*n][3*n]+=kx;K[3*n+1][3*n+1]+=ky;});
  loads.forEach(({n,fx=0,fy=0,m=0})=>{F[3*n]+=fx;F[3*n+1]+=fy;F[3*n+2]+=m;});
  fixed.forEach(d=>{K[d][d]+=1e12;});
  const U=gaussSolve(K.map(r=>Array.from(r)),Array.from(F));
  return {U,nodes};
}
/* ---- ประกอบ+แก้ระบบกำแพงเสาเข็มไอ (anchored bulkhead) เป็นโครงเชื่อมโยง ----
   คืน {nodes,U,front[],back[],stayN,upliftN, dF(z),dB(z), Mfront,Vfront,Mback} (หน่วย kN,m,kN·m) */
function soldierFrame(o){   // o:{H,D,Bp,EI,EA,SS,Lb,yCap,angle,S,q,zw,prof,EAstay,a}
  const {H,D,Bp,EI,EA,SS,Lb,yCap,angle,S,q,zw,prof,EAstay}=o, aLv=o.a||0;
  const tie=SS!=='cant';
  const nF=18, dzF=(H+D)/nF, nodes=[], fI=[];
  for(let k=0;k<=nF;k++){nodes.push({x:0,y:H-(H+D)*k/nF});fI.push(k);}            // เสาเข็มหน้า: y=H→−D
  const beams=[],trusses=[],springs=[],loads=[],fixed=[];
  for(let k=0;k<nF;k++)beams.push({a:fI[k],b:fI[k+1],EA,EI});
  // springs ด้านข้าง (เฉพาะใต้ระดับขุด y<0) + ยึดแนวดิ่งปลายเข็มหน้า
  for(let k=0;k<=nF;k++){const y=nodes[fI[k]].y; if(y<0){const z=H-y; springs.push({n:fI[k],kx:khAt(prof,z,Bp)*Bp*dzF});}}
  fixed.push(3*fI[nF]+1);                                                          // ปลายเข็มหน้า: ยึดแนวดิ่ง (แบกทาน)
  // แรงดัน active บนเสาเข็มหน้า เหนือระดับขุด (y>0) — ผลักออกจากดิน = −x · ×S (ต่อเสาเข็ม)
  for(let k=0;k<=nF;k++){const y=nodes[fI[k]].y; if(y>0){loads.push({n:fI[k],fx:-sigA(prof,H-y,zw,q)*S*dzF});}}
  let bI=[],capNode=null,bondNode=null;
  // จุดยึดรั้ง (tie) = โหนดเสาเข็มหน้าที่ระดับ a (ลึกจากยอด) — ไม่ใช่ยอดเสาเข็ม (แก้ให้พฤติกรรม/รูปโก่งตรงกับ a)
  let tieNode=fI[0]; {const tieY=H-aLv; let tb=1e9; for(let k=0;k<=nF;k++){const dd=Math.abs(nodes[fI[k]].y-tieY); if(dd<tb){tb=dd;tieNode=fI[k];}}}
  if(tie&&SS==='anchor'){
    // สมอดินเอียง: truss ไปยังจุด bond (ตรึง) ในดินมั่นคงพ้น wedge
    const ang=(angle||20)*D2R, bx=Lb, by=yCap-Lb*Math.tan(ang);
    nodes.push({x:bx,y:by}); bondNode=nodes.length-1; fixed.push(3*bondNode,3*bondNode+1);
    trusses.push({a:tieNode,b:bondNode,EA:EAstay});
  }else if(tie){
    // เสาเข็มสมอด้านหลัง (หัวที่ cap → ฝังลง) + สเตย์ดึง front@a → cap
    const Db=D, nB=14, dzB=(yCap+Db)/nB;
    for(let k=0;k<=nB;k++){nodes.push({x:Lb,y:yCap-(yCap+Db)*k/nB});bI.push(nodes.length-1);}
    capNode=bI[0];
    for(let k=0;k<nB;k++)beams.push({a:bI[k],b:bI[k+1],EA,EI});
    for(let k=0;k<=nB;k++){const y=nodes[bI[k]].y,z=H-y; springs.push({n:bI[k],kx:khAt(prof,z,Bp)*Bp*dzB, ky:0.6*khAt(prof,z,Bp)*Bp*dzB});}  // ข้าง+ดึงแนวดิ่ง(แรงเสียดทาน)
    fixed.push(3*bI[nB]+1);
    trusses.push({a:tieNode,b:capNode,EA:EAstay});
  }
  const r=frameSolve({nodes,beams,trusses,springs,loads,fixed}),U=r.U;
  const ux=n=>U[3*n], uy=n=>U[3*n+1];
  // โมเมนต์/เฉือนเสาเข็มหน้า (M=EI·y″ เชิงตัวเลข, ต่อเสาเข็ม)
  let Mf=0,Vf=0; for(let k=1;k<nF;k++){const M=EI*(ux(fI[k-1])-2*ux(fI[k])+ux(fI[k+1]))/(dzF*dzF); if(Math.abs(M)>Math.abs(Mf))Mf=M;}
  for(let k=1;k<nF;k++){const V=EI*(ux(fI[k-1])-2*ux(fI[k])+ux(fI[k+1]))/(dzF*dzF); } // (โมเมนต์พอ)
  Vf=Math.abs(Mf)/Math.max(0.6*(H+D),1);   // ประมาณ V จาก M (เพียงพอสำหรับเช็คเบื้องต้น)
  // แรงสเตย์ (ดึง+ = tension)
  let stayN=0, Mb=0;
  if(tie){const b=(SS==='anchor')?bondNode:capNode,a=tieNode,dx=nodes[b].x-nodes[a].x,dy=nodes[b].y-nodes[a].y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L;
    stayN=EAstay/L*((ux(b)-ux(a))*c+(uy(b)-uy(a))*s);
    if(SS!=='anchor'){for(let k=1;k<bI.length-1;k++){const M=EI*(ux(bI[k-1])-2*ux(bI[k])+ux(bI[k+1]))/(((yCap+D)/14)**2); if(Math.abs(M)>Math.abs(Mb))Mb=M;}}}
  const upliftN=tie?Math.max(stayN*Math.sin(((SS==='anchor'?(angle||20):Math.atan2(H-yCap,Lb)/D2R)||0)*D2R),0):0;
  let dmx=0; [...fI,...(bI||[])].forEach(id=>{const v=Math.abs(ux(id)); if(v>dmx)dmx=v;});   // δmax ทั้งระบบ (m)
  return {nodes,U,fI,bI,capNode,bondNode,nF,dzF,Mfront:Math.abs(Mf),Vfront:Math.abs(Vf),stayN,Mback:Math.abs(Mb),upliftN,
    dMaxMM:dmx*1000, dTopFront:ux(fI[0])*1000, dTopBack:tie&&capNode!=null?ux(capNode)*1000:0, tie, SS};
}
/* ---- ประกอบ+แก้ระบบกำแพงวางบนเสาเข็ม 2 แถว เป็นโครงเชื่อมโยง (cap แข็ง + เสาเข็ม layered springs ภายใต้ V,H,M) ----
   คืน node displacements (สำหรับ deform เชื่อมโยง) + δmax + โมเมนต์เสาเข็ม (หน่วย kN,m) */
function pileWallFrame(o){   // o:{xF,xB,Le,Bp,EI,EA,Ph,W,ybar,hz,prof,scrX}
  const {xF,xB,Le,Bp,EI,EA,Ph,W,ybar,hz,prof,scrX}=o;
  const nP=14, dz=Le/nP, nodes=[], FI=[], BI=[];
  for(let k=0;k<=nP;k++){nodes.push({x:xF,y:-dz*k});FI.push(nodes.length-1);}      // แถวหน้า (toe) y=0→−Le
  for(let k=0;k<=nP;k++){nodes.push({x:xB,y:-dz*k});BI.push(nodes.length-1);}      // แถวหลัง (heel)
  const cC=nodes.length; nodes.push({x:(xF+xB)/2,y:0});                            // ศูนย์กลาง cap
  const stem=nodes.length; nodes.push({x:scrX,y:hz+ybar});                         // จุดแรงด้านข้างบนพนัง
  const beams=[],springs=[],loads=[],fixed=[];
  const sEI=EI*60, sEA=EA*60;                                                      // ลิงก์แข็ง (rigid cap/stem)
  for(let k=0;k<nP;k++){beams.push({a:FI[k],b:FI[k+1],EA,EI});beams.push({a:BI[k],b:BI[k+1],EA,EI});}
  beams.push({a:cC,b:FI[0],EA:sEA,EI:sEI});beams.push({a:cC,b:BI[0],EA:sEA,EI:sEI});beams.push({a:cC,b:stem,EA:sEA,EI:sEI});
  const Kax=EA/Le;                                                                 // สติฟเนสแนวแกนเสาเข็ม (สปริงหัว → คู่ควบต้านพลิกคว่ำ)
  [FI,BI].forEach(arr=>{arr.forEach(id=>{springs.push({n:id,kx:khAt(prof,Math.max(-nodes[id].y,0.1),Bp)*Bp*dz});});
    springs.push({n:arr[0],ky:Kax}); springs.push({n:arr[nP],ky:Kax});});          // สปริงแนวดิ่งหัว+ปลาย (แบกทาน/เสียดทาน)
  loads.push({n:stem,fx:-Ph}); loads.push({n:cC,fy:-W});                           // แรงด้านข้าง + นน.ดิ่ง
  const r=frameSolve({nodes,beams,springs,loads,fixed}),U=r.U,ux=n=>U[3*n];
  let dmx=0;[...FI,...BI].forEach(id=>{const v=Math.abs(ux(id));if(v>dmx)dmx=v;});
  let Mf=0;for(let k=1;k<nP;k++){const M=EI*(ux(FI[k-1])-2*ux(FI[k])+ux(FI[k+1]))/(dz*dz);if(Math.abs(M)>Math.abs(Mf))Mf=M;}
  return {nodes,U,FI,BI,cC,stem,nP,dz,xF,xB,dMaxMM:dmx*1000,Mpile:Math.abs(Mf),capUx:ux(cC)};
}

/* ============================================================
   CORE CALCULATION
   ============================================================ */
function calc(i){
  const warn=[];
  if(i.wtype==='soldier')return calcSoldier(i,warn);            // ระบบเสาเข็มตัวไอ (กำแพงพืดฝังตัว)
  const C=CD();                                                 // มาตรฐานออกแบบที่เลือก (load factor & φ)
  const {hp,hz,t,B,toe,L,bs,gs,gsat,phi,q,qa,mu,zw,Df,dk,kh,fc,fy,gc}=i;
  const cc=Math.max(i.c||0,0);                                  // แรงยึดเกาะดิน (kN/m²) — ลดแรงดัน active (ค่าเริ่มต้น 0)
  if(cc>0)warn.push('ใช้แรงยึดเกาะ c>0 ลดแรงดันดิน — ไม่แนะนำสำหรับกำแพงถาวร (c เสื่อมเมื่อดินเปียก/แปรสภาพ/รบกวน) พิจารณาใช้ c=0 และระวังรอยแตกดึงที่อาจมีน้ำขัง');
  /* ★ ดินฐานราก (ใต้ฐาน) แยกจากดินหลัง — โหมด foundSep: bearing/passive/adhesion ใช้ φ₂/c₂/γ₂ ของดินฐาน (ตรงตำรา Das Ex.13.1) · ปิด = ใช้ดินหลังชุดเดียวเหมือนเดิม */
  const foundSep=!!i.foundSep;
  /* ★ φ₂ = 0 คือ "ค่าที่ถูกต้อง" ไม่ใช่ "ยังไม่ได้กรอก" — ดินเหนียวแบบไม่ระบายน้ำ (undrained, φ=0)
     เป็นสภาพฐานรากที่พบบ่อยที่สุดในไทย (ดินอ่อน กทม. · ดินเหนียวแข็ง)
     บั๊กเดิม (แก้ 2569-07): เงื่อนไข `i.phiF>0` ทำให้ φ₂=0 (falsy) หล่นไปใช้ φ ของ "ดินถม" แทน
     → เลือกดินฐาน "ดินเหนียวแข็ง φ₂=0" แต่ engine แอบใช้ φ=35° ของลูกรัง
     → N_q 1→33 · N_γ 0→37 · q_a 7→91 ตัน/ม² (เกินจริง ~13 เท่า) · แรงต้านเลื่อนและ passive ก็เกินตาม
     → ฐานรากบนดินเหนียวจะ "ผ่าน" ทั้งที่ต้องไม่ผ่าน = อันตรายถึงชีวิต
     เมื่อ foundSep เปิด = ผู้ใช้ระบุดินฐานเองแล้ว → ใช้ค่าที่กรอกตรง ๆ (ว่าง/NaN → 0 จาก inputs()) */
  const phiF=foundSep?Math.max(i.phiF||0,0):phi;                // มุมเสียดทานดินฐาน φ₂ (0 = ดินเหนียว undrained)
  const cF=foundSep?Math.max(i.cF||0,0):cc;                     // แรงยึดเกาะดินฐาน c₂
  const gsF=foundSep&&i.gsF>0?i.gsF:gs;                         // หน่วยน้ำหนักดินฐาน γ₂
  const kSl=2/3;                                                // k₁=k₂=⅔ (ลดกำลังเสียดทาน/ยึดเกาะที่ฐาน · Das)
  const baseResist=V=>foundSep?(V*Math.tan(kSl*phiF*D2R)+B*kSl*cF):(mu*V);  // ต้านเลื่อน: foundSep = V·tan(k₁φ₂) + B·k₂·c₂ · เดิม = μ·V
  const onPile=(i.wtype==='pile'||i.wtype==='pilecf');          // วางบนเสาเข็ม (ยื่น/ครีบ)
  const isGravity=i.wtype==='gravity';                          // กำแพงมวลสอบ/กึ่งแรงโน้มถ่วง คสล. — Coulomb production
  if(hz>0&&hz<0.20)warn.push('ฐานรากหนา < 0.20 ม. — กฎกระทรวง พ.ศ.2566 (ฐานราก) กำหนดขั้นต่ำ 0.20 ม.');
  if(!onPile&&Df>0&&Df<1.00)warn.push('ความลึกฝังฐาน Df < 1.00 ม. — กฎกระทรวง พ.ศ.2566 (ฐานราก ข้อ 11) กำหนดขั้นต่ำ 1.00 ม.');
  const mode=i.wtype==='pilecf'?'but':((onPile||isGravity)?'cant':i.wtype), beta=Math.min(i.beta,phi-1);
  if(i.beta>=phi)warn.push(`β ต้องน้อยกว่า φ — ใช้ β = ${fmt(beta,0)}° ในการคำนวณ`);
  const cov=i.cov/1000, db=i.db;
  const H=hp+hz;
  /* ผนังสอบ (tapered stem): หน้า(นอก)ดิ่งคงที่ · หลัง(ดิน)สอบเข้า → ความหนาที่ลึก zd จากยอด (magnitude เท่าเดิม) */
  const tTop=(i.ttop>0&&i.ttop<t-0.005)?i.ttop:t, tapered=tTop<t-0.005;
  const tAt=zd=>tTop+(t-tTop)*Math.min(Math.max(zd/Math.max(hp,0.1),0),1);   // zd=0 ยอด→tTop, zd=hp ฐาน→t
  /* Gravity: θ signed มาจากผิวหลังจริง (ยอดเข้าดินเป็นบวก · ฐานบานเข้าดินเป็นลบ) · δ จำกัด φ/2 ตาม USACE §3-14
     เมื่อผู้ใช้กรอกเกินยังเตือนชัดและทะเบียน checks จะไม่ผ่าน — engine ใช้ค่าที่จำกัดเพื่อไม่คำนวณกำลังเกินจริง */
  const wallTheta=isGravity?Math.atan2(tTop-t,Math.max(hp,0.1))/D2R:0;
  const wallDeltaIn=isGravity?Math.max(i.wallDelta||0,0):0, wallDelta=isGravity?Math.min(wallDeltaIn,phi/2):0;
  const forceAngle=isGravity?(wallDelta-wallTheta):0;             // P ทำมุม δ จาก normal ของผิว → มุมจากแนวราบ = δ−θ
  const coulombApplicOK=!isGravity||beta<=0.5||zw<=0||zw>=hp;      // USACE direct Coulomb: WT กลางชั้นใช้ได้เมื่อผิวดินราบ; ถ้าผิวลาดต้องอยู่เหนือ/ใต้ backfill ทั้งหมด
  if(isGravity&&wallDeltaIn>phi/2+1e-9)warn.push('δ ดิน–ผนัง = '+fmt(wallDeltaIn,1)+'° > φ/2 = '+fmt(phi/2,1)+'° — จำกัดค่าที่ใช้คำนวณ Coulomb เป็น φ/2 ตาม USACE EM 1110-2-2502 §3-14 และต้องแก้ช่อง δ ให้ผ่านก่อนอนุมัติ');
  if(isGravity&&!coulombApplicOK)warn.push('⛔ Coulomb direct solution อยู่นอกเงื่อนไข USACE: ผิวดินลาด β>0 แต่ระดับน้ำตัดอยู่กลาง backfill — ต้องใช้ general wedge/seepage analysis หรือปรับเคสให้น้ำอยู่เหนือ/ใต้ backfill ทั้งหมด; Approval Gate จะบล็อกผลนี้');
  if(isGravity)warn.push('Coulomb active สมมติว่ากำแพงเคลื่อนตัว/หมุนได้พอให้ดินเข้าสู่ active state — ถ้าผนังถูกยึดรั้งหรือการเคลื่อนตัวถูกจำกัด ให้ใช้แรงดัน at-rest/general wedge เพิ่มเติมก่อนอนุมัติ');
  if(isGravity&&!tapered)warn.push('Gravity wall ยังเป็นหน้าตัดสี่เหลี่ยม (t↑ = t) — ใช้ได้ แต่โดยทั่วไปควรทำผนังสอบเพื่อวางน้ำหนักให้คุ้มค่าและลดปริมาณคอนกรีต');
  const massTrigger=Math.max(i.cMassTrigger||1.0,.50),maxMassSection=Math.max(t,hz);
  if(isGravity&&maxMassSection>=massTrigger)warn.push('Gravity wall หน้าตัดหนาสุด '+fmt(maxMassSection,2)+' ม. ≥ project thermal trigger '+fmt(massTrigger,2)+' ม. — ต้องมี Thermal assessment/control plan กำหนด mix, lift, ลำดับเท, Tmax/Tdiff, monitoring และการบ่มโดยผู้รับผิดชอบ; trigger นี้เป็น screening ไม่ใช่นิยาม mass concrete ตายตัว และผลโครงสร้างนี้ยังไม่ใช่ thermal analysis');
  let heel=B-toe-t;
  if(heel<=0.05){warn.push('heel ≤ 0 — เพิ่ม B หรือลด toe/t');heel=0.05;}
  /* ครีบยึด (counterfort): ความยาว/สูงกำหนดเองได้ · 0 = อัตโนมัติ (ยาวเต็ม heel · สูงเต็ม hp ตามมาตรฐาน) */
  let cfLr=(i.cfL>0&&i.cfL<=heel+1e-6)?Math.min(i.cfL,heel):heel;   // ความลึกหน้าตัดครีบ (วัดตามหลัง)
  let cfHr=(i.cfH>0&&i.cfH<=hp+1e-6)?Math.min(i.cfH,hp):hp;         // ช่วงครีบยึดรั้งพนัง (แนวดิ่ง)
  if(i.wtype==='but'||i.wtype==='pilecf'){
    if(i.cfL>0&&i.cfL<heel-0.01)warn.push(`ครีบยาว ${fmt(cfLr,2)} ม. < heel ${fmt(heel,2)} ม. — ใช้เป็นความลึกหน้าตัดครีบ (d=Lc) แนะนำให้ครีบยาวเต็ม heel เพื่อรับโมเมนต์เต็มที่`);
    if(i.cfH>0&&i.cfH<hp-0.01)warn.push(`ครีบสูง ${fmt(cfHr,2)} ม. < hp ${fmt(hp,2)} ม. — พนังเหนือยอดครีบทำงานแบบยื่น (cantilever) ต้องตรวจกำลังพนังช่วงไม่มีครีบยึดเพิ่มเติม`);
  }
  const tanB=Math.tan(beta*D2R), cosB=Math.cos(beta*D2R);
  /* Rankine เดิมใช้ระนาบเสมือนที่ปลาย heel สูงถึงท้องฐาน; Gravity/Coulomb ใช้ผิวหลังพนังจริงสูง hp
     และบวก hz เฉพาะแขนโมเมนต์รอบท้องฐาน — ห้ามเอา heel ไปเพิ่มความสูงแรงหรือเอา Pv ไปวางปลาย heel */
  const Hq=isGravity?hp:(H+heel*tanB);          // ความสูงระนาบรับแรง: actual back face vs virtual Rankine plane
  const KaRaw=isGravity?kaCoulomb(phi,beta,wallDelta,wallTheta):kaRankine(phi,beta), coulombOK=!isGravity||(isFinite(KaRaw)&&KaRaw>0);
  let Ka=coulombOK?KaRaw:kaRankine(phi,beta);
  if(!coulombOK)warn.push('Coulomb อยู่นอกโดเมนสำหรับชุด φ/β/δ/θ นี้ — ใช้ Rankine เป็นค่าปลอดภัยชั่วคราวและต้องแก้มุมก่อนอนุมัติ');
  const Kp=Math.pow(Math.tan((45+phi/2)*D2R),2);
  const gp=Math.max(gsat-GW,5);               // submerged unit weight
  const d1=Math.min(Math.max(zw,0),Hq), d2=Hq-d1;        // above / below WT on plane
  const hwb=Math.max(0,H-Math.max(zw,0));                 // water height above base bottom

  /* ---- service earth pressure: numeric integration on plane Hq ---- */
  const N=400,dz=Hq/N,baseLever=isGravity?hz:0;let Phs=0,Pw=0,Mo=0,MoSoil=0,Mq=0;const prof=[];
  for(let k=0;k<N;k++){
    const z=(k+0.5)*dz;
    const sv=z<=d1?gs*z:gs*d1+gp*(z-d1);
    const earthH=isGravity?Math.cos(forceAngle*D2R):cosB;
    const ps=Math.max(Ka*(sv+q)-2*cc*Math.sqrt(Ka),0)*earthH, pw=z>d1?GW*(z-d1):0;
    Phs+=ps*dz;Pw+=pw*dz;Mo+=(ps+pw)*(baseLever+Hq-z)*dz;MoSoil+=ps*(baseLever+Hq-z)*dz;
    if(k%10===0)prof.push({z,p:ps+pw});
  }
  const Pv=Phs*Math.tan((isGravity?forceAngle:beta)*D2R);  // Gravity: P ทำมุม δ จาก normal → แนวดิ่งใช้ δ−θ · ระบบเดิมใช้ β
  const ySoil=MoSoil/Math.max(Phs,1e-9), zSoil=Math.min(Math.max(hz+hp-ySoil,0),hp);
  const xPv=isGravity?(toe+tAt(zSoil)):B;                 // จุดตัดแรงบนผิวหลังจริง ณ centroid ของแรงดิน
  const Ph=Phs+Pw, ybar=Mo/Math.max(Ph,1e-9);
  /* ★ กับดัก: c สูงจน Ka·σv ≤ 2c√Ka ตลอดความลึก → แรงดัน active = 0 → ΣM_พลิก ≈ 0 → FS = อนันต์
     ถูกทางคณิตศาสตร์ แต่ห้ามใช้ออกแบบกำแพงถาวร (c เสื่อมเมื่อดินเปียก/ถูกรบกวน + รอยแตกดึงอาจมีน้ำขัง) */
  if(cc>0 && Ph < 0.05*(0.5*gs*H*H))
    warn.push('⚠ <b>แรงดันดิน active ≈ 0</b> เพราะแรงยึดเกาะ c = '+fmt(cc/(UMODE==='mks'?9.80665:1),1)+' สูงจน Ka·σ<sub>v</sub> ≤ 2c√Ka ตลอดความลึก → <b>FS พลิกคว่ำ/เลื่อนไถล ไม่มีความหมาย</b> (หารด้วยศูนย์) · <b style="color:#C2362B">ห้ามใช้ผลนี้ออกแบบกำแพงถาวร</b> — ให้ตั้ง <b>c = 0</b> แล้วออกแบบใหม่ (cohesion เสื่อมเมื่อดินเปียก/แปรสภาพ/ถูกรบกวน)');
  const Ca=Ka*gs*hp*(isGravity?Math.cos(forceAngle*D2R):cosB);

  /* ---- weights about toe: x=arm, y=centroid height, st=count in stability, ms=mass(inertia) ---- */
  const Lt=L+bs;
  const wBut=0.5*cfLr*cfHr*bs*gc/Lt;          // น้ำหนักครีบเฉลี่ย/ม. (ใช้ความยาว/สูงครีบจริง)
  const hsub=Math.min(Math.max(hwb-hz,0),hp);          // submerged heel-soil height
  const W=[];
  if(tapered){   // หน้า(นอก)ดิ่งที่ x=toe · ส่วนหน้าหนาคงที่(สี่เหลี่ยม tTop) + ลิ่มสอบด้านดิน(สามเหลี่ยม) บานออกที่โคน
    W.push({n:'พนัง STEM ส่วนหน้า (tTop×hp)', v:tTop*hp*gc, x:toe+tTop/2, y:hz+hp/2, st:1, ms:1});
    W.push({n:'พนัง STEM ลิ่มสอบด้านดิน', v:0.5*(t-tTop)*hp*gc, x:toe+(t+2*tTop)/3, y:hz+hp/3, st:1, ms:1});
  }else{
    W.push({n:'พนัง STEM (t×hp)', v:t*hp*gc, x:toe+t/2, y:hz+hp/2, st:1, ms:1});
  }
  W.push({n:'ฐานราก BASE (B×hz)', v:B*hz*gc, x:B/2, y:hz/2, st:1, ms:1});
  if(mode==='but')W.push({n:'ครีบ BUTTRESS (เฉลี่ย/ม.)', v:wBut, x:toe+t+cfLr/3, y:hz+cfHr/3, st:1, ms:1});
  W.push({n:'ดินถมบนฐานหลัง'+(hsub>0?' (รวมส่วนจมน้ำ γsat)':''),
    v:heel*(gs*(hp-hsub)+gsat*hsub), x:toe+t+heel/2, y:hz+hp/2, st:1, ms:1});
  if(beta>0)W.push({n:'ลิ่มดินลาด β บน heel', v:0.5*heel*heel*tanB*gs, x:toe+t+2*heel/3, y:H+heel*tanB/3, st:1, ms:1});
  W.push({n:isGravity?'แรงดัน Coulomb แนวดิ่ง Pv (δ · ผิวหลังจริง)':'แรงดันดินแนวดิ่ง Pv (β)', v:Pv, x:xPv, y:0, st:1, ms:0});
  W.push({n:'น้ำหนักจร q บน heel (คิดเฉพาะ Bearing)', v:q*heel, x:toe+t+heel/2, y:0, st:0, ms:0});
  let SVs=0,SMs=0,SVb=0,SMb=0,Wm=0,My=0;
  W.forEach(w=>{ if(w.st){SVs+=w.v;SMs+=w.v*w.x;} SVb+=w.v;SMb+=w.v*w.x;
    if(w.ms){Wm+=w.v;My+=w.v*w.y;} });

  /* ---- uplift ---- */
  const U=hwb>0?0.5*GW*hwb*B:0, xU=2*B/3;

  /* ---- passive / shear key ---- (foundSep: ½Kp₂γ₂D² + 2c₂√Kp₂·D เต็มตาม Das · เดิม: ½Kp·γ·D² แล้วหารสองอนุรักษ์) */
  const Dp=Df+dk, Kp2=Math.pow(Math.tan((45+phiF/2)*D2R),2);
  const PpFull=0.5*Kp2*gsF*Dp*Dp + (foundSep?2*cF*Math.sqrt(Kp2)*Dp:0);
  /* ★★ 🔴 บั๊กความปลอดภัย (พบ+วัด+แก้ 2569-07 build 159) — เดิม:
       `const Pp=foundSep?PpFull:½Kp·γ·Dp², PpAll=foundSep?PpFull:(i.usePp?Pp/2:0);`
     เมื่อ foundSep=true (**ค่าเริ่มต้นของแอป**) บรรทัดนี้ทำผิด 2 อย่างพร้อมกัน:
       (1) **ข้ามสวิตช์ `usePp` ทั้งหมด** → วิศวกรติ๊กปิด "ใช้ passive" เพื่อความปลอดภัย แล้วแอปนับให้อยู่ดี เงียบ ๆ
       (2) **ข้าม ÷2 ด้วย** → นับ passive ที่ค่า **ultimate เต็ม** ทั้งที่ป้ายบน UI เขียนเองว่า "(÷ FS 2.0)"
           (passive เต็มตาม Das ต้องขยับตัว 2–5% ของ H ถึงจะเกิดจริง — นับเต็มคือสมมติว่ากำแพงขยับไปแล้ว)
     **วัดจริงที่ค่าเริ่มต้น (cant):** แอปรายงาน FS_slide = 2.118 ผ่าน · แต่ถ้าเคารพ usePp=OFF → **1.237 ตก**
       = รายงานเกินจริง **71%** · และ passive คือสิ่งที่วิศวกร "ตั้งใจไม่นับ" บ่อยที่สุด (ดินหน้าอาจถูกขุดออกภายหลัง
       · ยังไม่อัดแน่น · ต้องขยับมากถึงจะเกิด) — แอปจึงมีสวิตช์นี้ตั้งแต่แรก
     คลาสเดียวกับ "ปลอกผี" build 150: **นับกำลังจากสิ่งที่ไม่ได้ตกลงว่าจะมี** → ดู criteria-must-match-deliverable
     ★ คงสูตร Das (รวม cohesion) ไว้เมื่อ foundSep — นั่นเป็นของดี · แต่ตัวคูณลดและสวิตช์ต้องบังคับใช้เสมอ */
  const Pp=foundSep?PpFull:0.5*Kp*gs*Dp*Dp;          // ค่าเต็ม (ultimate) — แสดงในรายงานได้
  const _ppFS=Math.max(+i.ppFS||2,1);
  const PpAll=i.usePp?Pp/_ppFS:0;                    // ★ เคารพสวิตช์เสมอ + ตัวคูณลดที่ผู้ใช้เลือก (ค่าเริ่มต้น ÷2)
  /* ★ ตัวคูณลดต้อง "มองเห็นและเลือกได้" ไม่ใช่ฝังในโค้ด — เพราะแอปเคยมี 2 ธรรมเนียมตีกันเงียบ ๆ:
       เส้นทาง foundSep ใช้ Pp เต็ม (ตามสูตร Das) · เส้นทางอื่นใช้ Pp/2 (อนุรักษ์) → ผลต่างกันเท่าตัวโดยผู้ใช้ไม่รู้
     Das, Principles of Foundation Engineering: FS_slide = [ΣV·tan(k₁φ₂) + B·k₂·c₂ + Pp] / Pa·cosα → นับ Pp **เต็ม**
     ⇒ ÷1.0 = โหมด Das (ทวนสอบตำราได้) · ÷2.0 = ค่าเริ่มต้นอนุรักษ์นิยม (passive เต็มต้องขยับตัวมาก) */
  /* ★ ตัว shear key เองต้องรับแรงไหวด้วย — เดิมนับกำลัง passive ของ key เข้า FS เลื่อนไถล (ให้ FS +26% ที่ dk=0.5)
     แต่ไม่เคยตรวจว่า "key รับแรงนั้นไหวไหม" = นับกำลังจากชิ้นส่วนที่ไม่ได้ตรวจ (คลาสเดียวกับปลอกผีใน build 150)
     key = คานยื่นจากใต้ฐาน (หน้าตัด b=1 ม.ตามยาวกำแพง × หนา t) รับแรงดัน passive เฉพาะช่วงลึก Df→Dp ที่หน้ามัน */
  let keyChk=null;
  if(dk>0){
    const KpU=foundSep?Kp2:Kp, gU=foundSep?gsF:gs, cU=foundSep?cF:0;
    const ppAt=z=>KpU*gU*z + 2*cU*Math.sqrt(KpU);                       // แรงดัน passive ที่ความลึก z (kN/ม²)
    const VkFull=0.5*(ppAt(Df)+ppAt(Dp))*dk;                            // แรงลัพธ์บนหน้า key (kN/ม.)
    const Vk=VkFull/_ppFS;                                               // แรงออกแบบ key ใช้ตัวคูณลดเดียวกับ passive ใน sliding
    const armK=(ppAt(Df)+2*ppAt(Dp))/(3*Math.max(ppAt(Df)+ppAt(Dp),1e-9))*dk;   // แขนจากโคน key ถึงแรงลัพธ์
    const dKey=Math.max(t-0.075-db/2000,0.05);                          // key หล่อติดดิน → cover ด้านอัด/ดึง 75 มม. (ไม่ใช้ cover พนัง 50 มม.)
    const phiVcK=phiVc(1,dKey,fc), MuK=C.gH*Vk*armK, VuK=C.gH*Vk;
    const AsKflex=asReq(MuK,1,dKey,fc,fy), flexSectionOK=isFinite(AsKflex);
    const AsKmin=0.0018*1e6*t, AsKreq=flexSectionOK?Math.max(AsKflex||0,AsKmin):0.04*1e6*t;
    keyChk={VkFull,Vk,VkCredit:i.usePp?Vk:0,credited:!!i.usePp,ppFS:_ppFS,VuK,MuK,armK,dKey,phiVcK,
      AsKflex,AsKmin,AsKreq,flexSectionOK,shOK:VuK<=phiVcK,ratV:VuK/Math.max(phiVcK,1e-6)};
    if(!keyChk.shOK)warn.push('⛔ <b>Shear key รับแรงเฉือนไม่ไหว</b> — V<sub>u</sub> ที่โคน key = '+fF(VuK,1)+' > φV<sub>c</sub> = '+fF(phiVcK,1)+' '+UL().F
      +' · <b>ต้องเพิ่มความหนา key (= ความหนาพนัง t) หรือลดความลึก d<sub>k</sub></b> — มิฉะนั้น key จะเฉือนขาดและ FS เลื่อนไถลที่นับ passive ไว้จะใช้ไม่ได้');
  }

  /* ---- stability (static) ---- */
  const MoT=Mo+U*xU;
  const FSot=SMs/Math.max(MoT,1e-9);
  const FSsl=(baseResist(SVs-U)+PpAll)/Math.max(Ph,1e-9);
  if(foundSep&&PpAll>0){const _res=baseResist(SVs-U)+PpAll; if(PpAll>0.30*_res)warn.push('แรงดันด้านรับ (passive) = '+fmt(PpAll/_res*100,0)+'% ของกำลังต้านเลื่อน — passive ใช้ได้ต่อเมื่อดินหน้ากำแพง<b>ถาวร</b> (ห้ามขุดออกภายหลัง/ไม่มีร่องสาธารณูปโภค) · ไม่แน่ใจให้ตั้ง Df=0 เพื่อตัด passive (อนุรักษ์)');}

  /* ---- seismic (M-O) ---- */
  let seis=null, seisBlocked=null;
  if(kh>0){
    const kv=Math.max(i.kv||0,0);
    const thMO=Math.atan(kh/Math.max(1-kv,1e-9))/D2R;         // θ = arctan[k_h/(1−k_v)]  · Okabe 1926 / Mononobe–Matsuo 1929
    const Kae=kaeMO(phi,beta,kh,kv);
    if(!isFinite(Kae)){
      /* ★★ 🔴 RW-FIX-2569-08-29 — เดิมบรรทัดนี้คือ  `Kae=Ka*1.5`  แล้วเดินต่อไปออก FS แผ่นดินไหวเป็นตัวเลข
         เงื่อนไขที่ M-O ใช้ได้คือ  φ ≥ θ + β   เมื่อ θ = arctan[k_h/(1−k_v)]
         ถ้า φ − θ − β ≤ 0 สมการไม่มีรากจริง — ไม่ใช่ "คำนวณไม่ได้" แต่แปลว่า
         **ลิ่มดินหลังกำแพงยืนไม่อยู่** ที่ความเร่งชุดนั้น (ดินถมพังก่อนกำแพง)
         การแทนค่าคงที่ที่ตั้งขึ้นเองแล้วรายงานเป็น Factor of Safety = นับกำลังจากสิ่งที่ไม่มีอยู่จริง
         → ต้อง fail closed · ทางแก้ตามตำราคือลด k_h ด้วยวิธี displacement-based
           (Richards–Elms / Newmark sliding block), ลดความชันหลังถม β, หรือใช้วัสดุถม φ สูงขึ้น */
      seisBlocked={reason:'MO_UNDEFINED',kh,kv,beta,phi,theta:thMO,margin:phi-thMO-beta};
      warn.push('⛔ <b>ประเมินแผ่นดินไหวไม่ได้ — Mononobe–Okabe อยู่นอกโดเมน</b> · φ − θ − β = '
        +fmt(phi,1)+'° − '+fmt(thMO,2)+'° − '+fmt(beta,1)+'° = <b>'+fmt(phi-thMO-beta,2)+'° ≤ 0</b> '
        +'(θ = arctan[k<sub>h</sub>/(1−k<sub>v</sub>)]) — แปลว่า<b>ลิ่มดินหลังกำแพงยืนไม่อยู่</b>ที่ k<sub>h</sub> = '+fmt(kh,3)
        +' ไม่ใช่แค่คำนวณไม่ได้ · <b>ระบบจึงไม่ออกค่า FS แผ่นดินไหวให้</b> → ลด k<sub>h</sub> ด้วยวิธี displacement-based '
        +'(Richards–Elms / Newmark), ลดความชันหลังถม β, หรือใช้วัสดุถม φ สูงขึ้น');
    } else {
      const dPae=0.5*gs*Hq*Hq*(1-kv)*(Kae-Ka)*cosB;          // รวมความเร่งแนวดิ่ง (1−kv)
      const Fi=kh*Wm, Fv=kv*Wm, yi=My/Math.max(Wm,1e-9);
      const SMsE=SMs*(1-kv);                                  // แนวดิ่งขึ้นลดน้ำหนักตัวต้าน (อนุรักษ์)
      const PhE=Ph+dPae+Fi, MoE=Mo+dPae*(0.6*Hq+baseLever)+Fi*yi+U*xU;
      seis={Kae,theta:thMO,dPae,Fi,Fv,kv,yi,PhE,MoE,
        FSot:SMsE/Math.max(MoE,1e-9),
        FSsl:(baseResist(SVs*(1-kv)-U)+PpAll)/Math.max(PhE,1e-9)};
    }
  }

  /* ---- bearing (incl. q live) ---- */
  const Vb=SVb-U;
  const xbar=(SMb-MoT)/Math.max(Vb,1e-9), e=B/2-xbar, kern=B/6;
  let q1,q2;
  if(Math.abs(e)<=kern){q1=Vb/B*(1+6*e/B);q2=Vb/B*(1-6*e/B);}
  else{q1=xbar>0?2*Vb/(3*xbar):Infinity;q2=0;}
  /* ---- กำลังแบกทานจากดิน (Meyerhof) + ความกว้างประสิทธิผล B′ + การทรุดตัวเบื้องต้น ---- */
  const Bpeff=Math.max(B-2*Math.abs(e),0.1);
  let bcap=null, qaUse=qa, qmaxEff=q1, FoSbear=qa>0?3*qa/Math.max(q1,1e-9):0, settle=null;
  /* ★ แยกอิสระ 2 คำถาม (เดิมผูกกันด้วย ||foundSep):
       foundSep = "ใช้ดินชั้นไหนคิด bearing/passive/adhesion" (φ₂·c₂·γ₂ ของดินฐาน vs φ·c·γ ของดินถม)
       QASRC    = "ได้ q_a มาอย่างไร" (soil=คำนวณ Meyerhof/Das · code=ตารางกฎกระทรวง · input=เจาะสำรวจ)
     เดิมพอ foundSep เป็นค่าปกติ → บังคับเดิน Meyerhof เสมอ → โหมด "qa ตามตารางกฎกระทรวง" ใช้ไม่ได้เลย */
  if(QASRC==='soil'){                                             // คำนวณ q_a จากดิน (foundSep → ใช้ φ₂/c₂/γ₂ ของดินฐาน)
    const gEff=(zw<H)?gp:gsF;                                      // ใต้ฐานจมน้ำ → γ′ (จม) · foundSep ใช้ γ₂ ดินฐาน
    bcap=bearingCap(cF,phiF,gEff,Math.max(Df,0),Bpeff,Ph,Vb,foundSep); bcap.gEff=gEff; bcap.submerged=(zw<H);
    qaUse=bcap.qall; qmaxEff=foundSep?q1:Vb/Bpeff; FoSbear=bcap.qult/Math.max(qmaxEff,1e-9);   // foundSep เทียบ q_toe (ตำรา Das) · เดิมเทียบ V/B′ (Meyerhof)
    const Es=Math.max(800*cF+1200*Math.max(phiF-25,0)+3000,3000);   // ประมาณการหยาบจาก c,φ ดินฐาน (kN/m²) — อันดับขนาด
    const qnet=Math.max(qmaxEff-gEff*Math.max(Df,0),0);
    settle={Es,qnet,mm:qnet*Bpeff*(1-0.09)*1.5/Es*1000};           // elastic strip (ν≈0.3, Iw≈1.5)
  }
  /* ---- ★ ยามตรวจ "ความเป็นไปได้ทางกายภาพ" ของค่าดิน — ค่าที่เป็นไปไม่ได้ต้องส่งเสียง ไม่ใช่ไหลเข้าการคำนวณเงียบ ๆ ----
     เจอจริง 2569-07: ค่าหน่วย SI ของบิลด์เก่าที่ค้างใน localStorage ถูก restore ทับช่องหน่วย MKS
     → inputs() คูณ G ซ้ำ → γ = 186 kN/m³ (เหล็กยังแค่ 77!) · c = 392 kPa → q_a = 205 ตัน/ม² (จริง ~19)
     → พจน์ c·Nc กินไป 5,038 จาก 6,094 kPa · การตรวจแบกทาน "ผ่านเสมอ" อย่างไร้ความหมาย และไม่มีอะไรเตือนเลย
     ยามนี้ดักได้ทุกต้นทาง: สถานะเก่า · ไฟล์ .json เก่า · สลับหน่วย · พิมพ์ผิด */
  {const RNG={'γ ดินถม':[gs,12,26,'kN/m³'],'φ ดินถม':[phi,0,50,'°'],'c ดินถม':[cc,0,300,'kPa']};
   if(foundSep)Object.assign(RNG,{'γ ดินฐาน':[gsF,12,26,'kN/m³'],'φ ดินฐาน':[phiF,0,50,'°'],'c ดินฐาน':[cF,0,300,'kPa']});
   Object.keys(RNG).forEach(k=>{const a=RNG[k], v=a[0];
     if(!isFinite(v)||v<a[1]-1e-9||v>a[2]+1e-9)
       warn.push('⛔ <b>ค่าดินเป็นไปไม่ได้ทางกายภาพ — '+k+' = '+fmt(v,1)+' '+a[3]+'</b> (ช่วงที่เป็นไปได้ '+a[1]+'–'+a[2]+') · มักเกิดจาก<b>ค่าหน่วย SI ค้างอยู่ในช่องหน่วย MKS</b> แล้วถูกคูณ 9.81 ซ้ำ — <b style="color:#C2362B">ห้ามใช้ผลนี้ออกแบบ</b> ให้เลือกชนิดดินใหม่เพื่อรีเซ็ตค่า หรือกรอกให้ถูกหน่วย');});}
  /* ---- ★ กฎกระทรวงกำหนดฐานรากฯ พ.ศ.2566 ข้อ 16 — เพดานที่ต้องมีผลทดสอบรองรับ ----
     "ในกรณีที่ใช้ค่าหน่วยแรงแบกทานที่ยอมให้ของดินฐานรากเกิน ๒๐๐ กิโลปาสกาล หรือเกิน ๒๐ เมตริกตันต่อตารางเมตร
      ผู้ออกแบบและคำนวณต้องทำการทดสอบกำลังแบกทานของดินฐานรากโดยใช้แผ่นเหล็ก...ตามหมวด ๕"
     โหมด Meyerhof ให้ q_a สูงเกิน 20 ต/ม² ได้ง่ายมาก และเดิมไม่เตือนเลย → ออกแบบไปโดยไม่รู้ว่าผิดเงื่อนไข */
  {const _qaT=qaUse/G;
   if(_qaT>20+1e-6)warn.push('ใช้ q<sub>a</sub> = '+fmt(_qaT,1)+' ตัน/ม² <b>เกิน 20 ตัน/ม² (200 kPa)</b> — <b>กฎกระทรวงฯ ฐานราก พ.ศ.2566 ข้อ 16</b> กำหนดว่าต้อง<b>ทดสอบกำลังแบกทานด้วยแผ่นเหล็ก (plate load test) ตามหมวด 5</b> จึงจะใช้ค่านี้ได้ และต้องคำนึงถึงการกระจายหน่วยแรงที่ต่างกันระหว่างแผ่นทดสอบกับฐานรากจริง'+(QASRC==='soil'?' · ค่านี้มาจากการคำนวณ Meyerhof ไม่ใช่ผลทดสอบ':''));}
  /* ---- engineering-sense sanity (PROMPT §6): เตือน over-design ให้ประหยัดขึ้น (เฉพาะกำแพงถ่วง) ---- */
  if(!onPile){
    if(FSot>5)warn.push('FS พลิกคว่ำ = '+fmt(FSot,1)+' > 5 — เผื่อมากเกินไป (ไม่คุ้มค่า) พิจารณาลดความกว้าง/ความหนาฐาน');
    if(FSsl>4)warn.push('FS เลื่อนไถล = '+fmt(FSsl,1)+' > 4 — เผื่อมาก พิจารณาลดขนาด หรือถอด shear key/passive');
    const _qaCmp=(bcap?bcap.qall:qa);
    if(_qaCmp>0 && (qmaxEff/_qaCmp)<0.4)warn.push('แรงดันดินสูงสุดใช้ไปเพียง '+fmt(qmaxEff/_qaCmp*100,0)+'% ของกำลังแบกทาน — ฐานอาจใหญ่เกินจำเป็น (ลดขนาดเพื่อประหยัด)');
  }
  /* ---- แรงดันใต้ฐานที่ "ประลัย" (factored) สำหรับออกแบบ toe — จากน้ำหนักคูณตัวประกอบโดยตรง ---- */
  const _qArm=toe+t+heel/2, _Wlive=q*heel, _Wdead=SVb-_Wlive, _SMdead=SMb-_Wlive*_qArm;
  const VuB=C.gD*_Wdead+C.gL*_Wlive;
  const xbarU=(C.gD*_SMdead+C.gL*_Wlive*_qArm - C.gH*Mo)/Math.max(VuB,1e-9), eU=B/2-xbarU;
  let q1u; if(Math.abs(eU)<=kern)q1u=VuB/B*(1+6*eU/B); else q1u=(xbarU>0?2*VuB/(3*xbarU):Infinity);
  /* ---- กรณีแผ่นดินไหว: ตรวจความเยื้องศูนย์ + แบกทาน (เพิ่ม qa ได้ ⅓ สำหรับแรงชั่วครู่) ---- */
  if(seis){
    const VbE=SVb*(1-seis.kv)-U;
    const xbarE=(SMb*(1-seis.kv)-seis.MoE)/Math.max(VbE,1e-9), eE=B/2-xbarE;
    let q1E; if(Math.abs(eE)<=kern)q1E=VbE/B*(1+6*eE/B); else q1E=(xbarE>0?2*VbE/(3*xbarE):Infinity);
    seis.eE=eE; seis.q1E=q1E; seis.qaE=(bcap?bcap.qall:qa)*1.33; seis.eOK=Math.abs(eE)<=kern; seis.bearOK=q1E<=seis.qaE;
  }
  /* ---- เสถียรภาพลาดดินเบื้องต้น (infinite-slope) — มีผลเมื่อหลังถมลาดเอียง β>0 ---- */
  let slope=null;
  if(beta>0.5){
    const z=H, sb=Math.sin(beta*D2R), cb2=Math.cos(beta*D2R);
    const Fslope=Math.tan(phi*D2R)/Math.tan(beta*D2R)+cc/Math.max(gs*z*sb*cb2,1e-6);
    slope={beta,z,Fslope};
    if(Fslope<1.5)warn.push('เสถียรภาพลาดดินเบื้องต้น (infinite-slope) FS='+Fslope.toFixed(2)+' < 1.5 — ต้องวิเคราะห์เสถียรภาพรวมแบบวงสไลด์ (Bishop/Spencer)');
  }
  /* ---- เสถียรภาพรวมวงสไลด์ลึกผ่านดินฐาน (Bishop 2-soil · P6) — วงวิบัติลึกคือกรณีจริงของกำแพงสูงบนดินฐานอ่อน ---- */
  let gslip=null;
  /* ★★ กำแพงบนเสาเข็มก็ต้องตรวจเสถียรภาพรวม (แก้ 2569-07 build 156)
     บั๊กเดิม: `if(!onPile…)` → pile · pilecf **ข้ามการตรวจวงสไลด์ทั้งหมด ไม่มีทั้งผลและคำเตือน**
     → ผู้ใช้เข้าใจว่า "ตรวจครบแล้ว" ทั้งที่กำแพงบนเสาเข็มใช้กับดินอ่อน (กทม./ริมคลอง) มากที่สุด
     ★ หลักวิศวกรรม: เสาเข็มยึดวงตื้นไว้ได้ → กลไกที่เข็มหยุดไม่ได้คือ **วงลึกลอดใต้ปลายเข็ม**
       จึงส่ง pileToe = ความยาวเข็มฝัง (Le) ให้ globalSlip บังคับวงลงลึกกว่าปลายเข็ม
       **ยังไม่นับแรงต้านของเข็มที่ตัดวง** = อนุรักษ์นิยม และติดป้ายบอกตรง ๆ (ดู ROADMAP U8 ระยะยาว) */
  const _pileToe=onPile?Math.max(+i.pileEmb||0,0):0;
  if(B>0&&H>0.5&&(!onPile||_pileToe>0.5)){
    try{ gslip=globalSlipMemo({H,B,toe,t,hz,hp,Df,beta,q, gs,gsat,phi,cc, gsF,phiF,cF, gc, zw, pileToe:_pileToe, kh:Math.max(kh||0,0), kv:Math.max(i.kv||0,0)});
      if(gslip){ const reqG=gslip.seis?FSREQ.globE:FSREQ.glob; gslip.req=reqG; gslip.ok=gslip.FS>=reqG; gslip.pileToe=_pileToe;
        /* ★ ถ้าค่าต่ำสุดยัง "นอนที่ขอบกล่องค้นหา" หลังขยาย 3 รอบ = อาจยังไม่ใช่ค่าต่ำสุดจริง → ต้องบอก ห้ามเงียบ */
        if(gslip.edge)warn.push('⚠ <b>เสถียรภาพรวม: การค้นหาวงวิกฤตยังชนขอบเขต</b> — FS='+gslip.FS.toFixed(2)+' ที่รายงานอาจ<u>ไม่ใช่ค่าต่ำสุดจริง</u> (วงที่วิกฤตกว่าอาจอยู่นอกขอบเขตค้นหา) · โปรดตรวจเสถียรภาพรวมด้วยโปรแกรม slope stability เฉพาะทางก่อนใช้งานจริง');
        if(!gslip.ok)warn.push(_pileToe>0
          ? `เสถียรภาพรวม <b>วงลึกลอดใต้ปลายเข็ม</b> (Bishop) FS=${gslip.FS.toFixed(2)} < ${reqG} — ลึกสุด ${fmt(-gslip.deep,2)} ม.ใต้ฐาน (ปลายเข็ม ${fmt(_pileToe,1)} ม.) · <b>เสาเข็มหยุดกลไกนี้ไม่ได้</b>`
            +(phiF===0?` · <b>ดินเหนียวไม่ระบายน้ำ (φ₂=0): เพิ่มความยาวเข็มไม่ช่วย</b> (วัดจริง: เข็ม 4→18 ม. FS แทบไม่เปลี่ยน) เว้นแต่ปลายลงถึงชั้นแข็งจริง`:'')
            +` · แก้: ปรับปรุงดินฐาน (c₂/φ₂ · replace/preload/CDM) / ลดน้ำหนักจร q / ลดความสูง / berm หน้ากำแพง`
          : `เสถียรภาพรวมวงสไลด์ (Bishop · วิธี slices) FS=${gslip.FS.toFixed(2)} < ${reqG} — วงวิบัติลึกผ่านดินฐาน (ลึกสุด ${fmt(-gslip.deep,2)} ม.ใต้ฐาน) · แก้: ปรับปรุงดินฐาน/ลดความชัน β/ขยายฐาน B/ลดความสูง หรือเสริมเสาเข็ม-soil nail ตัดวงเลื่อน`);
        if(_pileToe>0)warn.push('ℹ <b>เสถียรภาพรวมของกำแพงบนเสาเข็ม</b> — คิดเฉพาะ<u>วงลึกที่ลอดใต้ปลายเข็ม</u> (วงตื้นกว่านั้นถือว่าเสาเข็มยึดไว้) และ<u>ยังไม่นับแรงต้านของเข็มที่ตัดวง</u> = อนุรักษ์นิยม · FS='+gslip.FS.toFixed(2)+' (ลึกสุด '+fmt(-gslip.deep,2)+' ม. · ปลายเข็ม '+fmt(_pileToe,1)+' ม.)');
      }
      /* ★ ห้ามเงียบ: หาวงวิกฤตไม่ได้ = "ไม่ได้ตรวจ" ไม่ใช่ "ผ่าน" — ต้องบอกวิศวกรตรง ๆ */
      if(!gslip)warn.push('⚠ <b>เสถียรภาพรวม: หาวงวิบัติวิกฤตไม่ได้</b> — เรขาคณิต/ความลึกที่ต้องตรวจอยู่นอกขอบเขตของตัวค้นหา · <u>ถือว่ายังไม่ได้ตรวจ ไม่ใช่ผ่าน</u> · โปรดตรวจด้วยโปรแกรม slope stability เฉพาะทาง');
    }catch(e){ warn.push('⚠ <b>เสถียรภาพรวม: คำนวณไม่สำเร็จ</b> ('+(e&&e.message||'?')+') — ถือว่ายังไม่ได้ตรวจ ไม่ใช่ผ่าน'); }
  }
  /* ---- การแอ่นตัวปลายพนัง δ (serviceability · พฤติกรรมโครงสร้าง) — พนัง=คานยื่นรับแรงดันดินสามเหลี่ยม + จรสม่ำเสมอ · หน้าตัดร้าว Ie≈0.35Ig ---- */
  let stemDefl=null;
  if(!onPile&&hp>0.3){
    const EcMPa=4700*Math.sqrt(Math.max(fc,10)), tEff=tapered?(tTop+t)/2:t;
    const Ig=Math.pow(Math.max(tEff,0.05),3)/12, Ie=0.35*Ig, EI=EcMPa*1000*Ie;      // ต่อ 1 ม. · kN·m² (MPa=1000 kN/m²)
    const w0=Ka*gs*hp*cosB, wq=Ka*(q||0)*cosB;                                       // แรงดันฐานพนัง (สามเหลี่ยม γ) + จร (สม่ำเสมอ) kN/m²
    const mm=(w0*Math.pow(hp,4)/(30*EI) + wq*Math.pow(hp,4)/(8*EI))*1000;            // ยื่น: สามเหลี่ยม w₀H⁴/30EI + สม่ำเสมอ wH⁴/8EI
    const allowMm=hp/240*1000, ok=mm<=allowMm;
    stemDefl={mm,allowMm,ok,EI,w0,wq,Ie,Ig,tEff,EcMPa};
    if(!ok)warn.push('การแอ่นตัวปลายพนัง δ='+fmt(mm,1)+' มม. > เกณฑ์ h<sub>p</sub>/240='+fmt(allowMm,1)+' มม. (serviceability) — เพิ่มความหนาพนัง t หรือเปลี่ยนเป็นกำแพงครีบ (buttress) เพื่อลดการแอ่น');
  }
  /* ---- การตัดเหล็กหลักพนัง (curtailment · ACI 318-19 §9.7.3.3) — คานยื่น M∝z³ (z จากยอด) · ตัดครึ่งที่ M=½M_ฐาน + ยื่นต่อ ≥ max(d,12d_b) ---- */
  let stemCut=null;
  if(!onPile&&hp>0.5){
    const db_=(i.db||16)/1000, dEff=Math.max(t-cov-db_/2,0.05);
    const yTh=hp*(1-Math.pow(0.5,1/3)), ext=Math.max(dEff,12*db_), cutLen=Math.min(yTh+ext,hp);   // จุดตัดทฤษฎี (M=½M_ฐาน) + ยื่นต่อ · ท่อนสั้นจากผิวบนฐาน
    stemCut={yTh,ext,cutLen,dEff,db:db_,frac:cutLen/hp};
  }
  /* ---- pile-supported (การวิเคราะห์กลุ่มเสาเข็มแบบแคปแข็ง — rigid pile-cap group, Bowles) ----
     เสาเข็ม 2 แถว (toe + heel) รับแรงลัพธ์ Rv + โมเมนต์รอบศูนย์ถ่วงกลุ่มเข็ม (P/A + M·c/I)
     • Mcg = OTM − Rv·(Mr/Rv − CG)  = โมเมนต์สุทธิรอบ CG กลุ่มเข็ม
     • แกนต่อต้น P = Rv/N + Mcg·arm/Ix     (แถว toe เอียง batter → หาร cos β)
     • แถว toe เอียง batter → รับแรงราบด้วยองค์ประกอบแกน (axial·sinβ) + กำลังต้านราบต่อต้น */
  let pile=null;
  if(onPile){
    const Pa=Math.max(i.Ppile,1);                                  // กำลังแกนปลอดภัย/ต้น (ตัน)
    const tenCap=(i.pileTen>0)?i.pileTen:0.3*Pa;                   // กำลังรับแรงถอน/ต้น — ผู้ใช้กรอกเอง (0 = อัตโนมัติ ~0.30·Pa)
    const pileSec=pileSection172(i),Bp=pileSec.B, Le=Math.max(i.pileEmb,2);
    const sT=Math.max(i.pileSt||i.pileS||1.5,0.6), sH=Math.max(i.pileSh||i.pileS||1.5,0.6); // ระยะเรียงตามยาวกำแพง (toe/heel)
    const covMin=Bp, edMin=Bp/2+covMin;                                                       // คอนกรีตฐานต้องหุ้มขอบเข็ม ≥ 1×หน้าตัดเข็ม → ระยะขอบ→ศูนย์เข็ม ≥ 1.5·Bp
    const edT=Math.max(i.pileEdT||edMin,edMin), edH=Math.max(i.pileEdH||edMin,edMin);          // ระยะขอบฐาน→ศูนย์เข็ม (บังคับ cover ≥ 1×Bp)
    if((i.pileEdT&&i.pileEdT<edMin-1e-6)||(i.pileEdH&&i.pileEdH<edMin-1e-6))warn.push(`ระยะขอบเสาเข็มถูกปรับเป็น ≥ ${fmt(edMin,2)} ม. (คอนกรีตฐานหุ้มขอบเข็ม ≥ 1×หน้าตัด ${fmt(Bp*100,0)} ซม.)`);
    if(B<edT+edH+Bp-1e-6)warn.push(`ฐานกว้าง B=${fmt(B,2)} ม. แคบเกินหุ้มเข็ม 2 แถว (ต้องการ ≥ ${fmt(edT+edH+Bp,2)} ม. เพื่อ cover ≥ 1×Bp ทั้งสองขอบ) — ขยาย toe/heel`);
    const btT=Math.max(i.pileBatT||0,0)*D2R, btH=Math.max(i.pileBatH||0,0)*D2R;              // มุมเอียง batter (rad)
    const latCap=Math.max(i.pileLat||0,0);                          // กำลังต้านราบต่อต้น (ตัน) — จาก Broms/lateral load test
    let xT=edT, xH=B-edH; if(xH<=xT+0.1)xH=xT+0.1;                  // ตำแหน่งแถว (วัดจากปลาย toe)
    const nT=1/sT, nH=1/sH, Ntot=nT+nH;                             // จำนวนต้น/เมตร
    const CG=(nT*xT+nH*xH)/Ntot;                                    // ศูนย์ถ่วงกลุ่มเข็ม (จาก toe)
    const Ix=Math.max(nT*Math.pow(xT-CG,2)+nH*Math.pow(xH-CG,2),1e-6); // Σn·arm² /เมตร
    const RvT=Vb/G, OTM=MoT/G, Mr=SMb/G;                            // แปลง kN→ตัน (Rv, OTM, Mr /ม.)
    const armRv=Mr/Math.max(RvT,1e-9);                              // ตำแหน่งแรงลัพธ์ดิ่ง (จาก toe)
    const Mcg=OTM-RvT*(armRv-CG);                                   // โมเมนต์สุทธิรอบ CG กลุ่มเข็ม (ตัน·ม/ม)
    const armT=CG-xT, armH=CG-xH;                                   // แขนโมเมนต์ (+ ไปทาง toe)
    const axTv=RvT/Ntot+Mcg*armT/Ix, axHv=RvT/Ntot+Mcg*armH/Ix;    // แกนแนวดิ่งต่อต้น (ตัน)
    const axT=axTv/Math.cos(btT), axH=axHv/Math.cos(btH);          // แกนจริง (เข็มเอียงหาร cos β)
    const ratT=axT/Pa, ratH=axH/Pa;                                 // อัตราส่วนกำลังแกน
    const Rh=Ph/G;                                                  // แรงผลักแนวราบรวม (ตัน/ม)
    const hcap=nT*(axT*Math.sin(btT)+latCap)+nH*(axH*Math.sin(btH)+latCap); // กำลังต้านราบ (ตัน/ม)
    const Rmax=Math.max(axT,axH), Rmin=Math.min(axT,axH);
    if(ratT>1||ratH>1)warn.push(`แกนเสาเข็มเกินกำลัง: toe ${fmt(axT,1)} / heel ${fmt(axH,1)} ตัน (Pa=${fmt(Pa,0)}) — เพิ่ม Pa / ลดระยะเรียง S / ขยายฐาน`);
    if(hcap<Rh)warn.push(`กำลังต้านแรงราบเสาเข็ม ${fmt(hcap,1)} < แรงผลัก Rh ${fmt(Rh,1)} ตัน/ม — เพิ่มมุม batter แถว toe / เพิ่มกำลังต้านราบต่อต้น (Broms) / ลดระยะเรียง`);
    if(Rmin<0)warn.push(`เสาเข็มแถวหลังมีแรงถอน (${fmt(Rmin,1)} ตัน) — ต้องออกแบบเข็มรับแรงดึง/สมอ หรือขยับแถวเข็ม/ขยายฐาน`);
    pile={Pa,tenCap,shape:pileSec.shape,section:pileSec,S:sT,sT,sH,edT,edH,cov:covMin,edMin,covT:edT-Bp/2,covH:edH-Bp/2,Bp,xf:xT,xb:xH,xT,xH,nT,nH,Ntot,CG,Ix,RvT,OTM,Mr,armRv,Mcg,
      armT,armH,axTv,axHv,axT,axH,ratT,ratH,btTdeg:Math.max(i.pileBatT||0,0),btHdeg:Math.max(i.pileBatH||0,0),latCap,
      Rh,hcap,hOK:hcap>=Rh,Rf:axT,Rb:axH,Rmax,Rmin,Hpile:Rh,tension:Rmin<0,nRow:2};
    /* ---- ปฏิกิริยาแนวดิ่งเสาเข็มแบบประลัย (factored) สำหรับออกแบบ "แคปเสาเข็ม" (pile cap) ----
       แคปรับแรงจากปฏิกิริยาเสาเข็มแบบจุด (ไม่ใช่แรงดันดินกระจาย) → ใช้แรงลัพธ์ดิ่งประลัย VuB + ตำแหน่ง xbarU */
    const RvUt=VuB/G, eUcg=xbarU-CG;                                   // ตัน/ม. · ความเยื้องแรงลัพธ์ประลัยจาก CG กลุ่มเข็ม
    pile.axTu=RvUt/Ntot + RvUt*eUcg*(xT-CG)/Ix;                        // แกนดิ่งประลัยต่อต้น แถว toe (ตัน/ต้น)
    pile.axHu=RvUt/Ntot + RvUt*eUcg*(xH-CG)/Ix;                        // แกนดิ่งประลัยต่อต้น แถว heel (ตัน/ต้น)
    pile.RvUt=RvUt; pile.eUcg=eUcg;
    /* ---- แรงราบคงเหลือหลังหักเข็มเอียง batter (ให้ M_u,pile สมจริง — ไม่อนุรักษ์เกิน) ----
       เข็มเอียง toe รับแรงราบด้วยองค์ประกอบแกน P·sinβ → เหลือ H_resid ให้เข็มดิ่งรับด้วยการดัด */
    const Hbat=nT*axT*Math.sin(btT)+nH*axH*Math.sin(btH);          // แรงราบที่เข็มเอียงรับ (ตัน/ม)
    const Hresid=Math.max(Rh-Hbat,0);                              // แรงราบคงเหลือ (ตัน/ม)
    const nBend=((btH<1e-3?nH:0)+(btT<1e-3?nT:0))||Ntot;           // จำนวนเข็มดิ่งที่รับด้วยการดัด (ต้น/ม)
    const HpilePer=Hresid/nBend;                                   // แรงราบดัดต่อต้น (ตัน/ต้น)
    pile.lat={Hbat,Hresid,nBend,HpilePer};
    /* pile-spring (Winkler) + การเคลื่อนตัว — ใช้แรงราบ "คงเหลือ" ต่อต้น (สมจริง) */
    pile.disp=pileDisp(i,{B:Bp,Lt:Le,embedTop:0,headLoad:Math.max(HpilePer*G,0.01),tie:false,Ishape:pileSec.shape==='i',IgSec:pileSec.I,AgSec:pileSec.Ag});
    /* ---- semi-fix / pin support (equivalent cantilever · depth-to-fixity) — ทางเลือกไม่ใช้ point-spring ---- */
    {const EIp=pile.disp.EI, khB=pile.disp.khBot;                  // kN·m², kN/m³
     const Rfix=Math.pow(EIp/Math.max(khB*Bp,1),0.25);             // stiffness length R (m)
     const Lf=1.4*Rfix;                                            // depth to fixity ≈ 1.4R (Tomlinson/Davisson–Robinson)
     pile.sf={Rv:Rmax,RvMin:Rmin,Hpile:HpilePer,Lf,Rfix,Mhead:HpilePer*Lf,MheadFix:HpilePer*Lf/2};}
    try{const prof=soilProfile(i), Ecp=4700*Math.sqrt(Math.max(fc,10))*1000;
      pile.frame=pileWallFrame({xF:-B/2+xT,xB:-B/2+xH,Le,Bp,EI:Ecp*pileSec.I,EA:Ecp*pileSec.Ag,Ph:Ph*sT,W:Vb*sT,ybar,hz,prof,scrX:-B/2+toe+t/2});}catch(e){console.error('pileFrame',e);}
    /* ---- กำลังหน้าตัดเสาเข็ม (หักด้วยแรงเฉือน/ดัดไหม) + การยึดเดือยหัวเข็ม↔ฐานราก (dowel พอไหม) ----
       แรงในเข็มจากแบบจำลอง Winkler/Frame (M,V) · เข็ม คสล.อัดแรง (มอก.) — RC เป็นค่าอนุรักษ์ (อัดแรงรับได้สูงกว่า) */
    {const dp=0.8*Bp, Ag=pileSec.Ag*1e6,bw=Math.max(pileSec.bw,.05);   // มม.² + web/effective width ตามหน้าตัดจริง
     // แรงเฉือนสูงสุดในเข็มบนหัว = แรงราบที่เข็มต้องถ่าย (top-loaded pile → |V| สูงสุดที่หัว = head load) ·
     // ใช้ค่าแรงราบต่อต้นโดยตรง (สมดุลแรงราบ) แทนการดิฟผลต่างจากสนามโมเมนต์ FE ที่คลาดเคลื่อนแถวขอบ
     const Hlat=(pile.lat?Math.max(pile.lat.HpilePer,0):0)*G;         // kN/ต้น
     const VuP=Hlat*C.gH;                                             // แรงเฉือนในเข็มประลัย (kN)
     const MuP=Math.max((pile.disp?pile.disp.mMax:0),(pile.frame?pile.frame.Mpile:0))*C.gH; // โมเมนต์ในเข็มประลัย (kN·m)
     const NuP=Math.max(Rmax,0)*G;                                    // แรงอัดแกนประลัย (kN) → เพิ่มกำลังเฉือน (ACI)
     /* ★★ 🔴 RW-FIX-2569-08-29 — เดิม: `const phiVc=(C.phiv||0.85)*Vc;`  ผิด 3 อย่างพร้อมกัน
        (1) ฝังค่า 0.85 (φ ของ กฎกระทรวง 2566) เป็น fallback → หลุดจาก profile ที่ผู้ใช้เลือกอยู่
        (2) ไม่แยกกิ่ง WSD → เลือกวิธีหน่วยแรงใช้งานแล้ว พนัง/ฐาน/คีย์ ใช้ 0.09√f′c แต่เสาเข็ม
            ยังคำนวณด้วยสูตรวิธีกำลัง = รายงานฉบับเดียวกันข้ามมาตรฐานกันเอง
        (3) `const phiVc` บังฟังก์ชันกลาง phiVc() ในสโคปนี้ (ใครเรียกเป็นฟังก์ชันจะได้ TypeError)
        แก้: เรียก phiVc() ตัวกลางตัวเดียวกับพนัง/ฐาน ซึ่งอ่าน φ และวิธี (SDM/WSD) จาก profile เอง
        พจน์เพิ่มกำลังจากแรงอัดแกน · ACI 318-14 Eq.22.5.6.1
            V_c = 0.17·(1 + N_u/(14·A_g))·λ·√f′c·b_w·d      (องค์อาคารรับแรงอัดแกน · SI: N, mm, MPa)
        เพดาน 0.30 ของพจน์เพิ่มเป็นค่าอนุรักษ์ของแอป ไม่ใช่ข้อกำหนดของ ACI
        WSD ไม่คูณพจน์นี้ — บิลด์นี้ยังไม่มีสัมประสิทธิ์แรงอัดแกนของวิธีหน่วยแรงใช้งานที่ทวนสอบแล้ว
        จึงใช้หน่วยแรงเฉือนยอมให้ล้วน (อนุรักษ์กว่า) แทนการเดาสัมประสิทธิ์ */
     const axialBoost=(C.method==='wsd')?1:(1+Math.min(NuP*1000/(14*Ag),0.3));
     const pilePhiVc=phiVc(bw,dp,fc)*axialBoost;                                 // kN · φV_c (SDM) หรือ กำลังยอมให้ (WSD) — ตาม profile ที่เลือก
     const Vc=pilePhiVc/((C.method==='wsd')?1:(C.phiv||1));                      // kN · กำลังก่อนคูณ φ (แสดงในรายงาน) · I-pile ใช้ web width เป็น screening อนุรักษ์
     const fpe=pileSec.shape==='bored'?0:Math.max(i.pileFpe!=null?i.pileFpe:4,0); // เข็มเจาะ RC ไม่อัดแรง
     const fr=0.62*Math.sqrt(fc), Sm=pileSec.S;
     const McrRC=fr*1000*Sm;                                          // โมเมนต์แตกร้าว RC ล้วน (อ้างอิงอนุรักษ์)
     const McrCalc=(fr+fpe)*1000*Sm,McrCatalog=pileSec.shape==='i'&&pileSec.catalogMcr_tm>0?pileSec.catalogMcr_tm*G:0;
     const Mcr=McrCatalog>0?Math.min(McrCalc,McrCatalog):McrCalc;      // I-pile ใช้ค่าต่ำกว่าระหว่าง section-property screening กับค่าทะเบียนโดยประมาณ
     const dw=dowelSpec(i), nDw=dw.n, dbDw=dw.db, AsDw=dw.As;           // เดือยหัวเข็ม/ต้น (default 4-DB12 · กำหนดเอง REBAROV.pileDowel)
     const AsM=MuP>0?MuP*1e6/(0.9*fy*dp*1000):0;                       // เดือยต้านโมเมนต์หัวเข็ม (มม.²)
     const Tup=Rmin<0?Math.abs(Rmin)*G:0;                             // แรงถอนหัวเข็ม (kN)
     const AsT=Tup>0?Tup*1000/(0.9*fy):0;                             // เดือยต้านแรงถอน/ดึง (มม.²)
     const AsReq=Math.max(AsM,AsT), ldD=Math.max(40*dbDw,300)/1000;   // เหล็กเดือยที่ต้องการ · ระยะฝัง 40d_b (ม.)
     pile.struct={section:pileSec,VuP,Vc,phiVc:pilePhiVc,shearMethod:C.method,axialBoost,VuOK:VuP<=pilePhiVc,ratV:VuP/Math.max(pilePhiVc,1e-6),
       MuP,Mcr,McrCalc,McrCatalog,McrRC,fpe,McrOK:MuP<=Mcr,ratM:MuP/Math.max(Mcr,1e-6),dp,bw,Ag,NuP,
       dowel:{n:nDw,db:dbDw,pre:dw.pre,man:dw.man,Asprov:AsDw,AsM,AsT,Tup,AsReq,ok:AsDw>=AsReq,ld:ldD,ldOK:hz>=0.55*ldD}};
     if(VuP>pilePhiVc)warn.push(`เสาเข็มเสี่ยงวิบัติด้วยแรงเฉือน: V_u ${fF(VuP,1)} > φV_c ${fF(pilePhiVc,1)} ${UL().F}/ต้น — เพิ่มขนาดเข็ม/เพิ่มมุม batter (ลดแรงราบดัด)/ลดระยะเรียง`);
     if(MuP>Mcr)warn.push(`โมเมนต์ในเสาเข็ม ${fM(MuP,1)} > โมเมนต์แตกร้าว ${fM(Mcr,1)} ${UL().M}/ต้น (รวมแรงอัดล่วงหน้า f_pe=${fmt(fpe,1)} MPa) — เพิ่มมุม batter (ลดแรงราบดัด)/เพิ่มขนาดเข็ม/ยืนยันกำลังดัดเข็มอัดแรงกับ catalog ผู้ผลิต${fpe>0?'':' · เข็มเจาะ(ไม่อัดแรง) f_pe=0'}`);
     if(AsDw<AsReq)warn.push(`เดือยหัวเข็ม ${dw.txt} (${fmt(AsDw,0)} มม.²) ไม่พอ — ต้องการ ${fmt(AsReq,0)} มม.² (${Tup>0?'รับแรงถอน '+fF(Tup,1)+' '+UL().F:'รับโมเมนต์หัวเข็ม'}) → เพิ่มจำนวน/ขนาดเดือย`);
     if(hz<0.55*ldD)warn.push(`ความหนาแคป ${fmt(hz,2)} ม. < ระยะฝังเดือย ~${fmt(ldD,2)} ม. — ใช้ของอ 90° ปลายเดือย หรือเพิ่มความหนาแคป`);
     if(pileSec.shape==='i'&&(!i.pileCatOK||!String(i.pileCatRef||'').trim()))warn.push(`เสาเข็ม ${pileSec.name} ${pileSec.axisLabel}: ผล M/V เป็นการคัดกรองจากหน้าตัด — ต้องกรอก Catalog/แบบผลิตและยืนยัน Pa, M/V, การยกตอก, รอยต่อ และความยาวผลิตก่อนออกแบบ FOR CONSTRUCTION`);
    }
  }

  /* ---- factored lateral pressure on stem, z from stem top ---- */
  const zw1=Math.max(zw,0);
  const pu=z=>{const sv=z<=zw1?gs*z:gs*zw1+gp*(z-zw1), earthH=isGravity?Math.cos(forceAngle*D2R):cosB;
    return C.gH*(Math.max(Ka*(sv+q)-2*cc*Math.sqrt(Ka),0)*earthH+(z>zw1?GW*(z-zw1):0));};

  /* ---- stem design ---- */
  const dS=Math.max(t-cov-db/2000,0.02);   // clamp กัน d≤0 (φVc ติดลบ) ตอนพิมพ์ t เล็กชั่วคราว
  let strips=[],stemTab=null,AsmV=0.0018*1000*t*1000;
  let VuS=0,phiVcS=phiVc(1,dS,fc);
  if(mode==='but'){
    const n=Math.max(4,Math.ceil(hp));
    for(let k=1;k<=n;k++){
      const z2=hp*k/n, z1=hp*(k-1)/n, z=(z1+z2)/2;
      const th=tAt(z2), dSt=Math.max(th-cov-db/2000,0.02), AsmS=0.0018*1000*th*1000;   // ความหนาตามระดับ (ผนังสอบ)
      const wu=pu(z2); // ใช้ขอบล่างแถบ (อนุรักษ์ · D/C ≤ 100% ทั้งแถบ)
      const Mn_=wu*L*L/12, Mn$=wu*L*L/16, Vu=wu*L/2;
      let As_=asReq(Mn_,1,dSt,fc,fy), As$=asReq(Mn$,1,dSt,fc,fy);
      const phiVcStrip=phiVc(1,dSt,fc), bad=isNaN(As_)||isNaN(As$)||Vu>phiVcStrip;
      As_=Math.max(As_||0,AsmS);As$=Math.max(As$||0,AsmS);
      strips.push({k,z1,z2,z,wu,Mn_,Mn$,As_,As$,Vu,th,d:dSt,phiVc:phiVcStrip,bad,
        b_:pickFit(As_,db,Math.min(3*th*1000,300)),b$:pickFit(As$,db,Math.min(3*th*1000,300))});
    }
    VuS=strips[strips.length-1].Vu;
  }else{
    /* cantilever: cumulative numeric V & M */
    const n2=120,dz2=hp/n2;let V=0,Mcum=0;const grid=[{z:0,V:0,M:0}];
    for(let k=0;k<n2;k++){const z=(k+0.5)*dz2;const p=pu(z);
      Mcum+=V*dz2+p*dz2*dz2/2;V+=p*dz2;grid.push({z:(k+1)*dz2,V,M:Mcum});}
    const at=f=>grid[Math.min(Math.round(f*n2),n2)];
    stemTab=[0.25,0.5,0.75,1].map(f=>{
      const g=at(f);
      const th=tAt(g.z), dSt=Math.max(th-cov-db/2000,0.02), phiVcz=phiVc(1,dSt,fc);
      let As=asReq(g.M,1,dSt,fc,fy);
      const bad=isNaN(As)||g.V>phiVcz;
      As=Math.max(As||0,0.0018*1000*th*1000);
      return {z:g.z,Mu:g.M,Vu:g.V,As,th,d:dSt,phiVc:phiVcz,bad,bar:pickFit(As,db,300)};
    });
    stemTab.grid=grid;
    VuS=grid[n2].V;
  }

  /* ---- heel ---- */
  const dH=hz-0.075-db/2000;
  const wuH=C.gD*(gs*(hp-hsub)+gsat*hsub+gc*hz)+C.gL*q;
  let MH_,MH$,AsH_,AsH$,VuH;
  if(onPile&&pile&&mode!=='but'){
    /* กำแพงยื่นวางบนเสาเข็ม: แผ่นฐานหลัง = ส่วนแคปเสาเข็ม ยื่นจากหลังพนัง (x=toe+t) → แถวเข็ม heel (x=xH)
       โมเมนต์บน (top) = น้ำหนักดินถม+ตัวฐาน (ลง) − ปฏิกิริยาเข็มแถว heel (ขึ้น) ที่ระยะ armH
       (กรณีมีครีบ pilecf: แผ่นฐานหลังพาดราบระหว่างครีบ → ใช้กิ่ง but ด้านล่าง เพราะครีบเป็นตัวรองรับ เข็มรับที่ครีบ) */
    const RheelU=pile.nH*pile.axHu*G;                 // kN/ม. ปฏิกิริยาดิ่งประลัยแถว heel
    const armH=Math.max(pile.xH-(toe+t),0);           // แขนจากหลังพนัง→แนวเข็ม heel
    MH_=Math.max(wuH*heel*heel/2 - RheelU*armH, 0);   // โมเมนต์บน (มักคุมด้วยน้ำหนักดินถม)
    MH$=0;
    VuH=Math.abs(wuH*Math.max(heel-dH,0) - (pile.xH>=toe+t+dH?RheelU:0));  // เฉือนทางเดียวที่ระยะ d
    pile.RheelU=RheelU; pile.armHeel=armH; pile.MHcap=MH_;
  }else if(mode==='but'){
    MH_=wuH*L*L/12;MH$=wuH*L*L/16;VuH=wuH*L/2;
  }else{
    MH_=wuH*heel*heel/2;MH$=0;VuH=wuH*Math.max(heel-dH,0);
  }
  AsH_=Math.max(asReq(MH_,1,dH,fc,fy)||0,0.0018*1e6*hz);
  AsH$=Math.max(asReq(MH$,1,dH,fc,fy)||0,0.0018*1e6*hz);
  const phiVcH=phiVc(1,dH,fc);
  const barH_=pickFit(AsH_,db), barH$=pickFit(AsH$,db);

  /* ---- toe ---- */
  const dT=hz-0.075-db/2000;
  let quT,MT,VuT;
  if(onPile&&pile){
    /* แผ่นฐานหน้า = ส่วนหนึ่งของแคปเสาเข็ม: ยื่นจากหน้าพนัง (x=toe) ถึงแถวเข็ม toe (x=xT)
       รับปฏิกิริยาเข็มแถว toe (ขึ้น) → โมเมนต์ล่าง (bottom) = R_toe·armT − นน.ตัวฐาน */
    const RtoeU=pile.nT*pile.axTu*G;                  // kN/ม. ปฏิกิริยาดิ่งประลัยแถว toe
    const armT=Math.max(toe-pile.xT,0);               // แขนจากหน้าพนัง→แนวเข็ม toe
    quT=0;                                             // ไม่มีแรงดันดินกระจายใต้แคป (เข็มรับทั้งหมด)
    MT=Math.max(RtoeU*armT - C.gD*gc*hz*toe*toe/2, 0);
    VuT=Math.max(RtoeU - C.gD*gc*hz*Math.max(toe-dT,0), 0);
    pile.RtoeU=RtoeU; pile.armToe=armT; pile.MTcap=MT;
  }else{
    quT=Math.max(q1u,0)-C.gD*gc*hz;   // แรงดันสุทธิขึ้นจากดิน (ประลัย) − นน.ตัวฐาน (ประลัย)
    MT=Math.max(quT,0)*toe*toe/2;
    VuT=Math.max(quT,0)*Math.max(toe-dT,0);
  }
  const AsT=Math.max(asReq(MT,1,dT,fc,fy)||0,0.0018*1e6*hz);
  const phiVcT=phiVc(1,dT,fc);
  const barT=pickFit(AsT,db);
  /* ---- 🔴 แรงเฉือนเกินกำลังคอนกรีตล้วน → เตือน "เข้าเล่มรายงาน" ไม่ใช่แค่บนจอ (พบ+แก้ 2569-07) ----
     แอปยังไม่ออกแบบและไม่ใส่เหล็กปลอกรับแรงเฉือนของพนัง/ฐานลง BBS และแบบก่อสร้าง
     (ตรวจ r.qty แล้ว: ไม่มี RB10 · ไม่มีคำว่า "ปลอก" เลยสักแถว) → นับกำลังปลอกเป็นกำลังหน้าตัดไม่ได้
     เดิมการ์ด KPI นับให้ → ขึ้น "ผ่าน ✓ RB10@100" ทั้งที่ของจริงจะถูกสร้างโดยไม่มีปลอก = วิบัติเงียบ
     ★ ต้องวางหลัง phiVcT ถูกประกาศ — วางก่อนหน้านี้ = TDZ ทำ calc() พังทั้งฟังก์ชัน (พลาดมาแล้วรอบหนึ่ง) */
  {const _sh=[];
   if(VuS>phiVcS+1e-9)_sh.push('พนัง V<sub>u</sub>='+fF(VuS,1)+' > φV<sub>c</sub>='+fF(phiVcS,1));
   if(VuH>phiVcH+1e-9)_sh.push('ฐานหลัง heel V<sub>u</sub>='+fF(VuH,1)+' > φV<sub>c</sub>='+fF(phiVcH,1));
   if(VuT>phiVcT+1e-9)_sh.push('ฐานหน้า toe V<sub>u</sub>='+fF(VuT,1)+' > φV<sub>c</sub>='+fF(phiVcT,1));
   if(_sh.length)warn.push('⛔ <b>แรงเฉือนเกินกำลังคอนกรีตล้วน</b> ('+UL().F+') — '+_sh.join(' · ')
     +' · <b>แอปยังไม่ใส่เหล็กปลอกรับแรงเฉือนของพนัง/ฐานลง BBS และแบบก่อสร้าง</b> จึงนับกำลังปลอกไม่ได้ — '
     +'<b style="color:#C2362B">ต้องเพิ่มความหนา (t / h<sub>z</sub>) หรือเพิ่ม f′c ให้คอนกรีตล้วนรับไหว</b>');}

  /* ---- buttress ---- */
  let but=null;
  if(mode==='but'){
    const PuB=C.gH*Ph*Lt, MuB=C.gH*Mo*Lt;
    const dB=cfLr-cov;                         // ความลึกหน้าตัดครีบ = ความยาวครีบตามหลัง (auto=heel)
    let AsB=asReq(MuB,bs,dB,fc,fy);
    const AsBmin=Math.max(0.25*Math.sqrt(fc)/fy,1.4/fy)*bs*1000*dB*1000;
    AsB=Math.max(AsB||AsBmin,AsBmin);
    const nB25=Math.ceil(AsB/BARS[25]);
    const wuBot=pu(hp);
    const Th=wuBot*L, AsTh=Th*1000/(0.9*fy);
    const Tv=wuH*L,  AsTv=Tv*1000/(0.9*fy);
    const phiVcB=phiVc(bs,dB,fc);
    /* ★ จุดตัดเหล็กหลักครีบ (curtailment · ACI 318-19 §9.7.3.3) — ครีบ = คานยื่นดิ่ง รับแรงดันดินสามเหลี่ยม → M ∝ z³ (z จากยอดครีบ)
       ตัดเหล็กครึ่งหนึ่งที่ M = ½M_ฐาน → y_th = H_ครีบ(1 − 0.5^⅓) = 0.206·H_ครีบ (วัดจากฐาน) แล้วยื่นต่อ ≥ max(d, 12d_b)
       เดิมแบบ 2D/3D hardcode "58%" ลอยๆ ไม่มี calc รองรับ (ผิดกฎ SSOT) — ตอนนี้ผูกกับผลคำนวณจริง */
    const finCut=(()=>{ const Hf=Math.max(cfHr,0.3), db_=(i.db||16)/1000;
      const yTh=Hf*(1-Math.pow(0.5,1/3)), ext=Math.max(dB,12*db_), cutLen=Math.min(yTh+ext,Hf);
      return {Hf,yTh,ext,cutLen,frac:cutLen/Hf}; })();
    but={PuB,MuB,dB,AsB,AsBmin,nB25,Th,AsTh,Tv,AsTv,phiVcB,wuBot,finCut};
  }

  const r={i,mode,beta,H,Hq,heel,Ka,Kp,Ca,Phs,Pw,Pv,Ph,Mo,ybar,prof,d1,d2,hwb,hsub,
    gravity:isGravity,earthMethod:isGravity?'Coulomb':'Rankine',wallDelta,wallDeltaIn,wallTheta,forceAngle,coulombOK,coulombApplicOK,xPv,ySoil,
    W,SVs,SMs,SVb,SMb,U,xU,Pp,PpAll,Dp,FSot,FSsl,seis,seisBlocked,MoT,
    xbar,e,kern,q1,q2,Vb,cc,bcap,qaUse,qmaxEff,FoSbear,Bpeff,settle,slope,q1u,eU,VuB,
    foundSep,phiF,cF,gsF,Pp,PpAll,kSl,keyChk,slideFric:foundSep?(SVs-U)*Math.tan(kSl*phiF*D2R):mu*(SVs-U),slideAdh:foundSep?B*kSl*cF:0,
    stemDefl,stemCut,gslip,
    dS,strips,stemTab,AsmV,VuS,phiVcS,pu,tTop,tapered,tAt,
    wuH,MH_,MH$,AsH_,AsH$,dH,VuH,phiVcH,barH_,barH$,
    quT,MT,AsT,dT,VuT,phiVcT,barT,Lt,but,db,warn,onPile,pile,cfLr,cfHr};
  applyRebarOv(r);          // เขียนทับเหล็กแต่ละรายการตามที่ผู้ใช้กำหนด (ถ้ามี) + เพิ่มเหล็กตามขวางฐาน
  r.qty=calcQty(r);
  r.construct=constructability169(r);   // Build 169 · SSOT สำหรับ Redline/Audit/Method/แบบ/JSON
  return r;
}
/* ใช้ค่าเหล็กที่ผู้ใช้กำหนดเอง (REBAROV) เขียนทับผลออกแบบอัตโนมัติบน r + เพิ่มเหล็กตามขวางฐาน r.barFT
   ทุกส่วนที่วาด/ทำ BBS อ่านจาก r.* จึงไล่ตามค่าที่กำหนดเองโดยอัตโนมัติ */
function applyRebarOv(r){
  const i=r.i, dfy=i.fy||390;
  r.barH_=ovBar('heelTop',r.barH_,r.AsH_,dfy,300);
  r.barH$=ovBar('heelBot',r.barH$,r.AsH$,dfy,300);
  r.barT =ovBar('toe',    r.barT, r.AsT, dfy,300);
  if(r.mode==='but'&&r.strips){r.strips.forEach(st=>{const mS=Math.min(3*st.th*1000,300);
    st.b_=ovBar('stemMain',st.b_,st.As_,dfy,mS); st.b$=ovBar('stemMain',st.b$,st.As$,dfy,mS);});}
  else if(r.stemTab){r.stemTab.forEach(st=>{st.bar=ovBar('stemMain',st.bar,st.As,dfy,300);});}
  /* เหล็กตามขวาง/กระจายฐาน (ทั้งบนและล่าง) — เลือกระยะ DB12 ให้ ≥ เหล็กกันร้าว/อุณหภูมิ 0.0018·b·hz (ฐานหนา→ถี่ขึ้น) */
  const distAs=0.0018*1e6*i.hz;
  const sDist=Math.max(100,Math.min(250,Math.floor(BARS[12]*1e3/Math.max(distAs,1)/10)*10));
  r.barFT=ovBar('footDist',{db:12,s:sDist,prov:1e3*BARS[12]/sDist,grade:dfy,pre:'DB',ok:true,txt:'DB12@'+sDist},distAs,dfy,300);
  /* Shear key K1 — U-bar ขาลง 2 หน้า + ปีกบนงอ 90° ฝังในฐานราก
     ผลคำนวณ/ขนาด/ระยะ/รูปดัด/จำนวนใช้ object เดียวให้ BBS·2D·3D·BOQ·Audit ตรงกัน */
  if(r.keyChk){const k=r.keyChk, maxS=Math.min(250,Math.max(100,3*i.t*1000));
    const auto=pickFit(k.AsKreq,12,maxS);auto.grade=dfy;auto.pre='DB';auto.ok=k.flexSectionOK&&auto.prov>=k.AsKreq*0.999;
    const kb=ovBar('keyMain',auto,k.AsKreq,dfy,maxS), RK=rebarRules(kb.db,i.fc,kb.grade||dfy);
    const cEarth=0.075,cTop=Math.max((i.cov||50)/1000,0.05),rad=kb.db/2000;
    const clearWidth=i.t-2*(cEarth+rad), leg=i.dk+i.hz-cEarth-cTop-2*rad, hook=RK.hook90m;
    const anchorPath=Math.max(i.hz-cTop-rad,0)+hook;
    const hookFit=Math.min(i.toe+cEarth,r.heel+cEarth)>=hook-0.003;
    const fitOK=clearWidth>=kb.db/1000+0.025&&leg>0;
    const anchorOK=anchorPath>=RK.ldhm-0.003&&hookFit;
    const n=Math.max(2,Math.ceil(Math.max((i.Lw||1)-2*cEarth,0.10)/(kb.s/1000))+1);
    Object.assign(k,{bar:kb,db:kb.db,s:kb.s,AsKprov:kb.prov,clearWidth,leg,hook,cutLen:clearWidth+2*leg+2*hook,
      coverEarth:cEarth,coverTop:cTop,anchorPath,ldh:RK.ldhm,hookFit,fitOK,anchorOK,n,
      flexOK:k.flexSectionOK&&kb.ok!==false&&kb.prov>=k.AsKreq*0.999});
    k.ok=k.shOK&&k.flexOK&&k.fitOK&&k.anchorOK;
    if(!k.flexOK)r.warn.push('⛔ <b>Shear key K1 รับดัดไม่พอ</b> — เพิ่มขนาด/ลดระยะ K1 หรือเพิ่มความหนา key t');
    if(!k.fitOK||!k.anchorOK)r.warn.push('⛔ <b>Shear key K1 จัดวาง/ฝังยึดไม่ได้</b> — ตรวจ t, h<sub>z</sub>, toe/heel, cover 75 มม. และระยะพัฒนาแรงของอ 90°');
  }
  /* ครีบ: เหล็กหลัก — กำหนดเกรด/ขนาดเองได้ (จำนวนคำนวณจาก AsB) */
  if(r.but){const o=REBAROV.cfMain, dia=Math.min(32,Math.max(12,(o&&o.d)?+o.d:16)), g=(o&&o.g)?+o.g:dfy, pre=barPre(g);   // เหล็กหลักครีบ = เหล็กข้ออ้อยหลัก ต้อง ≥DB12 (กัน DB9 ที่ไม่ใช่เหล็กหลัก) · default DB16
    r.but.barSize=dia; r.but.barPre=pre; r.but.barGrade=g;
    r.but.nB25=Math.max(2,Math.ceil(r.but.AsB/BARS[dia])); r.but.barTxt=r.but.nB25+'-'+pre+dia;
    /* ★ แบ่งเหล็กหลักครีบ: ครึ่งยาวตลอด + ครึ่ง Cutoff — SSOT เดียวให้ BBS/2D/3D นับตรงกัน (เดิมต่างคนต่างคิด ceil(nB25/2)) */
    if(r.but.finCut){ r.but.finCut.nFul=Math.max(1,Math.ceil(r.but.nB25/2));
      r.but.finCut.nCut=Math.max(r.but.nB25-r.but.finCut.nFul,0);
      r.but.finCut.db=dia; }
    /* ── ตรวจการเทคอนกรีต: มวลรวมหยาบสูงสุดต้องลอดช่องว่างเหล็กหลักครีบได้ (ACI 318 §26.4.2.1: d_agg ≤ ¾·ช่องว่างสุทธิ
       ⇔ ช่องว่างสุทธิ ≥ max(d_b, 25, 4/3·d_agg)) · แน่นเกิน → จัดเป็น 2 ชั้น กันโพรง/หินไม่ลง ── */
    const dagg=Math.max(i.dagg||20,10);                                   // มวลรวมหยาบสูงสุด (มม.) — หิน 3/4″ ≈ 20
    const covB=Math.max(i.cov||40,25);                                    // ระยะหุ้มครีบ (มม.)
    const clrMin=Math.max(dia,25,Math.ceil(4*dagg/3));                    // ช่องว่างสุทธิขั้นต่ำ (มม.)
    const availB=i.bs*1000-2*covB-dia;                                    // ช่วงกระจายเหล็กในความหนาครีบ b* (มม.)
    const n1=r.but.nB25, cc1=n1>1?availB/(n1-1):availB, clr1=cc1-dia;     // ช่องว่างสุทธิถ้าเรียงชั้นเดียว
    const twoLayer=(clr1<clrMin-0.5 && n1>=3 && availB>0);
    const nPer=twoLayer?Math.ceil(n1/2):n1, ccU=nPer>1?availB/(nPer-1):availB, clrU=ccU-dia;
    r.but.dagg=dagg; r.but.covB=covB; r.but.clrMin=clrMin; r.but.clr1=Math.round(clr1);
    r.but.twoLayer=twoLayer; r.but.nLayer=twoLayer?2:1; r.but.nPerLayer=nPer; r.but.clrUse=Math.round(clrU);
    if(twoLayer&&r.warn)r.warn.push('เหล็กหลักครีบ '+n1+'-'+pre+dia+' เรียงชั้นเดียวช่องว่าง≈'+Math.round(clr1)+' มม. < ขั้นต่ำ '+clrMin+' มม. (มวลรวม '+dagg+' มม. ลอดไม่ได้ · ¾-rule) → จัดเป็น 2 ชั้น (ช่องว่าง≈'+Math.round(clrU)+' มม. หินลงได้)');}
  /* เหล็กปลอก/ตัวยึด: ถ้ากำหนดเอง เก็บไว้ให้ตัววาด/BBS ใช้ */
  {const o=REBAROV.stirrup; r.tieBar=(o&&o.d)?{db:+o.d,pre:barPre(+o.g||dfy),s:o.s?+o.s:200}:null;}
}

/* ============================================================
   SOLDIER PILE WALL — เสาเข็มตัวไอ + แผ่นเสียบร่อง + สเตย์ดึงรั้ง
   (กำแพงพืดฝังตัว: active หลัง · passive หน้าช่วงฝัง · สเตย์เมื่อสูง)
   ============================================================ */
/* Build 180 · Ground Anchor installation contract (FHWA GEC 4 terminology)
   This is a pure SSOT validator/capacity identity, not a default generator.
   Missing project/geotechnical data remains zero/blank and must HOLD export. */
function groundAnchorSSOT180(i,o){
  i=i||{};o=o||{};
  const n=v=>Number.isFinite(+v)?+v:0, txt=v=>String(v==null?'':v).trim();
  const angle=n(o.angle), rad=angle*Math.PI/180;
  const freeLength=Math.max(0,n(i.gaFreeLength)), bondLength=Math.max(0,n(i.gaBondLength));
  const bondDiameter=Math.max(0,n(i.gaBondDia))/1000, bondStress=Math.max(0,n(i.gaBondStress));
  const serviceDemand=Math.max(0,n(o.serviceDemand)), factoredDemand=Math.max(0,n(o.factoredDemand));
  const horizontalFree=freeLength*Math.cos(rad), verticalDrop=freeLength*Math.sin(rad);
  const wedgeBackAtHead=Math.max(0,n(o.wedgeBackAtHead)), requiredClearance=Math.max(0.5,n(o.requiredClearance));
  const wedgeClearance=horizontalFree-wedgeBackAtHead;
  const bondCapacity=Math.PI*bondDiameter*bondLength*bondStress;
  const tendonSpec=txt(i.gaTendonSpec), groutSpec=txt(i.gaGroutSpec), protectionSpec=txt(i.gaProtectionSpec);
  const missing=[];
  if(!(freeLength>0))missing.push('gaFreeLength');
  if(!(bondLength>0))missing.push('gaBondLength');
  if(!(bondDiameter>0))missing.push('gaBondDia');
  if(!(bondStress>0))missing.push('gaBondStress');
  if(!tendonSpec)missing.push('gaTendonSpec');
  if(!groutSpec)missing.push('gaGroutSpec');
  if(!protectionSpec)missing.push('gaProtectionSpec');
  const angleOK=angle>=5&&angle<=45, wedgeOK=wedgeClearance>=requiredClearance-1e-9;
  const capacityOK=bondCapacity>0&&serviceDemand<=bondCapacity*(1+1e-9), complete=missing.length===0;
  return {schema:'rw-ground-anchor-installation/1.0.0',mark:'GA-01',angle,freeLength,bondLength,bondDiameter,bondStress,
    totalLength:freeLength+bondLength,horizontalFree,verticalDrop,wedgeBackAtHead,requiredClearance,wedgeClearance,
    serviceDemand,factoredDemand,bondCapacity,dc:bondCapacity>0?serviceDemand/bondCapacity:Infinity,
    tendonSpec,groutSpec,protectionSpec,missing,complete,angleOK,wedgeOK,capacityOK,ready:complete&&angleOK&&wedgeOK&&capacityOK,
    sourceRefs:['i.gaFreeLength','i.gaBondLength','i.gaBondDia','i.gaBondStress','i.gaTendonSpec','i.gaGroutSpec','i.gaProtectionSpec']};
}
function calcSoldier(i,warn){
  const C=CD();
  const {hp,phi,gs,q,fc,fy}=i, beta=0;
  if(gs/G>2.6)warn.push('⚠ γs = '+fmt(gs/G,1)+' ตัน/ม³ สูงผิดปกติ (ดินจริง 1.5–2.2 ตัน/ม³) — ตรวจ "หน่วย": ช่องนี้เป็น ตัน/ม³ ไม่ใช่ kN/m³ (18 kN/m³ ≈ 1.8 ตัน/ม³) · แรงดัน/โมเมนต์/แผ่นเสียบจะสูงเกินจริง ~10 เท่า ถ้ากรอกผิดหน่วย');
  const H=Math.max(hp,1);                       // ความสูงดินที่กัน (เหนือระดับขุด)
  const prof=soilProfile(i);                    // โปรไฟล์ชั้นดิน (สำหรับสปริง point-spring ต่อชั้น)
  const Ka=Math.pow(Math.tan((45-phi/2)*D2R),2), Kp=Math.pow(Math.tan((45+phi/2)*D2R),2);
  const S=Math.max(i.pileS,0.6);                // ระยะเสาเข็ม c/c
  /* เสาเข็มตัวไอ ตาม มอก.396-2549 — เลือกขนาด (i.ipile = ด้านหน้าตัด ซม.) → ดึงสเปคจากตาราง IPILE */
  const ipSz=Math.round(parseFloat(i.ipile))||35, ipS=ipileSpec(ipSz);
  const pileFc=39.2;                                  // มอก.396 f′c ≥ 400 ksc ≈ 39.2 MPa
  const Mcap=1.6*ipS.Mcr*G;                           // โมเมนต์รับได้ออกแบบ ≈ φMn ≈ 1.6·Mcr (kN·m) — ค่าประมาณ
  const Vcap=0.16*Math.sqrt(pileFc)*((ipSz/100)*0.8*(ipSz/100))*1000; // เฉือนรับได้โดยประมาณจากหน้าตัด (kN)
  const SS=i.soldierSys||'stay';   // ระบบยึดรั้ง: cant | stay | anchor (default = สเตย์ดึง)
  const tie=(SS!=='cant');                       // มีตัวยึดรั้ง (ทุกแบบยกเว้นคานยื่น)
  const aAuto=Math.max(0.25*H,0.8);
  const a=tie?(i.stayAtCap?0:((parseFloat(i.stayLvl)>0)?Math.min(parseFloat(i.stayLvl),H-0.2):aAuto)):0;   // ระดับจุดยึดรั้งจากยอด — กรอกเองได้ (0=auto ≈¼H) · เป็นจุดหมุน free-earth-support · stayAtCap → a=0 (ยึดที่ RB1 · ไม่มี RB2)

  /* แรงดัน active (ต่อความกว้าง 1 ม.) */
  const pa=z=>Ka*(gs*z+q);                      // ที่ลึก z จากยอด (ต/ม²)
  /* ---- หา embedment D ---- */
  // net pressure ใต้ระดับขุด (z>H): active(บน) ลบ passive(หน้า) = Ka·γ·z+Ka·q − Kp·γ·(z−H)
  const netBelow=zz=>Ka*(gs*zz+q)-Kp*gs*(zz-H);
  let D=0, D0eq=0;   // D0eq = ระยะฝังที่สมดุลโมเมนต์ (ก่อนเผื่อ FS) — ใช้คำนวณแรงสเตย์ T
  if(!tie){
    // cantilever: หา D ให้ ΣM รอบปลายเสาเข็ม ≥ 0 (วิธีอย่างง่าย + FS ฝัง 1.2 บน D ที่สมดุล)
    let D0=0.5;
    for(let d=0.3;d<=4*H;d+=0.05){
      const Lt=H+d;
      // โมเมนต์รอบปลาย (z=Lt): driving=active เต็ม, resisting=passive ช่วงฝัง
      // active resultant
      let Md=0,Mr=0,zc;
      const N=120,dz=Lt/N;
      for(let k=0;k<N;k++){const z=(k+0.5)*dz, arm=Lt-z;
        Md+=Ka*(gs*z+q)*dz*arm;
        if(z>H)Mr+=Kp*gs*(z-H)*dz*arm;}
      if(Mr>=1.3*Md){D0=d;break;} D0=d;
    }
    D=D0*1.2; // เผื่อความลึกฝัง
  }else{
    // anchored (free earth support): หา D ให้ ΣM รอบจุดสเตย์ = 0
    let D0=0.5;
    for(let d=0.3;d<=3*H;d+=0.05){
      const Lt=H+d; const N=140,dz=Lt/N; let M=0;
      for(let k=0;k<N;k++){const z=(k+0.5)*dz, arm=z-a; // โมเมนต์รอบสเตย์
        M+=Ka*(gs*z+q)*dz*arm;                 // active (ผลักออก, +)
        if(z>H)M-=Kp*gs*(z-H)*dz*arm;}         // passive (ต้าน, −)
      if(M<=0){D0=d;break;} D0=d;}
    D=D0*1.15; D0eq=D0;
  }
  /* ---- ระยะฝังให้เกิด fixity (long pile ≈ 4/β) ตามวิธี pile-spring — ดินอ่อน Su ต่ำ → ฝังลึก (สอดคล้องแบบจริง) ---- */
  const Bp=ipSz/100;                                  // ด้านหน้าตัดเสาเข็มตัวไอ (ม.) ตาม มอก.396
  /* แรงดันน้ำหลังกำแพง · เจาะรู PVC ระบายน้ำที่แผ่นพื้น (weep) → ลดแรงดันน้ำตามจำนวนรู/แผ่น (นำเข้าการคำนวณ)
     2 รู = ระบายเต็ม (drained · คงเหลือ 0) · 1 รู = ระบายบางส่วน (คงเหลือ 0.5) · 0 = ไม่เจาะ (แรงดันน้ำเต็ม) */
  const weepN=(i.weepN!=null)?i.weepN:(i.weep?2:0), drained=(weepN>=2);
  const drainFrac=(weepN>=2)?0:(weepN===1?0.5:1);                // สัดส่วนแรงดันน้ำที่คงเหลือหลังระบาย
  /* ★ zw = 0 คือ "ระดับน้ำอยู่ที่ผิวดิน" = กรณีเลวร้ายที่สุด ไม่ใช่ "ยังไม่ได้กรอก"
     (กำแพงเสาเข็มพืดริมคลอง/หน้าฝน เจอสภาพนี้ประจำ)
     บั๊กเดิม (แก้ 2569-07): `i.zw>0` ทำให้ zw=0 (falsy) หล่นไปใช้ zwt=H → pw(z)=0 ทุกจุด → แรงดันน้ำหายเกลี้ยง
     → M_max เสาเข็ม 26.8 (ที่ zw=0.3) ตกเหลือ 5.1 kN·m ที่ zw=0 = เท่ากับ "ไม่มีน้ำเลย" (ต่ำกว่าจริง ~5.3 เท่า)
     → ไม่ monotonic ตามระดับน้ำ = พิสูจน์บั๊กได้ในตัว · เสาเข็ม/แผ่นเสียบ/สเตย์ ถูกออกแบบต่ำกว่าจริงทั้งชุด
     NaN/ว่าง → H (ไม่มีน้ำ) คงพฤติกรรมเดิม · ติดลบ (น้ำเหนือผิวดิน) → หนีบเป็น 0 */
  const zwt=(isFinite(i.zw)&&i.zw<H)?Math.max(i.zw,0):H;
  const pw=z=>(z>=H||z<=zwt)?0:GW*(z-zwt)*drainFrac;             // แรงดันน้ำ active เหนือระดับขุด (kN/ม²) × drainFrac
  const dispAt=Dt=>pileDisp(i,{B:Bp,Lt:H+Dt,embedTop:H,distLoad:z=>z<H?(Ka*(gs*z+q)+pw(z))*S:0,tie,braceLevel:a,Ishape:true,prof});
  const Dpassive=D;
  const fcMPa=Math.max(i.fc,10),EcP=4700*Math.sqrt(fcMPa),IgP=Math.pow(Bp,4)/12*0.6,EIp=EcP*1000*IgP;
  const kline=Math.max(khAt(prof,H+Dpassive/2,Bp)*Bp, 1);   // สปริงดินด้านข้างผู้แทน (ks·B) ที่กึ่งกลางช่วงฝัง (kN/m²)
  const betaP=Math.pow(kline/(4*EIp),0.25);                 // 1/m (ส.ป.ส.ความยาวลักษณะเฉพาะเสาเข็มในดิน) β=(k_h·B/4EI)^¼
  const Dfix=Math.min((tie?1.5:3.0)/betaP,9*H);            // ฝังให้เป็น long pile: คานยื่น βD≈3, มีค้ำยัน βD≈1.5
  /* ---- โมเมนต์ passive↔active รอบจุดหมุน ที่ระยะฝัง Dt (คานยื่น=ปลายเข็ม · มีค้ำยัน=จุดสเตย์) ---- */
  const otAt=(Dt)=>{const Ltl=H+Dt,N2=140,dz2=Ltl/N2,piv=tie?a:Ltl;let Md=0,Mr=0;
    for(let k=0;k<N2;k++){const z=(k+0.5)*dz2, arm=tie?(z-piv):(Ltl-z);
      Md+=Ka*(gs*z+q)*dz2*Math.max(arm,0);                 // active (ขับเคลื่อน)
      if(z>H)Mr+=Kp*gs*(z-H)*dz2*Math.max(arm,0);}         // passive (ต้าน)
    return {Md,Mr};};
  const FSotReq=2.0;                                       // ★ FoS กันพลิกคว่ำปลายเข็ม ≥ 2.0 เสมอ (กฎกระทรวง 2566 ฐานราก ข้อ 31 — พลิกคว่ำ ≥2.0) · เลื่อนไถล ≥1.5 ไม่ใช้กับเสาเข็มพืด (embedded)
  let DfsTgt=0.3;                                           // ระยะฝังที่ทำให้ passive ≥ FoS·active (กันพลิกคว่ำตามเกณฑ์)
  for(let d=0.3; d<=6*H; d+=0.05){const m=otAt(d); DfsTgt=d; if(m.Md<=0||m.Mr>=FSotReq*m.Md)break;}
  const Dauto=Math.max(Dpassive,Dfix,DfsTgt);             // ปลอดภัยทุกมิติ: สมดุล passive · ฝังยึดแน่น long-pile · FoS กันพลิกคว่ำ
  const Duser=(i.pileEmbS>0)?i.pileEmbS:0;                 // ผู้ใช้กำหนดเอง (>0) · 0 = อัตโนมัติ
  D = Duser>0 ? Duser : Dauto;
  const Dreq=Dauto, embedAuto=(Duser<=0), embedOK=(D>=Dreq-0.02);   // กำหนดเองต้อง ≥ ระยะฝังที่ต้องการ
  const Lt=H+D;
  /* ---- เมตริกระยะฝังปลอดภัย (POINT SPRING SUPPORT) — กันหัก/พลิกคว่ำ/เลื่อน + ฝังยึดแน่น ---- */
  const otF=otAt(D), FSot=otF.Md>0?otF.Mr/otF.Md:9;
  const betaD=betaP*D, Lchar=1/betaP, longPile=betaD>=(tie?1.5:2.5);
  let crit='สมดุลโมเมนต์ passive', cmax=Dpassive;
  if(Dfix>cmax+1e-6){crit='ฝังยึดแน่น long-pile (βD≥'+(tie?1.5:2.5)+')';cmax=Dfix;}
  if(DfsTgt>cmax+1e-6){crit='FoS กันพลิกคว่ำ ≥ '+FSotReq.toFixed(1);cmax=DfsTgt;}
  const embed={Dpassive,Dfix,DfsTgt,Dauto,Dreq,D,betaP,Lchar,betaD,longPile,FSot,FSotReq,crit,
    midType:layerAt(prof,H+D/2).type, khTop:khAt(prof,H+0.01,Bp), khBot:khAt(prof,Lt,Bp)};
  if(embedOK&&FSot<FSotReq-0.01)warn.push('อัตราส่วนปลอดภัยกันพลิกคว่ำปลายเข็ม FS='+fmt(FSot,2)+' < '+fmt(FSotReq,1)+' — เพิ่มระยะฝัง D, เพิ่มหน้าตัด/ลดระยะ S หรือใส่คานค้ำยัน');
  /* ---- แรงเฉือน/โมเมนต์ในเสาเข็ม (ต่อความกว้าง 1 ม. แล้ว ×S ต่อต้น) ---- */
  const N=200,dz=Lt/N; const net=[];let V=0;const Varr=[0],Marr=[0];let Mc=0;
  for(let k=0;k<N;k++){const z=(k+0.5)*dz;
    let w=Ka*(gs*z+q)+pw(z); if(z>H)w-=Kp*gs*(z-H);          // + แรงดันน้ำ (ถ้าไม่เจาะระบาย)
    Mc+=V*dz+w*dz*dz/2;V+=w*dz;Varr.push(V);Marr.push(Mc);}
  // tie reaction (anchored): T = ค่าที่ทำให้ shear ที่ปลายเป็น 0 โดยประมาณ = active−passive รวม ที่จุดสเตย์
  let T=0,Mmax=0,zMmax=0,Vmax=0;
  const kSpan=Math.min(N,Math.round((H+0.45*D)/dz));            // จำกัดช่วง span (เหนือโซนฝังลึก) เพื่อไม่นับโมเมนต์สวิงเกินจริง
  if(tie){
    // free-earth support: แรงสเตย์ T = ΣFx = (active รวม − passive รวม) ที่ระยะฝัง "สมดุลโมเมนต์" D0eq
    // (ไม่ใช่ระยะฝังเผื่อ FS·D ที่ passive ส่วนเกินทำให้ net<0 → T ถูกบีบเป็น 0 · เป็นบั๊กเดิม)
    const Lt0=H+Math.max(D0eq,0.3), N0=200, dz0=Lt0/N0; let V0=0;
    for(let k=0;k<N0;k++){const z=(k+0.5)*dz0; let w=Ka*(gs*z+q)+pw(z); if(z>H)w-=Kp*gs*(z-H); V0+=w*dz0;}
    T=Math.max(V0,0);
    let Mloc=0;
    for(let k=0;k<=kSpan;k++){const z=k*dz; const m=Marr[k]-T*Math.max(z-a,0);
      if(Math.abs(m)>Math.abs(Mloc)){Mloc=m;zMmax=z;}
      const vv=Varr[k]-(z>=a?T:0); if(Math.abs(vv)>Vmax)Vmax=Math.abs(vv);}
    Mmax=Math.abs(Mloc);
  }else{
    // cantilever: โมเมนต์ออกแบบสูงสุดที่จุดแรงเฉือนเป็นศูนย์ใต้ระดับขุด (ไม่นับโซนฝังลึก)
    let kz=kSpan; for(let k=1;k<=N;k++){const z=k*dz; if(z>H&&Varr[k]*Varr[k-1]<=0){kz=Math.min(k,kSpan);break;}}
    for(let k=0;k<=kz;k++){if(Math.abs(Marr[k])>Mmax){Mmax=Math.abs(Marr[k]);zMmax=k*dz;}
      if(Math.abs(Varr[k])>Vmax)Vmax=Math.abs(Varr[k]);}
  }
  const MpileSimp=Mmax*S, VpileSimp=Vmax*S;     // วิธีอย่างง่าย (อ้างอิง)
  const Tpile=T*S;                              // แรงดึงสเตย์ต่อต้น (ต)
  /* ---- แผ่นเสียบ = แผ่นพื้นกลวงสำเร็จ CPAC HC60×300 (หนา 6 ซม. · กว้าง 30 ซม. · fc≥350 ksc · ลวด PC) ----
     พาดระหว่างปีกเสาเข็ม (ช่วงสุทธิ ≈ S−Bp) รับแรงดันด้านข้างเป็นโหลดกระจาย (kg/ม²) — ตรวจกับกำลังรับน้ำหนักปลอดภัยตามตาราง CPAC */
  const pwBase=(zwt<H?GW*(H-zwt)*drainFrac:0);                  // แรงดันน้ำที่ฐาน × drainFrac (ตามจำนวนรูระบาย)
  const wLag=Ka*(gs*H+q)+pwBase;                                // แรงดันด้านข้างที่ฐาน (kN/ม²) — รวมน้ำถ้า undrained
  const tLag=Math.min(Math.max((parseFloat(i.tLag)||5)/100,0.04),0.10), plankW=(parseFloat(i.lagW)||30)/100;   // ความหนา + ความกว้างแผ่นเสียบจาก input (มาตรฐาน 5×30 ซม. · เลือก 35 ได้)
  /* ร่องรับแผ่นของตัวไอ (มอก.396 ตาราง 3): ปากร่องระหว่างปลายปีก = B−2K (ช่องแคบสุดที่แผ่นต้องลอด)
     ลึกเข้าไปช่องกว้างขึ้นถึง B−2N ที่โคนปีก — แผ่นวางกึ่งกลาง CL เข็ม ยันบ่าลาดปีก/ชิดเอวตามความหนา */
  const grooveW=(ipS.b*10-2*(ipS.K||60))/1000;                  // ปากร่อง (ม.)
  const grooveWeb=(ipS.b*10-2*(ipS.N||75))/1000;                // ช่องที่โคนปีก/เอว (ม.)
  if(tLag>grooveW+1e-6)warn.push('แผ่นเสียบหนา '+fmt(tLag*100,0)+' ซม. > ปากร่องปีกเข็ม I-'+ipSz+' (B−2K = '+fmt(grooveW*100,1)+' ซม. ตาม มอก.396) — เสียบไม่ลง! ลดความหนาแผ่น หรือใช้เข็มใหญ่ขึ้น');
  const lagSpanCl=Math.max(S-Bp,0.3);                           // ช่วงพาดสุทธิระหว่างปีกเสาเข็ม (ม.)
  const wLag_kgm2=wLag*1000/9.80665;                            // kN/ม² → กก./ม² (รับเป็น superimposed load)
  // กำลังรับน้ำหนักปลอดภัยฐาน HC60 หนา 6 ซม. (3Ø4mm PC wire · ไม่ค้ำยัน) ตามตาราง CPAC · ช่วงพาด < 2 ม. ปรับตามโมเมนต์ (∝1/L²)
  const HCt=[[2.0,1615],[2.25,1240],[2.5,970],[2.75,740],[3.0,535],[3.25,380],[3.5,255]];
  const tScale=Math.pow(tLag/0.06,2);                           // เทียบสัดส่วน section modulus (t/6)² จากฐานแผ่น 6 ซม. — ยืนยันผู้ผลิต
  const plankSafe=(function(L){if(L<=HCt[0][0])return HCt[0][1]*Math.pow(HCt[0][0]/L,2);
    for(let j=1;j<HCt.length;j++)if(L<=HCt[j][0]){const a0=HCt[j-1][0],v0=HCt[j-1][1],a1=HCt[j][0],v1=HCt[j][1];return v0+(v1-v0)*(L-a0)/(a1-a0);}
    return HCt[HCt.length-1][1]*Math.pow(HCt[HCt.length-1][0]/L,2);})(lagSpanCl)*tScale;
  const lagUtil=plankSafe>0?wLag_kgm2/plankSafe:9, lagOK=lagUtil<=1;
  const lagName='แผ่นเสียบร่อง คสล. หนา '+fmt(tLag*100,0)+' ซม.';
  if(!lagOK)warn.push(lagName+': แรงดันด้านข้าง '+fmt(wLag_kgm2,0)+' กก./ม² > รับได้ '+fmt(plankSafe,0)+' กก./ม² (ช่วงพาดสุทธิ '+fmt(lagSpanCl,2)+' ม.) — ลดระยะเสาเข็ม S, เพิ่มความหนา/ลวด PC, หรือเจาะรูระบายน้ำ');
  /* ★ #5 แผ่นเสียบ = คาน คสล. ช่วงเดียว พาดแนวนอนระหว่างปีกเข็ม รับแรงดันด้านข้าง (w·L²/8) — ตรวจ M/V + โหมดออกแบบ */
  const lagDesign=(i.lagDesign==='self')?'self':'factory';          // 'factory'=แจ้ง M,V ให้โรงงานออกแบบ (default · แผ่นสำเร็จ) · 'self'=เสริมเหล็กเอง
  const wuLag=C.gH*wLag;                                             // แรงดันประลัย (kN/ม²)
  const MuLagM=wuLag*lagSpanCl*lagSpanCl/8, VuLagM=wuLag*lagSpanCl/2;// ต่อความสูงแผ่น 1 ม. — โมเมนต์ w·L²/8 (kN·m/ม) · เฉือน wL/2 (kN/ม)
  const MuLagP=MuLagM*plankW, VuLagP=VuLagM*plankW;                  // ต่อ 1 แผ่น (กว้าง plankW)
  const dLagEff=Math.max(tLag-0.02,0.02), lagFc=350;                 // d ประสิทธิผล (cover~1.5+½ลวด) · f′c แผ่น
  const lagAsMin=0.0018*1e6*tLag;                                    // เหล็ก/ตะแกรงกันร้าว min (มยผ.) mm²/ม
  const lagAsReq=Math.max(asReq(MuLagM,1.0,dLagEff,lagFc,fy)||0,lagAsMin);   // As รับดึงต้องการ (mm²/ม)
  const lagBarDb=6, lagBarA=BARS[lagBarDb]||28.3;                    // ตะแกรง/เหล็กเสริม RB6
  const lagSpAuto=Math.max(0.05,Math.min(0.20,Math.round((lagBarA*1000/Math.max(lagAsReq,1))/25)*25/1000));  // ระยะเรียง auto (ปัด 25มม)
  const lagAsProv=lagBarA/lagSpAuto;                                // As ที่ให้ (mm²/ม)
  const lagPhiVc=phiVc(1.0,dLagEff,lagFc);                           // φVc ต่อความสูง 1 ม. (kN/ม)
  const lagMomOK=lagAsProv>=lagAsReq*0.999, lagShOK=VuLagM<=lagPhiVc*1.001, lagSelfOK=lagMomOK&&lagShOK;
  if(lagDesign==='self'&&!lagSelfOK)warn.push('แผ่นเสียบ (เสริมเหล็กเอง): '+(!lagMomOK?('As '+fmt(lagAsProv,0)+' < ต้องการ '+fmt(lagAsReq,0)+' มม²/ม'):'')+(!lagShOK?(' · Vu '+fmt(VuLagM,1)+' > φVc '+fmt(lagPhiVc,1)+' kN/ม'):'')+' — เพิ่มความหนาแผ่น t หรือลดระยะเสาเข็ม S');
  const lag={tLag,plankW,lagSpanCl,wLag,wLag_kgm2,plankSafe,lagUtil,lagOK,tScale,lagName,grooveW,nPlank:Math.max(1,Math.ceil(H/plankW)),drained,nWeep:weepN,drainFrac,wireMesh:'wiremesh Ø4@200 (fy≥5,500 ksc)',pcWire:'3Ø4 mm (มอก.420)',fcPlank:350,
    lagDesign,wuLag,MuLagM,VuLagM,MuLagP,VuLagP,dLagEff,lagFc,lagAsMin,lagAsReq,lagBarDb,lagSpAuto,lagAsProv,lagPhiVc,lagMomOK,lagShOK,lagSelfOK};
  const MlagU=C.gH*wLag*S*S/10, dLag=0.04, AsLag=0.0018*1e6*tLag;  // (อ้างอิงเดิม — ใช้เฉพาะ BBS wiremesh)
  /* ---- คานรัด/คานหัวเข็ม 3 ระดับ — แยกออกแบบ "แต่ละคาน": RB1 (บนสุด) · RB2 (waler@a) · RB3 (ล่างสุด) ----
     คานต่อเนื่องเหนือหัวเสาเข็มพืด: กระจายแรงหัวเข็ม/แรงยึดรั้ง (Tpile ต่อช่วง S) → M ≈ w·L²/10 (typical ทุกระดับ — อนุรักษ์นิยม)
     (โมเมนต์บวก = ช่วงกลาง/เหล็กล่าง · โมเมนต์ลบ = เหนือ support/เหล็กบน) · ปลอก RB6/RB9 เว้นโซนเสาเข็ม · 0/auto = โปรแกรมออกแบบ */
  let capD=null;
  {
    const nLv=tie?((a>0.25)?3:2):2;                                  // จำนวนคานยึด (3 ถ้ามี waler กลางที่ a)
    const mkBeam=(p,name,present)=>{                                 // p = prefix input (rb1/rb2/rb3)
      const _pileW=(typeof Bp!=='undefined'?Bp:(typeof ipSz!=='undefined'?ipSz/100:0.30));   // หน้ากว้างเสาเข็มพืด
      const bw=Math.max((parseFloat(i[p+'Bw'])>0)?parseFloat(i[p+'Bw'])/100:0.30, _pileW+0.10);   // ★ คานหัวเข็มต้องกว้าง ≥ หน้าเข็ม + หุ้ม 5 ซม.×2 → เหล็กหน้าข้างพ้นเนื้อเข็ม คอร. (SSOT: คอนกรีต+เหล็ก+2D+calc ตรงกัน)
      const bh=(parseFloat(i[p+'Bh'])>0)?parseFloat(i[p+'Bh'])/100:Math.max(0.40,Math.ceil((0.45+0.05*H)/0.05)*0.05);
      const db=(parseInt(i[p+'Db'])>0)?parseInt(i[p+'Db']):16;
      const covCap=0.05, dCap=Math.max(bh-covCap,0.10), Ag=bw*bh*1e6;
      const McapU=C.gH*Tpile*S/10, VuCap=C.gH*Tpile*0.6;             // แรงออกแบบ typical (คานต่อเนื่อง · end shear ~0.6R)
      const AsMin=(1.4/fy)*bw*1000*dCap*1000;                        // เหล็กน้อยสุด (มยผ.1103 / ACI 318 §9.6)
      const AsBotReq=Math.max(asReq(McapU,bw,dCap,fc,fy)||0,AsMin), AsTopReq=AsBotReq;
      const nBotAuto=Math.max(2,Math.ceil(AsBotReq/BARS[db])), nTopAuto=Math.max(2,Math.ceil(AsTopReq/BARS[db]));
      const nBot=(parseInt(i[p+'Nb'])>0)?Math.max(parseInt(i[p+'Nb']),2):nBotAuto;
      const nTop=(parseInt(i[p+'Nt'])>0)?Math.max(parseInt(i[p+'Nt']),2):nTopAuto;
      const AsBot=nBot*BARS[db], AsTop=nTop*BARS[db];
      const linkDb=(parseInt(i[p+'Ldb'])>0)?parseInt(i[p+'Ldb']):9;
      const linkSp=(parseFloat(i[p+'Lsp'])>0)?Math.round(parseFloat(i[p+'Lsp'])*10):Math.min(200,Math.max(100,Math.round(dCap*1000/2/50)*50));
      const Av=2*BARS[linkDb], pVc=phiVc(bw,dCap,fc), Vsd=C.phiv*Av*fy*(dCap*1000)/linkSp/1000, phiVn=pVc+Vsd;
      const secMan=(parseFloat(i[p+'Bw'])>0||parseFloat(i[p+'Bh'])>0), stMan=(parseInt(i[p+'Nt'])>0||parseInt(i[p+'Nb'])>0);
      const asBotOK=AsBot>=AsBotReq*0.999, asTopOK=AsTop>=AsTopReq*0.999;
      const rho=AsBot/Ag, rhoOK=rho<=0.04, shearOK=VuCap<=phiVn*1.001;
      if(present){                                                   // เตือนเฉพาะคานที่มีจริง (RB2 มีเมื่อ a>0.25)
        if(!asBotOK)warn.push('คานรัด '+name+': As ล่างจริง '+fmt(AsBot,0)+' < ต้องการ '+fmt(AsBotReq,0)+' มม.² ('+nBot+'-DB'+db+') — เพิ่มจำนวน/ขนาดเหล็ก');
        if(!rhoOK)warn.push('คานรัด '+name+': ρ='+(rho*100).toFixed(1)+'% เกิน 4% — เพิ่มหน้าตัด (ปัจจุบัน '+Math.round(bw*100)+'×'+Math.round(bh*100)+' ซม.)');
        if(!shearOK)warn.push('คานรัด '+name+': Vu '+fmt(VuCap,1)+' > φVn '+fmt(phiVn,1)+' kN — เพิ่มปลอก/ลดระยะเรียง หรือเพิ่มหน้าตัด');
      }
      return {name,present,bw,bh,dCap,db,covCap:0.05,McapU,VuCap,AsMin,AsBotReq,AsTopReq,nBot,nTop,nBotAuto,nTopAuto,AsBot,AsTop,linkDb,linkSp,Av,pVc,Vsd,phiVn,secMan,stMan,asBotOK,asTopOK,rho,rhoOK,shearOK,linkBar:'RB'+linkDb+'@'+linkSp};
    };
    const RB1=mkBeam('rb1','RB1',true), RB2=mkBeam('rb2','RB2',nLv>=3), RB3=mkBeam('rb3','RB3',true);
    capD=Object.assign({},RB1,{nLv,beams:[RB1,RB2,RB3]});            // top-level = RB1 (เข้ากันได้กับโค้ดเดิม) + beams[] ต่อระดับ
  }
  /* ---- คานค้ำยัน + เสาเข็มสมอ (bracing strut + anchor pile) ---- */
  let stay=null;
  if(tie){
    const wedgeBack=H*Math.tan((45-phi/2)*D2R);   // ระยะ active wedge ที่ผิวดิน (จากกำแพง)
    const angle=(SS==='anchor')?(parseFloat(i.stayAng)>0?Math.min(parseFloat(i.stayAng),60):20):0;   // มุมเอียงสมอดิน (ground anchor) — กรอกเองได้ · default 20° · V-stay = 0
    /* Ground anchor Lb is the horizontal projection of the explicit unbonded
       length. V-stay keeps its original rear-pile setback rule. */
    const Lb=(SS==='anchor')?Math.max(0,parseFloat(i.gaFreeLength)||0)*Math.cos(angle*D2R)
      :((i.stayLb>0)?i.stayLb:Math.max(wedgeBack+0.6,H*1.0,2.0));
    const braceS=S;                               // V-config: เสาเข็มสมอ 1 ต้นทุกกึ่งกลางช่วง (1 สมอ : 2 เข็มหน้า)

    const thetaPlan=(SS==='anchor')?0:Math.atan2(S/2,Math.max(Lb,0.1)); // Ground anchor อยู่ในระนาบรูปตัด; V-stay จึงมีมุมบานในผังเท่านั้น
    const member=(SS==='anchor')
      ? 'สมอดินเอียง '+angle+'° (ground anchor) · 1 จุด/เสาเข็มหน้า · free length + grout bond zone จาก Engineering SSOT — bond ต้องพ้น active wedge'
      : 'สเตย์ดึง คสล. รูปตัว V (2 แนว/เสาเข็มสมอ · 1 แนว/เข็มหน้า) → เสาเข็มสมอ uplift · เข็มหน้าทุกต้นยึด';
    // 1 สเตย์ : 1 เข็มหน้า → สเตย์รับแรงเต็ม Tpile (ตามแกน = /cosθ_plan /cosθ_sec) · เสาเข็มสมอ V ยึดเข็มหน้า 2 ต้น
    const stayAxial=Tpile/Math.cos(thetaPlan)/(angle?Math.cos(angle*D2R):1);
    const Tperm=stayAxial, perAnchor=(SS==='anchor'?stayAxial:2*Tpile); // Ground anchor 1 จุด/เข็ม; V-anchor pile 1 ต้นรับเข็มหน้า 2 ต้น
    const strutBeam=stayAxial;                    // ออกแบบคาน คสล. ต่อหนึ่งสเตย์
    let Pa=Math.max(parseFloat(i.Ppile)||30,1)*G;   // กำลังเสาเข็มสมอ (kN)
    if(parseFloat(i.pileTen)>0)Pa=parseFloat(i.pileTen)*G;   // ผู้ใช้กรอกกำลังรับแรงถอนเอง → ใช้ค่าจริง (สมอรับแรงดึง ไม่ใช่แกนอัด)
    /* ---- ออกแบบคาน คสล. ยึดรั้ง (สเตย์) = สมาชิกรับแรงดึงล้วน: คอนกรีตไม่รับแรงดึง → เหล็กรับทั้งหมด ----
       เกณฑ์: (1) กำลัง SDM Tu≤φ·As·fy (φ=0.90 tension) หรือ WSD fs≤ยอมให้ · (2) คุมรอยร้าว fs,ใช้งาน≤ยอมให้
       (3) กันวิบัติฉับพลัน As·fy≥Ag·fr · (4) ปลอกยึด+ระยะฝังที่หัวกำแพง/cap */
    const bw=(parseFloat(i.stayBw)>0)?parseFloat(i.stayBw)/100:0.25, bh=(parseFloat(i.stayBh)>0)?parseFloat(i.stayBh)/100:0.50, Ag=bw*bh*1e6;   // หน้าตัดคาน (กรอกเอง ซม. / auto 25×50)
    const stDb=(parseInt(i.stayDb)>0)?parseInt(i.stayDb):16, barPos=i.stayBarPos||'side';   // ขนาดเหล็กหลัก + ตำแหน่งติดตั้ง
    const Tu=C.gH*strutBeam;                                    // แรงดึงประลัย (factored)
    const fr=0.62*Math.sqrt(fc), fsAll=fsAllowWSD(fy);          // โมดูลัสแตกร้าว · หน่วยแรงเหล็กยอมให้ (คุมรอยร้าว)
    const AsStr=C.method==='wsd'?strutBeam*1000/fsAll:Tu*1000/(0.90*fy); // กำลัง
    const AsCk=strutBeam*1000/fsAll;                            // คุมรอยร้าว (service)
    const AsCr=Ag*fr/fy;                                        // กันวิบัติฉับพลันตอนคอนกรีตแตก
    const AsTieReq=Math.max(AsStr,AsCk,AsCr);
    const nBrAuto=Math.max(4,Math.ceil(AsTieReq/BARS[stDb]));   // จำนวนเส้นอัตโนมัติ (เหล็กยืนรอบหน้าตัด)
    const nBrMan=(parseInt(i.stayNbr)>0), nBr=nBrMan?Math.max(parseInt(i.stayNbr),2):nBrAuto;   // จำนวนเส้น (กรอกเอง/auto)
    const AsTie=nBr*BARS[stDb], rhoTie=AsTie/Ag, fsSvc=strutBeam*1000/AsTie;
    const stLinkDb=(parseInt(i.stayLinkDb)>0)?parseInt(i.stayLinkDb):9, stLinkSp=(parseFloat(i.stayLinkSp)>0)?Math.round(parseFloat(i.stayLinkSp)*10):200;   // ปลอก RB6/RB9 · ระยะเรียง (ซม.→มม. · auto RB9@200)
    const linkBar='RB'+stLinkDb+'@'+stLinkSp, Ldt=Math.ceil(40*stDb)/1000;   // ปลอก · ระยะฝัง/ทาบ ≥40d_b (ม.)
    const asProvOK=nBrMan?(AsTie>=AsTieReq*0.999):true;         // กรอกจำนวนเอง → ตรวจ As จริง ≥ As ต้องการ
    const tieSecOK=rhoTie<=0.04, tieCrackOK=(fsSvc<=fsAll*1.001)&&asProvOK;
    if(SS!=='anchor'&&!tieSecOK)warn.push('คานสเตย์ยึดรั้ง: ρ='+(rhoTie*100).toFixed(1)+'% เกิน 4% — เพิ่มหน้าตัด (ปัจจุบัน '+(bw*100)+'×'+(bh*100)+' ซม.) หรือใช้เหล็กใหญ่ขึ้น');
    if(SS!=='anchor'&&!asProvOK)warn.push('คานสเตย์: As จริง '+fmt(AsTie,0)+' < As ต้องการ '+fmt(AsTieReq,0)+' มม.² ('+nBr+'-DB'+stDb+') — เพิ่มจำนวนเส้น/ขนาดเหล็ก');
    let wedgeOK=(Lb>=wedgeBack+0.5);
    if(SS!=='anchor'&&!wedgeOK)warn.push('ตัวสมอ/deadman ใกล้เกินไป — ต้องพ้น active wedge (~'+fmt(wedgeBack,1)+' ม.) · ใส่ Lb ≥ '+fmt(wedgeBack+0.5,1)+' ม.');
    // ---- คานรัดหัวเสาเข็ม (capping beam ตามแนวยาว) — อ้างอิงโมดูลออกแบบคานรัด capD (SSOT เดียว) ----
    const capBeam={bw:capD.bw,bh:capD.bh,dCap:capD.dCap,McapU:capD.McapU,AsCap:capD.AsBotReq,nBar:capD.nBot,nTop:capD.nTop,nBot:capD.nBot,db:capD.db,linkBar:capD.linkBar,capD};
    /* ความยาวเสาเข็มสมอ — กรอกเองได้ (0 = อัตโนมัติ ยาวถึงระดับปลายเข็มหลัก) · สั้นกว่าเข็มหลักได้ */
    const yCapEng=Math.max(H-0.5,H*0.6);                       // ระดับ pile cap สมอ (ใต้หัวกำแพง — ค่าเดียวกับ 3D/รูปตัด)
    const ancLeAuto=yCapEng+D; let ancLe=(parseFloat(i.ancLe)>0)?parseFloat(i.ancLe):ancLeAuto;
    if(SS!=='anchor'&&ancLe<Math.min(3,0.4*(H+D)))warn.push('เสาเข็มสมอยาว '+fmt(ancLe,1)+' ม. ค่อนข้างสั้น — ยืนยันกำลังรับแรงถอน (skin friction) ต่อความยาวนี้กับผลเจาะสำรวจ/ทดสอบ');
    // ★ เสาเข็มสมอ = สมาชิกรับแรงถอน/ดึง (uplift) · หน้าตัดแยกจากเข็มกันดินได้ (i.ancPileSec · 0=เท่าเข็มกันดิน) — เก็บผลแยกคู่
    const ancSz=(parseFloat(i.ancPileSec)>0)?Math.round(parseFloat(i.ancPileSec)):ipSz, ancS=ipileSpec(ancSz), ancSame=(ancSz===ipSz);
    const ancPerim=(ancS.perim||4*ancSz)/100;                              // เส้นรอบรูปหน้าตัด (ม.)
    const fsSkin=Math.max(0.5*(parseFloat(i.su)||2),1.0);                  // เสียดทานผิว ≈ 0.5·Su (t/m² · α-method) · ขั้นต่ำ 1
    if(!(parseFloat(i.ancLe)>0)){   // ★ AUTO-ออกแบบความยาวเข็มสมอ: ยืดให้เสียดทานผิวรับแรงถอนได้ (เผื่อ 5%) แต่ไม่เกินเพดานแรงดึงแกนหน้าตัด · cap = ยาวเข็มหลัก+3 ม.
      const _TsecC=0.30*((ancS.Psafe[0]+ancS.Psafe[1])/2), _tgtT=Math.min((perAnchor/G)*1.05,_TsecC);
      const _needLe=_tgtT/Math.max(ancPerim*fsSkin,1e-6);
      ancLe=Math.min(Math.max(ancLe,_needLe),Lt+3.0);
    }
    const TskinT=ancPerim*ancLe*fsSkin;                                    // แรงถอนจากเสียดทานผิว (ตัน)
    const TsecT=0.30*((ancS.Psafe[0]+ancS.Psafe[1])/2);                    // แรงดึงแกนหน้าตัด PC ≈ 30% กำลังแกน (ตัน · ค่าประมาณ ยืนยันผู้ผลิต)
    let TcapT=Math.min(TskinT,TsecT);                                      // กำลังรับแรงถอนเสาเข็มสมอ (ตัน)
    if(parseFloat(i.pileTen)>0)TcapT=parseFloat(i.pileTen);                // ผู้ใช้กรอกกำลังรับแรงถอนเอง → ใช้ค่าจริง
    const TcapKN=TcapT*G, dcT=perAnchor/Math.max(TcapKN,1e-6), anchorOKPile=dcT<=1.0001;
    Pa=TcapKN;                                                             // ★ Pa (กำลังเสาเข็มสมอ) = กำลังรับแรงถอนจากหน้าตัดสมอ (แทน Ppile เดิม)
    // ★ ชั้นที่ 3: เหล็ก dowel เชื่อมหัวเข็มสมอ ↔ pile cap — รับแรงถอนประลัยทั้งหมด (คอนกรีต-คอนกรีตรับดึงไม่ได้)
    //   2 ทางเลือก (ผู้ใช้เลือก): (ก) ใช้ลวด PC ของเข็มเป็น dowel  (ข) เจาะเสียบ/หล่อเหล็ก DB (แนะนำ)
    const TuAnc=(C.gH||1.7)*perAnchor;                                     // แรงถอนประลัยต่อเข็มสมอ (kN)
    const AgAnc=(ancS.area||ancSz*ancSz)*100;                              // Ag หน้าตัดสมอ (mm²)
    const AsDwReq=TuAnc*1000/(0.90*fy), AsDwMin=Math.max(0.005*AgAnc,4*BARS[12]);   // As=Tu/(φf_y) · ขั้นต่ำ 0.5%A_g หรือ ≥4-DB12
    const AsDwNeed=Math.max(AsDwReq,AsDwMin), dwGov=(AsDwReq>=AsDwMin?'แรงถอน':'ขั้นต่ำ');
    const dwMode=(i.ancDowelMode==='pcwire'?'pcwire':'db');
    // (ก) ลวด PC ของเข็ม (มอก.396 — กติกาเดียวกับ pileMOKDetail: nW/ขนาดลวด)
    const nWps=(ancSz<=22?4:ancSz<=30?6:ancSz<=40?8:10), wDiaPs=(ancSz<=26?4:5);
    const ApsWire=nWps*Math.PI/4*wDiaPs*wDiaPs;                            // พื้นที่ลวด PC รวม (mm²)
    const fpcUse=400, phiPc=0.75;                                         // หน่วยแรงใช้งานสุทธิของลวด PC ข้ามรอยต่อ (MPa) ≈ f_py−f_pe (มาร์จินเหนือแรงอัดคงค้าง · อนุรักษ์) · φ=0.75 (ลวดเรียบ ไม่เหนียว)
    const TpcCapKN=phiPc*ApsWire*fpcUse/1000, pcStrOK=(TuAnc<=TpcCapKN);   // กำลังรับดึงของลวด PC (kN) — ยังต้องสกัดเผยลวด+สมอปลาย
    // (ข) เจาะเสียบ/หล่อ DB — ขนาด/จำนวนกำหนดเองได้
    const dwDb=(parseFloat(i.ancDowelDb)>0?Math.round(parseFloat(i.ancDowelDb)):16);
    const nDwAuto=Math.max(4,Math.ceil(AsDwNeed/BARS[dwDb])), nDwMan=(parseFloat(i.ancDowelN)>0?Math.round(parseFloat(i.ancDowelN)):0), nDw=(nDwMan>0?nDwMan:nDwAuto);
    const AsDwProv=nDw*BARS[dwDb], dbDwOK=AsDwProv>=AsDwNeed*0.999;
    const ldDwCap=Math.ceil(40*dwDb)/1000, ldDwPile=Math.ceil(15*dwDb)/1000;   // ล้วงเข้า cap ≈40d_b (ดึง) · เจาะฝังเข้าเข็ม ≈15d_b (อีพ็อกซี/ทาบลวดเผย)
    const dowelOK=(dwMode==='pcwire'?pcStrOK:dbDwOK);
    const dowel={mode:dwMode,Tu:TuAnc,fyMPa:fy,AsReq:AsDwReq,AsMin:AsDwMin,AsNeed:AsDwNeed,govern:dwGov,
      db:dwDb,nBar:nDw,nAuto:nDwAuto,nMan:nDwMan,AsProv:AsDwProv,dbOK:dbDwOK,ldCap:ldDwCap,ldPile:ldDwPile,ld:ldDwCap,
      pc:{nW:nWps,dia:wDiaPs,Aps:ApsWire,fpc:fpcUse,phi:phiPc,Tcap:TpcCapKN,strOK:pcStrOK},
      ok:dowelOK, spec:(dwMode==='pcwire'?(nWps+'-Ø'+wDiaPs+'mm(PC)'):(nDw+'-DB'+dwDb)), bar:(dwMode==='pcwire'?('Ø'+wDiaPs+'PC'):('DB'+dwDb))};
    const anchorPileCalc={sz:ancSz,same:ancSame,perim:ancPerim,ancLe,fsSkin,TskinT,TsecT,TcapT,TcapKN,govern:(parseFloat(i.pileTen)>0?'ผู้ใช้กรอก':(TskinT<=TsecT?'เสียดทานผิว':'แรงดึงแกน')),Tdemand:perAnchor,TdemandT:perAnchor/G,dcT,ok:anchorOKPile,dowel};
    let groundAnchor=null,anchorPile=anchorPileCalc,anchorOK=anchorOKPile;
    if(SS==='anchor'){
      const wedgeBackAtHead=Math.max(0,(H-a)*Math.tan((45-phi/2)*D2R));
      groundAnchor=groundAnchorSSOT180(i,{angle,serviceDemand:stayAxial,factoredDemand:Tu,wedgeBackAtHead,requiredClearance:0.5});
      anchorPile=null;anchorOK=groundAnchor.ready;wedgeOK=groundAnchor.wedgeOK;Pa=groundAnchor.bondCapacity;
      if(groundAnchor.missing.length)warn.push('⛔ <b>GROUND ANCHOR INSTALLATION SSOT ไม่ครบ</b> — '+groundAnchor.missing.join(', ')+' · HOLD แบบ/Export โดยไม่สมมติค่า');
      if(!groundAnchor.angleOK)warn.push('⛔ มุม Ground Anchor '+fmt(angle,1)+'° อยู่นอกช่วงตรวจ 5–45° — วิศวกรต้องทบทวนแนวเจาะและสิทธิพื้นที่');
      if(groundAnchor.complete&&!groundAnchor.wedgeOK)warn.push('⛔ จุดเริ่ม bond ยังไม่พ้น active wedge + clearance 0.50 ม. — free length ฉายราบ '+fmt(groundAnchor.horizontalFree,2)+' < '+fmt(groundAnchor.wedgeBackAtHead+groundAnchor.requiredClearance,2)+' ม.');
      if(groundAnchor.complete&&!groundAnchor.capacityOK)warn.push('⛔ กำลังยึดเหนี่ยว Ground Anchor '+fF(groundAnchor.bondCapacity,1)+' '+UL().F+' < แรงใช้งาน '+fF(groundAnchor.serviceDemand,1)+' '+UL().F+' — เพิ่ม Lbond/Ø/τallow หรือปรับระบบจากข้อมูลทดสอบจริง');
    }else if(!anchorOK){
      warn.push('เสาเข็มสมอ I-'+ancSz+': แรงถอน '+fF(perAnchor,1)+' '+UL().F+' > กำลังรับถอน '+fF(TcapKN,1)+' ('+anchorPile.govern+') — เพิ่มหน้าตัด/ความยาวเสาเข็มสมอ หรือลดระยะ S');
    }
    stay={a,T:Tpile,Tperm,angle,thetaPlan,stayAxial,perAnchor,nStayPerAnchor:(SS==='anchor'?1:2),strut:strutBeam,Tu,Lb,braceS,Pa,bw,bh,Ag,nBr,nBrAuto,nBrMan,db:stDb,barPos,linkDb:stLinkDb,linkSp:stLinkSp,asProvOK,secMan:(parseFloat(i.stayBw)>0||parseFloat(i.stayBh)>0),AsTieReq,AsTie,rhoTie,fsSvc,fsAll,fr,AsStr,AsCk,AsCr,linkBar,Ldt,member,wedgeBack,wedgeOK,tieSecOK:(SS==='anchor'?true:tieSecOK),tieCrackOK:(SS==='anchor'?true:tieCrackOK),anchorOK,capBeam,yCap:yCapEng,ancLe:(SS==='anchor'&&groundAnchor?groundAnchor.totalLength:ancLe),ancLeAuto,ancLeMan:(SS==='anchor'?!!(groundAnchor&&groundAnchor.complete):(parseFloat(i.ancLe)>0)),anchorPile,groundAnchor};
  }

  /* ---- pile-spring (Winkler) + การเคลื่อนตัวด้านข้าง δ (ใช้ระยะฝังสุดท้าย) ---- */
  const disp=dispAt(D); disp.beta=betaP; disp.Lchar=1/betaP;
  if(!embedOK)warn.push('ระยะฝังเสาเข็ม D = '+fmt(D,2)+' ม. < ที่ต้องการ '+fmt(Dreq,2)+' ม. — ไม่ปลอดภัย (สมดุล passive / ฝังยึดแน่น) · เพิ่มความยาว หรือใส่ 0 = ให้โปรแกรมหาอัตโนมัติ');
  else if(embedAuto&&D>2.6*H)warn.push('ระยะฝังอัตโนมัติ D = '+fmt(D,2)+' ม. ลึกมาก (>2.6H) — ดินอ่อน/φ ต่ำ · พิจารณาเพิ่มหน้าตัดเสาเข็ม ลดระยะ S ใส่สเตย์ยึดรั้ง หรือเปลี่ยนระบบ');
  /* ---- โครงเชื่อมโยงทั้งระบบ (frame on layered springs, direct stiffness) — พฤติกรรมจริง + การเสียรูปเชื่อมโยง ---- */
  let frame=null;
  {const _Lb=stay?stay.Lb:Math.max(0.7*H,1.5), _walerY=H-a,                                  // ★ ระดับจุดยึดรั้ง a → waler=H−a · pile cap ตามสูตรเดียวกับ 3D/รูปตัด (ตรงกัน)
     _yCapF=(parseFloat(i.capLvl)>0)?Math.min(Math.max(H-parseFloat(i.capLvl),0.35),_walerY-0.3):Math.max(_walerY-Math.max(0.6,0.35*_Lb),0.35);
   try{frame=soldierFrame({H,D,Bp,EI:EIp,EA:EcP*1000*Bp*Bp,SS,Lb:_Lb,
     yCap:_yCapF,angle:stay?stay.angle:0,S,q,zw:i.zw,prof,EAstay:EcP*1000*0.04,a});}catch(e){console.error('frame',e);}}
  if(frame&&stay){stay.Nframe=frame.stayN; stay.upliftFrame=frame.upliftN;}   // แรงสเตย์/uplift จากโครงเชื่อมโยง
  /* โมเมนต์/เฉือนออกแบบ = จากแบบจำลอง FE pile-spring (สอดคล้องการเคลื่อนตัว) × load factor ตามมาตรฐาน */
  const LF=C.gH;
  const Mpile=disp.mMax*LF, Vpile=disp.vMax*LF;             // kN·m, kN ต่อต้น (factored, หน่วยเดียวกับ Mcap/Vcap)
  if(!disp.ok)warn.push('การเคลื่อนตัว δ='+fmt(disp.dMax,1)+' มม. > L/300='+fmt(disp.allow,1)+' มม. — เพิ่มหน้าตัดเสาเข็ม/ลดระยะ S หรือใส่คานค้ำยัน');

  // ★ เสริมพิเศษจากโรงงาน (เพิ่มเหล็ก/ลวด PC + ปลอกเกลียว) — แนะนำปริมาณเสมอ + (ถ้าเลือก) เพิ่มกำลังต้านจริง
  const _dp=0.8*(ipSz/100), _fyx=392000, _dMn=Math.max(0,Mpile-Mcap), _dVn=Math.max(0,Vpile-Vcap);   // ความลึกประสิทธิผล(ม.) · fy≈392MPa · ส่วนขาดโมเมนต์/เฉือน
  const _asAdd=_dMn>0?_dMn/(_fyx*0.9*_dp):0, _nXtra=(_dMn>0?Math.min(12,Math.max(2,Math.ceil(_asAdd/201e-6/2)*2)):0), _McapAdd=_nXtra*201e-6*_fyx*0.9*_dp;   // DB16 (201มม²) เพิ่มเป็นคู่ 2 หน้า · จำกัดสูงสุด 12 เส้น (ที่ใส่ในหน้าตัดได้จริง)
  const _enough=(Mcap+_McapAdd>=Mpile*0.999)&&(Vpile<=Vcap*1.6);   // เสริมพิเศษสูงสุดยังพอไหม (ถ้าไม่พอ → ต้องเปลี่ยนหน้าตัด/ระบบ)
  const pileXtra={need:(_dMn>0||_dVn>0), dM:_dMn, dV:_dVn, nBar:_nXtra, db:16, McapAdd:_McapAdd, enough:_enough, applied:!!i.pileXtra};
  const McapEff=Mcap+(i.pileXtra?_McapAdd:0), VcapEff=Vcap*(i.pileXtra?1.6:1);   // ปลอกเกลียวเสริม → เฉือน ~1.6× (โดยประมาณ)
  const checks={Mok:Mpile<=McapEff, Vok:Vpile<=VcapEff, dispOk:disp.ok};
  const Lw=Math.max(i.Lw,1), nPile=Math.max(2,Math.floor(Lw/S)+1);   // ใช้ความยาวผู้ใช้จริง — ห้ามหนีบกำแพงสั้นเป็น 6 ม. เพราะ BOQ/จำนวนเข็มจะเกินจริง
  const r={soldier:true,SS,i,H,D,Lt,Ka,Kp,S,Mcap:McapEff,Vcap:VcapEff,McapStd:Mcap,VcapStd:Vcap,pileXtra,tie,a,Mmax,Mpile,Vpile,MpileSimp,zMmax,T,Tpile,disp,Bp,ipSz,ipS,Mcr:ipS.Mcr,Dpassive,Dreq,embedAuto,embedOK,embed,frame,prof,
    wLag,MlagU,tLag,AsLag,dLag,lag,drained,zwt,stay,capD,Marr,Varr,dz,N,checks,warn,Lw,nPile,pa,net:zz=>{let w=Ka*(gs*zz+q)+pw(zz);if(zz>H)w-=Kp*gs*(zz-H);return w;}};
  /* ---- ★★ เสถียรภาพรวม วงลึกลอดใต้ปลายเข็ม — กำแพงเสาเข็มพืด (แก้ 2569-07 build 157) ----
     บั๊กเดิม: `calc()` บรรทัด 2468 `return calcSoldier(...)` **ออกก่อนถึงบล็อก globalSlip**
     → กำแพงเสาเข็มพืด **ไม่เคยถูกตรวจเสถียรภาพรวมเลย ไม่มีทั้งผลและคำเตือน**
     ทั้งที่ชนิดนี้ใช้ริมคลอง/ดินอ่อนมากที่สุด และ **มักวิกฤตกว่ากำแพงมีฐาน เพราะไม่มีฐานถ่วง**

     ★ แมปเรขาคณิตเข้า globalSlip ตัวเดิม (ไม่เขียนโมเดลใหม่ → ได้บั๊กที่แก้แล้วทั้งหมดฟรี:
       ห้ามผ่าคอนกรีต · ปฏิเสธวงที่ถูกขอบตัด · โดเมน/กริดสเกลตาม H · ขยายกล่องเอง · ธง edge)
       y=0 = ระดับขุด (พื้นหน้า)  ·  Df=0  ·  hz=0 (ไม่มีฐาน)  ·  toe=0, t=B=Bp (แนวเข็ม)
       Htot=H (ดินที่กัน)  ·  pileToe=D (ระยะฝังใต้ระดับขุด) → บังคับวงลอดใต้ปลายเข็ม
     ตรวจแล้ว ys(x): x≤0→0 (ระดับขุด) · 0<x≤Bp→H (ตัวเข็ม) · x>Bp→H (ดินหลัง) = ตรงกับเสาเข็มพืดพอดี */
  r.gslip=null;
  if(H>0.5&&D>0.3){
    try{
      /* ★ globalSlip รับดินได้ 2 ชุด (ดินถม + ดินฐาน) แต่ soldier บรรยายดินด้วย "ตารางชั้นดิน" (prof)
         → เลือก **ชั้นที่อ่อนที่สุดใต้ระดับขุด** ในช่วงที่วงวิกฤตพาดผ่าน เป็นตัวแทนดินฐาน
           = อนุรักษ์นิยม + อธิบายได้ · เทียบความแข็งแรงด้วย τ = c + γ·z_กลางชั้น·tanφ
         ★ ถ้ามีหลายชั้นใต้ระดับขุด → **ต้องบอกตรง ๆ ว่าเกณฑ์นี้ยุบเหลือชั้นเดียว** (ห้ามให้ดูเหมือนคิดครบ) */
      const _zTop=H, _zBot=H+D*1.6;                       // ช่วงใต้ระดับขุด ถึงลึกกว่าปลายเข็ม
      const _below=(prof||[]).filter(l=>l.bot>_zTop+1e-6&&l.top<_zBot-1e-6);
      let _sF=null, _tauMin=Infinity, _repName='';
      _below.forEach(l=>{
        const zm=(Math.max(l.top,_zTop)+Math.min(l.bot,_zBot))/2;
        const isClay=(l.type==='clay');
        const cL=isClay?Math.max(l.su||0,0):0, phL=isClay?0:Math.max(l.phi||0,0);
        const gL=Math.max(l.gamma||gs,1);
        const tau=cL+gL*zm*Math.tan(phL*D2R);
        if(tau<_tauMin){_tauMin=tau; _sF={gsF:gL,phiF:phL,cF:cL}; _repName=(isClay?'ดินเหนียว Su='+fmt(cL,1)+' kPa':'ทราย φ='+fmt(phL,0)+'°')+' (ลึก '+fmt(Math.max(l.top,_zTop)-_zTop,1)+'–'+fmt(Math.min(l.bot,_zBot)-_zTop,1)+' ม. ใต้ระดับขุด)';}
      });
      if(!_sF){_sF={gsF:gs,phiF:phi,cF:Math.max(+i.c||0,0)}; _repName='ดินชั้นเดียว';}
      if(_below.length>1)warn.push('ℹ <b>เสถียรภาพรวม: ยุบชั้นดินเหลือชั้นเดียว</b> — ใต้ระดับขุดมี '+_below.length+' ชั้น แต่โมเดลวงสไลด์รับได้ 2 ชุด (ดินถม+ดินฐาน) → เลือก<u>ชั้นที่อ่อนที่สุด</u> = '+_repName+' (อนุรักษ์นิยม) · การวิเคราะห์หลายชั้นจริงต้องใช้โปรแกรม slope stability เฉพาะทาง');
      r.gslip=globalSlipMemo(Object.assign({H,B:Bp,toe:0,t:Bp,hz:0,hp:H,Df:0,beta:0,q,
        gs,gsat:(+i.gsat||gs),phi,cc:Math.max(+i.c||0,0), gc:24, zw:i.zw, pileToe:D,
        kh:Math.max(+i.kh||0,0), kv:Math.max(+i.kv||0,0)}, _sF));
      if(r.gslip){ const reqG=r.gslip.seis?FSREQ.globE:FSREQ.glob; r.gslip.req=reqG; r.gslip.ok=r.gslip.FS>=reqG; r.gslip.pileToe=D; r.gslip.phiFused=_sF.phiF; r.gslip.repSoil=_repName;
        if(r.gslip.edge)warn.push('⚠ <b>เสถียรภาพรวม: การค้นหาวงวิกฤตยังชนขอบเขต</b> — FS='+r.gslip.FS.toFixed(2)+' อาจ<u>ไม่ใช่ค่าต่ำสุดจริง</u> · โปรดตรวจด้วยโปรแกรม slope stability เฉพาะทาง');
        if(!r.gslip.ok)warn.push('เสถียรภาพรวม <b>วงลึกลอดใต้ปลายเข็ม</b> (Bishop) FS='+r.gslip.FS.toFixed(2)+' < '+reqG+' — ลึกสุด '+fmt(-r.gslip.deep,2)+' ม.ใต้ระดับขุด (ปลายเข็ม '+fmt(D,2)+' ม.) · <b>เสาเข็มพืดหยุดกลไกนี้ไม่ได้</b>'
          +((+_sF.phiF)===0?' · <b>ดินเหนียวไม่ระบายน้ำ: การเพิ่มระยะฝัง D ช่วยได้จำกัดแล้วอิ่มตัว</b> (วัดจริงในโมเมนต์ดินชั้นเดียว: D 2→12 ม. ให้ FS 0.87→1.03 แล้วนิ่ง — <u>ไปไม่ถึง 1.5</u>) → ต้องแก้ที่ดินหรือแรง ไม่ใช่ที่ความยาวเข็ม':'')
          +' · แก้: ปรับปรุงดินฐาน (c₂/φ₂) / ลดน้ำหนักจร q / ลดความสูงขุด H / berm หน้ากำแพง');
        warn.push('ℹ <b>เสถียรภาพรวมกำแพงเสาเข็มพืด</b> — คิดเฉพาะ<u>วงลึกที่ลอดใต้ปลายเข็ม</u> (วงตื้นกว่านั้นถือว่าเข็มยึดไว้) และ<u>ยังไม่นับแรงต้านของเข็มที่ตัดวง</u> = อนุรักษ์นิยม · FS='+r.gslip.FS.toFixed(2)+' (ลึกสุด '+fmt(-r.gslip.deep,2)+' ม. · ปลายเข็ม '+fmt(D,2)+' ม.)');
      }
      /* ★ ห้ามเงียบ: หาวงไม่ได้ = "ไม่ได้ตรวจ" ไม่ใช่ "ผ่าน" */
      if(!r.gslip)warn.push('⚠ <b>เสถียรภาพรวม: หาวงวิบัติวิกฤตไม่ได้</b> — <u>ถือว่ายังไม่ได้ตรวจ ไม่ใช่ผ่าน</u> · โปรดตรวจด้วยโปรแกรม slope stability เฉพาะทาง');
    }catch(e){ warn.push('⚠ <b>เสถียรภาพรวม: คำนวณไม่สำเร็จ</b> ('+(e&&e.message||'?')+') — ถือว่ายังไม่ได้ตรวจ ไม่ใช่ผ่าน'); }
  }
  r.qty=calcQtySoldier(r);
  return r;
}
function calcQtySoldier(r){
  const i=r.i, Lw=r.Lw, nP=r.nPile;
  const pileLen=r.Lt+0.3, lagArea=Lw*r.H, lagVol=lagArea*r.tLag;
  /* (ลบตัวแปรตาย lagSteel/steelPanel ออก — คูณ *0 ทิ้งไว้ตั้งแต่ต้น และไม่เคยถูกใช้ที่ไหนเลย) */
  // ปริมาณคร่าว ๆ
  const concPanel=lagVol;
  const bbs=[];
  bbs.push({mk:'P1',pos:'เสาเข็มตัวไอ (ตอก) มอก.396',size:0,secTag:'I-'+(r.ipSz||35),detail:'I-pile ×'+nP+' ต้น ยาว '+fmt(pileLen,2)+' ม.',len:pileLen,n:nP,kg:0,shape:'I',cat:'precast'});
  {const pWm=(r.lag?r.lag.plankW:0.30), tL=(r.lag?r.lag.tLag:0.05), nPlk2=Math.max(1,Math.round(r.H/pWm)), nBay2=Math.max(1,nP-1);
   const wkg=Math.round(2400*tL*0.78);   // นน.แผ่น/ม² โดยประมาณ (กลวง ~78% ของตัน)
   bbs.push({mk:'L1',pos:r.lag?r.lag.lagName:'แผ่นเสียบร่อง คสล.',size:0,secTag:fmt(tL*100,0)+'×'+fmt(pWm*100,0)+' ซม.',detail:fmt(tL*100,0)+'×'+fmt(pWm*100,0)+' ซม. · fc≥350 ksc · '+(r.lag?r.lag.pcWire:'ลวด PC')+(r.lag&&r.lag.drained?' · ท่อ PVC สีฟ้า Ø2″ 2 ท่อ/แผ่น':''),len:r.S,n:nPlk2*nBay2,kg:wkg*r.S*pWm*nPlk2*nBay2,shape:'HC',cat:'precast'});}
  const conc={'แผ่นเสียบร่อง':concPanel};
  /* ★ SSOT ปลอก (ผูกเหล็ก) — ใช้ตัวเดียวกันทุกคาน (RB1·RB2·RB3·B1) ห้ามก๊อปสูตร
     ปลอกปิดขอ 135° · ขาวัดถึง "ขอบนอกปลอก" ตามธรรมเนียม BBS ไทย/EIT · รูปดัด SH51
     ความยาวตัด = 2(a+b) + 2·hook135 — ไม่หักระยะดัด (bend deduction) = อนุรักษ์นิยมทางสั่งซื้อ
     ★ ทำไมต้องมีแถวนี้: capD/stay นับกำลังเฉือนจากปลอก (φVn = φVc + V_sd) → ถ้าปลอกไม่อยู่ใน BBS
       ช่างสร้างได้คานไม่มีปลอก แต่รายการคำนวณบอกผ่าน = บั๊กเดียวกับ build 150 (ดู criteria-must-match-deliverable) */
  const tieRow=(mk,pos,bw,bh,cov,linkDb,linkSp,nBeam,Lbeam,note)=>{
    if(!(linkDb>0&&linkSp>0&&bw>0&&bh>0))return null;
    const RRl=rebarRules(linkDb,i.fc,i.fy);
    const ta=Math.max(bw-2*cov,0.05), tb=Math.max(bh-2*cov,0.05);       // ขนาดนอกปลอก (ม.)
    const len=2*(ta+tb)+2*RRl.hook135m;                                  // ความยาวตัด/เส้น (ม.)
    const n=Math.max(1,(Math.floor(Lbeam/(linkSp/1000))+1))*Math.max(1,nBeam);
    return {mk,pos,size:linkDb,
      detail:'ปลอกปิด ขอ 135° @'+linkSp+' มม. · นอก '+Math.round(ta*100)+'×'+Math.round(tb*100)+' ซม.'+(note?' · '+note:''),
      len,n,kg:len*n*KGM[linkDb],shape:'stir',bend:{type:'stir',a:ta,b:tb,c:RRl.hook135m,code:'51'}};
  };
  // คานรัด/คานหัวเข็ม RB1·RB2·RB3 (แยกออกแบบต่อระดับ) — จากโมดูล capD.beams · ทุกระบบ soldier
  {const cb=r.capD; if(cb){const beams=(cb.beams||[cb]).filter(b=>b.present!==false); let concCap=0;
    const lvName={RB1:'คานรัดหัวเข็ม (บนสุด)',RB2:'คานสเตย์/waler @a',RB3:'คานรัดล่าง'};
    beams.forEach(b=>{const nb=(b.nTop||0)+(b.nBot||0);
      bbs.push({mk:b.name||'RB',pos:(lvName[b.name]||'คานรัด')+' ตามแนวยาว',size:b.db,detail:Math.round(b.bw*100)+'×'+Math.round(b.bh*100)+' ซม. · บน '+b.nTop+'+ล่าง '+b.nBot+'-DB'+b.db+' + ปลอก '+b.linkBar+(b.secMan||b.stMan?' (กำหนดเอง)':''),len:Lw,n:nb,kg:Lw*nb*KGM[b.db],shape:'S'});   // ★ n = จำนวนเส้น (เดิม n:1 = จำนวนคาน → แถว BBS ขัดกันเอง: 12ม.×1.578 ≠ 189 · ใบสั่งซื้อขาด 10 เท่า) · kg เท่าเดิม (BARS/1e6*7850 ≡ KGM)
      {const tr=tieRow((b.name||'RB')+'s',(lvName[b.name]||'คานรัด')+' — ปลอกผูก',b.bw,b.bh,b.covCap||0.05,b.linkDb,b.linkSp,1,Lw);
       if(tr)bbs.push(tr);}                                        // ★ ปลอกที่ capD นับเป็นกำลัง (V_sd) ต้องมีตัวตนใน BBS
      concCap+=b.bw*b.bh*Lw;});
    conc['คานรัด RB1–RB'+(cb.nLv||2)]=concCap;}}
  /* V-stay reinforced-concrete members belong only to the stay/uplift-pile
     system.  Ground anchor uses tendon + grout bond and must not inherit
     B1/B1s/AP/APd from the mutually exclusive V-stay branch.  The 2D and 3D
     model builders already make this distinction; keep BBS/BOQ on the same
     Engineering SSOT contract. */
  if(r.tie&&r.stay&&r.SS!=='anchor'){const nFront=Math.max(2,Math.round(Lw/r.S)+1), nStay=nFront, nAnchor=Math.ceil(nFront/2);  // 1 สเตย์/เข็มหน้า · สมอ V 1 ต้น/คู่
    const Lstay=r.stay.Lb/Math.max(Math.cos(r.stay.thetaPlan),0.3)+0.5;
    const Ld40s=Math.max(40*r.stay.db/1000,0.40);   // ระยะพัฒนากำลัง 90° ทั้งสองปลาย: ฝั่งกำแพงล้วงคาน waler · ฝั่งสมอฝังยึด pile cap = 40·db
    bbs.push({mk:'B1',pos:'คานสเตย์ยึดรั้ง (V · 1 แนว/เข็มหน้า)',size:r.stay.db,detail:(r.stay.bw*100)+'×'+(r.stay.bh*100)+' ซม. '+r.stay.nBr+'-DB'+r.stay.db+' + ปลอก '+r.stay.linkBar+' ×'+nStay+' เส้น · ดัด 90° 2 ปลาย (waler+สมอ) 40db',len:Lstay,n:r.stay.nBr*nStay,kg:Lstay*r.stay.nBr*nStay*KGM[r.stay.db],shape:'U',bend:{type:'U',a:Math.max(Lstay-2*Ld40s,0.1),b:Ld40s,code:'21'}});
    {const apL=(r.stay&&r.stay.ancLe)?r.stay.ancLe:(r.Lt+0.3);   // ยาวเข็มสมอตามค่าจริง (สั้นกว่าเข็มหลักได้)
     const _apsz=(r.stay&&r.stay.anchorPile)?r.stay.anchorPile.sz:'', _apd=(r.stay&&r.stay.anchorPile&&r.stay.anchorPile.dowel)?r.stay.anchorPile.dowel:null;
     bbs.push({mk:'AP',pos:'เสาเข็มสมอ uplift (V 1 ต้น/คู่)',size:0,secTag:'I-'+_apsz,detail:'เข็ม I-'+_apsz+' ยาว '+fmt(apL,1)+' ม. ×'+nAnchor+' ต้น'+(r.stay&&r.stay.ancLeMan?' (กำหนดเอง)':'')+((r.stay&&r.stay.anchorPile&&!r.stay.anchorPile.same)?' · หน้าตัดแยกจากเข็มกันดิน':''),len:apL,n:nAnchor,kg:0,shape:'I',cat:'precast'});
     if(_apd){const _pcw=_apd.mode==='pcwire', _apdD=_pcw?_apd.pc.dia:_apd.db, _apdL=_apd.ldCap+_apd.ldPile, _apdN=nAnchor*_apd.nBar,
       /* ลวด PC = ลวดกลม → นน./ม. = ¼πd²·7850 (KGM มีแต่เหล็กข้ออ้อย 6–32 · Ø4/5/7 จะได้ undefined→NaN)
          เดิมแถวนี้ kg:0 → เหล็กเดือยรับแรงถอนหายจาก BOQ ทั้งก้อน */
       _apdKg=(_pcw?Math.PI/4*Math.pow(_apdD/1000,2)*7850:(KGM[_apdD]||0))*_apdL*_apdN;
     bbs.push({mk:'APd',pos:'เดือย dowel เข็มสมอ↔pile cap (รับแรงถอน)',size:_pcw?0:_apdD,secTag:_pcw?('ลวด PC Ø'+_apdD):null,kgOwn:_apdKg,detail:_apd.spec+'/ต้น · '+(_apd.mode==='pcwire'?'เผยลวด PC + สมอปลาย':'เจาะฝังอีพ็อกซี/หล่อ')+' · ล้วงเข้า cap ≥'+fmt(_apd.ldCap,2)+' ม.(ขอ 90°) · เข้าเข็ม ≥'+fmt(_apd.ldPile,2)+' ม.',len:_apdL,n:_apdN,kg:_apdKg,shape:'dowel'});}}
    {const tr=tieRow('B1s','คานสเตย์ยึดรั้ง — ปลอกผูก',r.stay.bw,r.stay.bh,(i.cov||50)/1000,r.stay.linkDb,r.stay.linkSp,nStay,Lstay,nStay+' คาน');
     if(tr)bbs.push(tr);}
    conc['คานสเตย์ (V)']=r.stay.bw*r.stay.bh*Lstay*nStay;}
  /* ★ steelKg = "เหล็กเส้นจริง" เท่านั้น — ห้ามรวมของหล่อสำเร็จ (cat:'precast')
     บั๊กเดิม (พบ+แก้ 2569-07): reduce รวมทุกแถวไม่เลือก → แถว L1 (แผ่นเสียบร่อง คสล.) มี kg = น้ำหนัก
     "คอนกรีต" ของแผ่น (2400×t×0.78×…) = 4,399 กก. ถูกนับเป็นเหล็ก → steelKg 5,716 ทั้งที่เหล็กจริง 964 กก.
     = ถอดแบบเหล็กเกินจริง 493% · แยก precastKg ออกมารายงานต่างหาก (เป็นของที่ต้องสั่งจริง แค่คนละหมวด) */
  const steelKg=bbs.filter(b=>b.cat!=='precast').reduce((a,b)=>a+b.kg,0)*1.08;
  const precastKg=bbs.filter(b=>b.cat==='precast').reduce((a,b)=>a+b.kg,0);
  const concTot=Object.values(conc).reduce((a,b)=>a+b,0);
  return {bbs,conc,concTot,form:lagArea*2,lean:0,steelKg,precastKg,nBut:0,nPile:nP,soldier:true};
}
/* ============================================================
   REBAR DETAILING RULES — single source of truth (ACI 318-14 Ch.25 / มยผ.1103)
   คืนค่าเป็น "มม." (ldh/lap/hook…) + สำเนา "เมตร" (…m) เพื่อใช้ในโค้ดวาด
   ใช้เหมือนกันทุกฟังก์ชัน (drawSecD / drawSecB / buildRebar(Cant) / dwgDetails / calcQty)
   ============================================================ */
/* callout เหล็กสไตล์แบบต้นฉบับ AutoCAD: "DB12 (SD40) @0.25 ม." */
function rebarRules(db,fc,fy){
  db=+db||12;
  const ld =Math.max(40*db,300);            // §25.4.2 ระยะฝังยึดแรงดึง (ตรง) — เชิงปฏิบัติ 40db
  const ldh=Math.max(20*db,8*db,150);       // §25.4.3 ระยะฝังยึดปลายของอ
  const lap=Math.max(52*db,300);            // ต่อทาบแรงดึง Class B = 1.3·ld ≈ 52db
  const hook90=12*db, hook135=Math.max(6*db,75), hook180=Math.max(4*db,65);
  const bendDia=(db<=25?6:8)*db, tieBendDia=(db<=16?4:6)*db;   // หลัก 6/8db · ปลอก 4/6db
  return {db,ld,ldh,lap,hook90,hook135,hook180,bendDia,tieBendDia,
    ldm:ld/1000,ldhm:ldh/1000,lapm:lap/1000,
    hook90m:hook90/1000,hook135m:hook135/1000,hook180m:hook180/1000,
    bendDiam:bendDia/1000,bendRm:bendDia/2000,tieBendRm:tieBendDia/2000};
}
/* ============================================================
   QUANTITIES — BBS + BOQ (per total wall length Lw)
   ============================================================ */
function calcQty(r){
  const {i,mode,heel}=r,{hp,hz,t,B,toe,L,bs,Lw}=i,db=r.db;
  const CS=constructionSpec(r);
  const tAvg=r.tapered?(t+r.tTop)/2:t;   // ความหนาเฉลี่ยผนัง (ผนังสอบ) สำหรับปริมาตรคอนกรีต
  const RR=rebarRules(db,i.fc,i.fy), hook=RR.hook90m, ld=RR.ldm, lap=RR.lapm;   // ดีเทลศูนย์เดียว (rebarRules)
  const bbs=[];
  const add=(mk,pos,size,detail,len,n,shape,bend)=>{n=Math.max(Math.ceil(n),0);
    bbs.push({mk,pos,size,detail,len,n,kg:len*n*KGM[size],shape,bend});};
  if(mode==='but'){
    const nBut=Math.max(2,Math.floor(Lw/(L+bs))+1);
    const cfLr=r.cfLr||heel, cfHr=r.cfHr||hp;     // ความยาว/สูงครีบจริง (auto=heel/hp)
    let kgH1=0,kgH2=0;
    const dbS_=r.strips[r.strips.length-1].b_.db, dbS$=r.strips[r.strips.length-1].b$.db;
    r.strips.forEach(s=>{kgH1+=(s.z2-s.z1)*(1000/s.b_.s)*(KGM[s.b_.db]/KGM[dbS_]);kgH2+=(s.z2-s.z1)*(1000/s.b$.s)*(KGM[s.b$.db]/KGM[dbS$]);});
    add('①a','เหล็กราบพนัง หน้าดิน (ที่ครีบ)',dbS_,'@'+r.strips[0].b_.s+'–'+r.strips[r.strips.length-1].b_.s+' (ถี่ลงล่าง) · ของอปลาย 2 ข้าง',Lw+2*hook,kgH1,'hookB',{type:'hookB',a:Lw,b:hook,code:'37'});
    add('①b','เหล็กราบพนัง หน้านอก (กลางช่วง)',dbS$,'@'+r.strips[0].b$.s+'–'+r.strips[r.strips.length-1].b$.s+' · ของอปลาย 2 ข้าง',Lw+2*hook,kgH2,'hookB',{type:'hookB',a:Lw,b:hook,code:'37'});
    const s2=Math.min(Math.floor(1000*BARS[12]/(0.0009*t*1e6)/25)*25,300);
    const RR12=rebarRules(12,i.fc,i.fy);
    add('②','เหล็กตั้งพนัง 2 หน้า (เดือย+ทาบ Class B · ยอดตรง)',12,'@'+s2,hp+RR12.hook90m+RR12.lapm,2*Lw*1000/s2,'L',{type:'L',a:hp+RR12.lapm,b:RR12.hook90m,code:'13'});
    {const hkH3=rebarRules(r.barH_.db,i.fc,i.fy).hook90m;
     add('③','เหล็กบนฐานหลัง (แถบเหนือครีบ 0.3L ข้างละ · ปลายงอลง)',r.barH_.db,'@'+r.barH_.s+' ×'+nBut+' แถบ · ของอ '+fmt(hkH3,2)+' ม.',bs+0.6*L+2*hkH3,(heel*1000/r.barH_.s)*nBut,'U',{type:'U',a:bs+0.6*L,b:hkH3,code:'21'});}
    add('④','เหล็กล่างฐานหลัง',r.barH$.db,'@'+r.barH$.s,Lw,heel*1000/r.barH$.s,'S',{type:'straight',a:Lw,code:'00'});
    add('⑤','เหล็กล่างฐานหน้า (ตามขวาง)',r.barT.db,'@'+r.barT.s,toe+t+ld+0.3,Lw*1000/r.barT.s,'L',{type:'L',a:toe+t+0.3,b:ld,code:'13'});
    const slope=Math.hypot(cfLr,cfHr);
    const ldC6=Math.max(40*(r.but.barSize||25)/1000,0.45), ld45C6=Math.max(45*(r.but.barSize||25)/1000,0.9);
    /* ★ แยก "ยาวตลอด" / "Cutoff" ตาม r.but.finCut — เดิม BBS คิดยาวเต็มสโลปทุกเส้น แต่แบบโชว์ครึ่งหนึ่งตัด → ปริมาณ≠รูป (ผิด SSOT) */
    const fcB=r.but.finCut, dbB6=(r.but.barSize||25), preB6=(r.but.barPre||'DB');
    const nFulB6=fcB?fcB.nFul:r.but.nB25, nCutB6=fcB?fcB.nCut:0;
    add('⑥','เหล็กหลักครีบ — ยาวตลอด (ยอดล้วงเข้าผนัง ≥ ld · ล่างตามท้องฐาน ≥45db)',dbB6,nFulB6+'-'+preB6+dbB6+'/ครีบ ×'+nBut,slope+ldC6+ld45C6,nFulB6*nBut,'cog',{type:'cog',a:ldC6,b:slope,c:ld45C6,code:'21'});
    if(nCutB6>0){const slCut=slope*fcB.frac;                    // ยาวตามสโลปถึงระดับตัดจริง + ยึดล่าง (ไม่มี ld บนเพราะถูกตัด)
      add('⑥b','เหล็กหลักครีบ — Cutoff ตัดที่ '+fmt(fcB.cutLen,2)+' ม. เหนือฐาน ('+fmt(fcB.frac*100,0)+'% H · ACI 9.7.3.3)',dbB6,nCutB6+'-'+preB6+dbB6+'/ครีบ ×'+nBut,slCut+ld45C6,nCutB6*nBut,'L',{type:'L',a:slCut,b:ld45C6,code:'13'});}
    {const hkFT=rebarRules(r.barFT.db,i.fc,i.fy).hook90m;
     add('⑧','เหล็กตามขวางฐาน (ตั้งฉากกำแพง · บน+ล่าง)',r.barFT.db,'@'+r.barFT.s+' · ของอปลาย 2 ข้าง '+fmt(hkFT,2)+' ม.',B+2*hkFT,2*Lw*1000/r.barFT.s,'hookB',{type:'hookB',a:B,b:hkFT,code:'37'});}
    const sTh=pickBar(r.but.AsTh,12,250).s, sTv=pickBar(r.but.AsTv,12,250).s;
    add('⑦a','U-tie ราบ (พนัง↔ครีบ)',12,'@'+sTh+'/ครีบ ×'+nBut,2*(t+cfLr*0.45)+bs,nBut*cfHr*1000/sTh,'U',{type:'U',a:bs,b:t+cfLr*0.45,code:'21'});
    add('⑦b','U-tie ดิ่ง (ฐาน↔ครีบ)',12,'@'+sTv+'/ครีบ ×'+nBut,2*(hz+cfHr*0.3)+bs,nBut*cfLr*1000/sTv,'U',{type:'U',a:bs,b:hz+cfHr*0.3,code:'21'});
    var conc={'ฐานราก':B*hz*Lw,'พนัง':tAvg*hp*Lw,'ครีบ':0.5*cfLr*cfHr*bs*nBut};
    var form=2*hp*Lw+2*hz*(Lw+B)+nBut*(cfLr*cfHr+bs*Math.hypot(cfLr,cfHr));
    var nButOut=nBut;
  }else{
    const bV=r.stemTab[3].bar, RRv=rebarRules(bV.db,i.fc,i.fy), hkV=RRv.hook90m, ldV=RRv.ldm, lapV=RRv.lapm;
    add('①','เหล็กตั้งหลัก หน้าดิน (เดือย+ทาบ Class B · ยอดตรง)',bV.db,'@'+bV.s,hp+hkV+lapV,Lw*1000/bV.s,'L',{type:'L',a:hp+lapV,b:hkV,code:'13'});
    const AsVf=0.0012*t*1e6, sVf=pickBar(AsVf,12).s;
    add('②','เหล็กตั้งหน้านอก',12,'@'+sVf,hp+ld+hook,Lw*1000/sVf,'cog',{type:'cog',a:ld,b:hp,c:hook,code:'21'});
    const AsHf=0.002*t*1e6/2, sHf=pickBar(AsHf,12).s;
    add('③','เหล็กราบพนัง 2 หน้า',12,'@'+sHf+' · ของอปลาย 2 ข้าง',Lw+2*hook,2*hp*1000/sHf,'hookB',{type:'hookB',a:Lw,b:hook,code:'37'});
    add('④','เหล็กบนฐานหลัง (ตามขวาง)',r.barH_.db,'@'+r.barH_.s,heel+ld+0.3,Lw*1000/r.barH_.s,'L',{type:'L',a:heel+0.3,b:ld,code:'13'});
    add('⑤','เหล็กล่างฐานหน้า (ตามขวาง)',r.barT.db,'@'+r.barT.s,toe+t+ld+0.3,Lw*1000/r.barT.s,'L',{type:'L',a:toe+t+0.3,b:ld,code:'13'});
    add('⑥','เหล็กกระจายฐาน บน+ล่าง (ขนานกำแพง)',12,'@250',Lw,2*Math.ceil(B/0.25),'S',{type:'straight',a:Lw,code:'00'});
    {const hkFT=rebarRules(r.barFT.db,i.fc,i.fy).hook90m;
     add('⑧','เหล็กตามขวางฐาน (ตั้งฉากกำแพง · บน+ล่าง)',r.barFT.db,'@'+r.barFT.s+' · ของอปลาย 2 ข้าง '+fmt(hkFT,2)+' ม.',B+2*hkFT,2*Lw*1000/r.barFT.s,'hookB',{type:'hookB',a:B,b:hkFT,code:'37'});}
    var conc={'ฐานราก':B*hz*Lw,'พนัง':tAvg*hp*Lw};
    var form=2*hp*Lw+2*hz*(Lw+B);
    var nButOut=0;
  }
  /* Shear key เป็นชิ้นส่วนร่วมทุกระบบฐานแผ่ — คอนกรีต/แบบหล่อ/K1 ต้องไม่หายเมื่อสลับ cant↔buttress */
  if(i.dk>0){
    conc['Shear key (d'+'k='+fmt(i.dk,2)+' ม.)']=t*i.dk*Lw;
    form+=2*i.dk*Lw;
    if(r.keyChk&&r.keyChk.bar){const k=r.keyChk,b=k.bar;
      add('K1','เหล็กหลัก Shear key รูป U ขาลง 2 หน้า + ปีกบนฝังฐาน',b.db,
        '@'+b.s+' ตามยาวกำแพง · A_s '+fmt(k.AsKprov,0)+' ≥ '+fmt(k.AsKreq,0)+' มม²/ม. · cover ดิน 75 มม. · ของอ 90° '+fmt(k.hook,2)+' ม.',
        k.cutLen,k.n,'keyU',{type:'keyU',a:k.clearWidth,b:k.leg,c:k.hook});
    }
  }
  /* Ⓟ เหล็กเดือยหัวเสาเข็ม (กำแพงวางบนเสาเข็ม — ทั้งคานยื่น/ครีบ): 4-DB12/ต้น ฝังเข็ม 0.45 + ล้วงเข้าฐาน + ของอ 90° */
  let nPileOut=0;
  if(r.onPile&&r.pile){
    const nPT=Math.max(1,Math.round(Lw/Math.max(r.pile.sT||2,0.6)))+1, nPH=Math.max(1,Math.round(Lw/Math.max(r.pile.sH||2,0.6)))+1;
    nPileOut=nPT+nPH;
    const dw=dowelSpec(i), RD=rebarRules(dw.db,i.fc,i.fy), lenD=Math.max(1.50,0.45+Math.min(hz-0.06,0.08+RD.ldm)+RD.hook90m);   // เดือย n-DBd/ต้น (กำหนดเองได้)
    add('Ⓟ','เหล็กเดือยหัวเสาเข็ม (โดยโรงงานเสาเข็ม · ยึดเข็ม↔ฐานราก)',dw.db,dw.txt+'/ต้น ×'+(nPT+nPH)+' ต้น · L≈'+fmt(lenD,2)+' ม.',lenD,dw.n*(nPT+nPH),'L',{type:'L',a:lenD-RD.hook90m,b:RD.hook90m,code:'13'});
  }
  const steelKg=bbs.reduce((a,b)=>a+b.kg,0)*1.08; // +8% laps/waste
  const concTot=Object.values(conc).reduce((a,b)=>a+b,0);
  const lean=(B+0.2)*CS.lean*Lw;
  return {bbs,conc,concTot,form,lean,steelKg,nBut:nButOut,nPile:nPileOut};
}
/* ============================================================
   RENDER
   ============================================================ */
/* ============================================================
   INDEPENDENT VALIDATION LAB — Worked Examples + B2–B4 + identities/mutation
   แต่ละ benchmark ใช้ tolerance ที่ระบุ · กู้คืน state เดิมหลังตรวจ (getState/setState)
   ============================================================ */
function _chk(label, actual, expected, opt){
  opt=opt||{}; const t=opt.tol!=null?opt.tol:0.02;
  let ok, disp;
  if(opt.type==='min'){ ok=actual>=expected; disp=fmt(actual,2)+' ≥ '+expected; }
  else if(opt.type==='flag'){ ok=(!!actual)===(!!expected); disp=(actual?'ใช่':'ไม่'); }
  else if(opt.type==='range'){ ok=actual>=expected[0]&&actual<=expected[1]; disp=fmt(actual,2)+' ∈ ['+expected[0]+', '+expected[1]+']'; }
  else if(opt.type==='info'){ ok=null; disp=(typeof actual==='number'?fmt(actual,opt.dec!=null?opt.dec:1):actual); }
  else { const err=Math.abs(actual-expected)/Math.max(Math.abs(expected),1e-9);
         ok=err<=t; disp=fmt(actual,3)+' <span style="color:var(--muted)">(เป้า '+expected+' · Δ'+(err*100).toFixed(2)+'%)</span>'; }
  return {label, ok, disp, unit:opt.unit||''};
}
/* BUILD 166 · independent public benchmarks (pure — ไม่มี DOM/calc state)
   B2: FHWA/USACE Coulomb + สมดุล gravity reference
   B3: FHWA-NHI-04-043 Design Step 4 (RC rectangular section)
   B4: FHWA NHI-01-094 Eq.5-7/5-8 + USACE EM 1110-1-1905 (Vesic bearing factors) */
function validation166Pure(){
  const out=[];
  const kg=gravityCoulombRef({H:6,B:3.6,top:0.6,gamma:18,gc:24,q:10,phi:32,beta:10,delta:20,theta:0,mu:0.55});
  const kr=kaRankine(30,0),kc0=kaCoulomb(30,0,0,0),kg0=gravityCoulombRef({H:6,B:3.6,top:0.6,gamma:18,gc:24,q:0,phi:32,beta:10,delta:20,theta:0,mu:0.55});
  out.push({name:'B2 · Coulomb + gravity reference (FHWA/USACE)',kind:'bench166',note:
    'oracle สมดุลแยกจาก production calc() · FHWA NHI-01-094 Eq.6-2 และ USACE EM 1110-2-2502 §3-5 · ใช้ hard anchor ที่คำนวณมือ ไม่อ่านผลจากหน้าจอ',checks:[
    _chk('K_a Coulomb (φ32 β10 δ20 θ0)',kg?kg.Ka:0,0.312567894,{tol:1e-6}),
    _chk('ขอบเขต δ=β=θ=0: Coulomb ≡ Rankine (φ30)',kc0,kr,{tol:1e-9}),
    _chk('แรงราบ P_h รวมดิน+surcharge',kg?kg.Ph:0,112.787613,{tol:1e-6,unit:'kN/ม.'}),
    _chk('แรงดิ่งจาก wall friction P_v',kg?kg.Pv:0,41.051334,{tol:1e-6,unit:'kN/ม.'}),
    _chk('โมเมนต์พลิกคว่ำรอบ toe',kg?kg.Mo:0,243.198291,{tol:1e-6,unit:'kN·m/ม.'}),
    _chk('FS_overturning ของ reference wall',kg?kg.FSot:0,3.55637697,{tol:1e-6}),
    _chk('FS_sliding ของ reference wall',kg?kg.FSsl:0,1.67481364,{tol:1e-6}),
    _chk('q=0 ต้องลดแรง/โมเมนต์ขับ',kg&&kg0&&kg.Ph>kg0.Ph&&kg.Mo>kg0.Mo?1:0,1,{type:'flag'})
  ]});
  const oldCode=DCODE;let as=NaN;
  try{DCODE='aci318';as=asReq(1.5117370124,0.0254,0.157226,27.57902917,413.68543759);}finally{DCODE=oldCode;}
  const fc=27.57902917,fy=413.68543759,b=25.4,d=157.226,phi=0.9;
  const a=as*fy/(0.85*fc*b),phiMn=phi*as*fy*(d-a/2)/1e6,rho=as/(b*d);
  out.push({name:'B3 · RC flexure worked example (FHWA-NHI-04-043)',kind:'bench166',note:
    'Design Step 4 หน้า 4-10: f′c=4 ksi · fy=60 ksi · d=6.19 in · Mu=13.38 kip-in ต่อแถบ 1 in · ค่าตำรา As=0.0426 in²/in',checks:[
    _chk('A_s ต้องการ = 0.0426 in² ต่อแถบ 1 in',as,27.495249,{tol:0.001,unit:'mm² (= 0.042618 in²)'}),
    _chk('ρ = 0.00688 ตาม worked example',rho,0.00688493,{tol:0.001}),
    _chk('back-substitution: φM_n ≡ M_u',phiMn,1.5117370124,{tol:1e-9,unit:'kN·m'}),
    _chk('Mu=0 → As=0 (ค่าขอบ)',asReq(0,1,0.3,28,420),0,{tol:1e-12})
  ]});
  const b30=bearingCap(0,30,18,0,2,0,0,false),b0=bearingCap(40,0,18,1,2,0,0,true),bi=bearingCap(0,30,18,0,2,100,200,false);
  out.push({name:'B4 · Strip-footing bearing (FHWA/USACE)',kind:'bench166',note:
    'FHWA NHI-01-094 Eq.5-7/5-8: q_ult=cNc+γDfNq+½γBNγ และ Nγ=2(Nq+1)tanφ · ตรวจตาราง φ=0/30 พร้อม inclination',checks:[
    _chk('φ30 → N_q = 18.401',b30.Nq,18.40112222,{tol:1e-6}),
    _chk('φ30 → N_c = 30.140',b30.Nc,30.13962779,{tol:1e-6}),
    _chk('φ30 → N_γ = 22.402',b30.Ng,22.40248627,{tol:1e-6}),
    _chk('ผิวดิน: q_ult = ½γBNγ = 403.245',b30.qult,403.24475288,{tol:1e-6,unit:'kPa'}),
    _chk('φ=0: Nc/Nq/Nγ = 5.14/1/0',Math.abs(b0.Nc-5.14)<1e-9&&Math.abs(b0.Nq-1)<1e-9&&Math.abs(b0.Ng)<1e-9?1:0,1,{type:'flag'}),
    _chk('ดินเหนียว φ0: q_ult = cNc·dc + γDfNq',b0.qult,264.72,{tol:1e-9,unit:'kPa'}),
    _chk('q_allow = 0.33 q_ult (ไม่ใช่ ÷3)',b30.qall,b30.qult*0.33,{tol:1e-9}),
    _chk('แรงเอียงต้องลด bearing capacity',bi.qult<b30.qult?1:0,1,{type:'flag'})
  ]});
  return out;
}
/* ★ ทะเบียนเกณฑ์ตรวจ — แยกออกจาก render() เพื่อให้ "ตัวแนะนำค่า" (suggestFix) ประเมินตัวเลือกซ้ำ ๆ ได้
   โดยใช้เกณฑ์ "ชุดเดียวกันเป๊ะ" กับที่แสดงบนจอ → ค่าที่แนะนำจะขัดกับผลที่โชว์ไม่ได้
   (เดิมอยู่ใน render() → ถ้าตัวแก้เขียนเกณฑ์เองจะกลายเป็น drift คลาสเดียวกับที่ไล่มาทั้งชุด) */
function buildChecks(r){
  const {i}=r;
  const secBad=(r.strips&&r.strips.some(s=>s.bad))||(r.stemTab&&r.stemTab.some(s=>s.bad));
  const srStem=shearDesign(r.VuS,1,r.dS,i.fc,i.fy);   // ออกแบบเหล็กปลอกตามต้องการ
  const srHeel=shearDesign(r.VuH,1,r.dH,i.fc,i.fy);
  const srToe =shearDesign(r.VuT,1,r.dT,i.fc,i.fy);
  r.srStem=srStem;r.srHeel=srHeel;r.srToe=srToe;
  const checks=[
    r.onPile
     ?{k:'PILE ถอน/พลิกคว่ำ',v:r.pile.tension?('แรงถอน '+fmt(-r.pile.Rmin,1)+' ตัน'):('ไม่ถอน Rmin '+fmt(r.pile.Rmin,1)),req:r.pile.tension?('≤ กำลังถอน '+fmt(r.pile.tenCap,1)+' ตัน'+(r.i.pileTen>0?' (กำหนดเอง)':' (~0.3Pa)')):'OK (ไม่มีแรงถอน)',ok:!r.pile.tension||(-r.pile.Rmin<=r.pile.tenCap),u:r.pile.tension?(-r.pile.Rmin/Math.max(r.pile.tenCap,1e-6)):0.25,
       fix:'พลิกคว่ำต้านด้วยคู่แรงเสาเข็ม (toe อัด/heel ดึง) — หากแรงถอนเกิน ใช้เสาเข็มรับแรงดึง/สมอ หรือขยายฐาน',to:['pileTen','pileSt','pileEdH','heel']}
     :{k:'F.S. OVERTURNING',v:fsFmt(r.FSot),req:'≥ '+FSREQ.ot.toFixed(1),ok:r.FSot>=FSREQ.ot,u:FSREQ.ot/Math.max(r.FSot,.01),
       fix:'เพิ่มความกว้างฐาน B (ด้าน heel), เพิ่มความหนาฐาน hz หรือลดความชัน β',to:['heel','toe','hz','beta']},
    r.onPile
     ?{k:'PILE แรงราบ · batter',v:fmt(r.pile.hcap,1)+' ตัน/ม.',req:'≥ Rh = '+fmt(r.pile.Rh,1)+(r.pile.btTdeg>0?' (toe batter '+fmt(r.pile.btTdeg,0)+'°)':' (ยังไม่ได้เอียง)'),ok:r.pile.hOK,u:r.pile.Rh/Math.max(r.pile.hcap,1e-6),
       fix:'แรงราบต้านด้วย เสาเข็ม toe เอียง batter (P·sinβ) + กำลังต้านราบต่อต้น — เพิ่มมุม batter / เพิ่ม Hlat (Broms) / ลดระยะเรียง S',to:['pileBatT','pileLat','pileSt','pileSh']}
     :{k:'F.S. SLIDING',v:fsFmt(r.FSsl),req:'≥ '+FSREQ.sl.toFixed(1),ok:r.FSsl>=FSREQ.sl,u:FSREQ.sl/Math.max(r.FSsl,.01),
       fix:(r.i.usePp
      ? 'เพิ่ม Shear key (dk) / เพิ่มระยะฝัง Df / ขยายส้น heel (แรงเสียดทานฐานเพิ่มตาม ΣV)'
      : '<b>ยังไม่นับ Passive</b> (ติ๊ก "ใช้แรงดัน Passive") — <u>ตราบใดที่ยังไม่เปิด การเพิ่ม dk/Df จะไม่ช่วยเลย</u> เพราะทั้งคู่ทำงานผ่าน passive · ทางที่ได้ผลตอนนี้: <b>ขยายส้น heel</b> (เพิ่มแรงเสียดทานฐาน)')
     +' · ถ้าดินหน้ากำแพงอาจถูกขุดออกภายหลัง (ท่อ/ถนน) → ควรปิด passive แล้วขยายฐานแทน',
    to:(r.i.usePp?['dk','Df','heel','toe']:['heel','usePp','toe'])},
    r.onPile
     ?{k:'PILE แกน toe/heel',v:fmt(r.pile.axT,1)+' / '+fmt(r.pile.axH,1)+' ตัน',req:'≤ Pa = '+fmt(r.pile.Pa,0)+' (ratio '+fmt(r.pile.ratT,2)+'/'+fmt(r.pile.ratH,2)+')',ok:r.pile.ratT<=1&&r.pile.ratH<=1&&!r.pile.tension,u:Math.max(r.pile.ratT,r.pile.ratH),
       fix:'แกน/ต้น = Rv/N + Mcg·arm/Ix (toe หาร cosβ) — เพิ่มกำลังเสาเข็ม Pa, ลดระยะ S, เพิ่มแถว/ขยายฐาน'+(r.pile.tension?' · ⚠ แถวหลังมีแรงถอน (Rmin<0) ต้องเสาเข็มรับแรงดึง/สมอ':''),to:['Ppile','pileSt','pileSh','heel']}
     :{k:'BEARING q,max',
       v:(r.bcap?fP(r.qmaxEff,1):fP(r.q1,1))+' '+UL().P+(r.bcap?(' (B′='+fmt(r.Bpeff,2)+'m)'):''),
       req:r.bcap?('≤ qa,ดิน='+fP(r.bcap.qall,1)+' · FoS='+fmt(r.FoSbear,2)+'≥3'):('≤ qa = '+fP(i.qa,1)+' (FoS≥3.0)'),
       ok:r.bcap?(r.qmaxEff<=r.bcap.qall):(r.q1<=i.qa&&r.q2>=-0.01),
       u:r.bcap?(3/Math.max(r.FoSbear,.01)):(r.q1/i.qa),
       fix:'เพิ่ม B หรือ toe (ลดแรงดันสูงสุด), ปรับปรุงกำลังดินฐานราก, หรือลดความสูงดินถม'+(QASRC==='code'?' · โหมดกฎกระทรวงล็อก q_a ตามหมวดข้อ 7 — ถ้ามีผลเจาะจริงให้สลับไปโหมด ①':''),to:['toe','heel','qaSrc','qaClass','qa']},
    {k:'ECCENTRICITY e',v:fmt(r.e,3)+' m',req:r.onPile?'เสาเข็มหลังรับแรงดึงได้':'≤ B/6 = '+fmt(r.kern,3),ok:r.onPile?true:Math.abs(r.e)<=r.kern,u:r.onPile?Math.min(Math.abs(r.e)/r.kern,0.6):Math.abs(r.e)/r.kern,
     fix:r.onPile?'ระบบเสาเข็ม: ไม่จำกัด kern (เสาเข็มหลังรับแรงดึง) — ตรวจแรงถอนแทน':'เพิ่ม toe (ขยับแรงลัพธ์เข้ากลางฐาน) หรือเพิ่ม B',to:['toe','heel']},
    /* ★★ เกณฑ์เฉือนต้องอิง φVc (คอนกรีตล้วน) = "กำลังของสิ่งที่จะถูกสร้างจริง"
       🔴 บั๊กความปลอดภัย (พบ+แก้ 2569-07): เดิม ok/u อิง shearDesign() ที่ "ออกแบบเหล็กปลอกให้เอง"
          → การ์ดขึ้น "24.2 ตัน → RB10@100 · ผ่าน ✓" แต่ค้นทั้ง r.qty: **ไม่มี RB10 · ไม่มีคำว่าปลอก เลยสักแถว**
          → ช่างสร้างตาม BBS/แบบ จะได้ฐาน "ไม่มีปลอก" · Vu 237.6 > φVc 152.1 = เฉือนวิบัติเกิน 56% ทั้งที่แอปบอกผ่าน
       ต้นตอเชิงโครงสร้าง: calcQty รันใน calc() แต่ srHeel เกิดใน buildChecks() ตอน render → BBS ไม่มีทางรู้จักปลอก
       และส่วนอื่นของแอปใช้ Vu ≤ φVc อยู่แล้วทั้งหมด (strips.bad · stemBad · รายงาน "✗ เพิ่ม hz") → การ์ดเป็นตัวเดียวที่หลุดแนว
       ★ เกณฑ์ต้องสะท้อน "สิ่งที่จะถูกสร้าง" ไม่ใช่ "สิ่งที่คำนวณได้ถ้าใส่เหล็กที่ไม่มีในแบบ"
         (ถ้าวันหน้าใส่ปลอกลง BBS+แบบจริงแล้ว ค่อยเปิดให้ใช้ φVn — ดู ROADMAP) */
    {k:'SHEAR — STEM',v:fF(r.VuS,1)+' '+UL().F,req:'≤ φVc = '+fF(r.phiVcS,1)+' (คอนกรีตล้วน)',ok:r.VuS<=r.phiVcS,u:r.VuS/Math.max(r.phiVcS,1e-6),
     fix:'เพิ่มความหนาพนัง t'+(r.mode==='but'?' หรือลดระยะห่างครีบ L':'')+' หรือเพิ่ม f′c'+(srStem.need?(' · (ถ้าจะใช้เหล็กปลอกต้องใช้ '+srStem.stirrup+' — แต่แอปยังไม่ออกแบบ/ไม่ใส่ปลอกลง BBS และแบบก่อสร้าง จึงไม่นับเป็นกำลัง)'):''),to:(r.mode==='but'?['t','L','fc']:['t','fc'])},
    {k:'SHEAR — HEEL',v:fF(r.VuH,1)+' '+UL().F,req:'≤ φVc = '+fF(r.phiVcH,1)+' (คอนกรีตล้วน)',ok:r.VuH<=r.phiVcH,u:r.VuH/Math.max(r.phiVcH,1e-6),
     fix:'เพิ่มความหนาฐาน hz หรือเพิ่ม f′c'+(srHeel.need?(' · (ถ้าจะใช้เหล็กปลอกต้องใช้ '+srHeel.stirrup+' — แต่แอปยังไม่ออกแบบ/ไม่ใส่ปลอกลง BBS และแบบก่อสร้าง จึงไม่นับเป็นกำลัง)'):''),to:['hz','fc']},
  ];
  if(r.gravity){
    const dLim=i.phi/2, dOK=r.wallDeltaIn<=dLim+1e-9;
    checks.splice(2,0,
      {k:'COULOMB DOMAIN',v:'Ka = '+fmt(r.Ka,4)+' · δ '+fmt(r.wallDelta,1)+'° · θ '+fmt(r.wallTheta,1)+'°',req:'φ>β · สมการมีคำตอบจริง',ok:!!r.coulombOK,u:r.coulombOK?Math.min(r.Ka/0.5,0.85):1.2,
       fix:'ลด β/δ หรือปรับรูปทรงสอบให้มุม θ อยู่ในโดเมน Coulomb',to:['beta','wallDelta','t','ttop']},
      {k:'COULOMB APPLICABILITY',v:r.coulombApplicOK?'เงื่อนไขผิวดิน/น้ำอยู่ในโดเมน':'β>0 และระดับน้ำตัดกลาง backfill',req:'USACE §3-12: ผิวลาดต้องไม่มี WT ตัดกลางชั้น',ok:!!r.coulombApplicOK,u:r.coulombApplicOK?.45:1.2,
       fix:'ใช้ general wedge + seepage analysis หรือจัด load case น้ำอยู่เหนือ/ใต้ backfill ทั้งหมด; ถ้าผิวดินราบให้ตั้ง β=0 ตามจริง',to:['beta','zw']},
      {k:'WALL FRICTION δ',v:fmt(r.wallDeltaIn,1)+'°'+(dOK?'':' (engine จำกัด '+fmt(r.wallDelta,1)+'°)'),req:'≤ φ/2 = '+fmt(dLim,1)+'° · USACE §3-14',ok:dOK,u:r.wallDeltaIn/Math.max(dLim,1e-6),
       fix:'ใช้ δ จากข้อมูลรอยต่อดิน–คอนกรีตและไม่เกิน φ/2 ตาม USACE; ถ้าไม่มีผลทดสอบให้ลด δ',to:['wallDelta','phi']});
  }
  if(r.onPile&&r.pile.disp){const dC=r.pile.frame?r.pile.frame.dMaxMM:r.pile.disp.dMax, al=r.pile.disp.allow;
   checks.push({k:'การเคลื่อนตัว δ',v:fmt(dC,1)+' มม.'+(r.pile.frame?' (เชื่อมโยง)':''),req:'≤ L/300 = '+fmt(al,1)+' มม.',ok:dC<=al,u:dC/Math.max(al,1e-6),
     fix:'เพิ่มหน้าตัด/ความยาวเสาเข็ม, ลดระยะ S, หรือปรับชั้นดิน (สปริง k_h ต่อชั้น)',to:['pileB','pileEmb','pileSt']});}
  if(r.onPile&&r.pile.struct){const st=r.pile.struct;
   checks.push({k:'PILE เฉือน (หักปลาย?)',v:fF(st.VuP,2)+' '+UL().F,req:'≤ φVc = '+fF(st.phiVc,2),ok:st.VuOK,u:st.ratV,
     fix:'เสาเข็มเสี่ยงขาดด้วยแรงเฉือน — เพิ่มขนาดเข็ม / เพิ่มมุม batter (ลดแรงราบดัด) / ลดระยะเรียง S / เพิ่มกำลังต้านราบ',to:['pileB','pileBatT','pileSt']});
   checks.push({k:'PILE โมเมนต์ดัด',v:fM(st.MuP,2)+' '+UL().M,req:'≤ M_cr = '+fM(st.Mcr,2)+(st.fpe>0?' (f_pe '+fmt(st.fpe,1)+')':''),ok:st.McrOK,u:st.ratM,
     fix:'เกินโมเมนต์แตกร้าว — เพิ่มมุม batter (ลดแรงราบดัด) / เพิ่มขนาดเข็ม / ยืนยันกำลังดัดเข็มอัดแรงกับ catalog ผู้ผลิต',to:['pileBatT','pileB','pileSt']});
   checks.push({k:'เดือยหัวเข็ม (dowel)',v:st.dowel.n+'-DB'+st.dowel.db+' = '+fmt(st.dowel.Asprov,0)+' มม²',req:'≥ '+fmt(st.dowel.AsReq,0)+' มม²'+(st.dowel.Tup>0?' (ถอน '+fF(st.dowel.Tup,1)+')':' (โมเมนต์)'),ok:st.dowel.ok&&st.dowel.ldOK,u:st.dowel.AsReq/Math.max(st.dowel.Asprov,1e-6),
     fix:'เดือยยึดเข็ม↔แคปไม่พอ — เพิ่มจำนวน/ขนาดเดือย'+(st.dowel.ldOK?'':' · แคปบางกว่าระยะฝัง → ใช้ของอ 90°/เพิ่มความหนา'),to:['hz','db']});}
  if(r.seis){
    checks.push({k:'SEISMIC F.S. OT',v:fmt(r.seis.FSot),req:'≥ 1.5',ok:r.seis.FSot>=1.5,u:1.5/Math.max(r.seis.FSot,.01),
      fix:'เพิ่ม B/hz หรือลด kh ตามผลศึกษาเฉพาะที่',to:['heel','hz','kh']});
    checks.push({k:'SEISMIC F.S. SL',v:fmt(r.seis.FSsl),req:'≥ 1.1',ok:r.seis.FSsl>=1.1,u:1.1/Math.max(r.seis.FSsl,.01),
      fix:'เพิ่ม Shear key / Passive สำหรับกรณีแผ่นดินไหว',to:['dk','usePp','Df','kh']});
    if(!r.onPile&&r.seis.eE!=null)checks.push({k:'SEISMIC e',v:fmt(r.seis.eE,3)+' m',req:'≤ B/6 = '+fmt(r.kern,3),ok:r.seis.eOK,u:Math.abs(r.seis.eE)/r.kern,
      fix:'เพิ่ม toe/B ลดความเยื้องศูนย์กรณีแผ่นดินไหว (มักวิกฤตกว่าสถิต)',to:['toe','heel','kh']});
    if(!r.onPile&&r.seis.q1E!=null&&isFinite(r.seis.q1E))checks.push({k:'SEISMIC q,max',v:fP(r.seis.q1E,1)+' '+UL().P,req:'≤ qa·1.33 = '+fP(r.seis.qaE,1),ok:r.seis.bearOK,u:r.seis.q1E/Math.max(r.seis.qaE,1e-6),
      fix:'เพิ่ม B/toe หรือปรับปรุงกำลังดินฐานราก'});
  }
  if(r.seisBlocked)checks.push({k:'SEISMIC (M-O)',v:'ประเมินไม่ได้ · ไม่ออกค่า',req:'ต้องมี φ ≥ θ + β',ok:false,u:1,
    fix:'φ − θ − β = '+fmt(r.seisBlocked.phi,1)+'° − '+fmt(r.seisBlocked.theta,2)+'° − '+fmt(r.seisBlocked.beta,1)+'° = '+fmt(r.seisBlocked.margin,2)+'° ≤ 0 — ลิ่มดินหลังกำแพงยืนไม่อยู่ที่ k_h นี้ · ลด kh ด้วยวิธี displacement-based (Richards–Elms/Newmark), ลดความชันหลังถม β, หรือใช้วัสดุถม φ สูงขึ้น',to:['kh','beta','phi']});
  if(r.slope)checks.push({k:'SLOPE (เบื้องต้น)',v:'FS '+fmt(r.slope.Fslope,2),req:'≥ 1.5',ok:r.slope.Fslope>=1.5,u:1.5/Math.max(r.slope.Fslope,.01),
    fix:'ลดความชันหลังถม β, ปรับปรุงดิน, หรือวิเคราะห์เสถียรภาพรวมแบบวงสไลด์ (Bishop/Spencer)'});
  /* ★ ตัว shear key ต้องรับแรงที่มันสร้างกำลังให้ไหวด้วย — เดิมนับ passive ของ key เข้า FS เลื่อนไถล
     โดยไม่เคยตรวจตัว key เลย = นับกำลังจากชิ้นส่วนที่ไม่ได้ตรวจ (คลาสเดียวกับปลอกผี build 150) */
  if(r.keyChk){const k=r.keyChk;
    checks.push({k:'SHEAR KEY — เฉือนโคน',v:fF(k.VuK,1)+' '+UL().F,
      req:'≤ φVc = '+fF(k.phiVcK,1)+' (หน้าตัด t×1ม. · passive ÷'+fmt(k.ppFS,1)+')',ok:k.shOK,u:k.ratV,
      fix:'key เฉือนขาด → กำลัง passive ที่ใช้ใน sliding เชื่อถือไม่ได้ — เพิ่มความหนาพนัง t (= ความหนา key) หรือลด dk',to:['t','dk','fc']});
    checks.push({k:'SHEAR KEY — K1 ดัด/ฝังยึด',v:(k.bar?k.bar.txt:'ไม่มี K1')+' · As '+fmt(k.AsKprov||0,0)+' มม²/ม.',
      req:'≥ '+fmt(k.AsKreq,0)+' มม²/ม. · cover 75 · ฝังฐาน ≥ ldh '+fmt(k.ldh||0,2)+' ม.',ok:!!(k.flexOK&&k.fitOK&&k.anchorOK),
      u:Math.max(k.AsKreq/Math.max(k.AsKprov||0,1),k.fitOK?0:1.15,k.anchorOK?0:1.15),
      fix:'เพิ่มขนาด/ลดระยะ K1 หรือเพิ่ม t/hz — K1 ต้องเป็น U-bar 2 หน้า มีปีกบนของอ 90° ฝังในฐาน และอยู่ใน cover จริง',to:['t','hz','dk','toe','heel']});
  }
  /* ★ ป้ายต้องบอก "ฐานคิดของโมเดล" ตรง ๆ — กำแพงบนเสาเข็มใช้เกณฑ์วงลึกลอดใต้ปลายเข็ม (deep-seated)
     และ **ยังไม่นับแรงต้านของเข็มที่ตัดวง** (อนุรักษ์นิยม) · วิศวกรต้องรู้ว่าเลขนี้มาจากสมมติฐานอะไร ก่อนเซ็นรับรอง */
  if(r.gslip){const _pt=r.gslip.pileToe>0, _sq=!!r.gslip.seis, _rq=_sq?FSREQ.globE:FSREQ.glob;
    checks.push({k:'GLOBAL SLIP (Bishop วงสไลด์)'+(_pt?' · วงลึกใต้ปลายเข็ม':'')+(_sq?' · แผ่นดินไหว':''),
    v:'FS '+fmt(r.gslip.FS,2)+(_sq?(' (pseudo-static · k'+'h='+fmt(+r.i.kh||0,3)+(r.gslip.kvGov<0?' · kv ลง':(+r.i.kv>0?' · kv ขึ้น':''))+')'):'')
      +(_pt?' (ลึก '+fmt(-r.gslip.deep,1)+' ม. > ปลายเข็ม '+fmt(r.gslip.pileToe,1)+' ม.)':''),
    req:'≥ '+_rq.toFixed(1)+(_sq?' (แผ่นดินไหว — ข้อ 31 ไม่ระบุวงสไลด์โดยตรง · ใช้ระดับ 1.1 ของข้อ 31 + แนวปฏิบัติสากล)':'')
      +(_pt?' · ยังไม่นับแรงต้านของเข็ม (อนุรักษ์นิยม)':''),
    ok:r.gslip.ok!==false,u:_rq/Math.max(r.gslip.FS,.01),
    /* ★ คำแนะนำต้องตรงกับฟิสิกส์ ไม่ใช่ตรงกับสัญชาตญาณ — วัดจริง (build 156):
       ดินเหนียวอ่อนสม่ำเสมอ (φ=0) เข็ม 4→18 ม. ให้ FS = 1.32→1.32 **ไม่ขยับเลย**
       (undrained: c เท่ากันทุกความลึก · แรงต้านโตพอ ๆ กับน้ำหนักดินที่โต) → "เพิ่มความยาวเข็ม" **ไม่ช่วย**
       ต่างจากดินทราย (φ=30): เข็ม 4→18 ม. ให้ FS 4.86→15.39 เพราะแรงเสียดทานโตตามหน่วยแรงกดที่ลึกขึ้น
       ⇒ ห้ามชี้ผู้ใช้ไปที่ `pileEmb` สำหรับเกณฑ์นี้ (ตัวแนะนำ ⚡ จะหาค่าไม่เจอ = ปุ่มหลอก) */
    fix:(_pt?('วงวิบัติลึก "ลอดใต้ปลายเข็ม" — <b>เสาเข็มหยุดกลไกนี้ไม่ได้</b>'
             +(r.i&&+r.i.phiF===0?' · <b>ดินเหนียวไม่ระบายน้ำ (φ₂=0): การเพิ่มความยาวเข็มไม่ช่วยเสถียรภาพรวม</b> เว้นแต่ปลายเข็มลงถึงชั้นที่แข็งกว่าจริง (ต้องระบุผ่านตารางชั้นดิน)':'')
             +' · แก้: ปรับปรุงดินฐาน (เพิ่ม c₂/φ₂ · replace/preload/CDM) / ลดน้ำหนักจร q / ลดความสูง / ลดความชัน β / เสริม berm หน้ากำแพง')
             :'วงวิบัติลึกผ่านดินฐาน — ปรับปรุงดินฐาน (φ₂/c₂)/ลดความชัน β/ขยายฐาน B/ลดความสูง/ลดน้ำหนักจร q/ลดระดับน้ำ zw หรือเสริมเสาเข็ม-soil nail ตัดวงเลื่อน'),
    to:(_pt?['soilTypeF','cF','phiF','q','beta','Df']:['beta','heel','soilTypeF','cF','phiF','q','zw'])});}
  if(secBad)checks.push({k:'SECTION SIZE',v:'เล็กเกินไป',req:'As คำนวณได้',ok:false,u:1.2,
    fix:'หน้าตัดรับโมเมนต์ไม่ไหว (ρ เกิน) — เพิ่มความหนาพนัง t หรือความหนาฐาน hz หรือเพิ่มกำลังคอนกรีต f′c',to:['t','hz','fc']});
  const barBad=(r.strips&&r.strips.some(s=>s.b_.prov<s.As_||s.b$.prov<s.As$))||
               (r.stemTab&&r.stemTab.some(s=>s.bar.prov<s.As))||
               r.barH_.prov<r.AsH_||r.barH$.prov<r.AsH$||r.barT.prov<r.AsT;
  if(barBad)checks.push({k:'REBAR FIT',v:'DB25@75 ไม่พอ',req:'Asจัด ≥ Asต้องการ',ok:false,u:1.15,
    fix:'แม้ขยับถึง DB25@75 เหล็กยังไม่พอ — เพิ่มความหนา t/hz หรือ (ครีบ) ลดระยะห่าง L',to:['t','hz','L']});
  return checks;
}
/* ============================================================
   RENDER — SOLDIER PILE WALL
   ============================================================ */
/* ★ เกณฑ์ตรวจของกำแพงเสาเข็มพืด — สกัดออกจาก renderSoldier() ให้เรียกซ้ำได้ (คู่ขนานกับ buildChecks ของกำแพงถ่วง)
   ★★ ทำไมต้องสกัด (พบ+วัด 2569-07 build 154): `suggestFix()` ฮาร์ดโค้ดเรียก `buildChecks(r)` ซึ่งเป็นของ
   กำแพงถ่วงล้วน → กับ soldier มัน **throw** (`r.strips` undefined → อ่าน .prov ไม่ได้) แล้วโดน
   `catch(e){return null}` กลืนเงียบ → **ปุ่ม ⚡ "แนะนำค่าที่ทำให้ผ่าน" ตายสนิทกับกำแพงเสาเข็มพืด**
   วัดจริง: soldier เรียก buildChecks 1 ครั้ง throw 1 ครั้ง → null ทันที · cant 12 ครั้ง 0 throw → ได้ผล
   (SUGRNG มี id ของ soldier อยู่ 7 ตัว: tLag·lagW·ancLe·stayBw·stayBh·pileEmbS·pileTen → ตั้งใจให้รองรับมาแต่ต้น) */
function buildChecksSoldier(r){
  const i=r.i,u=UL();
  const checks=[
    {k:'PILE MOMENT',v:fM(r.Mpile)+' '+u.M,req:'≤ Mต้าน '+fM(r.Mcap),ok:r.checks.Mok,u:r.Mpile/r.Mcap,fix:'เพิ่มหน้าตัดเสาเข็มไอ, ลดระยะ S, หรือใส่/เพิ่มสเตย์',to:['ipile','pileS','soldierSys']},
    {k:'PILE SHEAR',v:fF(r.Vpile)+' '+u.F,req:'≤ Vต้าน '+fF(r.Vcap),ok:r.checks.Vok,u:r.Vpile/r.Vcap,fix:'เพิ่มหน้าตัดเสาเข็ม / ลดระยะ S',to:['ipile','pileS']},
    {k:'EMBEDMENT D',v:fmt(r.D,2)+' m'+(r.embedAuto?' (auto)':' (กำหนดเอง)'),req:'ต้องการ ≥ '+fmt(r.Dreq,2)+' m · '+(r.tie?'free-earth':'cantilever'),ok:r.embedOK,u:r.embedOK?Math.min(r.Dreq/Math.max(r.D,0.1),0.99):1.15,fix:r.embedOK?'พอเพียง — เพิ่มได้ถ้าต้องการเผื่อ':'ระยะฝังไม่พอ! เพิ่ม D ≥ '+fmt(r.Dreq,2)+' ม. หรือใส่ 0 = อัตโนมัติ',to:['pileEmbS','pileEmb','pileS']},
    {k:'กันพลิกคว่ำปลายเข็ม FS',v:'FS = '+fmt(r.embed.FSot,2),req:'≥ '+fmt(r.embed.FSotReq,1)+' (passive/active รอบ'+(r.tie?'จุดสเตย์':'ปลายเข็ม')+')',ok:r.embed.FSot>=r.embed.FSotReq-0.01,u:r.embed.FSotReq/Math.max(r.embed.FSot,0.1),fix:'เพิ่มระยะฝัง D / เพิ่มหน้าตัด / ลดระยะ S / ใส่คานค้ำยัน',to:['pileEmbS','ipile','pileS','soldierSys']},
    {k:'พฤติกรรมเข็ม (point spring)',v:r.embed.longPile?'long pile (ปลายตรึง)':'short/rigid (หมุน)',req:'βD = '+fmt(r.embed.betaD,2)+' '+(r.embed.longPile?'≥':'<')+' '+(r.tie?'1.5':'2.5')+' · 1/β='+fmt(r.embed.Lchar,2)+' m',ok:r.embed.longPile,u:r.embed.longPile?0.6:1.1,fix:'เข็มสั้น/แข็ง → เพิ่มระยะฝังให้ถึง long-pile (βD เป้าหมาย) เพื่อให้ปลายเสมือนถูกตรึง ไม่หมุนพลิก',to:['pileEmbS','ipile','su']},
    {k:'LAGGING แผ่นเสียบร่อง',v:r.lag?(fmt(r.lag.wLag_kgm2,0)+' กก./ม²'):'—',req:r.lag?('หนา '+fmt(r.lag.tLag*100,0)+' ซม. รับ ≤ '+fmt(r.lag.plankSafe,0)+' กก./ม²'+(r.lag.drained?' · ท่อ PVC ระบายน้ำ':'')):'',ok:r.lag?r.lag.lagOK:true,u:r.lag?r.lag.lagUtil:0.6,fix:'ลดระยะเสาเข็ม S · เพิ่มความหนาแผ่น/ลวด PC · หรือเจาะท่อ PVC ระบายน้ำ',to:['pileS','tLag','lagW','weepN']},
    {k:'การเคลื่อนตัว δ',v:fmt(r.frame?r.frame.dMaxMM:r.disp.dMax,1)+' มม.'+(r.frame?' (เชื่อมโยง)':''),req:'≤ L/300 = '+fmt(r.disp.allow,1)+' มม.',ok:(r.frame?r.frame.dMaxMM:r.disp.dMax)<=r.disp.allow,u:(r.frame?r.frame.dMaxMM:r.disp.dMax)/r.disp.allow,fix:'ลด S / เพิ่มหน้าตัดเสาเข็ม / เพิ่มระยะฝัง / ใส่สเตย์ (kh='+fmt(r.disp.kh,0)+' t/m³)',to:['pileS','ipile','pileEmbS','soldierSys']},
  ];
  if(r.tie&&r.stay&&r.SS==='anchor'){
    const ga=r.stay.groundAnchor||{},missing=(ga.missing||[]);
    checks.push({k:'GROUND ANCHOR · INSTALLATION SSOT',v:(ga.mark||'GA-01')+' · Lfree '+fmt(ga.freeLength||0,2)+' + Lbond '+fmt(ga.bondLength||0,2)+' ม. · D/C '+(Number.isFinite(ga.dc)?fmt(ga.dc,2):'—'),
      req:'ข้อมูลครบ · bond พ้น active wedge ≥0.50 ม. · T '+fF(ga.serviceDemand||0,1)+' ≤ Rbond '+fF(ga.bondCapacity||0,1)+' '+u.F,
      ok:ga.ready===true,u:ga.ready?Math.min(Math.max(ga.dc||0,0),0.99):1.15,
      fix:missing.length?('กรอกข้อมูล Ground Anchor SSOT: '+missing.join(', ')):'เพิ่ม Lfree/Lbond/Ø/τallow หรือปรับ tendon/grout จากผลทดสอบจริง',
      to:['gaFreeLength','gaBondLength','gaBondDia','gaBondStress','gaTendonSpec','gaGroutSpec','gaProtectionSpec']});
  }else if(r.tie&&r.stay){const _ap=r.stay.anchorPile;
    checks.push({k:'เสาเข็มสมอ uplift'+(_ap?' (I-'+_ap.sz+')':''),v:fF(_ap?_ap.Tdemand:r.stay.perAnchor)+' '+u.F,
      req:'≤ ถอน '+fF(r.stay.Pa)+(_ap?' ('+_ap.govern+')':''),ok:r.stay.anchorOK,u:(_ap?_ap.dcT:r.stay.perAnchor/Math.max(r.stay.Pa,1e-6)),
      fix:'เพิ่มหน้าตัด/ความยาวเสาเข็มสมอ (แยกจากเข็มกันดินได้) หรือลดระยะ S',to:['ancPileSec','ancLe','pileS','Ppile']});
    if(_ap&&_ap.dowel)checks.push({k:'รอยต่อสมอ↔PILE CAP — APd',v:_ap.dowel.spec+' · T_u '+fF(_ap.dowel.Tu,1)+' '+u.F,
      req:'dowel รับแรงถอน + ฝัง cap/pile ตามรายละเอียด',ok:!!_ap.dowel.ok,
      u:_ap.dowel.ok?Math.min(_ap.dowel.mode==='pcwire'?(_ap.dowel.Tu/Math.max(_ap.dowel.pc.Tcap,1)):
        ((_ap.dowel.AsNeed||1)/Math.max(_ap.dowel.AsProv||1,1)),0.99):1.15,
      fix:'รอยต่อหัวเข็มสมอรับแรงถอนไม่พอ — เพิ่มจำนวน/ขนาด APd หรือเปลี่ยนเป็น DB เจาะเสียบ·หล่อ ฝัง cap ≥40db และเข้าเข็ม ≥15db',to:['ancDowelMode','ancDowelDb','ancDowelN','stayBw','stayBh']});
  }
  /* ★★ เสถียรภาพรวม วงลึกลอดใต้ปลายเข็ม — กำแพงเสาเข็มพืด (build 157)
     บั๊กเดิม: calc() `return calcSoldier(...)` ออกก่อนถึงบล็อก globalSlip → ชนิดนี้ไม่เคยถูกตรวจเลย
     ป้ายต้องบอกฐานคิด: ยังไม่นับแรงต้านของเข็มที่ตัดวง (อนุรักษ์นิยม) · วงตื้นถือว่าเข็มยึดไว้ */
  if(r.gslip){const _sq=!!r.gslip.seis, _rq=_sq?FSREQ.globE:FSREQ.glob;
   checks.push({k:'GLOBAL SLIP · วงลึกใต้ปลายเข็ม'+(_sq?' · แผ่นดินไหว':''),
    v:'FS '+fmt(r.gslip.FS,2)+(_sq?(' (pseudo-static · k'+'h='+fmt(+i.kh||0,3)+')'):'')+' (ลึก '+fmt(-r.gslip.deep,1)+' ม. > ปลายเข็ม '+fmt(r.gslip.pileToe,1)+' ม.)',
    req:'≥ '+_rq.toFixed(1)+(_sq?' (แผ่นดินไหว — ข้อ 31 ไม่ระบุวงสไลด์โดยตรง · ใช้ระดับ 1.1 + แนวปฏิบัติสากล)':'')+' · ยังไม่นับแรงต้านของเข็ม (อนุรักษ์นิยม)',
    ok:r.gslip.ok!==false, u:_rq/Math.max(r.gslip.FS,.01),
    fix:'วงวิบัติลึก "ลอดใต้ปลายเข็ม" — <b>เสาเข็มพืดหยุดกลไกนี้ไม่ได้</b>'
       +((+r.gslip.phiFused===0)?' · <b>ดินเหนียวไม่ระบายน้ำ: เพิ่มระยะฝัง D ช่วยได้จำกัดแล้วอิ่มตัว</b> (D 2→12 ม. → FS 0.87→1.03 แล้วนิ่ง · ไปไม่ถึง 1.5) เว้นแต่ปลายลงถึงชั้นแข็งจริง (ระบุผ่านตารางชั้นดิน)':'')
       +' · แก้: ปรับปรุงดินฐาน (ตารางชั้นดิน · replace/preload/CDM) / ลดน้ำหนักจร q / ลดความสูงขุด H / berm หน้ากำแพง',
    to:['su','q','hp','soilLayers']});}   /* ★ ไม่ใส่ pileEmbS — วัดแล้วว่าอิ่มตัวไปไม่ถึงเกณฑ์ → ปุ่ม ⚡ จะหาค่าไม่เจอ = ปุ่มหลอก */
  if(r.tie&&r.stay&&r.SS!=='anchor')checks.push({k:'คานยึดรั้ง คสล. (ดึง)',v:r.stay.nBr+'-DB16',req:'As '+fmt(r.stay.AsTie,0)+'≥'+fmt(r.stay.AsTieReq,0)+' มม² · ρ '+(r.stay.rhoTie*100).toFixed(1)+'%',ok:r.stay.tieSecOK&&r.stay.tieCrackOK&&r.stay.AsTie>=r.stay.AsTieReq,u:r.stay.AsTieReq/r.stay.AsTie,fix:'เพิ่มจำนวน DB16 / ใช้ DB20 / ขยายหน้าตัดคานสเตย์ (คุมรอยร้าว+กำลังดึง)',to:['stayDb','stayBw','stayBh']});
  return checks;
}
/* ★ SSOT — เลือกตัวสร้างเกณฑ์ตามชนิดกำแพง · ทุกคนที่อยาก "ได้เกณฑ์ของ r" ต้องผ่านตัวนี้ ห้ามเรียก buildChecks ตรง ๆ */
function checksFor(r){ return (r&&r.soldier)?buildChecksSoldier(r):buildChecks(r); }

/* ============================================================
   SVG DRAWINGS
   ============================================================ */
const SVGNS='http://www.w3.org/2000/svg';
let _RB_COLLECT=null;   // != null → bar() เก็บลิสต์แทนสร้าง mesh (สำหรับ auto clash-resolver จัดเหล็กไม่ให้ทะลุกัน)
/* ===== AUTO CLASH-RESOLVER — หลังสร้างเหล็กครบ ดันเส้นที่ทะลุกันให้แยกออกจนวางพาดกัน (touch+tie) ไม่ทะลุ =====
   ลำดับความสำคัญ (ค่ามาก=อยู่นิ่ง): เหล็กหลัก 3 · เหล็กหลักครีบ 2 · เหล็กกระจาย 1 · ปลอก/เดือย 0 (ขยับก่อน) */
/* ===== ตาราง bar-type (ACI 318-25 §25.3) — รัศมีดัดวงใน ตาม Ø + ชนิดเหล็ก (ใช้ร่วมทุกโหมด/ทุกมุมมอง · แนว Revit RebarBarType) =====
   เหล็กยืน (main/standard): Ø≤25 → 6d_b (รัศมี 3d_b) · Ø28+ → 8d_b (รัศมี 4d_b)
   ปลอก/เหล็กปลอกยึด (stirrup/tie): Ø≤16 → 4d_b (รัศมี 2d_b) · Ø>16 → 6d_b (รัศมี 3d_b) */
function rcBendR(dia,kind){const d=(dia||16)/1000; return (kind==='stirrup')?(dia<=16?2:3)*d:(dia<=25?3:4)*d;}
/* ---------- สลับภาษาเมนู ไทย/อังกฤษ (รายการคำนวณ+แบบ เป็นสองภาษาอยู่แล้ว) ---------- */
let LANG='th';    // ภาษาในข้อความเตือน — ฉีดเข้ามาทาง input.lang (เดิมอ่านจาก localStorage ของหน้าเว็บ)
function T(th,en){return LANG==='en'?en:th;}
/* ============================================================
   ขอบเขตของ engine — จุดเดียวที่รับค่าจากภายนอก
   หน้าจอมีหน้าที่รวบรวม input ให้ครบแล้วเรียก designRetainingWall(input)
   engine ไม่อ่าน DOM, ไม่อ่าน localStorage และไม่เขียนอะไรกลับออกไป
   ============================================================ */

/** หน่วยที่ input ใช้: 'si' (kN, m, MPa) เท่านั้น — ชั้น UI แปลงมาก่อน */
export function setEngineUnits(mode){ UMODE = (mode === 'mks') ? 'mks' : 'si'; }

/**
 * คำนวณกำแพงกันดินหนึ่งชุด
 *
 * @param {object} input  ค่าที่ผู้ใช้กรอก (หน่วย SI) — ดู INPUT_KEYS
 * @param {object} [opts]
 * @param {string} [opts.profile='thai2566']  โปรไฟล์มาตรฐานออกแบบ ดู DESIGN_PROFILES
 * @param {string} [opts.qaSource='input']    'input' = กรอก q_a เอง · 'soil' = คำนวณจากดิน (Meyerhof)
 * @param {Array}  [opts.soilLayers=null]     ชั้นดินหลายชั้น (null = ชั้นเดียวตาม input)
 * @param {object} [opts.rebarOverride={}]    เหล็กที่ผู้ใช้กำหนดแทนค่าออกแบบอัตโนมัติ
 * @param {string} [opts.lang='th']
 * @returns {object} ผลลัพธ์ชุดเดียว (เสถียรภาพ · แรงกด · เหล็ก · ปริมาณ · คำเตือน)
 */
export function designRetainingWall(input, opts = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('designRetainingWall: ต้องส่ง input เป็นอ็อบเจกต์');
  const profile = opts.profile || input.dcode || 'thai2566';
  if (!CODES[profile]) throw new RangeError('designRetainingWall: ไม่รู้จักโปรไฟล์ "' + profile + '" — ต้องเป็นหนึ่งใน ' + Object.keys(CODES).join(', '));
  DCODE = profile;
  QASRC = opts.qaSource || input.qaSrc || 'input';
  SOILLAYERS = opts.soilLayers != null ? opts.soilLayers : (input.soilLayers != null ? input.soilLayers : null);
  REBAROV = opts.rebarOverride || input.rebarOverride || {};
  LANG = opts.lang || input.lang || 'th';
  return calc(input);
}

/** โปรไฟล์มาตรฐานออกแบบพร้อมสายหลักฐาน (มาตรฐาน · ข้อ · สมการที่รันจริง) */
export const DESIGN_PROFILES = CODES;

/** เกณฑ์ Factor of Safety ที่ใช้ตัดสินผ่าน/ไม่ผ่าน */
export const FS_REQUIRED = FSREQ;

/* สัมประสิทธิ์และตัวช่วยระดับสมการ — เปิดไว้ให้ชุดทดสอบเรียกตรงได้ */
export {
  kaRankine, kaCoulomb, kaeMO, gravityCoulombRef,
  bearingCap, asReq, asReqWSD, shearDesign, phiVc, phiVmax,
  pickBar, pickFit, sigA, khAt, soilProfile, globalSlip, checksFor,
  gaussSolve, pileSpring, pileDisp, frameSolve, soldierFrame, pileWallFrame,
  constructionSpec, calc as calcRaw, calcSoldier
};

/**
 * ชุดทวนสอบอิสระที่มากับ engine — ไม่แตะ DOM และไม่พึ่ง calc()
 *   B2 · Coulomb + gravity oracle   [FHWA NHI-01-094 Eq.6-2 · USACE EM 1110-2-2502 §3-5]
 *   B3 · RC flexure worked example  [FHWA-NHI-04-043 Design Step 4]
 *   B4 · Strip-footing bearing      [FHWA NHI-01-094 Eq.5-7/5-8]
 * คืน [{name, checks:[{label, ok, disp, unit}]}] · ok === false คือไม่ผ่าน
 */
export { validation166Pure as independentBenchmarks };

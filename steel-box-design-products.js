/* SC01 R41. Verified source data, not retail recommended loads.
 * ESR-3814 May2025 Tables14/15/19, pp22/23/27 and MPII pp40–41.
 * See docs/connection/SC01_R41_PRODUCT_DATA_20260912.md for evidence. */
(function(root){
  'use strict';
  const VERSION='esr3814-2025-05-r1',ID='hilti-re500-v3',SOURCE='https://cdn-v2.icc-es.org/wp-content/uploads/report-directory/ESR-3814.pdf';
  const sizes=[8,10,12,16,20,24,27,30],ase=[36.6,58,84.3,157,245,353,459,561],holes=[10,12,14,18,22,28,30,35],mins=[60,60,70,80,90,100,110,120],torques=[10,20,40,80,150,200,270,300];
  const steel={'5.8':{fu:500,N:[18.3,29,42,78.5,122.5,176.5,229.5,280.5],V:[11,14.5,25.5,47,73.5,106,137.5,168.5]},'8.8':{fu:800,N:[29.3,46.5,67.5,125.5,196,282.5,367,449],V:[17.6,23,40.5,75.5,117.5,169.5,220.5,269.5]}};
  const bond={A:{cr:[8.8,8.8,8.8,8.7,8.6,8.5,8.5,8.4],uncr:[16.7,16.3,16,15.2,14.5,13.8,13.2,12.7]},B:{cr:[6.1,6.1,6,6,5.9,5.9,5.9,5.8],uncr:[11.5,11.3,11,10.5,10,9.5,9.1,8.7]}};
  const clone=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
  const fresh=()=>({id:'none',version:VERSION,grade:'5.8',temperature:'B',moisture:'dry',drilling:'hammer',exposure:'hdg-exterior',sustained:'gravity'});
  function row(d){
    const c=d.connection,q=c.productSelection,i=sizes.indexOf(d.plate.anchorMM),s=steel[q.grade],b=bond[q.temperature];
    if(q.id!==ID||q.version!==VERSION||i<0||!s||!b)return null;
    const hef=c.anchorHefMM,h=c.concreteThicknessMM;
    // Eq4-1 uses tau in psi; 1160psi = 7.99878MPa. No optional tau cap.
    const cac=c.concreteCracked?0:hef*(b.uncr[i]/(1160*.006895757293168))**.4*(3.1-.7*Math.min(h/hef,2.4));
    return {Ase:ase[i],futa:s.fu,Nnom:s.N[i],Vnom:s.V[i],phiN:.65,phiV:.60,
      product:{name:'Hilti HIT-RE 500 V3 / ISO 898-1 '+q.grade+' / M'+sizes[i]+' / '+(q.exposure==='hdg-exterior'?'HDG ASTM A153':'zinc ASTM B633 SC1'),report:'ICC-ES ESR-3814; Tables 14, 15, 19',revision:'May 2025',reportDate:'2025-05',qualification:'ACI 318-19 / ESR-3814',installationCondition:q.moisture,
        confirmed:true,conditionQualified:true,crackedQualified:true,uncrackedQualified:true,sustainedLoadIncluded:true,
        NsaDesign:s.N[i]*.65,VsaDesign:s.V[i]*.60,NpCrDesign:0,NpUncrDesign:0,tauCr:b.cr[i],tauUncr:b.uncr[i],phiBond:.65,
        kcCr:7.1,kcUncr:10,kcp:hef>=65?2:1,cac,fcMin:17.2,fcMax:55,hefMin:mins[i],hefMax:20*sizes[i],minEdge:5*sizes[i],minSpacing:5*sizes[i],minMemberThickness:hef+(i<=2?30:2*holes[i]),holeDiameter:holes[i],drillDepth:hef,torqueNm:torques[i],
        cureTime:'รอแข็งตัวเต็มตามอุณหภูมิติดตั้ง: ESR-3814 หน้า41; รูอิ่มน้ำใช้เวลาเพิ่มตาม MPII'}};
  }
  function issues(d,{values=true}={}){
    const c=d.connection,q=c.productSelection;
    if(!q||q.id==='manual'||q.id==='none'||d.support.type==='hbeam')return [];
    const out=[],r=row(d),add=message=>out.push({path:'connection.productSelection.id',message});
    if(!r){add('รุ่นฐานข้อมูลหรือขนาด/เกรดพุกไม่ตรงกับชุดที่รองรับ');return out;}
    if(c.anchorType!=='adhesive')add('HIT-RE 500 V3 ต้องใช้กับพุกเคมี');
    if(q.drilling!=='hammer')add('ชุดนี้ใช้รูเจาะกระแทกดอกคาร์ไบด์และทำความสะอาดตาม MPII');
    if(!['dry','saturated'].includes(q.moisture))add('ชุดนี้รองรับรูแห้ง / คอนกรีตอิ่มน้ำ ไม่มีน้ำขังในรู');
    if(!['dry-interior','hdg-exterior'].includes(q.exposure))add('เลือกแกนชุบซิงก์สำหรับภายในแห้ง หรือกัลวาไนซ์จุ่มร้อน ASTM A153 สำหรับภายนอก ตาม ESR §5.17–5.18');
    if(!['gravity','dead'].includes(q.sustained))add('เลือกน้ำหนักที่ค้างระยะยาว');
    if(d.design.profile!=='aisc360-22_aci318-19')add('ข้อมูลชุดนี้ผูกกับโปรไฟล์ ACI 318-19');
    for(const[key,lo,hi,label]of [['concreteFc',r.product.fcMin,r.product.fcMax,"f′c"],['anchorHefMM',r.product.hefMin,r.product.hefMax,'ระยะฝัง hef']])if(!Number.isFinite(c[key])||c[key]<lo||c[key]>hi)out.push({path:'connection.'+key,message:`${label} ต้องอยู่ในช่วง ${lo}–${hi} ตามเอกสารพุก`});
    if(!Number.isFinite(c.concreteThicknessMM)||c.concreteThicknessMM<r.product.minMemberThickness)out.push({path:'connection.concreteThicknessMM',message:`คอนกรีตต้องหนาอย่างน้อย ${r.product.minMemberThickness} mm สำหรับระยะฝังนี้`});
    if(values){
      for(const[k,v]of Object.entries(r.product))if(c.product[k]!==v)add('ข้อมูล '+k+' ไม่ตรงกับชุดพุก: เลือกชุดจากฐานข้อมูลใหม่');
      if(c.anchorAseMM2!==r.Ase||c.anchorFuta!==r.futa)add('พื้นที่เกลียวหรือกำลังแกนพุกไม่ตรงกับขนาด/เกรด');
    }
    return out;
  }
  function sync(d){
    const c=d.connection,q=c.productSelection;
    if(!q||q.id==='manual'||q.id==='none')return;
    const r=row(d);if(!r){c.product.confirmed=false;c.product.conditionQualified=false;return;}
    c.anchorType='adhesive';c.anchorAseMM2=r.Ase;c.anchorFuta=r.futa;Object.assign(c.product,r.product);
    // Site dimensions are tested separately; no silent increase of concrete/hef.
  }
  function sustainedCheck(d,all,cases){
    if(d.support.type==='hbeam'||d.connection.productSelection?.id!==ID)return null;
    const p=d.connection.product,c=d.connection,q=c.productSelection;
    const candidates=all.filter(x=>{const f=cases[x.caseIndex]?.factors;return f&&f.W===0&&(q.sustained==='gravity'||f.L===0);});
    if(!candidates.length||candidates.some(x=>!x.group?.forces?.length||x.group.forces.some(a=>!Number.isFinite(a.T))))return {state:'incomplete',ratio:NaN,note:'แรงดึงพุกสำหรับกรณีค้างระยะยาวไม่ครบ'};
    const governing=candidates.map(x=>({x,T:Math.max(0,...(x.group?.forces||[]).map(a=>a.T))})).sort((a,b)=>b.T-a.T)[0];
    if(!governing)return {state:'incomplete',ratio:NaN,note:'ไม่มีกรณีแรงค้างระยะยาวสำหรับตรวจพุกเคมี'};
    const tau=c.concreteCracked?p.tauCr:p.tauUncr,Nba=tau*Math.PI*d.plate.anchorMM*c.anchorHefMM/1000,capacity=.55*p.phiBond*Nba,demand=governing.T,ratio=demand/capacity;
    return {state:!Number.isFinite(ratio)?'incomplete':ratio>1?'fail':ratio>.8?'warn':'ok',ratio,demand,design:capacity,Nba,caseName:governing.x.caseName,plateId:governing.x.plateId,
      note:`แรงดึงพุกสูงสุด ${demand.toFixed(3)} / (0.55 × φ × Nba) ${capacity.toFixed(3)} kN; ${q.sustained==='gravity'?'ถือ DL และ LL เป็นแรงค้าง':'DL เป็นแรงค้าง; LL ชั่วคราว'}; ACI 318-19 §17.5.2.2`};
  }
  const presets={steel:[{id:'stkr400',label:'STKR400 · Fy 245 / Fu 400 MPa',Fy:245,Fu:400},{id:'stkr490',label:'STKR490 · Fy 325 / Fu 490 MPa',Fy:325,Fu:490}],weld:[{id:'e7018',label:'E7018 · Fexx 490 MPa',Fexx:490}]};
  root.NCYSC01DesignProducts=freeze({VERSION,ID,SOURCE,sizes,fresh,row,issues,sync,sustainedCheck,presets,clone,
    steelSource:'https://www.nipponsteel.com/product/construction/handbook/pdf/3-63.pdf',weldSource:'https://ch-delivery.lincolnelectric.com/api/public/content/f5e38ae6ebf441829d73d7b1a404818b?v=84bee2da'});
})(typeof window!=='undefined'?window:globalThis);

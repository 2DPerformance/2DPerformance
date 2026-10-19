/** Presentation only. Never feed displayed numbers back into the Engine.
 * NIST SP811 B.8; the native Engine uses the same exact standard gravity. */
import {STANDARD_GRAVITY,KGF_PER_KN,KSC_PER_MPA,validateInputUnitMode} from './inputUnits.mjs?rwv=20260930-load-units-1';

const definitions=Object.freeze({
  'kN':[1,'kN',KGF_PER_KN,'kgf'],
  'kN/ต้น':[1,'kN/ต้น',KGF_PER_KN,'kgf/ต้น'],
  'kN/m':[1,'kN/m',KGF_PER_KN,'kgf/m'],
  'kN/m³':[1,'kN/m³',KGF_PER_KN,'kgf/m³'],
  'kN·m':[1,'kN·m',KGF_PER_KN,'kgf·m'],
  'kN·m/m':[1,'kN·m/m',KGF_PER_KN,'kgf·m/m'],
  'kN·m²':[1,'kN·m²',KGF_PER_KN,'kgf·m²'],
  'kPa':[1,'kPa',KGF_PER_KN,'kgf/m²'],
  'MPa':[1,'MPa',KSC_PER_MPA,'kgf/cm²'],
  'tf':[STANDARD_GRAVITY,'kN',1000,'kgf'],
  'tf/ต้น':[STANDARD_GRAVITY,'kN/ต้น',1000,'kgf/ต้น'],
  'tf/m':[STANDARD_GRAVITY,'kN/m',1000,'kgf/m'],
  'tf·m/m':[STANDARD_GRAVITY,'kN·m/m',1000,'kgf·m/m'],
  'kgf/m²':[1/KGF_PER_KN,'kPa',1,'kgf/m²'],
});
const aliases=Object.freeze({'kN/ม.':'kN/m','kN/ม':'kN/m','kN/ม³':'kN/m³','kN/m²':'kPa','kN/ม²':'kPa',
  'kN·m/ม.':'kN·m/m','kN·ม.':'kN·m','ตัน':'tf','ตัน/ต้น':'tf/ต้น',
  'ตัน/ม.':'tf/m','ตัน/ม':'tf/m','ตัน·ม./ม.':'tf·m/m','กก./ม²':'kgf/m²'});
const descriptor=unit=>{
  const key=Object.hasOwn(aliases,unit)?aliases[unit]:unit;
  if(!Object.hasOwn(definitions,key))throw new TypeError('RW-01 unknown result unit: '+unit);
  return definitions[key];
};
export function resultUnits(mode='si') {
  validateInputUnitMode(mode);
  const kgf=mode==='kgf',offset=kgf?2:0;
  const value=(number,unit)=>number==null||number===''?NaN:Number(number)*descriptor(unit)[offset];
  const label=unit=>descriptor(unit)[offset+1];
  const format=(number,unit,places=2)=>{
    const converted=value(number,unit);
    return Number.isFinite(converted)?converted.toFixed(places):'—';
  };
  return Object.freeze({mode,value,label,format,
    quantity:(number,unit,places=2)=>format(number,unit,places)+' '+label(unit),
    title:kgf?'kgf · kgf·m · kgf/m²':'kN · kN·m · kPa',
  });
}

/** Old Engine prose has rounded values. Transform only explicit recognised
 * scalar quantities; do not guess units for dimensions, ratios or bar labels. */
export function displayEngineText(source,mode='si') {
  const units=resultUnits(mode);
  return String(source??'').replace(/(?<![\w.])([+−-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*(kN·m\/ม\.|kN·m\/m|kN·m²|kN·m|kN\/ม\.|kN\/m³|kN\/m²|kN\/ม²|kN\/m|kN\/ต้น|kN|kPa|MPa|ตัน·ม\.\/ม\.|ตัน\/ต้น|ตัน\/ม\.|ตัน\/ม|ตัน|กก\.\/ม²)(?![A-Za-z\d²³/·])/g,
    (_match,value,unit)=>units.quantity(Number(value.replaceAll(',','').replace('−','-')),unit,2));
}

/** Owner's cast-together detail affects wording only; preserve accepted BBS quantities. */
export function displayedBbsRow(snapshot,row) {
  const dowel=snapshot.forces?.rearAnchor?.dowel;
  if(row.mark!=='APd'||!dowel||dowel.mode==='pcwire')return row;
  return {...row,position:'เหล็กเดือยหล่อพร้อมกัน เข็มสมอ↔pile cap (รับแรงถอน)',
    detail:dowel.spec+'/ต้น · เหล็กเดือยหล่อพร้อมกัน · ตรวจพื้นที่เหล็กตามแรงที่คำนวณ'};
}

/** Read check demands/capacities from accepted numeric fields where available.
 * Keep original OK/DC and any explanatory suffix. Remaining explicit legacy
 * prose is converted from its accepted rounded representation only. */
export function displayedChecks(snapshot,mode='si') {
  const u=resultUnits(mode),p=snapshot.forces?.pile,f=snapshot.forces;
  return snapshot.checks.map(check=>{
    let value=displayEngineText(check.value,mode),criterion=displayEngineText(check.criterion,mode);
    const pair=(d,c,unit,caption='')=>{
      value=u.quantity(d,unit);criterion='≤ '+u.quantity(c,unit)+caption;
    };
    if(p&&check.key==='PILE แกน toe/heel'){
      value=u.format(p.axT,'tf')+' / '+u.quantity(p.axH,'tf/ต้น');
      criterion=check.criterion.replace(/Pa = [\d.,]+/, 'Pa = '+u.quantity(p.Pa,'tf/ต้น'));
    }else if(p&&check.key==='PILE แรงราบ · batter'){
      value=u.quantity(p.hcap,'tf/m');
      criterion=check.criterion.replace(/Rh = [\d.,]+/,'Rh = '+u.quantity(p.Rh,'tf/m'));
    }else if(p&&check.key==='PILE ถอน/พลิกคว่ำ'){
      value=check.value.replace(/Rmin [−\d.,-]+/,'Rmin '+u.quantity(Math.min(p.axTv,p.axHv),'tf/ต้น'));
      criterion=criterion.replace(/Paดึง=[\d.,]+/,match=>{
        const original=Number(match.slice(match.indexOf('=')+1));
        return 'Paดึง='+u.quantity(original,'tf/ต้น');
      });
    }else if(p&&['PILE โมเมนต์ดัด','PILE MOMENT'].includes(check.key)){
      const suffix=check.criterion.match(/\(f_pe ([\d.]+)\)/);
      pair(p.Mu,p.Mcr,'kN·m',suffix?' (f_pe '+u.quantity(Number(suffix[1]),'MPa',1)+')':'');
    }else if(p&&['PILE เฉือน (หักปลาย?)','PILE SHEAR'].includes(check.key))pair(p.Vu,p.Vc,'kN');
    else if(f?.stem&&check.key.startsWith('SHEAR — ')){
      const member={STEM:f.stem,HEEL:f.heel,TOE:f.toe}[check.key.split(' — ')[1]];
      if(member)pair(member.V,member.capacityV,'kN/m',' (คอนกรีตล้วน)');
    }else if(p&&check.key.startsWith('เสาเข็มสมอ uplift')){
      const cap=check.criterion.match(/^(≤ ถอน )([\d.,]+)/);
      if(cap)criterion=check.criterion.replace(cap[0],cap[1]+u.quantity(Number(cap[2].replaceAll(',','')),'kN'));
    }else if(snapshot.geometry.anchor&&check.key.startsWith('GROUND ANCHOR')){
      const a=snapshot.geometry.anchor;
      criterion=check.criterion.replace(/T [\d.,]+ ≤ min\(Rbond [\d.,]+, Rtendon\/head [\d.,]+\) kN/,
        'T '+u.format(a.serviceDemand,'kN')+' ≤ min(Rbond '+u.format(a.bondCapacity,'kN')
        +', Rtendon/head '+u.format(a.tendonCapacity,'kN')+') '+u.label('kN'));
    }
    if(snapshot.type==='duckfoot'){
      const columnCase=snapshot.column.cases.find(c=>check.key.endsWith(' · '+c.name));
      if(columnCase){
        if(check.key.startsWith('เสา · P–M'))pair(columnCase.M,columnCase.capacityM,'kN·m');
        else if(check.key.startsWith('เสา · แรงอัด'))pair(columnCase.P,columnCase.capacityP,'kN');
        else if(check.key.startsWith('เสา · เสถียรภาพ'))pair(columnCase.P,columnCase.Pcr,'kN');
      }
      const beam=snapshot.beamDesign,foot=snapshot.footing;
      if(check.key==='คานตีนเสา · ดัด')pair(beam.M,beam.capacity,'kN·m');
      if(check.key==='คานตีนเสา · เฉือน')pair(beam.V,beam.capacityV,'kN');
      const padMatch=check.key.match(/^ฐาน (\d+) · กำลังแบกทาน$/);
      if(padMatch)pair(snapshot.pads[Number(padMatch[1])-1].qMax,snapshot.input.qa,'kPa');
      if(foot){
        if(check.key==='ฐาน · ดัดตั้งฉากเขต')pair(foot.Mx,foot.barX.capacity,'kN·m/m');
        if(check.key==='ฐาน · ดัดขนานเขต')pair(foot.My,foot.barY.capacity,'kN·m/m');
        if(check.key==='ฐาน · เฉือนตั้งฉากเขต')pair(foot.Vx,foot.vcX,'kN/m');
        if(check.key==='ฐาน · เฉือนขนานเขต')pair(foot.Vy,foot.vcY,'kN/m');
        if(check.key==='ฐาน · เจาะทะลุขอบรวมโมเมนต์')pair(foot.punch.stress,foot.punch.capacity,'MPa');
      }
    }
    const label=check.key==='รอยต่อสมอ↔PILE CAP — APd'
      ?(snapshot.forces.rearAnchor?.dowel?.mode==='pcwire'?'APd · กำลังลวด PC':'APd · พื้นที่เหล็กเดือยหล่อพร้อมกัน'):check.key;
    return {...check,label,value,criterion,fix:displayEngineText(check.fix,mode)};
  });
}

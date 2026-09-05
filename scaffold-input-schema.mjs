// Input shape only. Engineering domains and normalization stay with the retained engine.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.length <= 100000;
const nullableNumber = value => value === null || finite(value);
const safeKey = key => !['__proto__','prototype','constructor'].includes(key);
const record = (value, required, optional = {}) => object(value)
  && Object.keys(required).every(key => Object.hasOwn(value,key))
  && Object.entries(value).every(([key,item]) => safeKey(key) && (required[key] || optional[key])?.(item) === true);
const list = validate => value => Array.isArray(value) && value.length <= 100000 && value.every(validate);
const point = value => record(value,{x:finite,y:finite});
const polygon = list(point);
const profile = value => record(value,{name:text,H:finite,B:finite,t:finite},{custom:value=>typeof value==='boolean'});
const beam = value => record(value,{id:text,name:text,x1:finite,y1:finite,x2:finite,y2:finite,b:finite,h:finite,support:text})
  || record(value,{dir:value=>['X','Y'].includes(value),offset:finite,b:finite,h:finite});
const procurement = value => record(value,{
  wastePct:nullableNumber,componentSparePct:nullableNumber,kerfMm:nullableNumber,stockLength:finite,
  rows: rows => object(rows) && Object.entries(rows).every(([key,row]) => safeKey(key) && record(row,{}, {onHand:nullableNumber,rate:nullableNumber})),
  extras:list(value=>record(value,{id:text,name:text,detail:text,qty:nullableNumber,unit:text})),
},{soleMaterial:text,soleTmm:nullableNumber,neededDate:text,supplier:text,requestedBy:text});
const arrays = {
  beams:list(beam),outer:polygon,holes:list(polygon),customPosts:list(point),removedPosts:list(point),customProfiles:list(profile),
  loadZones:list(value=>record(value,{id:text,name:text,poly:polygon,q:finite})),
  pointLoads:list(value=>record(value,{id:text,name:text,x:finite,y:finite,P:finite})),
};
const legacyVersion = value => ['2.2.0','2.3.0','2.4.0'].includes(value);
export function createScaffoldInputValidator(template, requiredKeys) {
  const stateFields = Object.fromEntries(Object.entries(template).map(([key,value]) => [key,
    arrays[key] || (key === 'procurement' ? procurement
      : key === 'rates' ? candidate => record(candidate,Object.fromEntries(Object.keys(value).map(name=>[name,finite])))
        : typeof value === 'number' ? finite : typeof value === 'boolean' ? candidate => typeof candidate === 'boolean' : text),
  ]));
  stateFields.customProfiles = arrays.customProfiles;
  stateFields.revision = text;
  const state = value => object(value) && requiredKeys.every(key=>Object.hasOwn(value,key))
    && Object.entries(value).every(([key,item])=>safeKey(key) && stateFields[key]?.(item) === true);
  const plan = value => record(value,{
    scalePxM:value=>finite(value)&&value>=0,
    localOriginImg:value=>value===null||point(value),fileName:text,
    imageData:value=>value===null||typeof value==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value),
  });
  return input => record(input,{version:value=>value===1,state,plan})
    || record(input,{version:legacyVersion,state});
}

export function decodeScaffoldLegacyFile(data, validate) {
  if (!record(data,{schema:value=>value==='naichangyai.scaffold-pro',version:legacyVersion,state:object,plan:object},{savedAt:text})) {
    throw new Error('รูปแบบไฟล์ .scaffold.json ไม่ตรงรุ่นที่รองรับ ไม่เปลี่ยนงานปัจจุบัน');
  }
  const input={version:1,state:data.state,plan:data.plan};
  if (!validate(input)) throw new Error('โครงสร้างข้อมูลหรือภาพในไฟล์นั่งร้านไม่ครบ ไม่เปลี่ยนงานปัจจุบัน');
  return input;
}

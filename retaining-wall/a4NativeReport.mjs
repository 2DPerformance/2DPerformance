/** CAD drawing sheets at the end of the accepted A4 calculation book.
 * Geometry/steel/verdict stay owned by the immutable Snapshot. */
import {buildA4CadSheets,renderA4CadSheet} from './a4DrawingSheet.mjs?rwv=20261003-cad-contour-1';
import {nativeCadViews} from './nativeCadViews.mjs?rwv=20261003-main-equations-1';
import {resultUnits} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
const esc=value=>String(value??'').replace(/[&<>"']/g,token=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[token]));

export function nativeA4ReportSheets(snapshot,{title,profileLabel,support,unitMode='si'}) {
  if(!snapshot?.geometry||!['PASS','FAIL'].includes(snapshot.status)
    ||!Array.isArray(snapshot.bbs)||!snapshot.bbs.length
    ||!Array.isArray(snapshot.checks)||!snapshot.checks.length
    ||!snapshot.authority?.includes('NOT FOR CONSTRUCTION'))
    throw new TypeError('RW-01 final Section requires a current complete result projection');
  const failed=snapshot.checks.filter(check=>!check.ok).length;
  if((snapshot.status==='PASS')!==(failed===0))throw new TypeError('RW-01 final Section verdict/checks mismatch');
  const profile=snapshot.type==='duckfoot'?'ACI 318-14 · กำลังหน้าตัด / ตัวคูณแรงโครงการ':profileLabel;
  const extraIdentity=['โปรไฟล์ที่เลือก: '+profile];
  if(['pile','pilecf'].includes(snapshot.type))extraIdentity.push('ระยะหุ้มเหล็กพนัง/ครีบ '+snapshot.input.cov+' มม. · ฐาน 75 มม.');
  if(snapshot.type==='duckfoot')extraIdentity.push('ตัวคูณแบบจำลอง: DL '+snapshot.input.factorN+' · LL '+snapshot.input.factorL+' · H/M '+snapshot.input.factorH);
  if(snapshot.type==='soldier'&&snapshot.geometry.staySystem==='stay')extraIdentity.push(
    'แคปหัวเข็มสมอหลังเป็นรูปประกอบ ยังไม่ตรวจดัด/เฉือน/ระยะฝังเหล็กและกำลังแรงราบหรือดัดของเข็มสมอ');
  const sheets=buildA4CadSheets({info:{type:snapshot.type,title,profile,project:snapshot.input.project,
    stamp:snapshot.stamp,status:snapshot.status,relativeSheetNumbers:true,
    forceUnits:resultUnits(unitMode).title,
    statusLabel:'ผลชุดนี้: '+snapshot.status+(failed?' · ไม่ผ่าน '+failed+' รายการ':' · ผ่านรายการที่ลงทะเบียน')+' · '+snapshot.stamp,
    extraIdentity,authority:snapshot.authority,
    notes:[support,'ภาพตำแหน่งและวัสดุออกแบบ ไม่ใช่รายการตัดดัด; อ่านสมการและผลตรวจครบทุกหน้าก่อนหน้า']},
    ...nativeCadViews(snapshot),rows:snapshot.bbs});
  return sheets.map(sheet=>'<section class="rw-a4-cad-sheet" '+(sheet.meta.finalSectionSummary
    ?'data-report-final-section="'+esc(snapshot.type)+'"':'data-report-plan-sheet="'+esc(snapshot.type)+'"')
    +' data-report-profile="'+esc(snapshot.profile)+'" data-report-stamp="'+esc(snapshot.stamp)+'">'
    +renderA4CadSheet(sheet)+'</section>').join('');
}

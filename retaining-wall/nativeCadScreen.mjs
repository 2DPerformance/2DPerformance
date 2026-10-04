import {separatePaperLabels} from './drafting/paperLabels.mjs?rwv=20261003-cad-contour-1';
/** Screen projection of the SAME accepted CAD geometry used by A4.
 * A view never resizes a physical member, changes a batter or selects bars. */
import {calculationCadView} from './calculationCadView.mjs?rwv=20261003-cad-contour-1';
import {fitCadView} from './a4DrawingSheet.mjs?rwv=20261003-cad-contour-1';
import {drawing,line,text} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {renderSvg} from './drafting/svgRenderer.js?rwv=20261003-cad-contour-1';

const WIDTH=140,HEIGHT=128;
// Captions and dimension offsets are paper annotations, independent of the
// physical CAD coordinates. Short/tall walls still need readable label lanes.
export function nativeScreenCad(snapshot,view='section') {
  return screenCadView(calculationCadView(snapshot,view,{screen:true}),view,{stamp:snapshot.stamp||snapshot.id,type:snapshot.type||snapshot.result?.i.wtype});
}
export function screenCadView(source,view='section',{stamp='draft',type='draft',draft=false}={}) {
  if(!['plan','section'].includes(view))throw new TypeError('CAD screen: Plan or Section required');
  const fitted=fitCadView(source,{x:5,y:13,w:130,h:102});
  const layer='RW-SCREEN-TEXT';
  // At the compact screen scale, the H label can meet the zero-level label.
  // Move only its paper lane; measured endpoints and the level anchor stay exact.
  const placed=separatePaperLabels(fitted.entities.map(e=>view==='section'&&['pile','pilecf'].includes(type)
    &&e.t==='dim'&&e.note==='H'?{...e,off:e.off-8}:e));
  const entities=[...placed,
    text({x:5,y:122},view==='plan'?'PLAN · ผังตำแหน่ง':'SECTION A-A · รูปตัด',3.4,layer,{bold:true}),
    ...(view==='section'?[text({x:135,y:122},'±0.000 = '+(type==='soldier'?'ระดับขุด':['pile','pilecf','duckfoot'].includes(type)?'ผิวบนฐาน':'ท้องฐาน'),2.0,layer,{align:'R'})]:[]),
    line({x:5,y:118},{x:135,y:118},'DIM','RW-SCREEN-FRAME'),
    line({x:5,y:10},{x:135,y:10},'DIM','RW-SCREEN-FRAME'),
    text({x:5,y:5},draft?'CAD · ขนาดกรอก (มม.) / ระดับ ม. · ยังไม่คำนวณ':'CAD · มิติ มม. / ระดับ ม. · สัดส่วนจริงทุกแกน',2.8,layer),
  ];
  return {drawing:drawing('RW-SCREEN-'+view.toUpperCase(),fitted.model.title,entities,
    {sourceStamp:stamp,viewKind:view,viewScale:fitted.scale,uniformScale:true,draft}),
    model:fitted.model,scale:fitted.scale};
}

export function renderNativeCadView(snapshot,view='section') {
  const cad=nativeScreenCad(snapshot,view);
  return renderScreenCad(cad,view,snapshot.stamp||snapshot.id);
}
export function renderScreenCad(cad,view,identity='draft',{draft=false,field=''}={}) {
  const stamp=String(identity).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
  return renderSvg(cad.drawing,{scale:1,padPaper:0,page:{w:WIDTH,h:HEIGHT}})
    .replace('<svg ','<svg data-native-cad-view="'+view+'" data-source-stamp="'+stamp
      +'" data-cad-state="'+(draft?'draft':'accepted')+'" data-selected-field="'+String(field).replace(/[^a-zA-Z0-9_-]/g,'')+'" data-view-scale="'+cad.scale+'" ');
}

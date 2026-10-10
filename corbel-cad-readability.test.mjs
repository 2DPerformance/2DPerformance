import assert from 'node:assert/strict';
import test from 'node:test';
import './Concrete-design/corbel-engine.js';
import './Concrete-design/corbel-workbench-model.js';
import './corbel-rebar-detail.js';
import './corbel-cad-drawing.js';
const E=globalThis.CorbelDesign,M=globalThis.CorbelWorkbenchModel,G=globalThis.CorbelRebarDetail;
const input={...E.DEFAULT_CORBEL_INPUT,widthMm:300,heightMm:500,tipHeightMm:350,lengthMm:450,depthMm:430,coverMm:40,vuKg:129.948};
const snapshot=(vertical=G.VERTICAL_TRIAL)=>M.createCorbelResultSnapshot(E.designCorbel(input),{createdAt:'2026-10-06T09:30:00Z',detailRebarPattern:'reference-return',detailGeometry:G.TRIAL_DETAILS,verticalDetail:vertical});
const views=html=>Object.fromEntries([...html.matchAll(/<svg\b[^>]*data-cad-view="([^"]+)"[\s\S]*?<\/svg>/g)].map(m=>[m[1],m[0]]));
const keys=html=>[...html.matchAll(/data-view-key="([^"]+)"/g)].map(m=>m[1]);

test('each section identifies only physically visible bar groups and names the same As upper/return legs',()=>{
  const s=snapshot(),g=G.build(s),before=JSON.stringify({s,g}),v=views(G.section(s));
  assert.deepEqual(keys(v.front),['01','02']);assert.deepEqual(keys(v['corbel-vertical']),['01','02','04']);assert.deepEqual(keys(v['support-vertical']),['02','05']);assert.deepEqual(keys(v.plan),['01','02','03']);
  for(const name of ['side','front','corbel-vertical','support-vertical']){
    assert.ok(v[name].includes('data-section-locator="'+name+'"'));assert.ok(v[name].includes('data-locator-steel="false"'));
    for(const key of keys(v[name]))assert.ok(v[name].includes('data-steel-mark="'+key+'"'),name+' key points to absent steel '+key);
  }
  assert.equal((v.front.match(/data-front-main=/g)||[]).length,g.main.length);assert.equal((v.front.match(/data-front-return=/g)||[]).length,g.main.length);assert.ok(v.front.includes('3 เส้น ไม่ใช่ 6 เส้น'));assert.ok(v.front.includes('ขาบน')&&v.front.includes('ขากลับของเส้นเดิม'));
  assert.ok(v['support-vertical'].includes('ไม่ใช่เหล็กตามยาวคาน'));assert.ok(v['support-vertical'].includes('ยังไม่มีข้อมูล'));assert.ok(!v['support-vertical'].includes('data-steel-family="As"'));assert.equal(JSON.stringify({s,g}),before);
});
test('horizontal steel plan, concrete-only section locators and both manual projection strips are distinct drawings',()=>{
  const s=snapshot(),g=G.build(s),v=views(G.section(s));assert.equal(Object.keys(v).length,6);
  assert.ok(v.plan.includes('data-plan-main=')&&v.plan.includes('data-plan-tie=')&&v.plan.includes('data-plan-anchor='));assert.ok(!v.plan.includes('data-plan-manual=')&&!v.plan.includes('data-cad-line="section-cut"'));
  assert.ok(!v['section-map'].includes('data-plan-main=')&&!v['section-map'].includes('data-plan-tie=')&&!v['section-map'].includes('data-plan-anchor='));assert.ok(v['section-map'].includes('data-locator')===false);
  assert.equal((v['section-map'].match(/data-cut-locator=/g)||[]).length,4);assert.equal((v['section-map'].match(/data-manual-projection-strip=/g)||[]).length,2);assert.equal((v['section-map'].match(/data-plan-manual=/g)||[]).length,g.verticalTies.length+g.supportTies.length);assert.ok(v['section-map'].includes('ไม่เพิ่มพื้นที่ Aₛ/Aₕ'));
});
test('actual non-default cut positions propagate to inset and cut map without hardcoded trial values; disabled groups stay absent',()=>{
  const s=snapshot({...G.VERTICAL_TRIAL,verticalCorbelStart:60,verticalSupportStart:56}),g=G.build(s),v=views(G.section(s));assert.equal(g.status,'GEOMETRY CANDIDATE');
  assert.ok(v['corbel-vertical'].includes('data-locator-axis="x" data-locator-position-mm="60"'));assert.ok(v['support-vertical'].includes('data-locator-axis="z" data-locator-position-mm="56"'));
  assert.ok(v['section-map'].includes('data-cut-locator="C" data-cut-axis="x" data-cut-position-mm="60"'));assert.ok(v['section-map'].includes('data-cut-locator="D" data-cut-axis="z" data-cut-position-mm="56"'));
  const legacy=views(G.section(snapshot({...G.VERTICAL_TRIAL,verticalCorbelEnabled:false,verticalSupportEnabled:false})));assert.deepEqual(Object.keys(legacy),['side','front','plan']);for(const name of Object.keys(legacy))assert.ok(!keys(legacy[name]).some(k=>k==='04'||k==='05'));assert.ok(!legacy.plan.includes('หน้าถัดไป')&&legacy.plan.includes('ตำแหน่งตัดดูภาพเล็ก'));
});

test('locked or incomplete geometry has no phantom steel keys or non-finite SVG coordinates',()=>{
  const s=snapshot(), g=G.build(s,{dirty:true});assert.equal(g.status,'LOCKED');
  const html=globalThis.CorbelCadDrawing.render(s,g,'locked');
  assert.deepEqual(keys(html),[]);assert.ok(!html.includes('NaN')&&!html.includes('Infinity'));
  assert.ok(html.includes('LOCKED')&&!html.includes('data-steel-mark='));
});


test('manual hoop leaders land on real straight side legs and approach diagonally clear of the hoop axis',()=>{
  const cases=[
    {name:'default'},
    {name:'wide',input:{lengthMm:600}},
    {name:'wide corbel',input:{widthMm:600}},
    {name:'wide support',detail:{detailSupportWidth:600}},
    {name:'narrow support',expectedHold:true,detail:{detailSupportWidth:200,detailEmbed:150,detailTieEmbed:140}},
    {name:'shifted cut',vertical:{verticalCorbelStart:60,verticalSupportStart:56}},
  ];
  const segmentDistance=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),den=d.reduce((v,x)=>v+x*x,0),t=Math.max(0,Math.min(1,p.reduce((v,x,i)=>v+(x-a[i])*d[i],0)/den));return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
  for(const c of cases){
    const s=M.createCorbelResultSnapshot(E.designCorbel({...input,...c.input}),{createdAt:'2026-10-07T08:00:00Z',detailRebarPattern:'reference-return',detailGeometry:{...G.TRIAL_DETAILS,...c.detail},verticalDetail:{...G.VERTICAL_TRIAL,...c.vertical}}),g=G.build(s,{allowRejected:true}),before=JSON.stringify({s,g}),v=views(G.section(s));
    if(c.expectedHold){assert.equal(g.status,'DETAIL HOLD');assert.ok(g.errors.some(e=>e.code==='REFERENCE_RETURN'));assert.ok(!v['corbel-vertical']&&!v['support-vertical']);assert.equal(JSON.stringify({s,g}),before);continue;}
    assert.ok(v['corbel-vertical']&&v['support-vertical'],c.name+' actual manual geometry is required');
    for(const [name,code,bars] of [['corbel-vertical','04',g.verticalTies],['support-vertical','05',g.supportTies]]){
      const mark=[...v[name].matchAll(/<g\b[^>]*data-steel-mark="([^"]+)"[^>]*>[\s\S]*?<\/g>/g)].find(m=>m[1]===code)?.[0];assert.ok(mark,c.name+' '+name);
      const attr=k=>mark.match(new RegExp(k+'="([^"]+)"'))?.[1],bar=bars.find(b=>b.id===attr('data-target-bar')),p=attr('data-target-mm').split(',').map(Number);
      assert.ok(bar,c.name+' '+name+' '+attr('data-target-bar')+' '+g.status);
      assert.ok(Math.min(...bar.points.slice(1).map((b,i)=>segmentDistance(p,bar.points[i],b)))<1e-6,'leader off actual bar');
      const axis=bar.orientation==='xy'?0:2;assert.ok(Math.abs(p[axis]-Math.min(...bar.points.map(q=>q[axis])))<1e-6,'leader is not on outside side leg');
      assert.ok(p[1]>bar.topYMm+bar.bendCenterRadiusMm&&p[1]<bar.bottomYMm-bar.bendCenterRadiusMm,'leader is on a bend');
      const points=mark.match(/data-leader-route="side-leg" d="([^"]+)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number),[ex,ey,tx,ty]=points.slice(-4);
      assert.ok(tx>ex&&ty>ey&&Math.abs((tx-ex)-(ty-ey))<.003,'approach must be diagonal, not run along hoop');
      assert.ok(mark.includes('data-leader-endpoint="true"')&&mark.includes('stroke="#fff"'),'visible endpoint');
    }
    assert.ok(v['support-vertical'].includes('data-section-context="corbel-beyond" data-context-steel="false"'));
    const supportView=v['support-vertical'],breakX=Number(supportView.match(/data-context-break-x="([^"]+)"/)[1]),extensionX=Number(supportView.match(/data-upper-extension-start-x="([^"]+)"/)[1]);assert.ok(extensionX>breakX+5,'D top dimension hides the concrete continuation');
    for(const view of ['corbel-vertical','support-vertical']){const rows=[...v[view].matchAll(/<g\b[^>]*data-direct-callout="true"[^>]*>[\s\S]*?<\/g>/g)].map(m=>({targetY:Number(m[0].match(/data-target-mm="[^"]+,([^,]+),[^"]+"/)[1]),labelY:Number(m[0].match(/<circle cx="54" cy="([^"]+)"/)[1])}));for(let i=1;i<rows.length;i++){assert.ok(rows[i].targetY>=rows[i-1].targetY,'callouts out of target order');assert.ok(rows[i].labelY-rows[i-1].labelY>=53.99,'callout labels overlap');}}
    for(const code of ['04','05']){const mark=[...v.side.matchAll(/<g\b[^>]*data-steel-mark="([^"]+)"[^>]*>[\s\S]*?<\/g>/g)].find(m=>m[1]===code)[0],id=mark.match(/data-target-bar="([^"]+)"/)[1],point=mark.match(/data-target-mm="([^"]+)"/)[1].split(',').map(Number),bar=[...g.verticalTies,...g.supportTies].find(b=>b.id===id);assert.ok(point[1]>bar.topYMm+bar.bendCenterRadiusMm&&point[1]<bar.bottomYMm-bar.bendCenterRadiusMm,'side manual callout still points at top leg');assert.ok(Math.min(...bar.points.slice(1).map((b,i)=>segmentDistance(point,bar.points[i],b)))<1e-6);}

    assert.ok(v['support-vertical'].includes('เห็น 1 จุด/ชั้น ที่ขาในคาน')&&v['support-vertical'].includes('ขาในหูช้างอยู่นอกกรอบ'));
    assert.ok(!v['support-vertical'].includes('ปลอกแนวนอน 2 ขาต่อชั้น'));
    assert.deepEqual(keys(v['support-vertical']),['02','05']);
    assert.ok(!v['support-vertical'].includes('data-steel-family="As"'));
    assert.equal(JSON.stringify({s,g}),before,'drafting mutated engineering data');
  }
});

test('manual position strips distinguish the beam-face datum from real hoops and disclose actual cover',()=>{
  const s=snapshot(),g=G.build(s),v=views(G.section(s));
  const strips=[...v['section-map'].matchAll(/<g data-manual-projection-strip="(04|05)">([\s\S]*?)(?=<g data-manual-projection-strip=|<text x="36\.000" y="675\.000")/g)];
  assert.equal(strips.length,2);
  for(const [_,id,body] of strips){assert.equal((body.match(/data-plan-manual=/g)||[]).length,id==='04'?g.verticalTies.length:g.supportTies.length);assert.ok(body.includes('data-cad-line="datum"'));assert.ok(body.includes('stroke-dasharray="7 4" opacity=".65"'));assert.ok(!body.includes('data-cad-line="outline"'));}
  assert.ok(v['section-map'].includes('เส้นประ = หน้าคาน'));assert.ok(v['corbel-vertical'].includes('cover ข้างจริง 49 mm'));assert.ok(v['corbel-vertical'].includes('Aₛ จาก h−d = 70 mm ตาม Engine'));assert.ok(v.side.includes('ฉายเหล็กทุก z'));
});

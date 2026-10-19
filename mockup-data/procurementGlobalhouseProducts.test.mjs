import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./procurement-globalhouse-products.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'procurement-globalhouse-products.js' });

const snapshot = sandbox.window.PROCUREMENT_GLOBALHOUSE_PRODUCT_SNAPSHOT;
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.retailer, 'Global House');
assert.equal(snapshot.branch, 'สาขาปทุมธานี');
assert.equal(snapshot.products.length, 555);

const familyCounts = Object.fromEntries(snapshot.families.map(family => [
  family.id,
  snapshot.products.filter(product => product.family === family.id).length,
]));
assert.deepEqual(familyCounts, {
  RB: 9,
  DB: 14,
  CEMENT_MIXED: 14,
  MORTAR_READY: 26,
  PVC_PIPE_85: 11,
  PVC_COUPLING: 4,
  PVC_REDUCER: 24,
  PVC_TEE: 9,
  PVC_UNION: 6,
  PVC_BALL_VALVE: 39,
  PVC_SOLVENT_CEMENT: 25,
  PTFE_TAPE: 9,
  PVC_ELBOW_90: 9,
  PVC_ELBOW_45: 7,
  PPR_PIPE: 18,
  PPR_ELBOW: 28,
  PPR_TEE: 28,
  PPR_COUPLING: 19,
  PPR_THREADED: 13,
  PPR_UNION: 11,
  PPR_VALVE: 12,
  PPR_ACCESSORY: 19,
  STEEL_PIPE_THREADED: 18,
  STEEL_PIPE_PREZINC: 6,
  STEEL_PIPE_NIPPLE: 11,
  STEEL_ELBOW: 28,
  STEEL_TEE_CROSS: 31,
  STEEL_COUPLING: 33,
  STEEL_NIPPLE_UNION: 17,
  STEEL_END_FLANGE: 21,
  STEEL_HOSE_TAIL: 16,
  STEEL_CLAMP: 20,
});

const sizes = family => [...new Set(snapshot.products
  .filter(product => product.family === family)
  .map(product => product.sizeMm))].sort((left, right) => left - right);
assert.deepEqual(sizes('RB'), [6, 9, 12, 15]);
assert.deepEqual(sizes('DB'), [12, 16, 20, 25, 32]);
assert.deepEqual(sizes('PVC_PIPE_85'), [18, 20, 25, 35, 40, 55, 65, 80, 100, 150]);
assert.deepEqual(sizes('PVC_COUPLING'), [18, 20, 25, 55]);
assert.deepEqual(sizes('PVC_REDUCER'), [20, 25, 35, 40, 55, 65, 80, 100]);
assert.deepEqual(sizes('PVC_TEE'), [18, 20, 25, 35, 40, 55, 65, 80, 100]);
assert.deepEqual(sizes('PVC_UNION'), [18, 20, 25, 40, 55]);
assert.deepEqual(sizes('PVC_BALL_VALVE'), [18, 20, 25, 40, 55, 80, 100]);
assert.deepEqual(sizes('PVC_ELBOW_90'), [18, 20, 25, 35, 40, 55, 65, 80, 100]);
assert.deepEqual(sizes('PVC_ELBOW_45'), [18, 20, 25, 40, 55, 65, 100]);
assert.deepEqual(sizes('PPR_PIPE'), [20, 25, 32, 40, 50, 63, 90, 110]);
assert.deepEqual(sizes('PPR_ELBOW'), [20, 25, 32, 40, 50, 63, 110]);
assert.deepEqual(sizes('PPR_TEE'), [20, 25, 32, 40, 50, 63, 90]);
assert.deepEqual(sizes('PPR_COUPLING'), [20, 25, 32, 40, 50, 63]);
assert.deepEqual(sizes('PPR_THREADED'), [20, 25, 40, 50, 63]);
assert.deepEqual(sizes('PPR_UNION'), [20, 25, 32, 40, 50, 63]);
assert.deepEqual(sizes('PPR_VALVE'), [20, 25, 32, 40, 50, 63]);
assert.deepEqual(sizes('PPR_ACCESSORY'), [20, 25, 32, 40, 50, 63]);
assert.deepEqual(sizes('STEEL_PIPE_THREADED'), [15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(sizes('STEEL_PIPE_PREZINC'), [15, 20, 25, 32, 40, 50]);
assert.deepEqual(sizes('STEEL_PIPE_NIPPLE'), [15, 20, 25]);
assert.deepEqual(sizes('STEEL_ELBOW'), [15, 20, 25, 32, 40, 50, 65, 80, 100, 150]);
assert.deepEqual(sizes('STEEL_TEE_CROSS'), [15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(sizes('STEEL_COUPLING'), [15, 20, 25, 32, 40, 50, 65, 80, 100, 150]);
assert.deepEqual(sizes('STEEL_NIPPLE_UNION'), [15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(sizes('STEEL_END_FLANGE'), [15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(sizes('STEEL_HOSE_TAIL'), [15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(sizes('STEEL_CLAMP'), [8, 10, 15, 20, 25, 32, 40, 50, 65, 80, 100]);
assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'PVC_SOLVENT_CEMENT' && product.weightG).map(product => product.weightG))].sort((left, right) => left - right),
  [40, 50, 100, 125, 200, 250, 400, 500, 1000],
);
assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'PTFE_TAPE').map(product => product.widthMm))].sort((left, right) => left - right),
  [12, 25],
);
assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'PTFE_TAPE').map(product => product.lengthM))].sort((left, right) => left - right),
  [10, 20, 25],
);

const ids = snapshot.products.map(product => product.id);
assert.equal(new Set(ids).size, ids.length, 'SKU IDs must be unique');
assert.equal(typeof snapshot.compareProducts, 'function');

const sortedIds = family => Array.from(snapshot.products)
  .filter(product => product.family === family)
  .sort(snapshot.compareProducts)
  .map(product => product.sku);
assert.deepEqual(sortedIds('RB'), [
  '06050601', '06070601', '021803221402',
  '06050901', '06070901', '0619006560018', '0610024790001',
  '06051201', '06051501',
]);
assert.deepEqual(sortedIds('DB'), [
  '06041201', '06072121', '0619843660001',
  '06061601', '06072161', '0619006560002',
  '06042005', '06072201',
  '06062502', '06072251', '0619003409706', '0619006560004',
  '021810013738', '021810013101',
]);
assert.deepEqual(sortedIds('PVC_PIPE_85'), [
  '8858721510672', '8858721510689', '8858721510696', '8858721510702',
  '8858721510719', '8858721510726', '8858721510733', '8858721510740',
  '8858721510757', '8858721511082', '8858721510771',
]);
assert.deepEqual(sortedIds('PVC_COUPLING'), [
  '8858721530014', '8858721530021', '8858721530038', '8858721530069',
]);
assert.deepEqual(sortedIds('PVC_UNION'), [
  '8858721531523', '8858721531530', '8858721531622',
  '8858721531547', '8858721531554', '8858721531561',
]);
assert.deepEqual(
  Array.from(snapshot.products)
    .filter(product => product.family === 'PVC_REDUCER')
    .sort(snapshot.compareProducts)
    .map(product => `${product.sizeMm}x${product.outletSizeMm}`),
  [
    '20x18',
    '25x18', '25x20',
    '35x20', '35x25',
    '40x18', '40x20', '40x25', '40x35',
    '55x18', '55x20', '55x35', '55x40',
    '65x20', '65x25', '65x40', '65x55',
    '80x35', '80x40', '80x65',
    '100x40', '100x55', '100x65', '100x80',
  ],
);
assert.deepEqual(
  Array.from(snapshot.products)
    .filter(product => product.family === 'PVC_BALL_VALVE')
    .sort(snapshot.compareProducts)
    .map(product => product.sizeMm),
  [18, 18, 18, 18, 18, 18, 18, 18, 18, 20, 20, 20, 20, 20, 20, 20, 25, 25, 25, 25, 25, 25, 40, 40, 40, 40, 40, 40, 40, 55, 55, 55, 55, 55, 55, 55, 80, 80, 100],
);
assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'PPR_PIPE').map(product => product.pressureClass))].sort((left, right) => Number(left) - Number(right)),
  ['10', '12.5', '20', '25'],
);
assert.equal(snapshot.products.filter(product => product.family === 'PPR_ELBOW' && product.angle === 45).length, 9);
assert.equal(snapshot.products.filter(product => product.family === 'PPR_ELBOW' && product.angle === 90).length, 19);
assert.equal(snapshot.products.filter(product => product.family === 'PPR_PIPE' && product.preorder).length, 6);
assert.equal(snapshot.products.filter(product => product.family !== 'PPR_PIPE' && product.family.startsWith('PPR_') && product.preorder).length, 4);
for (const family of ['PPR_PIPE', 'PPR_ELBOW', 'PPR_TEE', 'PPR_COUPLING', 'PPR_THREADED', 'PPR_UNION', 'PPR_VALVE', 'PPR_ACCESSORY']) {
  const orderedSizes = Array.from(snapshot.products)
    .filter(product => product.family === family)
    .sort(snapshot.compareProducts)
    .map(product => product.sizeMm);
  assert.deepEqual(orderedSizes, Array.from(orderedSizes).sort((left, right) => left - right), `${family} must sort by nominal PPR size`);
}
assert.deepEqual(
  Object.fromEntries(['8859620815530', '6222003112267'].map(sku => {
    const product = snapshot.products.find(item => item.sku === sku);
    return [sku, [product.sizeMm, product.outletSizeMm]];
  })),
  {
    8859620815530: [20, 18],
    6222003112267: [50, 40],
  },
);
assert.deepEqual(
  Object.fromEntries(['3222006570111', '3222006570500', '3310022850011'].map(sku => {
    const product = snapshot.products.find(item => item.sku === sku);
    return [sku, [product.sizeMm, product.outletSizeMm]];
  })),
  {
    3222006570111: [20, 15],
    3222006570500: [50, 15],
    3310022850011: [65, 40],
  },
);
assert.deepEqual(
  Object.fromEntries(['32001004', '32002040', '3222006571415', '8859177008195'].map(sku => {
    const product = snapshot.products.find(item => item.sku === sku);
    return [sku, [product.family, product.sizeMm, product.pipeClass || null, product.lengthCm || null, product.packQty || null]];
  })),
  {
    32001004: ['STEEL_PIPE_THREADED', 15, 'S', null, null],
    32002040: ['STEEL_PIPE_THREADED', 100, 'M', null, null],
    3222006571415: ['STEEL_PIPE_NIPPLE', 15, null, 10, null],
    8859177008195: ['STEEL_CLAMP', 8, null, null, 10],
  },
);

const sortedSolventWeights = Array.from(snapshot.products)
  .filter(product => product.family === 'PVC_SOLVENT_CEMENT')
  .sort(snapshot.compareProducts)
  .map(product => product.weightG);
assert.equal(sortedSolventWeights.at(-1), null, 'solvent cement without a published weight must sort last');
assert.deepEqual(sortedSolventWeights.filter(Boolean), Array.from(sortedSolventWeights.filter(Boolean)).sort((left, right) => left - right));

for (const product of snapshot.products) {
  assert.equal(product.price, product.priceMax, `${product.id} must use the conservative maximum price`);
  assert.ok(product.priceMin > 0 && product.priceMax >= product.priceMin);
  assert.match(product.sourceUrl, /^https:\/\/globalhouse\.co\.th\/product\/item-i\.\d+$/);
  assert.match(product.officialCategoryUrl, /^https:\/\/globalhouse\.co\.th\/category\/(8699|8700|8713|8714|8889|8890|8891|8892|8893|8894|8895|8896|8897)$/);
  assert.match(product.image, /^https:\/\/(?:www\.|st\.)image-gbh\.com\//);
  if (product.family === 'RB' || product.family === 'DB') {
    assert.ok(product.specTokens.includes(`Ø${product.sizeMm} มม.`));
  } else if (product.family === 'PVC_SOLVENT_CEMENT') {
    assert.ok(product.specTokens.includes(product.brand));
    if (product.weightG) assert.ok(product.specTokens.includes(`${product.weightG} กรัม`));
  } else if (product.family === 'PTFE_TAPE') {
    assert.ok(product.specTokens.includes(`กว้าง ${product.widthMm} มม.`));
  } else if (product.family.startsWith('PPR_')) {
    assert.ok(product.specTokens.includes('PPR'));
    assert.ok(product.specTokens.includes(`${product.sizeMm} มม.`));
  } else if (product.family.startsWith('STEEL_')) {
    assert.ok(product.specTokens.includes(`DN${product.sizeMm}`));
    assert.ok(product.specTokens.includes(`${product.sizeInch} นิ้ว`));
  } else if (product.family.startsWith('PVC_')) {
    assert.ok(product.specTokens.includes(`${product.sizeMm} มม.`));
  } else {
    assert.ok(product.specTokens.includes(product.brand));
  }
}

assert.ok(snapshot.products.filter(product => product.family === 'RB').every(product => product.grade === 'SR24'));
assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'DB').map(product => product.grade))].sort(),
  ['SD40', 'SD50'],
);

assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'CEMENT_MIXED').map(product => product.brand))].sort(),
  ['BIG BEAR', 'DURA ONE', 'TPI', 'นกอินทรี'],
);

assert.deepEqual(
  [...new Set(snapshot.products.filter(product => product.family === 'MORTAR_READY').map(product => product.brand))].sort(),
  ['DURA ONE', 'M BUILD', 'TPI', 'ดูร่าวัน'],
);
assert.equal(snapshot.products.filter(product => product.family === 'MORTAR_READY' && product.preorder).length, 16);
assert.equal(snapshot.products.filter(product => product.family === 'PVC_SOLVENT_CEMENT' && product.preorder).length, 6);
assert.equal(snapshot.products.filter(product => product.family === 'STEEL_PIPE_THREADED' && product.preorder).length, 6);
assert.equal(snapshot.products.filter(product => product.family === 'STEEL_PIPE_PREZINC' && product.preorder).length, 1);
assert.equal(snapshot.products.filter(product => product.family.startsWith('STEEL_') && !['STEEL_PIPE_THREADED', 'STEEL_PIPE_PREZINC'].includes(product.family) && product.preorder).length, 0);
assert.equal(snapshot.products.filter(product => product.officialCategoryUrl === 'https://globalhouse.co.th/category/8896').length, 35);
assert.equal(snapshot.products.filter(product => product.officialCategoryUrl === 'https://globalhouse.co.th/category/8897').length, 166);
assert.ok(snapshot.products.filter(product => ['PVC_COUPLING', 'PVC_REDUCER', 'PVC_TEE', 'PVC_UNION'].includes(product.family)).every(product => product.pressureClass === '13.5'));
assert.ok(snapshot.products.filter(product => ['PVC_BALL_VALVE', 'PVC_SOLVENT_CEMENT', 'PTFE_TAPE'].includes(product.family)).every(product => product.checkedAt === snapshot.plumbingAccessoriesCapturedAt));
assert.ok(snapshot.products.filter(product => product.family.startsWith('PPR_')).every(product => product.checkedAt === snapshot.pprCapturedAt));
assert.ok(snapshot.products.filter(product => product.family.startsWith('STEEL_')).every(product => product.checkedAt === snapshot.steelPlumbingCapturedAt));
assert.ok(snapshot.products.filter(product => !['PVC_BALL_VALVE', 'PVC_SOLVENT_CEMENT', 'PTFE_TAPE'].includes(product.family) && !product.family.startsWith('PPR_') && !product.family.startsWith('STEEL_')).every(product => product.checkedAt === snapshot.capturedAt));

console.log(`✓ procurementGlobalhouseProducts.test.mjs — ${snapshot.products.length} official cement, mortar, RB, DB, PVC, PPR and steel-pipe SKU snapshots verified`);

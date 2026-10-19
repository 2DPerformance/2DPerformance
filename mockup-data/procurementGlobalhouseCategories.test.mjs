import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./procurement-globalhouse-categories.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'procurement-globalhouse-categories.js' });

const tree = sandbox.window.PROCUREMENT_RETAIL_CATEGORY_TREE;
assert.equal(tree.schemaVersion, 1);
assert.equal(tree.retailer, 'Global House');
assert.deepEqual(Array.from(tree.departments, ({ id }) => id), ['cement', 'steel', 'plumbing']);
assert.deepEqual(
  Array.from(tree.departments, ({ url }) => url),
  [
    'https://globalhouse.co.th/category/8697',
    'https://globalhouse.co.th/category/8711',
    'https://globalhouse.co.th/category/8871',
  ],
);

const groups = tree.departments.flatMap((department) => Array.from(department.groups));
const leaves = groups.flatMap((group) => Array.from(group.children));
const urls = [...tree.departments, ...groups, ...leaves].map((item) => item.url);
assert.equal(new Set(urls).size, urls.length, 'category URLs must be unique');
assert.ok(urls.every((url) => /^https:\/\/globalhouse\.co\.th\/category\/\d+$/.test(url)));
assert.equal(leaves.length, 95, 'the three requested departments should include every captured leaf category');

const leafNames = new Set(leaves.map((leaf) => leaf.name));
for (const requiredName of [
  'ปูนซิเมนต์ผสม',
  'เหล็กข้ออ้อย',
  'เหล็ก H-Beam',
  'ปั๊มน้ำอัตโนมัติ',
  'ท่อพีวีซีสีฟ้า',
  'ระบบวาล์ว',
]) assert.ok(leafNames.has(requiredName), `missing category: ${requiredName}`);

console.log(`✓ procurementGlobalhouseCategories.test.mjs — ${tree.departments.length} departments, ${groups.length} groups and ${leaves.length} official category links verified`);

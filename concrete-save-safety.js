/* Storage acknowledgement only. Never changes calculation inputs or results. */
(function installConcreteSaveSafety(global) {
  'use strict';
  if (global.SVConcreteSaveSafety) return;
  const pending = new Map();
  let banner;
  function render() {
    const doc = global.document;
    if (!doc?.body) return;
    if (!banner) {
      banner = doc.createElement('section');
      banner.id = 'sv-concrete-unsaved';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      banner.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483600;background:oklch(97.8% .009 250);color:oklch(26% .055 257);border:1px solid currentColor;border-radius:6px;padding:12px;max-height:40vh;overflow:auto;font:14px/1.5 Sarabun,system-ui,sans-serif';
      const text = doc.createElement('div');
      text.dataset.saveMessage = '';
      banner.append(text);
      for (const [label, action] of [['ลองบันทึกอีกครั้ง', retry], ['ดาวน์โหลดข้อมูลกู้คืน JSON', rescue]]) {
        const button = doc.createElement('button');
        button.type = 'button'; button.textContent = label;
        button.style.cssText = 'min-height:44px;margin:8px 8px 0 0;padding:6px 12px;font:inherit';
        button.addEventListener('click', action); banner.append(button);
      }
      doc.body.append(banner);
      const style = doc.createElement('style');
      style.textContent = '@media print{#sv-concrete-unsaved{display:none!important}}';
      doc.head?.append(style);
    }
    banner.hidden = pending.size === 0;
    banner.querySelector('[data-save-message]').textContent = 'ยังบันทึกไม่ได้: ' + [...pending.values()].map(item => item.label).join(', ') + ' ข้อมูลล่าสุดยังอยู่ในแท็บนี้ อย่าเพิ่งปิดหรือรีเฟรช ลองบันทึกอีกครั้งหรือดาวน์โหลดข้อมูลกู้คืน (ไม่ใช่ไฟล์โครงการครบชุด)';
  }
  function attempt(item) {
    try {
      const storage = item.storage || global.localStorage;
      storage.setItem(item.key, item.serialized);
      if (storage.getItem(item.key) !== item.serialized) throw new Error('storage_readback_mismatch');
      pending.delete(item.key); render(); return true;
    } catch (error) {
      pending.set(item.key, item); render(); return false;
    }
  }
  function writeJSON(key, value, label, storage) {
    let serialized;
    try { serialized = JSON.stringify(value); if (serialized === undefined) throw new Error('invalid_json'); }
    catch (error) { global.alert?.('ยังบันทึกไม่ได้: ข้อมูลไม่อยู่ในรูปแบบ JSON กรุณาคงแท็บนี้ไว้'); return false; }
    return attempt({ key, serialized, label: label || key, storage });
  }
  function retry() { for (const item of [...pending.values()]) attempt(item); return pending.size === 0; }
  function rescue() {
    try {
      const data = Object.fromEntries([...pending].map(([key, item]) => [key, JSON.parse(item.serialized)]));
      const blob = new Blob([JSON.stringify({ schema: 'sv.concrete.storage-rescue.v1', exportedAt: new Date().toISOString(), scope: 'failed-storage-records-only-not-full-project', data }, null, 2)], { type: 'application/json' });
      const url = global.URL.createObjectURL(blob), a = global.document.createElement('a');
      a.href = url; a.download = 'concrete-unsaved.rescue.json'; global.document.body.append(a); a.click(); a.remove();
      global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
      return true; // Download request only; it does not acknowledge storage or clear pending data.
    } catch (error) { global.alert?.('ดาวน์โหลดข้อมูลกู้คืนไม่ได้ กรุณาคงแท็บนี้ไว้และลองอีกครั้ง'); return false; }
  }
  global.SVConcreteSaveSafety = Object.freeze({ writeJSON, retry, rescue, pendingJSON: key => pending.has(key) ? JSON.parse(pending.get(key).serialized) : undefined, pendingCount: () => pending.size });
  global.addEventListener?.('DOMContentLoaded', render, { once: true });
  global.addEventListener?.('beforeunload', event => { if (pending.size) { event.preventDefault(); event.returnValue = ''; } });
})(window);

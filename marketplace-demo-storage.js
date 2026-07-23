(function installMarketplaceDemoStorage() {
  'use strict';
  try {
    var params = new URLSearchParams(window.location.search || '');
    var app = String(params.get('sv-demo') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    var session = String(params.get('sv-demo-session') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!app || !session || typeof Storage === 'undefined') return;
    var prefix = '__sv_demo__' + app + '__' + session + '__';
    var proto = Storage.prototype;
    var rawGet = proto.getItem;
    var rawSet = proto.setItem;
    var rawRemove = proto.removeItem;
    var rawKey = proto.key;
    var lengthDescriptor = Object.getOwnPropertyDescriptor(proto, 'length');
    var rawLength = lengthDescriptor && lengthDescriptor.get;
    var keysFor = function (storage) {
      var keys = [];
      var length = rawLength ? Number(rawLength.call(storage)) : 0;
      for (var index = 0; index < length; index += 1) {
        var key = rawKey.call(storage, index);
        if (key && key.indexOf(prefix) === 0) keys.push(key);
      }
      return keys;
    };
    proto.getItem = function (key) { return rawGet.call(this, prefix + String(key)); };
    proto.setItem = function (key, value) { return rawSet.call(this, prefix + String(key), String(value)); };
    proto.removeItem = function (key) { return rawRemove.call(this, prefix + String(key)); };
    proto.clear = function () { keysFor(this).forEach(function (key) { rawRemove.call(this, key); }, this); };
    proto.key = function (index) {
      var key = keysFor(this)[Number(index)];
      return key ? key.slice(prefix.length) : null;
    };
    if (rawLength && (!lengthDescriptor || lengthDescriptor.configurable !== false)) {
      Object.defineProperty(proto, 'length', {
        configurable: true,
        enumerable: lengthDescriptor.enumerable,
        get: function () { return keysFor(this).length; },
      });
    }
    window.__svMarketplaceDemoContext = { appKey: app, sessionId: session, storagePrefix: prefix };
  } catch (error) {
    console.error('[demo-storage] sandbox setup failed', error);
  }
}());

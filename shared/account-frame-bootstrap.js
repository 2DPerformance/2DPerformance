/* Static workbenches inherit the already authenticated parent workspace before
 * any tool code reads storage. Direct links return to their normal SPA route. */
(function accountFrameBootstrap(root) {
  'use strict';
  var script = root.document.currentScript;
  var requestedRoute = script && script.getAttribute('data-account-route');
  var route = typeof requestedRoute === 'string' && /^\/[a-z0-9/-]*$/.test(requestedRoute)
    && requestedRoute.indexOf('//') === -1 ? requestedRoute : '/';
  try {
    if (root.parent === root || root.parent.location.origin !== root.location.origin) throw new Error('parent_required');
    var parentRuntime = root.parent.__svAccountWorkspaceRuntime;
    var runtime = root.__svAccountWorkspaceRuntime;
    if (!parentRuntime || !runtime || parentRuntime.isFrozen() || !parentRuntime.getContext()) throw new Error('workspace_required');
    var params = new URLSearchParams(root.location.search || '');
    var app = String(params.get('sv-demo') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    var session = String(params.get('sv-demo-session') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    var partition = app && session ? '__sv_demo__' + app + '__' + session + '__' : '';
    var context = runtime.install(partition ? { partition: partition } : undefined);
    var parentContext = parentRuntime.getContext();
    if (runtime.isFrozen() || !context || context.kind !== parentContext.kind || context.ownerId !== parentContext.ownerId
      || (context.partition || '') !== (partition || parentContext.partition || '')) throw new Error('workspace_mismatch');
    return;
  } catch (_) {
    root.document.documentElement.hidden = true;
    root.stop();
    root.location.replace(route);
  }
})(window);

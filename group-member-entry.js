/* Entry guard for the existing static apps now covered by group membership.
 * The parent SPA owns authentication, expiry and the hard/soft lock. This is
 * a normal-navigation guard, not server-side protection of static source code.
 */
(function () {
  'use strict';
  var routes = { 'footing-f2-f8': '/footing-f2-f8', 'billboard-design': '/billboard-design', boqtrace: '/boq-traceability', 'drawing-takeoff': '/drawing-takeoff', 'daily-report': '/daily-report' };
  var product = document.currentScript && document.currentScript.getAttribute('data-member-product');
  var route = Object.prototype.hasOwnProperty.call(routes, product) ? routes[product] : '/';
  var allowed = false;
  try {
    allowed = route !== '/' && window.parent !== window.self
      && window.parent.location.origin === window.location.origin
      && window.parent.location.pathname.replace(/\/+$/, '') === route
      && window.frameElement.getAttribute('data-group-member-product') === product;
  } catch (_) { allowed = false; }
  if (allowed) return;
  document.documentElement.style.visibility = 'hidden';
  window.stop();
  window.location.replace(route);
})();

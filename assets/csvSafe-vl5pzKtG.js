import{c}from"./main-BwruLm9s.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=c("Receipt",[["path",{d:"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z",key:"q3az6g"}],["path",{d:"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8",key:"1h4pet"}],["path",{d:"M12 17.5v-11",key:"1jc1ny"}]]),s=/^(?:[\t\r]|\s*[=+\-@])/u,a=/[",\r\n]/u;function o(t){let e;try{e=String(t??"")}catch{e="[invalid cell]"}const r=!(typeof t=="number"&&Number.isFinite(t))&&s.test(e)?`'${e}`:e;return a.test(r)?`"${r.replace(/"/g,'""')}"`:r}function y(t=[],{bom:e=!0}={}){const r=(Array.isArray(t)?t:[]).map(i=>(Array.isArray(i)?i:[i]).map(o).join(",")).join(`\r
`);return`${e?"\uFEFF":""}${r}`}export{u as R,y as s};

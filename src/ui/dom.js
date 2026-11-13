// Tiny DOM helper: h('div.cls#id', {attrs/onclick}, children...)
export function h(sel, attrs, ...kids) {
  const [tagCls, id] = sel.split('#'), [tag, ...cls] = tagCls.split('.');
  const el = document.createElement(tag || 'div'); if (cls.length) el.className = cls.join(' '); if (id) el.id = id;
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else if (k === 'style') el.style.cssText = v; else if (v === true) el.setAttribute(k, ''); else if (v !== false && v != null) el.setAttribute(k, v); }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const fmt = (x, d = 1, unit = '') => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d) + unit);
export const btn = (label, onclick, cls = '') => h('button.btn' + (cls ? '.' + cls : ''), { onclick }, label);

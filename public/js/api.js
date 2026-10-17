export const state = {
  user: null,
  pendingJoin: sessionStorage.getItem('elc_pending_join') || null,
};

export function setPendingJoin(token) {
  state.pendingJoin = token;
  if (token) sessionStorage.setItem('elc_pending_join', token);
  else sessionStorage.removeItem('elc_pending_join');
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchMe() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch {
    state.user = null;
  }
  return state.user;
}

export function go(hash) {
  if (location.hash === hash) renderAgain();
  else location.hash = hash;
}

let rerender = () => {};
export function bindRenderer(fn) {
  rerender = fn;
}
export function renderAgain() {
  rerender();
}

// ---------- tiny DOM helpers ----------
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(root, ...children) {
  clear(root);
  append(root, children);
}

export function fmtDate(value) {
  if (!value) return '';
  const d = new Date(String(value).includes('T') ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(String(value).includes('T') ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function slugName(text) {
  return String(text || 'certificate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------- modal ----------
export function modal({ title, body, actions, wide = false, onClose }) {
  const root = document.getElementById('modal-root');
  const overlay = h('div', {
    class: 'modal-overlay',
    onclick: (e) => {
      if (e.target === overlay) close();
    },
  });
  const dialog = h('div', { class: `modal ${wide ? 'modal-wide' : ''}`, role: 'dialog' });
  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 150);
    if (onClose) onClose();
  };
  dialog.append(
    h(
      'div',
      { class: 'modal-head' },
      h('h3', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: () => close() }, '×')
    ),
    h('div', { class: 'modal-body' })
  );
  const bodyEl = dialog.querySelector('.modal-body');
  if (typeof body === 'function') {
    const out = body({ close });
    append(bodyEl, [out]);
  } else {
    append(bodyEl, [body]);
  }
  if (actions && actions.length) {
    dialog.append(h('div', { class: 'modal-actions' }, actions({ close })));
  }
  root.append(overlay);
  overlay.append(dialog);
  requestAnimationFrame(() => overlay.classList.add('open'));
  const esc = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', esc);
    }
  };
  document.addEventListener('keydown', esc);
  return { close, bodyEl };
}

export function confirmModal(message, onYes, { danger = true, label = 'Confirm' } = {}) {
  modal({
    title: 'Please confirm',
    body: h('p', { class: 'muted' }, message),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: `btn ${danger ? 'danger' : 'primary'}`,
          onClick: async (e) => {
            e.preventDefault();
            try {
              await onYes();
              close();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        label
      ),
    ],
  });
}

// ---------- toast ----------
export function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  const node = h('div', { class: `toast toast-${kind}` }, message);
  root.append(node);
  setTimeout(() => node.classList.add('show'), 20);
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, 3600);
}

export function badge(text, kind = 'neutral') {
  return h('span', { class: `badge badge-${kind}` }, text);
}

export function pageHeader(title, subtitle, ...actions) {
  return h(
    'div',
    { class: 'page-head' },
    h('div', {}, h('h1', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    actions.length ? h('div', { class: 'page-actions' }, ...actions) : null
  );
}

export function emptyState(message) {
  return h('div', { class: 'empty-state' }, h('p', {}, message));
}

export function statCard(label, value, tone = '') {
  return h('div', { class: `stat ${tone}` }, h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, label));
}

export function formRow(label, control, hint) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null
  );
}

export function textInput(attrs = {}) {
  return h('input', { class: 'input', type: 'text', ...attrs });
}

export function selectInput(options, attrs = {}) {
  const sel = h('select', { class: 'input', ...attrs });
  for (const opt of options) {
    const o = h('option', { value: String(opt.value) }, opt.label);
    if (opt.selected) o.selected = true;
    sel.append(o);
  }
  return sel;
}

export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}
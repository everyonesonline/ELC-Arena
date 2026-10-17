import {
  state,
  fetchMe,
  go,
  bindRenderer,
  h,
  mount,
  clear,
  toast,
  api,
} from './api.js';
import { renderLogin } from './views/login.js';
import { renderStudent } from './views/student.js';
import { renderTeacher, renderQuizEditor, renderAttempts } from './views/teacher.js';
import {
  renderAdmin,
  renderAccess,
  renderCertificateDesign,
  renderIssuedCertificate,
} from './views/admin.js';
import { renderTakeQuiz, renderJoin } from './views/quiz.js';
import { renderCertificateView } from './certificate.js';

const app = document.getElementById('app');

const ROUTES = [
  { re: /^#\/login$/, roles: null, view: () => renderLogin(app) },
  { re: /^#\/join\/(.+)$/, roles: ['student'], view: (m) => renderJoin(viewRoot(), m[1]) },
  { re: /^#\/student$/, roles: ['student'], view: () => renderStudent(viewRoot()) },
  { re: /^#\/quiz\/(\d+)$/, roles: ['student'], view: (m) => renderTakeQuiz(viewRoot(), Number(m[1])) },
  { re: /^#\/teacher$/, roles: ['teacher', 'admin'], view: () => renderTeacher(viewRoot()) },
  { re: /^#\/editor\/(\d+)$/, roles: ['teacher', 'admin'], view: (m) => renderQuizEditor(viewRoot(), Number(m[1])) },
  { re: /^#\/attempts\/(\d+)$/, roles: ['teacher', 'admin'], view: (m) => renderAttempts(viewRoot(), Number(m[1])) },
  { re: /^#\/access\/(\d+)$/, roles: ['admin'], view: (m) => renderAccess(viewRoot(), Number(m[1])) },
  { re: /^#\/certificate-design\/(\d+)$/, roles: ['admin'], view: (m) => renderCertificateDesign(viewRoot(), Number(m[1])) },
  { re: /^#\/issued\/(\d+)$/, roles: ['admin', 'teacher'], view: (m) => renderIssuedCertificate(viewRoot(), Number(m[1])) },
  { re: /^#\/certificate\/(\d+)$/, roles: ['admin', 'teacher', 'student'], view: (m) => renderCertificateView(viewRoot(), Number(m[1])) },
  { re: /^#\/admin$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'overview') },
  { re: /^#\/admin\/users$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'users') },
  { re: /^#\/admin\/programs$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'programs') },
  { re: /^#\/admin\/quizzes$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'quizzes') },
  { re: /^#\/admin\/certificates$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'certificates') },
  { re: /^#\/admin\/settings$/, roles: ['admin'], view: () => renderAdmin(viewRoot(), 'settings') },
];

export function homeFor(role) {
  if (role === 'admin') return '#/admin';
  if (role === 'teacher') return '#/teacher';
  if (role === 'student') return '#/student';
  return '#/login';
}

async function render() {
  const hash = location.hash || '#/login';
  const route = ROUTES.find((r) => r.re.test(hash));

  if (!route) {
    if (!state.user) {
      location.hash = '#/login';
      return;
    }
    go(homeFor(state.user.role));
    return;
  }

  if (!state.user) {
    if (hash !== '#/login') {
      sessionStorage.setItem('elc_after_login', hash);
      location.hash = '#/login';
      return;
    }
  }

  if (hash === '#/login' && state.user) {
    go(homeFor(state.user.role));
    return;
  }

  if (route.roles && state.user && !route.roles.includes(state.user.role)) {
    toast('You do not have access to that page', 'error');
    go(homeFor(state.user.role));
    return;
  }

  const match = hash.match(route.re);
  try {
    if (route.roles) renderShell(hash);
    else clear(app);
    app.classList.remove('app-loading');
    await route.view(match);
  } catch (err) {
    console.error(err);
    if (err && err.status === 401) {
      state.user = null;
      location.hash = '#/login';
      toast('Your session ended — please sign in again', 'error');
      return;
    }
    mount(
      app,
      h(
        'div',
        { class: 'panel error-panel' },
        h('h2', {}, 'Something went wrong'),
        h('p', { class: 'muted' }, err && err.message ? err.message : 'Unexpected error'),
        h('button', { class: 'btn primary', onClick: () => render() }, 'Try again')
      )
    );
  }
}

function shellHeader(hash) {
  const user = state.user;
  const links = [];
  if (user.role === 'admin') {
    links.push(
      ['#/admin', 'Overview'],
      ['#/admin/quizzes', 'Quizzes'],
      ['#/admin/users', 'Students & Teachers'],
      ['#/admin/programs', 'Programs'],
      ['#/admin/certificates', 'Certificates'],
      ['#/admin/settings', 'Settings']
    );
  } else if (user.role === 'teacher') {
    links.push(['#/teacher', 'My Quizzes']);
  }

  const isActive = (href) =>
    hash === href ||
    (href === '#/teacher' && hash.startsWith('#/teacher')) ||
    (href === '#/admin' && hash === '#/admin') ||
    (href !== '#/admin' && hash.startsWith(href));

  return h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar-inner' },
      h(
        'a',
        { class: 'brand', href: user ? homeFor(user.role) : '#/login' },
        h('span', { class: 'brand-mark' }, 'E'),
        h(
          'span',
          { class: 'brand-text' },
          h('strong', {}, 'ELC Arena'),
          h('small', {}, "Everyone's Learning Center")
        )
      ),
      links.length
        ? h('nav', { class: 'nav' }, links.map(([href, label]) =>
            h('a', { href, class: isActive(href) && hash !== '#/admin' ? 'active' : hash === href ? 'active' : '' }, label)
          ))
        : h('span', { class: 'nav-note' }, user.role === 'student' ? 'Student portal' : ''),
      h(
        'div',
        { class: 'topbar-user' },
        h(
          'div',
          { class: 'user-chip' },
          h('span', { class: 'avatar' }, (user.full_name || user.username || '?').trim().slice(0, 1).toUpperCase()),
          h(
            'span',
            { class: 'user-meta' },
            h('strong', {}, user.full_name || user.username),
            h('small', {}, `${user.role[0].toUpperCase()}${user.role.slice(1)}`)
          )
        ),
        h(
          'button',
          {
            class: 'btn ghost',
            onClick: async () => {
              try {
                await api('/api/auth/logout', { method: 'POST' });
              } catch {
                /* ignore */
              }
              state.user = null;
              toast('Signed out');
              location.hash = '#/login';
            },
          },
          'Sign out'
        )
      )
    )
  );
}

function renderShell(hash) {
  clear(app);
  app.append(shellHeader(hash), h('main', { class: 'page' }, h('div', { id: 'view' })));
}

export function viewRoot() {
  return document.getElementById('view');
}

async function boot() {
  bindRenderer(render);
  await fetchMe();
  if (!location.hash) location.hash = state.user ? homeFor(state.user.role) : '#/login';
  await render();
}

window.addEventListener('hashchange', () => render());

boot();

export { render };
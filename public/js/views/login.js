import { h, mount, state, renderAgain } from '../api.js';
import { homeFor } from '../app.js';

const ROLE_COPY = {
  admin: {
    title: 'Admin sign in',
    hint: 'Manage students, teachers, quizzes and certificates.',
  },
  teacher: {
    title: 'Teacher sign in',
    hint: 'Create quizzes, share links and see who has finished.',
  },
  student: {
    title: 'Student sign in',
    hint: 'Take your assigned quizzes and download certificates.',
  },
};

export function renderLogin(root) {
  let role = 'admin';
  if (state.pendingJoin) role = 'student';

  const errorBox = h('div', { class: 'login-error', style: 'display:none' });
  const titleEl = h('h2', {}, ROLE_COPY[role].title);
  const hintEl = h('p', { class: 'muted', style: 'margin-bottom:0' }, ROLE_COPY[role].hint);

  const userInput = h('input', {
    class: 'input',
    type: 'text',
    name: 'username',
    autocomplete: 'username',
    placeholder: 'Username',
    required: true,
  });
  const passInput = h('input', {
    class: 'input',
    type: 'password',
    name: 'password',
    autocomplete: 'current-password',
    placeholder: 'Password',
    required: true,
  });
  const submitBtn = h('button', { class: 'btn primary', type: 'submit', style: 'width:100%;justify-content:center' }, 'Sign in');

  const roleTabs = h(
    'div',
    { class: 'role-tabs' },
    ...['admin', 'teacher', 'student'].map((r) =>
      h(
        'button',
        {
          type: 'button',
          class: r === role ? 'active' : '',
          onClick: (e) => {
            role = r;
            [...roleTabs.children].forEach((b) => b.classList.toggle('active', b === e.currentTarget));
            titleEl.textContent = ROLE_COPY[r].title;
            hintEl.textContent = ROLE_COPY[r].hint;
            hideError();
          },
        },
        `${r[0].toUpperCase()}${r.slice(1)}`
      )
    )
  );

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  function hideError() {
    errorBox.style.display = 'none';
  }

  const form = h(
    'form',
    {
      onsubmit: async (e) => {
        e.preventDefault();
        hideError();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';
        try {
          const { api, fetchMe } = await import('../api.js');
          await api('/api/auth/login', {
            method: 'POST',
            body: { username: userInput.value, password: passInput.value, role },
          });
          await fetchMe();
          const after = sessionStorage.getItem('elc_after_login');
          sessionStorage.removeItem('elc_after_login');
          const target = state.pendingJoin ? `#/join/${state.pendingJoin}` : after || homeFor(state.user.role);
          if (location.hash === target) renderAgain();
          else location.hash = target;
        } catch (err) {
          showError(err.message);
          passInput.value = '';
          passInput.focus();
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign in';
        }
      },
    },
    errorBox,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Username'), userInput),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Password'), passInput),
    submitBtn
  );

  mount(
    root,
    h(
      'div',
      { class: 'login-wrap' },
      h(
        'section',
        { class: 'login-hero' },
        h('span', { class: 'brand-mark' }, 'E'),
        h('h1', {}, 'ELC Arena'),
        h('p', {}, "Everyone's Learning Center quiz arena — teachers share links, students take quizzes, and every pass above 80% earns a certificate."),
        h(
          'ul',
          {},
          h('li', {}, 'Multiple choice & fill-in-the-blank questions'),
          h('li', {}, 'Math and science symbols built in'),
          h('li', {}, 'Admin-controlled access, retakes and certificates')
        )
      ),
      h(
        'section',
        { class: 'login-side' },
        h(
          'div',
          { class: 'login-card' },
          titleEl,
          hintEl,
          roleTabs,
          form,
          h('p', { class: 'login-foot' }, 'Access is granted by the admin — ask them for your account.')
        )
      )
    )
  );

  userInput.focus();
}
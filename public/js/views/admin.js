import {
  api,
  h,
  mount,
  pageHeader,
  badge,
  emptyState,
  toast,
  modal,
  confirmModal,
  formRow,
  textInput,
  selectInput,
  fmtDateTime,
  fmtDate,
  state,
} from '../api.js';
import { drawCertificate, certificateStage, downloadCertificate, CANVAS_W, CANVAS_H } from '../certificate.js';

// ============================================================
// dispatcher
// ============================================================
export async function renderAdmin(root, tab) {
  switch (tab) {
    case 'users':
      return renderUsers(root);
    case 'programs':
      return renderPrograms(root);
    case 'quizzes':
      return renderAllQuizzes(root);
    case 'certificates':
      return renderCertificates(root);
    case 'settings':
      return renderSettings(root);
    default:
      return renderOverview(root);
  }
}

// ============================================================
// overview
// ============================================================
async function renderOverview(root) {
  const o = await api('/api/admin/overview');
  mount(
    root,
    pageHeader('Admin dashboard', 'Manage everything in ELC Arena from here.'),
    h(
      'div',
      { class: 'grid grid-4', style: 'margin-bottom:20px' },
      stat('Students', o.students),
      stat('Teachers', o.teachers),
      stat('Quizzes', o.quizzes, 'gold'),
      stat('Attempts', o.attempts),
      stat('Certificates', o.certificates, 'gold'),
      stat('Programs', o.programs),
      stat('Retakes allowed', o.retakes),
      stat('Pending actions', o.retakes + Math.max(0, o.quizzes - o.certificates))
    ),
    h(
      'div',
      { class: 'grid grid-3' },
      actionCard('Students & teachers', 'Register accounts, set usernames and passwords, enrol programmes.', '#/admin/users', 'Manage users'),
      actionCard('Quizzes', 'Create quizzes, grant access, design the certificate for each quiz.', '#/admin/quizzes', 'Manage quizzes'),
      actionCard('Issued certificates', 'Edit any issued certificate and allow retakes.', '#/admin/certificates', 'Open certificates'),
      actionCard('Programs', 'Create the programmes students are enrolled in.', '#/admin/programs', 'Manage programs'),
      actionCard('Change password', 'Update the admin password for online@everyones.com.mv.', '#/admin/settings', 'Go to settings'),
      actionCard('Student portal', 'See the app exactly as a student does.', '#/student', 'View')
    )
  );
}

function stat(label, value, tone = '') {
  return h('div', { class: `stat ${tone}` }, h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, label));
}

function actionCard(title, text, href, cta) {
  return h(
    'div',
    { class: 'quiz-card' },
    h('h3', {}, title),
    h('p', { class: 'desc' }, text),
    h('div', { class: 'row' }, h('a', { class: 'btn primary sm', href }, cta))
  );
}

// ============================================================
// users
// ============================================================
async function renderUsers(root) {
  const programs = (await api('/api/programs').catch(() => ({ programs: [] }))).programs || [];
  let roleFilter = '';
  let query = '';

  const tableBox = h('div', {});

  async function load() {
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    if (query) params.set('q', query);
    const data = await api(`/api/admin/users?${params.toString()}`);
    renderTable(data.users || []);
  }

  function renderTable(users) {
    if (!users.length) {
      mount(tableBox, emptyState('No users match this filter.'));
      return;
    }
    mount(
      tableBox,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Username'), h('th', {}, 'Role'), h('th', {}, 'Program'), h('th', {}, 'Status'), h('th', { style: 'text-align:right' }, 'Actions'))
          ),
          h(
            'tbody',
            {},
            ...users.map((u) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, u.full_name), h('div', { class: 'muted', style: 'font-size:12.5px' }, u.email || '')),
                h('td', {}, h('code', {}, u.username)),
                h('td', {}, badge(u.role, u.role === 'teacher' ? 'blue' : u.role === 'admin' ? 'amber' : 'neutral')),
                h('td', {}, u.program_name || '—'),
                h('td', {}, u.active ? badge('Active', 'green') : badge('Disabled', 'red')),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:8px;justify-content:flex-end' },
                    u.role === 'admin'
                      ? h('a', { class: 'btn sm ghost', href: '#/admin/settings' }, 'Settings')
                      : h('button', { class: 'btn sm', onClick: () => userModal(u, programs, () => load()) }, 'Edit'),
                    u.role === 'admin'
                      ? null
                      : h(
                          'button',
                          {
                            class: 'btn sm danger',
                            onClick: () =>
                              confirmModal(
                                `Delete ${u.full_name || u.username}? Their quiz history and certificates are removed too.`,
                                async () => {
                                  await api(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                                  toast('User deleted');
                                  load();
                                },
                                { label: 'Delete' }
                              ),
                          },
                          'Delete'
                        )
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  const tabsRow = h(
    'div',
    { class: 'tabs' },
    ...[
      ['', 'All'],
      ['student', 'Students'],
      ['teacher', 'Teachers'],
    ].map(([value, label]) =>
      h(
        'button',
        {
          class: roleFilter === value ? 'active' : '',
          onClick: (e) => {
            roleFilter = value;
            [...tabsRow.children].forEach((b) => b.classList.toggle('active', b === e.currentTarget));
            load();
          },
        },
        label
      )
    )
  );

  const search = textInput({ placeholder: 'Search name or username…', style: 'max-width:260px' });
  let t = null;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      query = search.value.trim();
      load();
    }, 260);
  });

  mount(
    root,
    pageHeader(
      'Students & teachers',
      'Create accounts, edit usernames and passwords, enrol programmes.',
      h('button', { class: 'btn', onClick: () => userModal(null, programs, () => load(), 'teacher') }, '＋ Add teacher'),
      h('button', { class: 'btn primary', onClick: () => userModal(null, programs, () => load(), 'student') }, '＋ Add student')
    ),
    h('div', { class: 'panel' }, tabsRow, h('div', { class: 'toolbar' }, search), tableBox)
  );
  load();
}

function userModal(existing, programs, onSaved, fixedRole) {
  let role = existing ? existing.role : fixedRole || 'student';
  const fullName = textInput({ placeholder: 'e.g. Aisha Abdulla' });
  fullName.value = existing ? existing.full_name : '';
  const username = textInput({ placeholder: 'e.g. aisha or aisha@school.mv' });
  username.value = existing ? existing.username : '';
  const email = textInput({ placeholder: 'Email (optional)' });
  email.value = existing ? existing.email || '' : '';
  const password = h('input', { class: 'input', type: 'text', placeholder: existing ? 'Leave blank to keep current password' : 'At least 4 characters', autocomplete: 'new-password' });
  const program = selectInput([
    { value: '', label: '— Select program —', selected: !(existing && existing.program_id) },
    ...(programs || []).map((p) => ({ value: String(p.id), label: p.name, selected: existing && existing.program_id === p.id })),
  ]);
  const active = h('input', { type: 'checkbox', style: 'width:18px;height:18px;accent-color:#1a3a6b' });
  active.checked = existing ? !!existing.active : true;

  const rolePart = existing
    ? null
    : h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, 'Role'),
        h(
          'div',
          { class: 'role-tabs', style: 'margin:0' },
          ...['student', 'teacher'].map((r) =>
            h(
              'button',
              {
                type: 'button',
                class: r === role ? 'active' : '',
                onClick: (e) => {
                  role = r;
                  [...e.currentTarget.parentElement.children].forEach((b, i) => b.classList.toggle('active', b === e.currentTarget));
                  updateProgramVisibility();
                },
              },
              `${r[0].toUpperCase()}${r.slice(1)}`
            )
          )
        )
      );

  const programField = h('div', {}, formRow('Program (students)', program));
  function updateProgramVisibility() {
    programField.style.display = role === 'student' ? '' : 'none';
  }
  updateProgramVisibility();

  modal({
    title: existing ? `Edit ${existing.username}` : `Add ${role === 'teacher' ? 'teacher' : 'student'}`,
    body: h(
      'div',
      {},
      rolePart,
      formRow('Full name *', fullName, 'This name prints on certificates.'),
      formRow('Username *', username, 'Students sign in with this username and password.'),
      formRow('Email', email),
      programField,
      formRow(existing ? 'New password' : 'Password *', password, 'Minimum 4 characters — share it with the student.'),
      existing
        ? h('label', { class: 'row', style: 'gap:9px;font-size:14px' }, active, 'Account active (uncheck to block sign-in)')
        : null
    ),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            try {
              if (existing) {
                const body = {
                  full_name: fullName.value,
                  username: username.value,
                  email: email.value,
                  program_id: role === 'student' && program.value ? Number(program.value) : null,
                  active: active.checked,
                };
                if (password.value) body.password = password.value;
                await api(`/api/admin/users/${existing.id}`, { method: 'PUT', body });
                toast('User updated', 'success');
              } else {
                await api('/api/admin/users', {
                  method: 'POST',
                  body: {
                    role,
                    full_name: fullName.value,
                    username: username.value,
                    email: email.value,
                    program_id: program.value ? Number(program.value) : null,
                    password: password.value,
                  },
                });
                toast(`${role === 'teacher' ? 'Teacher' : 'Student'} account created`, 'success');
              }
              close();
              onSaved();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        existing ? 'Save changes' : 'Create account'
      ),
    ],
  });
  fullName.focus();
}

// ============================================================
// programs
// ============================================================
async function renderPrograms(root) {
  const box = h('div', {});

  async function load() {
    const data = await api('/api/programs');
    const list = data.programs || [];
    if (!list.length) {
      mount(box, emptyState('No programs yet. Create one (e.g. “Science Grade 8”), then enrol students.'));
      return;
    }
    mount(
      box,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Program'), h('th', {}, 'Description'), h('th', {}, 'Students'), h('th', { style: 'text-align:right' }, 'Actions'))),
          h(
            'tbody',
            {},
            ...list.map((p) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, p.name)),
                h('td', {}, p.description || '—'),
                h('td', {}, String(p.student_count || 0)),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:8px;justify-content:flex-end' },
                    h('button', { class: 'btn sm', onClick: () => programModal(p, load) }, 'Edit'),
                    h(
                      'button',
                      {
                        class: 'btn sm danger',
                        onClick: () =>
                          confirmModal(`Delete program “${p.name}”?`, async () => {
                            await api(`/api/programs/${p.id}`, { method: 'DELETE' });
                            toast('Program deleted');
                            load();
                          }, { label: 'Delete' }),
                      },
                      'Delete'
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  mount(
    root,
    pageHeader('Programs', 'Programme enrolment shown on each student dashboard.', h('button', { class: 'btn primary', onClick: () => programModal(null, load) }, '＋ New program')),
    h('div', { class: 'panel' }, box)
  );
  load();
}

function programModal(existing, onSaved) {
  const name = textInput({ placeholder: 'e.g. Science Grade 8' });
  name.value = existing ? existing.name : '';
  const desc = textInput({ placeholder: 'Optional description' });
  desc.value = existing ? existing.description || '' : '';
  modal({
    title: existing ? 'Edit program' : 'New program',
    body: h('div', {}, formRow('Name *', name), formRow('Description', desc)),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            try {
              if (existing) await api(`/api/programs/${existing.id}`, { method: 'PUT', body: { name: name.value, description: desc.value } });
              else await api('/api/programs', { method: 'POST', body: { name: name.value, description: desc.value } });
              close();
              toast('Program saved', 'success');
              onSaved();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        'Save'
      ),
    ],
  });
  name.focus();
}

// ============================================================
// all quizzes (admin)
// ============================================================
async function renderAllQuizzes(root) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading quizzes…')));

  const [quizData, programs] = await Promise.all([
    api('/api/quizzes'),
    api('/api/programs').catch(() => ({ programs: [] })),
  ]);
  const quizzes = quizData.quizzes || [];

  const table = quizzes.length
    ? h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Quiz'),
              h('th', {}, 'Program'),
              h('th', {}, 'Questions'),
              h('th', {}, 'Share link'),
              h('th', {}, 'Granted'),
              h('th', {}, 'Done'),
              h('th', {}, 'Certificates'),
              h('th', { style: 'text-align:right' }, 'Actions')
            )
          ),
          h(
            'tbody',
            {},
            ...quizzes.map((q) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, q.title), h('div', { class: 'muted', style: 'font-size:12.5px' }, `Pass ${q.pass_percent}%`)),
                h('td', {}, q.program_name || '—'),
                h('td', {}, String(q.question_count)),
                h('td', {}, q.is_shared ? badge('Shared', 'blue') : badge('Never shared', 'neutral')),
                h('td', {}, String(q.granted_count)),
                h('td', {}, String(q.attempted_count)),
                h('td', {}, String(q.issued_count)),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap' },
                    h('a', { class: 'btn sm', href: `#/access/${q.id}` }, 'Access'),
                    h('a', { class: 'btn sm', href: `#/editor/${q.id}` }, 'Edit'),
                    h('a', { class: 'btn sm ghost', href: `#/attempts/${q.id}` }, 'Attempts'),
                    h('a', { class: 'btn sm accent', href: `#/certificate-design/${q.id}` }, 'Certificate'),
                    h(
                      'button',
                      {
                        class: 'btn sm danger',
                        onClick: () =>
                          confirmModal(
                            `Delete “${q.title}” and all attempts, grants and certificates attached to it?`,
                            async () => {
                              await api(`/api/quizzes/${q.id}`, { method: 'DELETE' });
                              toast('Quiz deleted');
                              renderAdmin(root, 'quizzes');
                            },
                            { label: 'Delete quiz' }
                          ),
                      },
                      'Delete'
                    )
                  )
                )
              )
            )
          )
        )
      )
    : emptyState('No quizzes yet — create one from the teacher dashboard.');

  const createBtn = h(
    'button',
    {
      class: 'btn primary',
      onClick: () => createQuizAsAdmin(programs.programs, root),
    },
    '＋ Create quiz'
  );

  mount(
    root,
    pageHeader('All quizzes', 'Grant access, edit questions, design certificates.', createBtn),
    h('div', { class: 'panel' }, table)
  );
}

function createQuizAsAdmin(programs, root) {
  const title = textInput({ placeholder: 'e.g. Photosynthesis Basics' });
  const desc = textInput({ placeholder: 'Short description (optional)' });
  const program = selectInput([
    { value: '', label: '— All programs —', selected: true },
    ...(programs || []).map((p) => ({ value: String(p.id), label: p.name })),
  ]);
  const pass = h('input', { class: 'input', type: 'number', min: 1, max: 100, value: '80' });
  modal({
    title: 'Create a quiz',
    body: h('div', {}, formRow('Title *', title), formRow('Description', desc), formRow('Program', program), formRow('Pass mark (%)', pass)),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            try {
              const data = await api('/api/quizzes', {
                method: 'POST',
                body: {
                  title: title.value.trim(),
                  description: desc.value.trim(),
                  program_id: program.value ? Number(program.value) : null,
                  pass_percent: Number(pass.value) || 80,
                },
              });
              close();
              location.hash = `#/editor/${data.quiz.id}`;
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        'Create & open editor'
      ),
    ],
  });
  title.focus();
}

// ============================================================
// quiz access (grants, retakes, teachers) — admin only
// ============================================================
export async function renderAccess(root, quizId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading access…')));

  const [quizList, programs, teachers] = await Promise.all([
    api('/api/quizzes'),
    api('/api/programs').catch(() => ({ programs: [] })),
    api('/api/admin/users?role=teacher').catch(() => ({ users: [] })),
  ]);
  const quiz = quizList.quizzes.find((q) => q.id === quizId);
  const detail = await api(`/api/quizzes/${quizId}`);
  let programFilter = '';
  let query = '';
  const rosterBox = h('div', {});

  async function loadRoster() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (programFilter) params.set('program_id', programFilter);
    const data = await api(`/api/admin/quizzes/${quizId}/students?${params.toString()}`);
    renderRoster(data.students || []);
  }

  function renderRoster(students) {
    if (!students.length) {
      mount(rosterBox, emptyState('No students match this filter.'));
      return;
    }
    mount(
      rosterBox,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Username'), h('th', {}, 'Program'), h('th', {}, 'Access'), h('th', {}, 'Status'), h('th', {}, 'Certificate'), h('th', { style: 'text-align:right' }, 'Actions'))
          ),
          h(
            'tbody',
            {},
            ...students.map((s) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, s.full_name || s.username)),
                h('td', {}, h('code', {}, s.username)),
                h('td', {}, s.program_name || '—'),
                h('td', {}, s.granted ? badge('Granted', 'green') : badge('No access', 'neutral')),
                h(
                  'td',
                  {},
                  s.last_submitted_at
                    ? h('span', {}, `${s.last_score}% · ${s.last_passed === 1 ? 'pass' : 'fail'} `, h('span', { class: 'muted', style: 'font-size:12px' }, fmtDateTime(s.last_submitted_at)))
                    : badge('Not started', 'amber')
                ),
                h('td', {}, s.certificate_id ? h('a', { class: 'btn sm accent', href: `#/certificate/${s.certificate_id}` }, 'View') : '—'),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap' },
                    s.granted
                      ? h(
                          'button',
                          {
                            class: 'btn sm',
                            onClick: async () => {
                              try {
                                await api(`/api/admin/quizzes/${quizId}/grants/${s.id}`, { method: 'DELETE' });
                                toast(`Access removed for ${s.full_name || s.username}`);
                                loadRoster();
                              } catch (err) {
                                toast(err.message, 'error');
                              }
                            },
                          },
                          'Revoke'
                        )
                      : h(
                          'button',
                          {
                            class: 'btn sm primary',
                            onClick: async () => {
                              try {
                                await api(`/api/admin/quizzes/${quizId}/grants`, { method: 'POST', body: { student_id: s.id } });
                                toast(`Access granted to ${s.full_name || s.username}`, 'success');
                                loadRoster();
                              } catch (err) {
                                toast(err.message, 'error');
                              }
                            },
                          },
                          'Grant'
                        ),
                    s.last_submitted_at
                      ? s.retake_allowed
                        ? h(
                            'button',
                            {
                              class: 'btn sm danger',
                              onClick: async () => {
                                await api('/api/admin/retakes', { method: 'POST', body: { quiz_id: quizId, student_id: s.id, enable: false } });
                                toast('Retake cancelled');
                                loadRoster();
                              },
                            },
                            'Cancel retake'
                          )
                        : h(
                            'button',
                            {
                              class: 'btn sm accent',
                              title: 'Let this student do the quiz again',
                              onClick: async () => {
                                try {
                                  await api('/api/admin/retakes', { method: 'POST', body: { quiz_id: quizId, student_id: s.id, enable: true } });
                                  toast(`${s.full_name || s.username} can retake the quiz`, 'success');
                                  loadRoster();
                                } catch (err) {
                                  toast(err.message, 'error');
                                }
                              },
                            },
                            'Allow retake'
                          )
                      : null
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  const search = textInput({ placeholder: 'Search student…', style: 'max-width:250px' });
  let tt = null;
  search.addEventListener('input', () => {
    clearTimeout(tt);
    tt = setTimeout(() => {
      query = search.value.trim();
      loadRoster();
    }, 260);
  });

  const programSelect = selectInput([
    { value: '', label: '— All programs —', selected: true },
    ...(programs.programs || []).map((p) => ({ value: String(p.id), label: p.name })),
  ]);
  programSelect.addEventListener('change', () => {
    programFilter = programSelect.value;
    loadRoster();
  });

  const teacherBox = h('div', {});
  function renderTeachers() {
    const assigned = detail.assigned_teachers || [];
    mount(
      teacherBox,
      h(
        'div',
        {},
        h(
          'div',
          { class: 'row', style: 'gap:8px;flex-wrap:wrap;align-items:center' },
          h('strong', { style: 'font-size:14px;margin-right:6px' }, 'Assigned teachers:'),
          assigned.length
            ? assigned.map((t) =>
                h(
                  'span',
                  { class: 'pill' },
                  t.full_name || t.username,
                  ' ',
                  h(
                    'button',
                    {
                      class: 'icon-btn',
                      style: 'font-size:15px',
                      onClick: async () => {
                        await api(`/api/admin/quizzes/${quizId}/teachers/${t.id}`, { method: 'DELETE' });
                        detail.assigned_teachers = assigned.filter((x) => x.id !== t.id);
                        renderTeachers();
                      },
                    },
                    '×'
                  )
                )
              )
            : h('span', { class: 'muted' }, 'None — only the owner teacher and admin.')
        )
      )
    );
  }
  renderTeachers();

  const teacherSelect = selectInput([
    { value: '', label: '— Pick a teacher —' },
    ...(teachers.users || []).map((t) => ({ value: String(t.id), label: t.full_name || t.username })),
  ]);
  const addTeacherBtn = h(
    'button',
    {
      class: 'btn sm',
      onClick: async () => {
        if (!teacherSelect.value) return toast('Pick a teacher first', 'error');
        try {
          await api(`/api/admin/quizzes/${quizId}/teachers`, { method: 'POST', body: { teacher_id: Number(teacherSelect.value) } });
          const added = (teachers.users || []).find((t) => t.id === Number(teacherSelect.value));
          detail.assigned_teachers = [...(detail.assigned_teachers || []), { id: added.id, full_name: added.full_name, username: added.username }];
          renderTeachers();
          toast('Teacher added to quiz', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    'Add teacher'
  );

  const grantProgramBtn = h(
    'button',
    {
      class: 'btn sm',
      onClick: async () => {
        if (!programSelect.value) return toast('Pick a program first', 'error');
        try {
          const res = await api(`/api/admin/quizzes/${quizId}/grants`, { method: 'POST', body: { program_id: Number(programSelect.value) } });
          toast(`Granted to ${res.added} student(s)`, 'success');
          loadRoster();
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    'Grant whole program'
  );

  mount(
    root,
    pageHeader(
      `Access — ${quiz ? quiz.title : 'Quiz'}`,
      'Only students granted here can open the teacher’s link.',
      h('button', { class: 'btn', onClick: () => history.back() }, '← Back'),
      h('a', { class: 'btn', href: `#/editor/${quizId}` }, 'Edit questions'),
      h('a', { class: 'btn ghost', href: `#/attempts/${quizId}` }, 'Attempts')
    ),
    h(
      'div',
      { class: 'panel' },
      h('div', { class: 'toolbar' }, search, programSelect, grantProgramBtn, h('span', { class: 'muted', style: 'font-size:13px' }, 'Per-student granting is in the table below.')),
      rosterBox
    ),
    h(
      'div',
      { class: 'panel' },
      h('h2', {}, 'Teachers on this quiz'),
      teacherBox,
      h('div', { class: 'toolbar', style: 'margin-top:12px' }, teacherSelect, addTeacherBtn)
    )
  );
  loadRoster();
}

// ============================================================
// certificates (issued) — admin
// ============================================================
async function renderCertificates(root) {
  const quizzes = (await api('/api/quizzes').catch(() => ({ quizzes: [] }))).quizzes || [];
  let quizFilter = '';
  const box = h('div', {});

  const quizSelect = selectInput([
    { value: '', label: '— All quizzes —', selected: true },
    ...quizzes.map((q) => ({ value: String(q.id), label: q.title })),
  ]);

  async function load() {
    const qs = quizFilter ? `?quiz_id=${quizFilter}` : '';
    const data = await api(`/api/admin/certificates${qs}`);
    const rows = data.certificates || [];
    if (!rows.length) {
      mount(box, emptyState('No certificates issued yet. Certificates are created automatically when a student scores 80% or more.'));
      return;
    }
    mount(
      box,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Quiz'), h('th', {}, 'Marks'), h('th', {}, 'Issued'), h('th', {}, 'Retake'), h('th', { style: 'text-align:right' }, 'Actions'))
          ),
          h(
            'tbody',
            {},
            ...rows.map((c) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, c.full_name || c.username), h('div', { class: 'muted', style: 'font-size:12.5px' }, c.username)),
                h('td', {}, c.quiz_title),
                h('td', {}, badge(`${c.marks}%`, 'green')),
                h('td', {}, fmtDateTime(c.issued_at)),
                h('td', {}, c.retake_allowed ? badge('Allowed', 'amber') : '—'),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap' },
                    h('a', { class: 'btn sm', href: `#/certificate/${c.id}` }, 'View'),
                    h('button', { class: 'btn sm primary', onClick: () => issuedEditModal(c.id, load) }, 'Edit certificate'),
                    c.retake_allowed
                      ? h(
                          'button',
                          {
                            class: 'btn sm danger',
                            onClick: async () => {
                              await api('/api/admin/retakes', { method: 'POST', body: { quiz_id: c.quiz_id, student_id: c.student_id, enable: false } });
                              toast('Retake cancelled');
                              load();
                            },
                          },
                          'Cancel retake'
                        )
                      : h(
                          'button',
                          {
                            class: 'btn sm accent',
                            onClick: async () => {
                              try {
                                await api('/api/admin/retakes', { method: 'POST', body: { quiz_id: c.quiz_id, student_id: c.student_id, enable: true } });
                                toast('Student can now retake the quiz', 'success');
                                load();
                              } catch (err) {
                                toast(err.message, 'error');
                              }
                            },
                          },
                          'Allow retake'
                        )
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  quizSelect.addEventListener('change', () => {
    quizFilter = quizSelect.value;
    load();
  });

  mount(
    root,
    pageHeader('Issued certificates', 'Every certificate already delivered to students — editable at any time.'),
    h('div', { class: 'panel' }, h('div', { class: 'toolbar' }, quizSelect), box)
  );
  load();
}

// ---------- edit an issued certificate (admin) ----------
export async function issuedEditModal(issuanceId, onSaved, existingPayload) {
  let payload = existingPayload;
  if (!payload) {
    try {
      payload = (await api(`/api/issuances/${issuanceId}`)).certificate;
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
  }
  const defaults = payload.defaults || {};
  const values = payload.values || {};

  const FIELDS = [
    ['student_name', 'Full name on certificate'],
    ['quiz_name', 'Quiz name on certificate'],
    ['marks', 'Marks shown'],
    ['date', 'Date of issue'],
    ['wording_top', 'Wording (above name)'],
    ['statement', 'Statement (below name)'],
    ['center_name', 'Center name (required wording)'],
    ['center_tagline', 'Center tagline'],
    ['signature_name', 'Signature name'],
    ['signature_title', 'Signature title'],
    ['note', 'Extra note line'],
  ];

  const inputs = {};
  const resetKeys = new Set();
  const canvas = h('canvas', { class: 'certificate-canvas' });

  // build one input per editable field
  for (const [key, label] of FIELDS) {
    const input = textInput({ value: values[key] || '' });
    input.addEventListener('input', redraw);
    inputs[key] = input;
  }

  function currentPayload() {
    const merged = { ...values };
    for (const [key] of FIELDS) {
      if (inputs[key]) merged[key] = inputs[key].value;
    }
    return {
      ...payload,
      values: merged,
      design: {
        ...payload.design,
        cert_primary_color: payload.design.cert_primary_color,
        cert_accent_color: payload.design.cert_accent_color,
        cert_border: payload.design.cert_border,
        cert_title: payload.design.cert_title,
      },
    };
  }

  function redraw() {
    drawCertificate(canvas, currentPayload());
  }

  modal({
    title: `Edit certificate — ${defaults.student_name || ''}`,
    wide: true,
    body: h(
      'div',
      { class: 'grid grid-2' },
      h(
        'div',
        { style: 'max-height:70vh;overflow-y:auto;padding-right:6px' },
        h('p', { class: 'field-hint', style: 'margin-bottom:10px' }, 'Editing changes the certificate as students will download it. Fields left on the quiz default update automatically if you redesign the quiz later.'),
        ...FIELDS.map(([key, label]) =>
          h(
            'div',
            { class: 'field', style: 'margin-bottom:10px' },
            h(
              'div',
              { class: 'row', style: 'justify-content:space-between' },
              h('span', { class: 'field-label', style: 'margin:0' }, label),
              h(
                'button',
                {
                  class: 'btn sm ghost',
                  type: 'button',
                  title: 'Reset this field to the quiz default',
                  onClick: (e) => {
                    e.preventDefault();
                    inputs[key].value = defaults[key] || '';
                    resetKeys.add(key);
                    redraw();
                  },
                },
                '↺ default'
              )
            ),
            inputs[key]
          )
        )
      ),
      h('div', {}, h('p', { class: 'field-hint' }, 'Live preview'), canvas)
    ),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            try {
              const overrides = {};
              for (const [key] of FIELDS) {
                const val = String(inputs[key].value || '').trim();
                if (!val) continue;
                if (String(defaults[key] || '') !== val) overrides[key] = val;
              }
              await api(`/api/admin/certificates/${issuanceId}`, {
                method: 'PUT',
                body: { overrides, reset: Array.from(resetKeys) },
              });
              close();
              toast('Certificate updated', 'success');
              if (onSaved) onSaved();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        'Save certificate'
      ),
      h(
        'button',
        {
          class: 'btn accent',
          onClick: () => downloadCertificate(canvas, currentPayload()),
        },
        'Download PNG'
      ),
    ],
  });
  redraw();
}

// ---------- dedicated page for one issued certificate ----------
export async function renderIssuedCertificate(root, issuanceId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading certificate…')));
  let cert;
  try {
    cert = (await api(`/api/issuances/${issuanceId}`)).certificate;
  } catch (err) {
    mount(root, pageHeader('Certificate'), h('div', { class: 'panel' }, h('p', { class: 'muted' }, err.message)));
    return;
  }
  const canvas = certificateStage(cert);

  mount(
    root,
    pageHeader(
      `Certificate — ${cert.values.student_name}`,
      `${cert.values.quiz_name} · ${cert.values.marks} · issued ${cert.values.date}`,
      h('button', { class: 'btn', onClick: () => history.back() }, '← Back'),
      h('button', { class: 'btn primary', onClick: () => issuedEditModal(issuanceId, () => renderIssuedCertificate(root, issuanceId), cert) }, 'Edit certificate'),
      h('button', { class: 'btn accent', onClick: () => downloadCertificate(canvas, cert) }, '⬇ Download PNG')
    ),
    h('div', { class: 'panel' }, canvas)
  );
}

// ============================================================
// certificate design per quiz — admin
// ============================================================
export async function renderCertificateDesign(root, quizId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading certificate design…')));

  const [certData, quizData, issued] = await Promise.all([
    api(`/api/quizzes/${quizId}/certificate`),
    api(`/api/quizzes/${quizId}`).catch(() => null),
    api(`/api/admin/certificates?quiz_id=${quizId}`).catch(() => ({ certificates: [] })),
  ]);
  if (!certData.editable) {
    mount(root, pageHeader('Certificate'), h('div', { class: 'panel' }, h('p', { class: 'muted' }, 'Only the admin can edit certificates.')));
    return;
  }

  const design = certData.design;
  const quizTitle = certData.quiz_title;

  const fields = {
    cert_title: textInput(),
    cert_wording_top: textInput({ placeholder: 'Shown above the student’s name' }),
    cert_statement: textInput({ placeholder: 'Shown below the student’s name' }),
    cert_wording_bottom: textInput(),
    cert_center_name: textInput({ placeholder: "Everyone's Learning Center" }),
    cert_center_tagline: textInput(),
    cert_signature_name: textInput(),
    cert_signature_title: textInput(),
    marks_label: textInput(),
    date_label: textInput(),
  };
  Object.entries(fields).forEach(([key, input]) => {
    if (key === 'marks_label') input.value = design.cert_labels?.marks || 'Marks';
    else if (key === 'date_label') input.value = design.cert_labels?.date || 'Date of Issue';
    else input.value = design[key] || '';
    input.addEventListener('input', redraw);
  });

  const colorPrimary = h('input', { type: 'color', value: design.cert_primary_color || '#1a3a6b' });
  const colorAccent = h('input', { type: 'color', value: design.cert_accent_color || '#c9a227' });
  [colorPrimary, colorAccent].forEach((c) => c.addEventListener('input', redraw));
  const borderSelect = selectInput(
    ['classic', 'modern', 'elegant', 'minimal'].map((b) => ({ value: b, label: b[0].toUpperCase() + b.slice(1), selected: design.cert_border === b }))
  );
  borderSelect.addEventListener('change', redraw);

  const canvas = h('canvas', { class: 'certificate-canvas' });

  function samplePayload() {
    return {
      values: {
        ...pickValues(),
        score_detail: '17/20',
        note: '',
      },
      labels: { marks: fields.marks_label.value || 'Marks', date: fields.date_label.value || 'Date of Issue', score_of: 'out of' },
      design: {
        cert_title: fields.cert_title.value || 'Certificate of Achievement',
        cert_primary_color: colorPrimary.value,
        cert_accent_color: colorAccent.value,
        cert_border: borderSelect.value,
      },
    };
  }

  function pickValues() {
    return {
      student_name: 'Amira Ahmed',
      quiz_name: quizTitle,
      marks: '85%',
      date: fmtDate(new Date().toISOString()),
      wording_top: fields.cert_wording_top.value,
      statement: fields.cert_statement.value,
      center_name: fields.cert_center_name.value,
      center_tagline: fields.cert_center_tagline.value,
      signature_name: fields.cert_signature_name.value,
      signature_title: fields.cert_signature_title.value,
    };
  }

  function redraw() {
    drawCertificate(canvas, samplePayload());
  }

  const saveBtn = h(
    'button',
    {
      class: 'btn primary',
      onClick: async () => {
        try {
          await api(`/api/quizzes/${quizId}/certificate`, {
            method: 'PUT',
            body: {
              cert_title: fields.cert_title.value,
              cert_wording_top: fields.cert_wording_top.value,
              cert_statement: fields.cert_statement.value,
              cert_wording_bottom: fields.cert_wording_bottom.value,
              cert_center_name: fields.cert_center_name.value,
              cert_center_tagline: fields.cert_center_tagline.value,
              cert_signature_name: fields.cert_signature_name.value,
              cert_signature_title: fields.cert_signature_title.value,
              cert_primary_color: colorPrimary.value,
              cert_accent_color: colorAccent.value,
              cert_border: borderSelect.value,
              cert_labels: { marks: fields.marks_label.value, date: fields.date_label.value },
            },
          });
          toast('Certificate design saved — existing certificates pick it up too', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    'Save design'
  );

  const issuedRows = issued.certificates || [];
  const issuedTable = issuedRows.length
    ? h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Marks'), h('th', {}, 'Issued'), h('th', { style: 'text-align:right' }, 'Actions'))),
          h(
            'tbody',
            {},
            ...issuedRows.map((c) =>
              h(
                'tr',
                {},
                h('td', {}, c.full_name || c.username),
                h('td', {}, badge(`${c.marks}%`, 'green')),
                h('td', {}, fmtDateTime(c.issued_at)),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:7px;justify-content:flex-end' },
                    h('a', { class: 'btn sm', href: `#/certificate/${c.id}` }, 'View'),
                    h('button', { class: 'btn sm primary', onClick: () => issuedEditModal(c.id, loadIssued, null) }, 'Edit issued')
                  )
                )
              )
            )
          )
        )
      )
    : h('p', { class: 'muted' }, 'No certificates issued for this quiz yet.');

  const issuedBox = h('div', {}, issuedTable);
  async function loadIssued() {
    const fresh = await api(`/api/admin/certificates?quiz_id=${quizId}`);
    const rows = fresh.certificates || [];
    issuedBox.innerHTML = '';
    if (!rows.length) {
      issuedBox.append(h('p', { class: 'muted' }, 'No certificates issued for this quiz yet.'));
      return;
    }
    mount(
      issuedBox,
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Student'), h('th', {}, 'Marks'), h('th', {}, 'Issued'), h('th', { style: 'text-align:right' }, 'Actions'))),
          h(
            'tbody',
            {},
            ...rows.map((c) =>
              h('tr', {},
                h('td', {}, c.full_name || c.username),
                h('td', {}, badge(`${c.marks}%`, 'green')),
                h('td', {}, fmtDateTime(c.issued_at)),
                h('td', { style: 'text-align:right' },
                  h('div', { class: 'actions', style: 'display:flex;gap:7px;justify-content:flex-end' },
                    h('a', { class: 'btn sm', href: `#/certificate/${c.id}` }, 'View'),
                    h('button', { class: 'btn sm primary', onClick: () => issuedEditModal(c.id, loadIssued, null) }, 'Edit issued')
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  mount(
    root,
    pageHeader(
      `Certificate design — ${quizTitle}`,
      'This design is used for every certificate of this quiz, including ones already issued.',
      h('button', { class: 'btn', onClick: () => history.back() }, '← Back'),
      saveBtn
    ),
    h(
      'div',
      { class: 'grid grid-2' },
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Wording'),
        formRow('Certificate title', fields.cert_title),
        formRow('Wording above name', fields.cert_wording_top),
        formRow('Statement below name', fields.cert_statement),
        formRow('Award line (bottom)', fields.cert_wording_bottom),
        h('div', { class: 'divider' }),
        h('h2', {}, "Center (Everyone's Learning Center)"),
        formRow('Center name', fields.cert_center_name, 'Required wording — must stay on the certificate.'),
        formRow('Center tagline', fields.cert_center_tagline),
        h('div', { class: 'divider' }),
        h('h2', {}, 'Signature'),
        formRow('Signatory name', fields.cert_signature_name),
        formRow('Signatory title', fields.cert_signature_title),
        h('div', { class: 'divider' }),
        h('h2', {}, 'Labels & colours'),
        h('div', { class: 'form-grid' }, formRow('“Marks” label', fields.marks_label), formRow('“Date” label', fields.date_label)),
        h(
          'div',
          { class: 'color-row', style: 'margin-top:6px' },
          h('label', { class: 'color-field' }, 'Primary colour', colorPrimary),
          h('label', { class: 'color-field' }, 'Accent colour', colorAccent),
          h('label', { class: 'color-field', style: 'flex:1' }, 'Border style', borderSelect)
        )
      ),
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Live preview'),
        canvas,
        h('p', { class: 'field-hint', style: 'margin-top:8px' }, 'Sample student shown — real certificates use each student’s name, quiz name, marks and issue date.')
      )
    ),
    h('div', { class: 'panel' }, h('h2', {}, 'Issued certificates for this quiz'), issuedBox)
  );

  redraw();
}

// ============================================================
// settings
// ============================================================
async function renderSettings(root) {
  const current = h('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
  const next = h('input', { class: 'input', type: 'password', placeholder: 'New password (min 6 characters)', autocomplete: 'new-password' });
  const confirm = h('input', { class: 'input', type: 'password', placeholder: 'Repeat new password', autocomplete: 'new-password' });

  mount(
    root,
    pageHeader('Settings', 'Admin account security.'),
    h(
      'div',
      { class: 'grid grid-2' },
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Admin account'),
        h('div', { class: 'pill-row', style: 'margin-bottom:12px' },
          h('span', { class: 'pill' }, `Username: ${state.user?.username || ''}`),
          h('span', { class: 'pill' }, `Name: ${state.user?.full_name || ''}`)
        ),
        h('p', { class: 'muted' }, 'Change your password regularly. It unlocks all admin abilities: user management, access grants and certificates.')
      ),
      h(
        'form',
        {
          class: 'panel',
          onsubmit: async (e) => {
            e.preventDefault();
            if (next.value !== confirm.value) return toast('New passwords do not match', 'error');
            try {
              await api('/api/auth/password', { method: 'POST', body: { current_password: current.value, new_password: next.value } });
              toast('Password changed', 'success');
              current.value = next.value = confirm.value = '';
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        h('h2', {}, 'Change password'),
        formRow('Current password', current),
        formRow('New password', next),
        formRow('Confirm new password', confirm),
        h('button', { class: 'btn primary', type: 'submit' }, 'Update password')
      )
    )
  );
}
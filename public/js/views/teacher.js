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
  copyText,
  fmtDateTime,
  state,
} from '../api.js';
import { symbolButton } from '../symbols.js';

// ================= teacher dashboard =================
export async function renderTeacher(root) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading quizzes…')));

  const [quizData, programs] = await Promise.all([
    api('/api/quizzes'),
    api('/api/programs').catch(() => ({ programs: [] })),
  ]);
  const quizzes = quizData.quizzes || [];

  const createBtn = h('button', { class: 'btn primary', onClick: () => createQuizModal(programs.programs, root) }, '＋ Create quiz');

  const grid = quizzes.length
    ? h('div', { class: 'grid grid-2' }, ...quizzes.map((q) => quizCard(q, root)))
    : emptyState('No quizzes yet. Create your first quiz, bulk-upload questions, then share the link.');

  mount(
    root,
    pageHeader(
      state.user.role === 'admin' ? 'All quizzes' : 'My quizzes',
      state.user.role === 'admin'
        ? 'Create, edit and share quizzes across ELC.'
        : 'Create quizzes, share the link and see who has completed them.',
      createBtn
    ),
    grid
  );
}

function quizCard(q, root) {
  const shareBadge = q.is_shared ? badge('Link shared', 'blue') : badge('Link not shared', 'neutral');
  const questionBadge = q.question_count ? badge(`${q.question_count} questions`, 'neutral') : badge('No questions yet', 'amber');

  return h(
    'div',
    { class: 'quiz-card' },
    h('div', { class: 'row between' }, h('h3', {}, q.title), shareBadge),
    q.description ? h('p', { class: 'desc' }, q.description) : null,
    h(
      'div',
      { class: 'quiz-meta' },
      h('span', {}, q.program_name || 'All programs'),
      h('span', {}, `Pass ${q.pass_percent}%`),
      questionBadge,
      h('span', {}, `${q.granted_count} granted`),
      h('span', {}, `${q.attempted_count} attempted`),
      h('span', {}, `${q.issued_count} certificates`)
    ),
    h(
      'div',
      { class: 'row' },
      h('a', { class: 'btn primary sm', href: `#/editor/${q.id}` }, q.question_count ? 'Edit questions' : 'Add questions'),
      h('button', { class: 'btn sm', onClick: () => shareModal(q) }, q.is_shared ? 'Share link' : 'Generate link'),
      h('a', { class: 'btn ghost sm', href: `#/attempts/${q.id}` }, 'Who has done it'),
      state.user.role === 'admin'
        ? h('a', { class: 'btn ghost sm', href: `#/access/${q.id}` }, 'Access')
        : null,
      state.user.role === 'admin'
        ? h('a', { class: 'btn ghost sm', href: `#/certificate-design/${q.id}` }, 'Certificate')
        : null
    )
  );
}

export function shareModal(quiz) {
  let token = quiz.share_token;
  let resetCount = quiz.share_reset_count || 0;

  const linkBox = h('div', { class: 'link-box' });
  const tokenInput = h('input', {
    class: 'input',
    readonly: true,
    value: token ? currentLink(token) : '',
    placeholder: 'No link generated yet',
  });

  function currentLink(t) {
    return `${location.origin}${location.pathname}#/join/${t}`;
  }

  function refresh() {
    tokenInput.value = token ? currentLink(token) : '';
    linkBox.textContent = '';
    linkBox.append(tokenInput);
  }
  refresh();

  const copyBtn = h(
    'button',
    {
      class: 'btn sm',
      disabled: !token,
      onClick: async () => {
        await copyText(currentLink(token));
        toast('Link copied to clipboard', 'success');
      },
    },
    'Copy'
  );
  const openBtn = h(
    'a',
    { class: 'btn sm', href: token ? currentLink(token) : '#', target: '_blank', rel: 'noopener', onclick: (e) => { if (!token) { e.preventDefault(); toast('Generate the link first', 'error'); } } },
    'Open'
  );

  modal({
    title: `Share quiz — ${quiz.title}`,
    body: ({ close }) =>
      h(
        'div',
        {},
        h(
          'div',
          { class: 'hint-box', style: 'margin-bottom:14px' },
          'Share this link with your students. ',
          h('strong', {}, 'Only students the admin has granted access to '),
          'will be able to open the quiz — anyone else who opens the link is refused.',
          resetCount ? h('div', { style: 'margin-top:6px' }, `This link has been reset ${resetCount}× — old links stop working after a reset.`) : null
        ),
        linkBox,
        h('div', { class: 'row', style: 'margin-top:12px' }, copyBtn, openBtn),
        h('div', { class: 'divider' }),
        h('div', { class: 'row' },
          token
            ? h('button', { class: 'btn danger', onClick: () => resetLink() }, '↺ Reset link (invalidate old)')
            : h('button', { class: 'btn primary', onClick: () => generateLink() }, 'Generate share link')
        )
      ),
    actions: ({ close }) => [h('button', { class: 'btn ghost', onClick: () => close() }, 'Done')],
  });

  async function generateLink() {
    try {
      const data = await api(`/api/quizzes/${quiz.id}/share`, { method: 'POST' });
      token = data.token;
      resetCount = data.share_reset_count;
      refresh();
      toast('Share link generated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function resetLink() {
    confirmModal(
      'Reset the link? The current URL immediately stops working. You will get a brand-new link to share. Students who already completed the quiz are unaffected.',
      async () => {
        await generateLink();
        toast('Link reset — share the new one', 'success');
      },
      { label: 'Reset link' }
    );
  }
}

async function createQuizModal(programs, root) {
  const title = textInput({ placeholder: 'e.g. Photosynthesis Basics' });
  const desc = textInput({ placeholder: 'Short description (optional)' });
  const program = selectInput([
    { value: '', label: '— All programs —', selected: true },
    ...(programs || []).map((p) => ({ value: String(p.id), label: p.name })),
  ]);
  const pass = h('input', { class: 'input', type: 'number', min: 1, max: 100, value: '80' });

  modal({
    title: 'Create a quiz',
    body: h(
      'div',
      {},
      formRow('Quiz title *', title),
      formRow('Description', desc),
      formRow('Program', program, 'Students of this program see it once granted access.'),
      formRow('Pass mark (%) — certificate from 80%', pass)
    ),
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
              toast('Quiz created — add questions now', 'success');
              location.hash = `#/editor/${data.quiz.id}`;
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        'Create & add questions'
      ),
    ],
  });
  title.focus();
}

// ================= quiz editor =================
export async function renderQuizEditor(root, quizId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading quiz…')));

  let data;
  try {
    data = await api(`/api/quizzes/${quizId}`);
  } catch (err) {
    mount(root, pageHeader('Quiz'), h('div', { class: 'panel' }, h('p', { class: 'muted' }, err.message)));
    return;
  }
  const programs = await api('/api/programs').catch(() => ({ programs: [] }));

  const title = textInput({ value: data.quiz.title });
  const desc = textInput({ value: data.quiz.description || '' });
  const program = selectInput([
    { value: '', label: '— All programs —', selected: !data.quiz.program_id },
    ...(programs.programs || []).map((p) => ({
      value: String(p.id),
      label: p.name,
      selected: p.id === data.quiz.program_id,
    })),
  ]);
  const pass = h('input', { class: 'input', type: 'number', min: 1, max: 100, value: String(data.quiz.pass_percent) });

  const questionList = h('div', {});
  const shareHint = h('div', { class: 'muted', style: 'font-size:13.5px' });

  function refreshShareHint() {
    shareHint.textContent = data.quiz.share_token
      ? 'A share link exists — students can open it once the admin grants access.'
      : 'No link shared yet — generate one from the quiz list.';
  }
  refreshShareHint();

  function renderQuestions() {
    questionList.innerHTML = '';
    if (!data.questions.length) {
      questionList.append(
        emptyState('No questions yet. Bulk upload a Q:/A: paste or add questions one by one.')
      );
      return;
    }
    data.questions.forEach((q, idx) => {
      const opts =
        q.type === 'mcq'
          ? q.options.map((o, i) => `${Number(q.answer) === i ? '✓' : '•'} ${o}`).join('   ')
          : `Answer: ${String(q.answer).split('|').join(' / ')}`;
      questionList.append(
        h(
          'div',
          { class: 'q-edit-item' },
          h(
            'div',
            { class: 'row' },
            h('div', { class: 'q-body' },
              h('div', { class: 'row', style: 'gap:8px' },
                badge(`${idx + 1}`, 'blue'),
                badge(q.type === 'mcq' ? 'Multiple choice' : 'Fill in blank', 'neutral')
              ),
              h('p', { class: 'q-text', style: 'font-size:15.5px;margin:8px 0 2px' }, q.question),
              h('div', { class: 'q-opts' }, opts)
            ),
            h(
              'div',
              { class: 'actions' },
              h('button', { class: 'btn sm', onClick: () => questionModal(data, q, () => { reload(); }) }, 'Edit'),
              h(
                'button',
                {
                  class: 'btn sm danger',
                  onClick: () =>
                    confirmModal(`Delete question ${idx + 1}?`, async () => {
                      await api(`/api/questions/${q.id}`, { method: 'DELETE' });
                      toast('Question deleted');
                      reload();
                    }, { label: 'Delete' }),
                },
                'Delete'
              )
            )
          )
        )
      );
    });
  }

  async function reload() {
    data = await api(`/api/quizzes/${quizId}`);
    renderQuestions();
  }

  const saveDetailsBtn = h(
    'button',
    {
      class: 'btn primary',
      onClick: async () => {
        try {
          await api(`/api/quizzes/${quizId}`, {
            method: 'PUT',
            body: {
              title: title.value.trim(),
              description: desc.value.trim(),
              program_id: program.value ? Number(program.value) : null,
              pass_percent: Number(pass.value),
            },
          });
          toast('Quiz details saved', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    'Save details'
  );

  mount(
    root,
    pageHeader(
      data.quiz.title,
      `Editor · owned by ${data.creator ? data.creator.full_name || data.creator.username : '—'}`,
      h('button', { class: 'btn', onClick: () => history.back() }, '← Back'),
      h('a', { class: 'btn', href: `#/attempts/${quizId}` }, 'See attempts'),
      saveDetailsBtn
    ),
    h(
      'div',
      { class: 'grid grid-2' },
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Quiz details'),
        formRow('Title', title),
        formRow('Description', desc),
        formRow('Program', program),
        formRow('Pass mark (%)', pass, 'Certificates are issued from 80% by default.'),
        shareHint
      ),
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, 'Questions'),
        h(
          'div',
          { class: 'row', style: 'margin-bottom:14px' },
          h(
            'button',
            { class: 'btn primary sm', onClick: () => bulkModal(data, reload) },
            '⬆ Bulk upload (Q:/A:)'
          ),
          h('button', { class: 'btn sm', onClick: () => questionModal(data, null, reload) }, '＋ Add question'),
          h('span', { class: 'field-hint' }, `${data.questions.length} question${data.questions.length === 1 ? '' : 's'} in this quiz`)
        ),
        questionList
      )
    )
  );
  renderQuestions();
}

// ---------- single question modal ----------
function questionModal(data, existing, onSaved) {
  let type = existing ? existing.type : 'mcq';
  const qText = h('textarea', { class: 'input', rows: 3, placeholder: 'Question text — math/science symbols welcome (√ π ⇌ ₂ …)' });
  qText.value = existing ? existing.question : '';
  const blankAnswer = h('input', { class: 'input', placeholder: 'Correct answer, alternatives with | e.g. 4|four' });
  blankAnswer.value = existing && existing.type === 'blank' ? existing.answer : '';

  const optionsWrap = h('div', { class: 'options', style: 'gap:8px' });
  let options = existing && existing.type === 'mcq' ? [...existing.options] : ['', ''];
  let correctIdx = existing && existing.type === 'mcq' ? Number(existing.answer) || 0 : 0;

  const tabs = h(
    'div',
    { class: 'role-tabs', style: 'margin-top:0' },
    ...['mcq', 'blank'].map((t) =>
      h(
        'button',
        {
          type: 'button',
          class: t === type ? 'active' : '',
          onClick: (e) => {
            type = t;
            syncTabState();
            renderOptions();
            syncAnswerField();
          },
        },
        t === 'mcq' ? 'Multiple choice' : 'Fill in the blank'
      )
    )
  );
  function syncTabState() {
    [...tabs.children].forEach((b, i) => b.classList.toggle('active', (i === 0 && type === 'mcq') || (i === 1 && type === 'blank')));
  }

  function renderOptions() {
    optionsWrap.innerHTML = '';
    if (type !== 'mcq') return;
    options.forEach((opt, idx) => {
      const input = h('input', { class: 'input', type: 'text', placeholder: `Option ${idx + 1}` });
      input.value = opt;
      input.addEventListener('input', () => (options[idx] = input.value));
      const radio = h('input', { type: 'radio', name: 'correct_opt', checked: idx === correctIdx });
      radio.addEventListener('change', () => (correctIdx = idx));
      optionsWrap.append(
        h(
          'div',
          { class: 'row', style: 'gap:8px;margin-bottom:8px' },
          radio,
          input,
          symbolButton(input),
          h('button', {
            class: 'icon-btn',
            title: 'Remove option',
            onClick: (e) => {
              e.preventDefault();
              if (options.length <= 2) return toast('Multiple choice needs at least 2 options', 'error');
              options.splice(idx, 1);
              if (correctIdx >= options.length) correctIdx = options.length - 1;
              renderOptions();
            },
          }, '×')
        )
      );
    });
    const addBtn = h(
      'button',
      {
        class: 'btn sm',
        type: 'button',
        onClick: (e) => {
          e.preventDefault();
          options.push('');
          renderOptions();
        },
      },
      '＋ Add option'
    );
    optionsWrap.append(addBtn);
  }

  const blankField = formRow('Answer *', (() => {
    const row = h('div', { class: 'row', style: 'gap:8px' }, blankAnswer, symbolButton(blankAnswer));
    return row;
  })(), 'Case and spaces are ignored. Use | between acceptable answers (e.g. 4|four).');

  function syncAnswerField() {}

  renderOptions();

  const container = h(
    'div',
    {},
    tabs,
    formRow('Question *', qText),
    type === 'mcq' ? formRow('Options — tick the correct one *', optionsWrap) : null,
    type !== 'mcq' ? blankField : null
  );

  // re-render dynamic sections when type changes (tabs handler above only toggles classes)
  const origTabClick = tabs;
  origTabClick.addEventListener('click', () => {
    container.innerHTML = '';
    container.append(
      tabs,
      formRow('Question *', qText),
      type === 'mcq' ? formRow('Options — tick the correct one *', optionsWrap) : null,
      type !== 'mcq' ? blankField : null
    );
  });

  modal({
    title: existing ? 'Edit question' : 'Add a question',
    wide: true,
    body: container,
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            const body = {
              type,
              question: qText.value.trim(),
              options: type === 'mcq' ? options.map((o) => o.trim()).filter(Boolean) : [],
              answer: type === 'mcq' ? String(correctIdx) : blankAnswer.value.trim(),
            };
            try {
              if (existing) await api(`/api/questions/${existing.id}`, { method: 'PUT', body });
              else await api(`/api/quizzes/${data.quiz.id}/questions`, { method: 'POST', body });
              close();
              toast(existing ? 'Question updated' : 'Question added', 'success');
              onSaved();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        existing ? 'Save changes' : 'Add question'
      ),
    ],
  });
  qText.focus();
}

// ---------- bulk upload modal ----------
function formatHelpNode() {
  const box = h('div', { class: 'hint-box' });
  box.append(
    h('div', { style: 'font-weight:700;margin-bottom:6px' }, 'Plain-text format — paste Q:/A: lines:'),
    h(
      'pre',
      { class: 'pre-preview', style: 'background:#fff;color:#304468;border:1px solid #d7e4fa;padding:10px' },
      [
        'Q: What is 2 + 2?',
        'A: 4',
        '',
        'Q: Which planet is the largest?',
        'A: Jupiter      <- first A: = correct',
        'A: Saturn',
        'A: Mars',
        '',
        'Q: What is √49?',
        'A: 7',
        '',
        'Q: Which is water?',
        'T: blank        <- force fill-in-the-blank',
        'A: H2O|water    <- alternatives with |',
        '',
        'Mark another correct option with *A: and prefix comments with #.',
      ].join('\n')
    )
  );
  return box;
}

function bulkModal(data, onSaved) {
  const textarea = h('textarea', {
    class: 'input',
    rows: 12,
    placeholder: 'Q: Question one?\nA: Answer one\n\nQ: Question two?\nA: Correct option\nA: Wrong option',
  });
  const previewBox = h('div', {});
  let parsed = null;
  let mode = 'replace';

  function renderPreview() {
    if (!parsed) {
      previewBox.innerHTML = '';
      return;
    }
    previewBox.innerHTML = '';
    previewBox.append(
      h(
        'div',
        { style: 'margin-top:14px' },
        h(
          'div',
          { class: 'row between', style: 'margin-bottom:8px' },
          h('strong', {}, `Preview — ${parsed.questions.length} question${parsed.questions.length === 1 ? '' : 's'} parsed`),
          parsed.questions.length
            ? h('label', { class: 'row', style: 'gap:6px;font-size:13.5px' },
                h('input', { type: 'radio', name: 'bulk_mode', checked: mode === 'replace', onChange: () => { mode = 'replace'; } }),
                'Replace existing questions')
            : null,
          parsed.questions.length
            ? h('label', { class: 'row', style: 'gap:6px;font-size:13.5px' },
                h('input', { type: 'radio', name: 'bulk_mode', checked: mode === 'append', onChange: () => { mode = 'append'; } }),
                'Add to existing questions')
            : null
        ),
        parsed.errors.length
          ? h(
              'div',
              { class: 'warning-banner', style: 'margin-bottom:10px' },
              ...parsed.errors.map((e) => h('div', { style: 'font-weight:500' }, `Line ${e.line}: ${e.message}`))
            )
          : null,
        parsed.questions.length
          ? h(
              'div',
              {},
              ...parsed.questions.map((q, idx) =>
                h(
                  'div',
                  { class: 'q-edit-item' },
                  h('div', { class: 'row', style: 'gap:8px' },
                    badge(`${idx + 1}`, 'blue'),
                    badge(q.type === 'mcq' ? 'MCQ' : 'Fill blank', 'neutral')
                  ),
                  h('p', { class: 'q-text', style: 'font-size:15px;margin:6px 0 2px' }, q.question),
                  h('div', { class: 'q-opts' },
                    q.type === 'mcq'
                      ? q.options.map((o, i) => `${Number(q.answer) === i ? '✓' : '•'} ${o}`).join('   ')
                      : `Answer: ${q.answer.split('|').join(' / ')}`
                  )
                )
              )
            )
          : h('p', { class: 'muted' }, 'No questions parsed yet.')
      )
    );
  }

  modal({
    title: `Bulk upload questions — ${data.quiz.title}`,
    wide: true,
    body: h(
      'div',
      {},
      formatHelpNode(),
      h('div', { style: 'height:12px' }),
      formRow('Paste your questions', textarea),
      previewBox
    ),
    actions: ({ close }) => [
      h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'),
      h(
        'button',
        {
          class: 'btn',
          onClick: async () => {
            try {
              const res = await api(`/api/quizzes/${data.quiz.id}/questions/bulk`, {
                method: 'POST',
                body: { text: textarea.value, mode: 'preview' },
              });
              parsed = res;
              renderPreview();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        '1 · Preview'
      ),
      h(
        'button',
        {
          class: 'btn primary',
          onClick: async () => {
            try {
              if (!parsed) {
                const res = await api(`/api/quizzes/${data.quiz.id}/questions/bulk`, {
                  method: 'POST',
                  body: { text: textarea.value, mode: 'preview' },
                });
                parsed = res;
                renderPreview();
              }
              if (!parsed || !parsed.questions.length) {
                toast('No questions to save — problems listed above', 'error');
                return;
              }
              const res = await api(`/api/quizzes/${data.quiz.id}/questions/bulk`, {
                method: 'POST',
                body: { text: textarea.value, mode },
              });
              close();
              toast(`${res.saved} question${res.saved === 1 ? '' : 's'} saved (${res.total} total)`, 'success');
              onSaved();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        },
        '2 · Save questions'
      ),
    ],
  });
  textarea.focus();
}

// ================= attempts view =================
export async function renderAttempts(root, quizId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading attempts…')));

  let data;
  try {
    data = await api(`/api/quizzes/${quizId}/attempts`);
  } catch (err) {
    mount(root, pageHeader('Attempts'), h('div', { class: 'panel' }, h('p', { class: 'muted' }, err.message)));
    return;
  }

  const submitted = data.attempts.filter((a) => a.status === 'submitted');
  const uniqueDone = new Set(submitted.map((a) => a.student_id)).size;
  const passed = submitted.filter((a) => a.passed === 1).length;

  const attemptedIds = new Set(submitted.map((a) => a.student_id));
  const pending = data.granted_students.filter((s) => !attemptedIds.has(s.id));

  const table = submitted.length
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
              h('th', {}, 'Student'),
              h('th', {}, 'Program'),
              h('th', {}, 'Submitted'),
              h('th', {}, 'Score'),
              h('th', {}, 'Result'),
              h('th', { style: 'text-align:right' }, 'Action')
            )
          ),
          h(
            'tbody',
            {},
            ...submitted.map((a) =>
              h(
                'tr',
                {},
                h('td', {}, h('strong', {}, a.full_name || a.username), h('div', { class: 'muted', style: 'font-size:12.5px' }, a.username)),
                h('td', {}, a.program_name || '—'),
                h('td', {}, fmtDateTime(a.submitted_at)),
                h('td', {}, `${a.score}% (${a.correct}/${a.total})`),
                h('td', {}, a.passed === 1 ? badge('Passed', 'green') : badge('Not passed', 'red')),
                h(
                  'td',
                  { style: 'text-align:right' },
                  h(
                    'div',
                    { class: 'actions', style: 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap' },
                    h('button', { class: 'btn sm', onClick: () => reviewModal(a) }, 'Review'),
                    a.certificate_id
                      ? h('a', { class: 'btn sm accent', href: `#/certificate/${a.certificate_id}` }, 'Certificate')
                      : null
                  )
                )
              )
            )
          )
        )
      )
    : emptyState('Nobody has submitted this quiz yet. Share the link and grant access to your students.');

  mount(
    root,
    pageHeader(
      `Who has done “${data.quiz_title}”`,
      `Pass mark ${data.pass_percent}%`,
      h('button', { class: 'btn', onClick: () => history.back() }, '← Back'),
      state.user.role === 'admin' ? h('a', { class: 'btn primary', href: `#/access/${quizId}` }, 'Manage access') : null
    ),
    h(
      'div',
      { class: 'grid grid-4', style: 'margin-bottom:18px' },
      statBox('Granted access', data.granted_count),
      statBox('Completed', uniqueDone),
      statBox('Passed', passed),
      statBox('Certificates', data.attempts.filter((a) => a.certificate_id).length)
    ),
    h('div', { class: 'panel' }, h('h2', {}, 'Submissions'), table),
    h(
      'div',
      { class: 'panel' },
      h('h2', {}, `Granted but not finished (${pending.length})`),
      pending.length
        ? h('div', { class: 'pill-row' }, ...pending.map((s) => h('span', { class: 'pill' }, `${s.full_name || s.username}${s.program_name ? ` · ${s.program_name}` : ''}`)))
        : h('p', { class: 'muted' }, data.granted_count ? 'Everyone with access has attempted the quiz.' : 'Nobody has been granted access yet — ask the admin.')
    )
  );
}

function statBox(label, value) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, label));
}

async function reviewModal(attempt) {
  try {
    const data = await api(`/api/attempts/${attempt.id}/review`);
    const a = data.attempt;
    modal({
      title: `${a.student.full_name || a.student.username} — review`,
      wide: true,
      body: h(
        'div',
        {},
        h('p', { class: 'muted' }, `Score ${a.score}% (${a.correct}/${a.total}) · ${fmtDateTime(a.submitted_at)} · ${a.passed === 1 ? 'Passed' : 'Not passed'}`),
        ...a.review.map((r) =>
          h(
            'div',
            { class: `review-item ${r.is_correct ? 'ok' : 'bad'}` },
            h('p', { class: 'q-text' }, r.question),
            h('p', { class: 'review-line' }, `Student answer: ${r.student_answer || '—'} ${r.is_correct ? '✓' : '✗'}`),
            r.is_correct ? null : h('p', { class: 'review-line' }, `Correct answer: ${r.correct}`)
          )
        )
      ),
      actions: ({ close }) => [h('button', { class: 'btn ghost', onClick: () => close() }, 'Close')],
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}
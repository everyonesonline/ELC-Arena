import { api, h, mount, pageHeader, badge, toast, go, fmtDateTime, confirmModal } from '../api.js';
import { symbolButton } from '../symbols.js';

// ---------- join via teacher link ----------
export async function renderJoin(root, token) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Opening quiz link…')));
  try {
    const data = await api('/api/student/join', { method: 'POST', body: { token } });
    go(`#/quiz/${data.quiz.id}`);
  } catch (err) {
    const code = err.data && err.data.code;
    let title = 'Quiz link problem';
    let message = err.message;
    if (code === 'invalid_link') title = 'This link is no longer valid';
    if (code === 'not_granted') title = 'Access not granted yet';
    if (err.status === 409) {
      go('#/student');
      return;
    }
    mount(
      root,
      pageHeader(title),
      h(
        'div',
        { class: 'panel' },
        h('p', { class: 'muted', style: 'margin-bottom:16px' }, message),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', onClick: () => location.reload() }, 'Try again'),
          h('a', { class: 'btn ghost', href: '#/student' }, 'Back to my dashboard')
        )
      )
    );
  }
}

// ---------- take a quiz ----------
export async function renderTakeQuiz(root, quizId) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading quiz…')));

  let payload;
  try {
    payload = await api(`/api/student/quizzes/${quizId}/attempt`, { method: 'POST' });
  } catch (err) {
    if (err.status === 409 && (err.data?.code === 'already_completed' || err.data?.attempt)) {
      renderCompleted(root, quizId, err.data && err.data.attempt);
      return;
    }
    mount(
      root,
      pageHeader('Quiz'),
      h(
        'div',
        { class: 'panel' },
        h('p', { class: 'muted', style: 'margin-bottom:14px' }, err.message),
        h('a', { class: 'btn', href: '#/student' }, 'Back to my dashboard')
      )
    );
    return;
  }

  const { attempt, questions, answers } = payload;
  const quizMeta = payload.quiz || {};
  const stateObj = {
    index: 0,
    answers: new Map(),
    dirty: false,
  };
  for (const a of answers || []) stateObj.answers.set(a.question_id, a.student_answer);

  const guard = (e) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', guard);

  const shell = h('div', { class: 'exam-shell' });

  const saveNow = async (questionId, value) => {
    try {
      await api(`/api/student/attempts/${attempt.id}/answers`, {
        method: 'PUT',
        body: { answers: [{ question_id: questionId, answer: value }] },
      });
    } catch {
      /* autosave is best effort */
    }
  };

  function renderQuestion() {
    const q = questions[stateObj.index];
    const total = questions.length;
    const pct = Math.round(((stateObj.index + 1) / total) * 100);
    const value = stateObj.answers.get(q.id) ?? '';

    const body = h('div', { class: 'question-card' });

    body.append(
      h('div', { class: 'q-number' }, `Question ${stateObj.index + 1} of ${total} · ${q.type === 'mcq' ? 'Multiple choice' : 'Fill in the blank'} · ${q.points} pt${q.points === 1 ? '' : 's'}`),
      h('p', { class: 'q-text' }, q.question)
    );

    if (q.type === 'mcq') {
      const list = h('div', { class: 'options' });
      q.options.forEach((opt, idx) => {
        const selected = String(value) === String(idx);
        const row = h(
          'label',
          { class: `option ${selected ? 'selected' : ''}` },
          h('input', {
            type: 'radio',
            name: `q_${q.id}`,
            value: String(idx),
            checked: selected,
            onChange: () => {
              stateObj.answers.set(q.id, String(idx));
              renderQuestion();
              saveNow(q.id, String(idx));
            },
          }),
          h('span', {}, opt)
        );
        list.append(row);
      });
      body.append(list);
    } else {
      const input = h('input', {
        class: 'input',
        type: 'text',
        value,
        autocomplete: 'off',
        placeholder: 'Type your answer — use the symbol button for √ π ₂ …',
        style: 'font-size:17px',
        onInput: (e) => {
          stateObj.answers.set(q.id, e.target.value);
          saveNow(q.id, e.target.value);
        },
      });
      body.append(
        h(
          'div',
          { class: 'row', style: 'gap:8px' },
          input
        ),
        h(
          'div',
          { class: 'row', style: 'margin-top:10px' },
          symbolButton(input),
          h('span', { class: 'field-hint' }, 'Answers are matched ignoring spaces and letter case; you may type √, π, subscripts etc.')
        )
      );
    }

    const isFirst = stateObj.index === 0;
    const isLast = stateObj.index === questions.length - 1;
    body.append(
      h(
        'div',
        { class: 'exam-nav' },
        h(
          'button',
          {
            class: 'btn',
            disabled: isFirst,
            onClick: () => {
              stateObj.index -= 1;
              renderQuestion();
            },
          },
          '← Previous'
        ),
        isLast
          ? h(
              'button',
              {
                class: 'btn primary',
                onClick: () =>
                  confirmModal(
                    'Submit your answers now? After submitting you cannot redo this quiz unless the admin allows a retake.',
                    () => submit(),
                    { label: 'Submit quiz', danger: false }
                  ),
              },
              'Submit quiz ✓'
            )
          : h(
              'button',
              {
                class: 'btn primary',
                onClick: () => {
                  stateObj.index += 1;
                  renderQuestion();
                },
              },
              'Next →'
            )
      )
    );

    mount(shell, renderExamTop(), h('div', { class: 'progress' }, h('span', { style: `width:${pct}%` })), body);
  }

  function renderExamTop() {
    const answered = stateObj.answers.size;
    return h(
      'div',
      { class: 'exam-top' },
      h(
        'div',
        {},
        h('strong', { style: 'font-size:17px' }, quizMeta.title || 'Quiz in progress'),
        h('div', { class: 'muted', style: 'font-size:13px' }, `Answers save automatically · ${answered}/${questions.length} answered`)
      ),
      badge(`Pass ${quizMeta.pass_percent || 80}%`, 'blue')
    );
  }

  async function submit() {
    const list = questions.map((q) => ({
      question_id: q.id,
      answer: stateObj.answers.has(q.id) ? stateObj.answers.get(q.id) : '',
    }));
    let result;
    try {
      result = await api(`/api/student/attempts/${attempt.id}/submit`, { method: 'POST', body: { answers: list } });
    } catch (err) {
      if (err.status === 409) {
        window.removeEventListener('beforeunload', guard);
        renderCompleted(root, quizId, null);
        return;
      }
      toast(err.message, 'error');
      return;
    }
    window.removeEventListener('beforeunload', guard);
    renderResult(root, questions, result);
  }

  mount(root, shell);
  renderQuestion();
}

function renderResult(root, questions, { result, review }) {
  const passed = result.passed;
  mount(
    root,
    h(
      'div',
      { class: 'exam-shell' },
      h('div', { class: 'panel', style: 'text-align:center;padding:34px' },
        h(
          'div',
          { class: `result-score ${passed ? 'pass' : 'fail'}` },
          h('b', {}, `${result.score}%`),
          h('small', {}, 'YOUR SCORE')
        ),
        h('h2', { style: 'margin:6px 0 4px' }, passed ? 'Congratulations — you passed!' : 'Not quite there yet'),
        h(
          'p',
          { class: 'muted' },
          `You answered ${result.correct} of ${result.total} marks correctly. Pass mark: ${result.pass_percent}%.`
        ),
        h(
          'div',
          { class: 'row', style: 'justify-content:center;margin-top:16px' },
          passed && result.certificate_id
            ? h('a', { class: 'btn accent', href: `#/certificate/${result.certificate_id}` }, '🎉 Download certificate')
            : h('span', { class: 'warning-banner' }, 'Certificates begin at 80%. Ask the admin for a retake if allowed.'),
          h('a', { class: 'btn ghost', href: '#/student' }, 'Back to dashboard')
        )
      ),
      h('h2', { style: 'margin:26px 0 12px' }, 'Answer review'),
      ...(review || []).map((r) =>
        h(
          'div',
          { class: `review-item ${r.is_correct ? 'ok' : 'bad'}` },
          h('p', { class: 'q-text' }, r.question),
          h('p', { class: 'review-line' }, `Your answer: ${r.given || '—'} ${r.is_correct ? '✓' : '✗'}`),
          r.is_correct ? null : h('p', { class: 'review-line' }, `Correct answer: ${r.correct}`)
        )
      ),
      h('div', { class: 'row', style: 'margin-top:18px' }, h('a', { class: 'btn primary', href: '#/student' }, 'Back to dashboard'))
    )
  );
}

function renderCompleted(root, quizId, attempt) {
  mount(
    root,
    h(
      'div',
      { class: 'exam-shell' },
      h('div', { class: 'panel', style: 'text-align:center;padding:44px' },
        h('h2', { style: 'margin-top:0' }, 'You already completed this quiz'),
        h('p', { class: 'muted' },
          'A quiz cannot be taken again after submission. If you need to redo it, your admin can allow a retake.'
        ),
        attempt && attempt.score !== undefined
          ? h('p', { style: 'font-size:20px;font-weight:700' }, `Your score: ${attempt.score}%`)
          : null,
        h(
          'div',
          { class: 'row', style: 'justify-content:center;margin-top:14px' },
          h('a', { class: 'btn primary', href: '#/student' }, 'Back to my dashboard')
        )
      )
    )
  );
}
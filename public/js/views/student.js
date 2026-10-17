import {
  api,
  h,
  mount,
  pageHeader,
  badge,
  emptyState,
  toast,
  fmtDateTime,
  state,
  modal,
} from '../api.js';

export async function renderStudent(root) {
  mount(root, h('div', { class: 'boot-spinner' }, h('span', { class: 'spinner' }), h('p', {}, 'Loading your dashboard…')));

  const [overview, certs] = await Promise.all([
    api('/api/student/overview'),
    api('/api/student/certificates').catch(() => ({ certificates: [] })),
  ]);

  const quizCards = overview.quizzes.length
    ? h('div', { class: 'grid grid-2' }, ...overview.quizzes.map((q) => quizCard(q)))
    : emptyState(
        'No quizzes have been shared with you yet. When the teacher shares the link and the admin gives you access, the quiz will appear here.'
      );
  const certList = certs.certificates || [];

  mount(
    root,
    pageHeader('My learning', `Welcome back, ${state.user?.full_name || state.user?.username || ''} · ${state.user?.username || ''}`),
    h(
      'div',
      { class: 'panel share-card', style: 'margin-bottom:18px' },
      h(
        'div',
        { class: 'row between' },
        h(
          'div',
          {},
          h('strong', { style: 'font-size:17px' }, 'Program enrolled'),
          h('p', { class: 'muted', style: 'margin-top:4px' }, overview.program || 'Not assigned yet — ask the admin')
        ),
        badge(`${overview.quizzes.length} quiz${overview.quizzes.length === 1 ? '' : 'zes'} assigned`, 'blue')
      )
    ),
    h('h2', { style: 'margin:24px 0 12px' }, 'My quizzes'),
    quizCards,
    h('h2', { style: 'margin:30px 0 12px' }, 'My certificates'),
    certSection(certList)
  );
}

function certSection(list) {
  if (!list.length) return emptyState('Score 80% or more in a quiz to earn a downloadable certificate.');
  return h(
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
          h('th', {}, 'Marks'),
          h('th', {}, 'Issued'),
          h('th', { style: 'text-align:right' }, 'Action')
        )
      ),
      h(
        'tbody',
        {},
        ...list.map((c) =>
          h(
            'tr',
            {},
            h(
              'td',
              {},
              h('strong', {}, c.quiz_title),
              h('div', { class: 'muted', style: 'font-size:12.5px' }, c.cert_title || 'Certificate of Achievement')
            ),
            h('td', {}, badge(`${c.marks}%`, 'green')),
            h('td', {}, fmtDateTime(c.issued_at)),
            h(
              'td',
              { style: 'text-align:right' },
              h('a', { class: 'btn sm accent', href: `#/certificate/${c.id}` }, 'View & download')
            )
          )
        )
      )
    )
  );
}

function quizCard(q) {
  const statusBadge =
    q.status === 'completed'
      ? q.attempt && q.attempt.passed
        ? badge('Completed · Passed', 'green')
        : badge('Completed · Not passed', 'red')
      : q.status === 'in_progress'
        ? badge('In progress', 'amber')
        : badge('Pending', 'neutral');

  const metaLine =
    q.status === 'completed' && q.attempt
      ? h(
          'div',
          { class: 'quiz-meta' },
          h('span', {}, `Score: ${q.attempt.score}% (${q.attempt.correct}/${q.attempt.total})`),
          h('span', {}, `Pass mark: ${q.pass_percent}%`),
          h('span', {}, fmtDateTime(q.attempt.submitted_at))
        )
      : h(
          'div',
          { class: 'quiz-meta' },
          h('span', {}, `Pass mark: ${q.pass_percent}%`),
          q.program_name ? h('span', {}, q.program_name) : null
        );

  let primaryAction;
  if (q.status === 'completed') {
    if (q.retake_allowed) {
      primaryAction = h('a', { class: 'btn primary', href: `#/quiz/${q.id}` }, 'Start retake');
    } else if (q.certificate) {
      primaryAction = h('a', { class: 'btn accent', href: `#/certificate/${q.certificate.id}` }, 'Download certificate');
    } else {
      primaryAction = h('button', { class: 'btn', disabled: true }, 'Completed — a retake needs admin approval');
    }
  } else {
    primaryAction = h(
      'a',
      { class: 'btn primary', href: `#/quiz/${q.id}` },
      q.status === 'in_progress' ? 'Resume quiz' : 'Start quiz'
    );
  }

  return h(
    'div',
    { class: 'quiz-card' },
    h('div', { class: 'row between' }, h('h3', {}, q.title), statusBadge),
    q.description ? h('p', { class: 'desc' }, q.description) : null,
    metaLine,
    q.retake_allowed ? h('div', { class: 'warning-banner' }, 'A retake has been approved for you by the admin.') : null,
    q.certificate ? h('div', { class: 'success-banner' }, `Certificate issued — scored ${q.certificate.marks}%`) : null,
    h(
      'div',
      { class: 'row' },
      primaryAction,
      q.attempt
        ? h('button', { class: 'btn ghost', onClick: () => showReview(q) }, 'Review answers')
        : null
    )
  );
}

async function showReview(q) {
  try {
    const data = await api(`/api/attempts/${q.attempt.id}/review`);
    const review = data.attempt.review || [];
    modal({
      title: `Review — ${q.title}`,
      wide: true,
      body: review.length
        ? review.map((r) =>
            h(
              'div',
              { class: `review-item ${r.is_correct ? 'ok' : 'bad'}` },
              h('p', { class: 'q-text' }, r.question),
              h(
                'p',
                { class: 'review-line' },
                `Your answer: ${r.student_answer || '—'} ${r.is_correct ? '✓ correct' : '✗'}`
              ),
              r.is_correct ? null : h('p', { class: 'review-line' }, `Correct answer: ${r.correct}`)
            )
          )
        : h('p', { class: 'muted' }, 'No answers recorded for this attempt.'),
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}
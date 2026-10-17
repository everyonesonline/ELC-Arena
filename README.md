# ELC-Arena

ELC Arena — quizzes and certificates for Everyone's Learning Center.

> **Recovery notice (17 Oct 2026):** This source tree was reconstructed from the
> live preview deployment at
> `https://site-ffff9763a4654197accfef3bb51c1dd0.freebuff.page` after the original
> build chat was lost. The **entire frontend was recovered byte-for-byte** (no
> minification, no bundler, no source maps were involved — it was plain ES
> modules). The **server-side Worker code and D1 schema were NOT recoverable**
> (server code is never public); the live deployment still runs the real
> backend, so nothing was overwritten there.

## Project structure

```
public/                 static assets, exactly as deployed
  index.html            SPA shell (hash-based routing)
  styles.css            full stylesheet
  js/
    app.js              bootstrap + route table
    api.js              fetch wrapper, DOM helpers, modal/toast utilities
    certificate.js      certificate rendering
    symbols.js          shared symbol definitions
    views/
      login.js          sign-in
      student.js        student dashboard
      teacher.js        quiz editor + attempts review
      admin.js          admin: users, programs, access, certificates (~52 KB)
      quiz.js           quiz taking + join-by-token
worker.js               PLACEHOLDER — serves assets, returns 501 for /api/*
manifest.json           Freebuff Sites deploy manifest
```

## Running locally

The frontend is dependency-free vanilla ES modules:

```bash
python3 -m http.server 8000 --directory public
# open http://localhost:8000 — the UI loads; API calls fail until reimplemented
```

Any static file server works. There is no build step.

## API surface (recovered from the frontend; verified live 401s signed-out)

Auth: `POST /api/auth/login`, `/api/auth/logout`, `GET /api/auth/me`,
`POST /api/auth/password`

Student: `GET /api/student/overview`, `GET /api/student/certificates`,
`POST /api/student/join`, `POST /api/student/quizzes/:id/attempt`,
`GET /api/student/attempts/:id/answers`, `POST /api/student/attempts/:id/submit`

Quizzes/questions: `/api/quizzes` (+ `:id`, `/:id/share`, `/:id/attempts`,
`/:id/certificate`, `/:id/questions`, `/:id/questions/bulk`),
`/api/questions/:id`, `/api/attempts/:id/review`, `/api/issuances/:id`

Programs: `/api/programs` (+ `:id`)

Admin: `/api/admin/overview`, `/api/admin/users` (+ `:id`),
`/api/admin/retakes`, `/api/admin/quizzes/:id/students|teachers|grants`,
`/api/admin/certificates` (+ query `quiz_id`, `:issuanceId`)

Roles seen in the route table: `student`, `teacher`, `admin`.
Requests send `x-requested-with: XMLHttpRequest` and JSON bodies, cookies
same-origin.

## Restoring the backend

The D1 database (binding `DB`) still exists on the preview environment with its
data intact (quizzes, users, attempts, certificates). The `worker.js` stub here
marks every `/api/*` route as 501 so the frontend fails loudly; reimplement the
endpoints above against `env.DB` (and re-enable Sign in with Freebuff) to make
this tree fully self-sufficient.

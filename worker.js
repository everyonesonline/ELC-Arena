// ELC Arena — placeholder Worker.
//
// The original server code is NOT recoverable from a deployed site: only the
// static assets are public. This stub serves the recovered frontend exactly as
// deployed and marks every /api/* route as unimplemented (501) so the frontend
// fails loudly instead of silently. Reimplement the routes listed in README.md
// against the existing D1 database (binding: DB) to restore full functionality.
//
// The live preview environment still runs the real backend, so this file is
// only a scaffold for a future re-deploy — do not overwrite the live site with
// it until the API is reimplemented.

const NOT_IMPLEMENTED = {
  error: 'API not reimplemented yet — original Worker code was not recoverable. See README.md for the endpoint list.',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify(NOT_IMPLEMENTED), {
        status: 501,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // Static assets (index.html, styles.css, js/*) exactly as deployed.
    return env.ASSETS.fetch(request);
  },
};

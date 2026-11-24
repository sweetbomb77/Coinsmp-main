// Public API proxy for the Coin SMP site. The API origin is stored as a
// Worker setting and is not included in this source file.
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const path = new URL(request.url).pathname;
    if (!['/api/stats', '/api/events'].includes(path)) return new Response('Not found', { status: 404, headers: cors });
    if (!env.UPSTREAM_ORIGIN) return new Response('API proxy is not configured', { status: 503, headers: cors });

    try {
      const upstreamUrl = new URL(env.UPSTREAM_ORIGIN);
      if (!['http:', 'https:'].includes(upstreamUrl.protocol) ||
          /^(\\d{1,3}\\.){3}\\d{1,3}$/.test(upstreamUrl.hostname) ||
          upstreamUrl.hostname.startsWith('[')) {
        return new Response('UPSTREAM_ORIGIN must use http(s) and a DNS hostname, not an IP literal.', { status: 503, headers: cors });
      }
      upstreamUrl.pathname = path;
      upstreamUrl.search = '';
      upstreamUrl.hash = '';
      const upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' } });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8' }
      });
    } catch (error) {
      console.error('Coin SMP API proxy request failed', error?.message || String(error));
      return new Response(JSON.stringify({ error: 'Could not reach the Coin SMP API' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }
};

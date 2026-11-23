// Deploy this as a Cloudflare Worker. Set UPSTREAM_ORIGIN in the Worker
// settings (for example, your API server's http://host:port origin).
// Do not put the origin address in this public file.
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
      const origin = env.UPSTREAM_ORIGIN.replace(/\/$/, '');
      const upstream = await fetch(`${origin}${path}`, { headers: { Accept: 'application/json' } });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8' }
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Could not reach the Coin SMP API' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }
};

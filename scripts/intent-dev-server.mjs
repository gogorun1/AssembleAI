#!/usr/bin/env node
/**
 * Local HTTP server for the real api/intent handler (Vite SSR loads TypeScript).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/intent-dev-server.mjs
 *   curl -X POST http://localhost:8787/api/intent -H 'Content-Type: application/json' -d @payload.json
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.INTENT_DEV_PORT ?? 8787);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const vite = await createViteServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn'
});

const { handleIntentRequest } = await vite.ssrLoadModule('/api/intent/index.ts');

const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (url.pathname === '/api/intent') {
    const started = Date.now();
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    let utterance = '';
    try {
      utterance = JSON.parse(body).utterance ?? '';
    } catch {
      utterance = '(invalid json)';
    }
    console.log(`[intent] <- ${new Date().toISOString()} POST utterance="${utterance}"`);

    const request = new Request(`http://localhost:${PORT}${url.pathname}${url.search}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
    });

    try {
      const response = await handleIntentRequest(request);
      const payload = await response.text();
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders(req)
      });
      console.log(`[intent] -> ${response.status} ${Date.now() - started}ms ${payload.slice(0, 120)}`);
      res.end(payload);
    } catch (error) {
      console.error('[intent] handler error', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, corsHeaders(req));
  res.end('Not found');
});

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

server.listen(PORT, '127.0.0.1', () => {
  const endpoint = process.env.INTENT_LLM_ENDPOINT ?? 'https://api.openai.com/v1/responses';
  const model = process.env.INTENT_LLM_MODEL ?? 'gpt-4.1-mini';
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  console.log(`[intent-dev-server] http://127.0.0.1:${PORT}/api/intent`);
  console.log(`[intent-dev-server] model=${model} endpoint=${endpoint} key=${hasKey ? 'set' : 'MISSING'}`);
});

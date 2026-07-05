#!/usr/bin/env node
/**
 * Local HTTP server for the real api/* handlers (Vite SSR loads TypeScript).
 *
 * Serves:
 *   POST /api/intent  - structured intent parsing
 *   POST /api/stt     - speech-to-text for a recorded audio clip (multipart)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/intent-dev-server.mjs
 *   curl -X POST http://localhost:8787/api/intent -H 'Content-Type: application/json' -d @payload.json
 *   curl -X POST http://localhost:8787/api/stt -F audio=@clip.webm -F language=en
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
const { handleSttRequest } = await vite.ssrLoadModule('/api/stt/index.ts');

const routes = {
  '/api/intent': { handler: handleIntentRequest, log: logIntent },
  '/api/stt': { handler: handleSttRequest, log: logStt }
};

const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const route = routes[url.pathname];
  if (!route) {
    res.writeHead(404, corsHeaders(req));
    res.end('Not found');
    return;
  }

  const started = Date.now();
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  route.log(url.pathname, body, req);

  const request = new Request(`http://localhost:${PORT}${url.pathname}${url.search}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
  });

  try {
    const response = await route.handler(request);
    const payload = await response.text();
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers.entries()),
      ...corsHeaders(req)
    });
    console.log(`[${label(url.pathname)}] -> ${response.status} ${Date.now() - started}ms ${payload.slice(0, 120)}`);
    res.end(payload);
  } catch (error) {
    console.error(`[${label(url.pathname)}] handler error`, error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

function label(pathname) {
  return pathname.replace('/api/', '');
}

function logIntent(pathname, body) {
  let utterance = '';
  try {
    utterance = JSON.parse(body.toString('utf8')).utterance ?? '';
  } catch {
    utterance = '(invalid json)';
  }
  console.log(`[intent] <- ${new Date().toISOString()} POST utterance="${utterance}"`);
}

function logStt(pathname, body) {
  console.log(`[stt] <- ${new Date().toISOString()} POST audio=${body.length} bytes`);
}

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
  const intentModel = process.env.INTENT_LLM_MODEL ?? 'gpt-4.1-mini';
  const sttModel = process.env.STT_LLM_MODEL ?? 'gpt-4o-mini-transcribe';
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  console.log(`[api-dev-server] http://127.0.0.1:${PORT}`);
  console.log(`[api-dev-server]   POST /api/intent  (model=${intentModel})`);
  console.log(`[api-dev-server]   POST /api/stt     (model=${sttModel})`);
  console.log(`[api-dev-server] OPENAI_API_KEY=${hasKey ? 'set' : 'MISSING'}`);
});

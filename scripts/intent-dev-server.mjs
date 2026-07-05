#!/usr/bin/env node
/**
 * Local HTTP server for the real agent/api handlers (Vite SSR loads TypeScript).
 *
 * Serves:
 *   POST /api/intent      - structured intent parsing
 *   POST /api/stt         - speech-to-text for a recorded audio clip (multipart)
 *   POST /api/photo-check - Gemini vision assembly photo check
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... GEMINI_API_KEY=... node scripts/intent-dev-server.mjs
 *   curl -X POST http://localhost:8787/api/intent -H 'Content-Type: application/json' -d @payload.json
 *   curl -X POST http://localhost:8787/api/stt -F audio=@clip.webm -F language=en
 *   curl -X POST http://localhost:8787/api/photo-check -H 'Content-Type: application/json' -d @photo.json
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.INTENT_DEV_PORT ?? 8787);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Load .env / .env.local (all keys, not just VITE_*) into process.env so the
// server-side handlers can read secrets like GEMINI_API_KEY and OPENAI_API_KEY.
const fileEnv = loadEnv('development', ROOT, '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const vite = await createViteServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn'
});

const { handleIntentRequest } = await vite.ssrLoadModule('/api/intent/index.ts');
const { handleSttRequest } = await vite.ssrLoadModule('/api/stt/index.ts');
const { handlePhotoCheckRequest } = await vite.ssrLoadModule('/api/photo-check/index.ts');

const routes = {
  '/api/intent': { handler: handleIntentRequest, label: 'intent', log: logIntent },
  '/api/stt': { handler: handleSttRequest, label: 'stt', log: logStt },
  '/api/photo-check': { handler: handlePhotoCheckRequest, label: 'photo-check', log: logPhotoCheck }
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
    console.log(`[${route.label}] -> ${response.status} ${Date.now() - started}ms ${payload.slice(0, 120)}`);
    res.end(payload);
  } catch (error) {
    console.error(`[${route.label}] handler error`, error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

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

function logPhotoCheck(pathname, body) {
  console.log(`[photo-check] <- ${new Date().toISOString()} POST ${body.length} bytes`);
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
  const visionModel = process.env.GEMINI_VISION_MODEL ?? 'gemini-2.0-flash';
  const hasIntentKey = Boolean(process.env.OPENAI_API_KEY);
  const hasSttKey = Boolean(process.env.OPENAI_API_KEY);
  const hasVisionKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  console.log(`[agent-dev-server] http://127.0.0.1:${PORT}`);
  console.log(`[agent-dev-server] /api/intent       model=${intentModel} key=${hasIntentKey ? 'set' : 'MISSING'}`);
  console.log(`[agent-dev-server] /api/stt          model=${sttModel} key=${hasSttKey ? 'set' : 'MISSING'}`);
  console.log(`[agent-dev-server] /api/photo-check  model=${visionModel} key=${hasVisionKey ? 'set' : 'MISSING'}`);
});

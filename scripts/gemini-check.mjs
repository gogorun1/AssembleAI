#!/usr/bin/env node
/**
 * Diagnostic: verify the Gemini API key and list models that support
 * generateContent (i.e. usable by the Photo Check feature).
 *
 * Usage:
 *   npm run gemini:models
 *   # or: GEMINI_API_KEY=... node scripts/gemini-check.mjs
 */
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fileEnv = loadEnv('development', ROOT, '');
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || fileEnv.GEMINI_API_KEY;

if (!apiKey) {
  console.error('No GEMINI_API_KEY found in environment or .env.local');
  process.exit(1);
}

const base = 'https://generativelanguage.googleapis.com/v1beta/models';

try {
  const response = await fetch(`${base}?pageSize=100`, {
    headers: { 'x-goog-api-key': apiKey }
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`ListModels failed: ${response.status}`);
    console.error(text);
    process.exit(1);
  }

  const data = JSON.parse(text);
  const models = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''));

  console.log(`Key OK. ${models.length} models support generateContent:\n`);
  for (const name of models) {
    console.log(`  - ${name}`);
  }

  const recommended =
    models.find((n) => /flash/.test(n) && !/thinking|exp|preview/.test(n)) ??
    models.find((n) => /flash/.test(n)) ??
    models[0];
  if (recommended) {
    console.log(`\nRecommended GEMINI_VISION_MODEL=${recommended}`);
  }
} catch (error) {
  console.error('Request failed:', error?.message ?? error);
  if (error?.cause) {
    console.error('Cause:', error.cause?.message ?? error.cause);
  }
  process.exit(1);
}

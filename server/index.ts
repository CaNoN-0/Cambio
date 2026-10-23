/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Production entry point: serves the built SPA from dist/ and the API from the same origin.
 * Build with `npm run build`, run with `npm start` (PORT defaults to 3000; Cloud Run sets it).
 */

import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createApiApp } from './app';
import { bootstrapIdentity } from './bootstrap';

// A rejected promise inside a dependency (e.g. a gRPC credential refresh) must not take the whole
// payments API down. Log it; request handlers already convert their own failures into 5xx responses.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason instanceof Error ? reason.message : reason);
});

async function main() {
  const { identity, error } = await bootstrapIdentity(process.env, 'production');
  const api = createApiApp({
    identity,
    identityInitError: error,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    publicOrigin: process.env.APP_URL && /^https?:\/\//.test(process.env.APP_URL) ? process.env.APP_URL : undefined,
    // Cloud Run and most PaaS put exactly one proxy in front; needed for correct client IPs in rate limiting.
    trustProxy: process.env.TRUST_PROXY ?? 1,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(api);

  const dist = path.resolve(process.cwd(), 'dist');
  if (!existsSync(path.join(dist, 'index.html'))) {
    console.error('[server] dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
  }
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  // SPA fallback for client-side routes such as /app/activity. Payment links use #pay, which never reaches the server.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`[server] Cambio listening on :${port} (identity: ${identity ? identity.storeInfo.kind : `unavailable — ${error}`})`);
  });
}

main().catch((err) => {
  console.error('[server] fatal', err);
  process.exit(1);
});

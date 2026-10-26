/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Chooses and initialises the identity store from environment variables.
 *
 *   IDENTITY_STORE=firestore   Cloud Firestore via firebase-admin (default in production).
 *   IDENTITY_STORE=memory      In-process, non-durable. Default in development when no Firestore
 *                              credentials/emulator are configured. Refused in production unless
 *                              ALLOW_NON_DURABLE_IDENTITY=true.
 *
 * Firestore settings: FIREBASE_PROJECT_ID / FIRESTORE_DATABASE_ID (defaults come from
 * firebase-applet-config.json). Credentials come from Application Default Credentials
 * (the Cloud Run service account) or GOOGLE_APPLICATION_CREDENTIALS; FIRESTORE_EMULATOR_HOST
 * points the Admin SDK at the local emulator.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { IdentityService } from './identity/service';
import { MemoryIdentityStore } from './identity/memoryStore';
import type { IdentityStore } from './identity/store';
import type { SharedRateLimitStore } from './rateLimit';

export interface IdentityBootstrap {
  identity: IdentityService | null;
  error?: string;
  store?: IdentityStore['kind'];
  rateLimitStore?: SharedRateLimitStore;
}

function appletConfig(): { projectId?: string; firestoreDatabaseId?: string } {
  try {
    return JSON.parse(readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
  } catch {
    return {};
  }
}

export async function createFirestoreStore(env: NodeJS.ProcessEnv) {
  const { initializeApp, getApps, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { FirestoreIdentityStore } = await import('./identity/firestoreStore');
  const cfg = appletConfig();
  const projectId = env.FIREBASE_PROJECT_ID || cfg.projectId;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not set');
  // Fail fast and cleanly when no credentials exist (the emulator needs none). Without this probe the
  // Firestore client discovers the problem later, inside a promise it does not surface to callers.
  if (!env.FIRESTORE_EMULATOR_HOST) {
    await Promise.race([
      applicationDefault().getAccessToken(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out obtaining Google credentials')), 8000)),
    ]);
  }
  const app = getApps().find((a) => a.name === 'cambio-identity') ?? initializeApp({ projectId }, 'cambio-identity');
  const databaseId = env.FIRESTORE_DATABASE_ID || cfg.firestoreDatabaseId;
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  return new FirestoreIdentityStore(db, !env.FIRESTORE_EMULATOR_HOST);
}

export async function bootstrapIdentity(env: NodeJS.ProcessEnv = process.env, mode: 'production' | 'development' = 'production'): Promise<IdentityBootstrap> {
  if (mode === 'production' && env.FIRESTORE_EMULATOR_HOST && env.ALLOW_NON_DURABLE_IDENTITY !== 'true') return { identity: null, error: 'Firestore emulator is not durable production identity storage.' };
  const hasFirestore = !!(env.FIRESTORE_EMULATOR_HOST || env.GOOGLE_APPLICATION_CREDENTIALS || env.K_SERVICE);
  const requested = env.IDENTITY_STORE || (mode === 'production' || hasFirestore ? 'firestore' : 'memory');

  if (requested === 'memory') {
    if (mode === 'production' && env.ALLOW_NON_DURABLE_IDENTITY !== 'true') {
      return { identity: null, error: 'IDENTITY_STORE=memory is not allowed in production (set ALLOW_NON_DURABLE_IDENTITY=true to override).' };
    }
    console.warn('[identity] Using the in-memory store: usernames are NOT durable and NOT shared across instances.');
    return { identity: new IdentityService({ store: new MemoryIdentityStore() }), store: 'memory' };
  }

  if (requested !== 'firestore') return { identity: null, error: `Unknown IDENTITY_STORE "${requested}"` };

  try {
    const store = await createFirestoreStore(env);
    return { identity: new IdentityService({ store }), store: 'firestore', rateLimitStore: store };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[identity] Firestore store could not be initialised:', message);
    return { identity: null, error: 'Firestore identity store could not be initialised.' };
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Durable store on Cloud Firestore via the Admin SDK (server-side credentials only).
 * Client SDKs cannot write these collections: firestore.rules denies all client writes.
 *
 * Collections:
 *   verified_usernames/{username}   -> UsernameRecord
 *   verified_wallets/{address}      -> { username, address, updatedAt }
 *   identity_challenges/{nonce}     -> ChallengeRecord (never readable by clients)
 *
 * Legacy client-written collections (`usernames`, `wallets`) are deliberately ignored: their
 * ownership was never verified.
 */

import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import { decideClaim, StoreUnavailableError, type ChallengeRecord, type CommitResult, type IdentityStore, type UsernameRecord } from './store';

export const COLLECTIONS = {
  usernames: 'verified_usernames',
  wallets: 'verified_wallets',
  challenges: 'identity_challenges',
} as const;

function asUsernameRecord(data: DocumentData | undefined): UsernameRecord | null {
  if (!data || typeof data.username !== 'string' || typeof data.address !== 'string') return null;
  return {
    username: data.username,
    address: data.address,
    createdAt: Number(data.createdAt) || 0,
    updatedAt: Number(data.updatedAt) || 0,
    proof: 'siwe',
    chainId: Number(data.chainId) || 0,
  };
}

function asChallenge(data: DocumentData | undefined): ChallengeRecord | null {
  if (!data || typeof data.nonce !== 'string') return null;
  return {
    nonce: data.nonce,
    address: data.address,
    action: data.action,
    username: data.username,
    chainId: Number(data.chainId),
    message: data.message,
    issuedAt: Number(data.issuedAt),
    expiresAt: Number(data.expiresAt),
    usedAt: data.usedAt === null || data.usedAt === undefined ? null : Number(data.usedAt),
  };
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: number | string }).code;
    // gRPC UNAVAILABLE(14) / DEADLINE_EXCEEDED(4) / UNAUTHENTICATED(16) / PERMISSION_DENIED(7) => store is not usable.
    if ([4, 7, 14, 16, 'unavailable', 'permission-denied', 'unauthenticated'].includes(code as never)) {
      throw new StoreUnavailableError(String((err as Error).message || err));
    }
    if (/Could not load the default credentials|getaddrinfo|ECONNREFUSED/i.test(String((err as Error).message))) {
      throw new StoreUnavailableError(String((err as Error).message));
    }
    throw err;
  }
}

export class FirestoreIdentityStore implements IdentityStore {
  readonly kind = 'firestore' as const;
  readonly durable = true;
  constructor(private readonly db: Firestore) {}

  async ping() {
    await guard(() => this.db.collection(COLLECTIONS.usernames).limit(1).get());
  }

  async saveChallenge(c: ChallengeRecord) {
    await guard(() => this.db.collection(COLLECTIONS.challenges).doc(c.nonce).create(c));
  }

  async getChallenge(nonce: string) {
    return guard(async () => asChallenge((await this.db.collection(COLLECTIONS.challenges).doc(nonce).get()).data()));
  }

  async getByUsername(username: string) {
    return guard(async () => asUsernameRecord((await this.db.collection(COLLECTIONS.usernames).doc(username).get()).data()));
  }

  async getByAddress(address: string) {
    return guard(async () => {
      const w = (await this.db.collection(COLLECTIONS.wallets).doc(address).get()).data();
      if (!w || typeof w.username !== 'string') return null;
      const rec = await this.getByUsername(w.username);
      // Both directions must agree; a dangling pointer is treated as "no username".
      return rec && rec.address === address ? rec : null;
    });
  }

  async commitClaim(args: { nonce: string; address: string; action: 'register' | 'change'; username: string; now: number }): Promise<CommitResult> {
    return guard(() =>
      this.db.runTransaction(async (tx) => {
        const challengeRef = this.db.collection(COLLECTIONS.challenges).doc(args.nonce);
        const nameRef = this.db.collection(COLLECTIONS.usernames).doc(args.username);
        const walletRef = this.db.collection(COLLECTIONS.wallets).doc(args.address);

        const [challengeSnap, nameSnap, walletSnap] = await Promise.all([tx.get(challengeRef), tx.get(nameRef), tx.get(walletRef)]);
        const challenge = asChallenge(challengeSnap.data());
        const forName = asUsernameRecord(nameSnap.data());
        const walletName = walletSnap.data()?.username;
        let forWallet: UsernameRecord | null = null;
        let oldNameRef: DocumentReference | null = null;
        if (typeof walletName === 'string') {
          oldNameRef = this.db.collection(COLLECTIONS.usernames).doc(walletName);
          const oldSnap = walletName === args.username ? nameSnap : await tx.get(oldNameRef);
          const rec = asUsernameRecord(oldSnap.data());
          forWallet = rec && rec.address === args.address ? rec : null;
        }

        const d = decideClaim(args, challenge, forName, forWallet);
        if (challenge && (d.ok || d.markUsed)) tx.update(challengeRef, { usedAt: args.now });
        if (!d.ok) return { ok: false, reason: d.reason } as CommitResult;

        const record = forName ? { ...d.record, createdAt: forName.createdAt } : d.record;
        if (d.release && oldNameRef) tx.delete(oldNameRef);
        tx.set(nameRef, record);
        tx.set(walletRef, { username: record.username, address: record.address, updatedAt: record.updatedAt });
        return { ok: true, record, previousUsername: d.release } as CommitResult;
      })
    );
  }
}

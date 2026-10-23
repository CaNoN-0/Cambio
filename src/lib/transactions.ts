/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Transaction lifecycle and the local ledger of transactions this browser submitted.
 *
 * Rules enforced here:
 *  - A hash only ever comes from the wallet (writeContract). Nothing in Cambio generates one.
 *  - "confirmed" requires a receipt with status === 'success'; "reverted" requires a receipt with
 *    status === 'reverted'. A timeout or RPC failure after broadcast is "unknown", never success/failure.
 *  - Ledger statuses are a cache; reconcileLedger() re-derives them from chain receipts.
 */

import type { Address, Hex } from 'viem';
import type { TxErrorCode } from './txErrors';

export interface ReceiptSummary {
  status: 'success' | 'reverted';
  blockNumber: string;
  gasUsed: string;
  effectiveGasPrice: string | null;
  /** Block timestamp in ms, when the block could be fetched. */
  blockTimestamp: number | null;
}

export type TxPhase =
  | { phase: 'idle' }
  | { phase: 'preparing'; step?: string }
  | { phase: 'awaiting_signature'; step?: string }
  | { phase: 'pending'; hash: Hex; submittedAt: number; step?: string }
  | { phase: 'confirmed'; hash: Hex; receipt: ReceiptSummary }
  | { phase: 'reverted'; hash: Hex; receipt: ReceiptSummary }
  | { phase: 'rejected'; message: string }
  | { phase: 'failed'; code: TxErrorCode; message: string }
  | { phase: 'unknown'; hash: Hex; message: string };

export const isBusy = (p: TxPhase) => p.phase === 'preparing' || p.phase === 'awaiting_signature' || p.phase === 'pending';
export const isTerminal = (p: TxPhase) =>
  p.phase === 'confirmed' || p.phase === 'reverted' || p.phase === 'rejected' || p.phase === 'failed' || p.phase === 'unknown';

export type LedgerStatus = 'pending' | 'confirmed' | 'reverted' | 'unknown';

export interface LedgerEntry {
  mode: 'real';
  kind: 'transfer' | 'swap' | 'approval';
  chainId: number;
  hash: Hex;
  from: Address;
  /** Transfer recipient, or the router/spender for swaps and approvals. */
  to: Address;
  token: Address;
  symbol: string;
  decimals: number;
  /** Base units as a decimal string (bigint is not JSON-serialisable). */
  amount: string;
  status: LedgerStatus;
  submittedAt: number;
  blockNumber?: string;
  blockTimestamp?: number | null;
  /** Private note kept on this device only. It is not written on-chain. */
  memo?: string;
  requestId?: string;
  swap?: {
    tokenOut: Address;
    symbolOut: string;
    decimalsOut: number;
    minAmountOut: string;
    /** Actual amount received, parsed from the receipt's Transfer log after confirmation. */
    amountOut?: string;
  };
}

/** Fields that may change after submission. Identity fields (hash, chain, sender) never do. */
export type LedgerPatch = Partial<Omit<LedgerEntry, 'mode' | 'hash' | 'chainId' | 'from'>>;

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_LEDGER_ENTRIES = 100;

export function ledgerKey(chainId: number, address: string): string {
  return `cambio.ledger.v2:${chainId}:${address.toLowerCase()}`;
}

function isLedgerEntry(x: unknown): x is LedgerEntry {
  const e = x as LedgerEntry;
  return (
    !!e &&
    e.mode === 'real' &&
    (e.kind === 'transfer' || e.kind === 'swap' || e.kind === 'approval') &&
    Number.isSafeInteger(e.chainId) &&
    typeof e.hash === 'string' && HASH_RE.test(e.hash) &&
    typeof e.from === 'string' && ADDR_RE.test(e.from) &&
    typeof e.to === 'string' && ADDR_RE.test(e.to) &&
    typeof e.token === 'string' && ADDR_RE.test(e.token) &&
    typeof e.amount === 'string' && /^\d+$/.test(e.amount) &&
    ['pending', 'confirmed', 'reverted', 'unknown'].includes(e.status) &&
    typeof e.submittedAt === 'number'
  );
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLedger(chainId: number, address: string, store = defaultStore()): LedgerEntry[] {
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(ledgerKey(chainId, address)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isLedgerEntry).filter((e) => e.chainId === chainId && e.from.toLowerCase() === address.toLowerCase())
      : [];
  } catch {
    return [];
  }
}

export function upsertLedgerEntry(entry: LedgerEntry, store = defaultStore()): void {
  if (!store || !isLedgerEntry(entry)) return;
  const existing = readLedger(entry.chainId, entry.from, store);
  const merged = [entry, ...existing.filter((e) => e.hash.toLowerCase() !== entry.hash.toLowerCase())]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, MAX_LEDGER_ENTRIES);
  try {
    store.setItem(ledgerKey(entry.chainId, entry.from), JSON.stringify(merged));
  } catch {
    // Storage full or unavailable: the transaction still exists on-chain and in explorer history.
  }
}

export function updateLedgerEntry(
  chainId: number,
  from: string,
  hash: string,
  patch: LedgerPatch,
  store = defaultStore()
): void {
  const current = readLedger(chainId, from, store).find((e) => e.hash.toLowerCase() === hash.toLowerCase());
  if (current) upsertLedgerEntry({ ...current, ...patch }, store);
}

export interface ReceiptLike {
  status: 'success' | 'reverted';
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice?: bigint | null;
}

export function summarizeReceipt(r: ReceiptLike, blockTimestampMs: number | null): ReceiptSummary {
  return {
    status: r.status,
    blockNumber: r.blockNumber.toString(),
    gasUsed: r.gasUsed.toString(),
    effectiveGasPrice: r.effectiveGasPrice != null ? r.effectiveGasPrice.toString() : null,
    blockTimestamp: blockTimestampMs,
  };
}

/** The only mapping from a receipt to a terminal phase. A missing receipt is never treated as success. */
export function phaseFromReceipt(hash: Hex, receipt: ReceiptSummary): TxPhase {
  return receipt.status === 'success' ? { phase: 'confirmed', hash, receipt } : { phase: 'reverted', hash, receipt };
}

/**
 * Re-check pending/unknown ledger entries against the chain.
 * getReceipt should resolve null when the transaction is not yet mined, and throw on RPC failure.
 */
export async function reconcileLedger(
  entries: LedgerEntry[],
  getReceipt: (hash: Hex) => Promise<ReceiptLike | null>,
  onUpdate: (hash: Hex, status: LedgerStatus, receipt: ReceiptLike | null) => void
): Promise<void> {
  const open = entries.filter((e) => e.status === 'pending' || e.status === 'unknown');
  await Promise.all(
    open.map(async (e) => {
      try {
        const receipt = await getReceipt(e.hash);
        if (!receipt) return; // still pending; leave as-is
        onUpdate(e.hash, receipt.status === 'success' ? 'confirmed' : 'reverted', receipt);
      } catch {
        // RPC failure: keep the previous status rather than guessing.
      }
    })
  );
}

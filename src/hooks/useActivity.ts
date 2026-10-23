/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import type { MezoChainConfig } from '../config/chains';
import { fetchExplorerActivity, fetchRpcActivity, mergeActivity, type ActivityResult } from '../lib/activity';
import { readLedger, reconcileLedger, updateLedgerEntry } from '../lib/transactions';
import { getReceiptOrNull, publicClientFor } from '../lib/wagmiDeps';

const EMPTY: ActivityResult = { items: [], source: 'none', coverage: '', fetchedAt: 0, error: null };

export function useActivity(address: Address | null, chain: MezoChainConfig | null, enabled: boolean) {
  const [result, setResult] = useState<ActivityResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !address || !chain) {
      setResult(EMPTY);
      return;
    }
    const run = ++seq.current;
    setLoading(true);

    // Re-derive the status of anything this device submitted before reading history.
    await reconcileLedger(readLedger(chain.chainId, address), (h) => getReceiptOrNull(chain.chainId, h), (hash, status, receipt) =>
      updateLedgerEntry(chain.chainId, address, hash, { status, blockNumber: receipt?.blockNumber.toString() })
    );

    let next: ActivityResult;
    try {
      const items = await fetchExplorerActivity(chain, address);
      next = {
        items: mergeActivity(items, readLedger(chain.chainId, address)),
        source: 'explorer',
        coverage: `MUSD transfers indexed by the ${chain.name} explorer`,
        fetchedAt: Date.now(),
        error: null,
      };
    } catch (explorerErr) {
      try {
        const items = await fetchRpcActivity(publicClientFor(chain.chainId) as never, chain, address);
        next = {
          items: mergeActivity(items, readLedger(chain.chainId, address)),
          source: 'rpc-logs',
          coverage: 'Explorer unavailable — showing MUSD transfers from the last ~11 hours read directly from the RPC',
          fetchedAt: Date.now(),
          error: null,
        };
      } catch {
        next = {
          items: mergeActivity([], readLedger(chain.chainId, address)),
          source: 'none',
          coverage: 'Network history is unavailable right now. Only transactions sent from this device are shown.',
          fetchedAt: Date.now(),
          error: explorerErr instanceof Error ? explorerErr.message : 'History unavailable',
        };
      }
    }
    if (run === seq.current) {
      setResult(next);
      setLoading(false);
    }
  }, [address, chain, enabled]);

  useEffect(() => {
    setResult(EMPTY);
    load();
  }, [load]);

  // Poll while anything is unresolved, so pending transactions settle on screen without a reload.
  const hasOpen = result.items.some((i) => i.status === 'pending' || i.status === 'unknown');
  useEffect(() => {
    if (!hasOpen) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [hasOpen, load]);

  return { ...result, loading, refresh: load };
}

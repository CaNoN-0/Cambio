/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPublicClient, http, formatEther } from 'viem';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaction } from '../types';

/**
 * Fetch real on-chain native / MUSD balance for connected address
 */
export async function fetchRealOnChainBalance(
  address: string, 
  chainId?: number | string | null
): Promise<number> {
  if (!address) return 0;
  
  try {
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    let rpcUrl = 'https://rpc.mezo.org';
    
    if (numChainId === 31611) {
      rpcUrl = 'https://rpc.matsnet.mezo.org';
    } else if (numChainId === 1) {
      rpcUrl = 'https://cloudflare-eth.com';
    } else if (numChainId === 42161) {
      rpcUrl = 'https://arb1.arbitrum.io/rpc';
    } else if (numChainId === 11155111) {
      rpcUrl = 'https://rpc.sepolia.org';
    }

    const client = createPublicClient({
      transport: http(rpcUrl, { timeout: 3500 }),
    });

    const balanceWei = await client.getBalance({ 
      address: address as `0x${string}` 
    });
    
    const formatted = parseFloat(formatEther(balanceWei));
    return isNaN(formatted) ? 0 : formatted;
  } catch (err) {
    console.warn('Real on-chain balance query fallback to 0.00:', err);
    return 0;
  }
}

/**
 * Persist real transaction to Firestore for a connected wallet
 */
export async function saveRealTransaction(
  walletAddress: string, 
  transaction: Transaction
): Promise<void> {
  if (!walletAddress || !transaction) return;
  const normalizedAddr = walletAddress.toLowerCase();

  try {
    const txRef = doc(db, 'wallet_transactions', normalizedAddr, 'history', transaction.id);
    await setDoc(txRef, {
      ...transaction,
      walletAddress: normalizedAddr,
      savedAt: Date.now(),
      isDemo: false,
    });
  } catch (err) {
    console.warn('Could not persist real transaction to Firestore, using session storage:', err);
    try {
      const key = `cambio_txs_${normalizedAddr}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([transaction, ...existing]));
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Load real transactions for a connected wallet from Firestore
 */
export async function loadRealTransactions(
  walletAddress: string
): Promise<Transaction[]> {
  if (!walletAddress) return [];
  const normalizedAddr = walletAddress.toLowerCase();

  try {
    const historyCol = collection(db, 'wallet_transactions', normalizedAddr, 'history');
    const q = query(historyCol, orderBy('savedAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs.map((docSnap) => docSnap.data() as Transaction);
    }
  } catch (err) {
    console.warn('Could not read real transactions from Firestore, checking local storage:', err);
  }

  try {
    const key = `cambio_txs_${normalizedAddr}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // Ignore
  }

  return [];
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  doc, 
  getDoc, 
  runTransaction 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UsernameRecord, UsernameCheckResult } from '../types';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const STORAGE_KEY = 'cambio_username_registry_cache_v1';

/**
 * Normalizes a raw username input:
 * - Trims whitespace
 * - Strips all leading '@' characters
 * - Converts to lowercase for case-insensitive uniqueness
 */
export function normalizeUsername(input: string): string {
  if (!input) return '';
  return input.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Formats a normalized or raw username for display with a single '@' prefix
 */
export function formatDisplayUsername(input: string): string {
  const norm = normalizeUsername(input);
  return norm ? `@${norm}` : '';
}

/**
 * Validates username syntax rules:
 * - Length: 3–20 characters
 * - Characters: Letters, numbers, and underscores
 */
export function validateUsernameFormat(raw: string): {
  valid: boolean;
  normalized: string;
  display: string;
  error?: string;
} {
  const normalized = normalizeUsername(raw);
  const display = formatDisplayUsername(raw);

  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      display: '',
      error: 'Please enter a username',
    };
  }

  if (normalized.length < 3) {
    return {
      valid: false,
      normalized,
      display,
      error: 'Username must be at least 3 characters',
    };
  }

  if (normalized.length > 20) {
    return {
      valid: false,
      normalized,
      display,
      error: 'Username must be 20 characters or fewer',
    };
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      display,
      error: 'Only letters, numbers, and underscores allowed',
    };
  }

  return {
    valid: true,
    normalized,
    display,
  };
}

/**
 * Generate human-readable verification message for signing
 */
export function createVerificationMessage(
  action: 'register' | 'change',
  username: string,
  walletAddress: string,
  timestamp = Date.now()
): string {
  const display = formatDisplayUsername(username);
  return [
    'Cambio — Username Verification',
    '',
    action === 'register'
      ? `Authorize claiming username ${display} for wallet ${walletAddress}.`
      : `Authorize changing username to ${display} for wallet ${walletAddress}.`,
    '',
    `Wallet: ${walletAddress}`,
    `Username: ${display}`,
    `Timestamp: ${timestamp}`,
    '',
    'Note: This request does not cost gas and will not trigger a blockchain transaction.',
  ].join('\n');
}

/**
 * Local cache fallback for offline resilience
 */
function getFallbackRegistry(): {
  usernames: Record<string, UsernameRecord>;
  wallets: Record<string, string>;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    usernames: {
      jomi: {
        username: 'jomi',
        displayUsername: '@jomi',
        walletAddress: '0x71C3D8bA4c15147C8f6BfFE760D79Ec4fD6292FA',
        createdAt: Date.now() - 86400000,
        isVerified: true,
        signature: '0xmock_sig_jomi',
      },
      alex: {
        username: 'alex',
        displayUsername: '@alex',
        walletAddress: '0x24a81F268153406360A2f6B78d7890bF20c15B91',
        createdAt: Date.now() - 86400000,
        isVerified: true,
        signature: '0xmock_sig_alex',
      },
    },
    wallets: {
      '0x71c3d8ba4c15147c8b6bffe760d79ec4fd6292fa': 'jomi',
      '0x24a81f268153406360a2f6b78d7890bf20c15b91': 'alex',
    },
  };
}

function saveFallbackRegistry(data: {
  usernames: Record<string, UsernameRecord>;
  wallets: Record<string, string>;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

/**
 * Check if a username is available in Cloud Firestore
 */
export async function checkUsernameAvailability(
  rawUsername: string,
  connectedWalletAddress?: string | null
): Promise<UsernameCheckResult> {
  const validation = validateUsernameFormat(rawUsername);
  if (!validation.valid) {
    return {
      available: false,
      normalized: validation.normalized,
      display: validation.display,
      error: validation.error,
    };
  }

  const { normalized, display } = validation;

  // 1. Primary check: Cloud Firestore
  try {
    const usernameDocRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(usernameDocRef);

    if (snap.exists()) {
      const data = snap.data();
      const ownerAddress = data.ownerAddress || '';

      if (
        connectedWalletAddress &&
        ownerAddress.toLowerCase() === connectedWalletAddress.toLowerCase()
      ) {
        return {
          available: true,
          normalized,
          display,
          ownerAddress,
        };
      }

      return {
        available: false,
        normalized,
        display,
        error: 'Username already taken',
        ownerAddress,
      };
    }

    return {
      available: true,
      normalized,
      display,
    };
  } catch (firestoreErr) {
    console.warn('Firestore availability check failed, falling back to API / cache:', firestoreErr);
  }

  // 2. Secondary check: /api/usernames endpoint
  try {
    const res = await fetch(`/api/usernames/check?username=${encodeURIComponent(normalized)}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.available) {
        if (
          connectedWalletAddress &&
          data.ownerAddress?.toLowerCase() === connectedWalletAddress.toLowerCase()
        ) {
          return {
            available: true,
            normalized,
            display,
            ownerAddress: data.ownerAddress,
          };
        }
        return {
          available: false,
          normalized,
          display,
          error: 'Username already taken',
          ownerAddress: data.ownerAddress,
        };
      }
      return {
        available: true,
        normalized,
        display,
      };
    }
  } catch (err) {}

  // 3. Fallback cache check
  const fallback = getFallbackRegistry();
  const existing = fallback.usernames[normalized];

  if (existing) {
    if (
      connectedWalletAddress &&
      existing.walletAddress.toLowerCase() === connectedWalletAddress.toLowerCase()
    ) {
      return {
        available: true,
        normalized,
        display,
        ownerAddress: existing.walletAddress,
      };
    }
    return {
      available: false,
      normalized,
      display,
      error: 'Username already taken',
      ownerAddress: existing.walletAddress,
    };
  }

  return {
    available: true,
    normalized,
    display,
  };
}

/**
 * Fetch the registered username for a given wallet address from Cloud Firestore
 */
export async function getUsernameForWallet(
  walletAddress: string
): Promise<UsernameRecord | null> {
  if (!walletAddress) return null;
  const cleanAddr = walletAddress.trim().toLowerCase();

  // 1. Primary check: Cloud Firestore
  try {
    const walletDocRef = doc(db, 'wallets', cleanAddr);
    const snap = await getDoc(walletDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.username) {
        const username = data.username;
        return {
          username,
          displayUsername: `@${username}`,
          walletAddress: cleanAddr,
          createdAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now(),
          isVerified: true,
        };
      }
    }
  } catch (err) {
    console.warn('Firestore getUsernameForWallet failed, trying fallback:', err);
  }

  // 2. Secondary check: /api/usernames endpoint
  try {
    const res = await fetch(`/api/usernames/by-wallet/${encodeURIComponent(cleanAddr)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.record) {
        return data.record;
      }
    }
  } catch (e) {}

  // 3. Fallback cache check
  const fallback = getFallbackRegistry();
  const username = fallback.wallets[cleanAddr];
  if (username && fallback.usernames[username]) {
    return fallback.usernames[username];
  }

  return null;
}

/**
 * Resolve a username to its registered wallet address from Cloud Firestore
 */
export async function resolveUsername(
  rawInput: string
): Promise<{ address: string; display: string; isVerified: boolean } | null> {
  const normalized = normalizeUsername(rawInput);
  if (!normalized) return null;

  // 1. Primary check: Cloud Firestore
  try {
    const docRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.ownerAddress) {
        return {
          address: data.ownerAddress,
          display: `@${data.username || normalized}`,
          isVerified: true,
        };
      }
    }
  } catch (err) {
    console.warn('Firestore resolveUsername failed, trying fallback:', err);
  }

  // 2. Secondary check: /api/usernames endpoint
  try {
    const res = await fetch(`/api/usernames/by-username/${encodeURIComponent(normalized)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.record) {
        return {
          address: data.record.walletAddress,
          display: data.record.displayUsername || `@${normalized}`,
          isVerified: !!data.record.isVerified,
        };
      }
    }
  } catch (e) {}

  // 3. Fallback cache check
  const fallback = getFallbackRegistry();
  const record = fallback.usernames[normalized];
  if (record) {
    return {
      address: record.walletAddress,
      display: record.displayUsername,
      isVerified: !!record.isVerified,
    };
  }

  return null;
}

/**
 * Register a new username for a wallet atomically in Cloud Firestore
 */
export async function registerUsername(
  rawUsername: string,
  walletAddress: string,
  signature?: string
): Promise<{ success: boolean; username: string; display: string; error?: string }> {
  const validation = validateUsernameFormat(rawUsername);
  if (!validation.valid) {
    return {
      success: false,
      username: '',
      display: '',
      error: validation.error,
    };
  }

  const { normalized, display } = validation;
  const cleanAddr = walletAddress.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  // 1. Primary storage: Cloud Firestore atomic transaction
  try {
    await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, 'usernames', normalized);
      const walletDocRef = doc(db, 'wallets', cleanAddr);

      const usernameSnap = await transaction.get(usernameDocRef);
      if (usernameSnap.exists()) {
        const existingData = usernameSnap.data();
        if (existingData.ownerAddress?.toLowerCase() !== cleanAddr) {
          throw new Error('Username already taken by another wallet.');
        }
      }

      // If wallet previously had a different username, remove the old username document
      const walletSnap = await transaction.get(walletDocRef);
      if (walletSnap.exists()) {
        const oldUsername = walletSnap.data().username;
        if (oldUsername && oldUsername !== normalized) {
          const oldDocRef = doc(db, 'usernames', oldUsername);
          transaction.delete(oldDocRef);
        }
      }

      transaction.set(usernameDocRef, {
        username: normalized,
        ownerAddress: cleanAddr,
        createdAt: nowIso,
        signature: signature || '',
      });

      transaction.set(walletDocRef, {
        walletAddress: cleanAddr,
        username: normalized,
        updatedAt: nowIso,
      });
    });

    // Notify listeners
    notifyUsernameChanged(cleanAddr, normalized);

    return {
      success: true,
      username: normalized,
      display,
    };
  } catch (firestoreErr: any) {
    if (firestoreErr.message && firestoreErr.message.includes('already taken')) {
      return {
        success: false,
        username: normalized,
        display,
        error: firestoreErr.message,
      };
    }
    console.warn('Firestore register transaction failed, attempting API fallback:', firestoreErr);
  }

  // 2. Secondary fallback: /api/usernames endpoint
  try {
    const res = await fetch('/api/usernames/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: normalized,
        walletAddress: cleanAddr,
        signature,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        notifyUsernameChanged(cleanAddr, normalized);
        return {
          success: true,
          username: normalized,
          display,
        };
      }
    }
  } catch (e) {}

  // 3. Fallback cache storage
  const fallback = getFallbackRegistry();
  if (fallback.usernames[normalized] && fallback.usernames[normalized].walletAddress.toLowerCase() !== cleanAddr) {
    return {
      success: false,
      username: normalized,
      display,
      error: 'Username already taken',
    };
  }

  const newRecord: UsernameRecord = {
    username: normalized,
    displayUsername: display,
    walletAddress: cleanAddr,
    createdAt: Date.now(),
    signature,
    isVerified: true,
  };

  fallback.usernames[normalized] = newRecord;
  fallback.wallets[cleanAddr] = normalized;
  saveFallbackRegistry(fallback);
  notifyUsernameChanged(cleanAddr, normalized);

  return {
    success: true,
    username: normalized,
    display,
  };
}

/**
 * Change an existing username for a wallet atomically in Cloud Firestore
 */
export async function changeUsername(
  oldRawUsername: string,
  newRawUsername: string,
  walletAddress: string,
  signature?: string
): Promise<{ success: boolean; username: string; display: string; error?: string }> {
  const validation = validateUsernameFormat(newRawUsername);
  if (!validation.valid) {
    return {
      success: false,
      username: '',
      display: '',
      error: validation.error,
    };
  }

  const oldNormalized = normalizeUsername(oldRawUsername);
  const { normalized: newNormalized, display: newDisplay } = validation;
  const cleanAddr = walletAddress.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (oldNormalized === newNormalized) {
    return {
      success: true,
      username: newNormalized,
      display: newDisplay,
    };
  }

  // 1. Primary: Cloud Firestore atomic transaction
  try {
    await runTransaction(db, async (transaction) => {
      const newDocRef = doc(db, 'usernames', newNormalized);
      const oldDocRef = doc(db, 'usernames', oldNormalized);
      const walletDocRef = doc(db, 'wallets', cleanAddr);

      const newSnap = await transaction.get(newDocRef);
      if (newSnap.exists()) {
        const existingData = newSnap.data();
        if (existingData.ownerAddress?.toLowerCase() !== cleanAddr) {
          throw new Error('Username already taken');
        }
      }

      transaction.delete(oldDocRef);

      transaction.set(newDocRef, {
        username: newNormalized,
        ownerAddress: cleanAddr,
        createdAt: nowIso,
        signature: signature || '',
      });

      transaction.set(walletDocRef, {
        walletAddress: cleanAddr,
        username: newNormalized,
        updatedAt: nowIso,
      });
    });

    notifyUsernameChanged(cleanAddr, newNormalized);

    return {
      success: true,
      username: newNormalized,
      display: newDisplay,
    };
  } catch (firestoreErr: any) {
    if (firestoreErr.message && firestoreErr.message.includes('already taken')) {
      return {
        success: false,
        username: newNormalized,
        display: newDisplay,
        error: firestoreErr.message,
      };
    }
    console.warn('Firestore change transaction failed, attempting API fallback:', firestoreErr);
  }

  // 2. Secondary fallback: /api/usernames endpoint
  try {
    const res = await fetch('/api/usernames/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldUsername: oldNormalized,
        newUsername: newNormalized,
        walletAddress: cleanAddr,
        signature,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        notifyUsernameChanged(cleanAddr, newNormalized);
        return {
          success: true,
          username: newNormalized,
          display: newDisplay,
        };
      }
    }
  } catch (e) {}

  // 3. Fallback cache
  const fallback = getFallbackRegistry();
  if (fallback.usernames[newNormalized] && newNormalized !== oldNormalized) {
    return {
      success: false,
      username: newNormalized,
      display: newDisplay,
      error: 'Username already taken',
    };
  }

  delete fallback.usernames[oldNormalized];
  const newRecord: UsernameRecord = {
    username: newNormalized,
    displayUsername: newDisplay,
    walletAddress: cleanAddr,
    createdAt: Date.now(),
    signature,
    isVerified: true,
  };

  fallback.usernames[newNormalized] = newRecord;
  fallback.wallets[cleanAddr] = newNormalized;
  saveFallbackRegistry(fallback);
  notifyUsernameChanged(cleanAddr, newNormalized);

  return {
    success: true,
    username: newNormalized,
    display: newDisplay,
  };
}

/**
 * Cross-tab / cross-component notification
 */
function notifyUsernameChanged(walletAddress: string, username: string) {
  try {
    window.dispatchEvent(
      new CustomEvent('cambio_username_updated', {
        detail: { walletAddress, username, display: `@${username}` },
      })
    );
  } catch (e) {}
}

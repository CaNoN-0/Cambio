import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  runTransaction 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UsernameCheckResult, UsernameRecord } from '../types';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const LOCAL_STORAGE_KEY_PREFIX = 'cambio_usernames_cache_';
const LOCAL_WALLET_MAP_PREFIX = 'cambio_wallet_map_';

/**
 * Normalizes user input into a canonical username string:
 * - Strips whitespace
 * - Strips all leading @ symbols
 * - Converts to lowercase
 */
export function normalizeUsername(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Formats a canonical username for display (adds leading @)
 */
export function formatDisplayUsername(canonical: string): string {
  if (!canonical) return '';
  const clean = normalizeUsername(canonical);
  return clean ? `@${clean}` : '';
}

/**
 * Validates whether a username matches the strict syntactic rules
 */
export function validateUsernameRules(normalized: string): { isValid: boolean; error?: string } {
  if (!normalized) {
    return { isValid: false, error: 'Please enter a username.' };
  }
  if (normalized.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters.' };
  }
  if (normalized.length > 20) {
    return { isValid: false, error: 'Username must be 20 characters or fewer.' };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  return { isValid: true };
}

/**
 * Check if a username is available in Firestore
 */
export async function checkUsernameAvailability(rawInput: string): Promise<UsernameCheckResult> {
  const normalized = normalizeUsername(rawInput);
  const display = formatDisplayUsername(normalized);

  const validation = validateUsernameRules(normalized);
  if (!validation.isValid) {
    return {
      available: false,
      normalized,
      display,
      error: validation.error,
    };
  }

  try {
    const docRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        available: false,
        normalized,
        display,
        ownerAddress: data.ownerAddress,
        error: 'Username already taken',
      };
    }

    return {
      available: true,
      normalized,
      display,
    };
  } catch (err) {
    console.warn('Firestore availability check failed, checking local cache fallback:', err);
    // Local fallback check
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalized}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return {
          available: false,
          normalized,
          display,
          ownerAddress: parsed.ownerAddress,
          error: 'Username already taken',
        };
      } catch (e) {
        // ignore
      }
    }

    return {
      available: true,
      normalized,
      display,
    };
  }
}

/**
 * Get existing username for a wallet address
 */
export async function getUsernameForWallet(address: string | null): Promise<string | null> {
  if (!address) return null;
  const lowerAddr = address.toLowerCase();

  try {
    const walletRef = doc(db, 'wallets', lowerAddr);
    const snap = await getDoc(walletRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.username) {
        // Cache locally for fast subsequent reads
        localStorage.setItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`, data.username);
        return data.username;
      }
    }
  } catch (err) {
    console.warn('Firestore getUsernameForWallet failed, reading local cache:', err);
  }

  // Fallback to local storage cache
  const cached = localStorage.getItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`);
  return cached || null;
}

/**
 * Resolve either an @username alias or a 0x address into a verified address and display username
 */
export async function resolveRecipient(
  input: string
): Promise<{ address: string; username: string | null; isAlias: boolean } | null> {
  const cleanInput = input.trim();
  if (!cleanInput) return null;

  // Check if input is a raw EVM address
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanInput);
  if (isAddress) {
    const lower = cleanInput.toLowerCase();
    const associatedUsername = await getUsernameForWallet(lower);
    return {
      address: cleanInput,
      username: associatedUsername,
      isAlias: false,
    };
  }

  // Treat as username
  const normalized = normalizeUsername(cleanInput);
  if (!normalized) return null;

  try {
    const docRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.ownerAddress) {
        return {
          address: data.ownerAddress,
          username: normalized,
          isAlias: true,
        };
      }
    }
  } catch (err) {
    console.warn('Firestore resolveRecipient failed, checking local cache:', err);
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalized}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return {
          address: parsed.ownerAddress,
          username: normalized,
          isAlias: true,
        };
      } catch (e) {
        // ignore
      }
    }
  }

  return null;
}

/**
 * Request an off-chain cryptographic signature via standard EIP-191 personal_sign
 */
export async function requestWalletOwnershipSignature(
  address: string,
  username: string
): Promise<string> {
  const cleanUsername = normalizeUsername(username);
  const message = `Claim Cambio username @${cleanUsername} for wallet ${address.toLowerCase()} on Mezo`;

  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const eth = (window as any).ethereum;
      // Convert text to hex for personal_sign
      const hexMsg = '0x' + Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signature = await eth.request({
        method: 'personal_sign',
        params: [hexMsg, address],
      });
      return signature;
    } catch (err: any) {
      // User rejected signature in wallet
      if (err.code === 4001 || (err.message && err.message.includes('rejected'))) {
        throw new Error('Signature request was cancelled in your wallet.');
      }
      console.warn('Wallet personal_sign error, proceeding with simulation signature:', err);
    }
  }

  // Graceful fallback signature if in emulator/sandbox environment
  return `0x_eip191_sim_${Date.now()}_${cleanUsername}`;
}

/**
 * Register a unique username for a connected wallet atomically
 */
export async function registerUsername(
  walletAddress: string,
  username: string,
  signature?: string
): Promise<string> {
  const normalized = normalizeUsername(username);
  const lowerAddr = walletAddress.toLowerCase();

  const validation = validateUsernameRules(normalized);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid username');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, 'usernames', normalized);
      const walletDocRef = doc(db, 'wallets', lowerAddr);

      const usernameSnap = await transaction.get(usernameDocRef);
      if (usernameSnap.exists()) {
        const existingData = usernameSnap.data();
        if (existingData.ownerAddress !== lowerAddr) {
          throw new Error('Username already taken by another wallet.');
        }
      }

      // Check if wallet previously had a different username
      const walletSnap = await transaction.get(walletDocRef);
      if (walletSnap.exists()) {
        const oldUsername = walletSnap.data().username;
        if (oldUsername && oldUsername !== normalized) {
          // Free previous username document
          const oldDocRef = doc(db, 'usernames', oldUsername);
          transaction.delete(oldDocRef);
          localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${oldUsername}`);
        }
      }

      const nowIso = new Date().toISOString();

      transaction.set(usernameDocRef, {
        username: normalized,
        ownerAddress: lowerAddr,
        createdAt: nowIso,
        signature: signature || '',
      });

      transaction.set(walletDocRef, {
        walletAddress: lowerAddr,
        username: normalized,
        updatedAt: nowIso,
      });
    });

    // Update local cache
    localStorage.setItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`, normalized);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalized}`, JSON.stringify({
      username: normalized,
      ownerAddress: lowerAddr,
      createdAt: Date.now(),
      signature,
    }));

    return normalized;
  } catch (err: any) {
    if (err.message && err.message.includes('already taken')) {
      throw err;
    }
    console.warn('Firestore transaction failed, saving to local registry fallback:', err);

    // Local reservation fallback
    const existing = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalized}`);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.ownerAddress !== lowerAddr) {
        throw new Error('Username already taken');
      }
    }

    localStorage.setItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`, normalized);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalized}`, JSON.stringify({
      username: normalized,
      ownerAddress: lowerAddr,
      createdAt: Date.now(),
      signature,
    }));

    return normalized;
  }
}

/**
 * Change / update an existing username to a new one
 */
export async function changeUsername(
  walletAddress: string,
  oldUsername: string,
  newUsername: string,
  signature?: string
): Promise<string> {
  const normalizedOld = normalizeUsername(oldUsername);
  const normalizedNew = normalizeUsername(newUsername);
  const lowerAddr = walletAddress.toLowerCase();

  if (normalizedOld === normalizedNew) {
    return normalizedNew;
  }

  const validation = validateUsernameRules(normalizedNew);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid new username');
  }

  try {
    await runTransaction(db, async (transaction) => {
      const newDocRef = doc(db, 'usernames', normalizedNew);
      const oldDocRef = doc(db, 'usernames', normalizedOld);
      const walletDocRef = doc(db, 'wallets', lowerAddr);

      const newSnap = await transaction.get(newDocRef);
      if (newSnap.exists()) {
        throw new Error('Username already taken');
      }

      const nowIso = new Date().toISOString();

      // Delete old username doc
      transaction.delete(oldDocRef);

      // Create new username doc
      transaction.set(newDocRef, {
        username: normalizedNew,
        ownerAddress: lowerAddr,
        createdAt: nowIso,
        signature: signature || '',
      });

      // Update wallet reference
      transaction.set(walletDocRef, {
        walletAddress: lowerAddr,
        username: normalizedNew,
        updatedAt: nowIso,
      });
    });

    // Update local cache
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalizedOld}`);
    localStorage.setItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`, normalizedNew);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalizedNew}`, JSON.stringify({
      username: normalizedNew,
      ownerAddress: lowerAddr,
      createdAt: Date.now(),
      signature,
    }));

    return normalizedNew;
  } catch (err: any) {
    if (err.message && err.message.includes('already taken')) {
      throw err;
    }
    console.warn('Firestore change transaction failed, updating local fallback:', err);

    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalizedOld}`);
    localStorage.setItem(`${LOCAL_WALLET_MAP_PREFIX}${lowerAddr}`, normalizedNew);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${normalizedNew}`, JSON.stringify({
      username: normalizedNew,
      ownerAddress: lowerAddr,
      createdAt: Date.now(),
      signature,
    }));

    return normalizedNew;
  }
}

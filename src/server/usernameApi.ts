/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

interface UsernameRecord {
  username: string;
  displayUsername: string;
  walletAddress: string;
  createdAt: number;
  updatedAt?: number;
  signature?: string;
  isVerified: boolean;
}

interface RegistryData {
  usernames: Record<string, UsernameRecord>;
  wallets: Record<string, string>;
}

const REGISTRY_FILE = path.resolve(process.cwd(), 'data/usernames.json');

function ensureDataDirectory() {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadRegistry(): RegistryData {
  try {
    ensureDataDirectory();
    if (fs.existsSync(REGISTRY_FILE)) {
      const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Failed to read usernames.json, initializing empty registry:', err);
  }

  const initial: RegistryData = {
    usernames: {
      jomi: {
        username: 'jomi',
        displayUsername: '@jomi',
        walletAddress: '0x71C3D8bA4c15147C8f6BfFE760D79Ec4fD6292FA',
        createdAt: 1774000000000,
        isVerified: true,
        signature: '0xdemo_signature_jomi',
      },
      alex: {
        username: 'alex',
        displayUsername: '@alex',
        walletAddress: '0x24a81F268153406360A2f6B78d7890bF20c15B91',
        createdAt: 1774000000000,
        isVerified: true,
        signature: '0xdemo_signature_alex',
      },
      mezo_treasury: {
        username: 'mezo_treasury',
        displayUsername: '@mezo_treasury',
        walletAddress: '0x3161200000000000000000000000000000003161',
        createdAt: 1774000000000,
        isVerified: true,
        signature: '0xdemo_signature_treasury',
      },
    },
    wallets: {
      '0x71c3d8ba4c15147c8b6bffe760d79ec4fd6292fa': 'jomi',
      '0x24a81f268153406360a2f6b78d7890bf20c15b91': 'alex',
      '0x3161200000000000000000000000000000003161': 'mezo_treasury',
    },
  };

  saveRegistry(initial);
  return initial;
}

function saveRegistry(data: RegistryData) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save usernames.json:', err);
  }
}

function sendJson(res: ServerResponse, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

export function handleUsernameApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const url = req.url || '';
  if (!url.startsWith('/api/usernames')) {
    return next();
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. Check availability: GET /api/usernames/check?username=...
  if (pathname === '/api/usernames/check' && req.method === 'GET') {
    const raw = parsedUrl.searchParams.get('username') || '';
    const normalized = raw.trim().replace(/^@+/, '').toLowerCase();

    if (!normalized || normalized.length < 3 || normalized.length > 20) {
      return sendJson(res, 200, {
        available: false,
        error: 'Username must be between 3 and 20 characters',
      });
    }

    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      return sendJson(res, 200, {
        available: false,
        error: 'Only letters, numbers, and underscores are allowed',
      });
    }

    const registry = loadRegistry();
    const existing = registry.usernames[normalized];

    if (existing) {
      return sendJson(res, 200, {
        available: false,
        ownerAddress: existing.walletAddress,
        error: 'Username already taken',
      });
    }

    return sendJson(res, 200, {
      available: true,
      normalized,
      display: `@${normalized}`,
    });
  }

  // 2. Lookup by wallet: GET /api/usernames/by-wallet/:address
  if (pathname.startsWith('/api/usernames/by-wallet/') && req.method === 'GET') {
    const address = pathname.replace('/api/usernames/by-wallet/', '').trim().toLowerCase();
    const registry = loadRegistry();
    const username = registry.wallets[address];
    if (username && registry.usernames[username]) {
      return sendJson(res, 200, { record: registry.usernames[username] });
    }
    return sendJson(res, 200, { record: null });
  }

  // 3. Lookup by username: GET /api/usernames/by-username/:username
  if (pathname.startsWith('/api/usernames/by-username/') && req.method === 'GET') {
    const raw = pathname.replace('/api/usernames/by-username/', '').trim();
    const normalized = raw.replace(/^@+/, '').toLowerCase();
    const registry = loadRegistry();
    const record = registry.usernames[normalized];
    if (record) {
      return sendJson(res, 200, { record });
    }
    return sendJson(res, 200, { record: null });
  }

  // 4. Register: POST /api/usernames/register
  if (pathname === '/api/usernames/register' && req.method === 'POST') {
    readBody(req).then((body) => {
      const rawUsername = body.username || '';
      const walletAddress = (body.walletAddress || '').trim();
      const signature = body.signature;

      if (!walletAddress) {
        return sendJson(res, 400, { success: false, error: 'Wallet address is required' });
      }

      const normalized = rawUsername.trim().replace(/^@+/, '').toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Username must be 3–20 characters and contain only letters, numbers, or underscores',
        });
      }

      const registry = loadRegistry();
      const existing = registry.usernames[normalized];
      const lowerWallet = walletAddress.toLowerCase();

      // Check if username is already taken by another wallet
      if (existing && existing.walletAddress.toLowerCase() !== lowerWallet) {
        return sendJson(res, 409, {
          success: false,
          error: 'Username already taken by another wallet',
        });
      }

      // If this wallet previously had a different username, remove the old mapping
      const previousUsername = registry.wallets[lowerWallet];
      if (previousUsername && previousUsername !== normalized) {
        delete registry.usernames[previousUsername];
      }

      const record: UsernameRecord = {
        username: normalized,
        displayUsername: `@${normalized}`,
        walletAddress,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        signature,
        isVerified: true,
      };

      registry.usernames[normalized] = record;
      registry.wallets[lowerWallet] = normalized;
      saveRegistry(registry);

      return sendJson(res, 200, { success: true, record });
    });
    return;
  }

  // 5. Change username: POST /api/usernames/change
  if (pathname === '/api/usernames/change' && req.method === 'POST') {
    readBody(req).then((body) => {
      const oldRaw = (body.oldUsername || '').trim().replace(/^@+/, '').toLowerCase();
      const newRaw = (body.newUsername || '').trim().replace(/^@+/, '').toLowerCase();
      const walletAddress = (body.walletAddress || '').trim();
      const signature = body.signature;

      if (!walletAddress) {
        return sendJson(res, 400, { success: false, error: 'Wallet address is required' });
      }

      if (!/^[a-z0-9_]{3,20}$/.test(newRaw)) {
        return sendJson(res, 400, {
          success: false,
          error: 'New username must be 3–20 characters and contain only letters, numbers, or underscores',
        });
      }

      const registry = loadRegistry();
      const lowerWallet = walletAddress.toLowerCase();

      // Ensure caller actually owns old username if oldRaw provided
      if (oldRaw && registry.usernames[oldRaw]) {
        if (registry.usernames[oldRaw].walletAddress.toLowerCase() !== lowerWallet) {
          return sendJson(res, 403, {
            success: false,
            error: 'You do not own this username',
          });
        }
      }

      // Ensure new username is not taken by someone else
      if (registry.usernames[newRaw] && registry.usernames[newRaw].walletAddress.toLowerCase() !== lowerWallet) {
        return sendJson(res, 409, {
          success: false,
          error: 'Username already taken',
        });
      }

      // Safe atomic update: remove old mapping
      if (oldRaw && oldRaw !== newRaw) {
        delete registry.usernames[oldRaw];
      }

      const record: UsernameRecord = {
        username: newRaw,
        displayUsername: `@${newRaw}`,
        walletAddress,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        signature,
        isVerified: true,
      };

      registry.usernames[newRaw] = record;
      registry.wallets[lowerWallet] = newRaw;
      saveRegistry(registry);

      return sendJson(res, 200, { success: true, record });
    });
    return;
  }

  // 6. Registry stats / all: GET /api/usernames/registry
  if (pathname === '/api/usernames/registry' && req.method === 'GET') {
    const registry = loadRegistry();
    return sendJson(res, 200, {
      total: Object.keys(registry.usernames).length,
      isPrototype: true,
      records: registry.usernames,
    });
  }

  next();
}

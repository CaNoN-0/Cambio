import { PaymentRequest } from '../types';

const STORAGE_KEY = 'cambio_payment_requests_v1';

export function isRequestExpired(req: PaymentRequest): boolean {
  if (!req.expiryHours || req.expiryHours <= 0) return false;
  const expiryTimeMs = req.createdAt + req.expiryHours * 60 * 60 * 1000;
  return Date.now() > expiryTimeMs;
}

export function formatExpiryRemaining(req: PaymentRequest): string {
  if (!req.expiryHours || req.expiryHours <= 0) return 'No expiration';
  const expiryTimeMs = req.createdAt + req.expiryHours * 60 * 60 * 1000;
  const diffMs = expiryTimeMs - Date.now();
  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${Math.max(1, diffHours)} hour${diffHours === 1 ? '' : 's'} remaining`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
}

export function createShareableRequestUrl(request: PaymentRequest): string {
  if (typeof window === 'undefined') return '';
  const payload = {
    id: request.id,
    to: request.recipientAddress,
    u: request.recipientUsername || '',
    amt: request.amount,
    note: request.note || '',
    exp: request.expiryHours || 0,
    cat: request.createdAt,
  };
  const jsonStr = JSON.stringify(payload);
  const encoded = encodeURIComponent(jsonStr);
  
  // Format as hash parameter to work in all SPA hosting environments
  return `${window.location.origin}${window.location.pathname}#pay?req=${encoded}`;
}

export function parsePaymentRequestFromUrl(): PaymentRequest | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // Extract combined search params from either hash query or normal search
  let params: URLSearchParams | null = null;

  if (search && (search.includes('req=') || search.includes('to='))) {
    params = new URLSearchParams(search);
  } else if (hash && (hash.includes('req=') || hash.includes('to='))) {
    const queryIndex = hash.indexOf('?');
    if (queryIndex !== -1) {
      params = new URLSearchParams(hash.substring(queryIndex + 1));
    }
  }

  // 1. Try JSON payload format: ?req=...
  if (params && params.has('req')) {
    const reqStr = params.get('req');
    if (reqStr) {
      try {
        const data = JSON.parse(decodeURIComponent(reqStr));
        if (data && data.to && typeof data.amt === 'number') {
          const parsed: PaymentRequest = {
            id: data.id || `req_${Date.now()}`,
            recipientAddress: data.to,
            recipientUsername: data.u || undefined,
            amount: Number(data.amt),
            note: data.note || undefined,
            expiryHours: data.exp || 0,
            createdAt: data.cat || Date.now(),
            status: 'active',
          };
          if (isRequestExpired(parsed)) {
            parsed.status = 'expired';
          }
          return parsed;
        }
      } catch (err) {
        console.error('Failed to parse payment request from JSON payload:', err);
      }
    }
  }

  // 2. Try simple parameter format from ReceiveModal or QR Code: ?to=...&amt=...&note=...
  if (params && params.has('to')) {
    const rawTo = (params.get('to') || '').trim();
    if (rawTo) {
      const amtStr = params.get('amt');
      const amt = amtStr ? parseFloat(amtStr) : 0;
      const note = params.get('note') || params.get('memo') || undefined;
      const expStr = params.get('exp');
      const exp = expStr ? parseInt(expStr, 10) : 0;
      const isUsername = rawTo.startsWith('@') || (!rawTo.startsWith('0x') && rawTo.length <= 20);

      const parsed: PaymentRequest = {
        id: params.get('id') || `req_${Date.now()}`,
        recipientAddress: isUsername ? '' : rawTo,
        recipientUsername: isUsername ? rawTo.replace(/^@/, '') : undefined,
        amount: !isNaN(amt) && amt > 0 ? amt : 0,
        note: note || undefined,
        expiryHours: isNaN(exp) ? 0 : exp,
        createdAt: Date.now(),
        status: 'active',
      };
      return parsed;
    }
  }

  return null;
}

export function savePaymentRequestToStorage(req: PaymentRequest): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredPaymentRequests();
    const updated = [req, ...existing.filter((item) => item.id !== req.id)].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save payment request to storage:', err);
  }
}

export function getStoredPaymentRequests(): PaymentRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: PaymentRequest[] = JSON.parse(raw);
    return list.map((item) => ({
      ...item,
      status: isRequestExpired(item) ? 'expired' : 'active',
    }));
  } catch (err) {
    console.error('Failed to read payment requests from storage:', err);
    return [];
  }
}

export function deleteStoredPaymentRequest(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredPaymentRequests();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete payment request from storage:', err);
  }
}

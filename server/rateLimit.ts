/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fixed-window, per-key rate limiter. In-memory and per instance: it slows abuse of a single
 * instance but is not a global quota. Put a shared limiter (e.g. Cloud Armor) in front for that.
 */

import type { Request, Response, NextFunction } from 'express';

export function rateLimit(opts: { windowMs: number; max: number; name: string; now?: () => number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const now = opts.now ?? Date.now;
  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    const key = `${opts.name}:${req.ip ?? 'unknown'}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + opts.windowMs };
      hits.set(key, entry);
      if (hits.size > 50_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' });
      return;
    }
    next();
  };
}

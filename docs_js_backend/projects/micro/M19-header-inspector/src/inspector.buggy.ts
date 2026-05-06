/**
 * BUGGY HEADER INSPECTOR - DO NOT USE IN PRODUCTION
 *
 * Bugs:
 * 1. Trusts X-Forwarded-For blindly, returning the first (leftmost) value.
 *    An attacker can set X-Forwarded-For: 1.2.3.4 and spoof their IP.
 * 2. Does not set security headers on responses (XSS / clickjacking risk).
 */

import { Request, Response, NextFunction } from 'express';

export function setSecurityHeadersBuggy(_req: Request, _res: Response, next: NextFunction) {
  // Bug 2: No security headers set at all
  next();
}

export function extractClientIpBuggy(req: Request) {
  // Bug 1: Blindly trust the first value of X-Forwarded-For
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    return { ip: first, source: 'x-forwarded-for', trusted: true };
  }

  return { ip: req.socket.remoteAddress, source: 'direct', trusted: true };
}

export function analyzeSecurityHeadersBuggy(req: Request) {
  // Same as safe version for this function
  const SECURITY_HEADERS = [
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
    'content-security-policy',
    'referrer-policy',
  ];
  const present: string[] = [];
  const missing: string[] = [];
  for (const h of SECURITY_HEADERS) {
    if (req.headers[h]) present.push(h);
    else missing.push(h);
  }
  return { present, missing, score: `${present.length}/${SECURITY_HEADERS.length}` };
}

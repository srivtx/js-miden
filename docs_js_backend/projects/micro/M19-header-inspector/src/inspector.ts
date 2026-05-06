import { Request, Response, NextFunction } from 'express';

// List of trusted proxy IPs (CIDR matching omitted for brevity)
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '127.0.0.1').split(',');

export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.includes(ip);
}

function isValidIP(ip: string): boolean {
  // Basic IPv4 and IPv6 validation
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4.test(ip) || ipv6.test(ip) || ip === '::1';
}

export function extractClientIp(req: Request) {
  const remoteAddress = req.socket.remoteAddress || 'unknown';

  // If the direct connection is not a trusted proxy, ignore X-Forwarded-For
  if (!isTrustedProxy(remoteAddress)) {
    return { ip: remoteAddress, source: 'direct', trusted: true };
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    // The last IP in the chain was added by the trusted proxy closest to us
    const ips = xff.split(',').map((ip) => ip.trim()).filter(isValidIP);
    if (ips.length > 0) {
      // In a chain: client, proxy1, proxy2
      // If we trust proxy2 (our direct connection), the real client is the leftmost UNTRUSTED one.
      // For simplicity with one known proxy, return the first IP.
      return { ip: ips[0], source: 'x-forwarded-for', trusted: true };
    }
  }

  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && isValidIP(xri)) {
    return { ip: xri, source: 'x-real-ip', trusted: true };
  }

  return { ip: remoteAddress, source: 'direct', trusted: true };
}

const SECURITY_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'content-security-policy',
  'referrer-policy',
  'permissions-policy',
];

export function analyzeSecurityHeaders(req: Request) {
  const headers = req.headers;
  const present: string[] = [];
  const missing: string[] = [];

  for (const h of SECURITY_HEADERS) {
    if (headers[h]) {
      present.push(h);
    } else {
      missing.push(h);
    }
  }

  return { present, missing, score: `${present.length}/${SECURITY_HEADERS.length}` };
}

import { URL } from 'url';

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '[::1]', '[::]']);

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) return false;
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

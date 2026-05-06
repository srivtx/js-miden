import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface ExpandResult {
  final_url: string;
  chain: string[];
  status: string;
}

function requestUrl(url: string, method: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, { method, timeout: 5000 }, (res) => {
      res.resume(); // discard body to free socket
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

export async function expandUrl(startUrl: string): Promise<ExpandResult> {
  const chain: string[] = [];
  let current = startUrl;
  let redirects = 0;
  const MAX_REDIRECTS = 10;

  while (redirects < MAX_REDIRECTS) {
    let response: http.IncomingMessage;

    try {
      response = await requestUrl(current, 'HEAD');
      if (response.statusCode === 405) {
        response = await requestUrl(current, 'GET');
      }
    } catch {
      response = await requestUrl(current, 'GET');
    }

    chain.push(current);

    if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      current = new URL(response.headers.location, current).href;
      redirects++;

      // BUG: No validation of redirect target enables SSRF
      // An attacker can redirect to internal IPs after passing initial validation

      if (chain.includes(current)) {
        throw new Error('Redirect loop detected');
      }
      continue;
    }

    return {
      final_url: current,
      chain,
      status: 'success'
    };
  }

  throw new Error('Too many redirects');
}

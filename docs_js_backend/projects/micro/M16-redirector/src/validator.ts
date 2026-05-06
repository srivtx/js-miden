import { Request, Response } from "express";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Reject non-http(s) protocols (javascript:, data:, file:, etc.)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }

    // Reject empty host
    if (!parsed.hostname) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

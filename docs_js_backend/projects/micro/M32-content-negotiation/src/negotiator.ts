import { Request, Response, NextFunction } from 'express';

export type SupportedFormat = 'json' | 'xml' | 'html' | 'text';

export interface AcceptItem {
  type: string;
  subtype: string;
  q: number;
}

export function parseAcceptHeader(header: string): AcceptItem[] {
  return header
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [media, ...params] = part.split(';');
      const [type, subtype] = media.trim().split('/');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
      return { type: type.trim(), subtype: subtype.trim(), q };
    })
    .sort((a, b) => b.q - a.q);
}

export function selectFormat(
  acceptItems: AcceptItem[],
  supported: SupportedFormat[]
): SupportedFormat | null {
  const mimeMap: Record<SupportedFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    text: 'text/plain',
  };

  for (const item of acceptItems) {
    for (const format of supported) {
      const [t, s] = mimeMap[format].split('/');
      // BUG: Wildcard */* does not match because we compare exact strings
      // and don't handle wildcard cases properly.
      if (item.type === t && item.subtype === s) {
        return format;
      }
    }
  }

  return null;
}

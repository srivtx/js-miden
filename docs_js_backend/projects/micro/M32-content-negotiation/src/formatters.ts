export interface FormattedResponse {
  body: string;
  contentType: string;
}

export function formatResponse(
  data: unknown,
  format: string
): FormattedResponse {
  switch (format) {
    case 'json':
      return { body: JSON.stringify(data), contentType: 'application/json' };
    case 'xml':
      return {
        body: `<?xml version="1.0"?><root>${JSON.stringify(data)}</root>`,
        contentType: 'application/xml',
      };
    case 'html':
      return {
        body: `<html><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`,
        contentType: 'text/html',
      };
    case 'text':
      return {
        body: typeof data === 'string' ? data : JSON.stringify(data),
        contentType: 'text/plain',
      };
    default:
      return { body: JSON.stringify(data), contentType: 'application/json' };
  }
}

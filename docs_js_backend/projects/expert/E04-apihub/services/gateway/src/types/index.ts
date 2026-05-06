export interface ProxyRequest {
  apiKey: string;
  targetApiId: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  responseTimeMs: number;
}

export interface ServiceUrls {
  auth: string;
  usage: string;
  billing: string;
  analytics: string;
  portal: string;
}

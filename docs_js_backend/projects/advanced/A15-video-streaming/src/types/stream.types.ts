export interface StreamRequest {
  videoId: string;
  variantId?: string;
  quality?: string;
}

export interface Range {
  start: number;
  end: number;
}

export interface StreamResponse {
  stream: ReadableStream;
  start: number;
  end: number;
  totalSize: number;
  contentType: string;
}

export interface Manifest {
  type: 'hls' | 'dash';
  content: string;
  contentType: string;
}

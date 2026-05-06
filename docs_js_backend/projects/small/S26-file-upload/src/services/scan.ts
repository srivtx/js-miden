export interface ScanResult {
  clean: boolean;
  threats?: string[];
}

export async function scanFile(_path: string): Promise<ScanResult> {
  // Stub: in production, integrate ClamAV or cloud scanning API
  return { clean: true };
}

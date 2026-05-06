export function resolveTenant(req: any): string {
  return req.headers['x-tenant-id'] || req.subdomains[0] || 'default';
}

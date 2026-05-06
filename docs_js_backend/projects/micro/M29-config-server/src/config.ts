// BUG: No environment isolation!
// Config is stored only by app name, so dev overwrites prod.

const store: Record<string, Record<string, any>> = {};

export function setConfig(app: string, env: string, config: any) {
  // BUG: The 'env' parameter is completely ignored!
  store[app] = { ...store[app], ...config };
}

export function getConfig(app: string, env: string) {
  // BUG: Returns the same config regardless of environment
  return store[app] || {};
}

export function getStore() {
  return store;
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
}

export function logError(message: string, error?: Error, meta?: Record<string, unknown>) {
  console.error(JSON.stringify({
    level: 'error',
    message,
    error: error?.message,
    stack: error?.stack,
    ...meta,
    timestamp: new Date().toISOString(),
  }));
}
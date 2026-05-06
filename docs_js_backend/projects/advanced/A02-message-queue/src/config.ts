export const config = {
  dataDir: process.env.DATA_DIR || './data',
  port: parseInt(process.env.PORT || '3000'),
  defaultVisibilityTimeoutMs: 30000,
  maxDeliveryCount: 3,
};

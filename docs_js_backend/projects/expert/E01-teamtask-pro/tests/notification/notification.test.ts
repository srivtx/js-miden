import { describe, it, expect, vi } from 'vitest';

describe('NotificationService', () => {
  describe('SSE Connections', () => {
    it('BUG: should leak events across organizations', () => {
      // This test documents the real-time event leak bug
      // The notification service broadcasts to ALL connections
      // without filtering by organizationId
      const connections = new Map();
      connections.set('conn1', { organizationId: 'org-a' });
      connections.set('conn2', { organizationId: 'org-b' });

      // Simulating the buggy broadcast logic
      const event = { organizationId: 'org-a', message: 'secret' };
      const recipients: string[] = [];
      connections.forEach((conn: any, id: string) => {
        // BUG: No filter on conn.organizationId === event.organizationId
        recipients.push(id);
      });

      expect(recipients).toContain('conn2');
      // conn2 (org-b) received an event meant for org-a
    });
  });
});

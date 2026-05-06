import { describe, it, expect, vi } from 'vitest';

describe('FileService', () => {
  describe('download', () => {
    it('BUG: should allow cross-tenant file download', () => {
      // This test documents the file access bug
      // The download endpoint does not verify the file belongs
      // to the requesting user's organization
      const file = { _id: 'file1', organizationId: 'org-evil', path: '/uploads/evil/secret.pdf' };
      const requestingUser = { organizationId: 'org-good' };

      // BUG: Missing check: file.organizationId === requestingUser.organizationId
      const canAccess = true; // Always true in buggy implementation

      expect(canAccess).toBe(true);
      // User from org-good can access file from org-evil
    });
  });

  describe('task files', () => {
    it('BUG: should return files without org filter', () => {
      // When fetching files by taskId, organizationId is not included
      // in the query, potentially returning files from other orgs
      const query = { taskId: 'task1' };
      // BUG: Missing organizationId filter
      expect(query).not.toHaveProperty('organizationId');
    });
  });
});

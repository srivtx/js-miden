import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/auth/services/auth.js';
import { User } from '../../src/auth/models/user.js';
import { Organization } from '../../src/auth/models/organization.js';

vi.mock('../../src/auth/models/user.js');
vi.mock('../../src/auth/models/organization.js');

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should create user with organization', async () => {
      const orgMock = { _id: 'org123', name: 'Test Org' };
      const userMock = {
        _id: 'user123',
        email: 'test@example.com',
        organizationId: 'org123',
        role: 'owner',
        toObject: () => ({ _id: 'user123', email: 'test@example.com', organizationId: 'org123', role: 'owner' }),
      };

      (User.findOne as any).mockResolvedValue(null);
      (Organization.create as any).mockResolvedValue(orgMock);
      (User.create as any).mockResolvedValue(userMock);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      });

      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      (User.findOne as any).mockResolvedValue({ email: 'test@example.com' });

      await expect(service.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should authenticate valid credentials', async () => {
      const userMock = {
        _id: 'user123',
        email: 'test@example.com',
        password: '$2a$12$hashed',
        organizationId: 'org123',
        role: 'owner',
        toObject: () => ({ _id: 'user123', email: 'test@example.com', organizationId: 'org123', role: 'owner' }),
      };

      (User.findOne as any).mockResolvedValue(userMock);

      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as any);

      const result = await service.login('test@example.com', 'password123');
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });
  });
});

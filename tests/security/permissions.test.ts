import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Permission,
  PermissionLevel,
  Role,
  RoleBasedAccessControl,
  PermissionDeniedError,
  createPermission,
  createRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '../../src/security/permissions';

describe('Permission System', () => {
  let rbac: RoleBasedAccessControl;

  beforeEach(() => {
    rbac = new RoleBasedAccessControl();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createPermission', () => {
    it('should create permission with correct structure', () => {
      const permission = createPermission('read', 'user', 'Can read user data');

      expect(permission.id).toBe('read:user');
      expect(permission.name).toBe('read');
      expect(permission.resource).toBe('user');
      expect(permission.description).toBe('Can read user data');
      expect(permission.level).toBe(PermissionLevel.ALLOW);
    });

    it('should create deny permission', () => {
      const permission = createPermission('delete', 'admin', 'Deny delete', PermissionLevel.DENY);

      expect(permission.level).toBe(PermissionLevel.DENY);
    });

    it('should create wildcard permission', () => {
      const permission = createPermission('*', 'user', 'Full access');

      expect(permission.id).toBe('*:user');
    });
  });

  describe('createRole', () => {
    it('should create role with permissions', () => {
      const adminRole = createRole('admin', 'Administrator', [
        { name: 'read', resource: 'user' },
        { name: 'write', resource: 'user' },
        { name: 'delete', resource: 'user' },
      ]);

      expect(adminRole.id).toBe('admin');
      expect(adminRole.name).toBe('Administrator');
      expect(adminRole.permissions).toHaveLength(3);
    });

    it('should inherit parent role permissions', () => {
      const adminRole = createRole('admin', 'Administrator', [
        { name: 'write', resource: 'user' },
        { name: 'delete', resource: 'user' },
      ]);

      const superAdminRole = createRole('super_admin', 'Super Admin', [
        { name: '*', resource: '*' },
      ], adminRole);

      expect(superAdminRole.parent).toBe(adminRole);
    });
  });

  describe('RoleBasedAccessControl', () => {
    describe('registerRole', () => {
      it('should register a role', () => {
        const adminRole = createRole('admin', 'Admin', []);
        rbac.registerRole(adminRole);

        expect(rbac.hasRole('admin')).toBe(true);
      });

      it('should register multiple roles', () => {
        const adminRole = createRole('admin', 'Admin', []);
        const userRole = createRole('user', 'User', []);
        rbac.registerRole(adminRole);
        rbac.registerRole(userRole);

        expect(rbac.hasRole('admin')).toBe(true);
        expect(rbac.hasRole('user')).toBe(true);
      });
    });

    describe('grantRole', () => {
      it('should grant role to subject', () => {
        const adminRole = createRole('admin', 'Admin', [
          { name: 'read', resource: 'user' },
        ]);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');

        expect(rbac.hasRole('user123', 'admin')).toBe(true);
      });

      it('should grant multiple roles to subject', () => {
        const adminRole = createRole('admin', 'Admin', []);
        const editorRole = createRole('editor', 'Editor', []);
        rbac.registerRole(adminRole);
        rbac.registerRole(editorRole);
        rbac.grantRole('user123', ['admin', 'editor']);

        expect(rbac.hasRole('user123', 'admin')).toBe(true);
        expect(rbac.hasRole('user123', 'editor')).toBe(true);
      });
    });

    describe('revokeRole', () => {
      it('should revoke role from subject', () => {
        const adminRole = createRole('admin', 'Admin', []);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');
        rbac.revokeRole('user123', 'admin');

        expect(rbac.hasRole('user123', 'admin')).toBe(false);
      });
    });

    describe('checkPermission', () => {
      beforeEach(() => {
        const adminRole = createRole('admin', 'Admin', [
          { name: 'read', resource: 'user' },
          { name: 'write', resource: 'user' },
          { name: 'delete', resource: 'user' },
        ]);
        const userRole = createRole('user', 'User', [
          { name: 'read', resource: 'user' },
        ]);
        rbac.registerRole(adminRole);
        rbac.registerRole(userRole);
      });

      it('should allow access with correct permission', () => {
        rbac.grantRole('user123', 'user');
        const result = rbac.checkPermission('user123', 'read', 'user');

        expect(result.allowed).toBe(true);
      });

      it('should deny access without permission', () => {
        rbac.grantRole('user123', 'user');
        const result = rbac.checkPermission('user123', 'delete', 'user');

        expect(result.allowed).toBe(false);
      });

      it('should allow admin access to any resource', () => {
        rbac.grantRole('admin123', 'admin');
        const result = rbac.checkPermission('admin123', 'delete', 'user');

        expect(result.allowed).toBe(true);
      });

      it('should deny access for unknown subject', () => {
        const result = rbac.checkPermission('unknown', 'read', 'user');

        expect(result.allowed).toBe(false);
      });
    });

    describe('authorize', () => {
      beforeEach(() => {
        const adminRole = createRole('admin', 'Admin', [
          { name: 'read', resource: 'user' },
          { name: 'write', resource: 'user' },
        ]);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');
      });

      it('should not throw for allowed action', () => {
        expect(() => {
          rbac.authorize('user123', 'read', 'user');
        }).not.toThrow();
      });

      it('should throw PermissionDeniedError for denied action', () => {
        expect(() => {
          rbac.authorize('user123', 'delete', 'user');
        }).toThrow(PermissionDeniedError);
      });
    });

    describe('getPermissions', () => {
      it('should return effective permissions for subject', () => {
        const adminRole = createRole('admin', 'Admin', [
          { name: 'read', resource: 'user' },
          { name: 'write', resource: 'user' },
        ]);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');

        const permissions = rbac.getPermissions('user123');

        expect(permissions).toHaveLength(2);
      });

      it('should return empty array for unknown subject', () => {
        const permissions = rbac.getPermissions('unknown');

        expect(permissions).toHaveLength(0);
      });
    });

    describe('getRoles', () => {
      it('should return roles for subject', () => {
        const adminRole = createRole('admin', 'Admin', []);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');

        const roles = rbac.getRoles('user123');

        expect(roles).toContain('admin');
      });

      it('should return empty array for subject without roles', () => {
        const roles = rbac.getRoles('user123');

        expect(roles).toHaveLength(0);
      });
    });

    describe('clearSubject', () => {
      it('should remove all roles from subject', () => {
        const adminRole = createRole('admin', 'Admin', []);
        rbac.registerRole(adminRole);
        rbac.grantRole('user123', 'admin');
        rbac.clearSubject('user123');

        expect(rbac.getRoles('user123')).toHaveLength(0);
      });
    });

    describe('clearAll', () => {
      it('should remove all role assignments', () => {
        const adminRole = createRole('admin', 'Admin', []);
        rbac.registerRole(adminRole);
        rbac.grantRole('user1', 'admin');
        rbac.grantRole('user2', 'admin');
        rbac.clearAll();

        expect(rbac.getRoles('user1')).toHaveLength(0);
        expect(rbac.getRoles('user2')).toHaveLength(0);
      });
    });
  });

  describe('hasPermission', () => {
    it('should check if subject has specific permission', () => {
      const adminRole = createRole('admin', 'Admin', [
        { name: 'read', resource: 'user' },
      ]);
      rbac.registerRole(adminRole);
      rbac.grantRole('user123', 'admin');

      expect(hasPermission(rbac, 'user123', 'read', 'user')).toBe(true);
      expect(hasPermission(rbac, 'user123', 'write', 'user')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if subject has any of the permissions', () => {
      const adminRole = createRole('admin', 'Admin', [
        { name: 'read', resource: 'user' },
      ]);
      rbac.registerRole(adminRole);
      rbac.grantRole('user123', 'admin');

      expect(hasAnyPermission(rbac, 'user123', [
        { name: 'read', resource: 'user' },
        { name: 'write', resource: 'user' },
      ])).toBe(true);
    });

    it('should return false if subject has none of the permissions', () => {
      const userRole = createRole('user', 'User', [
        { name: 'read', resource: 'user' },
      ]);
      rbac.registerRole(userRole);
      rbac.grantRole('user123', 'user');

      expect(hasAnyPermission(rbac, 'user123', [
        { name: 'write', resource: 'user' },
        { name: 'delete', resource: 'user' },
      ])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if subject has all permissions', () => {
      const adminRole = createRole('admin', 'Admin', [
        { name: 'read', resource: 'user' },
        { name: 'write', resource: 'user' },
      ]);
      rbac.registerRole(adminRole);
      rbac.grantRole('user123', 'admin');

      expect(hasAllPermissions(rbac, 'user123', [
        { name: 'read', resource: 'user' },
        { name: 'write', resource: 'user' },
      ])).toBe(true);
    });

    it('should return false if subject is missing any permission', () => {
      const userRole = createRole('user', 'User', [
        { name: 'read', resource: 'user' },
      ]);
      rbac.registerRole(userRole);
      rbac.grantRole('user123', 'user');

      expect(hasAllPermissions(rbac, 'user123', [
        { name: 'read', resource: 'user' },
        { name: 'write', resource: 'user' },
      ])).toBe(false);
    });
  });
});

describe('PermissionDeniedError', () => {
  it('should create error with permission details', () => {
    const error = new PermissionDeniedError('user123', 'read', 'user');

    expect(error.message).toContain('user123');
    expect(error.message).toContain('read');
    expect(error.message).toContain('user');
    expect(error.name).toBe('PermissionDeniedError');
  });

  it('should include subject in error', () => {
    const error = new PermissionDeniedError('admin', 'delete', 'user');

    expect(error.subject).toBe('admin');
  });

  it('should include action in error', () => {
    const error = new PermissionDeniedError('user', 'write', 'document');

    expect(error.action).toBe('write');
  });

  it('should include resource in error', () => {
    const error = new PermissionDeniedError('user', 'read', 'database');

    expect(error.resource).toBe('database');
  });
});

describe('Permission Level', () => {
  it('should have correct values', () => {
    expect(PermissionLevel.ALLOW).toBe('allow');
    expect(PermissionLevel.DENY).toBe('deny');
  });
});

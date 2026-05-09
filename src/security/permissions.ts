export type ResourceType =
  | 'agent'
  | 'tool'
  | 'data'
  | 'file'
  | 'api'
  | 'database'
  | 'memory'
  | 'config'
  | 'user'
  | 'system';

export type ActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'invoke'
  | 'list'
  | 'export'
  | 'import'
  | 'admin';

export type PrincipalType = 'user' | 'role' | 'group' | 'service' | 'agent';

export interface Principal {
  id: string;
  type: PrincipalType;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface Resource {
  id: string;
  type: ResourceType;
  name?: string;
  owner?: string;
  parentId?: string;
  attributes?: Record<string, unknown>;
}

export interface Permission {
  id: string;
  principal: Principal;
  resource: {
    type: ResourceType;
    id?: string;
    pattern?: string;
  };
  actions: ActionType[];
  conditions?: PermissionCondition[];
  effect: 'allow' | 'deny';
  reason?: string;
  expiresAt?: Date;
}

export interface PermissionCondition {
  type: 'time_range' | 'ip_whitelist' | 'custom' | 'context';
  params: Record<string, unknown>;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  inheritsFrom?: string[];
  priority: number;
  metadata?: Record<string, unknown>;
}

export interface PermissionCheckRequest {
  principal: Principal;
  resource: Resource;
  action: ActionType;
  context?: Record<string, unknown>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  matchedPermission?: Permission;
  evaluatedConditions?: ConditionEvaluation[];
  timestamp: Date;
}

export interface ConditionEvaluation {
  condition: PermissionCondition;
  passed: boolean;
  details?: string;
}

export interface PermissionMatrix {
  roles: Map<string, Role>;
  permissions: Map<string, Permission>;
  roleHierarchy: Map<string, string[]>;
}

export interface PermissionChangeEvent {
  type: 'granted' | 'revoked' | 'modified';
  permission: Permission;
  actor: Principal;
  timestamp: Date;
  reason?: string;
}

export type PermissionChangeListener = (event: PermissionChangeEvent) => void;

const BUILT_IN_ROLES: Role[] = [
  {
    id: 'role:super_admin',
    name: 'Super Admin',
    description: '最高管理员，拥有所有权限',
    permissions: [],
    priority: 100,
  },
  {
    id: 'role:admin',
    name: 'Admin',
    description: '管理员，拥有大部分管理权限',
    permissions: [],
    priority: 80,
  },
  {
    id: 'role:operator',
    name: 'Operator',
    description: '操作员，可以执行日常操作',
    permissions: [],
    priority: 60,
  },
  {
    id: 'role:developer',
    name: 'Developer',
    description: '开发者，可以访问开发和测试资源',
    permissions: [],
    priority: 50,
  },
  {
    id: 'role:user',
    name: 'User',
    description: '普通用户，基本访问权限',
    permissions: [],
    priority: 30,
  },
  {
    id: 'role:guest',
    name: 'Guest',
    description: '访客，最低权限',
    permissions: [],
    priority: 10,
  },
  {
    id: 'role:agent',
    name: 'Agent',
    description: 'AI Agent，代理操作权限',
    permissions: [],
    priority: 40,
  },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  'role:super_admin': [
    {
      id: 'perm:super_admin:all',
      principal: { id: 'role:super_admin', type: 'role' },
      resource: { type: 'agent' },
      actions: ['create', 'read', 'update', 'delete', 'execute'],
      effect: 'allow',
    },
    {
      id: 'perm:super_admin:tools',
      principal: { id: 'role:super_admin', type: 'role' },
      resource: { type: 'tool' },
      actions: ['create', 'read', 'update', 'delete', 'execute', 'invoke'],
      effect: 'allow',
    },
    {
      id: 'perm:super_admin:data',
      principal: { id: 'role:super_admin', type: 'role' },
      resource: { type: 'data' },
      actions: ['create', 'read', 'update', 'delete', 'execute', 'export', 'import'],
      effect: 'allow',
    },
    {
      id: 'perm:super_admin:system',
      principal: { id: 'role:super_admin', type: 'role' },
      resource: { type: 'config' },
      actions: ['create', 'read', 'update', 'delete', 'admin'],
      effect: 'allow',
    },
    {
      id: 'perm:super_admin:system',
      principal: { id: 'role:super_admin', type: 'role' },
      resource: { type: 'system' },
      actions: ['create', 'read', 'update', 'delete', 'admin'],
      effect: 'allow',
    },
  ],
  'role:admin': [
    {
      id: 'perm:admin:agent',
      principal: { id: 'role:admin', type: 'role' },
      resource: { type: 'agent' },
      actions: ['create', 'read', 'update', 'delete'],
      effect: 'allow',
    },
    {
      id: 'perm:admin:tool',
      principal: { id: 'role:admin', type: 'role' },
      resource: { type: 'tool' },
      actions: ['create', 'read', 'update', 'delete', 'execute', 'invoke'],
      effect: 'allow',
    },
    {
      id: 'perm:admin:data',
      principal: { id: 'role:admin', type: 'role' },
      resource: { type: 'data' },
      actions: ['create', 'read', 'update', 'delete', 'export'],
      effect: 'allow',
    },
    {
      id: 'perm:admin:config',
      principal: { id: 'role:admin', type: 'role' },
      resource: { type: 'config' },
      actions: ['read', 'update'],
      effect: 'allow',
    },
  ],
  'role:operator': [
    {
      id: 'perm:operator:agent',
      principal: { id: 'role:operator', type: 'role' },
      resource: { type: 'agent' },
      actions: ['read', 'execute'],
      effect: 'allow',
    },
    {
      id: 'perm:operator:tool',
      principal: { id: 'role:operator', type: 'role' },
      resource: { type: 'tool' },
      actions: ['read', 'execute', 'invoke'],
      effect: 'allow',
    },
    {
      id: 'perm:operator:data',
      principal: { id: 'role:operator', type: 'role' },
      resource: { type: 'data' },
      actions: ['read'],
      effect: 'allow',
    },
  ],
  'role:developer': [
    {
      id: 'perm:developer:agent',
      principal: { id: 'role:developer', type: 'role' },
      resource: { type: 'agent' },
      actions: ['create', 'read', 'update'],
      effect: 'allow',
    },
    {
      id: 'perm:developer:tool',
      principal: { id: 'role:developer', type: 'role' },
      resource: { type: 'tool' },
      actions: ['create', 'read', 'update', 'execute'],
      effect: 'allow',
    },
    {
      id: 'perm:developer:data',
      principal: { id: 'role:developer', type: 'role' },
      resource: { type: 'data' },
      actions: ['create', 'read', 'update', 'delete'],
      effect: 'allow',
    },
  ],
  'role:user': [
    {
      id: 'perm:user:agent',
      principal: { id: 'role:user', type: 'role' },
      resource: { type: 'agent' },
      actions: ['read', 'execute'],
      effect: 'allow',
    },
    {
      id: 'perm:user:data',
      principal: { id: 'role:user', type: 'role' },
      resource: { type: 'data' },
      actions: ['read'],
      effect: 'allow',
    },
  ],
  'role:guest': [
    {
      id: 'perm:guest:data',
      principal: { id: 'role:guest', type: 'role' },
      resource: { type: 'data' },
      actions: ['read'],
      effect: 'allow',
    },
  ],
  'role:agent': [
    {
      id: 'perm:agent:tool',
      principal: { id: 'role:agent', type: 'role' },
      resource: { type: 'tool' },
      actions: ['invoke', 'execute'],
      effect: 'allow',
    },
    {
      id: 'perm:agent:data',
      principal: { id: 'role:agent', type: 'role' },
      resource: { type: 'data' },
      actions: ['read', 'update'],
      effect: 'allow',
    },
    {
      id: 'perm:agent:memory',
      principal: { id: 'role:agent', type: 'role' },
      resource: { type: 'memory' },
      actions: ['read', 'update', 'create'],
      effect: 'allow',
    },
  ],
};

export class PermissionChecker {
  private matrix: PermissionMatrix;
  private changeListeners: PermissionChangeListener[];
  private principalRoles: Map<string, Set<string>>;
  private customPolicies: ((request: PermissionCheckRequest) => PermissionCheckResult | null)[];

  constructor() {
    this.matrix = {
      roles: new Map(),
      permissions: new Map(),
      roleHierarchy: new Map(),
    };
    this.changeListeners = [];
    this.principalRoles = new Map();
    this.customPolicies = [];
    this.initializeBuiltInRoles();
  }

  private initializeBuiltInRoles(): void {
    for (const role of BUILT_IN_ROLES) {
      this.matrix.roles.set(role.id, role);
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role.id] || [];
      for (const perm of defaultPerms) {
        this.matrix.permissions.set(perm.id, perm);
      }
    }
  }

  registerRole(role: Role): void {
    this.matrix.roles.set(role.id, role);
  }

  grantPermission(permission: Permission, actor?: Principal): void {
    this.matrix.permissions.set(permission.id, permission);
    this.emitChange({
      type: 'granted',
      permission,
      actor: actor || { id: 'system', type: 'service' },
      timestamp: new Date(),
    });
  }

  revokePermission(permissionId: string, actor?: Principal): boolean {
    const permission = this.matrix.permissions.get(permissionId);
    if (permission) {
      this.matrix.permissions.delete(permissionId);
      this.emitChange({
        type: 'revoked',
        permission,
        actor: actor || { id: 'system', type: 'service' },
        timestamp: new Date(),
      });
      return true;
    }
    return false;
  }

  assignRoleToPrincipal(principalId: string, roleId: string): void {
    if (!this.principalRoles.has(principalId)) {
      this.principalRoles.set(principalId, new Set());
    }
    this.principalRoles.get(principalId)!.add(roleId);
  }

  removeRoleFromPrincipal(principalId: string, roleId: string): boolean {
    const roles = this.principalRoles.get(principalId);
    if (roles) {
      return roles.delete(roleId);
    }
    return false;
  }

  getPrincipalRoles(principalId: string): Role[] {
    const roleIds = this.principalRoles.get(principalId) || new Set();
    const roles: Role[] = [];
    for (const roleId of roleIds) {
      const role = this.matrix.roles.get(roleId);
      if (role) {
        roles.push(role);
        const inheritedRoles = this.getInheritedRoles(roleId);
        roles.push(...inheritedRoles);
      }
    }
    return roles.sort((a, b) => b.priority - a.priority);
  }

  private getInheritedRoles(roleId: string): Role[] {
    const role = this.matrix.roles.get(roleId);
    if (!role || !role.inheritsFrom) return [];

    const inheritedRoles: Role[] = [];
    for (const parentRoleId of role.inheritsFrom) {
      const parentRole = this.matrix.roles.get(parentRoleId);
      if (parentRole) {
        inheritedRoles.push(parentRole);
        inheritedRoles.push(...this.getInheritedRoles(parentRoleId));
      }
    }
    return inheritedRoles;
  }

  checkPermission(request: PermissionCheckRequest): PermissionCheckResult {
    for (const policy of this.customPolicies) {
      const policyResult = policy(request);
      if (policyResult) {
        return policyResult;
      }
    }

    const matchingPermissions = this.findMatchingPermissions(request);

    if (matchingPermissions.length === 0) {
      return {
        allowed: false,
        reason: '未找到匹配的权限规则',
        timestamp: new Date(),
      };
    }

    const explicitDeny = matchingPermissions.find(p => p.effect === 'deny');
    if (explicitDeny) {
      return {
        allowed: false,
        reason: explicitDeny.reason || '权限被明确拒绝',
        matchedPermission: explicitDeny,
        timestamp: new Date(),
      };
    }

    const allowPermission = matchingPermissions.find(p => p.effect === 'allow');
    if (allowPermission) {
      if (allowPermission.expiresAt && new Date() > allowPermission.expiresAt) {
        return {
          allowed: false,
          reason: '权限已过期',
          matchedPermission: allowPermission,
          timestamp: new Date(),
        };
      }

      if (allowPermission.conditions && allowPermission.conditions.length > 0) {
        const conditionResults = this.evaluateConditions(allowPermission.conditions, request.context);
        const allConditionsMet = conditionResults.every(r => r.passed);

        if (!allConditionsMet) {
          return {
            allowed: false,
            reason: '权限条件未满足',
            matchedPermission: allowPermission,
            evaluatedConditions: conditionResults,
            timestamp: new Date(),
          };
        }

        return {
          allowed: true,
          reason: '权限已通过条件验证',
          matchedPermission: allowPermission,
          evaluatedConditions: conditionResults,
          timestamp: new Date(),
        };
      }

      return {
        allowed: true,
        reason: allowPermission.reason || '权限已授权',
        matchedPermission: allowPermission,
        timestamp: new Date(),
      };
    }

    return {
      allowed: false,
      reason: '默认拒绝',
      timestamp: new Date(),
    };
  }

  private findMatchingPermissions(request: PermissionCheckRequest): Permission[] {
    const matchingPermissions: Permission[] = [];

    const roleIds = this.principalRoles.get(request.principal.id) || new Set();
    for (const roleId of roleIds) {
      const role = this.matrix.roles.get(roleId);
      if (role) {
        for (const permId of role.permissions) {
          const perm = this.matrix.permissions.get(permId);
          if (perm && this.matchesPermission(perm, request)) {
            matchingPermissions.push(perm);
          }
        }
      }
    }

    for (const perm of this.matrix.permissions.values()) {
      if (this.matchesPermission(perm, request)) {
        if (
          (perm.principal.type === request.principal.type && perm.principal.id === request.principal.id) ||
          (perm.principal.type === 'role' && roleIds.has(perm.principal.id))
        ) {
          matchingPermissions.push(perm);
        }
      }
    }

    return matchingPermissions.sort((a, b) => {
      const aIsSpecific = a.resource.id ? 1 : 0;
      const bIsSpecific = b.resource.id ? 1 : 0;
      return bIsSpecific - aIsSpecific;
    });
  }

  private matchesPermission(permission: Permission, request: PermissionCheckRequest): boolean {
    if (permission.resource.type !== request.resource.type) {
      return false;
    }

    if (permission.resource.id && permission.resource.id !== request.resource.id) {
      if (permission.resource.pattern) {
        const regex = new RegExp(permission.resource.pattern);
        if (!regex.test(request.resource.id)) {
          return false;
        }
      } else {
        return false;
      }
    }

    const hasAction = permission.actions.includes(request.action) || permission.actions.includes('admin');
    return hasAction;
  }

  private evaluateConditions(
    conditions: PermissionCondition[],
    context?: Record<string, unknown>
  ): ConditionEvaluation[] {
    const results: ConditionEvaluation[] = [];

    for (const condition of conditions) {
      let passed = false;
      let details: string | undefined;

      switch (condition.type) {
        case 'time_range':
          const now = new Date();
          const startTime = condition.params.start as string;
          const endTime = condition.params.end as string;
          if (startTime && endTime) {
            passed = now >= new Date(startTime) && now <= new Date(endTime);
            details = `当前时间 ${now.toISOString()} 在 [${startTime}, ${endTime}] 范围内`;
          }
          break;

        case 'ip_whitelist':
          const clientIp = context?.ip as string;
          const allowedIps = condition.params.ips as string[];
          if (clientIp && allowedIps) {
            passed = allowedIps.some(ip => {
              if (ip.includes('*')) {
                const regex = new RegExp('^' + ip.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
                return regex.test(clientIp);
              }
              return ip === clientIp;
            });
            details = `IP ${clientIp} 在白名单中: ${passed}`;
          }
          break;

        case 'context':
          const key = condition.params.key as string;
          const expectedValue = condition.params.value;
          const actualValue = context?.[key];
          passed = actualValue === expectedValue;
          details = `上下文 ${key} = ${actualValue}, 期望 ${expectedValue}`;
          break;

        case 'custom':
          passed = (condition.params.validate as (ctx: Record<string, unknown>) => boolean)?.(context || {}) ?? false;
          details = '自定义条件验证';
          break;
      }

      results.push({ condition, passed, details });
    }

    return results;
  }

  addCustomPolicy(
    policy: (request: PermissionCheckRequest) => PermissionCheckResult | null
  ): void {
    this.customPolicies.push(policy);
  }

  removeCustomPolicy(index: number): boolean {
    if (index >= 0 && index < this.customPolicies.length) {
      this.customPolicies.splice(index, 1);
      return true;
    }
    return false;
  }

  onPermissionChange(listener: PermissionChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index !== -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  private emitChange(event: PermissionChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Permission change listener error:', error);
      }
    }
  }

  canAccess(
    principalId: string,
    resourceType: ResourceType,
    action: ActionType,
    context?: Record<string, unknown>
  ): boolean {
    const roles = this.getPrincipalRoles(principalId);
    if (roles.length === 0) {
      return false;
    }

    const result = this.checkPermission({
      principal: { id: principalId, type: 'user' },
      resource: { id: '*', type: resourceType },
      action,
      context,
    });

    return result.allowed;
  }

  getResourcePermissions(
    principalId: string,
    resourceType: ResourceType
  ): { allowed: ActionType[]; denied: ActionType[] } {
    const allowed: ActionType[] = [];
    const denied: ActionType[] = [];
    const allActions: ActionType[] = ['create', 'read', 'update', 'delete', 'execute', 'invoke', 'list', 'export', 'import', 'admin'];

    for (const action of allActions) {
      const result = this.checkPermission({
        principal: { id: principalId, type: 'user' },
        resource: { id: '*', type: resourceType },
        action,
      });

      if (result.allowed) {
        allowed.push(action);
      } else {
        denied.push(action);
      }
    }

    return { allowed, denied };
  }

  exportPolicy(): {
    roles: Role[];
    permissions: Permission[];
    assignments: Record<string, string[]>;
  } {
    const roles = Array.from(this.matrix.roles.values());
    const permissions = Array.from(this.matrix.permissions.values());
    const assignments: Record<string, string[]> = {};

    for (const [principalId, roleIds] of this.principalRoles) {
      assignments[principalId] = Array.from(roleIds);
    }

    return { roles, permissions, assignments };
  }

  importPolicy(policy: {
    roles?: Role[];
    permissions?: Permission[];
    assignments?: Record<string, string[]>;
  }): void {
    if (policy.roles) {
      for (const role of policy.roles) {
        this.matrix.roles.set(role.id, role);
      }
    }

    if (policy.permissions) {
      for (const perm of policy.permissions) {
        this.matrix.permissions.set(perm.id, perm);
      }
    }

    if (policy.assignments) {
      for (const [principalId, roleIds] of Object.entries(policy.assignments)) {
        this.principalRoles.set(principalId, new Set(roleIds));
      }
    }
  }
}

export const defaultPermissionChecker = new PermissionChecker();

export function checkPermission(request: PermissionCheckRequest): PermissionCheckResult {
  return defaultPermissionChecker.checkPermission(request);
}

export function canAccess(
  principalId: string,
  resourceType: ResourceType,
  action: ActionType,
  context?: Record<string, unknown>
): boolean {
  return defaultPermissionChecker.canAccess(principalId, resourceType, action, context);
}

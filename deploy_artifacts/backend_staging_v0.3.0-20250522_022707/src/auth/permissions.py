"""
Permission and role management for the authentication system
"""
from enum import Enum
from typing import List, Dict


class Permission(str, Enum):
    """System permissions enumeration"""
    # Analytics permissions
    READ_ANALYTICS = "read:analytics"
    WRITE_ANALYTICS = "write:analytics"
    
    # Store management permissions
    READ_STORE = "read:store"
    WRITE_STORE = "write:store"
    
    # User management permissions
    MANAGE_USERS = "manage:users"
    
    # Organization management permissions
    MANAGE_ORGANIZATION = "manage:organization"
    
    # Admin permission
    ADMIN = "admin"


class RolePermissionManager:
    """Manages role-based permissions"""
    
    def __init__(self):
        # Define permissions for each role
        self.role_permissions: Dict[str, List[str]] = {
            "owner": [
                Permission.READ_ANALYTICS.value,
                Permission.WRITE_ANALYTICS.value,
                Permission.READ_STORE.value,
                Permission.WRITE_STORE.value,
                Permission.MANAGE_USERS.value,
                Permission.MANAGE_ORGANIZATION.value,
                Permission.ADMIN.value,
            ],
            "admin": [
                Permission.READ_ANALYTICS.value,
                Permission.WRITE_ANALYTICS.value,
                Permission.READ_STORE.value,
                Permission.WRITE_STORE.value,
                Permission.MANAGE_USERS.value,
            ],
            "member": [
                Permission.READ_ANALYTICS.value,
                Permission.WRITE_ANALYTICS.value,
                Permission.READ_STORE.value,
            ],
            "viewer": [
                Permission.READ_ANALYTICS.value,
                Permission.READ_STORE.value,
            ]
        }
    
    def get_permissions_for_role(self, role: str) -> List[str]:
        """Get permissions list for a given role"""
        return self.role_permissions.get(role, [])
    
    def has_permission(self, role: str, permission: str) -> bool:
        """Check if a role has a specific permission"""
        return permission in self.get_permissions_for_role(role)
    
    def validate_role(self, role: str) -> bool:
        """Validate if a role exists in the system"""
        return role in self.role_permissions
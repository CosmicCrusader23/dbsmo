# Permissions

This doc describes the current permission strings and which roles receive them. The source of truth is `lib/permissions.ts`.

## Permission strings

| Permission | What it allows |
| --- | --- |
| `admin:analytics` | Access to analytics views and metrics. |
| `admin:audit` | Access to audit-related views and records. |
| `admin:content` | Manage and edit content. |
| `admin:export` | Export data. |
| `admin:feedback` | View and manage feedback. |
| `admin:roles` | Manage role assignments and role configuration. |
| `admin:users` | Manage user accounts. |
| `admin:view` | Access to admin/staff-only surfaces. |

## Role mapping

| Role | Permissions |
| --- | --- |
| `ADMIN` | `admin:analytics`, `admin:audit`, `admin:content`, `admin:export`, `admin:feedback`, `admin:roles`, `admin:users`, `admin:view` |
| `TEACHER` | `admin:analytics`, `admin:content`, `admin:export`, `admin:feedback`, `admin:users`, `admin:view` |
| `CONTENT_EDITOR` | `admin:content`, `admin:view` |
| `ANALYST` | `admin:analytics`, `admin:export`, `admin:view` |

## Helpers used in code

- `permissionsForRole(role)` returns the list of permissions for a given role.
- `hasPermission(role, permission)` checks if a role includes a specific permission.
- `isStaffRole(role)` is true when the role includes `admin:view`.

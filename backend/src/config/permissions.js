/**
 * Central permission catalog.
 *
 * This file is the single source of truth for which modules and actions exist.
 * On startup (and when seeding) it is synchronised into the `permissions`
 * collection. The API only accepts permission keys that exist in that collection,
 * so clients can never invent new permissions.
 *
 * A permission key looks like "<module>.<action>", e.g. "loan.approve".
 */

export const ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
  { key: 'export', label: 'Export' },
];

const ALL = ACTIONS.map((a) => a.key);

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'membership', label: 'Membership', actions: ALL },
  { key: 'savings', label: 'Savings', actions: ALL },
  { key: 'rd', label: 'Recurring Deposit (RD)', actions: ALL },
  { key: 'loan', label: 'Loan', actions: ALL },
  { key: 'chitty', label: 'Chitty', actions: ALL },
  { key: 'reports', label: 'Reports', actions: ['view', 'export'] },
];

const actionLabel = Object.fromEntries(ACTIONS.map((a) => [a.key, a.label]));

export const PERMISSION_CATALOG = MODULES.flatMap((module, moduleIndex) =>
  module.actions.map((action) => ({
    key: `${module.key}.${action}`,
    module: module.key,
    action,
    description: `${actionLabel[action]} ${module.label}`,
    sortOrder: moduleIndex * 10 + ALL.indexOf(action),
  }))
);

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
});

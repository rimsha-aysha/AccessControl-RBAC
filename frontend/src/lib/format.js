export const SCOPE_LABELS = {
  assigned: 'Assigned Branch',
  selected: 'Selected Branches',
  all: 'All Branches',
};

export const SCOPE_HELP = {
  assigned: 'Users can only work with data from the branch they are assigned to.',
  selected: 'Users can work with data from the specific branches selected below.',
  all: 'Users can work with data from every branch.',
};

export const AUDIT_LABELS = {
  'role.created': 'Role created',
  'role.updated': 'Role details updated',
  'role.cloned': 'Role cloned',
  'role.activated': 'Role activated',
  'role.deactivated': 'Role deactivated',
  'role.deleted': 'Role deleted',
  'role.permissions_changed': 'Permissions changed',
  'role.branch_scope_changed': 'Branch scope changed',
  'role.approval_changed': 'Approval settings changed',
  'user.created': 'User created',
  'user.role_changed': 'User role changed',
  'user.status_changed': 'User status changed',
};

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '-');
export const formatDateTime = (value) => (value ? dateTimeFmt.format(new Date(value)) : '-');
export const formatMoney = (value) => (value === null || value === undefined || value === '' ? 'No limit' : moneyFmt.format(value));

export function formatApproval(level, limit) {
  if (!level) return 'None';
  return `Level ${level} · ${limit === null || limit === undefined ? 'No limit' : moneyFmt.format(limit)}`;
}

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDate(value);
}

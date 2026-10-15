import { useMemo, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import PermissionMatrix from './PermissionMatrix.jsx';
import { Alert, Button, Card, Field } from './ui.jsx';
import { SCOPE_HELP, SCOPE_LABELS } from '../lib/format.js';

export const EMPTY_ROLE = {
  name: '',
  description: '',
  status: 'active',
  branchScope: 'assigned',
  branchIds: [],
  approvalLevel: 0,
  approvalLimit: '',
  permissions: [],
};

/** Client-side checks that mirror the server rules (the server re-validates everything). */
export function validateRole(values) {
  const errors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Role name is required';
  else if (name.length > 100) errors.name = 'Role name must be 100 characters or fewer';
  if (values.description.length > 500) errors.description = 'Description must be 500 characters or fewer';
  if (values.branchScope === 'selected' && values.branchIds.length === 0) errors.branchIds = 'Select at least one branch';

  const level = Number(values.approvalLevel);
  if (!Number.isInteger(level) || level < 0 || level > 10) errors.approvalLevel = 'Approval level must be a whole number from 0 to 10';
  if (values.approvalLimit !== '') {
    const limit = Number(values.approvalLimit);
    if (Number.isNaN(limit) || limit < 0) errors.approvalLimit = 'Approval limit must be zero or a positive amount';
    else if (level < 1) errors.approvalLimit = 'Set an approval level of 1 or higher to use an approval limit';
  }
  if (values.permissions.length === 0) errors.permissions = 'Select at least one permission';
  return errors;
}

/** Converts form values to the API payload shape. */
export function toPayload(values, { includeStatus }) {
  const level = Number(values.approvalLevel);
  const payload = {
    name: values.name.trim(),
    description: values.description.trim(),
    branchScope: values.branchScope,
    branchIds: values.branchScope === 'selected' ? values.branchIds : [],
    approvalLevel: level,
    approvalLimit: level >= 1 && values.approvalLimit !== '' ? Number(values.approvalLimit) : null,
    permissions: values.permissions,
  };
  if (includeStatus) payload.status = values.status;
  return payload;
}

export default function RoleForm({ mode, initialValues, catalog, branches, isSystem, submitting, serverErrors = {}, onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState(false);
  const clientErrors = useMemo(() => validateRole(values), [values]);
  const errors = touched ? { ...serverErrors, ...clientErrors } : serverErrors;

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const toggleBranch = (id) =>
    setValues((v) => ({ ...v, branchIds: v.branchIds.includes(id) ? v.branchIds.filter((b) => b !== id) : [...v.branchIds, id] }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(clientErrors).length) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    onSubmit(toPayload(values, { includeStatus: mode !== 'edit' }));
  };

  const inputClass = (field) => `input ${errors[field] ? 'input-error' : ''}`;
  const activeBranches = branches.filter((b) => b.status === 'active');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {isSystem && (
        <Alert tone="warning" title="Protected role">
          The System Administrator role always has every permission and access to all branches. Its name and status cannot be changed. You can only update the description and approval settings.
        </Alert>
      )}
      {touched && Object.keys(clientErrors).length > 0 && (
        <Alert tone="error" title="Please fix the highlighted fields">
          {Object.values(clientErrors).join(' · ')}
        </Alert>
      )}

      <Card title="Role details" description="Basic information that identifies this role.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Role name" htmlFor="name" required error={errors.name} hint="Must be unique. Names are not case-sensitive.">
            <input
              id="name"
              className={inputClass('name')}
              value={values.name}
              onChange={set('name')}
              maxLength={100}
              disabled={isSystem}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              placeholder="e.g. Loan Officer"
              autoFocus={!isSystem}
            />
          </Field>
          {mode !== 'edit' ? (
            <Field label="Status" htmlFor="status">
              <select id="status" className="input" value={values.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          ) : (
            <Field label="Status" hint="Use Activate / Deactivate on the role details page to change status.">
              <p className="py-2 text-sm capitalize text-slate-700">{values.status}</p>
            </Field>
          )}
          <Field label="Description" htmlFor="description" error={errors.description} hint={`${values.description.length}/500 characters`} className="md:col-span-2">
            <textarea
              id="description"
              rows={3}
              className={inputClass('description')}
              value={values.description}
              onChange={set('description')}
              maxLength={500}
              aria-invalid={!!errors.description}
              placeholder="What is this role responsible for?"
            />
          </Field>
        </div>
      </Card>

      <Card title="Branch scope" description="Controls which branches' data users with this role can work with.">
        <fieldset disabled={isSystem}>
          <legend className="sr-only">Branch scope</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(SCOPE_LABELS).map(([key, label]) => (
              <label
                key={key}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  values.branchScope === key ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'
                } ${isSystem ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                <input type="radio" name="branchScope" value={key} checked={values.branchScope === key} onChange={set('branchScope')} className="mt-0.5 accent-brand-700" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{SCOPE_HELP[key]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {values.branchScope === 'selected' && (
          <Field label="Selected branches" required error={errors.branchIds} className="mt-5">
            <div className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3 ${errors.branchIds ? 'border-red-300' : 'border-slate-200'}`} aria-invalid={!!errors.branchIds} tabIndex={-1}>
              {activeBranches.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={values.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} className="h-4 w-4 accent-brand-700" />
                  <span className="text-slate-800">{b.name}</span>
                  <span className="text-xs text-slate-400">{b.code}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
      </Card>

      <Card title="Approval settings" description="Higher levels approve larger or more sensitive transactions. Level 0 means no approval authority.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Approval level" htmlFor="approvalLevel" error={errors.approvalLevel} hint="Whole number from 0 (none) to 10.">
            <input
              id="approvalLevel"
              type="number"
              min={0}
              max={10}
              step={1}
              className={inputClass('approvalLevel')}
              value={values.approvalLevel}
              onChange={set('approvalLevel')}
              aria-invalid={!!errors.approvalLevel}
            />
          </Field>
          <Field label="Approval limit (₹)" htmlFor="approvalLimit" error={errors.approvalLimit} hint="Optional. Leave empty for no upper limit. Requires level 1 or higher.">
            <input
              id="approvalLimit"
              type="number"
              min={0}
              step="any"
              className={inputClass('approvalLimit')}
              value={values.approvalLimit}
              onChange={set('approvalLimit')}
              disabled={Number(values.approvalLevel) < 1}
              aria-invalid={!!errors.approvalLimit}
              placeholder={Number(values.approvalLevel) < 1 ? 'Not applicable at level 0' : 'No limit'}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Permissions"
        description="Tick the actions this role may perform in each module. At least one permission is required."
        actions={isSystem ? <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" aria-hidden /> All permissions (locked)</span> : null}
      >
        {errors.permissions && (
          <p className="mb-3 text-sm font-medium text-red-600" role="alert">
            {errors.permissions}
          </p>
        )}
        <PermissionMatrix catalog={catalog} value={values.permissions} onChange={(permissions) => setValues((v) => ({ ...v, permissions }))} readOnly={isSystem} />
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {mode === 'create' ? 'Create role' : mode === 'clone' ? 'Create cloned role' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

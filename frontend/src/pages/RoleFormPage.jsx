import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import RoleForm, { EMPTY_ROLE } from '../components/RoleForm.jsx';
import { Alert, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';

const BASE = '/settings/access-control/roles';

/** One page for three modes: create (/new), edit (/:id/edit) and clone (/:id/clone). */
export default function RoleFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const catalog = useApi('/permissions');
  const branches = useApi('/branches');
  const source = useApi(mode === 'create' ? null : `/roles/${id}`);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');

  const loading = catalog.loading || branches.loading || source.loading;
  const loadError = catalog.error || branches.error || source.error;

  const titles = {
    create: { title: 'Create role', description: 'Define a new role with its permissions, branch scope and approval authority.' },
    edit: { title: `Edit role${source.data ? `: ${source.data.name}` : ''}`, description: 'Changes apply immediately to every user assigned to this role.' },
    clone: { title: `Clone role${source.data ? `: ${source.data.name}` : ''}`, description: 'Creates a new, separate role pre-filled with the settings below. Give it a unique name.' },
  }[mode];

  const initialValues = (() => {
    if (mode === 'create' || !source.data) return EMPTY_ROLE;
    const r = source.data;
    return {
      name: mode === 'clone' ? `Copy of ${r.name}`.slice(0, 100) : r.name,
      description: r.description || '',
      status: mode === 'clone' ? 'active' : r.status,
      branchScope: r.branchScope,
      branchIds: r.branchIds,
      approvalLevel: r.approvalLevel,
      approvalLimit: r.approvalLimit ?? '',
      permissions: r.permissions,
    };
  })();

  const submit = async (payload) => {
    setSubmitting(true);
    setServerErrors({});
    setFormError('');
    try {
      const res =
        mode === 'create'
          ? await api.post('/roles', payload)
          : mode === 'edit'
            ? await api.put(`/roles/${id}`, payload)
            : await api.post(`/roles/${id}/clone`, payload);
      toast.success(res.message);
      navigate(`${BASE}/${res.data.id}`);
    } catch (err) {
      setServerErrors(err.fieldErrors || {});
      setFormError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        {...titles}
        breadcrumbs={[
          { label: 'Settings', to: '/settings' },
          { label: 'Roles', to: BASE },
          ...(source.data ? [{ label: source.data.name, to: `${BASE}/${id}` }] : []),
          { label: mode === 'create' ? 'New' : mode === 'edit' ? 'Edit' : 'Clone' },
        ]}
      />
      {loadError ? (
        <div className="card">
          <ErrorState message={loadError.message} onRetry={() => [catalog, branches, source].forEach((s) => s.reload())} />
        </div>
      ) : loading || !catalog.data || !branches.data ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {formError && <Alert tone="error" title="The role could not be saved">{formError}</Alert>}
          <RoleForm
            key={source.data?.id || 'new'}
            mode={mode}
            initialValues={initialValues}
            catalog={catalog.data}
            branches={branches.data}
            isSystem={mode === 'edit' && source.data?.isSystem}
            submitting={submitting}
            serverErrors={serverErrors}
            onSubmit={submit}
            onCancel={() => navigate(mode === 'create' ? BASE : `${BASE}/${id}`)}
          />
        </div>
      )}
    </>
  );
}

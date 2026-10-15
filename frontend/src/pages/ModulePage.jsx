import { useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { ERP_MODULES } from '../components/AppLayout.jsx';
import { AccessDenied } from '../components/RouteGuards.jsx';
import { Alert, Card, PageHeader } from '../components/ui.jsx';
import NotFoundPage from './NotFoundPage.jsx';

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

/**
 * Business modules (Customers, Loan, ...) are outside the scope of this assignment.
 * This page explains that and shows the signed-in user's effective permissions for the module,
 * which demonstrates how RBAC decides what each user can do.
 */
export default function ModulePage() {
  const { moduleKey } = useParams();
  const { can, session } = useAuth();
  const module = ERP_MODULES.find((m) => m.key === moduleKey);
  if (!module) return <NotFoundPage />;
  if (!can(`${module.key}.view`)) return <AccessDenied />;

  return (
    <>
      <PageHeader title={module.label} description={`${module.label} management module.`} />
      <div className="space-y-6">
        <Alert tone="info" title="Module not included in this build">
          This assignment focuses on the Access Control module. {module.label} appears here as a navigation item and a permission category so you can see how role permissions control access to it.
        </Alert>
        <Card title="Your access to this module" description={`Based on your role: ${session?.role?.name}`}>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {ACTIONS.map((a) => {
              const allowed = can(`${module.key}.${a}`);
              return (
                <li key={a} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-400'}`}>
                  {allowed ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                  <span className="capitalize">{a}</span>
                  <span className="sr-only">{allowed ? 'allowed' : 'not allowed'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}

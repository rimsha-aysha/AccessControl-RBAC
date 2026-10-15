import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Spinner } from './ui.jsx';

/** Sends signed-out visitors to the login page. */
export function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session..." />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/**
 * Hides pages the user isn't allowed to see. This is for user experience only -
 * the backend independently rejects unauthorised API calls.
 */
export function RequireAccess({ admin, permission, children }) {
  const { isAdmin, can } = useAuth();
  const allowed = (admin ? isAdmin : true) && (permission ? can(permission) : true);
  return allowed ? children : <AccessDenied />;
}

export function AccessDenied() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 w-fit rounded-full bg-amber-50 p-3">
        <ShieldAlert className="h-6 w-6 text-amber-600" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Access restricted</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your role does not include permission to open this page. If you need access, ask a System Administrator to update your role.
      </p>
      <Button to="/" variant="secondary" className="mt-6">
        Back to home
      </Button>
    </div>
  );
}

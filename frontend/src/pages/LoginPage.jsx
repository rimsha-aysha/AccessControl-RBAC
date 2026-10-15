import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Button, Field } from '../components/ui.jsx';

export default function LoginPage() {
  const { login, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-brand-600 p-2">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <span className="text-lg font-semibold">Co-op ERP</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Access Control for every branch.</h1>
          <p className="mt-4 text-slate-300">
            Define roles, grant module permissions, set branch scope and approval authority with a full audit trail.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {['Role-based permissions per module and action', 'Branch-level data scope enforcement', 'Tiered approval levels and limits', 'Audit history of every change'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-200" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Demonstration build for evaluation purposes.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-6 w-6 text-brand-700" aria-hidden />
            <span className="text-lg font-semibold text-slate-900">Co-op ERP</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use the account created by your System Administrator.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Email address" htmlFor="email" required>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Password" htmlFor="password" required>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="input pr-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" icon={LogIn} loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-xs text-slate-400">
            There is no public sign-up. Accounts are created by a System Administrator, and the first administrator is created with the backend setup script.
          </p>
        </div>
      </div>
    </div>
  );
}

import { Compass } from 'lucide-react';
import { Button } from '../components/ui.jsx';

export default function NotFoundPage() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 w-fit rounded-full bg-slate-100 p-3">
        <Compass className="h-6 w-6 text-slate-500" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you are looking for does not exist or has moved.</p>
      <Button to="/" variant="secondary" className="mt-6">Back to home</Button>
    </div>
  );
}

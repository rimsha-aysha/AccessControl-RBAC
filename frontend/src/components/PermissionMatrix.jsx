import { CheckSquare, Minus, Square, XSquare } from 'lucide-react';

/**
 * Modules as rows, actions as columns.
 * `value` is an array of permission keys like "loan.approve".
 */
export default function PermissionMatrix({ catalog, value, onChange, readOnly = false }) {
  const selected = new Set(value);
  const { modules, actions } = catalog;

  const toggle = (key) => {
    if (readOnly) return;
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange([...next]);
  };

  const setMany = (keys, on) => {
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange([...next]);
  };

  const moduleKeys = (m) => m.actions.map((a) => `${m.key}.${a}`);
  const actionKeys = (a) => modules.filter((m) => m.actions.includes(a)).map((m) => `${m.key}.${a}`);
  const allKeys = modules.flatMap(moduleKeys);
  const state = (keys) => {
    const count = keys.filter((k) => selected.has(k)).length;
    return count === 0 ? 'none' : count === keys.length ? 'all' : 'some';
  };

  const HeaderToggle = ({ keys, label }) => {
    const s = state(keys);
    const Icon = s === 'all' ? CheckSquare : s === 'some' ? Minus : Square;
    return (
      <button
        type="button"
        onClick={() => setMany(keys, s !== 'all')}
        className="mx-auto mt-1 flex items-center rounded p-0.5 text-slate-400 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={s === 'all' ? `Clear all ${label}` : `Select all ${label}`}
        title={s === 'all' ? 'Clear column' : 'Select column'}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    );
  };

  return (
    <div>
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{selected.size}</span> of {allKeys.length} permissions selected
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMany(allKeys, true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <CheckSquare className="h-3.5 w-3.5" aria-hidden /> Select all
            </button>
            <button type="button" onClick={() => setMany(allKeys, false)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <XSquare className="h-3.5 w-3.5" aria-hidden /> Clear all
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="th sticky left-0 z-10 bg-slate-50">Module</th>
              {actions.map((a) => (
                <th key={a.key} scope="col" className="th text-center">
                  {a.label}
                  {!readOnly && <HeaderToggle keys={actionKeys(a.key)} label={`${a.label} permissions`} />}
                </th>
              ))}
              {!readOnly && <th scope="col" className="th text-center">Row</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {modules.map((m) => {
              const rowKeys = moduleKeys(m);
              const rowState = state(rowKeys);
              return (
                <tr key={m.key} className={rowState !== 'none' ? 'bg-brand-50/30' : ''}>
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-left text-sm font-medium text-slate-800">
                    {m.label}
                  </th>
                  {actions.map((a) => {
                    const key = `${m.key}.${a.key}`;
                    if (!m.actions.includes(a.key)) {
                      return (
                        <td key={a.key} className="px-4 py-3 text-center text-xs text-slate-300" title="Not applicable to this module">
                          —
                        </td>
                      );
                    }
                    const checked = selected.has(key);
                    return (
                      <td key={a.key} className="px-4 py-3 text-center">
                        {readOnly ? (
                          checked ? (
                            <CheckSquare className="mx-auto h-4 w-4 text-brand-700" aria-label={`${a.label} ${m.label}: allowed`} />
                          ) : (
                            <Square className="mx-auto h-4 w-4 text-slate-300" aria-label={`${a.label} ${m.label}: not allowed`} />
                          )
                        ) : (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-700"
                            aria-label={`${a.label} ${m.label}`}
                          />
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setMany(rowKeys, rowState !== 'all')}
                        className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                        aria-label={rowState === 'all' ? `Clear all ${m.label} permissions` : `Select all ${m.label} permissions`}
                      >
                        {rowState === 'all' ? 'Clear' : 'All'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

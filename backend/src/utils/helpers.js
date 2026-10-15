/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lower-cased, trimmed, single-spaced version of a role name, used for uniqueness. */
export function normalizeName(name = '') {
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Escape user input before placing it inside a RegExp. */
export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Standard success response shape: { success: true, data, meta? } */
export function sendSuccess(res, data, { status = 200, meta, message } = {}) {
  const body = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

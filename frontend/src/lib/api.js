/**
 * Small wrapper around fetch for talking to the backend API.
 * - Adds the JWT "Authorization" header automatically.
 * - Turns error responses into ApiRequestError with a readable message.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api').replace(/\/+$/, '');

const TOKEN_KEY = 'rbac_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable - session will simply not persist */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = [] } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** { fieldName: message } built from server validation details. */
  get fieldErrors() {
    return Object.fromEntries((this.details || []).map((d) => [d.field, d.message]));
  }
}

async function send(path, { method = 'GET', body, asBlob = false } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError('Cannot reach the server. Check that the backend is running and try again.');
  }

  if (response.status === 401 && token) {
    // Session expired or revoked - let the AuthProvider sign the user out.
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  if (asBlob && response.ok) return response;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON response */
  }
  if (!response.ok || payload?.success === false) {
    const err = payload?.error || {};
    throw new ApiRequestError(err.message || `Request failed (${response.status})`, {
      status: response.status,
      code: err.code,
      details: err.details,
    });
  }
  return payload;
}

export const api = {
  get: (path) => send(path),
  post: (path, body) => send(path, { method: 'POST', body }),
  put: (path, body) => send(path, { method: 'PUT', body }),
  patch: (path, body) => send(path, { method: 'PATCH', body }),
  del: (path) => send(path, { method: 'DELETE' }),

  /** Downloads a file (e.g. CSV) using the auth header, then triggers the browser download. */
  async download(path, fallbackName) {
    const response = await send(path, { asBlob: true });
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = match?.[1] || fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

/** Builds "?a=1&b=2" skipping empty values. */
export function toQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) search.set(k, v);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
let redirecionandoLogin = false;

function encerrarSessaoExpirada() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');

  if (!redirecionandoLogin && window.location.pathname !== '/login') {
    redirecionandoLogin = true;
    window.location.replace('/login');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(options.headers || {})
  };

  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type');

  const data = contentType?.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401) {
      encerrarSessaoExpirada();
    }

    throw new Error(data?.message || data?.error || 'Erro na requisição.');
  }

  return data;
}

export async function apiBlob(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      encerrarSessaoExpirada();
    }

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : null;
    throw new Error(data?.message || data?.error || 'Erro na requisição.');
  }

  return response.blob();
}

export function apiGet(endpoint) {
  return apiRequest(endpoint);
}

export function apiPost(endpoint, body) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
export function apiPut(endpoint, body) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function apiDelete(endpoint) {
  return apiRequest(endpoint, { method: 'DELETE' });
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiRequest(endpoint, options = {}) {
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

  const contentType = response.headers.get('content-type');

  const data = contentType?.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Erro na requisição.');
  }

  return data;
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
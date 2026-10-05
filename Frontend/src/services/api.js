const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(', ')
      : detail || `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const getProducts = () => request('/products');
export const getProduct = (productId, options) => request(`/products/${productId}`, options);
export const getCategories = () => request('/categories');

export const createOrder = (order) =>
  request('/orders', { method: 'POST', body: JSON.stringify(order) });

export const loginAdmin = (credentials) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });

export const getCurrentAdmin = () => request('/auth/me');
export const logoutAdmin = () => request('/auth/logout', { method: 'POST' });

export const registerCustomer = (profile) =>
  request('/customer/auth/register', { method: 'POST', body: JSON.stringify(profile) });

export const loginCustomer = (credentials) =>
  request('/customer/auth/login', { method: 'POST', body: JSON.stringify(credentials) });

export const getCurrentCustomer = () => request('/customer/auth/me');
export const logoutCustomer = () => request('/customer/auth/logout', { method: 'POST' });
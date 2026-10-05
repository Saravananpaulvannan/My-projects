const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const withImageOrigin = (product) => ({
  ...product,
  image_url: product.image_url
    ? new URL(product.image_url, new URL(API_BASE, window.location.href)).toString()
    : null,
});

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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

async function download(path) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Request failed (${response.status})`);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'download.pdf';
  return { blob: await response.blob(), filename };
}

export const getProducts = async () => (await request('/products')).map(withImageOrigin);
export const getProduct = (productId, options) => request(`/products/${productId}`, options).then(withImageOrigin);
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

export const getAdminCustomers = () => request('/admin/customers');
export const updateAdminCustomerRole = (userId, isAdmin) =>
  request(`/admin/customers/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin: isAdmin }),
  });

export const getAdminDashboard = () => request('/admin/dashboard');
export const getAdminProducts = async () => (await request('/admin/products')).map(withImageOrigin);
export const createAdminProduct = (product) =>
  request('/admin/products', { method: 'POST', body: JSON.stringify(product) }).then(withImageOrigin);
export const updateAdminProduct = (productId, product) =>
  request(`/admin/products/${productId}`, { method: 'PUT', body: JSON.stringify(product) }).then(withImageOrigin);
export const deactivateAdminProduct = (productId) =>
  request(`/admin/products/${productId}`, { method: 'DELETE' });
export const uploadAdminProductImage = (file) => {
  return request('/admin/product-images', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type },
  }).then((result) => ({
    image_url: new URL(result.image_url, new URL(API_BASE, window.location.href)).toString(),
  }));
};
export const getAdminOrders = ({ page = 1, pageSize = 10, deliveryStatus = '' } = {}) => {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (deliveryStatus) params.set('delivery_status', deliveryStatus);
  return request(`/admin/orders?${params}`);
};
export const getAdminOrder = (orderNumber) => request(`/admin/orders/${encodeURIComponent(orderNumber)}`);
export const updateAdminOrderDeliveryStatus = (orderNumber, deliveryStatus) =>
  request(`/admin/orders/${encodeURIComponent(orderNumber)}/delivery-status`, {
    method: 'PATCH',
    body: JSON.stringify({ delivery_status: deliveryStatus }),
  });
export const downloadAdminOrderPdf = (orderNumber) =>
  download(`/admin/orders/${encodeURIComponent(orderNumber)}/pdf`);
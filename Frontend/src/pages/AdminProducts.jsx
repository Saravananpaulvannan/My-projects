import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icons.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { formatINR } from '../data/products.js';
import {
  createAdminProduct,
  deactivateAdminProduct,
  getAdminProducts,
  updateAdminProduct,
  uploadAdminProductImage,
} from '../services/api.js';

const emptyProduct = {
  name: '', category: '', mrp: '', price: '', pack_unit: 'Box', pieces: '',
  description: '', image_url: null, stock_quantity: 0, is_active: true,
};

function fromProduct(product) {
  return {
    ...product,
    mrp: String(product.mrp),
    price: String(product.price),
    pieces: product.pieces == null ? '' : String(product.pieces),
  };
}

export default function AdminProducts() {
  const { refresh: refreshCatalog } = useCatalog();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyProduct);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      setProducts(await getAdminProducts());
    } catch (requestError) {
      setError(requestError.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) =>
      !query || product.name.toLowerCase().includes(query) || String(product.id) === query
    );
  }, [products, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyProduct);
    setFormOpen(true);
    setError('');
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm(fromProduct(product));
    setFormOpen(true);
    setError('');
  };

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const uploaded = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, image_url: uploaded.image_url }));
    } catch (requestError) {
      setError(requestError.message || 'Unable to upload image.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const payload = {
      ...form,
      mrp: Number(form.mrp),
      price: Number(form.price),
      image_url: form.image_url ? new URL(form.image_url, window.location.href).pathname : null,
      pieces: form.pieces === '' ? null : (/^\d+$/.test(form.pieces) ? Number(form.pieces) : form.pieces),
      stock_quantity: Number(form.stock_quantity),
    };
    try {
      const saved = editing
        ? await updateAdminProduct(editing.id, payload)
        : await createAdminProduct(payload);
      setProducts((current) => editing
        ? current.map((product) => product.id === saved.id ? saved : product)
        : [...current, saved].sort((left, right) => left.id - right.id));
      setEditing(null);
      setFormOpen(false);
      setMessage(editing ? 'Product updated.' : 'Product created.');
      refreshCatalog();
    } catch (requestError) {
      setError(requestError.message || 'Unable to save product.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    setError('');
    setMessage('');
    try {
      await deactivateAdminProduct(product.id);
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, is_active: false } : item));
      setMessage(`${product.name} was deactivated.`);
      refreshCatalog();
    } catch (requestError) {
      setError(requestError.message || 'Unable to deactivate product.');
    }
  };

  return (
    <section className="admin-products" aria-labelledby="admin-products-title">
      <div className="admin-section-head">
        <div>
          <h2 id="admin-products-title">Products</h2>
          <p>Manage the products shown in the customer catalog.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Icon name="plus" size={17} /> Add product
        </button>
      </div>

      {message && <p className="success-msg with-icon" role="status"><Icon name="check" size={18} /> {message}</p>}
      {error && <p className="error" role="alert">{error} <button type="button" className="link" onClick={loadProducts}>Try again</button></p>}

      <label className="search-box admin-product-search">
        <Icon name="search" size={18} />
        <input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by name or ID" />
      </label>

      {loading ? <p role="status">Loading products...</p> : error ? null : visibleProducts.length === 0 ? (
        <div className="admin-empty"><p>{products.length ? 'No products match your search.' : 'No products found.'}</p>{products.length === 0 && <button type="button" className="btn btn-outline" onClick={openNew}>Add your first product</button>}</div>
      ) : (
        <div className="admin-data-wrap">
          <table className="admin-data-table admin-product-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Original price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-identity">
                      {product.image_url ? <img src={product.image_url} alt="" /> : <span className="admin-product-placeholder"><Icon name="package" size={18} /></span>}
                      <span><strong>{product.name}</strong><small>#{product.id}</small></span>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td>{formatINR(product.price)}</td>
                  <td className="mrp">{formatINR(product.mrp)}</td>
                  <td>{product.stock_quantity}</td>
                  <td><span className={`admin-status ${product.is_active ? 'active' : 'inactive'}`}>{product.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      <button type="button" className="icon-btn" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}><Icon name="pencil" size={17} /></button>
                      <button type="button" className="icon-btn danger" title={`Delete ${product.name}`} aria-label={`Delete ${product.name}`} disabled={!product.is_active} onClick={() => deactivate(product)}><Icon name="trash-2" size={17} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}>
          <div className="modal admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className="modal-head">
              <h2 id="product-form-title">{editing ? 'Edit product' : 'Add product'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setFormOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <form onSubmit={saveProduct}>
              <div className="admin-form-grid">
                <label className="field"><span>Product name *</span><input autoFocus className="input" name="name" value={form.name} onChange={updateField} minLength={2} maxLength={240} required /></label>
                <label className="field"><span>Category *</span><input className="input" name="category" value={form.category} onChange={updateField} maxLength={100} list="product-categories" required /><datalist id="product-categories">{['Sound Crackers', 'Flower Pots', 'Fancy Novelties', 'Night Specials', 'Kids Specials', 'Sky Shots', 'Multi Shots', 'Chakkars', 'Garlands', 'Bombs', 'Rockets', 'Sparklers', 'Gift Boxes', 'Combo Packs'].map((category) => <option key={category} value={category} />)}</datalist></label>
                <label className="field"><span>Offer price *</span><input className="input" type="number" name="price" value={form.price} onChange={updateField} min="1" step="1" required /></label>
                <label className="field"><span>Original price *</span><input className="input" type="number" name="mrp" value={form.mrp} onChange={updateField} min={form.price || 1} step="1" required /></label>
                <label className="field"><span>Pack unit *</span><input className="input" name="pack_unit" value={form.pack_unit} onChange={updateField} maxLength={40} required /></label>
                <label className="field"><span>Pieces per pack</span><input className="input" name="pieces" value={form.pieces} onChange={updateField} maxLength={60} /></label>
                <label className="field"><span>Stock quantity</span><input className="input" type="number" name="stock_quantity" value={form.stock_quantity} onChange={updateField} min="0" step="1" required /></label>
                <label className="field admin-upload-field"><span>Product image</span><input className="input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={uploadImage} disabled={uploading} /><small>PNG, JPEG, GIF or WebP; up to 5 MB.</small></label>
              </div>
              {form.image_url && <div className="admin-image-preview"><img src={form.image_url} alt="Product preview" /><button type="button" className="btn btn-ghost" onClick={() => setForm((current) => ({ ...current, image_url: null }))}>Remove image</button></div>}
              <label className="field"><span>Description</span><textarea className="input" name="description" value={form.description || ''} onChange={updateField} rows="3" maxLength="4000" /></label>
              <label className="admin-role-control"><input type="checkbox" name="is_active" checked={form.is_active} onChange={updateField} /><span>Active in customer catalog</span></label>
              {error && <p className="error" role="alert">{error}</p>}
              <div className="admin-form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || uploading}><Icon name="check" size={17} /> {busy ? 'Saving...' : uploading ? 'Uploading image...' : 'Save product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
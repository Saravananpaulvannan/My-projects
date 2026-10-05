import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icons.jsx';
import ProductTable from '../components/ProductTable.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { formatINR } from '../data/products.js';

export default function Admin() {
  const { addToCart } = useCart();
  const { admin } = useAuth();
  const { products, categories, loading, error, refresh } = useCatalog();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  // Map of product id -> quantity for selected rows
  const [selected, setSelected] = useState({});
  const [message, setMessage] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || String(p.id) === q)
    );
  }, [search, category]);

  const selectedList = products.filter((p) => selected[p.id]);
  const totalQty = selectedList.reduce((s, p) => s + selected[p.id], 0);
  const totalAmount = selectedList.reduce((s, p) => s + p.price * selected[p.id], 0);
  const totalMrp = selectedList.reduce((s, p) => s + p.mrp * selected[p.id], 0);

  const setQty = (product, qty) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (qty === 0) delete next[product.id];
      else next[product.id] = qty;
      return next;
    });

  const addSelectedToCart = () => {
    selectedList.forEach((p) => addToCart(p, selected[p.id]));
    setMessage(`${selectedList.length} products (${totalQty} qty) added to cart.`);
    setSelected({});
  };

  return (
    <div className="page admin">
      <div className="page-head">
        <h1 className="page-title">Admin · Product List</h1>
        <span className="admin-count">{products.length} products</span>
      </div>
      <p className="admin-user with-icon">
        <Icon name="user" size={16} /> Logged in as <strong>{admin.name}</strong> ({admin.phone})
      </p>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="input"
            placeholder="Search by name or S.No..."
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input select"
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
          ))}
        </select>
      </div>

      {message && (
        <p className="success-msg with-icon" role="status">
          <Icon name="check" size={18} /> {message} <Link to="/cart" className="link">View cart</Link>
        </p>
      )}

      {loading && <p role="status">Loading products...</p>}
      {error && (
        <p className="notice" role="alert">
          {error} <button type="button" className="link" onClick={refresh}>Try again</button>
        </p>
      )}
      {!loading && !error && <ProductTable
        rows={rows}
        getQty={(id) => selected[id] || 0}
        onSetQty={setQty}
        footer={
          <div className="admin-footer">
            <div className="admin-summary">
              <span><strong>{selectedList.length}</strong> selected</span>
              <span>Qty <strong>{totalQty}</strong></span>
              <span>MRP <span className="mrp">{formatINR(totalMrp)}</span></span>
              <span>Total <strong className="admin-total">{formatINR(totalAmount)}</strong></span>
            </div>
            <div className="admin-actions">
              <button className="btn btn-ghost" onClick={() => setSelected({})} disabled={!selectedList.length}>
                <Icon name="x" size={16} /> Clear
              </button>
              <button className="btn btn-primary" onClick={addSelectedToCart} disabled={!selectedList.length}>
                <Icon name="shopping-cart" size={18} /> Add to Cart
              </button>
            </div>
          </div>
        }
      />}
    </div>
  );
}

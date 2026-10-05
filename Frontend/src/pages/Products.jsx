import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import ProductTable from '../components/ProductTable.jsx';
import Icon from '../components/Icons.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';
import { formatINR } from '../data/products.js';

const VIEW_KEY = 'aradhaya-products-view';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const category = categories.includes(params.get('category')) ? params.get('category') : 'All';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const { count, subtotal, getQty, addToCart, updateQty } = useCart();
  const { products, categories, loading, error, refresh } = useCatalog();
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid');

  const changeView = (v) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const setCartQty = (product, qty) => {
    if (getQty(product.id) === 0) {
      if (qty > 0) addToCart(product, qty);
    } else {
      updateQty(product.id, qty);
    }
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = products.filter(
      (p) => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(q)
    );
    if (sort === 'low') result = [...result].sort((a, b) => a.price - b.price);
    if (sort === 'high') result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [category, search, sort]);

  const setCategory = (c) => setParams(c === 'All' ? {} : { category: c });

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Our Products</h1>
        {count > 0 && (
          <Link to="/cart" className="total-pill" aria-live="polite">
            <Icon name="shopping-cart" size={18} />
            <span>{count} {count === 1 ? 'item' : 'items'}</span>
            <strong>{formatINR(subtotal)}</strong>
          </Link>
        )}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="input"
            placeholder="Search products..."
            aria-label="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">Sort: Featured</option>
          <option value="low">Price: Low to High</option>
          <option value="high">Price: High to Low</option>
        </select>
        <div className="view-toggle" role="group" aria-label="Switch view">
          <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            aria-pressed={view === 'grid'}
            aria-label="Card view"
            title="Card view"
            onClick={() => changeView('grid')}
          >
            <Icon name="layout-grid" size={18} />
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            aria-pressed={view === 'list'}
            aria-label="List view"
            title="List view"
            onClick={() => changeView('list')}
          >
            <Icon name="list" size={18} />
          </button>
        </div>
      </div>

      <div className="chips">
        {categories.map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading && <p role="status">Loading products...</p>}
      {error && (
        <div className="notice" role="alert">
          {error} <button type="button" className="link" onClick={refresh}>Try again</button>
        </div>
      )}
      {view === 'list' ? (
        !loading && !error && <ProductTable rows={list} getQty={getQty} onSetQty={setCartQty} />
      ) : loading || error ? null : list.length === 0 ? (
        <div className="empty">No products found.</div>
      ) : (
        <div className="product-grid">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

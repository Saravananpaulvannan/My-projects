import { useEffect, useState } from 'react';
import Icon from '../components/Icons.jsx';
import { formatINR } from '../data/products.js';
import { getAdminDashboard } from '../services/api.js';

const metrics = [
  { key: 'order_count', label: 'Total orders', icon: 'package', format: (value) => value.toLocaleString('en-IN') },
  { key: 'pending_delivery_count', label: 'Deliveries in progress', icon: 'truck', format: (value) => value.toLocaleString('en-IN') },
  { key: 'active_product_count', label: 'Active products', icon: 'sparkles', format: (value) => value.toLocaleString('en-IN') },
  { key: 'total_revenue', label: 'Order value', icon: 'badge-indian-rupee', format: formatINR },
];

export default function AdminDashboard({ navigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAdminDashboard()
      .then((data) => active && setSummary(data))
      .catch((requestError) => active && setError(requestError.message || 'Unable to load admin summary.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
      <div className="admin-section-head">
        <div>
          <h2 id="admin-dashboard-title">Store overview</h2>
          <p>Live totals from the store catalog and orders.</p>
        </div>
        {summary && <span className="admin-count">{summary.product_count} products</span>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading admin dashboard...</p> : summary && (
        <div className="admin-metrics">
          {metrics.map((metric) => (
            <div className="admin-metric" key={metric.key}>
              <span className="admin-metric-icon"><Icon name={metric.icon} size={20} /></span>
              <div><span>{metric.label}</span><strong>{metric.format(summary[metric.key])}</strong></div>
            </div>
          ))}
        </div>
      )}
      <div className="admin-shortcuts">
        <button type="button" className="btn btn-outline" onClick={() => navigate('products')}><Icon name="package" size={17} /> Manage products</button>
        <button type="button" className="btn btn-outline" onClick={() => navigate('orders')}><Icon name="list-checks" size={17} /> View orders</button>
      </div>
    </section>
  );
}
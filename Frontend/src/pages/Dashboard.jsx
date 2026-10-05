import { Link } from 'react-router-dom';
import BannerSlider from '../components/BannerSlider.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Icon from '../components/Icons.jsx';
import { useCatalog } from '../context/CatalogContext.jsx';

const stats = (productCount) => [
  { label: 'Years of Trust', value: '15+', icon: 'trophy' },
  { label: 'Happy Customers', value: '50K+', icon: 'smile' },
  { label: 'Products', value: `${productCount}+`, icon: 'sparkles' },
  { label: 'Cities Delivered', value: '120+', icon: 'truck' },
];

const features = [
  { icon: 'factory', title: 'Direct from Sivakasi', text: 'Sourced straight from licensed manufacturers for authentic quality.' },
  { icon: 'leaf', title: 'Eco-Friendly Options', text: 'Green crackers with reduced emissions and lower noise levels.' },
  { icon: 'shield-check', title: 'Safety Certified', text: 'All products comply with PESO safety and quality standards.' },
  { icon: 'badge-indian-rupee', title: 'Best Prices', text: 'Wholesale rates with up to 90% off listed MRP across the catalog.' },
];

const safetyTips = [
  'Always light crackers in open spaces, away from buildings and vehicles.',
  'Keep a bucket of water or sand nearby.',
  'Children should burst crackers only under adult supervision.',
  'Wear cotton clothes and avoid loose garments.',
  'Never try to relight a cracker that failed to ignite.',
];

export default function Dashboard() {
  const { products, categories, loading, error, refresh } = useCatalog();
  const featured = products.filter((p) => [14, 124, 169, 264].includes(p.id));

  return (
    <div className="page">
      <BannerSlider />

      <div className="stats">
        {stats(loading ? '-' : products.length).map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-icon">
              <Icon name={s.icon} size={26} />
            </span>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="card about">
        <div>
          <h2 className="section-title">About Aaradhaya Crackers</h2>
          <p>
            Aaradhaya Crackers brings the joy of celebration to every home. For over 15 years we have supplied
            premium fireworks for Diwali, weddings, temple festivals, New Year and every special occasion.
          </p>
          <p>
            Our wide range covers sparklers and kid-friendly items for little ones, colourful flower pots and
            chakkars for families, and spectacular sky shots for grand celebrations — so there is something for
            everyone.
          </p>
          <Link to="/contact" className="btn btn-outline">Get in Touch</Link>
        </div>
        <div className="about-art" aria-hidden="true">
          <Icon name="flame" size={110} strokeWidth={1.25} />
        </div>
      </section>

      <section>
        <h2 className="section-title">Why Choose Us</h2>
        <div className="features">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon"><Icon name={f.icon} size={26} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Shop by Category</h2>
        <div className="chips">
          {categories.slice(1).map((c) => (
            <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="chip">
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Featured Products</h2>
          <Link to="/products" className="link">
            View all <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error} <button type="button" className="link" onClick={refresh}>Try again</button>
          </p>
        )}
        {loading && <p role="status">Loading products...</p>}
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {!loading && !error && featured.length === 0 && <p className="muted-text">No featured products are available.</p>}
      </section>

      <section className="card safety">
        <h2 className="section-title">
          <Icon name="fire-extinguisher" size={24} /> Safety First
        </h2>
        <ul>
          {safetyTips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

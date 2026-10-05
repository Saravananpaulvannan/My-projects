import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icons.jsx';
import Logo from './Logo.jsx';

const links = [
  { to: '/', label: 'Dashboard', icon: 'layout-dashboard' },
  { to: '/products', label: 'Products', icon: 'sparkles' },
  { to: '/cart', label: 'Cart', icon: 'shopping-cart', badge: true },
  { to: '/checkout', label: 'Checkout', icon: 'credit-card' },
  { to: '/auth', label: 'Sign in', icon: 'user' },
  { to: '/contact', label: 'Contact', icon: 'phone' },
  { to: '/admin', label: 'Admin', icon: 'list-checks', adminOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { count } = useCart();
  const { customer, isAdmin } = useAuth();

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <Logo size={56} className="brand-logo" />
        <div>
          <div className="brand-name">Aaradhaya</div>
          <div className="brand-sub">Crackers</div>
          {isAdmin && (
            <span className="admin-chip">
              <Icon name="shield-check" size={12} /> Admin
            </span>
          )}
        </div>
      </div>

      <nav className="nav">
        {links.filter((l) => !l.adminOnly || isAdmin).map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            onClick={onClose}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon name={l.icon} className="nav-icon" />
            <span>{l.to === '/auth' && customer ? 'Account' : l.label}</span>
            {l.badge && count > 0 && <span className="badge">{count}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-card">
        <div className="sidebar-card-title"><Icon name="flame" size={18} /> Festival Offer</div>
        <p>Up to 90% off listed prices. Minimum order depends on delivery state.</p>
      </div>

    </aside>
  );
}

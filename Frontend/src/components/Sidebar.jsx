import { useEffect, useRef, useState } from 'react';
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
  { to: '/contact', label: 'Contact', icon: 'phone' },
  { to: '/admin', label: 'Admin', icon: 'list-checks', adminOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { count } = useCart();
  const { admin, isAdmin, openLogin, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e) => !settingsRef.current?.contains(e.target) && setSettingsOpen(false);
    const onKey = (e) => e.key === 'Escape' && setSettingsOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const handleLogin = () => {
    setSettingsOpen(false);
    onClose();
    openLogin();
  };

  const handleLogout = () => {
    setSettingsOpen(false);
    logout();
  };

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
            <span>{l.label}</span>
            {l.badge && count > 0 && <span className="badge">{count}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-card">
        <div className="sidebar-card-title"><Icon name="flame" size={18} /> Festival Offer</div>
        <p>10% off listed prices. Minimum order depends on delivery state.</p>
      </div>

      <div className="settings" ref={settingsRef}>
        {settingsOpen && (
          <div className="settings-menu" role="menu">
            {isAdmin ? (
              <>
                <div className="settings-user">
                  <Icon name="user" size={18} />
                  <div>
                    <strong>{admin.name}</strong>
                    <small>{admin.phone}</small>
                  </div>
                </div>
                <button type="button" role="menuitem" onClick={handleLogout}>
                  <Icon name="log-out" size={16} /> Logout
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" onClick={handleLogin}>
                <Icon name="log-in" size={16} /> Login as Admin
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="settings-btn"
          aria-label="Settings"
          aria-haspopup="menu"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <Icon name="settings" size={20} />
          <span>{isAdmin ? admin.name : 'Settings'}</span>
        </button>
      </div>
    </aside>
  );
}

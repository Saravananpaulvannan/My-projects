import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Icon from './components/Icons.jsx';
import Logo from './components/Logo.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Contact from './pages/Contact.jsx';
import Admin from './pages/Admin.jsx';
import LoginDialog from './components/LoginDialog.jsx';
import FloatingCheckout from './components/FloatingCheckout.jsx';
import { useAuth } from './context/AuthContext.jsx';

function RequireAdmin({ children }) {
  const { isAdmin, loading, openLogin } = useAuth();
  if (loading) return <div className="page" role="status">Checking admin session...</div>;
  if (isAdmin) return children;
  return (
    <div className="page">
      <div className="card empty">
        <div className="empty-icon"><Icon name="lock" size={56} strokeWidth={1.5} /></div>
        <h2>Admins only</h2>
        <p>Please login as an admin to view this page.</p>
        <button className="btn btn-primary" onClick={openLogin}>
          <Icon name="log-in" size={18} /> Login as Admin
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <span className="topbar-title">
            <Logo size={34} /> Aaradhaya Crackers
          </span>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="footer">
          © {new Date().getFullYear()} Aaradhaya Crackers · Celebrate safely <Icon name="sparkles" size={16} />
        </footer>
      </div>
      <FloatingCheckout />
      <LoginDialog />
    </div>
  );
}

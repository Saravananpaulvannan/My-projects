import { useState } from 'react';
import Icon from '../components/Icons.jsx';
import AdminCustomers from '../components/AdminCustomers.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminProducts from './AdminProducts.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const sections = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'products', label: 'Products', icon: 'package' },
  { id: 'orders', label: 'Orders', icon: 'list-checks' },
  { id: 'customers', label: 'Users', icon: 'users' },
];

export default function Admin() {
  const { admin, customer } = useAuth();
  const [section, setSection] = useState('dashboard');
  const adminIdentity = admin || { name: customer?.name, phone: customer?.mobile };
  const currentSection = sections.find((item) => item.id === section) || sections[0];

  return (
    <div className="page admin">
      <div className="page-head">
        <h1 className="page-title">{currentSection.label}</h1>
      </div>
      <p className="admin-user with-icon">
        <Icon name="user" size={16} /> Logged in as <strong>{adminIdentity.name}</strong> ({adminIdentity.phone})
      </p>

      <nav className="admin-tabs" aria-label="Admin sections">
        {sections.map((item) => (
          <button key={item.id} type="button" className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
            <Icon name={item.icon} size={17} /> {item.label}
          </button>
        ))}
      </nav>

      {section === 'dashboard' && <AdminDashboard navigate={setSection} />}
      {section === 'products' && <AdminProducts />}
      {section === 'orders' && <AdminOrders />}
      {section === 'customers' && <AdminCustomers />}
    </div>
  );
}

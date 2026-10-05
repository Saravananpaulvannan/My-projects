import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAdminCustomers, updateAdminCustomerRole } from '../services/api.js';

export default function AdminCustomers() {
  const { updateCustomerRole } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAdminCustomers()
      .then((records) => active && setCustomers(records))
      .catch((requestError) => active && setError(requestError.message || 'Unable to load customer accounts.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reload]);

  const setRole = async (profile, isAdmin) => {
    setUpdatingId(profile.id);
    setError('');
    try {
      const updated = await updateAdminCustomerRole(profile.id, isAdmin);
      setCustomers((current) => current.map((customer) => customer.id === updated.id ? updated : customer));
      updateCustomerRole(updated.id, updated.is_admin);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update this account.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="admin-customers" aria-labelledby="admin-customers-title">
      <div className="admin-customers-head">
        <div>
          <h2 id="admin-customers-title">Users</h2>
          <p>View registered accounts and grant or remove admin access.</p>
        </div>
        {!loading && !error && <span className="admin-count">{customers.length} accounts</span>}
      </div>

      {loading && <p role="status">Loading customer accounts...</p>}
      {error && (
        <p className="notice" role="alert">
          {error} <button type="button" className="link" onClick={() => setReload((value) => value + 1)}>Try again</button>
        </p>
      )}
      {!loading && !error && customers.length === 0 && <p className="muted-text">No customer accounts yet.</p>}
      {!loading && !error && customers.length > 0 && (
        <ul className="admin-customer-list">
          {customers.map((profile) => (
            <li className="admin-customer-row" key={profile.id}>
              <div className="admin-customer-identity">
                <strong>{profile.name}</strong>
                <span>{profile.mobile}</span>
                {profile.email && <span>{profile.email}</span>}
              </div>
              <label className="admin-role-control">
                <input
                  type="checkbox"
                  checked={profile.is_admin}
                  disabled={updatingId !== null}
                  onChange={(event) => setRole(profile, event.target.checked)}
                  aria-label={profile.is_admin ? `Remove admin access from ${profile.name}` : `Make ${profile.name} an admin`}
                />
                <span>{profile.is_admin ? 'Admin' : 'Make admin'}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
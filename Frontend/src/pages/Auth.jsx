import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = {
  name: '',
  email: '',
  mobile: '',
  address_line1: '',
  address_line2: '',
  pincode: '',
  identifier: '',
  password: '',
};

export default function Auth() {
  const { customer, loading, loginCustomer, registerCustomer, logoutCustomer } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestedReturn = params.get('returnTo');
  const destination = requestedReturn?.startsWith('/') && !requestedReturn.startsWith('//')
    ? requestedReturn
    : '/';

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const result = mode === 'login'
      ? await loginCustomer({ identifier: form.identifier.trim(), password: form.password })
      : await registerCustomer({
        name: form.name.trim(),
        email: form.email.trim() || null,
        mobile: form.mobile,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        pincode: form.pincode || null,
        password: form.password,
      });
    setBusy(false);
    if (result.ok) navigate(destination, { replace: true });
    else setError(result.error || 'Unable to authenticate. Please try again.');
  };

  if (loading) return <div className="page" role="status">Checking your account...</div>;

  if (customer) {
    return (
      <div className="page auth-layout">
        <div className="card auth-card">
          <div className="auth-heading">
            <span className="auth-mark"><Icon name="user" size={24} /></span>
            <div>
              <h1 className="page-title">Your account</h1>
              <p className="muted-text">Signed in as {customer.name}</p>
            </div>
          </div>
          <dl className="auth-profile">
            <div><dt>Mobile</dt><dd>{customer.mobile}</dd></div>
            {customer.email && <div><dt>Email</dt><dd>{customer.email}</dd></div>}
            {(customer.address_line1 || customer.address_line2) && (
              <div><dt>Address</dt><dd>{[customer.address_line1, customer.address_line2].filter(Boolean).join(', ')}</dd></div>
            )}
            {customer.pincode && <div><dt>Pincode</dt><dd>{customer.pincode}</dd></div>}
          </dl>
          <div className="auth-actions">
            <Link to="/products" className="btn btn-outline">Continue shopping</Link>
            <button type="button" className="btn btn-ghost" onClick={logoutCustomer}>
              <Icon name="log-out" size={17} /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-layout">
      <div className="card auth-card">
        <div className="auth-heading">
          <span className="auth-mark"><Icon name="user" size={24} /></span>
          <div>
            <h1 className="page-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted-text">{mode === 'login' ? 'Sign in to use your saved details at checkout.' : 'Save your details for a faster checkout next time.'}</p>
          </div>
        </div>

        <div className="auth-tabs" role="group" aria-label="Account action">
          <button type="button" className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' ? (
            <>
              <label className="field">
                <span>Full name *</span>
                <input className="input" name="name" value={form.name} onChange={update} autoComplete="name" minLength={2} maxLength={160} required />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Mobile number *</span>
                  <input className="input" name="mobile" type="tel" inputMode="numeric" value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) }))} autoComplete="tel" pattern="[6-9][0-9]{9}" required />
                </label>
                <label className="field">
                  <span>Email (optional)</span>
                  <input className="input" name="email" type="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} />
                </label>
              </div>
              <label className="field">
                <span>Address line 1 (optional)</span>
                <input className="input" name="address_line1" value={form.address_line1} onChange={update} autoComplete="address-line1" maxLength={240} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Address line 2</span>
                  <input className="input" name="address_line2" value={form.address_line2} onChange={update} autoComplete="address-line2" maxLength={240} />
                </label>
                <label className="field">
                  <span>Pincode</span>
                  <input className="input" name="pincode" inputMode="numeric" value={form.pincode} onChange={(event) => setForm((current) => ({ ...current, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) }))} autoComplete="postal-code" pattern="[0-9]{6}" />
                </label>
              </div>
            </>
          ) : (
            <label className="field">
              <span>Email or mobile number</span>
              <input className="input" name="identifier" value={form.identifier} onChange={update} autoComplete="username" required />
            </label>
          )}

          <label className="field">
            <span>Password {mode === 'register' ? '(12 characters minimum)' : ''}</span>
            <input className="input" name="password" type="password" value={form.password} onChange={update} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} maxLength={256} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary full" disabled={busy}>
            <Icon name={mode === 'login' ? 'log-in' : 'user'} size={18} />
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth-guest-note">An account is optional. <Link to="/checkout">Continue as a guest</Link>.</p>
      </div>
    </div>
  );
}
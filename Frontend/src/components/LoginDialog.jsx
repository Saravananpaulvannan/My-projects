import { useEffect, useState } from 'react';
import Icon from './Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginDialog() {
  const { loginOpen, closeLogin, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!loginOpen) return null;

  function close() {
    setPhone('');
    setPassword('');
    setShowPassword(false);
    setError('');
    closeLogin();
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    const result = await login(phone, password);
    setBusy(false);
    if (result.ok) close();
    else {
      setError(result.error);
      setPassword('');
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <div className="modal-head">
          <h2 id="login-title" className="with-icon">
            <Icon name="lock" size={20} /> Login as Admin
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Mobile Number</span>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="username"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-box">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary full" disabled={busy}>
            <Icon name="log-in" size={18} /> {busy ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

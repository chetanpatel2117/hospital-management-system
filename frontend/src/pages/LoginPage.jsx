import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HeartPulse, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(form);
      navigate(location.state?.from || '/dashboard.html', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark" aria-hidden="true"><HeartPulse size={22} strokeWidth={2.25} /></span><div><h1>MediCare</h1><p>Hospital operations</p></div></div>
        <div className="login-heading"><span className="eyebrow">SECURE ACCESS</span><h2>Welcome back</h2><p>Sign in to manage hospital operations.</p></div>
        {error && <div className="notice error" role="alert">{error}</div>}
        <form className="login-form" onSubmit={submit}>
          <label className="form-field"><span>Username</span><input className="form-control" autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required /></label>
          <label className="form-field"><span>Password</span><input className="form-control" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
          <button className="primary-button login-submit" disabled={submitting}><LockKeyhole size={16} />{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-hint" style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666', padding: '0.5rem 0', position: 'center', borderTop: '1px solid #ddd' }}>
          username : admin  password : admin123
        </p>
        <p className="login-footnote">Access is protected by your hospital account.</p>
      </section>
    </main>
  );
}

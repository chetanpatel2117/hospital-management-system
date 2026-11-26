import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    api(`/api/profile/${encodeURIComponent(user.username)}`)
      .then(setForm)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [user?.username]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api(`/api/profile/${encodeURIComponent(user.username)}`, { method: 'PUT', body: JSON.stringify(form) });
      await refresh();
      setNotice('Profile settings saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Loading your profile…</div>;
  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">ACCOUNT</span><h1>Settings</h1><p>Manage your profile and account preferences.</p></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}
      <section className="form-panel profile-panel">
        <form className="form-grid" onSubmit={submit}>
          <label className="form-field"><span>Name</span><input className="form-control" value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="form-field"><span>Email</span><input className="form-control" type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="form-field"><span>Phone</span><input className="form-control" type="tel" value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label className="form-field"><span>Department</span><input className="form-control" value={form.department || ''} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
          <label className="form-field full"><span>Address</span><textarea className="form-control" rows="3" value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <label className="preference-toggle full"><input type="checkbox" checked={Boolean(form.preferences?.emailNotifications)} onChange={(event) => setForm({ ...form, preferences: { ...form.preferences, emailNotifications: event.target.checked } })} />Email notifications</label>
          <div className="form-actions full"><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
        </form>
      </section>
    </>
  );
}

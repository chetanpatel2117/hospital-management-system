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
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

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

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('Choose a new password different from your current password.');
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await api('/api/profile/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice(result.message);
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setPasswordSaving(false);
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
      <section className="form-panel profile-panel password-panel">
        <div className="panel-heading">
          <div><h2>Change password</h2><p>Use your current password to set a new one. Other signed-in sessions will be revoked.</p></div>
        </div>
        {passwordError && <div className="notice error" role="alert">{passwordError}</div>}
        {passwordNotice && <div className="notice success" role="status">{passwordNotice}</div>}
        <form className="form-grid" onSubmit={changePassword}>
          <label className="form-field"><span>Current password</span><input className="form-control" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required disabled={passwordSaving} /></label>
          <label className="form-field"><span>New password</span><input className="form-control" type="password" autoComplete="new-password" minLength={12} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required disabled={passwordSaving} /></label>
          <label className="form-field"><span>Confirm new password</span><input className="form-control" type="password" autoComplete="new-password" minLength={12} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required disabled={passwordSaving} /></label>
          <div className="form-actions full"><button className="primary-button" disabled={passwordSaving}>{passwordSaving ? 'Updating…' : 'Update password'}</button></div>
        </form>
      </section>
    </>
  );
}

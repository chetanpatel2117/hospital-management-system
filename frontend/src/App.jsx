import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import ResourcePage, { pageConfigs } from './pages/ResourcePage.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

const pageByPath = {
  '/dashboard.html': 'dashboard',
  '/patient details.html': 'patients',
  '/doctor details.html': 'doctors',
  '/appointment details.html': 'appointments',
  '/emergancy case.html': 'emergency',
  '/staff details.html': 'staff',
  '/room details.html': 'rooms',
  '/icu details.html': 'icu',
  '/pharmacy.html': 'pharmacy',
  '/laboratory.html': 'laboratory',
  '/billing.html': 'billing',
  '/report details.html': 'reports',
  '/settings.html': 'settings'
};

function LegacyRouteApp() {
  const location = useLocation();
  const { user, loading, authError, refresh } = useAuth();
  const path = decodeURIComponent(location.pathname).toLowerCase();

  if (path === '/login page.html' || path === '/login') {
    if (loading) return <LoadingScreen />;
    if (authError) return <SessionError message={authError} onRetry={() => refresh().catch(() => {})} />;
    return user ? <Navigate to="/dashboard.html" replace /> : <Suspense fallback={<LoadingScreen />}><LoginPage /></Suspense>;
  }
  if (path === '/' && !loading && !user) return <Navigate to="/login page.html" replace />;
  if (loading) return <LoadingScreen />;
  if (authError) return <SessionError message={authError} onRetry={() => refresh().catch(() => {})} />;
  if (!user) return <Navigate to="/login page.html" replace state={{ from: location.pathname }} />;

  const page = pageByPath[path] || (path === '/' ? 'dashboard' : null);
  if (!page) return <main className="not-found"><h1>Page not found</h1><a href="/dashboard.html">Return to dashboard</a></main>;

  let content;
  if (page === 'dashboard') content = <DashboardPage />;
  else if (page === 'reports') content = <ReportsPage />;
  else if (page === 'settings') content = <ProfilePage />;
  else content = <ResourcePage key={page} config={pageConfigs[page]} />;

  return <Layout activePage={page}><Suspense fallback={<div className="loading-state">Loading module…</div>}>{content}</Suspense></Layout>;
}

function LoadingScreen() {
  return <main className="auth-loading" role="status">Checking your secure session…</main>;
}

function SessionError({ message, onRetry }) {
  return <main className="auth-loading"><div className="notice error" role="alert">Unable to verify your session: {message}</div><button className="primary-button" onClick={onRetry}>Retry</button></main>;
}

export default function App() {
  return <LegacyRouteApp />;
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, BedDouble, Building2, CalendarDays, ChartNoAxesCombined, ClipboardList, CreditCard, HeartPulse,
  FlaskConical, LayoutDashboard, LogOut, Menu, Pill, Settings, ShieldAlert,
  Stethoscope, Users, X
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { canAccessRole, moduleForPage } from '../permissions.js';

const navigation = [
  { id: 'dashboard', label: 'Overview', href: '/dashboard.html', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', href: '/patient%20details.html', icon: Users },
  { id: 'doctors', label: 'Doctors', href: '/doctor%20details.html', icon: Stethoscope },
  { id: 'appointments', label: 'Appointments', href: '/appointment%20details.html', icon: CalendarDays },
  { id: 'departments', label: 'Departments', href: '/departments.html', icon: Building2 },
  { id: 'medicalRecords', label: 'Medical records', href: '/medical-records.html', icon: ClipboardList },
  { id: 'emergency', label: 'Emergency', href: '/emergancy%20case.html', icon: ShieldAlert },
  { id: 'staff', label: 'Staff', href: '/staff%20details.html', icon: Users },
  { id: 'rooms', label: 'Rooms', href: '/room%20details.html', icon: BedDouble },
  { id: 'beds', label: 'Bed management', href: '/bed-management.html', icon: BedDouble },
  { id: 'icu', label: 'ICU', href: '/ICU%20details.html', icon: Activity },
  { id: 'pharmacy', label: 'Pharmacy', href: '/pharmacy.html', icon: Pill },
  { id: 'laboratory', label: 'Laboratory', href: '/laboratory.html', icon: FlaskConical },
  { id: 'billing', label: 'Billing', href: '/billing.html', icon: CreditCard },
  { id: 'users', label: 'User management', href: '/users.html', icon: Users },
  { id: 'reports', label: 'Reports', href: '/report%20details.html', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Settings', href: '/settings.html', icon: Settings }
];

export default function Layout({ activePage, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const visibleNavigation = navigation.filter((item) => canAccessRole(user?.role, moduleForPage(item.id), 'read'));

  useEffect(() => {
    const mobileBreakpoint = window.matchMedia('(max-width: 700px)');
    const compactBreakpoint = window.matchMedia('(min-width: 701px) and (max-width: 1100px)');
    const updateLayout = () => {
      setMobileLayout(mobileBreakpoint.matches);
      setSidebarCollapsed(compactBreakpoint.matches);
      if (!mobileBreakpoint.matches) setSidebarOpen(false);
    };
    updateLayout();
    mobileBreakpoint.addEventListener('change', updateLayout);
    compactBreakpoint.addEventListener('change', updateLayout);
    return () => {
      mobileBreakpoint.removeEventListener('change', updateLayout);
      compactBreakpoint.removeEventListener('change', updateLayout);
    };
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login page.html', { replace: true });
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {sidebarOpen && <button className="sidebar-backdrop open" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`app-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Main navigation">
        <a className="brand" href="/dashboard.html">
          <span className="brand-mark" aria-hidden="true"><HeartPulse size={22} strokeWidth={2.25} /></span>
          <span className="brand-copy"><span className="brand-name">MediCare</span><span className="brand-caption">Hospital operations</span></span>
        </a>
        <div className="nav-caption">Workspace</div>
        <nav className="app-nav">
          {visibleNavigation.map(({ id, label, href, icon: Icon }) => (
            <a key={id} href={href} title={sidebarCollapsed ? label : undefined} className={activePage === id ? 'active' : ''} aria-current={activePage === id ? 'page' : undefined} onClick={() => setSidebarOpen(false)}>
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
            </a>
          ))}
        </nav>
        <button className="sidebar-logout" type="button" title={sidebarCollapsed ? 'Sign out' : undefined} onClick={handleSignOut}><LogOut size={17} /><span>Sign out</span></button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-heading">
            <button className="menu-toggle" type="button" aria-label={mobileLayout ? sidebarOpen ? 'Close navigation' : 'Open navigation' : sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={mobileLayout ? sidebarOpen : !sidebarCollapsed} onClick={() => {
              if (mobileLayout) setSidebarOpen((open) => !open);
              else setSidebarCollapsed((collapsed) => !collapsed);
            }}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="topbar-title">{navigation.find((item) => item.id === activePage)?.label || 'Hospital'}</span>
          </div>
          <div className="topbar-user">
            <span className="avatar">{(user?.name || user?.username || 'A').slice(0, 1).toUpperCase()}</span>
            <span className="user-copy"><span className="user-name">{user?.name || user?.username}</span><span className="user-role">{user?.role}</span></span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

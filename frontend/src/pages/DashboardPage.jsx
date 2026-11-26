import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Activity, BedDouble, CalendarDays, CreditCard, FlaskConical, HeartPulse, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const chartColors = ['#2563a6', '#0f8b8d', '#70a5cc', '#74b69a', '#e5a84b'];

function Metric({ label, value, icon: Icon, tone = '' }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-note">Current database total</div></article>;
}

function Empty({ children }) {
  return <tr><td className="empty-row" colSpan="8">{children}</td></tr>;
}

function TablePanel({ title, children }) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2></div></div><div className="table-wrap">{children}</div></section>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/dashboard/overview')
      .then(setData)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state" role="status">Loading hospital overview…</div>;
  if (error) return <div className="notice error" role="alert">{error}</div>;
  if (!data) return <div className="notice">Dashboard data is unavailable.</div>;

  const { stats, charts } = data;
  const metrics = [
    ['Patients', stats.patients, Users, ''],
    ['Doctors', stats.doctors, HeartPulse, 'teal'],
    ['Appointments', stats.appointments, CalendarDays, ''],
    ['Available beds', stats.availableBeds, BedDouble, 'green'],
    ['Total staff', stats.staff, Users, 'teal'],
    ["Today's revenue", currency.format(stats.todaysRevenue), CreditCard, 'green'],
    ['Pending appointments', stats.pendingAppointments, Activity, 'amber'],
    ['Emergency cases', stats.emergencyCases, FlaskConical, 'amber']
  ];

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">HOSPITAL OVERVIEW</span><h1>Good day, {(user?.name || user?.username || 'team').split(' ')[0]}</h1><p>Live operational snapshot from your hospital records.</p></div><span className="date-chip">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <section className="metric-grid">{metrics.map(([label, value, icon, tone]) => <Metric key={label} label={label} value={value ?? 0} icon={icon} tone={tone} />)}</section>
      <section className="section-grid two">
        <article className="panel"><div className="panel-heading"><div><h2>Patient admissions</h2><p>Monthly patient registrations</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><LineChart data={(charts.months || []).map((month, index) => ({ month, patients: charts.patientAdmissions[index] }))}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="patients" stroke="#2563a6" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-heading"><div><h2>Revenue analytics</h2><p>Recorded payments by month</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><BarChart data={(charts.months || []).map((month, index) => ({ month, paid: charts.paidAmountsByBillMonth[index] }))}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => currency.format(value)} /><Bar dataKey="paid" fill="#0f8b8d" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
      </section>
      <section className="section-grid three">
        <article className="panel"><div className="panel-heading"><div><h2>Appointments</h2><p>By current status</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.appointmentStatuses || []} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3}>{(charts.appointmentStatuses || []).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-heading"><div><h2>Bed occupancy</h2><p>Capacity by room status</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.beds || []} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3}>{(charts.beds || []).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-heading"><div><h2>Department patients</h2><p>Current patient records</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={220}><BarChart data={charts.departments || []} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="#e9eef3" horizontal={false} /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#70a5cc" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></article>
      </section>
      <section className="section-grid two">
        <TablePanel title="Today's appointments"><table className="data-table"><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>{data.todaysAppointments?.length ? data.todaysAppointments.map((item) => <tr key={item._id}><td>{item.time}</td><td>{item.patientName}</td><td>{item.doctorName}</td><td><span className="status-pill">{item.status}</span></td></tr>) : <Empty>No appointments scheduled today.</Empty>}</tbody></table></TablePanel>
        <TablePanel title="Recent patient registrations"><table className="data-table"><thead><tr><th>Patient</th><th>Department</th><th>Status</th></tr></thead><tbody>{data.recentPatients?.length ? data.recentPatients.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.condition || '—'}</td><td><span className="status-pill">{item.status || 'Registered'}</span></td></tr>) : <Empty>No patient records yet.</Empty>}</tbody></table></TablePanel>
      </section>
      <section className="section-grid two">
        <TablePanel title="Recent transactions"><table className="data-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.recentTransactions?.length ? data.recentTransactions.map((item) => <tr key={item._id}><td>{item.invoiceNumber}</td><td>{item.patientName}</td><td>{currency.format(item.amount || 0)}</td><td>{item.status}</td></tr>) : <Empty>No billing records yet.</Empty>}</tbody></table></TablePanel>
        <TablePanel title="Doctor availability"><table className="data-table"><thead><tr><th>Doctor</th><th>Department</th><th>Availability</th><th>Shift</th></tr></thead><tbody>{data.doctors?.length ? data.doctors.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.department}</td><td>{item.availability}</td><td>{item.shift}</td></tr>) : <Empty>No doctor records available.</Empty>}</tbody></table></TablePanel>
      </section>
      <section className="section-grid">
        <TablePanel title="Active emergency cases"><table className="data-table"><thead><tr><th>Patient</th><th>Case type</th><th>Condition</th><th>Room</th></tr></thead><tbody>{data.recentEmergencyCases?.length ? data.recentEmergencyCases.map((item) => <tr key={item._id}><td>{item.patientName}</td><td>{item.emergencyType}</td><td><span className="status-pill danger">{item.conditionLevel}</span></td><td>{item.roomNumber || '—'}</td></tr>) : <Empty>No active emergency cases.</Empty>}</tbody></table></TablePanel>
      </section>
    </>
  );
}

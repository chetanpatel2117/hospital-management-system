import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Activity, BedDouble, CalendarDays, ClipboardList, CreditCard, FlaskConical, HeartPulse, Pill, Siren, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { canAccessRole, normalizeRole } from '../permissions.js';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const chartColors = ['#2563a6', '#0f8b8d', '#70a5cc', '#74b69a', '#e5a84b'];

function Metric({ label, value, icon: Icon, tone = '', note = 'Current database total' }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>;
}

function Empty({ children, columns = 4 }) {
  return <tr><td className="empty-row" colSpan={columns}>{children}</td></tr>;
}

function TablePanel({ title, children }) {
  return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2></div></div><div className="table-wrap">{children}</div></section>;
}

function ChartPanel({ title, description, hasData, children }) {
  return <article className="panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{hasData ? <div className="chart-wrap">{children}</div> : <div className="chart-empty">No records available for this period.</div>}</article>;
}

function DashboardGrid({ panels }) {
  if (!panels.length) return null;
  const layout = panels.length === 1 ? 'one' : panels.length === 3 ? 'three' : 'two';
  return <section className={`section-grid ${layout}`}>{panels}</section>;
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
  const role = normalizeRole(user?.role);
  const canRead = (module) => canAccessRole(role, module, 'read');
  const canPatients = canRead('patients');
  const canDoctors = canRead('doctors');
  const canAppointments = canRead('appointments');
  const canRooms = canRead('rooms');
  const canBilling = canRead('billing');
  const canStaff = canRead('staff');
  const canEmergency = canRead('emergency');
  const canLaboratory = canRead('laboratory');
  const canPharmacy = canRead('pharmacy');
  const signedCount = (value) => `${value > 0 ? '+' : ''}${value}`;
  const trends = stats.trends || {};
  const metrics = [];
  if (canPatients) metrics.push(['Patients', stats.patients, Users, '', `${trends.patientsAdded30d || 0} registered in 30d · ${signedCount(trends.patientsAdded30dChange || 0)} vs prior 30d`]);
  if (canDoctors) metrics.push(['Doctors', stats.doctors, HeartPulse, 'teal', 'Current doctor records']);
  if (canAppointments) {
    metrics.push(['Appointments', stats.appointments, CalendarDays, '', `${trends.appointments30d || 0} in 30d · ${signedCount(trends.appointments30dChange || 0)} vs prior 30d`]);
    metrics.push(['Pending appointments', stats.pendingAppointments, Activity, 'amber', 'Pending or scheduled records']);
  }
  if (canRooms) metrics.push(['Available beds', stats.availableBeds, BedDouble, 'green', 'Individual available bed slots']);
  if (canStaff) metrics.push(['Total staff', stats.staff, Users, 'teal', 'Current staff records']);
  if (canBilling) metrics.push(["Today's revenue", currency.format(stats.todaysRevenue), CreditCard, 'green', `${currency.format(trends.todaysRevenueChange || 0)} vs yesterday`]);
  if (canEmergency) metrics.push(['Emergency cases', stats.emergencyCases, Siren, 'amber', 'Active emergency records']);
  if (canLaboratory) {
    metrics.push(['Lab tests', stats.labTests, FlaskConical, 'teal', 'Saved test records']);
    metrics.push(['Pending tests', stats.pendingLabTests, ClipboardList, 'amber', 'Not completed or cancelled']);
    metrics.push(['Reports ready', stats.reportsReady, ClipboardList, 'green', 'Results marked ready']);
  }
  if (canPharmacy) {
    metrics.push(['Medicines', stats.medicines, Pill, 'teal', 'Inventory records']);
    metrics.push(['Low stock', stats.lowStock, Pill, 'amber', 'At or below reorder level']);
    metrics.push(['Expiring soon', stats.expiringMedicines, Pill, 'amber', 'Within the next 30 days']);
  }
  const primaryCharts = [];
  if (canPatients) primaryCharts.push(
    <ChartPanel key="admissions" title="Patient admissions" description="Monthly patient registrations" hasData={(charts.patientAdmissions || []).some((value) => value > 0)}>
      <ResponsiveContainer width="100%" height={240}><LineChart data={(charts.months || []).map((month, index) => ({ month, patients: charts.patientAdmissions[index] }))}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Line type="monotone" dataKey="patients" stroke="#2563a6" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
    </ChartPanel>
  );
  if (canBilling) primaryCharts.push(
    <ChartPanel key="revenue" title="Revenue analytics" description="Recorded payments by month" hasData={(charts.paidAmountsByBillMonth || []).some((value) => value > 0)}>
      <ResponsiveContainer width="100%" height={240}><BarChart data={(charts.months || []).map((month, index) => ({ month, paid: charts.paidAmountsByBillMonth[index] }))}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => currency.format(value)} /><Bar dataKey="paid" fill="#0f8b8d" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
    </ChartPanel>
  );
  const operationalCharts = [];
  if (canAppointments) operationalCharts.push(
    <ChartPanel key="appointments" title="Appointments" description="By current status" hasData={(charts.appointmentStatuses || []).length > 0}>
      <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.appointmentStatuses || []} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3}>{(charts.appointmentStatuses || []).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
    </ChartPanel>
  );
  if (canRooms) operationalCharts.push(
    <ChartPanel key="beds" title="Bed occupancy" description="Individual beds by current status" hasData={(charts.beds || []).some((entry) => entry.value > 0)}>
      <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.beds || []} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3}>{(charts.beds || []).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
    </ChartPanel>
  );
  if (canPatients) operationalCharts.push(
    <ChartPanel key="departments" title="Department patients" description="Current patient records" hasData={(charts.departments || []).length > 0}>
      <ResponsiveContainer width="100%" height={220}><BarChart data={charts.departments || []} layout="vertical" margin={{ left: 10 }}><CartesianGrid stroke="#e9eef3" horizontal={false} /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="label" width={90} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#70a5cc" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
    </ChartPanel>
  );
  if (canLaboratory) operationalCharts.push(
    <ChartPanel key="laboratory" title="Laboratory workflow" description="Tests by current status" hasData={(charts.labStatuses || []).length > 0}>
      <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.labStatuses || []} dataKey="value" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3}>{(charts.labStatuses || []).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
    </ChartPanel>
  );
  if (canPharmacy) operationalCharts.push(
    <ChartPanel key="pharmacy" title="Medicine inventory" description="Inventory by category" hasData={(charts.medicineCategories || []).length > 0}>
      <ResponsiveContainer width="100%" height={220}><BarChart data={charts.medicineCategories || []}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#0f8b8d" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
    </ChartPanel>
  );
  const tablePanels = [];
  if (canAppointments) tablePanels.push(
    <TablePanel key="appointments" title="Today's appointments"><table className="data-table"><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead><tbody>{data.todaysAppointments?.length ? data.todaysAppointments.map((item) => <tr key={item._id}><td>{item.time}</td><td>{item.patientName}</td><td>{item.doctorName}</td><td><span className="status-pill">{item.status}</span></td></tr>) : <Empty>No appointments scheduled today.</Empty>}</tbody></table></TablePanel>
  );
  if (canPatients) tablePanels.push(
    <TablePanel key="patients" title="Recent patient registrations"><table className="data-table"><thead><tr><th>Patient</th><th>Department</th><th>Status</th></tr></thead><tbody>{data.recentPatients?.length ? data.recentPatients.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.condition || '—'}</td><td><span className="status-pill">{item.status || 'Registered'}</span></td></tr>) : <Empty columns={3}>No patient records yet.</Empty>}</tbody></table></TablePanel>
  );
  if (canBilling) tablePanels.push(
    <TablePanel key="billing" title="Recent transactions"><table className="data-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.recentTransactions?.length ? data.recentTransactions.map((item) => <tr key={item._id}><td>{item.invoiceNumber}</td><td>{item.patientName}</td><td>{currency.format(item.amount || 0)}</td><td>{item.status}</td></tr>) : <Empty>No billing records yet.</Empty>}</tbody></table></TablePanel>
  );
  if (canDoctors) tablePanels.push(
    <TablePanel key="doctors" title="Doctor availability"><table className="data-table"><thead><tr><th>Doctor</th><th>Department</th><th>Availability</th><th>Shift</th></tr></thead><tbody>{data.doctors?.length ? data.doctors.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.department}</td><td>{item.availability}</td><td>{item.shift}</td></tr>) : <Empty>No doctor records available.</Empty>}</tbody></table></TablePanel>
  );
  if (canEmergency) tablePanels.push(
    <TablePanel key="emergency" title="Active emergency cases"><table className="data-table"><thead><tr><th>Patient</th><th>Case type</th><th>Condition</th><th>Room</th></tr></thead><tbody>{data.recentEmergencyCases?.length ? data.recentEmergencyCases.map((item) => <tr key={item._id}><td>{item.patientName}</td><td>{item.emergencyType}</td><td><span className="status-pill danger">{item.conditionLevel}</span></td><td>{item.roomNumber || '—'}</td></tr>) : <Empty>No active emergency cases.</Empty>}</tbody></table></TablePanel>
  );
  if (canLaboratory) tablePanels.push(
    <TablePanel key="laboratory" title="Recent laboratory tests"><table className="data-table"><thead><tr><th>Patient</th><th>Test</th><th>Priority</th><th>Status</th><th>Report</th></tr></thead><tbody>{data.recentLabTests?.length ? data.recentLabTests.map((item) => <tr key={item._id}><td>{item.patientName}</td><td>{item.testName}</td><td>{item.priority}</td><td>{item.status}</td><td>{item.reportReady ? 'Ready' : 'Pending'}</td></tr>) : <Empty columns={5}>No laboratory tests yet.</Empty>}</tbody></table></TablePanel>
  );
  if (canPharmacy) tablePanels.push(
    <TablePanel key="pharmacy" title="Recent medicine inventory"><table className="data-table"><thead><tr><th>Medicine</th><th>Category</th><th>Stock</th><th>Reorder level</th><th>Expiry</th></tr></thead><tbody>{data.recentMedicines?.length ? data.recentMedicines.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.category || '—'}</td><td>{item.stock}</td><td>{item.reorderLevel}</td><td>{item.expiryDate || '—'}</td></tr>) : <Empty columns={5}>No medicine records yet.</Empty>}</tbody></table></TablePanel>
  );
  const roleHeadings = {
    administrator: ['HOSPITAL OVERVIEW', 'Live operational snapshot from your hospital records.'],
    doctor: ['DOCTOR DASHBOARD', 'Clinical activity from patient, appointment, and laboratory records.'],
    receptionist: ['RECEPTION DESK', 'Patient flow, appointments, rooms, and recorded billing activity.'],
    nurse: ['NURSING DASHBOARD', 'Patient, appointment, room, and laboratory workflow.'],
    pharmacyStaff: ['PHARMACY OVERVIEW', 'Medicine inventory and stock status.'],
    labStaff: ['LABORATORY OVERVIEW', 'Patient and laboratory workflow records.']
  };
  const [eyebrow, description] = roleHeadings[role] || roleHeadings.administrator;

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>Good day, {(user?.name || user?.username || 'team').split(' ')[0]}</h1><p>{description}</p></div><span className="date-chip">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <section className="metric-grid">{metrics.map(([label, value, icon, tone, note]) => <Metric key={label} label={label} value={value ?? 0} icon={icon} tone={tone} note={note} />)}</section>
      <DashboardGrid panels={primaryCharts} />
      <DashboardGrid panels={operationalCharts} />
      <DashboardGrid panels={tablePanels} />
      <DashboardGrid panels={[
        <TablePanel key="activity" title="Recent hospital activity"><table className="data-table"><thead><tr><th>Module</th><th>Record</th><th>Last updated</th></tr></thead><tbody>{data.recentActivities?.length ? data.recentActivities.map((item) => <tr key={`${item.type}-${item.id}`}><td>{item.type}</td><td>{item.title}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td></tr>) : <Empty columns={3}>No recent activity is recorded.</Empty>}</tbody></table></TablePanel>
      ]} />
    </>
  );
}

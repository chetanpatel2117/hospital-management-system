import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';

const today = new Date();
const defaultTo = today.toISOString().slice(0, 10);
const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ReportsPage() {
  const [range, setRange] = useState({ from: defaultFrom, to: defaultTo });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(nextRange = range) {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams(nextRange);
      setReport(await api(`/api/reports/summary?${query}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const departments = useMemo(() => report?.patientsByDepartment || [], [report]);
  const statuses = useMemo(() => report?.appointmentStatuses || [], [report]);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ['Month', 'Patients', 'Appointments', 'Invoices', 'Billed amount', 'Paid amount'],
      ...report.months.map((month) => [month.label, month.patients, month.appointments, month.bills, month.billedAmount, month.paidAmount])
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hospital-report-${range.from}-to-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">ANALYTICS</span><h1>Reports & analytics</h1><p>Explore patient, revenue, and appointment performance using recorded data.</p></div>{report && <button className="secondary-button" type="button" onClick={exportCsv}>Export CSV</button>}</div>
      <form className="report-filters" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="form-field"><span>From</span><input className="form-control" type="date" value={range.from} max={range.to} onChange={(event) => setRange({ ...range, from: event.target.value })} required /></label>
        <label className="form-field"><span>To</span><input className="form-control" type="date" value={range.to} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} required /></label>
        <button className="primary-button" disabled={loading}>{loading ? 'Loading…' : 'Apply date range'}</button>
      </form>
      {error && <div className="notice error" role="alert">{error}</div>}
      {report && <>
        <section className="metric-grid report-metrics">
          {[['Patients', report.totals.patients], ['Appointments', report.totals.appointments], ['Invoices', report.totals.bills], ['Billed', currency.format(report.totals.billedAmount)], ['Paid', currency.format(report.totals.paidAmount)]].map(([label, value]) => <article key={label} className="metric-card"><span className="metric-label">{label}</span><div className="metric-value">{value}</div></article>)}
        </section>
        <section className="section-grid two">
          <article className="panel"><div className="panel-heading"><div><h2>Activity over time</h2><p>Patient growth and appointments</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={280}><BarChart data={report.months}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="patients" name="Patients" fill="#2563a6" radius={[4, 4, 0, 0]} /><Bar dataKey="appointments" name="Appointments" fill="#0f8b8d" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
          <article className="panel"><div className="panel-heading"><div><h2>Financial performance</h2><p>Invoice and payment totals per month</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={280}><BarChart data={report.months}><CartesianGrid stroke="#e9eef3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => currency.format(value)} /><Bar dataKey="billedAmount" name="Billed" fill="#70a5cc" radius={[4, 4, 0, 0]} /><Bar dataKey="paidAmount" name="Paid" fill="#0f8b8d" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></article>
        </section>
        <section className="section-grid two">
          <article className="panel"><div className="panel-heading"><div><h2>Patient distribution</h2><p>By department / condition</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><BarChart data={departments} layout="vertical"><CartesianGrid stroke="#e9eef3" horizontal={false} /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#70a5cc" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></article>
          <article className="panel"><div className="panel-heading"><div><h2>Appointment statuses</h2><p>Records in selected period</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={statuses} dataKey="value" nameKey="label" innerRadius={56} outerRadius={90} paddingAngle={3}>{statuses.map((item, index) => <Cell key={item.label} fill={['#2563a6', '#0f8b8d', '#70a5cc', '#e5a84b'][index % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></article>
        </section>
        <section className="table-panel report-table"><div className="panel-heading"><div><h2>Doctor performance</h2><p>Appointments in the selected date range</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Doctor</th><th>Appointments</th></tr></thead><tbody>{report.doctorPerformance.length ? report.doctorPerformance.map((doctor) => <tr key={doctor.name}><td>{doctor.name}</td><td>{doctor.appointments}</td></tr>) : <tr><td className="empty-row" colSpan="2">No appointment records for this period.</td></tr>}</tbody></table></div></section>
      </>}
    </>
  );
}

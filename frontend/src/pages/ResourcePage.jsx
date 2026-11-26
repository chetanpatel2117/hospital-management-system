import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Printer, Search } from 'lucide-react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import AppointmentCalendar from '../components/AppointmentCalendar.jsx';
import { canAccessRole, normalizeRole } from '../permissions.js';
import { useAuth } from '../auth.jsx';

const fields = (...items) => items.map(([name, label, type = 'text', options = null, required = false, source = null, readOnly = false]) => ({ name, label, type, options, required, source, readOnly }));
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const isDoctor = (row) => /doctor|consultant|physician/i.test(row.role || '');
const isBookableDoctor = (row) => isDoctor(row) && !/^(unavailable|on leave)$/i.test(row.availability || '');

export const pageConfigs = {
  patients: {
    title: 'Patient management', subtitle: 'Maintain patient profiles and clinical records.', endpoint: '/api/patients', module: 'patients', singular: 'patient',
    fields: fields(['name', 'Patient name', 'text', null, true], ['age', 'Age', 'number', null, true], ['gender', 'Gender', 'select', ['Male', 'Female', 'Other'], true], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['bloodGroup', 'Blood group', 'select', ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']], ['address', 'Address', 'textarea'], ['condition', 'Department / condition', 'text'], ['medicalHistory', 'Medical history', 'textarea'], ['status', 'Status', 'select', ['Admitted', 'Under Observation', 'Recovered', 'Discharged']]),
    filters: [{ key: 'gender', label: 'Gender' }, { key: 'status', label: 'Status' }],
    columns: [['name', 'Patient'], ['age', 'Age'], ['gender', 'Gender'], ['phone', 'Contact'], ['bloodGroup', 'Blood group'], ['condition', 'Department'], ['status', 'Status']]
  },
  doctors: {
    title: 'Doctor management', subtitle: 'Manage clinician profiles, specialties, and availability.', endpoint: '/api/staff', module: 'doctors', relatedEndpoint: '/api/appointments', singular: 'doctor', filter: isDoctor,
    defaults: { role: 'Doctor', availability: 'Available' },
    fields: fields(['name', 'Doctor name', 'text', null, true], ['role', 'Role', 'text', null, true], ['specialization', 'Specialization', 'text'], ['department', 'Department', 'text'], ['experienceYears', 'Experience (years)', 'number'], ['availability', 'Availability', 'select', ['Available', 'Unavailable', 'On leave']], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['shift', 'Shift', 'select', ['Morning', 'Evening', 'Night', 'Flexible']]),
    columns: [['name', 'Doctor'], ['specialization', 'Specialization'], ['department', 'Department'], ['availability', 'Availability'], ['phone', 'Contact'], ['experienceYears', 'Experience'], ['appointmentCount', 'Appointments']],
    filters: [{ key: 'department', label: 'Department' }, { key: 'availability', label: 'Availability' }]
  },
  staff: {
    title: 'Staff management', subtitle: 'Maintain workforce details and shift assignments.', endpoint: '/api/staff', module: 'staff', singular: 'staff member',
    fields: fields(['name', 'Name', 'text', null, true], ['role', 'Role', 'text', null, true], ['department', 'Department', 'text'], ['specialization', 'Specialization', 'text'], ['experienceYears', 'Experience (years)', 'number'], ['availability', 'Availability', 'select', ['Available', 'Unavailable', 'On leave']], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['shift', 'Shift', 'select', ['Morning', 'Evening', 'Night', 'Flexible']]),
    columns: [['name', 'Name'], ['role', 'Role'], ['department', 'Department'], ['phone', 'Contact'], ['shift', 'Shift'], ['availability', 'Availability']],
    filters: [{ key: 'department', label: 'Department' }, { key: 'role', label: 'Role' }]
  },
  appointments: {
    title: 'Appointment management', subtitle: 'Schedule, update, and track patient appointments.', endpoint: '/api/appointments', module: 'appointments', singular: 'appointment',
    fields: fields(
      ['patientName', 'Patient', 'select', null, true, { endpoint: '/api/patients', value: 'name', label: (patient) => `${patient.name} · ${patient._id.slice(-5)}` }],
      ['doctorName', 'Doctor', 'select', null, true, { endpoint: '/api/staff', value: 'name', label: (doctor) => `${doctor.name} · ${doctor.department || doctor.role}`, filter: isBookableDoctor }],
      ['department', 'Department', 'select', null, false, { endpoint: '/api/staff', value: 'department', label: (doctor) => doctor.department, filter: (doctor) => isBookableDoctor(doctor) && Boolean(doctor.department) }],
      ['date', 'Date', 'date', null, true],
      ['time', 'Time', 'time', null, true],
      ['status', 'Status', 'select', ['Pending', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'], true]
    ),
    columns: [['date', 'Date'], ['time', 'Time'], ['patientName', 'Patient'], ['doctorName', 'Doctor'], ['department', 'Department'], ['status', 'Status']],
    filters: [{ key: 'status', label: 'Status' }]
  },
  emergency: {
    title: 'Emergency cases', subtitle: 'Track active cases and emergency response status.', endpoint: '/api/emergency-cases', module: 'emergency', singular: 'emergency case',
    defaults: { status: 'Active' },
    fields: fields(['caseId', 'Case ID', 'text', null, true], ['patientName', 'Patient', 'select', null, true, { endpoint: '/api/patients', value: 'name', label: (patient) => `${patient.name} · ${patient._id.slice(-5)}` }], ['roomNumber', 'Room number'], ['contactNumber', 'Contact number', 'tel'], ['emergencyType', 'Emergency type', 'text', null, true], ['conditionLevel', 'Condition', 'select', ['Critical', 'Serious', 'Stable'], true], ['status', 'Status', 'select', ['Active', 'Resolved']]),
    columns: [['caseId', 'Case ID'], ['patientName', 'Patient'], ['emergencyType', 'Type'], ['conditionLevel', 'Condition'], ['roomNumber', 'Room'], ['status', 'Status']],
    filters: [{ key: 'conditionLevel', label: 'Condition' }, { key: 'status', label: 'Status' }]
  },
  rooms: {
    title: 'Rooms & beds', subtitle: 'Monitor room availability and occupancy capacity.', endpoint: '/api/rooms', module: 'rooms', singular: 'room',
    filter: (row) => String(row.type).toLowerCase() !== 'icu',
    defaults: { status: 'Available', capacity: 1, type: 'General' },
    fields: fields(['roomNumber', 'Room number', 'text', null, true], ['type', 'Room / ward type', 'select', ['General', 'Private', 'Ward', 'Isolation'], true], ['status', 'Status', 'select', ['Available', 'Occupied', 'Reserved'], true], ['capacity', 'Bed capacity', 'number', null, true], ['assignedTo', 'Assigned patient', 'text']),
    columns: [['roomNumber', 'Room'], ['type', 'Ward'], ['capacity', 'Beds'], ['status', 'Status'], ['assignedTo', 'Assigned patient']],
    summary: (items) => [
      ['Total rooms', items.length],
      ['Available beds', items.filter((item) => item.status === 'Available').reduce((total, item) => total + Number(item.capacity || 1), 0)],
      ['Occupied rooms', items.filter((item) => item.status === 'Occupied').length]
    ]
  },
  icu: {
    title: 'ICU management', subtitle: 'Track intensive-care room capacity and occupancy.', endpoint: '/api/rooms', module: 'rooms', singular: 'ICU room',
    filter: (row) => String(row.type).toLowerCase() === 'icu',
    defaults: { status: 'Available', capacity: 1, type: 'ICU' },
    fields: fields(['roomNumber', 'ICU room number', 'text', null, true], ['status', 'Status', 'select', ['Available', 'Occupied', 'Reserved'], true], ['capacity', 'Bed capacity', 'number', null, true], ['assignedTo', 'Assigned patient', 'text']),
    columns: [['roomNumber', 'Room'], ['capacity', 'Beds'], ['status', 'Status'], ['assignedTo', 'Assigned patient']],
    summary: (items) => [
      ['ICU rooms', items.length],
      ['Available beds', items.filter((item) => item.status === 'Available').reduce((total, item) => total + Number(item.capacity || 1), 0)],
      ['Occupied rooms', items.filter((item) => item.status === 'Occupied').length]
    ]
  },
  pharmacy: {
    title: 'Pharmacy inventory', subtitle: 'Track medicine stock, suppliers, and expiry dates.', endpoint: '/api/medicines', module: 'pharmacy', singular: 'medicine',
    defaults: { reorderLevel: 10 },
    fields: fields(['name', 'Medicine', 'text', null, true], ['category', 'Category', 'text', null, true], ['supplier', 'Supplier'], ['stock', 'Quantity', 'number', null, true], ['price', 'Unit price', 'number', null, true], ['reorderLevel', 'Low-stock threshold', 'number'], ['expiryDate', 'Expiry date', 'date']),
    columns: [['name', 'Medicine'], ['category', 'Category'], ['supplier', 'Supplier'], ['stock', 'Stock'], ['price', 'Price'], ['expiryDate', 'Expiry']],
    summary: (items) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiringLimit = new Date(today);
      expiringLimit.setDate(expiringLimit.getDate() + 30);
      return [
        ['Total medicines', items.length],
        ['Low stock', items.filter((item) => Number(item.stock) <= Number(item.reorderLevel ?? 10)).length],
        ['Expiring within 30 days', items.filter((item) => {
          if (!item.expiryDate) return false;
          const date = new Date(`${item.expiryDate}T00:00:00`);
          return !Number.isNaN(date.getTime()) && date >= today && date <= expiringLimit;
        }).length]
      ];
    }
  },
  laboratory: {
    title: 'Laboratory', subtitle: 'Manage requests, sample collection, and test results.', endpoint: '/api/lab-tests', module: 'laboratory', singular: 'lab test',
    defaults: { sampleCollected: false, reportReady: false, status: 'Requested', priority: 'Normal' },
    fields: fields(['patientName', 'Patient', 'select', null, true, { endpoint: '/api/patients', value: 'name', label: (patient) => `${patient.name} · ${patient._id.slice(-5)}` }], ['patientId', 'Patient ID', 'text', null, false, null, true], ['testName', 'Test name', 'text', null, true], ['priority', 'Priority', 'select', ['Normal', 'Urgent', 'Critical']], ['status', 'Workflow status', 'select', ['Requested', 'In Progress', 'Completed', 'Cancelled']], ['notes', 'Notes', 'textarea'], ['sampleCollected', 'Sample collected', 'checkbox'], ['sampleType', 'Sample type'], ['collectionTime', 'Collection time', 'datetime-local'], ['collectorName', 'Collector name'], ['reportReady', 'Report ready', 'checkbox'], ['resultStatus', 'Result status', 'select', ['', 'Normal', 'Abnormal', 'Critical']], ['verifiedBy', 'Verified by'], ['findings', 'Findings', 'textarea']),
    columns: [['patientName', 'Patient'], ['testName', 'Test'], ['priority', 'Priority'], ['status', 'Status'], ['sampleCollected', 'Sample'], ['reportReady', 'Report']],
    summary: (items) => [
      ['Total tests', items.length],
      ['Pending samples', items.filter((item) => !item.sampleCollected && !/^(cancelled|completed)$/i.test(item.status || '')).length],
      ['Reports ready', items.filter((item) => item.reportReady).length]
    ]
  },
  billing: {
    title: 'Billing & payments', subtitle: 'Generate invoices and track recorded payments.', endpoint: '/api/bills', module: 'billing', singular: 'bill',
    fields: fields(['patientName', 'Patient', 'select', null, true, { endpoint: '/api/patients', value: 'name', label: (patient) => `${patient.name} · ${patient._id.slice(-5)}` }], ['contact', 'Contact', 'tel'], ['email', 'Email', 'email'], ['invoiceNumber', 'Invoice number', 'text', null, true], ['consultationCharges', 'Consultation charges', 'number'], ['medicineCharges', 'Medicine charges', 'number'], ['laboratoryCharges', 'Laboratory charges', 'number'], ['otherCharges', 'Other charges', 'number'], ['paidAmount', 'Amount paid', 'number'], ['paymentMethod', 'Payment method', 'select', ['', 'Cash', 'Card', 'Bank transfer', 'Online']], ['paymentDate', 'Payment date', 'date'], ['dueDate', 'Due date', 'date'], ['status', 'Payment status', 'select', ['Pending', 'Paid', 'Failed']]),
    columns: [['invoiceNumber', 'Invoice'], ['patientName', 'Patient'], ['amount', 'Total'], ['paidAmount', 'Paid'], ['paymentMethod', 'Method'], ['status', 'Status'], ['dueDate', 'Due']],
    summary: (items) => [
      ['Total invoices', items.length],
      ['Pending', items.filter((item) => item.status !== 'Paid').length],
      ['Recorded payments', money(items.reduce((total, item) => total + Number(item.paidAmount || 0), 0))]
    ]
  },
  users: {
    title: 'User management', subtitle: 'Create accounts and assign approved module roles.', endpoint: '/api/users', module: 'userManagement', singular: 'user',
    defaults: { role: 'Receptionist', status: 'Active' },
    fields: fields(['username', 'Username', 'text', null, true], ['name', 'Full name', 'text', null, true], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['address', 'Address', 'text'], ['role', 'Role', 'select', ['Administrator', 'Doctor', 'Receptionist', 'Nurse', 'Pharmacy Staff', 'Lab Staff'], true], ['department', 'Department'], ['employeeId', 'Employee ID'], ['status', 'Account status', 'select', ['Active', 'Inactive'], true], ['password', 'Temporary password', 'password', null, true]),
    columns: [['username', 'Username'], ['name', 'Name'], ['role', 'Role'], ['email', 'Email'], ['status', 'Status']],
    summary: (items) => [
      ['Total accounts', items.length],
      ['Active', items.filter((item) => item.status !== 'Inactive').length],
      ['Inactive', items.filter((item) => item.status === 'Inactive').length]
    ]
  }
};

function displayValue(value, field) {
  if (field === 'sampleCollected' || field === 'reportReady') return value ? 'Yes' : 'No';
  if (field === 'amount' || field === 'paidAmount' || field === 'price') return value === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

export default function ResourcePage({ config }) {
  const { user } = useAuth();
  const can = (action) => canAccessRole(user?.role, config.module, action);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({});
  const [lookupData, setLookupData] = useState({});
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterValues, setFilterValues] = useState({});
  const [appointmentDate, setAppointmentDate] = useState('');
  const [calendarMode, setCalendarMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setLookupError('');
    try {
      const lookupEndpoints = [...new Set(config.fields.map((field) => field.source?.endpoint).filter(Boolean))]
        .filter((endpoint) => canAccessRole(user?.role, endpoint === '/api/staff' ? 'doctors' : 'patients', 'read'));
      const results = await api(config.endpoint);
      if (!Array.isArray(results)) throw new Error(`The server returned invalid ${config.singular} records.`);
      const auxiliaryResults = await Promise.allSettled([
        ...(config.relatedEndpoint ? [api(config.relatedEndpoint)] : []),
        ...lookupEndpoints.map((endpoint) => api(endpoint))
      ]);
      let relatedRows = [];
      let lookupOffset = 0;
      const auxiliaryErrors = [];
      if (config.relatedEndpoint) {
        const relatedResult = auxiliaryResults[0];
        if (relatedResult.status === 'fulfilled' && Array.isArray(relatedResult.value)) {
          relatedRows = relatedResult.value;
        } else {
          auxiliaryErrors.push(relatedResult.status === 'rejected' ? relatedResult.reason.message : 'The server returned invalid related records.');
        }
        lookupOffset = 1;
      }
      const lookupDataEntries = lookupEndpoints.map((endpoint, index) => {
        const result = auxiliaryResults[index + lookupOffset];
        if (result.status === 'rejected') {
          auxiliaryErrors.push(result.reason.message);
          return [endpoint, []];
        }
        if (!Array.isArray(result.value)) {
          auxiliaryErrors.push(`The server returned invalid linked records for ${endpoint}.`);
          return [endpoint, []];
        }
        return [endpoint, result.value];
      });
      const records = results;
      if (config.endpoint === '/api/staff' && config.relatedEndpoint) {
        const appointmentCounts = relatedRows.reduce((counts, appointment) => {
          counts.set(appointment.doctorName, (counts.get(appointment.doctorName) || 0) + 1);
          return counts;
        }, new Map());
        setRows(records.map((record) => ({ ...record, appointmentCount: config.relatedEndpoint && !auxiliaryErrors.length ? appointmentCounts.get(record.name) || 0 : undefined })));
      } else {
        setRows(records);
      }
      setLookupData(Object.fromEntries(lookupDataEntries));
      if (auxiliaryErrors.length) setLookupError(`Some linked data could not be loaded: ${[...new Set(auxiliaryErrors)].join(' ')}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [config, user?.role]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const data = config.filter ? rows.filter(config.filter) : rows;
    const normalized = query.trim().toLowerCase();
    return data.filter((row) => {
      if (normalized && !Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(normalized))) return false;
      return (config.filters || []).every(({ key }) => !filterValues[key] || String(row[key] || '') === filterValues[key]);
    });
  }, [rows, query, config.filter, config.filters, filterValues]);
  const listRows = config.endpoint === '/api/appointments' && appointmentDate
    ? filteredRows.filter((row) => row.date === appointmentDate)
    : filteredRows;
  const pageCount = Math.max(1, Math.ceil(listRows.length / pageSize));
  const visibleRows = listRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showActions = can('update') || can('delete') || ['/api/patients', '/api/appointments', '/api/lab-tests', '/api/bills'].includes(config.endpoint);
  const activeAdministratorCount = config.endpoint === '/api/users'
    ? rows.filter((row) => normalizeRole(row.role) === 'administrator' && (!row.status || /^active$/i.test(row.status))).length
    : 0;
  const isLastActiveAdministrator = (row) => normalizeRole(row.role) === 'administrator'
    && (!row.status || /^active$/i.test(row.status))
    && activeAdministratorCount <= 1;
  const isEditingProtectedUser = config.endpoint === '/api/users' && editing
    && (editing.username === user?.username || isLastActiveAdministrator(editing));
  const canDeleteRow = (row) => can('delete')
    && !(config.endpoint === '/api/users' && (row.username === user?.username || isLastActiveAdministrator(row)));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterValues, appointmentDate]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...(config.defaults || {}),
      ...(config.endpoint === '/api/bills' ? { invoiceNumber: `INV-${Date.now()}` } : {})
    });
    setError('');
    setDialogOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ ...row });
    setError('');
    setDialogOpen(true);
  }

  function updateField(name, value, type) {
    setForm((current) => ({ ...current, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value }));
  }

  function updateSelectField(field, value) {
    updateField(field.name, value, field.type);
    if (!field.source) return;
    const option = (lookupData[field.source.endpoint] || []).find((item) => String(item[field.source.value || 'name']) === value);
    if (!option) return;
    setForm((current) => {
      const next = { ...current, [field.name]: value };
      if (config.endpoint === '/api/appointments' && field.name === 'doctorName') {
        next.department = option.department || current.department || '';
      }
      if (config.endpoint === '/api/lab-tests' && field.name === 'patientName') {
        next.patientId = option._id || '';
      }
      if (config.endpoint === '/api/bills' && field.name === 'patientName') {
        next.contact = option.phone || '';
        next.email = option.email || '';
      }
      if (config.endpoint === '/api/emergency-cases' && field.name === 'patientName') {
        next.contactNumber = option.phone || current.contactNumber || '';
      }
      return next;
    });
  }

  function fieldOptions(field) {
    if (!field.source) return (field.options || []).map((value) => ({ value, label: value || 'Not specified' }));
    const options = (lookupData[field.source.endpoint] || [])
      .filter((item) => !field.source.filter || field.source.filter(item))
      .map((item) => ({
        value: String(item[field.source.value || 'name'] || ''),
        label: field.source.label ? field.source.label(item) : String(item[field.source.value || 'name'] || '')
      }))
      .filter((option) => option.value);
    return [...new Map(options.map((option) => [option.value, option])).values()];
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      delete payload._id;
      delete payload.__v;
      if (config.endpoint === '/api/bills') {
        const chargeKeys = ['consultationCharges', 'medicineCharges', 'laboratoryCharges', 'otherCharges'];
        const itemizedAmount = chargeKeys.reduce((sum, key) => sum + Number(payload[key] || 0), 0);
        payload.amount = itemizedAmount || editing?.amount || 0;
        if (Number(payload.paidAmount || 0) > payload.amount) {
          throw new Error('Amount paid cannot exceed the invoice total.');
        }
        if (!editing) payload.invoiceNumber = payload.invoiceNumber || `INV-${Date.now()}`;
      }
      if (config.endpoint === '/api/users' && editing && !payload.password) delete payload.password;
      const url = editing ? `${config.endpoint}/${encodeURIComponent(editing._id)}` : config.endpoint;
      await api(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setDialogOpen(false);
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${editing ? 'updated' : 'created'} successfully.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete this ${config.singular}? This action cannot be undone.`)) return;
    setError('');
    try {
      await api(`${config.endpoint}/${encodeURIComponent(row._id)}`, { method: 'DELETE' });
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} deleted.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">OPERATIONS</span><h1>{config.title}</h1><p>{config.subtitle}</p></div>{can('create') && <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} />Add {config.singular}</button>}</div>
      {notice && <div className="notice success" role="status">{notice}<button className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
      {error && !dialogOpen && <div className="notice error" role="alert">{error}<button className="notice-dismiss" onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {lookupError && !dialogOpen && <div className="notice error" role="alert">{lookupError}</div>}
      {config.summary && !loading && !error && <section className="summary-grid">{config.summary(config.filter ? rows.filter(config.filter) : rows).map(([label, value]) => <article className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>}
      <section className="table-panel">
        <div className="toolbar">
          <label className="search-box"><Search size={16} /><input className="search-field" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.singular}s…`} /></label>
          {(config.filters || []).map(({ key, label }) => <select className="filter-field" key={key} aria-label={`Filter by ${label}`} value={filterValues[key] || ''} onChange={(event) => setFilterValues((current) => ({ ...current, [key]: event.target.value }))}><option value="">All {label.toLowerCase()}s</option>{[...new Set(rows.map((row) => row[key]).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select>)}
          {config.endpoint === '/api/appointments' && <>
            {!calendarMode && <label className="appointment-date-filter"><span className="sr-only">Filter appointments by date</span><input className="filter-field" type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /></label>}
            <div className="view-toggle"><button type="button" className={!calendarMode ? 'active' : ''} onClick={() => setCalendarMode(false)}>List</button><button type="button" className={calendarMode ? 'active' : ''} onClick={() => setCalendarMode(true)}>Calendar</button></div>
          </>}
          <span className="record-count">{config.endpoint === '/api/appointments' && !calendarMode ? listRows.length : filteredRows.length} records</span>
        </div>
        {loading ? <div className="loading-state">Loading records…</div> : calendarMode && config.endpoint === '/api/appointments'
          ? <AppointmentCalendar appointments={filteredRows} month={calendarMonth} onMonthChange={setCalendarMonth} onSelect={can('update') ? openEdit : setViewing} />
          : (
          <div className="table-wrap"><table className="data-table"><thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}{showActions && <th>Actions</th>}</tr></thead><tbody>
            {!visibleRows.length ? <tr><td className="empty-row" colSpan={config.columns.length + Number(showActions)}>{error ? 'Records could not be loaded.' : query || appointmentDate || Object.values(filterValues).some(Boolean) ? 'No records match the current filters.' : `No ${config.singular} records yet.`}</td></tr> : visibleRows.map((row) => <tr key={row._id}>{config.columns.map(([key]) => <td key={key}>{displayValue(row[key], key)}</td>)}{showActions && <td><div className="row-actions">{['/api/patients', '/api/appointments', '/api/lab-tests'].includes(config.endpoint) && <button className="small-button" type="button" onClick={() => setViewing(row)}><Eye size={13} />View</button>}{config.endpoint === '/api/bills' && <button className="small-button" type="button" onClick={() => setViewing(row)}><Printer size={13} />Invoice</button>}{can('update') && <button className="small-button" type="button" onClick={() => openEdit(row)}>Edit</button>}{canDeleteRow(row) && <button className="danger-button small-danger" type="button" onClick={() => remove(row)}>Delete</button>}</div></td>}</tr>)}
          </tbody></table></div>
        )}
        {!calendarMode && listRows.length > pageSize && <div className="pagination"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, listRows.length)} of {listRows.length}</span><div><button className="small-button" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>Previous</button><span>{currentPage} / {pageCount}</span><button className="small-button" type="button" disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => page + 1)}>Next</button></div></div>}
      </section>
      {viewing && config.endpoint === '/api/patients' && <Modal title={viewing.name || 'Patient profile'} description="Patient profile and clinical details." onClose={() => setViewing(null)} wide>
        <dl className="detail-grid">{config.fields.filter((field) => field.type !== 'checkbox').map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{displayValue(viewing[field.name], field.name)}</dd></div>)}</dl>
      </Modal>}
      {viewing && ['/api/appointments', '/api/lab-tests'].includes(config.endpoint) && <Modal title={config.endpoint === '/api/appointments' ? 'Appointment details' : 'Laboratory record'} description="Saved record details." onClose={() => setViewing(null)} wide>
        <dl className="detail-grid">{config.fields.filter((field) => field.type !== 'checkbox').map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{displayValue(viewing[field.name], field.name)}</dd></div>)}</dl>
      </Modal>}
      {viewing && config.endpoint === '/api/bills' && <Modal title={`Invoice ${viewing.invoiceNumber}`} description="Recorded billing information." onClose={() => setViewing(null)}>
        <div className="invoice-preview">
          <div className="invoice-brand"><strong>MediCare</strong><span>Hospital invoice</span></div>
          <div className="invoice-line"><span>Patient</span><strong>{viewing.patientName}</strong></div>
          <div className="invoice-line"><span>Invoice</span><strong>{viewing.invoiceNumber}</strong></div>
          <div className="invoice-line"><span>Consultation</span><strong>{displayValue(viewing.consultationCharges, 'amount')}</strong></div>
          <div className="invoice-line"><span>Medicines</span><strong>{displayValue(viewing.medicineCharges, 'amount')}</strong></div>
          <div className="invoice-line"><span>Laboratory</span><strong>{displayValue(viewing.laboratoryCharges, 'amount')}</strong></div>
          <div className="invoice-line"><span>Other charges</span><strong>{displayValue(viewing.otherCharges, 'amount')}</strong></div>
          <div className="invoice-line invoice-total"><span>Total</span><strong>{displayValue(viewing.amount, 'amount')}</strong></div>
          <div className="invoice-line"><span>Payment status</span><strong>{viewing.status}</strong></div>
        </div>
        <div className="form-actions"><button className="primary-button" type="button" onClick={() => window.print()}><Printer size={15} />Print invoice</button></div>
      </Modal>}
      {dialogOpen && <Modal title={`${editing ? 'Edit' : 'Add'} ${config.singular}`} description="Changes are saved to the hospital database." onClose={() => setDialogOpen(false)} wide>
        <form className="form-grid" onSubmit={submit}>
          {config.fields.map((field) => <label key={field.name} className={`form-field ${field.type === 'textarea' ? 'full' : ''}`}>
            <span>{field.label}</span>
            {field.type === 'select' ? <select className="form-control" value={form[field.name] ?? ''} required={field.required} disabled={isEditingProtectedUser && ['role', 'status'].includes(field.name)} onChange={(event) => updateSelectField(field, event.target.value)}><option value="">Select {field.label.toLowerCase()}</option>{fieldOptions(field).map((option) => <option key={option.value || 'empty'} value={option.value}>{option.label}</option>)}{form[field.name] && !fieldOptions(field).some((option) => option.value === form[field.name]) && <option value={form[field.name]}>{form[field.name]} (existing)</option>}</select>
              : field.type === 'textarea' ? <textarea className="form-control" rows="3" value={form[field.name] ?? ''} required={field.required} onChange={(event) => updateField(field.name, event.target.value, field.type)} />
                : field.type === 'checkbox' ? <input type="checkbox" checked={Boolean(form[field.name])} onChange={(event) => updateField(field.name, event.target.checked, field.type)} />
                  : <input className="form-control" type={field.type} min={field.type === 'number' ? '0' : undefined} minLength={field.type === 'password' ? 12 : undefined} autoComplete={field.type === 'password' ? 'new-password' : undefined} step={field.name.toLowerCase().includes('price') || field.name.toLowerCase().includes('charge') || field.name === 'paidAmount' ? '0.01' : undefined} value={form[field.name] ?? ''} required={field.required && !(field.type === 'password' && editing)} readOnly={field.readOnly || (field.name === 'invoiceNumber' && Boolean(editing)) || (field.name === 'username' && Boolean(editing))} disabled={config.endpoint === '/api/users' && editing?.username === user?.username && field.name === 'password'} onChange={(event) => updateField(field.name, event.target.value, field.type)} />}
          </label>)}
          {lookupError && <div className="notice error full" role="alert">{lookupError}</div>}
          {config.endpoint === '/api/bills' && <div className="form-total full">Invoice total <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(['consultationCharges', 'medicineCharges', 'laboratoryCharges', 'otherCharges'].reduce((sum, key) => sum + Number(form[key] || 0), 0))}</strong></div>}
          {error && <div className="notice error full" role="alert">{error}</div>}
          <div className="form-actions full"><button type="button" className="secondary-button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : `Create ${config.singular}`}</button></div>
        </form>
      </Modal>}
    </>
  );
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { promisify } = require('util');

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital';
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production');
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const scrypt = promisify(crypto.scrypt);
const sessionDurationSeconds = 60 * 60 * 8;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(projectRoot, 'frontend', 'public', 'assets'), { dotfiles: 'deny', index: false }));

const {
  User,
  Patient,
  Appointment,
  Bill,
  Medicine,
  LabTest,
  Room,
  Staff,
  EmergencyCase
} = require('./models');

async function connectDatabase() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

async function seedDemoData() {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    if (!process.env.ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_PASSWORD before initializing the first administrator account');
    }
    await User.create({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: await hashPassword(process.env.ADMIN_PASSWORD),
      role: 'Administrator',
      name: 'Hospital Admin',
      email: 'admin@hospital.com',
      phone: '+91 9876543210',
      address: '19, Panchvati Park, Ten Road, Bardoli',
      department: 'Management',
      employeeId: 'D01',
      status: 'Active',
      joinedAt: 'Jan 2024',
      preferences: { twoFactor: false, emailNotifications: true, darkMode: false },
      photo: ''
    });
  }

  if (process.env.SEED_DEMO_DATA !== 'true') return;

  const patientCount = await Patient.countDocuments();
  if (patientCount === 0) {
    await Patient.create([
      { name: 'Amina Khan', age: 32, gender: 'Female', phone: '0712345678', bloodGroup: 'O+', address: 'Galle', condition: 'Cardiology', status: 'Admitted' },
      { name: 'Nuwan Fernando', age: 45, gender: 'Male', phone: '0712345679', bloodGroup: 'A+', address: 'Colombo', condition: 'Orthopedic', status: 'Under Observation' },
      { name: 'Sajini Perera', age: 28, gender: 'Female', phone: '0712345680', bloodGroup: 'B+', address: 'Kandy', condition: 'Pediatrics', status: 'Recovered' }
    ]);
  }

  const appointmentCount = await Appointment.countDocuments();
  if (appointmentCount === 0) {
    await Appointment.create([
      { patientName: 'Amina Khan', doctorName: 'Dr. Silva', date: '2026-06-26', time: '09:00', department: 'Cardiology', status: 'Scheduled' },
      { patientName: 'Nuwan Fernando', doctorName: 'Dr. Perera', date: '2026-06-26', time: '11:30', department: 'Orthopedic', status: 'Confirmed' }
    ]);
  }

  const billCount = await Bill.countDocuments();
  if (billCount === 0) {
    await Bill.create([
      { patientName: 'Amina Khan', invoiceNumber: 'INV-1001', amount: 12500, paidAmount: 7000, status: 'Pending', dueDate: '2026-06-30' },
      { patientName: 'Nuwan Fernando', invoiceNumber: 'INV-1002', amount: 8400, paidAmount: 8400, status: 'Paid', dueDate: '2026-06-20' }
    ]);
  }

  const medicineCount = await Medicine.countDocuments();
  if (medicineCount === 0) {
    await Medicine.create([
      { name: 'Paracetamol', category: 'Analgesic', stock: 8, price: 120, reorderLevel: 10 },
      { name: 'Amoxicillin', category: 'Antibiotic', stock: 25, price: 340, reorderLevel: 12 },
      { name: 'Insulin', category: 'Endocrine', stock: 5, price: 980, reorderLevel: 8 }
    ]);
  }

  const labTestCount = await LabTest.countDocuments();
  if (labTestCount === 0) {
    await LabTest.create([
      { patientName: 'Amina Khan', testName: 'CBC', sampleCollected: true, reportReady: false, status: 'In Progress' },
      { patientName: 'Sajini Perera', testName: 'Lipid Profile', sampleCollected: false, reportReady: false, status: 'Requested' }
    ]);
  }

  const roomCount = await Room.countDocuments();
  if (roomCount === 0) {
    await Room.create([
      { roomNumber: '101', type: 'General', status: 'Available', capacity: 2, assignedTo: '' },
      { roomNumber: 'ICU-1', type: 'ICU', status: 'Occupied', capacity: 1, assignedTo: 'Amina Khan' }
    ]);
  }

  const staffCount = await Staff.countDocuments();
  if (staffCount === 0) {
    await Staff.create([
      { name: 'Dr. Ashan Silva', role: 'Consultant', department: 'Cardiology', phone: '0710000001', email: 'ashan@hospital.com', shift: 'Morning' },
      { name: 'Nimali Jayasuriya', role: 'Nurse', department: 'ICU', phone: '0710000002', email: 'nimali@hospital.com', shift: 'Night' }
    ]);
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Hospital API is running' });
});

function signSession(username, role) {
  const payload = Buffer.from(JSON.stringify({
    username,
    role,
    expiresAt: Date.now() + sessionDurationSeconds * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(token) {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof session.username !== 'string' || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function getSessionToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('hospital_session='));
  return cookie ? cookie.slice('hospital_session='.length) : null;
}

function requireAuthentication(req, res, next) {
  const session = readSession(getSessionToken(req));
  if (!session) {
    return res.status(401).json({ message: 'Please sign in to continue' });
  }
  req.auth = session;
  next();
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hospital_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hospital_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  const [algorithm, salt, storedHash] = String(storedPassword).split('$');
  if (algorithm !== 'scrypt' || !salt || !storedHash) {
    return { valid: password === storedPassword, needsUpgrade: password === storedPassword };
  }

  const actualHash = await scrypt(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, 'hex');
  const valid = actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
  return { valid, needsUpgrade: false };
}

function validAppointmentDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validAppointmentTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

app.get('/api/dashboard/stats', requireAuthentication, async (req, res) => {
  try {
    const [patients, appointments, bills, medicines, labTests, rooms] = await Promise.all([
      Patient.countDocuments(),
      Appointment.countDocuments(),
      Bill.find(),
      Medicine.find(),
      LabTest.find(),
      Room.find()
    ]);

    const pendingBills = bills.filter((bill) => bill.status !== 'Paid').length;
    const lowStock = medicines.filter((medicine) => medicine.stock <= medicine.reorderLevel).length;
    const availableRooms = rooms.filter((room) => room.status === 'Available').length;

    res.json({
      patients,
      appointments,
      pendingBills,
      lowStock,
      labTests: labTests.length,
      availableRooms
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const verification = await verifyPassword(password, user.password);
    if (!verification.valid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    if (verification.needsUpgrade) {
      user.password = await hashPassword(password);
      await user.save();
    }

    setSessionCookie(res, signSession(user.username, user.role));
    res.json({
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      address: user.address,
      department: user.department,
      employeeId: user.employeeId,
      status: user.status,
      joinedAt: user.joinedAt,
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Signed out successfully' });
});

app.use('/api', requireAuthentication);

app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.auth.username })
      .select('username name role email phone address department employeeId status joinedAt preferences photo')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load the current user' });
  }
});

app.get('/api/dashboard/overview', async (req, res) => {
  try {
    const [patients, appointments, bills, rooms, labTests, staff, emergencyCases] = await Promise.all([
      Patient.find().sort({ createdAt: -1 }).lean(),
      Appointment.find().sort({ date: 1, time: 1 }).lean(),
      Bill.find().sort({ createdAt: -1 }).lean(),
      Room.find().lean(),
      LabTest.find().lean(),
      Staff.find().sort({ createdAt: -1 }).lean(),
      EmergencyCase.find().sort({ createdAt: -1 }).lean()
    ]);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const doctorRecords = staff.filter((member) => /doctor|consultant|physician/i.test(member.role || ''));
    const pendingAppointments = appointments.filter((appointment) => /^(pending|scheduled)$/i.test(appointment.status || ''));
    const months = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
      return {
        key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        label: month.toLocaleString('en', { month: 'short' }),
        patientAdmissions: 0,
        paidAmount: 0
      };
    });
    const monthIndex = new Map(months.map((month, index) => [month.key, index]));

    patients.forEach((patient) => {
      const createdAt = patient.createdAt && new Date(patient.createdAt);
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      const index = monthIndex.get(key);
      if (index !== undefined) months[index].patientAdmissions += 1;
    });

    bills.forEach((bill) => {
      if (!bill.paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(bill.paymentDate)) return;
      const key = bill.paymentDate.slice(0, 7);
      const index = monthIndex.get(key);
      if (index !== undefined) months[index].paidAmount += Number(bill.paidAmount || 0);
    });

    const departmentTotals = new Map();
    patients.forEach((patient) => {
      const department = patient.condition || 'Unspecified';
      departmentTotals.set(department, (departmentTotals.get(department) || 0) + 1);
    });

    const appointmentStatuses = new Map();
    appointments.forEach((appointment) => {
      const status = appointment.status || 'Unspecified';
      appointmentStatuses.set(status, (appointmentStatuses.get(status) || 0) + 1);
    });

    const availableBeds = rooms.reduce((total, room) => (
      room.status === 'Available' ? total + Number(room.capacity || 1) : total
    ), 0);
    const paidTotal = bills.reduce((total, bill) => total + Number(bill.paidAmount || 0), 0);
    const todaysRevenue = bills.reduce((total, bill) => (
      bill.paymentDate === todayKey ? total + Number(bill.paidAmount || 0) : total
    ), 0);

    res.json({
      stats: {
        patients: patients.length,
        doctors: doctorRecords.length,
        appointments: appointments.length,
        availableBeds,
        staff: staff.length,
        todaysRevenue,
        pendingAppointments: pendingAppointments.length,
        emergencyCases: emergencyCases.filter((item) => item.status === 'Active').length,
        paidTotal
      },
      recentPatients: patients.slice(0, 5),
      todaysAppointments: appointments.filter((appointment) => appointment.date === todayKey).slice(0, 6),
      recentTransactions: bills.slice(0, 5),
      recentEmergencyCases: emergencyCases.filter((item) => item.status === 'Active').slice(0, 5),
      doctors: doctorRecords.slice(0, 5).map((doctor) => ({
        name: doctor.name,
        department: doctor.department || 'Department not set',
        availability: doctor.availability || 'Not set',
        shift: doctor.shift || 'Shift not set'
      })),
      charts: {
        months: months.map(({ label }) => label),
        patientAdmissions: months.map(({ patientAdmissions }) => patientAdmissions),
        paidAmountsByBillMonth: months.map(({ paidAmount }) => paidAmount),
        departments: Array.from(departmentTotals, ([label, value]) => ({ label, value })),
        appointmentStatuses: Array.from(appointmentStatuses, ([label, value]) => ({ label, value })),
        beds: ['Available', 'Occupied', 'Reserved'].map((status) => ({
          label: status,
          value: rooms.filter((room) => room.status === status)
            .reduce((total, room) => total + Number(room.capacity || 1), 0)
        })),
        labStatuses: Array.from(labTests.reduce((counts, test) => {
          const status = test.status || 'Unspecified';
          counts.set(status, (counts.get(status) || 0) + 1);
          return counts;
        }, new Map()), ([label, value]) => ({ label, value }))
      }
    });
  } catch (error) {
    console.error('Unable to load dashboard overview:', error.message);
    res.status(500).json({ message: 'Unable to load dashboard data' });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const now = new Date();
    const defaultTo = now.toISOString().slice(0, 10);
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);
    const from = req.query.from || defaultFrom;
    const to = req.query.to || defaultTo;
    if (!validAppointmentDate(from) || !validAppointmentDate(to) || from > to) {
      return res.status(400).json({ message: 'Provide a valid date range with the start date on or before the end date' });
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const monthSpan = (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12
      + toDate.getUTCMonth() - fromDate.getUTCMonth() + 1;
    if (monthSpan > 60) {
      return res.status(400).json({ message: 'Report date ranges are limited to 60 months' });
    }
    const [patientsByMonth, patientsByDepartment, billsByMonth, paymentsByMonth, appointmentsByMonth, appointmentStatuses, doctorPerformance] = await Promise.all([
      Patient.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
      ]),
      Patient.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: { $ifNull: ['$condition', 'Unspecified'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Bill.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } },
          bills: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$amount', 0] } }
        } }
      ]),
      Bill.aggregate([
        { $match: { paymentDate: { $gte: from, $lte: to } } },
        { $group: {
          _id: { $substrBytes: ['$paymentDate', 0, 7] },
          paidAmount: { $sum: { $ifNull: ['$paidAmount', 0] } }
        } }
      ]),
      Appointment.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        { $group: { _id: { $substrBytes: ['$date', 0, 7] }, count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        { $group: { _id: { $ifNull: ['$status', 'Unspecified'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Appointment.aggregate([
        { $match: { date: { $gte: from, $lte: to } } },
        { $group: { _id: { $ifNull: ['$doctorName', 'Unassigned'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const months = [];
    const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));
    while (cursor <= lastMonth && months.length < 60) {
      const key = cursor.toISOString().slice(0, 7);
      months.push({
        key,
        label: cursor.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) + ` ${cursor.getUTCFullYear()}`,
        patients: 0,
        appointments: 0,
        bills: 0,
        billedAmount: 0,
        paidAmount: 0
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const monthIndex = new Map(months.map((month) => [month.key, month]));
    patientsByMonth.forEach((item) => {
      const month = monthIndex.get(item._id);
      if (month) month.patients = item.count;
    });
    appointmentsByMonth.forEach((item) => {
      const month = monthIndex.get(item._id);
      if (month) month.appointments = item.count;
    });
    billsByMonth.forEach((item) => {
      const month = monthIndex.get(item._id);
      if (month) {
        month.bills = item.bills;
        month.billedAmount = item.amount;
      }
    });
    paymentsByMonth.forEach((item) => {
      const month = monthIndex.get(item._id);
      if (month) month.paidAmount = item.paidAmount;
    });

    res.json({
      range: { from, to },
      totals: {
        patients: patientsByMonth.reduce((total, item) => total + item.count, 0),
        appointments: appointmentsByMonth.reduce((total, item) => total + item.count, 0),
        bills: billsByMonth.reduce((total, item) => total + item.bills, 0),
        billedAmount: billsByMonth.reduce((total, item) => total + item.amount, 0),
        paidAmount: paymentsByMonth.reduce((total, item) => total + item.paidAmount, 0)
      },
      months,
      patientsByDepartment: patientsByDepartment.map((item) => ({ label: item._id, value: item.count })),
      appointmentStatuses: appointmentStatuses.map((item) => ({ label: item._id, value: item.count })),
      doctorPerformance: doctorPerformance.map((item) => ({ name: item._id, appointments: item.count }))
    });
  } catch (error) {
    console.error('Unable to build reports:', error.message);
    res.status(500).json({ message: 'Unable to build reports for this date range' });
  }
});

function buildCrudRoutes(model, entityName, routeName) {
  app.get(`/api/${routeName}`, async (req, res) => {
    try {
      const docs = await model.find().sort({ createdAt: -1 });
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`/api/${routeName}`, async (req, res) => {
    try {
      if (model === Appointment) {
        const { patientName, doctorName, date, time, status } = req.body;
        if (!patientName || !doctorName || !validAppointmentDate(date) || !validAppointmentTime(time)) {
          return res.status(400).json({ message: 'Patient, doctor, date, and time are required in a valid format' });
        }
        if (status && !/^(pending|scheduled|confirmed|completed|cancelled)$/i.test(status)) {
          return res.status(400).json({ message: 'Unsupported appointment status' });
        }
        const conflict = /^(cancelled|completed)$/i.test(status || '')
          ? null
          : await Appointment.exists({
            doctorName,
            date,
            time,
            status: { $nin: ['Cancelled', 'Canceled', 'cancelled', 'canceled', 'Completed', 'completed'] }
          });
        if (conflict) return res.status(409).json({ message: 'This doctor already has an appointment at that time' });
      }
      const doc = new model(req.body);
      await doc.save();
      res.status(201).json(doc);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put(`/api/${routeName}/:id`, async (req, res) => {
    try {
      if (model === Appointment) {
        const current = await Appointment.findById(req.params.id);
        if (!current) return res.status(404).json({ message: `${entityName} not found` });
        const updated = { ...current.toObject(), ...req.body };
        if (!updated.patientName || !updated.doctorName || !validAppointmentDate(updated.date) || !validAppointmentTime(updated.time)) {
          return res.status(400).json({ message: 'Patient, doctor, date, and time are required in a valid format' });
        }
        if (updated.status && !/^(pending|scheduled|confirmed|completed|cancelled)$/i.test(updated.status)) {
          return res.status(400).json({ message: 'Unsupported appointment status' });
        }
        const conflict = /^(cancelled|completed)$/i.test(updated.status || '')
          ? null
          : await Appointment.exists({
            _id: { $ne: current._id },
            doctorName: updated.doctorName,
            date: updated.date,
            time: updated.time,
            status: { $nin: ['Cancelled', 'Canceled', 'cancelled', 'canceled', 'Completed', 'completed'] }
          });
        if (conflict) return res.status(409).json({ message: 'This doctor already has an appointment at that time' });
      }
      const doc = await model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!doc) return res.status(404).json({ message: `${entityName} not found` });
      res.json(doc);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete(`/api/${routeName}/:id`, async (req, res) => {
    try {
      if (model === Staff) {
        const member = await Staff.findById(req.params.id);
        if (!member) return res.status(404).json({ message: `${entityName} not found` });
        if (/doctor|consultant|physician/i.test(member.role || '')) {
          const assignedAppointments = await Appointment.countDocuments({ doctorName: member.name });
          if (assignedAppointments) {
            return res.status(409).json({ message: 'This doctor has appointment records. Reassign or remove those appointments before deleting the doctor.' });
          }
        }
      }
      const doc = await model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ message: `${entityName} not found` });
      res.json({ message: `${entityName} deleted successfully` });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
}

buildCrudRoutes(Patient, 'Patient', 'patients');
buildCrudRoutes(Appointment, 'Appointment', 'appointments');
buildCrudRoutes(Bill, 'Bill', 'bills');
buildCrudRoutes(Medicine, 'Medicine', 'medicines');
buildCrudRoutes(LabTest, 'Lab Test', 'lab-tests');
buildCrudRoutes(Room, 'Room', 'rooms');
buildCrudRoutes(Staff, 'Staff', 'staff');
buildCrudRoutes(EmergencyCase, 'Emergency case', 'emergency-cases');

app.get('/api/profile/:username', async (req, res) => {
  try {
    if (req.params.username !== req.auth.username) {
      return res.status(403).json({ message: 'You can only view your own profile' });
    }
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      address: user.address,
      department: user.department,
      employeeId: user.employeeId,
      status: user.status,
      joinedAt: user.joinedAt,
      preferences: user.preferences,
      photo: user.photo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/profile/:username', async (req, res) => {
  try {
    if (req.params.username !== req.auth.username) {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      {
        $set: {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          address: req.body.address,
          department: req.body.department,
          preferences: req.body.preferences,
          photo: req.body.photo
        }
      },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      address: user.address,
      department: user.department,
      employeeId: user.employeeId,
      status: user.status,
      joinedAt: user.joinedAt,
      preferences: user.preferences,
      photo: user.photo
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const pageRoutes = new Set([
  'appointment details.html',
  'billing.html',
  'dashboard.html',
  'doctor details.html',
  'emergancy case.html',
  'ICU details.html',
  'laboratory.html',
  'login page.html',
  'patient details.html',
  'pharmacy.html',
  'report details.html',
  'room details.html',
  'settings.html',
  'staff details.html'
]);

const clientDist = path.join(projectRoot, 'frontend', 'dist');
const reactEntry = path.join(clientDist, 'index.html');
app.use(express.static(clientDist, { index: false }));

app.get('/', (req, res) => {
  const entry = fs.existsSync(reactEntry) ? reactEntry : path.join(projectRoot, 'frontend', 'public', 'legacy-pages', 'login page.html');
  res.sendFile(entry);
});

app.get('/:page', (req, res) => {
  const page = req.params.page;
  if (!pageRoutes.has(page)) return res.status(404).send('Page not found');
  if (fs.existsSync(reactEntry)) return res.sendFile(reactEntry);
  res.sendFile(path.join(projectRoot, 'frontend', 'public', 'legacy-pages', page), (error) => {
    if (error) res.status(404).send('Page not found');
  });
});

async function startServer() {
  try {
    await connectDatabase();
    await seedDemoData();
    app.listen(port, () => {
      console.log(`Hospital server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Hospital server startup failed:', error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startServer();

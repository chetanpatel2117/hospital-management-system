const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const { promisify } = require('util');
const { normalizeRole, roleLabel, hasPermission } = require('./permissions');

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

function signSession(username, role, sessionVersion = 0) {
  const payload = Buffer.from(JSON.stringify({
    username,
    role,
    sessionVersion,
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

async function requireAuthentication(req, res, next) {
  const session = readSession(getSessionToken(req));
  if (!session) {
    return res.status(401).json({ message: 'Please sign in to continue' });
  }
  try {
    const account = await User.findOne({ username: session.username }).select('role status sessionVersion').lean();
    if (!account || (account.status && !/^active$/i.test(account.status))) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Your account is unavailable. Please sign in again.' });
    }
    if ((session.sessionVersion || 0) !== (account.sessionVersion || 0) || normalizeRole(session.role) !== normalizeRole(account.role)) {
      clearSessionCookie(res);
      return res.status(401).json({ message: 'Your account permissions changed. Please sign in again.' });
    }
    req.auth = { ...session, role: account.role };
    next();
  } catch (error) {
    console.error('Unable to verify account session:', error.message);
    res.status(503).json({ message: 'Unable to verify your account session' });
  }
}

function requireMappedRole(req, res, next) {
  const role = normalizeRole(req.auth.role);
  if (!role) {
    clearSessionCookie(res);
    return res.status(403).json({ message: 'Your account role is not mapped to an access policy. Contact an administrator.' });
  }
  req.auth.normalizedRole = role;
  next();
}

function requirePermission(module, action) {
  return (req, res, next) => {
    if (!hasPermission(req.auth.role, module, action)) {
      return res.status(403).json({ message: `Your role does not have permission to ${action} ${module}.` });
    }
    next();
  };
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

app.get('/api/dashboard/stats', requireAuthentication, requireMappedRole, requirePermission('adminDashboard', 'read'), async (req, res) => {
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
    if (!normalizeRole(user.role)) {
      return res.status(403).json({ message: 'Your account role is not mapped to an access policy. Contact an administrator.' });
    }
    if (user.status && !/^active$/i.test(user.status)) {
      return res.status(403).json({ message: 'Your account is inactive. Contact an administrator.' });
    }
    if (verification.needsUpgrade) {
      user.password = await hashPassword(password);
      await user.save();
    }

    setSessionCookie(res, signSession(user.username, user.role, user.sessionVersion || 0));
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

app.use('/api', requireAuthentication, requireMappedRole);

function userSummary(user) {
  return {
    _id: user._id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    address: user.address,
    department: user.department,
    employeeId: user.employeeId,
    status: user.status,
    createdAt: user.createdAt
  };
}

function isActiveAccount(status) {
  return !status || /^active$/i.test(status);
}

async function hasOtherActiveAdministrator(user) {
  const otherUsers = await User.find({ _id: { $ne: user._id } }).select('role status').lean();
  return otherUsers.some((other) => normalizeRole(other.role) === 'administrator' && isActiveAccount(other.status));
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

app.get('/api/users', requirePermission('userManagement', 'read'), async (req, res) => {
  try {
    const users = await User.find().select('username name role email phone address department employeeId status createdAt').sort({ createdAt: -1 }).lean();
    res.json(users.map(userSummary));
  } catch (error) {
    console.error('Unable to list user accounts:', error.message);
    res.status(500).json({ message: 'Unable to load user accounts' });
  }
});

app.post('/api/users', requirePermission('userManagement', 'create'), async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'User details must be sent as an object' });
    }
    const { username, password, name, email = '', phone = '', address = '', role, department = '', employeeId = '', status = 'Active' } = req.body;
    const assignedRole = roleLabel(role);
    if (typeof username !== 'string' || !/^[A-Za-z0-9._-]{3,32}$/.test(username.trim())) {
      return res.status(400).json({ message: 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens' });
    }
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'A full name is required' });
    if (typeof password !== 'string' || password.length < 12) return res.status(400).json({ message: 'Temporary password must be at least 12 characters' });
    if (!assignedRole) return res.status(400).json({ message: 'Select a supported account role' });
    if ([email, phone, address, department, employeeId].some((value) => typeof value !== 'string')) {
      return res.status(400).json({ message: 'Email, phone, address, department, and employee ID must be text values' });
    }
    if (typeof status !== 'string') return res.status(400).json({ message: 'Account status must be Active or Inactive' });
    if (!validEmail(email)) return res.status(400).json({ message: 'Provide a valid email address' });
    if (!/^(active|inactive)$/i.test(status)) return res.status(400).json({ message: 'Account status must be Active or Inactive' });

    const user = await User.create({
      username: username.trim(),
      password: await hashPassword(password),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      role: assignedRole,
      department: department.trim(),
      employeeId: employeeId.trim(),
      status: /^active$/i.test(status) ? 'Active' : 'Inactive'
    });
    res.status(201).json(userSummary(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That username is already in use' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('Unable to create user account:', error.message);
    res.status(500).json({ message: 'Unable to create the user account' });
  }
});

app.put('/api/users/:id', requirePermission('userManagement', 'update'), async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'User updates must be sent as an object' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.body.username !== undefined && req.body.username !== user.username) {
      return res.status(400).json({ message: 'Usernames cannot be changed after account creation' });
    }

    const updates = {};
    for (const field of ['name', 'email', 'phone', 'address', 'department', 'employeeId']) {
      if (req.body[field] === undefined) continue;
      if (typeof req.body[field] !== 'string') return res.status(400).json({ message: `${field} must be a string` });
      updates[field] = req.body[field].trim();
    }
    if (updates.name !== undefined && !updates.name) return res.status(400).json({ message: 'A full name is required' });
    if (updates.email !== undefined && !validEmail(updates.email)) return res.status(400).json({ message: 'Provide a valid email address' });

    if (req.body.role !== undefined) {
      const assignedRole = roleLabel(req.body.role);
      if (!assignedRole) return res.status(400).json({ message: 'Select a supported account role' });
      updates.role = assignedRole;
    }
    if (req.body.status !== undefined) {
      if (typeof req.body.status !== 'string' || !/^(active|inactive)$/i.test(req.body.status)) {
        return res.status(400).json({ message: 'Account status must be Active or Inactive' });
      }
      updates.status = /^active$/i.test(req.body.status) ? 'Active' : 'Inactive';
    }
    if (req.body.password !== undefined && req.body.password !== '') {
      if (typeof req.body.password !== 'string' || req.body.password.length < 12) {
        return res.status(400).json({ message: 'Temporary password must be at least 12 characters' });
      }
      if (user.username === req.auth.username) {
        return res.status(400).json({ message: 'You cannot reset your own password from User Management' });
      }
      updates.password = await hashPassword(req.body.password);
    }

    const roleChanged = updates.role && normalizeRole(updates.role) !== normalizeRole(user.role);
    const statusChanged = updates.status && updates.status !== user.status;
    if (user.username === req.auth.username && (roleChanged || updates.status === 'Inactive')) {
      return res.status(409).json({ message: 'You cannot change your own role or deactivate your own account' });
    }
    if (normalizeRole(user.role) === 'administrator' && isActiveAccount(user.status)
      && (updates.role && normalizeRole(updates.role) !== 'administrator' || updates.status === 'Inactive')
      && !await hasOtherActiveAdministrator(user)) {
      return res.status(409).json({ message: 'At least one active administrator account must remain' });
    }

    Object.assign(user, updates);
    if (roleChanged || statusChanged || updates.password) user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();
    res.json(userSummary(user));
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    console.error('Unable to update user account:', error.message);
    res.status(500).json({ message: 'Unable to update the user account' });
  }
});

app.delete('/api/users/:id', requirePermission('userManagement', 'delete'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user ID' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.username === req.auth.username) return res.status(409).json({ message: 'You cannot delete your own account' });
    if (normalizeRole(user.role) === 'administrator' && isActiveAccount(user.status) && !await hasOtherActiveAdministrator(user)) {
      return res.status(409).json({ message: 'At least one active administrator account must remain' });
    }
    await User.findByIdAndDelete(user._id);
    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Unable to delete user account:', error.message);
    res.status(500).json({ message: 'Unable to delete the user account' });
  }
});

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

app.get('/api/dashboard/overview', requirePermission('dashboard', 'read'), async (req, res) => {
  try {
    const canRead = (module) => hasPermission(req.auth.role, module, 'read');
    const canReadPatients = canRead('patients');
    const canReadAppointments = canRead('appointments');
    const canReadBilling = canRead('billing');
    const canReadRooms = canRead('rooms');
    const canReadLaboratory = canRead('laboratory');
    const canReadStaff = canRead('staff');
    const canReadDoctors = canRead('doctors');
    const canReadEmergency = canRead('emergency');
    const canReadPharmacy = canRead('pharmacy');
    const staffQuery = canReadStaff ? {} : canReadDoctors ? { role: /doctor|consultant|physician/i } : null;
    const [patients, appointments, bills, rooms, labTests, staff, emergencyCases, medicines] = await Promise.all([
      canReadPatients ? Patient.find().sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      canReadAppointments ? Appointment.find().sort({ date: 1, time: 1 }).lean() : Promise.resolve([]),
      canReadBilling ? Bill.find().sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      canReadRooms ? Room.find().lean() : Promise.resolve([]),
      canReadLaboratory ? LabTest.find().sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      staffQuery ? Staff.find(staffQuery).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      canReadEmergency ? EmergencyCase.find().sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      canReadPharmacy ? Medicine.find().sort({ updatedAt: -1 }).lean() : Promise.resolve([])
    ]);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const currentPeriodStart = new Date(todayStart);
    currentPeriodStart.setDate(currentPeriodStart.getDate() - 29);
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);
    const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const currentPeriodStartKey = toDateKey(currentPeriodStart);
    const previousPeriodStartKey = toDateKey(previousPeriodStart);
    const yesterdayKey = toDateKey(yesterdayStart);
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
    const yesterdaysRevenue = bills.reduce((total, bill) => (
      bill.paymentDate === yesterdayKey ? total + Number(bill.paidAmount || 0) : total
    ), 0);
    const patientsInPeriod = patients.filter((patient) => {
      const createdAt = patient.createdAt && new Date(patient.createdAt);
      return createdAt && createdAt >= currentPeriodStart && createdAt < new Date(todayStart.getTime() + 86400000);
    }).length;
    const patientsInPreviousPeriod = patients.filter((patient) => {
      const createdAt = patient.createdAt && new Date(patient.createdAt);
      return createdAt && createdAt >= previousPeriodStart && createdAt < currentPeriodStart;
    }).length;
    const appointmentsInPeriod = appointments.filter((appointment) => (
      appointment.date >= currentPeriodStartKey && appointment.date <= todayKey
    )).length;
    const appointmentsInPreviousPeriod = appointments.filter((appointment) => (
      appointment.date >= previousPeriodStartKey && appointment.date < currentPeriodStartKey
    )).length;
    const recentActivities = [
      ...patients.map((item) => ({ id: item._id, type: 'Patient', title: item.name, updatedAt: item.updatedAt || item.createdAt })),
      ...appointments.map((item) => ({ id: item._id, type: 'Appointment', title: `${item.patientName} · ${item.doctorName}`, updatedAt: item.updatedAt || item.createdAt })),
      ...bills.map((item) => ({ id: item._id, type: 'Billing', title: item.invoiceNumber || item.patientName, updatedAt: item.updatedAt || item.createdAt })),
      ...rooms.map((item) => ({ id: item._id, type: 'Room', title: item.roomNumber, updatedAt: item.updatedAt || item.createdAt })),
      ...labTests.map((item) => ({ id: item._id, type: 'Laboratory', title: `${item.testName} · ${item.patientName}`, updatedAt: item.updatedAt || item.createdAt })),
      ...staff.map((item) => ({ id: item._id, type: 'Staff', title: item.name, updatedAt: item.updatedAt || item.createdAt })),
      ...emergencyCases.map((item) => ({ id: item._id, type: 'Emergency', title: `${item.patientName} · ${item.emergencyType}`, updatedAt: item.updatedAt || item.createdAt })),
      ...medicines.map((item) => ({ id: item._id, type: 'Pharmacy', title: item.name, updatedAt: item.updatedAt || item.createdAt }))
    ].filter((item) => item.title && item.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime()))
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, 8);
    const stats = {};
    const trends = {};
    if (canReadPatients) {
      stats.patients = patients.length;
      trends.patientsAdded30d = patientsInPeriod;
      trends.patientsAdded30dChange = patientsInPeriod - patientsInPreviousPeriod;
    }
    if (canReadDoctors || canReadStaff) stats.doctors = doctorRecords.length;
    if (canReadAppointments) {
      stats.appointments = appointments.length;
      stats.pendingAppointments = pendingAppointments.length;
      trends.appointments30d = appointmentsInPeriod;
      trends.appointments30dChange = appointmentsInPeriod - appointmentsInPreviousPeriod;
    }
    if (canReadRooms) {
      stats.availableBeds = availableBeds;
      stats.occupiedBeds = rooms.filter((room) => room.status === 'Occupied').reduce((total, room) => total + Number(room.capacity || 1), 0);
    }
    if (canReadStaff) stats.staff = staff.length;
    if (canReadBilling) {
      stats.todaysRevenue = todaysRevenue;
      stats.paidTotal = paidTotal;
      trends.todaysRevenueChange = todaysRevenue - yesterdaysRevenue;
    }
    if (canReadEmergency) stats.emergencyCases = emergencyCases.filter((item) => item.status === 'Active').length;
    if (canReadLaboratory) {
      stats.labTests = labTests.length;
      stats.pendingLabTests = labTests.filter((item) => !/^(cancelled|completed)$/i.test(item.status || '')).length;
      stats.reportsReady = labTests.filter((item) => item.reportReady).length;
    }
    if (canReadPharmacy) {
      stats.medicines = medicines.length;
      stats.lowStock = medicines.filter((item) => Number(item.stock) <= Number(item.reorderLevel ?? 10)).length;
      stats.expiringMedicines = medicines.filter((item) => {
        if (!item.expiryDate) return false;
        const expiryDate = new Date(`${item.expiryDate}T00:00:00`);
        const expiringLimit = new Date(todayStart);
        expiringLimit.setDate(expiringLimit.getDate() + 30);
        return !Number.isNaN(expiryDate.getTime()) && expiryDate >= todayStart && expiryDate <= expiringLimit;
      }).length;
    }
    if (Object.keys(trends).length) stats.trends = trends;
    const labStatuses = Array.from(labTests.reduce((counts, test) => {
      const status = test.status || 'Unspecified';
      counts.set(status, (counts.get(status) || 0) + 1);
      return counts;
    }, new Map()), ([label, value]) => ({ label, value }));
    const medicineCategories = Array.from(medicines.reduce((counts, medicine) => {
      const category = medicine.category || 'Unspecified';
      counts.set(category, (counts.get(category) || 0) + 1);
      return counts;
    }, new Map()), ([label, value]) => ({ label, value }));

    res.json({
      stats,
      recentPatients: patients.slice(0, 5),
      todaysAppointments: appointments.filter((appointment) => appointment.date === todayKey).slice(0, 6),
      recentTransactions: bills.slice(0, 5),
      recentActivities,
      recentEmergencyCases: emergencyCases.filter((item) => item.status === 'Active').slice(0, 5),
      recentLabTests: labTests.slice(0, 5),
      recentMedicines: medicines.slice(0, 5),
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
        labStatuses,
        medicineCategories
      }
    });
  } catch (error) {
    console.error('Unable to load dashboard overview:', error.message);
    res.status(500).json({ message: 'Unable to load dashboard data' });
  }
});

app.get('/api/reports/summary', requirePermission('reports', 'read'), async (req, res) => {
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

const resourceModules = {
  patients: 'patients',
  appointments: 'appointments',
  bills: 'billing',
  medicines: 'pharmacy',
  'lab-tests': 'laboratory',
  rooms: 'rooms',
  staff: 'staff',
  'emergency-cases': 'emergency'
};

function requireResourcePermission(routeName, action) {
  return (req, res, next) => {
    const module = routeName === 'staff' && action === 'read' && req.auth.normalizedRole === 'receptionist'
      ? 'doctors'
      : resourceModules[routeName];
    return requirePermission(module, action)(req, res, next);
  };
}

function buildCrudRoutes(model, entityName, routeName) {
  app.get(`/api/${routeName}`, requireResourcePermission(routeName, 'read'), async (req, res) => {
    try {
      const query = routeName === 'staff' && req.auth.normalizedRole === 'receptionist'
        ? { role: /doctor|consultant|physician/i }
        : {};
      const docs = await model.find(query).sort({ createdAt: -1 });
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(`/api/${routeName}`, requireResourcePermission(routeName, 'create'), async (req, res) => {
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

  app.put(`/api/${routeName}/:id`, requireResourcePermission(routeName, 'update'), async (req, res) => {
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

  app.delete(`/api/${routeName}/:id`, requireResourcePermission(routeName, 'delete'), async (req, res) => {
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

app.get('/api/profile/:username', requirePermission('settings', 'read'), async (req, res) => {
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

app.post('/api/profile/password', requirePermission('settings', 'update'), async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Password details must be sent as an object' });
    }
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ message: 'New password must be at least 12 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'Choose a new password different from your current password' });
    }

    const user = await User.findOne({ username: req.auth.username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const verification = await verifyPassword(currentPassword, user.password);
    if (!verification.valid) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await hashPassword(newPassword);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();
    setSessionCookie(res, signSession(user.username, user.role, user.sessionVersion));
    res.json({ message: 'Password changed successfully. Other active sessions have been signed out.' });
  } catch (error) {
    console.error('Unable to change account password:', error.message);
    res.status(500).json({ message: 'Unable to change the account password' });
  }
});

app.put('/api/profile/:username', requirePermission('settings', 'update'), async (req, res) => {
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
  'staff details.html',
  'users.html'
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

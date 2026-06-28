const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  name: { type: String, default: 'Admin' },
  email: { type: String, default: 'admin@hospital.com' },
  phone: { type: String, default: '+91 9876543210' },
  address: { type: String, default: 'Hospital Address' },
  department: { type: String, default: 'Management' },
  employeeId: { type: String, default: 'D01' },
  status: { type: String, default: 'Active' },
  joinedAt: { type: String, default: 'Jan 2024' },
  preferences: { type: Object, default: { twoFactor: false, emailNotifications: true, darkMode: false } },
  photo: { type: String, default: '' }
}, { timestamps: true });

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  gender: String,
  phone: String,
  bloodGroup: String,
  address: String,
  condition: String,
  status: { type: String, default: 'Admitted' }
}, { timestamps: true });

const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  doctorName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  department: String,
  status: { type: String, default: 'Scheduled' }
}, { timestamps: true });

const billSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, default: 'Pending' },
  dueDate: String
}, { timestamps: true });

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  stock: { type: Number, required: true },
  price: { type: Number, required: true },
  reorderLevel: { type: Number, default: 10 },
  expiryDate: String
}, { timestamps: true });

const labTestSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  testName: { type: String, required: true },
  sampleCollected: { type: Boolean, default: false },
  reportReady: { type: Boolean, default: false },
  status: { type: String, default: 'Requested' }
}, { timestamps: true });

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  status: { type: String, default: 'Available' },
  capacity: Number,
  assignedTo: String
}, { timestamps: true });

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  department: String,
  phone: String,
  email: String,
  shift: String
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  Patient: mongoose.model('Patient', patientSchema),
  Appointment: mongoose.model('Appointment', appointmentSchema),
  Bill: mongoose.model('Bill', billSchema),
  Medicine: mongoose.model('Medicine', medicineSchema),
  LabTest: mongoose.model('LabTest', labTestSchema),
  Room: mongoose.model('Room', roomSchema),
  Staff: mongoose.model('Staff', staffSchema)
};

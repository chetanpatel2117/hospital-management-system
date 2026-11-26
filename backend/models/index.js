const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  sessionVersion: { type: Number, default: 0, min: 0 },
  name: { type: String, default: 'Admin' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  department: { type: String, default: '' },
  employeeId: { type: String, default: '' },
  status: { type: String, default: 'Active' },
  joinedAt: { type: String, default: () => new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' }) },
  preferences: { type: Object, default: { twoFactor: false, emailNotifications: true, darkMode: false } },
  photo: { type: String, default: '' }
}, { timestamps: true });

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, min: 0, max: 130 },
  gender: String,
  phone: String,
  email: String,
  bloodGroup: String,
  address: String,
  condition: String,
  medicalHistory: String,
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

const billPaymentSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, required: true },
  paymentDate: { type: String, required: true },
  reference: { type: String, default: '' },
  recordedBy: { type: String, default: '' },
  requestId: { type: String, default: '' },
  provider: { type: String, enum: ['manual', 'razorpay'], default: 'manual' },
  status: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Paid' },
  orderId: { type: String, default: '' },
  paymentId: { type: String, default: '' },
  expiresAt: Date
}, { timestamps: true });

const billSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  contact: String,
  email: String,
  invoiceNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true, min: 0.01 },
  consultationCharges: { type: Number, default: 0, min: 0 },
  medicineCharges: { type: Number, default: 0, min: 0 },
  laboratoryCharges: { type: Number, default: 0, min: 0 },
  otherCharges: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  paymentMethod: String,
  paymentDate: String,
  status: { type: String, default: 'Pending' },
  dueDate: String,
  legacyPaidAmount: { type: Number, min: 0 },
  legacyPaymentDate: String,
  legacyPaymentMethod: String,
  legacyPaymentCaptured: { type: Boolean, default: false },
  payments: { type: [billPaymentSchema], default: [] }
}, { timestamps: true, optimisticConcurrency: true });

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  supplier: String,
  stock: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  reorderLevel: { type: Number, default: 10 },
  expiryDate: String
}, { timestamps: true });

const labTestSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  patientId: String,
  testName: { type: String, required: true },
  priority: { type: String, enum: ['Normal', 'Urgent', 'Critical'], default: 'Normal' },
  notes: String,
  sampleCollected: { type: Boolean, default: false },
  sampleType: String,
  collectionTime: String,
  collectorName: String,
  reportReady: { type: Boolean, default: false },
  resultStatus: String,
  verifiedBy: String,
  findings: String,
  status: { type: String, default: 'Requested' }
}, { timestamps: true });

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  status: { type: String, default: 'Available' },
  capacity: { type: Number, min: 1 },
  assignedTo: String
}, { timestamps: true });

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  department: String,
  specialization: String,
  experienceYears: { type: Number, min: 0 },
  availability: { type: String, default: 'Not set' },
  phone: String,
  email: String,
  shift: String
}, { timestamps: true });

const emergencyCaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  patientName: { type: String, required: true },
  roomNumber: String,
  contactNumber: String,
  emergencyType: { type: String, required: true },
  conditionLevel: { type: String, enum: ['Critical', 'Serious', 'Stable'], required: true },
  status: { type: String, enum: ['Active', 'Resolved'], default: 'Active' }
}, { timestamps: true });

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true, minlength: 2, maxlength: 12, match: /^[A-Z0-9-]+$/ },
  head: { type: String, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 32 },
  location: { type: String, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

const medicalRecordSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientName: { type: String, required: true, trim: true },
  recordType: { type: String, enum: ['Consultation', 'Diagnosis', 'Progress note', 'Prescription', 'Procedure', 'Discharge'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, required: true, trim: true, maxlength: 10000 },
  recordDate: { type: String, required: true },
  department: { type: String, trim: true, maxlength: 80 },
  recordedBy: { type: String, required: true, trim: true }
}, { timestamps: true });

const bedSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  roomNumber: { type: String, required: true, trim: true },
  bedNumber: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['Available', 'Occupied', 'Reserved'], default: 'Available' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  patientName: { type: String, default: '', trim: true },
  assignedBy: { type: String, default: '', trim: true },
  notes: { type: String, default: '', maxlength: 500 }
}, { timestamps: true });
bedSchema.index({ roomId: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ patientId: 1 }, { unique: true, partialFilterExpression: { status: 'Occupied', patientId: { $type: 'objectId' } } });

module.exports = {
  User: mongoose.model('User', userSchema),
  Patient: mongoose.model('Patient', patientSchema),
  Appointment: mongoose.model('Appointment', appointmentSchema),
  Bill: mongoose.model('Bill', billSchema),
  Medicine: mongoose.model('Medicine', medicineSchema),
  LabTest: mongoose.model('LabTest', labTestSchema),
  Room: mongoose.model('Room', roomSchema),
  Staff: mongoose.model('Staff', staffSchema),
  EmergencyCase: mongoose.model('EmergencyCase', emergencyCaseSchema),
  Department: mongoose.model('Department', departmentSchema),
  MedicalRecord: mongoose.model('MedicalRecord', medicalRecordSchema),
  Bed: mongoose.model('Bed', bedSchema)
};

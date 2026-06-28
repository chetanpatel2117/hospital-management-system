const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hospital';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const {
  User,
  Patient,
  Appointment,
  Bill,
  Medicine,
  LabTest,
  Room,
  Staff
} = require('./models');

async function connectDatabase() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
}

async function seedDemoData() {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await User.create({
      username: 'admin',
      password: 'admin123',
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

app.get('/api/dashboard/stats', async (req, res) => {
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
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

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
      const doc = new model(req.body);
      await doc.save();
      res.status(201).json(doc);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put(`/api/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!doc) return res.status(404).json({ message: `${entityName} not found` });
      res.json(doc);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete(`/api/${routeName}/:id`, async (req, res) => {
    try {
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

app.get('/api/profile/:username', async (req, res) => {
  try {
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
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      {
        $set: {
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          address: req.body.address,
          department: req.body.department,
          employeeId: req.body.employeeId,
          status: req.body.status,
          role: req.body.role,
          joinedAt: req.body.joinedAt,
          preferences: req.body.preferences,
          photo: req.body.photo || undefined
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login page.html'));
});

app.get('/:page', (req, res) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, `${page}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
});

connectDatabase().then(() => seedDemoData());

app.listen(port, () => {
  console.log(`Hospital server running at http://localhost:${port}`);
});

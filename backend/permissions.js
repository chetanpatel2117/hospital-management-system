const roleAliases = new Map([
  ['administrator', 'administrator'],
  ['admin', 'administrator'],
  ['doctor', 'doctor'],
  ['physician', 'doctor'],
  ['consultant', 'doctor'],
  ['receptionist', 'receptionist'],
  ['nurse', 'nurse'],
  ['pharmacy', 'pharmacyStaff'],
  ['pharmacy staff', 'pharmacyStaff'],
  ['pharmacist', 'pharmacyStaff'],
  ['pharmacy technician', 'pharmacyStaff'],
  ['lab', 'labStaff'],
  ['lab staff', 'labStaff'],
  ['laboratory staff', 'labStaff'],
  ['lab technician', 'labStaff'],
  ['laboratory technician', 'labStaff'],
  ['lab tech', 'labStaff']
]);

const permissions = {
  doctor: {
    dashboard: ['read'],
    departments: ['read'],
    patients: ['read'],
    medicalRecords: ['read', 'create', 'update'],
    appointments: ['read', 'update'],
    laboratory: ['read'],
    settings: ['read', 'update']
  },
  receptionist: {
    dashboard: ['read'],
    departments: ['read'],
    patients: ['create', 'read', 'update', 'delete'],
    doctors: ['read'],
    appointments: ['create', 'read', 'update', 'delete'],
    rooms: ['read'],
    billing: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update']
  },
  nurse: {
    dashboard: ['read'],
    departments: ['read'],
    patients: ['read', 'update'],
    medicalRecords: ['read', 'create', 'update'],
    appointments: ['read'],
    rooms: ['read', 'update'],
    laboratory: ['read', 'update'],
    settings: ['read', 'update']
  },
  pharmacyStaff: {
    dashboard: ['read'],
    pharmacy: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update']
  },
  labStaff: {
    dashboard: ['read'],
    departments: ['read'],
    patients: ['read'],
    laboratory: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update']
  }
};

const roleLabels = {
  administrator: 'Administrator',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  nurse: 'Nurse',
  pharmacyStaff: 'Pharmacy Staff',
  labStaff: 'Lab Staff'
};

function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return roleAliases.get(normalized) || null;
}

function roleLabel(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? roleLabels[normalizedRole] : null;
}

function hasPermission(role, module, action) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'administrator') return true;
  return Boolean(permissions[normalizedRole]?.[module]?.includes(action));
}

module.exports = { normalizeRole, roleLabel, hasPermission };

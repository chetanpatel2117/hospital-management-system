const roleAliases = {
  administrator: 'administrator',
  admin: 'administrator',
  doctor: 'doctor',
  physician: 'doctor',
  consultant: 'doctor',
  receptionist: 'receptionist',
  nurse: 'nurse',
  pharmacy: 'pharmacyStaff',
  'pharmacy staff': 'pharmacyStaff',
  pharmacist: 'pharmacyStaff',
  'pharmacy technician': 'pharmacyStaff',
  lab: 'labStaff',
  'lab staff': 'labStaff',
  'laboratory staff': 'labStaff',
  'lab technician': 'labStaff',
  'laboratory technician': 'labStaff',
  'lab tech': 'labStaff'
};

const permissions = {
  doctor: {
    dashboard: ['read'],
    patients: ['read'],
    appointments: ['read', 'update'],
    laboratory: ['read'],
    settings: ['read', 'update']
  },
  receptionist: {
    dashboard: ['read'],
    patients: ['create', 'read', 'update', 'delete'],
    doctors: ['read'],
    appointments: ['create', 'read', 'update', 'delete'],
    rooms: ['read'],
    billing: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update']
  },
  nurse: {
    dashboard: ['read'],
    patients: ['read', 'update'],
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
    patients: ['read'],
    laboratory: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update']
  }
};

export function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return Object.prototype.hasOwnProperty.call(roleAliases, normalized) ? roleAliases[normalized] : null;
}

export function canAccessRole(role, module, action) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'administrator') return true;
  return Boolean(permissions[normalizedRole]?.[module]?.includes(action));
}

export function moduleForPage(page) {
  if (page === 'icu') return 'rooms';
  if (page === 'users') return 'userManagement';
  return page;
}

const test = require('node:test');
const assert = require('node:assert/strict');
const { hasPermission, normalizeRole, roleLabel } = require('./permissions');

test('normalizes known account roles and rejects unmapped roles', () => {
  assert.equal(normalizeRole(' Administrator '), 'administrator');
  assert.equal(normalizeRole('lab-technician'), 'labStaff');
  assert.equal(normalizeRole('unmapped role'), null);
  assert.equal(normalizeRole('constructor'), null);
  assert.equal(roleLabel('pharmacist'), 'Pharmacy Staff');
});

test('administrator retains full module access', () => {
  assert.equal(hasPermission('admin', 'emergency', 'delete'), true);
  assert.equal(hasPermission('Administrator', 'reports', 'read'), true);
});

test('only administrators can manage user accounts', () => {
  for (const role of ['Doctor', 'Receptionist', 'Nurse', 'Pharmacy Staff', 'Lab Staff']) {
    for (const action of ['read', 'create', 'update', 'delete']) {
      assert.equal(hasPermission(role, 'userManagement', action), false);
    }
  }
  assert.equal(hasPermission('Administrator', 'userManagement', 'create'), true);
});

test('clinical and reception roles can read departments but cannot manage them', () => {
  for (const role of ['Doctor', 'Receptionist', 'Nurse', 'Lab Staff']) {
    assert.equal(hasPermission(role, 'departments', 'read'), true);
    assert.equal(hasPermission(role, 'departments', 'create'), false);
    assert.equal(hasPermission(role, 'departments', 'update'), false);
    assert.equal(hasPermission(role, 'departments', 'delete'), false);
  }
});

test('doctors and nurses can manage clinical notes but not delete them', () => {
  for (const role of ['Doctor', 'Nurse']) {
    assert.equal(hasPermission(role, 'medicalRecords', 'read'), true);
    assert.equal(hasPermission(role, 'medicalRecords', 'create'), true);
    assert.equal(hasPermission(role, 'medicalRecords', 'update'), true);
    assert.equal(hasPermission(role, 'medicalRecords', 'delete'), false);
  }
  assert.equal(hasPermission('Receptionist', 'medicalRecords', 'read'), false);
});

test('doctor can update appointments but cannot access billing', () => {
  assert.equal(hasPermission('Doctor', 'patients', 'read'), true);
  assert.equal(hasPermission('Doctor', 'appointments', 'update'), true);
  assert.equal(hasPermission('Doctor', 'appointments', 'create'), false);
  assert.equal(hasPermission('Doctor', 'billing', 'read'), false);
});

test('receptionist can manage billing and only read doctors', () => {
  assert.equal(hasPermission('Receptionist', 'billing', 'create'), true);
  assert.equal(hasPermission('Receptionist', 'doctors', 'read'), true);
  assert.equal(hasPermission('Receptionist', 'staff', 'read'), false);
});

test('nurse and clinical support roles receive only their mapped access', () => {
  assert.equal(hasPermission('Nurse', 'laboratory', 'update'), true);
  assert.equal(hasPermission('Nurse', 'laboratory', 'delete'), false);
  assert.equal(hasPermission('Pharmacist', 'pharmacy', 'create'), true);
  assert.equal(hasPermission('Lab Technician', 'patients', 'read'), true);
  assert.equal(hasPermission('Lab Technician', 'patients', 'update'), false);
});

test('only nurses and administrators can change bed allocations', () => {
  assert.equal(hasPermission('Nurse', 'rooms', 'update'), true);
  assert.equal(hasPermission('Administrator', 'rooms', 'update'), true);
  assert.equal(hasPermission('Receptionist', 'rooms', 'read'), true);
  assert.equal(hasPermission('Receptionist', 'rooms', 'update'), false);
  assert.equal(hasPermission('Doctor', 'rooms', 'read'), false);
});

test('unmapped roles are denied all module access', () => {
  assert.equal(hasPermission('unknown', 'dashboard', 'read'), false);
  assert.equal(hasPermission(null, 'patients', 'read'), false);
});

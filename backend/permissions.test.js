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

test('unmapped roles are denied all module access', () => {
  assert.equal(hasPermission('unknown', 'dashboard', 'read'), false);
  assert.equal(hasPermission(null, 'patients', 'read'), false);
});

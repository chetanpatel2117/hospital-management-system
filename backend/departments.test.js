const test = require('node:test');
const assert = require('node:assert/strict');
const { Department } = require('./models');

test('department records trim names and normalize codes', async () => {
  const department = new Department({ name: ' Cardiology ', code: 'card-1' });
  await department.validate();
  assert.equal(department.name, 'Cardiology');
  assert.equal(department.code, 'CARD-1');
  assert.equal(department.status, 'Active');
});

test('department records reject invalid codes and statuses', async () => {
  const department = new Department({ name: 'Emergency', code: 'ER UNIT', status: 'Open' });
  await assert.rejects(department.validate(), (error) => error.name === 'ValidationError');
});

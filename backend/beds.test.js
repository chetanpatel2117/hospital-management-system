const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Bed } = require('./models');

test('bed slots require a room, positive bed number, and supported status', async () => {
  const bed = new Bed({
    roomId: new mongoose.Types.ObjectId(),
    roomNumber: '101',
    bedNumber: 1
  });
  await bed.validate();
  assert.equal(bed.status, 'Available');

  bed.status = 'Unknown';
  await assert.rejects(bed.validate(), (error) => error.name === 'ValidationError');
});

test('bed slots reject non-positive bed numbers', async () => {
  const bed = new Bed({
    roomId: new mongoose.Types.ObjectId(),
    roomNumber: '101',
    bedNumber: 0
  });
  await assert.rejects(bed.validate(), (error) => error.name === 'ValidationError');
});

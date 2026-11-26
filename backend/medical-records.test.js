const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MedicalRecord } = require('./models');

test('medical records require an identified patient and an attributed author', async () => {
  const record = new MedicalRecord({
    patientId: new mongoose.Types.ObjectId(),
    patientName: 'Patient One',
    recordType: 'Consultation',
    title: 'Initial visit',
    details: 'Clinical assessment recorded.',
    recordDate: '2026-11-26',
    recordedBy: 'doctor1'
  });
  await record.validate();
  assert.equal(record.recordType, 'Consultation');
});

test('medical records reject unsupported record types', async () => {
  const record = new MedicalRecord({
    patientId: new mongoose.Types.ObjectId(),
    patientName: 'Patient One',
    recordType: 'Unknown',
    title: 'Visit',
    details: 'Clinical assessment recorded.',
    recordDate: '2026-11-26',
    recordedBy: 'doctor1'
  });
  await assert.rejects(record.validate(), (error) => error.name === 'ValidationError');
});

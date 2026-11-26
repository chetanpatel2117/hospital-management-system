const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  billStatus,
  billPaymentEntries,
  createBillPayload,
  toMinorUnits,
  validBillingDate,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature
} = require('./billing');

test('converts valid INR amounts to paise and rejects invalid precision', () => {
  assert.equal(toMinorUnits('125.50'), 12550);
  assert.equal(toMinorUnits(0), 0);
  assert.equal(toMinorUnits(-1), null);
  assert.equal(toMinorUnits('1.001'), null);
  assert.equal(toMinorUnits('not money'), null);
});

test('creates invoices from validated itemized charge amounts', () => {
  const bill = createBillPayload({
    patientName: '  Patient One  ',
    invoiceNumber: 'INV-123',
    consultationCharges: '100.25',
    medicineCharges: 50,
    laboratoryCharges: 0,
    otherCharges: 10
  });
  assert.equal(bill.patientName, 'Patient One');
  assert.equal(bill.amount, 160.25);
  assert.equal(bill.consultationCharges, 100.25);
  assert.throws(() => createBillPayload({
    patientName: 'Patient One',
    invoiceNumber: 'INV-124',
    consultationCharges: 0
  }), /greater than zero/);
  assert.throws(() => createBillPayload({
    patientName: 'Patient One',
    invoiceNumber: 'INV-125',
    consultationCharges: 5,
    paidAmount: 5
  }), /only be changed by recording a payment/);
});

test('protects paid invoice amounts and immutable invoice numbers', () => {
  const currentBill = {
    patientName: 'Patient One',
    invoiceNumber: 'INV-123',
    amount: 100,
    paidAmount: 25,
    consultationCharges: 100,
    medicineCharges: 0,
    laboratoryCharges: 0,
    otherCharges: 0
  };
  assert.equal(createBillPayload({ dueDate: '2025-03-20' }, currentBill).dueDate, '2025-03-20');
  assert.throws(() => createBillPayload({ consultationCharges: 90 }, currentBill), (error) => error.status === 409);
  assert.throws(() => createBillPayload({ invoiceNumber: 'INV-999' }, currentBill), (error) => error.status === 409);
  assert.equal(validBillingDate('2025-02-28'), true);
  assert.equal(validBillingDate('2025-02-30'), false);
});

test('derives invoice payment status from the amount collected', () => {
  assert.equal(billStatus(10000, 0), 'Pending');
  assert.equal(billStatus(10000, 4000), 'Partially paid');
  assert.equal(billStatus(10000, 10000), 'Paid');
  assert.equal(billStatus(10000, 12000), 'Paid');
});

test('reports payment ledger events without double-counting legacy paid balances', () => {
  const entries = billPaymentEntries({
    paidAmount: 75,
    paymentDate: '2025-03-03',
    legacyPaidAmount: 50,
    legacyPaymentDate: '2025-03-01',
    legacyPaymentCaptured: true,
    payments: [
      { amount: 25, paymentDate: '2025-03-02', status: 'Paid' },
      { amount: 20, paymentDate: '2025-03-03', status: 'Pending' }
    ]
  });
  assert.deepEqual(entries, [
    { date: '2025-03-02', amount: 25 },
    { date: '2025-03-01', amount: 50 }
  ]);
});

test('verifies Razorpay checkout signatures and rejects tampering', () => {
  const secret = 'local-test-secret';
  const signature = crypto.createHmac('sha256', secret).update('order-123|payment-456').digest('hex');
  assert.equal(verifyRazorpayPaymentSignature('order-123', 'payment-456', signature, secret), true);
  assert.equal(verifyRazorpayPaymentSignature('order-123', 'payment-789', signature, secret), false);
  assert.equal(verifyRazorpayPaymentSignature('order-123', 'payment-456', 'invalid', secret), false);
});

test('verifies Razorpay webhook signatures against the original request bytes', () => {
  const secret = 'webhook-test-secret';
  const payload = Buffer.from('{"event":"payment.captured"}');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal(verifyRazorpayWebhookSignature(payload, signature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, secret), false);
  assert.equal(verifyRazorpayWebhookSignature(payload, signature, ''), false);
});

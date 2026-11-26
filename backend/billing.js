const crypto = require('crypto');

function toMinorUnits(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minorUnits = Math.round(amount * 100);
  if (!Number.isSafeInteger(minorUnits) || Math.abs(amount * 100 - minorUnits) > 0.00001) return null;
  return minorUnits;
}

function validBillingDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function createBillPayload(body, currentBill = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Invoice details must be sent as an object');
    error.status = 400;
    throw error;
  }
  const protectedFields = ['paidAmount', 'paymentMethod', 'paymentDate', 'status', 'payments'];
  if (protectedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    const error = new Error('Payment totals and status can only be changed by recording a payment');
    error.status = 400;
    throw error;
  }

  const chargeFields = ['consultationCharges', 'medicineCharges', 'laboratoryCharges', 'otherCharges'];
  const details = {};
  for (const field of ['patientName', 'contact', 'email', 'invoiceNumber', 'dueDate']) {
    if (body[field] !== undefined) details[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
  }
  for (const field of chargeFields) {
    const value = body[field] === undefined ? currentBill?.[field] || 0 : body[field];
    const minorUnits = toMinorUnits(value);
    if (minorUnits === null) {
      const error = new Error(`${field} must be a non-negative amount with at most two decimal places`);
      error.status = 400;
      throw error;
    }
    details[field] = minorUnits / 100;
  }

  if (!details.patientName && currentBill) details.patientName = currentBill.patientName;
  if (!details.invoiceNumber && currentBill) details.invoiceNumber = currentBill.invoiceNumber;
  if (!details.patientName || !details.invoiceNumber) {
    const error = new Error('Patient and invoice number are required');
    error.status = 400;
    throw error;
  }
  if (currentBill && details.invoiceNumber !== currentBill.invoiceNumber) {
    const error = new Error('Invoice numbers cannot be changed after creation');
    error.status = 409;
    throw error;
  }
  if (details.dueDate && !validBillingDate(details.dueDate)) {
    const error = new Error('Enter a valid invoice due date');
    error.status = 400;
    throw error;
  }

  const itemizedTotalMinorUnits = chargeFields.reduce((total, field) => total + toMinorUnits(details[field]), 0);
  const totalMinorUnits = itemizedTotalMinorUnits || (currentBill ? toMinorUnits(currentBill.amount) : 0);
  if (!totalMinorUnits) {
    const error = new Error('Enter at least one invoice charge greater than zero');
    error.status = 400;
    throw error;
  }
  if (currentBill && (toMinorUnits(currentBill.paidAmount) || 0) > 0) {
    const chargesChanged = chargeFields.some((field) => details[field] !== Number(currentBill[field] || 0));
    if (chargesChanged || totalMinorUnits !== toMinorUnits(currentBill.amount)) {
      const error = new Error('Invoice charges cannot be changed after a payment has been recorded');
      error.status = 409;
      throw error;
    }
    if (details.patientName !== currentBill.patientName) {
      const error = new Error('Patient details cannot be changed after a payment has been recorded');
      error.status = 409;
      throw error;
    }
  }

  details.amount = totalMinorUnits / 100;
  return details;
}

function billStatus(totalMinorUnits, paidMinorUnits) {
  if (paidMinorUnits <= 0) return 'Pending';
  return paidMinorUnits >= totalMinorUnits ? 'Paid' : 'Partially paid';
}

function billPaymentEntries(bill) {
  const entries = (Array.isArray(bill.payments) ? bill.payments : [])
    .filter((payment) => payment.status === 'Paid' && /^\d{4}-\d{2}-\d{2}$/.test(payment.paymentDate || ''))
    .map((payment) => ({ date: payment.paymentDate, amount: Number(payment.amount) || 0 }));
  const ledgerPaidMinorUnits = entries.reduce((total, entry) => total + (toMinorUnits(entry.amount) || 0), 0);
  const legacyPaidMinorUnits = bill.legacyPaymentCaptured
    ? toMinorUnits(bill.legacyPaidAmount) || 0
    : Math.max(0, (toMinorUnits(bill.paidAmount) || 0) - ledgerPaidMinorUnits);
  const legacyDate = bill.legacyPaymentCaptured ? bill.legacyPaymentDate : bill.paymentDate;
  if (legacyPaidMinorUnits && /^\d{4}-\d{2}-\d{2}$/.test(legacyDate || '')) {
    entries.push({ date: legacyDate, amount: legacyPaidMinorUnits / 100 });
  }
  return entries.filter((entry) => entry.amount > 0);
}

function verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret) {
  if (![orderId, paymentId, signature, secret].every((value) => typeof value === 'string' && value.length > 0)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !signature || typeof secret !== 'string' || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  billStatus,
  billPaymentEntries,
  createBillPayload,
  toMinorUnits,
  validBillingDate,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature
};

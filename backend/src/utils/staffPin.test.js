import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaffDefaultPin, staffPinRejectionReason, STAFF_DEFAULT_PIN } from './staffPin.js';

test('default staff PIN is 000000', () => {
  assert.equal(STAFF_DEFAULT_PIN, '000000');
  assert.equal(isStaffDefaultPin('000000'), true);
  assert.equal(isStaffDefaultPin('123456'), false);
});

test('new staff PIN rejects default and trivial values', () => {
  assert.equal(staffPinRejectionReason('000000'), 'Choose a different PIN');
  assert.equal(staffPinRejectionReason('123456'), 'Choose a different PIN');
  assert.equal(staffPinRejectionReason('111111'), 'Choose a different PIN');
  assert.equal(staffPinRejectionReason('48291'), 'PIN must be 6 digits');
  assert.equal(staffPinRejectionReason('739154'), null);
});

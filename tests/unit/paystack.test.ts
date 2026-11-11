import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPaystackSignature } from '@/lib/paystack';

const SECRET = 'sk_test_abc123';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'pm_1', amount: 2550000, currency: 'NGN' } });
const sign = (b: string, s = SECRET) => createHmac('sha512', s).update(b).digest('hex');

describe('paystack webhook signature', () => {
  it('accepts a correct HMAC-SHA512 of the raw body', () => expect(verifyPaystackSignature(body, sign(body), SECRET)).toBe(true));
  it('rejects a missing or empty signature', () => {
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, '', SECRET)).toBe(false);
  });
  it('rejects a signature made with another key', () => expect(verifyPaystackSignature(body, sign(body, 'sk_test_other'), SECRET)).toBe(false));
  it('rejects a tampered body (e.g. a changed amount)', () => {
    const tampered = body.replace('2550000', '1');
    expect(verifyPaystackSignature(tampered, sign(body), SECRET)).toBe(false);
  });
  it('rejects when no secret is configured, and garbage of the wrong length', () => {
    expect(verifyPaystackSignature(body, sign(body), undefined)).toBe(false);
    expect(verifyPaystackSignature(body, 'abc', SECRET)).toBe(false);
  });
  it('is not fooled by upper-case hex or whitespace around a valid signature', () => {
    expect(verifyPaystackSignature(body, ` ${sign(body).toUpperCase()} `, SECRET)).toBe(true);
  });
});

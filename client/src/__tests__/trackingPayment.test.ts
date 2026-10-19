import { describe, expect, it } from 'vitest';
import { canStartPaymentAttempt, isPaymentAttemptEligible } from '../pages/TrackingPage';

describe('tracking payment eligibility', () => {
  it('allows payment only for unpaid orders still pending payment', () => {
    expect(
      isPaymentAttemptEligible({
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
      })
    ).toBe(true);
    expect(
      isPaymentAttemptEligible({
        paymentStatus: 'FAILED',
        orderStatus: 'PENDING_PAYMENT',
      })
    ).toBe(true);
  });

  it('hides payment for paid or otherwise ineligible orders', () => {
    expect(
      isPaymentAttemptEligible({
        paymentStatus: 'PAID',
        orderStatus: 'PENDING_PAYMENT',
      })
    ).toBe(false);
    expect(
      isPaymentAttemptEligible({
        paymentStatus: 'PENDING',
        orderStatus: 'RECEIVED',
      })
    ).toBe(false);
    expect(
      isPaymentAttemptEligible({
        paymentStatus: 'EXPIRED',
        orderStatus: 'CANCELLED',
      })
    ).toBe(false);
  });

  it('blocks a repeated click while a payment attempt is in flight', () => {
    expect(
      canStartPaymentAttempt(
        { paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT' },
        true
      )
    ).toBe(false);
    expect(
      canStartPaymentAttempt(
        { paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT' },
        false
      )
    ).toBe(true);
  });
});

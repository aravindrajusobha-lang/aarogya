/**
 * SMS Delivery Adapter (BLOCKED STUB)
 *
 * SAFETY INVARIANT:
 * In simulation and sandbox mode, external telecommunications gateways are intentionally
 * not integrated. Delivery is NEVER claimed. This adapter returns a BLOCKED stub status
 * with delivered: false, claimed: false, and an explicit explanatory reason.
 */

export interface SmsDispatchResult {
  channel: 'sms';
  delivered: false;
  status: 'BLOCKED_STUB';
  recipientPhone: string;
  reason: string;
  claimed: false;
  dispatchedAt: string;
}

export class SmsAdapter {
  static readonly isBlockedStub = true;
  static readonly gatewayConfigured = false;
  static readonly adapterName = 'AarogyaDrishti_SMS_Blocked_Stub';

  /**
   * Attempts SMS dispatch.
   * ALWAYS returns delivered: false with BLOCKED_STUB status.
   * Delivery is NEVER claimed.
   */
  static async send(recipientPhone: string, message: string): Promise<SmsDispatchResult> {
    return {
      channel: 'sms',
      delivered: false,
      status: 'BLOCKED_STUB',
      recipientPhone: recipientPhone || 'NOT_PROVIDED',
      reason:
        'SMS delivery is a BLOCKED stub in simulation/sandbox mode. No SMS gateway or telecommunications delivery is claimed.',
      claimed: false,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Email Delivery Adapter (BLOCKED STUB)
 *
 * SAFETY INVARIANT:
 * In simulation and sandbox mode, external SMTP and mail transfer agents are intentionally
 * not integrated. Delivery is NEVER claimed. This adapter returns a BLOCKED stub status
 * with delivered: false, claimed: false, and an explicit explanatory reason.
 */

export interface EmailDispatchResult {
  channel: 'email';
  delivered: false;
  status: 'BLOCKED_STUB';
  recipientEmail: string;
  reason: string;
  claimed: false;
  dispatchedAt: string;
}

export class EmailAdapter {
  static readonly isBlockedStub = true;
  static readonly transportConfigured = false;
  static readonly adapterName = 'AarogyaDrishti_Email_Blocked_Stub';

  /**
   * Attempts Email dispatch.
   * ALWAYS returns delivered: false with BLOCKED_STUB status.
   * Delivery is NEVER claimed.
   */
  static async send(
    recipientEmail: string,
    subject: string,
    message: string
  ): Promise<EmailDispatchResult> {
    return {
      channel: 'email',
      delivered: false,
      status: 'BLOCKED_STUB',
      recipientEmail: recipientEmail || 'NOT_PROVIDED',
      reason:
        'Email delivery is a BLOCKED stub in simulation/sandbox mode. No SMTP transport or delivery is claimed.',
      claimed: false,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

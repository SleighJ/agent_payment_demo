/**
 * Fiat off-ramp service (STUB for devnet testing)
 * 
 * In production, this would integrate with:
 * - Circle's USDC → fiat API
 * - Stripe Connect for ACH transfers
 * 
 * For now, it simulates the withdrawal flow.
 */

import { query, queryOne, execute } from '../db/index.js';
import type { WithdrawalRequest } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FiatService');

export interface WithdrawalResult {
  success: boolean;
  request?: WithdrawalRequest;
  message: string;
  estimatedArrival?: string;
}

// Simulated USD/USDC exchange rate (1:1 for stablecoins)
const USDC_TO_USD_RATE = 1.0;

// Simulated processing fee
const WITHDRAWAL_FEE_PERCENT = 1.5;

/**
 * Initiate a withdrawal request (converts USDC to fiat)
 * 
 * STUB: This doesn't actually process payments.
 * In production, you'd:
 * 1. Burn USDC via Circle API
 * 2. Initiate Stripe Connect payout to user's bank
 */
export async function initiateWithdrawal(
  userId: number,
  walletId: number,
  amountUsdc: number
): Promise<WithdrawalResult> {
  logger.info('Initiating withdrawal', { userId, walletId, amountUsdc });

  if (amountUsdc < 10) {
    return {
      success: false,
      message: 'Minimum withdrawal is $10 USDC',
    };
  }

  // Calculate fiat amount after fee
  const fee = amountUsdc * (WITHDRAWAL_FEE_PERCENT / 100);
  const amountFiat = (amountUsdc - fee) * USDC_TO_USD_RATE;

  // Create withdrawal request
  execute(
    `INSERT INTO withdrawal_requests (user_id, wallet_id, amount_usdc, amount_fiat, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [userId, walletId, amountUsdc, amountFiat]
  );
  
  // Get the request we just created
  const pendingRequest = queryOne<WithdrawalRequest>(
    `SELECT * FROM withdrawal_requests 
     WHERE user_id = ? AND wallet_id = ? AND amount_usdc = ? AND status = 'pending'
     ORDER BY id DESC LIMIT 1`,
    [userId, walletId, amountUsdc]
  );
  
  if (!pendingRequest) {
    return { success: false, message: 'Failed to create withdrawal request' };
  }
  
  const requestId = pendingRequest.id;
  
  // Simulate processing
  const mockStripeId = `tr_mock_${Date.now()}`;
  
  execute(
    `UPDATE withdrawal_requests 
     SET status = 'processing', stripe_transfer_id = ?
     WHERE id = ?`,
    [mockStripeId, requestId]
  );
  
  const request = queryOne<WithdrawalRequest>(
    'SELECT * FROM withdrawal_requests WHERE id = ?',
    [requestId]
  );

  logger.info('Withdrawal initiated (STUB)', {
    requestId,
    amountUsdc,
    amountFiat,
    mockStripeId,
  });

  // Calculate estimated arrival (2-3 business days for ACH)
  const arrivalDate = new Date();
  arrivalDate.setDate(arrivalDate.getDate() + 3);
  const estimatedArrival = arrivalDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return {
    success: true,
    request,
    message: [
      '✅ Withdrawal initiated!',
      '',
      `💵 Amount: $${amountUsdc.toFixed(2)} USDC`,
      `📉 Fee (${WITHDRAWAL_FEE_PERCENT}%): $${fee.toFixed(2)}`,
      `💰 You'll receive: $${amountFiat.toFixed(2)} USD`,
      '',
      '⚠️ DEVNET MODE: No real money will be transferred.',
      'In production, funds would arrive via ACH.',
    ].join('\n'),
    estimatedArrival,
  };
}

/**
 * Get withdrawal history for a user
 */
export function getWithdrawalHistory(userId: number, limit: number = 20): WithdrawalRequest[] {
  return query<WithdrawalRequest>(
    `SELECT * FROM withdrawal_requests 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
}

/**
 * Get withdrawal status
 */
export function getWithdrawalStatus(requestId: number): WithdrawalRequest | undefined {
  return queryOne<WithdrawalRequest>(
    'SELECT * FROM withdrawal_requests WHERE id = ?',
    [requestId]
  );
}

/**
 * Simulate completing a withdrawal (for testing)
 */
export function completeWithdrawal(requestId: number): WithdrawalRequest | undefined {
  execute(
    `UPDATE withdrawal_requests 
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [requestId]
  );
  
  return queryOne<WithdrawalRequest>(
    'SELECT * FROM withdrawal_requests WHERE id = ?',
    [requestId]
  );
}

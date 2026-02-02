/**
 * Spending limits service - manages daily spending caps for wallets
 */

import {
  getOrCreateSpendingLimit,
  updateSpendingLimit,
  checkSpendingAllowed,
} from '../db/queries.js';
import type { SpendingLimit } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('LimitsService');

export interface LimitStatus {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  resetDate: string;
}

/**
 * Get the current spending limit status for a wallet
 */
export function getLimitStatus(walletId: number): LimitStatus {
  const limit = getOrCreateSpendingLimit(walletId);
  
  return {
    dailyLimit: limit.daily_limit,
    usedToday: limit.used_today,
    remaining: limit.daily_limit - limit.used_today,
    resetDate: limit.reset_date,
  };
}

/**
 * Set a new daily spending limit for a wallet
 */
export function setLimit(walletId: number, newLimit: number): LimitStatus {
  if (newLimit < 0) {
    throw new Error('Spending limit cannot be negative');
  }
  
  logger.info('Setting spending limit', { walletId, newLimit });
  
  const limit = updateSpendingLimit(walletId, newLimit);
  
  return {
    dailyLimit: limit.daily_limit,
    usedToday: limit.used_today,
    remaining: limit.daily_limit - limit.used_today,
    resetDate: limit.reset_date,
  };
}

/**
 * Check if a transaction amount is within the spending limit
 */
export function canSpend(walletId: number, amount: number): { allowed: boolean; remaining: number } {
  return checkSpendingAllowed(walletId, amount);
}

/**
 * Format limit status for display
 */
export function formatLimitStatus(status: LimitStatus): string {
  return [
    `💰 Daily Limit: $${status.dailyLimit.toFixed(2)}`,
    `📊 Used Today: $${status.usedToday.toFixed(2)}`,
    `✅ Remaining: $${status.remaining.toFixed(2)}`,
    `🔄 Resets: ${status.resetDate}`,
  ].join('\n');
}


/**
 * Database query functions
 */

import { query, queryOne, execute, runTransaction } from './index.js';
import type { User, Wallet, Transaction, SpendingLimit } from './schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Queries');

// ============= User Queries =============

export function createUser(telegramId: string, username?: string): User {
  // Check if user exists
  const existing = queryOne<User>(
    'SELECT * FROM users WHERE telegram_id = ?',
    [telegramId]
  );
  
  if (existing) {
    // Update username
    execute(
      'UPDATE users SET telegram_username = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
      [username || null, telegramId]
    );
    return queryOne<User>('SELECT * FROM users WHERE telegram_id = ?', [telegramId])!;
  }
  
  // Create new user
  execute(
    'INSERT INTO users (telegram_id, telegram_username) VALUES (?, ?)',
    [telegramId, username || null]
  );
  
  // Query by telegram_id instead of last_insert_rowid (more reliable with sql.js)
  const user = queryOne<User>('SELECT * FROM users WHERE telegram_id = ?', [telegramId])!;
  
  logger.debug('User created', { telegramId, userId: user.id });
  return user;
}

export function getUserByTelegramId(telegramId: string): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
}

export function getUserById(id: number): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
}

// ============= Wallet Queries =============

export function createWallet(
  userId: number,
  publicKey: string,
  encryptedSecretKey: string,
  walletType: 'human' | 'agent',
  label?: string
): Wallet {
  execute(
    'INSERT INTO wallets (user_id, public_key, encrypted_secret_key, wallet_type, label) VALUES (?, ?, ?, ?, ?)',
    [userId, publicKey, encryptedSecretKey, walletType, label || null]
  );
  
  // Query by public_key instead of last_insert_rowid (more reliable with sql.js)
  const wallet = queryOne<Wallet>('SELECT * FROM wallets WHERE public_key = ?', [publicKey])!;
  
  logger.info('Wallet created', { userId, publicKey, walletType });
  return wallet;
}

export function getWalletsByUserId(userId: number): Wallet[] {
  return query<Wallet>('SELECT * FROM wallets WHERE user_id = ? AND is_active = 1', [userId]);
}

export function getWalletByPublicKey(publicKey: string): Wallet | undefined {
  return queryOne<Wallet>('SELECT * FROM wallets WHERE public_key = ?', [publicKey]);
}

export function getWalletById(id: number): Wallet | undefined {
  return queryOne<Wallet>('SELECT * FROM wallets WHERE id = ?', [id]);
}

export function getPrimaryWallet(userId: number): Wallet | undefined {
  return queryOne<Wallet>(
    'SELECT * FROM wallets WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );
}

// ============= Transaction Queries =============

export function createTransaction(
  fromWalletId: number,
  amount: number,
  txType: Transaction['tx_type'],
  options: {
    toWalletId?: number;
    toExternalAddress?: string;
    fee?: number;
    txSignature?: string;
  } = {}
): Transaction {
  execute(
    `INSERT INTO transactions (
      from_wallet_id, to_wallet_id, to_external_address, 
      amount, fee, tx_signature, tx_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fromWalletId,
      options.toWalletId || null,
      options.toExternalAddress || null,
      amount,
      options.fee || 0,
      options.txSignature || null,
      txType
    ]
  );
  
  // Query by unique combination instead of last_insert_rowid
  const tx = queryOne<Transaction>(
    `SELECT * FROM transactions 
     WHERE from_wallet_id = ? AND amount = ? AND tx_type = ? 
     ORDER BY id DESC LIMIT 1`,
    [fromWalletId, amount, txType]
  )!;
  
  logger.debug('Transaction created', { id: tx.id, type: txType, amount });
  return tx;
}

export function updateTransactionStatus(
  id: number,
  status: Transaction['status'],
  options: { txSignature?: string; errorMessage?: string } = {}
): Transaction {
  if (status === 'confirmed') {
    execute(
      `UPDATE transactions 
       SET status = ?, tx_signature = COALESCE(?, tx_signature), error_message = ?, confirmed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, options.txSignature || null, options.errorMessage || null, id]
    );
  } else {
    execute(
      `UPDATE transactions 
       SET status = ?, tx_signature = COALESCE(?, tx_signature), error_message = ?
       WHERE id = ?`,
      [status, options.txSignature || null, options.errorMessage || null, id]
    );
  }
  
  return queryOne<Transaction>('SELECT * FROM transactions WHERE id = ?', [id])!;
}

export function getTransactionsByWallet(walletId: number, limit: number = 20): Transaction[] {
  return query<Transaction>(
    `SELECT * FROM transactions 
     WHERE from_wallet_id = ? OR to_wallet_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [walletId, walletId, limit]
  );
}

// ============= Spending Limit Queries =============

export function getOrCreateSpendingLimit(walletId: number): SpendingLimit {
  // Check if limit exists
  let existing = queryOne<SpendingLimit>(
    'SELECT * FROM spending_limits WHERE wallet_id = ?',
    [walletId]
  );
  
  if (existing) {
    // Reset if it's a new day
    const today = new Date().toISOString().split('T')[0];
    if (existing.reset_date !== today) {
      execute(
        `UPDATE spending_limits 
         SET used_today = 0, reset_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE wallet_id = ?`,
        [today, walletId]
      );
      return queryOne<SpendingLimit>('SELECT * FROM spending_limits WHERE wallet_id = ?', [walletId])!;
    }
    return existing;
  }
  
  // Create new limit
  const defaultLimit = parseFloat(process.env.DEFAULT_DAILY_LIMIT || '1000');
  const today = new Date().toISOString().split('T')[0];
  
  execute(
    `INSERT INTO spending_limits (wallet_id, daily_limit, reset_date)
     VALUES (?, ?, ?)`,
    [walletId, defaultLimit, today]
  );
  
  return queryOne<SpendingLimit>('SELECT * FROM spending_limits WHERE wallet_id = ?', [walletId])!;
}

export function updateSpendingLimit(walletId: number, newLimit: number): SpendingLimit {
  const existing = queryOne<SpendingLimit>(
    'SELECT * FROM spending_limits WHERE wallet_id = ?',
    [walletId]
  );
  
  if (!existing) {
    // Create if doesn't exist
    getOrCreateSpendingLimit(walletId);
  }
  
  execute(
    `UPDATE spending_limits 
     SET daily_limit = ?, updated_at = CURRENT_TIMESTAMP
     WHERE wallet_id = ?`,
    [newLimit, walletId]
  );
  
  return queryOne<SpendingLimit>('SELECT * FROM spending_limits WHERE wallet_id = ?', [walletId])!;
}

export function recordSpending(walletId: number, amount: number): SpendingLimit {
  // Ensure limit exists and is reset if needed
  getOrCreateSpendingLimit(walletId);
  
  execute(
    `UPDATE spending_limits 
     SET used_today = used_today + ?, updated_at = CURRENT_TIMESTAMP
     WHERE wallet_id = ?`,
    [amount, walletId]
  );
  
  return queryOne<SpendingLimit>('SELECT * FROM spending_limits WHERE wallet_id = ?', [walletId])!;
}

export function checkSpendingAllowed(walletId: number, amount: number): { allowed: boolean; remaining: number } {
  const limit = getOrCreateSpendingLimit(walletId);
  const remaining = limit.daily_limit - limit.used_today;
  
  return {
    allowed: amount <= remaining,
    remaining,
  };
}

// ============= Combined Operations =============

export function executeTransfer(
  fromWalletId: number,
  toWalletId: number,
  amount: number,
  txSignature: string,
  fee: number = 0
): Transaction {
  return runTransaction(() => {
    // Record spending
    recordSpending(fromWalletId, amount + fee);
    
    // Create transaction record
    const tx = createTransaction(fromWalletId, amount, 'transfer', {
      toWalletId,
      fee,
      txSignature,
    });
    
    // Mark as confirmed
    return updateTransactionStatus(tx.id, 'confirmed', { txSignature });
  });
}

/**
 * Transaction service - handles USDC transfers between wallets
 */

import { PublicKey } from '@solana/web3.js';
import {
  transferUsdc,
  hasEnoughUsdc,
  getExplorerUrl,
} from '../utils/solana.js';
import {
  createTransaction,
  updateTransactionStatus,
  checkSpendingAllowed,
  recordSpending,
  getTransactionsByWallet,
  executeTransfer,
} from '../db/queries.js';
import { getWalletKeypair } from './wallet.js';
import type { Wallet, Transaction } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TransactionService');

export interface TransferResult {
  success: boolean;
  transaction?: Transaction;
  signature?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Transfer USDC from one wallet to another
 */
export async function transfer(
  fromWallet: Wallet,
  toWallet: Wallet,
  amount: number
): Promise<TransferResult> {
  logger.info('Initiating transfer', {
    from: fromWallet.public_key,
    to: toWallet.public_key,
    amount,
  });

  // Check spending limits
  const { allowed, remaining } = checkSpendingAllowed(fromWallet.id, amount);
  if (!allowed) {
    return {
      success: false,
      error: `Daily spending limit exceeded. Remaining: $${remaining.toFixed(2)}`,
    };
  }

  // Check balance
  const fromPublicKey = new PublicKey(fromWallet.public_key);
  const hasBalance = await hasEnoughUsdc(fromPublicKey, amount);
  if (!hasBalance) {
    return {
      success: false,
      error: 'Insufficient USDC balance',
    };
  }

  // Calculate platform fee
  const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '1');
  const fee = amount * (feePercent / 100);
  const netAmount = amount - fee;

  // Create pending transaction record
  const pendingTx = createTransaction(fromWallet.id, amount, 'transfer', {
    toWalletId: toWallet.id,
    fee,
  });

  try {
    // Execute on-chain transfer
    const fromKeypair = getWalletKeypair(fromWallet);
    const toPublicKey = new PublicKey(toWallet.public_key);
    
    const signature = await transferUsdc(fromKeypair, toPublicKey, netAmount);
    
    // Update transaction record
    const confirmedTx = executeTransfer(
      fromWallet.id,
      toWallet.id,
      amount,
      signature,
      fee
    );
    
    const explorerUrl = getExplorerUrl(signature, process.env.SOLANA_NETWORK || 'devnet');
    
    logger.info('Transfer successful', { signature, amount, fee });
    
    return {
      success: true,
      transaction: confirmedTx,
      signature,
      explorerUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update transaction as failed
    updateTransactionStatus(pendingTx.id, 'failed', { errorMessage });
    
    logger.error('Transfer failed', { error: errorMessage });
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Transfer USDC to an external address (not in our system)
 */
export async function transferExternal(
  fromWallet: Wallet,
  toAddress: string,
  amount: number
): Promise<TransferResult> {
  logger.info('Initiating external transfer', {
    from: fromWallet.public_key,
    to: toAddress,
    amount,
  });

  // Validate address
  let toPublicKey: PublicKey;
  try {
    toPublicKey = new PublicKey(toAddress);
  } catch {
    return {
      success: false,
      error: 'Invalid Solana address',
    };
  }

  // Check spending limits
  const { allowed, remaining } = checkSpendingAllowed(fromWallet.id, amount);
  if (!allowed) {
    return {
      success: false,
      error: `Daily spending limit exceeded. Remaining: $${remaining.toFixed(2)}`,
    };
  }

  // Check balance
  const fromPublicKey = new PublicKey(fromWallet.public_key);
  const hasBalance = await hasEnoughUsdc(fromPublicKey, amount);
  if (!hasBalance) {
    return {
      success: false,
      error: 'Insufficient USDC balance',
    };
  }

  // Create pending transaction
  const pendingTx = createTransaction(fromWallet.id, amount, 'transfer', {
    toExternalAddress: toAddress,
  });

  try {
    const fromKeypair = getWalletKeypair(fromWallet);
    const signature = await transferUsdc(fromKeypair, toPublicKey, amount);
    
    // Record spending and update transaction
    recordSpending(fromWallet.id, amount);
    const confirmedTx = updateTransactionStatus(pendingTx.id, 'confirmed', { txSignature: signature });
    
    const explorerUrl = getExplorerUrl(signature, process.env.SOLANA_NETWORK || 'devnet');
    
    return {
      success: true,
      transaction: confirmedTx,
      signature,
      explorerUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateTransactionStatus(pendingTx.id, 'failed', { errorMessage });
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get transaction history for a wallet
 */
export function getHistory(walletId: number, limit: number = 20): Transaction[] {
  return getTransactionsByWallet(walletId, limit);
}


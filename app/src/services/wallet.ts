/**
 * Wallet service - manages Solana wallet creation and operations
 */

import { PublicKey } from '@solana/web3.js';
import {
  generateKeypair,
  keypairToBase58,
  keypairFromBase58,
  getSolBalance,
  getUsdcBalance,
  requestAirdrop,
} from '../utils/solana.js';
import {
  createWallet,
  getWalletsByUserId,
  getWalletByPublicKey,
  getPrimaryWallet,
  getWalletById,
} from '../db/queries.js';
import type { Wallet } from '../db/schema.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('WalletService');

export interface WalletBalance {
  sol: number;
  usdc: number;
}

export interface WalletInfo {
  wallet: Wallet;
  balance: WalletBalance;
}

/**
 * Create a new wallet for a user
 */
export async function createNewWallet(
  userId: number,
  walletType: 'human' | 'agent',
  label?: string
): Promise<Wallet> {
  logger.info('Creating new wallet', { userId, walletType });
  
  // Generate new keypair
  const keypair = generateKeypair();
  const publicKey = keypair.publicKey.toBase58();
  const encryptedSecretKey = keypairToBase58(keypair);
  
  // Store in database
  const wallet = createWallet(userId, publicKey, encryptedSecretKey, walletType, label);
  
  // Request SOL airdrop for gas on devnet
  if (process.env.SOLANA_NETWORK === 'devnet') {
    try {
      await requestAirdrop(keypair.publicKey, 1);
      logger.info('Airdropped 1 SOL to new wallet', { publicKey });
    } catch (error) {
      logger.warn('Failed to airdrop SOL', { error, publicKey });
      // Don't fail wallet creation if airdrop fails
    }
  }
  
  return wallet;
}

/**
 * Get wallet balance (SOL + USDC)
 */
export async function getWalletBalance(wallet: Wallet): Promise<WalletBalance> {
  const publicKey = new PublicKey(wallet.public_key);
  
  const [sol, usdc] = await Promise.all([
    getSolBalance(publicKey),
    getUsdcBalance(publicKey),
  ]);
  
  return { sol, usdc };
}

/**
 * Get wallet info including balance
 */
export async function getWalletInfo(wallet: Wallet): Promise<WalletInfo> {
  const balance = await getWalletBalance(wallet);
  return { wallet, balance };
}

/**
 * Get user's primary wallet with balance
 */
export async function getUserPrimaryWallet(userId: number): Promise<WalletInfo | null> {
  const wallet = getPrimaryWallet(userId);
  
  if (!wallet) {
    return null;
  }
  
  return getWalletInfo(wallet);
}

/**
 * Get all wallets for a user with balances
 */
export async function getUserWallets(userId: number): Promise<WalletInfo[]> {
  const wallets = getWalletsByUserId(userId);
  
  return Promise.all(wallets.map(wallet => getWalletInfo(wallet)));
}

/**
 * Find wallet by public key
 */
export function findWalletByAddress(publicKey: string): Wallet | undefined {
  return getWalletByPublicKey(publicKey);
}

/**
 * Get the keypair for a wallet (for signing transactions)
 */
export function getWalletKeypair(wallet: Wallet) {
  return keypairFromBase58(wallet.encrypted_secret_key);
}

/**
 * Resolve a wallet identifier (could be public key, label, or wallet ID)
 */
export function resolveWallet(identifier: string, userId?: number): Wallet | undefined {
  // Try as public key first
  const byKey = getWalletByPublicKey(identifier);
  if (byKey) return byKey;
  
  // Try as numeric ID
  const numId = parseInt(identifier, 10);
  if (!isNaN(numId)) {
    const byId = getWalletById(numId);
    if (byId) return byId;
  }
  
  // If userId provided, could search by label
  // (not implemented yet, but easy to add)
  
  return undefined;
}


/**
 * Solana connection and utility helpers
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { createLogger } from './logger.js';

const logger = createLogger('Solana');

// Devnet USDC mint address (we'll use a custom one for testing)
// In production, use Circle's official USDC mint
export const DEVNET_USDC_MINT = new PublicKey(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Devnet USDC
);

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

/**
 * Get a connection to Solana
 */
export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Generate a new Solana keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Convert keypair to base58 string for storage
 */
export function keypairToBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

/**
 * Restore keypair from base58 string
 */
export function keypairFromBase58(secretKey: string): Keypair {
  const decoded = bs58.decode(secretKey);
  return Keypair.fromSecretKey(decoded);
}

/**
 * Get SOL balance for a wallet
 */
export async function getSolBalance(publicKey: PublicKey): Promise<number> {
  const connection = getConnection();
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get USDC balance for a wallet
 */
export async function getUsdcBalance(
  ownerPublicKey: PublicKey,
  usdcMint: PublicKey = DEVNET_USDC_MINT
): Promise<number> {
  const connection = getConnection();
  
  try {
    const tokenAccounts = await connection.getTokenAccountsByOwner(ownerPublicKey, {
      mint: usdcMint,
    });

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const accountInfo = await getAccount(connection, tokenAccounts.value[0].pubkey);
    return Number(accountInfo.amount) / Math.pow(10, USDC_DECIMALS);
  } catch (error) {
    logger.debug('No USDC account found', { owner: ownerPublicKey.toBase58() });
    return 0;
  }
}

/**
 * Request SOL airdrop on devnet
 */
export async function requestAirdrop(
  publicKey: PublicKey,
  solAmount: number = 1
): Promise<string> {
  const connection = getConnection();
  
  logger.info(`Requesting airdrop of ${solAmount} SOL`, { 
    wallet: publicKey.toBase58() 
  });
  
  const signature = await connection.requestAirdrop(
    publicKey,
    solAmount * LAMPORTS_PER_SOL
  );
  
  await connection.confirmTransaction(signature, 'confirmed');
  
  logger.info('Airdrop confirmed', { signature });
  return signature;
}

/**
 * Transfer USDC between wallets
 */
export async function transferUsdc(
  fromKeypair: Keypair,
  toPublicKey: PublicKey,
  amount: number,
  usdcMint: PublicKey = DEVNET_USDC_MINT
): Promise<string> {
  const connection = getConnection();
  
  logger.info('Initiating USDC transfer', {
    from: fromKeypair.publicKey.toBase58(),
    to: toPublicKey.toBase58(),
    amount,
  });

  // Get or create token accounts
  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeypair,
    usdcMint,
    fromKeypair.publicKey
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeypair, // Payer for account creation
    usdcMint,
    toPublicKey
  );

  // Transfer tokens
  const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, USDC_DECIMALS)));
  
  const signature = await transfer(
    connection,
    fromKeypair,
    fromTokenAccount.address,
    toTokenAccount.address,
    fromKeypair,
    amountInSmallestUnit
  );

  logger.info('USDC transfer complete', { signature });
  return signature;
}

/**
 * Check if a wallet has enough USDC for a transfer
 */
export async function hasEnoughUsdc(
  publicKey: PublicKey,
  amount: number
): Promise<boolean> {
  const balance = await getUsdcBalance(publicKey);
  return balance >= amount;
}

/**
 * Format a Solana explorer URL
 */
export function getExplorerUrl(signature: string, network: string = 'devnet'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
}


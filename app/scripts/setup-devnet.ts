/**
 * Setup script for Solana devnet testing
 * 
 * This script:
 * 1. Creates a test wallet
 * 2. Airdrops SOL for gas fees
 * 3. Provides instructions for getting devnet USDC
 */

import 'dotenv/config';
import {
  getConnection,
  generateKeypair,
  keypairToBase58,
  requestAirdrop,
  getSolBalance,
} from '../src/utils/solana.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('SetupDevnet');

async function main() {
  console.log('\n🚀 Setting up Solana Devnet for Agent Payments\n');
  console.log('='.repeat(50));

  const connection = getConnection();
  
  // Check connection
  try {
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana devnet (v${version['solana-core']})`);
  } catch (error) {
    console.error('❌ Failed to connect to Solana devnet');
    process.exit(1);
  }

  // Generate test wallet
  console.log('\n📝 Creating test wallet...');
  const testWallet = generateKeypair();
  const publicKey = testWallet.publicKey.toBase58();
  const secretKey = keypairToBase58(testWallet);

  console.log(`   Public Key: ${publicKey}`);
  console.log(`   Secret Key: ${secretKey.slice(0, 20)}...`);

  // Airdrop SOL
  console.log('\n💧 Requesting SOL airdrop...');
  try {
    await requestAirdrop(testWallet.publicKey, 2);
    const balance = await getSolBalance(testWallet.publicKey);
    console.log(`   ✅ Airdrop successful! Balance: ${balance} SOL`);
  } catch (error) {
    console.log('   ⚠️ Airdrop failed (rate limited). Try again in a minute.');
  }

  // Instructions
  console.log('\n' + '='.repeat(50));
  console.log('\n📋 Next Steps:\n');
  
  console.log('1️⃣  Get Devnet USDC:');
  console.log('    Visit: https://faucet.circle.com/');
  console.log('    - Select "Solana" and "USDC"');
  console.log('    - Paste your wallet address:');
  console.log(`    ${publicKey}\n`);

  console.log('2️⃣  Create your .env file:');
  console.log('    Copy .env.example to .env');
  console.log('    Add your Telegram bot token\n');

  console.log('3️⃣  Get a Telegram Bot Token:');
  console.log('    - Message @BotFather on Telegram');
  console.log('    - Send /newbot and follow instructions');
  console.log('    - Copy the token to your .env file\n');

  console.log('4️⃣  Start the bot:');
  console.log('    npm run dev\n');

  console.log('='.repeat(50));
  console.log('\n🎉 Setup complete! Save the wallet info above.\n');

  // Output wallet info for easy copying
  console.log('📦 Wallet JSON (save this):');
  console.log(JSON.stringify({
    publicKey,
    secretKey,
  }, null, 2));
}

main().catch(console.error);

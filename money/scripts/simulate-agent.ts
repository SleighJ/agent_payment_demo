/**
 * Simulation script for testing agent-to-agent payments
 * 
 * Creates two "agents" and simulates transfers between them.
 */

import 'dotenv/config';
import { initDb, closeDb } from '../src/db/index.js';
import { createUser } from '../src/db/queries.js';
import { createNewWallet, getWalletBalance } from '../src/services/wallet.js';
import { transfer } from '../src/services/transaction.js';
import { setLimit, getLimitStatus } from '../src/services/limits.js';
import { createLogger } from '../src/utils/logger.js';
import { getUsdcBalance } from '../src/utils/solana.js';
import { PublicKey } from '@solana/web3.js';

const logger = createLogger('Simulate');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🤖 Agent Payment Simulation\n');
  console.log('='.repeat(50));

  // Initialize database (async)
  await initDb('./data/simulation.db');

  try {
    // Create two test users (simulating agent operators)
    console.log('\n👥 Creating test users...');
    const user1 = createUser('sim_user_1', 'agent_alice');
    const user2 = createUser('sim_user_2', 'agent_bob');
    console.log(`   User 1 (Alice): ID ${user1.id}`);
    console.log(`   User 2 (Bob): ID ${user2.id}`);

    // Create wallets for each user
    console.log('\n💼 Creating agent wallets...');
    const wallet1 = await createNewWallet(user1.id, 'agent', 'Alice Agent');
    const wallet2 = await createNewWallet(user2.id, 'agent', 'Bob Agent');
    
    console.log(`   Alice's wallet: ${wallet1.public_key.slice(0, 16)}...`);
    console.log(`   Bob's wallet: ${wallet2.public_key.slice(0, 16)}...`);

    // Wait for airdrops to confirm
    console.log('\n⏳ Waiting for SOL airdrops to confirm...');
    await sleep(2000);

    // Check balances
    console.log('\n💰 Initial balances:');
    const balance1 = await getWalletBalance(wallet1);
    const balance2 = await getWalletBalance(wallet2);
    console.log(`   Alice: ${balance1.sol.toFixed(4)} SOL, ${balance1.usdc.toFixed(2)} USDC`);
    console.log(`   Bob: ${balance2.sol.toFixed(4)} SOL, ${balance2.usdc.toFixed(2)} USDC`);

    // Set spending limits
    console.log('\n📊 Setting spending limits...');
    setLimit(wallet1.id, 500);
    setLimit(wallet2.id, 500);
    console.log('   Both agents: $500/day limit');

    // Note about USDC
    console.log('\n' + '='.repeat(50));
    console.log('\n⚠️  To test transfers, you need devnet USDC!');
    console.log('\n   Get free devnet USDC from:');
    console.log('   https://faucet.circle.com/\n');
    console.log('   Send USDC to Alice\'s wallet:');
    console.log(`   ${wallet1.public_key}\n`);
    console.log('='.repeat(50));

    // Check if Alice has USDC
    const aliceUsdc = await getUsdcBalance(new PublicKey(wallet1.public_key));
    
    if (aliceUsdc > 0) {
      console.log('\n🔄 Simulating payment: Alice → Bob');
      console.log(`   Alice has ${aliceUsdc.toFixed(2)} USDC`);
      
      const transferAmount = Math.min(10, aliceUsdc * 0.5);
      console.log(`   Transferring ${transferAmount.toFixed(2)} USDC...`);
      
      const result = await transfer(wallet1, wallet2, transferAmount);
      
      if (result.success) {
        console.log('   ✅ Transfer successful!');
        console.log(`   Signature: ${result.signature?.slice(0, 32)}...`);
        console.log(`   Explorer: ${result.explorerUrl}`);
        
        // Check new balances
        console.log('\n💰 New balances:');
        const newBalance1 = await getWalletBalance(wallet1);
        const newBalance2 = await getWalletBalance(wallet2);
        console.log(`   Alice: ${newBalance1.usdc.toFixed(2)} USDC`);
        console.log(`   Bob: ${newBalance2.usdc.toFixed(2)} USDC`);
        
        // Check spending limit usage
        const limit1 = getLimitStatus(wallet1.id);
        console.log(`\n   Alice's daily limit usage: $${limit1.usedToday.toFixed(2)} / $${limit1.dailyLimit.toFixed(2)}`);
      } else {
        console.log(`   ❌ Transfer failed: ${result.error}`);
      }
    } else {
      console.log('\n⏭️  Skipping transfer test (no USDC balance)');
      console.log('   Fund the wallet above and run this script again.');
    }

    console.log('\n✅ Simulation complete!\n');

  } finally {
    closeDb();
  }
}

main().catch((error) => {
  console.error('Simulation error:', error);
  closeDb();
  process.exit(1);
});

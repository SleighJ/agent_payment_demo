/**
 * /connect command - Create a new Solana wallet
 */

import type { BotContext } from '../index.js';
import { getUserByTelegramId, createUser } from '../../db/queries.js';
import { createNewWallet, getUserWallets } from '../../services/wallet.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ConnectCommand');

export async function connectCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('❌ Could not identify your Telegram account.');
    return;
  }

  // Ensure user exists
  let user = getUserByTelegramId(telegramId);
  if (!user) {
    user = createUser(telegramId, username);
  }

  // Check existing wallets
  const existingWallets = await getUserWallets(user.id);
  
  // Parse optional wallet type from command
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  const walletType = args[0] === 'agent' ? 'agent' : 'human';
  const label = args.slice(walletType === 'agent' ? 1 : 0).join(' ') || undefined;

  await ctx.reply('🔄 Creating your wallet...');

  try {
    const wallet = await createNewWallet(user.id, walletType, label);
    
    const message = `
✅ **Wallet Created!**

📍 **Address:**
\`${wallet.public_key}\`

🏷️ **Type:** ${walletType === 'agent' ? '🤖 Agent' : '👤 Human'}
${label ? `📝 **Label:** ${label}` : ''}

💡 **Next Steps:**
${process.env.SOLANA_NETWORK === 'devnet' 
  ? `• I've airdropped some SOL for gas fees
• Get devnet USDC from a faucet to test transfers`
  : `• Send SOL to this address for gas fees
• Send USDC to start making payments`
}

Use /balance to check your wallet.
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    logger.info('Wallet created', { 
      userId: user.id, 
      walletType, 
      publicKey: wallet.public_key 
    });
    
  } catch (error) {
    logger.error('Failed to create wallet', { error, userId: user.id });
    await ctx.reply('❌ Failed to create wallet. Please try again.');
  }
}


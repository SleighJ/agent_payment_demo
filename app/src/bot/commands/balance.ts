/**
 * /balance command - Check wallet balance
 */

import type { BotContext } from '../index.js';
import { getUserByTelegramId } from '../../db/queries.js';
import { getUserWallets } from '../../services/wallet.js';
import { getLimitStatus } from '../../services/limits.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('BalanceCommand');

export async function balanceCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId) {
    await ctx.reply('❌ Could not identify your Telegram account.');
    return;
  }

  const user = getUserByTelegramId(telegramId);
  if (!user) {
    await ctx.reply('❌ Please use /start first to create an account.');
    return;
  }

  const wallets = await getUserWallets(user.id);

  if (wallets.length === 0) {
    await ctx.reply(
      '💼 You don\'t have any wallets yet.\n\nUse /connect to create one!'
    );
    return;
  }

  let message = '💰 **Your Wallets**\n\n';

  for (const { wallet, balance } of wallets) {
    const limitStatus = getLimitStatus(wallet.id);
    const typeEmoji = wallet.wallet_type === 'agent' ? '🤖' : '👤';
    
    message += `${typeEmoji} **${wallet.label || `Wallet #${wallet.id}`}**\n`;
    message += `📍 \`${wallet.public_key.slice(0, 8)}...${wallet.public_key.slice(-8)}\`\n`;
    message += `💵 USDC: **$${balance.usdc.toFixed(2)}**\n`;
    message += `⛽ SOL: ${balance.sol.toFixed(4)}\n`;
    message += `📊 Daily Limit: $${limitStatus.remaining.toFixed(2)} / $${limitStatus.dailyLimit.toFixed(2)}\n`;
    message += '\n';
  }

  // Add total if multiple wallets
  if (wallets.length > 1) {
    const totalUsdc = wallets.reduce((sum, w) => sum + w.balance.usdc, 0);
    const totalSol = wallets.reduce((sum, w) => sum + w.balance.sol, 0);
    message += `📊 **Total:** $${totalUsdc.toFixed(2)} USDC, ${totalSol.toFixed(4)} SOL`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
  
  logger.debug('Balance checked', { userId: user.id, walletCount: wallets.length });
}


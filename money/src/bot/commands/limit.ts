/**
 * /limit command - View and set daily spending limits
 * 
 * Usage: 
 *   /limit - View current limit
 *   /limit <amount> - Set new daily limit
 */

import type { BotContext } from '../index.js';
import { getUserByTelegramId } from '../../db/queries.js';
import { getUserPrimaryWallet } from '../../services/wallet.js';
import { getLimitStatus, setLimit, formatLimitStatus } from '../../services/limits.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('LimitCommand');

export async function limitCommand(ctx: BotContext): Promise<void> {
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

  const walletInfo = await getUserPrimaryWallet(user.id);
  if (!walletInfo) {
    await ctx.reply('❌ You need a wallet first. Use /connect to create one.');
    return;
  }

  const { wallet } = walletInfo;

  // Parse arguments
  const args = ctx.message?.text?.split(' ').slice(1) || [];

  if (args.length === 0) {
    // Show current limit
    const status = getLimitStatus(wallet.id);
    
    const message = `
📊 **Daily Spending Limit**

${formatLimitStatus(status)}

To change your limit, use:
\`/limit <new_amount>\`

Example: \`/limit 500\` to set a $500 daily limit
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  // Set new limit
  const newLimit = parseFloat(args[0]);

  if (isNaN(newLimit) || newLimit < 0) {
    await ctx.reply('❌ Invalid amount. Please enter a positive number.');
    return;
  }

  try {
    const status = setLimit(wallet.id, newLimit);
    
    const message = `
✅ **Spending Limit Updated!**

${formatLimitStatus(status)}
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    logger.info('Spending limit updated', {
      userId: user.id,
      walletId: wallet.id,
      newLimit,
    });
  } catch (error) {
    logger.error('Failed to update limit', { error });
    await ctx.reply('❌ Failed to update limit. Please try again.');
  }
}


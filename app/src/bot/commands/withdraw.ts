/**
 * /withdraw command - Initiate fiat off-ramp (USDC to bank)
 * 
 * Usage: /withdraw <amount>
 */

import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../index.js';
import { getUserByTelegramId } from '../../db/queries.js';
import { getUserPrimaryWallet } from '../../services/wallet.js';
import { initiateWithdrawal } from '../../services/fiat.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('WithdrawCommand');

export async function withdrawCommand(ctx: BotContext): Promise<void> {
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

  const { wallet, balance } = walletInfo;

  // Parse arguments
  const args = ctx.message?.text?.split(' ').slice(1) || [];

  if (args.length === 0) {
    await ctx.reply(
      '💵 **Withdraw to Bank**\n\n' +
      'Convert your USDC to USD and withdraw to your bank account.\n\n' +
      `💰 Available: **$${balance.usdc.toFixed(2)} USDC**\n\n` +
      '**Usage:** `/withdraw <amount>`\n' +
      '**Example:** `/withdraw 100`\n\n' +
      '📍 Minimum withdrawal: $10\n' +
      '📉 Fee: 1.5%\n' +
      '⏱️ Arrival: 2-3 business days',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const amount = parseFloat(args[0]);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Invalid amount. Please enter a positive number.');
    return;
  }

  if (amount < 10) {
    await ctx.reply('❌ Minimum withdrawal is $10 USDC.');
    return;
  }

  if (amount > balance.usdc) {
    await ctx.reply(
      `❌ Insufficient balance.\n\n` +
      `💰 Available: $${balance.usdc.toFixed(2)} USDC\n` +
      `💸 Requested: $${amount.toFixed(2)} USDC`
    );
    return;
  }

  // Calculate preview
  const feePercent = 1.5;
  const fee = amount * (feePercent / 100);
  const netAmount = amount - fee;

  // Show confirmation
  const confirmMessage = `
🏦 **Confirm Withdrawal**

💵 Amount: **$${amount.toFixed(2)} USDC**
📉 Fee (${feePercent}%): $${fee.toFixed(2)}
💰 You'll receive: **$${netAmount.toFixed(2)} USD**

⏱️ Estimated arrival: 2-3 business days

⚠️ **DEVNET MODE:** This is a simulation. No real money will be transferred.

Ready to proceed?
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('✅ Confirm', `confirm:withdraw:${amount}`)
    .text('❌ Cancel', 'cancel');

  ctx.session.awaitingConfirmation = {
    type: 'withdraw',
    data: { amount },
  };

  const sentMessage = await ctx.reply(confirmMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  // Handle confirmation via callback
  // Note: Actual processing happens in the callback handler
}

/**
 * Process withdrawal confirmation
 */
export async function processWithdrawalConfirmation(
  ctx: BotContext,
  amount: number
): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = getUserByTelegramId(telegramId);
  if (!user) return;

  const walletInfo = await getUserPrimaryWallet(user.id);
  if (!walletInfo) return;

  await ctx.editMessageText('⏳ Processing withdrawal...', {
    parse_mode: 'Markdown',
  });

  try {
    const result = await initiateWithdrawal(user.id, walletInfo.wallet.id, amount);

    if (result.success) {
      await ctx.editMessageText(result.message, { parse_mode: 'Markdown' });
      
      logger.info('Withdrawal initiated', {
        userId: user.id,
        amount,
        requestId: result.request?.id,
      });
    } else {
      await ctx.editMessageText(`❌ ${result.message}`);
    }
  } catch (error) {
    logger.error('Withdrawal error', { error });
    await ctx.editMessageText('❌ Withdrawal failed. Please try again.');
  }

  ctx.session.awaitingConfirmation = undefined;
}


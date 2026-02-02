/**
 * /pay command - Send USDC to another wallet
 * 
 * Usage: /pay <address or @username> <amount>
 */

import { InlineKeyboard } from 'grammy';
import type { BotContext } from '../index.js';
import { getUserByTelegramId } from '../../db/queries.js';
import { getUserPrimaryWallet, findWalletByAddress } from '../../services/wallet.js';
import { transfer, transferExternal } from '../../services/transaction.js';
import { canSpend } from '../../services/limits.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('PayCommand');

export async function payCommand(ctx: BotContext): Promise<void> {
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

  // Parse command arguments
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  
  if (args.length < 2) {
    await ctx.reply(
      '📝 **Usage:** `/pay <address> <amount>`\n\n' +
      '**Examples:**\n' +
      '• `/pay 7xKX...ABC 50` - Send 50 USDC to an address\n' +
      '• `/pay @alice 25.50` - Send to another user (coming soon)',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const [recipient, amountStr] = args;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Invalid amount. Please enter a positive number.');
    return;
  }

  // Get user's primary wallet
  const walletInfo = await getUserPrimaryWallet(user.id);
  if (!walletInfo) {
    await ctx.reply('❌ You need a wallet first. Use /connect to create one.');
    return;
  }

  const { wallet: fromWallet, balance } = walletInfo;

  // Check balance
  if (balance.usdc < amount) {
    await ctx.reply(
      `❌ Insufficient balance.\n\n` +
      `💰 Your balance: $${balance.usdc.toFixed(2)} USDC\n` +
      `💸 Requested: $${amount.toFixed(2)} USDC`
    );
    return;
  }

  // Check spending limit
  const { allowed, remaining } = canSpend(fromWallet.id, amount);
  if (!allowed) {
    await ctx.reply(
      `❌ Daily spending limit exceeded.\n\n` +
      `📊 Remaining today: $${remaining.toFixed(2)}\n` +
      `💸 Requested: $${amount.toFixed(2)}\n\n` +
      `Use /limit to adjust your daily limit.`
    );
    return;
  }

  // Check if recipient is in our system
  const recipientWallet = findWalletByAddress(recipient);
  const isInternal = !!recipientWallet;

  // Calculate fee
  const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '1');
  const fee = amount * (feePercent / 100);

  // Show confirmation
  const confirmMessage = `
🔄 **Confirm Payment**

📤 From: \`${fromWallet.public_key.slice(0, 8)}...${fromWallet.public_key.slice(-8)}\`
📥 To: \`${recipient.slice(0, 8)}...${recipient.slice(-8)}\`
${isInternal ? '✅ Recipient is in our system' : '⚠️ External address'}

💵 Amount: **$${amount.toFixed(2)} USDC**
📉 Fee (${feePercent}%): $${fee.toFixed(2)}
💰 Total: **$${(amount).toFixed(2)} USDC**

Ready to send?
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('✅ Confirm', `confirm:pay:${recipient}:${amount}`)
    .text('❌ Cancel', 'cancel');

  // Store confirmation data in session
  ctx.session.awaitingConfirmation = {
    type: 'pay',
    data: { recipient, amount, isInternal },
  };

  const sentMessage = await ctx.reply(confirmMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  // Set up callback handler for this specific confirmation
  // We'll use a one-time listener approach
  const callbackHandler = async (callbackCtx: BotContext) => {
    if (callbackCtx.callbackQuery?.data?.startsWith('confirm:pay:')) {
      await callbackCtx.answerCallbackQuery();
      
      // Remove keyboard
      await callbackCtx.editMessageText('⏳ Processing payment...', {
        parse_mode: 'Markdown',
      });

      try {
        let result;
        
        if (isInternal && recipientWallet) {
          result = await transfer(fromWallet, recipientWallet, amount);
        } else {
          result = await transferExternal(fromWallet, recipient, amount);
        }

        if (result.success) {
          const successMessage = `
✅ **Payment Sent!**

💵 Amount: $${amount.toFixed(2)} USDC
📥 To: \`${recipient.slice(0, 8)}...${recipient.slice(-8)}\`

🔗 [View on Explorer](${result.explorerUrl})
          `.trim();

          await callbackCtx.editMessageText(successMessage, {
            parse_mode: 'Markdown',
          });

          logger.info('Payment sent', {
            from: fromWallet.public_key,
            to: recipient,
            amount,
            signature: result.signature,
          });
        } else {
          await callbackCtx.editMessageText(
            `❌ Payment failed: ${result.error}`
          );
        }
      } catch (error) {
        logger.error('Payment error', { error });
        await callbackCtx.editMessageText(
          '❌ Payment failed. Please try again.'
        );
      }

      ctx.session.awaitingConfirmation = undefined;
    }
  };

  // Note: In grammY, we handle callbacks globally in the bot setup
  // The actual confirmation is processed via the callback query handler
}


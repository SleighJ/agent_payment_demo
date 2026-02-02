/**
 * /history command - View transaction history
 */

import type { BotContext } from '../index.js';
import { getUserByTelegramId } from '../../db/queries.js';
import { getUserPrimaryWallet } from '../../services/wallet.js';
import { getHistory } from '../../services/transaction.js';
import { getExplorerUrl } from '../../utils/solana.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('HistoryCommand');

export async function historyCommand(ctx: BotContext): Promise<void> {
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
  const transactions = getHistory(wallet.id, 10);

  if (transactions.length === 0) {
    await ctx.reply(
      '📜 **Transaction History**\n\n' +
      'No transactions yet.\n\n' +
      'Use /pay to send your first payment!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let message = '📜 **Transaction History**\n\n';

  for (const tx of transactions) {
    const isOutgoing = tx.from_wallet_id === wallet.id;
    const emoji = isOutgoing ? '📤' : '📥';
    const direction = isOutgoing ? 'Sent' : 'Received';
    const statusEmoji = tx.status === 'confirmed' ? '✅' : tx.status === 'pending' ? '⏳' : '❌';
    
    const date = new Date(tx.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    message += `${emoji} **${direction}** $${tx.amount.toFixed(2)} ${tx.token}\n`;
    message += `   ${statusEmoji} ${tx.status} • ${date}\n`;
    
    if (tx.tx_signature) {
      const explorerUrl = getExplorerUrl(tx.tx_signature, process.env.SOLANA_NETWORK || 'devnet');
      message += `   🔗 [View on Explorer](${explorerUrl})\n`;
    }
    
    if (tx.fee > 0) {
      message += `   📉 Fee: $${tx.fee.toFixed(2)}\n`;
    }
    
    message += '\n';
  }

  message += `_Showing last ${transactions.length} transactions_`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    // Disable link preview
    link_preview_options: { is_disabled: true },
  });
  
  logger.debug('History viewed', { userId: user.id, count: transactions.length });
}


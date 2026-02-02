/**
 * Telegram bot setup using grammY
 */

import { Bot, Context, session, SessionFlavor } from 'grammy';
import { createLogger } from '../utils/logger.js';

// Import command handlers
import { startCommand } from './commands/start.js';
import { connectCommand } from './commands/connect.js';
import { balanceCommand } from './commands/balance.js';
import { payCommand } from './commands/pay.js';
import { limitCommand } from './commands/limit.js';
import { withdrawCommand } from './commands/withdraw.js';
import { historyCommand } from './commands/history.js';
import { helpCommand } from './commands/help.js';

const logger = createLogger('Bot');

// Session data interface
export interface SessionData {
  awaitingConfirmation?: {
    type: 'pay' | 'withdraw';
    data: Record<string, unknown>;
  };
}

// Custom context type with session
export type BotContext = Context & SessionFlavor<SessionData>;

/**
 * Create and configure the Telegram bot
 */
export function createBot(): Bot<BotContext> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const bot = new Bot<BotContext>(token);

  // Initialize session
  bot.use(session({
    initial: (): SessionData => ({}),
  }));

  // Error handler
  bot.catch((err) => {
    logger.error('Bot error', { error: err.message, stack: err.stack });
  });

  // Register commands
  bot.command('start', startCommand);
  bot.command('connect', connectCommand);
  bot.command('balance', balanceCommand);
  bot.command('pay', payCommand);
  bot.command('limit', limitCommand);
  bot.command('withdraw', withdrawCommand);
  bot.command('history', historyCommand);
  bot.command('help', helpCommand);

  // Handle confirmation callbacks
  bot.callbackQuery(/^confirm:/, async (ctx) => {
    const [, action, ...params] = ctx.callbackQuery.data.split(':');
    
    if (action === 'pay') {
      // Handle payment confirmation
      await ctx.answerCallbackQuery('Processing payment...');
      // The actual logic is in the pay command
    } else if (action === 'withdraw') {
      await ctx.answerCallbackQuery('Processing withdrawal...');
    }
  });

  bot.callbackQuery('cancel', async (ctx) => {
    ctx.session.awaitingConfirmation = undefined;
    await ctx.answerCallbackQuery('Cancelled');
    await ctx.editMessageText('❌ Operation cancelled.');
  });

  // Unknown command handler
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply(
        '❓ Unknown command. Use /help to see available commands.'
      );
    }
  });

  logger.info('Bot configured successfully');
  
  return bot;
}

/**
 * Set up bot commands menu
 */
export async function setupBotCommands(bot: Bot<BotContext>): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start using the bot' },
    { command: 'connect', description: 'Create a new wallet' },
    { command: 'balance', description: 'Check your wallet balance' },
    { command: 'pay', description: 'Send USDC to another wallet' },
    { command: 'limit', description: 'Set daily spending limit' },
    { command: 'withdraw', description: 'Withdraw to bank (fiat)' },
    { command: 'history', description: 'View transaction history' },
    { command: 'help', description: 'Show help message' },
  ]);
  
  logger.info('Bot commands menu set up');
}


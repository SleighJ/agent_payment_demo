/**
 * /start command - Welcome new users and create their account
 */

import type { BotContext } from '../index.js';
import { createUser, getUserByTelegramId } from '../../db/queries.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('StartCommand');

export async function startCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('❌ Could not identify your Telegram account.');
    return;
  }

  logger.info('User started bot', { telegramId, username });

  // Create or update user
  const existingUser = getUserByTelegramId(telegramId);
  const user = createUser(telegramId, username);

  const isNewUser = !existingUser;

  const welcomeMessage = isNewUser
    ? `
🎉 Welcome to Agent Payments!

I help AI agents and their humans manage money seamlessly.

🔐 **What I Do:**
• Create Solana wallets for you and your agents
• Enable instant USDC transfers between agents
• Track spending with daily limits
• Withdraw to your bank when needed

📱 **Get Started:**
1. Use /connect to create your first wallet
2. Fund it with USDC (devnet for testing)
3. Start sending payments!

Type /help to see all commands.

⚠️ **Devnet Mode:** This bot is running on Solana devnet. No real money is involved.
    `.trim()
    : `
👋 Welcome back, ${username ? `@${username}` : 'friend'}!

Your account is ready. Here's what you can do:

• /balance - Check your wallet
• /pay - Send USDC to someone
• /history - View transactions
• /help - See all commands
    `.trim();

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}


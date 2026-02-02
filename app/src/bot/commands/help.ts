/**
 * /help command - Show available commands and usage
 */

import type { BotContext } from '../index.js';

export async function helpCommand(ctx: BotContext): Promise<void> {
  const helpMessage = `
🤖 **Agent Payments Bot**

A payment infrastructure for AI agents and their humans.

**💼 Wallet Commands**
/start - Create your account
/connect - Create a new wallet
/connect agent - Create an agent wallet
/balance - Check wallet balances

**💸 Payment Commands**
/pay <address> <amount> - Send USDC
/limit - View spending limit
/limit <amount> - Set daily limit
/history - View transactions

**🏦 Fiat Commands**
/withdraw <amount> - Withdraw to bank (USD)

**ℹ️ Other**
/help - Show this message

**📝 Examples:**
\`/pay 7xKX...ABC 50\` - Send 50 USDC
\`/limit 500\` - Set $500 daily limit
\`/withdraw 100\` - Withdraw $100 to bank

**⚠️ Devnet Mode**
This bot is running on Solana devnet.
No real money is involved - perfect for testing!

**🔗 Links**
• [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
• [Get Devnet USDC](https://faucet.circle.com/)
  `.trim();

  await ctx.reply(helpMessage, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
  });
}


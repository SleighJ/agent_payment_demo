/**
 * Agent Payments Platform
 * 
 * Entry point for the Telegram bot that enables
 * AI agents to manage payments on Solana.
 */

import 'dotenv/config';
import { createBot, setupBotCommands } from './bot/index.js';
import { initDb, closeDb } from './db/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Main');

async function main() {
  logger.info('Starting Agent Payments Platform...');
  logger.info(`Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);

  // Initialize database (async for sql.js)
  await initDb();

  // Create and configure bot
  const bot = createBot();
  
  // Set up commands menu
  await setupBotCommands(bot);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await bot.stop();
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start bot
  logger.info('Bot is starting...');
  
  // Use long polling for development
  // In production, switch to webhooks
  await bot.start({
    onStart: (botInfo) => {
      logger.info(`Bot started as @${botInfo.username}`);
      logger.info('Ready to accept commands!');
    },
  });
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
